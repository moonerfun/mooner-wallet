/**
 * TradingView Chart Component
 * Embeds lightweight-charts via WebView
 * Uses Mobula's Token OHLCV History API for candle data
 * Real-time updates via OHLCV WebSocket stream
 */

import { useTheme } from "@/contexts/ThemeContext";
import React, { memo, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

interface TradingViewChartProps {
  address: string;
  blockchain: string;
  symbol?: string;
  interval?: string;
  onIntervalChange?: (interval: string) => void;
}

const INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

// Import from centralized chains
import { toMobulaChainId } from "@/constants/chains";

// Map blockchain name to Mobula chainId format
const getChainId = (chain: string): string => {
  return toMobulaChainId(chain);
};

export const TradingViewChart = memo(
  ({
    address,
    blockchain,
    symbol = "TOKEN",
    interval = "15m",
    onIntervalChange,
  }: TradingViewChartProps) => {
    const { theme, isDark } = useTheme();
    const [isLoading, setIsLoading] = useState(true);

    // Get Mobula API key from env
    const apiKey = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";

    // Map interval to API period format
    const period = interval;

    // Map blockchain to Mobula chainId format
    const chainId = getChainId(blockchain);

    // Generate HTML for the chart using lightweight-charts library
    const chartHtml = useMemo(() => {
      const backgroundColor = isDark ? "#0D0D0D" : "#FFFFFF";
      const textColor = isDark ? "#D1D5DB" : "#374151";
      const gridColor = isDark ? "#1F2937" : "#E5E7EB";
      const upColor = "#22C55E";
      const downColor = "#EF4444";

      return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      background: ${backgroundColor};
      overflow: hidden;
    }
    #chart { width: 100%; height: 100%; }
    .status {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: ${textColor};
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      text-align: center;
    }
    .status.error { color: #EF4444; }
    .status small { display: block; margin-top: 8px; opacity: 0.7; font-size: 11px; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <div id="status" class="status">Loading chart...</div>
  
  <script>
    const container = document.getElementById('chart');
    const statusEl = document.getElementById('status');
    let chart, candleSeries, volumeSeries;
    let ws = null;
    let lastCandleTime = 0;
    let lastCandleClose = 0;
    
    // Convert period string to seconds for timestamp alignment
    function getPeriodSeconds(period) {
      const periodMap = {
        '1s': 1,
        '5s': 5,
        '15s': 15,
        '30s': 30,
        '1m': 60,
        '1min': 60,
        '1': 60,
        '5m': 300,
        '5min': 300,
        '5': 300,
        '15m': 900,
        '15min': 900,
        '15': 900,
        '1h': 3600,
        '60': 3600,
        '4h': 14400,
        '240': 14400,
        '1d': 86400,
        '1D': 86400,
        '1w': 604800,
        '1W': 604800,
      };
      return periodMap[period] || 60; // Default to 1 minute
    }
    
    // Initialize chart
    function initChart() {
      chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { type: 'solid', color: '${backgroundColor}' },
          textColor: '${textColor}',
        },
        grid: {
          vertLines: { color: '${gridColor}' },
          horzLines: { color: '${gridColor}' },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: '${gridColor}',
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        timeScale: {
          borderColor: '${gridColor}',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { vertTouchDrag: false },
      });

      // Candlestick series with custom price format for small values
      candleSeries = chart.addCandlestickSeries({
        upColor: '${upColor}',
        downColor: '${downColor}',
        borderUpColor: '${upColor}',
        borderDownColor: '${downColor}',
        wickUpColor: '${upColor}',
        wickDownColor: '${downColor}',
        priceFormat: {
          type: 'custom',
          minMove: 0.00000001,
          formatter: (price) => {
            if (price === 0) return '0';
            if (Math.abs(price) >= 1000) return price.toFixed(2);
            if (Math.abs(price) >= 1) return price.toFixed(4);
            if (Math.abs(price) >= 0.0001) return price.toFixed(6);
            if (Math.abs(price) >= 0.00000001) return price.toFixed(10);
            return price.toExponential(4);
          },
        },
      });

      // Volume series
      volumeSeries = chart.addHistogramSeries({
        color: '#6B7280',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      // Resize handler
      const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || !chart) return;
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      });
      resizeObserver.observe(container);
    }

    // Fetch historical OHLCV data from Mobula Token OHLCV History API
    async function fetchHistoricalData() {
      try {
        const now = Date.now();
        const from = now - (7 * 24 * 60 * 60 * 1000); // 7 days of data
        
        // Use the Token OHLCV History endpoint (api/2/token/ohlcv-history)
        const url = 'https://api.mobula.io/api/2/token/ohlcv-history?address=${address}&chainId=${chainId}&period=${period}&from=' + from + '&to=' + now;
        
        console.log('Fetching OHLCV history:', url);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': '${apiKey}',
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          const text = await response.text();
          console.error('API error response:', text);
          throw new Error('API error ' + response.status);
        }
        
        const result = await response.json();
        console.log('OHLCV API response keys:', Object.keys(result));
        
        const data = result.data || [];
        
        if (!data || data.length === 0) {
          throw new Error('No OHLCV data available');
        }
        
        // Log first candle to debug data format
        console.log('First raw candle:', JSON.stringify(data[0]));
        console.log('Total candles:', data.length);
        
        // Get period in seconds for timestamp alignment
        const periodSeconds = getPeriodSeconds('${period}');
        
        // Transform API response to chart format
        // API returns: { t: timestamp, o: open, h: high, l: low, c: close, v: volume }
        // Align timestamps to period boundaries for consistency
        const candles = data.map(d => {
          const timeInSeconds = Math.floor(d.t / 1000);
          const alignedTime = Math.floor(timeInSeconds / periodSeconds) * periodSeconds;
          return {
            time: alignedTime,
            open: parseFloat(d.o) || 0,
            high: parseFloat(d.h) || 0,
            low: parseFloat(d.l) || 0,
            close: parseFloat(d.c) || 0,
          };
        }).sort((a, b) => a.time - b.time);
        
        // Remove duplicates (keep the last one for each timestamp)
        const uniqueCandles = [];
        const seenTimes = new Set();
        for (let i = candles.length - 1; i >= 0; i--) {
          if (!seenTimes.has(candles[i].time)) {
            seenTimes.add(candles[i].time);
            uniqueCandles.unshift(candles[i]);
          }
        }
        
        // Fill gaps between candles to ensure visual continuity
        // This creates flat candles for missing periods
        const filledCandles = [];
        for (let i = 0; i < uniqueCandles.length; i++) {
          const current = uniqueCandles[i];
          
          if (i > 0) {
            const prev = filledCandles[filledCandles.length - 1];
            const expectedTime = prev.time + periodSeconds;
            
            // Fill any gaps with flat candles using previous close
            while (expectedTime < current.time) {
              const gapTime = prev.time + periodSeconds * (filledCandles.length > 0 ? 1 : 1);
              if (gapTime >= current.time) break;
              
              // Only fill reasonable gaps (max 50 periods to avoid excessive fills)
              const gapCount = (current.time - prev.time) / periodSeconds;
              if (gapCount > 50) break;
              
              const lastFilled = filledCandles[filledCandles.length - 1];
              const nextGapTime = lastFilled.time + periodSeconds;
              if (nextGapTime >= current.time) break;
              
              filledCandles.push({
                time: nextGapTime,
                open: lastFilled.close,
                high: lastFilled.close,
                low: lastFilled.close,
                close: lastFilled.close,
              });
            }
            
            // Adjust current candle's open to match previous close for visual continuity
            current.open = prev.close;
            // Ensure high/low encompass the adjusted open
            current.high = Math.max(current.high, current.open);
            current.low = Math.min(current.low, current.open);
          }
          
          filledCandles.push(current);
        }
        
        // Log first transformed candle
        console.log('First transformed candle:', JSON.stringify(filledCandles[0]));
        console.log('Filled candles count:', filledCandles.length);
        
        const volumes = data.map(d => {
          const timeInSeconds = Math.floor(d.t / 1000);
          const alignedTime = Math.floor(timeInSeconds / periodSeconds) * periodSeconds;
          return {
            time: alignedTime,
            value: parseFloat(d.v) || 0,
            color: parseFloat(d.c) >= parseFloat(d.o) ? '${upColor}40' : '${downColor}40',
          };
        }).sort((a, b) => a.time - b.time);
        
        // Remove duplicate volumes
        const uniqueVolumes = [];
        const seenVolumeTimes = new Set();
        for (let i = volumes.length - 1; i >= 0; i--) {
          if (!seenVolumeTimes.has(volumes[i].time)) {
            seenVolumeTimes.add(volumes[i].time);
            uniqueVolumes.unshift(volumes[i]);
          }
        }
        
        candleSeries.setData(filledCandles);
        volumeSeries.setData(uniqueVolumes);
        
        // Track last candle for continuity with real-time updates
        if (filledCandles.length > 0) {
          const lastCandle = filledCandles[filledCandles.length - 1];
          lastCandleTime = lastCandle.time;
          lastCandleClose = lastCandle.close;
        }
        
        statusEl.style.display = 'none';
        chart.timeScale().fitContent();
        
        // Notify React Native
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready' }));
        
        return candles;
      } catch (error) {
        console.error('Fetch error:', error);
        throw error;
      }
    }
    
    // Connect to OHLCV WebSocket for real-time updates
    function connectWebSocket() {
      if (ws) {
        ws.close();
      }
      
      ws = new WebSocket('wss://api.mobula.io');
      
      ws.onopen = () => {
        console.log('OHLCV WebSocket connected');
        // Subscribe to OHLCV stream for this token
        const subscriptionMsg = {
          type: 'ohlcv',
          authorization: '${apiKey}',
          payload: {
            asset: '${address}',
            chainId: '${chainId}',
            period: '${period}',
            subscriptionTracking: true
          }
        };
        console.log('Sending OHLCV subscription:', JSON.stringify(subscriptionMsg));
        ws.send(JSON.stringify(subscriptionMsg));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log all messages for debugging
          console.log('OHLCV WS message:', JSON.stringify(data).substring(0, 500));
          
          // Skip non-data messages
          if (data.event === 'pong' || data.event === 'subscribed') return;
          if (data.subscriptionId && !data.time && !data.t) return;
          
          // Handle OHLCV data - support both formats:
          // Format 1: { t, o, h, l, c, v } (short keys)
          // Format 2: { time, open, high, low, close, volume } (full keys)
          const timestamp = data.t || data.time;
          const open = data.o !== undefined ? data.o : data.open;
          const high = data.h !== undefined ? data.h : data.high;
          const low = data.l !== undefined ? data.l : data.low;
          const close = data.c !== undefined ? data.c : data.close;
          const volume = data.v !== undefined ? data.v : (data.volume || 0);
          
          if (timestamp && open !== undefined) {
            // Normalize timestamp - if > 10 billion, it's in milliseconds
            let timeInSeconds = timestamp > 10000000000 ? Math.floor(timestamp / 1000) : timestamp;
            
            // Align timestamp to period boundary for proper candle display
            // This ensures new candles appear at the correct time
            const periodSeconds = getPeriodSeconds('${period}');
            timeInSeconds = Math.floor(timeInSeconds / periodSeconds) * periodSeconds;
            
            // Parse values
            let candleOpen = parseFloat(open);
            const candleHigh = parseFloat(high);
            const candleLow = parseFloat(low);
            const candleClose = parseFloat(close);
            
            // For new candles (different time than last), connect open to previous close
            if (timeInSeconds !== lastCandleTime && lastCandleClose > 0) {
              candleOpen = lastCandleClose;
            }
            
            const candle = {
              time: timeInSeconds,
              open: candleOpen,
              high: Math.max(candleHigh, candleOpen),
              low: Math.min(candleLow, candleOpen),
              close: candleClose,
            };
            
            // Update tracking
            lastCandleTime = timeInSeconds;
            lastCandleClose = candleClose;
            
            console.log('Updating candle:', JSON.stringify(candle));
            candleSeries.update(candle);
            
            volumeSeries.update({
              time: timeInSeconds,
              value: parseFloat(volume) || 0,
              color: candleClose >= candleOpen ? '${upColor}40' : '${downColor}40',
            });
          }
        } catch (e) {
          console.error('WS message error:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed');
        // Reconnect after delay
        setTimeout(() => {
          if (document.visibilityState !== 'hidden') {
            connectWebSocket();
          }
        }, 5000);
      };
      
      // Ping to keep alive
      setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'ping' }));
        }
      }, 30000);
    }
    
    // Main initialization
    async function init() {
      try {
        initChart();
        await fetchHistoricalData();
        connectWebSocket();
      } catch (error) {
        console.error('Init error:', error);
        statusEl.innerHTML = 'Unable to load chart<small>' + error.message + '</small>';
        statusEl.className = 'status error';
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', message: error.message }));
      }
    }
    
    init();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (ws) ws.close();
    });
  </script>
