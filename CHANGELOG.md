# Changelog

## Unreleased

## 0.4.6-alpha (2026-11-23)

- Fixed 3D rear camera horizontal mirroring across all Pixel, Samsung, Xiaomi, Honor, and generic chassis models, and renamed 3D angle presets to `Iso / Back / Front`.
- Updated device profile validation badges & tooltips (**Verified Lab Rat**, **Close Enough**, and orange **Mystery Brick**).
- Upgraded Android 11–16 bugreport parsing (ZIP entry priority ignoring `dumpstate_board.txt`, Qualcomm µA current normalization, relative-offset `Battery History (`, Android 11 `Uid` & interleaved hardware subsystems, and authoritative `package` UID lookup).
- Added graceful missing-telemetry UI states across all KPI cards, charts, attribution tables, and Thermal Sensors (including auto-selecting multi-day timeline when hourly history is absent and honest `N/A` states on legacy dumps like Nokia 3.2).
- Self-hosted local `Product Sans` webfonts from `assets/` and added installable offline PWA support (`manifest.webmanifest`, PNG/maskable app icons, and build-time precaching Service Worker).
- Automated `CHANGELOG.md` promotion (`## Unreleased` -> versioned release with commit-log fallback) in GitHub Actions and allowed mixed-case/path commit scopes (e.g. `feat(thermalChassis):`) in `scripts/commitlint.ts` and `scripts/bump-version.ts`.
- Switched CI versioning to linear per-commit accumulation (`upgrade` resets `Y.Z` for major releases, `feat`/`huge` preserves patch `Z`, and `housekeep` replaces `chore`/`refac`), honoring manual `package.json` overrides and `[skip bump]` guards.
- Enabled the 3D thermal chassis on mobile viewports, added frame-rate-independent rotational inertia and smooth preset easing for touch/mouse dragging, and replaced the hardcoded HUD connector with a DOM-measured smooth Bézier callout docked directly to the HUD border.

## 0.1.2-alpha

- Fixed Pixel 9a (`tegu`) thermal headroom `34282.5°` overflow by preferring public `thermalservice` HAL entries, parsing `getVirtualSensorInfo`, dropping `COUNT_THRESHOLD` math nodes, and enforcing physical °C bounds.
- Replaced hardcoded `"middle-aged"` battery health text with 5-tier copy bands, 4 pill verdicts (`Great`, `Good`, `Fair`, `Worn`), and native Android `SOH` / Samsung `ASOC` display.
- Added dynamic AOSP/OEM charging policy & charging state enum handling (`FORCE_FULL_CHARGE`, `LONG_LIFE`, `ADAPTIVE`, `TOO_HOT`, `TOO_COLD`, Samsung battery protection modes).
- Upgraded Standby card to use true screen-off CPU uptime (`screenOffUptimeMs`), Deep/Light Doze segments, and zero-duplication Sleep Audit rows.
- Upgraded Radio card to a dual Cellular + Wi-Fi summary with multi-segment RSRP/RSSI signal quality bars, `mAh/GB` efficiency, GPS drain, and contextual insights.
- Added zero-hardcoding 3-tier system/app attribution (`System Service`, `System App`, `User App`) via `package` flags, `role` holders, and `batterystats` foreground activity.
- Separated the parametric 3D chassis & section-heatmap engine (`src/chassis-engine/`) from `App.tsx`, adding category-grouped thermal selection and neutral outer chassis rendering.
- Introduced 2-layer device profiling (`src/profiles/`) covering Pixel 5–9a model profiles and Google, Samsung, Xiaomi, Honor, and Huawei brand profiles (with Samsung `dumpstate.txt`, `mSavedBatteryAsoc`, `mSavedBatteryUsage`, and `SDHMS SIOP::` thermal telemetry support), plus dbrand-tone profile validation badges in the header.
- Added source repo (`github.com/sanszerif/pregnantbattery`), bug-report links, and footer version badge; added `AGENTS.md`, zero-dependency commitlint hook, and automated CI version bumping.

## 0.1.1-alpha

- Enhanced UI polish, card interactions, mobile layout, and parsing resilience; deployed second iteration to `battery.nipun.is-a.dev`.

## 0.1.0-alpha

- Scaffolded initial alpha release of `pregnantBattery` client-side Android bugreport analyzer.
