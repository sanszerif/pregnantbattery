import { expect, test } from "bun:test";
import { parseBugReport } from "./parse-bugreport";
import { resolveDeviceProfile } from "./profiles";
import { buildChassisEdges } from "./chassis-engine/geometry";
import { computeHudLeaderPath } from "./chassis-engine/ThermalPhone3D";
import { validateCommitMessage } from "../scripts/commitlint";
import {
  computeLinearNextVersion,
  computeNextVersion,
  promoteChangelog,
} from "../scripts/bump-version";
import { buildServiceWorkerSource } from "../scripts/pwa-plugin";

test("parses synthetic dumpstate covering edge cases cleanly", async () => {
  const sampleDump = [
    "== dumpstate: 2027-01-01 00:15:00",
    "Build: AP4A.250105.002",
    "Build fingerprint: 'google/cheetah/cheetah:16/AP4A.250105.002/123456:user/release-keys'",
    "------ SYSTEM PROPERTIES (getprop) ------",
    "[ro.product.marketname]: [Pixel 7 Pro]",
    "[ro.product.manufacturer]: [Google]",
    "[ro.boot.bootreason]: [reboot,userrequested]",
    "------ END ------",
    "-------------------------------------------------------------------------------",
    "DUMP OF SERVICE android.hardware.health.IHealth/default:",
    "getHealthInfo -> HealthInfo{batteryStatus: DISCHARGING, batteryLevel: 82, batteryVoltageMillivolts: 3980, batteryTemperatureTenthsCelsius: 315, batteryCurrentMicroamps: -250000, batteryFullChargeUah: 4360000, batteryFullChargeDesignCapacityUah: 5002000, batteryCycleCount: 410, batteryTechnology: Li-ion, chargingPolicy: DEFAULT, lifetimeA: 0}",
    "--------- 0.010s was the duration of dumpsys android.hardware.health.IHealth/default, ending at: 2027-01-01 00:15:01",
    "-------------------------------------------------------------------------------",
    "DUMP OF SERVICE android.hardware.thermal.IThermal/default:",
    "getCurrentTemperatures:",
    "  Type: SKIN Name: VIRTUAL-SKIN CurrentValue: 33.4 ThrottlingStatus: NONE",
    "  Type: UNKNOWN Name: broken_therm CurrentValue: -273.15 ThrottlingStatus: NONE",
    "  Type: UNKNOWN Name: VIRTUAL-SKIN-MODEL-UPDATED CurrentValue: 34282.5 ThrottlingStatus: LIGHT",
    "  Type: BATTERY Name: battery CurrentValue: 31.5 ThrottlingStatus: NONE",
    "--------- 0.010s was the duration of dumpsys android.hardware.thermal.IThermal/default, ending at: 2027-01-01 00:15:02",
    "-------------------------------------------------------------------------------",
    "DUMP OF SERVICE batterystats:",
    "Battery History [3]:",
    '  12-31 23:50:00.100 090 10000000 status=discharging temp=300 volt=4050 +screen fg=u0a101:"com.screenzen"',
    '  12-31 23:55:00.200 090 10000000 temp=305 +wake_lock="*wal*:keep-screen-on"',
    "  01-01 00:05:00.300 089 10000000",
    "  01-01 00:10:00.400 088 10000000 -screen",
    "Daily stats:",
    "  Estimated power use (mAh):",
    "    Capacity: 5002, Computed drain: 100, actual drain: 90-100",
    "    screen: 50.0 duration: 10m 0s",
    "  UID u0a999: 99.0",
    "Statistics since last charge:",
    "  Time on battery: 1h 0m 0s 0ms (100.0%) realtime",
    "  Time on battery screen off: 45m 0s 0ms (75.0%)",
    "  Discharge: 200 mAh",
    "  Screen off discharge: 50 mAh",
    "  Screen on discharge: 150 mAh",
    "  Screen on: 15m 0s 0ms (25.0%) 3x",
    "  Total partial wakelock time: 5m 0s 0ms",
    "  Estimated power use (mAh):",
    "    Capacity: 5002, Computed drain: 200, actual drain: 190-210",
    "    screen: 120.0 duration: 15m 0s",
    "    cpu: 40.0 duration: 20m 0s",
    "    wifi: 20.0 duration: 30m 0s",
    "  UID u0a101: 85.4",
    "      cpu=60.2 wifi=25.2",
    "",
    "      (on battery, screen off/doze) cpu=0.5",
    "  All kernel wake locks:",
    "  u0a101:",
    "    Apk com.screenzen:",
    "--------- 0.050s was the duration of dumpsys batterystats, ending at: 2027-01-01 00:15:03",
  ].join("\n");

  const data = await parseBugReport(new Blob([sampleDump]));

  expect(data.health.technology).toBe("Li-ion");
  expect(data.device.bootReason).toBe("reboot,userrequested");
  expect(data.device.ufsLifetimeUsedPct).toBeNull();
  expect(data.device.profile.id).toBe("pixel-7-pro");
  expect(data.device.profile.layer).toBe("model");

  expect(data.thermals.sensors.some((s) => s.name === "broken_therm")).toBe(
    false,
  );
  expect(
    data.thermals.sensors.some((s) => s.name === "VIRTUAL-SKIN-MODEL-UPDATED"),
  ).toBe(false);
  expect(data.thermals.skinTempC).toBeCloseTo(33.4, 1);
  expect(data.thermals.sensors.length).toBe(2);

  expect(data.timeline.length).toBe(4);
  expect(data.timeline[0].screenOn).toBe(true);
  expect(data.timeline[1].screenOn).toBe(true);
  expect(data.timeline[2].level).toBe(89);
  expect(data.timeline[3].screenOn).toBe(false);
  for (let i = 1; i < data.timeline.length; i++) {
    expect(data.timeline[i].tsMs).toBeGreaterThan(data.timeline[i - 1].tsMs);
  }

  expect(data.drain.globalSubsystems.map((s) => s.name)).toEqual([
    "screen",
    "cpu",
    "wifi",
  ]);
  expect(data.drain.drainers.length).toBe(1);
  expect(data.drain.drainers[0].packageName).toBe("com.screenzen");
  expect(data.drain.drainers[0].detail).toContain("cpu 60 mAh");
  expect(data.drain.drainers[0].detail).toContain("wifi 25 mAh");
});

