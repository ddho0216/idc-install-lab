/* 서버실 월드와 장비 모델 (단위: 미터). 모양·배치·장비는 모두 제가 만든 가상 그림입니다. */
(function () {
  const G = window.G, T = G.T, U = G.U, V3 = G.V3, box = G.box, mat = G.mat;
  const RW = 0.6, RD = 1.0, ZC = -3.0, BASEY = 0.1, TOTALU = 42, EW = 0.482, FW = 1180;
  const W = G.W = { RW, RD, ZC, EW, ZF: ZC + RD / 2, ZR: ZC - RD / 2, RAILF: ZC + RD / 2 - 0.035, RAILR: ZC - RD / 2 + 0.035, RACKX: { R10: -1.3, R11: -0.65, R12: 0, R01: 0.65, R02: 1.3 }, TOTALU,
    yOfU: u => BASEY + (u - 1) * U + U / 2, uOfY: y => Math.round((y - BASEY - U / 2) / U) + 1, ROOM: { x0: -7, x1: 7, z0: -5.6, z1: 6.6, h: 3.2 } };
  const COL = { A: 0xd9654a, B: 0x4a8bd9, fiber: 0xe8c547 };
  W.COL = COL;
  const addCol = (x0, x1, z0, z1) => G.colliders.push({ x0, x1, z0, z1 });

  /* ---------- 방 ---------- */
  W.buildRoom = function () {
    const sc = G.scene, R = W.ROOM, w = R.x1 - R.x0, d = R.z1 - R.z0;
    const ft = G.tex(256, 256, (g, a, b) => { g.fillStyle = '#8f9aa4'; g.fillRect(0, 0, a, b); g.strokeStyle = '#78838d'; g.lineWidth = 6; g.strokeRect(0, 0, a, b); g.fillStyle = '#7f8a94'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(24 + i * 56, 24 + j * 56, 6, 6); }, [w / 0.6, d / 0.6]);
    const floor = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ map: ft, roughness: 0.85 })); floor.rotation.x = -Math.PI / 2; floor.position.set((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2); floor.receiveShadow = true; sc.add(floor);
    // 콜드/핫 아일 바닥 표시
    const decal = (z0, z1, color, x0, x1) => { const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2); sc.add(m); };
    decal(-2.4, 1.2, 0x2a78c8, -2.2, 2.2); decal(-5.4, -3.6, 0xc8553d, -2.2, 2.2);
    const lab = (t, c, x, z) => { const s = G.sprite(t, c, 2.3); s.material.depthWrite = false; const m = new T.Mesh(new T.PlaneGeometry(1.4, 0.26), new T.MeshBasicMaterial({ map: s.material.map, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); sc.add(m); };
    lab('콜드 아일 (전면 · 찬 공기)', '#1f5f9e', 0, -1.7); lab('핫 아일 (후면 · 더운 공기)', '#a8402a', 0, -4.7);
    // 안전선
    [[-2.6, -2.6, 0.02, 4.2], [2.6, 2.6, 0.02, 4.2]].forEach(l => { const m = new T.Mesh(new T.PlaneGeometry(0.06, l[3] - l[2]), new T.MeshBasicMaterial({ color: 0xf2c200 })); m.rotation.x = -Math.PI / 2; m.position.set(l[0], 0.005, (l[2] + l[3]) / 2); sc.add(m); });
    // 벽·천장
    const wm = mat(0xcfd6dc, 0.9), band = mat(0x9aa7b3, 0.8);
    const wall = (x, z, sx, sz) => { const m = box(sx, R.h, sz, 0xcdd5dc, 0.9); m.position.set(x, R.h / 2, z); m.castShadow = false; sc.add(m); const b = box(sx + 0.01, 0.9, sz + 0.01, 0x9aa7b3, 0.8); b.position.set(x, 0.45, z); b.castShadow = false; sc.add(b); };
    wall(0, R.z0 - 0.1, w + 0.4, 0.2); wall(0, R.z1 + 0.1, w + 0.4, 0.2); wall(R.x0 - 0.1, (R.z0 + R.z1) / 2, 0.2, d); wall(R.x1 + 0.1, (R.z0 + R.z1) / 2, 0.2, d);
    const ceil = box(w, 0.1, d, 0xdfe4e8, 0.9); ceil.position.set(0, R.h + 0.05, (R.z0 + R.z1) / 2); ceil.castShadow = false; sc.add(ceil);
    for (let i = -2; i <= 2; i++) for (let j = -1; j <= 2; j++) { const l = new T.Mesh(new T.BoxGeometry(1.2, 0.04, 0.35), new T.MeshBasicMaterial({ color: 0xffffff })); l.position.set(i * 2.6, R.h - 0.02, -3.6 + j * 2.8); sc.add(l); }
    addCol(R.x0 - 1, R.x0, R.z0 - 1, R.z1 + 1); addCol(R.x1, R.x1 + 1, R.z0 - 1, R.z1 + 1); addCol(R.x0 - 1, R.x1 + 1, R.z0 - 1, R.z0); addCol(R.x0 - 1, R.x1 + 1, R.z1, R.z1 + 1);
    // 문 + 비상구 표지
    const door = box(1.1, 2.1, 0.06, 0x56606a, 0.6, 0.3); door.position.set(0, 1.05, R.z1 - 0.02); sc.add(door);
    const ex = new T.Mesh(new T.PlaneGeometry(0.5, 0.16), new T.MeshBasicMaterial({ map: G.tex(256, 80, (g, a, b) => { g.fillStyle = '#1b9a5a'; g.fillRect(0, 0, a, b); g.fillStyle = '#fff'; g.font = '700 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', a / 2, b / 2 + 2); }) })); ex.position.set(0, 2.3, R.z1 - 0.05); ex.rotation.y = Math.PI; sc.add(ex);
    // 케이블 트레이 (랙 줄 위)
    const tray = box(3.6, 0.04, 0.35, 0x8a949e, 0.5, 0.6); tray.position.set(0.3, 2.35, ZC); sc.add(tray);
    [-1.3, 0.5, 1.8].forEach(x => { const h = box(0.02, 0.8, 0.02, 0x8a949e, 0.5, 0.6); h.position.set(x, 2.78, ZC); sc.add(h); });
    // 벽 포스터
    const poster = (x, z, ry, t1, t2) => { const m = new T.Mesh(new T.PlaneGeometry(1.1, 0.7), new T.MeshBasicMaterial({ map: G.tex(440, 280, (g, a, b) => { g.fillStyle = '#fff'; g.fillRect(0, 0, a, b); g.fillStyle = '#e0a030'; g.fillRect(0, 0, a, 36); g.fillStyle = '#222'; g.font = '700 30px sans-serif'; g.fillText(t1, 18, 90); g.font = '500 22px sans-serif'; t2.forEach((l, i) => g.fillText(l, 18, 140 + i * 34)); }) })); m.position.set(x, 1.7, z); m.rotation.y = ry; sc.add(m); };
    poster(R.x0 + 0.02, 0.2, Math.PI / 2, '작업 전 확인', ['• 장비·시리얼 대조', '• 전원은 A/B 분리', '• 케이블은 라벨 부착', '• 정리 후 사진 기록']);
    poster(R.x1 - 0.02, 0.2, -Math.PI / 2, '전력 기준', ['• 정격의 80%까지만', '• 한쪽 장애 시 기준으로', '• A/B 평소엔 반반']);
  };

  /* ---------- 랙 ---------- */
  const railTex = G.tex(32, TOTALU * 16, (g, w, h) => { g.fillStyle = '#8a949e'; g.fillRect(0, 0, w, h); for (let u = 1; u <= TOTALU; u++) { const y = h - u * 16; g.fillStyle = '#2a3138'; [3, 7, 11].forEach(k => g.fillRect(12, y + k, 8, 2)); g.fillStyle = '#5b6670'; g.fillRect(0, y, w, 1); } });
  W.makeRack = function (name, x, o) {
    o = o || {}; const g = new T.Group(); g.position.set(x, 0, ZC); G.scene.add(g);
    const H = BASEY + TOTALU * U + 0.04, post = mat(0x3d4852, 0.5, 0.4);
    const bs = box(RW, BASEY, RD, 0x252b31); bs.position.y = BASEY / 2; g.add(bs); const tp = box(RW, 0.04, RD, 0x252b31); tp.position.y = H - 0.02; g.add(tp);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(p => { const m = new T.Mesh(new T.BoxGeometry(0.035, H - BASEY - 0.04, 0.035), post); m.castShadow = true; m.position.set(p[0] * (RW / 2 - 0.02), BASEY + (H - BASEY - 0.04) / 2, p[1] * (RD / 2 - 0.02)); g.add(m); });
    [-1, 1].forEach(sx => { const s = box(0.012, H - BASEY - 0.04, RD - 0.02, 0xb7c0c8, 0.6); s.position.set(sx * (RW / 2 - 0.006), BASEY + (H - BASEY - 0.04) / 2, 0); g.add(s); });
    [[RD / 2 - 0.036, 0], [-RD / 2 + 0.036, Math.PI]].forEach(([z, ry]) => [-1, 1].forEach(sx => { const p = new T.Mesh(new T.PlaneGeometry(0.03, TOTALU * U), new T.MeshBasicMaterial({ map: railTex })); p.position.set(sx * (EW / 2 + 0.014), BASEY + TOTALU * U / 2, z); p.rotation.y = ry; g.add(p); }));
    const nm = G.sprite(name, '#222', 1.0, 'rgba(255,255,255,.9)'); nm.position.set(0, H + 0.14, RD / 2); g.add(nm);
    if (o.ticks) [1, 10, 20, 30, 40].forEach(u => { const s = G.sprite('U' + u, '#333', 0.32, 'rgba(255,255,255,.85)'); s.position.set(-RW / 2 - 0.1, W.yOfU(u), RD / 2); g.add(s); });
    const doorH = H - BASEY - 0.04, dtex = W.doorTex || (W.doorTex = G.tex(128, 256, (c, w, h) => { c.fillStyle = '#262e36'; c.fillRect(0, 0, w, h); c.fillStyle = '#0d1115'; for (let yy = 6; yy < h; yy += 8) for (let xx = 6; xx < w; xx += 8) { c.beginPath(); c.arc(xx, yy, 2.2, 0, 7); c.fill(); } c.strokeStyle = '#3d4852'; c.lineWidth = 6; c.strokeRect(2, 2, w - 4, h - 4); }));
    const mkDoor = (zf, hs, ang) => { const gr = new T.Group(); gr.position.set(hs * (RW / 2 - 0.012), BASEY + doorH / 2 + 0.02, zf); const m = new T.Mesh(new T.BoxGeometry(RW - 0.026, doorH, 0.02), new T.MeshStandardMaterial({ map: dtex, roughness: 0.6, metalness: 0.3 })); m.position.x = -hs * (RW / 2 - 0.013); m.castShadow = true; gr.add(m); const hd = box(0.014, 0.18, 0.024, 0xb0b8c0, 0.3, 0.8); hd.position.set(-hs * (RW - 0.07), 0, 0); gr.add(hd); gr.rotation.y = ang; g.add(gr); };
    if (o.doorF) mkDoor(RD / 2 + 0.012, -1, o.doorF === 'open' ? -1.9 : 0); if (o.doorR) mkDoor(-RD / 2 + 0.012, 1, 0);
    addCol(x - RW / 2, x + RW / 2, ZC - RD / 2, ZC + RD / 2); g.userData.name = name; return g;
  };

  /* ---------- 장비 얼굴 텍스처 ---------- */
  const led = (g, x, y, on, c) => { g.fillStyle = on ? (c || '#2fbf71') : '#555d65'; g.fillRect(x, y, 14, 7); };
  const PORT = { psu1: [135, 56], psu2: [375, 56], nic1: [640, 50], nic2: [698, 50], mgmt: [768, 50], con: [616, 52], t1: [1070, 45], t2: [1140, 45] };
  W.PORT = PORT;
  W.faceTex = {
    serverFront(label, serial) { return G.tex(FW, 100, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3c454e'); gr.addColorStop(1, '#222930'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#14191e'; g.fillRect(0, 0, 64, h); g.fillRect(w - 64, 0, 64, h); g.fillStyle = '#59626b'; [22, 78].forEach(y => { g.beginPath(); g.arc(32, y, 6, 0, 7); g.fill(); g.beginPath(); g.arc(w - 32, y, 6, 0, 7); g.fill(); });
      for (let i = 0; i < 4; i++) { const x = 100 + i * 212; g.fillStyle = '#10151a'; g.fillRect(x, 10, 198, 80); g.fillStyle = '#2c353e'; g.fillRect(x + 4, 14, 190, 72); g.fillStyle = '#3a444e'; for (let k = 0; k < 7; k++) g.fillRect(x + 14, 22 + k * 9, 146, 3);
        g.fillStyle = '#59626b'; g.fillRect(x + 168, 26, 20, 48); g.fillStyle = '#252c33'; g.fillRect(x + 172, 32, 12, 36); g.fillStyle = '#3ecf8e'; g.fillRect(x + 10, 78, 8, 5); g.fillStyle = i === 2 ? '#e0a030' : '#2e363f'; g.fillRect(x + 22, 78, 8, 5); g.fillStyle = '#8a96a1'; g.font = '700 11px sans-serif'; g.fillText('HDD ' + i, x + 140, 85); }
      g.fillStyle = '#d9dde1'; g.fillRect(950, 14, 100, 72); g.fillStyle = '#3ecf8e'; g.beginPath(); g.arc(984, 46, 15, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#2b9bd9'; g.beginPath(); g.arc(1026, 30, 5, 0, 7); g.fill(); g.fillStyle = '#e0a030'; g.beginPath(); g.arc(1026, 50, 5, 0, 7); g.fill(); g.fillStyle = '#14191e'; g.fillRect(958, 72, 24, 9); g.fillRect(990, 72, 24, 9);
      g.fillStyle = '#f2f2ee'; g.fillRect(1058, 22, 52, 56); g.fillStyle = '#222'; g.font = '700 9px sans-serif'; g.fillText((label || '').slice(0, 11), 1061, 36); g.font = '8px sans-serif'; g.fillText('S/N', 1061, 52); g.fillText((serial || '').slice(0, 11), 1061, 63); }); },
    serverRear(st) { return G.tex(FW, 100, (g, w, h) => { g.fillStyle = '#c9d0d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#e0a030'; g.fillRect(0, 0, w, 3);
      [PORT.psu1[0], PORT.psu2[0]].forEach((cx, i) => { g.fillStyle = '#aeb6be'; g.fillRect(cx - 105, 16, 210, 70); g.fillStyle = st.cord && st.cord[i] ? '#d9654a' : '#20262b'; g.fillRect(cx - 28, 34, 56, 36); g.fillStyle = '#6a737d'; g.fillRect(cx - 18, 40, 6, 14); g.fillRect(cx + 12, 40, 6, 14); led(g, cx + 70, 22, st.power && st.cord && st.cord[i], '#2fbf71'); });
      g.fillStyle = '#56606a'; g.font = '700 14px sans-serif'; g.fillText('PSU1', 40, 12); g.fillText('PSU2', 280, 12); g.fillText('NIC1', 624, 12); g.fillText('NIC2', 682, 12); g.fillText('MGMT', 750, 12);
      [PORT.nic1[0], PORT.nic2[0], PORT.mgmt[0]].forEach((cx, i) => { g.fillStyle = '#20262b'; g.fillRect(cx - 22, 30, 44, 34); g.fillStyle = '#586068'; g.fillRect(cx - 17, 34, 34, 22); led(g, cx - 8, 70, st.nic && st.nic[i], '#2fbf71'); });
      for (let i = 0; i < 4; i++) { g.fillStyle = '#9aa3ab'; g.beginPath(); g.arc(880 + i * 60, 52, 22, 0, 7); g.fill(); g.fillStyle = '#4a525a'; g.beginPath(); g.arc(880 + i * 60, 52, 7, 0, 7); g.fill(); }
      g.fillStyle = '#f2f2ee'; g.fillRect(490, 22, 100, 56); g.fillStyle = '#222'; g.font = '700 11px sans-serif'; g.textBaseline = 'alphabetic'; g.fillText('S/N', 496, 40); g.fillText((st.serial || '').slice(0, 12), 496, 56); g.font = '9px sans-serif'; g.fillText('MADE FOR SIM', 496, 70); }); },
    switchRear(st) { return G.tex(FW, 100, (g, w, h) => { g.fillStyle = '#d6dce2'; g.fillRect(0, 0, w, h); g.fillStyle = '#e0a030'; g.fillRect(0, 0, w, 4); g.fillStyle = '#56606a'; g.font = '700 14px sans-serif'; g.textBaseline = 'top';
      g.fillText('PSU1', 30, 6); g.fillText('PSU2', 270, 6); g.fillText('FAN', 470, 6); g.fillText('CON', 604, 80); g.fillText('GE 1-48', 660, 6); g.fillText('T1', 1062, 6); g.fillText('T2', 1132, 6);
      [PORT.psu1[0], PORT.psu2[0]].forEach((cx, i) => { g.fillStyle = '#b2bac2'; g.fillRect(cx - 105, 22, 210, 70); g.fillStyle = st.cord && st.cord[i] ? '#d9654a' : '#2a3036'; g.fillRect(cx - 28, 40, 56, 34); g.fillStyle = '#6a737d'; g.fillRect(cx - 18, 46, 6, 14); g.fillRect(cx + 12, 46, 6, 14); led(g, cx + 76, 28, st.power && st.cord && st.cord[i], '#2fbf71'); });
      for (let i = 0; i < 3; i++) { g.fillStyle = '#9aa3ab'; g.beginPath(); g.arc(510 + i * 30, 58, 11, 0, 7); g.fill(); g.fillStyle = '#4a525a'; g.beginPath(); g.arc(510 + i * 30, 58, 4, 0, 7); g.fill(); }
      g.fillStyle = st.con ? '#4fa3d9' : '#20262b'; g.fillRect(606, 40, 20, 24);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 24; c++) { const x = 660 + c * 16.2, y = 28 + r * 31; g.fillStyle = '#20262b'; g.fillRect(x, y, 12, 22); g.fillStyle = '#4a525a'; g.fillRect(x + 2, y + 3, 8, 3); }
      [PORT.t1[0], PORT.t2[0]].forEach((cx, i) => { g.fillStyle = '#20262b'; g.fillRect(cx - 14, 30, 28, 30); g.fillStyle = '#586068'; g.fillRect(cx - 10, 34, 20, 22); g.fillStyle = st.up && st.up[i] ? '#2fbf71' : (st.upBad && st.upBad[i] ? '#d9654a' : '#4a525a'); g.fillRect(cx - 8, 66, 16, 8); });
      g.fillStyle = st.sys === 'ok' ? '#2fbf71' : st.sys === 'boot' ? '#e0a030' : '#8a929b'; g.beginPath(); g.arc(590, 20, 5, 0, 7); g.fill(); }); },
    switchFront(serial) { return G.tex(FW, 100, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#cdd3d9'); gr.addColorStop(1, '#aeb6be'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#e0a030'; g.fillRect(0, 0, w, 4);
      g.fillStyle = '#8f98a1'; g.fillRect(0, 0, 64, h); g.fillRect(w - 64, 0, 64, h); g.fillStyle = '#59626b'; [24, 76].forEach(y => { g.beginPath(); g.arc(32, y, 6, 0, 7); g.fill(); g.beginPath(); g.arc(w - 32, y, 6, 0, 7); g.fill(); });
      g.fillStyle = '#5b646d'; g.fillRect(80, 30, 70, 40); g.fillStyle = '#9aa3ab'; g.fillRect(86, 36, 58, 28); g.fillStyle = '#5b646d'; g.fillRect(w - 150, 30, 70, 40); g.fillStyle = '#9aa3ab'; g.fillRect(w - 144, 36, 58, 28);
      g.fillStyle = '#98a1aa'; for (let r = 0; r < 3; r++) for (let i = 0; i < 40; i++) g.fillRect(200 + i * 19, 22 + r * 18, 9, 10);
      g.fillStyle = 'rgba(25,32,38,.8)'; g.font = '700 22px sans-serif'; g.textBaseline = 'middle'; g.fillText('NX-4824T  ·  흡기면 (포트 반대면)', 200, 84); g.fillStyle = '#f2f2ee'; g.fillRect(950, 18, 150, 38); g.fillStyle = '#222'; g.font = '700 13px sans-serif'; g.fillText('S/N ' + (serial || ''), 958, 38); }); },
    fill(label, kind) { return G.tex(FW, 100, (g, w, h) => { g.fillStyle = '#2b323a'; g.fillRect(0, 0, w, h); g.fillStyle = kind === 'sw' ? '#1d242b' : '#2b323a'; g.fillRect(0, 0, w, h); if (kind === 'sw') { for (let i = 0; i < 24; i++) { g.fillStyle = '#0f1318'; g.fillRect(520 + i * 24, 30, 16, 24); g.fillStyle = i < 14 ? '#2fbf71' : '#4a525a'; g.fillRect(523 + i * 24, 58, 10, 5); } g.fillStyle = '#4fc3d9'; g.fillRect(0, 0, w, 3); } else { g.fillStyle = '#10151a'; for (let i = 0; i < 4; i++) g.fillRect(110 + i * 215, 12, 195, 76); g.fillStyle = '#3ecf8e'; g.fillRect(40, 44, 10, 8); }
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '700 24px sans-serif'; g.textBaseline = 'middle'; g.fillText(label, 90, 50); }); },
  };

  /* ---------- 장비(서버/스위치) ---------- */
  // 로컬 +z = 전면, -z = 후면(포트·전원). 랙 앞에서 후면부터 밀어 넣으면 후면이 핫 아일(-z)을 향함.
  W.makeDevice = function (type, o) {
    o = o || {}; const D = type === 'server' ? 0.62 : 0.44, H = U * 0.92, g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(EW, H, D), mat(type === 'server' ? 0x4a525a : 0x9aa3ab, 0.55, 0.3)); body.castShadow = true; body.receiveShadow = true; g.add(body);
    const st = { serial: o.serial || '', cord: [false, false], power: false, nic: [false, false, false], up: [false, false], upBad: [false, false], con: false, sys: 'off' };
    const frontT = type === 'server' ? W.faceTex.serverFront(o.label || 'SRV-NEW-01', o.serial) : W.faceTex.switchFront(o.serial);
    const front = new T.Mesh(new T.PlaneGeometry(EW, H), new T.MeshBasicMaterial({ map: frontT })); front.position.z = D / 2 + 0.002; g.add(front);
    const rear = new T.Mesh(new T.PlaneGeometry(EW, H), new T.MeshBasicMaterial({ map: type === 'server' ? W.faceTex.serverRear(st) : W.faceTex.switchRear(st) })); rear.position.z = -D / 2 - 0.002; rear.rotation.y = Math.PI; g.add(rear);
    [-1, 1].forEach(sx => { const e = box(0.03, H, 0.006, 0x6f7983, 0.4, 0.6); e.position.set(sx * (EW / 2 + 0.015), 0, D / 2 - 0.003); g.add(e); [-0.011, 0.011].forEach(yy => { const h = new T.Mesh(new T.CylinderGeometry(0.0035, 0.0035, 0.002, 10), mat(0x20262b)); h.rotation.x = Math.PI / 2; h.position.set(sx * (EW / 2 + 0.015), yy, D / 2 + 0.001); g.add(h); }); });
    const dev = { type, g, D, H, st, rear, front, refresh() { const old = rear.material.map; rear.material.map = type === 'server' ? W.faceTex.serverRear(st) : W.faceTex.switchRear(st); rear.material.needsUpdate = true; old && old.dispose(); },
      port(name) { const p = PORT[name]; g.updateMatrixWorld(true); return g.localToWorld(V3(-(p[0] / FW - 0.5) * EW, (0.5 - p[1] / 100) * H, -D / 2 - 0.004)); } };
    return dev;
  };

  /* ---------- 물건(집을 수 있는) ---------- */
  W.makeItem = function (id, label, g, hitSize, o) {
    o = o || {}; const hit = new T.Mesh(new T.BoxGeometry(hitSize[0], hitSize[1], hitSize[2]), new T.MeshBasicMaterial({ visible: false })); hit.position.set(hitSize[3] || 0, hitSize[4] || 0, hitSize[5] || 0); g.add(hit);
    const it = Object.assign({ id, label, g, hit, enabled: true, held: false, home: { p: g.position.clone(), r: g.rotation.y }, scale0: 1 }, o); G.items[id] = it; G.addPickable(it, hit); G.scene.add(g); return it;
  };
  W.coil = function (id, label, color, tint, pos, o) {
    const g = new T.Group(), R = 0.055;
    [0, 1, 2].forEach(i => { const t = new T.Mesh(new T.TorusGeometry(R - i * 0.008, 0.007, 8, 24), mat(color, 0.6)); t.rotation.x = Math.PI / 2; t.position.y = 0.008 + i * 0.012; t.castShadow = true; g.add(t); });
    [-0.07, 0.07].forEach(px => { const pl = box(0.025, 0.018, 0.034, tint, 0.5); pl.position.set(px, 0.012, 0); g.add(pl); });
    g.position.copy(pos); const it = W.makeItem(id, label, g, [0.2, 0.07, 0.14, 0, 0.03, 0], Object.assign({ holdT: { p: [0.24, -0.2, -0.5], r: [0.3, -0.3, 0.1], s: 2.2 }, scale0: 1 }, o || {})); return it;
  };
  W.makePdu = function (id, rating, pos) {
    const g = new T.Group(), body = box(0.05, 1.45, 0.05, 0x2a3036, 0.6); body.position.y = 0.78; g.add(body);
    const stripe = box(0.052, 1.45, 0.006, 0x8a929b); stripe.position.set(0, 0.78, -0.027); g.add(stripe);
    for (let k = 0; k < 12; k++) { const o = box(0.03, 0.045, 0.01, 0x6a737d); o.position.set(0, 1.42 - k * 0.105 - 0.05, -0.03); g.add(o); }
    const lcdT = G.tex(128, 64, (c, w, h) => { c.fillStyle = '#10161b'; c.fillRect(0, 0, w, h); c.fillStyle = '#7fe3a1'; c.font = '700 30px monospace'; c.fillText('00.0A', 10, 30); c.fillStyle = '#e0a030'; c.font = '14px sans-serif'; c.fillText(rating + 'A PDU', 10, 54); });
    const lcd = new T.Mesh(new T.PlaneGeometry(0.044, 0.022), new T.MeshBasicMaterial({ map: lcdT })); lcd.position.set(0, 1.5, -0.0305); lcd.rotation.y = Math.PI; g.add(lcd);
    const lb = G.sprite(rating + 'A', '#1b2127', 0.5, 'rgba(255,255,255,.92)'); lb.position.set(0, 1.62, 0); g.add(lb); g.position.copy(pos);
    const it = W.makeItem(id, 'PDU ' + rating + 'A', g, [0.2, 1.5, 0.2, 0, 0.8, 0], { rating, kind: 'pdu', holdT: { p: [0.3, -0.38, -0.62], r: [0, 0.2, -1.05], s: 0.5 }, lcd, lcdT });
    it.setLcd = amp => { const c = lcdT.image.getContext('2d'); c.fillStyle = '#10161b'; c.fillRect(0, 0, 128, 64); c.fillStyle = amp > it.crit ? '#ff6b57' : amp > it.warn ? '#ffd24a' : '#7fe3a1'; c.font = '700 30px monospace'; c.fillText(amp.toFixed(1).padStart(4, '0') + 'A', 10, 30); c.fillStyle = '#e0a030'; c.font = '14px sans-serif'; c.fillText(rating + 'A  W' + (it.warn || '--') + ' C' + (it.crit || '--'), 6, 54); lcdT.needsUpdate = true; };
    return it;
  };
  W.makeRails = function (pos) {
    const g = new T.Group(); [-0.05, 0.05].forEach(x => { const r = box(0.012, 0.02, 0.5, 0x8a949e, 0.4, 0.6); r.position.set(x, 0.012, 0); g.add(r); const f = box(0.03, 0.002, 0.5, 0x8a949e, 0.4, 0.6); f.position.set(x, 0.002, 0); g.add(f); });
    g.position.copy(pos); return W.makeItem('rails', '레일 킷', g, [0.2, 0.08, 0.56, 0, 0.02, 0], { holdT: { p: [0.26, -0.22, -0.55], r: [0, 0.5, 0], s: 1.2 } });
  };

  /* ---------- 작업대·보관대·소품 ---------- */
  W.buildProps = function () {
    const sc = G.scene;
    const table = (x, z, w, d, name) => { const g = new T.Group(); g.position.set(x, 0, z); const top = box(w, 0.04, d, 0xcdb895, 0.8); top.position.y = 0.78; g.add(top); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => { const l = box(0.04, 0.76, 0.04, 0x59626b, 0.5, 0.3); l.position.set(p[0] * (w / 2 - 0.05), 0.38, p[1] * (d / 2 - 0.05)); g.add(l); }); sc.add(g); addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2); if (name) { const s = G.sprite(name, '#222', 0.9, 'rgba(255,255,255,.9)'); s.position.set(0, 1.55, 0); g.add(s); } return g; };
    W.table = table(-4.6, -0.8, 2.6, 1.0, '작업대');
    // PDU 보관대(선반)
    const cart = new T.Group(); cart.position.set(-6.1, 0, -3.6); const bs = box(1.2, 0.08, 0.5, 0x59626b, 0.5, 0.3); bs.position.y = 0.06; cart.add(bs);
    [-0.58, 0.58].forEach(x => { const p = box(0.04, 1.7, 0.04, 0x59626b, 0.5, 0.3); p.position.set(x, 0.85, 0); cart.add(p); }); const tb = box(1.2, 0.03, 0.5, 0x59626b, 0.5, 0.3); tb.position.y = 1.7; cart.add(tb);
    const cl = G.sprite('PDU 보관대', '#222', 0.9, 'rgba(255,255,255,.9)'); cl.position.set(0, 2.05, 0); cart.add(cl); sc.add(cart); addCol(-6.7, -5.5, -3.9, -3.3);
    // 감독관 데스크(작업지시서)
    // 관제 PC 책상
    W.desk = table(5.0, 1.2, 1.6, 0.8, '관제 PC');
    const mon = new T.Group(); mon.position.set(5.0, 0.8, 1.35); mon.add(box(0.5, 0.3, 0.02, 0x1b2127)); mon.children[0].position.y = 0.2; const scr = new T.Mesh(new T.PlaneGeometry(0.46, 0.26), new T.MeshBasicMaterial({ map: G.tex(256, 150, (g, w, h) => { g.fillStyle = '#0d1a22'; g.fillRect(0, 0, w, h); g.fillStyle = '#4fc3d9'; g.font = '14px monospace'; g.fillText('NOC  관제 시스템', 12, 24); g.fillStyle = '#2fbf71'; for (let i = 0; i < 8; i++) g.fillRect(12, 40 + i * 12, 40 + i * 14, 6); }) })); scr.position.set(0, 0.2, -0.011); scr.rotation.y = Math.PI; mon.add(scr); sc.add(mon); W.monitor = mon;
    // 서버실 장식: 소화기, 쓰레기통
    const ext = box(0.12, 0.45, 0.12, 0xc8402a, 0.5); ext.position.set(-6.7, 0.25, 4.5); sc.add(ext);
    // 감독관 NPC
    W.buildNpc(); W.buildExtras();
  };
  W.buildNpc = function () {
    const g = new T.Group(); g.position.set(-2.6, 0, 3.2); G.scene.add(g); W.npc = g;
    const body = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 0.72, 16), mat(0x2f4a63, 0.8)); body.position.y = 1.0; body.castShadow = true; g.add(body);
    const vest = new T.Mesh(new T.CylinderGeometry(0.205, 0.245, 0.5, 16, 1, true), new T.MeshStandardMaterial({ color: 0xf08a1c, roughness: 0.6, side: T.DoubleSide })); vest.position.y = 1.08; g.add(vest);
    const stripe = new T.Mesh(new T.CylinderGeometry(0.21, 0.25, 0.04, 16, 1, true), new T.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.4, side: T.DoubleSide })); stripe.position.y = 1.02; g.add(stripe);
    [-1, 1].forEach(s => { const leg = box(0.12, 0.64, 0.14, 0x2a2f36, 0.7); leg.position.set(s * 0.09, 0.32, 0); g.add(leg); const arm = box(0.08, 0.5, 0.08, 0x2f4a63, 0.8); arm.position.set(s * 0.28, 1.05, 0.05); arm.rotation.z = s * 0.12; g.add(arm); });
    const head = new T.Mesh(new T.SphereGeometry(0.15, 20, 16), mat(0xe9b99a, 0.7)); head.position.y = 1.6; head.castShadow = true; g.add(head);
    const hat = new T.Mesh(new T.SphereGeometry(0.17, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf2c200, 0.5)); hat.position.y = 1.64; g.add(hat); const brim = box(0.36, 0.015, 0.3, 0xf2c200, 0.5); brim.position.set(0, 1.645, 0.04); g.add(brim);
    const board = box(0.22, 0.3, 0.015, 0xb48b52, 0.8); board.position.set(0.22, 1.1, 0.2); board.rotation.x = -0.3; g.add(board);
    const nm = G.sprite('감독관', '#222', 0.8, 'rgba(255,255,255,.92)'); nm.position.y = 1.98; g.add(nm);
    const hit = new T.Mesh(new T.BoxGeometry(0.7, 1.9, 0.6), new T.MeshBasicMaterial({ visible: false })); hit.position.y = 0.95; g.add(hit); W.npcHit = hit; W.npcHead = head;
    addCol(-2.9, -2.3, 2.9, 3.5);
  };
  W.buildExtras = function () {
    const sc = G.scene, R = W.ROOM;
    const clock = new T.Mesh(new T.CircleGeometry(0.22, 32), new T.MeshBasicMaterial({ map: G.tex(256, 256, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 8; g.stroke(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104); g.lineTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); g.stroke(); } g.lineWidth = 10; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 62); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(128, 128); g.lineTo(186, 150); g.stroke(); }) }));
    clock.position.set(R.x0 + 0.03, 2.4, -1.6); clock.rotation.y = Math.PI / 2; sc.add(clock);
    const wb = new T.Mesh(new T.PlaneGeometry(1.7, 0.95), new T.MeshBasicMaterial({ map: G.tex(680, 380, (g, w, h) => { g.fillStyle = '#f8f9fa'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a949e'; g.lineWidth = 10; g.strokeRect(0, 0, w, h); g.fillStyle = '#1f5fbf'; g.font = '700 34px sans-serif'; g.fillText('오늘의 작업 · R12 랙', 28, 56); g.fillStyle = '#333'; g.font = '500 26px sans-serif'; ['09:00 입고 확인', '10:00 PDU / 레일 설치', '13:00 장비 장착·배선', '16:00 관제 연동 확인', '17:00 티켓 마감'].forEach((t, i) => g.fillText('• ' + t, 28, 110 + i * 46)); g.fillStyle = '#c23a26'; g.font = '700 24px sans-serif'; g.fillText('※ 전원은 반드시 A/B 분리', 28, 350); }) }));
    wb.position.set(R.x1 - 0.03, 1.6, -2.4); wb.rotation.y = -Math.PI / 2; sc.add(wb);
    const tool = new T.Group(); tool.position.set(-5.5, 0, 0.5); const tb = box(0.5, 0.22, 0.24, 0xc23a26, 0.5); tb.position.y = 0.11; tool.add(tb); const tl = box(0.5, 0.03, 0.26, 0x8a1f10, 0.5); tl.position.y = 0.235; tool.add(tl); const th = box(0.3, 0.03, 0.03, 0x2a2f36, 0.4, 0.5); th.position.y = 0.29; tool.add(th); [-0.2, 0.2].forEach(x => { const lt = box(0.04, 0.04, 0.03, 0xb0b8c0, 0.3, 0.8); lt.position.set(x, 0.2, 0.135); tool.add(lt); }); sc.add(tool);
    const bin = new T.Mesh(new T.CylinderGeometry(0.17, 0.14, 0.42, 20), mat(0x2f6f4a, 0.7)); bin.position.set(1.3, 0.21, 6.2); bin.castShadow = true; sc.add(bin);
    const lad = new T.Group(); lad.position.set(R.x1 - 0.25, 0, -4.6); lad.rotation.z = -0.12; [-0.2, 0.2].forEach(x => { const r = box(0.04, 2.0, 0.04, 0xd9a21e, 0.5, 0.4); r.position.set(x, 1.0, 0); lad.add(r); }); for (let i = 0; i < 7; i++) { const rg = box(0.4, 0.03, 0.04, 0xd9a21e, 0.5, 0.4); rg.position.set(0, 0.25 + i * 0.27, 0); lad.add(rg); } sc.add(lad);
    const es = new T.Group(); es.position.set(-1.0, 1.25, R.z1 - 0.06); es.add(box(0.2, 0.2, 0.08, 0xf2c200, 0.6)); const bt = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.05, 16), mat(0xc23a26, 0.4)); bt.rotation.x = Math.PI / 2; bt.position.z = 0.06; es.add(bt); const el = G.sprite('비상 정지', '#222', 0.45, 'rgba(255,255,255,.9)'); el.position.y = 0.2; es.add(el); sc.add(es);
    const perf = G.tex(64, 64, (g, w, h) => { g.fillStyle = '#9aa7b2'; g.fillRect(0, 0, w, h); g.fillStyle = '#4b5964'; for (let y = 6; y < h; y += 8) for (let x = 6; x < w; x += 8) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); } });
    [-0.65, 0, 0.65].forEach(x => { const t = new T.Mesh(new T.PlaneGeometry(0.58, 0.58), new T.MeshStandardMaterial({ map: perf, roughness: 0.8 })); t.rotation.x = -Math.PI / 2; t.position.set(x, 0.007, -1.85); t.receiveShadow = true; sc.add(t); });
  };
  W.npcLook = function () { const n = W.npc; if (!n) return; const a = Math.atan2(G.pos.x - n.position.x, G.pos.z - n.position.z); n.rotation.y += (((a - n.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.06; };
})();
