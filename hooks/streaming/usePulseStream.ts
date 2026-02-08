/**
 * usePulseStream - WebSocket hook for Pulse V2 streaming
 * Connects to Mobula's pulse-v2 stream for real-time token updates
 *
 * Performance optimizations:
 * - Uses UpdateBatcher for batched updates (prevents UI freezing)
 * - Internal pause state separate from UI pause
 * - Throttled token updates
 * - Immediate processing for init messages (no batching)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

import { MOBULA_PULSE_WS_URL } from "@/constants/endpoints";
import { PULSE_DEFAULT_LIMIT } from "@/constants/pagination";

import type { PulseToken, RawPulseToken } from "@/lib";
import { normalizeToken } from "@/lib";
import { usePulseStore, ViewName } from "@/store/pulseStore";
import { UpdateBatcher } from "@/utils/UpdateBatcher";
import { wsLogger } from "@/utils/logger";
import { useShallow } from "@/utils/storeUtils";

interface PulseView {
  name: string;
  chainId: string[];
  limit: number;
  model: string;
  filters?: Record<string, unknown>;
}

interface PulsePayload {
  assetMode: boolean;
  compressed: boolean;
  views: PulseView[];
}

interface PulseViewData {
  data?: RawPulseToken[];
  tokens?: RawPulseToken[];
}

interface PulseMessage {
  type: "init" | "update-token";
  payload: {
    new?: PulseViewData;
    bonding?: PulseViewData;
    bonded?: PulseViewData;
    viewName?: ViewName;
    token?: RawPulseToken;
  };
}

// Timeout type that works in both React Native and Node.js
type TimeoutRef = ReturnType<typeof setTimeout> | null;

export interface UsePulseStreamOptions {
  enabled?: boolean;
  chainIds?: string[];
  protocols?: string[];
}

export interface UsePulseStreamReturn {
  isConnected: boolean;
  isStreaming: boolean;
  isPaused: boolean;
  error: string | null;
  pauseStream: () => void;
  resumeStream: () => void;
  applyFilters: (view: ViewName) => void;
}

export function usePulseStream(
  options: UsePulseStreamOptions = {},
): UsePulseStreamReturn {
  const {
    enabled = true,
    chainIds = ["solana:solana"],
    protocols = [],
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<TimeoutRef>(null);
  const reconnectAttemptsRef = useRef(0);
  const isSubscriptionPausedRef = useRef(false);
  const apiKey = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";

  const [error, setError] = useState<string | null>(null);

  // Get store instance for direct access in batcher (avoids stale closure)
  const pulseStore = usePulseStore;

  // Use shallow comparison for selecting multiple actions/state (prevents re-renders)
  const {
    setTokens,
    setLoading,
    setConnected,
    setStreaming,
    setPaused,
    clearView,
  } = usePulseStore(
    useShallow((state) => ({
      setTokens: state.setTokens,
      setLoading: state.setLoading,
      setConnected: state.setConnected,
      setStreaming: state.setStreaming,
      setPaused: state.setPaused,
      clearView: state.clearView,
    })),
  );

  // Read-only state with shallow comparison
  const { isConnected, isStreaming, isPaused } = usePulseStore(
    useShallow((state) => ({
      isConnected: state.isConnected,
      isStreaming: state.isStreaming,
      isPaused: state.isPaused,
    })),
  );

  // Token update batcher - access store directly to avoid stale closures
  const tokenBatcherRef = useRef<
    UpdateBatcher<{ view: ViewName; token: PulseToken }>
  >(
    new UpdateBatcher(
      (updates) => {
        wsLogger.log(`Batcher flushing ${updates.length} updates`);

        // Get fresh mergeToken function from store
        const { mergeToken } = pulseStore.getState();

        // Deduplicate by keeping only the latest update per token
        const latestByKey = new Map<
          string,
          { view: ViewName; token: PulseToken }
        >();
        updates.forEach((update) => {
          const key = `${update.view}-${update.token.address}`;
          latestByKey.set(key, update);
        });

        // Apply all updates
        latestByKey.forEach(({ view, token }) => {
          mergeToken(view, token);
        });
      },
      50, // max 50 updates per batch
      300, // throttle to 300ms (mobile-friendly)
    ),
  );

  // Process init data immediately (no batching)
  const processInitData = useCallback(
    (payload: PulseMessage["payload"]) => {
      // Handle both 'tokens' and 'data' field names (API inconsistency)
      const views: ViewName[] = ["new", "bonding", "bonded"];

      views.forEach((view) => {
        const viewData = payload[view];
        if (viewData) {
          // API returns data in 'data' field
          const rawTokens = viewData.data || viewData.tokens || [];
          const rawArray = Array.isArray(rawTokens) ? rawTokens : [rawTokens];

          // Normalize tokens from API format (snake_case, nested) to our format
          const normalizedTokens: PulseToken[] = [];
          rawArray.forEach((raw) => {
            const normalized = normalizeToken(raw);
            if (normalized) {
              normalizedTokens.push(normalized);
            }
          });

          if (normalizedTokens.length > 0) {
            setTokens(view, normalizedTokens);
            setLoading(view, false);
          } else {
            setLoading(view, false);
          }
        }
      });
    },
    [setTokens, setLoading],
  );

  const sendSubscription = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn("[PulseWS] Cannot subscribe: not connected");
      return;
    }

    // Get filters from store for each view
    const { buildWebSocketFilters, appliedFilters } = pulseStore.getState();

    // Build views array with filters (MTT format)
    const views = (["new", "bonding", "bonded"] as const).map((viewName) => {
      const wsFilters = buildWebSocketFilters(viewName);
      const chainIds =
        appliedFilters[viewName].chainIds.length > 0
          ? appliedFilters[viewName].chainIds
          : ["solana:solana"];

      const view: Record<string, unknown> = {
        name: viewName,
        chainId: chainIds,
        limit: PULSE_DEFAULT_LIMIT,
        model: viewName,
      };

      // Only add filters if there are any
      if (Object.keys(wsFilters).length > 0) {
        view.filters = wsFilters;
      }

      return view;
    });

    const payload = {
      assetMode: true,
      compressed: false,
      views,
    };

    const message = {
      type: "pulse-v2",
      authorization: apiKey,
      payload,
    };

    wsRef.current.send(JSON.stringify(message));
    setStreaming(true);

    // Show loading state
    (["new", "bonding", "bonded"] as const).forEach((view) => {
      setLoading(view, true);
    });
  }, [apiKey, setLoading, setStreaming, pulseStore]);

  const handleMessage = useCallback(
    (message: PulseMessage) => {
      // Skip processing if internally paused
      if (isSubscriptionPausedRef.current) {
        return;
      }

      if (message.type === "init") {
        // Process init data IMMEDIATELY (no batching) for fast initial load
        processInitData(message.payload);
      } else if (message.type === "update-token") {
        // Queue token update for batched processing
        const { viewName, token: rawToken } = message.payload;

        if (viewName && rawToken) {
          // Normalize the token before batching
          const normalized = normalizeToken(rawToken);
          if (normalized) {
            tokenBatcherRef.current.add({ view: viewName, token: normalized });
          }
        }
      }
    },
    [processInitData],
  );

  const connect = useCallback(() => {
    if (!enabled || !apiKey) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(MOBULA_PULSE_WS_URL);

      wsRef.current.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Send subscription
        sendSubscription();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: PulseMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error("[PulseWS] Parse error:", err);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error("[PulseWS] Error:", event);
        setError("WebSocket error");
      };

      wsRef.current.onclose = (event) => {
        console.log("[PulseWS] Closed:", event.code, event.reason);
        setConnected(false);
        setStreaming(false);
        attemptReconnect();
      };
    } catch (err) {
      console.error("[PulseWS] Failed to connect:", err);
      setError("Failed to connect");
    }
  }, [
    enabled,
    apiKey,
    sendSubscription,
    handleMessage,
    setConnected,
    setStreaming,
  ]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= 5) {
      console.log("[PulseWS] Max reconnect attempts reached");
      setError("Connection lost. Please refresh.");
      return;
    }

    const delay = Math.min(
      2000 * Math.pow(2, reconnectAttemptsRef.current),
      30000,
    );
    reconnectAttemptsRef.current += 1;

    console.log(
      `[PulseWS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`,
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear batcher
    tokenBatcherRef.current.clear();

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
    setStreaming(false);
  }, [setConnected, setStreaming]);

  const pauseStream = useCallback(() => {
    isSubscriptionPausedRef.current = true;
    setPaused(true);
    console.log("[PulseWS] Stream paused");
  }, [setPaused]);

  const resumeStream = useCallback(() => {
    isSubscriptionPausedRef.current = false;
    setPaused(false);
    console.log("[PulseWS] Stream resumed");
  }, [setPaused]);

  // Get filtersVersion from store to trigger resubscription
  const filtersVersion = usePulseStore((state) => state.filtersVersion);
  const storeApplyFilters = usePulseStore((state) => state.applyFilters);

  const applyFilters = useCallback(
    (view: ViewName) => {
      // Call store's applyFilters which copies filters to appliedFilters
      // and increments filtersVersion
      storeApplyFilters(view);
      // Note: The resubscription is triggered by the filtersVersion effect below
    },
    [storeApplyFilters],
  );

  // Initial connection
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled]);

  // Reconnect when chainIds change
  useEffect(() => {
    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      sendSubscription();
    }
  }, [chainIds.join(",")]);

  // Resubscribe when filters are applied (filtersVersion changes)
  useEffect(() => {
    if (
      filtersVersion > 0 &&
      isConnected &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      console.log(
        `[PulseWS] Filters applied (version ${filtersVersion}), resubscribing...`,
      );
      sendSubscription();
    }
  }, [filtersVersion]);

  return {
    isConnected,
    isStreaming,
    isPaused,
    error,
    pauseStream,
    resumeStream,
    applyFilters,
  };
}

/**
 * Convenience hook for using Pulse data in a specific view
 * Uses the store's getFilteredTokens for consistent filtering
 */