test("parses Samsung synthetic dump with ASOC, cycles, mA current, and SIOP thermals", async () => {
  const samsungDump = [
    "== dumpstate: 2026-11-22 13:25:38",
    "Build: CP2A.260605.016",
    "Build fingerprint: 'samsung/a35xjvxx/a35x:17/CP2A.260605.016/A356EXXUBEZJ2:user/release-keys'",
    "------ SYSTEM PROPERTIES (getprop) ------",
    "[ro.product.brand]: [samsung]",
    "[ro.product.manufacturer]: [samsung]",
    "[ro.product.model]: [SM-A356E]",
    "[ro.product.device]: [a35x]",
    "[ro.boot.ddr_size]: [8]",
    "------ END ------",
    "------ UFS LT (/sys/class/sec/ufs/lt) ------",
    "3",
    "--------- 0.001s was the duration of 'UFS LT'",
    "------ SYSTEM LOG (logcat) ------",
    "11-22 13:25:35.337 1000 4171 5371 I SDHMS:y : SIOP:: AP:433 BAT:382 USB:371 CHG:418 PA:411 SKIN:386 WIFI2:382",
    "--------- 0.010s was the duration of 'SYSTEM LOG'",
    "DUMP OF SERVICE android.hardware.health.IHealth/default:",
    "getHealthInfo -> HealthInfo{batteryStatus: DISCHARGING, batteryLevel: 17, batteryVoltageMillivolts: 3663, batteryTemperatureTenthsCelsius: 382, batteryCurrentMicroamps: -846, batteryCycleCount: 0, batteryFullChargeUah: 5000000, batteryFullChargeDesignCapacityUah: 5000000, batteryTechnology: Li-ion}",
    "--------- 0.005s was the duration of dumpsys android.hardware.health.IHealth/default",
    "DUMP OF SERVICE battery:",
    "  mProtectBatteryMode: 2",
    "  LLB CAL: 20240411",
    "  battery FirstUseDate: [20240618]",
    "  mSavedBatteryAsoc: [88]",
    "  mSavedBatteryUsage: [76803]",
    "--------- 0.005s was the duration of dumpsys battery",
  ].join("\n");

  const data = await parseBugReport(new Blob([samsungDump]));
  expect(data.device.profile.id).toBe("samsung");
  expect(data.device.profile.layer).toBe("brand");
  expect(data.device.profile.badgeName).toBe("Close Enough");
  expect(data.device.profile.badgeTooltip).toContain(
    "Using Samsung Galaxy OEM Generic mappings",
  );
  expect(data.device.profile.chassis.cameraStyle).toBe(
    "samsung-vertical-rings",
  );
  expect(data.device.ramGb).toBe("8GB");
  expect(data.device.ufsLifetimeUsedPct).toBe(30);
  expect(data.health.healthPct).toBe(88);
  expect(data.health.stateOfHealthPct).toBe(88);
  expect(data.health.verdict).toBe("Fair");
  expect(data.health.cycleCount).toBe(768);
  expect(data.health.currentMa).toBe(-846);
  expect(data.health.chargingPolicy).toBe("ADAPTIVE_PROTECT");
  expect(data.health.manufacturedDate).toBe("2024-04-11");
  expect(data.health.firstUseDate).toBe("2024-06-18");
  expect(data.thermals.skinTempC).toBeCloseTo(38.6, 1);
  expect(data.thermals.batteryTempC).toBeCloseTo(38.2, 1);
  expect(data.thermals.sensors.some((s) => s.name === "SIOP_AP")).toBe(true);
});

