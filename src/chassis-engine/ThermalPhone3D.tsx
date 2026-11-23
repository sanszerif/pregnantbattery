import React, { useMemo, useRef, useState } from "react";
import { Badge } from "../ui";
import { buildChassisEdges } from "./geometry";
import type {
  ChassisSpec,
  ThermalCategory,
  ThermalSection,
  Vec3,
} from "./types";

export interface RenderThermalSensor {
  name: string;
  label: string;
  type: string;
  section: ThermalCategory;
  isVirtual: boolean;
  currentC: number;
  peakC: number | null;
  status: string;
}

type UiCategoryId =
  | "cpu"
  | "gpu"
  | "battery"
  | "charging"
  | "display"
  | "radio"
  | "speaker"
  | "body";

const CATEGORY_META: Record<
  UiCategoryId,
  { label: string; anchor: Vec3; sections: ThermalSection[] }
> = {
  cpu: {
    label: "CPU / SoC",
    anchor: [-0.06, -0.98, 0.04],
    sections: ["cpu"],
  },
  gpu: {
    label: "GPU / NPU",
    anchor: [0.31, -0.9, 0.04],
    sections: ["gpu"],
  },
  battery: {
    label: "Battery",
    anchor: [-0.14, 0.56, 0],
    sections: ["battery"],
  },
  charging: {
    label: "Charging",
    anchor: [0, 1.9, 0],
    sections: ["coil", "usb"],
  },
  display: {
    label: "Display",
    anchor: [0.22, -0.1, 0.14],
    sections: ["display"],
  },
  radio: {
    label: "Radio / RF",
    anchor: [0.64, -1.64, 0],
    sections: ["radio"],
  },
  speaker: {
    label: "Speaker",
    anchor: [0.56, 1.78, 0],
    sections: ["speaker"],
  },
  body: {
    label: "Chassis / Skin",
    anchor: [0.74, 0.12, -0.14],
    sections: [],
  },
};

const CATEGORY_ORDER: UiCategoryId[] = [
  "cpu",
  "gpu",
  "battery",
  "charging",
  "display",
  "radio",
  "speaker",
  "body",
];

function toUiCategory(section: ThermalCategory): UiCategoryId {
  if (section === "coil" || section === "usb") return "charging";
  return section;
}

const THROTTLE_RANK: Record<string, number> = {
  SHUTDOWN: 6,
  EMERGENCY: 5,
  CRITICAL: 4,
  SEVERE: 3,
  MODERATE: 2,
  LIGHT: 1,
  NONE: 0,
};

