/* 레벨 규칙: 작업 구성, 상호작용, 감독관 검수, 점수. 모든 장비·값은 제가 만든 가상 데이터입니다. */
(function () {
  const G = window.G, W = G.W, T = G.T, U = G.U, V3 = G.V3, $ = G.$, box = G.box, mat = G.mat, COL = W.COL;
  const EW = W.EW, ZF = W.ZF, ZR = W.ZR, ZC = W.ZC;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const S = G.S = { pdus: {}, occ: {}, conn: [], fiber: { 1: {}, 2: {} }, flags: {}, cords: {} };
  const VOLT = 220, SERVER_W = 450, SW_W = 150;
  const LV = {
    1: { name: '1레벨 · 서버 설치', device: 'server', label: '서버', serial: 'FOC2547A1BQ', loadW: 8 * SERVER_W, desc: '1U 서버 1대 (SRV-NEW-01)' },
    2: { name: '2레벨 · 스위치 설치', device: 'switch', label: '스위치', serial: 'FOC2547A1BQ', loadW: 8 * SERVER_W + SW_W, desc: '48포트 스위치 1대 (SW-BD-R12-01)' },
  };

  /* ================= UI ================= */
  const UI = G.UI = { act: {} };
  UI.open = (html, o) => { o = o || {}; const m = $('#modal'); m.innerHTML = '<div class="card ' + (o.cls || '') + '">' + html + '</div>'; m.hidden = false; G.setModal(true); G.onEsc = o.noEsc ? null : UI.close; UI.onClose = o.onClose || null; };
  UI.close = () => { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; G.setModal(false); G.onEsc = null; const f = UI.onClose; UI.onClose = null; f && f(); };
  document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el) return; const f = UI.act[el.dataset.a]; if (f) f(el, e); });
  UI.dialog = (who, lines, buttons, o) => UI.open('<div class="dlg"><div class="face">' + who + '</div><div>' + lines.map(l => '<p>' + l + '</p>').join('') + '</div></div><div class="row">' + buttons.map(b => '<button class="btn' + (b.g ? ' ghost' : '') + '" data-a="' + b.a + '">' + b.t + '</button>').join('') + '</div>', o);

  /* ================= 상태 도우미 ================= */
  const loadA = () => LV[S.n].loadW / VOLT;
  const occupied = (u, kind) => S.occ[u] && (kind ? S.occ[u] === kind : true);
  const uFromHit = (f, h) => { let u = Math.max(1, Math.min(42, W.uOfY(f.hit.point.y))); if (h && h.type === 'device' && S.rails && S.occ[S.rails.u] === 'rails' && Math.abs(u - S.rails.u) <= 1) u = S.rails.u; return u; };
  const popIn = (m, delay) => { m.scale.setScalar(0.01); G.after(delay || 0, () => G.anim(0.25, k => m.scale.setScalar(Math.max(0.01, k * (2 - k))), null, null)); };
  const screw = (pos, dirZ, delay, parent) => { const m = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.005, 10), mat(0xd9dde1, 0.3, 0.8)); m.rotation.x = Math.PI / 2; m.position.copy(pos); m.position.z += dirZ * 0.002; (parent || G.scene).add(m); G.hw.push(m); popIn(m, delay); G.after(delay || 0, () => G.sfx('screw')); return m; };
  const flushSlot = (pos, size, def) => { const m = G.slotMesh(size[0], size[1], size[2]); m.position.copy(pos); G.scene.add(m); return G.addSlot(m, def); };

  /* ================= 레벨 시작 ================= */
  G.startLevel = function (n) {
    Object.assign(S, { n, lv: LV[n], t0: Date.now(), fails: 0, hints: 0, insp: 0, done: false, recvSubmitted: false, boxOpen: false, rails: null, devMount: null, flags: {}, console: false, conn: [], cords: {}, pdus: {}, occ: {}, mon: { reg: false, ok: false }, cliLog: [], hist: [], hi: 0 });
    S.scen = pick(['clean', 'serial', 'missing', 'damaged']); S.polBad = pick([[true, false], [false, true], [false, false]]); G.flip = Math.random() < 0.5;
    W.buildRoom(); Object.keys(W.RACKX).forEach(k => W.makeRack(k, W.RACKX[k], { ticks: k === 'R12', doorF: k === 'R12' || k === 'R01' ? 'open' : 'closed', doorR: k === 'R12' || k === 'R01' ? null : 'closed' })); W.buildProps();
    buildRackSlot(); buildBox(); buildTableStuff(); buildDecor();
    if (n === 1) buildCart(); else { buildPreinstalled(); }
    buildInteractives(); renderQuick();
    G.addUse(W.npcHit, { prompt: '감독관과 이야기', run: supervisorMenu });
    G.onTab = showOrder; G.onHelp = showHelp; G.onFrame = frame; G.onGuide = () => { S.guideMin = !S.guideMin; S.gsig = ''; };
    $('#lvname').textContent = S.lv.name; $('#hud').hidden = false; $('#start').hidden = true; G.running = true;
    G.pos.set(0, 0, 5.3); G.yaw = 0; G.pitch = -0.05;
    intro();
  };
  function frame() { W.npcLook(); const ms = Date.now() - S.t0, m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; if (!S.done) $('#timer').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); $('#mis').textContent = '검수 불합격 ' + S.fails; if (!S.gt || ms - S.gt > 250) { S.gt = ms; renderGuide(); } }

  /* ================= 월드 구성 ================= */
  function buildRackSlot() {
    const m = new T.Mesh(new T.PlaneGeometry(0.5, 1.9), new T.MeshBasicMaterial({ visible: false })); m.position.set(0, 0.1 + 0.95, ZF - 0.01); G.scene.add(m);
    G.addSlot(m, {
      kind: 'rack', glow: false, facing: 1, accept: h => h.type === 'rails' || h.type === 'device',
      prompt: (h, f) => { const u = uFromHit(f, h); return h.type === 'rails' ? 'U' + u + ' 에 레일 설치' : 'U' + u + ' 에 밀어 넣기 (' + (G.flip ? '앞면부터' : '뒷면부터') + ')'; },
      ghost: (f, h) => { const u = uFromHit(f, h); if (!G.ghost) { G.ghost = new T.Mesh(new T.BoxGeometry(EW + 0.03, U * 0.96, 0.6), new T.MeshBasicMaterial({ transparent: true, opacity: 0.4, depthWrite: false })); G.scene.add(G.ghost); } const ok = h.type === 'rails' ? !occupied(u) : (S.rails && S.rails.u === u && S.occ[u] === 'rails'); G.ghost.material.color.set(ok ? 0x2fbf71 : 0xd9654a); G.ghost.position.set(0, W.yOfU(u), ZF - 0.3); G.ghost.visible = true; },
      onPlace: (h, f) => { const u = uFromHit(f, h); if (h.type === 'rails') placeRails(h, u); else placeDevice(h, u); },
    });
  }
  function buildBox() {
    const g = new T.Group(), BW = 1.0, BH = 0.28, BD = 0.74, cm = 0xc59a5b; g.position.set(-4.95, 0.8, -0.8); G.scene.add(g);
    [[BW, 0.01, BD, 0, 0.005, 0], [BW, BH, 0.012, 0, BH / 2, BD / 2], [BW, BH, 0.012, 0, BH / 2, -BD / 2], [0.012, BH, BD, -BW / 2, BH / 2, 0], [0.012, BH, BD, BW / 2, BH / 2, 0]].forEach(q => { const m = box(q[0], q[1], q[2], cm, 0.9); m.position.set(q[3], q[4], q[5]); g.add(m); });
    const foam = box(BW - 0.04, 0.09, BD - 0.04, 0xf1f1ee, 1); foam.position.y = 0.055; g.add(foam);
    const mk = (zh, sg) => { const gr = new T.Group(); gr.position.set(0, BH, zh); const f = box(BW, 0.008, BD / 2, 0xb78a4d, 0.9); f.position.z = -sg * BD / 4; gr.add(f); g.add(gr); return gr; };
    const fr = mk(BD / 2, 1), bk = mk(-BD / 2, -1), tape = box(BW + 0.005, 0.003, 0.06, 0xe6d3a4, 0.5); tape.position.set(0, BH + 0.008, 0); g.add(tape);
    const pr = new T.Mesh(new T.PlaneGeometry(BW - 0.1, 0.13), new T.MeshBasicMaterial({ transparent: true, map: G.tex(512, 66, (c, w, h) => { c.fillStyle = '#5a3d17'; c.font = '700 30px sans-serif'; c.fillText(S.n === 1 ? 'SERVER 1U · THIS SIDE UP ↑' : 'SWITCH 48P · THIS SIDE UP ↑', 12, 30); c.font = '600 20px sans-serif'; c.fillText('FRAGILE · 취급주의 (가상)', 12, 58); }) })); pr.position.set(0, BH / 2, BD / 2 + 0.008); g.add(pr);
    const bs0 = S.scen === 'serial' ? 'FOC2547A18Q' : S.lv.serial;
    const sl = new T.Mesh(new T.PlaneGeometry(0.3, 0.16), new T.MeshBasicMaterial({ map: G.tex(300, 160, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#222'; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); c.fillStyle = '#222'; c.font = '700 20px sans-serif'; c.fillText(S.n === 1 ? 'RX-1U420' : 'NX-4824T', 12, 30); c.font = '700 22px monospace'; c.fillText('S/N ' + bs0, 12, 62); for (let i = 0; i < 46; i++) c.fillRect(12 + i * 6, 80, (i % 3) + 1.5, 56); c.font = '12px sans-serif'; c.fillText('QTY 1 · MADE FOR SIM', 12, 152); }) })); sl.position.set(BW / 2 - 0.2, BH / 2 - 0.02, BD / 2 + 0.009); g.add(sl);
    const hit = new T.Mesh(new T.BoxGeometry(BW, BH + 0.1, BD), new T.MeshBasicMaterial({ visible: false })); hit.position.y = BH / 2; g.add(hit);
    S.box = { g, fr, bk, tape, hit, open: false, BH };
    G.addUse(hit, { prompt: () => S.box.open ? '(이미 열었습니다)' : '박스 개봉', run: openBox });
    // 내용물
    const base = g.position, top = 0.8 + 0.1;
    const boxSerial = S.scen === 'serial' ? 'FOC2547A18Q' : S.lv.serial; const dev = W.makeDevice(S.lv.device, { label: S.lv.dev, serial: boxSerial }); const hd = S.n === 1 ? 0.62 : 0.44;
    dev.g.position.set(base.x - 0.22, top + dev.H / 2 + 0.005, base.z); dev.g.rotation.y = Math.PI / 2;
    const bag = new T.Mesh(new T.BoxGeometry(EW + 0.04, dev.H + 0.02, dev.D + 0.04), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.15, depthWrite: false })); dev.g.add(bag);
    S.dev = dev; S.bag = bag;
    const it = W.makeItem('dev', S.n === 1 ? '서버 SRV-NEW-01 (포장됨)' : '스위치 NX-4824T (포장됨)', dev.g, [EW + 0.05, 0.07, dev.D + 0.04, 0, 0, 0], { type: 'device', flippable: true, holdT: { p: [0.22, -0.2, -0.5], r: [0.15, -0.5, 0.05], s: 0.9 }, enabled: false, dev });
    it.home = { p: dev.g.position.clone(), r: dev.g.rotation.y }; it.onPick = () => { bag.visible = false; it.label = S.n === 1 ? '서버 SRV-NEW-01' : '스위치 NX-4824T'; };
    dev.g.visible = false; S.devItem = it;
    // 부속품 (박스 안, 열기 전에는 숨김)
    const acc = []; const y = top + 0.012;
    acc.push(W.coil('cord1', '전원 코드 1', 0x24292e, 0x3a4148, V3(base.x + 0.2, y, base.z - 0.22), { cable: { pair: ['psu', 'outlet'], color: 0x24292e, rad: 0.0045, plug: 0x20262b, kind: 'power' }, type: 'cable' }));
    acc.push(W.coil('cord2', '전원 코드 2', 0x24292e, 0x3a4148, V3(base.x + 0.2, y, base.z), { cable: { pair: ['psu', 'outlet'], color: 0x24292e, rad: 0.0045, plug: 0x20262b, kind: 'power' }, type: 'cable' }));
    if (S.n === 1) acc.push(W.coil('cat6', 'UTP 케이블 (Cat6)', 0x3a78c4, 0xdde6ee, V3(base.x + 0.2, y, base.z + 0.22), { cable: { pair: ['nic', 'swport'], color: 0x3a78c4, rad: 0.0035, plug: 0xdde6ee, kind: 'net' }, type: 'cable' }));
    else {
      acc.push(W.coil('fib1', '광 케이블 1 (LC)', COL.fiber, 0xdde6ee, V3(base.x + 0.2, y, base.z + 0.22), { cable: { pair: ['uplink', 'core'], color: COL.fiber, rad: 0.003, plug: 0xdde6ee, kind: 'fiber' }, type: 'cable' }));
      acc.push(W.coil('fib2', '광 케이블 2 (LC)', COL.fiber, 0xdde6ee, V3(base.x + 0.38, y, base.z + 0.22), { cable: { pair: ['uplink', 'core'], color: COL.fiber, rad: 0.003, plug: 0xdde6ee, kind: 'fiber' }, type: 'cable' }));
      acc.push(W.coil('console', '콘솔 케이블', 0x4fa3d9, 0x2a3036, V3(base.x + 0.38, y, base.z), { cable: { pair: ['con', 'laptop'], color: 0x4fa3d9, rad: 0.003, plug: 0x2a3036, kind: 'console' }, type: 'cable' }));
    }
    acc.forEach(a => { a.enabled = false; a.g.visible = false; }); S.acc = acc;
    // 레일 킷은 따로 포장
    S.railsItem = W.makeRails(V3(-3.75, 0.82, -0.55)); S.railsItem.type = 'rails'; S.railsItem.g.rotation.y = Math.PI / 2; S.railsItem.home = { p: S.railsItem.g.position.clone(), r: Math.PI / 2 };
  }
  function openBox() {
    const b = S.box; if (b.open) { G.toast('이미 열었습니다.', 'warn'); return; } b.open = true; G.sfx('click'); G.usables = G.usables.filter(u => u !== b.hit);
    G.anim(1.8, k => { b.tape.scale.x = Math.max(0.001, 1 - Math.min(1, k * 2.2)); b.fr.rotation.x = 2.7 * k; b.bk.rotation.x = -2.7 * k; }, () => {
      S.devItem.enabled = true; S.dev.g.visible = true; S.acc.forEach((a, i) => { a.enabled = true; a.g.visible = true; popIn(a.g, i * 0.1); });
      G.toast('박스를 열었습니다. 입고서와 대조하세요 (작업대 클립보드).', 'ok'); G.sfx('ok');
    });
    G.toast('테이프를 뜯고 뚜껑을 엽니다…');
  }
  function buildTableStuff() {
    // 클립보드, 태블릿
    const cb = new T.Group(); cb.position.set(-3.95, 0.81, -1.05); cb.rotation.y = 0.3; const bd = box(0.24, 0.012, 0.32, 0xb48b52, 0.8); cb.add(bd); const pp = box(0.21, 0.004, 0.29, 0xf6f3ea, 0.9); pp.position.y = 0.008; cb.add(pp); G.scene.add(cb);
    const h1 = new T.Mesh(new T.BoxGeometry(0.34, 0.12, 0.42), new T.MeshBasicMaterial({ visible: false })); h1.position.set(-3.95, 0.86, -1.05); G.scene.add(h1); G.addUse(h1, { prompt: '입고서 대조 (검수 기록)', run: openRecv });
    const tb = new T.Group(); tb.position.set(-3.55, 0.815, -0.62); tb.rotation.y = -0.4; tb.add(box(0.2, 0.012, 0.14, 0x1b2127, 0.4)); const ts = new T.Mesh(new T.PlaneGeometry(0.18, 0.12), new T.MeshBasicMaterial({ color: 0x4fc3d9 })); ts.rotation.x = -Math.PI / 2; ts.position.y = 0.007; tb.add(ts); G.scene.add(tb);
    const h2 = new T.Mesh(new T.BoxGeometry(0.3, 0.1, 0.24), new T.MeshBasicMaterial({ visible: false })); h2.position.set(-3.55, 0.85, -0.62); G.scene.add(h2); G.addUse(h2, { prompt: '태블릿 (작업 정보·계산기)', run: openTablet });
    if (S.n === 2) {
      const lp = new T.Group(); lp.position.set(-3.7, 0.8, -1.05); lp.rotation.y = 0.5; lp.add(box(0.34, 0.015, 0.23, 0x7d8791, 0.5, 0.5)); const sc = box(0.33, 0.21, 0.01, 0x1b2127); sc.position.set(0, 0.11, -0.11); sc.rotation.x = -0.25; lp.add(sc);
      const scr = new T.Mesh(new T.PlaneGeometry(0.3, 0.18), new T.MeshBasicMaterial({ map: G.tex(256, 150, (g, w, h) => { g.fillStyle = '#0b0e12'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0b030'; g.font = '16px monospace'; g.fillText('SW> _', 10, 24); }) })); scr.position.set(0, 0.11, -0.104); scr.rotation.x = -0.25; lp.add(scr); G.scene.add(lp); S.laptop = lp;
      const h3 = new T.Mesh(new T.BoxGeometry(0.4, 0.3, 0.3), new T.MeshBasicMaterial({ visible: false })); h3.position.set(-3.7, 0.95, -1.05); G.scene.add(h3); G.addUse(h3, { prompt: '노트북 (콘솔 터미널)', run: openTerminal });
      // 노트북 콘솔 포트 슬롯
      S.laptopSlot = flushSlot(V3(-3.55, 0.82, -0.93), [0.05, 0.04, 0.05], { kind: 'laptop', name: 'laptop', accept: cableAccept('laptop'), prompt: () => '노트북 콘솔 포트에 연결', onPlace: cablePlace });
    }
    // 관제 PC (2레벨)
    if (S.n === 2) { const pc = new T.Mesh(new T.BoxGeometry(0.6, 0.45, 0.4), new T.MeshBasicMaterial({ visible: false })); pc.position.set(5.0, 1.05, 1.3); G.scene.add(pc); G.addUse(pc, { prompt: '관제 PC (장비 등록)', run: openMonitor }); }
  }
  function fill(rack, u, type, label, o) { const d = W.makeDevice(type, { label }); d.g.position.set(W.RACKX[rack], W.yOfU(u), W.RAILF - d.D / 2); G.scene.add(d.g);
    if (label === 'ACC') useBox(W.RACKX[rack], W.yOfU(u), W.RAILF + 0.03, EW, U * 0.9, 0.06, 'SW-ACC-01 (R01 U40)', () => devInfo('SW-ACC-01', rack, u, 'switch'), 1);
    else if (label) useBox(W.RACKX[rack], W.yOfU(u), W.RAILF + 0.03, EW, U * 0.9, 0.06, label + ' (' + rack + ' U' + u + ')', () => devInfo(label, rack, u, type), 1);
    return d; }
  function buildDecor() {
    [1, 3, 5, 7, 9, 11, 13, 15].forEach((u, i) => fill('R11', u, 'server', 'SRV-DB-' + (i + 1)).g.position.y = W.yOfU(u));
    [1, 3, 5, 7, 9, 11].forEach((u, i) => fill('R10', u, 'server', 'SRV-WEB-' + (i + 1)));
    [1, 3, 5, 7].forEach((u, i) => fill('R02', u, 'server', 'SRV-APP-' + (i + 1)));
    if (S.n === 1) {
      const acc = fill('R01', 40, 'switch', 'ACC'); S.acc1 = acc;
      [[3, 0], [4, 0], [5, 0]].forEach((p, i) => { const px = 660 + (10 + i) * 16.2 + 6, py = 28 + p[1] * 31 + 11; acc.g.updateMatrixWorld(true); const pos = acc.g.localToWorld(V3(-(px / 1180 - 0.5) * EW, (0.5 - py / 100) * acc.H, -acc.D / 2 - 0.004));
        flushSlot(V3(pos.x, pos.y, pos.z - 0.008), [0.02, 0.016, 0.02], { kind: 'swport', name: 'SW-ACC-01 Gi1/0/' + (11 + i), out: V3(0, 0, -1), accept: cableAccept('swport'), prompt: () => 'SW-ACC-01 Gi1/0/' + (11 + i) + ' 에 꽂기', onPlace: cablePlace }); });
      const lb = G.sprite('SW-ACC-01 (R01 U40)', '#222', 0.9, 'rgba(255,255,255,.9)'); lb.position.set(0.65, 2.05, ZR - 0.05); G.scene.add(lb);
    } else {
      S.coreA = fill('R01', 41, 'switch', 'CORE-A'); S.coreB = fill('R01', 38, 'switch', 'CORE-B');
      [[S.coreA, 'CORE-A'], [S.coreB, 'CORE-B']].forEach(([d, nm]) => { d.g.updateMatrixWorld(true); const pos = d.port('t1'); const lb = G.sprite(nm, '#14606f', 0.55, 'rgba(255,255,255,.9)'); lb.position.set(pos.x, pos.y + 0.08, pos.z - 0.05); G.scene.add(lb);
        flushSlot(V3(pos.x, pos.y, pos.z - 0.008), [0.026, 0.026, 0.02], { kind: 'core', name: nm, out: V3(0, 0, -1), accept: cableAccept('core'), prompt: () => nm + ' 포트에 꽂기', onPlace: cablePlace }); });
    }
  }
  function buildCart() {
    [[16, 'a'], [16, 'b'], [20, 'a'], [20, 'b'], [32, 'a'], [32, 'b']].forEach((d, i) => { const it = W.makePdu('pdu' + d[0] + d[1], d[0], V3(-6.55 + i * 0.2, 0.1, -3.62)); it.type = 'pdu'; it.home = { p: it.g.position.clone(), r: 0 }; });
    Object.values(G.items).filter(i => i.kind === 'pdu').forEach(it => { it.pduSlotAccept = true; });
    ['L', 'R'].forEach(lr => { const x = lr === 'L' ? 0.262 : -0.262; flushSlot(V3(x, 0.82, ZR + 0.07), [0.09, 1.55, 0.09], { kind: 'pdu', name: 'pdu' + lr, lr, facing: -1, accept: h => h.type === 'pdu', prompt: () => (lr === 'L' ? '후면 왼쪽' : '후면 오른쪽') + '에 PDU 설치', onPlace: (h) => installPdu(h, lr, false) }); });
  }
  function buildPreinstalled() {
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach(u => { S.occ[u] = 'decor'; if (u % 2) fill('R12', u, 'server', 'SRV-' + (u + 100)); });
    [['L', 'pdu32a'], ['R', 'pdu32b']].forEach(([lr, id]) => { const it = W.makePdu(id, 32, V3(lr === 'L' ? 0.262 : -0.262, 0, ZR + 0.07)); it.type = 'pdu'; it.warn = 22.4; it.crit = 25.6; installPdu(it, lr, true); });
    Object.values(S.pdus).forEach(p => p.setLcd(6.1));
  }

  /* ================= PDU ================= */
  function installPdu(it, lr, instant) {
    const pos = V3(lr === 'L' ? 0.262 : -0.262, 0, ZR + 0.07), side = lr === 'L' ? 'A' : 'B';
    const done = () => {
      it.installed = { lr, side }; it.enabled = false; it.g.rotation.set(0, 0, 0); S.pdus[lr] = it; it.outlets = [];
      for (let k = 0; k < 12; k++) { const p = V3(pos.x, 1.42 - k * 0.105 - 0.05, pos.z - 0.045); it.outlets.push(flushSlot(p, [0.05, 0.04, 0.03], { kind: 'outlet', name: 'PDU-' + side + ' ' + (k + 1) + '번', side, k, pdu: it, out: V3(0, 0, -1), accept: cableAccept('outlet'), prompt: () => 'PDU-' + side + ' ' + (k + 1) + '번 콘센트에 꽂기', onPlace: cablePlace })); }
      const hit = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.07), new T.MeshBasicMaterial({ visible: false })); hit.position.set(pos.x, 1.5, pos.z - 0.05); hit.userData.facing = -1; G.scene.add(hit); G.addUse(hit, { prompt: 'PDU-' + side + ' 설정 화면', run: () => openPduPanel(it) });
      G.pduLabel && 0; const old = it.g.children.find(c => c.isSprite); if (old) { it.g.remove(old); const lb = G.sprite('PDU-' + side + ' ' + it.rating + 'A', '#fff', 0.55, side === 'A' ? '#c8553d' : '#3a78c4'); lb.position.set(0, 1.62, 0); it.g.add(lb); }
      if (!instant) { G.sfx('place'); G.toast('PDU-' + side + ' (' + it.rating + 'A) 설치. LCD를 보면 설정할 수 있습니다.', 'ok'); }
    };
    if (instant) { it.g.position.copy(pos); done(); return; }
    G.detach(it); it.g.rotation.set(0, 0, 0);
    G.path(it.g, [{ p: V3(pos.x, 0.55, pos.z - 0.5), r: 0, d: 0.7, arc: 0.2 }, { p: pos, r: 0, d: 0.5, arc: 0 }], done);
  }
  function updateLoads() {
    const base = S.n === 2 ? 6.1 : 0, cur = { A: base, B: base }, v = SERVER_W;
    const powered = S.n === 1 ? S.booted : S.sysOn, w = S.n === 1 ? SERVER_W : SW_W, cs = Object.values(S.cords).filter(c => c.side);
    if (powered) cs.forEach(c => { cur[c.side] += w / cs.length / VOLT; });
    ['L', 'R'].forEach(lr => { const p = S.pdus[lr]; if (p) { p.amps = cur[p.installed.side]; p.setLcd(p.amps); } });
  }
  function openPduPanel(it) {
    const side = it.installed.side, hasCord = Object.values(S.cords).some(c => c.side === side);
    UI.open('<h2>PDU-' + side + ' 설정</h2><p class="sub">정격 ' + it.rating + 'A · 현재 부하 ' + (it.amps || 0).toFixed(1) + 'A</p><h3>경보 임계값 (A)</h3><div class="row">경고 <input id="pw" type="number" step="0.1" value="' + (it.warn || '') + '" style="width:90px"> 위험 <input id="pc" type="number" step="0.1" value="' + (it.crit || '') + '" style="width:90px"></div>' +
      '<p class="mini">기준은 작업지시서(Tab)를 확인하세요.</p><div class="row"><button class="btn" data-a="pduSave">저장</button><button class="btn ghost" data-a="pduRemove"' + (hasCord ? ' disabled title="케이블이 꽂혀 있습니다"' : '') + '>PDU 빼내기</button><button class="btn ghost" data-a="close">닫기</button></div>');
    UI.act.pduSave = () => { it.warn = parseFloat($('#pw').value); it.crit = parseFloat($('#pc').value); it.setLcd(it.amps || 0); G.sfx('ok'); G.toast('PDU-' + side + ' 임계값을 저장했습니다.', 'ok'); UI.close(); };
    UI.act.pduRemove = () => { const lr = it.installed.lr; it.outlets.forEach(G.rmSlot); G.usables = G.usables.filter(u => !(u.position.x === (lr === 'L' ? 0.262 : -0.262) && Math.abs(u.position.y - 1.5) < 0.01)); it.installed = null; it.enabled = true; delete S.pdus[lr]; it.warn = it.crit = undefined; G.flyTo(it.g, it.home.p, 0, 0.8, () => { it.placed = false; }, 0.4); UI.close(); G.toast('PDU를 빼서 보관대로 돌려놓았습니다.'); };
  }

  /* ================= 레일·장비 설치 ================= */
  function placeRails(h, u) {
    if (occupied(u)) { G.sfx('err'); G.toast('U' + u + ' 칸은 이미 사용 중입니다.', 'bad'); return; }
    G.detach(h); const y = W.yOfU(u); h.g.rotation.set(0, h.g.rotation.y, 0); S.occ[u] = 'rails'; S.rails = { u };
    G.path(h.g, [{ p: V3(0, y + 0.12, ZF + 0.4), r: 0, d: 0.7, arc: 0.12 }, { p: V3(0, y, ZC), r: 0, d: 0.7, arc: 0 }], () => {
      h.g.visible = false; h.enabled = false; const rg = new T.Group(); rg.position.set(0, y, 0); G.scene.add(rg);
      [-1, 1].forEach(sx => { const r = box(0.012, 0.02, W.RD - 0.08, 0x8a949e, 0.4, 0.6); r.position.set(sx * (EW / 2 + 0.004), -U * 0.3, ZC); rg.add(r); r.position.z = ZC; rg.position.z = 0; [-1, 1].forEach(sz => { const br = box(0.03, 0.025, 0.006, 0x6f7983, 0.4, 0.6); br.position.set(sx * (EW / 2 + 0.012), -U * 0.2, ZC + sz * (W.RD / 2 - 0.045)); rg.add(br); screw(V3(sx * (EW / 2 + 0.012), y - U * 0.2, ZC + sz * (W.RD / 2 - 0.042)), sz, 0.15 + (sx > 0 ? 0.3 : 0) + (sz > 0 ? 0.15 : 0)); }); });
      S.railsGroup = rg; G.sfx('place'); G.toast('U' + u + ' 에 레일을 달았습니다.', 'ok');
      const hit = new T.Mesh(new T.BoxGeometry(0.5, U, 0.04), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, y - U * 0.3, ZF + 0.02); hit.userData.facing = 1; G.scene.add(hit); S.railsUse = G.addUse(hit, { prompt: () => S.devMount ? '' : '레일 빼기', run: removeRails });
    });
  }
  function removeRails() { if (S.devMount) { G.toast('장비를 먼저 빼야 합니다.', 'warn'); return; } const u = S.rails.u; delete S.occ[u]; S.rails = null; G.scene.remove(S.railsGroup); G.usables = G.usables.filter(x => x !== S.railsUse); const h = S.railsItem; h.g.visible = true; h.enabled = true; G.flyTo(h.g, h.home.p, h.home.r, 0.7, () => { h.placed = false; }); G.toast('레일을 풀어 작업대에 돌려놓았습니다.'); }
  function placeDevice(h, u) {
    if (!(S.rails && S.rails.u === u && S.occ[u] === 'rails')) { G.sfx('err'); G.toast(S.rails ? '레일이 있는 U' + S.rails.u + ' 칸에 넣어야 합니다.' : '먼저 레일 킷을 설치해야 장비를 올릴 수 있습니다.', 'bad'); return; }
    const flip = G.flip, dev = h.dev; G.detach(h); h.enabled = false; S.occ[u] = 'dev'; S.devMount = { u, flip }; G.usables = G.usables.filter(x => x !== S.railsUse);
    const y = W.yOfU(u), rot = flip ? Math.PI : 0, stage = ZF + dev.D / 2 + 0.3, fin = W.RAILF - dev.D / 2; dev.g.rotation.set(0, dev.g.rotation.y, 0);
    G.path(dev.g, [{ p: V3(0, y + 0.18, stage + 0.2), r: rot, d: 0.9, arc: 0.12 }, { p: V3(0, y, stage), r: rot, d: 0.45, arc: 0 }, { p: V3(0, y, fin), r: rot, d: 1.8, arc: 0 }], () => {
      dev.g.updateMatrixWorld(true); S.earScrews = []; let d = 0.1; [-1, 1].forEach(sx => [-0.011, 0.011].forEach(yo => { S.earScrews.push(screw(dev.g.localToWorld(V3(sx * (EW / 2 + 0.015), yo, dev.D / 2 + 0.002)), flip ? -1 : 1, d)); d += 0.2; }));
      G.after(0.9, () => { makePortSlots(); G.sfx('place'); G.toast(S.n === 1 ? '서버를 밀어 넣고 랙 귀를 고정했습니다.' : '스위치를 밀어 넣고 랙 귀를 고정했습니다.', 'ok'); });
      const hit = new T.Mesh(new T.BoxGeometry(0.46, U * 0.9, 0.05), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, y, W.RAILF + 0.01); hit.userData.facing = 1; G.scene.add(hit);
      if (S.n === 1) { const btn = new T.Mesh(new T.BoxGeometry(0.04, U * 0.9, 0.04), new T.MeshBasicMaterial({ visible: false })); btn.position.copy(dev.g.localToWorld(V3((1020 / 1180 - 0.5) * EW, 0, dev.D / 2 + 0.01))); G.scene.add(btn); btn.userData.facing = flip ? -1 : 1; S.btn = btn; G.addUse(btn, { prompt: () => S.booted ? '전원 버튼 (이미 켜짐)' : '서버 전원 켜기', run: bootServer }); }
      S.devUse = G.addUse(hit, { prompt: () => S.conn.length ? '' : '장비 빼기', run: removeDevice }); S.devHit = hit;
    });
  }
  function removeDevice() {
    if (S.conn.length) { G.toast('케이블이 꽂혀 있습니다. 먼저 뽑으세요 (포트 옆을 클릭).', 'warn'); return; }
    const m = S.devMount, dev = S.dev; S.occ[m.u] = 'rails'; S.devMount = null; S.portSlots.forEach(G.rmSlot); S.portSlots = [];
    G.usables = G.usables.filter(u => u !== S.devUse && u !== S.btn); G.scene.remove(S.devHit); if (S.btn) G.scene.remove(S.btn);
    if (S.railsUse && !G.usables.includes(S.railsUse)) G.usables.push(S.railsUse);
    (S.earScrews || []).forEach(m2 => G.scene.remove(m2)); S.earScrews = [];
    S.booted = false; S.sysOn = false; dev.st.sys = 'off'; dev.st.power = false; dev.refresh(); updateLoads();
    const it = S.devItem; it.enabled = true; G.flyTo(dev.g, it.home.p, it.home.r, 0.9, () => { it.placed = false; }, 0.4); G.toast('장비를 빼서 작업대로 돌려놓았습니다.');
  }
  function makePortSlots() {
    S.portSlots = []; const dev = S.dev, m = S.devMount, n = V3(0, 0, m.flip ? 1 : -1);
    const names = S.n === 1 ? ['psu1', 'psu2', 'nic1'] : ['psu1', 'psu2', 't1', 't2', 'con'];
    names.forEach(nm => { const kind = nm.startsWith('psu') ? 'psu' : nm.startsWith('nic') ? 'nic' : nm === 'con' ? 'con' : 'uplink', pos = dev.port(nm).add(n.clone().multiplyScalar(0.008));
      S.portSlots.push(flushSlot(pos, kind === 'psu' ? [0.05, 0.026, 0.02] : [0.022, 0.024, 0.02], { kind, name: nm, dev, out: n, accept: cableAccept(kind), prompt: () => ({ psu1: 'PSU1 전원 입구', psu2: 'PSU2 전원 입구', nic1: 'NIC1 포트', t1: '업링크 T1', t2: '업링크 T2', con: 'CON(콘솔) 포트' })[nm] + '에 꽂기', onPlace: cablePlace })); });
  }

  /* ================= 케이블 ================= */
  function cableAccept(kind) { return h => !!(h.cable && (h.pending ? h.cable.pair[0] === kind && h.pending.kind === h.cable.pair[1] || h.cable.pair[1] === kind && h.pending.kind === h.cable.pair[0] : h.cable.pair.includes(kind))); }
  function cablePlace(h, f) {
    const slot = f.obj.userData.slot, wp = f.obj.getWorldPosition(V3());
    if (!h.pending) { h.pending = { kind: slot.kind, slot, wp, cancel() { G.live = null; h.pending = null; } }; G.live = { from: () => wp, color: h.cable.color, rad: h.cable.rad }; h.hint = () => '반대쪽 끝을 꽂을 곳을 조준하세요'; G.sfx('click'); G.toast('한쪽 끝을 꽂았습니다. 반대쪽을 조준하세요.'); return; }
    const A = h.pending.slot, Aw = h.pending.wp; h.pending = null; G.live = null; delete h.hint;
    const first = A.kind === h.cable.pair[0] ? [A, Aw, slot, wp] : [slot, wp, A, Aw]; const [sa, pa, sb, pb] = first;
    const pts = route(h.cable.kind, pa, pb, sa, sb);
    const kind = h.cable.kind, rec = { item: h, a: sa, b: sb, pa, pb, group: null };
    G.detach(h); h.g.visible = false; h.enabled = false; sa.enabled = false; sb.enabled = false; S.conn.push(rec);
    rec.group = G.cable(pts, h.cable.color, h.cable.rad, h.cable.plug, kind, () => afterConnect(rec));
    G.sfx('place');
  }
  function route(kind, a, b, sa, sb) {
    const na = (sa.out || sb.out || V3(0, 0, -1)), P = (x, y, z) => V3(x, y, z);
    if (kind === 'power') { const dv = sa.kind === 'psu' ? sa : sb, dp = dv === sa ? a : b, op = dv === sa ? b : a, n = dv.out; return [dp, dp.clone().add(n.clone().multiplyScalar(0.08)), P((dp.x + op.x) / 2, (dp.y + op.y) / 2 - 0.03, ZR - 0.17), P(op.x, op.y, ZR - 0.12), op]; }
    if (kind === 'net') { const nic = sa.kind === 'nic' ? a : b, sw = sa.kind === 'nic' ? b : a; return [nic, nic.clone().add(V3(0, 0, -0.08)), P(nic.x, nic.y + 0.25, ZR - 0.2), P(sw.x, sw.y - 0.2, ZR - 0.2), P(sw.x, sw.y, ZR - 0.08), sw]; }
    if (kind === 'fiber') { const up = sa.kind === 'uplink' ? a : b, co = sa.kind === 'uplink' ? b : a, n = (sa.kind === 'uplink' ? sa : sb).out; return [up, up.clone().add(n.clone().multiplyScalar(0.09)), P(up.x, up.y + 0.1, ZR - 0.16), P(up.x, 2.2, ZR - 0.16), P(co.x, 2.2, ZR - 0.16), P(co.x, co.y + 0.12, ZR - 0.14), P(co.x, co.y, ZR - 0.07), co]; }
    const con = sa.kind === 'con' ? a : b, lp = sa.kind === 'con' ? b : a; return [lp, P(lp.x - 0.1, 0.012, lp.z - 0.1), P(-1.9, 0.012, -1.4), P(-1.9, 0.012, ZR - 0.5), P(con.x, 0.012, ZR - 0.5), P(con.x, con.y - 0.2, ZR - 0.25), P(con.x, con.y, ZR - 0.08), con];
  }
  function afterConnect(rec) {
    const kind = rec.item.cable.kind, A = rec.a, B = rec.b;
    // 뽑기 (장비 쪽 끝에서)
    const dsl = A.kind === 'outlet' || A.kind === 'swport' || A.kind === 'core' || A.kind === 'laptop' ? rec.pb : rec.pa, hit = new T.Mesh(new T.BoxGeometry(0.022, 0.025, 0.03), new T.MeshBasicMaterial({ visible: false })); hit.position.copy(dsl).add(V3(0, 0, -0.01)); hit.userData.facing = -1; G.scene.add(hit);
    rec.hit = G.addUse(hit, { prompt: '케이블 뽑기', run: () => unplug(rec) }); rec.hitMesh = hit;
    if (kind === 'power') { const psu = (A.kind === 'psu' ? A : B), out = (A.kind === 'outlet' ? A : B); S.cords[psu.name] = { side: out.side, out: out.k + 1, rec }; S.dev.st.cord[psu.name === 'psu1' ? 0 : 1] = true; S.dev.refresh(); if (S.n === 2 && !S.sysOn) { S.sysOn = true; S.dev.st.power = true; S.dev.st.sys = 'boot'; S.dev.refresh(); G.sfx('boot'); G.after(3, () => { S.dev.st.sys = 'ok'; S.dev.refresh(); G.toast('스위치가 부팅을 마쳤습니다.', 'ok'); }); } updateLoads(); if (S.n === 1 && S.booted) { S.dev.st.power = true; S.dev.refresh(); } G.toast('전원 코드 연결: ' + psu.name.toUpperCase() + ' → PDU-' + out.side + ' ' + (out.k + 1) + '번', 'ok'); }
    else if (kind === 'net') { S.net = { port: (A.kind === 'swport' ? A : B).name }; S.dev.st.nic[0] = true; S.dev.refresh(); G.toast('UTP 케이블 연결: ' + S.net.port, 'ok'); }
    else if (kind === 'fiber') { const up = A.kind === 'uplink' ? A : B, co = A.kind === 'core' ? A : B, i = up.name === 't1' ? 1 : 2; S.fiber[i] = { core: co.name, wrong: S.polBad[i - 1], label: false, rec }; syncLeds(); afterFiber(rec, i, co, dsl); }
    else if (kind === 'console') { S.console = true; S.dev.st.con = true; S.dev.refresh(); G.toast('콘솔 케이블 연결. 노트북에서 터미널을 여세요.', 'ok'); }
    G.sfx('ok');
  }
  function afterFiber(rec, i, co, pos) {
    const lab = new T.Mesh(new T.BoxGeometry(0.022, 0.03, 0.03), new T.MeshBasicMaterial({ visible: false })); lab.position.copy(S.dev.port(i === 1 ? 't1' : 't2')).add(V3(0, 0.06, S.devMount.flip ? 0.02 : -0.02)); lab.userData.facing = S.devMount.flip ? 1 : -1; G.scene.add(lab);
    rec.labUse = G.addUse(lab, { prompt: () => S.fiber[i].label ? '라벨 붙임 (' + i + ')' : '광 케이블 T' + i + ' 라벨 붙이기', run: () => { S.fiber[i].label = true; G.sfx('click'); G.toast('T' + i + ' 케이블 양끝에 라벨을 붙였습니다.', 'ok'); } });
    const fl = new T.Mesh(new T.BoxGeometry(0.022, 0.03, 0.03), new T.MeshBasicMaterial({ visible: false })); fl.position.copy(co.userData ? V3(0, 0, 0) : V3()); const cp = rec.a === co ? rec.pa : rec.pb; fl.position.copy(cp).add(V3(0, 0.03, -0.012)); fl.userData.facing = -1; G.scene.add(fl);
    rec.flipUse = G.addUse(fl, { prompt: () => S.fiber[i].wrong ? 'T' + i + ' Tx/Rx 뒤집기 (링크 DOWN)' : 'T' + i + ' 링크 정상', run: () => { if (!S.fiber[i].wrong) { G.toast('이미 링크가 올라와 있습니다.'); return; } S.fiber[i].wrong = false; syncLeds(); G.sfx('ok'); G.toast('Tx/Rx를 뒤집었습니다. T' + i + ' 링크 UP!', 'ok'); } });
    rec.extra = [lab, fl];
    if (S.fiber[i].wrong) G.toast('T' + i + ' LED가 꺼져 있습니다. 광 극성이 뒤집혔을 수 있습니다 (코어 쪽 케이블 끝을 클릭).', 'warn'); else G.toast('T' + i + ' 링크 UP (' + co.name + ')', 'ok');
  }
  function syncLeds() { const d = S.dev; [1, 2].forEach(i => { const f = S.fiber[i]; d.st.up[i - 1] = !!(f.core && !f.wrong); d.st.upBad[i - 1] = !!(f.core && f.wrong); }); d.refresh(); }
  function unplug(rec) {
    const it = rec.item, kind = it.cable.kind; G.scene.remove(rec.group); G.cables = G.cables.filter(c => c !== rec.group); G.usables = G.usables.filter(u => u !== rec.hit && u !== rec.labUse && u !== rec.flipUse); [rec.hitMesh].concat(rec.extra || []).forEach(m => m && G.scene.remove(m));
    rec.a.enabled = true; rec.b.enabled = true; S.conn = S.conn.filter(c => c !== rec);
    if (kind === 'power') { const psu = rec.a.kind === 'psu' ? rec.a : rec.b; delete S.cords[psu.name]; S.dev.st.cord[psu.name === 'psu1' ? 0 : 1] = false; S.dev.refresh(); updateLoads(); }
    if (kind === 'net') { S.net = null; S.dev.st.nic[0] = false; S.dev.refresh(); }
    if (kind === 'fiber') { const up = rec.a.kind === 'uplink' ? rec.a : rec.b, i = up.name === 't1' ? 1 : 2; S.fiber[i] = {}; syncLeds(); }
    if (kind === 'console') { S.console = false; S.dev.st.con = false; S.dev.refresh(); }
    it.g.visible = true; it.enabled = true; it.g.position.copy(rec.pa); G.flyTo(it.g, it.home.p, it.home.r, 0.7, () => { it.placed = false; }, 0.3); G.sfx('drop'); G.toast('케이블을 뽑아 작업대에 돌려놓았습니다.');
  }
  function bootServer() {
    if (S.booted) { G.toast('이미 켜져 있습니다.'); return; }
    if (!S.devMount) return;
    const n = Object.keys(S.cords).length; if (!n) { G.sfx('err'); G.toast('전원이 들어오지 않습니다. 전원 케이블을 연결하세요.', 'bad'); return; }
    S.booted = true; S.dev.st.power = true; S.dev.st.sys = 'ok'; S.dev.refresh(); G.sfx('boot'); updateLoads(); G.toast('서버 전원을 켰습니다. 팬이 돌고 부팅 중…', 'ok');
  }

  /* ================= 오버레이: 지시서 / 도움말 / 검수 ================= */
  function showHelp() { UI.open('<h2>조작법 (마우스만으로 됩니다)</h2><table class="t"><tr><td>바닥 클릭</td><td>그곳으로 걸어갑니다 (장애물은 알아서 피함)</td></tr><tr><td>물건·자리 클릭</td><td>멀리 있어도 다가가서 집기·사용·설치</td></tr><tr><td>드래그</td><td>시점 돌리기</td></tr><tr><td>휠</td><td>화면 확대/축소</td></tr><tr><td>우클릭</td><td>손에 든 물건 내려놓기</td></tr><tr><td>오른쪽 아래 버튼</td><td>빠른 이동</td></tr><tr><td>위쪽 버튼</td><td>작업지시서 · 안내판 · 도움말</td></tr></table><p class="mini">키보드(W A S D, E, R, Q, Tab)도 쓸 수 있지만 필요 없습니다. 순서는 자유이고, 끝나면 감독관에게 검수를 요청하세요.</p><div class="row"><button class="btn" data-a="close">닫기</button></div>'); }
  UI.act.close = () => UI.close();
  function showOrder() {
    const R = LabCLI.REQ, L = S.lv, a = loadA();
    const common = '<tr><td>전압</td><td>단상 ' + VOLT + 'V</td></tr><tr><td>이 랙 예정 부하</td><td>서버 8대 × ' + SERVER_W + 'W' + (S.n === 2 ? ' + 스위치 ' + SW_W + 'W' : '') + ' = <b>' + L.loadW + 'W</b></td></tr><tr><td>전원 구성</td><td>A/B 이중화(평소엔 반반)</td></tr><tr><td>PDU 기준</td><td>정격 전류의 <b>80%</b>까지만 사용 · 경고 70% / 위험 80% · PDU-A 후면 왼쪽, PDU-B 후면 오른쪽</td></tr>';
    const spec = S.n === 1 ? '<tr><td>설치 대상</td><td>1U 서버 1대 (SRV-NEW-01), 시리얼 ' + L.serial + '</td></tr><tr><td>위치</td><td>R12 (무거운 장비는 아래부터)</td></tr><tr><td>전원</td><td>PSU 2개를 서로 다른 PDU(A/B)에</td></tr><tr><td>네트워크</td><td>NIC1 → SW-ACC-01(R01) 빈 포트 (Gi1/0/11~13)</td></tr><tr><td>마무리</td><td>전원 켜서 부팅 확인</td></tr>'
      : '<tr><td>설치 대상</td><td>스위치 1대 (' + R.host + '), 시리얼 ' + L.serial + '</td></tr><tr><td>위치</td><td>R12 상단 TOR (U38~41), 포트·전원면은 후면(핫 아일)</td></tr><tr><td>전원</td><td>PSU 2개를 서로 다른 PDU(A/B)에. PDU는 이미 설치됨</td></tr><tr><td>업링크</td><td>T1 → CORE-A, T2 → CORE-B (R01), 케이블 라벨 부착, 링크 UP</td></tr><tr><td>콘솔 설정</td><td>호스트명 ' + R.host + ' · VLAN 99(MGMT)/100 · Vlan99 ' + R.ip + '/24 · GW ' + R.gw + ' · 업링크 trunk(99,100)+description · SNMP RO ' + R.community + ' · write memory</td></tr><tr><td>관제 등록</td><td>장비명·IP·community 일치, 수집 5분, 경고 80%</td></tr>';
    UI.open('<div class="paper"><h2>작업지시서 · ' + L.name + '</h2><p class="sub">작업 순서는 자유입니다. 끝나면 감독관에게 검수를 요청하세요. (값은 모두 가상)</p><table class="t">' + spec + common + '</table></div><div class="row"><button class="btn" data-a="close">닫기</button></div>');
  }
  function intro() {
    const lines = S.n === 1 ? ['어서 와요, 신입. 오늘은 <b>1U 서버 1대</b>를 R12 랙에 설치하는 일입니다.', '작업대 위에 박스가 도착해 있어요. 입고서 대조부터, PDU(멀티탭) 설치, 레일, 장착, 전원, 네트워크까지 <b>순서는 알아서</b> 하세요.', '다 됐다 싶으면 저한테 말을 걸어요. 제가 직접 확인합니다. 자세한 내용은 <kbd>Tab</kbd> 작업지시서에 있어요.']
      : ['2레벨입니다. 이번에는 <b>스위치 1대</b>를 R12 상단에 설치하고 관제까지 붙여야 해요.', 'PDU는 이미 달려 있습니다. 광 업링크 2개를 코어 두 대에 나눠 꽂고, 콘솔로 설정한 뒤 관제 PC에 등록하세요.', '순서는 자유, 끝나면 저를 부르세요. <kbd>Tab</kbd> 작업지시서를 꼭 읽어요.'];
    UI.dialog('감독관', lines, [{ t: '알겠습니다', a: 'close' }, { t: '조작법 보기', a: 'help', g: 1 }]); UI.act.help = showHelp;
  }
  function supervisorMenu() {
    UI.dialog('감독관', ['무슨 일이죠?'], [{ t: '검수 요청합니다', a: 'inspect' }, { t: '작업지시서 다시 보기', a: 'order', g: 1 }, { t: '힌트 부탁드립니다 (감점)', a: 'hint', g: 1 }, { t: '닫기', a: 'close', g: 1 }]);
    UI.act.inspect = () => { UI.close(); G.after(0.05, doInspect); }; UI.act.order = () => { UI.close(); G.after(0.05, showOrder); };
    UI.act.hint = () => { const r = inspectList(), f = r.find(x => x.state !== 'pass'); S.hints++; UI.dialog('감독관', [f ? '<b>' + f.label + '</b> 쪽을 다시 살펴봐요. ' + f.hint : '다 된 것 같은데요? 검수를 요청해 봐요.'], [{ t: '알겠습니다', a: 'close' }]); };
  }

  /* ================= 입고 검수 / 태블릿 ================= */
  function rowsFor() {
    const sc = S.scen, n = S.n;
    const base = [{ id: 'model', name: '모델명', note: n === 1 ? 'RX-1U420' : 'NX-4824T', box: n === 1 ? 'RX-1U420' : 'NX-4824T' }, { id: 'serial', name: '시리얼 번호', note: S.lv.serial, box: sc === 'serial' ? 'FOC2547A18Q' : S.lv.serial },
      { id: 'psu', name: '전원 모듈(PSU)', note: '2개', box: '2개' }, { id: 'cord', name: '전원 코드', note: '2개', box: '2개' }, { id: 'rail', name: '랙 레일 킷', note: '1세트', box: '1세트' }];
    base.push(n === 1 ? { id: 'cab', name: 'UTP 케이블', note: '1개', box: sc === 'missing' ? '0개' : '1개' } : { id: 'cab', name: 'SFP+ 광 모듈', note: '2개', box: sc === 'missing' ? '1개' : '2개' });
    base.push({ id: 'look', name: '외관', note: '이상 없음', box: sc === 'damaged' ? '랙 귀(브래킷) 휘어짐' : '이상 없음' });
    return base;
  }
  const expectedFlags = () => ({ clean: [], serial: ['serial'], missing: ['cab'], damaged: ['look'] }[S.scen]);
  function openRecv() {
    if (!S.box.open) { G.sfx('err'); G.toast('먼저 박스를 열어 현물을 확인하세요.', 'warn'); return; }
    const rows = rowsFor();
    UI.open('<div class="paper"><h2>입고서 대조</h2><p class="sub">입고서와 박스 현물이 다른 줄만 "이상"으로 바꾸고 제출하세요.</p><table class="t"><tr><th>항목</th><th>입고서</th><th>박스 현물</th><th>판정</th></tr>' + rows.map(r => '<tr><td>' + r.name + '</td><td class="mono">' + esc(r.note) + '</td><td class="mono">' + esc(r.box) + '</td><td><button class="flag' + (S.flags[r.id] ? ' on' : '') + '" data-a="flag" data-id="' + r.id + '">' + (S.flags[r.id] ? '이상' : '정상') + '</button></td></tr>').join('') + '</table></div><div class="row"><button class="btn" data-a="recvOk">제출</button><button class="btn ghost" data-a="close">닫기</button></div>');
    UI.act.flag = el => { S.flags[el.dataset.id] = !S.flags[el.dataset.id]; el.classList.toggle('on'); el.textContent = S.flags[el.dataset.id] ? '이상' : '정상'; G.sfx('click'); };
    UI.act.recvOk = () => { S.recvSubmitted = true; UI.close(); G.sfx('ok'); G.toast('검수 기록을 제출했습니다. (결과는 감독관 검수에서 확인됩니다)', 'ok'); };
  }
  function openTablet() {
    UI.open('<h2>태블릿 · 작업 정보</h2><p class="sub">계산기: 전류(A) = 전력(W) ÷ 전압(V)</p><div class="row"><input id="cw" type="number" placeholder="전력 W" style="width:120px"> ÷ <input id="cv" type="number" value="' + VOLT + '" style="width:90px"> V = <b id="cr" class="mono">–</b> A</div><div class="row"><input id="cx" type="number" step="0.1" placeholder="정격 A" style="width:110px"> × 80% = <b id="cx2" class="mono">–</b> A (사용 한도)</div><p class="mini">작업 조건은 <kbd>Tab</kbd> 작업지시서를 보세요. 한쪽 PDU가 꺼지면 남은 PDU가 전부 감당해야 합니다.</p><div class="row"><button class="btn" data-a="close">닫기</button></div>');
    const upd = () => { const w = parseFloat($('#cw').value), v = parseFloat($('#cv').value), r = parseFloat($('#cx').value); $('#cr').textContent = w && v ? (w / v).toFixed(2) : '–'; $('#cx2').textContent = r ? (r * 0.8).toFixed(1) : '–'; };
    ['#cw', '#cv', '#cx'].forEach(s => $(s).addEventListener('input', upd));
  }

  /* ================= 2레벨: 터미널 / 관제 ================= */
  function linkOf(n) { const i = n === 'Te1/1/1' ? 1 : n === 'Te1/1/2' ? 2 : 0, f = i && S.fiber[i]; if (!f || !f.core) return { phys: false, hasCable: false }; const ok = !f.wrong; return { phys: ok, hasCable: true, tx: -2.3, rx: ok ? -3.1 : -40.0, peer: ok ? { name: f.core, port: 'Te1/0/12' } : null }; }
  function openTerminal() {
    if (!S.cli) S.cli = new LabCLI.Device({ serial: S.lv.serial, link: linkOf }); const d = S.cli;
    UI.open('<h2>노트북 · 콘솔 터미널</h2>' + (S.console ? '' : '<p class="mini" style="color:#ffb27a">콘솔 케이블이 연결되지 않았습니다. 작업대의 콘솔 케이블을 스위치 CON 포트와 노트북에 연결하세요.</p>') + '<ul class="chk" id="tasks"></ul><div class="term" id="term"></div><div class="termin"><span id="pr"></span><input id="ci" type="text" autocomplete="off" spellcheck="false"' + (S.console ? '' : ' disabled') + '></div><div class="row"><button class="btn ghost" data-a="close">닫기</button></div>');
    const term = $('#term'), inp = $('#ci');
    const paint = () => { term.innerHTML = S.cliLog.map(l => l.p ? '<span class="p">' + esc(l.p) + '</span> ' + esc(l.c) : esc(l.o)).join('\n'); term.scrollTop = term.scrollHeight; $('#pr').textContent = d.prompt(); $('#tasks').innerHTML = d.tasks().map(t => '<li class="' + (t.ok ? 'pass' : 'todo') + '"><span class="ic">' + (t.ok ? '✓' : '·') + '</span><div>' + esc(t.label) + '</div></li>').join(''); };
    if (!S.cliLog.length) S.cliLog.push({ o: '--- 콘솔 연결됨 (9600 8N1, 가상) ---\n엔터를 누르면 시작합니다. 먼저 enable 이 필요합니다.\n' }); paint(); if (S.console) inp.focus();
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const c = inp.value; S.cliLog.push({ p: d.prompt(), c }); if (c.trim()) { S.hist.push(c); S.hi = S.hist.length; } d.run(c).forEach(o => S.cliLog.push({ o })); inp.value = ''; paint(); } else if (e.key === 'ArrowUp') { if (S.hi > 0) inp.value = S.hist[--S.hi]; e.preventDefault(); } else if (e.key === 'ArrowDown') { inp.value = S.hi < S.hist.length - 1 ? S.hist[++S.hi] : (S.hi = S.hist.length, ''); e.preventDefault(); } else if (e.key === 'Escape') UI.close(); });
  }
  function openMonitor() {
    const M = S.mon, v = M.v || {};
    UI.open('<h2>관제 PC · 장비 등록</h2><table class="t"><tr><td>장비명</td><td><input id="mn" value="' + esc(v.name || '') + '" style="width:100%"></td></tr><tr><td>관리 IP</td><td><input id="mi" value="' + esc(v.ip || '') + '" style="width:100%"></td></tr><tr><td>SNMP community</td><td><input id="mc" value="' + esc(v.comm || '') + '" style="width:100%"></td></tr><tr><td>수집 간격</td><td><select id="mt"><option>1분</option><option selected>5분</option><option>10분</option></select></td></tr><tr><td>경고 기준</td><td><select id="mh"><option>60%</option><option>70%</option><option selected>80%</option><option>95%</option></select></td></tr></table>' +
      '<div class="row"><button class="btn" data-a="monReg">등록</button><button class="btn ghost" data-a="monVer"' + (M.reg ? '' : ' disabled') + '>검증 실행</button><button class="btn ghost" data-a="close">닫기</button></div><ul class="chk" id="vl"></ul><canvas class="graph" id="gr" width="720" height="260"></canvas>');
    drawGraph(M.ok ? 12 : -1);
    UI.act.monReg = () => { const d = S.cli, c = { name: $('#mn').value.trim(), ip: $('#mi').value.trim(), comm: $('#mc').value.trim() }, bad = []; const svi = d && d.svi[99] || {};
      if (!d || c.name !== d.host) bad.push('장비명이 장비 hostname(' + (d ? d.host : '미설정') + ')과 다릅니다'); if (c.ip !== svi.ip) bad.push('관리 IP가 장비 설정(' + (svi.ip || '없음') + ')과 다릅니다'); if (!d || !d.snmp.includes(c.comm)) bad.push('community가 장비 설정과 다릅니다');
      if ($('#mt').value !== '5분') bad.push('수집 간격은 5분이 표준입니다'); if ($('#mh').value !== '80%') bad.push('경고 기준은 80%가 표준입니다'); M.v = c;
      if (bad.length) { M.reg = false; G.sfx('err'); $('#vl').innerHTML = bad.map(b => '<li class="fail"><span class="ic">!</span><div>' + b + '</div></li>').join(''); return; } M.reg = true; G.sfx('ok'); G.toast('관제에 등록했습니다.', 'ok'); openMonitor(); };
    UI.act.monVer = () => { const d = S.cli, ip = M.v.ip, ping = d.reach(ip) || (d.svi[99] && d.svi[99].ip === ip && d.reach(LabCLI.REQ.gw)), snmp = !!ping && d.snmp.includes(M.v.comm);
      $('#vl').innerHTML = [[ping, '관제 서버 → ' + ip + ' ping ' + (ping ? '응답' : '실패')], [snmp, 'SNMP 응답 ' + (snmp ? '정상' : '없음')]].map(x => '<li class="' + (x[0] ? 'pass' : 'fail') + '"><span class="ic">' + (x[0] ? '✓' : '!') + '</span><div>' + x[1] + '</div></li>').join('');
      if (!ping || !snmp) { G.sfx('err'); $('#vl').innerHTML += '<li class="todo"><span class="ic">?</span><div>장비에 닿지 않습니다. 노트북 콘솔에서 IP·게이트웨이·트렁크(VLAN 99)·링크를 확인하세요.</div></li>'; return; }
      let n = 0; const iv = setInterval(() => { n++; drawGraph(n); if (n >= 12) { clearInterval(iv); M.ok = true; G.sfx('ok'); G.toast('그래프가 들어옵니다. 관제 연동 완료.', 'ok'); } }, 150); };
  }
  function drawGraph(n) {
    const cv = $('#gr'); if (!cv) return; const g = cv.getContext('2d'), w = cv.width, h = cv.height; g.fillStyle = '#0b0e12'; g.fillRect(0, 0, w, h); g.strokeStyle = '#26303a'; g.fillStyle = '#6f7b87'; g.font = '16px sans-serif';
    [0, 20, 40, 60, 80, 100].forEach(p => { const y = h - 24 - p / 100 * (h - 44); g.beginPath(); g.moveTo(40, y); g.lineTo(w - 6, y); g.stroke(); g.fillText(p + '%', 4, y + 5); });
    if (n < 0) { g.fillText('검증을 통과하면 그래프가 나타납니다', 150, h / 2); return; }
    [['#6fb1e8', 22], ['#f0b030', 14]].forEach((s, k) => { g.strokeStyle = s[0]; g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i < n; i++) { const v = s[1] + 9 * Math.sin(i * 0.7 + k * 2) + (i * 37 % 7) * 0.6, x = 40 + i * ((w - 60) / 11), y = h - 24 - v / 100 * (h - 44); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
  }

  /* ================= 검수 ================= */
  function inspectList() {
    const out = [], add = (id, label, state, msg, hint) => out.push({ id, label, state, msg, hint: hint || '' }), A = loadA(), L = S.pdus.L, R = S.pdus.R;
    // 입고
    const exp = expectedFlags().slice().sort().join(), got = Object.keys(S.flags).filter(k => S.flags[k]).sort().join();
    if (!S.box.open) add('recv', '입고 검수', 'todo', '박스를 열지 않았습니다.', '박스를 열고 현물을 확인했나요?'); else if (!S.recvSubmitted) add('recv', '입고 검수', 'todo', '입고서 대조 기록(클립보드)을 제출하지 않았습니다.', '작업대의 클립보드로 입고서와 현물을 대조해 제출하세요.');
    else if (exp !== got) { const e = expectedFlags(); add('recv', '입고 검수', 'fail', '검수 기록이 현물과 다릅니다. ' + (e.length ? '다른 항목이 있었는데 놓쳤거나, 정상인 항목을 이상으로 적었습니다.' : '이상이 없었는데 이상으로 표시했습니다.'), '입고서와 박스 값을 한 글자씩 비교해 보세요. (시리얼, 개수, 외관)'); }
    else add('recv', '입고 검수', 'pass', e0(expectedFlags()));
    function e0(e) { return e.length ? '이상 항목을 정확히 찾았습니다. (실제로는 사진을 찍고 반품/교체를 접수합니다)' : '입고서와 현물이 일치합니다.'; }
    // PDU
    if (S.n === 1) {
      if (!L || !R) add('pdu', 'PDU 설치', 'todo', 'PDU 2대를 후면에 설치하지 않았습니다.', '보관대의 PDU를 후면 좌우에 다세요. 정격은 전류를 계산해서 고릅니다.');
      else if (L.rating !== R.rating) add('pdu', 'PDU 설치', 'fail', '두 PDU의 정격이 다릅니다 (' + L.rating + 'A / ' + R.rating + 'A). A/B는 같은 정격이어야 합니다.', 'A/B는 같은 정격으로 맞춥니다.');
      else if (A > L.rating * 0.8) add('pdu', 'PDU 설치', 'fail', L.rating + 'A로는 부족합니다. 사용 한도 ' + L.rating + '×80% = ' + (L.rating * 0.8).toFixed(1) + 'A, 한쪽 장애 시 부하 ' + A.toFixed(1) + 'A. 차단기가 내려가 랙 전체가 정전될 수 있습니다.', '한쪽 PDU가 꺼졌을 때 남은 PDU가 전부 감당하는 전류를 계산해 보세요. (예정 부하 W ÷ 220V)');
      else add('pdu', 'PDU 설치', 'pass', 'PDU ' + L.rating + 'A × 2. 한쪽 장애 시에도 ' + A.toFixed(1) + 'A ≤ 사용 한도 ' + (L.rating * 0.8).toFixed(1) + 'A.');
      if (!L || !R) add('pdupos', 'PDU 위치·임계값', 'todo', 'PDU가 설치되지 않았습니다.', 'PDU를 먼저 설치하세요.');
      else { const rate = L.rating, nearv = (a, b) => Math.abs(a - b) <= 0.3; if (!(L.warn >= 0 && R.warn >= 0 && L.crit >= 0 && R.crit >= 0)) add('pdupos', 'PDU 위치·임계값', 'todo', 'PDU 경보 임계값을 설정하지 않았습니다 (PDU LCD를 클릭).', '후면의 PDU LCD를 보고 클릭해서 경고/위험 값을 넣으세요. 기준은 지시서에 있습니다.');
        else if (![L, R].every(p => nearv(p.warn, rate * 0.7) && nearv(p.crit, rate * 0.8))) add('pdupos', 'PDU 위치·임계값', 'fail', '임계값이 기준과 다릅니다. 경고 = ' + rate + '×70% = ' + (rate * 0.7).toFixed(1) + 'A, 위험 = ' + rate + '×80% = ' + (rate * 0.8).toFixed(1) + 'A.', '지시서의 경고 70% / 위험 80% 기준을 정격에 곱해 보세요.');
        else add('pdupos', 'PDU 위치·임계값', 'pass', 'PDU-A 후면 왼쪽, PDU-B 후면 오른쪽, 경고 ' + (rate * 0.7).toFixed(1) + 'A / 위험 ' + (rate * 0.8).toFixed(1) + 'A.'); }
    } else add('pdu', 'PDU (사전 설치)', 'pass', 'PDU 32A × 2가 이미 설치돼 있습니다.');
    // 위치
    const m = S.devMount;
    if (!S.rails) add('pos', S.lv.label + ' 위치·레일', 'todo', '레일 킷을 설치하지 않았습니다.', '레일 킷을 집어서 랙 전면의 원하는 U에 설치하세요.'); else if (!m) add('pos', S.lv.label + ' 위치·레일', 'todo', S.lv.label + '를 랙에 장착하지 않았습니다.', '장비를 집어 레일을 단 U에 밀어 넣으세요.');
    else if (S.n === 1 && m.u > 12) add('pos', '서버 위치·레일', 'fail', 'U' + m.u + ': 서버는 무겁습니다. 랙 아래쪽(U1~12)부터 채우는 게 원칙입니다. 위쪽이 무거우면 랙이 기울 위험이 있습니다.', '무거운 장비는 랙 아래부터 설치합니다.');
    else if (S.n === 2 && !(m.u >= 38 && m.u <= 41)) add('pos', '스위치 위치·레일', 'fail', 'U' + m.u + ': 스위치는 서버와 케이블로 이어지니 랙 상단(U38~41, TOR)에 둡니다.', '스위치는 랙 맨 위쪽(TOR)에 둡니다. 맨 위 U42는 비웁니다.');
    else add('pos', S.lv.label + ' 위치·레일', 'pass', 'R12 U' + m.u + ' 레일 위에 장착.');
    if (!m) add('dir', '장비 방향', 'todo', '장비가 장착되지 않았습니다.', '장비를 밀어 넣기 전에 「방향 바꾸기」 버튼으로 방향을 정하세요.'); else if (m.flip) add('dir', '장비 방향', 'fail', '포트·전원면이 전면(콜드 아일)을 향해 있습니다. 더운 공기가 찬 통로로 나오고, 전원 코드가 PDU가 있는 후면까지 돌아가야 합니다. 장비를 빼서 「방향 바꾸기」로 방향을 바꿔 다시 넣으세요.', '장비 뒷면(포트·전원)이 후면(핫 아일)을 향해야 합니다. 손에 든 장비 아래 「방향 바꾸기」 버튼으로 바꿀 수 있어요.'); else add('dir', '장비 방향', 'pass', '포트·전원면이 후면(핫 아일)을 향합니다.');
    // 전원
    const cs = Object.keys(S.cords).map(k => S.cords[k]);
    if (cs.length < 2) add('pwr', '전원 A/B 이중화', 'todo', '전원 코드 ' + cs.length + '개만 연결돼 있습니다 (2개 필요).', '전원 코드 2개로 PSU1·PSU2를 각각 PDU에 연결하세요.'); else if (cs[0].side === cs[1].side) add('pwr', '전원 A/B 이중화', 'fail', '두 코드가 모두 PDU-' + cs[0].side + ' 에 꽂혀 있습니다. 그 계통이 꺼지면 장비가 통째로 꺼집니다.', 'PSU1과 PSU2를 서로 다른 PDU(A/B)에 나눠 꽂으세요.'); else add('pwr', '전원 A/B 이중화', 'pass', cs.map(c => 'PDU-' + c.side + ' ' + c.out + '번').join(' · ') + '에 분리 연결.');
    if (S.n === 1) {
      if (!S.net) add('net', '네트워크 연결', 'todo', 'NIC1 케이블이 연결되지 않았습니다.', 'UTP 케이블로 서버 NIC1과 SW-ACC-01(R01)의 빈 포트를 연결하세요. 둘 다 후면입니다.'); else add('net', '네트워크 연결', 'pass', 'NIC1 → ' + S.net.port + '.');
      if (!S.booted) add('boot', '전원 투입·부팅', 'todo', '서버 전원을 켜지 않았습니다.', '전원 케이블 연결 후 서버 전면의 전원 버튼을 누르세요.'); else add('boot', '전원 투입·부팅', 'pass', '서버가 켜져 정상 부팅.');
    } else {
      const f1 = S.fiber[1], f2 = S.fiber[2];
      if (!f1.core || !f2.core) add('fib', '광 업링크', 'todo', '업링크 ' + ((f1.core ? 1 : 0) + (f2.core ? 1 : 0)) + '개만 연결했습니다 (2개 필요).', '광 케이블 2개로 T1, T2를 코어에 연결하세요.');
      else if (f1.core === f2.core) add('fib', '광 업링크', 'fail', '두 업링크가 같은 코어(' + f1.core + ')에 연결됐습니다. 코어 한 대가 죽으면 단절됩니다.', 'T1은 CORE-A, T2는 CORE-B로 나눠야 합니다.');
      else if (f1.wrong || f2.wrong) add('fib', '광 업링크', 'fail', '링크가 DOWN인 업링크가 있습니다. Tx/Rx가 뒤집혔습니다.', '링크 LED가 꺼진 쪽 코어 끝을 클릭해 극성을 뒤집으세요.');
      else add('fib', '광 업링크', 'pass', 'T1 ↔ ' + f1.core + ', T2 ↔ ' + f2.core + ', 링크 UP.');
      if (f1.core && f2.core) { if (!(f1.label && f2.label)) add('lab', '케이블 라벨', 'fail', '라벨이 없는 케이블이 있습니다. 나중에 장애가 나면 어느 선인지 알 수 없습니다.', '각 광 케이블 장비 쪽 끝을 클릭해 라벨을 붙이세요.'); else add('lab', '케이블 라벨', 'pass', '양쪽 케이블 라벨 부착.'); } else add('lab', '케이블 라벨', 'todo', '케이블을 먼저 연결하세요.', '');
      const d = S.cli, ts = d ? d.tasks() : null;
      if (!d || !ts) add('cli', '콘솔 설정', 'todo', '아직 설정하지 않았습니다.', '콘솔 케이블로 노트북을 연결하고 터미널을 여세요.'); else { const bad = ts.filter(t => !t.ok); if (bad.length) add('cli', '콘솔 설정', 'fail', '미완료: ' + bad.map(b => b.label).join(' / '), '노트북 터미널의 체크리스트를 확인하세요. 저장(write memory)까지 해야 합니다.'); else add('cli', '콘솔 설정', 'pass', '설정 완료, 저장됨.'); }
      if (!S.mon.ok) add('mon', '관제 연동', 'todo', '관제 PC에서 등록·검증을 마치지 않았습니다.', '관제 PC에서 장비를 등록하고 검증하세요.'); else add('mon', '관제 연동', 'pass', '등록 · ping/SNMP · 그래프 수신 확인.');
    }
    return out;
  }
  function doInspect() {
    S.insp++; const r = inspectList(), failed = r.filter(x => x.state === 'fail').length, todo = r.filter(x => x.state === 'todo').length;
    S.fails += failed; const all = !failed && !todo;
    UI.open('<h2>감독관 검수</h2><p class="sub">' + (all ? '전부 합격입니다.' : '합격 ' + r.filter(x => x.state === 'pass').length + ' · 불합격 ' + failed + ' · 미완료 ' + todo) + '</p><ul class="chk">' + r.map(x => '<li class="' + x.state + '"><span class="ic">' + (x.state === 'pass' ? '✓' : x.state === 'fail' ? '✕' : '·') + '</span><div><b>' + x.label + '</b><small>' + (x.msg || '') + '</small></div></li>').join('') + '</ul><div class="row">' + (all ? '<button class="btn" data-a="finish">작업 완료 보고</button>' : '<button class="btn" data-a="close">돌아가서 고치기</button>') + '</div>', { noEsc: all });
    if (!all) G.sfx('err'); else G.sfx('ok'); UI.act.finish = finish;
  }
  function finish() {
    S.done = true; const ms = Date.now() - S.t0, min = ms / 60000, score = Math.max(0, Math.round(100 - S.fails * 8 - S.hints * 5 - Math.max(0, min - 12) * 2)), stars = score >= 85 ? 3 : score >= 65 ? 2 : 1;
    let best = {}; try { best = JSON.parse(localStorage.getItem('idc-best') || '{}'); if (!best[S.n] || score > best[S.n].score) best[S.n] = { score, stars }; localStorage.setItem('idc-best', JSON.stringify(best)); } catch (e) {}
    const t = Math.floor(min) + '분 ' + (Math.floor(ms / 1000) % 60) + '초'; G.sfx('win');
    const rep = ['[신규 장비 설치 작업 기록 - 가상 실습]', S.lv.desc + ' / 시리얼 ' + S.lv.serial, '위치: R12 U' + S.devMount.u + ' (포트면 후면), 레일 킷 사용', 'PDU: 각 ' + ((S.pdus.L || {}).rating || 32) + 'A, A=후면 좌 / B=후면 우', '전원: ' + Object.keys(S.cords).map(k => k.toUpperCase() + ' → PDU-' + S.cords[k].side + ' ' + S.cords[k].out + '번').join(', ')].concat(S.n === 1 ? ['네트워크: NIC1 → ' + S.net.port, '전원 투입, 부팅 확인'] : ['업링크: T1 ↔ ' + S.fiber[1].core + ', T2 ↔ ' + S.fiber[2].core + ' (라벨 부착)', '설정: ' + S.cli.host + ', 저장 완료', '관제: 등록·검증 완료']).join('\n');
    UI.open('<h2>작업 완료!</h2><p class="sub">' + S.lv.name + '</p><div class="stars">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</div><div class="score"><div>점수<b>' + score + '</b></div><div>걸린 시간<b>' + t + '</b></div><div>검수 불합격<b>' + S.fails + '</b></div></div><h3>작업 기록 (복사해서 노션에 붙여 넣으세요)</h3><pre class="term" id="rep" style="height:auto;white-space:pre-wrap">' + esc(rep) + '</pre><div class="row"><button class="btn" data-a="copy">기록 복사</button>' + (S.n === 1 ? '<button class="btn" data-a="next">2레벨로</button>' : '') + '<button class="btn ghost" data-a="again">다시 하기</button><button class="btn ghost" data-a="menu">메뉴</button></div>', { noEsc: true });
    UI.act.copy = () => { (navigator.clipboard ? navigator.clipboard.writeText(rep) : Promise.reject()).then(() => G.toast('복사했습니다.', 'ok'), () => { const r = document.createRange(); r.selectNodeContents($('#rep')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); };
    UI.act.next = () => { location.hash = '#2'; location.reload(); }; UI.act.again = () => { location.hash = '#' + S.n; location.reload(); }; UI.act.menu = () => { location.hash = ''; location.reload(); };
  }
  /* ================= 왼쪽 아래 안내판 ================= */
  function guideSteps() {
    const n = S.n, cs = Object.keys(S.cords).length, pd = S.pdus, hasL = pd.L && pd.R, th = hasL && [pd.L, pd.R].every(p => p.warn >= 0 && p.crit >= 0);
    const c = [
      { t: '박스 열기', how: '작업대의 갈색 박스를 클릭하면 테이프를 뜯고 뚜껑이 열립니다.', done: S.box.open },
      { t: '입고서 대조', how: '박스 앞면의 <b>S/N 라벨</b>과 작업대 <b>클립보드</b>의 입고서를 비교합니다. 다른 줄만 "이상"으로 바꿔 제출하세요.', done: S.recvSubmitted },
    ];
    if (n === 1) c.push({ t: 'PDU 설치', how: '태블릿으로 전류를 계산 → 보관대(왼쪽 안쪽)에서 PDU를 집고(클릭) → 랙 <b>뒤쪽</b> 좌/우 세로 자리를 클릭. 한쪽이 꺼졌을 때 기준으로 정격을 고르세요.', done: !!hasL }, { t: 'PDU 경보값', how: '랙 뒤쪽 PDU 위의 LCD를 클릭 → 경고·위험 전류 입력 후 저장.', done: !!th });
    c.push({ t: '레일 킷', how: '작업대의 레일 킷을 집고 → 랙 <b>앞면</b>에서 달 U 칸을 바라보고 클릭. 초록=가능, 빨강=불가.', done: !!S.rails });
    c.push({ t: n === 1 ? '서버 장착' : '스위치 장착(TOR)', how: '장비를 집고 아래 「방향 바꾸기」로 방향을 정합니다(뒷면=포트·전원이 랙 안쪽으로 먼저). 레일을 단 U 칸을 클릭.' + (n === 2 ? ' 스위치는 랙 맨 위쪽(U38~41).' : ' 서버는 아래쪽부터.'), done: !!S.devMount });
    c.push({ t: '전원 A/B', how: '전원 코드를 집고 → 장비 뒷면 <b>PSU 입구</b> 클릭 → PDU <b>콘센트</b> 클릭. 2개를 서로 다른 PDU(A/B)에.', done: cs >= 2 });
    if (n === 1) c.push({ t: '네트워크', how: 'UTP를 집고 → 서버 뒷면 NIC1 클릭 → 옆 랙(R01) 뒷면의 SW-ACC-01 빈 포트 클릭.', done: !!S.net }, { t: '전원 켜기', how: '서버 <b>앞면</b> 오른쪽 전원 버튼을 클릭.', done: !!S.booted });
    else { const f = S.fiber; c.push({ t: '광 업링크', how: '광 케이블 2개: T1 → CORE-A, T2 → CORE-B (R01 뒷면). 링크 LED가 꺼지면 코어 쪽 끝을 클릭해 Tx/Rx를 뒤집고, 장비 쪽 끝을 클릭해 라벨을 붙입니다.', done: !!(f[1].core && f[2].core && !f[1].wrong && !f[2].wrong && f[1].label && f[2].label) }, { t: '콘솔 설정', how: '콘솔 케이블: 스위치 CON ↔ 노트북 연결 → 노트북을 클릭해 터미널 → 작업지시서대로 설정하고 write memory.', done: !!(S.cli && S.cli.tasks().every(t => t.ok)) }, { t: '관제 등록', how: '관제 PC(오른쪽 책상) 클릭 → 등록 → 검증 실행.', done: !!S.mon.ok }); }
    c.push({ t: '검수 요청', how: '다 됐다고 생각되면 감독관을 클릭해 검수를 요청하세요.', done: S.done });
    return c;
  }
  function renderGuide() {
    const el = $('#guide'); if (!el) return; const st = guideSteps(), cur = st.findIndex(x => !x.done), h = G.hold;
    let tip = '';
    if (h) { const T2 = { rails: '랙 앞면에서 레일을 달 U 칸을 클릭하세요.', device: '레일 칸을 클릭. 아래 <b>「방향 바꾸기」</b>로 방향을 바꿉니다 (현재 ' + (G.flip ? '앞면부터' : '뒷면부터') + ').', pdu: '랙 뒤쪽 좌(A)/우(B) 세로 자리를 클릭하세요.' };
      if (h.type === 'cable') { const k = h.cable.kind; tip = h.pending ? '한쪽을 꽂았습니다. <b>반대쪽 끝</b>을 꽂을 곳을 바라보고 클릭하세요.' : ({ power: '한쪽은 장비 뒷면 <b>PSU 입구</b>, 반대쪽은 <b>PDU 콘센트</b>. 초록으로 빛나는 곳이 꽂을 수 있는 곳입니다.', net: '서버 <b>NIC1</b> ↔ R01의 SW-ACC-01 빈 포트.', fiber: '스위치 <b>T1/T2</b> ↔ R01 코어 포트. 서로 다른 코어에.', console: '스위치 <b>CON</b> 포트에 꽂습니다 (노트북 연결).' })[k]; } else tip = T2[h.type] || ''; }
    const sig = [S.guideMin, cur, st.map(x => +x.done).join(''), tip, G.flip].join('|'); if (sig === S.gsig) return; S.gsig = sig;
    el.innerHTML = '<div class="gh"><b>하는 방법</b><span>[G] ' + (S.guideMin ? '펼치기' : '접기') + '</span></div>' + (S.guideMin ? '' : '<div class="gk"><kbd>바닥 클릭</kbd>이동 <kbd>물건 클릭</kbd>집기·사용·설치 <kbd>드래그</kbd>시점 <kbd>휠</kbd>확대 <kbd>우클릭</kbd>내려놓기</div><ol class="gs">' + st.map((x, i) => '<li class="' + (x.done ? 'done' : i === cur ? 'cur' : '') + '"><span class="n">' + (x.done ? '✓' : i + 1) + '</span><div><b>' + x.t + '</b>' + (i === cur ? '<small>' + x.how + '</small>' : '') + '</div></li>').join('') + '</ol>' + (tip ? '<div class="gt">' + tip + '</div>' : ''));
  }

  /* ================= 이동 메뉴 · 상단 버튼 ================= */
  const ST = {
    bench: { label: '입고 작업대', x: -4.95, z: 0.45, look: [-4.95, 0.95, -0.8] }, cart: { label: 'PDU 보관대', x: -6.1, z: -2.75, look: [-6.1, 0.9, -3.6], l1: true },
    front: { label: 'R12 앞', x: 0, z: -1.75, look: [0, 1.0, -2.5] }, rear: { label: 'R12 뒤', x: 0.1, z: -4.3, look: [0.1, 1.1, -3.5] }, r01: { label: 'R01 뒤', x: 0.65, z: -4.3, look: [0.65, 1.5, -3.5] },
    noc: { label: '관제 PC', x: 5.0, z: 2.55, look: [5.0, 0.95, 1.3] }, npc: { label: '감독관', x: -2.6, z: 2.35, look: [-2.6, 1.2, 3.2] },
  };
  function renderQuick() { const q = $('#quick'); if (!q) return; q.innerHTML = '<div class="qh">빠른 이동</div>' + Object.keys(ST).filter(k => !ST[k].l1 || S.n === 1).map(k => '<button data-go="' + k + '">' + ST[k].label + '</button>').join(''); }
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('[data-go]'); if (g && G.running && !G.modal) { const t = ST[g.dataset.go]; G.walkTo(t.x, t.z, { look: V3(t.look[0], t.look[1], t.look[2]) }); return; }
    const t = e.target.closest && e.target.closest('[data-top]'); if (!t || !G.running) return;
    if (t.dataset.top === 'order') showOrder(); else if (t.dataset.top === 'guide') G.onGuide(); else if (t.dataset.top === 'help') showHelp();
  });

  /* ================= 물건마다 눌러 볼 수 있는 것들 ================= */
  function useBox(x, y, z, w, h, d, prompt, run, facing) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ visible: false })); m.position.set(x, y, z); m.userData.facing = facing || 0; G.scene.add(m); G.addUse(m, { prompt, run }); return m; }
  function devInfo(name, rack, u, type) {
    const cpu = 18 + (u * 7 + name.length * 3) % 52, acc = name === 'SW-ACC-01', core = /CORE/.test(name);
    UI.open('<h2>' + name + '</h2><p class="sub">' + rack + ' U' + u + ' · ' + (acc ? '48포트 액세스 스위치' : core ? '코어 스위치' : '1U 서버') + ' (가상)</p><table class="t">' + (acc ? '<tr><td>사용 포트</td><td>10 / 48</td></tr><tr><td>빈 포트</td><td>Gi1/0/11 ~ 13 (이번 작업용)</td></tr><tr><td>전원</td><td>A/B 이중화 정상</td></tr>' : core ? '<tr><td>업링크</td><td>Te1/0/12 (신규 스위치용 예약)</td></tr><tr><td>상태</td><td>정상 (가동 ' + (200 + u) + '일)</td></tr>' : '<tr><td>상태</td><td>가동 중</td></tr><tr><td>CPU</td><td>' + cpu + '%</td></tr><tr><td>전원</td><td>A/B 이중화 정상</td></tr>') + '</table><div class="row"><button class="btn" data-a="close">닫기</button></div>');
  }
  function toggleDoor(name) {
    const d = W.doors[name], to = d.open ? 0 : -1.9, from = d.grp.rotation.y; d.open = !d.open; G.sfx('click');
    G.anim(0.7, k => { d.grp.rotation.y = from + (to - from) * k; }, null);
    G.usables = G.usables.filter(u => u !== d.hit); d.hit = null; G.after(0.01, () => placeDoorHit(name));
  }
  function placeDoorHit(name) {
    const d = W.doors[name], x = W.RACKX[name]; if (d.hit) { G.scene.remove(d.hit); G.usables = G.usables.filter(u => u !== d.hit); }
    d.hit = d.open ? useBox(x - 0.4, 1.0, ZF + 0.3, 0.2, 2.0, 0.5, name + ' 앞문 닫기', () => toggleDoor(name), 1) : useBox(x, 1.0, ZF + 0.045, 0.58, 2.0, 0.1, name + ' 앞문 열기', () => toggleDoor(name), 1);
  }
  function openMonitoring() {
    const cur = { A: 0, B: 0 }; if (S.booted) { const cs = Object.values(S.cords); cs.forEach(c => { cur[c.side] += G.S2 ? SERVER_W / cs.length / VOLT : 0; }); }
    UI.open('<h2>관제 · R12 모니터링</h2><table class="t"><tr><th>대상</th><th>상태</th></tr><tr><td>SRV-NEW-01</td><td>' + (S.booted ? (S.net ? '<b style="color:#2fbf71">UP (ping 응답)</b>' : '<b style="color:#e0a030">전원 ON · 네트워크 미연결</b>') : '<b style="color:#ef6a55">응답 없음</b>') + '</td></tr><tr><td>PDU-A 부하</td><td class="mono">' + cur.A.toFixed(1) + ' A' + (S.pdus.L ? ' / ' + S.pdus.L.rating + 'A' : ' (PDU 없음)') + '</td></tr><tr><td>PDU-B 부하</td><td class="mono">' + cur.B.toFixed(1) + ' A' + (S.pdus.R ? ' / ' + S.pdus.R.rating + 'A' : ' (PDU 없음)') + '</td></tr><tr><td>R12 콜드 아일 온도</td><td class="mono">' + (S.booted && S.devMount && S.devMount.flip ? '28℃ 경고' : '23℃') + '</td></tr></table><p class="mini">' + (S.booted && S.net ? '장비가 정상적으로 관제에 올라왔습니다.' : '아직 관제에 정상으로 올라오지 않았습니다.') + '</p><div class="row"><button class="btn" data-a="close">닫기</button></div>');
  }
  function buildInteractives() {
    const R = W.ROOM;
    useBox(R.x0 + 0.1, 2.4, -1.6, 0.2, 0.5, 0.5, '벽시계 보기', () => { const m = Math.floor((Date.now() - S.t0) / 60000); G.toast('작업 시작 후 ' + m + '분 경과. 마감(17:00)까진 천천히 해도 됩니다.'); });
    useBox(R.x1 - 0.1, 1.6, -2.4, 0.2, 0.95, 1.7, '화이트보드 읽기', () => UI.open('<h2>오늘의 작업 · R12 랙</h2><table class="t"><tr><td>09:00</td><td>입고 확인</td></tr><tr><td>10:00</td><td>PDU / 레일 설치</td></tr><tr><td>13:00</td><td>장비 장착·배선</td></tr><tr><td>16:00</td><td>관제 연동 확인</td></tr><tr><td>17:00</td><td>티켓 마감</td></tr></table><p class="mini" style="color:#ef6a55">※ 전원은 반드시 A/B 분리</p><div class="row"><button class="btn" data-a="close">닫기</button></div>'));
    useBox(R.x0 + 0.1, 1.7, 0.2, 0.2, 0.7, 1.1, '벽 게시물: 작업 전 확인', () => UI.open('<h2>작업 전 확인</h2><ul><li>장비·시리얼 대조</li><li>전원은 A/B 분리</li><li>케이블은 라벨 부착</li><li>정리 후 사진 기록</li></ul><div class="row"><button class="btn" data-a="close">닫기</button></div>'));
    useBox(R.x1 - 0.1, 1.7, 0.2, 0.2, 0.7, 1.1, '벽 게시물: 전력 기준', () => UI.open('<h2>전력 기준</h2><ul><li>정격 전류의 80%까지만 사용</li><li>한쪽 장애 시 기준으로 계산</li><li>A/B는 평소엔 반반</li></ul><div class="row"><button class="btn" data-a="close">닫기</button></div>'));
    let toolOpen = false; useBox(-5.5, 0.15, 0.5, 0.55, 0.3, 0.3, '공구함 열기/닫기', () => { toolOpen = !toolOpen; const a = toolOpen ? -1.2 : 0, f = W.toolLid.rotation.x; G.anim(0.4, k => { W.toolLid.rotation.x = f + (a - f) * k; }, null); G.sfx('click'); if (toolOpen) G.toast('공구함: 육각렌치, 케이블 타이, 라벨 용지, 드라이버, 랜 테스터', 'ok'); });
    useBox(-6.7, 0.25, 4.5, 0.25, 0.5, 0.25, '소화기 확인', () => G.toast('소화기: 점검일 2026-10-15, 압력 정상 (가상)'));
    useBox(1.3, 0.21, 6.2, 0.4, 0.45, 0.4, '쓰레기통', () => G.toast('포장재는 작업이 끝난 뒤 한꺼번에 정리합니다.'));
    useBox(R.x1 - 0.25, 1.0, -4.6, 0.5, 2.0, 0.35, '사다리', () => G.toast('사다리: 랙 상단 작업 때 씁니다. 이번 작업은 필요 없습니다.'));
    useBox(-1.0, 1.25, R.z1 - 0.1, 0.3, 0.3, 0.2, '비상 정지 버튼', () => UI.open('<h2>비상 정지</h2><p class="sub">누르면 센터 전체 전원이 차단됩니다. 정말 누를까요?</p><div class="row"><button class="btn" data-a="close">취소</button><button class="btn" data-a="estop">누른다</button></div>')); UI.act.estop = () => { UI.close(); S.fails += 2; G.sfx('err'); G.toast('센터 전체 정전! 고객사 항의 접수 (연습이라 즉시 복구됨). 불합격 +2', 'bad'); };
    useBox(0, 1.05, R.z1 - 0.12, 1.1, 2.1, 0.25, '출입문', () => G.toast('작업이 끝나기 전에는 퇴근할 수 없습니다.'));
    [-0.65, 0, 0.65].forEach(x => useBox(x, 0.02, -1.85, 0.58, 0.1, 0.58, '타공 타일', () => G.toast('타공 타일: 찬 공기가 이쪽으로 올라옵니다 (콜드 아일).')));
    ['R10', 'R11', 'R02'].forEach(n => placeDoorHit(n));
    if (S.n === 1) useBox(5.0, 1.05, 1.3, 0.6, 0.45, 0.4, '관제 모니터 (R12 상태)', openMonitoring);
  }
  UI.act.close = () => UI.close();
  G.inspectList = inspectList; G.S2 = S;
})();
