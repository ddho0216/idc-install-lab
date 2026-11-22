/* IDC Labs — 책상 위 3D 실습판. 모든 수치는 학습용 가상 값입니다. */
(function () {
'use strict';
const T = THREE;
const $ = s => document.querySelector(s);
const cv = $('#cv');
const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.useLegacyLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
scene.background = new T.Color(0x3a2a20);
const camera = new T.PerspectiveCamera(36, 1, 0.1, 200);
const root = new T.Group(); scene.add(root);

/* ---------- 조명 ---------- */
scene.add(new T.HemisphereLight(0xfff4e4, 0x3a2a20, 0.85));
const sun = new T.DirectionalLight(0xfff0d8, 0.95);
sun.position.set(-6, 12, 7); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
scene.add(sun);
const fill = new T.PointLight(0xffc68a, 0.5, 40); fill.position.set(6, 6, 6); scene.add(fill);

/* ---------- 도우미 ---------- */
const redraws = [];
function cTex(c, rep) {
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mat(color, o) { return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.65, metalness: 0.05 }, o || {})); }
function box(parent, w, h, d, color, x, y, z, o) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), Array.isArray(color) ? color : mat(color, o));
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function cyl(parent, r, h, color, x, y, z, o) {
  const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 20), mat(color, o));
  m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function label(parent, text, x, y, z, o) {
  o = Object.assign({ scale: 0.006, color: '#1b1917', bg: 'rgba(243,239,230,.94)', font: '500 26px "IBM Plex Mono",monospace', pad: 12 }, o || {});
  const c = canvas(8, 8), sp = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthTest: false }));
  sp.renderOrder = 10; sp.position.set(x, y, z); parent.add(sp);
  const api = { sprite: sp, text: '', set(t, col, bg) {
    if (t !== undefined) this.text = t; if (col) o.color = col; if (bg) o.bg = bg;
    const g = c.getContext('2d'); g.font = o.font; const w = Math.ceil(g.measureText(this.text).width) + o.pad * 2, h = 26 + o.pad * 1.4;
    c.width = w; c.height = h; g.font = o.font; g.textBaseline = 'middle';
    if (o.bg) { g.fillStyle = o.bg; g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, 8) : g.rect(0, 0, w, h); g.fill(); }
    g.fillStyle = o.color; g.fillText(this.text, o.pad, h / 2 + 1);
    if (sp.material.map) sp.material.map.dispose();
    sp.material.map = cTex(c); sp.material.needsUpdate = true; sp.scale.set(w * o.scale, h * o.scale, 1);
  } };
  api.set(text); redraws.push(() => api.set()); return api;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ---------- 책상·종이 ---------- */
(function desk() {
  const c = canvas(1024, 1024), g = c.getContext('2d');
  g.fillStyle = '#4a3426'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * 1024, a = 0.05 + Math.random() * 0.12;
    g.strokeStyle = Math.random() < 0.5 ? `rgba(20,10,4,${a})` : `rgba(210,160,110,${a * 0.6})`; g.lineWidth = 0.6 + Math.random() * 2.2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * (3 + Math.random() * 4));
    g.stroke();
  }
  const m = new T.Mesh(new T.PlaneGeometry(80, 56), new T.MeshStandardMaterial({ map: cTex(c, [10, 7]), roughness: 0.8 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; root.add(m);
})();
function paper(sheet, notes) {
  const W = 2048, H = 1280, c = canvas(W, H), g = c.getContext('2d');
  const draw = () => {
    g.fillStyle = '#ece5d3'; g.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += 64) { g.strokeStyle = x % 256 === 0 ? 'rgba(90,80,60,.28)' : 'rgba(90,80,60,.12)'; g.lineWidth = x % 256 === 0 ? 1.6 : 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 64) { g.strokeStyle = y % 256 === 0 ? 'rgba(90,80,60,.28)' : 'rgba(90,80,60,.12)'; g.lineWidth = y % 256 === 0 ? 1.6 : 1; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = '#2b2620'; g.lineWidth = 3; g.strokeRect(30, 30, W - 60, H - 60);
    g.fillStyle = '#ece5d3'; g.fillRect(W - 560, H - 170, 520, 130); g.strokeRect(W - 560, H - 170, 520, 130);
    g.beginPath(); g.moveTo(W - 560, H - 105); g.lineTo(W - 40, H - 105); g.stroke();
    g.fillStyle = '#2b2620'; g.font = '600 34px "Noto Serif KR",serif'; g.fillText('IDC LABS · 실습 시트 ' + sheet, W - 540, H - 125);
    g.font = '500 22px "IBM Plex Mono",monospace'; g.fillStyle = '#6f6a60'; g.fillText('PRACTICE ONLY · 모든 값은 가상', W - 540, H - 62);
    g.fillStyle = '#d9480f'; g.font = '34px "Nanum Pen Script",cursive';
    (notes || []).forEach(n => { g.save(); g.translate(n[0], n[1]); g.rotate((n[3] || 0) * Math.PI / 180); g.font = (n[4] || 40) + 'px "Nanum Pen Script","Noto Sans KR",cursive'; g.fillText(n[2], 0, 0); g.restore(); });
  };
  draw();
  const t = cTex(c);
  const m = new T.Mesh(new T.PlaneGeometry(16, 10), new T.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.receiveShadow = true;
  redraws.push(() => { draw(); t.needsUpdate = true; });
  return m;
}
function board(parent, w, d, drawFn) {
  const s = 100, c = canvas(w * s, d * s), g = c.getContext('2d');
  const draw = () => {
    g.fillStyle = '#20262a'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
    for (let x = 0; x < c.width; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
    for (let y = 0; y < c.height; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.strokeRect(10, 10, c.width - 20, c.height - 20);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.strokeStyle = 'rgba(255,255,255,.55)';
    drawFn && drawFn(g, x => (x + w / 2) * s, z => (z + d / 2) * s, s);
  };
  draw();
  const t = cTex(c);
  const base = box(parent, w, 0.2, d, 0x1b2024, 0, 0.11, 0);
  const top = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ map: t, roughness: 0.8 }));
  top.rotation.x = -Math.PI / 2; top.position.set(0, 0.215, 0); top.receiveShadow = true; parent.add(top);
  redraws.push(() => { draw(); t.needsUpdate = true; });
  return { base, top };
}

/* ---------- 실습 런타임 ---------- */
const labsDef = {};
let L = null;                  // 현재 실습
const pinHover = { id: null };

function newLab(def) {
  const lab = { def, group: new T.Group(), pins: {}, wires: [], hits: [], taps: {}, state: {}, done: [], flags: {}, hist: [], anim: [] };
  return lab;
}
function addPin(lab, id, x, y, z, color, text, opt) {
  opt = opt || {};
  const g = new T.Group(); g.position.set(x, 0.215, z); lab.group.add(g);
  cyl(g, 0.15, 0.1, 0x0c0e10, 0, 0.05, 0);
  cyl(g, 0.06, y, 0xc9a24a, 0, y / 2 + 0.05, 0, { metalness: 0.8, roughness: 0.3 });
  const ball = new T.Mesh(new T.SphereGeometry(0.105, 18, 14), mat(0xd9b45a, { metalness: 0.85, roughness: 0.25, emissive: new T.Color(color), emissiveIntensity: 0.15 }));
  ball.position.y = y + 0.1; ball.castShadow = true; g.add(ball);
  const hit = new T.Mesh(new T.SphereGeometry(0.34, 10, 8), new T.MeshBasicMaterial({ visible: false }));
  hit.position.y = y + 0.1; g.add(hit);
  const pos = new T.Vector3(x, 0.215 + y + 0.1, z);
  const tag = label(g, text, opt.tx || 0, y + (opt.ty || 0.62), opt.tz || 0, { scale: 0.0048, font: '500 22px "IBM Plex Mono",monospace', color: '#efe8db', bg: 'rgba(16,15,14,.86)', pad: 9 });
  const pin = { id, pos, ball, color, hit, group: g, wire: null, tag };
  hit.userData.pin = pin; lab.pins[id] = pin; lab.hits.push(hit); return pin;
}
function addTap(lab, id, mesh, fn, cursor) {
  mesh.userData.tap = fn; mesh.userData.tapId = id; lab.taps[id] = mesh; lab.hits.push(mesh);
}
function wireCurve(a, b) {
  const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 0.3 + a.distanceTo(b) * 0.1;
  const up = v => v.clone().add(new T.Vector3(0, 0.38, 0));
  return new T.CatmullRomCurve3([a, up(a), mid, up(b), b], false, 'catmullrom', 0.5);
}
function wireMesh(curve, color) {
  return new T.Mesh(new T.TubeGeometry(curve, 36, 0.045, 8), mat(color, { roughness: 0.45 }));
}
function connect(a, b) {
  const curve = wireCurve(a.pos, b.pos), m = wireMesh(curve, a.color);
  m.castShadow = true; L.group.add(m);
  const w = { a, b, mesh: m, curve, pulse: new T.Mesh(new T.SphereGeometry(0.075, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff })), t: Math.random() };
  w.pulse.visible = false; L.group.add(w.pulse); if (L.state.tripped) L.state.tripped = { A: false, B: false };
  m.userData.wire = w; L.hits.push(m); L.wires.push(w); a.wire = b.wire = w; return w;
}
function removeWire(w) {
  if (L.state.tripped) L.state.tripped = { A: false, B: false };
  L.group.remove(w.mesh); L.group.remove(w.pulse); w.mesh.geometry.dispose();
  L.hits.splice(L.hits.indexOf(w.mesh), 1); L.wires.splice(L.wires.indexOf(w), 1);
  w.a.wire = w.b.wire = null;
}
function wireOf(id) { const p = L.pins[id]; return p && p.wire ? { w: p.wire, other: p.wire.a === p ? p.wire.b : p.wire.a } : null; }