test("resolves 2-layer model and brand profiles accurately", () => {
  expect(resolveDeviceProfile({ codename: "redfin" }).id).toBe("pixel-5");
  expect(resolveDeviceProfile({ codename: "tokay" }).ratedCycles).toBe(1000);
  expect(resolveDeviceProfile({ codename: "tegu" }).chassis.cameraStyle).toBe(
    "pixel-9a-flush-pill",
  );
  expect(
    resolveDeviceProfile({ brand: "Redmi", manufacturer: "Xiaomi" }).id,
  ).toBe("xiaomi");
  // Older Honor builds report manufacturer=HUAWEI; brand must win
  expect(
    resolveDeviceProfile({ brand: "HONOR", manufacturer: "HUAWEI" }).id,
  ).toBe("honor");
  expect(
    resolveDeviceProfile({ brand: "HUAWEI", manufacturer: "HUAWEI" }).id,
  ).toBe("huawei");
  const generic = resolveDeviceProfile({
    codename: "q2q",
    model: "Custom Phone",
    brand: "Acme",
    manufacturer: "Acme",
  });
  expect(generic.layer).toBe("generic");
  expect(generic.badgeName).toBe("Mystery Brick");
  expect(generic.badgeTooltip).toContain("figure out fs");

  // Ensure parametric 3D chassis engine builds edges cleanly and places rear cameras on screen-LEFT at yaw=180°
  const sEdges = buildChassisEdges(
    resolveDeviceProfile({ brand: "samsung" }).chassis,
  );
  const p9aEdges = buildChassisEdges(
    resolveDeviceProfile({ codename: "tegu" }).chassis,
  );
  expect(sEdges.length).toBeGreaterThan(20);
  expect(p9aEdges.some((e) => e.section === "battery")).toBe(true);
  expect(p9aEdges.some((e) => !e.section)).toBe(true);

  const projectRearX = (x: number, z: number) => {
    const yawRad = Math.PI; // Back view (yaw = 180°): +x projects left (< 225)
    const x1 = x * Math.cos(yawRad) + z * Math.sin(yawRad);
    return 225 + x1 * 76;
  };
  const sCamEdges = sEdges.filter(
    (e) => e.tint === "#cbd5e1" && e.pts.every((p) => p[2] < -0.14),
  );
  const p9aCamEdges = p9aEdges.filter(
    (e) => e.tint === "#cbd5e1" && e.pts.every((p) => p[2] < -0.14),
  );
  expect(sCamEdges.length).toBeGreaterThan(0);
  expect(p9aCamEdges.length).toBeGreaterThan(0);
  for (const edge of [...sCamEdges, ...p9aCamEdges]) {
    const avgPx =
      edge.pts.reduce((sum, p) => sum + projectRearX(p[0], p[2]), 0) /
      edge.pts.length;
    expect(avgPx).toBeLessThan(225);
  }

  // Smooth DOM-measured HUD leader line connects cleanly to exact HUD borders
  const hud = { left: 10, right: 208, top: 10, bottom: 94 };
  const below = computeHudLeaderPath({ x: 240, y: 210 }, hud);
  expect(below).not.toBeNull();
  expect(below?.endY).toBe(hud.bottom);
  expect(below?.endX).toBeGreaterThanOrEqual(hud.left + 16);
  expect(below?.endX).toBeLessThanOrEqual(hud.right - 16);
  expect(below?.d).toContain(" C");

  const right = computeHudLeaderPath({ x: 260, y: 52 }, hud);
  expect(right).not.toBeNull();
  expect(right?.endX).toBe(hud.right);
  expect(right?.endY).toBeGreaterThanOrEqual(hud.top + 16);
  expect(right?.endY).toBeLessThanOrEqual(hud.bottom - 16);

  expect(computeHudLeaderPath({ x: 100, y: 50 }, hud)).toBeNull();
});

