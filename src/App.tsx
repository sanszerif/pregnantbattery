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
  CpuBold,
  CpuChargeBold,
  DangerBold,
  DocumentUploadBold,
  FlashBold,
  GithubBold,
  LinkBold,
  MobileBold,
  MoonBold,
  RefreshBold,
  ShieldTickBold,
  Sun1Bold,
  WifiBold,
} from "mx-icons";
import {
  formatDurationShort,
  parseBugReport,
  type BugReportData,
  type DailyStatPoint,
  type ThermalSensor,
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

type Vec3 = readonly [number, number, number];

interface WireEdge {
  pts: Vec3[];
  opacity: number;
  width?: number;
  dashed?: boolean;
  tint?: string;
}

function makeRoundedRectLoop(
  rx: number,
  ry: number,
  r: number,
  z: number,
  cornerSteps = 3,
): Vec3[] {
  const pts: Vec3[] = [];
  const corners: [number, number, number][] = [
    [rx - r, -ry + r, -Math.PI / 2],
    [rx - r, ry - r, 0],
    [-rx + r, ry - r, Math.PI / 2],
    [-rx + r, -ry + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= cornerSteps; i++) {
      const a = a0 + (i / cornerSteps) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
  }
  pts.push(pts[0]);
  return pts;
}

function makeCircleLoop(
  cx: number,
  cy: number,
  r: number,
  z: number,
  segs = 20,
): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
  }
  return pts;
}

function makeBoxEdges(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  opacity: number,
  dashed = true,
): WireEdge[] {
  return [
    {
      pts: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
        [x0, y0, z0],
      ],
      opacity,
      dashed,
    },
    {
      pts: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
        [x0, y0, z1],
      ],
      opacity,
      dashed,
    },
    {
      pts: [
        [x0, y0, z0],
        [x0, y0, z1],
      ],
      opacity: opacity * 0.85,
      dashed,
    },
    {
      pts: [
        [x1, y0, z0],
        [x1, y0, z1],
      ],
      opacity: opacity * 0.85,
      dashed,
    },
    {
      pts: [
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      opacity: opacity * 0.85,
      dashed,
    },
    {
      pts: [
        [x0, y1, z0],
        [x0, y1, z1],
      ],
      opacity: opacity * 0.85,
      dashed,
    },
  ];
}

const PHONE_WIRE_EDGES: WireEdge[] = (() => {
  const edges: WireEdge[] = [];
  const frontOuter = makeRoundedRectLoop(1.0, 2.04, 0.22, 0.14);
  const backOuter = makeRoundedRectLoop(1.0, 2.04, 0.22, -0.14);
  const midFrame = makeRoundedRectLoop(1.01, 2.05, 0.22, 0);
  const screenBezel = makeRoundedRectLoop(0.9, 1.92, 0.15, 0.14);

  edges.push({ pts: frontOuter, opacity: 0.58, width: 1.2 });
  edges.push({ pts: backOuter, opacity: 0.42, width: 1.05 });
  edges.push({ pts: midFrame, opacity: 0.28, width: 0.9, tint: "#9eb9e8" });
  edges.push({ pts: screenBezel, opacity: 0.34, width: 0.95, tint: "#9eb9e8" });

  // Corner & side frame struts connecting front glass and rear panel
  for (let i = 0; i < frontOuter.length - 1; i += 2) {
    edges.push({
      pts: [frontOuter[i], backOuter[i]],
      opacity: 0.26,
      width: 0.85,
    });
  }

  // Front selfie camera punch-hole & earpiece speaker slit
  edges.push({
    pts: makeCircleLoop(0, -1.78, 0.065, 0.145, 14),
    opacity: 0.45,
    width: 0.9,
    tint: "#9eb9e8",
  });
  edges.push({
    pts: [
      [-0.22, -1.97, 0.145],
      [0.22, -1.97, 0.145],
    ],
    opacity: 0.38,
    width: 1.1,
  });

  // Rear Pixel-style camera visor bar & triple lenses (distinguishes rear vs front instantly)
  edges.push(
    ...makeBoxEdges(-0.98, -1.52, -0.22, 0.98, -1.04, -0.14, 0.48, false),
  );
  edges.push({
    pts: makeCircleLoop(-0.52, -1.28, 0.14, -0.225, 16),
    opacity: 0.55,
    width: 1.0,
    tint: "#e5a4eb",
  });
  edges.push({
    pts: makeCircleLoop(-0.08, -1.28, 0.13, -0.225, 16),
    opacity: 0.55,
    width: 1.0,
    tint: "#e5a4eb",
  });
  edges.push({
    pts: makeCircleLoop(0.45, -1.28, 0.12, -0.225, 16),
    opacity: 0.5,
    width: 1.0,
    tint: "#e5a4eb",
  });
  edges.push({
    pts: makeCircleLoop(0.75, -1.28, 0.055, -0.225, 12),
    opacity: 0.4,
    width: 0.85,
  });

  // Internal blueprint: SoC / motherboard + silicon die
  edges.push(
    ...makeBoxEdges(-0.54, -1.42, -0.02, 0.54, -0.56, 0.06, 0.26, true),
  );
  edges.push({
    pts: [
      [-0.22, -1.16, 0.04],
      [0.22, -1.16, 0.04],
      [0.22, -0.82, 0.04],
      [-0.22, -0.82, 0.04],
      [-0.22, -1.16, 0.04],
    ],
    opacity: 0.35,
    dashed: true,
    tint: "#ff9b7b",
  });

  // Internal blueprint: Battery cell + Qi wireless charging coil
  edges.push(...makeBoxEdges(-0.68, -0.34, -0.06, 0.36, 1.5, 0.05, 0.26, true));
  edges.push({
    pts: makeCircleLoop(-0.08, 0.46, 0.42, -0.09, 24),
    opacity: 0.26,
    dashed: true,
    tint: "#72c2a4",
  });
  edges.push({
    pts: makeCircleLoop(-0.08, 0.46, 0.28, -0.09, 20),
    opacity: 0.22,
    dashed: true,
    tint: "#72c2a4",
  });

  // Bottom USB-C port
  edges.push(
    ...makeBoxEdges(-0.22, 1.88, -0.05, 0.22, 2.04, 0.05, 0.42, false),
  );

  return edges;
})();