</body>
</html>
      `;
    }, [address, chainId, period, isDark, apiKey]);

    const handleMessage = (event: { nativeEvent: { data: string } }) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.type === "ready" || message.type === "error") {
          setIsLoading(false);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    const handleLoadEnd = () => {
      // Fallback timeout to hide loading
      setTimeout(() => {
        setIsLoading(false);
      }, 5000);
    };

    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        {/* Interval Selector */}
        <View style={[styles.intervalRow, { borderBottomColor: theme.border }]}>
          {INTERVALS.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.intervalButton,
                interval === item.value && {
                  backgroundColor: theme.primary.DEFAULT + "20",
                },
              ]}
              onPress={() => onIntervalChange?.(item.value)}
            >
              <Text
                style={[
                  styles.intervalText,
                  {
                    color:
                      interval === item.value
                        ? theme.primary.DEFAULT
                        : theme.text.secondary,
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart WebView */}
        <View style={styles.chartContainer}>
          {isLoading && (
            <View
              style={[
                styles.loadingOverlay,
                { backgroundColor: theme.surface },
              ]}
            >
              <ActivityIndicator size="small" color={theme.primary.DEFAULT} />
              <Text
                style={[styles.loadingText, { color: theme.text.secondary }]}
              >
                Loading chart...
              </Text>
            </View>
          )}
          <WebView
            source={{ html: chartHtml }}
            style={styles.webview}
            scrollEnabled={false}
            bounces={false}
            onMessage={handleMessage}
            onLoadEnd={handleLoadEnd}
            originWhitelist={["*"]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
            allowsInlineMediaPlayback={true}
          />
        </View>
      </View>
    );
  },
);

TradingViewChart.displayName = "TradingViewChart";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 300,
    borderRadius: 12,
    overflow: "hidden",
  },
  intervalRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 4,
  },
  intervalButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  intervalText: {
    fontSize: 12,
    fontWeight: "600",
  },
  chartContainer: {
    flex: 1,
    minHeight: 250,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
