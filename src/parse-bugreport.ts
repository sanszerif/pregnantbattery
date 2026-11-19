// shortcut: supports standard 32-bit ZIP deflate-raw/stored entries (<4GB); upgrade to ZIP64 if adb bugreports exceed 4GB

export interface TimelinePoint {
  time: string;
  tsMs: number;
  level: number;
  tempC: number;
  voltMv: number;
  chargeMah: number;
  screenOn: boolean;
  charging: boolean;
}

export interface ThermalSensor {
  name: string;
  label: string;
  type: string;
  currentC: number;
  peakC: number | null;
  status: string;
}

export interface DrainerItem {
  id: string;
  name: string;
  packageName: string;
  kind: 'app' | 'system';
  totalMah: number;
  screenOffMah: number;
  wakelockMs: number;
  wakeups: number;
  detail: string;
  procs: string[];
  wifiData: string | null;
  activeAudio: string | null;
  holdingWakelock: boolean;
}

export interface DailyStatPoint {
  date: string;
  dischargePct: number;
  chargePct: number;
  drainPctPerHr: number;
  chargePctPerHr: number;
}

export interface BclModuleStat {
  module: string;
  label: string;
  startCount: number;
  lightCount: number;
  mediumCount: number;
  heavyCount: number;
  totalThrottle: number;
}

export interface BugReportData {
  fileName: string;
  device: {
    model: string;
    brand: string;
    manufacturer: string;
    codename: string;
    build: string;
    androidVersion: string;
    dumpTime: string;
    bootReason: string;
    isThermalBoot: boolean;
    ramGb: string;
    storageGb: string;
    ufsLifetimeUsedPct: number | null;
  };
  health: {
    learnedMah: number | null;
    designMah: number | null;
    healthPct: number | null;
    lostMah: number | null;
    cycleCount: number | null;
    status: string;
    technology: string;
    verdict: 'Good' | 'Fair' | 'Worn' | 'Unknown';
    levelPct: number;
    voltageMv: number;
    currentMa: number | null;
    tempC: number;
    chargingPolicy: string;
    manufacturedDate: string | null;
  };
  thermals: {
    overallStatus: number;
    overallStatusLabel: string;
    preRebootTempC: number | null;
    preRebootTime: string | null;
    skinTempC: number;
    batteryTempC: number;
    coilTempC: number | null;
    cpuPeakC: number | null;
    gpuPeakC: number | null;
    sensors: ThermalSensor[];
    bcl: {
      totalThrottle: number;
      heavyCount: number;
      mediumCount: number;
      lightCount: number;
      modules: BclModuleStat[];
    };
  };
  drain: {
    screenOnMs: number;
    screenOnCount: number;
    screenOffMs: number;
    totalDischargeMah: number;
    screenOnDischargeMah: number;
    screenOffDischargeMah: number;
    deepDozeDischargeMah: number;
    screenOnPctDrop: number;
    screenOffPctDrop: number;
    screenOnPctPerHr: number | null;
    screenOffPctPerHr: number | null;
    chargePctPerHr: number | null;
    partialWakelockMs: number;
    awakeWhileScreenOffPct: number;
    wifiDrainMah: number;
    wifiTxGb: string;
    wifiRxMb: string;
    wifiPoorSignalPct: number;
    activeRateMahPerHr: number;
    idleRateMahPerHr: number;
    unattributedTotalMah: number;
    activeAudioClients: { uid: string; name: string; source: string }[];
    globalSubsystems: {
      name: string;
      label: string;
      mah: number;
      appsMah: number | null;
      unattributedMah: number;
      detail: string;
    }[];
    drainers: DrainerItem[];
  };
  timeline: TimelinePoint[];
  dailyStats: DailyStatPoint[];
}

const SYSTEM_UID_NAMES: Record<string, { name: string; pkg: string }> = {
  '0': { name: 'Linux Kernel & Root', pkg: 'kernel' },
  '1000': { name: 'Android System', pkg: 'android.system' },
  '1001': { name: 'Phone & Cellular Radio', pkg: 'com.android.phone' },
  '1041': { name: 'Audio Server', pkg: 'audioserver' },
  '1046': { name: 'Media / Codec Server', pkg: 'mediaserver' },
  '1073': { name: 'Network Stack', pkg: 'com.android.networkstack' },
  '2000': { name: 'ADB / USB Shell', pkg: 'com.android.shell' },
};

const FRIENDLY_PKG_MAP: Record<string, string> = {
  'com.resilio.sync': 'Resilio Sync',
  'com.screenzen': 'ScreenZen',
  'com.whatsapp': 'WhatsApp',
  'com.whatsapp.w4b': 'WhatsApp Business',
  'com.android.vending': 'Google Play Store',
  'com.google.android.gms': 'Google Play Services',
  'com.google.android.googlequicksearchbox': 'Google App',
  'com.android.chrome': 'Chrome',
  'com.instagram.android': 'Instagram',
  'com.facebook.katana': 'Facebook',
  'com.netflix.mediaclient': 'Netflix',
  'com.viscouspot.gitsync': 'GitSync',
  'com.sameerasw.essentials': 'Essentials',
  'com.musixmatch.android.lyrify': 'Musixmatch',
  'com.google.android.apps.nexuslauncher': 'Pixel Launcher',
  'com.google.android.apps.photos': 'Google Photos',
  'com.google.android.apps.nbu.files': 'Files by Google',
  'com.google.android.as': 'Android System Intelligence',
  'com.google.android.contacts': 'Google Contacts',
  'com.android.systemui': 'System UI',
  'com.google.android.youtube': 'YouTube',
  'com.spotify.music': 'Spotify',
  'com.starlink.mobile': 'Starlink',
};

const SENSOR_LABELS: Record<string, { label: string; group: string }> = {
  'VIRTUAL-SKIN': { label: 'Outer Device Skin', group: 'Body' },
  'VIRTUAL-SKIN-CHARGE': { label: 'Charging Surface', group: 'Body' },
  battery: { label: 'Battery Cell', group: 'Battery' },
  qi_therm: { label: 'Wireless Charging Coil', group: 'Charging' },
  gnss_tcxo_therm: { label: 'GPS / GNSS Radio', group: 'Radio' },
  'cellular-emergency': { label: 'Cellular Modem', group: 'Radio' },
  BIG: { label: 'CPU Prime Cores (BIG)', group: 'CPU' },
  MID: { label: 'CPU Performance Cores (MID)', group: 'CPU' },
  LITTLE: { label: 'CPU Efficiency Cores (LITTLE)', group: 'CPU' },
  G3D: { label: 'Graphics (GPU)', group: 'GPU' },
  TPU: { label: 'Neural / AI Processor', group: 'NPU' },
  disp_therm: { label: 'Display Panel', group: 'Display' },
  usb_pwr_therm: { label: 'USB-C Power Port', group: 'Charging' },
  usb_pwr_therm2: { label: 'USB-C Secondary Sensor', group: 'Charging' },
  quiet_therm: { label: 'Rear Chassis Thermistor', group: 'Body' },
  neutral_therm: { label: 'Mid-Frame Thermistor', group: 'Body' },
};

const HAL_TYPE_NAMES: Record<number, string> = {
  0: 'CPU',
  1: 'GPU',
  2: 'Battery',
  3: 'Body',
  4: 'USB Port',
  5: 'Modem',
  6: 'BCL',
  7: 'NPU',
  9: 'NPU',
};

const THERMAL_STATUS_NAMES = ['NONE', 'LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL', 'EMERGENCY', 'SHUTDOWN'];
const THROTTLE_RANK: Record<string, number> = {
  SHUTDOWN: 6,
  EMERGENCY: 5,
  CRITICAL: 4,
  SEVERE: 3,
  MODERATE: 2,
  LIGHT: 1,
  NONE: 0,
};

const THERMAL_STATUS_LABELS = [
  'Normal (None)',
  'Light Throttling',
  'Moderate Throttling',
  'Severe Throttling',
  'Critical Heat',
  'Emergency',
  'Shutdown Imminent',
];

