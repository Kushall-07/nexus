/**
 * CrystalizedBall - a glowing crystal orb drawn with a single WebGL fragment shader.
 *
 * The visual props mirror the reference usage:
 *   <CrystalizedBall preset="plasma" color="#ef5050" size={0.7} crackle={0.85} fill={0.5} interactive hoverStrength={0.7} />
 *
 * On top of that it behaves like a voice agent. `mode` changes how it moves:
 *   idle       slow breathing, a calm glow
 *   listening  everything is drawn in to the centre: the cracks tighten, light flows inward and
 *              sparks stream into the core; the orb contracts a little and reacts to `levelRef`
 *   speaking   the orb shakes and its edge wobbles; cracks flash with every word and sparks fly outward
 *   thinking   the inside swirls faster
 * Values ease between modes, so changing mode never snaps.
 *
 * `levelRef` is a shared 0..1 number the owner updates (microphone loudness, or a kick on each
 * spoken word). The orb reads it every frame and lets it fall away smoothly.
 *
 * Without WebGL, or before it starts, a soft CSS orb is shown instead. Rendering pauses when the
 * orb is off screen or the tab is hidden. With "reduce motion" the orb moves slowly and never shakes.
 */
import { useEffect, useRef, type MutableRefObject } from "react";

export type OrbMode = "idle" | "listening" | "speaking" | "thinking";
export type OrbPreset = "plasma" | "shard" | "ember";

export interface CrystalizedBallProps {
  preset?: OrbPreset;
  /** Main colour of the orb, as #rrggbb. */
  color?: string;
  /** Diameter as a fraction of the smaller side of the box (0..1). */
  size?: number;
  /** How bright and dense the crystal cracks are (0..1). */
  crackle?: number;
  /** How full of light the orb is (0..1). */
  fill?: number;
  /** React to the pointer: the highlight follows it and the orb leans toward it. */
  interactive?: boolean;
  /** How strongly the orb reacts to the pointer (0..1). */
  hoverStrength?: number;
  mode?: OrbMode;
  /** 0..1 loudness, updated by the owner. */
  levelRef?: MutableRefObject<number>;
  className?: string;
}

/* ─────────────────────────────── presets & colour ─────────────────────────────── */

interface PresetDef {
  /** Number of crystal cells across the orb. */
  cells: number;
  /** How far the accent colour moves toward white-hot. */
  heat: number;
  accent: [number, number, number];
}

const PRESETS: Record<OrbPreset, PresetDef> = {
  plasma: { cells: 2.3, heat: 0.62, accent: [1, 1, 1] },
  shard: { cells: 1.45, heat: 0.72, accent: [1, 0.96, 0.9] },
  ember: { cells: 2.9, heat: 0.7, accent: [1, 0.82, 0.48] },
};

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value) || full.length !== 6) return [0.94, 0.31, 0.31];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/* ─────────────────────────────────── shaders ─────────────────────────────────── */

const VERT = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_c1;
uniform vec3  u_c2;
uniform float u_size;
uniform float u_cells;
uniform float u_crackle;
uniform float u_fill;
uniform float u_listen;
uniform float u_speak;
uniform float u_think;
uniform float u_level;
uniform float u_hover;
uniform vec2  u_ptr;
uniform vec2  u_shake;

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

