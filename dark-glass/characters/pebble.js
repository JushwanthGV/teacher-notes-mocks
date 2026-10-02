/* Pebble - soft cream stone with a glowing inner spark and a small detached spark.
   Procedural SDF raymarching on OGL (Unlicense, from esm.sh). No assets.
   Interface (shared by all characters): create(host, opts) -> { setState, setLevel, setLook, setCalm, start, stop, destroy }
   Sheet: refs-characters/pebble.png. Palette: body #F7F3ED, spark #FF9A3C, glow #FFD6A3, shadow #DCCFC4. */
const OGL_URL = 'https://esm.sh/ogl@1.0.11';
const STATES = ['normal', 'listening', 'thinking', 'speaking'];
const ENTER = 0.5, RETURN = 0.75;          // seconds: sheet says transitions 400-900 ms, return to ready 600-900 ms

const VERT = `precision highp float;attribute vec2 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,0.0,1.0);}`;

const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uRot;      // yaw, pitch, roll (radians)
uniform vec3 uShift;    // body offset
uniform float uScale;   // body scale (breathing)
uniform vec3 uSpark;    // x radius, y brightness, z drift
uniform vec4 uDet;      // detached spark xyz, radius
uniform vec2 uGlow;     // x inner glow gain, y detached glow gain
uniform float uLevel, uRays;
varying vec2 vUv;

const vec3 L = vec3(-0.42, 0.66, -0.62);
const vec3 SP0 = vec3(0.36, 0.19, -0.28);   // spark rest position (body space)

mat3 rotM(vec3 a){
  float cy=cos(a.x), sy=sin(a.x), cx=cos(a.y), sx=sin(a.y), cz=cos(a.z), sz=sin(a.z);
  mat3 Y=mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
  mat3 X=mat3(1.,0.,0., 0.,cx,sx, 0.,-sx,cx);
  mat3 Z=mat3(cz,sz,0., -sz,cz,0., 0.,0.,1.);
  return Z*X*Y;
}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
float sdEll(vec3 p, vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/max(k1,1e-4);}
float hash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
vec3 hash33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}

mat3 R; mat3 RT;
float body(vec3 p){
  float a=sdEll(p-vec3(-.06,.10,0.),vec3(.64,.80,.60));
  float b=sdEll(p-vec3(.14,-.47,.04),vec3(.62,.39,.54));
  float d=smin(a,b,.30);
  d=smin(d,sdEll(p-vec3(-.30,.50,.05),vec3(.38,.40,.40)),.30);
  float c1=length(p-vec3(.30,.18,-.70))-.56;
  d=smax(d,-c1,.10);
  float c2=length(p-vec3(.36,.19,-.46))-.37;
  d=smax(d,-c2,.07);
  d=smax(d,-(length(p-vec3(.38,.20,-.30))-.24),.05);
  return d;
}
// returns (distance, material): 1 stone, 2 inner spark, 3 detached spark
vec2 map(vec3 w){
  vec3 pl=R*(w-uShift)/uScale;
  float db=body(pl)*uScale;
  vec3 sp=SP0+vec3(0.,0.,uSpark.z);
  float ds=(length(pl-sp)-uSpark.x)*uScale;
  float dd=length(w-uDet.xyz)-uDet.w;
  vec2 r=vec2(db,1.);
  if(ds<r.x) r=vec2(ds,2.);
  if(dd<r.x) r=vec2(dd,3.);
  return r;
}
float mapD(vec3 w){return map(w).x;}
vec3 normalAt(vec3 p){
  const vec2 e=vec2(1.,-1.)*.0008;
  return normalize(e.xyy*mapD(p+e.xyy)+e.yyx*mapD(p+e.yyx)+e.yxy*mapD(p+e.yxy)+e.xxx*mapD(p+e.xxx));
}
float aoAt(vec3 p,vec3 n){
  float o=0.,s=1.;
  for(int i=1;i<=4;i++){float h=.04+.09*float(i);o+=(h-mapD(p+n*h))*s;s*=.62;}
  return clamp(1.-1.9*o,0.,1.);
}
float shadowAt(vec3 ro,vec3 rd){
  float res=1.,t=.04;
  for(int i=0;i<14;i++){float h=mapD(ro+rd*t);res=min(res,7.*h/t);t+=clamp(h,.04,.22);if(res<.01||t>2.5)break;}
  res=clamp(res,0.,1.);return res*res*(3.-2.*res);
}
float speckle(vec3 p){
  vec3 q=p*17.;vec3 id=floor(q);vec3 f=fract(q);
  vec3 c=hash33(id);
  float on=step(.80,hash13(id+7.));
  float d=length(f-(.25+.5*c));
  float dots=on*smoothstep(.17,.06,d)*(.45+.55*c.x);
  float cloud=hash13(floor(p*5.)+3.)*.5+hash13(floor(p*9.)+1.)*.5;
  return clamp(dots+.07*cloud,0.,1.);
}
vec3 sparkLightPos(){return uShift+RT*(SP0+vec3(0.,0.,uSpark.z))*uScale;}