/* ---------- 토스트 ---------- */
let toastT = 0;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---------- UI ---------- */
const order = ['power', 'fiber', 'airflow', 'rack'];
function buildPills() {
  $('#pills').innerHTML = order.map((id, i) => `<a href="#/lab/${id}" data-id="${id}"><small>0${i + 1}</small>${labsDef[id].meta.nav}</a>`).join('');
}
function renderLesson() {
  const m = L.def.meta, cur = L.done.findIndex(d => !d), i = order.indexOf(m.id), all = cur < 0;
  $('#lesson').innerHTML =
    `<div class="kick"><span>LAB 0${i + 1} / 0${order.length}</span><b>${m.time}</b></div><h1>${m.title}</h1><p class="desc">${m.desc}</p>` +
    `<ol>${L.def.steps.map((s, k) => `<li class="${L.done[k] ? 'done' : k === cur ? 'cur' : ''}"><span class="n">${String(k + 1).padStart(2, '0')}</span><span><span class="t">${s.t}</span>${k === cur && s.h ? `<br><small style="color:#6f6a60;font-weight:400">${s.h}</small>` : ''}</span></li>`).join('')}</ol>` +
    `<details class="why"${all ? ' open' : ''}><summary>왜 중요할까요</summary><p>${m.why}</p></details>` +
    `<button class="next" id="next" style="${all ? 'background:#d9480f;border-color:#d9480f;color:#fff' : ''}">${i < order.length - 1 ? '다음 실습 →' : '처음으로 ↺'}</button>`;
  $('#next').onclick = () => { location.hash = '#/lab/' + order[(i + 1) % order.length]; };
}
function buildInstr() {
  const m = L.def;
  $('#instr').innerHTML = `<h2>INSTRUMENTS</h2>${m.series ? '<canvas id="gr"></canvas>' : ''}<div id="rows"></div>${m.note ? `<p class="note">${m.note}</p>` : ''}`;
  L.grCanvas = $('#gr');
}
function updateInstr() {
  const rows = L.def.rows(L);
  $('#rows').innerHTML = rows.map(r => `<div class="row"><span>${r[0]}</span><span class="${r[2] || ''}">${r[1]}</span></div>`).join('');
}
function drawGraph() {
  const c = L.grCanvas; if (!c || !L.def.series) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth, h = c.clientHeight;
  if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const D = L.def, [lo, hi] = D.range(L), Y = v => h - 6 - (v - lo) / (hi - lo) * (h - 12);
  (D.lines ? D.lines(L) : []).forEach(l => { g.strokeStyle = l.color; g.setLineDash([4, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(0, Y(l.v)); g.lineTo(w, Y(l.v)); g.stroke(); });
  g.setLineDash([]);
  D.series.forEach((s, k) => {
    g.strokeStyle = s.color; g.lineWidth = 1.8; g.beginPath();
    L.hist.forEach((hh, i) => { const x = i / 89 * w, y = Y(clamp(hh[k], lo, hi)); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  });
}
function buildBar() {
  const bar = $('#bar'); bar.innerHTML = '';
  L.def.controls(L).forEach(c => {
    if (c.k === 'range') {
      const l = document.createElement('label'); l.innerHTML = `${c.label}<input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.get()}" aria-label="${c.label}"><b></b>`;
      const inp = l.querySelector('input'), out = l.querySelector('b');
      inp.oninput = () => { c.set(+inp.value); recalc(); };
      c.sync = () => { if (+inp.value !== c.get()) inp.value = c.get(); out.textContent = c.fmt(c.get()); }; bar.appendChild(l);
    } else if (c.k === 'seg') {
      const wrap = document.createElement('div'); wrap.className = 'seg'; wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', c.label);
      wrap.innerHTML = c.opts.map(o => `<button data-v="${o[0]}">${o[1]}</button>`).join('');
      wrap.onclick = e => { const b = e.target.closest('button'); if (!b) return; c.set(isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v); recalc(); };
      c.sync = () => wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(b.dataset.v) === String(c.get())));
      if (c.label) { const l = document.createElement('label'); l.textContent = c.label; l.appendChild(wrap); bar.appendChild(l); } else bar.appendChild(wrap);
    } else {
      const b = document.createElement('button'); b.className = 'btn' + (c.pri ? ' pri' : ''); b.textContent = c.text; b.onclick = () => { c.fn(); recalc(); }; bar.appendChild(b); c.sync = () => { };
    }
  });
  L.ctrls = L.def.controls.last;
}
function syncBar() { (L.ctrlList || []).forEach(c => c.sync && c.sync()); }

function checkSteps() {
  let changed = false;
  L.def.steps.forEach((s, k) => {
    if (!L.done[k] && (k === 0 || L.done[k - 1]) && s.test(L)) { L.done[k] = true; changed = true; toast('✓ ' + s.t); }
  });
  if (changed || L.firstRender) { renderLesson(); L.firstRender = false; }
}
function recalc() {
  L.def.calc(L); L.def.visual(L); updateInstr(); syncBar(); checkSteps();
}

/* ---------- 카메라(궤도) ---------- */
const cam = { az: -0.5, pol: 0.95, dist: 11, tx: 0, ty: 0.3, tz: 0, goal: null };
function placeCam() {
  const s = Math.sin(cam.pol), p = new T.Vector3(cam.tx + cam.dist * s * Math.sin(cam.az), cam.ty + cam.dist * Math.cos(cam.pol), cam.tz + cam.dist * s * Math.cos(cam.az));
  camera.position.copy(p); camera.lookAt(cam.tx, cam.ty, cam.tz);
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  const shift = w > 900 ? 30 : 0; camera.setViewOffset(w, h, -shift, 0, w, h); camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ---------- 포인터 ---------- */
const ray = new T.Raycaster(), ndc = new T.Vector2();
function pick(e) {
  if (!L) return null;
  const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hs = ray.intersectObjects(L.hits, false); if (!hs.length) return null;
  return hs.find(h => h.object.userData.pin) || hs[0];
}
let drag = null, preview = null;
function pinReason(a, b) { return L.def.canConnect(L, a, b); }
function setPreview(from, pt) {
  if (preview) { L.group.remove(preview); preview.geometry.dispose(); preview = null; }
  if (!pt) return;
  const curve = wireCurve(from.pos, pt); preview = wireMesh(curve, from.color); preview.material.transparent = true; preview.material.opacity = 0.7; L.group.add(preview);
}
function groundPoint(e, y) {
  const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const t = (y - ray.ray.origin.y) / ray.ray.direction.y; return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
}
cv.addEventListener('pointerdown', e => {
  if (!L) return; cv.setPointerCapture(e.pointerId); cam.goal = null;
  const h = pick(e);
  if (h && h.object.userData.pin) {
    const p = h.object.userData.pin;
    if (p.wire) { toast('이미 선이 연결돼 있습니다. 선을 탭하면 제거됩니다.'); drag = { type: 'orbit', x: e.clientX, y: e.clientY, moved: 99 }; return; }
    drag = { type: 'wire', from: p }; cv.classList.add('wire'); setHover(p);
  } else drag = { type: 'orbit', x: e.clientX, y: e.clientY, moved: 0, obj: h && (h.object.userData.tap || h.object.userData.wire) ? h.object : null };
});
cv.addEventListener('pointermove', e => {
  if (!L) return;
  if (!drag) {
    const h = pick(e); cv.classList.toggle('wire', !!(h && h.object.userData.pin)); cv.classList.toggle('tap', !!(h && !h.object.userData.pin && (h.object.userData.tap || h.object.userData.wire)));
    if (L.def.hover) L.def.hover(L, h && h.object.userData.hov !== undefined ? h.object.userData.hov : null);
    return;
  }
  if (drag.type === 'orbit') {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    cam.az -= dx * 0.006; cam.pol = clamp(cam.pol - dy * 0.005, 0.3, 1.45);
  } else {
    const h = pick(e), over = h && h.object.userData.pin && h.object.userData.pin !== drag.from ? h.object.userData.pin : null;
    setHover(over, drag.from); drag.over = over;
    setPreview(drag.from, over ? over.pos : groundPoint(e, drag.from.pos.y));
  }
});
function endDrag(e) {
  if (!drag) return; const d = drag; drag = null; cv.classList.remove('wire'); setPreview(null); setHover(null);
  if (d.type === 'orbit' && d.moved < 6 && d.obj) {
    if (d.obj.userData.wire) { removeWire(d.obj.userData.wire); toast('선을 뽑았습니다.'); recalc(); }
    else d.obj.userData.tap();
  } else if (d.type === 'wire' && d.over) {
    const why = pinReason(d.from, d.over);
    if (why && why.err) { toast(why.err); return; }
    const w = connect(d.from, d.over); if (why && why.warn) toast(why.warn); recalc();
  }
}
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.08), L.def.cam.min, L.def.cam.max); }, { passive: false });
function setHover(p, from) {
  Object.values(L.pins).forEach(q => {
    const r = from && q !== from && !q.wire ? L.def.canConnect(L, from, q) : { err: 1 };
    const on = q === p || !(r && r.err);
    q.ball.scale.setScalar(q === p ? 1.5 : on ? 1.25 : 1); q.ball.material.emissiveIntensity = q === p ? 0.8 : on ? 0.45 : 0.15;
  });
}

