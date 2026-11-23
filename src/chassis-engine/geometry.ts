import type { ChassisSpec, ThermalSection, Vec3, WireEdge } from "./types";

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

function makePillLoop(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  z: number,
  vertical = false,
): Vec3[] {
  const pts: Vec3[] = [];
  const steps = 6;
  if (!vertical) {
    const r = ry;
    const straight = Math.max(0, rx - r);
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI;
      pts.push([cx + straight + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI / 2 + (i / steps) * Math.PI;
      pts.push([cx - straight + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
  } else {
    const r = rx;
    const straight = Math.max(0, ry - r);
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI + (i / steps) * Math.PI;
      pts.push([cx + Math.cos(a) * r, cy - straight + Math.sin(a) * r, z]);
    }
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI;
      pts.push([cx + Math.cos(a) * r, cy + straight + Math.sin(a) * r, z]);
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
  section?: ThermalSection,
  tint?: string,
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
      section,
      tint,
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
      section,
      tint,
    },
    {
      pts: [
        [x0, y0, z0],
        [x0, y0, z1],
      ],
      opacity: opacity * 0.85,
      dashed,
      section,
      tint,
    },
    {
      pts: [
        [x1, y0, z0],
        [x1, y0, z1],
      ],
      opacity: opacity * 0.85,
      dashed,
      section,
      tint,
    },
    {
      pts: [
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      opacity: opacity * 0.85,
      dashed,
      section,
      tint,
    },
    {
      pts: [
        [x0, y1, z0],
        [x0, y1, z1],
      ],
      opacity: opacity * 0.85,
      dashed,
      section,
      tint,
    },
  ];
}

function addCameraModule(
  edges: WireEdge[],
  spec: ChassisSpec,
  w: number,
  h: number,
  d: number,
): void {
  const zBack = -d;
  const zBump = -d - 0.055;
  const camTint = "#cbd5e1";

  switch (spec.cameraStyle) {
    case "pixel-visor-triple":
    case "pixel-visor-dual": {
      const triple = spec.cameraStyle === "pixel-visor-triple";
      edges.push(
        ...makeBoxEdges(
          -(w - 0.02),
          -h * 0.745,
          -d - 0.08,
          w - 0.02,
          -h * 0.51,
          zBack,
          0.48,
          false,
        ),
      );
      if (triple) {
        edges.push(
          {
            pts: makeCircleLoop(0.52, -h * 0.627, 0.14, zBump - 0.03, 16),
            opacity: 0.55,
            width: 1.0,
            tint: camTint,
          },
          {
            pts: makeCircleLoop(0.08, -h * 0.627, 0.13, zBump - 0.03, 16),
            opacity: 0.55,
            width: 1.0,
            tint: camTint,
          },
          {
            pts: makeCircleLoop(-0.44, -h * 0.627, 0.12, zBump - 0.03, 16),
            opacity: 0.5,
            width: 1.0,
            tint: camTint,
          },
        );
      } else {
        edges.push(
          {
            pts: makePillLoop(0.28, -h * 0.627, 0.36, 0.145, zBump - 0.03),
            opacity: 0.45,
            width: 0.95,
          },
          {
            pts: makeCircleLoop(0.46, -h * 0.627, 0.115, zBump - 0.03, 16),
            opacity: 0.55,
            width: 1.0,
            tint: camTint,
          },
          {
            pts: makeCircleLoop(0.1, -h * 0.627, 0.11, zBump - 0.03, 16),
            opacity: 0.55,
            width: 1.0,
            tint: camTint,
          },
        );
      }
      edges.push({
        pts: makeCircleLoop(-0.74, -h * 0.627, 0.055, zBump - 0.03, 12),
        opacity: 0.4,
        width: 0.85,
      });
      break;
    }

    case "pixel-pill-bar-dual":
    case "pixel-pill-bar-triple": {
      const triple = spec.cameraStyle === "pixel-pill-bar-triple";
      const cy = -h * 0.635;
      edges.push(
        {
          pts: makePillLoop(0, cy, 0.78, 0.22, zBack),
          opacity: 0.44,
          width: 1.0,
        },
        {
          pts: makePillLoop(0, cy, 0.78, 0.22, zBump - 0.025),
          opacity: 0.52,
          width: 1.05,
        },
      );
      if (triple) {
        edges.push(
          {
            pts: makeCircleLoop(0.46, cy, 0.13, zBump - 0.03, 16),
            opacity: 0.58,
            width: 1.0,
            tint: camTint,
          },
          {
            pts: makeCircleLoop(0.1, cy, 0.125, zBump - 0.03, 16),
            opacity: 0.58,
            width: 1.0,
            tint: camTint,
          },
          {
            pts: makeCircleLoop(-0.28, cy, 0.12, zBump - 0.03, 16),
            opacity: 0.55,
            width: 1.0,
            tint: camTint,
          },
        );
      } else {
        edges.push(
          {
            pts: makeCircleLoop(0.34, cy, 0.13, zBump - 0.03, 16),
            opacity: 0.58,
            width: 1.0,
            tint: camTint,
          },
          {
            pts: makeCircleLoop(-0.06, cy, 0.125, zBump - 0.03, 16),
            opacity: 0.58,
            width: 1.0,
            tint: camTint,
          },
        );
      }
      edges.push({
        pts: makeCircleLoop(-0.58, cy, 0.055, zBump - 0.03, 12),
        opacity: 0.42,
        width: 0.85,
      });
      break;
    }

    case "pixel-9a-flush-pill": {
      // Flush horizontal pill cutout top-left (rear view: +x projects left) + flash to its right
      const cx = 0.37;
      const cy = -h * 0.7;
      edges.push(
        {
          pts: makePillLoop(cx, cy, 0.34, 0.16, zBack),
          opacity: 0.52,
          width: 1.05,
        },
        {
          pts: makePillLoop(cx, cy, 0.34, 0.16, zBack - 0.018),
          opacity: 0.42,
          width: 0.95,
        },
        {
          pts: makeCircleLoop(cx + 0.165, cy, 0.115, zBack - 0.02, 16),
          opacity: 0.58,
          width: 1.0,
          tint: camTint,
        },
        {
          pts: makeCircleLoop(cx - 0.165, cy, 0.11, zBack - 0.02, 16),
          opacity: 0.58,
          width: 1.0,
          tint: camTint,
        },
        {
          pts: makeCircleLoop(-0.09, cy, 0.048, zBack - 0.01, 12),
          opacity: 0.42,
          width: 0.85,
        },
      );
      break;
    }

    case "pixel-square-corner": {
      edges.push(
        {
          pts: makeRoundedRectLoop(0.32, 0.32, 0.1, zBump).map(([x, y, z]) => [
            x + 0.52,
            y - h * 0.68,
            z,
          ]),
          opacity: 0.5,
          width: 1.0,
        },
        {
          pts: makeCircleLoop(0.64, -h * 0.74, 0.1, zBump - 0.01, 14),
          opacity: 0.55,
          width: 1.0,
          tint: camTint,
        },
        {
          pts: makeCircleLoop(0.38, -h * 0.62, 0.1, zBump - 0.01, 14),
          opacity: 0.55,
          width: 1.0,
          tint: camTint,
        },
        // Rear capacitive fingerprint dimple
        {
          pts: makeCircleLoop(0, -h * 0.3, 0.14, zBack - 0.01, 16),
          opacity: 0.32,
          width: 0.85,
        },
      );
      break;
    }

    case "pixel-fold": {
      // Hinge center seam + top-left rounded horizontal pill camera bar
      edges.push(
        {
          pts: [
            [0, -h, zBack - 0.01],
            [0, h, zBack - 0.01],
          ],
          opacity: 0.3,
          width: 0.9,
          dashed: true,
        },
        {
          pts: makePillLoop(0.56, -h * 0.66, 0.44, 0.16, zBump),
          opacity: 0.5,
          width: 1.0,
        },
        {
          pts: makeCircleLoop(0.82, -h * 0.66, 0.105, zBump - 0.01, 14),
          opacity: 0.55,
          width: 1.0,
          tint: camTint,
        },
        {
          pts: makeCircleLoop(0.56, -h * 0.66, 0.105, zBump - 0.01, 14),
          opacity: 0.55,
          width: 1.0,
          tint: camTint,
        },
        {
          pts: makeCircleLoop(0.3, -h * 0.66, 0.105, zBump - 0.01, 14),
          opacity: 0.55,
          width: 1.0,
          tint: camTint,
        },
      );
      break;
    }

    case "samsung-vertical-rings": {
      // Iconic Samsung floating vertical triple camera rings (top-left rear) + flash offset right
      const x = 0.58;
      const ys = [-h * 0.75, -h * 0.58, -h * 0.41];
      for (const y of ys) {
        edges.push(
          {
            pts: makeCircleLoop(x, y, 0.135, zBack, 18),
            opacity: 0.5,
            width: 1.0,
          },
          {
            pts: makeCircleLoop(x, y, 0.135, zBump, 18),
            opacity: 0.58,
            width: 1.05,
            tint: camTint,
          },
          {
            pts: makeCircleLoop(x, y, 0.075, zBump - 0.01, 14),
            opacity: 0.46,
            width: 0.9,
          },
        );
      }
      edges.push({
        pts: makeCircleLoop(0.3, -h * 0.665, 0.048, zBack - 0.01, 12),
        opacity: 0.42,
        width: 0.85,
      });
      break;
    }

    case "xiaomi-square-island": {
      const cx = 0.44;
      const cy = -h * 0.62;
      const island = makeRoundedRectLoop(0.36, 0.36, 0.12, zBump).map(
        ([x, y, z]) => [x + cx, y + cy, z] as Vec3,
      );
      edges.push({ pts: island, opacity: 0.52, width: 1.05 });
      for (const [dx, dy] of [
        [-0.16, -0.16],
        [0.16, -0.16],
        [-0.16, 0.16],
        [0.16, 0.16],
      ]) {
        edges.push({
          pts: makeCircleLoop(cx + dx, cy + dy, 0.1, zBump - 0.015, 14),
          opacity: 0.54,
          width: 0.95,
          tint: camTint,
        });
      }
      break;
    }

    case "honor-pill": {
      const cx = 0.54;
      const cy = -h * 0.58;
      edges.push(
        {
          pts: makePillLoop(cx, cy, 0.19, 0.44, zBump, true),
          opacity: 0.52,
          width: 1.0,
        },
        {
          pts: makeCircleLoop(cx, cy - 0.23, 0.11, zBump - 0.015, 14),
          opacity: 0.56,
          width: 1.0,
          tint: camTint,
        },
        {
          pts: makeCircleLoop(cx, cy, 0.105, zBump - 0.015, 14),
          opacity: 0.56,
          width: 1.0,
          tint: camTint,
        },
        {
          pts: makeCircleLoop(cx, cy + 0.23, 0.11, zBump - 0.015, 14),
          opacity: 0.56,
          width: 1.0,
          tint: camTint,
        },
      );
      break;
    }

    case "huawei-ring": {
      const cy = -h * 0.55;
      edges.push(
        {
          pts: makeCircleLoop(0, cy, 0.44, zBump, 24),
          opacity: 0.52,
          width: 1.05,
        },
        {
          pts: makeCircleLoop(0, cy, 0.26, zBump - 0.01, 20),
          opacity: 0.36,
          width: 0.85,
        },
      );
      for (const [dx, dy] of [
        [-0.22, -0.18],
        [0.22, -0.18],
        [-0.22, 0.18],
        [0.22, 0.18],
      ]) {
        edges.push({
          pts: makeCircleLoop(dx, cy + dy, 0.095, zBump - 0.015, 14),
          opacity: 0.54,
          width: 0.95,
          tint: camTint,
        });
      }
      break;
    }

    case "generic-slab":
    default: {
      const cx = 0.56;
      const cy = -h * 0.6;
      edges.push(
        {
          pts: makePillLoop(cx, cy, 0.17, 0.34, zBump, true),
          opacity: 0.46,
          width: 0.95,
        },
        {
          pts: makeCircleLoop(cx, cy - 0.15, 0.1, zBump - 0.015, 14),
          opacity: 0.52,
          width: 0.95,
          tint: camTint,
        },
        {
          pts: makeCircleLoop(cx, cy + 0.15, 0.1, zBump - 0.015, 14),
          opacity: 0.52,
          width: 0.95,
          tint: camTint,
        },
      );
      break;
    }
  }
}

export function buildChassisEdges(spec: ChassisSpec): WireEdge[] {
  const w = spec.width ?? (spec.foldable ? 1.24 : 1.0);
  const h = spec.height ?? (spec.foldable ? 1.92 : 2.04);
  const r = spec.cornerRadius ?? 0.22;
  const d = spec.depth ?? 0.14;

  const edges: WireEdge[] = [];
  const frontOuter = makeRoundedRectLoop(w, h, r, d);
  const backOuter = makeRoundedRectLoop(w, h, r, -d);
  const midFrame = makeRoundedRectLoop(w + 0.01, h + 0.01, r, 0);

  // Neutral outer body shell (no section tag -> never obscured by heatmap)
  edges.push({ pts: frontOuter, opacity: 0.56, width: 1.2 });
  edges.push({ pts: backOuter, opacity: 0.4, width: 1.05 });
  edges.push({ pts: midFrame, opacity: 0.26, width: 0.9, tint: "#94a3b8" });

  for (let i = 0; i < frontOuter.length - 1; i += 2) {
    edges.push({
      pts: [frontOuter[i], backOuter[i]],
      opacity: 0.24,
      width: 0.85,
    });
  }

  // Front selfie punch-hole & earpiece slit
  edges.push({
    pts: makeCircleLoop(0, -h * 0.87, 0.06, d + 0.005, 14),
    opacity: 0.42,
    width: 0.9,
    tint: "#94a3b8",
  });
  edges.push({
    pts: [
      [-0.22, -h * 0.965, d + 0.005],
      [0.22, -h * 0.965, d + 0.005],
    ],
    opacity: 0.36,
    width: 1.1,
  });

  // Model / Brand rear silhouette
  addCameraModule(edges, spec, w, h, d);

  // --- Section-tagged internal heatmap subsystems ---
  // Display panel (front glass plane)
  edges.push({
    pts: makeRoundedRectLoop(w * 0.9, h * 0.94, Math.max(0.08, r - 0.07), d),
    opacity: 0.34,
    width: 1.0,
    tint: "#9eb9e8",
    section: "display",
  });

  // SoC / CPU motherboard & primary die
  edges.push(
    ...makeBoxEdges(
      -0.54 * w,
      -h * 0.69,
      -0.02,
      0.54 * w,
      -h * 0.27,
      0.06,
      0.3,
      true,
      "cpu",
    ),
  );
  edges.push({
    pts: [
      [-0.26 * w, -h * 0.56, 0.04],
      [0.14 * w, -h * 0.56, 0.04],
      [0.14 * w, -h * 0.4, 0.04],
      [-0.26 * w, -h * 0.4, 0.04],
      [-0.26 * w, -h * 0.56, 0.04],
    ],
    opacity: 0.42,
    width: 1.05,
    dashed: false,
    section: "cpu",
  });

  // GPU / NPU silicon block adjacent to CPU die
  edges.push({
    pts: [
      [0.18 * w, -h * 0.54, 0.04],
      [0.44 * w, -h * 0.54, 0.04],
      [0.44 * w, -h * 0.34, 0.04],
      [0.18 * w, -h * 0.34, 0.04],
      [0.18 * w, -h * 0.54, 0.04],
    ],
    opacity: 0.4,
    width: 1.0,
    dashed: true,
    section: "gpu",
  });

  // Radio / RF / Modem antenna module (upper-right corner)
  edges.push(
    ...makeBoxEdges(
      0.42 * w,
      -h * 0.89,
      -0.05,
      0.86 * w,
      -h * 0.72,
      0.04,
      0.34,
      true,
      "radio",
    ),
  );

  // Battery cell
  edges.push(
    ...makeBoxEdges(
      -0.68 * w,
      -h * 0.16,
      -0.06,
      0.42 * w,
      h * 0.73,
      0.05,
      0.32,
      true,
      "battery",
    ),
  );

  // Qi wireless charging coil
  if (spec.hasWirelessCoil !== false) {
    edges.push({
      pts: makeCircleLoop(-0.08 * w, h * 0.22, 0.4, -0.09, 24),
      opacity: 0.32,
      width: 1.0,
      dashed: true,
      section: "coil",
    });
    edges.push({
      pts: makeCircleLoop(-0.08 * w, h * 0.22, 0.25, -0.09, 20),
      opacity: 0.26,
      width: 0.9,
      dashed: true,
      section: "coil",
    });
  }

  // Bottom USB-C charging port
  edges.push(
    ...makeBoxEdges(-0.22, h * 0.91, -0.05, 0.22, h, 0.05, 0.45, false, "usb"),
  );

  // Bottom speaker acoustic cavity
  edges.push(
    ...makeBoxEdges(
      0.34 * w,
      h * 0.81,
      -0.05,
      0.78 * w,
      h * 0.94,
      0.05,
      0.32,
      true,
      "speaker",
    ),
  );

  return edges;
}
