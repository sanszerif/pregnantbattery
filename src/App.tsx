import React, { useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  AndroidBold,
  BatteryChargingBold,
  CodeCircleBold,
  CpuBold,
  CpuChargeBold,
  DangerBold,
  DocumentUploadBold,
  FlashBold,
  GithubBold,
  InfoCircleBold,
  LinkBold,
  MobileBold,
  MoonBold,
  Radar2Bold,
  RefreshBold,
  Setting2Bold,
  ShieldTickBold,
  Sun1Bold,
  VerifyBold,
  WifiBold,
} from "mx-icons";
import pkg from "../package.json";
import { ThermalPhone3D } from "./chassis-engine/ThermalPhone3D";
import {
  formatDurationShort,
  parseBugReport,
  type BugReportData,
  type DailyStatPoint,
  type SignalQualityDistribution,
  type TimelinePoint,
} from "./parse-bugreport";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  BentoPill,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ExpandPanel,
  InfoTooltip,
  Progress,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TooltipProvider,
  type ChartConfig,
} from "./ui";

type TimeWindow = "all" | "12h" | "6h" | "3h" | "14d";
type CardKey =
  "health" | "cycles" | "thermals" | "standby" | "split" | "radio" | "bcl";

const BATTERY_CHART_CONFIG: ChartConfig = {
  level: { label: "Battery %", color: "var(--chart-1)" },
  screenBar: { label: "Screen On", color: "var(--chart-3)" },
};

const TEMP_CHART_CONFIG: ChartConfig = {
  tempC: { label: "Battery Temp (°C)", color: "var(--chart-2)" },
};

const DAILY_BAR_CONFIG: ChartConfig = {
  dischargePct: { label: "Discharged (%)", color: "var(--chart-1)" },
  chargePct: { label: "Charged (%)", color: "var(--chart-3)" },
};

const DAILY_PACE_CONFIG: ChartConfig = {
  drainPctPerHr: { label: "Drain Pace (%/hr)", color: "var(--chart-2)" },
};

const DONUT_COLORS = ["#e5a4eb", "#9eb9e8", "#e6c84f", "#a3a1e8", "#72c2a4"];

const CLICK_CARD_FX =
  "cursor-pointer select-none transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.985] touch-manipulation";

const REPO_URL = "https://github.com/sanszerif/pregnantbattery";
const ISSUES_URL = "https://github.com/sanszerif/pregnantbattery/issues";

const POLICY_TOOLTIPS: Record<string, string> = {
  DEFAULT:
    "Default Policy — standard fast charging up to 100% with no artificial ceiling.",
  LONG_LIFE:
    "Long Life Policy — limits charge ceiling (e.g. 80%) or current to slow battery aging.",
  ADAPTIVE:
    "Adaptive Policy — delays full charge based on your schedule/alarm to cut high-voltage soak.",
  FORCE_FULL_CHARGE:
    "Force Full Charge — temporarily overrides an 80% / Long-Life limit to charge to 100% (used periodically by Pixel for capacity calibration, or manually).",
  BASIC_PROTECT:
    "Samsung Basic Protection — tops up to 100%, then stops and waits until charge drops to 95%.",
  ADAPTIVE_PROTECT:
    "Samsung Adaptive Protection — pauses at 80% while asleep and finishes to 100% before wake-up.",
  MAXIMUM_PROTECT:
    "Samsung Maximum Protection — hard-caps charging at 80% (or 85%) to maximize longevity.",
  INVALID: "Charging policy not reported by this device HAL.",
};

const CHARGING_STATE_TOOLTIPS: Record<string, string> = {
  NORMAL: "Normal charging temperature and voltage profile.",
  TOO_COLD: "Charging throttled or paused — cell is too cold for full current.",
  TOO_HOT:
    "Charging throttled or paused — thermal protection is clamping current.",
  LONG_LIFE:
    "Hardware actively holding charge under a longevity protection ceiling.",
  ADAPTIVE: "Adaptive charging schedule is moderating power delivery.",
};

const BATTERY_STATUS_TOOLTIPS: Record<string, string> = {
  CHARGING: "Live state: actively drawing power into the battery.",
  DISCHARGING: "Live state: running off the battery cell.",
  NOT_CHARGING:
    "Live state: plugged in, charging paused/bypassed by thermal or protection policy.",
  FULL: "Live state: battery reached target full state.",
  UNKNOWN: "Live charging state unavailable.",
};

function describeChargingPolicy(policy: string): string {
  return (
    POLICY_TOOLTIPS[policy] ??
    `OEM charging policy (${policy.replace(/_/g, " ")}) reported by Android Health HAL.`
  );
}

function describeChargingState(state: string): string {
  return (
    CHARGING_STATE_TOOLTIPS[state] ??
    `Charging thermal/protection state: ${state.replace(/_/g, " ")}.`
  );
}

function describeBatteryStatus(status: string): string {
  return (
    BATTERY_STATUS_TOOLTIPS[status] ??
    `Live battery status (${status.replace(/_/g, " ")}) at dump capture.`
  );
}

function summarizeSignal(dist: SignalQualityDistribution): {
  strongPct: number;
  weakPct: number;
  label: string;
} {
  const strongPct = Math.round(dist.great + dist.good);
  const weakPct = Math.round((dist.moderate + dist.poor) * 10) / 10;
  if (dist.great >= 50)
    return { strongPct, weakPct, label: `Great ${Math.round(dist.great)}%` };
  if (strongPct >= 60)
    return { strongPct, weakPct, label: `Good ${strongPct}%` };
  if (dist.poor >= 20)
    return { strongPct, weakPct, label: `Weak ${Math.round(dist.poor)}%` };
  return { strongPct, weakPct, label: `Fair ${strongPct}%` };
}

function sumFormattedTraffic(a: string, b: string): string {
  const toMb = (s: string) => {
    const m = /([\d.]+)\s*(GB|MB|KB|B)/i.exec(s);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    switch (m[2].toUpperCase()) {
      case "GB":
        return v * 1024;
      case "MB":
        return v;
      case "KB":
        return v / 1024;
      default:
        return v / (1024 * 1024);
    }
  };
  const totalMb = toMb(a) + toMb(b);
  if (totalMb >= 1024) return `${(totalMb / 1024).toFixed(2)} GB`;
  if (totalMb >= 1) return `${Math.round(totalMb)} MB`;
  return `${Math.round(totalMb * 1024)} KB`;
}

function mahPerGbLabel(mah: number, a: string, b: string): string | null {
  const toGb = (s: string) => {
    const m = /([\d.]+)\s*(GB|MB|KB|B)/i.exec(s);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    switch (m[2].toUpperCase()) {
      case "GB":
        return v;
      case "MB":
        return v / 1024;
      case "KB":
        return v / (1024 * 1024);
      default:
        return v / (1024 * 1024 * 1024);
    }
  };
  const gb = toGb(a) + toGb(b);
  if (gb < 0.02 || mah <= 0) return null;
  return `${Math.round(mah / gb)} mAh/GB`;
}