/* ---------- 실습 정의 공용 ---------- */
function fmt(v, n) { return v.toFixed(n === undefined ? 1 : n); }

/* ===== LAB 1 전원 ===== */
labsDef.power = {
  meta: { id: 'power', nav: '전원', time: '약 8분', title: '이중 전원과 PDU 용량', desc: '서버 한 대에는 전원 입구(PSU)가 두 개입니다. 각각 다른 PDU에 꽂고, PDU가 한쪽만 남아도 버티는지 확인합니다.', why: 'A·B 두 줄로 받는 이유는 한쪽이 끊겨도 서버를 살리기 위해서입니다. 그런데 한쪽이 끊기면 남은 PDU가 전체 전류를 떠안습니다. 정격 16A에 16.4A가 걸리면 차단기가 내려가 서버가 전부 꺼집니다. 평소 80%를 넘지 않게, 한쪽만 남았을 때도 80% 아래가 되게 PDU를 고르는 것이 설계 원칙입니다.' },
  cam: { az: -0.3, pol: 1.0, dist: 19, min: 9, max: 28 },
  note: '220V 단상 기준 · 서버 1대 450W 가정 · 전류 = 전력 ÷ 220',
  series: true,
  range: L => [0, 40],
  lines: L => [{ v: L.state.rating, color: '#ff7a66' }, { v: L.state.rating * 0.8, color: '#f2b64a' }],
  steps: [
    { t: 'PSU1을 PDU-A 콘센트에 연결', h: '왼쪽 서버의 PSU1 핀을 누른 채 PDU-A의 콘센트 핀까지 끌어 놓으세요.', test: L => { const w = wireOf('PSU1'); return !!w && w.other.id[0] === 'A'; } },
    { t: 'PSU2를 PDU-B 콘센트에 연결', h: '다른 PDU에 꽂아야 이중화가 됩니다.', test: L => { const w = wireOf('PSU2'); return !!w && w.other.id[0] === 'B'; } },
    { t: '한쪽만 남아도 80% 이하가 되도록 PDU 정격 선택', h: '아래 막대에서 정격을 바꿔 보세요. 서버 8대일 때 한쪽이 받는 전류를 계산해 보세요.', test: L => L.state.n >= 8 && L.state.total <= L.state.rating * 0.8 },
    { t: 'FEED A를 끊어도 서버가 계속 켜져 있는지 확인', h: '오른쪽 FEED A 스위치를 탭하세요.', test: L => !L.state.feedA && L.state.powered > 0 && !L.state.tripped.A && !L.state.tripped.B },
    { t: '서버를 16대로 늘려 차단기가 내려가는 순간 관찰', h: '서버 수 슬라이더를 오른쪽 끝으로.', test: L => L.state.trip5 }
  ],
  controls(L) {
    const s = L.state, list = [
      { k: 'seg', label: 'PDU 정격', opts: [[16, '16A'], [20, '20A'], [32, '32A']], get: () => s.rating, set: v => { s.rating = v; } },
      { k: 'range', label: '서버 수', min: 4, max: 16, step: 1, get: () => s.n, set: v => { s.n = v; }, fmt: v => v + '대' },
      { k: 'btn', text: '차단기 복구', fn: () => { s.tripped = { A: false, B: false }; } },
      { k: 'btn', text: '선 모두 제거', fn: () => { L.wires.slice().forEach(removeWire); } }
    ];
    return L.ctrlList = list;
  },
  build(L) {
    const g = L.group, s = L.state; Object.assign(s, { rating: 16, n: 8, feedA: true, feedB: true, tripped: { A: false, B: false }, trip5: false, powered: 0, total: 0, amps: { A: 0, B: 0 } });
    g.add(paper('01 · 전원', [[130, 150, '전원은 항상 두 갈래로', -3, 54], [150, 215, 'A줄 + B줄 = 이중화', -3, 46], [1500, 1130, '한쪽이 죽으면 나머지가 전부 떠안는다!', -2, 44]]));
    board(g, 11.5, 6.4, (c, X, Z) => {
      c.font = '500 20px "IBM Plex Mono"'; c.strokeRect(X(-5.4), Z(-1.8), 220, 400); c.fillText('SERVER', X(-5.3), Z(-1.55));
      c.strokeRect(X(0.9), Z(-2.5), 380, 90); c.strokeRect(X(0.9), Z(1.55), 380, 90);
    });
    L.stack = [];
    for (let i = 0; i < 16; i++) { const m = box(g, 2.4, 0.15, 2.5, 0x3d444a, -3.2, 0.3 + i * 0.2, 0); const led = box(g, 0.2, 0.05, 0.04, 0x1a1a1a, -2.12, 0.3 + i * 0.2, 0.9, { emissive: 0x000000 }); L.stack.push({ m, led }); }
    L.srvLabel = label(g, '', -3.2, 3.9, 0, { scale: 0.006 });
    const A = addPin(L, 'PSU1', -1.7, 0.18, -0.9, 0xff9a3c, 'PSU1'), B = addPin(L, 'PSU2', -1.7, 0.18, 0.9, 0x4fa8d9, 'PSU2');
    L.pdu = {};
    ['A', 'B'].forEach((k, j) => {
      const z = j ? 2.1 : -2.1;
      box(g, 3.6, 0.35, 0.8, 0x2f3438, 2.9, 0.4, z); box(g, 3.6, 0.04, 0.82, k === 'A' ? 0xff9a3c : 0x4fa8d9, 2.9, 0.59, z);
      for (let i = 1; i <= 4; i++) addPin(L, k + i, 1.7 + (i - 1) * 0.85, 0.12, z, k === 'A' ? 0xff9a3c : 0x4fa8d9, k + i, { ty: 0.5 });
      const lamp = new T.Mesh(new T.SphereGeometry(0.17, 16, 12), mat(0x333333, { emissive: 0x000000 })); lamp.position.set(5.0, 0.6, z); g.add(lamp);
      const lab = label(g, '', 2.9, 1.1, z + (j ? 0.5 : -0.5), { scale: 0.0055 });
      const sw = box(g, 0.55, 0.3, 0.55, 0x2b3035, 5.0, 0.38, j ? z + 0.95 : z - 0.95), lever = box(g, 0.14, 0.5, 0.14, 0xe8e2d4, 5.0, 0.7, sw.position.z);
      label(g, 'FEED ' + k, 5.0, 1.45, sw.position.z, { scale: 0.005, font: '500 22px "IBM Plex Mono"' });
      const hitSw = new T.Mesh(new T.BoxGeometry(1.0, 1.2, 1.0), new T.MeshBasicMaterial({ visible: false })); hitSw.position.set(5.0, 0.8, sw.position.z); g.add(hitSw);
      addTap(L, 'feed' + k, hitSw, () => { s['feed' + k] = !s['feed' + k]; recalc(); });
      L.pdu[k] = { lamp, lab, lever };
    });
  },
  canConnect(L, a, b) {
    const psu = id => id.startsWith('PSU');
    if (psu(a.id) === psu(b.id)) return { err: psu(a.id) ? 'PSU끼리는 연결할 수 없습니다. PDU 콘센트로 가야 합니다.' : 'PDU 콘센트끼리는 연결할 수 없습니다.' };
    if (a.wire || b.wire) return { err: '이미 선이 연결된 핀입니다.' };
    const p = psu(a.id) ? a : b, o = psu(a.id) ? b : a, other = wireOf(p.id === 'PSU1' ? 'PSU2' : 'PSU1');
    if (other && other.other.id[0] === o.id[0]) return { warn: '두 PSU가 같은 PDU에 꽂혔습니다. 그 PDU가 죽으면 서버가 꺼집니다 — 다른 PDU를 쓰세요.' };
    return null;
  },
  calc(L) {
    const s = L.state, w1 = wireOf('PSU1'), w2 = wireOf('PSU2'), tgt = [w1 && w1.other.id[0], w2 && w2.other.id[0]];
    s.total = s.n * 450 / 220; let again = true, guard = 0;
    while (again && guard++ < 4) {
      again = false;
      const pw = k => s['feed' + k] && !s.tripped[k], on = tgt.map(k => !!k && pw(k)), cnt = on.filter(Boolean).length;
      s.amps = { A: 0, B: 0 }; s.powered = cnt;
      tgt.forEach((k, i) => { if (on[i]) s.amps[k] += s.total / cnt; });
      if (tgt.every(Boolean)) ['A', 'B'].forEach(k => { if (!s.tripped[k] && s.amps[k] > s.rating) { s.tripped[k] = true; again = true; toast('PDU-' + k + ' 차단기 트립! ' + fmt(s.amps[k]) + 'A > ' + s.rating + 'A'); if (L.done[3]) s.trip5 = true; } });
    }
  },
  visual(L) {
    const s = L.state;
    ['A', 'B'].forEach(k => {
      const p = L.pdu[k], a = s.amps[k], tripped = s.tripped[k], feed = s['feed' + k];
      const col = !feed ? 0x333333 : tripped ? 0xd9483b : a > s.rating * 0.8 ? 0xe0a030 : 0x2f9e6b;
      p.lamp.material.color.setHex(col); p.lamp.material.emissive.setHex(feed || tripped ? col : 0); p.lamp.material.emissiveIntensity = 0.9;
      p.lab.set('PDU-' + k + ' · ' + s.rating + 'A  ' + (!feed ? '입력 OFF' : tripped ? '트립' : fmt(a) + 'A'), tripped ? '#fff' : '#1b1917', tripped ? 'rgba(217,72,59,.95)' : 'rgba(243,239,230,.94)');
      p.lever.rotation.x = feed ? 0.5 : -0.5;
    });
    L.stack.forEach((u, i) => {
      u.m.visible = u.led.visible = i < s.n; const on = s.powered > 0;
      u.led.material.color.setHex(on ? 0x59d19a : 0xd9483b); u.led.material.emissive.setHex(on ? 0x59d19a : 0x300000);
    });
    L.srvLabel.set('서버 ' + s.n + '대 · ' + (s.n * 450) + 'W · ' + fmt(s.total) + 'A', s.powered ? '#1b1917' : '#fff', s.powered ? 'rgba(243,239,230,.94)' : 'rgba(217,72,59,.95)');
    L.srvLabel.sprite.position.y = 0.45 + s.n * 0.2 + 0.5;
    const pins = L.pins; ['PSU1', 'PSU2'].forEach(id => { const w = wireOf(id); pins[id].tag.set(id + (w ? ' → ' + w.other.id : '')); });
    L.wires.forEach(w => { const pd = (w.a.id.startsWith('PSU') ? w.b : w.a).id[0]; w.live = s['feed' + pd] && !s.tripped[pd]; });
  },
  rows(L) {
    const s = L.state, f = k => s['feed' + k] ? (s.tripped[k] ? '트립' : fmt(s.amps[k]) + ' A  (' + Math.round(s.amps[k] / s.rating * 100) + '%)') : '입력 OFF';
    const cls = k => !s['feed' + k] ? '' : s.tripped[k] ? 'bad' : s.amps[k] > s.rating * 0.8 ? 'warn' : 'ok';
    return [['서버', s.n + '대 × 450W'], ['총 전류(정상)', fmt(s.total) + ' A'], ['한쪽만 남을 때', fmt(s.total) + ' / ' + s.rating + ' A (' + Math.round(s.total / s.rating * 100) + '%)', s.total <= s.rating * 0.8 ? 'ok' : s.total <= s.rating ? 'warn' : 'bad'], ['PDU-A', f('A'), cls('A')], ['PDU-B', f('B'), cls('B')], ['서버 전원', s.powered ? '켜짐 (' + s.powered + '/2 경로)' : '꺼짐', s.powered ? 'ok' : 'bad']];
  },
  sample(L) { return [L.state.amps.A, L.state.amps.B]; }
};
labsDef.power.series = [{ color: '#ff9a3c' }, { color: '#4fa8d9' }];

