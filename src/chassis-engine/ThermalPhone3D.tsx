import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

export interface HudBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LeaderPathResult {
  d: string;
  endX: number;
  endY: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes a smooth cubic Bezier leader path connecting a projected 3D anchor in
 * stage-pixel coordinates directly onto the active HUD card border with zero gap.
 */
export function computeHudLeaderPath(
  anchor: { x: number; y: number },
  hud: HudBox,
): LeaderPathResult | null {
  const { x: ax, y: ay } = anchor;
  if (
    ax >= hud.left - 6 &&
    ax <= hud.right + 6 &&
    ay >= hud.top - 6 &&
    ay <= hud.bottom + 6
  ) {
    return null;
  }

  const padX = Math.min(16, Math.max(0, (hud.right - hud.left) / 4));
  const padY = Math.min(16, Math.max(0, (hud.bottom - hud.top) / 4));

  if (ay > hud.bottom + 4) {
    const endX = clamp(ax, hud.left + padX, hud.right - padX);
    const endY = hud.bottom;
    const dy = Math.max(18, (ay - endY) * 0.45);
    const d = `M${ax.toFixed(1)},${ay.toFixed(1)} C${ax.toFixed(1)},${(ay - dy).toFixed(1)} ${endX.toFixed(1)},${(endY + dy).toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;
    return { d, endX, endY };
  }

  if (ax > hud.right + 4) {
    const endX = hud.right;
    const endY = clamp(ay, hud.top + padY, hud.bottom - padY);
    const dx = Math.max(18, (ax - endX) * 0.45);
    const d = `M${ax.toFixed(1)},${ay.toFixed(1)} C${(ax - dx).toFixed(1)},${ay.toFixed(1)} ${(endX + dx).toFixed(1)},${endY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;
    return { d, endX, endY };
  }

  if (ax < hud.left - 4) {
    const endX = hud.left;
    const endY = clamp(ay, hud.top + padY, hud.bottom - padY);
    const dx = Math.max(18, (endX - ax) * 0.45);
    const d = `M${ax.toFixed(1)},${ay.toFixed(1)} C${(ax + dx).toFixed(1)},${ay.toFixed(1)} ${(endX - dx).toFixed(1)},${endY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;
    return { d, endX, endY };
  }

  const endX = clamp(ax, hud.left + padX, hud.right - padX);
  const endY = hud.top;
  const dy = Math.max(18, (endY - ay) * 0.45);
  const d = `M${ax.toFixed(1)},${ay.toFixed(1)} C${ax.toFixed(1)},${(ay + dy).toFixed(1)} ${endX.toFixed(1)},${(endY - dy).toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;
  return { d, endX, endY };
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

interface StageMetrics {
  hud: HudBox;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  isStacked: boolean;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
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
  const rotRef = useRef(rot);
  const [selectedCat, setSelectedCat] = useState<UiCategoryId | null>(null);
  const [stageMetrics, setStageMetrics] = useState<StageMetrics | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const velRef = useRef<{ vyaw: number; vpitch: number }>({
    vyaw: 0,
    vpitch: 0,
  });
  const dragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    lastX: number;
    lastY: number;
    lastTime: number;
  }>({
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  });

  const commitRot = useCallback((next: { yaw: number; pitch: number }) => {
    rotRef.current = next;
    setRot(next);
  }, []);

  const cancelMotion = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelMotion(), [cancelMotion]);

  const animatePreset = useCallback(
    (targetYaw: number, targetPitch: number) => {
      cancelMotion();
      velRef.current = { vyaw: 0, vpitch: 0 };
      if (prefersReducedMotion()) {
        commitRot({ yaw: targetYaw, pitch: targetPitch });
        return;
      }
      const startYaw = rotRef.current.yaw;
      const startPitch = rotRef.current.pitch;
      const deltaYaw =
        ((((targetYaw - startYaw + 180) % 360) + 360) % 360) - 180;
      const deltaPitch = targetPitch - startPitch;
      const startTime = performance.now();
      const duration = 340;
      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        commitRot({
          yaw: startYaw + deltaYaw * ease,
          pitch: startPitch + deltaPitch * ease,
        });
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [cancelMotion, commitRot],
  );

  const finishDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        !dragRef.current.active ||
        dragRef.current.pointerId !== e.pointerId
      ) {
        return;
      }
      const pausedMs = performance.now() - dragRef.current.lastTime;
      dragRef.current.active = false;
      dragRef.current.pointerId = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }

      if (pausedMs > 65 || prefersReducedMotion()) {
        velRef.current = { vyaw: 0, vpitch: 0 };
        return;
      }
      if (Math.hypot(velRef.current.vyaw, velRef.current.vpitch) <= 0.015) {
        velRef.current = { vyaw: 0, vpitch: 0 };
        return;
      }

      let prevTime = performance.now();
      const stepInertia = (now: number) => {
        const dt = Math.max(1, Math.min(48, now - prevTime));
        prevTime = now;
        const decay = Math.pow(0.92, dt / 16.67);
        const v = velRef.current;
        const cur = rotRef.current;
        const nextPitchRaw = cur.pitch + v.vpitch * dt;
        const clampedPitch = Math.max(-75, Math.min(75, nextPitchRaw));
        commitRot({
          yaw: cur.yaw + v.vyaw * dt,
          pitch: clampedPitch,
        });
        const nextVyaw = v.vyaw * decay;
        const nextVpitch = nextPitchRaw !== clampedPitch ? 0 : v.vpitch * decay;
        velRef.current = { vyaw: nextVyaw, vpitch: nextVpitch };
        if (Math.hypot(nextVyaw, nextVpitch) >= 0.008) {
          rafRef.current = requestAnimationFrame(stepInertia);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(stepInertia);
    },
    [commitRot],
  );

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

  const measureStage = useCallback(() => {
    const stageEl = stageRef.current;
    const hudEl = hudRef.current;
    const svgEl = svgRef.current;
    if (!stageEl || !hudEl || !svgEl) {
      setStageMetrics(null);
      return;
    }
    const ctm = svgEl.getScreenCTM?.();
    if (!ctm || ctm.a <= 0 || ctm.d <= 0) {
      setStageMetrics(null);
      return;
    }
    const stageRect = stageEl.getBoundingClientRect();
    const hudRect = hudEl.getBoundingClientRect();
    if (stageRect.width <= 0 || hudRect.width <= 0) {
      setStageMetrics(null);
      return;
    }
    const isStacked =
      typeof window !== "undefined" &&
      window.getComputedStyle(hudEl).position !== "absolute";
    setStageMetrics({
      hud: {
        left: hudRect.left - stageRect.left,
        right: hudRect.right - stageRect.left,
        top: hudRect.top - stageRect.top,
        bottom: hudRect.bottom - stageRect.top,
      },
      scaleX: ctm.a,
      scaleY: ctm.d,
      offsetX: ctm.e - stageRect.left,
      offsetY: ctm.f - stageRect.top,
      isStacked,
    });
  }, []);

  useLayoutEffect(() => {
    measureStage();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureStage());
    if (stageRef.current) ro.observe(stageRef.current);
    if (hudRef.current) ro.observe(hudRef.current);
    if (svgRef.current) ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, [
    measureStage,
    activeCategory?.id,
    activeCategory?.sensors.length,
    chassis.foldable,
  ]);

  const isStacked = stageMetrics?.isStacked ?? false;

  const project = useMemo(() => {
    const yawRad = (rot.yaw * Math.PI) / 180;
    const pitchRad = (rot.pitch * Math.PI) / 180;
    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);
    const camDist = 9.0;
    const scale = chassis.foldable ? 68 : 76;
    const cx = isStacked ? 200 : 225;
    const cy = isStacked ? 174 : 180;

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
  }, [rot, chassis.foldable, isStacked]);

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

  const leaderPath = useMemo(() => {
    if (!activeAnchor || !stageMetrics) return null;
    const ax = activeAnchor.px * stageMetrics.scaleX + stageMetrics.offsetX;
    const ay = activeAnchor.py * stageMetrics.scaleY + stageMetrics.offsetY;
    return computeHudLeaderPath({ x: ax, y: ay }, stageMetrics.hud);
  }, [activeAnchor, stageMetrics]);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div
        ref={stageRef}
        className="bg-background/60 relative flex w-full flex-col overflow-hidden rounded-sm border select-none sm:min-h-[400px] sm:flex-1"
      >
        {/* Stacked header HUD on mobile (< sm), floating top-left overlay on sm+ */}
        {activeCategory && (
          <div
            ref={hudRef}
            data-testid="thermal-hud-card"
            className="bg-popover/90 pointer-events-none relative z-20 m-2 mb-0 flex flex-col gap-1 rounded-sm border px-2.5 py-2 text-xs shadow-lg backdrop-blur-sm sm:absolute sm:top-2.5 sm:left-2.5 sm:m-0 sm:w-[198px]"
          >
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

        {/* Smooth DOM-measured pixel overlay connecting active anchor to HUD border */}
        {leaderPath && activeAnchor && (
          <svg
            data-testid="thermal-leader-overlay"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[15] size-full overflow-visible"
          >
            <path
              d={leaderPath.d}
              fill="none"
              stroke={activeAnchor.cat.color}
              strokeOpacity={0.72}
              strokeWidth={1.25}
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
            <circle
              cx={leaderPath.endX}
              cy={leaderPath.endY}
              r={2.8}
              fill={activeAnchor.cat.color}
              stroke="#121215"
              strokeWidth={1}
            />
          </svg>
        )}

        <div
          onPointerDown={(e) => {
            if ((e.target as Element).closest("button")) return;
            cancelMotion();
            e.currentTarget.setPointerCapture(e.pointerId);
            velRef.current = { vyaw: 0, vpitch: 0 };
            dragRef.current = {
              active: true,
              pointerId: e.pointerId,
              lastX: e.clientX,
              lastY: e.clientY,
              lastTime: performance.now(),
            };
          }}
          onPointerMove={(e) => {
            if (
              !dragRef.current.active ||
              dragRef.current.pointerId !== e.pointerId
            ) {
              return;
            }
            const now = performance.now();
            const dx = e.clientX - dragRef.current.lastX;
            const dy = e.clientY - dragRef.current.lastY;
            const dt = Math.max(4, now - dragRef.current.lastTime);
            const dyaw = dx * 0.55;
            const dpitch = -dy * 0.45;
            const cur = rotRef.current;
            commitRot({
              yaw: cur.yaw + dyaw,
              pitch: Math.max(-75, Math.min(75, cur.pitch + dpitch)),
            });
            const instVyaw = clamp(dyaw / dt, -2.2, 2.2);
            const instVpitch = clamp(dpitch / dt, -1.6, 1.6);
            velRef.current = {
              vyaw: velRef.current.vyaw * 0.45 + instVyaw * 0.55,
              vpitch: velRef.current.vpitch * 0.45 + instVpitch * 0.55,
            };
            dragRef.current.lastX = e.clientX;
            dragRef.current.lastY = e.clientY;
            dragRef.current.lastTime = now;
          }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          className="relative h-[285px] w-full shrink-0 touch-none cursor-grab active:cursor-grabbing sm:h-auto sm:min-h-[400px] sm:flex-1"
        >
          {/* Angle presets: bottom-left on mobile, top-right on desktop */}
          <div className="bg-popover/85 absolute bottom-2 left-2 z-20 flex items-center gap-0.5 rounded-sm border p-0.5 text-[10px] backdrop-blur-sm sm:top-2.5 sm:right-2.5 sm:bottom-auto sm:left-auto">
            {[
              { label: "Iso", yaw: -152, pitch: 12 },
              { label: "Back", yaw: 180, pitch: 0 },
              { label: "Front", yaw: 0, pitch: 0 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => animatePreset(preset.yaw, preset.pitch)}
                className="hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer rounded-[2px] px-1.5 py-0.5 font-medium transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <svg ref={svgRef} viewBox="0 0 400 360" className="size-full">
            <defs>
              <radialGradient id="thermalGlow" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor={activeCategory?.color ?? "var(--chart-2)"}
                  stopOpacity="0.11"
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-2)"
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>
            <circle
              cx={isStacked ? 200 : 225}
              cy={isStacked ? 174 : 180}
              r="150"
              fill="url(#thermalGlow)"
            />

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
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setSelectedCat(pt.cat.id);
                  }}
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

          <span
            data-testid="thermal-chassis-label"
            className="text-muted-foreground pointer-events-none absolute right-2 bottom-2.5 max-w-[44%] truncate text-[10px] sm:right-2.5 sm:bottom-2 sm:max-w-none"
          >
            <span>{chassis.label}</span>
            <span className="hidden sm:inline"> · Drag to rotate</span>
          </span>
        </div>
      </div>

      {/* Category-grouped thermal section selector */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const isActive = activeCategory?.id === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setSelectedCat(cat.id);
              }}
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
