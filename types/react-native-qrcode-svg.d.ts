declare module "react-native-qrcode-svg" {
  import { Component } from "react";
  import { ImageSourcePropType } from "react-native";

  export interface QRCodeProps {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    logo?: ImageSourcePropType;
    logoSize?: number;
    logoBackgroundColor?: string;
    logoMargin?: number;
    logoBorderRadius?: number;
    quietZone?: number;
    enableLinearGradient?: boolean;
    gradientDirection?: string[];
    linearGradient?: string[];
    ecl?: "L" | "M" | "Q" | "H";
    getRef?: (ref: any) => void;
    onError?: (error: any) => void;
  }

  export default class QRCode extends Component<QRCodeProps> {}
}
