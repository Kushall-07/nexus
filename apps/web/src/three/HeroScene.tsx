/**
 * NEXUS Hero — Three.js particle-network scene.
 *
 * Visual concept: An interconnected network of nodes representing the
 * intelligence ecosystem — repositories → skills → role matches → opportunities.
 *
 * Performance notes:
 *  - Lazy-loaded via React.lazy() — not in the initial bundle.
 *  - Skipped on mobile (pointer: coarse) and reduced-motion — see HeroSection.
 *  - Animation paused via visibilitychange listener.
 *  - All Three.js resources disposed on unmount.
 *  - Device pixel ratio capped at 2.
 */

import * as THREE from "three";
import { useEffect, useRef } from "react";

export type HeroTheme = "dark" | "light";

interface Props {
  theme: HeroTheme;
}

// ─── Color constants ──────────────────────────────────────────────────────────

const DARK = {
  node: new THREE.Color(0xf6c900),        // Vibrant Gold — primary nodes
  nodeDim: new THREE.Color(0x8a6e00),     // Dimmed Gold — repo nodes
  nodeBright: new THREE.Color(0xffe680),  // Bright Gold — opportunity nodes
  line: new THREE.Color(0xf6c900),        // Gold connections
  lineOpacity: 0.12,
  bg: "transparent",
};

const LIGHT = {
  node: new THREE.Color(0x0e4f4a),        // Deep Teal — primary nodes
  nodeDim: new THREE.Color(0x1a7a74),     // Mid Teal — repo nodes
  nodeBright: new THREE.Color(0xf67f5e),  // Coral — opportunity nodes
  line: new THREE.Color(0x0e4f4a),        // Teal connections
  lineOpacity: 0.10,
  bg: "transparent",
};

// ─── Scene parameters ─────────────────────────────────────────────────────────

const PARTICLE_COUNT = 95;
const FIELD_SIZE = 7;           // half-extent of the field (units)
const CONNECTION_DIST = 2.4;    // max distance for a visible connection line
const MAX_CONNECTIONS = 320;    // pre-allocated line segments
const ROTATION_SPEED = 0.00018; // radians per ms
const DRIFT_SPEED = 0.00028;    // base velocity multiplier
const POINTER_RADIUS = 2.0;     // units
const POINTER_STRENGTH = 0.045; // attraction force

// Particle "types" — determines size and colour assignment.
// 40% repos (small, dim), 40% skills (medium, primary), 20% opportunities (large, bright)
const REPO_COUNT = Math.floor(PARTICLE_COUNT * 0.40);
const SKILL_COUNT = Math.floor(PARTICLE_COUNT * 0.40);
// OPPORTUNITY_COUNT = remainder

// ─── Component ────────────────────────────────────────────────────────────────

