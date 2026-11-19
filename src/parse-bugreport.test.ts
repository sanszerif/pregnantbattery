import { expect, test } from 'bun:test';
import { parseBugReport } from './parse-bugreport';

test('parses synthetic dumpstate covering edge cases cleanly', async () => {
  const sampleDump = [
    '== dumpstate: 2027-01-01 00:15:00',
    'Build: AP4A.250105.002',
    "Build fingerprint: 'google/cheetah/cheetah:16/AP4A.250105.002/123456:user/release-keys'",
    '------ SYSTEM PROPERTIES (getprop) ------',
    '[ro.product.marketname]: [Pixel 7 Pro]',
    '[ro.product.manufacturer]: [Google]',
    '[ro.boot.bootreason]: [reboot,userrequested]',
    '------ END ------',
    '-------------------------------------------------------------------------------',
    'DUMP OF SERVICE android.hardware.health.IHealth/default:',
    'getHealthInfo -> HealthInfo{batteryStatus: DISCHARGING, batteryLevel: 82, batteryVoltageMillivolts: 3980, batteryTemperatureTenthsCelsius: 315, batteryCurrentMicroamps: -250000, batteryFullChargeUah: 4360000, batteryFullChargeDesignCapacityUah: 5002000, batteryCycleCount: 410, batteryTechnology: Li-ion, chargingPolicy: DEFAULT, lifetimeA: 0}',
    '--------- 0.010s was the duration of dumpsys android.hardware.health.IHealth/default, ending at: 2027-01-01 00:15:01',
    '-------------------------------------------------------------------------------',
    'DUMP OF SERVICE android.hardware.thermal.IThermal/default:',
    'getCurrentTemperatures:',
    '  Type: SKIN Name: VIRTUAL-SKIN CurrentValue: 33.4 ThrottlingStatus: NONE',
    '  Type: UNKNOWN Name: broken_therm CurrentValue: -273.15 ThrottlingStatus: NONE',
    '  Type: BATTERY Name: battery CurrentValue: 31.5 ThrottlingStatus: NONE',
    '--------- 0.010s was the duration of dumpsys android.hardware.thermal.IThermal/default, ending at: 2027-01-01 00:15:02',
    '-------------------------------------------------------------------------------',
    'DUMP OF SERVICE batterystats:',
    'Battery History [3]:',
    '  12-31 23:50:00.100 090 10000000 status=discharging temp=300 volt=4050 +screen fg=u0a101:"com.screenzen"',
    '  12-31 23:55:00.200 090 10000000 temp=305 +wake_lock="*wal*:keep-screen-on"',
    '  01-01 00:05:00.300 089 10000000',
    '  01-01 00:10:00.400 088 10000000 -screen',
    'Daily stats:',
    '  Estimated power use (mAh):',
    '    Capacity: 5002, Computed drain: 100, actual drain: 90-100',
    '    screen: 50.0 duration: 10m 0s',
    '  UID u0a999: 99.0',
    'Statistics since last charge:',
    '  Time on battery: 1h 0m 0s 0ms (100.0%) realtime',
    '  Time on battery screen off: 45m 0s 0ms (75.0%)',
    '  Discharge: 200 mAh',
    '  Screen off discharge: 50 mAh',
    '  Screen on discharge: 150 mAh',
    '  Screen on: 15m 0s 0ms (25.0%) 3x',
    '  Total partial wakelock time: 5m 0s 0ms',
    '  Estimated power use (mAh):',
    '    Capacity: 5002, Computed drain: 200, actual drain: 190-210',
    '    screen: 120.0 duration: 15m 0s',
    '    cpu: 40.0 duration: 20m 0s',
    '    wifi: 20.0 duration: 30m 0s',
    '  UID u0a101: 85.4',
    '      cpu=60.2 wifi=25.2',
    '',
    '      (on battery, screen off/doze) cpu=0.5',
    '  All kernel wake locks:',
    '  u0a101:',
    '    Apk com.screenzen:',
    '--------- 0.050s was the duration of dumpsys batterystats, ending at: 2027-01-01 00:15:03',
  ].join('\n');

  const data = await parseBugReport(new Blob([sampleDump]));

  expect(data.health.technology).toBe('Li-ion');
  expect(data.device.bootReason).toBe('reboot,userrequested');
  expect(data.device.ufsLifetimeUsedPct).toBeNull();

  expect(data.thermals.sensors.some((s) => s.name === 'broken_therm')).toBe(false);
  expect(data.thermals.sensors.length).toBe(2);

  expect(data.timeline.length).toBe(4);
  expect(data.timeline[0].screenOn).toBe(true);
  expect(data.timeline[1].screenOn).toBe(true);
  expect(data.timeline[2].level).toBe(89);
  expect(data.timeline[3].screenOn).toBe(false);
  for (let i = 1; i < data.timeline.length; i++) {
    expect(data.timeline[i].tsMs).toBeGreaterThan(data.timeline[i - 1].tsMs);
  }

  expect(data.drain.globalSubsystems.map((s) => s.name)).toEqual(['screen', 'cpu', 'wifi']);
  expect(data.drain.drainers.length).toBe(1);
  expect(data.drain.drainers[0].packageName).toBe('com.screenzen');
  expect(data.drain.drainers[0].detail).toContain('cpu 60 mAh');
  expect(data.drain.drainers[0].detail).toContain('wifi 25 mAh');
});