function sensorAnchor3D(sensor: ThermalSensor): { zone: string; pos: Vec3 } {
  const n = sensor.name.toLowerCase();
  const t = sensor.type.toLowerCase();
  if (
    n.includes("big") ||
    n.includes("mid") ||
    n.includes("little") ||
    t === "cpu"
  ) {
    return { zone: "soc_cpu", pos: [-0.08, -1.04, 0.04] };
  }
  if (
    n.includes("g3d") ||
    n.includes("tpu") ||
    n.includes("isp") ||
    n.includes("aur") ||
    t === "gpu" ||
    t === "npu"
  ) {
    return { zone: "soc_gpu", pos: [0.16, -0.8, 0.04] };
  }
  if (n === "battery" || t === "battery") {
    return { zone: "battery", pos: [-0.2, 0.62, -0.01] };
  }
  if (n.includes("qi") || n.includes("wlc") || n.includes("wireless")) {
    return { zone: "coil", pos: [-0.08, 0.46, -0.11] };
  }
  if (n.includes("disp")) {
    return { zone: "display", pos: [0.1, -0.08, 0.14] };
  }
  if (n.includes("usb")) {
    return { zone: "usb", pos: [0, 1.94, 0.02] };
  }
  if (
    n.includes("gnss") ||
    n.includes("cell") ||
    n.includes("modem") ||
    t === "radio"
  ) {
    return { zone: "radio", pos: [0.62, -1.66, -0.04] };
  }
  if (n.includes("skin") || n.includes("quiet") || t === "body") {
    return { zone: "skin", pos: [0.46, 0.2, -0.14] };
  }
  return { zone: "chassis", pos: [0.56, 0.85, 0] };
}

function sensorTempColor(s: ThermalSensor): string {
  if (
    s.status === "SEVERE" ||
    s.status === "CRITICAL" ||
    s.status === "EMERGENCY" ||
    s.status === "SHUTDOWN" ||
    s.currentC >= 65
  ) {
    return "#ff7a6b";
  }
  if (s.status === "MODERATE" || s.status === "LIGHT" || s.currentC >= 45) {
    return "#ff9b7b";
  }
  if (s.currentC >= 38) return "#e6c84f";
  return "#72c2a4";
}

