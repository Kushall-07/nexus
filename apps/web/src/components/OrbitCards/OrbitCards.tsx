/**
 * OrbitCards — scroll-driven 3D orbit that settles into a grid.
 *
 * Motion model ported from the Framer "Orbit Projects" component (Stylokit):
 *   - the section is tall and its viewport is `position: sticky`
 *   - scroll position → a damped 0…1 progress value
 *   - cards ride a curved 3D arc around the centre (depth → scale + opacity),
 *     then flatten into a grid; two big titles slide in from the sides behind them
 * Differences from the reference: the cards are arbitrary React nodes (not images),
 * colours come from the NEXUS theme, and narrow screens / reduced-motion users get a
 * plain responsive grid instead of the orbit.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type OrbitItem = { key: string; node: ReactNode };

type Props = {
  items: OrbitItem[];
  /** CSS colour for the pinned stage (match the section background) */
  background: string;
  leftTitle: string;
  rightTitle: string;
  centerText?: string;
  titleColor?: string;
  textColor?: string;
  /** hidden heading for assistive tech (the visual titles are decorative) */
  srTitle: string;
  columns?: number;
  gap?: number;
  gridMaxWidth?: number;
  /** card width / height */
  aspect?: number;
  arcCardWidth?: number;
  scrollLength?: number; // vh
  startOffset?: number; // %
  smoothness?: number;
  perspective?: number;
  curveWidth?: number;
  curveHeight?: number;
  depth?: number;
  rotation?: number;
  offsetY?: number;
  depthOpacity?: number; // %
  depthScale?: number; // %
  positionY?: number; // %
  desktopBreakpoint?: number;
  /** rendered above the grid in the compact (non-orbit) layout */
  compactHeader?: ReactNode;
  compactClassName?: string;
  compactGridClassName?: string;
  id?: string;
};

const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function smootherstep(start: number, end: number, value: number) {
  if (start === end) return value < start ? 0 : 1;
  const p = clamp((value - start) / (end - start));
  return p * p * p * (p * (p * 6 - 15) + 10);
}

const SHELL_RADIUS = 16;

type CardProps = {
  node: ReactNode;
  x: number; y: number; z: number;
  width: number; height: number;
  nativeWidth: number; nativeHeight: number;
  rotateY: number; rotateZ: number;
  scale: number; opacity: number; zIndex: number;
  flattened: number;
};

