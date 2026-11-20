/* 3D 랙 장면 (three.js). 크기·배치는 제가 만든 가상 그림입니다. */
(function (root) {
  const U = 0.445, W = 4.83, DEP = 6.0, BASE = 0.35, TOTAL_U = 42;
  const yOf = u => BASE + (u - 1) * U + U / 2;
  const PRE = [];

  const ZF = DEP / 2, ZR = -DEP / 2;
  const CORE_X = 8.4;
  const COLORS = { A: 0xd9654a, B: 0x4a8bd9, fiber: 0xe8c547 };

  function tex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function sprite(text, color, scale) {
    const t = tex(512, 96, (g, w, h) => {
      g.font = '600 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color || '#e9edf1';
      g.fillText(text, w / 2, h / 2);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(5.3 * (scale || 1), 1 * (scale || 1), 1); return s;
  }
  function faceMats(front, rear, side) {
    const sm = new THREE.MeshStandardMaterial({ color: side || 0x20262d, roughness: 0.7, metalness: 0.3 });
    const f = front ? new THREE.MeshStandardMaterial({ map: front, roughness: 0.6, metalness: 0.2 }) : sm;
    const r = rear ? new THREE.MeshStandardMaterial({ map: rear, roughness: 0.6, metalness: 0.2 }) : sm;
    return [sm, sm, sm, sm, f, r];
  }
  function plain(label, base, accent, dark) {
    return tex(1086, 100, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = accent; g.fillRect(0, 0, w, 3);
      g.fillStyle = dark ? 'rgba(25,32,38,.75)' : 'rgba(255,255,255,.55)'; g.font = '600 28px sans-serif'; g.textBaseline = 'middle'; g.fillText(label, 26, h / 2);
    });
  }
  function srvFace(label, kind, rear) {
    return tex(1086, 100 * (kind === 'disk' ? 1 : 1), (g, w, h) => {
      g.fillStyle = rear ? '#1c2127' : '#2b323a'; g.fillRect(0, 0, w, h);
      if (!rear) {
        g.fillStyle = '#10141a';
        for (let i = 0; i < 48; i++) g.fillRect(180 + i * 16, 18, 10, h - 36);
        g.fillStyle = '#3ecf8e'; g.fillRect(36, 40, 10, 10); g.fillStyle = '#e0a030'; g.fillRect(56, 40, 10, 10);
        g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '600 26px sans-serif'; g.textBaseline = 'middle'; g.fillText(label, 880, h / 2);
      } else {
        g.fillStyle = '#0e1216'; g.fillRect(40, 14, 220, h - 28); g.fillRect(280, 14, 220, h - 28);
        g.fillStyle = '#3a4650';
        for (let i = 0; i < 4; i++) { g.fillRect(560 + i * 70, 24, 52, 28); }
        g.fillStyle = '#4fc3d9'; for (let i = 0; i < 4; i++) g.fillRect(568 + i * 70, 56, 36, 12);
      }
    });
  }
  /* 새 스위치 포트면: PSU 2개 + 팬 + 48포트 + 업링크 2 */
  const PX = { psu1: 125, psu2: 345, up1: 1018, up2: 1054 };
  function switchFace(state) {
    return tex(1086, 100, (g, w, h) => {
      g.fillStyle = '#d3d9df'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e0a030'; g.fillRect(0, 0, w, 4);
      g.fillStyle = '#6a737d'; g.font = '700 14px sans-serif'; g.textBaseline = 'top';
      g.fillText('PSU1', 22, 8); g.fillText('PSU2', 242, 8); g.fillText('FAN', 462, 8); g.fillText('GE 1-48', 600, 8); g.fillText('T1  T2', 1004, 8);
      [PX.psu1, PX.psu2].forEach(cx => {
        g.fillStyle = '#b2bac2'; g.fillRect(cx - 100, 24, 200, 66);
        g.fillStyle = '#2a3036'; g.fillRect(cx - 28, 40, 56, 34);   // AC 인렛
        g.fillStyle = '#6a737d'; g.fillRect(cx - 18, 46, 6, 14); g.fillRect(cx + 12, 46, 6, 14);
        g.fillStyle = state.psuLed ? '#2fbf71' : '#8a929b'; g.fillRect(cx + 70, 30, 14, 8);
      });
      for (let i = 0; i < 4; i++) { g.fillStyle = '#9aa3ab'; g.beginPath(); g.arc(480 + i * 28, 56, 11, 0, 7); g.fill(); g.fillStyle = '#4a525a'; g.beginPath(); g.arc(480 + i * 28, 56, 4, 0, 7); g.fill(); }
      for (let r = 0; r < 2; r++) for (let c = 0; c < 24; c++) {
        const x = 600 + c * 15.8, y = 28 + r * 30;
        g.fillStyle = '#20262b'; g.fillRect(x, y, 12, 22);
        g.fillStyle = state.gelink && state.gelink(r * 24 + c) ? '#2fbf71' : '#4a525a'; g.fillRect(x + 2, y + 3, 8, 3);
      }
      [PX.up1, PX.up2].forEach((cx, i) => {
        g.fillStyle = '#20262b'; g.fillRect(cx - 14, 30, 28, 30);
        g.fillStyle = '#586068'; g.fillRect(cx - 10, 34, 20, 22);
        const on = state.up && state.up[i];
        g.fillStyle = on ? '#2fbf71' : '#4a525a'; g.fillRect(cx - 8, 66, 16, 8);
      });
      g.fillStyle = state.sys === 'ok' ? '#2fbf71' : state.sys === 'boot' ? '#e0a030' : '#8a929b';
      g.beginPath(); g.arc(566, 22, 5, 0, 7); g.fill();
    });
  }

  const Scene3D = {
    ready: false,
    init(canvas, opts) {
      opts = opts || {};
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8ecef); scene.fog = new THREE.Fog(0xe8ecef, 90, 160);
      const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
      const root3 = new THREE.Group(); scene.add(root3);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c0c8, 1.5));
      const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(12, 26, 18); scene.add(key);
      const back = new THREE.DirectionalLight(0xffffff, 0.55); back.position.set(-10, 22, -20); scene.add(back);
      Object.assign(this, { r, scene, cam, root: root3, cs: { az: 0, pol: 80, dist: 36, ty: 9, tx: 0 }, goal: null, onPickU: opts.onPickU, cables: [], sw: null, swState: { sys: 'off', up: [false, false], psuLed: false } });
      this.buildStatic();
      this.bind(canvas);
      this.resize();
      this.ready = true;
      const loop = () => { this.tick(); requestAnimationFrame(loop); };
      loop();
    },
    buildStatic() {
      const g = this.root;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), new THREE.MeshStandardMaterial({ color: 0xd3d9de, roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2; g.add(floor);
      const grid = new THREE.GridHelper(80, 40, 0xaeb7bf, 0xc3cad1); grid.position.y = 0.01; g.add(grid);
      // 콜드/핫 아일 바닥 띠
      const cold = new THREE.Mesh(new THREE.PlaneGeometry(26, 6), new THREE.MeshBasicMaterial({ color: 0x2a6fb0, transparent: true, opacity: 0.16 }));
      cold.rotation.x = -Math.PI / 2; cold.position.set(CORE_X / 2, 0.02, ZF + 4.6); g.add(cold);
      const hot = new THREE.Mesh(new THREE.PlaneGeometry(26, 6), new THREE.MeshBasicMaterial({ color: 0xc8553d, transparent: true, opacity: 0.16 }));
      hot.rotation.x = -Math.PI / 2; hot.position.set(CORE_X / 2, 0.02, ZR - 4.6); g.add(hot);
      const l1 = sprite('콜드 아일 (전면, 찬 공기 흡기)', '#1f5f9e', 0.9); l1.position.set(0, 0.5, ZF + 4.6); g.add(l1);
      const l2 = sprite('핫 아일 (후면, 더운 공기 배기)', '#a8402a', 0.9); l2.position.set(0, 0.5, ZR - 4.6); g.add(l2);
      this.rack(0, 'R12 (빈 랙 · 여기에 설치)');
      this.rack(CORE_X, 'R01 (코어 랙)');
      // 사전 장비
      PRE.forEach(d => this.pre(d));
      // 코어
      this.coreDev('CORE-A', 41); this.coreDev('CORE-B', 38);
      // PDU
      this.pdu('A'); this.pdu('B');
    },
    rack(x, label) {
      const g = this.root, m = new THREE.MeshStandardMaterial({ color: 0x3a444e, roughness: 0.5, metalness: 0.4 });
      const H = TOTAL_U * U + 0.7;
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(p => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, H, 0.18), m);
        post.position.set(x + p[0] * (W / 2 + 0.22), H / 2, p[1] * ZF); g.add(post);
      });
      [0.15, H - 0.1].forEach(y => [ZF, ZR].forEach(z => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(W + 0.62, 0.14, 0.14), m); bar.position.set(x, y, z); g.add(bar);
      }));
      [-1, 1].forEach(sx => [0.15, H - 0.1].forEach(y => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, DEP), m); bar.position.set(x + sx * (W / 2 + 0.22), y, 0); g.add(bar);
      }));
      // U 번호 눈금 (전면 왼쪽 기둥 옆)
      for (let u = 5; u <= 40; u += 5) {
        const t = sprite(String(u), '#55606b', 0.28); t.position.set(x - W / 2 - 0.85, yOf(u), ZF + 0.12); g.add(t);
      }
      const t = sprite(label, '#2b343c', 0.62); t.position.set(x, H + 0.9, 0); g.add(t);
    },
    pre(d) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(W * 0.97, d.h * U * 0.92, DEP * 0.98), faceMats(
        d.kind === 'patch' ? tex(1086, 100, (g, w, h) => { g.fillStyle = '#2f373f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 24; i++) { g.fillStyle = '#12161a'; g.fillRect(40 + i * 42, 30, 28, 40); g.fillStyle = '#4fc3d9'; g.fillRect(44 + i * 42, 34, 20, 6); } })
          : d.kind === 'mgr' ? plain('케이블 매니저', '#252b32', '#3a444e') : srvFace(d.name, d.kind, false),
        d.kind === 'patch' || d.kind === 'mgr' ? plain(d.name, '#252b32', '#3a444e') : srvFace(d.name, d.kind, true)));
      box.position.set(0, BASE + (d.u - 1) * U + d.h * U / 2, 0); this.root.add(box);
    },
    coreDev(name, u) {
      const f = tex(1086, 100, (g, w, h) => { g.fillStyle = '#1d242b'; g.fillRect(0, 0, w, h); g.fillStyle = '#4fc3d9'; g.fillRect(0, 0, w, 3);
        for (let i = 0; i < 24; i++) { g.fillStyle = '#0f1318'; g.fillRect(500 + i * 24, 30, 16, 24); g.fillStyle = i < 14 ? '#2fbf71' : '#4a525a'; g.fillRect(503 + i * 24, 58, 10, 5); }
        g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 30px sans-serif'; g.textBaseline = 'middle'; g.fillText(name, 30, h / 2); });
      const box = new THREE.Mesh(new THREE.BoxGeometry(W * 0.97, U * 0.92, DEP * 0.98), faceMats(f, f));
      box.position.set(CORE_X, yOf(u), 0); this.root.add(box);
      const s = sprite(name, '#14606f', 0.4); s.position.set(CORE_X, yOf(u) + 0.5, ZR - 0.25); this.root.add(s);
      (this.corePorts = this.corePorts || {})[name] = new THREE.Vector3(CORE_X + 1.5, yOf(u), ZR - 0.05);
    },
    pdu(side) {
      const col = COLORS[side], grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 14.6, 0.34), new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.6 }));
      body.position.y = 8.2; grp.add(body);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 14.6, 0.04), new THREE.MeshStandardMaterial({ color: col }));
      stripe.position.set(0, 8.2, -0.17); grp.add(stripe);
      for (let k = 0; k < 12; k++) {
        const o = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0x6a737d }));
        o.position.set(0, 1.4 + k * 1.05, -0.2); grp.add(o);
      }
      const home = new THREE.Vector3(side === 'A' ? -6.6 : -5.0, 0, 1.6);
      grp.position.copy(home); grp.userData = { home, side, target: null, installed: false };
      this.root.add(grp); (this.pdus = this.pdus || {})[side] = grp; this.pduLabel(side, 'PDU-' + side + ' (대기)');
    },
    pduLabel(side, text) {
      const grp = this.pdus[side]; if (grp.userData.lab) grp.remove(grp.userData.lab);
      const l = sprite(text, '#' + COLORS[side].toString(16), 0.42); l.position.set(0, 16.0, 0); grp.add(l); grp.userData.lab = l;
    },
    pduPos(side, k) { const g = this.pdus[side]; g.updateMatrixWorld(true); return g.localToWorld(new THREE.Vector3(0, 1.4 + k * 1.05, -0.22)); },
    installPdu(side, lr, label) {
      const g = this.pdus[side]; g.userData.target = new THREE.Vector3(lr === 'L' ? 2.62 : -2.62, 0, ZR + 0.45); g.userData.installed = true;
      this.pduLabel(side, label || 'PDU-' + side);
    },
    resetPdus() { ['A', 'B'].forEach(k => { const g = this.pdus[k]; g.position.copy(g.userData.home); g.userData.target = null; g.userData.installed = false; this.pduLabel(k, 'PDU-' + k + ' (대기)'); }); },
    /* 스위치 장착 */
    mount(u, portFace) {
      if (this.sw) { this.root.remove(this.sw); this.sw = null; }
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(W * 0.97, U * 0.92, DEP * 0.62), faceMats(null, null, 0x9aa3ab));
      grp.add(body);
      const faceMat = new THREE.MeshBasicMaterial({ map: switchFace(this.swState), transparent: false });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.97, U * 0.92), faceMat); face.position.z = DEP * 0.31 + 0.005; grp.add(face);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.97, U * 0.92), new THREE.MeshBasicMaterial({ map: plain('NX-4824T  ·  흡기 (포트 반대면)', '#bfc6cd', '#e0a030', true) }));
      back.position.z = -DEP * 0.31 - 0.005; back.rotation.y = Math.PI; grp.add(back);
      grp.position.set(0, yOf(u), portFace === 'rear' ? 0 : 0);
      grp.rotation.y = portFace === 'rear' ? Math.PI : 0;
      grp.position.z = (portFace === 'rear' ? -1 : 1) * (DEP * 0.19); // 앞뒤 기준 위치(안쪽에 깊이 맞춤)
      grp.userData = { face, u, portFace };
      this.root.add(grp); this.sw = grp; this.refreshFace();
      return grp;
    },
    refreshFace() {
      if (!this.sw) return;
      const f = this.sw.userData.face; if (f.material.map) f.material.map.dispose();
      f.material.map = switchFace(this.swState); f.material.needsUpdate = true;
    },
    setSwState(p) { Object.assign(this.swState, p); this.refreshFace(); },
    unmount() { if (this.sw) { this.root.remove(this.sw); this.sw = null; } this.clearCables(); },
    local(px, py) { // 스위치 포트면 위 한 점 -> 월드
      const v = new THREE.Vector3((px / 1086 - 0.5) * W * 0.97, (0.5 - py / 100) * U * 0.92, DEP * 0.31 + 0.02);
      this.sw.updateMatrixWorld(true); return this.sw.localToWorld(v);
    },
    ghost(u, ok) {
      if (this.ghostM) { this.root.remove(this.ghostM); this.ghostM = null; }
      if (u == null) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(W * 0.99, U * 0.96, DEP * 0.98), new THREE.MeshBasicMaterial({ color: ok ? 0x2fbf71 : 0xd9654a, transparent: true, opacity: 0.38, depthWrite: false }));
      m.position.set(0, yOf(u), 0); this.root.add(m); this.ghostM = m;
    },
    clearCables() { this.cables.forEach(c => this.root.remove(c)); this.cables = []; },
    tube(points, color, rad) {
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, rad || 0.045, 8, false), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
      this.root.add(m); this.cables.push(m); return m;
    },
    power(which, side, outlet) { // which 1|2
      if (!this.sw) return;
      const a = this.local(which === 1 ? PX.psu1 : PX.psu2, 56);
      const out = this.sw.userData.portFace === 'rear' ? -1 : 1;
      const end = this.pduPos(side, outlet);
      const pts = [a, new THREE.Vector3(a.x, a.y, a.z + out * 0.7)];
      if (out > 0) { // 포트면이 앞: 전원선이 랙 옆으로 돌아 뒤로 감
        const sx = Math.sign(this.pdus[side].position.x) || 1;
        pts.push(new THREE.Vector3(sx * (W / 2 + 1.0), a.y, ZF + 0.8), new THREE.Vector3(sx * (W / 2 + 1.0), a.y, 0), new THREE.Vector3(sx * (W / 2 + 0.7), end.y, ZR - 0.9));
      } else {
        pts.push(new THREE.Vector3((a.x + end.x) / 2, (a.y + end.y) / 2, ZR - 1.1));
      }
      pts.push(new THREE.Vector3(end.x, end.y, end.z - 0.25), end);
      return this.tube(pts, COLORS[side], 0.05);
    },
    fiber(i, core) { // i 1|2, core 'CORE-A'|'CORE-B'
      if (!this.sw) return;
      const a = this.local(i === 1 ? PX.up1 : PX.up2, 45);
      const out = this.sw.userData.portFace === 'rear' ? -1 : 1;
      const dst = this.corePorts[core].clone(); dst.x += i * 0.4;
      const topY = TOTAL_U * U + 1.3 + i * 0.25;
      const pts = [a, new THREE.Vector3(a.x, a.y, a.z + out * 0.8)];
      if (out > 0) pts.push(new THREE.Vector3(a.x, a.y + 0.2, ZF + 1.6), new THREE.Vector3(W / 2 + 1.2, a.y, ZF + 1.6), new THREE.Vector3(W / 2 + 1.2, topY, ZR - 1.2));
      pts.push(new THREE.Vector3(a.x, topY, ZR - 1.2), new THREE.Vector3(dst.x, topY, ZR - 1.2), new THREE.Vector3(dst.x, dst.y + 0.6, ZR - 0.9), dst);
      return this.tube(pts, COLORS.fiber, 0.03);
    },
    /* 카메라 */
    bind(canvas) {
      let drag = null, moved = 0;
      canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; canvas.setPointerCapture(e.pointerId); this.goal = null; });
      canvas.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
        drag = { x: e.clientX, y: e.clientY };
        if (e.buttons & 2 || e.shiftKey) { this.cs.ty = Math.max(1, Math.min(20, this.cs.ty + dy * 0.04)); this.cs.tx -= dx * 0.04 * Math.cos(this.cs.az * Math.PI / 180); }
        else { this.cs.az -= dx * 0.4; this.cs.pol = Math.max(35, Math.min(105, this.cs.pol - dy * 0.3)); }
      });
      canvas.addEventListener('pointerup', e => {
        if (drag && moved < 5 && this.onPickU) this.pick(e, canvas);
        drag = null;
      });
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      canvas.addEventListener('wheel', e => { e.preventDefault(); this.goal = null; this.cs.dist = Math.max(10, Math.min(60, this.cs.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
      window.addEventListener('resize', () => this.resize());
    },
    pick(e, canvas) {
      const b = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.cam);
      const hit = new THREE.Vector3();
      if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit) && Math.abs(hit.x) < W / 2 + 0.3) {
        const u = Math.round((hit.y - BASE - U / 2) / U) + 1;
        if (u >= 1 && u <= TOTAL_U) this.onPickU(u);
      }
    },
    setView(name) {
      const P = {
        front: { az: 0, pol: 82, dist: 40, ty: 9, tx: 4 }, rear: { az: 180, pol: 82, dist: 40, ty: 9, tx: 4 },
        top: { az: 180, pol: 78, dist: 20, ty: 15.5, tx: 3 }, rearTop: { az: 190, pol: 74, dist: 24, ty: 14, tx: 4 },
        pdu: { az: 200, pol: 80, dist: 34, ty: 9, tx: -1 },
        front_up: { az: 0, pol: 84, dist: 20, ty: 14.5, tx: 0 },
      };
      this.goal = P[name] || P.front;
    },
    tick() {
      const c = this.cs;
      Object.values(this.pdus || {}).forEach(g => { const t = g.userData.target; if (t) { g.position.lerp(t, 0.1); if (g.position.distanceTo(t) < 0.02) { g.position.copy(t); g.userData.target = null; } } });
      if (this.goal) {
        let d = 0;
        ['az', 'pol', 'dist', 'ty', 'tx'].forEach(k => { let t = this.goal[k]; if (k === 'az') { let df = ((t - c.az + 540) % 360) - 180; t = c.az + df; } const diff = t - c[k]; c[k] += diff * 0.1; d += Math.abs(diff); });
        if (d < 0.05) this.goal = null;
      }
      const az = c.az * Math.PI / 180, pol = c.pol * Math.PI / 180;
      this.cam.position.set(c.tx + c.dist * Math.sin(pol) * Math.sin(az), c.ty + c.dist * Math.cos(pol), c.dist * Math.sin(pol) * Math.cos(az));
      this.cam.lookAt(c.tx, c.ty, 0);
      this.r.render(this.scene, this.cam);
    },
    resize() {
      const cv = this.r.domElement, p = cv.parentElement;
      const w = p.clientWidth, h = p.clientHeight; if (!w || !h) return;
      this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    },
  };
  Scene3D.consts = { U, W, DEP, TOTAL_U, PRE, PX };
  root.Scene3D = Scene3D;
})(window);