const ThermalPhone3D = React.memo(function ThermalPhone3D({
  sensors,
}: {
  sensors: ThermalSensor[];
}) {
  const [rot, setRot] = useState<{ yaw: number; pitch: number }>({
    yaw: -28,
    pitch: 14,
  });
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const dragRef = useRef<{
    active: boolean;
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  }>({
    active: false,
    x: 0,
    y: 0,
    yaw: -28,
    pitch: 14,
  });

  const sensorCoords = useMemo(() => {
    const zoneCounts = new Map<string, number>();
    return sensors.map((s) => {
      const { zone, pos } = sensorAnchor3D(s);
      const k = zoneCounts.get(zone) ?? 0;
      zoneCounts.set(zone, k + 1);
      if (k === 0) return { sensor: s, pos };
      const angle = k * 2.39996;
      const rad = 0.14 + Math.min(k, 4) * 0.045;
      const clampX = Math.max(
        -0.85,
        Math.min(0.85, pos[0] + Math.cos(angle) * rad),
      );
      const clampY = Math.max(
        -1.88,
        Math.min(1.88, pos[1] + Math.sin(angle) * rad),
      );
      return { sensor: s, pos: [clampX, clampY, pos[2]] as Vec3 };
    });
  }, [sensors]);

  const project = useMemo(() => {
    const yawRad = (rot.yaw * Math.PI) / 180;
    const pitchRad = (rot.pitch * Math.PI) / 180;
    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);
    const camDist = 9.0;
    const scale = 76;
    const cx = 225;
    const cy = 180;

    return ([x, y, z]: Vec3) => {
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y2 = y * cosP - z1 * sinP;
      const z2 = y * sinP + z1 * cosP;
      const f = camDist / (camDist - z2);
      return {
        px: cx + x1 * scale * f,
        py: cy + y2 * scale * f,
        depth: z2,
      };
    };
  }, [rot]);

  const projectedEdges = useMemo(
    () =>
      PHONE_WIRE_EDGES.map((edge) => {
        let zSum = 0;
        const pts = edge.pts.map((v) => {
          const p = project(v);
          zSum += p.depth;
          return p;
        });
        const avgDepth = zSum / Math.max(1, pts.length);
        const depthFactor = Math.max(
          0.45,
          Math.min(1.15, 0.8 + avgDepth * 0.25),
        );
        return {
          d: pts
            .map(
              (p, idx) =>
                `${idx === 0 ? "M" : "L"}${p.px.toFixed(1)},${p.py.toFixed(1)}`,
            )
            .join(" "),
          opacity: Math.min(0.85, edge.opacity * depthFactor),
          width: edge.width ?? 0.9,
          dashed: edge.dashed,
          tint: edge.tint ?? "#e2e8f0",
        };
      }),
    [project],
  );

  const projectedSensors = useMemo(() => {
    const list = sensorCoords.map(({ sensor, pos }) => {
      const p = project(pos);
      return {
        sensor,
        px: p.px,
        py: p.py,
        depth: p.depth,
        color: sensorTempColor(sensor),
      };
    });
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }, [sensorCoords, project]);

  const activeSensor = useMemo(() => {
    if (!projectedSensors.length) return null;
    if (hoveredName) {
      const match = projectedSensors.find((p) => p.sensor.name === hoveredName);
      if (match) return match;
    }
    return (
      projectedSensors.find((p) => p.sensor.name === sensors[0]?.name) ??
      projectedSensors[projectedSensors.length - 1]
    );
  }, [projectedSensors, hoveredName, sensors]);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div
        onPointerDown={(e) => {
          if ((e.target as Element).closest("button")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = {
            active: true,
            x: e.clientX,
            y: e.clientY,
            yaw: rot.yaw,
            pitch: rot.pitch,
          };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          setRot({
            yaw: dragRef.current.yaw + dx * 0.55,
            pitch: Math.max(
              -75,
              Math.min(75, dragRef.current.pitch - dy * 0.45),
            ),
          });
        }}
        onPointerUp={(e) => {
          if (dragRef.current.active) {
            dragRef.current.active = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* noop */
            }
          }
        }}
        onPointerCancel={() => {
          dragRef.current.active = false;
        }}
        className="bg-background/60 relative min-h-[410px] w-full flex-1 cursor-grab overflow-hidden rounded-sm border select-none active:cursor-grabbing"
      >
        {/* Top-left floating HUD for active/hovered sensor */}
        {activeSensor && (
          <div className="bg-popover/90 pointer-events-none absolute top-2.5 left-2.5 z-10 flex max-w-[205px] flex-col gap-0.5 rounded-sm border px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">
                {activeSensor.sensor.label}
              </span>
              <span
                className="font-mono font-bold tabular-nums"
                style={{ color: activeSensor.color }}
              >
                {activeSensor.sensor.currentC}°C
              </span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-[10px]">
              <span className="truncate font-mono">
                {activeSensor.sensor.name}
              </span>
              <Badge
                variant={statusBadgeVariant(activeSensor.sensor.status)}
                className="px-1 py-0 text-[9px]"
              >
                {activeSensor.sensor.status}
              </Badge>
            </div>
            {activeSensor.sensor.peakC &&
              activeSensor.sensor.peakC > activeSensor.sensor.currentC + 1 && (
                <span className="text-muted-foreground font-mono text-[10px]">
                  Peak cached: {activeSensor.sensor.peakC}°C
                </span>
              )}
          </div>
        )}

        {/* Top-right angle presets */}
        <div className="bg-popover/85 absolute top-2.5 right-2.5 z-10 flex items-center gap-0.5 rounded-sm border p-0.5 text-[10px] backdrop-blur-sm">
          {[
            { label: "Iso", yaw: -28, pitch: 14 },
            { label: "Front", yaw: 0, pitch: 0 },
            { label: "Rear", yaw: 180, pitch: 0 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setRot({ yaw: preset.yaw, pitch: preset.pitch })}
              className="hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer rounded-[2px] px-1.5 py-0.5 font-medium transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <svg viewBox="0 0 400 360" className="size-full">
          <defs>
            <radialGradient id="thermalGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="225" cy="180" r="150" fill="url(#thermalGlow)" />

          {/* Transparent 3D wireframe chassis & internal subsystems */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {projectedEdges.map((edge, idx) => (
              <path
                key={idx}
                d={edge.d}
                stroke={edge.tint}
                strokeOpacity={edge.opacity}
                strokeWidth={edge.width}
                strokeDasharray={edge.dashed ? "3 3" : undefined}
              />
            ))}
          </g>

          {/* Leader line from active sensor to HUD corner */}
          {activeSensor && (
            <line
              x1={activeSensor.px}
              y1={activeSensor.py}
              x2={125}
              y2={62}
              stroke={activeSensor.color}
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}

          {/* Depth-sorted thermal sensor vertices */}
          {projectedSensors.map((pt) => {
            const isActive = activeSensor?.sensor.name === pt.sensor.name;
            const depthOpacity = Math.max(
              0.42,
              Math.min(1, 0.78 + pt.depth * 0.28),
            );
            const r = isActive ? 5.2 : 3.6;
            return (
              <g
                key={pt.sensor.name}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredName(pt.sensor.name)}
                onClick={() => setHoveredName(pt.sensor.name)}
              >
                {isActive && (
                  <>
                    <circle
                      cx={pt.px}
                      cy={pt.py}
                      r={11}
                      fill={pt.color}
                      fillOpacity={0.14}
                    />
                    <circle
                      cx={pt.px}
                      cy={pt.py}
                      r={8.5}
                      fill="none"
                      stroke={pt.color}
                      strokeOpacity={0.85}
                      strokeWidth={1.1}
                    />
                  </>
                )}
                <circle
                  cx={pt.px}
                  cy={pt.py}
                  r={r}
                  fill={pt.color}
                  fillOpacity={isActive ? 1 : depthOpacity}
                  stroke="#121215"
                  strokeWidth={1.1}
                />
                <circle cx={pt.px} cy={pt.py} r={12} fill="transparent" />
              </g>
            );
          })}
        </svg>

        <span className="text-muted-foreground pointer-events-none absolute right-2.5 bottom-2 text-[10px]">
          Drag to rotate · Hover point
        </span>
      </div>

      {/* Synced quick sensor strip */}
      <div className="flex flex-wrap gap-1.5">
        {sensors.map((s) => {
          const isActive = activeSensor?.sensor.name === s.name;
          const color = sensorTempColor(s);
          return (
            <button
              key={s.name}
              type="button"
              onMouseEnter={() => setHoveredName(s.name)}
              onClick={() => setHoveredName(s.name)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border px-2 py-0.5 text-[11px] transition-colors ${
                isActive
                  ? "bg-accent border-foreground/30 text-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="max-w-[105px] truncate">{s.label}</span>
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {s.currentC}°
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

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
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const hasDaily = dailyStats.length >= 2;
  const activeWindow = timeWindow === "14d" && !hasDaily ? "all" : timeWindow;
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

  const hourlyContent = (
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
                Volt <strong>{(activePoint.voltMv / 1000).toFixed(2)}V</strong>
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
            : `${chartSeries.length} samples · Drag across charts or scrub below`}
        </CardDescription>
        <CardAction>
          <Tabs
            value={activeWindow}
            onValueChange={(v) => {
              setTimeWindow(v as TimeWindow);
              setScrubIdx(null);
            }}
          >
            <TabsList className="w-full sm:w-auto">
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
              {hasDaily && (
                <TabsTrigger value="14d" className="flex-1 sm:flex-initial">
                  {dailyStats.length}d
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </CardAction>
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
                <span className="bg-card text-foreground inline-flex h-8 max-w-[165px] items-center gap-1.5 rounded-sm border px-3 text-xs font-medium sm:max-w-none">
                  <MobileBold
                    size={14}
                    color="currentColor"
                    className="shrink-0"
                  />
                  <span className="truncate">{report.device.model}</span>
                </span>
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
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
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
                      tooltip="Health verdict based on remaining capacity vs 80% replacement threshold."
                      className="rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                    >
                      {report.health.verdict === "Unknown"
                        ? "Estimated"
                        : report.health.verdict}
                    </BentoPill>
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
                        : report.health.learnedMah !== null
                          ? `${report.health.learnedMah}`
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
                          ? report.health.healthPct >= 85
                            ? `Still holding ${report.health.healthPct}% of original juice. Not pregnant yet, just middle-aged.`
                            : report.health.healthPct >= 80
                              ? `Hovering near the 80% replacement cliff (${report.health.lostMah} mAh gone).`
                              : `Below 80% capacity (${report.health.lostMah} mAh gone). Time to stop pretending it's fine.`
                          : `Design capacity wasn't exposed by this device's HAL.`}
                      </p>
                      <div className="flex flex-wrap justify-between gap-1 text-[11px] opacity-80">
                        <span>Tech: {report.health.technology}</span>
                        {report.thermals.bcl.heavyCount > 0 ? (
                          <span>
                            {report.thermals.bcl.heavyCount} heavy voltage
                            droops
                          </span>
                        ) : (
                          <span>
                            Born: {report.health.manufacturedDate ?? "Unknown"}
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
                      tooltip="Live charging or discharging state at the moment the bugreport was captured."
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
                    <BentoPill
                      tooltip="Live cell voltage. Full lithium cells sit around 4.2V–4.4V; empty around 3.3V."
                      className="-rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                    >
                      {(report.health.voltageMv / 1000).toFixed(2)}V
                    </BentoPill>
                    <BentoPill
                      tooltip="Android charging policy. LONG LIFE throttles speed or max charge to slow aging."
                      className="rotate-2 hidden px-1.5 text-[10px] sm:inline-flex sm:px-2 sm:text-[11px]"
                    >
                      {report.health.chargingPolicy.replace(/_/g, " ")}
                    </BentoPill>
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
                        : `${report.health.levelPct}%`}
                    </span>
                  </div>
                  <ExpandPanel open={expandedCards.cycles}>
                    <div className="mx-3 flex flex-col gap-2 border-t border-black/15 pt-2.5 text-xs sm:mx-4">
                      {report.health.cycleCount !== null && (
                        <div className="h-2 w-full overflow-hidden rounded-[2px] bg-black/15">
                          <div
                            className="h-full bg-[#520a5e]"
                            style={{
                              width: `${Math.min(100, Math.round((report.health.cycleCount / 800) * 100))}%`,
                            }}
                          />
                        </div>
                      )}
                      <p className="leading-snug opacity-90">
                        {report.health.cycleCount !== null
                          ? report.health.cycleCount > 800
                            ? `${report.health.cycleCount} full cycles logged — officially past the typical 800-cycle rating.`
                            : `${report.health.cycleCount} of ~800 typical rated cycles used.`
                          : `Cycle count wasn't exposed by this device's fuel gauge.`}
                        {liveWatts ? ` Pulling ${liveWatts}W right now.` : ""}
                      </p>
                      <div className="flex flex-wrap justify-between gap-1 text-[11px] opacity-80">
                        <span>Level: {report.health.levelPct}%</span>
                        <span>Policy: {report.health.chargingPolicy}</span>
                      </div>
                    </div>
                  </ExpandPanel>
                </Card>

                {/* 3. Mint: Thermal Headroom */}
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
                        tooltip="Peak CPU silicon temperature cached by Android thermalservice."
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
                  </div>
                  <div className="flex items-end justify-between px-3 sm:px-4">
                    <span className="text-[10px] font-medium opacity-70">
                      {expandedCards.thermals
                        ? "Hide zones"
                        : "Tap for details"}
                    </span>
                    <span className="font-heading text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl">
                      {report.thermals.skinTempC}°
                    </span>
                  </div>
                  <ExpandPanel open={expandedCards.thermals}>
                    <div className="mx-3 flex flex-col gap-1.5 border-t border-black/15 pt-2.5 text-xs sm:mx-4">
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
                    </div>
                  </ExpandPanel>
                </Card>

                {/* 4. Lavender: Standby Drain */}
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
                    <BentoPill
                      tooltip="Total battery capacity burned while the screen was completely off."
                      className="-rotate-2 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                    >
                      {report.drain.screenOffDischargeMah} mAh off
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
                      tooltip="Percent of screen-off time the CPU stayed awake instead of deep sleeping."
                      className="rotate-1 px-1.5 text-[10px] sm:px-2 sm:text-[11px]"
                    >
                      {report.drain.awakeWhileScreenOffPct}% awake
                    </BentoPill>
                    <BentoPill
                      tooltip="Total duration background apps held partial CPU wakelocks."
                      className="-rotate-1 hidden px-1.5 text-[10px] sm:inline-flex sm:px-2 sm:text-[11px]"
                    >
                      {formatDurationShort(report.drain.partialWakelockMs)} lock
                    </BentoPill>
                    {report.drain.screenOffPctPerHr === null && (
                      <BentoPill
                        tooltip="Hourly drain rate when the display is actively turned on."
                        className="rotate-2 hidden px-1.5 text-[10px] sm:inline-flex sm:px-2 sm:text-[11px]"
                      >
                        {report.drain.activeRateMahPerHr} active/hr
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
                      {report.drain.idleRateMahPerHr}
                    </span>
                  </div>
                  <ExpandPanel open={expandedCards.standby}>
                    <div className="mx-3 flex flex-col gap-2 border-t border-black/15 pt-2.5 text-xs sm:mx-4">
                      <div className="h-2 w-full overflow-hidden rounded-[2px] bg-black/15">
                        <div
                          className="h-full bg-[#1f1c63]"
                          style={{
                            width: `${report.drain.awakeWhileScreenOffPct}%`,
                          }}
                        />
                      </div>
                      <p className="leading-snug opacity-90">
                        {report.drain.awakeWhileScreenOffPct >= 50
                          ? `Insomnia alert: apps kept the CPU awake ${report.drain.awakeWhileScreenOffPct}% of the time your screen was off.`
                          : `Healthy sleep ratio: only ${report.drain.awakeWhileScreenOffPct}% awake during idle hours.`}
                      </p>
                      <div className="flex flex-wrap justify-between gap-1 text-[11px] opacity-80">
                        <span>
                          Deep doze drain: {report.drain.deepDozeDischargeMah}{" "}
                          mAh
                        </span>
                        <span>
                          Wakelocks:{" "}
                          {formatDurationShort(report.drain.partialWakelockMs)}
                        </span>
                      </div>
                    </div>
                  </ExpandPanel>
                </Card>
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
                        {activeSlice !== null && donutData[activeSlice]
                          ? `${donutData[activeSlice].name}: ${donutData[activeSlice].pct}% (${donutData[activeSlice].detail})`
                          : "Top consumers (mAh) · Tap or hover to highlight"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
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
                                    activeSlice === null || activeSlice === idx
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
                            Off: {formatDurationShort(report.drain.screenOffMs)}
                          </span>
                        </div>
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
                            {report.drain.wifiDrainMah > 0
                              ? "Radio & Signal Cost"
                              : "Thermal Snapshot"}
                          </span>
                          {report.drain.wifiDrainMah > 0 ? (
                            <WifiBold size={18} color="#8f290c" />
                          ) : (
                            <DangerBold size={18} color="#8f290c" />
                          )}
                        </CardDescription>
                        <CardTitle className="text-lg text-[#5c1908]">
                          {report.drain.wifiDrainMah > 0
                            ? `${report.drain.wifiDrainMah} mAh Wi-Fi Drain`
                            : report.thermals.preRebootTempC
                              ? `Peak ${report.thermals.preRebootTempC}°C Pre-Reboot`
                              : `${report.thermals.sensors.length} Thermal Sensors`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2 text-xs font-medium text-[#5c1908]/90">
                        <div>
                          {report.drain.wifiDrainMah > 0
                            ? `Sent ${report.drain.wifiTxGb} · Received ${report.drain.wifiRxMb} · ${report.drain.wifiPoorSignalPct}% on weak signal`
                            : `Manufactured ${report.health.manufacturedDate ?? "date N/A"} · ${report.health.technology}`}
                        </div>
                        <ExpandPanel open={expandedCards.radio}>
                          <div className="flex flex-col gap-1.5 border-t border-black/15 pt-2 text-[11px] font-normal">
                            {report.drain.wifiDrainMah > 0 && (
                              <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-black/15">
                                <div
                                  className="h-full bg-[#5c1908]"
                                  style={{
                                    width: `${report.drain.wifiPoorSignalPct}%`,
                                  }}
                                />
                              </div>
                            )}
                            <p>
                              {report.drain.wifiPoorSignalPct > 50
                                ? `Your phone spent ${report.drain.wifiPoorSignalPct}% of the time screaming at a distant router. Move closer or blame your ISP.`
                                : `Dump captured ${report.device.dumpTime} with ${report.thermals.sensors.length} active thermal sensors.`}
                            </p>
                          </div>
                        </ExpandPanel>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Synchronized Battery & Thermal Timelines */}
                <TimelineSection
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
                                          ? formatDurationShort(item.wakelockMs)
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
                                                ? "System Process"
                                                : "Android App"}
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
                      </TabsContent>

                      <TabsContent value="hardware">
                        {report.drain.unattributedTotalMah >= 50 && (
                          <div className="text-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span>
                              App-attributed vs unattributed system/radio drain
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
                                  report.drain.globalSubsystems[0]?.mah || 1,
                                );
                                const pct = Math.max(
                                  3,
                                  Math.round((sub.mah / maxMah) * 100),
                                );
                                const hasUnattrib = sub.unattributedMah >= 5;
                                const unattribFrac = hasUnattrib
                                  ? Math.min(
                                      100,
                                      Math.round(
                                        (sub.unattributedMah / sub.mah) * 100,
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
                                          style={{ width: `${attribFrac}%` }}
                                        />
                                      )}
                                      <div
                                        className="h-full bg-chart-2"
                                        style={{ width: `${unattribFrac}%` }}
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
                        text="Sensors discovered from the device thermal HAL mapped across the 3D chassis on desktop or listed by throttling severity."
                      />
                    </CardTitle>
                    <CardDescription>
                      {report.thermals.sensors.length} active sensors in dump
                      snapshot
                    </CardDescription>
                    <CardAction className="hidden md:block">
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
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    {thermalView === "3d" && (
                      <div className="hidden md:flex md:flex-1 md:flex-col">
                        <ThermalPhone3D sensors={report.thermals.sensors} />
                      </div>
                    )}
                    <div
                      className={`${thermalView === "3d" ? "md:hidden " : ""}max-h-[560px] overflow-y-auto rounded-sm border`}
                    >
                      <Table>
                        <TableHeader className="bg-card/95 sticky top-0 z-10 backdrop-blur-xs">
                          <TableRow>
                            <TableHead>Sensor</TableHead>
                            <TableHead className="text-right">Temp</TableHead>
                            <TableHead className="text-right">Status</TableHead>
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
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>

        {/* dbrand-style Footer */}
        <footer className="bg-card/60 border-t sm:bg-background/90 sm:sticky sm:bottom-0 sm:z-20 sm:backdrop-blur-sm">
          <div className="flex w-full flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-xs">
              <CpuChargeBold size={18} color="#f8fafc" className="shrink-0" />
              <span className="font-heading font-bold tracking-wide">
                pregnantBattery by sanszerif
              </span>
              <span className="text-muted-foreground hidden md:inline">
                · Zero servers. Zero telemetry. Built because buying a new phone
                for a tired battery is a scam.
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
                    : `${report.health.levelPct}%`}{" "}
                  · {report.thermals.skinTempC}°C skin
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