test("validates commitlint and semver bump rules", () => {
  expect(
    validateCommitMessage("fix(thermal): clamp millidegree node").valid,
  ).toBe(true);
  expect(
    validateCommitMessage("feat(thermalChassis): add 3D engine").valid,
  ).toBe(true);
  expect(
    computeNextVersion("0.1.2-alpha", "feat(thermalChassis): add 3D engine"),
  ).toBe("0.2.2-alpha");
  expect(validateCommitMessage("upgrade: v2 architecture overhaul").valid).toBe(
    true,
  );
  expect(validateCommitMessage("feat: add pixel 9a chassis").valid).toBe(true);
  expect(validateCommitMessage("huge: device profile architecture").valid).toBe(
    true,
  );
  expect(validateCommitMessage("ci: auto bump version").valid).toBe(true);
  expect(validateCommitMessage("housekeep: extract chassis engine").valid).toBe(
    true,
  );
  expect(validateCommitMessage("chore: update docs").valid).toBe(false);
  expect(validateCommitMessage("refac: extract chassis").valid).toBe(false);
  expect(validateCommitMessage("major: v2 release").valid).toBe(false);
  expect(validateCommitMessage("feat!: breaking change").valid).toBe(false);
  expect(validateCommitMessage("random bad commit").valid).toBe(false);

  expect(computeNextVersion("0.1.2-alpha", "fix: tiny fix")).toBe(
    "0.1.3-alpha",
  );
  expect(computeNextVersion("0.1.2-alpha", "ci: deploy fix")).toBe(
    "0.1.3-alpha",
  );
  expect(computeNextVersion("0.1.2-alpha", "feat: new brand")).toBe(
    "0.2.2-alpha",
  );
  expect(computeNextVersion("0.1.2-alpha", "huge: redesign")).toBe(
    "0.2.2-alpha",
  );
  expect(computeNextVersion("0.1.2-alpha", "upgrade: breaking release")).toBe(
    "1.0.0-alpha",
  );
  expect(computeNextVersion("0.1.2-alpha", "housekeep: cleanup")).toBeNull();
  expect(
    computeNextVersion("0.1.2-alpha", "housekeep(release): bump"),
  ).toBeNull();
  expect(computeNextVersion("0.1.2-alpha", "chore(release): bump")).toBeNull();
  expect(
    computeNextVersion("0.1.2-alpha", "fix: tiny tweak [skip bump]"),
  ).toBeNull();

  // Linear per-commit chronological replay across real c519bc8..4d5a1de sequence
  expect(
    computeLinearNextVersion("0.1.2-alpha", [
      "huge(profiles): add 2-layer device profiling",
      "feat(thermalChassis): add 3D wireframe engine",
      "feat: added PWA support",
      "fix(testing): fixed added device tests",
      "fix(changelog): enhance automated promotion",
      "chore: housekeeping formatted code",
      "ci: fixed canary build on bun lint",
      "housekeep(versioning): switch to linear per-commit increments",
    ]),
  ).toBe("0.4.5-alpha");
  expect(
    computeLinearNextVersion("0.1.2-alpha", [
      "fix: patch before major",
      "upgrade: v1 rewrite",
      "feat: new dashboard",
      "fix: follow-up fix",
    ]),
  ).toBe("1.1.1-alpha");
  expect(
    computeLinearNextVersion("0.1.2-alpha", [
      "housekeep: cleanup",
      "housekeep(release): bump version to v0.1.2-alpha",
      "chore(release): bump version to v0.1.2-alpha",
      "fix: skipped manual bump [skip bump]",
    ]),
  ).toBeNull();
  expect(computeLinearNextVersion("0.1.2-alpha", [])).toBeNull();

  // Case 1: Promotes authored ## Unreleased notes cleanly above prior release
  const withNotes = [
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "- Added offline PWA support.",
    "",
    "## 0.1.2-alpha",
    "",
    "- Initial fixes.",
    "",
  ].join("\n");
  const promotedNotes = promoteChangelog(
    withNotes,
    "0.2.0-alpha",
    "2026-11-23",
    ["feat: fallback ignored"],
  );
  expect(promotedNotes).toBe(
    [
      "# Changelog",
      "",
      "## Unreleased",
      "",
      "## 0.2.0-alpha (2026-11-23)",
      "",
      "- Added offline PWA support.",
      "",
      "## 0.1.2-alpha",
      "",
      "- Initial fixes.",
      "",
    ].join("\n"),
  );

  // Case 2: Falls back to commit list when ## Unreleased is empty or comment-only
  const emptyUnreleased = [
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "<!-- write release notes here -->",
    "",
    "## 0.1.2-alpha",
    "",
    "- Initial fixes.",
    "",
  ].join("\n");
  const promotedFallback = promoteChangelog(
    emptyUnreleased,
    "0.1.3-alpha",
    "2026-11-23",
    [
      "fix: clamp negative temp",
      "Merge pull request #12 from foo/bar",
      "chore(release): bump version to v0.1.2-alpha",
      "fix: clamp negative temp",
    ],
  );
  expect(promotedFallback).toContain(
    "## Unreleased\n\n## 0.1.3-alpha (2026-11-23)\n\n- fix: clamp negative temp\n\n## 0.1.2-alpha",
  );

  // Case 3: Inserts ## Unreleased + dated release when ## Unreleased header is absent
  const noUnreleased = "# Changelog\n\n## 0.1.2-alpha\n\n- Old item.\n";
  const inserted = promoteChangelog(noUnreleased, "0.2.0-alpha", "2026-11-23", [
    "feat: add widget",
  ]);
  expect(inserted).toBe(
    "# Changelog\n\n## Unreleased\n\n## 0.2.0-alpha (2026-11-23)\n\n- feat: add widget\n\n## 0.1.2-alpha\n\n- Old item.\n",
  );

  // Case 4: Idempotent if target version heading already exists
  expect(
    promoteChangelog(promotedNotes, "0.2.0-alpha", "2026-11-24", ["fix: x"]),
  ).toBe(promotedNotes);
});

