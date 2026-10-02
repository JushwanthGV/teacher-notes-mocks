// Lumo - a curious little creature made of light. Procedural SDF raymarch (OGL), no assets.
// Interface: create(host, opts) -> { setState, setLevel, setLook, setCalm, start, stop, destroy }

const VERT = `
attribute vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uPx;
uniform vec4 uA; // earL, earR, fold, crouch
uniform vec4 uB; // glow, coreScale, bounce, lean
uniform vec4 uC; // spark0, spark1, spark2, breath
uniform vec4 uD; // lookX, lookY, level, time

float sdEll(vec3 p, vec3 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float dot2(vec3 v){ return dot(v, v); }
float sdRC(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  float x2 = dot2(pa * l2 - ba * y); float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// world -> creature space (crouch squash, lean about the feet, hop)
vec3 xf(vec3 p){
  vec3 q = p;
  q.y -= uB.z;
  q.xy = rot(uB.w) * (q.xy - vec2(0.0, -0.55)) + vec2(0.0, -0.55);
  float cr = uA.w;
  q.y = (q.y + 0.55) / (1.0 - 0.17 * cr) - 0.55;
  q.x /= (1.0 + 0.09 * cr);
  q.z /= (1.0 + 0.09 * cr);
  q.xz = rot(-0.42) * q.xz;
  return q;
}

float earD(vec3 q, float side, float ang, float len, float fold){
  vec3 base = vec3(side * 0.2, 0.3, -0.02);
  vec3 up = vec3(sin(ang), cos(ang), 0.0);
  vec3 back = normalize(vec3(side * 0.9, 0.05, -0.5));
  vec3 dir = normalize(mix(up, back, fold));
  vec3 tip = base + dir * len * (1.0 - 0.3 * fold);
  vec3 e = q - base; e.z *= 1.9; vec3 b2 = tip - base; b2.z *= 1.9;
  return sdRC(e, vec3(0.0), b2, 0.24, 0.1) * 0.6;
}

float map(vec3 p){
  vec3 q = xf(p);
  float br = uC.w;
  float body = sdEll(q, vec3(0.56, 0.54 * br, 0.54));
  float feet = min(sdEll(q - vec3(-0.27, -0.5, 0.2), vec3(0.2, 0.11, 0.27)),
                   sdEll(q - vec3(0.3, -0.5, 0.17), vec3(0.2, 0.11, 0.27)));
  float tail = sdEll(q - vec3(-0.12, -0.36, -0.46), vec3(0.17, 0.15, 0.16));
  float d = smin(body, feet, 0.12);
  d = smin(d, tail, 0.12);
  float eL = earD(q, -1.0, uA.x, 0.74, uA.z);
  float eR = earD(q, 1.0, uA.y, 0.9, uA.z);
  d = smin(d, eL, 0.1);
  d = smin(d, eR, 0.1);
  return d * 0.9;
}

vec3 calcN(vec3 p){
  const vec2 e = vec2(1.0, -1.0) * 0.0015;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

float dash(vec2 p, vec2 c, float ang, float len, float w){
  p -= c; p = rot(ang) * p;
  float d = abs(p.x) - len; d = max(d, 0.0);
  return length(vec2(d, p.y)) - w;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  vec3 ro = vec3(0.0, 0.9, 6.0);
  vec3 ta = vec3(0.0, 0.3, 0.0);
  vec3 ww = normalize(ta - ro), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.9 * ww);

  vec3 cWarm = vec3(1.0, 0.702, 0.278);
  vec3 cCore = vec3(1.0, 0.839, 0.4);
  vec3 cHi = vec3(1.0, 0.906, 0.71);
  float glow = uB.x;

  vec4 res = vec4(0.0);
  vec3 bc = vec3(0.0, 0.3, 0.0); float R = 2.1;
  vec3 oc = ro - bc; float bb = dot(oc, rd); float cc = dot(oc, oc) - R * R; float hh = bb * bb - cc;
  if (hh > 0.0) {
    float sh = sqrt(hh);
    float t = max(-bb - sh, 0.0); float tmax = -bb + sh;
    float dmin = 10.0; bool hit = false;
    for (int i = 0; i < 64; i++) {
      float d = map(ro + rd * t);
      dmin = min(dmin, d);
      if (d < 0.0015) { hit = true; break; }
      t += d;
      if (t > tmax) break;
    }
    float edge = smoothstep(0.0, 0.25, sh);
    float halo = exp(-max(dmin, 0.0) * 4.2) * (0.16 + 0.34 * glow) * edge;
    vec2 q = gl_FragCoord.xy / uRes; float scr = smoothstep(0.0, 0.14, q.x) * smoothstep(0.0, 0.14, 1.0 - q.x) * smoothstep(0.0, 0.14, q.y) * smoothstep(0.0, 0.14, 1.0 - q.y); halo *= scr; // Kakashi: fade the glow before the canvas edge (no square box)
    vec3 haloCol = mix(cWarm, cCore, 0.4);
    float ao = 1.0; vec3 col = vec3(0.0); float a = 0.0;
    if (hit) {
      vec3 p = ro + rd * t; vec3 n = calcN(p); vec3 q = xf(p);
      float ndv = clamp(dot(n, -rd), 0.0, 1.0);
      float fr = pow(1.0 - ndv, 2.2);
      float th = clamp(-map(p - n * 0.14) / 0.14, 0.0, 1.0);
      ao = clamp(map(p + n * 0.18) / 0.18, 0.0, 1.0);
      vec3 L = normalize(vec3(-0.45, 0.8, 0.6));
      float lam = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
      vec3 cp = vec3(-0.03, 0.02, 0.22);
      float dc = length(q - cp);
      float core = exp(-dc * dc / (0.3 * uB.y * uB.y));
      col = mix(cWarm * 0.93, cCore, 0.28 + 0.72 * smoothstep(0.0, 1.0, core));
      col = mix(col, cHi, core * (0.35 + 0.4 * glow));
      col += cHi * core * core * 0.12 * glow;
      float tn = 1.0 - th;
      col = mix(col, mix(cWarm, cHi, 0.5), tn * 0.62);
      col = mix(col, cWarm * 1.02, fr * 0.55);
      col *= 0.76 + 0.3 * lam;
      col *= 0.8 + 0.2 * ao;
      col *= 0.92 + 0.2 * glow;
      float ds = length(q - vec3(-0.1, 0.02, 0.52));
      col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.05, 0.012, ds) * (0.7 + 0.3 * glow));
      col += cHi * 0.08 * pow(max(dot(reflect(rd, n), L), 0.0), 8.0);
      a = 1.0;
    } else {
      a = 1.0 - smoothstep(0.0, uPx * 1.6, dmin);
    }
    // object over halo (premultiplied)
    float aH = halo;
    vec3 rgb = col * a + haloCol * aH * (1.0 - a);
    float al = a + aH * (1.0 - a);
    res = vec4(rgb, al);
  }

  // accent sparks (screen space, like the sheet): three short dashes right of the head
  float sp = 0.0;
  sp = max(sp, (1.0 - smoothstep(0.0, uPx * 1.5, dash(uv, vec2(0.33, 0.2), 0.62, 0.028, 0.0095))) * uC.x);
  sp = max(sp, (1.0 - smoothstep(0.0, uPx * 1.5, dash(uv, vec2(0.37, 0.1), 0.0, 0.03, 0.0095))) * uC.y);
  sp = max(sp, (1.0 - smoothstep(0.0, uPx * 1.5, dash(uv, vec2(0.32, 0.0), -0.62, 0.028, 0.0095))) * uC.z);
  vec3 spc = mix(cCore, cHi, 0.45);
  res.rgb = res.rgb * (1.0 - sp) + spc * sp;
  res.a = res.a * (1.0 - sp) + sp;

  gl_FragColor = res;
}
`;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;

