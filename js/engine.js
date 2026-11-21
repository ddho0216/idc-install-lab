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
    G.test = /[?&]test/.test(location.search); r.setPixelRatio(G.test ? 1 : Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = !G.test; r.shadowMap.type = T.PCFSoftShadowMap;
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

  /* ---------- 입력 ---------- */
  G.bindInput = function (canvas) {
    const lock = () => { if (G.modal || !G.running) return; if (!G.locked && canvas.requestPointerLock) { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } };
    canvas.addEventListener('click', lock);
    document.addEventListener('pointerlockchange', () => { G.locked = document.pointerLockElement === canvas; const h = $('#lockhint'); if (h) h.hidden = G.locked || G.modal || !G.running; });
    document.addEventListener('mousemove', e => { if (!G.locked) return; G.yaw -= e.movementX * 0.0022; G.pitch = Math.max(-1.4, Math.min(1.4, G.pitch - e.movementY * 0.0022)); });
    document.addEventListener('mousedown', e => { if (!G.running || G.modal || !G.locked) return; if (e.button === 0) G.primary(); else if (e.button === 2) G.dropHeld(); });
    document.addEventListener('contextmenu', e => e.preventDefault());
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
    });
    document.addEventListener('keyup', e => { G.keys[e.code] = false; });
    window.addEventListener('blur', () => { G.keys = {}; });
  };
  G.setModal = on => { G.modal = on; if (on) { G.keys = {}; if (document.pointerLockElement) document.exitPointerLock(); } };

  /* ---------- 루프 ---------- */
  G.loop = function (now) {
    const dt = Math.min(G.test ? 0.6 : 0.05, (now - G.clock) / 1000); G.clock = now;
    if (G.running && !G.modal) G.move(dt);
    G.update(dt); G.r.render(G.scene, G.cam); requestAnimationFrame(G.loop);
  };
  G.move = function (dt) {
    const k = G.keys, sp = (k.ShiftLeft || k.ShiftRight) ? 3.4 : 1.9;
    if (k.ArrowLeft) G.yaw += 1.8 * dt; if (k.ArrowRight) G.yaw -= 1.8 * dt; if (k.ArrowUp) G.pitch = Math.min(1.4, G.pitch + 1.4 * dt); if (k.ArrowDown) G.pitch = Math.max(-1.4, G.pitch - 1.4 * dt);
    let f = 0, s = 0; if (k.KeyW) f++; if (k.KeyS) f--; if (k.KeyD) s++; if (k.KeyA) s--;
    if (f || s) {
      const l = Math.hypot(f, s), sy = Math.sin(G.yaw), cy = Math.cos(G.yaw);
      const dx = (-sy * f + cy * s) / l * sp * dt, dz = (-cy * f - sy * s) / l * sp * dt;
      G.tryMove(dx, 0); G.tryMove(0, dz); G.bob = (G.bob || 0) + dt * sp * 3.2;
    }
  };
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
  G.lookAt = function (p) { const c = V3(G.pos.x, G.eye, G.pos.z), d = p.clone().sub(c); G.yaw = Math.atan2(-d.x, -d.z); G.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
  const _w = new T.Vector3();
  G.aim = function () {
    G.ray.setFromCamera({ x: 0, y: 0 }, G.cam);
    G.slots.forEach(s => { const sl = s.userData.slot; s.material.visible = !!(G.hold && sl.enabled && sl.glow !== false && sl.accept(G.hold) && s.getWorldPosition(_w).distanceTo(G.cam.position) < 3.2); });
    let f = null;
    if (G.hold) {
      const live = G.slots.filter(s => s.userData.slot.enabled && s.userData.slot.accept(G.hold));
      const h = G.ray.intersectObjects(live, false)[0];
      if (h) f = { kind: 'slot', obj: h.object, hit: h };
    }
    if (!f) {
      const h = G.ray.intersectObjects(G.hold ? G.usables : G.usables.concat(G.pickables.filter(m => m.userData.item && m.userData.item.enabled)), false)[0];
      if (h) f = { kind: h.object.userData.item ? 'pick' : 'use', obj: h.object, hit: h };
    }
    G.focus = f; G.updateGhost(); G.prompt();
  };
  G.prompt = function () {
    const f = G.focus; let t = '', cls = '';
    if (G.hold && f && f.kind === 'slot') { const s = f.obj.userData.slot; t = (s.prompt ? s.prompt(G.hold, f) : '설치'); cls = 'place'; t = '[클릭] ' + t; }
    else if (f && f.kind === 'pick') { t = '[E] 집기: ' + f.obj.userData.item.label; cls = 'pick'; }
    else if (f && f.kind === 'use') { const u = f.obj.userData.use; t = '[E] ' + (typeof u.prompt === 'function' ? u.prompt() : u.prompt); cls = 'use'; }
    else if (G.hold && G.hold.hint) t = G.hold.hint();
    G.setPrompt(t, cls);
    const c = $('#cross'); if (c) c.className = f ? 'on ' + cls : '';
  };
  G.setPrompt = (t, cls) => { const p = $('#prompt'); if (!p) return; if (p.textContent !== t) p.textContent = t; p.className = (cls || '') + (t ? ' show' : ''); };
  G.primary = function () {
    const f = G.focus; if (!f || G.modal) return;
    if (f.kind === 'slot') { const s = f.obj.userData.slot; if (G.hold) s.onPlace(G.hold, f); }
    else if (f.kind === 'pick' && !G.hold) G.pickup(f.obj.userData.item);
    else if (f.kind === 'use') f.obj.userData.use.run(f);
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
    const it = G.hold; if (!it) return; if (it.pending) { G.toast('케이블이 한쪽만 꽂힌 상태입니다. 먼저 반대쪽을 꽂거나 [Q]로 뽑으세요.', 'warn'); it.pending.cancel && it.pending.cancel(); }
    G.detach(it); const h = it.home; G.flyTo(it.g, h.p, h.r, 0.6, null, 0.15); it.g.rotation.x = 0; it.g.rotation.z = 0; it.g.scale.setScalar(it.scale0 || 1); G.sfx('drop');
  };
  G.flipHeld = function () { const it = G.hold; if (!it || !it.flippable) return; G.flip = !G.flip; G.sfx('click'); G.updateHandBar(); };
  G.updateHandBar = function () {
    const b = $('#handbar'); if (!b) return; const it = G.hold;
    if (!it) { b.hidden = true; return; }
    b.hidden = false; let t = '<b>' + it.label + '</b>';
    if (it.flippable) t += '<span>[R] 방향: <em>' + (G.flip ? '앞면(전면)부터 넣음' : '뒷면(포트·전원면)부터 넣음') + '</em></span>';
    t += '<span>[Q] 내려놓기</span>'; b.innerHTML = t;
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