test("parses Pixel 7 Pro bugreport.zip dynamically", async () => {
  const candidates = [
    Bun.file("assets/bug_reports/PIXEL7PRO.zip"),
    Bun.file("D:\\projects\\misc\\bugreport.zip"),
    Bun.file("assets/bugreport.zip"),
  ];
  let file = candidates[0];
  for (const c of candidates) {
    if (await c.exists()) {
      file = c;
      break;
    }
  }
  if (!(await file.exists())) return;
  const ticks: number[] = [];
  const stages = new Set<string>();
  const data = await parseBugReport(file, (pct, stage) => {
    ticks.push(pct);
    if (stage) stages.add(stage);
  });

  expect(ticks[ticks.length - 1]).toBe(100);
  expect(ticks.length).toBeGreaterThan(5);
  expect(stages.size).toBeGreaterThan(2);

  expect(data.device.codename).toBe("cheetah");
  expect(data.device.model).toBe("Pixel 7 Pro");
  expect(data.device.profile.id).toBe("pixel-7-pro");
  expect(data.device.profile.layer).toBe("model");
  expect(data.device.profile.ratedCycles).toBe(800);
  expect(data.device.isThermalBoot).toBe(true);

  expect(data.health.learnedMah).toBe(4360);
  expect(data.health.designMah).toBe(5002);
  expect(data.health.healthPct ?? 0).toBeCloseTo(87.2, 1);
  expect(data.health.cycleCount).toBe(824);
  expect(data.health.verdict).toBe("Fair");

  expect(data.thermals.overallStatus).toBe(3);
  expect(data.thermals.preRebootTempC).toBeCloseTo(55.3, 1);
  expect(data.thermals.skinTempC).toBeGreaterThan(44);
  expect(data.thermals.skinTempC).toBeLessThan(80);
  expect(data.thermals.sensors.length).toBeGreaterThan(8);
  expect(data.thermals.sensors.some((s) => s.status === "SEVERE")).toBe(true);

  expect(data.drain.totalDischargeMah).toBe(2010);
  expect(data.drain.screenOnDischargeMah).toBe(566);
  expect(data.drain.screenOffDischargeMah).toBe(1444);

  const pkgs = data.drain.drainers.map((d) => d.packageName);
  expect(pkgs).toContain("com.resilio.sync");
  expect(pkgs).toContain("com.screenzen");
  expect(data.timeline.length).toBeGreaterThan(50);

  expect(data.dailyStats.length).toBe(11);
  expect(data.thermals.bcl.heavyCount).toBe(277);
  expect(data.thermals.bcl.totalThrottle).toBe(864);
  expect(data.thermals.bcl.modules[0].module).toBe("AUDIO");

  expect(data.drain.activeAudioClients.length).toBeGreaterThan(0);
  expect(data.drain.activeAudioClients[0].uid).toBe("2000");
});

