/**
 * Spacing constants for consistent padding/margins across the app
 *
 * Use these constants instead of hardcoded values to maintain consistency.
 * All values are based on the 4px grid system defined in theme.ts
 *
 * Usage:
 *   import { SPACING } from '@/constants/spacing';
 *   // or
 *   const { layout } = useTheme(); // if added to ThemeContext
 */

import { spacing } from "./theme";

/**
 * Screen-level layout constants
 * Use these for consistent screen structure
 */
export const LAYOUT = {
  /** Standard horizontal padding for screen content (16px) */
  screenPaddingHorizontal: spacing[4],

  /** Vertical padding for headers (12px) */
  headerPaddingVertical: spacing[3],

  /** Gap between sections (16px) */
  sectionGap: spacing[4],

  /** Gap between items within a section (12px) */
  itemGap: spacing[3],

  /** Gap between elements within a card/row (12px) */
  inlineGap: spacing[3],

  /** Small inline gap for tight groupings (8px) */
  inlineGapSm: spacing[2],

  /** Content padding inside cards - small (12px) */
  cardPaddingSm: spacing[3],

  /** Content padding inside cards - medium (16px) */
  cardPaddingMd: spacing[4],

  /** Content padding inside cards - large (24px) */
  cardPaddingLg: spacing[6],

  /** Tab container horizontal margin (16px) */
  tabContainerMarginHorizontal: spacing[4],

  /** Tab container vertical spacing (8px top, 8px bottom) */
  tabContainerMarginVertical: spacing[2],

  /** Internal padding for tab container (4px) */
  tabContainerPadding: spacing[1],

  /** Vertical padding for tab items (10px) */
  tabItemPaddingVertical: spacing[2.5],

  /** Gap between icon and text in tabs (6px) */
  tabIconGap: spacing[1.5],

  /** Standard border radius for tabs (12px) */
  tabBorderRadius: 12,

  /** List item vertical padding (12px) */
  listItemPaddingVertical: spacing[3],

  /** List item horizontal padding (16px) */
  listItemPaddingHorizontal: spacing[4],

  /** Empty state padding (48px) */
  emptyStatePadding: spacing[12],
} as const;

/**
 * Component-level spacing constants
 * Use these for consistent component internal spacing
 */
export const COMPONENT = {
  /** Button padding - small */
  buttonPaddingSm: { vertical: 8, horizontal: 16 },

  /** Button padding - medium */
  buttonPaddingMd: { vertical: 12, horizontal: 24 },

  /** Button padding - large */
  buttonPaddingLg: { vertical: 16, horizontal: 32 },

  /** Icon button size (40px) */
  iconButtonSize: 40,

  /** Icon button border radius (full/20px) */
  iconButtonRadius: 20,

  /** Badge padding horizontal (8px) */
  badgePaddingHorizontal: spacing[2],

  /** Badge padding vertical (4px) */
  badgePaddingVertical: spacing[1],

  /** Input height - standard (48px) */
  inputHeight: 48,

  /** Input padding horizontal (12px) */
  inputPaddingHorizontal: spacing[3],

  /** Modal header height */
  modalHeaderHeight: 56,
} as const;

/**
 * Style presets for common patterns
 * These can be spread into style objects
 */
export const STYLE_PRESETS = {
  /** Standard screen header style */
  screenHeader: {
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
    paddingVertical: LAYOUT.headerPaddingVertical,
  },

  /** Standard screen content container */
  screenContent: {
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
  },

  /** Standard FlatList content container style */
  listContent: {
    padding: LAYOUT.screenPaddingHorizontal,
  },

  /** Tab container style */
  tabContainer: {
    marginHorizontal: LAYOUT.tabContainerMarginHorizontal,
    marginVertical: LAYOUT.tabContainerMarginVertical,
    padding: LAYOUT.tabContainerPadding,
    borderRadius: LAYOUT.tabBorderRadius,
    borderWidth: 1,
  },

  /** Tab item style */
  tabItem: {
    paddingVertical: LAYOUT.tabItemPaddingVertical,
    gap: LAYOUT.tabIconGap,
  },

  /** List item row style */
  listItem: {
    paddingVertical: LAYOUT.listItemPaddingVertical,
    paddingHorizontal: LAYOUT.listItemPaddingHorizontal,
  },
} as const;

export type LayoutConstants = typeof LAYOUT;
export type ComponentConstants = typeof COMPONENT;
export type StylePresets = typeof STYLE_PRESETS;
