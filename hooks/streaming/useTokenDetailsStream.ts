/**
 * useTokenDetailsStream - WebSocket hook for token details real-time updates
 * Uses Mobula's token-details WebSocket stream
 * Provides real-time price, volume, and market data updates
 */

import { toMobulaChainId } from "@/constants/chains";
import { MOBULA_WS_URL } from "@/constants/endpoints";
import { WS_PING_INTERVAL, WS_RECONNECT_DELAY } from "@/constants/network";
import { TokenDetails, useTokenStore } from "@/store/tokenStore";
import { useCallback, useEffect, useRef, useState } from "react";

interface TokenDetailsStreamProps {
  address: string;
  blockchain: string;
  enabled?: boolean;
}

interface TokenDetailsUpdate {
  tokenData: {
    address: string;
    chainId: string;
    symbol: string;
    name: string;
    decimals?: number;
    logo?: string;
    description?: string;
    deployer?: string;

    // Pricing
    priceUSD: number;
    latestPriceUSD?: number;
    priceChange1minPercentage?: number;
    priceChange5minPercentage?: number;
    priceChange1hPercentage?: number;
    priceChange4hPercentage?: number;
    priceChange6hPercentage?: number;
    priceChange12hPercentage?: number;
    priceChange24hPercentage?: number;

    // All-time high/low
    athUSD?: number;
    atlUSD?: number;
    athDate?: string;
    atlDate?: string;

    // Market data
    marketCapUSD?: number;
    marketCapDilutedUSD?: number;
    liquidityUSD?: number;
    liquidityMaxUSD?: number;
    approximateReserveUSD?: number;

    // Volume by timeframe
    volume1minUSD?: number;
    volume5minUSD?: number;
    volume15minUSD?: number;
    volume1hUSD?: number;
    volume4hUSD?: number;
    volume6hUSD?: number;
    volume12hUSD?: number;
    volume24hUSD?: number;
    volumeBuy24hUSD?: number;
    volumeSell24hUSD?: number;

    // Supply
    totalSupply?: number;
    circulatingSupply?: number;

    // Holder distribution
    holdersCount?: number;
    top10HoldingsPercentage?: number;
    top50HoldingsPercentage?: number;
    top100HoldingsPercentage?: number;
    top200HoldingsPercentage?: number;
    devHoldingsPercentage?: number;
    insidersHoldingsPercentage?: number;
    bundlersHoldingsPercentage?: number;
    snipersHoldingsPercentage?: number;
    proTradersHoldingsPercentage?: number;

    // Trades by timeframe
    trades1min?: number;
    trades5min?: number;
    trades15min?: number;
    trades1h?: number;
    trades4h?: number;
    trades6h?: number;
    trades12h?: number;
    trades24h?: number;
    buys24h?: number;
    sells24h?: number;
    buyers24h?: number;
    sellers24h?: number;
    traders24h?: number;

    // Organic trading metrics
    organicTrades24h?: number;
    organicTraders24h?: number;
    organicVolume24hUSD?: number;

    // Fees
    feesPaid1hUSD?: number;
    feesPaid24hUSD?: number;
    totalFeesPaidUSD?: number;

    // Bonding
    bonded?: boolean;
    bondingPercentage?: number;
    bondedAt?: string;

    // Security
    security?: {
      honeypot?: boolean;
      rugPull?: boolean;
      scam?: boolean;
      verified?: boolean;
    };

    // Socials
    socials?: {
      twitter?: string;
      website?: string;
      telegram?: string;
      others?: Record<string, string>;
      uri?: string;
    };

    // Dexscreener
    dexscreenerListed?: boolean;
    dexscreenerAdPaid?: boolean;

    // Deployer/Twitter metrics
    deployerMigrationsCount?: number;
    twitterReusesCount?: number;
    twitterRenameCount?: number;

    // Exchange info
    exchange?: {
      name: string;
      logo?: string;
    };

    // Created timestamp
    createdAt?: string;
  };
  pair?: string;
  date?: number;
  type?: "buy" | "sell";
  token_amount?: number;
  token_amount_usd?: number;
  token_price?: number;
  hash?: string;
  sender?: string;
}

