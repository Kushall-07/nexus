/**
 * StaticHeroBackground — CSS fallback for the Three.js particle network.
 *
 * Used when:
 *  - Device is mobile (pointer: coarse, width < 1024px)
 *  - User prefers reduced motion
 *  - WebGL is unavailable
 *
 * Renders a branded atmospheric field with the existing Gold Signal
 * animation system (nx-node-pulse) adapted for the landing page.
 */

import type { HeroTheme } from "./HeroScene";

interface Props {
  theme: HeroTheme;
}

// Pre-defined node positions for a natural-looking static constellation
const NODES = [
  { x: 12, y: 18, size: 4, delay: "0s", duration: "2.8s" },
  { x: 28, y: 42, size: 3, delay: "0.4s", duration: "3.2s" },
  { x: 48, y: 15, size: 5, delay: "0.8s", duration: "2.5s" },
  { x: 62, y: 55, size: 4, delay: "1.1s", duration: "3.0s" },
  { x: 75, y: 28, size: 6, delay: "0.2s", duration: "2.9s" },
  { x: 85, y: 68, size: 3, delay: "0.6s", duration: "3.4s" },
  { x: 35, y: 72, size: 4, delay: "0.9s", duration: "2.7s" },
  { x: 90, y: 45, size: 5, delay: "0.3s", duration: "3.1s" },
  { x: 55, y: 80, size: 3, delay: "1.5s", duration: "2.6s" },
  { x: 18, y: 60, size: 4, delay: "0.7s", duration: "3.3s" },
  { x: 70, y: 12, size: 3, delay: "1.2s", duration: "2.8s" },
  { x: 42, y: 38, size: 7, delay: "0.5s", duration: "2.4s" }, // central hub
  { x: 65, y: 82, size: 4, delay: "0.0s", duration: "3.0s" },
  { x: 22, y: 85, size: 3, delay: "1.0s", duration: "3.5s" },
  { x: 82, y: 22, size: 5, delay: "0.4s", duration: "2.7s" },
];

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 4], [4, 7], [7, 5], [5, 8], [8, 6],
  [6, 9], [9, 0], [2, 11], [11, 3], [11, 7], [3, 4], [10, 4],
  [12, 5], [13, 6], [14, 7],
];

export function StaticHeroBackground({ theme }: Props) {
  const isDark = theme === "dark";
  const nodeColor = isDark ? "oklch(81% 0.195 86)" : "oklch(30% 0.065 192)";
  const lineColor = isDark ? "oklch(81% 0.195 86 / 0.14)" : "oklch(30% 0.065 192 / 0.12)";
  const nodePulseClass = "nx-node-pulse";

  // Convert percentage positions to SVG coords (0-100 viewBox)
  const getNode = (i: number) => NODES[i] ?? NODES[0]!;

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* Connection lines */}
        {CONNECTIONS.map(([a, b], i) => {
          const pa = getNode(a!);
          const pb = getNode(b!);
          return (
            <line
              key={i}
              x1={pa.x} y1={pa.y}
              x2={pb.x} y2={pb.y}
              stroke={lineColor}
              strokeWidth="0.3"
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.size * 0.28}
            fill={i === 11 ? (isDark ? "oklch(81% 0.195 86)" : "oklch(70% 0.148 36)") : nodeColor}
            className={nodePulseClass}
            style={{
              animationDelay: n.delay,
              animationDuration: n.duration,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