/* ===== LAB 2 광 링크 ===== */
labsDef.fiber = {
  meta: { id: 'fiber', nav: '광 링크', time: '약 6분', title: 'TX와 RX는 서로 엇갈려야 합니다', desc: '스위치와 코어 장비를 광 케이블로 잇습니다. 빛을 쏘는 TX는 반대편의 받는 RX로 가야 링크가 올라옵니다.', why: '광 케이블은 한 가닥이 한 방향입니다. 그래서 양쪽 TX를 서로 이으면 둘 다 말만 하고 아무도 듣지 않습니다. 현장에서 링크가 안 올라오면 첫 번째로 의심하는 것이 이 극성(Polarity)입니다. 다음은 광 세기: 거리와 커넥터 오염이 손실을 만들고, 수신 세기가 −9.9dBm 아래로 내려가면 링크가 끊어집니다.' },
  cam: { az: -0.2, pol: 0.95, dist: 17, min: 8, max: 26 },
  note: '멀티모드 OM4 · 송신 −2.3 dBm · 수신 하한 −9.9 dBm (가상)',
  series: [{ color: '#ff9a3c' }, { color: '#4fc3d9' }],
  range: L => [-15, 0],
  lines: L => [{ v: -9.9, color: '#ff7a66' }],
  steps: [
    { t: 'SW의 TX를 CORE의 RX에 연결', h: 'SW TX 핀 → CORE RX 핀. 선이 X자로 엇갈립니다.', test: L => { const w = wireOf('SW_TX'); return !!w && w.other.id === 'CORE_RX'; } },
    { t: 'SW의 RX를 CORE의 TX에 연결', test: L => { const w = wireOf('SW_RX'); return !!w && w.other.id === 'CORE_TX'; } },
    { t: '양쪽 링크 LED가 초록이 되는지 확인', test: L => L.state.up },
    { t: '커넥터를 「긁힘」으로 바꿔 링크가 끊기는지 확인', h: '아래 커넥터 상태 버튼.', test: L => L.state.conn === 'scratch' && !L.state.up },
    { t: '「깨끗」으로 되돌려 링크를 복구', test: L => L.state.conn === 'clean' && L.state.up }
  ],
  controls(L) {
    const s = L.state;
    return L.ctrlList = [
      { k: 'range', label: '케이블 길이', min: 10, max: 600, step: 10, get: () => s.len, set: v => { s.len = v; }, fmt: v => v + 'm' },
      { k: 'seg', label: '커넥터', opts: [['clean', '깨끗'], ['dust', '먼지'], ['scratch', '긁힘']], get: () => s.conn, set: v => { s.conn = v; } },
      { k: 'btn', text: '선 모두 제거', fn: () => L.wires.slice().forEach(removeWire) }
    ];
  },
  build(L) {
    const g = L.group, s = L.state; Object.assign(s, { len: 100, conn: 'clean', up: false, rxSW: null, rxCORE: null });
    g.add(paper('02 · 광 링크', [[130, 160, 'TX → RX, RX ← TX', -3, 56], [1450, 1110, '청소 안 한 커넥터 = 현장 장애 1순위', -2, 44]]));
    board(g, 11, 5.4, (c, X, Z) => { c.font = '500 20px "IBM Plex Mono"'; c.strokeRect(X(-4.9), Z(-1.9), 300, 380); c.strokeRect(X(2.2), Z(-1.9), 300, 380); c.fillText('SWITCH', X(-4.8), Z(-1.65)); c.fillText('CORE', X(2.3), Z(-1.65)); });
    L.dev = {};
    [['SW', -3.5, 'ACC-SW'], ['CORE', 3.6, 'CORE-RTR']].forEach(([k, x, name]) => {
      box(g, 2.6, 0.7, 3.4, 0x30363c, x, 0.55, 0); box(g, 2.6, 0.04, 3.4, 0x6b7279, x, 0.92, 0);
      label(g, name, x, 1.55, 0, { scale: 0.006 });
      const led = new T.Mesh(new T.SphereGeometry(0.14, 16, 12), mat(0x333333, { emissive: 0 })); led.position.set(x, 1.0, -1.3); g.add(led);
      const lt = label(g, 'LINK', x, 1.45, -1.3, { scale: 0.0045, font: '500 20px "IBM Plex Mono"' });
      L.dev[k] = { led, lt };
      const px = x + (k === 'SW' ? 1.55 : -1.55);
      addPin(L, k + '_TX', px, 0.2, -0.8, 0xff9a3c, k === 'SW' ? 'TX' : 'TX', { tx: k === 'SW' ? 0.25 : -0.25 });
      addPin(L, k + '_RX', px, 0.2, 0.8, 0x4fc3d9, 'RX', { tx: k === 'SW' ? 0.25 : -0.25 });
    });
    L.spool = label(g, '', 0, 0.9, 2.4, { scale: 0.006 });
  },
  canConnect(L, a, b) {
    if (a.id.split('_')[0] === b.id.split('_')[0]) return { err: '같은 장비의 포트끼리는 이을 수 없습니다. 반대편 장비로 가세요.' };
    if (a.wire || b.wire) return { err: '이미 선이 연결된 핀입니다.' };
    if (a.id.endsWith('TX') === b.id.endsWith('TX')) return { warn: (a.id.endsWith('TX') ? 'TX–TX' : 'RX–RX') + ' 연결: 빛이 들어갈 곳이 없습니다. TX는 반대편 RX로 이어야 합니다.' };
    return null;
  },
  calc(L) {
    const s = L.state, loss = 1.0 + s.len * 0.0035 + (s.conn === 'dust' ? 3.2 : s.conn === 'scratch' ? 7.5 : 0);
    const rx = (txId, rxId) => { const w = wireOf(txId); return w && w.other.id === rxId ? Math.max(-2.3 - loss, -25) : null; };
    s.loss = loss; s.rxCORE = rx('SW_TX', 'CORE_RX'); s.rxSW = rx('CORE_TX', 'SW_RX');
    s.up = s.rxCORE !== null && s.rxSW !== null && s.rxCORE >= -9.9 && s.rxSW >= -9.9;
  },
  visual(L) {
    const s = L.state;
    ['SW', 'CORE'].forEach(k => { const d = L.dev[k], c = s.up ? 0x2f9e6b : 0xd9483b; d.led.material.color.setHex(c); d.led.material.emissive.setHex(c); d.led.material.emissiveIntensity = 0.9; d.lt.set(s.up ? 'LINK UP' : 'LINK DOWN', s.up ? '#fff' : '#fff', s.up ? 'rgba(47,158,107,.95)' : 'rgba(217,72,59,.95)'); });
    L.spool.set('길이 ' + s.len + 'm · 총 손실 ' + fmt(s.loss) + 'dB');
    L.wires.forEach(w => { w.live = !!(s.rxCORE !== null || s.rxSW !== null) && ((w.a.id.endsWith('TX') !== w.b.id.endsWith('TX'))) && s.up; });
  },
  rows(L) {
    const s = L.state, f = v => v === null ? '신호 없음 (LOS)' : fmt(v) + ' dBm', c = v => v === null ? 'bad' : v < -9.9 ? 'bad' : v < -8 ? 'warn' : 'ok';
    return [['연결된 선', L.wires.length + ' / 2'], ['CORE Rx 세기', f(s.rxCORE), c(s.rxCORE)], ['SW Rx 세기', f(s.rxSW), c(s.rxSW)], ['총 손실', fmt(s.loss) + ' dB'], ['링크', s.up ? 'UP' : 'DOWN', s.up ? 'ok' : 'bad']];
  },
  sample(L) { const s = L.state; return [s.rxCORE === null ? -15 : s.rxCORE, s.rxSW === null ? -15 : s.rxSW]; }
};