test("parses Pixel 9a bugreport.zip with thermal clamping, 3-tier apps, radio & standby fixes", async () => {
  const file = Bun.file(
    "assets/bug_reports/PIXEL9A-bugreport-tegu-CP4A.261105.040.A1-2026-11-20-09-49-05.zip",
  );
  if (!(await file.exists())) return;

  const data = await parseBugReport(file);
  expect(data.device.codename).toBe("tegu");
  expect(data.device.model).toBe("Pixel 9a");
  expect(data.device.profile.id).toBe("pixel-9a");
  expect(data.device.profile.layer).toBe("model");
  expect(data.device.profile.badgeName).toBe("Verified Lab Rat");
  expect(data.device.profile.badgeTooltip).toContain(
    "Exact blueprint mapped for Pixel 9a",
  );
  expect(data.device.profile.ratedCycles).toBe(1000);
  expect(data.device.profile.chassis.cameraStyle).toBe("pixel-9a-flush-pill");

  expect(data.health.healthPct).toBe(96);
  expect(data.health.verdict).toBe("Great");
  expect(data.health.stateOfHealthPct).toBe(98);
  expect(data.health.chargingPolicy).toBe("FORCE_FULL_CHARGE");
  expect(data.health.chargingState).toBe("NORMAL");

  // Issue 3: 34282.5° millidegree leak must be excluded
  expect(data.thermals.skinTempC).toBeCloseTo(34.3, 1);
  expect(data.thermals.skinTempC).toBeLessThan(60);
  expect(data.thermals.sensors.every((s) => s.currentC <= 150)).toBe(true);
  expect(data.thermals.sensors.length).toBeLessThanOrEqual(30);

  // Issue 4: True screen-off CPU uptime instead of cumulative wakelock 100%
  expect(data.drain.awakeWhileScreenOffPct).toBe(29);
  expect(data.drain.deepDozeMs).toBeGreaterThan(0);

  // Issue 5: Cellular + Wi-Fi stats
  expect(data.drain.cellularDrainMah).toBe(4317);
  expect(data.drain.wifiDrainMah).toBe(249);
  expect(data.drain.gpsDrainMah).toBeCloseTo(28.7, 1);

  // Issue 6: Automatic 3-tier system/system-app/user-app detection
  const byPkg = (pkg: string) =>
    data.drain.drainers.find((d) => d.packageName === pkg);
  expect(byPkg("com.android.systemui")?.kind).toBe("system");
  expect(byPkg("com.google.android.as")?.kind).toBe("system");
  expect(byPkg("com.google.android.as.oss")?.kind).toBe("system");
  expect(data.drain.drainers.find((d) => d.id === "uid-1051")?.kind).toBe(
    "system",
  );
  expect(data.drain.drainers.find((d) => d.id === "uid--5")?.kind).toBe(
    "system",
  );
  expect(byPkg("com.google.android.apps.photos")?.kind).toBe("system-app");
  expect(byPkg("com.android.chrome")?.kind).toBe("system-app");
  expect(byPkg("com.instagram.android")?.kind).toBe("app");
  expect(byPkg("com.whatsapp")?.kind).toBe("app");
});

