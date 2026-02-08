# Mooner Wallet

A multichain mobile cryptocurrency wallet built with React Native and Expo. Supports Solana and EVM-compatible chains (Ethereum, Base, BNB Smart Chain) with passkey-based authentication.

## Features

- **Multichain Support**: Manage assets across Solana, Ethereum, Base, and BNB Smart Chain
- **Passkey Authentication**: Secure wallet access using WebAuthn/Passkeys via Turnkey
- **Cross-chain Swaps**: Swap tokens across different blockchains using OneBalance
- **Market Data**: Real-time token prices and market information via Mobula API
- **KOL Tracking**: Follow key opinion leaders and their trading activity
- **Push Notifications**: Stay updated on wallet activity and market movements
- **Twitter/X Integration**: Link your social account for enhanced features

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Xcode (for iOS development)
- Android Studio (for Android development)
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mooner-wallet
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure App Files

Copy the example configuration files and fill in your credentials:

```bash
cp .env.example .env
cp app.example.json app.json
```

Edit the files with your configuration:

- **`.env`** - API keys and environment variables (see Environment Variables section below)
- **`app.json`** - Update the following fields:
  - `expo.ios.bundleIdentifier` - Your iOS bundle ID
  - `expo.ios.appleTeamId` - Your Apple Developer Team ID
  - `expo.ios.associatedDomains` - Your domain for passkey authentication
  - `expo.android.package` - Your Android package name
  - `expo.extra.eas.projectId` - Your EAS project ID (run `eas init` to get one)
  - `expo.owner` - Your Expo account username

### 4. Run the Application

**Development (Expo Go):**

```bash
npm start
```

**iOS (with native modules):**

```bash
npm run ios
```

**Android (with native modules):**

```bash
npm run android
```

## Environment Variables

All environment variables must be configured in `.env` before running the application. Required services:

### Turnkey (Required)

Turnkey provides the wallet infrastructure with passkey-based authentication.

| Variable                                   | Description                                                    |
| ------------------------------------------ | -------------------------------------------------------------- |
| `EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID`      | Your organization ID from the Turnkey dashboard                |
| `EXPO_PUBLIC_TURNKEY_API_BASE_URL`         | API base URL (default: `https://api.turnkey.com`)              |
| `EXPO_PUBLIC_TURNKEY_AUTH_PROXY_URL`       | Auth proxy URL for passkey authentication                      |
| `EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID` | Auth proxy configuration ID                                    |
| `EXPO_PUBLIC_TURNKEY_RPID`                 | Relying Party ID for WebAuthn (must match your domain)         |
| `EXPO_PUBLIC_APP_SCHEME`                   | Deep link scheme for OAuth callbacks (default: `moonerwallet`) |

Setup instructions: https://docs.turnkey.com

### Supabase (Required)

Supabase handles backend services, user data, and real-time features.

| Variable                        | Description                   |
| ------------------------------- | ----------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Your Supabase project URL     |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

Setup instructions: https://supabase.com/docs

### Mobula API (Required)

Mobula provides token market data, prices, and blockchain information.

| Variable                     | Description                                |
| ---------------------------- | ------------------------------------------ |
| `EXPO_PUBLIC_MOBULA_API_KEY` | Your Mobula API key                        |
| `EXPO_PUBLIC_MOBULA_API_URL` | API URL (default: `https://api.mobula.io`) |

Get an API key: https://docs.mobula.io

### OneBalance (Required for Swaps)

OneBalance enables cross-chain token swaps.

| Variable                         | Description             |
| -------------------------------- | ----------------------- |
| `EXPO_PUBLIC_ONEBALANCE_API_KEY` | Your OneBalance API key |

Setup instructions: https://docs.onebalance.io

### Blockchain RPC Endpoints (Required)

RPC endpoints for blockchain interactions. You need endpoints for each supported chain.

| Variable                     | Description                              |
| ---------------------------- | ---------------------------------------- |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint (Helius recommended) |
| `EXPO_PUBLIC_ETH_RPC_URL`    | Ethereum RPC endpoint                    |
| `EXPO_PUBLIC_BASE_RPC_URL`   | Base RPC endpoint                        |
| `EXPO_PUBLIC_BSC_RPC_URL`    | BNB Smart Chain RPC endpoint             |

Recommended RPC providers:

- Solana: https://helius.dev
- EVM chains: https://quickrpc.com or https://alchemy.com

### Twitter/X OAuth (Optional)

For social account linking.

| Variable                  | Description                                 |
| ------------------------- | ------------------------------------------- |
| `EXPO_PUBLIC_X_CLIENT_ID` | OAuth 2.0 Client ID from X Developer Portal |

## Project Structure

```
mooner-wallet/
├── app/                    # Expo Router screens and layouts
│   ├── (auth)/            # Authentication screens
│   ├── (main)/            # Main app screens
│   │   ├── (tabs)/        # Bottom tab navigation
│   │   └── token/         # Token detail screens
│   └── oauth/             # OAuth callback handlers
├── components/            # Reusable UI components
│   ├── auth/              # Authentication components
│   ├── kol/               # KOL tracking components
│   ├── market/            # Market data components
│   ├── pulse/             # Pulse feed components
│   ├── settings/          # Settings components
│   ├── token/             # Token detail components
│   ├── ui/                # Base UI components
│   └── wallet/            # Wallet management components
├── constants/             # App configuration and constants
├── contexts/              # React contexts
├── hooks/                 # Custom React hooks
├── lib/                   # API clients and services
├── store/                 # Zustand state stores
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
```

## Building for Production

### iOS

```bash
eas build --platform ios --profile production
```

### Android

```bash
eas build --platform android --profile production
```

### Submitting to App Stores

```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

## Scripts

| Command            | Description                              |
| ------------------ | ---------------------------------------- |
| `npm start`        | Start Expo development server            |
| `npm run ios`      | Run on iOS simulator/device              |
| `npm run android`  | Run on Android emulator/device           |
| `npm run web`      | Run in web browser                       |
| `npm run prebuild` | Generate native iOS and Android projects |
| `npm run clean`    | Clean and reinstall dependencies         |
| `npm run lint`     | Run ESLint                               |

## Documentation

Additional documentation is available in the `docs/` directory:

- [Demo Mode](docs/demo-mode.md) - Testing without real credentials
- [Mobula Integration](docs/mobula.md) - Market data API details
- [OneBalance Integration](docs/onebalance.md) - Cross-chain swap implementation
- [Push Notifications](docs/push-notifications.md) - Notification setup
- [Turnkey Integration](docs/turnkey.md) - Wallet infrastructure details

## Security Notes

- Never commit `.env` files to version control
- The `.env` file is already in `.gitignore`
- Use `.env.example` as a template for required variables
- Rotate API keys if they are ever exposed
- Service account JSON files should never be committed

## License

Private and confidential. All rights reserved.