export function HeroScene({ theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const destroyRef = useRef<(() => void) | null>(null);

  // Re-create scene when theme changes
  useEffect(() => {
    // Destroy previous scene if any
    destroyRef.current?.();
    destroyRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Test WebGL availability
    const testCtx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!testCtx) return;

    const palette = theme === "light" ? LIGHT : DARK;

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ── Scene + camera ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    function handleResize() {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    handleResize();

    // ── Particle data ──────────────────────────────────────────────────────
    type PType = "repo" | "skill" | "opportunity";

    interface Particle {
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      type: PType;
      size: number;
    }

    const particles: Particle[] = [];

    function makeParticle(type: PType): Particle {
      const spread = FIELD_SIZE * 0.95;
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 0.6, // shallower z — stays legible
      );
      const speed = DRIFT_SPEED * (0.6 + Math.random() * 0.8);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        (Math.random() - 0.5) * speed,
        (Math.random() - 0.5) * speed * 0.3,
      );
      const size = type === "repo" ? 0.030 + Math.random() * 0.020
        : type === "skill" ? 0.045 + Math.random() * 0.025
        : 0.065 + Math.random() * 0.030;
      return { pos, vel, type, size };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const type: PType =
        i < REPO_COUNT ? "repo"
        : i < REPO_COUNT + SKILL_COUNT ? "skill"
        : "opportunity";
      particles.push(makeParticle(type));
    }

    // ── Particle geometry (ShaderMaterial for per-vertex sizes) ───────────
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const sizeArr = new Float32Array(PARTICLE_COUNT);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);

    function colorFor(p: Particle): THREE.Color {
      if (p.type === "repo") return palette.nodeDim;
      if (p.type === "opportunity") return palette.nodeBright;
      return palette.node;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i]!;
      posArr[i * 3] = p.pos.x;
      posArr[i * 3 + 1] = p.pos.y;
      posArr[i * 3 + 2] = p.pos.z;
      sizeArr[i] = p.size;
      const c = colorFor(p);
      colArr[i * 3] = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }

    const pointGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage);
    const sizeAttr = new THREE.BufferAttribute(sizeArr, 1);
    const colAttr = new THREE.BufferAttribute(colArr, 3);
    pointGeo.setAttribute("position", posAttr);
    pointGeo.setAttribute("aSize", sizeAttr);
    pointGeo.setAttribute("color", colAttr);

    // Shader material for circular, smooth point sprites with per-vertex sizes
    const pointMat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: theme === "light" ? 0.85 : 0.90 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (900.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
          // Fade particles that are very far back
          float depth = clamp((-mvPos.z - 0.5) / 8.0, 0.0, 1.0);
          vOpacity = 1.0 - depth * 0.5;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.3, 0.5, d)) * uOpacity * vOpacity;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const pointsMesh = new THREE.Points(pointGeo, pointMat);
    scene.add(pointsMesh);

    // ── Connection lines ───────────────────────────────────────────────────
    const linePositions = new Float32Array(MAX_CONNECTIONS * 2 * 3);
    const lineAlphas = new Float32Array(MAX_CONNECTIONS * 2);
    const lineGeo = new THREE.BufferGeometry();
    const linePosAttr = new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage);
    const lineAlphaAttr = new THREE.BufferAttribute(lineAlphas, 1).setUsage(THREE.DynamicDrawUsage);
    lineGeo.setAttribute("position", linePosAttr);
    lineGeo.setAttribute("aAlpha", lineAlphaAttr);
    lineGeo.setDrawRange(0, 0);

    const lineMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: palette.line },
        uMaxOpacity: { value: palette.lineOpacity },
      },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uMaxOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * uMaxOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(linesMesh);

    // ── Pivot for global rotation ─────────────────────────────────────────
    const pivot = new THREE.Group();
    pivot.add(pointsMesh);
    pivot.add(linesMesh);
    scene.add(pivot);

    // Remove from scene before adding to pivot (pivot.add moves them)
    scene.remove(pointsMesh);
    scene.remove(linesMesh);

    // ── Animation loop ─────────────────────────────────────────────────────
    let lastTime = 0;
    let rafId = 0;
    let visible = true;

    function getPointerWorld(): THREE.Vector3 | null {
      const ptr = pointerRef.current;
      if (!ptr || !canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const nx = ((ptr.x - rect.left) / rect.width) * 2 - 1;
      const ny = -((ptr.y - rect.top) / rect.height) * 2 + 1;
      const ray = new THREE.Vector3(nx, ny, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      // Intersect with z=0 plane
      const t = -camera.position.z / ray.z;
      return new THREE.Vector3(
        camera.position.x + ray.x * t,
        camera.position.y + ray.y * t,
        0,
      );
    }

    function tick(now: number) {
      if (!visible) { rafId = requestAnimationFrame(tick); return; }

      const dt = Math.min(now - lastTime, 50); // cap delta
      lastTime = now;

      const ptWorld = getPointerWorld();

      // Compute pointer in pivot local space once per frame (not per particle)
      const localPtr = ptWorld
        ? ptWorld.clone().applyMatrix4(pivot.matrixWorld.clone().invert())
        : null;

      // Update particle positions
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i]!;

        // Drift
        p.pos.addScaledVector(p.vel, dt);

        // Pointer attraction — applied in pivot local space
        if (localPtr) {
          const diff = localPtr.clone().sub(p.pos);
          const distSq = diff.lengthSq();
          const rSq = POINTER_RADIUS * POINTER_RADIUS;
          if (distSq < rSq && distSq > 0.001) {
            const force = (1 - distSq / rSq) * POINTER_STRENGTH;
            p.vel.addScaledVector(diff.normalize(), force * dt * 0.001);
          }
        }

        // Dampen velocity
        p.vel.multiplyScalar(1 - 0.0008 * dt);

        // Wrap around field boundary
        const hs = FIELD_SIZE;
        if (p.pos.x > hs) p.pos.x -= hs * 2;
        if (p.pos.x < -hs) p.pos.x += hs * 2;
        if (p.pos.y > hs) p.pos.y -= hs * 2;
        if (p.pos.y < -hs) p.pos.y += hs * 2;
        if (p.pos.z > hs * 0.3) p.pos.z -= hs * 0.6;
        if (p.pos.z < -hs * 0.3) p.pos.z += hs * 0.6;

        // Write to buffer
        posArr[i * 3] = p.pos.x;
        posArr[i * 3 + 1] = p.pos.y;
        posArr[i * 3 + 2] = p.pos.z;
      }
      posAttr.needsUpdate = true;

      // Update connections
      let connCount = 0;
      const distSqThreshold = CONNECTION_DIST * CONNECTION_DIST;
      for (let a = 0; a < PARTICLE_COUNT - 1 && connCount < MAX_CONNECTIONS; a++) {
        for (let b = a + 1; b < PARTICLE_COUNT && connCount < MAX_CONNECTIONS; b++) {
          const pa = particles[a]!;
          const pb = particles[b]!;
          const dx = pa.pos.x - pb.pos.x;
          const dy = pa.pos.y - pb.pos.y;
          const dz = pa.pos.z - pb.pos.z;
          const dSq = dx * dx + dy * dy + dz * dz;
          if (dSq < distSqThreshold) {
            const alpha = 1 - dSq / distSqThreshold;
            const base = connCount * 6;
            linePositions[base] = pa.pos.x;
            linePositions[base + 1] = pa.pos.y;
            linePositions[base + 2] = pa.pos.z;
            linePositions[base + 3] = pb.pos.x;
            linePositions[base + 4] = pb.pos.y;
            linePositions[base + 5] = pb.pos.z;
            lineAlphas[connCount * 2] = alpha;
            lineAlphas[connCount * 2 + 1] = alpha;
            connCount++;
          }
        }
      }
      linePosAttr.needsUpdate = true;
      lineAlphaAttr.needsUpdate = true;
      lineGeo.setDrawRange(0, connCount * 2);

      // Rotate pivot slowly
      pivot.rotation.y += ROTATION_SPEED * dt;
      pivot.rotation.x = Math.sin(now * 0.00005) * 0.08;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    }

    // Start
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);

    // ── Resize observer ───────────────────────────────────────────────────
    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas);

    // ── Visibility observer ───────────────────────────────────────────────
    const onVisibility = () => { visible = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);

    // ── Fade in ───────────────────────────────────────────────────────────
    if (canvas) {
      canvas.style.opacity = "0";
      canvas.style.transition = "opacity 800ms ease-out";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { if (canvas) canvas.style.opacity = "1"; });
      });
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    const destroy = () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);

      // Dispose geometries and materials
      pointGeo.dispose();
      pointMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      renderer.dispose();
    };

    destroyRef.current = destroy;
    return destroy;
  }, [theme]);

  // ── Pointer tracking ─────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => { pointerRef.current = null; };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        opacity: 0,
      }}
    />
  );
}