test("parses Samsung Galaxy A35 bugreport.zip via brand profile", async () => {
  const file = Bun.file(
    "assets/bug_reports/SAMSUNGA35-bugreport-a35xjvxx-CP2A.260605.016-2026-11-22-13-25-38.zip",
  );
  if (!(await file.exists())) return;

  const data = await parseBugReport(file);
  expect(data.device.codename).toBe("a35x");
  expect(data.device.profile.id).toBe("samsung");
  expect(data.device.profile.layer).toBe("brand");
  expect(data.device.profile.badgeName).toBe("Close Enough");
  expect(data.device.profile.chassis.cameraStyle).toBe(
    "samsung-vertical-rings",
  );
  expect(data.device.ramGb).toBe("8GB");
  expect(data.device.ufsLifetimeUsedPct).toBe(30);

  expect(data.health.healthPct).toBe(88);
  expect(data.health.stateOfHealthPct).toBe(88);
  expect(data.health.cycleCount).toBe(768);
  expect(Math.abs(data.health.currentMa ?? 0)).toBeGreaterThan(100);
  expect(data.health.manufacturedDate).toBe("2024-04-11");

  expect(data.thermals.sensors.length).toBeGreaterThanOrEqual(8);
  expect(data.thermals.skinTempC).toBeCloseTo(39.8, 1);

  expect(data.drain.cellularDrainMah).toBe(879);
  expect(data.drain.wifiDrainMah).toBe(100);
});

test("parses Android 11 synthetic legacy dump without fabricating health or missing power/history", async () => {
  const android11Dump = [
    "== dumpstate: 2026-11-22 18:42:02",
    "Build: RP1A.200720.012",
    "Build fingerprint: 'HMD/Deadpool_00WW/DPL_sprout:11/RKQ1.200928.002/00WW_3_290_SP02:user/release-keys'",
    "------ SYSTEM PROPERTIES (getprop) ------",
    "[ro.product.brand]: [Nokia]",
    "[ro.product.manufacturer]: [HMD Global]",
    "[ro.product.model]: [Nokia 3.2]",
    "[ro.product.device]: [DPL_sprout]",
    "------ END ------",
    "DUMP OF SERVICE battery:",
    "  status: 3",
    "  health: 2",
    "  level: 98",
    "  voltage: 4210",
    "  temperature: 342",
    "  current now: -179138",
    "  Charge counter: 2020590",
    "  technology: Li-ion",
    "--------- 0.005s was the duration of dumpsys battery",
    "DUMP OF SERVICE thermalservice:",
    "HAL Ready: false",
    "--------- 0.005s was the duration of dumpsys thermalservice",
    "DUMP OF SERVICE batterystats:",
    "Battery History (3% used, 12KB used of 4096KB, 10 strings using 1KB):",
    "                    0 (14) RESET:TIME: 2026-11-22-15-00-00",
    '                    0 (2) 100 c2100020 status=discharging temp=340 volt=4250 +screen top=u0a182:"com.instagram.android"',
    "             +5m30s000ms (2) 099 c2100020 temp=350 -screen",
    "            +1h10m00s000ms (2) 097 c2100020 status=charging +charging volt=4310",
    "Statistics since last charge:",
    "  Time on battery: 1h 10m 0s 0ms (100.0%) realtime",
    "  Screen on: 5m 30s 0ms (7.8%) 1x",
    "  Estimated power use (mAh):",
    "    Capacity: 4000, Computed drain: 140, actual drain: 120-150",
    "    Screen: 80.3 Excluded from smearing",
    "    Uid 1000: 35.4 ( cpu=30.1 wake=1.2 radio=4.1 ) Excluded from smearing",
    "    Cell standby: 12.5 ( radio=12.5 ) Excluded from smearing",
    "    Idle: 67.4 Excluded from smearing",
    "    Uid u0a182: 18.2 ( cpu=12.0 radio=6.2 ) Including smearing: 45.0 ( screen=22.0 proportional=4.8 )",
    "--------- 0.010s was the duration of dumpsys batterystats",
  ].join("\n");

  const data = await parseBugReport(new Blob([android11Dump]));
  expect(data.device.profile.badgeName).toBe("Mystery Brick");
  expect(data.health.healthPct).toBeNull();
  expect(data.health.learnedMah).toBeNull();
  expect(data.health.cycleCount).toBeNull();
  expect(data.health.currentMa).toBe(-179);
  expect(data.thermals.sensors.length).toBe(0);
  expect(data.thermals.batteryTempC).toBeCloseTo(34.2, 1);

  expect(data.timeline.length).toBe(3);
  expect(data.timeline[0].time).toBe("11-22 15:00");
  expect(data.timeline[1].screenOn).toBe(false);
  expect(data.timeline[2].charging).toBe(true);
  expect(data.timeline[2].tsMs).toBeGreaterThan(data.timeline[0].tsMs);

  expect(data.drain.globalSubsystems.map((s) => s.name)).toEqual([
    "screen",
    "idle",
    "mobile_radio",
  ]);
  expect(data.drain.drainers.length).toBe(2);
  expect(data.drain.drainers[1].packageName).toBe("com.instagram.android");
});