// Nearest and second-nearest cell distances: their gap is small along crystal edges.
vec2 voronoi(vec2 x, float t) {
  vec2 n = floor(x), f = fract(x);
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.5 * sin(t + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}

mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  uv -= u_shake + u_ptr * 0.035 * u_hover;

  float ang = atan(uv.y, uv.x);
  float wobble = u_speak * (0.020 * sin(ang * 3.0 + u_time * 7.0) + 0.014 * sin(ang * 5.0 - u_time * 11.0)) * (0.5 + u_level);
  float R = 0.5 * u_size * (1.0 - 0.12 * u_listen) * (1.0 + 0.06 * u_level + wobble);

  vec2 q = uv / R;
  float r = length(q);

  // Soft halo outside the ball
  float halo = exp(-max(r - 1.0, 0.0) * 5.5) * (0.30 + 0.35 * u_fill + 0.45 * u_level + 0.25 * u_listen);
  halo *= 1.0 - smoothstep(2.3, 3.2, r);

  // Sparks: they stream into the centre while listening and fly outward while speaking
  float sparks = 0.0;
  float flow = max(u_listen, u_speak * 0.85);
  float inward = u_listen / (u_listen + u_speak + 0.001);
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float h = hash1(fi + 1.0);
    float phase = fract(u_time * (0.16 + 0.14 * hash1(fi + 5.0)) + h);
    float rin = mix(2.0, 0.08, phase);
    float rout = mix(0.35, 2.1, phase);
    float rad = mix(rout, rin, inward);
    float a = h * 6.2831 + fi * 0.7 + u_time * 0.15 * (1.0 - inward);
    vec2 pp = vec2(cos(a), sin(a)) * rad;
    float d = length(q - pp);
    sparks += exp(-d * d * 520.0) * (1.0 - phase) * (0.5 + hash1(fi + 9.0));
  }
  sparks *= flow;

  vec3 col = vec3(0.0);
  float inside = 1.0 - smoothstep(0.985, 1.0, r);

  if (inside > 0.0) {
    float z = sqrt(max(0.0, 1.0 - r * r));
    vec3 n = vec3(q, z);

    // Look through the glass: the interior is bent by the sphere's curvature.
    vec2 p = q * 1.6 + n.xy * 0.35;
    p = rot(u_time * 0.7 * u_think + 0.25 * sin(u_time * 0.2)) * p;
    // Listening draws the pattern toward the centre and compresses it there.
    float pull = u_listen * (1.5 - r);
    p *= 1.0 + pull * 0.9;
    p -= normalize(q + 0.0001) * (u_time * 0.40 * u_listen);
    // Speaking shakes the inside.
    p += u_speak * 0.14 * (0.4 + u_level) * vec2(sin(u_time * 9.0 + q.y * 6.0), cos(u_time * 8.0 + q.x * 6.0));

    float haze = fbm(p * 1.3 + u_time * 0.18);
    vec2 v = voronoi(p * u_cells, u_time * 0.45);
    float edge = v.y - v.x;
    float width = 0.045 + 0.05 * u_crackle;
    float cracks = (1.0 - smoothstep(0.0, width, edge)) * u_crackle;
    float glow = exp(-edge * 9.0) * u_crackle * 0.55;
    float flash = 1.0 + u_level * 1.6 + u_speak * 0.25;

    // Body: deep colour that brightens toward the middle
    vec3 body = u_c1 * mix(0.16, 0.8, pow(1.0 - r, 0.85)) * (0.4 + 0.9 * u_fill);
    body += u_c1 * haze * (0.30 + 0.7 * u_fill);
    body *= 0.82 + 0.34 * v.x;

    // Crystal edges, hot in the middle and cooler toward the rim
    vec3 veins = mix(u_c1, u_c2, 0.55 + 0.45 * (1.0 - r));
    col = body + glow * u_c1 * flash + cracks * veins * 1.5 * flash;

    // Core light grows when listening
    float core = exp(-r * r * 3.2) * (0.25 + 0.9 * u_fill + 0.7 * u_listen + 0.6 * u_level);
    col += u_c2 * core * 0.55;

    // Glass: rim light and a highlight that follows the pointer
    float fres = pow(1.0 - z, 3.0);
    col += u_c2 * fres * 0.85;
    vec3 L = normalize(vec3(-0.45 + u_ptr.x * 0.55 * u_hover, 0.55 + u_ptr.y * 0.55 * u_hover, 0.7));
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 38.0);
    col += vec3(1.0) * spec * (0.55 + 0.3 * u_hover);
  }

  // Premultiplied output: ball, then halo and sparks behind/around it
  float haloA = clamp(halo, 0.0, 1.0) * 0.65;
  float sparkA = clamp(sparks, 0.0, 1.0);
  vec3 outer = u_c1 * haloA + u_c2 * sparkA;
  vec3 rgb = col * inside + outer * (1.0 - inside * 0.9);
  float a = clamp(inside + (haloA + sparkA) * (1.0 - inside), 0.0, 1.0);
  gl_FragColor = vec4(rgb, a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/* ─────────────────────────────────── component ─────────────────────────────────── */

const TARGETS: Record<OrbMode, { listen: number; speak: number; think: number }> = {
  idle: { listen: 0, speak: 0, think: 0 },
  listening: { listen: 1, speak: 0, think: 0 },
  speaking: { listen: 0, speak: 1, think: 0 },
  thinking: { listen: 0, speak: 0, think: 1 },
};

export function CrystalizedBall({
  preset = "plasma",
  color = "#ef5050",
  size = 0.7,
  crackle = 0.85,
  fill = 0.5,
  interactive = true,
  hoverStrength = 0.7,
  mode = "idle",
  levelRef,
  className,
}: CrystalizedBallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  // The render loop reads the latest props from here, so it never has to restart for a prop change.
  const live = useRef({ mode, size, crackle, fill, interactive, hoverStrength, preset, color, levelRef });
  live.current = { mode, size, crackle, fill, interactive, hoverStrength, preset, color, levelRef };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return undefined; // the CSS orb underneath stays visible

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return undefined;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uni = {
      res: u("u_res"), time: u("u_time"), c1: u("u_c1"), c2: u("u_c2"), size: u("u_size"), cells: u("u_cells"),
      crackle: u("u_crackle"), fill: u("u_fill"), listen: u("u_listen"), speak: u("u_speak"), think: u("u_think"),
      level: u("u_level"), hover: u("u_hover"), ptr: u("u_ptr"), shake: u("u_shake"),
    };

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    // Eased state
    const cur = { listen: 0, speak: 0, think: 0, level: 0, hover: 0, ptrX: 0, ptrY: 0 };
    const pointer = { x: 0, y: 0, inside: false };

    let raf = 0;
    let inView = true;
    let tabVisible = !document.hidden;
    let lost = false;
    let last = performance.now();
    const start = last;

    function resize() {
      const w = Math.max(1, Math.floor(canvas!.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas!.clientHeight * dpr));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
      gl!.viewport(0, 0, w, h);
    }

    function frame(now: number) {
      if (!gl || lost) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = live.current;
      const t = ((now - start) / 1000) * (reduced ? 0.25 : 1) + 8;
      const target = TARGETS[p.mode];
      const ease = 1 - Math.exp(-dt * 5);

      cur.listen += (target.listen - cur.listen) * ease;
      cur.speak += (target.speak - cur.speak) * ease;
      cur.think += (target.think - cur.think) * ease;

      // Loudness: jump to the shared level, then fall away smoothly.
      const external = Math.min(1, Math.max(0, p.levelRef?.current ?? 0));
      if (p.levelRef) p.levelRef.current = external * Math.exp(-dt * 4.5);
      let level = Math.max(external, cur.level * Math.exp(-dt * 5));
      if (p.mode === "speaking") level = Math.max(level, 0.3 + 0.22 * Math.sin(t * 6.3) * Math.sin(t * 2.1 + 1.0));
      cur.level = level;

      const wantHover = p.interactive && pointer.inside ? p.hoverStrength : 0;
      cur.hover += (wantHover - cur.hover) * ease;
      cur.ptrX += (pointer.x - cur.ptrX) * ease;
      cur.ptrY += (pointer.y - cur.ptrY) * ease;

      // Speaking shakes the whole orb.
      const shakeAmount = reduced ? 0 : cur.speak * (0.006 + 0.016 * level);
      const shakeX = shakeAmount * (Math.sin(t * 23) + 0.6 * Math.sin(t * 37.7));
      const shakeY = shakeAmount * (Math.cos(t * 19) + 0.6 * Math.sin(t * 31.3));

      const def = PRESETS[p.preset];
      const c1 = parseHex(p.color);
      const c2 = mixColor(c1, def.accent, def.heat);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uni.res, canvas!.width, canvas!.height);
      gl.uniform1f(uni.time, t);
      gl.uniform3f(uni.c1, c1[0], c1[1], c1[2]);
      gl.uniform3f(uni.c2, c2[0], c2[1], c2[2]);
      gl.uniform1f(uni.size, p.size);
      gl.uniform1f(uni.cells, def.cells);
      gl.uniform1f(uni.crackle, p.crackle);
      gl.uniform1f(uni.fill, p.fill);
      gl.uniform1f(uni.listen, cur.listen);
      gl.uniform1f(uni.speak, reduced ? 0 : cur.speak);
      gl.uniform1f(uni.think, cur.think);
      gl.uniform1f(uni.level, level);
      gl.uniform1f(uni.hover, cur.hover);
      gl.uniform2f(uni.ptr, cur.ptrX, cur.ptrY);
      gl.uniform2f(uni.shake, shakeX, shakeY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now: number) {
      if (inView && tabVisible) frame(now);
      raf = requestAnimationFrame(loop);
    }

    resize();
    frame(performance.now());
    canvas.style.opacity = "1";
    if (fallbackRef.current) fallbackRef.current.style.opacity = "0";
    raf = requestAnimationFrame(loop);

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    resizeObserver?.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
    }, { threshold: 0.01 });
    intersection.observe(canvas);

    const onVisibility = () => {
      tabVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      pointer.x = ((event.clientX - box.left) / box.width) * 2 - 1;
      pointer.y = -(((event.clientY - box.top) / box.height) * 2 - 1);
      pointer.inside = true;
    };
    const onLeave = () => {
      pointer.inside = false;
      pointer.x = 0;
      pointer.y = 0;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      canvas.style.opacity = "0";
      if (fallbackRef.current) fallbackRef.current.style.opacity = "1";
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // Do not call loseContext(): React StrictMode re-runs this effect on the same canvas.
    };
  }, []);

  const [r, g, b] = parseHex(color).map((v) => Math.round(v * 255));

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Shown until WebGL draws, and whenever WebGL is unavailable. */}
      <div
        ref={fallbackRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          transition: "opacity 500ms ease-out",
        }}
      >
        <div
          style={{
            width: `${size * 100}%`,
            maxWidth: `${size * 100}%`,
            aspectRatio: "1",
            borderRadius: "50%",
            background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), rgb(${r},${g},${b}) 38%, rgba(${r},${g},${b},0.35) 100%)`,
            boxShadow: `0 0 70px rgba(${r},${g},${b},0.55)`,
          }}
        />
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", opacity: 0, transition: "opacity 500ms ease-out", touchAction: "none" }}
      />
    </div>
  );
}
