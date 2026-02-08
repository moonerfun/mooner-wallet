#!/usr/bin/env npx ts-node
/**
 * Test script for Pulse V2 WebSocket filters
 * Run with: npx ts-node scripts/test-pulse-filters.ts
 *
 * This helps identify which filter fields cause PrismaClientValidationError
 */

import WebSocket from "ws";

const API_KEY = process.env.EXPO_PUBLIC_MOBULA_API_KEY || "";
const WS_URL = "wss://api.mobula.io";

if (!API_KEY) {
  console.error("❌ Missing EXPO_PUBLIC_MOBULA_API_KEY environment variable");
  console.log(
    "Run with: EXPO_PUBLIC_MOBULA_API_KEY=your_key npx ts-node scripts/test-pulse-filters.ts",
  );
  process.exit(1);
}

interface TestCase {
  name: string;
  filters: Record<string, any>;
}

// Test cases - start minimal and add filters one by one
const testCases: TestCase[] = [
  {
    name: "Minimal (no filters)",
    filters: {},
  },
  {
    name: "Volume only",
    filters: {
      volume_1h: { gte: 1000 },
    },
  },
  {
    name: "Volume + Market Cap",
    filters: {
      volume_1h: { gte: 1000 },
      market_cap: { gte: 5000 },
    },
  },
  {
    name: "Volume + Market Cap + Holders",
    filters: {
      volume_1h: { gte: 1000 },
      market_cap: { gte: 5000 },
      holders_count: { gte: 50 },
    },
  },
  {
    name: "Volume + Market Cap + Trades",
    filters: {
      volume_1h: { gte: 1000 },
      market_cap: { gte: 5000 },
      trades_1h: { gte: 10 },
    },
  },
  {
    name: "With top_10_holdings_percentage",
    filters: {
      volume_1h: { gte: 1000 },
      top_10_holdings_percentage: { lte: 50 },
    },
  },
  {
    name: "With dev_holdings_percentage",
    filters: {
      volume_1h: { gte: 1000 },
      dev_holdings_percentage: { lte: 15 },
    },
  },
  {
    name: "With snipers_holdings_percentage",
    filters: {
      volume_1h: { gte: 1000 },
      snipers_holdings_percentage: { lte: 15 },
    },
  },
  {
    name: "With bundlers_holdings_percentage",
    filters: {
      volume_1h: { gte: 1000 },
      bundlers_holdings_percentage: { lte: 15 },
    },
  },
  {
    name: "With liquidity",
    filters: {
      volume_1h: { gte: 1000 },
      liquidity: { gte: 5000 },
    },
  },
  {
    name: "With buyers_1h",
    filters: {
      volume_1h: { gte: 1000 },
      buyers_1h: { gte: 10 },
    },
  },
  {
    name: "bonded: false (direct)",
    filters: {
      volume_1h: { gte: 1000 },
      bonded: false,
    },
  },
  {
    name: "bonded: { equals: false }",
    filters: {
      volume_1h: { gte: 1000 },
      bonded: { equals: false },
    },
  },
  {
    name: "bonded: true (direct)",
    filters: {
      volume_1h: { gte: 1000 },
      bonded: true,
    },
  },
  {
    name: "bonded: { equals: true }",
    filters: {
      volume_1h: { gte: 1000 },
      bonded: { equals: true },
    },
  },
  {
    name: "dexscreener_listed: true (direct)",
    filters: {
      volume_1h: { gte: 1000 },
      dexscreener_listed: true,
    },
  },
  {
    name: "dexscreener_listed: { equals: true }",
    filters: {
      volume_1h: { gte: 1000 },
      dexscreener_listed: { equals: true },
    },
  },
  {
    name: "bonding_percentage",
    filters: {
      volume_1h: { gte: 1000 },
      bonding_percentage: { gte: 30 },
    },
  },
];

async function testFilters(
  testCase: TestCase,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        resolve({ success: false, error: "Timeout (10s)" });
      }
    }, 10000);

    ws.on("open", () => {
      const message = {
        type: "pulse-v2",
        authorization: API_KEY,
        payload: {
          assetMode: true,
          compressed: false,
          views: [
            {
              name: "test-view",
              chainId: ["solana:solana"],
              limit: 10,
              sortBy: "volume_1h",
              sortOrder: "desc",
              filters: testCase.filters,
            },
          ],
        },
      };
      ws.send(JSON.stringify(message));
    });

    ws.on("message", (data) => {
      if (resolved) return;

      try {
        const msg = JSON.parse(data.toString());

        if (msg.error || msg.name === "PrismaClientValidationError") {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({ success: false, error: msg.error || msg.name });
          return;
        }

        if (msg.type === "init") {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({ success: true });
          return;
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    ws.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      }
    });

    ws.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ success: false, error: "Connection closed unexpectedly" });
      }
    });
  });
}

async function runTests() {
  console.log("🧪 Testing Pulse V2 WebSocket Filters\n");
  console.log("API Key:", API_KEY.substring(0, 8) + "...");
  console.log("WebSocket URL:", WS_URL);
  console.log("");

  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const testCase of testCases) {
    process.stdout.write(`Testing: ${testCase.name}... `);
    const result = await testFilters(testCase);
    results.push({ name: testCase.name, ...result });

    if (result.success) {
      console.log("✅ SUCCESS");
    } else {
      console.log(`❌ FAILED: ${result.error}`);
    }

    // Small delay between tests
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n📊 Summary:\n");
  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Passed: ${passed.length}/${results.length}`);
  if (passed.length > 0) {
    console.log("   Working filters:");
    passed.forEach((r) => console.log(`   - ${r.name}`));
  }

  console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
  if (failed.length > 0) {
    console.log("   Broken filters:");
    failed.forEach((r) => console.log(`   - ${r.name}: ${r.error}`));
  }
}

runTests().catch(console.error);
