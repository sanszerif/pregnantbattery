import type { BrandProfile } from "./types";

export const BRAND_PROFILES: Record<string, BrandProfile> = {
  google: {
    id: "google",
    brandName: "Google Pixel",
    brandAliases: ["google", "pixel"],
    manufacturerAliases: ["google"],
    ratedCycles: 800,
    chassis: {
      id: "google-generic",
      label: "Google Pixel Silhouette",
      cornerRadius: 0.22,
      cameraStyle: "pixel-visor-dual",
    },
    quirks: {
      bclAudioHapticsShared: true,
    },
  },
  samsung: {
    id: "samsung",
    brandName: "Samsung Galaxy",
    brandAliases: ["samsung"],
    manufacturerAliases: ["samsung"],
    ratedCycles: 1000,
    chassis: {
      id: "samsung-galaxy",
      label: "Samsung Galaxy Silhouette",
      cornerRadius: 0.16,
      cameraStyle: "samsung-vertical-rings",
    },
    quirks: {
      samsungBatteryExtras: true,
      currentMaHeuristic: true,
      siopThermalLog: true,
      secUfsLifetime: true,
    },
  },
  xiaomi: {
    id: "xiaomi",
    brandName: "Xiaomi / Redmi / POCO",
    brandAliases: ["xiaomi", "redmi", "poco", "blackshark"],
    manufacturerAliases: ["xiaomi"],
    ratedCycles: 1000,
    chassis: {
      id: "xiaomi-generic",
      label: "Xiaomi Silhouette",
      cornerRadius: 0.22,
      cameraStyle: "xiaomi-square-island",
    },
    quirks: {
      dualCellVoltageMv: 6000,
    },
  },
  honor: {
    id: "honor",
    brandName: "Honor",
    brandAliases: ["honor"],
    manufacturerAliases: ["honor"],
    ratedCycles: 1000,
    chassis: {
      id: "honor-generic",
      label: "Honor Silhouette",
      cornerRadius: 0.24,
      cameraStyle: "honor-pill",
    },
    quirks: {
      dualCellVoltageMv: 6000,
    },
  },
  huawei: {
    id: "huawei",
    brandName: "Huawei",
    brandAliases: ["huawei"],
    manufacturerAliases: ["huawei"],
    ratedCycles: 800,
    chassis: {
      id: "huawei-generic",
      label: "Huawei Silhouette",
      cornerRadius: 0.24,
      cameraStyle: "huawei-ring",
    },
    quirks: {},
  },
};

export const GENERIC_BRAND_PROFILE: BrandProfile = {
  id: "generic",
  brandName: "Android AOSP",
  brandAliases: [],
  manufacturerAliases: [],
  ratedCycles: 800,
  chassis: {
    id: "generic-aosp",
    label: "Generic Android Slab",
    cornerRadius: 0.22,
    cameraStyle: "generic-slab",
  },
  quirks: {},
};