/* ===== LAB 3 공기 흐름 ===== */
labsDef.airflow = {
  meta: { id: 'airflow', nav: '공기 흐름', time: '약 7분', title: '앞에서 마시고 뒤로 내보냅니다', desc: '랙 단면을 보며 서버 방향을 바로잡고 빈 슬롯을 막습니다. 서버 입구 온도가 어떻게 달라지는지 숫자로 확인합니다.', why: '서버는 앞(콜드 아일)에서 차가운 공기를 마시고 뒤(핫 아일)로 뜨거운 공기를 내보냅니다. 거꾸로 꽂힌 서버나 빈 슬롯은 뜨거운 공기가 앞으로 되돌아오게 만들어(재순환) 모든 서버의 입구 온도를 올립니다. 그래서 반대로 꽂은 서버와 비워 둔 슬롯을 먼저 찾는 것이 관제·설치 점검의 기본입니다.' },
  cam: { az: -0.2, pol: 1.12, dist: 19, min: 9, max: 28, ty: 2.8 },
  note: '입구 = 공급 + 재순환 × ΔT · ΔT = 6 + 0.16 × 부하% (가상 모델)',
  series: [{ color: '#f2b64a' }],
  range: L => [15, 45],
  lines: L => [{ v: 27, color: '#f2b64a' }, { v: 32, color: '#ff7a66' }],
  steps: [
    { t: '거꾸로 꽂힌 서버를 탭해 방향을 바로잡기', h: '주황색으로 뒤집힌 서버 하나가 있습니다. 탭하면 돌아갑니다.', test: L => L.state.rev.every(r => !r) },
    { t: '빈 슬롯을 모두 블랭킹 패널로 막기', h: '어두운 빈 칸을 탭하세요.', test: L => L.state.slot.every((t, i) => t !== 'e' || L.state.blank[i]) },
    { t: '부하를 80% 이상으로 올려도 입구 온도를 27℃ 이하로 유지', test: L => L.state.load >= 80 && L.state.inlet <= 27 },
    { t: '공급 온도를 27℃ 이상으로 올려 경고 확인', test: L => L.state.inlet > 27 }
  ],
  controls(L) {
    const s = L.state;
    return L.ctrlList = [
      { k: 'range', label: '공급 온도', min: 16, max: 30, step: 1, get: () => s.supply, set: v => { s.supply = v; }, fmt: v => v + '℃' },
      { k: 'range', label: '서버 부하', min: 10, max: 100, step: 5, get: () => s.load, set: v => { s.load = v; }, fmt: v => v + '%' },
      { k: 'btn', text: '처음 상태로', fn: () => { s.rev = s.slot.map((t, i) => i === 3); s.blank = s.slot.map(() => false); } }
    ];
  },
  build(L) {
    const g = L.group, s = L.state;
    s.slot = 'S S e S S e S S e S S S'.split(' '); s.rev = s.slot.map((t, i) => i === 3); s.blank = s.slot.map(() => false);
    Object.assign(s, { supply: 20, load: 60, inlet: 20 });
    g.add(paper('03 · 공기 흐름', [[130, 160, '앞(차가운 쪽)에서 마시고', -3, 54], [150, 225, '뒤(뜨거운 쪽)로 뱉는다', -3, 54], [1400, 1110, '거꾸로 꽂은 서버 하나가 랙 전체를 데운다', -2, 44]]));
    const b = board(g, 11, 6, (c, X, Z, sc) => {
      const gr = c.createLinearGradient(X(-5.5), 0, X(5.5), 0); gr.addColorStop(0, 'rgba(79,168,217,.35)'); gr.addColorStop(0.42, 'rgba(79,168,217,0)'); gr.addColorStop(0.58, 'rgba(217,72,59,0)'); gr.addColorStop(1, 'rgba(217,72,59,.35)');
      c.fillStyle = gr; c.fillRect(0, 0, c.width, c.height); c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '500 22px "IBM Plex Mono"';
      c.fillText('COLD AISLE (앞 · 흡입)', X(-5.2), Z(-2.7)); c.fillText('HOT AISLE (뒤 · 배기)', X(2.2), Z(-2.7));
    });
    box(g, 2.9, 0.1, 2.6, 0x15181a, 0, 0.3, 0);
    [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]].forEach(p => box(g, 0.1, 5.2, 0.1, 0x0c0d0e, p[0], 2.9, p[1]));
    box(g, 2.9, 0.1, 2.6, 0x15181a, 0, 5.5, 0);
    L.slotG = []; L.flow = [];
    const sy = i => 0.55 + i * 0.4;
    s.slot.forEach((t, i) => {
      const grp = new T.Group(); grp.position.set(0, sy(i), 0); g.add(grp); L.slotG[i] = {};
      const hit = new T.Mesh(new T.BoxGeometry(2.6, 0.38, 0.06), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, sy(i), 1.12); g.add(hit);
      if (t === 'S') {
        const fr = mat(0xbfc4c8), rr = mat(0x23272b), sd = mat(0x6d747a), serv = new T.Group(); grp.add(serv);
        box(serv, 2.5, 0.32, 2.2, [rr, fr, sd, sd, sd, sd], 0, 0, 0);
        for (let k = 0; k < 6; k++) box(serv, 0.02, 0.2, 0.18, 0x15181a, -1.26, 0, -0.8 + k * 0.32);
        const led = box(serv, 0.04, 0.05, 0.05, 0x1a1a1a, -1.27, 0.1, 0.95, { emissive: 0 }); L.slotG[i].serv = serv; L.slotG[i].led = led;
        addTap(L, 'srv' + i, hit, () => { s.rev[i] = !s.rev[i]; recalc(); });
      } else {
        box(grp, 2.5, 0.3, 2.1, 0x090a0b, 0, 0, 0.0);
        const bp = box(grp, 0.06, 0.34, 2.2, 0x6f7a82, -1.27, 0, 0); L.slotG[i].bp = bp;
        addTap(L, 'blank' + i, hit, () => { s.blank[i] = !s.blank[i]; recalc(); });
      }
      for (let k = 0; k < 3; k++) {
        const cone = new T.Mesh(new T.ConeGeometry(0.05, 0.16, 8), new T.MeshBasicMaterial({ color: 0x4fa8d9, transparent: true, opacity: 0.85 }));
        cone.rotation.z = -Math.PI / 2; cone.position.y = sy(i); g.add(cone); L.flow.push({ cone, i, k, t: Math.random() });
      }
    });
    L.info = label(g, '', 0, 6.2, 0, { scale: 0.006 });
  },
  canConnect() { return { err: '이 실습은 선을 잇지 않고, 서버와 빈 칸을 탭해서 진행합니다.' }; },
  calc(L) {
    const s = L.state, rev = s.rev.filter(Boolean).length, open = s.slot.filter((t, i) => t === 'e' && !s.blank[i]).length;
    s.recirc = clamp(0.04 + 0.3 * rev + 0.07 * open, 0, 1); s.dT = 6 + 0.16 * s.load;
    s.inlet = s.supply + s.recirc * s.dT; s.outlet = s.inlet + s.dT; s.rev_n = rev; s.open = open;
    s.status = s.inlet > 32 ? 'dead' : s.inlet > 27 ? 'warn' : 'ok';
  },
  visual(L) {
    const s = L.state;
    s.slot.forEach((t, i) => {
      const o = L.slotG[i];
      if (t === 'S') { const tgt = s.rev[i] ? Math.PI : 0; o.serv.rotation.y = tgt; const c = s.status === 'dead' ? 0xd9483b : s.rev[i] ? 0xff9a3c : 0x59d19a; o.led.material.color.setHex(c); o.led.material.emissive.setHex(c); }
      else o.bp.visible = s.blank[i], o.bp.scale.x = 1;
      L.slotG[i].blankOn = t === 'e' && s.blank[i];
    });
    L.info.set('입구 ' + fmt(s.inlet) + '℃  ·  배기 ' + fmt(s.outlet) + '℃', '#1b1917', s.status === 'dead' ? 'rgba(217,72,59,.95)' : s.status === 'warn' ? 'rgba(224,160,48,.95)' : 'rgba(243,239,230,.94)');
    L.flow.forEach(f => { f.kind = s.slot[f.i] === 'S' ? (s.rev[f.i] ? 'rev' : 'ok') : (s.blank[f.i] ? 'none' : 'leak'); f.cone.visible = f.kind !== 'none'; });
  },
  rows(L) {
    const s = L.state;
    return [['공급 온도', s.supply + ' ℃'], ['서버 입구 온도', fmt(s.inlet) + ' ℃', s.status === 'ok' ? 'ok' : s.status === 'warn' ? 'warn' : 'bad'], ['배기 온도', fmt(s.outlet) + ' ℃'], ['재순환 비율', Math.round(s.recirc * 100) + ' %', s.recirc > 0.2 ? 'warn' : 'ok'], ['거꾸로 꽂힌 서버', s.rev_n + '대', s.rev_n ? 'bad' : 'ok'], ['열린 빈 슬롯', s.open + '칸', s.open ? 'warn' : 'ok'], ['상태', s.status === 'dead' ? '과열 종료 위험' : s.status === 'warn' ? '경고 (27℃↑)' : '정상', s.status === 'dead' ? 'bad' : s.status === 'warn' ? 'warn' : 'ok']];
  },
  sample(L) { return [L.state.inlet]; },
  tick(L, dt) {
    const s = L.state;
    L.flow.forEach(f => {
      f.t = (f.t + dt * 0.35) % 1; const tt = (f.t + f.k / 3) % 1, y = L.slotG[f.i] ? 0.55 + f.i * 0.4 : 0;
      let x0 = -2.9, x1 = 2.9, z = -0.8 + f.k * 0.8, col = 0x4fa8d9;
      if (f.kind === 'rev') { x0 = 2.9; x1 = -2.9; col = 0xff9a3c; }
      else if (f.kind === 'leak') { x0 = 2.9; x1 = -0.6; col = 0xff7a50; z += 0.1; }
      const x = x0 + (x1 - x0) * tt; f.cone.position.set(x, y, z); f.cone.rotation.z = x1 > x0 ? -Math.PI / 2 : Math.PI / 2;
      if (f.kind === 'ok') f.cone.material.color.setHex(tt < 0.5 ? 0x4fa8d9 : 0xe2a24a);
      else f.cone.material.color.setHex(col);
    });
  }
};