test('parses Android 17 bugreport.zip dynamically with real-time progress stages', async () => {
  const extFile = Bun.file('D:\\projects\\misc\\bugreport.zip');
  const localFile = Bun.file('assets/bugreport.zip');
  const file = (await extFile.exists()) ? extFile : localFile;
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

  expect(data.device.codename).toBe('cheetah');
  expect(data.device.model).toBe('Pixel 7 Pro');
  expect(data.device.manufacturer).toBe('Google');
  expect(data.device.androidVersion).toBe('17');
  expect(data.device.isThermalBoot).toBe(true);

  expect(data.health.learnedMah).toBe(4360);
  expect(data.health.designMah).toBe(5002);
  expect(data.health.healthPct ?? 0).toBeCloseTo(87.2, 1);
  expect(data.health.cycleCount).toBe(824);
  expect(data.health.verdict).toBe('Fair');

  expect(data.thermals.overallStatus).toBe(3);
  expect(data.thermals.preRebootTempC).toBeCloseTo(55.3, 1);
  expect(data.thermals.skinTempC).toBeGreaterThan(44);
  expect(data.thermals.sensors.length).toBeGreaterThan(8);
  expect(data.thermals.sensors.some((s) => s.status === 'SEVERE')).toBe(true);

  expect(data.drain.totalDischargeMah).toBe(2010);
  expect(data.drain.screenOnDischargeMah).toBe(566);
  expect(data.drain.screenOffDischargeMah).toBe(1444);

  const pkgs = data.drain.drainers.map((d) => d.packageName);
  expect(pkgs).toContain('com.resilio.sync');
  expect(pkgs).toContain('com.screenzen');
  expect(data.timeline.length).toBeGreaterThan(50);

  expect(data.dailyStats.length).toBe(11);
  expect(data.dailyStats[0].date).toBe('11-05');
  expect(data.dailyStats[data.dailyStats.length - 1].date).toBe('11-18');
  expect(data.drain.screenOnPctPerHr ?? 0).toBeCloseTo(28.6, 1);
  expect(data.drain.screenOffPctPerHr ?? 0).toBeCloseTo(5.9, 1);
  expect(data.drain.chargePctPerHr ?? 0).toBeGreaterThan(15);

  expect(data.thermals.bcl.heavyCount).toBe(277);
  expect(data.thermals.bcl.totalThrottle).toBe(864);
  expect(data.thermals.bcl.modules[0].module).toBe('AUDIO');

  expect(data.drain.unattributedTotalMah).toBeGreaterThan(700);
  expect(data.drain.activeAudioClients.length).toBeGreaterThan(0);
  expect(data.drain.activeAudioClients[0].uid).toBe('2000');
  const shellDrainer = data.drain.drainers.find((d) => d.id === 'uid-2000');
  expect(shellDrainer?.procs).toContain('adbd');
  expect(shellDrainer?.procs).toContain('app_process');
  expect(shellDrainer?.activeAudio).toBe('REMOTE_SUBMIX');
});

test('rejects empty or invalid files with clear errors', async () => {
  await expect(parseBugReport(new Blob([]))).rejects.toThrow(/0 bytes/i);
  await expect(parseBugReport(new Blob(['hello world not a bugreport']))).rejects.toThrow(/Zero Android bugreport telemetry/i);
});
