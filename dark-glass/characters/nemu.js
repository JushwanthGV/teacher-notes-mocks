// Nemu - a sleepy yet intelligent companion. Procedural SDF raymarch (OGL), no assets.
// Interface: create(host, opts) -> { setState, setLevel, setLook, setCalm, start, stop, destroy }

const VERT = `
attribute vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uPx;
uniform vec4 uA; // lift, headLift, roll, yaw
uniform vec4 uB; // earPerk, earTilt, tailCurl, tailWag
uniform vec4 uC; // active glow, curl, breath, bubbles
uniform vec4 uD; // spark, earWigL, earWigR, time
uniform vec4 uE; // lookX, lookY, level, eyeOpen

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

const vec3 PIV = vec3(-0.8, -0.6, 0.0);

// lift the front of the body about the rump
vec3 lifted(vec3 p){
  vec3 q = p - PIV;
  q.xy = rot(uA.x) * q.xy;
  return q + PIV;
}
vec3 headLocal(vec3 p){
  vec3 q = lifted(p);
  vec3 hc = vec3(0.5 - 0.06 * uC.y, 0.08 + uA.y, 0.14);
  vec3 h = q - hc;
  float a = 0.62 + uA.w;
  vec3 l = vec3(cos(a) * h.x - sin(a) * h.z, h.y, sin(a) * h.x + cos(a) * h.z);
  l.xy = rot(uA.z) * l.xy;
  return l;
}
float earD(vec3 hl, float side, float wig){
  float perk = uB.x;
  float outward = 0.3 - 0.22 * perk;
  float ang = side * outward + uB.y * 0.5 + wig;
  float len = 0.34 + 0.12 * perk;
  vec3 base = vec3(side * 0.25, 0.28, -0.02);
  vec3 tip = base + vec3(sin(ang), cos(ang), 0.0) * len;
  vec3 e = hl - base; e.z *= 1.6; vec3 b2 = tip - base; b2.z *= 1.6;
  return sdRC(e, vec3(0.0), b2, 0.21, 0.09) * 0.66;
}
float tailD(vec3 p){
  float cu = uB.z, wg = uB.w;
  vec3 T0 = vec3(-0.8, -0.1, -0.05);
  vec3 T1 = vec3(-1.0, -0.3, 0.3 + wg * 0.1);
  vec3 T2 = mix(vec3(-0.75, -0.46, 0.64), vec3(-0.5, -0.48, 0.72), cu) + vec3(0.0, wg * 0.1, wg * 0.18);
  vec3 T3 = mix(vec3(-0.3, -0.48, 0.72), vec3(0.14, -0.48, 0.78), cu) + vec3(0.0, wg * 0.14, wg * 0.28);
  float d = sdRC(p, T0, T1, 0.16, 0.14);
  d = min(d, sdRC(p, T1, T2, 0.14, 0.125));
  d = min(d, sdRC(p, T2, T3, 0.125, 0.1));
  return d;
}
float pawD(vec3 q){
  return sdEll(q - vec3(0.56, -0.41, 0.42), vec3(0.4, 0.19, 0.2));
}

float map(vec3 p){
  vec3 q = lifted(p);
  float cu = uC.y;
  float body = sdEll(q - vec3(-0.2, -0.08 + 0.03 * cu, 0.0), vec3(0.78 * (1.0 - 0.1 * cu), 0.54 * uC.z, 0.6));
  float hip = sdEll(q - vec3(-0.5, -0.2, 0.1), vec3(0.44, 0.4, 0.44));
  float d = smin(body, hip, 0.2);
  vec3 hl = headLocal(p);
  float head = sdEll(hl, vec3(0.52, 0.43, 0.46));
  d = smin(d, head, 0.16);
  d = smin(d, pawD(q), 0.1);
  float ears = min(earD(hl, -1.0, uD.y), earD(hl, 1.0, uD.z));
  d = smin(d, ears, 0.07);
  d = smin(d, tailD(p), 0.1);
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
  vec3 ro = vec3(0.1, 1.2, 6.4);
  vec3 ta = vec3(-0.02, -0.08, 0.0);
  vec3 ww = normalize(ta - ro), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 2.25 * ww);

  vec3 cBase = vec3(0.914, 0.894, 1.0);
  vec3 cAcc = vec3(0.655, 0.545, 0.98);
  vec3 cHi = vec3(0.78, 0.706, 1.0);
  vec3 cShade = vec3(0.47, 0.4, 0.82);
  float act = uC.x;

  // floor: soft contact shadow + violet glow that only shows when active
  float FY = -0.64;
  vec4 floorL = vec4(0.0);
  float tf = (FY - ro.y) / rd.y;
  if (tf > 0.0) {
    vec3 fp = ro + rd * tf;
    vec2 fq = vec2((fp.x + 0.2) / 1.25, (fp.z - 0.12) / 0.85);
    float r2 = dot(fq, fq);
    float gA = act * 0.5 * exp(-r2 * 1.5);
    float sA = 0.42 * exp(-r2 * 3.2);
    floorL = vec4(cAcc * gA, gA);
    floorL.rgb = floorL.rgb * (1.0 - sA) + vec3(0.05, 0.03, 0.16) * sA;
    floorL.a = floorL.a * (1.0 - sA) + sA;
  }

  vec4 res = floorL;
  vec3 bc = vec3(-0.1, 0.0, 0.1); float R = 2.2;
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
    float halo = exp(-max(dmin, 0.0) * 5.0) * (0.02 + 0.3 * act) * edge;
    vec3 col = vec3(0.0); float a = 0.0;
    if (hit) {
      vec3 p = ro + rd * t; vec3 n = calcN(p); vec3 q = lifted(p);
      float ndv = clamp(dot(n, -rd), 0.0, 1.0);
      float fr = pow(1.0 - ndv, 3.0);
      float ao = clamp(map(p + n * 0.2) / 0.2, 0.0, 1.0);
      vec3 L = normalize(vec3(-0.35, 0.85, 0.5));
      float lam = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
      lam = lam * lam * (3.0 - 2.0 * lam);
      col = mix(cShade, cBase, 0.12 + 0.88 * lam);
      col = mix(cShade * 0.82, col, 0.55 + 0.45 * ao);
      // violet bounce from the floor on downward-facing parts
      col += cAcc * 0.22 * clamp(-n.y, 0.0, 1.0) * (0.5 + act);
      col += cHi * fr * 0.28;
      // front paw is a little lighter
      float pw = pawD(q);
      col = mix(col, vec3(0.97, 0.95, 1.0) * (0.78 + 0.22 * lam), smoothstep(0.05, 0.0, pw) * 0.5);
      // closed-eye lines on the head, as drawn on the sheet
      vec3 hl = headLocal(p);
      float headProx = 1.0 - smoothstep(0.0, 0.05, abs(sdEll(hl, vec3(0.52, 0.43, 0.46))));
      float eyes = 0.0;
      float opn = clamp(uE.w, 0.0, 1.0);
      float arcW = 1.0 - smoothstep(0.08, 0.45, opn);
      float openE = 0.0, lite = 0.0;
      for (int k = 0; k < 2; k++) {
        float sx = k == 0 ? -1.0 : 1.0;
        float dx = hl.x - sx * 0.19;
        // closed-eye arc (sleepy)
        float ty = -0.005 - 0.04 * (1.0 - clamp(dx * dx / (0.09 * 0.09), 0.0, 1.0));
        float ln = abs(hl.y - ty) - 0.0075;
        float m = 1.0 - smoothstep(0.075, 0.095, abs(dx));
        eyes = max(eyes, (1.0 - smoothstep(0.0, 0.006, ln)) * m);
        // open eye: soft rounded oval, eyelid comes down from the top
        vec2 ec = vec2(dx, hl.y - 0.0);
        float oe = length(ec / vec2(0.058, 0.074)) - 1.0;
        float lidY = 0.074 * (2.0 * opn - 1.0);
        float lid = 1.0 - smoothstep(-0.006, 0.01, ec.y - lidY);
        float shape = 1.0 - smoothstep(-0.08, 0.06, oe);
        float vis = shape * lid;
        openE = max(openE, vis);
        float cl = 1.0 - smoothstep(0.0, 0.012, length(ec - vec2(0.02, 0.028)) - 0.013);
        lite = max(lite, cl * lid * smoothstep(0.55, 1.0, opn));
      }
      float surf = headProx * step(0.12, hl.z);
      eyes *= surf * arcW;
      openE *= surf; lite *= surf;
      col = mix(col, vec3(0.3, 0.21, 0.58), eyes * 0.9);
      col = mix(col, vec3(0.184, 0.165, 0.333), openE * 0.96);
      col = mix(col, vec3(1.0, 0.99, 1.0), lite * 0.95);
      // soft glow only when active
      col += cAcc * act * (0.1 + 0.42 * fr + 0.1 * (1.0 - lam));
      col += cHi * act * 0.06;
      a = 1.0;
    } else {
      a = 1.0 - smoothstep(0.0, uPx * 1.6, dmin);
    }
    vec3 haloCol = mix(cAcc, cHi, 0.3);
    vec3 rgb = col * a + haloCol * halo * (1.0 - a);
    float al = a + halo * (1.0 - a);
    res = vec4(rgb + res.rgb * (1.0 - al), al + res.a * (1.0 - al));
  }

  // accent sparks (like the sheet): three short dashes right of the head
  float s = uD.x;
  float sp = 0.0;
  sp = max(sp, (1.0 - smoothstep(0.0, uPx * 1.5, dash(uv, vec2(0.4, 0.25), 0.9, 0.024, 0.0095))) * s);
  sp = max(sp, (1.0 - smoothstep(0.0, uPx * 1.5, dash(uv, vec2(0.44, 0.19), 0.15, 0.02, 0.0095))) * s);
  sp = max(sp, (1.0 - smoothstep(0.0, uPx * 1.5, dash(uv, vec2(0.4, 0.13), -0.7, 0.014, 0.0095))) * s);
  // thinking bubbles
  float bb1 = (1.0 - smoothstep(0.0, uPx * 1.5, length(uv - vec2(0.05, 0.33)) - 0.017)) * uC.w;
  float bb2 = (1.0 - smoothstep(0.0, uPx * 1.5, length(uv - vec2(0.12, 0.375)) - 0.026)) * uC.w;
  sp = max(sp, max(bb1, bb2));
  vec3 spc = mix(cAcc, cHi, 0.35);
  res.rgb = res.rgb * (1.0 - sp) + spc * sp;
  res.a = res.a * (1.0 - sp) + sp;

  gl_FragColor = res;
}
`;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// critically damped spring: settles in ~ 4*tau
function spring(s, target, dt, tau) {
  const w = 2 / tau;
  const x = s.x - target;
  const e = Math.exp(-w * dt);
  const nx = (x + (s.v + w * x) * dt) * e;
  s.v = (s.v - (s.v + w * x) * w * dt) * e;
  s.x = target + nx;
}