export function usePulseSection(viewName: ViewName) {
  const tokens = usePulseStore((state) => state.sections[viewName].tokens);
  const loading = usePulseStore((state) => state.sections[viewName].loading);
  const sectionError = usePulseStore((state) => state.sections[viewName].error);
  const searchQuery = usePulseStore(
    (state) => state.sections[viewName].searchQuery,
  );
  const filter = usePulseStore((state) => state.filters[viewName]);
  const setSearchQuery = usePulseStore((state) => state.setSearchQuery);

  // Get filtered tokens directly using the store function
  // We call getState() to ensure we get fresh data on each render
  const filteredTokens = React.useMemo(() => {
    return usePulseStore.getState().getFilteredTokens(viewName);
  }, [viewName, tokens, searchQuery, filter]);

  // Check if any non-default filters are set
  const { socials, metrics, audits } = filter;
  const hasFilters =
    filter.protocols.length > 0 ||
    filter.includeKeywords.trim().length > 0 ||
    filter.excludeKeywords.trim().length > 0 ||
    // Audits
    audits.dexPaid ||
    audits.caEndsInPump ||
    audits.age.min !== undefined ||
    audits.age.max !== undefined ||
    audits.holders.min !== undefined ||
    audits.holders.max !== undefined ||
    audits.top10HoldersPercent.min !== undefined ||
    audits.top10HoldersPercent.max !== undefined ||
    audits.devHoldingPercent.min !== undefined ||
    audits.devHoldingPercent.max !== undefined ||
    audits.snipersPercent.min !== undefined ||
    audits.snipersPercent.max !== undefined ||
    audits.insidersPercent.min !== undefined ||
    audits.insidersPercent.max !== undefined ||
    audits.bundlePercent.min !== undefined ||
    audits.bundlePercent.max !== undefined ||
    // Metrics
    metrics.liquidity.min !== undefined ||
    metrics.liquidity.max !== undefined ||
    metrics.volume.min !== undefined ||
    metrics.volume.max !== undefined ||
    metrics.marketCap.min !== undefined ||
    metrics.marketCap.max !== undefined ||
    metrics.bCurvePercent.min !== undefined ||
    metrics.bCurvePercent.max !== undefined ||
    // Socials
    socials.twitter ||
    socials.website ||
    socials.telegram ||
    socials.atLeastOneSocial ||
    socials.onlyPumpLive;

  return {
    tokens,
    filteredTokens,
    isLoading: loading,
    error: sectionError,
    searchQuery,
    setSearch: (query: string) => setSearchQuery(viewName, query),
    hasFilters,
    tokenCount: tokens.length,
    filteredCount: filteredTokens.length,
  };
}