test("parses Nokia 3.2 Android 11 bugreport.zip gracefully without fake health/standby values", async () => {
  const file = Bun.file(
    "assets/bug_reports/NOKIA_3.2-bugreport-Deadpool_00WW-RKQ1.200928.002-2026-11-22-20-12-41.zip",
  );
  if (!(await file.exists())) return;

  const data = await parseBugReport(file);
  expect(data.device.profile.layer).toBe("generic");
  expect(data.device.profile.badgeName).toBe("Mystery Brick");
  expect(data.health.healthPct).toBeNull();
  expect(data.health.learnedMah).toBeNull();
  expect(data.health.cycleCount).toBeNull();
  expect(data.thermals.sensors.length).toBe(0);
  expect(data.drain.screenOffMs).toBe(0);
  expect(data.drain.drainers.length).toBeGreaterThanOrEqual(4);
  expect(data.dailyStats.length).toBe(11);
});

test("parses Samsung Galaxy A20s Android 11 bugreport.zip with normalized uA current, timeline, and drainers", async () => {
  const file = Bun.file(
    "assets/bug_reports/SAMSUNGA20s-bugreport-a20sxx-RP1A.200720.012-2026-11-22-18-42-02.zip",
  );
  if (!(await file.exists())) return;

  const data = await parseBugReport(file);
  expect(data.device.profile.id).toBe("samsung");
  expect(data.device.profile.badgeName).toBe("Close Enough");
  expect(data.health.currentMa).toBe(-179);
  expect(data.timeline.length).toBeGreaterThan(20);
  expect(data.drain.drainers.length).toBeGreaterThanOrEqual(10);
  expect(data.drain.globalSubsystems.length).toBeGreaterThanOrEqual(3);
});

test("parses Redmi Note 13 Pro+ Android 16 bugreport.zip with relative timeline & Xiaomi brand profile", async () => {
  const file = Bun.file(
    "assets/bug_reports/REDMI_NOTE13PROPLUS-bugreport-zircon_in-BP2A.250605.031.A3-2026-11-21-08-21-05.zip",
  );
  if (!(await file.exists())) return;

  const data = await parseBugReport(file);
  expect(data.device.profile.id).toBe("xiaomi");
  expect(data.device.profile.badgeName).toBe("Close Enough");
  expect(data.health.healthPct ?? 0).toBeCloseTo(66.9, 1);
  expect(data.health.verdict).toBe("Worn");
  expect(data.health.cycleCount).toBe(732);
  expect(data.timeline.length).toBeGreaterThan(50);
  expect(data.thermals.sensors.length).toBeGreaterThanOrEqual(5);
  expect(data.drain.drainers.length).toBeGreaterThanOrEqual(15);
});

test("validates offline PWA manifest and generated Service Worker script", async () => {
  const manifest = (await Bun.file("public/manifest.webmanifest").json()) as {
    id: string;
    name: string;
    display: string;
    start_url: string;
    scope: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("./");
  expect(manifest.scope).toBe("./");
  expect(manifest.icons.some((i) => i.sizes === "192x192")).toBe(true);
  expect(
    manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "any"),
  ).toBe(true);
  expect(
    manifest.icons.some(
      (i) => i.sizes === "512x512" && i.purpose === "maskable",
    ),
  ).toBe(true);
  for (const icon of manifest.icons) {
    const rel = icon.src.replace(/^\.\//, "");
    expect(await Bun.file(`public/${rel}`).exists()).toBe(true);
  }

  const sw = buildServiceWorkerSource("pregnantbattery-v0.1.2-alpha-abc", [
    "./",
    "./index.html",
    "./assets/index.js",
  ]);
  expect(sw).toContain("pregnantbattery-v0.1.2-alpha-abc");
  expect(sw).toContain("./assets/index.js");
  expect(sw).toContain('addEventListener("install"');
  expect(sw).toContain('addEventListener("fetch"');
  expect(() =>
    new Bun.Transpiler({ loader: "js" }).transformSync(sw),
  ).not.toThrow();
});

test("rejects empty or invalid files with clear errors", async () => {
  await expect(parseBugReport(new Blob([]))).rejects.toThrow(/0 bytes/i);
  await expect(
    parseBugReport(new Blob(["hello world not a bugreport"])),
  ).rejects.toThrow(/Zero Android bugreport telemetry/i);
});
