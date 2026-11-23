import { BRAND_PROFILES, GENERIC_BRAND_PROFILE } from "./brands";
import { MODEL_PROFILES } from "./models";
import type { BrandProfile, ResolvedDeviceProfile } from "./types";

export type {
  BrandProfile,
  ModelProfile,
  ProfileLayer,
  ProfileQuirks,
  ResolvedDeviceProfile,
} from "./types";

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function findBrandProfile(
  brandRaw: string,
  manufacturerRaw: string,
): BrandProfile | null {
  const b = norm(brandRaw);
  const m = norm(manufacturerRaw);
  const list = Object.values(BRAND_PROFILES);

  // Check brand BEFORE manufacturer so legacy Honor builds (manufacturer=HUAWEI) route to Honor
  if (b) {
    const brandMatch = list.find((p) =>
      p.brandAliases.some((a) => b === a || b.includes(a)),
    );
    if (brandMatch) return brandMatch;
  }
  if (m) {
    const mfgMatch = list.find((p) =>
      p.manufacturerAliases.some((a) => m === a || m.includes(a)),
    );
    if (mfgMatch) return mfgMatch;
  }
  return null;
}

export function resolveDeviceProfile(input: {
  codename?: string;
  model?: string;
  brand?: string;
  manufacturer?: string;
}): ResolvedDeviceProfile {
  const code = norm(input.codename);
  const model = norm(input.model);

  // Layer 1: Exact Model Profile (codename first, then normalized model name)
  const modelMatch =
    (code && MODEL_PROFILES.find((p) => p.codenames.includes(code))) ||
    (model && MODEL_PROFILES.find((p) => p.modelNames.includes(model)));

  if (modelMatch) {
    const parentBrand =
      BRAND_PROFILES[modelMatch.brandId] ?? GENERIC_BRAND_PROFILE;
    const ratedCycles = modelMatch.ratedCycles ?? parentBrand.ratedCycles;
    return {
      id: modelMatch.id,
      brandId: parentBrand.id,
      layer: "model",
      label: modelMatch.label,
      brandName: parentBrand.brandName,
      badgeName: "Verified Lab Rat",
      badgeTooltip: `Exact blueprint mapped for ${modelMatch.label}. pregnantBattery tested on this.`,
      ratedCycles,
      chassis: modelMatch.chassis,
      quirks: { ...parentBrand.quirks, ...modelMatch.quirks },
    };
  }

  // Layer 2: Brand Profile
  const brandMatch = findBrandProfile(
    input.brand ?? "",
    input.manufacturer ?? "",
  );
  if (brandMatch) {
    return {
      id: brandMatch.id,
      brandId: brandMatch.id,
      layer: "brand",
      label: brandMatch.brandName,
      brandName: brandMatch.brandName,
      badgeName: "Close Enough",
      badgeTooltip: `Using ${brandMatch.brandName} OEM Generic mappings. Drop a bug report on Discord/GitHub to make this verified on this specific device model.`,
      ratedCycles: brandMatch.ratedCycles,
      chassis: brandMatch.chassis,
      quirks: { ...brandMatch.quirks },
    };
  }

  // Layer 3: Basic AOSP Fallback
  return {
    id: GENERIC_BRAND_PROFILE.id,
    brandId: GENERIC_BRAND_PROFILE.id,
    layer: "generic",
    label: GENERIC_BRAND_PROFILE.brandName,
    brandName: GENERIC_BRAND_PROFILE.brandName,
    badgeName: "Mystery Brick",
    badgeTooltip:
      "Hmm... can't figure out fs if this is pregnant or not. Your device's OEM quirks aren't profiled yet. Drop a bug report on Discord/GitHub to make this verified on this specific device model.",
    ratedCycles: GENERIC_BRAND_PROFILE.ratedCycles,
    chassis: GENERIC_BRAND_PROFILE.chassis,
    quirks: { ...GENERIC_BRAND_PROFILE.quirks },
  };
}
