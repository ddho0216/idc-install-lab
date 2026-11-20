/* 3D 작업장 (three.js): 빈 랙, 작업대, PDU 보관대, 집어서 설치하는 상호작용. 크기·배치는 제가 만든 가상 그림입니다. */
(function (root) {
  const U = 0.445, W = 4.83, DEP = 9.0, BASE = 0.7, TOTAL_U = 42;
  const ZF = DEP / 2, ZR = -DEP / 2, RAILZ = ZF - 0.35, SWD = 4.4, CORE_X = 9.6;
  const HGT = BASE + TOTAL_U * U + 0.4;
  const yOf = u => BASE + (u - 1) * U + U / 2;
  const uOf = y => Math.round((y - BASE - U / 2) / U) + 1;
  const COLORS = { A: 0xd9654a, B: 0x4a8bd9, fiber: 0xe8c547 };
  const PX = { psu1: 125, psu2: 345, up1: 1018, up2: 1054, con: 566 };
  const TB = { x: -12, z: 1.5, top: 7.7 };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  function tex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function sprite(text, color, scale, bg) {
    const t = tex(512, 96, (g, w, h) => {
      if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(8, 10, w - 16, h - 20, 22) : g.rect(8, 10, w - 16, h - 20); g.fill(); }
      g.font = '700 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color || '#2b343c'; g.fillText(text, w / 2, h / 2 + 2);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(5.3 * (scale || 1), 1 * (scale || 1), 1); return s;
  }
  const mat = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.65 : r, metalness: m || 0 });
  function box(w, h, d, c, r, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, r, m)); }

  function railTex() {
    return tex(64, TOTAL_U * 24, (g, w, h) => {
      g.fillStyle = '#8a949e'; g.fillRect(0, 0, w, h);
      for (let u = 1; u <= TOTAL_U; u++) {
        const y = h - u * 24;
        g.fillStyle = '#2a3138'; for (let k = 0; k < 3; k++) g.fillRect(24, y + 3 + k * 7, 16, 4);
        g.fillStyle = '#5b6670'; g.fillRect(0, y, w, 1);
        if (u % 5 === 0 || u === 1) { g.fillStyle = '#12161a'; g.font = 'bold 15px sans-serif'; g.fillText(String(u), 3, y + 16); }
      }
    });
  }
  function switchFace(state) {
    return tex(1086, 100, (g, w, h) => {
      g.fillStyle = '#d6dce2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e0a030'; g.fillRect(0, 0, w, 4);
      g.fillStyle = '#56606a'; g.font = '700 14px sans-serif'; g.textBaseline = 'top';
      g.fillText('PSU1', 22, 8); g.fillText('PSU2', 242, 8); g.fillText('FAN', 462, 8); g.fillText('CON', 556, 80); g.fillText('GE 1-48', 600, 8); g.fillText('T1  T2', 1004, 8);
      [PX.psu1, PX.psu2].forEach((cx, i) => {
        g.fillStyle = '#b2bac2'; g.fillRect(cx - 100, 24, 200, 66);
        g.fillStyle = state.inlet && state.inlet[i] ? '#d9654a' : '#2a3036'; g.fillRect(cx - 28, 40, 56, 34);
        g.fillStyle = '#6a737d'; g.fillRect(cx - 18, 46, 6, 14); g.fillRect(cx + 12, 46, 6, 14);
        g.fillStyle = state.psuLed ? '#2fbf71' : '#8a929b'; g.fillRect(cx + 70, 30, 14, 8);
      });
      for (let i = 0; i < 3; i++) { g.fillStyle = '#9aa3ab'; g.beginPath(); g.arc(484 + i * 28, 58, 11, 0, 7); g.fill(); g.fillStyle = '#4a525a'; g.beginPath(); g.arc(484 + i * 28, 58, 4, 0, 7); g.fill(); }
      g.fillStyle = state.con ? '#4fa3d9' : '#20262b'; g.fillRect(556, 40, 20, 20);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 24; c++) {
        const x = 600 + c * 15.8, y = 28 + r * 30;
        g.fillStyle = '#20262b'; g.fillRect(x, y, 12, 22); g.fillStyle = '#4a525a'; g.fillRect(x + 2, y + 3, 8, 3);
      }
      [PX.up1, PX.up2].forEach((cx, i) => {
        g.fillStyle = '#20262b'; g.fillRect(cx - 14, 30, 28, 30); g.fillStyle = '#586068'; g.fillRect(cx - 10, 34, 20, 22);
        g.fillStyle = state.up && state.up[i] ? '#2fbf71' : '#4a525a'; g.fillRect(cx - 8, 66, 16, 8);
      });
      g.fillStyle = state.sys === 'ok' ? '#2fbf71' : state.sys === 'boot' ? '#e0a030' : '#8a929b'; g.beginPath(); g.arc(566, 22, 5, 0, 7); g.fill();
    });
  }
  function plainTex(label, base, accent, dark) {
    return tex(1086, 100, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = accent; g.fillRect(0, 0, w, 3);
      g.fillStyle = dark ? 'rgba(25,32,38,.75)' : 'rgba(255,255,255,.75)'; g.font = '600 28px sans-serif'; g.textBaseline = 'middle'; g.fillText(label, 26, h / 2);
    });
  }

  const Scene3D = {
    ready: false, items: {}, targetMeshes: [], tweens: [], cables: [], planeOn: false, heldId: null, hoverRef: null, pduAt: {},
    init(canvas, H) {
      this.H = H || {};
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8ecef); scene.fog = new THREE.Fog(0xe8ecef, 110, 190);
      const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 260);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c0c8, 1.5));
      const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(12, 30, 22); scene.add(key);
      const back = new THREE.DirectionalLight(0xffffff, 0.55); back.position.set(-10, 24, -22); scene.add(back);
      const root3 = new THREE.Group(); scene.add(root3);
      Object.assign(this, { r, scene, cam, root: root3, cs: { az: 0, pol: 82, dist: 44, ty: 8, tx: -4 }, goal: null, swState: { sys: 'off', up: [false, false], psuLed: false, inlet: [false, false], con: false }, clock: performance.now() });
      this.hbox = new THREE.Box3Helper(new THREE.Box3(), 0xf0a000); this.hbox.visible = false; scene.add(this.hbox);
      this.kbox = new THREE.Box3Helper(new THREE.Box3(), 0x17935a); this.kbox.visible = false; scene.add(this.kbox);
      this.tgroup = new THREE.Group(); root3.add(this.tgroup);
      this.buildStatic(); this.bind(canvas); this.resize(); this.ready = true;
      const loop = () => { this.tick(); requestAnimationFrame(loop); }; loop();
    },

    /* ---------- 고정 구조물 ---------- */
    buildStatic() {
      const g = this.root;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), mat(0xd3d9de, 0.95)); floor.rotation.x = -Math.PI / 2; g.add(floor);
      const grid = new THREE.GridHelper(140, 70, 0xaeb7bf, 0xc3cad1); grid.position.y = 0.01; g.add(grid);
      const cold = new THREE.Mesh(new THREE.PlaneGeometry(34, 6), new THREE.MeshBasicMaterial({ color: 0x2a6fb0, transparent: true, opacity: 0.14 }));
      cold.rotation.x = -Math.PI / 2; cold.position.set(-2, 0.02, ZF + 4.6); g.add(cold);
      const hot = new THREE.Mesh(new THREE.PlaneGeometry(34, 6), new THREE.MeshBasicMaterial({ color: 0xc8553d, transparent: true, opacity: 0.14 }));
      hot.rotation.x = -Math.PI / 2; hot.position.set(-2, 0.02, ZR - 4.6); g.add(hot);
      const l1 = sprite('콜드 아일 (전면, 찬 공기 흡기)', '#1f5f9e', 0.9); l1.position.set(2, 0.6, ZF + 4.8); g.add(l1);
      const l2 = sprite('핫 아일 (후면, 더운 공기 배기)', '#a8402a', 0.9); l2.position.set(2, 0.6, ZR - 4.8); g.add(l2);
      this.rack(0, 'R12 (빈 랙 · 여기에 설치)'); this.rack(CORE_X, 'R01 (코어 랙)', true);
      this.coreDev('CORE-A', 41); this.coreDev('CORE-B', 38);
      this.buildTable(); this.buildPduStand(); this.buildSwitch(); this.buildItems();
    },
    rack(x, label, plain) {
      const g = this.root, post = mat(0x3d4852, 0.5, 0.4), HH = HGT - BASE - 0.4;
      const base = box(W + 1.5, BASE, DEP, 0x2a3138); base.position.set(x, BASE / 2, 0); g.add(base);
      const top = box(W + 1.5, 0.4, DEP, 0x2a3138); top.position.set(x, HGT - 0.2, 0); g.add(top);
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(p => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, HH, 0.5), post); m.position.set(x + p[0] * (W / 2 + 0.33), BASE + HH / 2, p[1] * (ZF - 0.25)); g.add(m);
      });
      [-1, 1].forEach(sx => {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, HH, DEP - 0.2), new THREE.MeshStandardMaterial({ color: 0xaab3bb, roughness: 0.6, transparent: true, opacity: 0.55 }));
        side.position.set(x + sx * (W / 2 + 0.66), BASE + HH / 2, 0); g.add(side);
      });
      const rt = railTex();
      [[ZF - 0.34, 0], [ZR + 0.34, Math.PI]].forEach(([z, ry]) => [-1, 1].forEach(sx => {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, TOTAL_U * U), new THREE.MeshBasicMaterial({ map: rt }));
        pl.position.set(x + sx * (W / 2 + 0.14), BASE + TOTAL_U * U / 2, z); pl.rotation.y = ry; g.add(pl);
      }));
      const t = sprite(label, '#2b343c', 0.62); t.position.set(x, HGT + 1.0, 0); g.add(t);
    },
    coreDev(name, u) {
      const f = tex(1086, 100, (g, w, h) => { g.fillStyle = '#1d242b'; g.fillRect(0, 0, w, h); g.fillStyle = '#4fc3d9'; g.fillRect(0, 0, w, 3);
        for (let i = 0; i < 24; i++) { g.fillStyle = '#0f1318'; g.fillRect(500 + i * 24, 30, 16, 24); g.fillStyle = i < 14 ? '#2fbf71' : '#4a525a'; g.fillRect(503 + i * 24, 58, 10, 5); }
        g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '700 30px sans-serif'; g.textBaseline = 'middle'; g.fillText(name, 30, h / 2); });
      const sm = mat(0x20262d, 0.7, 0.3), fm = new THREE.MeshStandardMaterial({ map: f, roughness: 0.6 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(W * 0.97, U * 0.92, 5.4), [sm, sm, sm, sm, fm, fm]); m.position.set(CORE_X, yOf(u), 0); this.root.add(m);
      const s = sprite(name, '#14606f', 0.4); s.position.set(CORE_X, yOf(u) + 0.55, ZR - 0.3); this.root.add(s);
      (this.corePorts = this.corePorts || {})[name] = V3(CORE_X + 1.5, yOf(u), -2.75);
    },
    buildTable() {
      const g = new THREE.Group(); g.position.set(TB.x, 0, TB.z);
      const top = box(13, 0.4, 7.2, 0xcdb895, 0.8); top.position.y = TB.top - 0.2; g.add(top);
      [[-6.2, -3.3], [6.2, -3.3], [-6.2, 3.3], [6.2, 3.3]].forEach(p => { const l = box(0.35, TB.top - 0.4, 0.35, 0x59626b, 0.5, 0.3); l.position.set(p[0], (TB.top - 0.4) / 2, p[1]); g.add(l); });
      const lab = sprite('작업대 (입고된 장비·자재)', '#2b343c', 0.55); lab.position.set(0, TB.top + 5.6, 0); g.add(lab);
      this.root.add(g);
    },
    buildPduStand() {
      const st = box(9.4, 0.3, 2.4, 0x59626b, 0.5, 0.3); st.position.set(-22.2, 0.15, 1.5); this.root.add(st);
      const lab = sprite('PDU 보관대 (정격이 다른 PDU)', '#2b343c', 0.55); lab.position.set(-22.2, 17.6, 1.5); this.root.add(lab);
      [['pdu16a', 16], ['pdu16b', 16], ['pdu20a', 20], ['pdu20b', 20], ['pdu32a', 32], ['pdu32b', 32]].forEach((d, i) => {
        const g = new THREE.Group(), x = -25.5 + i * 1.3;
        const body = box(0.42, 14.6, 0.42, 0x2a3036, 0.6); body.position.y = 8.2; g.add(body);
        const stripe = box(0.44, 14.6, 0.05, 0x8a929b); stripe.position.set(0, 8.2, -0.2); g.add(stripe);
        for (let k = 0; k < 12; k++) { const o = box(0.22, 0.5, 0.06, 0x6a737d); o.position.set(0, 14.4 - k * 1.05, -0.22); g.add(o); }
        const lb = sprite(d[1] + 'A', '#1b2127', 0.34, 'rgba(255,255,255,.9)'); lb.position.set(0, 15.9, 0); g.add(lb); g.userData.lab = lb;
        g.position.set(x, 0.3, 1.5);
        this.reg(d[0], g, { label: 'PDU ' + d[1] + 'A (정격 ' + d[1] + 'A)', hit: [0.9, 14.8, 0.9, 0, 8.2, 0], rating: d[1], kind: 'pdu' });
      });
    },
    buildSwitch() {
      const g = new THREE.Group(), sm = mat(0x9aa3ab, 0.6, 0.3);
      const body = new THREE.Mesh(new THREE.BoxGeometry(W * 0.97, U * 0.92, SWD), sm); g.add(body);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.97, U * 0.92), new THREE.MeshBasicMaterial({ map: switchFace(this.swState) })); face.position.z = SWD / 2 + 0.005; g.add(face);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.97, U * 0.92), new THREE.MeshBasicMaterial({ map: plainTex('NX-4824T  ·  흡기 (포트 반대면)', '#bfc6cd', '#e0a030', true) }));
      back.position.z = -SWD / 2 - 0.005; back.rotation.y = Math.PI; g.add(back);
      g.userData.face = face; g.position.set(-15, TB.top + 1.8 + 0.3, TB.z); g.visible = false;
      const lb = sprite('스위치', '#1b2127', 0.34, 'rgba(255,255,255,.9)'); lb.position.set(0, 0.9, 0); g.add(lb);
      this.sw = g; this.reg('switch', g, { label: '스위치 NX-4824T (가상)', hit: [W, 0.9, SWD, 0, 0, 0], enabled: false, kind: 'switch' });
    },
    buildItems() {
      // 입고 박스
      const bx = new THREE.Group();
      const body = box(6.2, 1.8, 5.6, 0xc59a5b, 0.9); body.position.y = 0.9; bx.add(body);
      const tape = box(0.5, 1.82, 5.62, 0xe6d3a4, 0.9); tape.position.y = 0.9; bx.add(tape);
      const f1 = box(6.2, 0.08, 2.8, 0xb78a4d, 0.9), f2 = box(6.2, 0.08, 2.8, 0xb78a4d, 0.9);
      const p1 = new THREE.Group(); p1.position.set(0, 1.8, 2.8); f1.position.z = -1.4; p1.add(f1);
      const p2 = new THREE.Group(); p2.position.set(0, 1.8, -2.8); f2.position.z = 1.4; p2.add(f2);
      bx.add(p1); bx.add(p2); bx.userData = { p1, p2, open: 0 };
      const lb = sprite('입고 박스', '#1b2127', 0.34, 'rgba(255,255,255,.9)'); lb.position.set(0, 3.2, 0); bx.add(lb);
      bx.position.set(-15, TB.top, TB.z); this.reg('box', bx, { label: '입고 박스 (먼저 검수)', hit: [6.2, 1.8, 5.6, 0, 0.9, 0], pickable: false, kind: 'box' });
      // 레일 킷
      const rl = new THREE.Group();
      [-0.55, 0.55].forEach(z => { const r1 = box(4.4, 0.18, 0.5, 0x8a949e, 0.4, 0.6); r1.position.z = z; rl.add(r1); const r2 = box(4.4, 0.5, 0.1, 0x8a949e, 0.4, 0.6); r2.position.set(0, 0.2, z + (z < 0 ? -0.25 : 0.25)); rl.add(r2); });
      const l2 = sprite('레일 킷', '#1b2127', 0.34, 'rgba(255,255,255,.9)'); l2.position.set(0, 1.5, 0); rl.add(l2);
      rl.position.set(-9.8, TB.top + 0.15, 4.4); this.reg('rails', rl, { label: '레일 킷 (스위치를 받치는 레일)', hit: [4.6, 0.9, 1.8, 0, 0.3, 0], kind: 'rails' });
      // 전원 코드·광·콘솔: 감아 둔 케이블
      const coil = (id, x, z, color, label, tint, ring) => {
        const g = new THREE.Group();
        const t = new THREE.Mesh(new THREE.TorusGeometry(ring || 0.62, 0.08, 10, 28), mat(color, 0.6)); t.rotation.x = Math.PI / 2; t.position.y = 0.1; g.add(t);
        const t2 = new THREE.Mesh(new THREE.TorusGeometry((ring || 0.62) - 0.2, 0.08, 10, 28), mat(color, 0.6)); t2.rotation.x = Math.PI / 2; t2.position.y = 0.22; g.add(t2);
        const pl = box(0.35, 0.22, 0.5, tint, 0.5); pl.position.set(0.8, 0.12, 0); g.add(pl); const pl2 = box(0.35, 0.22, 0.5, tint, 0.5); pl2.position.set(-0.8, 0.12, 0); g.add(pl2);
        const lb = sprite(label, '#1b2127', 0.3, 'rgba(255,255,255,.9)'); lb.position.set(0, 1.5, 0); g.add(lb);
        g.position.set(x, TB.top + 0.05, z); this.reg(id, g, { label, hit: [2.2, 0.8, 1.6, 0, 0.3, 0], kind: id.replace(/\d/g, '') });
      };
      coil('cord1', -10.8, 0.4, 0x24292e, '전원 코드 1', 0x3a4148);
      coil('cord2', -8.6, 0.4, 0x24292e, '전원 코드 2', 0x3a4148);
      coil('fib1', -10.8, 2.2, COLORS.fiber, '광 케이블 1 (LC)', 0xdde6ee);
      coil('fib2', -8.6, 2.2, COLORS.fiber, '광 케이블 2 (LC)', 0xdde6ee);
      coil('console', -6.6, 0.4, 0x4fa3d9, '콘솔 케이블', 0x2a3036);
      // 노트북
      const lp = new THREE.Group();
      const lb2 = box(2.6, 0.12, 1.8, 0x7d8791, 0.5, 0.5); lb2.position.y = 0.06; lp.add(lb2);
      const sc = box(2.6, 1.6, 0.08, 0x1b2127); sc.position.set(0, 0.9, -0.9); sc.rotation.x = -0.18; lp.add(sc);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ map: tex(256, 140, (g, w, h) => { g.fillStyle = '#0b0e12'; g.fillRect(0, 0, w, h); g.fillStyle = '#e0a030'; g.font = '16px monospace'; g.fillText('SW> _', 10, 24); }) }));
      scr.position.set(0, 0.9, -0.85); scr.rotation.x = -0.18; lp.add(scr);
      const l3 = sprite('노트북 (콘솔 접속용)', '#1b2127', 0.34, 'rgba(255,255,255,.9)'); l3.position.set(0, 2.5, 0); lp.add(l3);
      lp.position.set(-6.2, TB.top, 3.0); lp.rotation.y = 0.2; this.reg('laptop', lp, { label: '노트북 (콘솔 접속용)', hit: [2.8, 1.8, 2, 0, 0.8, 0], pickable: false, kind: 'laptop' });
    },
    /* 상호작용 가능한 물건 등록 */
    reg(id, g, o) {
      const hit = new THREE.Mesh(new THREE.BoxGeometry(o.hit[0], o.hit[1], o.hit[2]), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(o.hit[3], o.hit[4], o.hit[5]); hit.userData.iid = id; g.add(hit);
      this.root.add(g);
      this.items[id] = Object.assign({ id, g, hit, home: g.position.clone(), homeRot: g.rotation.y, label: o.label, pickable: o.pickable !== false, enabled: o.enabled !== false, placed: false }, { rating: o.rating, kind: o.kind });
    },

    /* ---------- 장면 동작 ---------- */
    openBox() { this.items.box.g.userData.open = 1; this.sw.visible = true; this.items.switch.enabled = true; },
    setHeld(id) { this.heldId = id; },
    fly(id, pos, rotY, cb, dur) {
      const it = this.items[id]; it.placed = true;
      this.tweens = this.tweens.filter(t => t.g !== it.g);
      this.tweens.push({ g: it.g, p0: it.g.position.clone(), p1: pos.clone(), r0: it.g.rotation.y, r1: rotY == null ? it.g.rotation.y : rotY, t: 0, dur: dur || 0.9, arc: 1.6, cb });
    },
    home(id, cb) { const it = this.items[id]; this.fly(id, it.home, it.homeRot, () => { it.placed = false; it.g.visible = true; cb && cb(); }); },
    pduSlot(lr) { return V3(lr === 'L' ? 2.72 : -2.72, 0, ZR + 0.95); },
    pduAssign(side, id) { this.pduAt[side] = id; },
    pduLabel(id, text, bg, fg) {
      const g = this.items[id].g; if (g.userData.lab) g.remove(g.userData.lab);
      const l = sprite(text, fg || '#fff', 0.38, bg || '#2a3036'); l.position.set(0, 15.9, 0); g.add(l); g.userData.lab = l;
    },
    pduPos(side, k) { const g = this.items[this.pduAt[side]].g; g.updateMatrixWorld(true); return g.localToWorld(V3(0, 14.4 - k * 1.05, -0.22)); },
    installRails(u, cb) {
      const it = this.items.rails, g = it.g;
      this.fly('rails', V3(0, yOf(u), 0), 0, () => {
        g.visible = false;
        const rg = new THREE.Group();
        [-1, 1].forEach(sx => { const r = box(0.16, 0.22, DEP - 0.9, 0x8a949e, 0.4, 0.6); r.position.set(sx * (W / 2 * 0.97 + 0.12), -U * 0.3, 0); rg.add(r); });
        rg.position.set(0, yOf(u), 0); this.root.add(rg); this.railsMesh = rg; cb && cb();
      }, 0.8);
    },
    swPort(name) {
      const px = { psu1: PX.psu1, psu2: PX.psu2, t1: PX.up1, t2: PX.up2, con: PX.con }[name], py = { psu1: 56, psu2: 56, t1: 45, t2: 45, con: 50 }[name];
      this.sw.updateMatrixWorld(true);
      return this.sw.localToWorld(V3((px / 1086 - 0.5) * W * 0.97, (0.5 - py / 100) * U * 0.92, SWD / 2 + 0.02));
    },
    mountSwitch(u, face, cb) {
      const z = (ZF - 0.35 - SWD / 2) * (face === 'rear' ? -1 : 1);
      this.sw.userData.face = this.sw.userData.face;
      this.fly('switch', V3(0, yOf(u), z), face === 'rear' ? Math.PI : 0, () => { this.mounted = { u, face }; this.refreshFace(); cb && cb(); }, 1.2);
    },
    refreshFace() { const f = this.sw.userData.face; if (f.material.map) f.material.map.dispose(); f.material.map = switchFace(this.swState); f.material.needsUpdate = true; },
    setSwState(p) { Object.assign(this.swState, p); this.refreshFace(); },
    ghost(u, ok) {
      if (this.ghostM) { this.root.remove(this.ghostM); this.ghostM = null; }
      if (u == null) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(W * 0.99, U * 0.96, DEP * 0.9), new THREE.MeshBasicMaterial({ color: ok ? 0x2fbf71 : 0xd9654a, transparent: true, opacity: 0.4, depthWrite: false }));
      m.position.set(0, yOf(u), 0); this.root.add(m); this.ghostM = m;
    },
    pickU(on) { this.planeOn = !!on; if (!on) this.ghost(null); },
    /* 놓을 자리 표시 */
    setTargets(list) {
      this.targetMeshes.forEach(m => this.tgroup.remove(m)); this.targetMeshes = [];
      (list || []).forEach(t => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(t.size[0], t.size[1], t.size[2]), new THREE.MeshBasicMaterial({ color: 0xf0b030, transparent: true, opacity: 0.4, depthTest: false }));
        m.position.copy(t.pos); m.renderOrder = 10; m.userData = { tid: t.id, label: t.label };
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xa86c00, depthTest: false })); m.add(e);
        this.tgroup.add(m); this.targetMeshes.push(m);
      });
    },
    tube(points, color, rad, kind) {
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, rad || 0.05, 8, false), mat(color, 0.5));
      this.root.add(m); m.userData.kind = kind; this.cables.push(m); return m;
    },
    clearCables(kind) { this.cables = this.cables.filter(c => { if (!kind || c.userData.kind === kind) { this.root.remove(c); return false; } return true; }); },
    power(psu, side, outlet) {
      const a = this.swPort(psu === 1 ? 'psu1' : 'psu2'), end = this.pduPos(side, outlet), rear = this.mounted && this.mounted.face === 'rear', out = rear ? -1 : 1;
      const pts = [a, V3(a.x, a.y, a.z + out * 0.8)];
      if (!rear) { const sx = Math.sign(this.items[this.pduAt[side]].g.position.x) || 1; pts.push(V3(sx * (W / 2 + 1.1), a.y, ZF + 1.0), V3(sx * (W / 2 + 1.1), a.y, 0), V3(sx * (W / 2 + 0.9), end.y, ZR - 1.2)); }
      else pts.push(V3((a.x + end.x) / 2, (a.y + end.y) / 2, ZR - 1.4));
      pts.push(V3(end.x, end.y, end.z - 0.9), end);
      return this.tube(pts, COLORS[side], 0.055, 'power');
    },
    fiber(port, core) {
      const a = this.swPort(port === 1 ? 't1' : 't2'), rear = this.mounted && this.mounted.face === 'rear', out = rear ? -1 : 1;
      const dst = this.corePorts[core].clone(); dst.x += port * 0.4;
      const topY = HGT + 0.9 + port * 0.25, pts = [a, V3(a.x, a.y, a.z + out * 1.0)];
      if (!rear) pts.push(V3(a.x, a.y + 0.2, ZF + 1.8), V3(W / 2 + 1.5, a.y, ZF + 1.8), V3(W / 2 + 1.5, topY, ZR - 1.4));
      pts.push(V3(a.x, topY, ZR - 1.4), V3(dst.x, topY, ZR - 1.4), V3(dst.x, dst.y + 0.6, ZR - 1.0), dst);
      return this.tube(pts, COLORS.fiber, 0.035, 'fiber');
    },
    consoleLine() {
      const lp = this.items.laptop.g.position, p = this.swPort('con'), rear = this.mounted && this.mounted.face === 'rear';
      return this.tube([V3(lp.x + 1.2, lp.y + 0.2, lp.z), V3(lp.x + 4, 5, lp.z - 2), V3(-5, p.y - 1.6, (rear ? -1 : 1) * (ZF + 3)), V3(p.x, p.y, p.z + (rear ? -1 : 1) * 0.9), p], 0x4fa3d9, 0.04, 'console');
    },
    reset() {
      this.tweens = []; this.setTargets([]); this.setHeld(null); this.pickU(false); this.clearCables(); this.pduAt = {};
      Object.values(this.items).forEach(it => { it.g.position.copy(it.home); it.g.rotation.y = it.homeRot; it.placed = false; it.g.visible = true; });
      this.sw.visible = false; this.items.switch.enabled = false; this.items.box.g.userData.open = 0; this.mounted = null;
      if (this.railsMesh) { this.root.remove(this.railsMesh); this.railsMesh = null; }
      Object.values(this.items).filter(i => i.kind === 'pdu').forEach(i => this.pduLabel(i.id, i.rating + 'A', 'rgba(255,255,255,.9)', '#1b2127'));
      this.swState = { sys: 'off', up: [false, false], psuLed: false, inlet: [false, false], con: false }; this.refreshFace();
      this.setView('table');
    },

    /* ---------- 입력·카메라 ---------- */
    bind(canvas) {
      let drag = null, moved = 0;
      const ndc = e => { const b = canvas.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); };
      this.hit = e => {
        const rc = new THREE.Raycaster(); rc.setFromCamera(ndc(e), this.cam);
        if (this.targetMeshes.length) { const h = rc.intersectObjects(this.targetMeshes, false)[0]; if (h) return { t: 'target', id: h.object.userData.tid, label: h.object.userData.label, obj: h.object }; }
        const hs = Object.values(this.items).filter(i => i.enabled && i.pickable && i.g.visible).map(i => i.hit);
        const h2 = rc.intersectObjects(hs, false)[0]; if (h2) { const it = this.items[h2.object.userData.iid]; return { t: 'item', id: it.id, label: it.label, obj: it.g }; }
        if (this.planeOn) { const p = V3(); if (rc.ray.intersectPlane(new THREE.Plane(V3(0, 0, 1), 0), p) && Math.abs(p.x) < W / 2 + 0.3) { const u = uOf(p.y); if (u >= 1 && u <= TOTAL_U) return { t: 'plane', u }; } }
        return null;
      };
      canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; canvas.setPointerCapture(e.pointerId); this.goal = null; });
      canvas.addEventListener('pointermove', e => {
        if (drag) {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); drag = { x: e.clientX, y: e.clientY };
          if (e.buttons & 2 || e.shiftKey) { this.cs.ty = Math.max(1, Math.min(22, this.cs.ty + dy * 0.05)); this.cs.tx -= dx * 0.05 * Math.cos(this.cs.az * Math.PI / 180); }
          else { this.cs.az -= dx * 0.4; this.cs.pol = Math.max(30, Math.min(105, this.cs.pol - dy * 0.3)); }
          return;
        }
        const h = this.hit(e); this.hoverRef = h && h.obj ? h : null; canvas.style.cursor = h && h.t !== 'plane' ? 'pointer' : (h ? 'crosshair' : 'grab');
        this.H.hover && this.H.hover(h, e.clientX, e.clientY);
      });
      canvas.addEventListener('pointerup', e => {
        if (drag && moved < 5) { const h = this.hit(e); if (h && h.t === 'item') this.H.item && this.H.item(h.id); else if (h && h.t === 'target') this.H.target && this.H.target(h.id); else if (h && h.t === 'plane') this.H.plane && this.H.plane(h.u); else this.H.empty && this.H.empty(); }
        drag = null;
      });
      canvas.addEventListener('pointerleave', () => { this.hoverRef = null; this.H.hover && this.H.hover(null); });
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      canvas.addEventListener('wheel', e => { e.preventDefault(); this.goal = null; this.cs.dist = Math.max(8, Math.min(80, this.cs.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
      window.addEventListener('resize', () => this.resize());
    },
    setView(name, o) {
      const u = (o && o.u) || 40, y = yOf(u);
      const P = {
        table: { az: 8, pol: 70, dist: 34, ty: 7, tx: -12 },
        wide: { az: 0, pol: 82, dist: 46, ty: 8, tx: -4 },
        pdu: { az: 196, pol: 76, dist: 48, ty: 9, tx: -11 },
        rails: { az: 0, pol: 84, dist: 17, ty: y, tx: -1 },
        rearUp: { az: 180, pol: 80, dist: 21, ty: y - 3, tx: 1 },
        rearCore: { az: 190, pol: 74, dist: 30, ty: y - 1, tx: 5 },
        mountWide: { az: 0, pol: 80, dist: 38, ty: 9, tx: -6 },
        powerWide: { az: 212, pol: 76, dist: 38, ty: 10, tx: -5 },
        fiberWide: { az: 206, pol: 74, dist: 48, ty: 11, tx: -1 },
        con: { az: 2, pol: 78, dist: 24, ty: y, tx: -6 },
        done: { az: 28, pol: 78, dist: 40, ty: 8, tx: 0 },
      };
      this.goal = Object.assign({}, P[name] || P.wide);
    },
    project(v) { const p = v.clone().project(this.cam), b = this.r.domElement.getBoundingClientRect(); return { x: b.left + (p.x + 1) / 2 * b.width, y: b.top + (1 - p.y) / 2 * b.height }; },
    screenOfItem(id) { const it = this.items[id]; it.g.updateMatrixWorld(true); return this.project(it.hit.getWorldPosition(V3())); },
    screenOfTarget(id) { const m = this.targetMeshes.find(t => t.userData.tid === id); return m ? this.project(m.position) : null; },
    tick() {
      const now = performance.now(), dt = Math.min(0.05, (now - this.clock) / 1000); this.clock = now;
      // 비행
      this.tweens = this.tweens.filter(t => {
        t.t += dt / t.dur; const k = Math.min(1, t.t), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        t.g.position.lerpVectors(t.p0, t.p1, e); t.g.position.y += Math.sin(Math.PI * k) * t.arc; t.g.rotation.y = t.r0 + (t.r1 - t.r0) * e;
        if (k >= 1) { t.g.position.copy(t.p1); t.g.rotation.y = t.r1; t.cb && t.cb(); return false; } return true;
      });
      // 집고 있는 물건은 살짝 들림
      Object.values(this.items).forEach(it => { if (!it.placed && !this.tweens.some(t => t.g === it.g)) { const ty = it.home.y + (this.heldId === it.id ? 0.9 : 0); it.g.position.y += (ty - it.g.position.y) * 0.25; } });
      // 박스 뚜껑
      const bx = this.items.box.g.userData; bx.p1.rotation.x += ((bx.open ? -2.2 : 0) - bx.p1.rotation.x) * 0.12; bx.p2.rotation.x += ((bx.open ? 2.2 : 0) - bx.p2.rotation.x) * 0.12;
      // 강조 상자
      const hv = this.hoverRef; if (hv && hv.obj && (hv.t === 'target' || (this.items[hv.id] && this.items[hv.id].g.visible))) { this.hbox.box.setFromObject(hv.obj); this.hbox.visible = true; } else this.hbox.visible = false;
      if (this.heldId) { this.kbox.box.setFromObject(this.items[this.heldId].g); this.kbox.visible = true; } else this.kbox.visible = false;
      const pulse = 0.3 + 0.18 * Math.sin(now / 260); this.targetMeshes.forEach(m => { m.material.opacity = pulse; });
      // 카메라
      const c = this.cs;
      if (this.goal) {
        let d = 0; ['az', 'pol', 'dist', 'ty', 'tx'].forEach(k => { let t = this.goal[k]; if (k === 'az') { t = c.az + (((t - c.az + 540) % 360) - 180); } const df = t - c[k]; c[k] += df * 0.09; d += Math.abs(df); });
        if (d < 0.05) this.goal = null;
      }
      const az = c.az * Math.PI / 180, pol = c.pol * Math.PI / 180;
      this.cam.position.set(c.tx + c.dist * Math.sin(pol) * Math.sin(az), c.ty + c.dist * Math.cos(pol), c.dist * Math.sin(pol) * Math.cos(az));
      this.cam.lookAt(c.tx, c.ty, 0);
      this.r.render(this.scene, this.cam);
    },
    resize() { const cv = this.r.domElement, p = cv.parentElement, w = p.clientWidth, h = p.clientHeight; if (!w || !h) return; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); },
  };
  Scene3D.consts = { U, W, DEP, TOTAL_U, yOf, uOf, ZF, ZR, PX };
  root.Scene3D = Scene3D;
})(window);