/* ===== LAB 4 랙 배치 ===== */
const RU = 0.2;
labsDef.rack = {
  meta: { id: 'rack', nav: '랙 배치', time: '약 6분', title: '무거운 건 아래, 가벼운 건 위', desc: '24U 랙에 서버 2대와 스위치를 넣습니다. 아래에는 이미 무거운 스토리지가 들어 있습니다. 무게중심이 높아지지 않도록 배치하세요.', why: '랙은 높은 가구입니다. 무거운 장비를 위쪽에 달면 무게중심이 올라가 레일을 당기다가 랙 전체가 앞으로 쏟아질 수 있습니다. 서버는 아래부터, 가벼운 스위치는 맨 위(TOR)에 두는 것이 기본 배치입니다. 케이블을 위에서 내려 정리하기 쉬운 이유도 있습니다.' },
  cam: { az: -0.3, pol: 1.15, dist: 16.5, min: 9, max: 26, ty: 2.8 },
  note: '무게중심(U) = Σ(무게×위치) ÷ 총무게 · 8U 이하가 안정(가상 기준)',
  series: false,
  steps: [
    { t: '서버 1대를 U12 이하에 설치', h: '아래 막대에서 「서버」를 고르고 랙의 칸을 탭하세요. 서버는 2U입니다.', test: L => L.state.items.some(i => i.kind === 'srv' && i.u + i.h - 1 <= 12) },
    { t: '서버 2대째도 아래쪽에', test: L => L.state.items.filter(i => i.kind === 'srv' && i.u + i.h - 1 <= 12).length >= 2 },
    { t: '스위치를 맨 위(U21 이상)에 설치', h: '「스위치」를 고르고 위쪽 칸을 탭하세요.', test: L => L.state.items.some(i => i.kind === 'sw' && i.u >= 21) },
    { t: '무게중심 8U 이하 유지', test: L => L.state.cog <= 8 && L.state.items.length >= 3 }
  ],
  controls(L) {
    const s = L.state;
    return L.ctrlList = [
      { k: 'seg', label: '설치할 장비', opts: [['srv', '서버 2U · 28kg'], ['sw', '스위치 1U · 6kg']], get: () => s.tool, set: v => { s.tool = v; } },
      { k: 'btn', text: '모두 빼기', fn: () => { s.items.slice().forEach(removeItem); } }
    ];
  },
  build(L) {
    const g = L.group, s = L.state; Object.assign(s, { tool: 'srv', items: [], cog: 0, kg: 0, hov: null });
    g.add(paper('04 · 랙 배치', [[130, 160, '무거운 건 아래!', -3, 60], [1450, 1110, '레일 당기다 랙이 쏟아진다', -2, 44]]));
    board(g, 6.5, 5, (c, X, Z) => { c.font = '500 20px "IBM Plex Mono"'; c.fillText('24U RACK', X(-3.0), Z(-2.2)); });
    [[-1.2, -0.95], [1.2, -0.95], [-1.2, 0.95], [1.2, 0.95]].forEach(p => box(g, 0.1, 24 * RU + 0.2, 0.1, 0x0c0d0e, p[0], 0.22 + (24 * RU + 0.2) / 2, p[1]));
    box(g, 2.5, 0.08, 2.0, 0x15181a, 0, 0.26, 0); box(g, 2.5, 0.08, 2.0, 0x15181a, 0, 0.22 + 24 * RU + 0.18, 0);
    const nc = canvas(80, 24 * 40), ng = nc.getContext('2d');
    const nd = () => { ng.fillStyle = '#0c0d0e'; ng.fillRect(0, 0, 80, 960); ng.fillStyle = '#d6cfbf'; ng.font = '500 20px "IBM Plex Mono"'; for (let u = 1; u <= 24; u++) { ng.fillText(String(u), 10, 960 - (u - 1) * 40 - 12); ng.fillRect(60, 960 - u * 40, 14, 2); } };
    nd(); const nt = cTex(nc); redraws.push(() => { nd(); nt.needsUpdate = true; });
    const num = new T.Mesh(new T.PlaneGeometry(0.42, 24 * RU), new T.MeshBasicMaterial({ map: nt })); num.position.set(-1.45, 0.27 + 12 * RU, 0.96); g.add(num);
    L.ghost = box(g, 2.2, RU, 1.9, 0x2f9e6b, 0, 0, 0, { transparent: true, opacity: 0.45 }); L.ghost.visible = false; L.ghost.castShadow = false;
    L.uY = u => 0.27 + (u - 1) * RU;
    for (let u = 1; u <= 24; u++) {
      const h = new T.Mesh(new T.BoxGeometry(2.4, RU * 0.98, 0.3), new T.MeshBasicMaterial({ visible: false })); h.position.set(0, L.uY(u) + RU / 2, 1.0); h.userData.hov = u; g.add(h);
      addTap(L, 'u' + u, h, () => place(u));
    }
    addItem(1, 4, 'sto', true);
  },
  canConnect() { return { err: '이 실습은 선을 잇지 않고, 랙의 칸을 탭해서 장비를 넣습니다.' }; },
  hover(L, u) {
    L.state.hov = u; const gh = L.ghost;
    if (!u) { gh.visible = false; return; }
    const spec = SPEC[L.state.tool], ok = fits(u, spec.h);
    gh.visible = true; gh.scale.y = spec.h; gh.position.set(0, L.uY(u) + RU * spec.h / 2, 0); gh.material.color.setHex(ok ? 0x2f9e6b : 0xd9483b);
  },
  calc(L) {
    const s = L.state; let m = 0, mz = 0;
    s.items.forEach(i => { const c = i.u + i.h / 2 - 0.5, w = SPEC[i.kind].kg; m += w; mz += w * (c + 0.5); });
    s.kg = m; s.cog = m ? mz / m : 0; s.used = s.items.reduce((a, i) => a + i.h, 0);
  },
  visual(L) { },
  rows(L) {
    const s = L.state, risk = s.cog <= 8 ? ['안정', 'ok'] : s.cog <= 11 ? ['주의', 'warn'] : ['전복 위험', 'bad'];
    return [['설치 장비', s.items.length + '개 (스토리지 포함)'], ['사용 공간', s.used + ' / 24 U'], ['총 무게', fmt(s.kg, 0) + ' kg'], ['무게중심 높이', fmt(s.cog) + ' U', risk[1]], ['전복 위험', risk[0], risk[1]]];
  },
  sample() { return []; }
};
const SPEC = { sto: { h: 4, kg: 80 }, srv: { h: 2, kg: 28 }, sw: { h: 1, kg: 6 } };
function fits(u, h) { if (u + h - 1 > 24) return false; return !L.state.items.some(i => !(u + h - 1 < i.u || u > i.u + i.h - 1)); }
function frontTex(kind, h) {
  const c = canvas(512, 40 * h), g = c.getContext('2d');
  g.fillStyle = kind === 'sto' ? '#41484e' : kind === 'sw' ? '#3b4a5a' : '#b9bec2'; g.fillRect(0, 0, 512, c.height);
  g.fillStyle = 'rgba(0,0,0,.35)';
  if (kind === 'sw') { for (let i = 0; i < 24; i++) g.fillRect(24 + i * 19, 12, 12, 14); g.fillStyle = '#9ee0b0'; g.fillRect(480, 8, 10, 10); }
  else for (let r = 0; r < h * 1; r++) for (let i = 0; i < 6; i++) g.fillRect(30 + i * 62, 6 + r * 36, 52, 26);
  g.fillStyle = kind === 'sw' ? '#ddd' : '#2a2e32'; g.font = '500 16px "IBM Plex Mono"'; g.fillText(kind === 'sto' ? 'STORAGE (고정)' : kind === 'sw' ? 'TOR-SW' : 'SERVER', 440 - (kind === 'sto' ? 40 : 0), c.height - 8);
  return cTex(c);
}
function addItem(u, h, kind, fixed) {
  const s = L.state, m = box(L.group, 2.2, RU * h - 0.02, 1.9, [mat(0x23272b), mat(0x23272b), mat(0x2d3338), mat(0x2d3338), new T.MeshStandardMaterial({ map: frontTex(kind, h), roughness: 0.6 }), mat(0x23272b)], 0, L.uY(u) + RU * h / 2, 0);
  const it = { u, h, kind, mesh: m, fixed }; s.items.push(it);
  if (!fixed) { const hit = m; hit.userData.tap = () => { removeItem(it); }; L.hits.push(hit); }
  return it;
}
function removeItem(it) { if (it.fixed) { toast('고정된 스토리지는 뺄 수 없습니다.'); return; } L.group.remove(it.mesh); L.hits.splice(L.hits.indexOf(it.mesh), 1); L.state.items.splice(L.state.items.indexOf(it), 1); recalc(); }
function place(u) {
  const cov = L.state.items.find(i => u >= i.u && u <= i.u + i.h - 1);
  if (cov) { if (cov.fixed) toast('고정된 스토리지는 뺄 수 없습니다.'); else removeItem(cov); return; }
  const spec = SPEC[L.state.tool];
  if (!fits(u, spec.h)) { toast(u + spec.h - 1 > 24 ? '랙 위로 튀어나옵니다.' : '그 자리에는 이미 장비가 있습니다.'); return; }
  addItem(u, spec.h, L.state.tool);
  if (u > 12 && L.state.tool === 'srv') toast('무거운 서버를 높이 달았습니다 — 무게중심이 올라갑니다.');
  recalc();
}

