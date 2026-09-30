/* Voice-mode orb for the v4 mock.
   Copied from directions/v3-target/index-v3a.html (read only, 2026-09-30) and wrapped as a module.
   Ring shader: ported from React Bits "Orb" (orb-kit/react-bits/Orb.tailwind.jsx).
   React Bits licence: MIT + Commons Clause License Condition v1.0, Copyright (c) 2026 David Haz.
   OGL (oframe/ogl, Unlicense) is loaded from esm.sh the first time voice mode opens.
   Eyes (pointer follow with a spring), blink, states: our own code.
   Changes vs v3: states are normal | listening | thinking | speaking (motion round 6: Motion Full/Calm switch, no OS reduced-motion freeze); the loop runs only while voice mode is open;
   WebGL loads lazily, so type mode costs nothing. */

const vert = `precision highp float;attribute vec2 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,0.0,1.0);}`;
const frag = `precision highp float;
uniform float iTime;uniform vec3 iResolution;uniform float hue;uniform float hover;uniform float rot;uniform float hoverIntensity;uniform vec3 backgroundColor;varying vec2 vUv;
vec3 rgb2yiq(vec3 c){float y=dot(c,vec3(0.299,0.587,0.114));float i=dot(c,vec3(0.596,-0.274,-0.322));float q=dot(c,vec3(0.211,-0.523,0.312));return vec3(y,i,q);}
vec3 yiq2rgb(vec3 c){float r=c.x+0.956*c.y+0.621*c.z;float g=c.x-0.272*c.y-0.647*c.z;float b=c.x-1.106*c.y+1.703*c.z;return vec3(r,g,b);}
vec3 adjustHue(vec3 color,float hueDeg){float hueRad=hueDeg*3.14159265/180.0;vec3 yiq=rgb2yiq(color);float cosA=cos(hueRad);float sinA=sin(hueRad);float i=yiq.y*cosA-yiq.z*sinA;float q=yiq.y*sinA+yiq.z*cosA;yiq.y=i;yiq.z=q;return yiq2rgb(yiq);}
vec3 hash33(vec3 p3){p3=fract(p3*vec3(0.1031,0.11369,0.13787));p3+=dot(p3,p3.yxz+19.19);return -1.0+2.0*fract(vec3(p3.x+p3.y,p3.x+p3.z,p3.y+p3.z)*p3.zyx);}
float snoise3(vec3 p){const float K1=0.333333333;const float K2=0.166666667;vec3 i=floor(p+(p.x+p.y+p.z)*K1);vec3 d0=p-(i-(i.x+i.y+i.z)*K2);vec3 e=step(vec3(0.0),d0-d0.yzx);vec3 i1=e*(1.0-e.zxy);vec3 i2=1.0-e.zxy*(1.0-e);vec3 d1=d0-(i1-K2);vec3 d2=d0-(i2-K1);vec3 d3=d0-0.5;vec4 h=max(0.6-vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)),0.0);vec4 n=h*h*h*h*vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.0)));return dot(vec4(31.316),n);}
vec4 extractAlpha(vec3 colorIn){float a=max(max(colorIn.r,colorIn.g),colorIn.b);return vec4(colorIn.rgb/(a+1e-5),a);}
const vec3 baseColor1=vec3(0.611765,0.262745,0.996078);const vec3 baseColor2=vec3(0.298039,0.760784,0.913725);const vec3 baseColor3=vec3(0.062745,0.078431,0.600000);
const float innerRadius=0.6;const float noiseScale=0.65;
float light1(float intensity,float attenuation,float dist){return intensity/(1.0+dist*attenuation);}
float light2(float intensity,float attenuation,float dist){return intensity/(1.0+dist*dist*attenuation);}
vec4 draw(vec2 uv){vec3 color1=adjustHue(baseColor1,hue);vec3 color2=adjustHue(baseColor2,hue);vec3 color3=adjustHue(baseColor3,hue);
float ang=atan(uv.y,uv.x);float len=length(uv);float invLen=len>0.0?1.0/len:0.0;float bgLuminance=dot(backgroundColor,vec3(0.299,0.587,0.114));
float n0=snoise3(vec3(uv*noiseScale,iTime*0.5))*0.5+0.5;float r0=mix(mix(innerRadius,1.0,0.4),mix(innerRadius,1.0,0.6),n0);float d0=distance(uv,(r0*invLen)*uv);
float v0=light1(1.0,10.0,d0);v0*=smoothstep(r0*1.05,r0,len);float innerFade=smoothstep(r0*0.8,r0*0.95,len);v0*=mix(innerFade,1.0,bgLuminance*0.7);
float cl=cos(ang+iTime*2.0)*0.5+0.5;float a=iTime*-1.0;vec2 pos=vec2(cos(a),sin(a))*r0;float d=distance(uv,pos);float v1=light2(1.5,5.0,d);v1*=light1(1.0,50.0,d0);
float v2=smoothstep(1.0,mix(innerRadius,1.0,n0*0.5),len);float v3=smoothstep(innerRadius,mix(innerRadius,1.0,0.5),len);
vec3 colBase=mix(color1,color2,cl);float fadeAmount=mix(1.0,0.1,bgLuminance);vec3 darkCol=mix(color3,colBase,v0);darkCol=(darkCol+v1)*v2*v3;darkCol=clamp(darkCol,0.0,1.0);
vec3 lightCol=(colBase+v1)*mix(1.0,v2*v3,fadeAmount);lightCol=mix(backgroundColor,lightCol,v0);lightCol=clamp(lightCol,0.0,1.0);vec3 finalCol=mix(darkCol,lightCol,bgLuminance);return extractAlpha(finalCol);}
vec4 mainImage(vec2 fragCoord){vec2 center=iResolution.xy*0.5;float size=min(iResolution.x,iResolution.y);vec2 uv=(fragCoord-center)/size*2.0;float angle=rot;float s=sin(angle);float c=cos(angle);uv=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y);
uv.x+=hover*hoverIntensity*0.1*sin(uv.y*10.0+iTime);uv.y+=hover*hoverIntensity*0.1*sin(uv.x*10.0+iTime);return draw(uv);}
void main(){vec2 fragCoord=vUv*iResolution.xy;vec4 col=mainImage(fragCoord);gl_FragColor=vec4(col.rgb*col.a,col.a);}`;

