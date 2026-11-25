/* hero3d.js — Escena 3D del inicio (Three.js): botella de vidrio con condensación, hielo, escarcha y neblina.
 * Si el equipo no soporta WebGL, se muestra una foto en su lugar (.no3d). */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const hero = document.getElementById('hero');
const canvas = document.getElementById('h3d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;
const fail = (e) => { if (e) console.warn('3D desactivado:', e); hero.classList.add('no3d'); document.dispatchEvent(new Event('bh:hero-ready')); };
window.__h3d = true;

try { await main(); } catch (e) { fail(e); }

async function main() {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('sin WebGL');
  try { await Promise.race([document.fonts.load('900 100px Archivo'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let dprCap = isTouch ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
  if ('transmissionResolutionScale' in renderer) renderer.transmissionResolutionScale = isTouch ? .5 : .75;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#061322');
  scene.fog = new THREE.Fog('#061322', 9, 20);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  /* ---------- texturas generadas ---------- */
  const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };

  // gotas de condensación → mapa de normales
  function dropletNormals(size, count, maxR) {
    const hc = cv(size, size, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = (Math.random() ** 2.4) * maxR + 1.2;
        const gr = g.createRadialGradient(x, y - r * .15, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.6, 'rgba(200,200,200,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * .9, r * (1 + Math.random() * .5), 0, 0, 6.283); g.fill();
        if (r > maxR * .55 && Math.random() < .5) { // gota que escurre
          g.fillStyle = 'rgba(190,190,190,.7)'; g.fillRect(x - r * .25, y, r * .5, r * (3 + Math.random() * 6));
        }
      }
    });
    const src = hc.getContext('2d').getImageData(0, 0, size, size).data;
    const out = cv(size, size, () => {});
    const og = out.getContext('2d'), img = og.createImageData(size, size), d = img.data;
    const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * 2.2, dy = (H(x, y - 1) - H(x, y + 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      d[i] = (dx / l * .5 + .5) * 255; d[i + 1] = (dy / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const dropsN = dropletNormals(512, 900, 9);
  dropsN.repeat.set(3, 3);

  // etiqueta de la botella
  const labelTex = new THREE.CanvasTexture(cv(2048, 760, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#f6fbff'); bg.addColorStop(1, '#d8eef8'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const gold = g.createLinearGradient(0, 0, 0, 60); gold.addColorStop(0, '#f7d68b'); gold.addColorStop(.5, '#c8902f'); gold.addColorStop(1, '#f3cf7a');
    g.fillStyle = gold; g.fillRect(0, 0, w, 58); g.fillRect(0, h - 58, w, 58);
    g.fillStyle = '#0b2440'; g.fillRect(0, 58, w, 8); g.fillRect(0, h - 66, w, 8);
    // escarcha
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(143,227,255,${Math.random() * .12})`; g.fillRect(Math.random() * w, 70 + Math.random() * (h - 140), 2 + Math.random() * 6, 2 + Math.random() * 6); }
    const cx = w * .5;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#0b2440'; g.font = '800 54px Archivo, Arial'; g.fillText('— CERVEZA · BIEN HELADA · DELIVERY —', cx, 128);
    g.font = '900 250px Archivo, Arial Black, Arial';
    const gt = g.createLinearGradient(0, 200, 0, 470); gt.addColorStop(0, '#123b66'); gt.addColorStop(1, '#061a2e'); g.fillStyle = gt;
    g.fillText('BIEN', cx, 270);
    g.fillStyle = '#c8102e'; g.font = '900 260px Archivo, Arial Black, Arial';
    g.save(); g.translate(cx, 478); g.scale(1.05, 1); g.fillText('HELADA', 0, 0); g.restore();
    g.strokeStyle = '#c8902f'; g.lineWidth = 6; g.beginPath(); g.arc(cx - 640, 380, 120, 0, 6.283); g.stroke(); g.beginPath(); g.arc(cx + 640, 380, 120, 0, 6.283); g.stroke();
    g.fillStyle = '#123b66'; g.font = '700 150px serif'; g.fillText('❄', cx - 640, 388); g.fillText('❄', cx + 640, 388);
    g.font = '800 46px Archivo, Arial'; g.fillStyle = '#0b2440'; g.fillText('LAGER · 630 ml · 4.8% vol.', cx, 640);
  }));
  labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = 8;

  const neckTex = new THREE.CanvasTexture(cv(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4d589'); gr.addColorStop(.5, '#b9822a'); gr.addColorStop(1, '#f0c870');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0b2440'; g.fillRect(0, 70, w, 116);
    g.fillStyle = '#f6e2a8'; g.font = '900 74px Archivo, Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('❄ BIEN HELADA ❄', w / 2, 130);
  }));
  neckTex.colorSpace = THREE.SRGBColorSpace;

  const capTex = new THREE.CanvasTexture(cv(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w * .4, w * .4, 10, w / 2, w / 2, w / 2); gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(1, '#8e0b1d');
    g.fillStyle = gr; g.fillRect(0, 0, w, w); g.fillStyle = '#ffe3a1'; g.font = '900 120px Archivo, Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BH', w / 2, w / 2 + 6);
  }));
  capTex.colorSpace = THREE.SRGBColorSpace;

  const soft = new THREE.CanvasTexture(cv(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }));
  const cloud = new THREE.CanvasTexture(cv(256, 256, (g, w) => {
    for (let i = 0; i < 26; i++) {
      const x = w * (.25 + Math.random() * .5), y = w * (.35 + Math.random() * .3), r = w * (.12 + Math.random() * .18);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }
  }));

  /* ---------- botella ---------- */
  const bottle = new THREE.Group();
  const P = [[0, 0], [.33, 0], [.39, .015], [.415, .06], [.42, .14], [.42, 1.56], [.412, 1.7], [.38, 1.86], [.3, 2.04], [.215, 2.2], [.163, 2.36], [.148, 2.55], [.146, 2.8],
    [.162, 2.82], [.168, 2.87], [.163, 2.92], [.15, 2.94], [.0, 2.95]];
  const prof = P.map(([x, y]) => new THREE.Vector2(x, y));
  const glassGeo = new THREE.LatheGeometry(prof, 96);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', metalness: 0, roughness: .07, transmission: 1, thickness: .35, ior: 1.52,
    attenuationColor: new THREE.Color('#b0630f'), attenuationDistance: .55,
    clearcoat: 1, clearcoatRoughness: .04, clearcoatNormalMap: dropsN, clearcoatNormalScale: new THREE.Vector2(1.1, 1.1),
    normalMap: dropsN, normalScale: new THREE.Vector2(.35, .35), specularIntensity: 1, envMapIntensity: 1.3
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  bottle.add(glass);

  // cerveza (opaca y luminosa para que el vidrio la refracte)
  const L = P.filter(([, y]) => y <= 2.3).map(([x, y]) => new THREE.Vector2(Math.max(0, x * .9), Math.max(.04, y)));
  L.push(new THREE.Vector2(.17, 2.3), new THREE.Vector2(0, 2.3));
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(L, 64), new THREE.MeshPhysicalMaterial({
    color: '#c0700c', emissive: '#6a3000', emissiveIntensity: .3, roughness: .25, metalness: 0, sheen: .6, sheenColor: new THREE.Color('#ffd27f')
  }));
  bottle.add(liquid);

  // etiqueta (envuelve el frente)
  const lblArc = Math.PI * 1.35;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(.426, .426, .78, 96, 1, true, -lblArc / 2 + Math.PI, lblArc),
    new THREE.MeshPhysicalMaterial({ map: labelTex, roughness: .45, clearcoat: .6, clearcoatRoughness: .2, clearcoatNormalMap: dropsN, clearcoatNormalScale: new THREE.Vector2(.6, .6), side: THREE.FrontSide }));
  label.position.y = .82; label.rotation.y = Math.PI;
  bottle.add(label);

  // banda dorada del cuello
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.152, .166, .34, 64, 1, true),
    new THREE.MeshPhysicalMaterial({ map: neckTex, metalness: .75, roughness: .28, clearcoat: .8 }));
  neck.position.y = 2.42; bottle.add(neck);

  // chapa con dientes
  const capGeo = new THREE.CylinderGeometry(.168, .18, .085, 84, 2);
  const pos = capGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), r = Math.hypot(x, z);
    if (r > .1) { const a = Math.atan2(z, x), k = 1 + .045 * Math.cos(a * 21) * (y < 0 ? 1 : .5); pos.setX(i, x * k); pos.setZ(i, z * k); }
  }
  capGeo.computeVertexNormals();
  const capMats = [new THREE.MeshPhysicalMaterial({ color: '#b0101f', metalness: .9, roughness: .25, clearcoat: 1 }),
    new THREE.MeshPhysicalMaterial({ map: capTex, metalness: .6, roughness: .3, clearcoat: 1 }),
    new THREE.MeshPhysicalMaterial({ color: '#7a0a14', metalness: .9, roughness: .3 })];
  const cap = new THREE.Mesh(capGeo, capMats);
  cap.position.y = 2.975; bottle.add(cap);

  // gotas en relieve (algunas gotas grandes de verdad sobre el vidrio)
  const dropGeo = new THREE.SphereGeometry(1, 10, 8);
  const dropMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, transparent: true, opacity: .45, clearcoat: 1, envMapIntensity: 2 });
  const DN = isTouch ? 70 : 140;
  const drops = new THREE.InstancedMesh(dropGeo, dropMat, DN);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  for (let i = 0; i < DN; i++) {
    const y = .2 + Math.random() * 1.35, a = Math.random() * Math.PI * 2, r = .423, sz = .008 + Math.random() ** 3 * .022;
    p3.set(Math.cos(a) * r, y, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    s3.set(sz * .55, sz * (1 + Math.random() * .6), sz);
    drops.setMatrixAt(i, m4.compose(p3, q, s3));
  }
  bottle.add(drops);

  bottle.position.y = 0;
  const rig = new THREE.Group(); rig.add(bottle); scene.add(rig);

  /* ---------- hielo ---------- */
  const iceMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: '#3d86ad', emissiveIntensity: .35, roughness: .08, transmission: 1, thickness: .7, ior: 1.31,
    attenuationColor: new THREE.Color('#bfeaff'), attenuationDistance: 1.6, clearcoat: 1, clearcoatRoughness: .1, normalMap: dropsN, normalScale: new THREE.Vector2(.5, .5) });
  const ice = [];
  const ICE = [[-.78, .16, .25, .34], [.72, .15, .38, .3], [-.42, .14, .72, .27], [.38, .13, .74, .25], [-1.05, .13, -.25, .26], [1.02, .14, -.1, .29], [.05, .12, 1.0, .22], [-.62, .42, .32, .23]];
  ICE.forEach(([x, y, z, s], i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(s, s * .92, s, 3, s * .16), iceMat);
    m.position.set(x, y + (i === 7 ? .08 : 0), z); m.rotation.set(Math.random() * .6, Math.random() * 3, Math.random() * .5);
    m.userData = { base: m.position.clone(), rot: m.rotation.clone(), k: i };
    rig.add(m); ice.push(m);
  });

  /* ---------- piso, sombra y fondo ---------- */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshPhysicalMaterial({ color: '#030b15', roughness: .55, metalness: .1, envMapIntensity: .15 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: soft, color: '#000', transparent: true, opacity: .75, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .003; rig.add(shadow);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: soft, color: '#8fe3ff', transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = .006; rig.add(glow);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), new THREE.MeshBasicMaterial({ map: soft, color: '#1d5a8c', transparent: true, opacity: .9, depthWrite: false, fog: false }));
  back.position.set(0, 2.6, -6); scene.add(back);
  const backAmber = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: soft, color: '#ff9d2e', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  backAmber.position.set(0, 1.5, -2.2); rig.add(backAmber);

  /* ---------- neblina y escarcha ---------- */
  const mist = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.MeshBasicMaterial({ map: cloud, transparent: true, opacity: .2, depthWrite: false, color: '#9fdcff', blending: THREE.AdditiveBlending }));
    m.position.set((Math.random() - .5) * 3, .2 + Math.random() * .25, (Math.random() - .5) * 1.6);
    m.userData = { sp: .08 + Math.random() * .12, ph: Math.random() * 6 }; rig.add(m); mist.push(m);
  }
  const FN = isTouch ? 160 : 320, fp = new Float32Array(FN * 3), fv = new Float32Array(FN);
  for (let i = 0; i < FN; i++) { fp[i * 3] = (Math.random() - .5) * 8; fp[i * 3 + 1] = Math.random() * 5; fp[i * 3 + 2] = (Math.random() - .5) * 5; fv[i] = .1 + Math.random() * .3; }
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const frost = new THREE.Points(fgeo, new THREE.PointsMaterial({ map: soft, size: .06, color: '#cfefff', transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(frost);

  /* ---------- luces ---------- */
  scene.add(new THREE.HemisphereLight('#bfe6ff', '#08121f', .35));
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-3, 5, 4); scene.add(key);
  const rimB = new THREE.SpotLight('#7fd6ff', 60, 14, .6, .6); rimB.position.set(-3.5, 3.5, -3); rimB.target = bottle; scene.add(rimB);
  const rimA = new THREE.SpotLight('#ffb43d', 45, 14, .6, .7); rimA.position.set(3.5, 3, -2.5); rimA.target = bottle; scene.add(rimA);
  const inner = new THREE.PointLight('#ffb040', 6, 3.5, 2); inner.position.set(0, 1.2, -.9); rig.add(inner);

  /* ---------- tamaño / encuadre ---------- */
  let W = 1, H = 1, layout = { x: 0, y: 0, z: 9, ty: 1.45 };
  function resize() {
    const r = hero.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    const portrait = W / H < .85, desk = W >= 1024;
    if (desk) layout = { x: 1.65 + Math.min(1, (W / H - 1.4)) * .8, y: -.05, z: 9.2, ty: 1.5 };
    else if (portrait) {
      // el texto ocupa la parte de arriba: la botella va abajo
      const copy = hero.querySelector('.h3d-copy').getBoundingClientRect().height / H;
      layout = { x: 0, y: -.15 - copy * 2.2, z: 12.4 - Math.min(2.6, (W / H) * 2.6), ty: 1.35 };
    } else layout = { x: 1.3, y: -.2, z: 9.5, ty: 1.5 };
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  /* ---------- interacción ---------- */
  let spin = 0, vel = .35, tiltX = 0, tiltY = 0, tx = 0, ty = 0, drag = null, scrollP = 0, boost = 0;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5); } }, { passive: true });
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; });
  addEventListener('pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    vel = dx * .045; spin += dx * .012; drag.x = e.clientX;
  }, { passive: true });
  addEventListener('pointerup', () => { if (drag && !drag.moved) boost = 1; drag = null; });
  addEventListener('pointercancel', () => { drag = null; });
  addEventListener('deviceorientation', (e) => { if (e.gamma != null) { tx = Math.max(-.5, Math.min(.5, e.gamma / 60)); ty = Math.max(-.5, Math.min(.5, (e.beta - 45) / 80)); } }, { passive: true });
  addEventListener('scroll', () => { scrollP = Math.min(1, Math.max(0, scrollY / (H || 1))); }, { passive: true });

  /* ---------- entrada tras destapar ---------- */
  let intro = 0, introOn = false, introT0 = 0, paused = !!document.getElementById('intro');
  const startIntro = () => { introOn = true; paused = false; introT0 = performance.now() + 150; hero.classList.add('is-live'); last = performance.now(); loop(); };
  // se llama después de definir el bucle (más abajo)
  queueMicrotask(() => { if (!document.getElementById('intro') || window.Intro === undefined) startIntro(); else window.Intro.ready(startIntro); });

  /* ---------- bucle ---------- */
  let visible = true, last = performance.now(), slow = 0, frames = 0, t = 0;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) { last = performance.now(); loop(); } }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = performance.now(); loop(); } });
  const tempEl = document.getElementById('h3dTemp');
  const ease = (x) => 1 - Math.pow(1 - x, 4);
  let raf = 0;

  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    // si el equipo va lento, bajamos resolución y quitamos lo más caro
    frames++; if (dt > .034) slow++;
    if (frames === 90) {
      if (slow > 45 && dprCap > 1) { dprCap = 1; renderer.setPixelRatio(1); resize(); drops.visible = false; mist.forEach(m => m.visible = false); }
      frames = 0; slow = 0;
    }
    if (introOn && intro < 1) intro = reduced ? 1 : Math.max(0, Math.min(1, (now - introT0) / 1800));
    const e = ease(intro);

    if (!drag) { vel += ((reduced ? 0 : .32) + boost * 6 - vel) * Math.min(1, dt * 1.6); boost *= Math.pow(.02, dt); }
    spin += vel * dt;
    tiltX += (ty * .25 - tiltX) * Math.min(1, dt * 3); tiltY += (tx * .5 - tiltY) * Math.min(1, dt * 3);

    rig.position.set(layout.x, layout.y + (1 - e) * 4.5 - scrollP * 1.2, 0);
    bottle.rotation.y = spin + (1 - e) * 5 + scrollP * 2.2 - .5;
    bottle.position.y = reduced ? 0 : Math.sin(t * 1.3) * .035 + .02;
    bottle.rotation.z = Math.sin(t * .9) * .015 + tiltY * .08;
    rig.rotation.x = tiltX * .12; rig.rotation.y = tiltY * .25;
    ice.forEach((m, i) => {
      const k = ease(Math.max(0, Math.min(1, intro * 1.6 - .5 - i * .06)));
      m.scale.setScalar(k); m.position.y = m.userData.base.y + (1 - k) * 1.2;
      m.rotation.y = m.userData.rot.y + t * .05 * (i % 2 ? 1 : -1);
    });
    cap.rotation.y = 0;

    camera.position.set(layout.x * .35 + tiltY * .6, layout.ty + .55 - tiltX * .4 + scrollP * .8, layout.z);
    camera.lookAt(layout.x * .35, layout.ty + scrollP * .3, 0);

    mist.forEach((m) => { m.position.x += 0; m.position.x += Math.sin(t * m.userData.sp + m.userData.ph) * dt * .12; m.material.opacity = .14 + Math.sin(t * .6 + m.userData.ph) * .06; m.lookAt(camera.position); });
    const a = fgeo.attributes.position.array;
    for (let i = 0; i < FN; i++) { a[i * 3 + 1] += fv[i] * dt * .35; a[i * 3] += Math.sin(t + i) * dt * .03; if (a[i * 3 + 1] > 5) a[i * 3 + 1] = 0; }
    fgeo.attributes.position.needsUpdate = true;
    inner.intensity = 5 + Math.sin(t * 2.1) * .8;
    if (tempEl && (frames % 30 === 0)) tempEl.textContent = (-2 + Math.round(Math.sin(t * .4) * 0.6)).toString();

    renderer.render(scene, camera);
    if (visible && !document.hidden) loop();
  }
  function loop() { if (!raf && !paused) raf = requestAnimationFrame(frame); }

  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  loop();
  document.dispatchEvent(new Event('bh:hero-ready'));
}
