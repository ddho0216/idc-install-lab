/* 게임 엔진: 1인칭 이동, 조준·집기·놓기, 애니메이션, 소리, 알림 (단위: 미터) */
(function () {
  const T = THREE, U = 0.04445;
  const G = window.G = {
    T, U, items: {}, tw: [], timers: [], colliders: [], pickables: [], usables: [], slots: [], cables: [], hw: [],
    hold: null, flip: false, locked: false, modal: false, keys: {}, yaw: 0, pitch: -0.05, focus: null, live: null, t0: 0, running: false, clock: performance.now(),
  };
  const $ = G.$ = s => document.querySelector(s);
  const V3 = G.V3 = (x, y, z) => new T.Vector3(x, y, z);
  G.ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

  /* ---------- 텍스처·재료 도우미 ---------- */
  G.tex = (w, h, draw, rep) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t;
  };
  G.mat = (c, r, m) => new T.MeshStandardMaterial({ color: c, roughness: r == null ? 0.7 : r, metalness: m || 0 });
  G.box = (w, h, d, c, r, m) => { const x = new T.Mesh(new T.BoxGeometry(w, h, d), G.mat(c, r, m)); x.castShadow = true; x.receiveShadow = true; return x; };
  G.sprite = (text, color, scale, bg) => {
    const t = G.tex(512, 96, (g, w, h) => {
      if (bg) { g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect(6, 10, w - 12, h - 20, 20); else g.rect(6, 10, w - 12, h - 20); g.fill(); }
      g.font = '700 42px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color || '#222'; g.fillText(text, w / 2, h / 2 + 2);
    });
    const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(0.55 * (scale || 1), 0.55 * (scale || 1) * 96 / 512, 1); return s;
  };

  /* ---------- 시작 ---------- */
  G.init = function (canvas) {
    const r = G.r = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    G.test = /[?&]test/.test(location.search); G.fast = G.test || /[?&]fast/.test(location.search); r.setPixelRatio(G.fast ? 1 : Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = !G.fast; r.shadowMap.type = T.PCFSoftShadowMap;
    if ('useLegacyLights' in r) r.useLegacyLights = true;
    const sc = G.scene = new T.Scene(); sc.background = new T.Color(0xaeb8c1); sc.fog = new T.Fog(0xaeb8c1, 16, 36);
    const cam = G.cam = new T.PerspectiveCamera(72, 1, 0.04, 60); cam.rotation.order = 'YXZ'; sc.add(cam);
    G.pos = V3(0, 0, 4.6); G.eye = 1.62;
    sc.add(new T.HemisphereLight(0xf2f6fa, 0x7d8892, 0.62));
    const sun = new T.DirectionalLight(0xfff6e8, 0.55); sun.position.set(3, 7, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); const sc2 = sun.shadow.camera; sc2.left = -9; sc2.right = 9; sc2.top = 8; sc2.bottom = -8; sc2.near = 1; sc2.far = 20; sun.shadow.bias = -0.0006;
    sc.add(sun); sc.add(sun.target);
    G.ray = new T.Raycaster(); G.ray.far = 3.2;
    G.resize(); window.addEventListener('resize', G.resize); G.bindInput(canvas);
    requestAnimationFrame(G.loop);
  };
  G.resize = () => { const c = G.r.domElement, w = innerWidth, h = innerHeight; G.r.setSize(w, h, false); G.cam.aspect = w / h; G.cam.updateProjectionMatrix(); };

  /* ---------- 입력 (마우스 중심, 키보드는 보조) ---------- */
  G.mouse = { nx: 0, ny: 0, x: 0, y: 0, in: false };
  G.bindInput = function (canvas) {
    let down = null;
    canvas.addEventListener('mousedown', e => { if (!G.running || G.modal) return; down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, b: e.button, drag: false }; });
    document.addEventListener('mousemove', e => {
      G.mouse.x = e.clientX; G.mouse.y = e.clientY; G.mouse.nx = e.clientX / innerWidth * 2 - 1; G.mouse.ny = -(e.clientY / innerHeight * 2 - 1); G.mouse.in = e.target === canvas;
      if (!down) return; const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.drag = true;
      if (down.drag) { G.yaw += dx * 0.0042; G.pitch = Math.max(-1.3, Math.min(1.3, G.pitch + dy * 0.003)); if (G.walk) G.walk.free = true; }
      down.lx = e.clientX; down.ly = e.clientY;
    });
    document.addEventListener('mouseup', () => { if (!down) return; const d = down; down = null; if (d.drag || G.modal || !G.running) return; if (d.b === 0) G.click(); else if (d.b === 2) G.dropHeld(); });
    canvas.addEventListener('mouseleave', () => { G.mouse.in = false; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); G.cam.fov = Math.max(44, Math.min(92, G.cam.fov + Math.sign(e.deltaY) * 4)); G.cam.updateProjectionMatrix(); }, { passive: false });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-hb]'); if (!b) return; if (b.dataset.hb === 'flip') G.flipHeld(); else if (b.dataset.hb === 'drop') G.dropHeld(); });
    document.addEventListener('keydown', e => {
      if (G.modal) { if (e.key === 'Escape' && G.onEsc) G.onEsc(); return; }
      if (!G.running) return;
      G.keys[e.code] = true;
      if (e.code === 'KeyE') G.primary();
      else if (e.code === 'KeyQ') G.dropHeld();
      else if (e.code === 'KeyR') G.flipHeld();
      else if (e.code === 'Tab') { e.preventDefault(); G.onTab && G.onTab(); }
      else if (e.code === 'KeyH') G.onHelp && G.onHelp();
      else if (e.code === 'KeyG') G.onGuide && G.onGuide();
      else if (e.code === 'Escape') { G.walk = null; if (G.hold) G.dropHeld(); }
    });
    document.addEventListener('keyup', e => { G.keys[e.code] = false; });
    window.addEventListener('blur', () => { G.keys = {}; });
  };
  G.setModal = on => { G.modal = on; if (on) { G.keys = {}; G.walk = null; } if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); };

  /* ---------- 루프 ---------- */
  G.loop = function (now) {
    const dt = Math.min(G.fast ? 0.6 : 0.05, (now - G.clock) / 1000); G.clock = now;
    if (G.running && !G.modal) G.move(dt);
    G.update(dt); G.r.render(G.scene, G.cam); requestAnimationFrame(G.loop);
  };
  G.move = function (dt) {
    const k = G.keys, sp = (k.ShiftLeft || k.ShiftRight) ? 3.4 : 1.9, keyMove = k.KeyW || k.KeyS || k.KeyA || k.KeyD;
    if (G.walk && keyMove) G.walk = null;
    if (G.walk) {
      const w = G.walk, p = w.pts[w.i], dx = p.x - G.pos.x, dz = p.z - G.pos.z, d = Math.hypot(dx, dz), step = w.speed * dt;
      G.bob = (G.bob || 0) + dt * w.speed * 3.2;
      if (!w.free && d > 0.05) { const ty = Math.atan2(-dx, -dz); let df = ((ty - G.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; G.yaw += df * Math.min(1, dt * 7); G.pitch += (-0.05 - G.pitch) * Math.min(1, dt * 3); }
      if (d <= step) { G.pos.x = p.x; G.pos.z = p.z; w.i++; if (w.i >= w.pts.length) G.arrive(); } else { G.pos.x += dx / d * step; G.pos.z += dz / d * step; }
      return;
    }
    if (k.ArrowLeft) G.yaw += 1.8 * dt; if (k.ArrowRight) G.yaw -= 1.8 * dt; if (k.ArrowUp) G.pitch = Math.min(1.4, G.pitch + 1.4 * dt); if (k.ArrowDown) G.pitch = Math.max(-1.4, G.pitch - 1.4 * dt);
    let f = 0, s = 0; if (k.KeyW) f++; if (k.KeyS) f--; if (k.KeyD) s++; if (k.KeyA) s--;
    if (f || s) {
      const l = Math.hypot(f, s), sy = Math.sin(G.yaw), cy = Math.cos(G.yaw);
      const dx = (-sy * f + cy * s) / l * sp * dt, dz = (-cy * f - sy * s) / l * sp * dt;
      G.tryMove(dx, 0); G.tryMove(0, dz); G.bob = (G.bob || 0) + dt * sp * 3.2;
    }
  };
  /* ---- 길찾기 (격자 A*) ---- */
  G.bounds = { x0: -7, x1: 7, z0: -6.6, z1: 6.6, cs: 0.2 };
  G.buildNav = function () {
    const b = G.bounds, nx = Math.ceil((b.x1 - b.x0) / b.cs), nz = Math.ceil((b.z1 - b.z0) / b.cs), bl = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = b.x0 + (i + 0.5) * b.cs, z = b.z0 + (j + 0.5) * b.cs; for (const c of G.colliders) if (x > c.x0 - 0.32 && x < c.x1 + 0.32 && z > c.z0 - 0.32 && z < c.z1 + 0.32) { bl[i * nz + j] = 1; break; } }
    G.nav = { nx, nz, bl };
  };
  const cellOf = (x, z) => { const b = G.bounds, N = G.nav; return [Math.max(0, Math.min(N.nx - 1, Math.floor((x - b.x0) / b.cs))), Math.max(0, Math.min(N.nz - 1, Math.floor((z - b.z0) / b.cs)))]; };
  const centre = (i, j) => ({ x: G.bounds.x0 + (i + 0.5) * G.bounds.cs, z: G.bounds.z0 + (j + 0.5) * G.bounds.cs });
  G.nearestFree = (x, z) => { const [i, j] = cellOf(x, z), N = G.nav; if (!N.bl[i * N.nz + j]) return [i, j]; for (let r = 1; r < 40; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= N.nx || c >= N.nz) continue; if (!N.bl[a * N.nz + c]) return [a, c]; } return null; };
  G.clearLine = (ax, az, bx, bz) => { const N = G.nav, n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.08)); for (let k = 0; k <= n; k++) { const t = k / n, c = cellOf(ax + (bx - ax) * t, az + (bz - az) * t); if (N.bl[c[0] * N.nz + c[1]]) return false; } return true; };
  G.findPath = (sx, sz, gx, gz) => {
    const N = G.nav, s0 = G.nearestFree(sx, sz), g0 = cellOf(gx, gz); if (!s0) return null; const nz = N.nz, key = (i, j) => i * nz + j, start = key(s0[0], s0[1]), goal = key(g0[0], g0[1]);
    const gs = new Float32Array(N.nx * nz).fill(1e9), par = new Int32Array(N.nx * nz).fill(-1), closed = new Uint8Array(N.nx * nz), open = [start]; gs[start] = 0;
    const h = (i, j) => Math.hypot(i - g0[0], j - g0[1]);
    while (open.length) {
      let bi = 0, bf = 1e18; for (let q = 0; q < open.length; q++) { const k = open[q], f = gs[k] + h((k / nz) | 0, k % nz); if (f < bf) { bf = f; bi = q; } } const cur = open.splice(bi, 1)[0]; if (closed[cur]) continue; closed[cur] = 1;
      if (cur === goal) break; const ci = (cur / nz) | 0, cj = cur % nz;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= N.nx || b >= nz || N.bl[key(a, b)]) continue; if (di && dj && (N.bl[key(ci + di, cj)] || N.bl[key(ci, cj + dj)])) continue; const nk = key(a, b), ng = gs[cur] + (di && dj ? 1.414 : 1); if (ng < gs[nk]) { gs[nk] = ng; par[nk] = cur; open.push(nk); } }
    }
    if (par[goal] < 0 && goal !== start) return null;
    const cells = []; for (let k = goal; k >= 0; k = par[k]) { cells.push(centre((k / nz) | 0, k % nz)); if (k === start) break; } cells.reverse();
    const pts = [{ x: sx, z: sz }].concat(cells); const out = [], first = pts[0]; let anchor = first, idx = 1;
    while (idx < pts.length) { let far = idx; for (let q = pts.length - 1; q > idx; q--) if (G.clearLine(anchor.x, anchor.z, pts[q].x, pts[q].z)) { far = q; break; } out.push({ x: pts[far].x, z: pts[far].z }); anchor = pts[far]; idx = far + 1; }
    out[out.length - 1] = { x: gx, z: gz }; return out;
  };
  G.walkTo = function (x, z, o) {
    o = o || {}; if (!G.nav) G.buildNav(); const g = G.nearestFree(x, z); if (!g) return; const c = centre(g[0], g[1]), gx = o.exact ? x : c.x, gz = o.exact ? z : c.z;
    const pts = G.findPath(G.pos.x, G.pos.z, gx, gz); if (!pts) { G.toast('갈 수 없는 곳입니다.', 'warn'); return; }
    G.walk = { pts, i: 0, o, speed: 2.5, free: false }; G.markAt(gx, gz);
  };
  G.arrive = function () {
    const w = G.walk, o = w.o; G.walk = null;
    if (o.look) { const c = V3(G.pos.x, G.eye, G.pos.z), d = o.look.clone().sub(c), ty = Math.atan2(-d.x, -d.z), tp = Math.max(-1.1, Math.min(1.1, Math.atan2(d.y, Math.hypot(d.x, d.z)))), y0 = G.yaw, p0 = G.pitch, dy = ((ty - y0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI; G.anim(0.45, k => { G.yaw = y0 + dy * k; G.pitch = p0 + (tp - p0) * k; }, () => { o.onArrive && o.onArrive(); }); }
    else o.onArrive && o.onArrive();
  };
  G.markAt = (x, z) => { if (!G.markMesh) { G.markMesh = new T.Mesh(new T.RingGeometry(0.16, 0.22, 32), new T.MeshBasicMaterial({ color: 0x1f5fbf, transparent: true, opacity: 0.9, depthWrite: false })); G.markMesh.rotation.x = -Math.PI / 2; G.scene.add(G.markMesh); } const m = G.markMesh; m.position.set(x, 0.014, z); m.visible = true; G.anim(1.2, k => { m.scale.setScalar(1 + k * 0.8); m.material.opacity = 0.9 * (1 - k); }, () => { m.visible = false; }, null); };
  G.tryMove = function (dx, dz) {
    const R = 0.28, nx = G.pos.x + dx, nz = G.pos.z + dz;
    for (const c of G.colliders) if (nx > c.x0 - R && nx < c.x1 + R && nz > c.z0 - R && nz < c.z1 + R) return;
    G.pos.x = nx; G.pos.z = nz;
  };
  G.update = function (dt) {
    const c = G.cam, bob = G.running ? Math.sin(G.bob || 0) * 0.012 : 0;
    c.position.set(G.pos.x, G.eye + bob, G.pos.z); c.rotation.y = G.yaw; c.rotation.x = G.pitch;
    // 애니메이션
    const fin = []; G.tw = G.tw.filter(t => { t.t += dt / t.dur; const k = Math.min(1, t.t); t.fn(t.ease ? t.ease(k) : k); if (k >= 1) { fin.push(t); return false; } return true; }); fin.forEach(t => t.done && t.done());
    const due = []; G.timers = G.timers.filter(t => { t.t -= dt; if (t.t <= 0) { due.push(t); return false; } return true; }); due.forEach(t => t.fn());
    if (G.onFrame) G.onFrame(dt);
    if (G.running && !G.modal) G.aim(); else if (G.running) G.setPrompt('');
    G.liveCable();
  };
  G.anim = (dur, fn, done, ease) => G.tw.push({ t: 0, dur, fn, done, ease: ease === undefined ? G.ease : ease });
  G.after = (sec, fn) => G.timers.push({ t: sec, fn });
  G.flyTo = (obj, pos, rotY, dur, cb, arc) => {
    const p0 = obj.position.clone(), r0 = obj.rotation.y, r1 = rotY == null ? r0 : rotY;
    G.anim(dur || 0.8, k => { obj.position.lerpVectors(p0, pos, k); obj.position.y += Math.sin(Math.PI * k) * (arc == null ? 0.25 : arc); obj.rotation.y = r0 + (r1 - r0) * k; }, () => { obj.position.copy(pos); obj.rotation.y = r1; cb && cb(); });
  };
  G.path = (obj, pts, cb) => { const step = i => { if (i >= pts.length) { cb && cb(); return; } const q = pts[i]; G.flyTo(obj, q.p, q.r, q.d, () => step(i + 1), q.arc); }; step(0); };

  /* ---------- 조준: 집기 / 사용 / 놓기 ---------- */
  G.project = v => { const p = v.clone().project(G.cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
  G.lookAt = function (p) { const c = V3(G.pos.x, G.eye, G.pos.z), d = p.clone().sub(c); G.yaw = Math.atan2(-d.x, -d.z); G.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
  const _w = new T.Vector3(), REACH = 2.3;
  const facingOf = m => { const sl = m.userData.slot, f = m.userData.facing || (sl && (sl.facing || (sl.out ? Math.sign(sl.out.z) : 0))); return f || 0; };
  const seen = m => { if (G.test) return true; const f = facingOf(m); if (!f) return true; m.getWorldPosition(_w); return (G.pos.z - _w.z) * f > -0.05; };
  G.aim = function () {
    const ndc = G.test ? { x: 0, y: 0 } : (G.mouse.in ? { x: G.mouse.nx, y: G.mouse.ny } : null);
    G.slots.forEach(s => { const sl = s.userData.slot; s.material.visible = !!(G.hold && sl.enabled && sl.glow !== false && sl.accept(G.hold) && seen(s) && s.getWorldPosition(_w).distanceTo(G.cam.position) < (G.test ? 3.2 : 6)); });
    let f = null;
    if (ndc) {
      G.ray.far = G.test ? 3.2 : 40; G.ray.setFromCamera(ndc, G.cam);
      if (G.hold) { const live = G.slots.filter(s => s.userData.slot.enabled && s.userData.slot.accept(G.hold) && seen(s)); const h = G.ray.intersectObjects(live, false)[0]; if (h) f = { kind: 'slot', obj: h.object, hit: h }; }
      if (!f) { const cand = (G.hold ? G.usables : G.usables.concat(G.pickables.filter(m => m.userData.item && m.userData.item.enabled))).filter(seen); const h = G.ray.intersectObjects(cand, false)[0]; if (h) f = { kind: h.object.userData.item ? 'pick' : 'use', obj: h.object, hit: h }; }
      if (!f && !G.test && G.floor) { const h = G.ray.intersectObject(G.floor, false)[0]; if (h) f = { kind: 'floor', point: h.point }; }
    }
    G.focus = f; G.updateGhost(); G.prompt();
    if (!G.test) { G.r.domElement.style.cursor = f ? (f.kind === 'floor' ? 'crosshair' : 'pointer') : 'default'; if (!G.hring) { G.hring = new T.Mesh(new T.RingGeometry(0.1, 0.14, 28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })); G.hring.rotation.x = -Math.PI / 2; G.scene.add(G.hring); } if (f && f.kind === 'floor') { G.hring.position.set(f.point.x, 0.012, f.point.z); G.hring.visible = true; } else G.hring.visible = false; }
  };
  G.prompt = function () {
    const f = G.focus, k = G.test ? '[E] ' : ''; let t = '', cls = '';
    if (G.hold && f && f.kind === 'slot') { const s = f.obj.userData.slot; t = (G.test ? '[클릭] ' : '') + (s.prompt ? s.prompt(G.hold, f) : '설치'); cls = 'place'; }
    else if (f && f.kind === 'pick') { t = k + '집기: ' + f.obj.userData.item.label; cls = 'pick'; }
    else if (f && f.kind === 'use') { const u = f.obj.userData.use; t = k + (typeof u.prompt === 'function' ? u.prompt() : u.prompt); cls = 'use'; }
    else if (f && f.kind === 'floor') { t = ''; }
    else if (G.hold && G.hold.hint) t = G.hold.hint();
    G.setPrompt(t, cls);
  };
  G.setPrompt = (t, cls) => { const p = $('#prompt'); if (!p) return; if (p.textContent !== t) p.textContent = t; p.className = (cls || '') + (t ? ' show' : ''); if (!G.test && G.mouse.in) { p.style.left = Math.min(innerWidth - 240, G.mouse.x + 16) + 'px'; p.style.top = (G.mouse.y + 18) + 'px'; } };
  const valid = f => { if (f.kind === 'slot') { const s = f.obj.userData.slot; return !!(G.hold && s.enabled && s.accept(G.hold)); } if (f.kind === 'pick') return !G.hold && f.obj.userData.item.enabled; return true; };
  G.act = function (f) {
    if (!f || G.modal || !valid(f)) return;
    if (f.kind === 'slot') f.obj.userData.slot.onPlace(G.hold, f);
    else if (f.kind === 'pick') G.pickup(f.obj.userData.item);
    else if (f.kind === 'use') f.obj.userData.use.run(f);
  };
  G.primary = function () { G.act(G.focus); };   // 키보드 E / 테스트: 즉시 실행
  G.click = function () {
    const f = G.focus; if (!f || G.modal) return;
    if (f.kind === 'floor') { G.walkTo(f.point.x, f.point.z); return; }
    const tp = f.hit.point.clone(), d = Math.hypot(tp.x - G.pos.x, tp.z - G.pos.z);
    if (d <= REACH) { G.act(f); return; }
    const dir = V3(tp.x - G.pos.x, 0, tp.z - G.pos.z).normalize();
    G.walkTo(tp.x - dir.x * 1.45, tp.z - dir.z * 1.45, { look: tp, onArrive: () => G.act(f) });
  };
  G.updateGhost = function () {
    const f = G.focus;
    if (G.ghost) { G.ghost.visible = false; }
    if (!G.hold || !f || f.kind !== 'slot') return;
    const s = f.obj.userData.slot; if (s.ghost) s.ghost(f, G.hold);
  };

  /* ---------- 손에 들기 ---------- */
  G.pickup = function (it) {
    if (G.hold) return; G.hold = it; G.sfx('pick');
    it.prevParent = it.g.parent; it.g.parent && it.g.parent.remove(it.g); G.cam.add(it.g);
    const h = it.holdT || { p: [0.26, -0.24, -0.55], r: [0, -0.4, 0], s: 1 };
    it.g.position.set(h.p[0], h.p[1], h.p[2]); it.g.rotation.set(h.r[0], h.r[1], h.r[2]); it.g.scale.setScalar(h.s);
    it.g.traverse(o => { if (o.castShadow !== undefined) o.castShadow = false; });
    it.held = true; it.onPick && it.onPick(); G.updateHandBar();
  };
  G.detach = function (it) { // 손에서 월드로 (현재 월드 위치 유지)
    const wp = V3(), wq = new T.Quaternion(); it.g.getWorldPosition(wp); it.g.getWorldQuaternion(wq);
    G.cam.remove(it.g); G.scene.add(it.g); it.g.position.copy(wp); it.g.quaternion.copy(wq); it.g.scale.setScalar(it.scale0 || 1);
    it.g.traverse(o => { if (o.castShadow !== undefined && o.userData.cs !== false) o.castShadow = true; });
    it.held = false; G.hold = null; G.updateHandBar();
  };
  G.dropHeld = function () {
    const it = G.hold; if (!it) return; if (it.pending) { G.toast('꽂던 케이블을 내려놓았습니다.', 'warn'); it.pending.cancel && it.pending.cancel(); }
    G.detach(it); const h = it.home; G.flyTo(it.g, h.p, h.r, 0.6, null, 0.15); it.g.rotation.x = 0; it.g.rotation.z = 0; it.g.scale.setScalar(it.scale0 || 1); G.sfx('drop');
  };
  G.flipHeld = function () { const it = G.hold; if (!it || !it.flippable) return; G.flip = !G.flip; G.sfx('click'); G.updateHandBar(); };
  G.updateHandBar = function () {
    const b = $('#handbar'); if (!b) return; const it = G.hold;
    if (!it) { b.hidden = true; return; }
    b.hidden = false; let t = '<b>' + it.label + '</b>';
    if (it.flippable) t += '<span>넣는 방향: <em>' + (G.flip ? '앞면부터' : '뒷면(포트·전원)부터') + '</em></span><button class="hb" data-hb="flip">방향 바꾸기</button>';
    t += '<button class="hb" data-hb="drop">내려놓기 (우클릭)</button>'; b.innerHTML = t;
  };

  /* ---------- 케이블 (점점 그려지는 선) ---------- */
  G.cable = function (pts, color, rad, plug, kind, done) {
    const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
    const geo = new T.TubeGeometry(curve, 90, rad, 8, false), m = new T.Mesh(geo, G.mat(color, 0.5)), grp = new T.Group(); grp.add(m); grp.userData.kind = kind; m.castShadow = true;
    const total = geo.index.count; geo.setDrawRange(0, 0);
    const mk = p => { const b = G.box(rad * 4.2, rad * 4.2, rad * 4.2, plug, 0.5); b.position.copy(p); return b; };
    grp.add(mk(pts[0])); G.scene.add(grp); G.cables.push(grp);
    G.anim(1.1, k => geo.setDrawRange(0, Math.floor(total * k / 3) * 3), () => { geo.setDrawRange(0, total); grp.add(mk(pts[pts.length - 1])); done && done(); });
    return grp;
  };
  G.clearCables = kind => { G.cables = G.cables.filter(c => { if (!kind || c.userData.kind === kind) { G.scene.remove(c); return false; } return true; }); };
  G.liveCable = function () {
    const lv = G.live; if (G.liveMesh) { G.scene.remove(G.liveMesh); G.liveMesh.geometry.dispose(); G.liveMesh = null; }
    if (!lv || !G.hold) return;
    const a = lv.from(), b = V3(0.22, -0.22, -0.5).applyMatrix4(G.cam.matrixWorld), mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= 0.18 + a.distanceTo(b) * 0.08;
    const curve = new T.CatmullRomCurve3([a, mid, b]);
    G.liveMesh = new T.Mesh(new T.TubeGeometry(curve, 16, lv.rad, 6, false), G.mat(lv.color, 0.5)); G.scene.add(G.liveMesh);
  };

  /* ---------- 알림·소리 ---------- */
  G.toast = function (text, type) {
    const t = $('#toast'); if (!t) return; const d = document.createElement('div'); d.className = 'tt ' + (type || ''); d.textContent = text; t.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 3600); while (t.children.length > 4) t.firstChild.remove();
  };
  G.sfx = function (name) {
    try {
      const A = G.ac = G.ac || new (window.AudioContext || window.webkitAudioContext)(); if (A.state === 'suspended') A.resume();
      const tone = (f, d, type, v, f2) => { const o = A.createOscillator(), g = A.createGain(); o.type = type || 'sine'; o.frequency.value = f; if (f2) o.frequency.exponentialRampToValueAtTime(f2, A.currentTime + d); g.gain.value = v || 0.07; g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + d); o.connect(g); g.connect(A.destination); o.start(); o.stop(A.currentTime + d); };
      if (name === 'pick') tone(520, 0.08, 'triangle', 0.06, 760); else if (name === 'place') { tone(300, 0.12, 'square', 0.05, 180); } else if (name === 'drop') tone(200, 0.1, 'sine', 0.05, 120);
      else if (name === 'screw') tone(900, 0.05, 'square', 0.03, 1300); else if (name === 'click') tone(700, 0.04, 'square', 0.03); else if (name === 'err') { tone(190, 0.22, 'sawtooth', 0.06, 120); }
      else if (name === 'ok') { tone(660, 0.12, 'sine', 0.07); setTimeout(() => tone(880, 0.16, 'sine', 0.07), 110); } else if (name === 'win') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), i * 120)); }
      else if (name === 'boot') { tone(120, 0.7, 'sawtooth', 0.04, 260); }
    } catch (e) {}
  };

  /* ---------- 등록 도우미 ---------- */
  G.addPickable = (item, mesh) => { mesh.userData.item = item; G.pickables.push(mesh); };
  G.addUse = (mesh, use) => { mesh.userData.use = use; G.usables.push(mesh); return mesh; };
  G.addSlot = (mesh, slot) => { slot.enabled = slot.enabled !== false; mesh.userData.slot = slot; mesh.visible = true; mesh.material.visible = false; G.slots.push(mesh); return mesh; };
  G.slotMesh = (w, h, d, glow) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ color: 0x35e08c, transparent: true, opacity: 0.42, visible: false })); m.renderOrder = 5; return m; };
  G.rmSlot = mesh => { G.slots = G.slots.filter(s => s !== mesh); mesh.parent && mesh.parent.remove(mesh); };
})();