const TARGET = { normal: { speed: 0, hue: 0, hover: 0 }, listening: { speed: 1, hue: 0, hover: .12 }, thinking: { speed: 2.4, hue: 28, hover: 1 }, speaking: { speed: 1.5, hue: -18, hover: .5 } };

export function createOrb({ isCalm = () => false, STILL = false, T0 = 0, look = null } = {}) {
  const orb = document.getElementById('orb'), face = document.getElementById('face'), mouth = document.getElementById('mouth');
  const eyes = [document.getElementById('eyeL'), document.getElementById('eyeR')], swirl = document.getElementById('swirl');
  const floatEl = document.querySelector('.float'), dotEls = [...document.querySelectorAll('.dots i')];
  let floatAmp = 0, wobbleAmp = 0, lvlS = 0, mouthKick = -1e9, mouthAmp = 0;
  let state = 'normal', active = false, raf = 0, last = performance.now(), rot = 0, orbTime = T0;
  let tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, nextBlink = performance.now() + 2500, blinkStart = -1;
  let prog = null, renderer = null, mesh = null, glOK = false, loading = null;
  const cur = { speed: 0, hue: 0, hover: 0 }, MAX = 13;

  /* eyes follow the pointer anywhere on the page (v3 behaviour) */
  addEventListener('pointermove', e => {
    if (!active) return;
    const r = orb.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 320);
    tx = dx / d * MAX * k; ty = dy / d * MAX * k;
  });
  document.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
  if (look) { tx = x = look[0]; ty = y = look[1]; }

  async function loadGL(){
    try {
      const { Renderer, Program, Mesh, Triangle, Vec3 } = await import('https://esm.sh/ogl@1.0.11');
      const host = document.getElementById('orbGl');
      renderer = new Renderer({ alpha: true, premultipliedAlpha: false, dpr: Math.min(devicePixelRatio || 1, 2) });
      const gl = renderer.gl; gl.clearColor(0, 0, 0, 0); host.appendChild(gl.canvas);
      prog = new Program(gl, { vertex: vert, fragment: frag, uniforms: {
        iTime: { value: T0 }, iResolution: { value: new Vec3(1, 1, 1) }, hue: { value: 0 }, hover: { value: 0 }, rot: { value: 0 },
        hoverIntensity: { value: .35 }, backgroundColor: { value: new Vec3(0, 0, 0) } } });
      mesh = new Mesh(gl, { geometry: new Triangle(gl), program: prog });
      const size = () => { if (!host.clientWidth) return; renderer.setSize(host.clientWidth, host.clientHeight); prog.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, 1); };
      size(); addEventListener('resize', size); new ResizeObserver(size).observe(host);
      glOK = true;
    } catch (err) { console.warn('OGL orb failed, CSS orb only', err); }
    document.documentElement.dataset.ogl = glOK ? 'ok' : 'failed';
  }

  function frame(now){
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const anim = !STILL && !isCalm();                 // Full motion: float, breathing, wobble, glow pulse, dots, ring turning
    /* eyes: spring toward the pointer in Full and Calm, whatever the OS says */
    { const k = 170, c = 18; vx += ((tx - x) * k - vx * c) * dt; vy += ((ty - y) * k - vy * c) * dt; x += vx * dt; y += vy * dt; if (STILL) { x = tx; y = ty; } }
    let ex = x, ey = y;
    if (state === 'thinking' && anim) { ex = x * .4 + 7 * Math.cos(now / 900); ey = y * .4 - 8; }
    if (!STILL && now > nextBlink) { blinkStart = now; nextBlink = now + 3000 + Math.random() * 3000; }   // blink every 3-6 s, every state
    let blink = 1;
    if (blinkStart > 0) { const p = (now - blinkStart) / 170; if (p < 1) blink = Math.max(.08, Math.abs(1 - 2 * p)); else blinkStart = -1; }
    /* speaking: each caption word opens the mouth, then it closes */
    const env = state === 'speaking' ? mouthAmp * Math.exp(-(now - mouthKick) / 130) : 0;
    face.style.transform = `translate(${ex.toFixed(2)}px,${ey.toFixed(2)}px)`;
    for (const e of eyes) e.style.transform = `scaleY(${blink.toFixed(3)})`;
    mouth.style.transform = `scaleY(${state === 'speaking' ? (STILL ? 1 : (.45 + env).toFixed(3)) : 1})`;
    /* float + breathing (listening), wobble (thinking): amplitudes ease so nothing jumps */
    const ea = Math.min(1, dt * 5);
    floatAmp += ((anim && state === 'listening' ? 1 : 0) - floatAmp) * ea; wobbleAmp += ((anim && state === 'thinking' ? 1 : 0) - wobbleAmp) * ea;
    const fy = Math.sin(now / 6000 * 6.283) * 5.5 * floatAmp, br = 1 + Math.sin(now / 2600 * 6.283) * .018 * floatAmp;
    const wr = Math.sin(now / 170) * 2.6 * wobbleAmp, wx = Math.sin(now / 230) * 1.6 * wobbleAmp;
    floatEl.style.transform = (floatAmp + wobbleAmp) > .002 ? `translate(${wx.toFixed(2)}px,${fy.toFixed(2)}px) rotate(${wr.toFixed(2)}deg) scale(${br.toFixed(4)})` : '';
    /* glow pulse: fake voice level while listening, word envelope while speaking */
    let lvl = 0;
    if (anim && state === 'listening') lvl = Math.max(0, Math.sin(now / 800)) * (.5 + .5 * Math.sin(now / 260 + Math.sin(now / 900) * 2)) * .9 + .1;
    if (anim && state === 'speaking') lvl = env;
    lvlS += (lvl - lvlS) * Math.min(1, dt * 12);
    orb.style.setProperty('--lvl', lvlS.toFixed(3));
    dotEls.forEach((d, n) => { if (state === 'thinking' && anim) { const s = Math.sin((now / 1100 - n * .16) * 6.283); d.style.transform = `translateY(${(-2 - 2 * s).toFixed(2)}px)`; d.style.opacity = (.75 + .25 * s).toFixed(2); } else { d.style.transform = ''; d.style.opacity = ''; } });
    if (glOK) {
      const tg = TARGET[state], ease = STILL ? 1 : 1 - Math.pow(.02, dt);
      const sp = anim ? tg.speed : 0, hv = anim ? tg.hover : 0;
      cur.speed += (sp - cur.speed) * ease; cur.hue += (tg.hue - cur.hue) * ease; cur.hover += (hv - cur.hover) * ease;
      if (!STILL) { orbTime += dt * cur.speed; rot += dt * .25 * cur.speed; }
      prog.uniforms.iTime.value = orbTime; prog.uniforms.hue.value = cur.hue; prog.uniforms.hover.value = cur.hover; prog.uniforms.rot.value = rot;
      renderer.render({ scene: mesh });
    }
    swirl.style.transform = `rotate(${(orbTime * 22) % 360}deg)`;
    if (active && !STILL && !document.hidden) raf = requestAnimationFrame(frame); else raf = 0;
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && active) kick(); });

  return {
    async start(){ active = true; if (!loading) loading = loadGL(); kick(); await loading; kick(); },
    stop(){ active = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    setState(s){ state = s; orb.dataset.state = s; kick(); },
    kickMouth(len){ mouthKick = performance.now(); mouthAmp = Math.min(1, .5 + len * .09); },   // caption word onset -> mouth opens
  };
}
