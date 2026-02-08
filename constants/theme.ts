// Theme configuration with hex color codes
// All colors are easily customizable from this single file
// 🌙 Yellow Moon — elegant gold & black palette

export const colors = {
  // Primary brand colors - Moonlight Gold
  primary: {
    DEFAULT: "#F5C518", // Signature moon gold
    light: "#FFD84D", // Bright golden glow
    dark: "#D4A810", // Deep amber moon
  },
  // Secondary colors - Charcoal & Slate (neutral grounding)
  secondary: {
    DEFAULT: "#2A2A2A", // Rich charcoal
    light: "#404040", // Lighter slate
    dark: "#1A1A1A", // Deep charcoal
  },
  // Accent colors - Warm honey tones
  accent: {
    DEFAULT: "#E8A900", // Honey gold
    light: "#F2C94C", // Soft honey
    dark: "#CC9400", // Deep honey
  },
  // Status colors - balanced with gold theme
  success: "#22C55E", // Clean green
  warning: "#F5C518", // Moon gold (matches primary)
  error: "#EF4444", // Clear red
  info: "#3B82F6", // Crisp blue
  // Muted destructive colors for less aggressive styling
  destructive: {
    DEFAULT: "#DC2626", // Softer red
    muted: "#991B1B", // Muted dark red
    light: "#FEE2E2", // Very light red background
  },
} as const;

// Light theme - clean warm whites
export const lightTheme = {
  background: "#FAFAFA", // Clean off-white
  surface: "#FFFFFF", // Pure white cards
  surfaceSecondary: "#F5F5F0", // Subtle warm tint cards
  border: "#E5E5E0", // Soft warm border
  borderLight: "#EBEBEB", // Lighter border for subtle separation
  text: {
    primary: "#0A0A0A", // Near black
    secondary: "#525252", // Medium gray
    muted: "#A3A3A3", // Light gray
    inverse: "#FFFFFF", // White text on dark backgrounds
  },
  card: {
    background: "#FFFFFF", // White card
    backgroundAlt: "#FAFAF5", // Alternate warm card
    elevated: "#FFFFFF", // Elevated card (same, use shadow)
  },
  ...colors,
} as const;

// Dark theme - pure black with gold highlights
export const darkTheme = {
  background: "#000000", // Pure black
  surface: "#0A0A0A", // Near black surface
  surfaceSecondary: "#111111", // Slightly elevated surface
  border: "#1F1F1F", // Subtle dark border
  borderLight: "#2A2A2A", // Lighter border for more contrast
  text: {
    primary: "#FFFFFF", // Pure white
    secondary: "#A3A3A3", // Medium gray
    muted: "#666666", // Muted gray
    inverse: "#0A0A0A", // Dark text on light backgrounds
  },
  card: {
    background: "#0F0F0F", // Dark card
    backgroundAlt: "#141414", // Alternate slightly lighter
    elevated: "#1A1A1A", // Elevated card with more presence
  },
  ...colors,
} as const;

// Border radius presets - easily customizable
export const borderRadius = {
  none: 0,
  sm: 6,
  DEFAULT: 8,
  md: 10,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  full: 9999,
} as const;

// Font sizes - easily customizable
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
} as const;

// Line heights
export const lineHeight = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
  xl: 28,
  "2xl": 32,
  "3xl": 36,
  "4xl": 40,
  "5xl": 48,
} as const;

// Spacing scale
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export type ThemeType = typeof lightTheme | typeof darkTheme;