const REST = { lift: 0, headLift: 0, roll: 0, perk: 0, curl: 0, tailCurl: 0, glow: 0.06, spark: 0, bub: 0, lowBody: 0 };

export async function create(host, opts = {}) {
  const o = Object.assign({ calm: false, still: false, t0: 0 }, opts);
  const api = { setState() {}, setLevel() {}, setLook() {}, setCalm() {}, start() {}, stop() {}, destroy() {} };

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.character = 'nemu';
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const fallback = () => {
    canvas.remove();
    const d = document.createElement('div');
    d.dataset.character = 'nemu';
    d.dataset.fallback = '1';
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none';
    d.innerHTML = '<svg viewBox="0 0 240 160" width="90%" height="90%" aria-hidden="true"><defs><radialGradient id="ng" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#F3F0FF"/><stop offset="1" stop-color="#A78BFA"/></radialGradient></defs><ellipse cx="105" cy="108" rx="82" ry="40" fill="url(#ng)"/><path d="M40 112 C10 120 18 150 70 146" fill="none" stroke="#C7B4FF" stroke-width="16" stroke-linecap="round"/><ellipse cx="150" cy="82" rx="42" ry="34" fill="url(#ng)"/><path d="M122 62 L128 28 L150 52Z M154 52 L176 30 L184 66Z" fill="#E9E4FF"/><path d="M135 84 Q143 90 151 84 M160 84 Q168 90 176 84" fill="none" stroke="#4D3A94" stroke-width="3" stroke-linecap="round"/><ellipse cx="160" cy="124" rx="32" ry="12" fill="#F6F3FF"/></svg>';
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
        uA: { value: [0, 0, 0, 0] }, uB: { value: [0, 0, 0, 0] }, uC: { value: [0, 0, 1, 0] },
        uD: { value: [0, 0, 0, 0] }, uE: { value: [0, 0, 0, 0] },
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
  let eyeOpen = 0, nextBlink = 2.5, blinkT = -1;
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
      t.perk = k * 1;
      t.lift = k * (0.11 + 0.04 * lv);
      t.headLift = k * (0.13 + 0.04 * lv);
      t.roll = k * 0.12;
      t.glow = REST.glow + k * k * (0.28 + 0.5 * lv) * (calm ? 1.5 : 1) / (calm ? 1.5 : 1);
      t.spark = k * (0.5 + 0.5 * lv);
    } else if (state === 'thinking') {
      t.curl = k;
      t.tailCurl = k;
      t.perk = -0.8 * k;
      t.headLift = -0.09 * k;
      t.lift = -0.03 * k;
      t.roll = -0.08 * k;
      t.glow = REST.glow + k * 0.3;
      t.bub = k;
      tau = 0.22;
    } else if (state === 'speaking') {
      t.perk = k * 0.45;
      t.lift = k * (0.05 + 0.05 * lv);
      t.headLift = k * (0.06 + 0.07 * lv);
      t.glow = REST.glow + k * (0.2 + 0.55 * lv);
      t.spark = k * (0.35 + 0.65 * lv);
    }
    if (clock < settleUntil) tau = 0.2; // return to ready: 600-900 ms
    return { t, tau };
  }

  function step(dt, snap) {
    clock += dt;
    const aL = levelRaw > level ? 0.05 : 0.14;
    level = snap ? levelRaw : level + (levelRaw - level) * (1 - Math.exp(-dt / aL));
    lx = snap ? lookX : lx + (lookX - lx) * (1 - Math.exp(-dt / 0.25));
    ly = snap ? lookY : ly + (lookY - ly) * (1 - Math.exp(-dt / 0.25));
    const { t, tau } = targets();
    for (const k in S) {
      if (snap) { S[k].x = t[k]; S[k].v = 0; } else spring(S[k], t[k], dt, tau);
    }
    const T = clock;
    const k = calm ? 0.3 : 1;
    const idleOn = !calm && !still;
    const breath = 1 + (idleOn ? 0.022 * Math.sin((T / 4.5) * Math.PI * 2) : 0);
    let wigL = idleOn ? 0.05 * Math.sin((T / 4.5) * Math.PI * 2 + 0.4) : 0;
    let wigR = idleOn ? 0.06 * Math.sin((T / 3.9) * Math.PI * 2 + 2.2) : 0;
    let wag = idleOn ? 0.35 * Math.sin((T / 4.5) * Math.PI * 2 + 1.1) : 0;
    let bob = 0;
    if (state === 'speaking' && !still) {
      wigL += 0.12 * level * k * Math.sin(T * 8.5);
      wigR += 0.12 * level * k * Math.sin(T * 8.5 + 1.5);
      wag += 0.9 * level * k * Math.sin(T * 7.0);
      bob = 0.03 * level * k * Math.sin(T * 6.0);
    } else if (state === 'listening' && !still) {
      wag += 0.3 * k * Math.sin(T * 3.2);
      wigL += 0.03 * level * k * Math.sin(T * 7);
    } else if (state === 'thinking' && !still && !calm) {
      wigL += 0.05 * Math.sin((T / 1.2) * Math.PI * 2);
      wigR += 0.05 * Math.sin((T / 1.2) * Math.PI * 2 + 0.8);
      wag += 0.25 * Math.sin((T / 1.2) * Math.PI * 2);
    }
    // sparks flicker; thinking bubbles stay steady
    const sp = Math.max(0, S.spark.x);
    const spark = (still || state === 'normal') ? sp : sp * (0.7 + 0.3 * Math.sin(T * 8) * (0.4 + 0.6 * level));
    spring(lean, -lx * 0.07, snap ? 0 : dt, 0.3);
    if (snap) lean.x = -lx * 0.07;
    const u = program.uniforms;
    u.uA.value = [S.lift.x, S.headLift.x + bob, S.roll.x + lean.x, -lx * 0.05];
    u.uB.value = [S.perk.x, lx * 0.35, clamp(S.tailCurl.x, 0, 1), wag];
    u.uC.value = [clamp(S.glow.x, 0, 1.2), clamp(S.curl.x, 0, 1), breath, clamp(S.bub.x, 0, 1)];
    u.uD.value = [clamp(spark, 0, 1), wigL, wigR, T];
    // eyes: closed while ready/thinking, open while listening/speaking (~200 ms lid blend, instant in calm)
    const wantOpen = (state === 'listening' || state === 'speaking') ? 1 : 0;
    if (snap || calm) eyeOpen = wantOpen;
    else eyeOpen += clamp(wantOpen - eyeOpen, -dt / 0.2, dt / 0.2);
    let blink = 1;
    if (wantOpen && !calm && !still) {
      if (blinkT < 0 && T > nextBlink) blinkT = 0;
      if (blinkT >= 0) {
        blinkT += dt;
        const bp = blinkT / 0.17;
        blink = bp >= 1 ? 1 : 1 - Math.sin(bp * Math.PI);
        if (bp >= 1) { blinkT = -1; nextBlink = T + 2.8 + Math.random() * 3.2; }
      }
    } else { blinkT = -1; if (T > nextBlink) nextBlink = T + 1.5; }
    u.uE.value = [lx, ly, level, eyeOpen * blink];
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
