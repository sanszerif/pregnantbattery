import type { ChassisSpec } from "../chassis-engine/types";

export type ProfileLayer = "model" | "brand" | "generic";

export interface ProfileQuirks {
  bclAudioHapticsShared?: boolean;
  samsungBatteryExtras?: boolean;
  currentMaHeuristic?: boolean;
  siopThermalLog?: boolean;
  secUfsLifetime?: boolean;
  dualCellVoltageMv?: number;
}

export interface BrandProfile {
  id: string;
  brandName: string;
  brandAliases: string[];
  manufacturerAliases: string[];
  ratedCycles: number;
  chassis: ChassisSpec;
  quirks: ProfileQuirks;
}

export interface ModelProfile {
  id: string;
  brandId: string;
  codenames: string[];
  modelNames: string[];
  label: string;
  ratedCycles?: number;
  chassis: ChassisSpec;
  quirks?: ProfileQuirks;
}

export interface ResolvedDeviceProfile {
  id: string;
  brandId: string;
  layer: ProfileLayer;
  label: string;
  brandName: string;
  badgeName: string;
  badgeTooltip: string;
  ratedCycles: number;
  chassis: ChassisSpec;
  quirks: ProfileQuirks;
}
