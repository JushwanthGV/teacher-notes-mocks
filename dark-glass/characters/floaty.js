/* Floaty - soft cloud of blended spheres with a few small orbiting orbs.
   Procedural SDF raymarching on OGL (Unlicense, from esm.sh). No assets.
   Interface (shared by all characters): create(host, opts) -> { setState, setLevel, setLook, setCalm, start, stop, destroy }
   Sheet: refs-characters/floaty.png. Palette: body #EBF1FF, accent #B7D4FF, highlight #7AA5FF, background #1E2A5B. */
const OGL_URL = 'https://esm.sh/ogl@1.0.11';
const STATES = ['normal', 'listening', 'thinking', 'speaking'];
const ENTER = 0.5, RETURN = 0.75;          // seconds (sheet: transitions 400-900 ms, return to ready 600-900 ms)
const NS = 6, NO = 3;

const VERT = `precision highp float;attribute vec2 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,0.0,1.0);}`;

const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uRot; uniform vec3 uShift;
uniform vec4 uS0,uS1,uS2,uS3,uS4,uS5;       // body spheres (xyz, r) in body space
uniform vec4 uO0,uO1,uO2;                   // orbs (xyz, r) in world space
uniform float uK;                            // smooth-union softness
uniform float uGlow, uRays, uLevel;
varying vec2 vUv;

const vec3 L = vec3(-0.40, 0.68, -0.60);
mat3 R;

mat3 rotM(vec3 a){
  float cy=cos(a.x), sy=sin(a.x), cx=cos(a.y), sx=sin(a.y), cz=cos(a.z), sz=sin(a.z);
  mat3 Y=mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
  mat3 X=mat3(1.,0.,0., 0.,cx,sx, 0.,-sx,cx);
  mat3 Z=mat3(cz,sz,0., -sz,cz,0., 0.,0.,1.);
  return Z*X*Y;
}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float sph(vec3 p,vec4 s){return length(p-s.xyz)-s.w;}
float body(vec3 p){
  float d=sph(p,uS0);
  d=smin(d,sph(p,uS1),uK);d=smin(d,sph(p,uS2),uK);d=smin(d,sph(p,uS3),uK);
  d=smin(d,sph(p,uS4),uK);d=smin(d,sph(p,uS5),uK);
  return d;
}
vec2 map(vec3 w){
  vec3 pl=R*(w-uShift);
  float db=body(pl);
  vec2 r=vec2(db,1.);
  float d0=sph(w,uO0);if(d0<r.x)r=vec2(d0,2.);
  float d1=sph(w,uO1);if(d1<r.x)r=vec2(d1,2.);
  float d2=sph(w,uO2);if(d2<r.x)r=vec2(d2,2.);
  return r;
}
float mapD(vec3 w){return map(w).x;}
vec3 normalAt(vec3 p){
  const vec2 e=vec2(1.,-1.)*.0010;
  return normalize(e.xyy*mapD(p+e.xyy)+e.yyx*mapD(p+e.yyx)+e.yxy*mapD(p+e.yxy)+e.xxx*mapD(p+e.xxx));
}
float aoAt(vec3 p,vec3 n){
  float o=0.,s=1.;
  for(int i=1;i<=4;i++){float h=.05+.10*float(i);o+=(h-mapD(p+n*h))*s;s*=.6;}
  return clamp(1.-1.5*o,0.,1.);
}
float seg(vec2 p,vec2 a,vec2 b,float r){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}

vec3 shadeBody(vec3 p,vec3 n,vec3 rd){
  float ao=aoAt(p,n);
  float lam=dot(n,L)*.5+.5;lam=lam*lam*(3.-2.*lam);
  vec3 hi=vec3(.922,.945,1.);          // #EBF1FF
  vec3 mid=vec3(.718,.831,1.);         // #B7D4FF
  vec3 deep=vec3(.478,.647,1.);        // #7AA5FF
  vec3 col=mix(mid*.93,hi,lam);
  // cool underside, soft translucent gradient
  float low=clamp(-n.y*.5+.5,0.,1.);
  col=mix(col,mix(mid,deep,.55),low*.7*(1.-lam*.45));
  col*=mix(.68,1.,ao);
  // soft subsurface glow in the valleys between lobes
  col+=deep*(1.-ao)*.10;
  // rim, no gloss
  float fr=pow(1.-max(dot(n,-rd),0.),2.6);
  col+=mix(hi,deep,.35)*fr*.14;
  return col;
}
vec3 shadeOrb(vec3 n,vec3 rd){
  float top=clamp(dot(n,normalize(vec3(-.35,.8,-.5)))*.5+.5,0.,1.);
  vec3 col=mix(vec3(.478,.647,1.),vec3(.80,.89,1.),top*top);
  float fr=pow(1.-max(dot(n,-rd),0.),2.2);
  col+=vec3(.7,.82,1.)*fr*.18;
  return col;
}