/* ---------- 실습 전환 ---------- */
function go(id) {
  if (!labsDef[id]) id = 'power';
  if (L) { root.remove(L.group); setPreview(null); }
  const def = labsDef[id]; L = newLab(def); root.add(L.group); L.firstRender = true;
  def.build(L); L.done = def.steps.map(() => false);
  Object.assign(cam, { az: def.cam.az, pol: def.cam.pol, dist: def.cam.dist, tx: 0, ty: def.cam.ty || 0.3, tz: 0 });
  document.querySelectorAll('#pills a').forEach(a => a.classList.toggle('on', a.dataset.id === id));
  buildInstr(); buildBar(); renderLesson(); def.calc(L); recalc();
  if (def.series) { const v = def.sample(L); for (let i = 0; i < 90; i++) L.hist.push(v.slice()); }
  document.title = 'IDC Labs · ' + def.meta.nav;
}
function route() { const m = /#\/lab\/(\w+)/.exec(location.hash); go(m ? m[1] : 'power'); }
addEventListener('hashchange', route);

/* ---------- 루프 ---------- */
let last = performance.now(), sampleT = 0;
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (L) {
    if (L.def.tick) L.def.tick(L, dt);
    L.wires.forEach(w => { w.t = (w.t + dt * 0.5) % 1; w.pulse.visible = !!w.live; if (w.live) w.pulse.position.copy(w.curve.getPoint(w.t)); });
    sampleT += dt; if (sampleT > 0.25 && L.def.series) { sampleT = 0; L.hist.push(L.def.sample(L).slice()); if (L.hist.length > 90) L.hist.shift(); drawGraph(); }
    L.state.items && L.state.items.forEach(() => { });
  }
  placeCam(); renderer.render(scene, camera); requestAnimationFrame(loop);
}

/* ---------- 시작 ---------- */
buildPills(); resize();
const fontWait = Promise.race([Promise.all(['500 20px "IBM Plex Mono"', '600 20px "Noto Serif KR"', '30px "Nanum Pen Script"'].map(f => document.fonts ? document.fonts.load(f, '가A1') : 0)), new Promise(r => setTimeout(r, 2500))]);
route(); requestAnimationFrame(loop);
fontWait.then(() => { redraws.forEach(f => f()); });

/* 테스트용 */
window.__labs = {
  go: id => { location.hash = '#/lab/' + id; },
  state: () => L.state, steps: () => L.done.slice(), wires: () => L.wires.length,
  pin: id => { const p = L.pins[id].pos.clone().project(camera), r = cv.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width + r.left, y: (1 - p.y) / 2 * r.height + r.top }; },
  tapObj: id => { const o = L.taps[id], v = o.getWorldPosition(new T.Vector3()).project(camera), r = cv.getBoundingClientRect(); return { x: (v.x + 1) / 2 * r.width + r.left, y: (1 - v.y) / 2 * r.height + r.top }; }
};
})();
