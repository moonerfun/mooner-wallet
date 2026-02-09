/**
 * XIcon - X (formerly Twitter) logo icon component
 * Renders the official X logo using SVG
 */

import React from "react";
import Svg, { Path } from "react-native-svg";

interface XIconProps {
  /** Size of the icon (default: 24) */
  size?: number;
  /** Color of the icon (default: #000) */
  color?: string;
}

export function XIcon({ size = 24, color = "#000" }: XIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"
        fill={color}
      />
    </Svg>
  );
}

export default XIcon;