const SUBSYSTEM_LABELS: Record<string, string> = {
  wifi: 'Wi-Fi Radio',
  audio: 'Audio Subsystem',
  cpu: 'Processor (CPU)',
  screen: 'Display Screen',
  wakelock: 'Background Wakelocks',
  mobile_radio: 'Cellular Modem',
  camera: 'Camera Hardware',
  GPU: 'Graphics (GPU)',
  video: 'Video Decoder',
  bluetooth: 'Bluetooth',
  phone: 'Voice Calls',
  ambient_display: 'Always-On Display',
  gnss: 'GPS Location',
  TPU: 'AI / NPU Accelerator',
};

const BATTERY_SERVICE_STATUS: Record<number, string> = {
  1: 'UNKNOWN',
  2: 'CHARGING',
  3: 'DISCHARGING',
  4: 'NOT_CHARGING',
  5: 'FULL',
};

const BCL_MODULE_LABELS: Record<string, string> = {
  AUDIO: 'Audio & Haptics',
  HAPTICS: 'Haptics',
  CAMERA: 'Camera',
  INT: 'SoC Bus (INT)',
  GPU: 'Graphics (GPU)',
  TPU: 'AI / TPU',
  MODEM: 'Cellular Modem',
  DDR: 'Memory (DDR)',
  CPU_BIG: 'CPU Prime',
  CPU_MID: 'CPU Perf',
  CPU_LITTLE: 'CPU Eff',
  DISPLAY: 'Display',
  WLAN: 'Wi-Fi',
};

function normalizeAudioUid(rawUid: string): string {
  const n = Number(rawUid);
  if (Number.isInteger(n) && n >= 10000) return `u0a${n - 10000}`;
  return rawUid;
}

export function parseDurationMs(str: string): number {
  let total = 0;
  for (const m of str.matchAll(/(\d+)\s*(ms|d|h|m|s)/g)) {
    const val = Number(m[1]);
    switch (m[2]) {
      case 'd': total += val * 86_400_000; break;
      case 'h': total += val * 3_600_000; break;
      case 'm': total += val * 60_000; break;
      case 's': total += val * 1000; break;
      case 'ms': total += val; break;
    }
  }
  return total;
}

export function formatDurationShort(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function friendlySensorLabel(name: string, rawType: string): { label: string; group: string } {
  if (SENSOR_LABELS[name]) return SENSOR_LABELS[name];
  const lower = name.toLowerCase();
  const group =
    rawType && rawType !== 'UNKNOWN' && rawType !== '-1'
      ? titleCase(rawType.toLowerCase().replace(/_/g, ' '))
      : lower.includes('cpu') || lower.includes('soc')
      ? 'CPU'
      : lower.includes('gpu')
      ? 'GPU'
      : lower.includes('bat')
      ? 'Battery'
      : lower.includes('skin')
      ? 'Body'
      : lower.includes('usb') || lower.includes('chg') || lower.includes('qi')
      ? 'Charging'
      : 'Other';
  const cleaned = name
    .replace(/^VIRTUAL-/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\btherm\b/i, 'Sensor')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : titleCase(w.toLowerCase())))
    .join(' ');
  return { label: cleaned || name, group };
}

function friendlyAppName(pkg: string, uid?: string): string {
  if (!pkg && uid && SYSTEM_UID_NAMES[uid]) return SYSTEM_UID_NAMES[uid].name;
  if (FRIENDLY_PKG_MAP[pkg]) return FRIENDLY_PKG_MAP[pkg];
  const base = pkg.split(':')[0];
  if (FRIENDLY_PKG_MAP[base]) return FRIENDLY_PKG_MAP[base];
  const parts = base.split('.').filter((p) => !['com', 'org', 'net', 'io', 'android', 'google', 'apps', 'app', 'client'].includes(p));
  const raw = parts[parts.length - 1] || base || uid || 'Unknown';
  return titleCase(raw);
}

