// Polyfills must be imported FIRST before anything else
// This is required for Turnkey SDK's crypto operations
// IMPORTANT: react-native-get-random-values MUST be imported before anything else
import { Buffer } from "buffer";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// Ensure Buffer is available globally
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}

import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

// https://docs.expo.dev/router/reference/troubleshooting/#expo_router_app_root-not-defined

// Must be exported or Fast Refresh won't update the context
export function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