function SignalQualityBar({ dist }: { dist: SignalQualityDistribution }) {
  const total = dist.great + dist.good + dist.moderate + dist.poor;
  if (total <= 0) return null;
  const pct = (v: number) => `${Math.max(0, (v / total) * 100).toFixed(1)}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-[2px] bg-black/15">
      {dist.great > 0 && (
        <div
          className="h-full bg-[#1b5e43]"
          style={{ width: pct(dist.great) }}
          title={`Great: ${dist.great}%`}
        />
      )}
      {dist.good > 0 && (
        <div
          className="h-full bg-[#3f8266]"
          style={{ width: pct(dist.good) }}
          title={`Good: ${dist.good}%`}
        />
      )}
      {dist.moderate > 0 && (
        <div
          className="h-full bg-[#a8751d]"
          style={{ width: pct(dist.moderate) }}
          title={`Moderate: ${dist.moderate}%`}
        />
      )}
      {dist.poor > 0 && (
        <div
          className="h-full bg-[#5c1908]"
          style={{ width: pct(dist.poor) }}
          title={`Poor: ${dist.poor}%`}
        />
      )}
    </div>
  );
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "warning" | "outline" {
  if (
    status === "SEVERE" ||
    status === "CRITICAL" ||
    status === "EMERGENCY" ||
    status === "SHUTDOWN"
  ) {
    return "destructive";
  }
  if (status === "MODERATE" || status === "LIGHT") return "warning";
  return "secondary";
}

function shortProcName(proc: string): string {
  const base = proc.split("/").pop() || proc;
  return base
    .replace(
      /^(?:android\.hardware\.|com\.google\.android\.|com\.android\.)/,
      "",
    )
    .replace(/@[\d.]+-service[.-]?/, "·")
    .replace(/^service-/, "");
}

function renderBrushTraveller(props: {
  x: number;
  y: number;
  width: number;
  height: number;
}): React.ReactElement<SVGElement> {
  const { x, y, width, height } = props;
  const cx = x + width / 2;
  const cy = y + height / 2;
  return (
    <g className="cursor-ew-resize">
      <rect
        x={x}
        y={y - 1}
        width={width}
        height={height + 2}
        rx={4}
        fill="#222227"
        stroke="#72c2a4"
        strokeWidth={1.4}
      />
      <line
        x1={cx - 1.8}
        y1={cy - 5}
        x2={cx - 1.8}
        y2={cy + 5}
        stroke="#72c2a4"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <line
        x1={cx + 1.8}
        y1={cy - 5}
        x2={cx + 1.8}
        y2={cy + 5}
        stroke="#72c2a4"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </g>
  );
}

const TimelineSection = React.memo(function TimelineSection({
  timeline,
  dailyStats,
}: {
  timeline: TimelinePoint[];
  dailyStats: DailyStatPoint[];
}) {
  const hasHourly = timeline.length >= 2;
  const hasDaily = dailyStats.length >= 2;
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() =>
    !hasHourly && hasDaily ? "14d" : "all",
  );
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const activeWindow: TimeWindow =
    timeWindow === "14d" && !hasDaily ? "all" : timeWindow;
  const isDaily = activeWindow === "14d" && hasDaily;

  const dailySummary = useMemo(() => {
    if (!hasDaily) return null;
    const avgDischarge = Math.round(
      dailyStats.reduce((s, d) => s + d.dischargePct, 0) / dailyStats.length,
    );
    const paceDays = dailyStats.filter((d) => d.drainPctPerHr > 0);
    const avgPace = paceDays.length
      ? Math.round(
          (paceDays.reduce((s, d) => s + d.drainPctPerHr, 0) /
            paceDays.length) *
            10,
        ) / 10
      : 0;
    const peakDay = paceDays.reduce<DailyStatPoint | null>(
      (best, d) => (!best || d.drainPctPerHr > best.drainPctPerHr ? d : best),
      null,
    );
    return { avgDischarge, avgPace, peakDay };
  }, [dailyStats, hasDaily]);

  const chartSeries = useMemo(() => {
    if (timeline.length === 0) return [];
    let filtered = timeline;
    if (activeWindow !== "all" && activeWindow !== "14d") {
      const hours = activeWindow === "12h" ? 12 : activeWindow === "6h" ? 6 : 3;
      const cutoff = timeline[timeline.length - 1].tsMs - hours * 3_600_000;
      const slice = timeline.filter((p) => p.tsMs >= cutoff);
      if (slice.length >= 2) filtered = slice;
    }
    return filtered.map((p, idx) => ({
      ...p,
      idx,
      clock: p.time.slice(6),
      screenBar: p.screenOn ? 6 : 0,
    }));
  }, [timeline, activeWindow]);

  const tempBounds = useMemo(() => {
    if (!chartSeries.length) return [20, 50] as const;
    let min = Infinity;
    let max = -Infinity;
    for (const p of chartSeries) {
      if (p.tempC < min) min = p.tempC;
      if (p.tempC > max) max = p.tempC;
    }
    return [
      Math.floor(Math.min(20, min - 2)),
      Math.ceil(Math.max(48, max + 3)),
    ] as const;
  }, [chartSeries]);

  const resolvedIdx =
    scrubIdx !== null && scrubIdx >= 0 && scrubIdx < chartSeries.length
      ? scrubIdx
      : Math.max(0, chartSeries.length - 1);
  const activePoint = chartSeries[resolvedIdx] ?? null;
  const scrubPct =
    chartSeries.length > 1
      ? Math.round((resolvedIdx / (chartSeries.length - 1)) * 100)
      : 100;

  const scrubAtClientX = (clientX: number) => {
    const el = scrubRef.current;
    if (!el || chartSeries.length < 2) return;
    const rect = el.getBoundingClientRect();
    const plotLeft = rect.left + 28;
    const plotWidth = Math.max(1, rect.width - 40);
    const ratio = Math.max(0, Math.min(1, (clientX - plotLeft) / plotWidth));
    setScrubIdx(Math.round(ratio * (chartSeries.length - 1)));
  };

  const handleChartMouseMove = (state: {
    activeTooltipIndex?: number | string | null;
  }) => {
    const idx =
      typeof state.activeTooltipIndex === "number"
        ? state.activeTooltipIndex
        : Number(state.activeTooltipIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < chartSeries.length) {
      setScrubIdx(idx);
    }
  };

  const hourlyContent =
    chartSeries.length < 2 ? (
      <div className="bg-muted/40 text-muted-foreground flex flex-col items-center justify-center gap-1.5 rounded-sm border px-4 py-10 text-center text-xs">
        <p className="font-medium text-foreground">
          Not enough battery history samples in this dump to plot an hourly
          timeline.
        </p>
        {hasDaily ? (
          <p>
            Switch to the{" "}
            <span className="font-mono font-semibold text-foreground">
              {dailyStats.length}d
            </span>{" "}
            tab above to inspect multi-day charge and burn logs.
          </p>
        ) : (
          <p>Battery history ring buffer was empty or just reset.</p>
        )}
      </div>
    ) : (
      <div className="flex flex-col gap-3 sm:gap-4">
        {activePoint && (
          <div className="bg-muted/50 flex flex-col gap-2 rounded-sm border px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium tabular-nums">
                  {activePoint.time}
                </span>
                <Badge
                  variant={
                    activePoint.charging
                      ? "secondary"
                      : activePoint.screenOn
                        ? "outline"
                        : "secondary"
                  }
                >
                  {activePoint.charging
                    ? "Charging"
                    : activePoint.screenOn
                      ? "Screen On"
                      : "Screen Off"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
                <span>
                  Level <strong>{activePoint.level}%</strong>
                </span>
                <span>
                  Temp <strong>{activePoint.tempC}°C</strong>
                </span>
                <span>
                  Volt{" "}
                  <strong>{(activePoint.voltMv / 1000).toFixed(2)}V</strong>
                </span>
                {activePoint.chargeMah > 0 && (
                  <span className="text-muted-foreground hidden sm:inline">
                    Charge{" "}
                    <strong className="text-foreground">
                      {activePoint.chargeMah} mAh
                    </strong>
                  </span>
                )}
              </div>
            </div>
            {chartSeries.length > 1 && (
              <input
                type="range"
                min={0}
                max={chartSeries.length - 1}
                value={resolvedIdx}
                onChange={(e) => setScrubIdx(Number(e.target.value))}
                aria-label="Scrub battery and thermal timeline"
                className="timeline-scrubber w-full touch-pan-x"
                style={{
                  background: `linear-gradient(to right, var(--chart-1) 0%, var(--chart-1) ${scrubPct}%, rgba(255, 255, 255, 0.12) ${scrubPct}%, rgba(255, 255, 255, 0.12) 100%)`,
                }}
              />
            )}
          </div>
        )}

        <div
          ref={scrubRef}
          className="flex touch-pan-y flex-col gap-3 select-none sm:gap-4"
          onPointerDown={(e) => {
            if (e.pointerType === "touch") {
              if ((e.target as Element | null)?.closest?.(".recharts-brush"))
                return;
              draggingRef.current = true;
              scrubAtClientX(e.clientX);
            }
          }}
          onPointerMove={(e) => {
            if (draggingRef.current && e.pointerType === "touch") {
              scrubAtClientX(e.clientX);
            }
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Charge Level (%)
            </span>
            <ChartContainer
              config={BATTERY_CHART_CONFIG}
              className="h-[200px] sm:h-[245px]"
            >
              <ComposedChart
                data={chartSeries}
                syncId="telemetry"
                margin={{ top: 8, right: 10, left: -18, bottom: 0 }}
                onMouseMove={handleChartMouseMove}
              >
                <defs>
                  <linearGradient id="fillBattery" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="idx"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tickFormatter={(i) => chartSeries[Number(i)]?.clock ?? ""}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                {scrubIdx !== null && activePoint && (
                  <ReferenceLine
                    x={resolvedIdx}
                    stroke="var(--primary)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.65}
                  />
                )}
                <ChartTooltip
                  cursor={{
                    stroke: "var(--muted-foreground)",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                  content={({ active, payload, label }) => (
                    <ChartTooltipContent
                      active={active}
                      payload={payload}
                      label={chartSeries[Number(label)]?.time ?? label}
                      config={BATTERY_CHART_CONFIG}
                      renderExtra={(p) => (
                        <div className="text-muted-foreground flex justify-between gap-4 tabular-nums">
                          <span>
                            {p.charging
                              ? "Charging"
                              : p.screenOn
                                ? "Screen On"
                                : "Idle"}
                          </span>
                          <span>
                            {((Number(p.voltMv) || 0) / 1000).toFixed(2)}V ·{" "}
                            {String(p.tempC)}°C
                          </span>
                        </div>
                      )}
                    />
                  )}
                />
                <Bar
                  dataKey="screenBar"
                  fill="var(--chart-3)"
                  barSize={3}
                  opacity={0.65}
                  isAnimationActive
                  animationDuration={360}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="level"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#fillBattery)"
                  isAnimationActive
                  animationDuration={360}
                  animationEasing="ease-out"
                  activeDot={{
                    r: 4,
                    fill: "var(--chart-1)",
                    stroke: "var(--background)",
                    strokeWidth: 2,
                  }}
                />
              </ComposedChart>
            </ChartContainer>
          </div>

          <Separator />

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Battery Temperature (°C)
            </span>
            <ChartContainer
              config={TEMP_CHART_CONFIG}
              className="h-[175px] sm:h-[205px]"
            >
              <AreaChart
                data={chartSeries}
                syncId="telemetry"
                margin={{ top: 8, right: 10, left: -18, bottom: 0 }}
                onMouseMove={handleChartMouseMove}
              >
                <defs>
                  <linearGradient id="fillTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="idx"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tickFormatter={(i) => chartSeries[Number(i)]?.clock ?? ""}
                />
                <YAxis
                  domain={[tempBounds[0], tempBounds[1]]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}°`}
                />
                <ReferenceLine
                  y={40}
                  stroke="var(--chart-4)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />
                <ReferenceLine
                  y={45}
                  stroke="var(--chart-5)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.8}
                />
                {scrubIdx !== null && activePoint && (
                  <ReferenceLine
                    x={resolvedIdx}
                    stroke="var(--primary)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.65}
                  />
                )}
                <ChartTooltip
                  cursor={{
                    stroke: "var(--muted-foreground)",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                  content={({ active, payload, label }) => (
                    <ChartTooltipContent
                      active={active}
                      payload={payload}
                      label={chartSeries[Number(label)]?.time ?? label}
                      config={TEMP_CHART_CONFIG}
                    />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="tempC"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="url(#fillTemp)"
                  isAnimationActive
                  animationDuration={360}
                  animationEasing="ease-out"
                  activeDot={{
                    r: 4,
                    fill: "var(--chart-2)",
                    stroke: "var(--background)",
                    strokeWidth: 2,
                  }}
                />
                <Brush
                  dataKey="idx"
                  height={26}
                  stroke="rgba(255,255,255,0.14)"
                  fill="#18181c"
                  travellerWidth={12}
                  traveller={renderBrushTraveller}
                  tickFormatter={(i) => chartSeries[Number(i)]?.clock ?? ""}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </div>
    );

  const dailyContent = dailySummary ? (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-sm border px-3 py-2 text-xs">
        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span>
            Avg <strong>{dailySummary.avgDischarge}%/day</strong> used
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            Avg pace <strong>{dailySummary.avgPace}%/hr</strong>
          </span>
        </div>
        {dailySummary.peakDay && (
          <Badge
            variant={
              dailySummary.peakDay.drainPctPerHr >= 20
                ? "destructive"
                : "secondary"
            }
          >
            Peak burn {dailySummary.peakDay.date}:{" "}
            {dailySummary.peakDay.drainPctPerHr}%/hr
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            Daily Cycle Throughput (% steps)
          </span>
          <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-[2px] bg-chart-1" /> Discharged
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-[2px] bg-chart-3" /> Charged
            </span>
          </div>
        </div>
        <ChartContainer
          config={DAILY_BAR_CONFIG}
          className="h-[205px] sm:h-[250px]"
        >
          <ComposedChart
            data={dailyStats}
            syncId="daily-history"
            margin={{ top: 8, right: 10, left: -18, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
              content={({ active, payload, label }) => (
                <ChartTooltipContent
                  active={active}
                  payload={payload}
                  label={label}
                  config={DAILY_BAR_CONFIG}
                  renderExtra={(p) => (
                    <div className="text-muted-foreground flex justify-between gap-4 tabular-nums">
                      <span>Drain {String(p.drainPctPerHr)}%/hr</span>
                      <span>
                        {Number(p.chargePctPerHr) > 0
                          ? `Charge +${String(p.chargePctPerHr)}%/hr`
                          : "No charge"}
                      </span>
                    </div>
                  )}
                />
              )}
            />
            <Bar
              dataKey="dischargePct"
              fill="var(--chart-1)"
              radius={[2, 2, 0, 0]}
              maxBarSize={24}
              isAnimationActive
              animationDuration={360}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="chargePct"
              fill="var(--chart-3)"
              radius={[2, 2, 0, 0]}
              maxBarSize={24}
              isAnimationActive
              animationDuration={360}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ChartContainer>
      </div>

      <Separator />

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">
          Average Discharge Pace (%/hr)
        </span>
        <ChartContainer
          config={DAILY_PACE_CONFIG}
          className="h-[185px] sm:h-[220px]"
        >
          <AreaChart
            data={dailyStats}
            syncId="daily-history"
            margin={{ top: 8, right: 10, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillDailyPace" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--chart-2)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="var(--chart-2)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <ChartTooltip
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={({ active, payload, label }) => (
                <ChartTooltipContent
                  active={active}
                  payload={payload}
                  label={label}
                  config={DAILY_PACE_CONFIG}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="drainPctPerHr"
              stroke="var(--chart-2)"
              strokeWidth={2}
              fill="url(#fillDailyPace)"
              isAnimationActive
              animationDuration={360}
              animationEasing="ease-out"
              activeDot={{
                r: 4,
                fill: "var(--chart-2)",
                stroke: "var(--background)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  ) : null;

  return (
    <Card
      className="animate-bento-in min-w-0 xl:col-span-8"
      style={{ animationDelay: "90ms" }}
    >
      <CardHeader>
        <CardTitle>
          {isDaily
            ? "Daily charge & burn history"
            : "Battery & thermal timeline"}
          <InfoTooltip
            title={
              isDaily
                ? "Multi-Day Step History"
                : "Touch, Drag & Hover Scrubber"
            }
            text={
              isDaily
                ? "Aggregated from Android daily batterystats discharge/charge step counters across up to ~2 weeks, beyond the ~24h history ring buffer."
                : "Hover, touch-drag across either chart, or slide the timeline bar to scrub battery level and temperature in lockstep. Drag the bottom brush handles to zoom."
            }
          />
        </CardTitle>
        <CardDescription>
          {isDaily
            ? `${dailyStats[0].date} to ${dailyStats[dailyStats.length - 1].date} · ${dailyStats.length} daily logs`
            : hasHourly
              ? `${chartSeries.length} samples · Drag across charts or scrub below`
              : "No timeline samples recorded in this dump"}
        </CardDescription>
        {(hasHourly || hasDaily) && (
          <CardAction>
            <Tabs
              value={activeWindow}
              onValueChange={(v) => {
                setTimeWindow(v as TimeWindow);
                setScrubIdx(null);
              }}
            >
              <TabsList className="w-full sm:w-auto">
                {hasHourly && (
                  <>
                    <TabsTrigger value="all" className="flex-1 sm:flex-initial">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="12h" className="flex-1 sm:flex-initial">
                      12h
                    </TabsTrigger>
                    <TabsTrigger value="6h" className="flex-1 sm:flex-initial">
                      6h
                    </TabsTrigger>
                    <TabsTrigger value="3h" className="flex-1 sm:flex-initial">
                      3h
                    </TabsTrigger>
                  </>
                )}
                {hasDaily && (
                  <TabsTrigger value="14d" className="flex-1 sm:flex-initial">
                    {dailyStats.length}d
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        {hasDaily && dailyContent ? (
          <div className="relative overflow-hidden">
            <div
              className={`flex w-[200%] items-start transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isDaily ? "-translate-x-1/2" : "translate-x-0"
              }`}
            >
              <div
                aria-hidden={isDaily}
                className={`w-1/2 shrink-0 pr-1 transition-opacity duration-300 ${
                  isDaily ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
              >
                {hourlyContent}
              </div>
              <div
                aria-hidden={!isDaily}
                className={`w-1/2 shrink-0 pl-1 transition-opacity duration-300 ${
                  isDaily ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {dailyContent}
              </div>
            </div>
          </div>
        ) : (
          hourlyContent
        )}
      </CardContent>
    </Card>
  );
});

export default function App() {
  const [report, setReport] = useState<BugReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState("Initializing stream...");
  const [error, setError] = useState<string | null>(null);
  const [failedFileName, setFailedFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<CardKey, boolean>>({
    health: false,
    cycles: false,
    thermals: false,
    standby: false,
    split: false,
    radio: false,
    bcl: false,
  });
  const [expandedUidId, setExpandedUidId] = useState<string | null>(null);
  const [thermalView, setThermalView] = useState<"3d" | "list">("3d");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleCard = (key: CardKey) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setFailedFileName(null);
    setLoading(true);
    setProgress(2);
    setLoadingStage("Inspecting file header...");
    setActiveSlice(null);
    setExpandedUidId(null);

    try {
      const parsed = await parseBugReport(file, (pct, stage) => {
        setProgress(pct);
        if (stage) setLoadingStage(stage);
      });
      setProgress(100);
      setLoadingStage("Telemetry ready.");
      // shortcut: 120ms UX settle delay so 100% progress state renders before dashboard swap
      await new Promise((r) => setTimeout(r, 120));
      setReport(parsed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something broke while reading that archive.",
      );
      setFailedFileName(file.name);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const donutData = useMemo(() => {
    if (!report) return [];
    const top = report.drain.globalSubsystems.slice(0, 5);
    const total =
      report.drain.globalSubsystems.reduce(
        (acc, s) => acc + Math.round(s.mah),
        0,
      ) || 1;
    return top.map((sub, i) => {
      const value = Math.round(sub.mah);
      return {
        name: sub.label,
        value,
        pct: Math.round((value / total) * 100),
        detail: sub.detail,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      };
    });
  }, [report]);

  const donutConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    for (const d of donutData) cfg[d.name] = { label: d.name, color: d.color };
    return cfg;
  }, [donutData]);

  const liveWatts =
    report?.health.currentMa !== null && report?.health.voltageMv
      ? (
          (report.health.voltageMv / 1000) *
          (Math.abs(report.health.currentMa) / 1000)
        ).toFixed(1)
      : null;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="bg-background text-foreground flex min-h-screen w-full flex-col overflow-x-clip pb-20 sm:pb-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.txt"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {/* Header */}
        <header className="bg-background/90 sticky top-0 z-20 border-b backdrop-blur-sm">
          <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <CpuChargeBold size={24} color="#f8fafc" className="shrink-0" />
              <div className="flex items-baseline gap-1.5">
                <h1 className="font-heading text-sm font-bold tracking-wide sm:text-base">
                  pregnantBattery
                </h1>
                <span className="text-muted-foreground text-[11px] sm:text-xs">
                  by sanszerif
                </span>
              </div>
            </div>

            {report && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <BentoPill
                  tooltip={`${report.device.profile.badgeName}: ${report.device.profile.badgeTooltip}`}
                  className={`inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-sm border px-2.5 text-xs font-medium sm:max-w-none ${
                    report.device.profile.layer === "model"
                      ? "border-[#72c2a4]/45 bg-[#72c2a4]/15 text-[#72c2a4] hover:bg-[#72c2a4]/25"
                      : report.device.profile.layer === "brand"
                        ? "border-[#e5a4eb]/45 bg-[#e5a4eb]/15 text-[#e5a4eb] hover:bg-[#e5a4eb]/25"
                        : "border-[#ff9b7b]/45 bg-[#ff9b7b]/15 text-[#ff9b7b] hover:bg-[#ff9b7b]/25"
                  }`}
                >
                  <MobileBold
                    size={14}
                    color="currentColor"
                    className="shrink-0"
                  />
                  <span className="truncate">{report.device.model}</span>
                  {report.device.profile.layer === "model" ? (
                    <VerifyBold
                      size={14}
                      color="currentColor"
                      className="shrink-0"
                    />
                  ) : report.device.profile.layer === "brand" ? (
                    <ShieldTickBold
                      size={14}
                      color="currentColor"
                      className="shrink-0"
                    />
                  ) : (
                    <InfoCircleBold
                      size={14}
                      color="currentColor"
                      className="shrink-0"
                    />
                  )}
                </BentoPill>
                <span className="bg-secondary text-secondary-foreground hidden h-8 items-center rounded-sm border px-3 text-xs font-medium md:inline-flex">
                  Android {report.device.androidVersion} · {report.device.build}
                </span>
                {(report.device.ramGb || report.device.storageGb) && (
                  <BentoPill
                    tooltip="Hardware memory & flash storage wear reported by UFS controller. Lower wear % means healthy storage."
                    className="bg-card text-foreground hidden h-8 items-center rounded-sm border px-3 text-xs font-medium lg:inline-flex"
                  >
                    {[
                      report.device.ramGb && `${report.device.ramGb} RAM`,
                      report.device.storageGb,
                      report.device.ufsLifetimeUsedPct !== null &&
                        `${report.device.ufsLifetimeUsedPct}% wear`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </BentoPill>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshBold size={14} color="currentColor" />
                  Load Zip
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="flex w-full flex-1 flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          {/* Upload Empty State */}
          {!report && !loading && (
            <div className="flex flex-1 flex-col justify-end pb-4 sm:justify-center sm:py-10">
              <Card
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`animate-bento-in mx-auto w-full max-w-lg border-dashed ${
                  dragOver ? "border-primary bg-muted/40" : ""
                }`}
              >
                <CardHeader className="flex flex-col items-center text-center sm:flex sm:flex-col sm:items-center">
                  <div className="bg-muted mb-2 flex size-12 items-center justify-center rounded-sm border">
                    <CpuChargeBold size={24} color="#f8fafc" />
                  </div>
                  <CardTitle className="text-base">
                    Drop the zip. Diagnose the damage.
                  </CardTitle>
                  <CardDescription>
                    Run{" "}
                    <code className="bg-muted rounded-[2px] px-1.5 py-0.5 text-foreground">
                      adb bugreport
                    </code>
                    , toss the{" "}
                    <code className="bg-muted rounded-[2px] px-1.5 py-0.5 text-foreground">
                      .zip
                    </code>{" "}
                    or{" "}
                    <code className="bg-muted rounded-[2px] px-1.5 py-0.5 text-foreground">
                      .txt
                    </code>{" "}
                    here, and see which app is treating your battery like an
                    all-you-can-eat buffet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Button
                    className="hidden sm:inline-flex"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <DocumentUploadBold size={16} color="currentColor" />
                    Choose Bug Report File
                  </Button>
                  <div className="text-muted-foreground flex items-center gap-1.5 text-center text-xs">
                    <ShieldTickBold
                      size={15}
                      color="#72c2a4"
                      className="shrink-0"
                    />
                    <span>
                      100% parsed locally on your own silicon. Your 150 MB phone
                      logs are none of my business.
                    </span>
                  </div>

                  {error && (
                    <div className="animate-bento-in flex w-full flex-col gap-3">
                      <Alert variant="destructive">
                        <DangerBold size={16} color="currentColor" />
                        <AlertTitle>Well, that didn&apos;t parse.</AlertTitle>
                        <AlertDescription>
                          {failedFileName ? (
                            <strong className="text-foreground">
                              {failedFileName}:{" "}
                            </strong>
                          ) : null}
                          {error}
                        </AlertDescription>
                      </Alert>
                      <div className="bg-muted/50 flex flex-col gap-2 rounded-sm border p-3 text-xs">
                        <span className="font-medium text-foreground">
                          Quick sanity check:
                        </span>
                        <ul className="text-muted-foreground list-disc space-y-1 pl-4">
                          <li>
                            Make sure{" "}
                            <code className="text-foreground">
                              adb bugreport
                            </code>{" "}
                            actually finished writing the zip.
                          </li>
                          <li>
                            Drop the whole Android bugreport{" "}
                            <code className="text-foreground">.zip</code> or raw{" "}
                            <code className="text-foreground">
                              dumpstate .txt
                            </code>
                            , not an unrelated archive.
                          </li>
                          <li>
                            Still broken?{" "}
                            <a
                              href={ISSUES_URL}
                              target="_blank"
                              rel="noreferrer"
                              className="text-foreground underline underline-offset-2"
                            >
                              Log a bug or drop your device details on GitHub
                            </a>
                            .
                          </li>
                        </ul>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <RefreshBold size={13} color="currentColor" />
                            Try Another File
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setError(null)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Smooth Real-Time Streaming Progress */}
          {loading && (
            <div className="flex flex-1 items-center justify-center py-12">
              <Card className="animate-bento-in w-full max-w-md">
                <CardHeader>
                  <CardTitle>Dissecting your bugreport...</CardTitle>
                  <CardDescription>{loadingStage}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  <Progress
                    value={progress}
                    indicatorClassName="bg-chart-1 transition-all duration-150 ease-out"
                  />
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>
                      Zero server round-trips. Pure browser brutality.
                    </span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {progress}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Bento Dashboard */}
          {report && !loading && (
            <div className="flex flex-col gap-3">
              {error && (
                <Alert variant="destructive" className="animate-bento-in">
                  <DangerBold size={16} color="currentColor" />
                  <AlertTitle>
                    Couldn&apos;t load {failedFileName ?? "that file"} — keeping
                    your previous report
                  </AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                    <span>{error}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setError(null)}
                    >
                      Dismiss
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {(report.device.isThermalBoot ||
                report.thermals.overallStatus >= 3) && (
                <Alert variant="destructive" className="animate-bento-in">
                  <DangerBold size={16} color="currentColor" />
                  <AlertTitle>
                    {report.device.isThermalBoot
                      ? `Thermal Shutdown Detected (${report.device.bootReason})`
                      : `Active Thermal Throttling (${report.thermals.overallStatusLabel})`}
                  </AlertTitle>
                  <AlertDescription>
                    {report.thermals.preRebootTempC
                      ? `Your battery cooked itself to ${report.thermals.preRebootTempC}°C right before the last reboot (${report.thermals.preRebootTime ?? "recent"}), so Android pulled the plug. `
                      : ""}
                    {report.thermals.overallStatus >= 3
                      ? `Current status is ${report.thermals.overallStatusLabel} (${report.thermals.skinTempC}°C skin) — CPU clocks and charging speed are actively throttled.`
                      : "The device logged a thermal shutdown on its previous boot."}
                  </AlertDescription>
                </Alert>
              )}

              {/* Row 1: 4 Clickable Expandable Pastel Bento KPI Cards */}
              <div className="grid grid-cols-2 items-start gap-2.5 sm:gap-3 xl:grid-cols-4">
                {/* 1. Coral: Battery Health */}
                <Card
                  variant="coral"
                  onClick={() => toggleCard("health")}
                  className={`animate-bento-in justify-between gap-2.5 py-3 sm:gap-3 sm:py-4 ${CLICK_CARD_FX}`}
                  style={{ animationDelay: "0ms" }}
                >
                  <div className="flex items-start justify-between px-3 sm:px-4">
                    <div className="flex flex-col text-xs leading-tight font-medium sm:text-sm">
                      <span>Battery</span>
                      <span>health</span>
                    </div>
                    <BatteryChargingBold size={20} color="#c84520" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-1 px-2.5 sm:gap-1.5 sm:px-4">
                    {report.health.healthPct !== null ? (
                      <>
                        {report.health.learnedMah !== null && (
                          <BentoPill
                            tooltip="Maximum charge your battery currently holds when 100% full."
                            className="-rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                          >
                            {report.health.learnedMah.toLocaleString()} mAh
                          </BentoPill>
                        )}
                        {report.health.designMah !== null && (
                          <BentoPill
                            tooltip="Factory rated battery capacity when the phone was brand new."
                            className="rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                          >
                            {report.health.designMah.toLocaleString()} design
                          </BentoPill>
                        )}
                        {report.health.lostMah !== null && (
                          <BentoPill
                            tooltip="Permanent capacity lost to chemical lithium aging."
                            className="-rotate-1 hidden px-1.5 text-[10px] sm:inline-flex sm:px-2 sm:text-[11px]"
                          >
                            -{report.health.lostMah.toLocaleString()} worn
                          </BentoPill>
                        )}
                        <BentoPill
                          tooltip="4-tier verdict: Great (≥95%), Good (90–94%), Fair (80–89%), Worn (<80%)."
                          className="rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                        >
                          {report.health.verdict}
                        </BentoPill>
                      </>
                    ) : (
                      <BentoPill
                        tooltip="This device's Android HAL did not report battery design or learned capacity."
                        className="-rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                      >
                        Not exposed
                      </BentoPill>
                    )}
                  </div>
                  <div className="flex items-end justify-between px-3 sm:px-4">
                    <span className="text-[10px] font-medium opacity-70">
                      {expandedCards.health
                        ? "Hide wear gauge"
                        : "Tap for details"}
                    </span>
                    <span className="font-heading text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
                      {report.health.healthPct !== null
                        ? `${report.health.healthPct}%`
                        : "N/A"}
                    </span>
                  </div>
                  <ExpandPanel open={expandedCards.health}>
                    <div className="mx-3 flex flex-col gap-2 border-t border-black/15 pt-2.5 text-xs sm:mx-4">
                      {report.health.healthPct !== null &&
                      report.health.designMah ? (
                        <div className="relative">
                          <div className="h-2 w-full overflow-hidden rounded-[2px] bg-black/15">
                            <div
                              className="h-full bg-[#5c1908]"
                              style={{ width: `${report.health.healthPct}%` }}
                            />
                          </div>
                          <div
                            className="border-[#5c1908] pointer-events-none absolute -top-0.5 -bottom-0.5 border-l-2 border-dashed"
                            style={{ left: "80%" }}
                          />
                        </div>
                      ) : null}
                      <p className="leading-snug opacity-90">
                        {report.health.healthPct !== null
                          ? report.health.healthPct >= 95
                            ? `Holding ${report.health.healthPct}% of factory capacity. Fresh cell, barely broken in.`
                            : report.health.healthPct >= 90
                              ? `Holding ${report.health.healthPct}% of original juice. Healthy cell with plenty of runway.`
                              : report.health.healthPct >= 85
                                ? `Still holding ${report.health.healthPct}% of original juice. Not pregnant yet, just middle-aged.`
                                : report.health.healthPct >= 80
                                  ? `Hovering near the 80% replacement cliff (${report.health.lostMah} mAh gone).`
                                  : `Below 80% capacity (${report.health.lostMah} mAh gone). Time to stop pretending it's fine.`
                          : "Battery health capacity wasn't exposed by this device's Android HAL (common on older Android builds)."}
                      </p>
                      <div className="flex flex-wrap justify-between gap-1 text-[11px] opacity-80">
                        <span>
                          Tech: {report.health.technology}
                          {report.health.stateOfHealthPct !== null
                            ? ` · SOH ${report.health.stateOfHealthPct}%`
                            : ""}
                        </span>
                        {report.thermals.bcl.heavyCount > 0 ? (
                          <span>
                            {report.thermals.bcl.heavyCount} heavy voltage
                            droops
                          </span>
                        ) : (
                          <span>
                            {report.health.manufacturedDate
                              ? `Born: ${report.health.manufacturedDate}`
                              : report.health.firstUseDate
                                ? `First use: ${report.health.firstUseDate}`
                                : report.health.healthPct === null
                                  ? "Health HAL: Unavailable"
                                  : "Born: Unknown"}
                          </span>
                        )}
                      </div>
                    </div>
                  </ExpandPanel>
                </Card>

                {/* 2. Orchid: Charge Cycles */}
                <Card
                  variant="orchid"
                  onClick={() => toggleCard("cycles")}
                  className={`animate-bento-in justify-between gap-2.5 py-3 sm:gap-3 sm:py-4 ${CLICK_CARD_FX}`}
                  style={{ animationDelay: "35ms" }}
                >
                  <div className="flex items-start justify-between px-3 sm:px-4">
                    <div className="flex flex-col text-xs leading-tight font-medium sm:text-sm">
                      <span>Charge</span>
                      <span>cycles</span>
                    </div>
                    <FlashBold size={20} color="#a43db0" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-1 px-2.5 sm:gap-1.5 sm:px-4">
                    <BentoPill
                      tooltip={describeBatteryStatus(report.health.status)}
                      className="-rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                    >
                      {report.health.status}
                    </BentoPill>
                    {report.health.currentMa !== null && (
                      <BentoPill
                        tooltip="Live current in milliamps (+ charging into battery, - draining)."
                        className="rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                      >
                        {report.health.currentMa > 0 ? "+" : ""}
                        {report.health.currentMa} mA
                      </BentoPill>
                    )}
                    {report.health.voltageMv > 0 && (
                      <BentoPill
                        tooltip="Live cell voltage. Full lithium cells sit around 4.2V–4.4V; empty around 3.3V."
                        className="-rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                      >
                        {(report.health.voltageMv / 1000).toFixed(2)}V
                      </BentoPill>
                    )}
                    {report.health.chargingPolicy !== "INVALID" && (
                      <BentoPill
                        tooltip={describeChargingPolicy(
                          report.health.chargingPolicy,
                        )}
                        className="rotate-2 hidden px-1.5 text-[10px] sm:inline-flex sm:px-2 sm:text-[11px]"
                      >
                        {report.health.chargingPolicy.replace(/_/g, " ")}
                      </BentoPill>
                    )}
                    {report.health.cycleCount === null && (
                      <BentoPill
                        tooltip="Current battery state of charge at dump capture."
                        className="rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                      >
                        Level {report.health.levelPct}%
                      </BentoPill>
                    )}
                    {(report.health.chargingState !== "NORMAL" &&
                      report.health.chargingState !== "INVALID") ||
                    (report.health.batteryHealth !== "GOOD" &&
                      report.health.batteryHealth !== "UNKNOWN") ? (
                      <BentoPill
                        tooltip={
                          report.health.chargingState !== "NORMAL" &&
                          report.health.chargingState !== "INVALID"
                            ? describeChargingState(report.health.chargingState)
                            : `Battery health status: ${report.health.batteryHealth}`
                        }
                        className="-rotate-1 bg-[#520a5e]/20 px-1.5 text-[10px] font-semibold sm:px-2 sm:text-[11px]"
                      >
                        {report.health.chargingState !== "NORMAL" &&
                        report.health.chargingState !== "INVALID"
                          ? report.health.chargingState.replace(/_/g, " ")
                          : report.health.batteryHealth}
                      </BentoPill>
                    ) : null}
                  </div>
                  <div className="flex items-end justify-between px-3 sm:px-4">
                    <span className="text-[10px] font-medium opacity-70">
                      {expandedCards.cycles
                        ? "Hide telemetry"
                        : "Tap for details"}
                    </span>
                    <span className="font-heading text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
                      {report.health.cycleCount !== null
                        ? report.health.cycleCount
                        : "N/A"}
                    </span>
                  </div>
                  <ExpandPanel open={expandedCards.cycles}>
                    <div className="mx-3 flex flex-col gap-2 border-t border-black/15 pt-2.5 text-xs sm:mx-4">
                      {report.health.cycleCount !== null && (
                        <div className="h-2 w-full overflow-hidden rounded-[2px] bg-black/15">
                          <div
                            className="h-full bg-[#520a5e]"
                            style={{
                              width: `${Math.min(100, Math.round((report.health.cycleCount / report.device.profile.ratedCycles) * 100))}%`,
                            }}
                          />
                        </div>
                      )}
                      <p className="leading-snug opacity-90">
                        {report.health.cycleCount !== null
                          ? report.health.cycleCount >
                            report.device.profile.ratedCycles
                            ? `${report.health.cycleCount} full cycles logged — officially past the typical ${report.device.profile.ratedCycles.toLocaleString()}-cycle rating.`
                            : `${report.health.cycleCount} of ~${report.device.profile.ratedCycles.toLocaleString()} typical rated cycles used.`
                          : `Cycle count wasn't exposed by this device's fuel gauge.`}
                        {liveWatts ? ` Pulling ${liveWatts}W right now.` : ""}
                      </p>
                      <div className="flex flex-wrap justify-between gap-1 text-[11px] opacity-80">
                        <span>
                          Level: {report.health.levelPct}% ·{" "}
                          {report.health.chargingState}
                        </span>
                        <span>
                          {report.health.chargingPolicy.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  </ExpandPanel>
                </Card>

                {/* 3. Mint: Thermal Headroom */}
                {(() => {
                  const hasThermalHal = report.thermals.sensors.length > 0;
                  const hasTempReading =
                    hasThermalHal || report.health.tempC > 0;
                  const displayTemp = hasThermalHal
                    ? report.thermals.skinTempC
                    : report.thermals.batteryTempC;
                  return (
                    <Card
                      variant="mint"
                      onClick={() => toggleCard("thermals")}
                      className={`animate-bento-in justify-between gap-2.5 py-3 sm:gap-3 sm:py-4 ${CLICK_CARD_FX}`}
                      style={{ animationDelay: "70ms" }}
                    >
                      <div className="flex items-start justify-between px-3 sm:px-4">
                        <div className="flex flex-col text-xs leading-tight font-medium sm:text-sm">
                          <span>Thermal</span>
                          <span>headroom</span>
                        </div>
                        <Sun1Bold size={20} color="#3a7d78" />
                      </div>
                      <div className="flex flex-wrap justify-center gap-1 px-2.5 sm:gap-1.5 sm:px-4">
                        {!hasTempReading ? (
                          <BentoPill
                            tooltip="Neither Thermal HAL sensors nor battery thermistor temperature were exposed in this dump."
                            className="-rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                          >
                            No thermal data
                          </BentoPill>
                        ) : !hasThermalHal ? (
                          <>
                            <BentoPill
                              tooltip="Internal battery cell temperature. Above 40°C speeds up chemical aging."
                              className="-rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                            >
                              Cell {report.thermals.batteryTempC}°
                            </BentoPill>
                            <BentoPill
                              tooltip="No Thermal HAL sensors were exposed; showing battery thermistor temperature only."
                              className="rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                            >
                              Cell temp only
                            </BentoPill>
                          </>
                        ) : (
                          <>
                            <BentoPill
                              tooltip="Internal battery cell temperature. Above 40°C speeds up chemical aging."
                              className="-rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                            >
                              Cell {report.thermals.batteryTempC}°
                            </BentoPill>
                            {report.thermals.coilTempC !== null && (
                              <BentoPill
                                tooltip="Wireless charging coil temperature at the back glass."
                                className="rotate-1 hidden px-1.5 text-[10px] sm:inline-flex sm:px-2 sm:text-[11px]"
                              >
                                Coil {report.thermals.coilTempC}°
                              </BentoPill>
                            )}
                            {report.thermals.cpuPeakC !== null && (
                              <BentoPill
                                tooltip="Peak CPU silicon temperature cached by thermal HAL."
                                className="-rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                              >
                                CPU {report.thermals.cpuPeakC}°
                              </BentoPill>
                            )}
                            <BentoPill
                              tooltip="System-wide throttling severity from None (0) up to Shutdown (6)."
                              className="rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                            >
                              {report.thermals.overallStatusLabel}
                            </BentoPill>
                          </>
                        )}
                      </div>
                      <div className="flex items-end justify-between px-3 sm:px-4">
                        <span className="text-[10px] font-medium opacity-70">
                          {expandedCards.thermals
                            ? "Hide zones"
                            : "Tap for details"}
                        </span>
                        <span className="font-heading text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
                          {hasTempReading ? `${displayTemp}°` : "N/A"}
                        </span>
                      </div>
                      <ExpandPanel open={expandedCards.thermals}>
                        <div className="mx-3 flex flex-col gap-1.5 border-t border-black/15 pt-2.5 text-xs sm:mx-4">
                          {!hasTempReading ? (
                            <p className="leading-snug opacity-90">
                              Thermal telemetry wasn&apos;t exposed in this bug
                              report.
                            </p>
                          ) : !hasThermalHal ? (
                            <>
                              <div className="flex justify-between">
                                <span>Battery cell</span>
                                <span className="font-mono font-semibold">
                                  {report.thermals.batteryTempC}°C
                                </span>
                              </div>
                              <p className="pt-0.5 leading-snug opacity-90">
                                Thermal HAL zones weren&apos;t exposed in this
                                dump — showing battery thermistor reading only.
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span>Skin / Battery</span>
                                <span className="font-mono font-semibold">
                                  {report.thermals.skinTempC}°C /{" "}
                                  {report.thermals.batteryTempC}°C
                                </span>
                              </div>
                              {(report.thermals.cpuPeakC !== null ||
                                report.thermals.gpuPeakC !== null) && (
                                <div className="flex justify-between">
                                  <span>CPU / GPU Peak</span>
                                  <span className="font-mono font-semibold">
                                    {report.thermals.cpuPeakC ?? "—"}°C /{" "}
                                    {report.thermals.gpuPeakC ?? "—"}°C
                                  </span>
                                </div>
                              )}
                              <p className="pt-0.5 leading-snug opacity-90">
                                {report.thermals.overallStatus >= 3
                                  ? "Running hot enough to fry eggs — Android is actively clamping performance."
                                  : report.thermals.overallStatus >= 1
                                    ? "Mild warmth detected; light background throttling active."
                                    : "Thermals look chill. No active throttling right now."}
                              </p>
                            </>
                          )}
                        </div>
                      </ExpandPanel>
                    </Card>
                  );
                })()}

                {/* 4. Lavender: Standby Drain */}
                {(() => {
                  const hasStandbyData =
                    report.drain.screenOffMs >= 60_000 ||
                    report.drain.screenOffDischargeMah > 0;
                  const totalOff = Math.max(1, report.drain.screenOffMs);
                  const awakeMs =
                    report.drain.screenOffUptimeMs > 0
                      ? report.drain.screenOffUptimeMs
                      : report.drain.partialWakelockMs;
                  const deepPct = Math.min(
                    100,
                    Math.round((report.drain.deepDozeMs / totalOff) * 100),
                  );
                  const lightPct = Math.min(
                    100 - deepPct,
                    Math.round((report.drain.lightDozeMs / totalOff) * 100),
                  );
                  const awakePct = Math.min(
                    100,
                    Math.round((awakeMs / totalOff) * 100),
                  );
                  return (
                    <Card
                      variant="lavender"
                      onClick={() => toggleCard("standby")}
                      className={`animate-bento-in justify-between gap-2.5 py-3 sm:gap-3 sm:py-4 ${CLICK_CARD_FX}`}
                      style={{ animationDelay: "105ms" }}
                    >
                      <div className="flex items-start justify-between px-3 sm:px-4">
                        <div className="flex flex-col text-xs leading-tight font-medium sm:text-sm">
                          <span>Standby</span>
                          <span>mAh / hr</span>
                        </div>
                        <MoonBold size={20} color="#4e4ab0" />
                      </div>
                      <div className="flex flex-wrap justify-center gap-1 px-2.5 sm:gap-1.5 sm:px-4">
                        {hasStandbyData ? (
                          <>
                            <BentoPill
                              tooltip="Total battery capacity burned while the screen was completely off."
                              className="-rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                            >
                              {report.drain.screenOffDischargeMah.toLocaleString()}{" "}
                              mAh off
                            </BentoPill>
                            {report.drain.screenOffPctPerHr !== null && (
                              <BentoPill
                                tooltip="Real idle drain pace measured from batterystats discharge steps."
                                className="rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                              >
                                -{report.drain.screenOffPctPerHr}%/hr idle
                              </BentoPill>
                            )}
                            <BentoPill
                              tooltip="True CPU uptime percentage while screen was off (vs Deep Doze sleep)."
                              className="rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                            >
                              {report.drain.awakeWhileScreenOffPct}% awake
                            </BentoPill>
                            <BentoPill
                              tooltip="Total screen-off duration since last full charge."
                              className="-rotate-1 hidden px-1.5 text-[10px] sm:inline-flex sm:px-2 sm:text-[11px]"
                            >
                              {formatDurationShort(report.drain.screenOffMs)}{" "}
                              off
                            </BentoPill>
                          </>
                        ) : (
                          <BentoPill
                            tooltip="Under 1 minute of screen-off battery data was recorded in this dump."
                            className="-rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                          >
                            No standby sample
                          </BentoPill>
                        )}
                      </div>
                      <div className="flex items-end justify-between px-3 sm:px-4">
                        <span className="text-[10px] font-medium opacity-70">
                          {expandedCards.standby
                            ? "Hide sleep audit"
                            : "Tap for details"}
                        </span>
                        <span className="font-heading text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
                          {hasStandbyData
                            ? report.drain.idleRateMahPerHr
                            : "N/A"}
                        </span>
                      </div>
                      <ExpandPanel open={expandedCards.standby}>
                        <div className="mx-3 flex flex-col gap-2 border-t border-black/15 pt-2.5 text-xs sm:mx-4">
                          {!hasStandbyData ? (
                            <p className="leading-snug opacity-90">
                              No screen-off standby telemetry in this dump —
                              either the phone was just unplugged or idle stats
                              weren&apos;t recorded.
                            </p>
                          ) : (
                            <>
                              <div
                                className="flex h-2 w-full overflow-hidden rounded-[2px] bg-black/15"
                                title={`Deep Doze ${deepPct}% · Light Doze ${lightPct}% · Awake ${awakePct}%`}
                              >
                                {deepPct > 0 && (
                                  <div
                                    className="h-full bg-[#1f1c63]"
                                    style={{ width: `${deepPct}%` }}
                                  />
                                )}
                                {lightPct > 0 && (
                                  <div
                                    className="h-full bg-[#39348f]"
                                    style={{ width: `${lightPct}%` }}
                                  />
                                )}
                                <div
                                  className="h-full bg-white/45"
                                  style={{
                                    width: `${Math.max(4, deepPct + lightPct > 0 ? awakePct : report.drain.awakeWhileScreenOffPct)}%`,
                                  }}
                                />
                              </div>
                              <div className="flex flex-col gap-1 text-[11px]">
                                <div className="flex justify-between gap-2">
                                  <span className="opacity-80">
                                    Deep / Light Doze
                                  </span>
                                  <span className="font-mono font-semibold tabular-nums">
                                    {formatDurationShort(
                                      report.drain.deepDozeMs,
                                    )}{" "}
                                    /{" "}
                                    {formatDurationShort(
                                      report.drain.lightDozeMs,
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="opacity-80">Doze drain</span>
                                  <span className="font-mono font-semibold tabular-nums">
                                    {report.drain.deepDozeDischargeMah} deep ·{" "}
                                    {report.drain.lightDozeDischargeMah} light
                                    mAh
                                  </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="opacity-80">
                                    CPU awake / Locks
                                  </span>
                                  <span className="font-mono font-semibold tabular-nums">
                                    {formatDurationShort(awakeMs)} ·{" "}
                                    {formatDurationShort(
                                      report.drain.partialWakelockMs,
                                    )}
                                  </span>
                                </div>
                              </div>
                              <p className="leading-snug opacity-90">
                                {report.drain.awakeWhileScreenOffPct >= 50
                                  ? "Insomnia alert: background tasks blocked Deep Doze most of the night."
                                  : report.drain.partialWakelockMs >
                                        awakeMs * 1.6 && awakeMs > 0
                                    ? "Solid deep-doze ratio; overlapping wakelocks ran concurrently while awake."
                                    : "Healthy sleep ratio — Deep Doze kicked in properly between wakes."}
                              </p>
                            </>
                          )}
                        </div>
                      </ExpandPanel>
                    </Card>
                  );
                })()}
              </div>

              {/* Row 2: Left Bento Stack & Synchronized Timelines */}
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                <div className="flex flex-col gap-3 xl:col-span-4">
                  {/* Interactive Donut Card */}
                  <Card
                    className="animate-bento-in"
                    style={{ animationDelay: "60ms" }}
                  >
                    <CardHeader>
                      <CardTitle>
                        Subsystem share
                        <InfoTooltip
                          title="Hardware Power Breakdown"
                          text="Hover or tap any subsystem slice or row to inspect its share of total power draw."
                        />
                      </CardTitle>
                      <CardDescription>
                        {donutData.length === 0
                          ? "No subsystem estimates recorded"
                          : activeSlice !== null && donutData[activeSlice]
                            ? `${donutData[activeSlice].name}: ${donutData[activeSlice].pct}% (${donutData[activeSlice].detail})`
                            : "Top consumers (mAh) · Tap or hover to highlight"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {donutData.length === 0 ? (
                        <div className="bg-muted/40 text-muted-foreground rounded-sm border px-3 py-5 text-center text-xs">
                          No hardware subsystem power estimates were logged in
                          this bug report.
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 sm:flex-row">
                          <ChartContainer
                            config={donutConfig}
                            className="size-36 shrink-0 sm:size-40"
                          >
                            <PieChart>
                              <Pie
                                data={donutData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={40}
                                outerRadius={64}
                                paddingAngle={2}
                                stroke="none"
                                isAnimationActive={false}
                                onMouseEnter={(_, idx) => setActiveSlice(idx)}
                                onMouseLeave={() => setActiveSlice(null)}
                                onClick={(_, idx) =>
                                  setActiveSlice((prev) =>
                                    prev === idx ? null : idx,
                                  )
                                }
                              >
                                {donutData.map((entry, idx) => (
                                  <Cell
                                    key={entry.name}
                                    fill={entry.color}
                                    opacity={
                                      activeSlice === null ||
                                      activeSlice === idx
                                        ? 1
                                        : 0.35
                                    }
                                    className="cursor-pointer transition-opacity duration-150"
                                  />
                                ))}
                              </Pie>
                              <ChartTooltip
                                content={({ active, payload }) => (
                                  <ChartTooltipContent
                                    active={active}
                                    payload={payload}
                                    config={donutConfig}
                                  />
                                )}
                              />
                            </PieChart>
                          </ChartContainer>
                          <div className="flex w-full flex-col gap-1 text-xs">
                            {donutData.map((d, idx) => (
                              <button
                                key={d.name}
                                type="button"
                                onMouseEnter={() => setActiveSlice(idx)}
                                onMouseLeave={() => setActiveSlice(null)}
                                onClick={() =>
                                  setActiveSlice((prev) =>
                                    prev === idx ? null : idx,
                                  )
                                }
                                className={`flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1 text-left transition-colors cursor-pointer touch-manipulation ${
                                  activeSlice === idx
                                    ? "bg-muted"
                                    : "hover:bg-muted/60"
                                }`}
                              >
                                <span className="text-muted-foreground flex min-w-0 items-center gap-2">
                                  <span
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: d.color }}
                                  />
                                  <span className="text-foreground font-mono font-semibold tabular-nums">
                                    {d.value}
                                  </span>
                                  <span className="truncate">{d.name}</span>
                                </span>
                                <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
                                  {d.pct}%
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {(report.drain.unattributedTotalMah >= 50 ||
                        report.drain.activeAudioClients.length > 0) && (
                        <div className="bg-muted/50 flex flex-col gap-1.5 rounded-sm border px-3 py-2 text-xs">
                          {report.drain.unattributedTotalMah >= 50 && (
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="text-muted-foreground">
                                Unattributed to apps:{" "}
                                <strong className="font-mono text-foreground">
                                  {report.drain.unattributedTotalMah} mAh
                                </strong>
                              </span>
                              <span className="text-muted-foreground font-mono text-[11px]">
                                {report.drain.globalSubsystems
                                  .filter((s) => s.unattributedMah >= 20)
                                  .slice(0, 3)
                                  .map(
                                    (s) =>
                                      `${s.label.split(" ")[0]} ${Math.round(s.unattributedMah)}`,
                                  )
                                  .join(" · ")}
                              </span>
                            </div>
                          )}
                          {report.drain.activeAudioClients.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="warning" className="text-[10px]">
                                Live AudioRecord
                              </Badge>
                              <span className="text-muted-foreground truncate text-[11px]">
                                {report.drain.activeAudioClients
                                  .map((c) => `${c.name} (${c.source})`)
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Stacked Expandable Accent Pair */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Card
                      variant="sky"
                      onClick={() => toggleCard("split")}
                      className={`animate-bento-in gap-3 ${CLICK_CARD_FX}`}
                      style={{ animationDelay: "100ms" }}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-[#152744]">
                          <span className="flex items-center gap-1.5">
                            Active vs standby split
                            <InfoTooltip
                              title="Discharge Split"
                              iconClassName="text-[#152744]/75 hover:text-[#152744]"
                              text="Compares battery capacity burned with the screen turned on versus sitting idle with the screen off."
                            />
                          </span>
                          <span className="font-sans text-[10px] font-medium opacity-70">
                            {expandedCards.split ? "Less" : "More"}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2.5 text-xs">
                        {report.drain.totalDischargeMah > 0 ||
                        report.drain.screenOnDischargeMah > 0 ||
                        report.drain.screenOffDischargeMah > 0 ? (
                          <>
                            <div className="flex h-5 w-full overflow-hidden rounded-[3px] bg-black/15 text-[11px] font-semibold">
                              <div
                                className="bg-[#152744] text-[#9eb9e8] flex items-center justify-center truncate px-2"
                                style={{
                                  width: `${
                                    report.drain.totalDischargeMah > 0
                                      ? Math.round(
                                          (report.drain.screenOnDischargeMah /
                                            report.drain.totalDischargeMah) *
                                            100,
                                        )
                                      : 50
                                  }%`,
                                }}
                              >
                                On {report.drain.screenOnDischargeMah}
                              </div>
                              <div
                                className="flex items-center justify-center truncate px-2 text-[#152744]"
                                style={{
                                  width: `${
                                    report.drain.totalDischargeMah > 0
                                      ? Math.round(
                                          (report.drain.screenOffDischargeMah /
                                            report.drain.totalDischargeMah) *
                                            100,
                                        )
                                      : 50
                                  }%`,
                                }}
                              >
                                Off {report.drain.screenOffDischargeMah}
                              </div>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>
                                Screen on:{" "}
                                {formatDurationShort(report.drain.screenOnMs)} (
                                {report.drain.screenOnCount}x)
                              </span>
                              <span>
                                Off:{" "}
                                {formatDurationShort(report.drain.screenOffMs)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bg-black/10 text-[#152744] rounded-[3px] px-2.5 py-2 text-[11px] font-medium">
                              No discharge split recorded yet in this dump.
                            </div>
                            {(report.drain.screenOnMs > 0 ||
                              report.drain.screenOffMs > 0) && (
                              <div className="flex justify-between font-medium">
                                {report.drain.screenOnMs > 0 && (
                                  <span>
                                    Screen on:{" "}
                                    {formatDurationShort(
                                      report.drain.screenOnMs,
                                    )}{" "}
                                    ({report.drain.screenOnCount}x)
                                  </span>
                                )}
                                {report.drain.screenOffMs > 0 && (
                                  <span>
                                    Off:{" "}
                                    {formatDurationShort(
                                      report.drain.screenOffMs,
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        {(report.drain.screenOnPctPerHr !== null ||
                          report.drain.screenOffPctPerHr !== null ||
                          report.drain.chargePctPerHr !== null) && (
                          <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[11px] opacity-85 tabular-nums">
                            <span>
                              {report.drain.screenOnPctPerHr !== null
                                ? `-${report.drain.screenOnPctPerHr}%/hr on`
                                : ""}
                              {report.drain.screenOnPctPerHr !== null &&
                              report.drain.screenOffPctPerHr !== null
                                ? " · "
                                : ""}
                              {report.drain.screenOffPctPerHr !== null
                                ? `-${report.drain.screenOffPctPerHr}%/hr off`
                                : ""}
                            </span>
                            {report.drain.chargePctPerHr !== null && (
                              <span>
                                +{report.drain.chargePctPerHr}%/hr charge
                              </span>
                            )}
                          </div>
                        )}
                        <ExpandPanel open={expandedCards.split}>
                          {report.drain.totalDischargeMah > 0 ||
                          report.drain.screenOnDischargeMah > 0 ||
                          report.drain.screenOffDischargeMah > 0 ? (
                            <div className="flex flex-col gap-1 border-t border-black/15 pt-2 text-[11px] opacity-90">
                              <div className="flex justify-between">
                                <span>Screen-on burn rate</span>
                                <span className="font-mono font-semibold">
                                  {report.drain.activeRateMahPerHr} mAh/hr
                                  {report.drain.screenOnPctPerHr !== null
                                    ? ` (-${report.drain.screenOnPctPerHr}%/hr)`
                                    : ` (-${report.drain.screenOnPctDrop}%)`}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Screen-off burn rate</span>
                                <span className="font-mono font-semibold">
                                  {report.drain.idleRateMahPerHr} mAh/hr
                                  {report.drain.screenOffPctPerHr !== null
                                    ? ` (-${report.drain.screenOffPctPerHr}%/hr)`
                                    : ` (-${report.drain.screenOffPctDrop}%)`}
                                </span>
                              </div>
                              {report.drain.chargePctPerHr !== null && (
                                <div className="flex justify-between">
                                  <span>Charge pace (steps)</span>
                                  <span className="font-mono font-semibold">
                                    +{report.drain.chargePctPerHr}%/hr
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="border-t border-black/15 pt-2 text-[11px] leading-snug opacity-90">
                              Burn rate breakdown needs measurable screen-on or
                              standby discharge.
                            </p>
                          )}
                        </ExpandPanel>
                      </CardContent>
                    </Card>

                    {report.thermals.bcl.modules.length > 0 && (
                      <Card
                        variant="orchid"
                        onClick={() => toggleCard("bcl")}
                        className={`animate-bento-in gap-2 ${CLICK_CARD_FX}`}
                        style={{ animationDelay: "115ms" }}
                      >
                        <CardHeader>
                          <CardDescription className="flex flex-row items-center justify-between text-[#520a5e]/80">
                            <span className="flex items-center gap-1.5">
                              <span>Load brownouts (BCL)</span>
                              <InfoTooltip
                                title="Battery Current Limiting (Voltage Droop)"
                                iconClassName="text-[#520a5e]/75 hover:text-[#520a5e]"
                                text="Kernel hardware throttling triggered when a sudden power spike sags battery voltage. Frequent heavy events indicate elevated internal cell resistance from wear."
                              />
                            </span>
                            <DangerBold size={18} color="#821891" />
                          </CardDescription>
                          <CardTitle className="text-lg text-[#520a5e]">
                            {report.thermals.bcl.heavyCount > 0
                              ? `${report.thermals.bcl.heavyCount} Heavy Voltage Droops`
                              : `${report.thermals.bcl.totalThrottle} Brownout Events`}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 text-xs font-medium text-[#520a5e]/90">
                          <div className="flex h-2.5 w-full overflow-hidden rounded-[2px] bg-black/15">
                            {report.thermals.bcl.heavyCount > 0 && (
                              <div
                                className="h-full bg-[#520a5e]"
                                style={{
                                  width: `${(report.thermals.bcl.heavyCount / Math.max(1, report.thermals.bcl.totalThrottle)) * 100}%`,
                                }}
                              />
                            )}
                            {report.thermals.bcl.mediumCount > 0 && (
                              <div
                                className="h-full bg-[#520a5e]/55"
                                style={{
                                  width: `${(report.thermals.bcl.mediumCount / Math.max(1, report.thermals.bcl.totalThrottle)) * 100}%`,
                                }}
                              />
                            )}
                            {report.thermals.bcl.lightCount > 0 && (
                              <div
                                className="h-full bg-[#520a5e]/25"
                                style={{
                                  width: `${(report.thermals.bcl.lightCount / Math.max(1, report.thermals.bcl.totalThrottle)) * 100}%`,
                                }}
                              />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[11px] tabular-nums">
                            <span>
                              {report.thermals.bcl.heavyCount} heavy ·{" "}
                              {report.thermals.bcl.mediumCount} med ·{" "}
                              {report.thermals.bcl.lightCount} light
                            </span>
                            <span className="font-sans text-[10px] opacity-75">
                              {expandedCards.bcl ? "Less" : "By rail"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {report.thermals.bcl.modules
                              .slice(0, 3)
                              .map((m) => (
                                <BentoPill
                                  key={m.module}
                                  className="px-1.5 text-[10px]"
                                >
                                  {m.label} ·{" "}
                                  {m.heavyCount > 0
                                    ? `${m.heavyCount} heavy`
                                    : `${m.totalThrottle}x`}
                                </BentoPill>
                              ))}
                          </div>
                          <ExpandPanel open={expandedCards.bcl}>
                            <div className="flex flex-col gap-1.5 border-t border-black/15 pt-2 text-[11px] font-normal">
                              {report.thermals.bcl.modules
                                .slice(0, 5)
                                .map((m) => {
                                  const maxMod = Math.max(
                                    1,
                                    report.thermals.bcl.modules[0]
                                      ?.totalThrottle || 1,
                                  );
                                  return (
                                    <div
                                      key={m.module}
                                      className="flex flex-col gap-0.5"
                                    >
                                      <div className="flex justify-between font-mono tabular-nums">
                                        <span className="font-sans font-medium">
                                          {m.label}
                                        </span>
                                        <span>
                                          {m.heavyCount}H · {m.mediumCount}M ·{" "}
                                          {m.lightCount}L
                                        </span>
                                      </div>
                                      <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-black/15">
                                        <div
                                          className="h-full bg-[#520a5e]"
                                          style={{
                                            width: `${Math.max(4, Math.round((m.totalThrottle / maxMod) * 100))}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              <p className="pt-0.5 leading-snug opacity-90">
                                {report.thermals.bcl.heavyCount >= 50
                                  ? "High internal resistance is causing sharp voltage drops under camera/audio load spikes."
                                  : "Occasional peak-load voltage droop mitigations logged by the kernel."}
                              </p>
                            </div>
                          </ExpandPanel>
                        </CardContent>
                      </Card>
                    )}

                    {(() => {
                      const hasCell = report.drain.cellularDrainMah > 0;
                      const hasWifi = report.drain.wifiDrainMah > 0;
                      const hasRadio = hasCell || hasWifi;
                      const hasThermalSnapshot =
                        report.thermals.preRebootTempC !== null ||
                        report.thermals.sensors.length > 0;
                      const totalRadioMah =
                        report.drain.cellularDrainMah +
                        report.drain.wifiDrainMah;
                      const cellDominates =
                        report.drain.cellularDrainMah >=
                        report.drain.wifiDrainMah;
                      const cellSum = summarizeSignal(
                        report.drain.cellularSignal,
                      );
                      const wifiSum = summarizeSignal(report.drain.wifiSignal);
                      const cellTraffic = sumFormattedTraffic(
                        report.drain.cellularRx,
                        report.drain.cellularTx,
                      );
                      const wifiTraffic = sumFormattedTraffic(
                        report.drain.wifiRxMb,
                        report.drain.wifiTxGb,
                      );
                      const cellEff = mahPerGbLabel(
                        report.drain.cellularDrainMah,
                        report.drain.cellularRx,
                        report.drain.cellularTx,
                      );
                      const wifiEff = mahPerGbLabel(
                        report.drain.wifiDrainMah,
                        report.drain.wifiRxMb,
                        report.drain.wifiTxGb,
                      );

                      const insight =
                        cellSum.weakPct >= 25 || wifiSum.weakPct >= 25
                          ? `Weak signal taxed the radio (${cellDominates ? `${cellSum.weakPct}% cell` : `${wifiSum.weakPct}% Wi-Fi`} poor/moderate) — transmitters boosted power.`
                          : hasCell && report.drain.cellularActivePct >= 50
                            ? `Strong cellular signal (${cellSum.label}), but modem stayed active ${report.drain.cellularActivePct}% of battery time moving ${cellTraffic}.`
                            : hasWifi &&
                                report.drain.wifiScanMs > 30 * 60_000 &&
                                report.drain.wifiDisconnPct > 70
                              ? `Wi-Fi spent ${formatDurationShort(report.drain.wifiScanMs)} scanning while disconnected (${report.drain.wifiDisconnPct}%).`
                              : hasRadio
                                ? `Clean radio link (${cellDominates ? cellSum.label : wifiSum.label}) with ${report.drain.connectivityChanges} network handoffs.`
                                : hasThermalSnapshot
                                  ? `Dump captured ${report.device.dumpTime} with ${report.thermals.sensors.length} active thermal sensors.`
                                  : `Dump captured ${report.device.dumpTime} · Battery tech: ${report.health.technology}.`;

                      return (
                        <Card
                          variant="coral"
                          onClick={() => toggleCard("radio")}
                          className={`animate-bento-in gap-2 ${CLICK_CARD_FX} ${
                            report.thermals.bcl.modules.length > 0
                              ? "sm:col-span-2 xl:col-span-1"
                              : ""
                          }`}
                          style={{ animationDelay: "130ms" }}
                        >
                          <CardHeader>
                            <CardDescription className="flex flex-row items-center justify-between text-[#5c1908]/80">
                              <span>
                                {hasRadio
                                  ? "Radio & Signal Cost"
                                  : hasThermalSnapshot
                                    ? "Thermal Snapshot"
                                    : "Radio & Signal"}
                              </span>
                              {hasRadio ? (
                                cellDominates ? (
                                  <Radar2Bold size={18} color="#8f290c" />
                                ) : (
                                  <WifiBold size={18} color="#8f290c" />
                                )
                              ) : hasThermalSnapshot ? (
                                <DangerBold size={18} color="#8f290c" />
                              ) : (
                                <Radar2Bold size={18} color="#8f290c" />
                              )}
                            </CardDescription>
                            <CardTitle className="text-lg text-[#5c1908]">
                              {hasRadio
                                ? hasCell && hasWifi
                                  ? `${totalRadioMah.toLocaleString()} mAh Radio Drain`
                                  : hasCell
                                    ? `${report.drain.cellularDrainMah.toLocaleString()} mAh Cellular`
                                    : `${report.drain.wifiDrainMah.toLocaleString()} mAh Wi-Fi`
                                : !hasThermalSnapshot
                                  ? "No telemetry"
                                  : report.thermals.preRebootTempC
                                    ? `Peak ${report.thermals.preRebootTempC}°C Pre-Reboot`
                                    : `${report.thermals.sensors.length} Thermal Sensors`}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-2 text-xs font-medium text-[#5c1908]/90">
                            {hasRadio ? (
                              <div className="flex flex-col gap-1">
                                {hasCell && (
                                  <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <span className="font-semibold">
                                      Cellular
                                    </span>
                                    <span className="font-mono tabular-nums">
                                      {report.drain.cellularDrainMah.toLocaleString()}{" "}
                                      mAh · {cellTraffic} · {cellSum.label}
                                    </span>
                                  </div>
                                )}
                                {hasWifi && (
                                  <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <span className="font-semibold">Wi-Fi</span>
                                    <span className="font-mono tabular-nums">
                                      {report.drain.wifiDrainMah.toLocaleString()}{" "}
                                      mAh · {wifiTraffic} · {wifiSum.label}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : hasThermalSnapshot ? (
                              <div>
                                Manufactured{" "}
                                {report.health.manufacturedDate ?? "date N/A"} ·{" "}
                                {report.health.technology}
                              </div>
                            ) : (
                              <div>
                                Radio power and thermal HAL snapshots
                                weren&apos;t logged in this dump.
                              </div>
                            )}
                            <ExpandPanel open={expandedCards.radio}>
                              <div className="flex flex-col gap-2 border-t border-black/15 pt-2 text-[11px] font-normal">
                                {hasCell && (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex justify-between font-mono tabular-nums">
                                      <span className="font-sans font-medium">
                                        Cellular RSRP{" "}
                                        {cellEff ? `(${cellEff})` : ""}
                                      </span>
                                      <span>
                                        {report.drain.cellularActivePct}% active
                                      </span>
                                    </div>
                                    <SignalQualityBar
                                      dist={report.drain.cellularSignal}
                                    />
                                  </div>
                                )}
                                {hasWifi && (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex justify-between font-mono tabular-nums">
                                      <span className="font-sans font-medium">
                                        Wi-Fi RSSI{" "}
                                        {wifiEff ? `(${wifiEff})` : ""}
                                      </span>
                                      <span>
                                        {report.drain.wifiScanMs > 0
                                          ? `${formatDurationShort(report.drain.wifiScanMs)} scan`
                                          : wifiSum.label}
                                      </span>
                                    </div>
                                    <SignalQualityBar
                                      dist={report.drain.wifiSignal}
                                    />
                                  </div>
                                )}
                                {report.drain.gpsDrainMah > 0 && (
                                  <div className="flex justify-between font-mono text-[10px] opacity-85 tabular-nums">
                                    <span className="font-sans">
                                      GPS / GNSS
                                    </span>
                                    <span>
                                      {report.drain.gpsDrainMah} mAh ·{" "}
                                      {report.drain.connectivityChanges}{" "}
                                      handoffs
                                    </span>
                                  </div>
                                )}
                                <p className="leading-snug opacity-90">
                                  {insight}
                                </p>
                              </div>
                            </ExpandPanel>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div>
                </div>

                {/* Synchronized Battery & Thermal Timelines */}
                <TimelineSection
                  key={`${report.fileName}-${report.device.dumpTime}`}
                  timeline={report.timeline}
                  dailyStats={report.dailyStats}
                />
              </div>

              {/* Row 3: Power Attribution & Live Thermal Sensors */}
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                <Card
                  className="animate-bento-in flex min-w-0 flex-col xl:col-span-8"
                  style={{ animationDelay: "120ms" }}
                >
                  <Tabs defaultValue="apps" className="flex flex-1 flex-col">
                    <CardHeader>
                      <CardTitle>
                        Power & wakelock attribution
                        <InfoTooltip
                          title="Battery Drain Breakdown"
                          text="Tap any app row to inspect its background wakelock and screen-off damage."
                        />
                      </CardTitle>
                      <CardDescription>
                        Top consumers since last full charge · Click any row to
                        expand
                      </CardDescription>
                      <CardAction>
                        <TabsList className="w-full sm:w-auto">
                          <TabsTrigger
                            value="apps"
                            className="flex-1 sm:flex-initial"
                          >
                            Apps & Services
                          </TabsTrigger>
                          <TabsTrigger
                            value="hardware"
                            className="flex-1 sm:flex-initial"
                          >
                            Hardware
                          </TabsTrigger>
                        </TabsList>
                      </CardAction>
                    </CardHeader>

                    <CardContent className="flex flex-1 flex-col">
                      <TabsContent
                        value="apps"
                        className="flex flex-1 flex-col"
                      >
                        {report.drain.drainers.length === 0 ? (
                          <div className="bg-muted/40 text-muted-foreground flex flex-1 items-center justify-center rounded-sm border px-4 py-8 text-center text-xs">
                            No per-app power usage was attributed in this bug
                            report.
                          </div>
                        ) : (
                          <div className="max-h-[540px] overflow-y-auto rounded-sm border xl:max-h-[715px]">
                            <Table>
                              <TableHeader className="bg-card/95 sticky top-0 z-10 backdrop-blur-xs">
                                <TableRow>
                                  <TableHead>App / Service</TableHead>
                                  <TableHead className="hidden sm:table-cell">
                                    Share
                                  </TableHead>
                                  <TableHead className="hidden text-right md:table-cell">
                                    Screen-Off
                                  </TableHead>
                                  <TableHead className="hidden text-right sm:table-cell">
                                    Wakelock
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Total
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {report.drain.drainers.map((item) => {
                                  const maxMah = Math.max(
                                    1,
                                    report.drain.drainers[0]?.totalMah || 1,
                                  );
                                  const pct = Math.max(
                                    3,
                                    Math.round((item.totalMah / maxMah) * 100),
                                  );
                                  const isExpanded = expandedUidId === item.id;
                                  return (
                                    <React.Fragment key={item.id}>
                                      <TableRow
                                        onClick={() =>
                                          setExpandedUidId((prev) =>
                                            prev === item.id ? null : item.id,
                                          )
                                        }
                                        className="cursor-pointer transition-colors active:bg-muted/60"
                                      >
                                        <TableCell className="max-w-[205px] whitespace-normal sm:max-w-[260px] lg:max-w-[320px] sm:whitespace-nowrap">
                                          <div className="flex flex-col gap-1.5">
                                            <div className="flex min-w-0 items-center gap-2">
                                              {item.kind === "system" ? (
                                                <CpuBold
                                                  size={15}
                                                  color="currentColor"
                                                  className="text-muted-foreground shrink-0"
                                                />
                                              ) : item.kind === "system-app" ? (
                                                <Setting2Bold
                                                  size={15}
                                                  color="#9eb9e8"
                                                  className="shrink-0"
                                                />
                                              ) : (
                                                <AndroidBold
                                                  size={15}
                                                  color="#72c2a4"
                                                  className="shrink-0"
                                                />
                                              )}
                                              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                  <span className="truncate font-medium">
                                                    {item.name}
                                                  </span>
                                                  {item.activeAudio && (
                                                    <Badge
                                                      variant="warning"
                                                      className="px-1.5 py-0 text-[10px]"
                                                    >
                                                      Mic/Audio:{" "}
                                                      {item.activeAudio}
                                                    </Badge>
                                                  )}
                                                  {item.holdingWakelock && (
                                                    <Badge
                                                      variant="outline"
                                                      className="px-1.5 py-0 text-[10px]"
                                                    >
                                                      Live lock
                                                    </Badge>
                                                  )}
                                                </div>
                                                <span className="text-muted-foreground truncate text-[11px]">
                                                  {item.packageName}
                                                  {item.procs.length > 0
                                                    ? ` · ${item.procs.slice(0, 2).map(shortProcName).join(", ")}${
                                                        item.procs.length > 2
                                                          ? ` +${item.procs.length - 2}`
                                                          : ""
                                                      }`
                                                    : ""}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="flex flex-col gap-1 sm:hidden">
                                              <Progress
                                                value={pct}
                                                className="h-1.5"
                                                indicatorClassName={
                                                  item.kind === "system"
                                                    ? "bg-chart-3"
                                                    : item.kind === "system-app"
                                                      ? "bg-chart-5"
                                                      : "bg-chart-2"
                                                }
                                              />
                                              <span className="text-muted-foreground text-[11px]">
                                                {item.detail}
                                              </span>
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell className="hidden w-36 sm:table-cell">
                                          <Progress
                                            value={pct}
                                            indicatorClassName={
                                              item.kind === "system"
                                                ? "bg-chart-3"
                                                : item.kind === "system-app"
                                                  ? "bg-chart-5"
                                                  : "bg-chart-2"
                                            }
                                          />
                                        </TableCell>
                                        <TableCell className="hidden text-right font-mono md:table-cell">
                                          {item.screenOffMah >= 1
                                            ? `${Math.round(item.screenOffMah)} mAh`
                                            : "—"}
                                        </TableCell>
                                        <TableCell className="hidden text-right font-mono sm:table-cell">
                                          {item.wakelockMs >= 10_000
                                            ? formatDurationShort(
                                                item.wakelockMs,
                                              )
                                            : "—"}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                          {item.totalMah} mAh
                                        </TableCell>
                                      </TableRow>
                                      {isExpanded && (
                                        <TableRow className="bg-muted/35 hover:bg-muted/35 animate-bento-in">
                                          <TableCell
                                            colSpan={5}
                                            className="whitespace-normal py-2.5 text-xs"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <span className="text-muted-foreground">
                                                <strong className="text-foreground">
                                                  {item.name}
                                                </strong>{" "}
                                                ({item.packageName}) —{" "}
                                                {item.detail}.
                                                {item.procs.length > 0
                                                  ? ` Processes: ${item.procs.join(", ")}.`
                                                  : ""}
                                                {item.activeAudio
                                                  ? ` Active AudioRecord (${item.activeAudio}).`
                                                  : ""}
                                              </span>
                                              <Badge variant="outline">
                                                {item.kind === "system"
                                                  ? "System Service"
                                                  : item.kind === "system-app"
                                                    ? "System App"
                                                    : "User App"}
                                              </Badge>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="hardware">
                        {report.drain.globalSubsystems.length === 0 ? (
                          <div className="bg-muted/40 text-muted-foreground rounded-sm border px-4 py-8 text-center text-xs">
                            No hardware subsystem estimates were logged in this
                            bug report.
                          </div>
                        ) : (
                          <>
                            {report.drain.unattributedTotalMah >= 50 && (
                              <div className="text-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <span>
                                  App-attributed vs unattributed system/radio
                                  drain
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1">
                                    <span className="size-2 rounded-[2px] bg-chart-5" />{" "}
                                    Apps
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="size-2 rounded-[2px] bg-chart-2" />{" "}
                                    Unattributed (
                                    {report.drain.unattributedTotalMah} mAh)
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className="max-h-[510px] overflow-y-auto rounded-sm border xl:max-h-[685px]">
                              <Table>
                                <TableHeader className="bg-card/95 sticky top-0 z-10 backdrop-blur-xs">
                                  <TableRow>
                                    <TableHead>Hardware Subsystem</TableHead>
                                    <TableHead className="hidden sm:table-cell">
                                      Share
                                    </TableHead>
                                    <TableHead className="hidden md:table-cell">
                                      Activity Detail
                                    </TableHead>
                                    <TableHead className="text-right">
                                      Estimated Drain
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {report.drain.globalSubsystems.map((sub) => {
                                    const maxMah = Math.max(
                                      1,
                                      report.drain.globalSubsystems[0]?.mah ||
                                        1,
                                    );
                                    const pct = Math.max(
                                      3,
                                      Math.round((sub.mah / maxMah) * 100),
                                    );
                                    const hasUnattrib =
                                      sub.unattributedMah >= 5;
                                    const unattribFrac = hasUnattrib
                                      ? Math.min(
                                          100,
                                          Math.round(
                                            (sub.unattributedMah / sub.mah) *
                                              100,
                                          ),
                                        )
                                      : 0;
                                    const attribFrac = 100 - unattribFrac;
                                    const detailText = hasUnattrib
                                      ? `${Math.round(sub.appsMah ?? 0)} mAh apps · ${Math.round(sub.unattributedMah)} unattributed${
                                          sub.detail !== "Subsystem estimate"
                                            ? ` · ${sub.detail}`
                                            : ""
                                        }`
                                      : sub.detail;
                                    const shareBar = hasUnattrib ? (
                                      <div className="bg-secondary flex h-2 w-full overflow-hidden rounded-[2px]">
                                        <div
                                          className="flex h-full"
                                          style={{ width: `${pct}%` }}
                                        >
                                          {attribFrac > 0 && (
                                            <div
                                              className="h-full bg-chart-5"
                                              style={{
                                                width: `${attribFrac}%`,
                                              }}
                                            />
                                          )}
                                          <div
                                            className="h-full bg-chart-2"
                                            style={{
                                              width: `${unattribFrac}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <Progress
                                        value={pct}
                                        indicatorClassName="bg-chart-5"
                                      />
                                    );
                                    return (
                                      <TableRow key={sub.name}>
                                        <TableCell className="whitespace-normal sm:whitespace-nowrap">
                                          <div className="flex flex-col gap-1">
                                            <span className="font-medium">
                                              {sub.label}
                                            </span>
                                            <div className="sm:hidden">
                                              {shareBar}
                                            </div>
                                            {hasUnattrib && (
                                              <span className="text-muted-foreground text-[11px] sm:hidden">
                                                {detailText}
                                              </span>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="hidden w-40 sm:table-cell">
                                          {shareBar}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground hidden md:table-cell">
                                          {detailText}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                          {Math.round(sub.mah)} mAh
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </>
                        )}
                      </TabsContent>
                    </CardContent>
                  </Tabs>
                </Card>

                <Card
                  className="animate-bento-in flex min-w-0 flex-col xl:col-span-4"
                  style={{ animationDelay: "150ms" }}
                >
                  <CardHeader>
                    <CardTitle>
                      Thermal sensors
                      <InfoTooltip
                        title="All Discovered Sensors"
                        text="Sensors discovered from the device thermal HAL mapped across the interactive 3D chassis or listed by throttling severity."
                      />
                    </CardTitle>
                    <CardDescription>
                      {report.thermals.sensors.length === 0
                        ? "No Thermal HAL sensors exposed"
                        : `${report.thermals.sensors.length} active sensors in dump snapshot`}
                    </CardDescription>
                    {report.thermals.sensors.length > 0 && (
                      <CardAction>
                        <Tabs
                          value={thermalView}
                          onValueChange={(v) =>
                            setThermalView(v as "3d" | "list")
                          }
                        >
                          <TabsList>
                            <TabsTrigger value="3d">3D</TabsTrigger>
                            <TabsTrigger value="list">List</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    {report.thermals.sensors.length === 0 ? (
                      <div className="bg-muted/40 text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1.5 rounded-sm border px-4 py-8 text-center text-xs">
                        <p className="font-medium text-foreground">
                          Thermal HAL sensors weren&apos;t exposed in this bug
                          report.
                        </p>
                        <p>
                          Common on older Android builds or restricted OEM
                          dumps.
                        </p>
                        {report.health.tempC > 0 && (
                          <p className="font-mono text-[11px]">
                            Battery cell thermistor reported{" "}
                            {report.health.tempC}°C at capture.
                          </p>
                        )}
                      </div>
                    ) : thermalView === "3d" ? (
                      <div className="flex flex-1 flex-col">
                        <ThermalPhone3D
                          sensors={report.thermals.sensors}
                          chassis={report.device.profile.chassis}
                        />
                      </div>
                    ) : (
                      <div className="max-h-[560px] overflow-y-auto rounded-sm border">
                        <Table>
                          <TableHeader className="bg-card/95 sticky top-0 z-10 backdrop-blur-xs">
                            <TableRow>
                              <TableHead>Sensor</TableHead>
                              <TableHead className="text-right">Temp</TableHead>
                              <TableHead className="text-right">
                                Status
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.thermals.sensors.map((s) => (
                              <TableRow key={s.name}>
                                <TableCell className="max-w-[150px] whitespace-normal sm:max-w-[190px] sm:whitespace-nowrap">
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="truncate font-medium">
                                      {s.label}
                                    </span>
                                    <span className="text-muted-foreground truncate text-[11px]">
                                      {s.type}
                                      {s.peakC && s.peakC > s.currentC + 1
                                        ? ` · peak ${s.peakC}°C`
                                        : ""}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {s.currentC}°C
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={statusBadgeVariant(s.status)}>
                                    {s.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>

        {/* dbrand-style Footer */}
        <footer className="bg-card/60 border-t sm:bg-background/90 sm:sticky sm:bottom-0 sm:z-20 sm:backdrop-blur-sm">
          <div className="flex w-full flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <CpuChargeBold size={18} color="#f8fafc" className="shrink-0" />
              <span className="font-heading font-bold tracking-wide">
                pregnantBattery
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                v{pkg.version}
              </span>
              <span className="text-muted-foreground hidden md:inline">
                · I don&apos;t need your goddamn data. Built because I&apos;m
                lazy.
              </span>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial"
                asChild
              >
                <a
                  href="https://linktr.ee/sanszerif"
                  target="_blank"
                  rel="noreferrer"
                >
                  <LinkBold size={14} color="currentColor" />
                  linktr.ee/sanszerif
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial"
                asChild
              >
                <a
                  href="https://github.com/sanszerif"
                  target="_blank"
                  rel="noreferrer"
                >
                  <GithubBold size={14} color="currentColor" />
                  github.com/sanszerif
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial"
                asChild
              >
                <a href={REPO_URL} target="_blank" rel="noreferrer">
                  <CodeCircleBold size={14} color="currentColor" />
                  Source
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial"
                title="Found a bug or unprofiled device? Report it on GitHub."
                asChild
              >
                <a href={ISSUES_URL} target="_blank" rel="noreferrer">
                  <DangerBold size={14} color="currentColor" />
                  Report Bug
                </a>
              </Button>
            </div>
          </div>
        </footer>

        {/* Mobile Bottom Thumb-Zone Upload Dock */}
        <div className="bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
          {!report ? (
            <Button
              className="h-12 w-full text-sm font-semibold"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <DocumentUploadBold size={18} color="currentColor" />
              {loading
                ? `Dissecting (${progress}%)...`
                : "Upload Bug Report (.zip / .txt)"}
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">
                  {report.device.model}
                </div>
                <div className="text-muted-foreground truncate text-[11px]">
                  {report.health.healthPct !== null
                    ? `${report.health.healthPct}% health`
                    : `Health N/A · ${report.health.levelPct}%`}
                  {report.thermals.sensors.length > 0
                    ? ` · ${report.thermals.skinTempC}°C skin`
                    : report.health.tempC > 0
                      ? ` · ${report.thermals.batteryTempC}°C cell`
                      : ""}
                </div>
              </div>
              <Button
                size="sm"
                className="h-10 shrink-0 px-4"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <RefreshBold size={15} color="currentColor" />
                Load Zip
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