function parseTimestampMs(year: number, mmddHhmmss: string): number {
  const m = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(mmddHhmmss);
  if (!m) return 0;
  return Date.UTC(year, Number(m[1]) - 1, Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

async function openBugreportByteStream(
  file: Blob & { name?: string },
  onProgress?: (pct: number, stage?: string) => void,
): Promise<{ stream: ReadableStream<Uint8Array>; expectedTextBytes: number }> {
  if (file.size === 0) {
    throw new Error('That file is literally 0 bytes. Let adb bugreport finish generating before dropping it here.');
  }
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head.length === 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;

  if (!isZip) {
    if (file.name?.toLowerCase().endsWith('.zip')) {
      throw new Error('This file ends in .zip, but its ZIP header is invalid or corrupted.');
    }
    onProgress?.(5, 'Reading bugreport text stream...');
    return {
      stream: file.stream() as unknown as ReadableStream<Uint8Array>,
      expectedTextBytes: file.size,
    };
  }

  onProgress?.(4, 'Inspecting ZIP Central Directory...');
  const tailLen = Math.min(file.size, 65557);
  const tailBuf = await file.slice(file.size - tailLen).arrayBuffer();
  const tailView = new DataView(tailBuf);
  let eocdPos = -1;
  for (let i = tailBuf.byteLength - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) throw new Error('Corrupted ZIP archive: End of Central Directory signature missing.');

  const cdSize = tailView.getUint32(eocdPos + 12, true);
  const cdOffset = tailView.getUint32(eocdPos + 16, true);
  const cdBuf = await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
  const cdBytes = new Uint8Array(cdBuf);
  const cdView = new DataView(cdBuf);
  const utf8 = new TextDecoder();

  let best: { name: string; method: number; compSize: number; uncompSize: number; localOffset: number } | null = null;
  let pos = 0;
  while (pos + 46 <= cdBytes.length) {
    if (cdView.getUint32(pos, true) !== 0x02014b50) break;
    const method = cdView.getUint16(pos + 10, true);
    const compSize = cdView.getUint32(pos + 20, true);
    const uncompSize = cdView.getUint32(pos + 24, true);
    const nameLen = cdView.getUint16(pos + 28, true);
    const extraLen = cdView.getUint16(pos + 30, true);
    const commentLen = cdView.getUint16(pos + 32, true);
    const localOffset = cdView.getUint32(pos + 42, true);
    const name = utf8.decode(cdBytes.subarray(pos + 46, pos + 46 + nameLen));

    const isMainBugreport = /(?:^|\/)bugreport-.*\.txt$/i.test(name);
    const isTxt = name.toLowerCase().endsWith('.txt');
    if (isMainBugreport) {
      best = { name, method, compSize, uncompSize, localOffset };
      break;
    }
    if (isTxt && (!best || uncompSize > best.uncompSize)) {
      best = { name, method, compSize, uncompSize, localOffset };
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }

  if (!best) throw new Error('Found a ZIP file, but zero bugreport-*.txt dumps inside it.');

  const lhBuf = await file.slice(best.localOffset, best.localOffset + 30).arrayBuffer();
  const lhView = new DataView(lhBuf);
  if (lhView.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Corrupt ZIP local file header.');
  }
  const localNameLen = lhView.getUint16(26, true);
  const localExtraLen = lhView.getUint16(28, true);
  const dataStart = best.localOffset + 30 + localNameLen + localExtraLen;
  const compressedSlice = file.slice(dataStart, dataStart + best.compSize);
  const rawStream = compressedSlice.stream() as unknown as ReadableStream<Uint8Array>;
  const expectedTextBytes = best.uncompSize > 0 ? best.uncompSize : best.compSize * 6;

  if (best.method === 0) return { stream: rawStream, expectedTextBytes };
  if (best.method === 8) {
    return {
      stream: rawStream.pipeThrough(new DecompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>),
      expectedTextBytes,
    };
  }
  throw new Error(`Unsupported ZIP compression method (${best.method}). Expected DEFLATE (8) or STORED (0).`);
}

type Section =
  | 'header'
  | 'props'
  | 'ihealth'
  | 'ithermal'
  | 'thermalservice'
  | 'mitigation'
  | 'battery'
  | 'batterystats'
  | 'audiopolicy'
  | 'skip';
type BsSub = 'history' | 'discharge_steps' | 'charge_steps' | 'daily' | 'stats' | 'power' | 'wakelocks' | 'uids' | 'skip';

export async function parseBugReport(
  file: Blob & { name?: string },
  onProgress?: (pct: number, stage?: string) => void,
): Promise<BugReportData> {
  const { stream: byteStream, expectedTextBytes } = await openBugreportByteStream(file, onProgress);
  const textStream = byteStream.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>);
  const reader = textStream.getReader();

  let section: Section = 'header';
  let bsSub: BsSub = 'skip';
  let lineCount = 0;

  // Device metadata
  let dumpTime = '';
  let build = '';
  let codename = '';
  let androidVersion = '';
  let bootReason = '';
  let ramGb = '';
  let storageGb = '';
  let ufsLifetimeUsedPct: number | null = null;
  let propMarketName = '';
  let propModel = '';
  let propBrand = '';
  let propManufacturer = '';
  let propDevice = '';

  // Health (IHealth + battery service fallback)
  let learnedMah: number | null = null;
  let estimatedMah: number | null = null;
  let designMah: number | null = null;
  let cycleCount: number | null = null;
  let healthStatus = 'UNKNOWN';
  let technology = 'Li-ion';
  let levelPct = 0;
  let voltageMv = 0;
  let currentMa: number | null = null;
  let tempC = 0;
  let chargingPolicy = 'DEFAULT';
  let manufacturedDate: string | null = null;
  let svcChargeCounterMah = 0;

  // Thermals & BCL
  let thermalSub = '';
  const currentTempMap = new Map<string, { type: string; value: number; status: string }>();
  const cachedTempMap = new Map<string, number>();
  let overallThermalStatus = 0;
  let preRebootTempC: number | null = null;
  let preRebootTime: string | null = null;
  let inPreReboot = false;
  let inKernelBcl = false;
  const rawBclModules: BclModuleStat[] = [];

  // Audio policy active recording clients
  let inAudioRecord = false;
  let pendingAudioClient: { uid: string; source: string } | null = null;
  const rawAudioClients: { uid: string; source: string }[] = [];

  // Battery History timeline
  let dumpYear = 0;
  let dumpMonth = 0;
  let curYear = new Date().getFullYear();
  let hasExplicitHistoryYear = false;
  let curTempC = 30;
  let curVoltMv = 3900;
  let curChargeMah = 0;
  let curScreenOn = false;
  let curCharging = false;
  let lastSavedLevel = -1;
  let lastSavedTemp = -999;
  let lastSavedScreen: boolean | null = null;
  let lastSavedCharging: boolean | null = null;
  let lastSavedTs = 0;
  const timeline: TimelinePoint[] = [];

  // Drain stats
  let screenOnMs = 0;
  let screenOnCount = 0;
  let screenOffMs = 0;
  let totalDischargeMah = 0;
  let screenOnDischargeMah = 0;
  let screenOffDischargeMah = 0;
  let deepDozeDischargeMah = 0;
  let screenOnPctDrop = 0;
  let screenOffPctDrop = 0;
  let partialWakelockMs = 0;
  let wifiDrainMah = 0;
  let wifiTxGb = '0 B';
  let wifiRxMb = '0 B';
  let wifiPoorSignalPct = 0;
  let inWifiRssi = false;

  // Step durations & 2-week daily stats
  let estScreenOffFullMs = 0;
  let estScreenOnFullMs = 0;
  let stepScreenOffMs = 0;
  let stepScreenOffCount = 0;
  let stepScreenOnMs = 0;
  let stepScreenOnCount = 0;
  let stepChargeMs = 0;
  let stepChargeCount = 0;

  interface RawDailyEntry {
    date: string;
    dischargeMs: number;
    dischargeSteps: number;
    chargeMs: number;
    chargeSteps: number;
  }
  const rawDailyEntries: RawDailyEntry[] = [];
  let curDaily: RawDailyEntry | null = null;

  const globalSubsystems: {
    name: string;
    label: string;
    mah: number;
    appsMah: number | null;
    unattributedMah: number;
    detail: string;
  }[] = [];
  let powerMode: 'global' | 'sub' | 'uid' = 'global';
  interface RawUidPower {
    uid: string;
    totalMah: number;
    screenOffMah: number;
    wakelockMs: number;
    detail: string;
  }
  const rawUidPowers: RawUidPower[] = [];
  let activeUidPower: RawUidPower | null = null;

  const applyUidComponents = (text: string, target: RawUidPower) => {
    const wlMatch = /wakelock=[\d.]+\s*\(([^)]+)\)/.exec(text);
    if (wlMatch) target.wakelockMs = Math.max(target.wakelockMs, parseDurationMs(wlMatch[1]));
    const parts: string[] = [];
    for (const cm of text.matchAll(/\b(cpu|audio|video|wifi|wakelock|camera|GPU|bluetooth|gnss|mobile_radio)=([\d.]+)/g)) {
      if (parseFloat(cm[2]) >= 1) parts.push(`${cm[1]} ${Math.round(parseFloat(cm[2]))} mAh`);
    }
    if (parts.length > 0) target.detail = parts.slice(0, 3).join(' · ');
  };

  interface RawWakelock {
    uid: string;
    tag: string;
    durationMs: number;
    count: number;
  }
  const rawWakelocks: RawWakelock[] = [];
  const uidHoldingWakelock = new Set<string>();
  const uidAudioInMs = new Map<string, number>();
  const uidToPkgMap = new Map<string, string>();
  const uidWakeupsMap = new Map<string, number>();
  const uidProcsMap = new Map<string, string[]>();
  const uidWifiDataMap = new Map<string, string>();
  let currentUidBlock = '';

  const processLine = (raw: string) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    lineCount++;

    if (line.startsWith('------ SYSTEM PROPERTIES')) {
      section = 'props';
      return;
    }
    if (
      (section === 'props' && line.startsWith('------ ')) ||
      ((line.startsWith('------ ') || line.startsWith('--------- ')) && line.includes('was the duration of'))
    ) {
      section = 'skip';
      bsSub = 'skip';
      inPreReboot = false;
      inKernelBcl = false;
      inAudioRecord = false;
      pendingAudioClient = null;
      return;
    }

    if (line.startsWith('DUMP OF SERVICE ')) {
      if (line.includes('android.hardware.health.IHealth/')) section = 'ihealth';
      else if (line.includes('android.hardware.thermal.IThermal/')) {
        section = 'ithermal';
        thermalSub = '';
      } else if (line.includes('DUMP OF SERVICE thermalservice:')) {
        section = 'thermalservice';
        thermalSub = '';
      } else if (line.includes('IBatteryMitigation/')) {
        section = 'mitigation';
        inPreReboot = false;
        inKernelBcl = false;
      } else if (line.includes('DUMP OF SERVICE battery:')) {
        section = 'battery';
      } else if (line.includes('DUMP OF SERVICE batterystats:')) {
        section = 'batterystats';
        bsSub = 'skip';
      } else if (line.includes('DUMP OF SERVICE media.audio_policy:')) {
        section = 'audiopolicy';
        inAudioRecord = false;
        pendingAudioClient = null;
      } else {
        section = 'skip';
      }
      return;
    }

    if (section === 'skip') return;

    if (section === 'header') {
      if (lineCount > 120) {
        section = 'skip';
        return;
      }
      if (line.startsWith('== dumpstate:')) {
        dumpTime = line.replace('== dumpstate:', '').trim();
        const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(dumpTime);
        if (dm) {
          const y = Number(dm[1]);
          const m = Number(dm[2]);
          if (y > 2020) {
            dumpYear = y;
            curYear = y;
          }
          dumpMonth = m;
        }
      } else if (line.startsWith('Build: ')) {
        build = line.slice(7).trim();
      } else if (line.startsWith('Build fingerprint:')) {
        const m = /'([^/]+)\/[^/]+\/([^:]+):([^/]+)\//.exec(line);
        if (m) {
          if (!propBrand) propBrand = m[1];
          codename = m[2];
          androidVersion = m[3];
        }
      } else if (line.startsWith('androidboot.bootreason')) {
        bootReason = line.split('=')[1]?.replace(/"/g, '').trim() ?? '';
      } else if (line.startsWith('androidboot.ddr_size')) {
        ramGb = line.split('=')[1]?.replace(/"/g, '').trim() ?? '';
      } else if (line.startsWith('androidboot.hardware.ufs')) {
        const m = /"(\d+GB)"/i.exec(line);
        if (m) storageGb = m[1];
      }
      return;
    }

    if (section === 'props') {
      if (!line.startsWith('[ro.') && !line.startsWith('[sys.boot.reason]')) return;
      const pm = /^\[([^\]]+)\]:\s*\[([^\]]*)\]/.exec(line);
      if (!pm) return;
      const [, key, val] = pm;
      if (!val) return;
      if (key === 'ro.product.marketname' || key === 'ro.product.vendor.marketname') propMarketName = val;
      else if (key === 'ro.product.model' || key === 'ro.product.product.model') propModel = propModel || val;
      else if (key === 'ro.product.brand') propBrand = val;
      else if (key === 'ro.product.manufacturer') propManufacturer = val;
      else if (key === 'ro.product.device') propDevice = val;
      else if ((key === 'ro.boot.bootreason' || key === 'sys.boot.reason') && !bootReason) bootReason = val;
      return;
    }

    if (section === 'battery') {
      const t = line.trim();
      if (t.startsWith('level:')) levelPct = levelPct || (parseInt(t.split(':')[1], 10) || 0);
      else if (t.startsWith('voltage:')) voltageMv = voltageMv || (parseInt(t.split(':')[1], 10) || 0);
      else if (t.startsWith('temperature:')) {
        const val = parseInt(t.split(':')[1], 10);
        if (!tempC && Number.isFinite(val)) tempC = val / 10;
      } else if (t.startsWith('Charge counter:')) {
        svcChargeCounterMah = Math.round((parseInt(t.split(':')[1], 10) || 0) / 1000);
      } else if (t.startsWith('status:') && healthStatus === 'UNKNOWN') {
        const code = parseInt(t.split(':')[1], 10);
        healthStatus = BATTERY_SERVICE_STATUS[code] ?? healthStatus;
      } else if (t.startsWith('technology:')) {
        technology = t.split(':')[1].trim() || technology;
      } else if (t.startsWith('Charging policy:') && chargingPolicy === 'DEFAULT') {
        const pol = parseInt(t.split(':')[1], 10);
        if (pol === 2) chargingPolicy = 'LONG_LIFE';
      }
      return;
    }

    if (section === 'ihealth') {
      if (line.startsWith('getHealthInfo -> HealthInfo{')) {
        const num = (k: string) => {
          const m = new RegExp(`${k}:\\s*(-?\\d+)`).exec(line);
          return m ? Number(m[1]) : null;
        };
        const str = (k: string) => {
          const m = new RegExp(`${k}:\\s*([A-Za-z0-9_-]+)`).exec(line);
          return m ? m[1] : null;
        };
        const fullUah = num('batteryFullChargeUah');
        const designUah = num('batteryFullChargeDesignCapacityUah');
        const cyc = num('batteryCycleCount');
        const lvl = num('batteryLevel');
        const mv = num('batteryVoltageMillivolts');
        const t10 = num('batteryTemperatureTenthsCelsius');
        const ua = num('batteryCurrentMicroamps');
        const mfgSec = num('batteryManufacturingDateSeconds');
        const lifeA = /lifetimeA:\s*(\d+)/.exec(line);
        if (fullUah && fullUah > 0) learnedMah = Math.round(fullUah / 1000);
        if (designUah && designUah > 0) designMah = Math.round(designUah / 1000);
        if (cyc !== null && cyc >= 0) cycleCount = cyc;
        if (lvl !== null) levelPct = lvl;
        if (mv !== null) voltageMv = mv;
        if (t10 !== null) tempC = t10 / 10;
        if (ua !== null) currentMa = Math.round(ua / 1000);
        if (mfgSec && mfgSec > 0) {
          manufacturedDate = new Date(mfgSec * 1000).toISOString().slice(0, 10);
        }
        const lifeVal = lifeA ? Number(lifeA[1]) : 0;
        if (lifeVal > 0 && lifeVal <= 11) ufsLifetimeUsedPct = Math.min(100, lifeVal * 10);
        healthStatus = str('batteryStatus') ?? healthStatus;
        chargingPolicy = str('chargingPolicy') ?? chargingPolicy;
        technology = str('batteryTechnology') ?? technology;
      }
      return;
    }

    if (section === 'ithermal') {
      if (line.startsWith('getCurrentTemperatures:')) thermalSub = 'curr';
      else if (line.startsWith('get')) thermalSub = '';
      else if (thermalSub === 'curr') {
        const m = /Type:\s*(\S+)\s+Name:\s*(\S+)\s+CurrentValue:\s*([\d.-]+)\s+ThrottlingStatus:\s*(\S+)/.exec(line);
        if (m) {
          currentTempMap.set(m[2], { type: m[1], value: Number(m[3]), status: m[4] });
        }
      }
      return;
    }

    if (section === 'thermalservice') {
      if (line.startsWith('Thermal Status:')) {
        overallThermalStatus = Number(line.split(':')[1]?.trim() || 0);
      } else if (line.startsWith('Cached temperatures:')) {
        thermalSub = 'cached';
      } else if (line.startsWith('Current temperatures from HAL:')) {
        thermalSub = 'hal_curr';
      } else if (line.startsWith('HAL ') || line.startsWith('Current cooling') || line.startsWith('Temperature ')) {
        thermalSub = '';
      } else if (thermalSub === 'cached' || thermalSub === 'hal_curr') {
        const m = /mValue=([\d.-]+),\s*mType=(-?\d+),\s*mName=([^,]+),\s*mStatus=(\d+)/.exec(line);
        if (m) {
          const val = Number(m[1]);
          const typeCode = Number(m[2]);
          const name = m[3].trim();
          const status = THERMAL_STATUS_NAMES[Number(m[4])] ?? 'NONE';
          if (thermalSub === 'cached') {
            cachedTempMap.set(name, val);
          } else if (!currentTempMap.has(name)) {
            currentTempMap.set(name, {
              type: HAL_TYPE_NAMES[typeCode] ?? 'UNKNOWN',
              value: val,
              status,
            });
          }
        }
      }
      return;
    }

    if (section === 'mitigation') {
      if (line === 'RuntimeInfoBeforeReboot') inPreReboot = true;
      else if (line === 'RuntimeInfo' || line.startsWith('------')) inPreReboot = false;
      else if (inPreReboot) {
        if (line.startsWith('Time:')) preRebootTime = line.slice(5).trim();
        else if (line.startsWith('BatteryTemperatureTenthsCelsius:')) {
          preRebootTempC = Number(line.slice(32).trim()) / 10;
        }
      }
      if (line === 'Mitigation Count(From Kernel)') inKernelBcl = true;
      else if (line.startsWith('Mitigation Count(To Module)') || line.startsWith('------')) inKernelBcl = false;
      else if (inKernelBcl && line.includes(',')) {
        const cols = line.split(',');
        const mod = cols[0].trim();
        if (cols.length >= 9 && mod && mod !== 'MODULE' && mod !== 'UNDEFINED') {
          const startCount = Number(cols[1]) || 0;
          const lightCount = Number(cols[3]) || 0;
          const mediumCount = Number(cols[5]) || 0;
          const heavyCount = Number(cols[7]) || 0;
          const totalThrottle = lightCount + mediumCount + heavyCount;
          if (totalThrottle > 0) {
            rawBclModules.push({
              module: mod,
              label: BCL_MODULE_LABELS[mod] || titleCase(mod.toLowerCase().replace(/_/g, ' ')),
              startCount,
              lightCount,
              mediumCount,
              heavyCount,
              totalThrottle,
            });
          }
        }
      }
      return;
    }

    if (section === 'audiopolicy') {
      if (line.includes('AudioRecord Clients')) {
        inAudioRecord = true;
        pendingAudioClient = null;
        return;
      }
      if (inAudioRecord) {
        const t = line.trim();
        if (!t || t.startsWith('AudioTrack') || /^Available\s/i.test(t)) {
          inAudioRecord = false;
          pendingAudioClient = null;
          return;
        }
        const portMatch = /^\d+\.\s+Port ID:/.exec(t);
        if (portMatch) {
          const activeMatch = /uid\s+(\d+);\s*State:\s*Active/i.exec(t);
          if (activeMatch) {
            pendingAudioClient = { uid: normalizeAudioUid(activeMatch[1]), source: 'AUDIO_INPUT' };
            rawAudioClients.push(pendingAudioClient);
          } else {
            pendingAudioClient = null;
          }
          return;
        }
        if (pendingAudioClient) {
          const srcMatch = /Source:\s*AUDIO_SOURCE_([A-Z0-9_]+)/.exec(t);
          if (srcMatch) pendingAudioClient.source = srcMatch[1];
        }
      }
      return;
    }

    // batterystats section
    if (line.startsWith('Battery History [')) {
      bsSub = 'history';
      return;
    }
    if (line.startsWith('Discharge step durations:')) {
      bsSub = 'discharge_steps';
      return;
    }
    if (line.startsWith('Charge step durations:')) {
      bsSub = 'charge_steps';
      return;
    }
    if (line.startsWith('Daily stats:')) {
      bsSub = 'daily';
      curDaily = null;
      return;
    }
    if (line.startsWith('Per-PID Stats:')) {
      bsSub = 'skip';
      return;
    }
    if (line.startsWith('Statistics since last charge:')) {
      bsSub = 'stats';
      return;
    }
    if (bsSub === 'stats' && line.startsWith('  Estimated power use (mAh):')) {
      bsSub = 'power';
      powerMode = 'global';
      globalSubsystems.length = 0;
      rawUidPowers.length = 0;
      activeUidPower = null;
      return;
    }
    if (line.startsWith('  All kernel wake locks:')) {
      bsSub = 'skip';
      return;
    }
    if (line.startsWith('  All partial wake locks:')) {
      bsSub = 'wakelocks';
      return;
    }
    if (/^  (u0a\d+|1000|1001|1041|1046|1073|2000|\d+):$/.test(line)) {
      bsSub = 'uids';
      currentUidBlock = line.trim().slice(0, -1);
      return;
    }
    if (line.startsWith('Per process state tracking available:') || line.startsWith('--------- ')) {
      bsSub = 'skip';
      return;
    }

    if (bsSub === 'history') {
      if (line.includes('TIME:')) {
        const tm = /TIME:\s*(\d{4})-/.exec(line);
        if (tm) {
          curYear = Number(tm[1]);
          hasExplicitHistoryYear = true;
        }
        return;
      }
      if (line.includes('="')) {
        for (const pm of line.matchAll(/(?:fg|job|pkgactive|pkginactive|top|sync)=(u0a\d+|\d+):"([^":/]+)/g)) {
          if (!uidToPkgMap.has(pm[1])) uidToPkgMap.set(pm[1], pm[2]);
        }
      }

      const hm = /^\s+(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\.\d+\s+(\d{3})\s+[0-9a-fA-F]+\s*(.*)$/.exec(line);
      if (!hm) return;

      const pointYear =
        !hasExplicitHistoryYear && dumpYear > 2020 && dumpMonth === 1 && hm[1].startsWith('12-')
          ? dumpYear - 1
          : !hasExplicitHistoryYear && dumpYear > 2020 && dumpMonth === 1 && hm[1].startsWith('01-')
          ? dumpYear
          : curYear;
      let tsMs = parseTimestampMs(pointYear, hm[1]);
      if (hm[1].startsWith('01-') && lastSavedTs > 0 && tsMs < lastSavedTs - 300 * 86_400_000) {
        curYear += 1;
        tsMs = parseTimestampMs(curYear, hm[1]);
      }
      const lvl = Number(hm[2]);
      const flags = hm[3].replace(/"[^"]*"/g, '');

      const tm = /\btemp=(\d+)/.exec(flags);
      if (tm) curTempC = Number(tm[1]) / 10;
      const vm = /\bvolt=(\d+)/.exec(flags);
      if (vm) curVoltMv = Number(vm[1]);
      const cm = /\bcharge=(\d+)/.exec(flags);
      if (cm) curChargeMah = Number(cm[1]);

      if (/(?:^|\s)\+screen(?=\s|$)/.test(flags) || (lastSavedScreen === null && /(?:^|\s)screen(?=\s|$)/.test(flags))) {
        curScreenOn = true;
      } else if (/(?:^|\s)-screen(?=\s|$)/.test(flags)) {
        curScreenOn = false;
      }

      if (
        flags.includes('status=charging') ||
        flags.includes('status=full') ||
        /(?:^|\s)\+charging(?=\s|$)/.test(flags)
      ) {
        curCharging = true;
      } else if (
        flags.includes('status=discharging') ||
        flags.includes('status=not-charging') ||
        /(?:^|\s)-charging(?=\s|$)/.test(flags)
      ) {
        curCharging = false;
      }

      const changed =
        lvl !== lastSavedLevel ||
        Math.abs(curTempC - lastSavedTemp) >= 0.3 ||
        curScreenOn !== lastSavedScreen ||
        curCharging !== lastSavedCharging ||
        tsMs - lastSavedTs >= 15 * 60_000;

      if (changed && tsMs > 0) {
        timeline.push({
          time: hm[1].slice(0, 11),
          tsMs,
          level: lvl,
          tempC: curTempC,
          voltMv: curVoltMv,
          chargeMah: curChargeMah,
          screenOn: curScreenOn,
          charging: curCharging,
        });
        lastSavedLevel = lvl;
        lastSavedTemp = curTempC;
        lastSavedScreen = curScreenOn;
        lastSavedCharging = curCharging;
        lastSavedTs = tsMs;
      }
      return;
    }

    if (bsSub === 'discharge_steps') {
      const t = line.trim();
      const sm = /^#\d+:\s*\+([^\s]+)\s+to\s+\d+(?:\s*\(([^)]*)\))?/.exec(t);
      if (sm) {
        const ms = parseDurationMs(sm[1]);
        const flags = sm[2] ?? '';
        if (ms > 0) {
          if (flags.includes('screen-on')) {
            stepScreenOnMs += ms;
            stepScreenOnCount++;
          } else if (flags.includes('screen-off')) {
            stepScreenOffMs += ms;
            stepScreenOffCount++;
          }
        }
        return;
      }
      if (t.startsWith('Estimated screen off time:')) {
        estScreenOffFullMs = parseDurationMs(t.slice(26));
      } else if (t.startsWith('Estimated screen on time:')) {
        estScreenOnFullMs = parseDurationMs(t.slice(25));
      }
      return;
    }

    if (bsSub === 'charge_steps') {
      const t = line.trim();
      const sm = /^#\d+:\s*\+([^\s]+)\s+to\s+\d+/.exec(t);
      if (sm) {
        const ms = parseDurationMs(sm[1]);
        if (ms > 100) {
          stepChargeMs += ms;
          stepChargeCount++;
        }
      }
      return;
    }

    if (bsSub === 'daily') {
      const t = line.trim();
      const dm = /^(?:Current start time:|Daily from)\s*(\d{4}-(\d{2}-\d{2}))/.exec(t);
      if (dm) {
        curDaily = { date: dm[2], dischargeMs: 0, dischargeSteps: 0, chargeMs: 0, chargeSteps: 0 };
        rawDailyEntries.push(curDaily);
        return;
      }
      if (!curDaily) return;
      if (t.startsWith('Discharge total time:')) {
        const tm = /Discharge total time:\s*([^(]+)\(from\s*(\d+)\s*steps\)/.exec(t);
        if (tm) {
          curDaily.dischargeMs = parseDurationMs(tm[1]);
          curDaily.dischargeSteps = Number(tm[2]);
        }
      } else if (t.startsWith('Charge total time:')) {
        const tm = /Charge total time:\s*([^(]+)\(from\s*(\d+)\s*steps\)/.exec(t);
        if (tm) {
          curDaily.chargeMs = parseDurationMs(tm[1]);
          curDaily.chargeSteps = Number(tm[2]);
        }
      }
      return;
    }

    if (bsSub === 'stats') {
      const t = line.trim();
      if (inWifiRssi && !/^(?:none|poor|moderate|good|great)\s*\(/.test(t)) {
        inWifiRssi = false;
      }
      if (t.startsWith('Estimated battery capacity:')) {
        const v = parseInt(t.split(':')[1], 10);
        if (v > 0) estimatedMah = v;
      } else if (t.startsWith('Last learned battery capacity:')) {
        const v = parseInt(t.split(':')[1], 10);
        if (v > 0 && !learnedMah) learnedMah = v;
      } else if (t.startsWith('Time on battery screen off:')) {
        const m = /Time on battery screen off:\s*([^(]+)\(/.exec(t);
        if (m) screenOffMs = parseDurationMs(m[1].trim());
      } else if (t.startsWith('Discharge:')) totalDischargeMah = parseInt(t.split(':')[1], 10) || 0;
      else if (t.startsWith('Screen off discharge:')) screenOffDischargeMah = parseInt(t.split(':')[1], 10) || 0;
      else if (t.startsWith('Screen on discharge:')) screenOnDischargeMah = parseInt(t.split(':')[1], 10) || 0;
      else if (t.startsWith('Device deep doze discharge:')) deepDozeDischargeMah = parseInt(t.split(':')[1], 10) || 0;
      else if (t.startsWith('Screen on:')) {
        const m = /Screen on:\s*([^(]+)\([^)]+\)\s*(\d+)x/.exec(t);
        if (m) {
          screenOnMs = parseDurationMs(m[1].trim());
          screenOnCount = Number(m[2]);
        }
      } else if (t.startsWith('Total partial wakelock time:')) {
        partialWakelockMs = parseDurationMs(t.split(':')[1].trim());
      } else if (t.startsWith('WiFi Battery drain:')) {
        wifiDrainMah = parseFloat(t.split(':')[1]) || 0;
      } else if (t.startsWith('Wifi data received:')) {
        wifiRxMb = t.split(':')[1].trim();
      } else if (t.startsWith('Wifi data sent:')) {
        wifiTxGb = t.split(':')[1].trim();
      } else if (t.startsWith('Wifi Rx signal strength')) {
        inWifiRssi = true;
      } else if (inWifiRssi && t.startsWith('poor (')) {
        const m = /\(([\d.]+)%\)/.exec(t);
        if (m) wifiPoorSignalPct = parseFloat(m[1]);
        inWifiRssi = false;
      } else if (t.startsWith('Amount discharged while screen on:')) {
        screenOnPctDrop = parseInt(t.split(':')[1], 10) || 0;
      } else if (t.startsWith('Amount discharged while screen off:')) {
        screenOffPctDrop = parseInt(t.split(':')[1], 10) || 0;
      }
      return;
    }

    if (bsSub === 'power') {
      const uidMatch = /^\s{2,4}UID ([^:\s]+):\s*([\d.]+)(.*)$/.exec(line);
      if (uidMatch) {
        powerMode = 'uid';
        activeUidPower = {
          uid: uidMatch[1],
          totalMah: parseFloat(uidMatch[2]),
          screenOffMah: 0,
          wakelockMs: 0,
          detail: '',
        };
        if (uidMatch[3]) applyUidComponents(uidMatch[3], activeUidPower);
        rawUidPowers.push(activeUidPower);
        return;
      }
      if (powerMode === 'global') {
        if (line.trim().startsWith('(')) {
          powerMode = 'sub';
          return;
        }
        const gm = /^\s{4}([A-Za-z_]+):\s*([\d.]+)(.*)$/.exec(line);
        if (gm && !['Capacity', 'Global'].includes(gm[1])) {
          const mah = parseFloat(gm[2]);
          if (mah >= 1) {
            const appsMatch = /\bapps:\s*([\d.]+)/.exec(gm[3]);
            const appsMah = appsMatch ? parseFloat(appsMatch[1]) : null;
            const skipUnattrib = gm[1] === 'screen' || gm[1] === 'ambient_display' || gm[1] === 'phone';
            const unattributedMah =
              appsMah !== null && !skipUnattrib ? Math.max(0, Math.round((mah - appsMah) * 10) / 10) : 0;
            const durMatch = /duration:\s*(.+)$/.exec(gm[3]);
            const detail = durMatch ? `${formatDurationShort(parseDurationMs(durMatch[1]))} active` : 'Subsystem estimate';
            const existing = globalSubsystems.find((s) => s.name === gm[1]);
            if (existing) {
              existing.mah = mah;
              existing.appsMah = appsMah;
              existing.unattributedMah = unattributedMah;
              existing.detail = detail;
            } else {
              globalSubsystems.push({
                name: gm[1],
                label: SUBSYSTEM_LABELS[gm[1]] || gm[1],
                mah,
                appsMah,
                unattributedMah,
                detail,
              });
            }
          }
        }
      } else if (powerMode === 'uid' && activeUidPower) {
        const trim = line.trim();
        if (!trim.startsWith('(')) {
          applyUidComponents(trim, activeUidPower);
        } else if (trim.startsWith('(on battery, screen off/doze)')) {
          let offSum = 0;
          for (const cm of trim.matchAll(/\b(?:cpu|audio|video|wifi|wakelock|camera|GPU|bluetooth|gnss|mobile_radio)=([\d.]+)/g)) {
            offSum += parseFloat(cm[1]);
          }
          activeUidPower.screenOffMah = Math.round(offSum * 10) / 10;
        }
      }
      return;
    }

    if (bsSub === 'wakelocks') {
      const wm = /^\s+Wake lock (\S+)\s+(.+?):\s+([^(]+)\((\d+)\s+times\)/.exec(line);
      if (wm) {
        const uid = wm[1];
        const tag = wm[2].trim();
        const durationMs = parseDurationMs(wm[3]);
        if (rawWakelocks.length < 40) {
          rawWakelocks.push({
            uid,
            tag,
            durationMs,
            count: Number(wm[4]),
          });
        }
        const runMatch = /\(running for (\d+)ms\)/.exec(line);
        if (runMatch && Number(runMatch[1]) > 0) uidHoldingWakelock.add(uid);
        if (tag === 'AudioIn') uidAudioInMs.set(uid, Math.max(uidAudioInMs.get(uid) ?? 0, durationMs));
      }
      return;
    }

    if (bsSub === 'uids' && currentUidBlock) {
      const trim = line.trim();
      if (!uidToPkgMap.has(currentUidBlock)) {
        if (trim.startsWith('Proc ') || trim.startsWith('Apk ')) {
          const pm = /^(?:Proc|Apk)\s+([^:\s]+):/.exec(trim);
          if (pm && pm[1] !== '*wakelock*') uidToPkgMap.set(currentUidBlock, pm[1]);
        } else if (trim.startsWith('Job ')) {
          const jm = /^Job\s+(?:\*[^*]+\*\/)?([a-zA-Z][a-zA-Z0-9_.]*\.[a-zA-Z0-9_.]+)\//.exec(trim);
          if (jm) uidToPkgMap.set(currentUidBlock, jm[1]);
        } else if (trim.includes('NotificationManagerService:post:')) {
          const nm = /NotificationManagerService:post:([a-zA-Z0-9_.]+)/.exec(trim);
          if (nm) uidToPkgMap.set(currentUidBlock, nm[1]);
        } else if (trim.includes('SysUI:')) {
          uidToPkgMap.set(currentUidBlock, 'com.android.systemui');
        }
      }
      if (trim.startsWith('Proc ')) {
        const pm = /^Proc\s+(.+?):(?:\s|$)/.exec(trim);
        if (pm && pm[1] !== '*wakelock*') {
          const list = uidProcsMap.get(currentUidBlock) ?? [];
          if (!list.includes(pm[1]) && list.length < 4) {
            list.push(pm[1]);
            uidProcsMap.set(currentUidBlock, list);
          }
        }
      }
      if (trim.startsWith('Wi-Fi network:') && !uidWifiDataMap.has(currentUidBlock)) {
        const wm = /Wi-Fi network:\s*([^,\s]+)\s+received,\s*([^\s(]+)\s+sent/.exec(trim);
        if (wm && (/[MG]B/i.test(wm[1]) || /[MG]B/i.test(wm[2]))) {
          uidWifiDataMap.set(currentUidBlock, `${wm[2]} TX · ${wm[1]} RX`);
        }
      }
      if (trim.startsWith('Wakeup alarm ')) {
        const am = /(\d+)\s+times/.exec(trim);
        if (am) {
          uidWakeupsMap.set(currentUidBlock, (uidWakeupsMap.get(currentUidBlock) ?? 0) + Number(am[1]));
        }
      }
    }
  };

  const stageLabel = (): string => {
    if (section === 'props') return 'Reading device model & build properties...';
    if (section === 'ihealth' || section === 'battery') return 'Inspecting battery health & cycle count...';
    if (section === 'ithermal' || section === 'thermalservice' || section === 'mitigation') {
      return 'Scanning thermal sensors & throttling history...';
    }
    if (section === 'batterystats' && bsSub === 'history') return 'Reconstructing battery & temperature timeline...';
    if (section === 'batterystats') return 'Ranking wakelocks & app power drain...';
    return 'Scanning Android system dumps...';
  };

  let remainder = '';
  let decodedBytes = 0;
  let lastProgressPct = 4;
  let lastYieldAt = performance.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    decodedBytes += value.length;
    const chunk = remainder + value;
    const lines = chunk.split('\n');
    remainder = lines.pop() ?? '';
    for (let i = 0; i < lines.length; i++) {
      processLine(lines[i]);
    }

    const now = performance.now();
    const nextPct = Math.min(96, Math.max(6, Math.round(6 + (decodedBytes / Math.max(1, expectedTextBytes)) * 90)));
    if (onProgress && (now - lastYieldAt >= 36 || nextPct >= lastProgressPct + 5)) {
      lastProgressPct = nextPct;
      onProgress(nextPct, stageLabel());
      if (now - lastYieldAt >= 36) {
        lastYieldAt = now;
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }
  if (remainder) processLine(remainder);

  const hasTelemetry =
    Boolean(dumpTime) ||
    Boolean(build) ||
    learnedMah !== null ||
    levelPct > 0 ||
    timeline.length > 0 ||
    currentTempMap.size > 0;
  if (!hasTelemetry) {
    throw new Error('Zero Android bugreport telemetry found in this file. Make sure you dropped an adb bugreport .zip or dumpstate .txt.');
  }

  onProgress?.(100, 'Finalizing telemetry report...');

  // Device identification (fully dynamic across OEMs)
  const resolvedCodename = codename || propDevice || 'unknown';
  const rawModel = propMarketName || propModel || titleCase(resolvedCodename);
  const resolvedBrand = propBrand || propManufacturer || 'Android';
  const model =
    rawModel && propManufacturer && !rawModel.toLowerCase().includes(propManufacturer.toLowerCase()) && rawModel === propDevice
      ? `${propManufacturer} ${rawModel}`
      : rawModel || `${titleCase(resolvedBrand)} Device`;

  // Health calculations (never hardcode a 5000 mAh fallback when design capacity is absent)
  const fallbackFullMah =
    learnedMah ??
    estimatedMah ??
    (svcChargeCounterMah > 0 && levelPct >= 20 ? Math.round((svcChargeCounterMah / levelPct) * 100) : null);

  let healthPct: number | null = null;
  let lostMah: number | null = null;
  let verdict: 'Good' | 'Fair' | 'Worn' | 'Unknown' = 'Unknown';

  if (fallbackFullMah && designMah && designMah > 0) {
    healthPct = Math.min(100, Math.round((fallbackFullMah / designMah) * 1000) / 10);
    lostMah = Math.max(0, designMah - fallbackFullMah);
    verdict = healthPct >= 90 ? 'Good' : healthPct >= 80 ? 'Fair' : 'Worn';
  }

  // Universal thermal sensor discovery
  const sensors: ThermalSensor[] = [];
  for (const [name, cur] of currentTempMap.entries()) {
    if (name.includes('MINUS') || !Number.isFinite(cur.value) || cur.value <= -40 || (cur.value === 0 && cur.status === 'NONE')) continue;
    const meta = friendlySensorLabel(name, cur.type);
    const cached = cachedTempMap.get(name);
    sensors.push({
      name,
      label: meta.label,
      type: meta.group,
      currentC: Math.round(cur.value * 10) / 10,
      peakC: cached !== undefined ? Math.round(Math.max(cached, cur.value) * 10) / 10 : null,
      status: cur.status,
    });
  }
  sensors.sort((a, b) => {
    const rankDiff = (THROTTLE_RANK[b.status] ?? 0) - (THROTTLE_RANK[a.status] ?? 0);
    return rankDiff !== 0 ? rankDiff : b.currentC - a.currentC;
  });

  const skinSensor = sensors.find((s) => s.name === 'VIRTUAL-SKIN' || s.type === 'Body' || /skin/i.test(s.name));
  const batterySensor = sensors.find((s) => s.name.toLowerCase() === 'battery' || s.type === 'Battery');
  const coilSensor = sensors.find((s) => /qi_therm|wireless|wlc/i.test(s.name));
  const cpuTemps = sensors
    .filter((s) => s.type === 'CPU')
    .map((s) => s.peakC ?? s.currentC);
  const gpuTemps = sensors
    .filter((s) => s.type === 'GPU')
    .map((s) => s.peakC ?? s.currentC);

  // BCL brownout deduplication (Pixel shares AUDIO & HAPTICS counts on the same rail)
  const audioBcl = rawBclModules.find((m) => m.module === 'AUDIO');
  const bclModules = rawBclModules
    .filter(
      (m) =>
        !(
          m.module === 'HAPTICS' &&
          audioBcl &&
          m.startCount === audioBcl.startCount &&
          m.lightCount === audioBcl.lightCount &&
          m.mediumCount === audioBcl.mediumCount &&
          m.heavyCount === audioBcl.heavyCount
        ),
    )
    .sort(
      (a, b) =>
        b.heavyCount * 100 +
        b.mediumCount * 10 +
        b.lightCount -
        (a.heavyCount * 100 + a.mediumCount * 10 + a.lightCount),
    );
  const bclSummary = {
    totalThrottle: bclModules.reduce((s, m) => s + m.totalThrottle, 0),
    heavyCount: bclModules.reduce((s, m) => s + m.heavyCount, 0),
    mediumCount: bclModules.reduce((s, m) => s + m.mediumCount, 0),
    lightCount: bclModules.reduce((s, m) => s + m.lightCount, 0),
    modules: bclModules,
  };

  // Deduplicate active AudioRecord clients and map to friendly names
  const audioClientSeen = new Set<string>();
  const activeAudioClients: { uid: string; name: string; source: string }[] = [];
  const uidAudioSourceMap = new Map<string, string>();
  for (const c of rawAudioClients) {
    const key = `${c.uid}:${c.source}`;
    if (audioClientSeen.has(key)) continue;
    audioClientSeen.add(key);
    const sysMeta = SYSTEM_UID_NAMES[c.uid];
    const pkg = uidToPkgMap.get(c.uid) || sysMeta?.pkg || c.uid;
    const name = sysMeta ? sysMeta.name : friendlyAppName(pkg, c.uid);
    activeAudioClients.push({ uid: c.uid, name, source: c.source });
    if (!uidAudioSourceMap.has(c.uid)) uidAudioSourceMap.set(c.uid, c.source);
  }

  rawUidPowers.sort((a, b) => b.totalMah - a.totalMah);
  const significantUids = rawUidPowers.filter((u) => u.totalMah >= 0.5);
  const drainers: DrainerItem[] = (significantUids.length > 0 ? significantUids.slice(0, 30) : rawUidPowers.slice(0, 12))
    .map((u) => {
      const sysMeta = SYSTEM_UID_NAMES[u.uid];
      const pkg = sysMeta?.pkg || uidToPkgMap.get(u.uid) || u.uid;
      const isSystem = Boolean(sysMeta);
      const wakeups = uidWakeupsMap.get(u.uid) ?? 0;
      const wlMatch = rawWakelocks.find((w) => w.uid === u.uid);
      const wakelockMs = Math.max(u.wakelockMs, wlMatch?.durationMs ?? 0);
      const procs = (uidProcsMap.get(u.uid) ?? []).filter((p) => p !== pkg);
      const wifiData = uidWifiDataMap.get(u.uid) ?? null;
      const activeAudio =
        uidAudioSourceMap.get(u.uid) ?? (uidAudioInMs.has(u.uid) && uidHoldingWakelock.has(u.uid) ? 'AUDIO_IN' : null);
      const holdingWakelock = uidHoldingWakelock.has(u.uid);
      const extraBits = [
        u.screenOffMah >= 1 ? `${Math.round(u.screenOffMah)} mAh screen-off` : '',
        wakelockMs >= 10_000 ? `${formatDurationShort(wakelockMs)} wakelock` : '',
        wakeups >= 10 ? `${wakeups} wakeup alarms` : '',
        wifiData ?? '',
      ].filter(Boolean);
      return {
        id: `uid-${u.uid}`,
        name: sysMeta ? sysMeta.name : friendlyAppName(pkg, u.uid),
        packageName: pkg,
        kind: isSystem ? 'system' : 'app',
        totalMah: Math.round(u.totalMah * 10) / 10,
        screenOffMah: u.screenOffMah,
        wakelockMs,
        wakeups,
        detail: extraBits.join(' · ') || u.detail || 'Background activity',
        procs,
        wifiData,
        activeAudio,
        holdingWakelock,
      };
    });

  const step = timeline.length > 450 ? Math.ceil(timeline.length / 450) : 1;
  const compactTimeline = timeline.filter((_, idx) => idx === 0 || idx === timeline.length - 1 || idx % step === 0);

  const maxDailyMs = 14 * 86_400_000;
  const dailyStats: DailyStatPoint[] = rawDailyEntries
    .filter((d) => d.dischargeSteps > 0 || d.chargeSteps > 0)
    .map((d) => ({
      date: d.date,
      dischargePct: d.dischargeSteps,
      chargePct: d.chargeSteps,
      drainPctPerHr:
        d.dischargeSteps > 0 && d.dischargeMs > 60_000 && d.dischargeMs <= maxDailyMs
          ? Math.round((100 / (d.dischargeMs / 3_600_000)) * 10) / 10
          : 0,
      chargePctPerHr:
        d.chargeSteps > 0 && d.chargeMs > 60_000 && d.chargeMs <= maxDailyMs
          ? Math.round((100 / (d.chargeMs / 3_600_000)) * 10) / 10
          : 0,
    }))
    .reverse();

  const screenOnPctPerHr =
    estScreenOnFullMs > 60_000
      ? Math.round((100 / (estScreenOnFullMs / 3_600_000)) * 10) / 10
      : stepScreenOnCount >= 2 && stepScreenOnMs > 60_000
      ? Math.round((stepScreenOnCount / (stepScreenOnMs / 3_600_000)) * 10) / 10
      : null;
  const screenOffPctPerHr =
    estScreenOffFullMs > 60_000
      ? Math.round((100 / (estScreenOffFullMs / 3_600_000)) * 10) / 10
      : stepScreenOffCount >= 2 && stepScreenOffMs > 60_000
      ? Math.round((stepScreenOffCount / (stepScreenOffMs / 3_600_000)) * 10) / 10
      : null;
  const chargePctPerHr =
    stepChargeCount >= 2 && stepChargeMs > 60_000
      ? Math.round((stepChargeCount / (stepChargeMs / 3_600_000)) * 10) / 10
      : null;

  const unattributedTotalMah = Math.round(globalSubsystems.reduce((acc, s) => acc + s.unattributedMah, 0));

  const awakeWhileScreenOffPct = screenOffMs > 0 ? Math.min(100, Math.round((partialWakelockMs / screenOffMs) * 100)) : 0;
  const activeRateMahPerHr = screenOnMs > 60_000 ? Math.round(screenOnDischargeMah / (screenOnMs / 3_600_000)) : 0;
  const idleRateMahPerHr = screenOffMs > 60_000 ? Math.round(screenOffDischargeMah / (screenOffMs / 3_600_000)) : 0;

  return {
    fileName: file.name || 'bugreport.zip',
    device: {
      model,
      brand: titleCase(resolvedBrand),
      manufacturer: propManufacturer || titleCase(resolvedBrand),
      codename: resolvedCodename,
      build: build || 'unknown',
      androidVersion: androidVersion || 'unknown',
      dumpTime: dumpTime || 'Unknown time',
      bootReason,
      isThermalBoot: /thermal/i.test(bootReason),
      ramGb,
      storageGb,
      ufsLifetimeUsedPct,
    },
    health: {
      learnedMah: fallbackFullMah,
      designMah,
      healthPct,
      lostMah,
      cycleCount,
      status: healthStatus,
      technology,
      verdict,
      levelPct,
      voltageMv,
      currentMa,
      tempC: Math.round(tempC * 10) / 10,
      chargingPolicy,
      manufacturedDate,
    },
    thermals: {
      overallStatus: overallThermalStatus,
      overallStatusLabel: THERMAL_STATUS_LABELS[overallThermalStatus] ?? `Status ${overallThermalStatus}`,
      preRebootTempC,
      preRebootTime,
      skinTempC: skinSensor?.currentC ?? Math.round(tempC * 10) / 10,
      batteryTempC: batterySensor?.currentC ?? Math.round(tempC * 10) / 10,
      coilTempC: coilSensor?.currentC ?? null,
      cpuPeakC: cpuTemps.length ? Math.max(...cpuTemps) : null,
      gpuPeakC: gpuTemps.length ? Math.max(...gpuTemps) : null,
      sensors,
      bcl: bclSummary,
    },
    drain: {
      screenOnMs,
      screenOnCount,
      screenOffMs,
      totalDischargeMah,
      screenOnDischargeMah,
      screenOffDischargeMah,
      deepDozeDischargeMah,
      screenOnPctDrop,
      screenOffPctDrop,
      screenOnPctPerHr,
      screenOffPctPerHr,
      chargePctPerHr,
      partialWakelockMs,
      awakeWhileScreenOffPct,
      wifiDrainMah: Math.round(wifiDrainMah),
      wifiTxGb,
      wifiRxMb,
      wifiPoorSignalPct,
      activeRateMahPerHr,
      idleRateMahPerHr,
      unattributedTotalMah,
      activeAudioClients,
      globalSubsystems: globalSubsystems.sort((a, b) => b.mah - a.mah),
      drainers,
    },
    timeline: compactTimeline,
    dailyStats,
  };
}
