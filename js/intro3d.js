/* intro3d.js — Intro 3D: cae una caja de cerveza, sale una botella, se pregunta la edad y se destapa.
 * La carga js/intro.js (que maneja la UI, el sonido y la salida). Si no hay WebGL, intro.js usa la foto. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;
const easeIO = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;

export async function run(root, hooks) {
  const canvas = root.querySelector('canvas');
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('sin WebGL');
  const thud = () => {}, slide = () => {};
  try { await Promise.race([document.fonts.load('900 100px Archivo'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  let pr = Math.min(devicePixelRatio || 1, isTouch ? 1.3 : 1.5); renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false; // sombra falsa (sprite) en vez de shadow maps: mucho más liviano

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .7;
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 120);

  scene.add(new THREE.HemisphereLight('#bfe6ff', '#0a1520', .5));
  const key = new THREE.DirectionalLight('#ffffff', 2.3); key.position.set(4, 12, 7); key.castShadow = true;
  key.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 9; key.shadow.camera.bottom = -6; key.shadow.bias = -.0004; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8fe3ff', 2.2); rim.position.set(-6, 5, -7); scene.add(rim);
  const warm = new THREE.PointLight('#ffb43d', 14, 14, 1.6); warm.position.set(4.5, 2.5, 3); scene.add(warm);
  const heroLight = new THREE.PointLight('#cfefff', 0, 10, 1.6); heroLight.position.set(-2.5, 6.5, 4); scene.add(heroLight);
  const burst = new THREE.PointLight('#ffe2a6', 0, 9, 2); scene.add(burst);

  /* ---------- texturas generadas ---------- */
  const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
  const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  function dropletNormals(size, count, maxR) {
    const hc = cv(size, size, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = (Math.random() ** 2.4) * maxR + 1.2;
        const gr = g.createRadialGradient(x, y - r * .15, 0, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.6, 'rgba(200,200,200,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * .9, r * (1 + Math.random() * .5), 0, 0, 6.283); g.fill();
        if (r > maxR * .55 && Math.random() < .5) { g.fillStyle = 'rgba(190,190,190,.7)'; g.fillRect(x - r * .25, y, r * .5, r * (3 + Math.random() * 6)); }
      }
    });
    const src = hc.getContext('2d').getImageData(0, 0, size, size).data;
    const out = cv(size, size, () => {}), og = out.getContext('2d'), img = og.createImageData(size, size), d = img.data;
    const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * 2.2, dy = (H(x, y - 1) - H(x, y + 1)) * 2.2, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      d[i] = (dx / l * .5 + .5) * 255; d[i + 1] = (dy / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const dropsN = dropletNormals(256, 320, 6); dropsN.repeat.set(3, 3);

  const labelTex = tex(cv(1024, 380, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#f6fbff'); bg.addColorStop(1, '#d6edf8'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const gold = g.createLinearGradient(0, 0, 0, 30); gold.addColorStop(0, '#f7d68b'); gold.addColorStop(.5, '#c8902f'); gold.addColorStop(1, '#f3cf7a');
    g.fillStyle = gold; g.fillRect(0, 0, w, 29); g.fillRect(0, h - 29, w, 29); g.fillStyle = '#0b2440'; g.fillRect(0, 29, w, 4); g.fillRect(0, h - 33, w, 4);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(143,227,255,${Math.random() * .12})`; g.fillRect(Math.random() * w, 35 + Math.random() * (h - 70), 1 + Math.random() * 3, 1 + Math.random() * 3); }
    const cx = w / 2; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#0b2440'; g.font = '800 27px Archivo, Arial'; g.fillText('— CERVEZA · BIEN HELADA · DELIVERY —', cx, 64);
    g.font = '900 125px Archivo, Arial Black, Arial'; g.fillStyle = '#0f3560'; g.fillText('BIEN', cx, 135);
    g.fillStyle = '#c8102e'; g.font = '900 130px Archivo, Arial Black, Arial'; g.fillText('HELADA', cx, 239);
    g.strokeStyle = '#c8902f'; g.lineWidth = 3; [-320, 320].forEach(dx => { g.beginPath(); g.arc(cx + dx, 190, 60, 0, 6.283); g.stroke(); });
    g.fillStyle = '#123b66'; g.font = '700 76px serif'; g.fillText('❄', cx - 320, 194); g.fillText('❄', cx + 320, 194);
    g.font = '800 23px Archivo, Arial'; g.fillStyle = '#0b2440'; g.fillText('LAGER · 620 ml · 4.8% vol.', cx, 318);
  }));
  const neckTex = tex(cv(512, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4d589'); gr.addColorStop(.5, '#b9822a'); gr.addColorStop(1, '#f0c870'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0b2440'; g.fillRect(0, 35, w, 58); g.fillStyle = '#f6e2a8'; g.font = '900 36px Archivo, Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❄ BIEN HELADA ❄', w / 2, 65);
  }));
  const capTex = tex(cv(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w * .4, w * .4, 10, w / 2, w / 2, w / 2); gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(1, '#8e0b1d'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.fillStyle = '#ffe3a1'; g.font = '900 120px Archivo, Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BH', w / 2, w / 2 + 6);
  }));
  const crateLogo = tex(cv(512, 256, (g, w, h) => {
    g.fillStyle = '#0a3a66'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffb43d'; g.font = '900 30px Archivo, Arial'; g.fillText('❄  ❄  ❄', w / 2, 46);
    g.fillStyle = '#ecf6ff'; g.font = '900 92px Archivo, Arial Black'; g.save(); g.translate(w / 2, 118); g.scale(.92, 1); g.fillText('BIEN', 0, 0); g.restore();
    g.fillStyle = '#8fe3ff'; g.save(); g.translate(w / 2, 196); g.scale(.92, 1); g.fillText('HELADA', 0, 0); g.restore();
  }));
  const plasticBump = new THREE.CanvasTexture(cv(256, 256, (g, w) => { const im = g.createImageData(w, w); for (let i = 0; i < im.data.length; i += 4) { const v = 120 + Math.random() * 30; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }));
  plasticBump.wrapS = plasticBump.wrapT = THREE.RepeatWrapping; plasticBump.repeat.set(4, 4);
  const soft = new THREE.CanvasTexture(cv(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }));
  const cloud = new THREE.CanvasTexture(cv(256, 256, (g, w) => { for (let i = 0; i < 26; i++) { const x = w * (.25 + Math.random() * .5), y = w * (.35 + Math.random() * .3), r = w * (.12 + Math.random() * .18), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); } }));
  const floorAlpha = new THREE.CanvasTexture(cv(256, 256, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(.45, '#aaa'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }));

  /* ---------- piso ---------- */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ color: '#0d2238', roughness: .32, metalness: .1, transparent: true, alphaMap: floorAlpha, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: '#2f86c9', transparent: true, opacity: .35, depthWrite: false }));
  glow.scale.set(18, 12, 1); glow.position.set(0, 4, -6); scene.add(glow);

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: soft, color: '#000', transparent: true, opacity: .8, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .01; scene.add(blob);

  /* ---------- botellas ---------- */
  const P = [[0, 0], [.33, 0], [.39, .015], [.415, .06], [.42, .14], [.42, 1.56], [.412, 1.7], [.38, 1.86], [.3, 2.04], [.215, 2.2], [.163, 2.36], [.148, 2.55], [.146, 2.8], [.162, 2.82], [.168, 2.87], [.163, 2.92], [.15, 2.94], [.0, 2.95]];
  const glassGeo = new THREE.LatheGeometry(P.map(([x, y]) => new THREE.Vector2(x, y)), isTouch ? 48 : 72);
  const lblArc = Math.PI * 1.35;
  const labelGeo = new THREE.CylinderGeometry(.426, .426, .78, 64, 1, true, -lblArc / 2 + Math.PI, lblArc);
  const neckGeo = new THREE.CylinderGeometry(.152, .166, .34, 48, 1, true);
  const capGeo = new THREE.CylinderGeometry(.168, .18, .085, 84, 2);
  { const p = capGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), r = Math.hypot(x, z); if (r > .1) { const a = Math.atan2(z, x), k = 1 + .045 * Math.cos(a * 21) * (y < 0 ? 1 : .5); p.setX(i, x * k); p.setZ(i, z * k); } } capGeo.computeVertexNormals(); }
  const heroGlass = new THREE.MeshPhysicalMaterial({ color: '#7a3806', roughness: .05, metalness: .1, clearcoat: 1, clearcoatRoughness: .03, clearcoatNormalMap: dropsN, clearcoatNormalScale: new THREE.Vector2(1, 1),
    sheen: .25, sheenColor: new THREE.Color('#ffc46b'), emissive: '#6a2c00', emissiveIntensity: .45, envMapIntensity: 2.2 });
  const cheapGlass = new THREE.MeshStandardMaterial({ color: '#4a2205', roughness: .12, metalness: .15, envMapIntensity: 1.7 });
  const labelCheap = new THREE.MeshStandardMaterial({ map: labelTex, roughness: .45 });
  const labelMat = new THREE.MeshPhysicalMaterial({ map: labelTex, roughness: .45, clearcoat: .6, clearcoatRoughness: .2, clearcoatNormalMap: dropsN, clearcoatNormalScale: new THREE.Vector2(.6, .6) });
  const neckMat = new THREE.MeshPhysicalMaterial({ map: neckTex, metalness: .75, roughness: .28, clearcoat: .8 });
  const capCheap = new THREE.MeshStandardMaterial({ color: '#a50f1d', metalness: .8, roughness: .3 });
  const capMats = [new THREE.MeshPhysicalMaterial({ color: '#b0101f', metalness: .9, roughness: .25, clearcoat: 1 }), new THREE.MeshPhysicalMaterial({ map: capTex, metalness: .6, roughness: .3, clearcoat: 1 }), new THREE.MeshPhysicalMaterial({ color: '#7a0a14', metalness: .9, roughness: .3 })];
  function makeBottle(hero) {
    const b = new THREE.Group();
    const gl = new THREE.Mesh(glassGeo, hero ? heroGlass : cheapGlass); gl.castShadow = true; b.add(gl);
    const lb = new THREE.Mesh(labelGeo, hero ? labelMat : labelCheap); lb.position.y = .82; lb.rotation.y = Math.PI; b.add(lb);
    const nk = new THREE.Mesh(neckGeo, neckMat); nk.position.y = 2.42; b.add(nk);
    const cp = new THREE.Mesh(capGeo, hero ? capMats : capCheap); cp.position.y = 2.975; cp.castShadow = true; b.add(cp);
    b.userData.cap = cp;
    return b;
  }

  /* ---------- caja de plástico ---------- */
  const crate = new THREE.Group(), crateInner = new THREE.Group(); crate.add(crateInner); scene.add(crate);
  const plastic = new THREE.MeshPhysicalMaterial({ color: '#0e5a9c', roughness: .42, metalness: 0, clearcoat: .35, clearcoatRoughness: .4, bumpMap: plasticBump, bumpScale: .4, sheen: .3, sheenColor: new THREE.Color('#8fe3ff') });
  const plasticDark = new THREE.MeshStandardMaterial({ color: '#0a3f70', roughness: .6 });
  const rr = (x, y, w, h, r) => { const p = new THREE.Path(); p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h); p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); return p; };
  function wall(w, h, slots) {
    const s = new THREE.Shape(); const o = rr(-w / 2, 0, w, h, .06); s.curves = o.curves; s.currentPoint = o.currentPoint;
    s.holes.push(rr(-.6, h - .5, 1.2, .3, .14));
    slots.forEach(([x0, x1]) => { for (let x = x0; x <= x1 + 1e-6; x += .22) s.holes.push(rr(x - .06, .3, .12, .72, .06)); });
    const g = new THREE.ExtrudeGeometry(s, { depth: .1, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 1, curveSegments: 3 });
    g.translate(0, 0, -.05); return g;
  }
  const CW = 4.24, CD = 3.24, CH = 1.7;
  const longW = wall(CW, CH, [[-1.86, -1.0], [1.0, 1.86]]), shortW = wall(CD, CH, [[-1.32, 1.32]]);
  const addM = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; crateInner.add(m); return m; };
  addM(new RoundedBoxGeometry(CW, .14, CD, 2, .04), plastic, 0, .07, 0);
  addM(longW, plastic, 0, 0, CD / 2 - .06); addM(longW, plastic, 0, 0, -CD / 2 + .06, Math.PI);
  addM(shortW, plastic, CW / 2 - .06, 0, 0, Math.PI / 2); addM(shortW, plastic, -CW / 2 + .06, 0, 0, -Math.PI / 2);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => addM(new RoundedBoxGeometry(.28, CH + .08, .28, 2, .07), plastic, sx * (CW / 2 - .06), (CH + .08) / 2, sz * (CD / 2 - .06)));
  addM(new RoundedBoxGeometry(CW + .12, .12, .24, 2, .05), plastic, 0, CH, CD / 2 - .06); addM(new RoundedBoxGeometry(CW + .12, .12, .24, 2, .05), plastic, 0, CH, -CD / 2 + .06);
  addM(new RoundedBoxGeometry(.24, .12, CD + .12, 2, .05), plastic, CW / 2 - .06, CH, 0); addM(new RoundedBoxGeometry(.24, .12, CD + .12, 2, .05), plastic, -CW / 2 + .06, CH, 0);
  [-1, 0, 1].forEach(x => addM(new THREE.BoxGeometry(.04, 1.0, CD - .2), plasticDark, x, .64, 0));
  [-.5, .5].forEach(z => addM(new THREE.BoxGeometry(CW - .2, 1.0, .04), plasticDark, 0, .64, z));
  const logoPlate = addM(new RoundedBoxGeometry(1.86, .86, .04, 2, .03), new THREE.MeshPhysicalMaterial({ map: crateLogo, roughness: .35, clearcoat: .6 }), 0, .66, CD / 2 + .015);
  logoPlate.castShadow = false;

  const COLS = [-1.5, -.5, .5, 1.5], ROWS = [-1, 0, 1], HERO_I = 9; // fila delantera, segunda desde la izquierda
  const bottles = [];
  ROWS.forEach((z, ri) => COLS.forEach((x, ci) => {
    const i = ri * 4 + ci, hero = i === HERO_I, b = makeBottle(hero);
    b.position.set(x, .14, z); b.rotation.y = hero ? 0 : Math.random() * 6.28;
    b.userData.base = b.position.clone(); b.userData.ph = Math.random() * 6.28; b.userData.amp = .03 + Math.random() * .05;
    crateInner.add(b); bottles.push(b);
  }));
  const heroB = bottles[HERO_I], heroCap = heroB.userData.cap;
  const LIFT = 4.4, HERO_Z = 1.4;

  /* ---------- partículas ---------- */
  const parts = [];
  function spawn(opts) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: opts.map || soft, color: opts.color || '#d8f2ff', transparent: true, opacity: 0, depthWrite: false }));
    m.position.copy(opts.p); scene.add(m);
    parts.push(Object.assign({ m, age: 0, life: 1, s0: .3, s1: 1.2, o: .6, g: 0, drag: 1.5 }, opts));
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.age += dt; const k = q.age / q.life;
      if (k >= 1) { scene.remove(q.m); q.m.material.dispose(); parts.splice(i, 1); continue; }
      q.v.y += q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.m.position.addScaledVector(q.v, dt);
      if (q.floor && q.m.position.y < .05) { q.m.position.y = .05; q.v.y *= -.2; q.v.x *= .6; q.v.z *= .6; }
      const s = lerp(q.s0, q.s1, easeOut(k)); q.m.scale.set(s, s, 1); q.m.material.opacity = q.o * (k < .12 ? k / .12 : 1 - (k - .12) / .88);
    }
  }
  function impactDust() {
    for (let i = 0; i < (isTouch ? 12 : 18); i++) {
      const a = Math.random() * 6.283, r = 2.2 + Math.random() * .6;
      spawn({ map: cloud, p: new THREE.Vector3(Math.cos(a) * r * 1.1, .15 + Math.random() * .2, Math.sin(a) * r * .8), v: new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 4), .4 + Math.random() * 1.4, Math.sin(a) * (3 + Math.random() * 4)),
        life: 1 + Math.random() * .8, s0: .8, s1: 3 + Math.random() * 2, o: .55, drag: 2.4, color: '#cdeeff' });
    }
    for (let i = 0; i < 14; i++) { // escarcha que salta
      const a = Math.random() * 6.283;
      spawn({ p: new THREE.Vector3(Math.cos(a) * 1.8, 1.6, Math.sin(a) * 1.3), v: new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 2.5), 3 + Math.random() * 4, Math.sin(a) * (1 + Math.random() * 2.5)),
        life: 1.1, s0: .1, s1: .06, o: 1, g: -16, drag: .3, floor: true, color: '#ffffff' });
    }
  }
  const foamHead = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: '#f3e4c4', roughness: .95, emissive: '#2a1a05', emissiveIntensity: .2 }));
  foamHead.visible = false; heroB.add(foamHead);

  /* ---------- cámara ---------- */
  const tmp = new THREE.Vector3(), camT = new THREE.Vector3(), camP = new THREE.Vector3();
  let wide, close;
  function frame() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), a = camera.aspect, port = a < .9;
    wide = { t: new THREE.Vector3(0, port ? 1.0 : 1.4, 0), d: Math.max(3.3 / th, 3.2 / (th * a)) * (port ? 1 : 1.05), az: .42, el: .36 };
    // primer plano: la botella ocupa la parte alta para dejar espacio a la pregunta
    const V = port ? 7.4 : 5.8, cy = .14 + LIFT + 1.5;
    close = { t: new THREE.Vector3(0, cy - V * (port ? .13 : .08), HERO_Z), d: Math.max(V / (2 * th), 1.4 / (th * a)), az: .16, el: .1 };
  }
  function camAt(v) { camP.set(Math.sin(v.az) * Math.cos(v.el), Math.sin(v.el), Math.cos(v.az) * Math.cos(v.el)).multiplyScalar(v.d).add(v.t); return camP.clone(); }
  frame(); addEventListener('resize', frame);
  const unbind = () => removeEventListener('resize', frame);

  /* ---------- línea de tiempo ---------- */
  const T = { fall0: .35, hit: 1.05, rise0: 1.75, rise1: 3.0, cam0: 1.55, cam1: 3.25, ready: 3.15 };
  let t0 = performance.now(), last = t0, hitDone = false, slideDone = false, readyDone = false, openAt = -1, noAt = -1, endShown = false, capFree = false;
  const capV = new THREE.Vector3();
  function reset() {
    t0 = performance.now(); hitDone = slideDone = readyDone = endShown = capFree = false; openAt = noAt = -1;
    heroB.add(heroCap); heroCap.position.set(0, 2.975, 0); heroCap.rotation.set(0, 0, 0); foamHead.visible = false;
    parts.splice(0).forEach(q => scene.remove(q.m));
    if (reduced) { t0 -= T.ready * 1000; hitDone = slideDone = true; }
  }
  window.__seek = (t) => { t0 = performance.now() - t * 1000; };

  function update(t, dt, now) {
    // --- la caja cae y rebota ---
    const kf = clamp01((t - T.fall0) / (T.hit - T.fall0)), kk = kf * kf;
    let y = 11 * (1 - kk), sq = 1, rx = .28 * (1 - kk), rz = -.16 * (1 - kk);
    const ry = -.9 * (1 - easeOut(kf));
    const tb = Math.max(0, t - T.hit);
    if (t >= T.hit) {
      y = Math.abs(Math.sin(tb * 11)) * .45 * Math.exp(-tb * 5.5);
      sq = 1 - .07 * Math.exp(-tb * 9) * Math.cos(tb * 34);
      rx = .035 * Math.exp(-tb * 4) * Math.sin(tb * 17); rz = -.03 * Math.exp(-tb * 4) * Math.sin(tb * 13 + 1);
      if (!hitDone) { hitDone = true; thud(); impactDust(); }
    }
    crate.position.y = y; crate.rotation.set(rx, ry, rz); crateInner.scale.set(1 + (1 - sq) * .5, sq, 1 + (1 - sq) * .5);
    crate.visible = t > T.fall0 - .05;
    { const k = clamp01(1 - y / 11); blob.visible = crate.visible; blob.scale.set(6.6 * (1.4 - .4 * k), 5.2 * (1.4 - .4 * k), 1); blob.material.opacity = .85 * k * k; }

    // botellas tintinean con el golpe
    const shake = t >= T.hit ? Math.exp(-tb * 3.2) : 0;
    bottles.forEach((b) => {
      if (b === heroB && t > T.rise0) return;
      const u = b.userData; b.rotation.x = u.amp * shake * Math.sin(tb * 26 + u.ph); b.rotation.z = u.amp * shake * Math.cos(tb * 23 + u.ph);
      b.position.y = u.base.y + Math.max(0, Math.sin(tb * 20 + u.ph)) * .06 * shake;
    });

    // --- la botella sale girando ---
    const kr = clamp01((t - T.rise0) / (T.rise1 - T.rise0));
    if (t > T.rise0 && !slideDone) { slideDone = true; slide(); }
    let lift = easeIO(kr);
    if (noAt >= 0) lift *= 1 - easeIO(clamp01((t - noAt) / 1.1));
    const bob = readyDone && noAt < 0 ? Math.sin(now / 650) * .05 : 0;
    if (t > T.rise0) {
      const b0 = heroB.userData.base;
      heroB.position.set(lerp(b0.x, 0, lift), b0.y + LIFT * lift + bob, lerp(b0.z, HERO_Z, lift));
      const spin = (1 - easeOut(kr)) * Math.PI * 2.5;
      heroB.rotation.set(Math.sin(kr * Math.PI) * .18, .16 + spin + (readyDone && openAt < 0 && noAt < 0 ? Math.sin(now / 1400) * .22 : 0), Math.sin(kr * Math.PI) * -.08);
    }
    heroLight.intensity = 22 * lift;

    // --- cámara ---
    let kc = easeIO(clamp01((t - T.cam0) / (T.cam1 - T.cam0)));
    if (noAt >= 0) kc *= 1 - easeIO(clamp01((t - noAt) / 1.3));
    camera.position.lerpVectors(camAt(wide), camAt(close), kc);
    camT.lerpVectors(wide.t, close.t, kc);
    if (openAt >= 0) { const ko = easeOut(clamp01((t - openAt) / 1.6)); camera.position.lerp(camT, .12 * ko); }
    const sh = (t >= T.hit ? .22 * Math.exp(-tb * 7) : 0) + (openAt >= 0 ? .08 * Math.exp(-(t - openAt) * 6) : 0);
    camera.position.x += Math.sin(t * 57) * sh; camera.position.y += Math.cos(t * 49) * sh;
    camera.lookAt(camT);

    // --- lista: pregunta de edad ---
    if (t > T.ready && !readyDone && noAt < 0) { readyDone = true; hooks.ready(); }
    if (readyDone && openAt < 0 && noAt < 0 && Math.random() < dt * 4) { // vaho frío
      heroB.getWorldPosition(tmp);
      spawn({ map: cloud, p: tmp.clone().add(new THREE.Vector3((Math.random() - .5) * .8, .6 + Math.random() * 2, .2)), v: new THREE.Vector3((Math.random() - .5) * .3, .35 + Math.random() * .3, 0), life: 2.6, s0: .6, s1: 2, o: .32, drag: .2, color: '#d6f1ff' });
    }

    // --- destapar ---
    if (openAt >= 0) {
      const to = t - openAt;
      if (!capFree) {
        capFree = true; scene.attach(heroCap); capV.set(1.4, 8.5, 1.6);
        heroB.getWorldPosition(tmp); burst.position.copy(tmp).add(new THREE.Vector3(0, 3, .6));
      }
      if (heroCap.parent === scene) { capV.y -= 18 * dt; heroCap.position.addScaledVector(capV, dt); heroCap.rotation.x += dt * 14; heroCap.rotation.z += dt * 9; }
      burst.intensity = 40 * Math.exp(-to * 4);
      heroB.rotation.z += -.06 * Math.exp(-to * 6) * Math.sin(to * 30);
      const kf2 = clamp01(to / .7); foamHead.visible = true; foamHead.position.set(0, 2.93 + .1 * easeOut(kf2), 0); foamHead.scale.set(.155 + .02 * kf2, .05 + .09 * easeOut(kf2), .155 + .02 * kf2);
      if (to < .9) {
        const top = heroB.localToWorld(tmp.set(0, 3.05, 0)).clone();
        for (let i = 0; i < (to < .2 ? 6 : 2); i++) {
          const a = Math.random() * 6.283, sp = Math.random();
          spawn({ p: top.clone(), v: new THREE.Vector3(Math.cos(a) * sp * 2.2, 3.5 + Math.random() * 4.5, Math.sin(a) * sp * 1.6 + .6), life: .9 + Math.random() * .7, s0: .08 + Math.random() * .1, s1: .22 + Math.random() * .18, o: 1, g: -11, drag: .6, color: '#fff6e2' });
        }
      }
      if (to > 1.35 && !endShown) { endShown = true; hooks.opened(); }
    } else burst.intensity = 0;
  }

  // precompila shaders y sube texturas ANTES de arrancar el reloj (si no, el primer cuadro se congela segundos)
  foamHead.visible = true; crate.visible = true; blob.visible = true;
  const warm1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, transparent: true, depthWrite: false })), warm2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloud, transparent: true, depthWrite: false }));
  scene.add(warm1, warm2); camera.position.set(0, 6, 20); camera.lookAt(0, 2, 0);
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) {}
  renderer.render(scene, camera);
  scene.remove(warm1, warm2); foamHead.visible = false;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let slow = 0, frames = 0;
  renderer.setAnimationLoop((now) => {
    const raw = now - last, dt = Math.min(.05, raw / 1000); last = now;
    if (document.hidden) return; // nada que dibujar
    // calidad adaptativa: si el equipo no llega a ~40 fps, baja la resolución
    if (++frames > 20 && frames < 400 && pr > .8) { slow = slow * .9 + (raw > 25 ? .1 : 0); if (slow > .6) { pr = Math.max(.8, pr - .25); renderer.setPixelRatio(pr); frame(); slow = 0; } }
    const t = (now - t0) / 1000;
    update(t, dt, now); stepParts(dt);
    renderer.render(scene, camera);
  });
  root.classList.add('on3d');
  reset();
  return {
    open() { openAt = (performance.now() - t0) / 1000; },
    no() { noAt = (performance.now() - t0) / 1000; },
    dispose() { renderer.setAnimationLoop(null); unbind(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} }
  };
}