vec3 shadeStone(vec3 p,vec3 n,vec3 rd,vec3 sw){
  vec3 pl=R*(p-uShift)/uScale;
  float ao=aoAt(p,n);
  float sh=shadowAt(p+n*.02,L);
  float lam=clamp(dot(n,L)*.5+.5,0.,1.);lam=lam*lam*(3.-2.*lam);
  vec3 base=vec3(.969,.953,.929), shad=vec3(.863,.812,.769);
  float sp=speckle(pl);
  base=mix(base,vec3(.60,.47,.40),sp*.8);
  vec3 col=mix(shad*.70,base,lam*(.45+.55*sh));
  col*=mix(.62,1.,ao);
  col+=vec3(.025,.03,.05)*(n.y*.5+.5);
  float fr=pow(1.-max(dot(n,-rd),0.),3.);
  col+=vec3(1.,.95,.9)*fr*.10*ao;
  // light from the inner spark
  vec3 to=sw-p;float d2=dot(to,to);vec3 ld=to*inversesqrt(d2+1e-5);
  float sz=uSpark.x/.17;
  float li=uSpark.y*min(sz*sz,1.5)*1.1/(1.+d2*7.5);
  float sl=clamp(dot(n,ld)*.62+.38,0.,1.);
  col+=vec3(1.,.50,.14)*sl*li*mix(.55,1.,ao);
  col=mix(col,col*vec3(1.,.9,.8)+vec3(.0,.0,.0),smoothstep(0.,1.,li)*.15);
  // detached spark bounce
  vec3 td=uDet.xyz-p;float dd2=dot(td,td);
  col+=vec3(1.,.6,.25)*clamp(dot(n,normalize(td))*.5+.5,0.,1.)*uGlow.y*.55/(1.+dd2*9.);
  return col;
}
vec3 shadeSpark(vec3 n,vec3 rd,float bright){
  float c=pow(max(dot(n,-rd),0.),2.2);
  vec3 col=mix(vec3(1.,.58,.20),vec3(1.,.95,.78),smoothstep(.1,.9,c));
  return col*(.95+.35*bright);
}
vec3 shadeDet(vec3 p,vec3 n,vec3 rd){
  float c=pow(max(dot(n,-rd),0.),2.);
  float top=clamp(dot(n,normalize(vec3(-.3,.8,-.5)))*.5+.5,0.,1.);
  vec3 col=mix(vec3(.95,.52,.18),vec3(1.,.74,.42),top);
  col=mix(col,vec3(1.,.86,.66),c*.35);
  return col*(.82+.3*uGlow.y);
}
float seg(vec2 p,vec2 a,vec2 b,float r){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}