// critically damped spring: settles in ~ 4*tau
function spring(s, target, dt, tau) {
  const w = 2 / tau;
  const x = s.x - target;
  const e = Math.exp(-w * dt);
  const nx = (x + (s.v + w * x) * dt) * e;
  s.v = (s.v - (s.v + w * x) * w * dt) * e;
  s.x = target + nx;
}

const REST = { earA: -0.3, earB: 0.52, fold: 0, crouch: 0, glow: 0.72, coreS: 1, bounce: 0, spark: 0 };

export async function create(host, opts = {}) {
  const o = Object.assign({ calm: false, still: false, t0: 0 }, opts);
  const api = { setState() {}, setLevel() {}, setLook() {}, setCalm() {}, start() {}, stop() {}, destroy() {} };

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.character = 'lumo';
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const fallback = () => {
    canvas.remove();
    const d = document.createElement('div');
    d.dataset.character = 'lumo';
    d.dataset.fallback = '1';
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none';
    d.innerHTML = '<svg viewBox="0 0 200 200" width="80%" height="80%" aria-hidden="true"><defs><radialGradient id="lg" cx="45%" cy="55%" r="60%"><stop offset="0" stop-color="#FFE7B5"/><stop offset="1" stop-color="#FFB347"/></radialGradient></defs><path d="M70 70 C58 20 80 8 92 36 C100 54 98 64 96 70Z M112 68 C112 28 140 4 156 22 C168 40 140 62 128 72Z" fill="#FFB347" opacity=".85"/><circle cx="102" cy="116" r="52" fill="url(#lg)"/><ellipse cx="74" cy="168" rx="20" ry="11" fill="#FFD666"/><ellipse cx="124" cy="168" rx="20" ry="11" fill="#FFD666"/><circle cx="92" cy="112" r="3" fill="#fff"/></svg>';
    host.appendChild(d);
    api.destroy = () => d.remove();
    return api;
  };

  let ogl;
  try { ogl = await import('https://esm.sh/ogl@1.0.11'); } catch (e) { return fallback(); }

  let renderer, gl, mesh, program;
  try {
    const { Renderer, Program, Mesh, Triangle } = ogl;
    renderer = new Renderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, dpr: 1, depth: false });
    gl = renderer.gl;
    if (!gl) throw new Error('no gl');
    host.appendChild(canvas);
    gl.clearColor(0, 0, 0, 0);
    program = new Program(gl, {
      vertex: VERT, fragment: FRAG, transparent: false, depthTest: false, depthWrite: false, cullFace: false,
      uniforms: {
        uRes: { value: [1, 1] }, uPx: { value: 0.003 },
        uA: { value: [0, 0, 0, 0] }, uB: { value: [0, 0, 0, 0] }, uC: { value: [0, 0, 0, 1] }, uD: { value: [0, 0, 0, 0] },
      },
    });
    mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  } catch (e) {
    return fallback();
  }

  // ---- state ----
  let state = 'normal', calm = !!o.calm, still = !!o.still;
  let level = 0, levelRaw = 0, lookX = 0, lookY = 0, lx = 0, ly = 0;
  let clock = o.t0 || 0;
  let settleUntil = -1;
  let running = false, raf = 0, visible = true, last = 0, destroyed = false;
  const S = {};
  for (const k in REST) S[k] = { x: REST[k], v: 0 };
  const lean = { x: 0, v: 0 };

  function targets() {
    const k = calm ? 0.3 : 1;
    const lv = level * (calm ? 0.4 : 1);
    const t = Object.assign({}, REST);
    let tau = 0.16;
    if (state === 'listening') {
      t.earA = REST.earA + k * (0.34 + 0.12 * lv);
      t.earB = REST.earB + k * (0.3 + 0.1 * lv);
      t.glow = REST.glow + k * (0.08 + 0.3 * lv);
      t.coreS = 1 + k * 0.1 * lv;
      t.spark = k * (0.55 + 0.45 * lv);
      t.bounce = k * 0.015;
    } else if (state === 'thinking') {
      t.fold = k * 0.82;
      t.earA = REST.earA - k * 0.1;
      t.earB = REST.earB - k * 0.1;
      t.crouch = k * 0.7;
      t.glow = REST.glow + k * 0.1;
      t.spark = k * 0.9;
      tau = 0.2;
    } else if (state === 'speaking') {
      t.glow = REST.glow + k * (0.1 + 0.32 * lv);
      t.coreS = 1 + k * (0.08 + 0.28 * lv);
      t.spark = k * (0.4 + 0.6 * lv);
      t.bounce = k * 0.05 * lv;
      t.earA = REST.earA + k * 0.1 * lv;
      t.earB = REST.earB + k * 0.1 * lv;
    }
    if (clock < settleUntil) tau = 0.2; // return to ready: 600-900 ms
    return { t, tau };
  }

  let sparkTimeRef = 0;
  function step(dt, snap) {
    clock += dt;
    // level smoothing: fast attack, slower release
    const aL = levelRaw > level ? 0.05 : 0.14;
    level = snap ? levelRaw : level + (levelRaw - level) * (1 - Math.exp(-dt / aL));
    lx = snap ? lookX : lx + (lookX - lx) * (1 - Math.exp(-dt / 0.25));
    ly = snap ? lookY : ly + (lookY - ly) * (1 - Math.exp(-dt / 0.25));
    const { t, tau } = targets();
    for (const k in S) {
      if (snap) { S[k].x = t[k]; S[k].v = 0; } else spring(S[k], t[k], dt, k === 'bounce' ? 0.1 : tau);
    }
    spring(lean, -lx * 0.065, snap ? 0 : dt, 0.3);
    if (snap) lean.x = -lx * 0.065;

    const idleOn = !calm && !still;
    const T = clock;
    const breath = 1 + (idleOn ? 0.018 * Math.sin((T / 4.5) * Math.PI * 2) : 0);
    const twA = idleOn ? 0.045 * Math.sin((T / 4.5) * Math.PI * 2 + 0.6) + 0.02 * Math.sin(T * 1.3) : 0;
    const twB = idleOn ? 0.05 * Math.sin((T / 3.8) * Math.PI * 2 + 2.0) : 0;
    let wigA = 0, wigB = 0, bobY = 0, coreP = 0;
    const k = calm ? 0.3 : 1;
    if (state === 'speaking' && !still) {
      wigA = 0.16 * level * k * Math.sin(T * 9.5);
      wigB = 0.16 * level * k * Math.sin(T * 9.5 + 1.7);
      bobY = 0.03 * level * k * Math.abs(Math.sin(T * 6.5));
    }
    if (state === 'thinking' && !still && !calm) {
      coreP = 0.12 * Math.sin((T / 1.2) * Math.PI * 2);
    }
    // sparks flicker per state
    const sp = Math.max(0, S.spark.x);
    let s0, s1, s2;
    if (state === 'thinking') {
      const f = (i) => Math.pow(Math.max(0, Math.sin(((T / 1.2) - i * 0.28) * Math.PI * 2)), 2);
      s0 = sp * (still ? 1 : f(0)); s1 = sp * (still ? 1 : f(1)); s2 = sp * (still ? 1 : f(2));
    } else if (state === 'normal') {
      s0 = s1 = s2 = sp; // fades out during return to ready
    } else {
      const g = (i) => still ? 1 : 0.55 + 0.45 * Math.sin(T * 7 + i * 2.1) * (0.4 + 0.6 * level);
      s0 = sp * g(0); s1 = sp * g(1); s2 = sp * g(2);
    }
    const u = program.uniforms;
    u.uA.value = [S.earA.x + twA + wigA, S.earB.x + twB + wigB, clamp(S.fold.x, 0, 1), clamp(S.crouch.x, 0, 1)];
    u.uB.value = [clamp(S.glow.x + coreP, 0, 1.25), S.coreS.x, S.bounce.x + bobY, lean.x];
    u.uC.value = [clamp(s0, 0, 1), clamp(s1, 0, 1), clamp(s2, 0, 1), breath];
    u.uD.value = [lx, ly, level, T];
  }

  function resize() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    const cap = 640 / Math.max(w, h);
    if (cap < 1) { w = Math.round(w * cap); h = Math.round(h * cap); }
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h);
      canvas.style.width = '100%'; canvas.style.height = '100%';
    }
    program.uniforms.uRes.value = [w, h];
    program.uniforms.uPx.value = 1 / Math.min(w, h);
  }

  function draw() {
    resize();
    renderer.render({ scene: mesh });
  }

  function frame(now) {
    raf = 0;
    if (!running || destroyed) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (visible && !document.hidden) { step(dt, false); draw(); }
    raf = requestAnimationFrame(frame);
  }

  function renderStill() { step(0.0001, true); draw(); }

  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) last = 0; })
    : null;
  if (io) io.observe(host);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!running) renderStill(); }) : null;
  if (ro) ro.observe(host);

  Object.assign(api, {
    setState(s) {
      if (!['normal', 'listening', 'thinking', 'speaking'].includes(s) || s === state) return;
      if (s === 'normal') settleUntil = clock + 0.9;
      state = s;
      if (still || !running) renderStill();
    },
    setLevel(x) { levelRaw = clamp(+x || 0, 0, 1); if (still) renderStill(); },
    setLook(x, y) { lookX = clamp(+x || 0, -1, 1); lookY = clamp(+y || 0, -1, 1); if (still) renderStill(); },
    setCalm(b) { calm = !!b; if (still || !running) renderStill(); },
    start() {
      if (destroyed || running) return;
      if (still) { renderStill(); return; }
      running = true; last = 0; raf = requestAnimationFrame(frame);
    },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    destroy() {
      destroyed = true; api.stop();
      if (io) io.disconnect(); if (ro) ro.disconnect();
      try { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {}
      canvas.remove();
    },
  });

  renderStill();
  if (!still) api.start();
  return api;
}