void main(){
  vec2 uv=(vUv-.5)*2.;
  uv.x*=uRes.x/uRes.y;
  R=rotM(uRot);
  vec3 ro=vec3(0.,0.,-4.);
  vec3 rd=normalize(vec3(uv*.345,1.));
  float t=2.2,dmin=1e5,tmin=t;
  vec2 h=vec2(0.);bool hit=false;
  for(int i=0;i<64;i++){
    vec3 p=ro+rd*t;h=map(p);
    if(h.x<dmin){dmin=h.x;tmin=t;}
    if(h.x<.0012){hit=true;break;}
    t+=h.x*.9;
    if(t>6.)break;
  }
  vec3 col=vec3(0.);float a=0.;
  if(hit||dmin<.014){
    float tt=hit?t:tmin;
    vec3 p=ro+rd*tt;vec2 m=map(p);vec3 n=normalAt(p);
    col=(m.y<1.5)?shadeBody(p,n,rd):shadeOrb(n,rd);
    a=hit?1.:1.-smoothstep(0.,.014,dmin);
    col*=a;
  }
  // soft ambient glow that follows activity (not too bright)
  {
    float g=uGlow*exp(-max(dmin,0.)*5.5)*.30;
    vec3 gc=vec3(.48,.65,1.);
    col+=gc*g*(1.-a);
    a=clamp(a+g*.9*(1.-a),0.,1.);
  }
  // a few small dashes while listening / speaking (sheet), blue accent
  if(uRays>.002){
    vec2 w=uv*.345*4.;
    float d=1e3;
    d=min(d,seg(w,vec2(.92,.88),vec2(1.04,.98),.018));
    d=min(d,seg(w,vec2(1.06,.70),vec2(1.22,.74),.018));
    d=min(d,seg(w,vec2(1.06,.50),vec2(1.18,.45),.018));
    float r=(1.-smoothstep(0.,.012,d))*uRays*(.6+.4*uLevel);
    col+=vec3(.48,.65,1.)*r*(1.-a);
    a=clamp(a+r,0.,1.);
  }
  gl_FragColor=vec4(clamp(col,0.,1.),a);
}`;

export async function create(host, opts = {}) {
  const o = Object.assign({ calm: false, still: false, t0: 0 }, opts);
  let ogl;
  try { ogl = await import(OGL_URL); }
  catch (e) { console.warn('[floaty] OGL failed to load, using fallback', e); return fallback(host, o); }
  try { return build(ogl, host, o); }
  catch (e) { console.warn('[floaty] WebGL setup failed, using fallback', e); return fallback(host, o); }
}

function fallback(host, o) {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none';
  wrap.innerHTML = '<svg viewBox="0 0 120 120" width="100%" height="100%"><defs><radialGradient id="flB" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#EBF1FF"/><stop offset="1" stop-color="#B7D4FF"/></radialGradient></defs>'
    + '<g fill="url(#flB)"><circle cx="60" cy="62" r="22"/><circle cx="40" cy="64" r="16"/><circle cx="80" cy="63" r="17"/><circle cx="50" cy="46" r="17"/><circle cx="70" cy="46" r="15"/></g>'
    + '<circle cx="18" cy="70" r="6" fill="#7AA5FF"/><circle cx="104" cy="76" r="6" fill="#7AA5FF"/></svg>';
  host.appendChild(wrap);
  return {
    fallback: true,
    setState() {}, setLevel() {}, setLook() {}, setCalm() {}, start() {}, stop() {},
    destroy() { wrap.remove(); },
  };
}

// rest layout (body space): x, y, z, r
const REST = [
  [0.00, -0.02, 0.00, 0.43],
  [-0.52, -0.17, 0.02, 0.29],
  [0.52, -0.15, 0.00, 0.31],
  [-0.22, 0.36, 0.04, 0.33],
  [0.26, 0.32, 0.00, 0.29],
  [0.00, -0.36, 0.05, 0.27],
];

function build(ogl, host, o) {
  const { Renderer, Program, Mesh, Triangle } = ogl;
  const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
  const gl = renderer.gl;
  if (!gl) throw new Error('no WebGL');
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const uniforms = {
    uRes: { value: [1, 1] }, uTime: { value: 0 }, uRot: { value: [0, 0, 0] }, uShift: { value: [0, 0, 0] },
    uK: { value: .12 }, uGlow: { value: .3 }, uRays: { value: 0 }, uLevel: { value: 0 },
  };
  for (let i = 0; i < NS; i++) uniforms['uS' + i] = { value: REST[i].slice() };
  for (let i = 0; i < NO; i++) uniforms['uO' + i] = { value: [1, 0, 0, .07] };
  const program = new Program(gl, { vertex: VERT, fragment: FRAG, uniforms });
  if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) throw new Error('shader link failed');
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  const U = program.uniforms;

  const W = { normal: 1, listening: 0, thinking: 0, speaking: 0 };
  let target = 'normal', calm = o.calm ? 1 : 0, calmGoal = calm;
  let level = 0, levelS = 0, lookT = [0, 0], look = [0, 0];
  let running = false, raf = 0, visible = true, destroyed = false;
  let clock = o.still ? o.t0 : 0, last = 0, thinkClock = 0;
  const ease = x => x * x * (3 - 2 * x);
  const TAU = 6.2832;

  function size() {
    const w = Math.max(1, Math.round(host.clientWidth)), h = Math.max(1, Math.round(host.clientHeight));
    renderer.setSize(w, h);
    U.uRes.value = [gl.canvas.width, gl.canvas.height];
    if (o.still || !running) draw();
  }

  function params() {
    let sum = 0; const e = {};
    for (const s of STATES) { e[s] = ease(W[s]); sum += e[s]; }
    if (sum < 1e-4) { e.normal = 1; sum = 1; }
    for (const s of STATES) e[s] /= sum;
    const amp = 1 - .7 * calm, idle = 1 - calm;
    const L = levelS, t = clock;
    const lx = look[0], ly = look[1];
    const th = thinkClock;                      // seconds inside the thinking state
    const swirl = e.thinking * amp * (calm > .5 ? 0 : 1);

    const spheres = [];
    for (let i = 0; i < NS; i++) {
      const r0 = REST[i];
      let x = r0[0], y = r0[1], z = r0[2], r = r0[3];
      // idle: each lobe breathes on its own phase (4-5 s loop)
      const ph = i * 1.3;
      x += Math.sin(t * TAU / 4.6 + ph) * .018 * idle;
      y += Math.sin(t * TAU / 4.2 + ph * 1.7) * .018 * idle;
      r *= 1 + Math.sin(t * TAU / 4.8 + ph) * .03 * idle;
      // listening: body stretches slightly toward the voice, spheres lean forward
      x = x * (1 + .07 * e.listening * amp) + .05 * e.listening * amp;
      y = y * (1 - .04 * e.listening * amp);
      z -= .06 * e.listening * amp;
      r *= 1 + e.listening * L * .05 * amp;
      // thinking: compact, lobes swirl around the centre, then settle
      const ang = swirl * (Math.sin(th * TAU / 1.2 + i * .9) * .34 + th * .0);
      const cx = Math.cos(ang), sx = Math.sin(ang);
      const k = 1 - .13 * swirl;
      const nx = (x * cx - y * sx) * k, ny = (x * sx + y * cx) * k;
      x = nx; y = ny + .04 * swirl;
      r *= 1 - .05 * swirl;
      // speaking: expands and contracts with the voice
      const sp = e.speaking * amp;
      x *= 1 + sp * (.04 + .10 * L); y *= 1 + sp * (.03 + .08 * L);
      r *= 1 + sp * (.03 + .12 * L);
      spheres.push([x, y, z, r]);
    }
    // orbs: slow orbit when idle, closer + reactive when listening, up and orbiting while thinking, outward and bouncing while speaking
    const orbs = [];
    const base = [[-1.00, -.28, -.12, .085, 4.7, 0.0], [.98, -.38, -.10, .075, 5.3, 2.1], [.62, .74, -.05, .05, 4.1, 4.0]];
    for (let i = 0; i < NO; i++) {
      const [bx, by, bz, br, per, ph] = base[i];
      let x = bx + Math.sin(t * TAU / per + ph) * .05 * idle;
      let y = by + Math.sin(t * TAU / (per * .8) + ph + 1) * .07 * idle;
      let z = bz;
      // listening: move closer to the body and react to the mic level
      x -= Math.sign(bx) * .12 * e.listening * amp; y += .05 * e.listening * amp;
      let r = br * (1 + e.listening * L * .35 * amp);
      // thinking: orbit above/around the cloud, 1.2 s per loop, then pause (last quarter holds)
      if (swirl > 0) {
        const u = (th % 1.2) / 1.2, run = u < .75 ? ease(u / .75) : 1;
        const a2 = run * TAU + i * 2.1;
        const ox = Math.cos(a2) * (.62 + i * .05), oy = .72 + Math.sin(a2) * (.14 + i * .02);
        x += (ox - x) * swirl; y += (oy - y) * swirl; z += (-.05 - z) * swirl;
      }
      // speaking: move outward, bounce on the voice
      x += Math.sign(bx) * (.07 + .12 * L) * e.speaking * amp; y += (Math.sin(t * 9 + i * 1.7) * .02 + .10 * L * (i % 2 ? -1 : 1)) * e.speaking * amp;
      r *= 1 + e.speaking * L * .25 * amp;
      orbs.push([x, y, z, r]);
    }
    const bob = Math.sin(t * TAU / 5.0) * .028 * idle + e.speaking * L * .02 * amp;
    return {
      spheres, orbs,
      rot: [lx * .07 - e.listening * .06 * amp, -ly * .05, -lx * .025 - e.listening * .04 * amp + Math.sin(t * TAU / 6) * .01 * idle],
      shift: [lx * .04 + e.listening * .06 * amp, bob - ly * .02 + e.listening * .02 * amp, 0],
      k: .12 + .04 * swirl,
      glow: .22 + (e.listening * (.25 + .35 * L) + e.thinking * .35 + e.speaking * (.3 + .4 * L)) * amp,
      rays: (e.listening + e.speaking) * amp * (calm > .5 ? .5 : 1),
    };
  }

  function draw() {
    const p = params();
    U.uTime.value = clock;
    p.spheres.forEach((s, i) => { U['uS' + i].value = s; });
    p.orbs.forEach((s, i) => { U['uO' + i].value = s; });
    U.uRot.value = p.rot; U.uShift.value = p.shift; U.uK.value = p.k;
    U.uGlow.value = p.glow; U.uRays.value = p.rays; U.uLevel.value = levelS;
    if (host.clientWidth > 0 && host.clientHeight > 0) renderer.render({ scene: mesh });
  }

  function step(dt) {
    clock += dt;
    thinkClock = target === 'thinking' ? thinkClock + dt : 0;
    for (const s of STATES) {
      const goal = s === target ? 1 : 0;
      const d = dt / (target === 'normal' ? RETURN : ENTER);
      W[s] = goal > W[s] ? Math.min(goal, W[s] + d) : Math.max(goal, W[s] - d);
    }
    calm += (calmGoal - calm) * Math.min(1, dt / .25);
    if (Math.abs(calmGoal - calm) < .002) calm = calmGoal;
    const k = level > levelS ? 1 - Math.exp(-dt / .05) : 1 - Math.exp(-dt / .16);
    levelS += (level - levelS) * k;
    const kl = 1 - Math.exp(-dt * 9);
    look[0] += (lookT[0] - look[0]) * kl; look[1] += (lookT[1] - look[1]) * kl;
  }

  function loop(now) {
    raf = 0;
    if (!running || destroyed) return;
    if (visible && !document.hidden) {
      const dt = Math.min(.05, last ? (now - last) / 1000 : 0);
      last = now; step(dt); draw();
    } else last = 0;
    raf = requestAnimationFrame(loop);
  }

  const ro = new ResizeObserver(() => size()); ro.observe(host);
  const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) last = 0; }); io.observe(host);
  const onVis = () => { last = 0; };
  document.addEventListener('visibilitychange', onVis);
  size();

  const api = {
    setState(s) {
      if (!STATES.includes(s)) s = 'normal';
      target = s;
      if (o.still) { for (const k of STATES) W[k] = k === s ? 1 : 0; thinkClock = s === 'thinking' ? .45 : 0; draw(); }
    },
    setLevel(x) { level = Math.max(0, Math.min(1, +x || 0)); if (o.still) { levelS = level; draw(); } },
    setLook(x, y) {
      lookT = [Math.max(-1, Math.min(1, +x || 0)), Math.max(-1, Math.min(1, +y || 0))];
      if (o.still) { look = lookT.slice(); draw(); }
    },
    setCalm(b) { calmGoal = b ? 1 : 0; if (o.still) { calm = calmGoal; draw(); } },
    start() {
      if (destroyed || running) return;
      running = true; last = 0;
      if (o.still) draw(); else raf = requestAnimationFrame(loop);
    },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    destroy() {
      destroyed = true; api.stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.remove();
      const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    },
    debug() { return { target, weights: { ...W }, level: levelS, calm, clock, thinkClock }; },
  };
  if (o.still) draw();
  return api;
}
