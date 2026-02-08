/**
 * Popular Tokens for Swap Module
 * Pre-configured token lists for quick selection
 */

import { NATIVE_TOKEN_ADDRESS, RELAY_CHAIN_IDS } from "@/constants/chains";
import { SwapToken } from "../types";

// Popular tokens organized by chain ID
export const POPULAR_TOKENS: SwapToken[] = [
  // Ethereum tokens
  {
    symbol: "ETH",
    name: "Ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    address: NATIVE_TOKEN_ADDRESS,
    chainId: RELAY_CHAIN_IDS.ETHEREUM,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    chainId: RELAY_CHAIN_IDS.ETHEREUM,
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    chainId: RELAY_CHAIN_IDS.ETHEREUM,
    decimals: 6,
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    logo: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    chainId: RELAY_CHAIN_IDS.ETHEREUM,
    decimals: 8,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    chainId: RELAY_CHAIN_IDS.ETHEREUM,
    decimals: 18,
  },

  // Base tokens
  {
    symbol: "ETH",
    name: "Ethereum (Base)",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    address: NATIVE_TOKEN_ADDRESS,
    chainId: RELAY_CHAIN_IDS.BASE,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin (Base)",
    logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chainId: RELAY_CHAIN_IDS.BASE,
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD (Base)",
    logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    chainId: RELAY_CHAIN_IDS.BASE,
    decimals: 6,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether (Base)",
    logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    address: "0x4200000000000000000000000000000000000006",
    chainId: RELAY_CHAIN_IDS.BASE,
    decimals: 18,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin (Base)",
    logo: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    chainId: RELAY_CHAIN_IDS.BASE,
    decimals: 18,
  },

  // BNB Smart Chain tokens
  {
    symbol: "BNB",
    name: "BNB",
    logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    address: NATIVE_TOKEN_ADDRESS,
    chainId: RELAY_CHAIN_IDS.BSC,
    decimals: 18,
  },
  {
    symbol: "USDT",
    name: "Tether USD (BNB Chain)",
    logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    address: "0x55d398326f99059fF775485246999027B3197955",
    chainId: RELAY_CHAIN_IDS.BSC,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin (BNB Chain)",
    logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    chainId: RELAY_CHAIN_IDS.BSC,
    decimals: 18,
  },
  {
    symbol: "WBNB",
    name: "Wrapped BNB",
    logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    chainId: RELAY_CHAIN_IDS.BSC,
    decimals: 18,
  },
  {
    symbol: "BUSD",
    name: "Binance USD",
    logo: "https://assets.coingecko.com/coins/images/9576/small/BUSD.png",
    address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    chainId: RELAY_CHAIN_IDS.BSC,
    decimals: 18,
  },

  // Solana tokens
  {
    symbol: "SOL",
    name: "Solana",
    logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    address: "11111111111111111111111111111111",
    chainId: RELAY_CHAIN_IDS.SOLANA,
    decimals: 9,
  },
  {
    symbol: "USDC",
    name: "USD Coin (Solana)",
    logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    chainId: RELAY_CHAIN_IDS.SOLANA,
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether (Solana)",
    logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    chainId: RELAY_CHAIN_IDS.SOLANA,
    decimals: 6,
  },
  {
    symbol: "BONK",
    name: "Bonk",
    logo: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg",
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    chainId: RELAY_CHAIN_IDS.SOLANA,
    decimals: 5,
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    logo: "https://assets.coingecko.com/coins/images/34188/small/jup.png",
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    chainId: RELAY_CHAIN_IDS.SOLANA,
    decimals: 6,
  },
];

/**
 * Get popular tokens for a specific chain
 */
export function getPopularTokensForChain(chainId: number): SwapToken[] {
  return POPULAR_TOKENS.filter((token) => token.chainId === chainId);
}

/**
 * Find a token by address and chain
 */
export function findToken(
  address: string,
  chainId: number,
): SwapToken | undefined {
  return POPULAR_TOKENS.find(
    (token) =>
      token.address.toLowerCase() === address.toLowerCase() &&
      token.chainId === chainId,
  );
}