/** One orbiting card: the content is laid out at its final grid size and scaled with the card. */
const OrbitCard = memo(function OrbitCard(p: CardProps) {
  const shadow = lerp(1, 0.35, p.flattened);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: p.width,
        height: p.height,
        opacity: p.opacity,
        zIndex: p.zIndex,
        transformOrigin: "50% 50%",
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateY(${p.rotateY}deg) rotateZ(${p.rotateZ}deg) scale(${p.scale})`,
      }}
    >
      <div
        className="nx-card"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: SHELL_RADIUS,
          boxShadow: `0 ${18 * shadow}px ${50 * shadow}px rgba(14, 79, 74, ${0.16 * shadow})`,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <div
          style={{
            width: p.nativeWidth,
            height: p.nativeHeight,
            transformOrigin: "0 0",
            transform: `scale(${p.width / p.nativeWidth})`,
          }}
        >
          {p.node}
        </div>
      </div>
    </div>
  );
});

export function OrbitCards({
  items,
  background,
  leftTitle,
  rightTitle,
  centerText,
  titleColor = "var(--color-indigo-700)",
  textColor = "var(--color-slate-700)",
  srTitle,
  columns = 4,
  gap = 16,
  gridMaxWidth = 1160,
  aspect = 1.1,
  arcCardWidth = 410,
  scrollLength = 360,
  startOffset = 55,
  smoothness = 7,
  perspective = 1300,
  curveWidth = 570,
  curveHeight = 210,
  depth = 520,
  rotation = 310,
  offsetY = -40,
  depthOpacity = 30,
  depthScale = 82,
  positionY = 52,
  desktopBreakpoint = 1100,
  compactHeader,
  compactClassName = "px-5 py-20 sm:px-8",
  compactGridClassName = "grid gap-4 sm:grid-cols-2",
  id,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const stageRef = useCallback((node: HTMLElement | null) => setStage(node), []);

  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false),
  );
  const [progress, setProgress] = useState(0);
  const [near, setNear] = useState(false);

  const target = useRef(0);
  const animated = useRef(0);
  const raf = useRef<number | null>(null);
  const lastT = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Measure whichever element is currently mounted (stage or compact wrapper).
  useLayoutEffect(() => {
    if (!stage) return undefined;
    const measure = () => {
      const r = stage.getBoundingClientRect();
      const width = Math.max(Math.round(r.width), 1);
      const height = Math.max(Math.round(r.height), 1);
      setViewport((prev) => (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [stage]);

  const compact = reduced || viewport.width < desktopBreakpoint || viewport.height < 560;

  // Only run the scroll engine near the viewport.
  useEffect(() => {
    if (compact) return undefined;
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => setNear(e?.isIntersecting ?? true), { rootMargin: "100% 0px 100% 0px", threshold: 0 });
    io.observe(root);
    return () => io.disconnect();
  }, [compact]);

  useEffect(() => {
    if (compact || !near || !rootRef.current) return undefined;

    const step = (time: number) => {
      raf.current = null;
      const prev = lastT.current ?? time;
      const dt = Math.min(Math.max((time - prev) / 1000, 0), 0.064);
      lastT.current = time;
      const cur = animated.current;
      const next = cur + (target.current - cur) * (1 - Math.exp(-Math.max(smoothness, 0.1) * dt));
      const done = Math.abs(target.current - next) < 1e-4;
      animated.current = done ? target.current : next;
      setProgress(animated.current);
      if (!done) raf.current = requestAnimationFrame(step);
      else lastT.current = null;
    };

    const update = () => {
      const root = rootRef.current;
      if (!root) return;
      const b = root.getBoundingClientRect();
      const lead = window.innerHeight * (clamp(startOffset, 0, 100) / 100);
      const distance = Math.max(b.height - window.innerHeight, 1);
      target.current = clamp((lead - b.top) / distance);
      if (raf.current === null) raf.current = requestAnimationFrame(step);
    };

    // Jump straight to the right place on (re)entry instead of animating from 0.
    const b0 = rootRef.current.getBoundingClientRect();
    const d0 = Math.max(b0.height - window.innerHeight, 1);
    const p0 = clamp((window.innerHeight * (clamp(startOffset, 0, 100) / 100) - b0.top) / d0);
    animated.current = p0;
    target.current = p0;
    setProgress(p0);

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      lastT.current = null;
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [compact, near, smoothness, startOffset]);

  // ─── Compact: plain responsive grid ─────────────────────────────────────────
  if (compact) {
    return (
      <section id={id} ref={rootRef} aria-label={srTitle} style={{ background }}>
        <div ref={stageRef} className={compactClassName}>
          {compactHeader}
          <div className={compactGridClassName}>
            {items.map((it) => (
              <div key={it.key} className="nx-card nx-card-hover rounded-2xl">
                {it.node}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ─── Desktop: orbit ─────────────────────────────────────────────────────────
  const vw = viewport.width;
  const vh = viewport.height;
  const n = items.length;
  const cols = Math.min(Math.max(Math.round(columns), 1), Math.max(n, 1));
  const rows = Math.ceil(n / cols);
  const gridW = Math.min(gridMaxWidth, Math.max(vw - 96, 200));
  const cardW = Math.max(90, (gridW - gap * (cols - 1)) / cols);
  const cardH = cardW / Math.max(aspect, 0.2);
  const gridH = rows * cardH + Math.max(rows - 1, 0) * gap;

  const arcW = Math.min(arcCardWidth, vw * 0.28);
  const arcH = arcW / Math.max(aspect, 0.2);
  const curveX = Math.min(curveWidth, vw * 0.44);
  const curveY = Math.min(curveHeight, vh * 0.3);
  const arcDepth = Math.min(depth, vw * 0.42);

  const titleIn = smootherstep(0, 0.2, progress);
  const titleOut = smootherstep(0.74, 0.94, progress);
  const titleOpacity = titleIn * (1 - titleOut);
  const titleShift = lerp(28, 0, titleIn);
  const titleOutside = vw * 0.7;
  const safeCenter = Math.min(220, vw * 0.5);
  const titleFinal = (safeCenter + 32) / 2;
  const titleOffset = lerp(titleOutside, titleFinal, titleIn);
  const reveal = smootherstep(0, 0.17, progress);
  const orbit = smootherstep(0.05, 0.7, progress);
  const centerOpacity = smootherstep(0.12, 0.25, progress) * (1 - smootherstep(0.58, 0.82, progress));
  const titleFont = Math.round(clamp(vw * 0.066, 56, 128));

  const titleStyle = {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: titleFont,
    lineHeight: 0.86,
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap" as const,
    margin: 0,
    color: titleColor,
  };

  return (
    <section id={id} ref={rootRef} aria-label={srTitle} style={{ position: "relative", width: "100%", height: `${Math.max(scrollLength, 120)}vh`, background }}>
      <h2 className="sr-only">{srTitle}</h2>
      <div
        ref={stageRef}
        style={{
          position: "sticky",
          top: 0,
          width: "100%",
          height: "100svh",
          minHeight: 600,
          overflow: "hidden",
          background,
          perspective: `${perspective}px`,
          perspectiveOrigin: "50% 50%",
          transformStyle: "preserve-3d",
          isolation: "isolate",
        }}
      >
        {/* Ambient glow — deep teal top-left, coral bottom-right — grows as the orbit builds */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: 0.35 + 0.65 * orbit,
            background:
              "radial-gradient(ellipse 45% 55% at 12% 18%, oklch(30% 0.065 192 / 0.13), transparent 70%)," +
              "radial-gradient(ellipse 40% 50% at 90% 88%, oklch(70% 0.148 36 / 0.16), transparent 70%)",
          }}
        />

        {/* Big titles slide in from the sides, behind the cards */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", left: "50%", top: "56%", zIndex: 0, width: "max-content", pointerEvents: "none",
            opacity: titleOpacity, willChange: "transform, opacity",
            transform: `translate3d(calc(-100% - ${titleOffset}px), calc(-50% + ${titleShift}px), 0)`,
          }}
        >
          <div style={titleStyle}>{leftTitle}</div>
        </div>
        <div
          aria-hidden="true"
          style={{
            position: "absolute", left: "50%", top: "39%", zIndex: 0, width: "max-content", pointerEvents: "none",
            opacity: titleOpacity, willChange: "transform, opacity",
            transform: `translate3d(${titleOffset}px, calc(-50% - ${titleShift}px), 0)`,
          }}
        >
          <div style={{ ...titleStyle, color: "oklch(62% 0.17 36)" }}>{rightTitle}</div>
        </div>
        {centerText && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute", left: "50%", top: "50%", zIndex: 2, width: safeCenter, maxWidth: "80vw", padding: 16,
              boxSizing: "border-box", pointerEvents: "none", opacity: centerOpacity,
              transform: "translate3d(-50%, -50%, 0)", color: textColor, textAlign: "center",
              fontSize: 13, fontWeight: 500, lineHeight: 1.25, letterSpacing: "-0.01em",
            }}
          >
            {centerText}
          </div>
        )}

        {/* Cards */}
        <div style={{ position: "absolute", inset: 0, zIndex: 10, transformStyle: "preserve-3d" }}>
          {items.map((item, index) => {
            const cardReveal = smootherstep(0.025 + index * 0.01, 0.18 + index * 0.012, progress);
            const flatten = smootherstep(0.56 + index * 0.009, Math.min(0.91 + index * 0.009, 0.99), progress);

            const angle = (index / Math.max(n, 1)) * 360 - 125 + orbit * rotation;
            const rad = (angle * Math.PI) / 180;
            const arcCX = Math.sin(rad) * curveX;
            const arcCY = Math.cos(rad + 0.65) * curveY - vh * 0.025 + offsetY;
            const arcZ = Math.cos(rad) * arcDepth;
            const nd = clamp((arcZ + arcDepth) / Math.max(arcDepth * 2, 1));
            const arcScale = lerp(clamp(depthScale, 50, 100) / 100, 1, nd);
            const arcOpacity = lerp(clamp(depthOpacity, 0, 100) / 100, 1, nd);
            const arcRotY = -Math.sin(rad) * 62;
            const arcRotZ = -Math.sin(rad) * 8;
            const entrance = (1 - cardReveal) * vh * 0.48;
            const arcLeft = arcCX - arcW / 2;
            const arcTop = arcCY - arcH / 2 + entrance;

            const col = index % cols;
            const row = Math.floor(index / cols);
            const gridLeft = -gridW / 2 + col * (cardW + gap);
            const gridTop = vh * (positionY / 100) - vh / 2 - gridH / 2 + row * (cardH + gap);

            return (
              <OrbitCard
                key={item.key}
                node={item.node}
                width={lerp(arcW, cardW, flatten)}
                height={lerp(arcH, cardH, flatten)}
                nativeWidth={cardW}
                nativeHeight={cardH}
                x={lerp(arcLeft, gridLeft, flatten)}
                y={lerp(arcTop, gridTop, flatten)}
                z={lerp(arcZ, 0, flatten)}
                rotateY={lerp(arcRotY, 0, flatten)}
                rotateZ={lerp(arcRotZ, 0, flatten)}
                scale={lerp(arcScale, 1, flatten)}
                opacity={clamp(lerp(arcOpacity * cardReveal * reveal, 1, flatten))}
                zIndex={flatten > 0.86 ? 100 + index : Math.round(100 + nd * 800)}
                flattened={flatten}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