export function tempSeverityColor(currentC: number, status: string): string {
  if (
    status === "SEVERE" ||
    status === "CRITICAL" ||
    status === "EMERGENCY" ||
    status === "SHUTDOWN" ||
    currentC >= 65
  ) {
    return "#ff7a6b";
  }
  if (status === "MODERATE" || status === "LIGHT" || currentC >= 45) {
    return "#ff9b7b";
  }
  if (currentC >= 38) return "#e6c84f";
  return "#72c2a4";
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

interface CategorySummary {
  id: UiCategoryId;
  label: string;
  anchor: Vec3;
  sensors: RenderThermalSensor[];
  peakSensor: RenderThermalSensor;
  peakCurrentC: number;
  worstStatus: string;
  color: string;
}

export const ThermalPhone3D = React.memo(function ThermalPhone3D({
  sensors,
  chassis,
}: {
  sensors: RenderThermalSensor[];
  chassis: ChassisSpec;
}) {
  const [rot, setRot] = useState<{ yaw: number; pitch: number }>({
    yaw: -152,
    pitch: 12,
  });
  const [selectedCat, setSelectedCat] = useState<UiCategoryId | null>(null);
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
    yaw: -152,
    pitch: 12,
  });

  const wireEdges = useMemo(() => buildChassisEdges(chassis), [chassis]);

  const { categories, sectionColorMap } = useMemo(() => {
    const grouped = new Map<UiCategoryId, RenderThermalSensor[]>();
    const secBuckets = new Map<ThermalSection, RenderThermalSensor[]>();

    for (const s of sensors) {
      const cat = toUiCategory(s.section);
      const list = grouped.get(cat) ?? [];
      list.push(s);
      grouped.set(cat, list);

      if (s.section !== "body") {
        const slist = secBuckets.get(s.section) ?? [];
        slist.push(s);
        secBuckets.set(s.section, slist);
      }
    }

    const summaries: CategorySummary[] = [];
    for (const id of CATEGORY_ORDER) {
      const list = grouped.get(id);
      if (!list?.length) continue;
      const sorted = [...list].sort((a, b) => {
        const rd =
          (THROTTLE_RANK[b.status] ?? 0) - (THROTTLE_RANK[a.status] ?? 0);
        return rd !== 0 ? rd : b.currentC - a.currentC;
      });
      const peakSensor = sorted[0];
      const maxC = Math.max(...sorted.map((s) => s.currentC));
      const worstStatus = sorted.reduce(
        (best, cur) =>
          (THROTTLE_RANK[cur.status] ?? 0) > (THROTTLE_RANK[best] ?? 0)
            ? cur.status
            : best,
        "NONE",
      );
      summaries.push({
        id,
        label: CATEGORY_META[id].label,
        anchor: CATEGORY_META[id].anchor,
        sensors: sorted,
        peakSensor,
        peakCurrentC: Math.round(maxC * 10) / 10,
        worstStatus,
        color: tempSeverityColor(maxC, worstStatus),
      });
    }

    // Individual wireframe section heatmap colors (excluding outer body)
    const secColors = new Map<
      ThermalSection,
      { color: string; hot: boolean }
    >();
    for (const [sec, slist] of secBuckets.entries()) {
      const maxC = Math.max(...slist.map((s) => s.currentC));
      const worstStatus = slist.reduce(
        (best, cur) =>
          (THROTTLE_RANK[cur.status] ?? 0) > (THROTTLE_RANK[best] ?? 0)
            ? cur.status
            : best,
        "NONE",
      );
      secColors.set(sec, {
        color: tempSeverityColor(maxC, worstStatus),
        hot: (THROTTLE_RANK[worstStatus] ?? 0) > 0 || maxC >= 40,
      });
    }
    // Share charging color between coil and usb when only one has readings
    const chgSummary = summaries.find((c) => c.id === "charging");
    if (chgSummary) {
      const chgHot =
        (THROTTLE_RANK[chgSummary.worstStatus] ?? 0) > 0 ||
        chgSummary.peakCurrentC >= 40;
      if (!secColors.has("coil"))
        secColors.set("coil", { color: chgSummary.color, hot: chgHot });
      if (!secColors.has("usb"))
        secColors.set("usb", { color: chgSummary.color, hot: chgHot });
    }

    return { categories: summaries, sectionColorMap: secColors };
  }, [sensors]);

  const activeCategory = useMemo(() => {
    if (!categories.length) return null;
    if (selectedCat) {
      const match = categories.find((c) => c.id === selectedCat);
      if (match) return match;
    }
    return categories.find((c) => c.id !== "body") ?? categories[0];
  }, [categories, selectedCat]);

  const project = useMemo(() => {
    const yawRad = (rot.yaw * Math.PI) / 180;
    const pitchRad = (rot.pitch * Math.PI) / 180;
    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);
    const camDist = 9.0;
    const scale = chassis.foldable ? 68 : 76;
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
  }, [rot, chassis.foldable]);

  const activeSectionsSet = useMemo(() => {
    if (!activeCategory) return new Set<ThermalSection>();
    return new Set(CATEGORY_META[activeCategory.id].sections);
  }, [activeCategory]);

  const projectedEdges = useMemo(
    () =>
      wireEdges.map((edge) => {
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
        const secHeat = edge.section
          ? sectionColorMap.get(edge.section)
          : undefined;
        const isHighlighted = edge.section
          ? activeSectionsSet.has(edge.section)
          : false;

        const baseOpacity = secHeat
          ? isHighlighted
            ? Math.max(0.82, edge.opacity + 0.45)
            : secHeat.hot
              ? Math.max(0.58, edge.opacity + 0.22)
              : Math.max(0.42, edge.opacity + 0.1)
          : edge.opacity;

        return {
          d: pts
            .map(
              (p, idx) =>
                `${idx === 0 ? "M" : "L"}${p.px.toFixed(1)},${p.py.toFixed(1)}`,
            )
            .join(" "),
          opacity: Math.min(0.95, baseOpacity * depthFactor),
          width: isHighlighted
            ? (edge.width ?? 1.0) + 0.55
            : (edge.width ?? 0.9),
          dashed: edge.dashed,
          tint: secHeat ? secHeat.color : (edge.tint ?? "#cbd5e1"),
        };
      }),
    [wireEdges, project, sectionColorMap, activeSectionsSet],
  );

  const projectedAnchors = useMemo(() => {
    const list = categories
      .filter((c) => c.id !== "body")
      .map((cat) => {
        const p = project(cat.anchor);
        return {
          cat,
          px: p.px,
          py: p.py,
          depth: p.depth,
        };
      });
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }, [categories, project]);

  const activeAnchor = activeCategory
    ? (projectedAnchors.find((a) => a.cat.id === activeCategory.id) ?? null)
    : null;

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
        className="bg-background/60 relative min-h-[400px] w-full flex-1 cursor-grab overflow-hidden rounded-sm border select-none active:cursor-grabbing"
      >
        {/* Top-left floating HUD for active hardware section */}
        {activeCategory && (
          <div className="bg-popover/90 pointer-events-none absolute top-2.5 left-2.5 z-10 flex w-[198px] flex-col gap-1 rounded-sm border px-2.5 py-2 text-xs shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">
                {activeCategory.label}
              </span>
              <span
                className="font-mono font-bold tabular-nums"
                style={{ color: activeCategory.color }}
              >
                {activeCategory.peakCurrentC}°C
              </span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-[10px]">
              <span>
                {activeCategory.sensors.length} sensor
                {activeCategory.sensors.length === 1 ? "" : "s"}
              </span>
              <Badge
                variant={statusBadgeVariant(activeCategory.worstStatus)}
                className="px-1 py-0 text-[9px]"
              >
                {activeCategory.worstStatus}
              </Badge>
            </div>
            <div className="border-border/60 mt-0.5 flex flex-col gap-0.5 border-t pt-1 text-[10px]">
              {activeCategory.sensors.slice(0, 4).map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-muted-foreground truncate">
                    {s.label}
                  </span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {s.currentC}°
                  </span>
                </div>
              ))}
              {activeCategory.sensors.length > 4 && (
                <span className="text-muted-foreground text-[9px]">
                  +{activeCategory.sensors.length - 4} more in List view
                </span>
              )}
            </div>
          </div>
        )}

        {/* Top-right angle presets */}
        <div className="bg-popover/85 absolute top-2.5 right-2.5 z-10 flex items-center gap-0.5 rounded-sm border p-0.5 text-[10px] backdrop-blur-sm">
          {[
            { label: "Iso", yaw: -152, pitch: 12 },
            { label: "Back", yaw: 180, pitch: 0 },
            { label: "Front", yaw: 0, pitch: 0 },
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
              <stop
                offset="0%"
                stopColor={activeCategory?.color ?? "var(--chart-2)"}
                stopOpacity="0.11"
              />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="225" cy="180" r="150" fill="url(#thermalGlow)" />

          {/* Section-colored 3D wireframe chassis & internal subsystems */}
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

          {/* Leader line from active internal section to HUD */}
          {activeAnchor && (
            <line
              x1={activeAnchor.px}
              y1={activeAnchor.py}
              x2={125}
              y2={74}
              stroke={activeAnchor.cat.color}
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}

          {/* One clean interactive anchor per internal hardware category */}
          {projectedAnchors.map((pt) => {
            const isActive = activeCategory?.id === pt.cat.id;
            const depthOpacity = Math.max(
              0.5,
              Math.min(1, 0.8 + pt.depth * 0.25),
            );
            return (
              <g
                key={pt.cat.id}
                className="cursor-pointer"
                onMouseEnter={() => setSelectedCat(pt.cat.id)}
                onClick={() => setSelectedCat(pt.cat.id)}
              >
                {isActive && (
                  <>
                    <circle
                      cx={pt.px}
                      cy={pt.py}
                      r={11.5}
                      fill={pt.cat.color}
                      fillOpacity={0.16}
                    />
                    <circle
                      cx={pt.px}
                      cy={pt.py}
                      r={8.5}
                      fill="none"
                      stroke={pt.cat.color}
                      strokeOpacity={0.9}
                      strokeWidth={1.15}
                    />
                  </>
                )}
                <circle
                  cx={pt.px}
                  cy={pt.py}
                  r={isActive ? 5.2 : 3.9}
                  fill={pt.cat.color}
                  fillOpacity={isActive ? 1 : depthOpacity}
                  stroke="#121215"
                  strokeWidth={1.15}
                />
                <circle cx={pt.px} cy={pt.py} r={13} fill="transparent" />
              </g>
            );
          })}
        </svg>

        <span className="text-muted-foreground pointer-events-none absolute right-2.5 bottom-2 text-[10px]">
          {chassis.label} · Drag to rotate
        </span>
      </div>

      {/* Category-grouped thermal section selector */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const isActive = activeCategory?.id === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onMouseEnter={() => setSelectedCat(cat.id)}
              onClick={() => setSelectedCat(cat.id)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border px-2 py-1 text-[11px] transition-colors ${
                isActive
                  ? "bg-accent border-foreground/30 text-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span>{cat.label}</span>
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {cat.peakCurrentC}°
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