void main(){
  vec2 uv=(vUv-.5)*2.;
  float asp=uRes.x/uRes.y;
  uv.x*=asp;
  R=rotM(uRot);RT=mat3(R[0][0],R[1][0],R[2][0],R[0][1],R[1][1],R[2][1],R[0][2],R[1][2],R[2][2]);
  vec3 ro=vec3(0.,.02,-4.);
  vec3 rd=normalize(vec3(uv*.345,1.));
  float t=2.2,dmin=1e5,tmin=t;
  vec2 h=vec2(0.);bool hit=false;
  for(int i=0;i<64;i++){
    vec3 p=ro+rd*t;h=map(p);
    if(h.x<dmin){dmin=h.x;tmin=t;}
    if(h.x<.0012){hit=true;break;}
    t+=h.x*.92;
    if(t>6.)break;
  }
  vec3 col=vec3(0.);float a=0.;
  vec3 sw=sparkLightPos();
  if(hit||dmin<.014){
    float tt=hit?t:tmin;
    vec3 p=ro+rd*tt;vec2 m=map(p);vec3 n=normalAt(p);
    if(m.y<1.5) col=shadeStone(p,n,rd,sw);
    else if(m.y<2.5) col=shadeSpark(n,rd,uSpark.y);
    else col=shadeDet(p,n,rd);
    a=hit?1.:1.-smoothstep(0.,.014,dmin);
    col*=a;
  }
  float th=hit?t:7.;
  // glow of the inner spark (soft bloom, partly hidden when stone is in front)
  {
    float tc=dot(sw-ro,rd);vec3 q=ro+rd*tc-sw;float d=length(q);
    float vis=(tc<th)?1.:.22;
    float g=uGlow.x*uSpark.x*uSpark.x/(.012+d*d)*.07;
    g=clamp(g,0.,1.)*vis;
    vec3 gc=mix(vec3(1.,.60,.24),vec3(1.,.84,.64),clamp(g*1.4,0.,1.));
    col+=gc*g*.9*(1.-a*.5);
    a=clamp(a+g*.9,0.,1.);
  }
  // glow of the detached spark
  {
    float tc=dot(uDet.xyz-ro,rd);vec3 q=ro+rd*tc-uDet.xyz;float d=length(q);
    float vis=(tc<th)?1.:.2;
    float g=uGlow.y*uDet.w*uDet.w/(.01+d*d)*.05;
    g=clamp(g,0.,.8)*vis;
    col+=vec3(1.,.66,.30)*g*.8*(1.-a*.6);
    a=clamp(a+g*.7,0.,1.);
  }
  // little rays while speaking: three short dashes, upper right of the cavity
  if(uRays>.002){
    vec2 w=uv*.345*4.;
    float k=uRays*(.55+.45*uLevel);
    float d=1e3;
    d=min(d,seg(w,vec2(.86,.74),vec2(.98,.84),.016));
    d=min(d,seg(w,vec2(.96,.58),vec2(1.12,.62),.016));
    d=min(d,seg(w,vec2(.98,.40),vec2(1.10,.35),.016));
    float r=(1.-smoothstep(0.,.012,d))*k;
    col+=vec3(1.,.62,.24)*r*(1.-a);
    a=clamp(a+r,0.,1.);
  }
  gl_FragColor=vec4(clamp(col,0.,1.),a);
}`;

export async function create(host, opts = {}) {
  const o = Object.assign({ calm: false, still: false, t0: 0 }, opts);
  let ogl;
  try { ogl = await import(OGL_URL); }
  catch (e) { console.warn('[pebble] OGL failed to load, using fallback', e); return fallback(host, o); }
  try { return build(ogl, host, o); }
  catch (e) { console.warn('[pebble] WebGL setup failed, using fallback', e); return fallback(host, o); }
}

function fallback(host, o) {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none';
  wrap.innerHTML = '<svg viewBox="0 0 120 120" width="100%" height="100%" style="max-width:100%;max-height:100%"><defs><radialGradient id="pbSp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE3BF"/><stop offset=".55" stop-color="#FF9A3C"/><stop offset="1" stop-color="#FF9A3C" stop-opacity="0"/></radialGradient></defs>'
    + '<path d="M38 14c20-6 42 6 44 30 1 8-3 12-1 18 3 9 12 14 8 28-4 14-24 20-44 18C24 106 12 92 14 72 16 56 20 44 24 32c3-10 7-15 14-18z" fill="#F7F3ED"/>'
    + '<path d="M60 30c14-4 26 6 24 20-1 8-8 12-8 18-14 4-28-2-30-16-1-12 4-18 14-22z" fill="#DCCFC4" opacity=".55"/>'
    + '<circle cx="66" cy="50" r="13" fill="url(#pbSp)"/><circle cx="98" cy="64" r="6" fill="#FF9A3C"/></svg>';
  host.appendChild(wrap);
  return {
    fallback: true,
    setState() {}, setLevel() {}, setLook() {}, setCalm() {}, start() {}, stop() {},
    destroy() { wrap.remove(); },
  };
}

function build(ogl, host, o) {
  const { Renderer, Program, Mesh, Triangle } = ogl;
  const dprCap = 1.5;
  const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, dprCap) });
  const gl = renderer.gl;
  if (!gl) throw new Error('no WebGL');
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const program = new Program(gl, {
    vertex: VERT, fragment: FRAG,
    uniforms: {
      uRes: { value: [1, 1] }, uTime: { value: 0 }, uRot: { value: [0, 0, 0] }, uShift: { value: [0, 0, 0] }, uScale: { value: 1 },
      uSpark: { value: [.17, 1, 0] }, uDet: { value: [1, -.3, -.1, .13] }, uGlow: { value: [1, 1] }, uLevel: { value: 0 }, uRays: { value: 0 },
    },
  });
  if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) throw new Error('shader link failed');
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  const U = program.uniforms;

  // ---- state
  const W = { normal: 1, listening: 0, thinking: 0, speaking: 0 };   // linear ramps 0..1
  let target = 'normal', calm = o.calm ? 1 : 0, calmGoal = calm;
  let level = 0, levelS = 0, lookT = [0, 0], look = [0, 0];
  let running = false, raf = 0, visible = true, destroyed = false;
  let clock = o.still ? o.t0 : 0, last = 0, thinkClock = 0;
  const ease = x => x * x * (3 - 2 * x);

  function size() {
    const w = Math.max(1, Math.round(host.clientWidth)), h = Math.max(1, Math.round(host.clientHeight));
    renderer.setSize(w, h);
    U.uRes.value = [gl.canvas.width, gl.canvas.height];
    if (o.still || !running) draw();
  }

  // thinking arc: 0..1.2 s: out 0-300, pause 300-700, return 700-1200 ms (sheet)
  function arc(sec) {
    const u = sec % 1.2;
    if (u < .3) return ease(u / .3);
    if (u < .7) return 1;
    if (u < 1.2) return 1 - ease((u - .7) / .5);
    return 0;
  }

  function params(now) {
    // normalised state blend
    let sum = 0; const e = {};
    for (const s of STATES) { e[s] = ease(W[s]); sum += e[s]; }
    if (sum < 1e-4) { e.normal = 1; sum = 1; }
    for (const s of STATES) e[s] /= sum;
    const amp = 1 - .7 * calm;            // calm: state changes are minimal
    const idle = 1 - calm;                // calm: no idle loop
    const L = levelS;
    const t = clock;
    const mix = (n, l, th, sp) => n + ((e.listening * (l - n)) + (e.thinking * (th - n)) + (e.speaking * (sp - n))) * amp;

    const breath = 1 + Math.sin(t * 6.2832 / 4.5) * .012 * idle;
    // spark: size and brightness react to voice
    const sparkR = .17 * mix(1, 1 + .35 * L, .78, 1 + .42 * L);
    const sparkB = mix(.8 + .04 * Math.sin(t * 3.1) * idle, .85 + .35 * L, .55, .9 + .4 * L);
    const drift = Math.sin(t * 6.2832 / 3.2) * .012 * idle;
    // body motion
    const bodyScale = breath * mix(1, 1.0, .945, 1 + .028 * L);
    const lx = look[0], ly = look[1];
    const yaw = lx * .07 + e.listening * .09 * amp;                    // look-lean <= 4 deg, plus a listening lean
    const pitch = -ly * .05 + e.listening * .04 * amp - e.thinking * .05 * amp;
    const roll = -lx * .02 + (e.listening * -.05 + e.thinking * .07) * amp + Math.sin(t * 6.2832 / 4.5 + 1) * .008 * idle;
    const sy = Math.sin(t * 6.2832 / 4.5) * .008 * idle + e.speaking * L * .018 * amp;
    // detached spark
    const th = e.thinking * amp * (calm > .5 ? 0 : arc(thinkClock));
    const dHome = [.98 + lx * .02, -.30 + ly * -.02, -.12];
    const dp = [
      dHome[0] + Math.sin(t * 6.2832 / 4.1) * .035 * idle - th * .22 - e.listening * .10 * amp + e.speaking * L * .05 * amp,
      dHome[1] + Math.sin(t * 6.2832 / 3.3 + 1.4) * .05 * idle + th * 1.12 + e.speaking * L * .08 * amp,
      dHome[2] - e.listening * .20 * amp,
    ];
    const detR = .13 * (1 + .12 * e.listening * L * amp) * (1 - .18 * th);
    return {
      rot: [yaw, pitch, roll], shift: [lx * .03, sy + ly * -.015, 0], scale: bodyScale,
      spark: [sparkR, sparkB, drift], det: [dp[0], dp[1], dp[2], detR],
      glow: [mix(.8, .85 + .2 * L, .55, .9 + .3 * L), mix(.9, 1.0 + .3 * L, 1.0, 1.0)],
      rays: e.speaking * amp * (calm > .5 ? .5 : 1),
    };
  }

  function draw(now) {
    const p = params(now);
    U.uTime.value = clock;
    U.uRot.value = p.rot; U.uShift.value = p.shift; U.uScale.value = p.scale;
    U.uSpark.value = p.spark; U.uDet.value = p.det; U.uGlow.value = p.glow;
    U.uLevel.value = levelS; U.uRays.value = p.rays;
    if (host.clientWidth > 0 && host.clientHeight > 0) renderer.render({ scene: mesh });
  }

  function step(dt) {
    clock += dt;
    thinkClock = target === 'thinking' ? thinkClock + dt : 0;
    for (const s of STATES) {
      const goal = s === target ? 1 : 0;
      const dur = target === 'normal' ? RETURN : ENTER;
      const d = dt / dur;
      W[s] = goal > W[s] ? Math.min(goal, W[s] + d) : Math.max(goal, W[s] - d);
    }
    calm += (calmGoal - calm) * Math.min(1, dt / .25);
    if (Math.abs(calmGoal - calm) < .002) calm = calmGoal;
    const k = level > levelS ? 1 - Math.exp(-dt / .045) : 1 - Math.exp(-dt / .14);
    levelS += (level - levelS) * k;
    const kl = 1 - Math.exp(-dt * 9);
    look[0] += (lookT[0] - look[0]) * kl; look[1] += (lookT[1] - look[1]) * kl;
  }

  function loop(now) {
    raf = 0;
    if (!running || destroyed) return;
    if (visible && !document.hidden) {
      const dt = Math.min(.05, last ? (now - last) / 1000 : 0);
      last = now;
      step(dt); draw(now);
    } else last = 0;
    raf = requestAnimationFrame(loop);
  }

  const ro = new ResizeObserver(() => size());
  ro.observe(host);
  const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) last = 0; });
  io.observe(host);
  const onVis = () => { last = 0; };
  document.addEventListener('visibilitychange', onVis);
  size();

  const api = {
    setState(s) {
      if (!STATES.includes(s)) s = 'normal';
      target = s;
      if (o.still) { for (const k of STATES) W[k] = k === s ? 1 : 0; draw(); }
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
    // read-only snapshot for tests
    debug() { return { target, weights: { ...W }, level: levelS, calm, clock, thinkClock }; },
  };
  if (o.still) draw();
  return api;
}