export function useTokenDetailsStream({
  address,
  blockchain,
  enabled = true,
}: TokenDetailsStreamProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const mountedRef = useRef(true);
  const isPausedRef = useRef(false);
  const isConnectingRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Use ref instead of state for lastUpdate to avoid unnecessary re-renders
  const lastUpdateRef = useRef<number | null>(null);

  // Batching refs for high-frequency updates
  const pendingTokenUpdateRef = useRef<Partial<TokenDetails> | null>(null);
  const pendingTradesRef = useRef<
    Array<{
      id: string;
      type: "buy" | "sell";
      amount: number;
      amountUsd: number;
      price: number;
      maker: string;
      timestamp: string;
      txHash: string;
    }>
  >([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BATCH_INTERVAL = 100; // Batch updates every 100ms

  // Store refs for stable references to avoid useEffect loops
  const updateTokenRef = useRef(useTokenStore.getState().updateToken);
  const addTradesBatchRef = useRef(useTokenStore.getState().addTradesBatch);

  // Keep refs up to date
  useEffect(() => {
    updateTokenRef.current = useTokenStore.getState().updateToken;
    addTradesBatchRef.current = useTokenStore.getState().addTradesBatch;
  });

  // Flush batched updates to the store
  const flushBatchedUpdates = useCallback(() => {
    if (!mountedRef.current) return;

    // Apply token updates
    if (pendingTokenUpdateRef.current) {
      updateTokenRef.current(pendingTokenUpdateRef.current);
      pendingTokenUpdateRef.current = null;
    }

    // Apply trade updates in a single batch operation
    if (pendingTradesRef.current.length > 0) {
      const trades = pendingTradesRef.current;
      pendingTradesRef.current = [];

      // Add all trades at once using batch method
      addTradesBatchRef.current(trades);
    }

    lastUpdateRef.current = Date.now();
    batchTimeoutRef.current = null;
  }, []);

  // Schedule a batched update
  const scheduleBatchUpdate = useCallback(() => {
    if (batchTimeoutRef.current) return; // Already scheduled

    batchTimeoutRef.current = setTimeout(() => {
      flushBatchedUpdates();
    }, BATCH_INTERVAL);
  }, [flushBatchedUpdates]);

  // Pause/resume callbacks
  const pauseStream = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    console.log("[TokenDetails] Stream paused");
  }, []);

  const resumeStream = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    console.log("[TokenDetails] Stream resumed");
  }, []);

  // Normalize blockchain to Mobula format using centralized function
  const getChainId = useCallback((chain: string): string => {
    return toMobulaChainId(chain);
  }, []);

  // Map WebSocket update to TokenDetails partial
  const mapTokenUpdate = useCallback(
    (data: TokenDetailsUpdate): Partial<TokenDetails> => {
      const tokenData = data.tokenData;
      if (!tokenData) return {};

      return {
        // Pricing
        price: tokenData.priceUSD ?? tokenData.latestPriceUSD,
        priceChange1m: tokenData.priceChange1minPercentage,
        priceChange5m: tokenData.priceChange5minPercentage,
        priceChange1h: tokenData.priceChange1hPercentage,
        priceChange4h: tokenData.priceChange4hPercentage,
        priceChange6h: tokenData.priceChange6hPercentage,
        priceChange12h: tokenData.priceChange12hPercentage,
        priceChange24h: tokenData.priceChange24hPercentage,

        // All-time high/low
        athUSD: tokenData.athUSD,
        atlUSD: tokenData.atlUSD,
        athDate: tokenData.athDate,
        atlDate: tokenData.atlDate,

        // Market data
        marketCap: tokenData.marketCapUSD,
        fullyDilutedValuation: tokenData.marketCapDilutedUSD,
        liquidity: tokenData.liquidityUSD,
        liquidityMaxUSD: tokenData.liquidityMaxUSD,
        approximateReserveUSD: tokenData.approximateReserveUSD,

        // Volume by timeframe
        volume1m: tokenData.volume1minUSD,
        volume5m: tokenData.volume5minUSD,
        volume15m: tokenData.volume15minUSD,
        volume1h: tokenData.volume1hUSD,
        volume4h: tokenData.volume4hUSD,
        volume6h: tokenData.volume6hUSD,
        volume12h: tokenData.volume12hUSD,
        volume24h: tokenData.volume24hUSD,
        volumeBuy24h: tokenData.volumeBuy24hUSD,
        volumeSell24h: tokenData.volumeSell24hUSD,

        // Supply
        totalSupply: tokenData.totalSupply,
        circulatingSupply: tokenData.circulatingSupply,

        // Holder distribution
        holdersCount: tokenData.holdersCount,
        top10HoldingsPercentage: tokenData.top10HoldingsPercentage,
        top50HoldingsPercentage: tokenData.top50HoldingsPercentage,
        top100HoldingsPercentage: tokenData.top100HoldingsPercentage,
        top200HoldingsPercentage: tokenData.top200HoldingsPercentage,
        devHoldingsPercentage: tokenData.devHoldingsPercentage,
        insidersHoldingsPercentage: tokenData.insidersHoldingsPercentage,
        bundlersHoldingsPercentage: tokenData.bundlersHoldingsPercentage,
        snipersHoldingsPercentage: tokenData.snipersHoldingsPercentage,
        proTradersHoldingsPercentage: tokenData.proTradersHoldingsPercentage,

        // Transactions
        trades1m: tokenData.trades1min,
        trades5m: tokenData.trades5min,
        trades15m: tokenData.trades15min,
        trades1h: tokenData.trades1h,
        trades4h: tokenData.trades4h,
        trades6h: tokenData.trades6h,
        trades12h: tokenData.trades12h,
        trades24h: tokenData.trades24h,
        txns24h: tokenData.trades24h,
        buys24h: tokenData.buys24h,
        sells24h: tokenData.sells24h,
        buyers24h: tokenData.buyers24h,
        sellers24h: tokenData.sellers24h,
        traders24h: tokenData.traders24h,
        makers24h: tokenData.traders24h,

        // Organic trading metrics
        organicTrades24h: tokenData.organicTrades24h,
        organicTraders24h: tokenData.organicTraders24h,
        organicVolume24h: tokenData.organicVolume24hUSD,

        // Fees
        feesPaid1h: tokenData.feesPaid1hUSD,
        feesPaid24h: tokenData.feesPaid24hUSD,
        totalFeesPaid: tokenData.totalFeesPaidUSD,

        // Bonding
        isBonded: tokenData.bonded,
        bondingPercentage: tokenData.bondingPercentage,
        bondedAt: tokenData.bondedAt,

        // Security
        security: tokenData.security,

        // Socials
        socials: tokenData.socials,
        twitter: tokenData.socials?.twitter,
        telegram: tokenData.socials?.telegram,
        website: tokenData.socials?.website,

        // Dexscreener
        dexscreenerListed: tokenData.dexscreenerListed,
        dexscreenerAdPaid: tokenData.dexscreenerAdPaid,

        // Deployer/Twitter metrics
        deployer: tokenData.deployer,
        deployerMigrationsCount: tokenData.deployerMigrationsCount,
        twitterReusesCount: tokenData.twitterReusesCount,
        twitterRenameCount: tokenData.twitterRenameCount,

        // Exchange
        exchange: tokenData.exchange,

        // Created timestamp
        createdAt: tokenData.createdAt,

        // Logo
        logo: tokenData.logo,
      };
    },
    [],
  );

  // Start ping interval to keep connection alive
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: "ping" }));
      }
    }, WS_PING_INTERVAL);
  }, []);

  // Stop ping interval
  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || !address || !blockchain) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (isConnectingRef.current) return; // Prevent multiple connection attempts

    isConnectingRef.current = true;

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const apiKey = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";
    const chainId = getChainId(blockchain);

    try {
      wsRef.current = new WebSocket(MOBULA_WS_URL);

      wsRef.current.onopen = () => {
        if (!mountedRef.current) return;
        isConnectingRef.current = false;
        console.log("[TokenDetails] WebSocket connected");
        setIsConnected(true);

        // Subscribe to token-details stream
        const subscription = {
          type: "token-details",
          authorization: apiKey,
          payload: {
            tokens: [
              {
                blockchain: chainId,
                address: address,
              },
            ],
            subscriptionTracking: true,
          },
        };

        wsRef.current?.send(JSON.stringify(subscription));
        startPingInterval();
      };

      wsRef.current.onmessage = (event) => {
        if (!mountedRef.current) return;
        // Skip processing if paused
        if (isPausedRef.current) return;

        try {
          const data = JSON.parse(event.data);

          // Handle pong
          if (data.event === "pong") {
            return;
          }

          // Handle token update with trade data - use batching to prevent overwhelming React
          if (data.tokenData) {
            const updates = mapTokenUpdate(data);
            if (Object.keys(updates).length > 0) {
              // Merge with pending updates instead of immediate update
              pendingTokenUpdateRef.current = {
                ...pendingTokenUpdateRef.current,
                ...updates,
              };
            }

            // If this update includes a trade, queue it for batching
            if (data.hash && data.type) {
              // Limit pending trades to prevent memory issues
              if (pendingTradesRef.current.length < 50) {
                pendingTradesRef.current.push({
                  id: data.hash,
                  type: data.type as "buy" | "sell",
                  amount: data.token_amount || 0,
                  amountUsd: data.token_amount_usd || 0,
                  price: data.token_price || data.tokenData.priceUSD,
                  maker: data.sender || "",
                  timestamp: new Date(data.date || Date.now()).toISOString(),
                  txHash: data.hash,
                });
              }
            }

            // Schedule batch update
            scheduleBatchUpdate();
          }
        } catch (err) {
          console.error("[TokenDetails] Failed to parse message:", err);
        }
      };

      wsRef.current.onerror = (error) => {
        isConnectingRef.current = false;
        console.error("[TokenDetails] WebSocket error:", error);
      };

      wsRef.current.onclose = () => {
        if (!mountedRef.current) return;
        isConnectingRef.current = false;
        console.log("[TokenDetails] WebSocket closed");
        setIsConnected(false);
        stopPingInterval();

        // Attempt reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && enabled) {
            connect();
          }
        }, WS_RECONNECT_DELAY);
      };
    } catch (err) {
      isConnectingRef.current = false;
      console.error("[TokenDetails] Failed to connect:", err);
    }
  }, [
    address,
    blockchain,
    enabled,
    getChainId,
    mapTokenUpdate,
    scheduleBatchUpdate,
    startPingInterval,
    stopPingInterval,
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    stopPingInterval();

    // Clear batch timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    // Clear pending updates
    pendingTokenUpdateRef.current = null;
    pendingTradesRef.current = [];

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [stopPingInterval]);

  // Connect on mount, disconnect on unmount
  // Use a separate ref for connect function to avoid dependency loop
  const connectRef = useRef(connect);
  connectRef.current = connect;

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  useEffect(() => {
    mountedRef.current = true;

    if (enabled && address && blockchain) {
      connectRef.current();
    }

    return () => {
      mountedRef.current = false;
      disconnectRef.current();
    };
  }, [address, blockchain, enabled]); // Only depend on data, not callbacks

  return {
    isConnected,
    isPaused,
    lastUpdate: lastUpdateRef.current,
    pauseStream,
    resumeStream,
    reconnect: connect,
    disconnect,
  };
}
