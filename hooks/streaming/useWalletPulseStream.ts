/**
 * useWalletPulseStream - WebSocket hook for Wallet Page tabs
 * Uses Pulse V2 API with custom views for:
 * - Verified (DexScreener listed)
 * - Trending (fees paid 5 min)
 * - Most Held (holder count)
 * - Graduated (bonded tokens)
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { MOBULA_PULSE_WS_URL } from "@/constants/endpoints";

import { PulseToken, RawPulseToken } from "@/store/pulseStore";
import {
  getWalletTabViews,
  normalizeToken,
  useWalletTabsStore,
  WalletTabName,
} from "@/store/walletTabsStore";
import { UpdateBatcher } from "@/utils/UpdateBatcher";

interface WalletTabViewData {
  data?: RawPulseToken[];
  tokens?: RawPulseToken[];
}

interface WalletPulseMessage {
  type: "init" | "new-token" | "update-token" | "remove-token";
  payload: {
    verified?: WalletTabViewData;
    trending?: WalletTabViewData;
    mostHeld?: WalletTabViewData;
    graduated?: WalletTabViewData;
    viewName?: string;
    token?: RawPulseToken;
    tokenKey?: string;
  };
}

type TimeoutRef = ReturnType<typeof setTimeout> | null;

export interface UseWalletPulseStreamOptions {
  enabled?: boolean;
}

export interface UseWalletPulseStreamReturn {
  isConnected: boolean;
  isStreaming: boolean;
  isPaused: boolean;
  error: string | null;
  pauseStream: () => void;
  resumeStream: () => void;
  reconnect: () => void;
}

export function useWalletPulseStream(
  options: UseWalletPulseStreamOptions = {},
): UseWalletPulseStreamReturn {
  const { enabled = true } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<TimeoutRef>(null);
  const reconnectAttemptsRef = useRef(0);
  const isSubscriptionPausedRef = useRef(false);
  const pingIntervalRef = useRef<TimeoutRef>(null);
  const apiKey = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";

  const [error, setError] = useState<string | null>(null);

  // Get store instance
  const store = useWalletTabsStore;

  // Store actions
  const setTokens = useWalletTabsStore((state) => state.setTokens);
  const setLoading = useWalletTabsStore((state) => state.setLoading);
  const setConnected = useWalletTabsStore((state) => state.setConnected);
  const setStreaming = useWalletTabsStore((state) => state.setStreaming);
  const setPaused = useWalletTabsStore((state) => state.setPaused);
  const setStoreError = useWalletTabsStore((state) => state.setError);
  const isConnected = useWalletTabsStore((state) => state.isConnected);
  const isStreaming = useWalletTabsStore((state) => state.isStreaming);
  const isPaused = useWalletTabsStore((state) => state.isPaused);

  // Token update batcher
  const tokenBatcherRef = useRef<
    UpdateBatcher<{ tab: WalletTabName; token: PulseToken }>
  >(
    new UpdateBatcher(
      (updates) => {
        const { mergeToken } = store.getState();

        // Deduplicate by keeping only the latest update per token
        const latestByKey = new Map<
          string,
          { tab: WalletTabName; token: PulseToken }
        >();
        updates.forEach((update) => {
          const key = `${update.tab}-${update.token.address}`;
          latestByKey.set(key, update);
        });

        // Apply all updates
        latestByKey.forEach(({ tab, token }) => {
          mergeToken(tab, token);
        });
      },
      50,
      300,
    ),
  );

  // Map view name from API to our tab name
  const mapViewNameToTab = (viewName: string): WalletTabName | null => {
    const mapping: Record<string, WalletTabName> = {
      verified: "verified",
      trending: "trending",
      mostHeld: "mostHeld",
      graduated: "graduated",
      // Also handle model names that might come back
      bonding: "mostHeld",
      bonded: "graduated",
    };
    return mapping[viewName] || null;
  };

  // Process init data immediately
  const processInitData = useCallback(
    (payload: WalletPulseMessage["payload"]) => {
      // Try extracting by our custom view names first
      const viewNames: WalletTabName[] = [
        "verified",
        "trending",
        "mostHeld",
        "graduated",
      ];
      let foundData = false;

      viewNames.forEach((viewName) => {
        const viewData = (payload as any)[viewName];
        if (viewData) {
          foundData = true;
          const rawTokens = viewData.data || viewData.tokens || [];
          const rawArray = Array.isArray(rawTokens) ? rawTokens : [rawTokens];

          const normalizedTokens: PulseToken[] = [];
          rawArray.forEach((raw) => {
            const normalized = normalizeToken(raw);
            if (normalized) {
              normalizedTokens.push(normalized);
            }
          });

          if (normalizedTokens.length > 0) {
            setTokens(viewName, normalizedTokens);
          }
          setLoading(viewName, false);
        }
      });

      // If no data found by view names, try by model names
      if (!foundData) {
        const modelToTabs: Record<string, WalletTabName[]> = {
          bonded: ["verified", "graduated"],
          new: ["trending"],
          bonding: ["mostHeld"],
        };

        Object.entries(modelToTabs).forEach(([modelName, tabs]) => {
          const modelData = (payload as any)[modelName];
          if (modelData) {
            foundData = true;
            const rawTokens = modelData.data || modelData.tokens || [];
            const rawArray = Array.isArray(rawTokens) ? rawTokens : [rawTokens];

            const normalizedTokens: PulseToken[] = [];
            rawArray.forEach((raw) => {
              const normalized = normalizeToken(raw);
              if (normalized) {
                normalizedTokens.push(normalized);
              }
            });

            // Set same tokens for all tabs that use this model
            tabs.forEach((tab) => {
              if (normalizedTokens.length > 0) {
                setTokens(tab, normalizedTokens);
              }
              setLoading(tab, false);
            });
          }
        });
      }

      viewNames.forEach((tab) => {
        setLoading(tab, false);
      });
    },
    [setTokens, setLoading],
  );

  const sendSubscription = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    const views = getWalletTabViews();

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

    // Show loading state for all tabs
    (["verified", "trending", "mostHeld", "graduated"] as const).forEach(
      (tab) => {
        setLoading(tab, true);
      },
    );
  }, [apiKey, setLoading, setStreaming]);

  const handleMessage = useCallback(
    (message: WalletPulseMessage | { error: string; details?: unknown }) => {
      // Skip processing if internally paused
      if (isSubscriptionPausedRef.current) {
        return;
      }

      // Handle error responses
      if ("error" in message) {
        console.error(
          "[WalletPulseWS] API Error:",
          message.error,
          message.details,
        );
        setError(message.error);
        // Stop loading on all tabs
        (["verified", "trending", "mostHeld", "graduated"] as const).forEach(
          (tab) => {
            setLoading(tab, false);
            setStoreError(tab, message.error);
          },
        );
        return;
      }

      if (message.type === "init") {
        processInitData(message.payload);
      } else if (
        message.type === "new-token" ||
        message.type === "update-token"
      ) {
        const { viewName, token: rawToken } = message.payload;

        if (viewName && rawToken) {
          const tab = mapViewNameToTab(viewName);
          if (tab) {
            const normalized = normalizeToken(rawToken);
            if (normalized) {
              // Set loading to false when we receive the first token for a tab
              const { tabs } = store.getState();
              if (tabs[tab].loading) {
                setLoading(tab, false);
              }

              tokenBatcherRef.current.add({ tab, token: normalized });
            }
          }
        }
      } else if (message.type === "remove-token") {
        const { viewName, tokenKey } = message.payload;

        if (viewName && tokenKey) {
          const tab = mapViewNameToTab(viewName);
          if (tab) {
            const { removeToken } = store.getState();
            removeToken(tab, tokenKey);
          }
        }
      }
    },
    [processInitData, store],
  );

  const startPingInterval = useCallback(() => {
    // Clear existing interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    // Send ping every 30 seconds
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: "ping" }));
      }
    }, 30000);
  }, []);

  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

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

        // Start ping interval
        startPingInterval();

        // Send subscription
        sendSubscription();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WalletPulseMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          // Silent parse error
        }
      };

      wsRef.current.onerror = () => {
        setError("WebSocket error");
      };

      wsRef.current.onclose = () => {
        setConnected(false);
        setStreaming(false);
        stopPingInterval();
        attemptReconnect();
      };
    } catch (err) {
      setError("Failed to connect");
    }
  }, [
    enabled,
    apiKey,
    sendSubscription,
    handleMessage,
    setConnected,
    setStreaming,
    startPingInterval,
    stopPingInterval,
  ]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= 5) {
      setError("Connection lost. Please refresh.");
      return;
    }

    const delay = Math.min(
      2000 * Math.pow(2, reconnectAttemptsRef.current),
      30000,
    );
    reconnectAttemptsRef.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopPingInterval();
    tokenBatcherRef.current.clear();

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
    setStreaming(false);
  }, [setConnected, setStreaming, stopPingInterval]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [disconnect, connect]);

  const pauseStream = useCallback(() => {
    isSubscriptionPausedRef.current = true;
    setPaused(true);
    console.log("[WalletPulseWS] Stream paused");
  }, [setPaused]);

  const resumeStream = useCallback(() => {
    isSubscriptionPausedRef.current = false;
    setPaused(false);
    console.log("[WalletPulseWS] Stream resumed");
  }, [setPaused]);

  // Initial connection
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled]);

  return {
    isConnected,
    isStreaming,
    isPaused,
    error,
    pauseStream,
    resumeStream,
    reconnect,
  };
}

/**
 * Convenience hook for using wallet tab data
 */
export function useWalletTab(tabName: WalletTabName) {
  const tokens = useWalletTabsStore((state) => state.tabs[tabName].tokens);
  const loading = useWalletTabsStore((state) => state.tabs[tabName].loading);
  const tabError = useWalletTabsStore((state) => state.tabs[tabName].error);
  const lastUpdate = useWalletTabsStore(
    (state) => state.tabs[tabName].lastUpdate,
  );

  return {
    tokens,
    loading,
    error: tabError,
    lastUpdate,
    tokenCount: tokens.length,
  };
}
