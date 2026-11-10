/**
 * LiquidBackground — animated "warp" gradient (WebGL, no dependencies).
 *
 * Inspired by the Framer AnimatedLiquidBackground component: a full-bleed,
 * slowly swirling liquid gradient with a fine grain overlay. Re-implemented as
 * a single fragment shader on a full-screen triangle and tuned to the NEXUS
 * light palette (Cream base · Deep Teal · Mid Teal · Coral accent).
 *
 * Behaviour:
 *  - Always renders a CSS gradient underneath, so the hero looks correct before
 *    WebGL starts, when WebGL is unavailable, or if the context is lost.
 *  - Pauses when scrolled out of view or the tab is hidden.
 *  - prefers-reduced-motion → a single static frame is drawn, no animation.
 *  - Coarse pointers / small screens render at a lower resolution.
 */

import { useEffect, useRef } from "react";

// ─── Palette (sRGB, matches index.css tokens) ────────────────────────────────

const CREAM: [number, number, number] = [0xf1, 0xee, 0xe8];
const TEAL_DEEP: [number, number, number] = [0x0e, 0x4f, 0x4a];
const TEAL_MID: [number, number, number] = [0x1a, 0x7a, 0x74];
const CORAL: [number, number, number] = [0xf6, 0x7f, 0x5e];

const rgb = (c: [number, number, number]) => c.map((v) => v / 255) as [number, number, number];

// ─── Shaders ─────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_cream;
uniform vec3  u_teal;
uniform vec3  u_tealMid;
uniform vec3  u_coral;

// Tunables (mirroring the Framer control names)
const float SPEED      = 1.0;
const float SCALE      = 1.25;
const float DISTORTION = 0.55;
const float SWIRL      = 0.80;
const int   ITERATIONS = 5;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float t = u_time * 0.12 * SPEED;

  // Iterated swirl + domain warp → liquid flow field
  vec2 p = uv * SCALE;
  for (int i = 0; i < ITERATIONS; i++) {
    float fi = float(i);
    p = rot(SWIRL * 0.35 * sin(t + fi)) * p;
    p += DISTORTION * vec2(
      sin(p.y * 1.7 + t * 1.3 + fi * 1.9),
      cos(p.x * 1.5 - t * 1.1 + fi * 2.3)
    ) / (1.0 + fi * 0.6);
  }

  float field = noise(p * 1.2 + t) * 0.6 + noise(p * 2.4 - t * 0.7) * 0.4;
  field = smoothstep(0.25, 0.75, field);

  // Cream base; teal ribbons and a coral band flow through it.
  vec3 col = u_cream;
  col = mix(col, u_tealMid, smoothstep(0.30, 0.75, field) * 0.60);
  col = mix(col, u_teal,    smoothstep(0.62, 0.98, field) * 0.75);

  // Coral accent in a narrow, moving band
  float band = smoothstep(0.30, 0.45, field) * (1.0 - smoothstep(0.45, 0.62, field));
  col = mix(col, u_coral, band * 0.70);

  // Colour is strongest toward the edges; the centre stays calmer so the
  // headline remains readable.
  float edge = smoothstep(0.10, 0.95, length(uv * vec2(0.75, 1.0)));
  col = mix(u_cream, col, 0.40 + 0.60 * edge);

  // Fine grain (noise overlay in the reference)
  float g = hash(gl_FragCoord.xy + fract(u_time) * 100.0) - 0.5;
  col += g * 0.035;

  gl_FragColor = vec4(col, 1.0);
}
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LiquidBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return; // CSS gradient underneath remains visible

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // Full-screen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    gl.uniform3fv(gl.getUniformLocation(program, "u_cream"), rgb(CREAM));
    gl.uniform3fv(gl.getUniformLocation(program, "u_teal"), rgb(TEAL_DEEP));
    gl.uniform3fv(gl.getUniformLocation(program, "u_tealMid"), rgb(TEAL_MID));
    gl.uniform3fv(gl.getUniformLocation(program, "u_coral"), rgb(CORAL));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);

    let rafId = 0;
    let inView = true;
    let tabVisible = !document.hidden;
    let lost = false;
    const start = performance.now();
    // Start at a pleasing offset so the static (reduced-motion) frame isn't empty-looking.
    const TIME_OFFSET = 12;

    function resize() {
      if (!canvas || !gl) return;
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }

    function draw(now: number) {
      if (!gl || lost) return;
      gl.uniform1f(uTime, TIME_OFFSET + (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now: number) {
      if (inView && tabVisible) draw(now);
      rafId = requestAnimationFrame(loop);
    }

    resize();
    draw(performance.now());
    canvas.style.opacity = "1";
    if (!reduced) rafId = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now()); // keeps the static frame correct after resizes
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => { inView = entry?.isIntersecting ?? true; }, { threshold: 0.05 });
    io.observe(canvas);

    const onVisibility = () => { tabVisible = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);

    const onLost = (e: Event) => { e.preventDefault(); lost = true; canvas.style.opacity = "0"; };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // NOTE: do not call loseContext() here — React StrictMode re-runs the effect
      // on the same <canvas>, and getContext() would return the dead context.
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        // CSS fallback — same palette, visible until/unless WebGL draws
        background:
          "radial-gradient(ellipse 60% 55% at 78% 22%, oklch(30% 0.065 192 / 0.16), transparent 70%)," +
          "radial-gradient(ellipse 50% 50% at 15% 80%, oklch(70% 0.148 36 / 0.16), transparent 70%)," +
          "var(--color-slate-50)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", opacity: 0, transition: "opacity 900ms ease-out" }}
      />
    </div>
  );
}
