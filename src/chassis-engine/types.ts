export type Vec3 = readonly [number, number, number];

export type ThermalSection =
  "cpu" | "gpu" | "battery" | "coil" | "usb" | "display" | "radio" | "speaker";

export type ThermalCategory = ThermalSection | "body";

export interface WireEdge {
  pts: Vec3[];
  opacity: number;
  width?: number;
  dashed?: boolean;
  tint?: string;
  section?: ThermalSection;
}

export type CameraStyle =
  | "pixel-square-corner"
  | "pixel-visor-dual"
  | "pixel-visor-triple"
  | "pixel-pill-bar-dual"
  | "pixel-pill-bar-triple"
  | "pixel-9a-flush-pill"
  | "pixel-fold"
  | "samsung-vertical-rings"
  | "xiaomi-square-island"
  | "honor-pill"
  | "huawei-ring"
  | "generic-slab";

export interface ChassisSpec {
  id: string;
  label: string;
  width?: number;
  height?: number;
  cornerRadius?: number;
  depth?: number;
  cameraStyle: CameraStyle;
  hasWirelessCoil?: boolean;
  foldable?: boolean;
}
