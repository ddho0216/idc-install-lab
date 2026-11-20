/* IDC 장비 설치 실습: 3D에서 물건을 집어 설치하고, 단계별로 검증합니다. (가상 환경, 모든 값은 제가 만든 가상 데이터) */
(function () {
  const $ = s => document.querySelector(s);
  const C = Scene3D.consts;
  const STEPS = [
    { id: 'recv', t: '입고·검수', s: '입고서와 현물 대조' },
    { id: 'pdu', t: 'PDU 설치', s: '전류 계산·정격 고르기' },
    { id: 'mount', t: '랙 마운트', s: '레일 → 스위치' },
    { id: 'power', t: '전원 연결', s: 'A/B 이중화' },
    { id: 'fiber', t: '광 케이블링', s: '코어 두 대에 연결' },
    { id: 'cli', t: '콘솔 설정', s: 'IP·VLAN·트렁크·저장' },
    { id: 'mon', t: '관제 연동', s: '등록하고 그래프 확인' },
    { id: 'done', t: '완료', s: '작업 기록' },
  ];
  const IX = id => STEPS.findIndex(x => x.id === id);
  const VOLT = 220, SERVERS = 8, SERVER_W = 450, SW_W = 150, LOAD_W = SERVERS * SERVER_W + SW_W, LOAD_A = LOAD_W / VOLT;
  const SERIAL = 'FOC2547A1BQ';
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  let S, timer;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function fresh() {
    const scen = pick(['clean', 'serial', 'missing', 'damaged']);
    S = {
      step: 0, max: 0, t0: Date.now(), tEnd: null, miss: 0, hints: 0, scen, fb: null, held: null, pend: null,
      rows: [
        { id: 'model', name: '모델명', note: 'NX-4824T', box: 'NX-4824T' },
        { id: 'serial', name: '시리얼 번호', note: SERIAL, box: scen === 'serial' ? 'FOC2547A18Q' : SERIAL },
        { id: 'psu', name: '전원 모듈(PSU)', note: '2개', box: '2개' },
        { id: 'cord', name: '전원 코드', note: '2개', box: '2개' },
        { id: 'rail', name: '랙 레일 킷', note: '1세트', box: '1세트' },
        { id: 'sfp', name: 'SFP+ 광 모듈', note: '2개', box: scen === 'missing' ? '1개' : '2개' },
        { id: 'look', name: '외관', note: '이상 없음', box: scen === 'damaged' ? '랙 귀(브래킷) 휘어짐' : '이상 없음' },
      ],
      flags: {}, recvOk: false, boxOpen: false, unpacked: false,
      pdu: { ok: false, slot: {}, rate: 0 }, pduIn: {},
      mount: { railsU: null, face: 'rear', placed: false, ok: false, u: null },
      power: { conn: {}, ok: false }, console: false,
      fiber: { 1: { core: '', wrong: false, label: false }, 2: { core: '', wrong: false, label: false }, conn: {}, polBad: pick([[true, false], [false, true], [false, false]]), ok: false },
      mon: { reg: false, ok: false, t: null }, cliLog: [], hist: [], histIdx: 0,
    };
    S.dev = new LabCLI.Device({ serial: SERIAL, link: linkOf });
    Scene3D.reset(); updateHand();
  }
  function linkOf(n) {
    const i = n === 'Te1/1/1' ? 1 : n === 'Te1/1/2' ? 2 : 0, f = i && S.fiber[i];
    if (!f || !f.core) return { phys: false, hasCable: false };
    const ok = !f.wrong;
    return { phys: ok, hasCable: true, tx: -2.3, rx: ok ? -3.1 : -40.0, peer: ok ? { name: f.core, port: 'Te1/0/12' } : null };
  }
  function fail(title, msg) { S.miss++; S.fb = { t: 'bad', title, msg }; head(); }
  function good(title, msg) { S.fb = { t: 'ok', title, msg }; }
  function note(title, msg) { S.fb = { t: 'info', title, msg }; }
  function fbHtml() { return S.fb ? '<div class="fb ' + S.fb.t + '"><b>' + esc(S.fb.title) + '</b>' + S.fb.msg + '</div>' : ''; }
  function hintBtn(text) { return '<details><summary data-act="hint">힌트 보기 (쓰면 기록에 남습니다)</summary><p class="why" id="hintbox" hidden>' + text + '</p></details>'; }
  function how(lines) { return '<ol class="how">' + lines.map(l => '<li>' + l + '</li>').join('') + '</ol>'; }

  /* ---------- 상단·단계 ---------- */
  function head() {
    $('#miss').textContent = '실수 ' + S.miss;
    $('#steps').innerHTML = '<ol>' + STEPS.map((s, i) =>
      '<li class="' + (i < S.step ? 'done' : '') + (i === S.step ? ' cur' : '') + '"' + (i <= S.max && (i === IX('cli') || i === IX('mon')) ? ' data-act="goto" data-i="' + i + '" style="cursor:pointer"' : '') + '><div>' + s.t + '<small>' + s.s + '</small></div></li>').join('') + '</ol>';
  }
  function tick() { const ms = (S.tEnd || Date.now()) - S.t0, m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; $('#timer').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
  function go(i) {
    release(); S.step = i; S.max = Math.max(S.max, i); S.fb = null; S.pend = null; render();
    viewFor(false);
  }
  const VIEWS = { recv: ['table', 'table'], pdu: ['pdu', 'pdu'], mount: ['mountWide', 'rails'], power: ['powerWide', 'rearUp'], fiber: ['fiberWide', 'rearCore'], cli: ['powerWide', 'rearUp'], mon: ['wide', 'wide'], done: ['done', 'done'] };
  function viewFor(zoom) { const v = VIEWS[STEPS[S.step].id]; Scene3D.setView(zoom ? v[1] : v[0], { u: S.mount.railsU || 40 }); }
  function render() {
    if (STEPS[S.step].id === 'pdu') savePduIn();
    head();
    const id = STEPS[S.step].id; $('#panel').innerHTML = VIEW[id]();
    if (id === 'cli') cliMount();
    if (id === 'mon') drawGraph(false);
    updateHand();
  }

  /* ---------- 손에 든 것 / 놓을 자리 ---------- */
  function updateHand() {
    const h = $('#hand'); if (!h) return;
    if (!S.held) { h.hidden = true; return; }
    const it = Scene3D.items[S.held]; h.hidden = false;
    let msg = '손에 든 것: <b>' + esc(it.label) + '</b> · ';
    const st = STEPS[S.step].id;
    if (st === 'pdu') msg += '후면의 노란 자리(왼쪽/오른쪽)를 클릭해서 설치';
    else if (st === 'mount') msg += S.held === 'rails' ? '랙 전면에서 레일을 달 U 칸을 클릭' : '레일을 달아 둔 같은 U 칸을 클릭해서 밀어 넣기';
    else if (st === 'power') msg += S.pend ? 'PSU에 꽂았습니다. 이제 PDU 콘센트(노란 칸)를 클릭' : '스위치의 PSU 전원 입구(노란 칸)를 클릭';
    else if (st === 'fiber') msg += S.pend ? '스위치 포트에 꽂았습니다. 이제 코어 스위치 포트(노란 칸)를 클릭' : '스위치 업링크 포트 T1/T2(노란 칸)를 클릭';
    else if (st === 'cli') msg += '스위치의 CON 포트(노란 칸)를 클릭';
    h.innerHTML = msg + ' <span class="mini">(Esc 또는 빈 곳 클릭 = 내려놓기)</span>';
  }
  function release() { const was = S.held; S.held = null; S.pend = null; Scene3D.setHeld(null); Scene3D.setTargets([]); Scene3D.pickU(false); updateHand(); if (was) viewFor(false); }
  function canHold(id) {
    const st = STEPS[S.step].id, it = Scene3D.items[id];
    if (st === 'pdu') return it.kind === 'pdu' && !it.placed;
    if (st === 'mount') return id === 'rails' ? !S.mount.railsU : (id === 'switch' && !!S.mount.railsU && !S.mount.placed);
    if (st === 'power') return /^cord/.test(id) && !S.power.conn[id];
    if (st === 'fiber') return /^fib/.test(id) && !S.fiber.conn[id];
    if (st === 'cli') return id === 'console' && !S.console;
    return false;
  }
  const GOAL = { recv: '지금은 박스를 열고 검수하는 단계입니다.', pdu: '지금은 PDU(보관대의 긴 막대)만 필요합니다.', mount: S => S.mount.railsU ? '지금은 스위치를 집을 차례입니다.' : '지금은 레일 킷부터 집으세요.', power: '지금은 전원 코드(검은 코일)가 필요합니다.', fiber: '지금은 광 케이블(노란 코일)이 필요합니다.', cli: '지금은 콘솔 케이블(파란 코일)이 필요합니다.', mon: '이 단계는 3D 조작이 필요 없습니다.', done: '작업이 끝났습니다.' };
  function recvClick(id) {
    if (id === 'box') {
      if (S.boxOpen) { note('이미 열었습니다', '안의 장비는 검수가 끝난 뒤에 꺼냅니다.'); render(); return; }
      S.boxOpen = true; S.fb = null; Scene3D.setView('unbox'); render();
      Scene3D.openBox(() => { Scene3D.setView('table'); good('박스를 열었습니다', '테이프를 뜯고 뚜껑을 열었습니다. 완충재 위에 장비가 비닐에 싸여 있습니다. 이제 입고서와 대조하세요.'); render(); });
      return;
    }
    if (id === 'switch') {
      if (!S.boxOpen) return;
      if (!S.recvOk) { note('먼저 검수하세요', '입고서와 현물 대조를 마치고 제출한 뒤에 장비를 꺼냅니다.'); render(); return; }
      if (S.unpacked) { note('이미 꺼냈습니다', '다음 단계로 넘어가세요.'); render(); return; }
      S.unpacked = true; S.fb = null; Scene3D.setView('unbox'); render();
      Scene3D.unpack(() => { Scene3D.setView('table'); good('장비를 꺼냈습니다', '비닐을 벗기고 작업대 위에 올려 두었습니다.'); render(); });
    }
  }
  function onItem(id) {
    if (STEPS[S.step].id === 'recv') { recvClick(id); return; }
    if (S.held === id) { release(); return; }
    if (!canHold(id)) { const g = GOAL[STEPS[S.step].id]; note('지금 쓸 물건이 아닙니다', typeof g === 'function' ? g(S) : g); render(); return; }
    release(); S.held = id; Scene3D.setHeld(id); S.fb = null; viewFor(true); setTargetsFor(id); render();
  }
  function setTargetsFor(id) {
    const st = STEPS[S.step].id, T = [];
    if (st === 'pdu') ['L', 'R'].forEach(lr => { if (!S.pdu.slot[lr]) { const p = Scene3D.pduSlot(lr); T.push({ id: 'slot' + lr, pos: V3(p.x, 8.2, p.z), size: [1.1, 14.8, 1.1], label: lr === 'L' ? '후면 왼쪽 자리' : '후면 오른쪽 자리' }); } });
    if (st === 'mount') Scene3D.pickU(true);
    if (st === 'power') {
      if (!S.pend) [1, 2].forEach(n => { if (!S.power.used || !S.power.used[n]) T.push({ id: 'psu' + n, pos: Scene3D.swPort('psu' + n), size: [1.8, 0.45, 0.9], label: 'PSU' + n + ' 전원 입구' }); });
      else ['A', 'B'].forEach(side => { for (let k = 0; k < 12; k++) T.push({ id: 'o:' + side + ':' + k, pos: Scene3D.pduPos(side, k), size: [0.6, 0.7, 0.6], label: 'PDU-' + side + ' ' + (k + 1) + '번 콘센트' }); });
    }
    if (st === 'fiber') {
      if (!S.pend) [1, 2].forEach(n => { if (!S.fiber[n].core) T.push({ id: 't' + n, pos: Scene3D.swPort('t' + n), size: [0.6, 0.6, 0.9], label: '업링크 T' + n + ' (Te1/1/' + n + ')' }); });
      else ['CORE-A', 'CORE-B'].forEach(c => T.push({ id: c, pos: Scene3D.corePorts[c], size: [1.3, 0.7, 1.3], label: c + ' 포트' }));
    }
    if (st === 'cli') T.push({ id: 'con', pos: Scene3D.swPort('con'), size: [0.7, 0.6, 0.9], label: 'CON(콘솔) 포트' });
    Scene3D.setTargets(T);
  }
  function onTarget(id) {
    const st = STEPS[S.step].id, held = S.held; if (!held) return;
    if (st === 'pdu') {
      const lr = id.slice(4), it = Scene3D.items[held];
      S.pdu.slot[lr] = held; Scene3D.fly(held, Scene3D.pduSlot(lr), 0, () => { render(); });
      Scene3D.pduLabel(held, (lr === 'L' ? 'A' : 'B') + ' · ' + it.rating + 'A', '#2a3036'); release(); S.fb = null; render(); return;
    }
    if (st === 'power') {
      if (id.indexOf('psu') === 0) { const n = +id.slice(3); S.pend = { cord: held, psu: n }; Scene3D.setSwState({ inlet: [n === 1 || (S.power.used && S.power.used[1]), n === 2 || (S.power.used && S.power.used[2])].map(Boolean) }); setTargetsFor(held); updateHand(); return; }
      const [, side, k] = id.split(':'), p = S.pend;
      S.power.conn[p.cord] = { psu: p.psu, side, out: +k + 1 }; (S.power.used = S.power.used || {})[p.psu] = true;
      Scene3D.power(p.psu, side, +k); Scene3D.items[p.cord].g.visible = false; Scene3D.items[p.cord].placed = true;
      Scene3D.setSwState({ inlet: [!!S.power.used[1], !!S.power.used[2]] }); release(); powerCheck(); render(); return;
    }
    if (st === 'fiber') {
      if (/^t\d$/.test(id)) { S.pend = { fib: held, port: +id[1] }; setTargetsFor(held); updateHand(); return; }
      const port = S.pend.port, fib = held; fiberConnect(port, id, fib); release(); render(); return;
    }
    if (st === 'cli') {
      S.console = true; Scene3D.consoleLine(); Scene3D.items.console.g.visible = false; Scene3D.items.console.placed = true; Scene3D.setSwState({ con: true }); release();
      good('콘솔 연결', '노트북이 스위치 콘솔 포트에 연결됐습니다. 이제 명령을 칠 수 있습니다.'); render();
    }
  }
  function mountRule(u) {
    if (!(u >= 1 && u <= 42)) return { ok: false, t: 'U 범위(1~42)를 벗어났습니다.' };
    if (u === 42) return { ok: false, t: 'U42(맨 위)는 케이블 트레이를 잡는 점검 공간이라 비워 두는 규칙입니다.' };
    if (u < 38) return { ok: false, t: 'U' + u + ': 아래~중간은 서버 ' + SERVERS + '대가 들어갈 자리입니다. 스위치는 서버와 케이블로 이어지니 랙 상단(U38~41)에 둡니다(TOR 구성, 제가 정한 가정).' };
    return { ok: true, t: 'U' + u + ' 설치 가능' };
  }
  function onPlane(u) {
    if (STEPS[S.step].id !== 'mount' || !S.held) return;
    const r = mountRule(u);
    if (S.held === 'rails') {
      if (!r.ok) { fail('이 위치에는 레일을 달 수 없습니다', r.t); release(); render(); return; }
      S.mount.railsU = u; release(); Scene3D.installRails(u, () => { render(); });
      good('레일 설치', 'U' + u + ' 에 좌우 레일을 달았습니다. 이제 스위치를 집어서 같은 U 칸으로 밀어 넣으세요.'); render(); return;
    }
    if (S.held === 'switch') {
      if (u !== S.mount.railsU) { fail('레일이 없는 칸입니다', '레일은 U' + S.mount.railsU + ' 에 달려 있습니다. 같은 칸을 클릭하세요.'); updateHand(); render(); return; }
      const face = S.mount.face; S.mount.placed = true; S.mount.u = u; release();
      Scene3D.mountSwitch(u, face, () => {
        if (face !== 'rear') {
          Scene3D.setView('rails', { u });
          fail('방향이 맞지 않습니다', '포트·전원·팬 면이 <b>전면(콜드 아일)</b>을 향했습니다. 이 장비는 그 면으로 더운 공기를 뿜기 때문에 찬 통로로 열기가 나옵니다. 또 전원 코드가 PDU가 있는 후면까지 앞으로 돌아가야 하고 서버 NIC와도 면이 다릅니다. "빼서 다시 끼우기"를 누르고 방향을 바꾸세요.');
        } else { S.mount.ok = true; Scene3D.setView('rearUp', { u }); good('장착 완료', 'R12 U' + u + ', 포트면이 후면(핫 아일)을 향합니다. 후면으로 돌려 보여 드립니다.'); }
        render();
      });
      render();
    }
  }
  function onHover(h, x, y) {
    const tip = $('#tip'); if (!tip) return;
    if (!h) { tip.hidden = true; Scene3D.ghost(null); return; }
    if (h.t === 'plane') {
      const r = mountRule(h.u); Scene3D.ghost(h.u, r.ok); tip.hidden = false; tip.textContent = r.t;
    } else { Scene3D.ghost(null); tip.hidden = false; tip.textContent = h.label || ''; }
    const b = $('.stage').getBoundingClientRect(); tip.style.left = Math.min(x - b.left + 14, b.width - 240) + 'px'; tip.style.top = (y - b.top + 16) + 'px';
  }

  /* ---------- 단계별 화면 ---------- */
  const VIEW = {
    recv() {
      const done = S.recvOk;
      if (!S.boxOpen) return '<h2>1. 입고·검수</h2><p class="sub">작업대 위에 박스가 도착했습니다.</p>' + how(['3D 작업대 왼쪽의 <b>갈색 박스를 클릭</b>해서 개봉합니다.', '안의 장비와 부속품을 입고서와 대조합니다.', '이상이 없으면 장비를 꺼내 작업대에 올려 둡니다.']) +
        '<div class="why"><b>왜 먼저 열어 보나요</b> 설치 전에 입고서와 현물이 맞는지 확인해야 합니다. 설치한 뒤에 시리얼이 다르거나 부품이 빠진 걸 발견하면 반품·교체 책임이 불분명해집니다.</div>' + fbHtml();
      return '<h2>1. 입고·검수</h2><p class="sub">박스 안 현물을 입고서와 한 줄씩 대조하세요.</p>' +
        '<table class="cmp"><tr><th>항목</th><th>입고서</th><th>박스 현물</th><th>판정</th></tr>' +
        S.rows.map(r => '<tr><td>' + r.name + '</td><td class="mono">' + esc(r.note) + '</td><td class="mono">' + esc(r.box) + '</td><td>' +
          '<button class="flag' + (S.flags[r.id] ? ' on' : '') + '" data-act="flag" data-id="' + r.id + '" type="button" aria-pressed="' + !!S.flags[r.id] + '"' + (done ? ' disabled' : '') + '>' + (S.flags[r.id] ? '이상' : '정상') + '</button></td></tr>').join('') +
        '</table><p class="mini">다른 점이 있는 줄만 "이상"으로 바꾸세요. 모두 같으면 그대로 제출합니다.</p>' +
        (done ? how(['검수가 끝났습니다.', '3D에서 <b>비닐에 싸인 스위치를 클릭</b>해서 상자 밖으로 꺼냅니다.']) : '') +
        '<div class="row">' + (done ? '<button class="btn" data-act="next" type="button"' + (S.unpacked ? '' : ' disabled') + '>' + (S.unpacked ? '다음: PDU 설치' : '장비를 꺼내면 열립니다') + '</button>' : '<button class="btn" data-act="recv-submit" type="button">검수 결과 제출</button>') + '</div>' +
        fbHtml() + (done ? '' : hintBtn('글자를 한 자씩 읽어 보세요. 시리얼은 한 글자만 달라도 다른 장비입니다. 개수도 입고서와 같은지 보세요.'));
    },
    pdu() {
      const P = S.pdu, I = S.pduIn || {}, v = (id, ph) => '<input id="' + id + '" type="number" step="0.1" min="0" value="' + (I[id] == null ? '' : I[id]) + '" placeholder="' + ph + '" style="width:92px"' + (P.ok ? ' disabled' : '') + '>';
      const L = P.slot.L && Scene3D.items[P.slot.L], R = P.slot.R && Scene3D.items[P.slot.R];
      const both = !!(L && R);
      return '<h2>2. PDU(멀티탭) 설치</h2><p class="sub">랙 뒤쪽 보관대에 정격이 다른 PDU가 놓여 있습니다. 필요한 걸 골라 직접 답니다.</p>' +
        how(['아래 ①에서 전류를 계산해 필요한 정격을 정합니다.', '3D에서 그 정격의 PDU를 <b>클릭해서 집습니다</b>.', '랙 후면의 노란 자리(왼쪽/오른쪽)를 클릭해서 답니다. 2대 모두.', '③ 경보 임계값을 넣고 확인합니다.']) +
        '<div class="why"><b>PDU란</b> 랙 안에서 쓰는 전원 멀티탭입니다. 전원 계통이 두 개(A/B)라 2대를 답니다.</div>' +
        '<h3>작업 요청서 (가상)</h3><table class="cmp" style="font-size:13px">' +
        '<tr><td>전압</td><td>단상 ' + VOLT + 'V</td></tr>' +
        '<tr><td>이 랙의 예정 부하</td><td>서버 ' + SERVERS + '대 × ' + SERVER_W + 'W + 스위치 1대 ' + SW_W + 'W = <b>' + LOAD_W.toLocaleString() + 'W</b></td></tr>' +
        '<tr><td>전원 구성</td><td>A/B 이중화. 평소엔 반반 나눠 씀</td></tr>' +
        '<tr><td>안전 기준</td><td>PDU 정격 전류의 <b>80%</b>까지만 사용</td></tr>' +
        '<tr><td>경보 설정</td><td>정격의 70%에서 경고, 80%에서 위험</td></tr>' +
        '<tr><td>설치 위치</td><td>PDU-A 후면 <b>왼쪽</b>, PDU-B 후면 <b>오른쪽</b></td></tr></table>' +
        '<h3>① 전류 계산 &nbsp;<span class="mini">전류(A) = 전력(W) ÷ 전압(V)</span></h3>' +
        '<div class="row">총 부하 ' + v('p-total', 'A') + ' A</div><div class="row">평소 PDU 1대 부하 ' + v('p-norm', 'A') + ' A</div><div class="row">한쪽이 꺼졌을 때 남은 PDU 1대 부하 ' + v('p-fail', 'A') + ' A</div>' +
        '<h3>② 설치된 PDU</h3><p class="mini">왼쪽(A): <b>' + (L ? L.rating + 'A' : '아직 없음') + '</b> &nbsp; 오른쪽(B): <b>' + (R ? R.rating + 'A' : '아직 없음') + '</b></p>' +
        (L || R ? '<div class="row">' + (P.ok ? '' : '<button class="btn ghost" data-act="pdu-reset" type="button">모두 다시 꺼내기</button>') + '</div>' : '') +
        '<h3>③ 경보 임계값 (PDU 설정 화면)</h3><div class="row">경고 ' + v('p-warn', 'A') + ' A &nbsp; 위험 ' + v('p-crit', 'A') + ' A</div>' +
        '<div class="row">' + (P.ok ? '<button class="btn" data-act="next" type="button">다음: 랙 마운트</button>' : '<button class="btn" data-act="pdu-do" type="button"' + (both ? '' : ' disabled') + '>' + (both ? '계산과 설치 확인' : 'PDU 2대를 먼저 설치하세요') + '</button>') + '</div>' +
        fbHtml() + (P.ok ? '' : hintBtn('정상 시에는 두 PDU가 부하를 반반 나눠 갖고, 한쪽이 꺼지면 남은 한 대가 전부 감당합니다. 그때 부하가 "정격 × 0.8"을 넘으면 안 됩니다.'));
    },
    mount() {
      const m = S.mount;
      return '<h2>3. 랙 마운트</h2><p class="sub">빈 랙에 레일을 달고, 그 위로 스위치를 밀어 넣습니다.</p>' +
        how(['작업대의 <b>레일 킷</b>을 클릭해서 집고, 랙 전면에서 달 U 칸을 클릭합니다.', '아래에서 스위치의 <b>포트·전원 면을 어느 쪽으로 향할지</b> 정합니다.', '<b>스위치</b>를 집고, 레일을 단 같은 U 칸을 클릭합니다.']) +
        '<div class="why"><b>이 장비의 특징 (제가 정한 가상 모델)</b> 1U 스위치. 포트 48개·전원(PSU 2개)·팬이 <b>한쪽 면</b>에 몰려 있고, 그 면으로 더운 공기를 내보냅니다. 반대면이 흡기입니다.</div>' +
        '<h3>포트·전원이 있는 면 방향</h3><div class="row"><label><input type="radio" name="face" value="front"' + (m.face === 'front' ? ' checked' : '') + (m.placed ? ' disabled' : '') + ' data-act="face"> 전면(콜드 아일)</label>' +
        '<label><input type="radio" name="face" value="rear"' + (m.face === 'rear' ? ' checked' : '') + (m.placed ? ' disabled' : '') + ' data-act="face"> 후면(핫 아일, 서버 NIC가 있는 쪽)</label></div>' +
        '<ul class="chk"><li class="' + (m.railsU ? 'ok' : '') + '">레일 킷 설치' + (m.railsU ? ' (U' + m.railsU + ')' : '') + '</li><li class="' + (m.ok ? 'ok' : '') + '">스위치 장착' + (m.ok ? ' (포트면 후면)' : '') + '</li></ul>' +
        '<div class="row">' + (m.ok ? '<button class="btn" data-act="next" type="button">다음: 전원 연결</button>' : (m.placed ? '<button class="btn ghost" data-act="mount-redo" type="button">빼서 다시 끼우기</button>' : '')) + '</div>' +
        fbHtml() + (m.ok ? '' : hintBtn('빈 랙입니다. 아래쪽은 무거운 서버 ' + SERVERS + '대가 들어갈 자리입니다. 스위치는 서버와 연결되니 위쪽에 두는 "TOR(Top of Rack)" 구성이 일반적입니다. 면은 "더운 공기가 나가는 면"이 어느 aisle을 향해야 하는지 생각해 보세요.'));
    },
    power() {
      const c = S.power.conn, line = id => c[id] ? 'PSU' + c[id].psu + ' → PDU-' + c[id].side + ' ' + c[id].out + '번' : '아직 연결 안 함';
      return '<h2>4. 전원 연결</h2><p class="sub">전원 코드 2개로 스위치의 PSU 2개를 PDU에 연결합니다. 후면에서 왼쪽이 PDU-A, 오른쪽이 PDU-B입니다.</p>' +
        how(['작업대의 <b>전원 코드</b>를 클릭해서 집습니다.', '스위치의 <b>PSU 전원 입구</b>(노란 칸)를 클릭합니다.', '이어서 <b>PDU 콘센트</b>(노란 칸)를 클릭합니다.', '코드 2개를 서로 다른 PDU에 나눠 꽂습니다.']) +
        '<div class="why"><b>전류</b> 이 스위치는 ' + SW_W + 'W 입니다. PSU 2개가 반반 나눠 쓰므로 각 PSU는 약 ' + (SW_W / 2 / VOLT).toFixed(2) + 'A 입니다.</div>' +
        '<ul class="chk"><li class="' + (c.cord1 ? 'ok' : '') + '">코드 1: ' + line('cord1') + '</li><li class="' + (c.cord2 ? 'ok' : '') + '">코드 2: ' + line('cord2') + '</li></ul>' +
        '<div class="row">' + (S.power.ok ? '<button class="btn" data-act="next" type="button">다음: 광 케이블링</button>' : (c.cord1 || c.cord2 ? '<button class="btn ghost" data-act="power-reset" type="button">코드 모두 뽑기</button>' : '')) + '</div>' +
        fbHtml() + (S.power.ok ? '' : hintBtn('PDU는 서로 다른 전원 계통(A/B)입니다. 한쪽 계통이 정전·차단기 작업으로 꺼져도 장비가 살아 있으려면 PSU 두 개를 어떻게 나눠야 할까요?'));
    },
    fiber() {
      const f = S.fiber;
      const row = i => {
        const x = f[i], conn = !!x.core, up = conn && !x.wrong;
        return '<div class="row"><b style="width:56px">T' + i + '</b>' + (conn ? '<span class="mono">' + x.core + '</span> <span class="mini">링크 ' + (up ? '<b style="color:var(--ok)">UP</b>' : '<b style="color:var(--bad)">DOWN</b>') + '</span>' +
          (up ? '' : '<button class="btn ghost" data-act="flip" data-i="' + i + '" type="button">Tx/Rx 뒤집기</button>') +
          '<label class="mini"><input type="checkbox" data-act="label" data-i="' + i + '"' + (x.label ? ' checked' : '') + '> 양끝 라벨</label>' : '<span class="mini">아직 연결 안 함</span>') + '</div>';
      };
      const ready = f[1].core && f[2].core && f[1].core !== f[2].core && !f[1].wrong && !f[2].wrong && f[1].label && f[2].label;
      return '<h2>5. 광 케이블링</h2><p class="sub">업링크 T1(Te1/1/1), T2(Te1/1/2)를 옆 랙의 코어 스위치에 광으로 연결합니다.</p>' +
        how(['작업대의 <b>광 케이블</b>(노란 코일)을 클릭해서 집습니다.', '스위치 <b>업링크 포트 T1/T2</b>(노란 칸)를 클릭합니다.', '이어서 <b>코어 스위치 포트</b>(CORE-A 또는 CORE-B)를 클릭합니다.', '링크 상태를 확인하고, 라벨을 붙입니다.']) +
        '<div class="why"><b>알아둘 것</b> 광은 한 가닥이 Tx(송신), 한 가닥이 Rx(수신)입니다. 한쪽의 Tx는 반대쪽 Rx로 가야 합니다. 노란 선이 광 케이블입니다.</div>' +
        row(1) + row(2) + '<p class="mini">링크가 DOWN이면 케이블이 연결돼도 불이 안 들어옵니다. 원인을 찾아 고치세요.</p>' +
        '<div class="row">' + (ready ? '<button class="btn" data-act="fiber-done" type="button">다음: 콘솔 설정</button>' : '<button class="btn" disabled type="button">연결·링크·라벨을 모두 마치면 열립니다</button>') + (f[1].core && f[2].core && f[1].core === f[2].core ? '<button class="btn ghost" data-act="fiber-reset" type="button">광 케이블 모두 뽑기</button>' : '') + '</div>' +
        fbHtml() + hintBtn('한쪽 링크만 DOWN이라면 그 케이블의 Tx/Rx가 뒤집혔을 가능성이 큽니다. 코어 두 대에 서로 다르게 연결해야 코어 한 대가 죽어도 살아 있습니다.');
    },
    cli() {
      const R = LabCLI.REQ;
      return '<h2>6. 콘솔 설정</h2><p class="sub">콘솔 케이블로 노트북을 스위치에 연결하고, 작업 요청서대로 설정한 뒤 저장하세요. (가상 장비, 실제 접속 아님)</p>' +
        (S.console ? '' : how(['작업대의 <b>콘솔 케이블</b>(파란 코일)을 클릭해서 집습니다.', '스위치의 <b>CON 포트</b>(노란 칸)를 클릭합니다.']) + fbHtml()) +
        '<h3>작업 요청서</h3><table class="cmp mono" style="font-size:12px">' +
        '<tr><td>호스트명</td><td>' + R.host + '</td></tr><tr><td>관리 VLAN</td><td>99 (MGMT), 서버 VLAN 100</td></tr><tr><td>관리 IP</td><td>' + R.ip + ' / ' + R.mask + '</td></tr>' +
        '<tr><td>게이트웨이</td><td>' + R.gw + '</td></tr><tr><td>업링크</td><td>Te1/1/1(CORE-A), Te1/1/2(CORE-B): trunk, VLAN 99·100</td></tr><tr><td>SNMP</td><td>' + R.community + ' (읽기 전용)</td></tr></table>' +
        '<h3>진행</h3><ul class="chk" id="tasks"></ul>' +
        '<div class="term" id="term" tabindex="0" aria-label="가상 터미널 출력"></div><div class="termin"><span id="pr"></span><input id="ci" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="명령 입력"' + (S.console ? '' : ' disabled placeholder="콘솔 케이블을 먼저 연결하세요"') + '></div>' +
        '<p class="mini">위/아래 화살표로 이전 명령 · <code>?</code> 로 명령 도움말 · <code>conf t</code> 처럼 줄여 써도 됩니다.</p>' +
        '<div class="row"><button class="btn" id="cli-next" data-act="cli-next" type="button" disabled>다음: 관제 연동</button></div>' +
        '<details><summary>쓸 수 있는 명령 모아보기</summary><div class="why mono" style="font-size:12px">enable<br>configure terminal<br>hostname &lt;이름&gt;<br>vlan 99 → name MGMT<br>interface vlan 99 → ip address … / no shutdown<br>ip default-gateway &lt;IP&gt;<br>interface range te1/1/1 - 2 → switchport mode trunk / switchport trunk allowed vlan 99,100 / description …<br>snmp-server community … ro<br>end → write memory<br>확인: show ip interface brief · show interfaces status · show lldp neighbors · show interfaces te1/1/1 transceiver · ping &lt;IP&gt;</div></details>' + (S.console ? fbHtml() : '');
    },
    mon() {
      const M = S.mon;
      return '<h2>7. 관제 연동</h2><p class="sub">관제 시스템에 새 장비를 등록하고, 트래픽 그래프가 들어오는지 확인합니다.</p>' +
        '<div class="why"><b>순서</b> 등록 → 검증(ping, SNMP 응답) → 5분 대기 후 첫 그래프. 설정한 값과 등록한 값이 한 글자라도 다르면 데이터가 안 들어옵니다.</div>' +
        '<h3>관제 등록 화면</h3><table class="cmp">' +
        '<tr><td>장비명</td><td><input id="m-name" type="text" value="' + esc(M.reg ? M.v.name : '') + '" placeholder="콘솔에서 정한 이름" style="width:100%"></td></tr>' +
        '<tr><td>관리 IP</td><td><input id="m-ip" type="text" value="' + esc(M.reg ? M.v.ip : '') + '" placeholder="x.x.x.x" style="width:100%"></td></tr>' +
        '<tr><td>SNMP community</td><td><input id="m-comm" type="text" value="' + esc(M.reg ? M.v.comm : '') + '" style="width:100%"></td></tr>' +
        '<tr><td>수집 간격</td><td><select id="m-int"><option>1분</option><option selected>5분</option><option>10분</option></select></td></tr>' +
        '<tr><td>경고 기준(회선 사용률)</td><td><select id="m-thr"><option>60%</option><option>70%</option><option selected>80%</option><option>95%</option></select></td></tr></table>' +
        '<div class="row"><button class="btn" data-act="mon-reg" type="button">등록</button><button class="btn ghost" data-act="mon-verify" type="button"' + (M.reg ? '' : ' disabled') + '>검증 실행</button>' +
        '<button class="btn ghost" data-act="cli-back" type="button">콘솔로 돌아가기</button></div>' +
        '<ul class="chk" id="vlist">' + (M.checks || []).map(c => '<li class="' + (c.ok ? 'ok' : '') + '">' + c.t + '</li>').join('') + '</ul>' +
        '<canvas id="gr" class="graph" width="720" height="260" aria-label="트래픽 그래프"></canvas>' +
        '<div class="row">' + (M.ok ? '<button class="btn" data-act="next" type="button">작업 마무리</button>' : '') + '</div>' + fbHtml();
    },
    done() {
      const ms = S.tEnd - S.t0, m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
      let best = ''; try { const b = JSON.parse(localStorage.getItem('idclab-best') || 'null'); if (b) best = '<p class="mini">내 최고 기록: ' + b.time + ' · 실수 ' + b.miss + '</p>'; } catch (e) {}
      return '<h2>완료</h2><p class="sub">장비가 관제에 정상적으로 잡혔습니다.</p><div class="score"><div>걸린 시간<b>' + m + '분 ' + s + '초</b></div><div>실수<b>' + S.miss + '</b></div><div>힌트 사용<b>' + S.hints + '</b></div><div>시나리오<b style="font-size:15px">' + ({ clean: '이상 없음', serial: '시리얼 불일치', missing: '부품 누락', damaged: '외관 파손' }[S.scen]) + '</b></div></div>' + best +
        '<h3>작업 기록 (복사해서 노션에 붙여 넣으세요)</h3><pre class="term" id="rep" style="height:auto;white-space:pre-wrap">' + esc(report()) + '</pre>' +
        '<div class="row"><button class="btn" data-act="copy" type="button">작업 기록 복사</button><button class="btn ghost" data-act="restart" type="button">다시 해보기 (시나리오 바뀜)</button></div>';
    },
  };

  function report() {
    const m = S.mount, p = S.power, f = S.fiber, d = S.dev, c = p.conn;
    return ['[신규 장비 설치 작업 기록 - 가상 실습]',
      '장비: NX-4824T (가상) / 시리얼 ' + SERIAL + ' / 입고 검수: ' + ({ clean: '이상 없음', serial: '시리얼 불일치 → 교체 접수 가정', missing: 'SFP+ 1개 누락 → 추가 요청 가정', damaged: '랙 귀 휘어짐 → 교체 접수 가정' }[S.scen]),
      'PDU: PDU-A(후면 좌)·PDU-B(후면 우) 각 ' + S.pdu.rate + 'A, 경고 ' + S.pdu.warn + 'A / 위험 ' + S.pdu.crit + 'A (예정 부하 ' + LOAD_A.toFixed(1) + 'A, 한쪽 장애 시에도 한도 ' + (S.pdu.rate * 0.8).toFixed(1) + 'A 이내)',
      '위치: R12 U' + m.u + ' (포트면 후면), 레일 킷 사용', '전원: ' + Object.keys(c).map(k => 'PSU' + c[k].psu + ' → PDU-' + c[k].side + ' ' + c[k].out + '번').join(', '),
      '업링크: Te1/1/1 ↔ ' + f[1].core + ' Te1/0/12, Te1/1/2 ↔ ' + f[2].core + ' Te1/0/12 (광 극성 확인 완료)',
      '설정: ' + d.host + ', Vlan99 ' + LabCLI.REQ.ip + '/24, GW ' + LabCLI.REQ.gw + ', 업링크 trunk(99,100), SNMP RO, write memory 완료',
      '관제: 등록, ping·SNMP 응답 확인, 5분 후 트래픽 그래프 수신 확인'].join('\n');
  }

  /* ---------- 단계별 검증 ---------- */
  function powerCheck() {
    const c = S.power.conn, k = Object.keys(c); if (k.length < 2) { note('코드 1개 연결됨', '남은 코드 1개도 연결하세요.'); return; }
    if (c[k[0]].side === c[k[1]].side) {
      Scene3D.setSwState({ psuLed: true, sys: 'boot' });
      fail('두 PSU가 같은 PDU에 연결됐습니다', '이러면 PDU-' + c[k[0]].side + ' 계통이 꺼지는 순간 스위치가 통째로 꺼집니다. 이중화 전원을 쓰는 이유가 사라집니다. "코드 모두 뽑기"를 누르고 PSU1과 PSU2를 서로 다른 PDU(A/B)에 나눠 꽂으세요.'); return;
    }
    S.power.ok = true; Scene3D.setSwState({ psuLed: true, sys: 'boot' });
    good('전원 이중화 완료', Object.keys(c).map(x => 'PSU' + c[x].psu + '→PDU-' + c[x].side).join(', ') + '. 각 PDU 부하 약 ' + (SW_W / 2 / VOLT).toFixed(2) + 'A (사용 한도 ' + (S.pdu.rate * 0.8).toFixed(1) + 'A). 전원이 들어가 부팅 중입니다(SYS 램프가 주황). 한 계통이 꺼져도 장비는 살아 있습니다.');
  }
  function fiberConnect(port, core, fibId) {
    const f = S.fiber[port]; f.core = core; f.wrong = S.fiber.polBad[port - 1]; S.fiber.conn[fibId] = port;
    Scene3D.fiber(port, core); Scene3D.items[fibId].g.visible = false; Scene3D.items[fibId].placed = true; syncLeds();
    if (f.wrong) fail('T' + port + ' 링크가 올라오지 않습니다', '케이블은 연결됐는데 LED가 꺼져 있습니다. 광 Tx/Rx가 뒤집혔을지 모릅니다. <b>Tx/Rx 뒤집기</b>를 눌러 보세요.');
    else good('T' + port + ' 링크 UP', core + ' 와 연결되어 포트 LED가 초록색입니다.');
    const o = port === 1 ? 2 : 1;
    if (S.fiber[o].core && S.fiber[o].core === core) fail('두 업링크가 같은 코어에 연결됐습니다', '코어 한 대가 죽으면 이 스위치는 통째로 단절됩니다. 한 쪽은 CORE-A, 다른 쪽은 CORE-B로 연결해야 합니다. "광 케이블 모두 뽑기"로 다시 하세요.');
  }
  function syncLeds() { Scene3D.setSwState({ up: [!!linkOf('Te1/1/1').phys, !!linkOf('Te1/1/2').phys] }); }
  function savePduIn() { ['p-total', 'p-norm', 'p-fail', 'p-warn', 'p-crit'].forEach(k => { const e = $('#' + k); if (e) S.pduIn[k] = e.value; }); }

  /* ---------- 클릭 처리 ---------- */
  document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const A = ACT[el.dataset.act]; if (A) A(el, +el.dataset.i); });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    if (el.dataset.act === 'face') S.mount.face = el.value;
    if (el.dataset.act === 'label') { S.fiber[+el.dataset.i].label = el.checked; render(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.held) { release(); render(); } });

  const ACT = {
    hint() { S.hints++; const b = $('#hintbox'); if (b) b.hidden = false; },
    goto(el, i) { if (i !== S.step) go(i); },
    next() { go(S.step + 1); },
    flag(el) { const id = el.dataset.id; S.flags[id] = !S.flags[id]; render(); },
    'recv-submit'() {
      const exp = { clean: [], serial: ['serial'], missing: ['sfp'], damaged: ['look'] }[S.scen];
      const got = Object.keys(S.flags).filter(k => S.flags[k]);
      const missed = exp.filter(k => !got.includes(k)), extra = got.filter(k => !exp.includes(k));
      if (!missed.length && !extra.length) {
        S.recvOk = true;
        good(exp.length ? '이상 항목을 정확히 찾았습니다' : '모두 정상입니다', exp.length ? '현장에서는 <b>사진을 찍고 입고 담당·공급사에 반품/교체(RMA)를 접수</b>합니다. 이 실습에서는 교체품이 도착했다고 보고 계속 진행합니다. 이제 장비를 상자에서 꺼내세요.' : '입고서와 현물이 일치합니다. 이제 장비를 상자에서 꺼내세요.');
      } else fail('검수 결과가 맞지 않습니다', (missed.length ? '놓친 항목: <b>' + missed.map(k => S.rows.find(r => r.id === k).name).join(', ') + '</b>. ' : '') + (extra.length ? '정상인데 이상으로 표시한 항목: <b>' + extra.map(k => S.rows.find(r => r.id === k).name).join(', ') + '</b>. ' : '') + '입고서와 박스 값을 다시 비교하세요.');
      render();
    },
    'pdu-do'() {
      savePduIn();
      const n = id => parseFloat(S.pduIn[id]), near = (a, b, t) => Math.abs(a - b) <= t, f = (t, m) => { fail(t, m); render(); };
      const tot = n('p-total'), nor = n('p-norm'), fl = n('p-fail'), warn = n('p-warn'), crit = n('p-crit');
      const L = Scene3D.items[S.pdu.slot.L], R = Scene3D.items[S.pdu.slot.R];
      if (!near(tot, LOAD_A, 0.3)) return f('총 부하 전류가 맞지 않습니다', '전류(A) = 전력(W) ÷ 전압(V) 입니다. 총 전력은 ' + SERVERS + '×' + SERVER_W + ' + ' + SW_W + ' = ' + LOAD_W + 'W, 전압은 ' + VOLT + 'V 입니다.');
      if (!near(nor, LOAD_A / 2, 0.2)) return f('평소 PDU 1대 부하가 맞지 않습니다', 'A/B 두 대가 부하를 반반 나눠 가지므로 총 부하의 절반입니다.');
      if (!near(fl, LOAD_A, 0.3)) return f('한쪽 장애 시 부하가 맞지 않습니다', '한쪽 PDU(전원 계통)가 꺼지면 남은 PDU 1대가 총 부하를 전부 감당합니다.');
      if (L.rating !== R.rating) return f('두 PDU의 정격이 다릅니다', '왼쪽 ' + L.rating + 'A, 오른쪽 ' + R.rating + 'A 입니다. A/B는 같은 정격이어야 한쪽이 꺼졌을 때 남은 쪽이 같은 부하를 감당할 수 있습니다. "모두 다시 꺼내기"로 다시 고르세요.');
      const rate = L.rating;
      if (LOAD_A > rate * 0.8) return f(rate + 'A PDU로는 부족합니다', '사용 한도는 ' + rate + 'A × 80% = <b>' + (rate * 0.8).toFixed(1) + 'A</b> 인데, 한쪽 장애 시 부하는 ' + LOAD_A.toFixed(1) + 'A 입니다. 이 상태에서 한 계통이 꺼지면 남은 PDU의 차단기가 내려가 랙 전체가 정전될 수 있습니다. "모두 다시 꺼내기"로 더 큰 정격을 고르세요.');
      if (!near(warn, rate * 0.7, 0.3) || !near(crit, rate * 0.8, 0.3)) return f('경보 임계값이 맞지 않습니다', rate + 'A 기준 경고 = ' + rate + ' × 70% = ' + (rate * 0.7).toFixed(1) + 'A, 위험 = ' + rate + ' × 80% = ' + (rate * 0.8).toFixed(1) + 'A 입니다.');
      S.pdu.ok = true; S.pdu.rate = rate; S.pdu.warn = warn; S.pdu.crit = crit;
      Scene3D.pduAssign('A', S.pdu.slot.L); Scene3D.pduAssign('B', S.pdu.slot.R);
      Scene3D.pduLabel(S.pdu.slot.L, 'PDU-A ' + rate + 'A', '#c8553d'); Scene3D.pduLabel(S.pdu.slot.R, 'PDU-B ' + rate + 'A', '#3a78c4');
      good('PDU 설치 완료', '각 PDU ' + rate + 'A, 경고 ' + warn + 'A / 위험 ' + crit + 'A. 한쪽 장애 시에도 ' + LOAD_A.toFixed(1) + 'A ≤ 사용 한도 ' + (rate * 0.8).toFixed(1) + 'A 로 버팁니다.'); render();
    },
    'pdu-reset'() {
      ['L', 'R'].forEach(lr => { const id = S.pdu.slot[lr]; if (id) { Scene3D.home(id); Scene3D.pduLabel(id, Scene3D.items[id].rating + 'A', 'rgba(255,255,255,.9)', '#1b2127'); } });
      S.pdu.slot = {}; S.fb = null; release(); render();
    },
    'mount-redo'() { viewFor(false); Scene3D.home('switch'); Scene3D.mounted = null; S.mount.placed = false; S.mount.u = null; S.fb = null; render(); },
    'power-reset'() {
      viewFor(false);
      Scene3D.clearCables('power'); S.power = { conn: {}, ok: false, used: {} }; Scene3D.setSwState({ inlet: [false, false], psuLed: false, sys: 'off' });
      ['cord1', 'cord2'].forEach(id => { Scene3D.items[id].g.visible = true; Scene3D.items[id].placed = false; }); S.fb = null; release(); render();
    },
    flip(el, i) { S.fiber[i].wrong = !S.fiber[i].wrong; syncLeds(); S.fiber[i].wrong ? fail('아직 DOWN입니다', 'T' + i + ' 링크가 여전히 DOWN입니다.') : good('Tx/Rx를 뒤집었습니다', 'T' + i + ' 링크가 UP으로 올라왔습니다.'); render(); },
    'fiber-reset'() {
      viewFor(false);
      Scene3D.clearCables('fiber'); S.fiber[1] = { core: '', wrong: false, label: false }; S.fiber[2] = { core: '', wrong: false, label: false }; S.fiber.conn = {}; syncLeds();
      ['fib1', 'fib2'].forEach(id => { Scene3D.items[id].g.visible = true; Scene3D.items[id].placed = false; }); S.fb = null; release(); render();
    },
    'fiber-done'() { Scene3D.setSwState({ sys: 'ok' }); go(IX('cli')); },
    'cli-next'() { go(IX('mon')); },
    'cli-back'() { go(IX('cli')); },
    'mon-reg'() {
      const v = { name: $('#m-name').value.trim(), ip: $('#m-ip').value.trim(), comm: $('#m-comm').value.trim() };
      const d = S.dev, svi = d.svi[99] || {}, bad = [];
      if (v.name !== d.host) bad.push('장비명이 장비의 hostname(' + d.host + ')과 다릅니다');
      if (v.ip !== svi.ip) bad.push('관리 IP가 장비에 설정된 값(' + (svi.ip || '없음') + ')과 다릅니다');
      if (!d.snmp.includes(v.comm)) bad.push('community가 장비 설정과 다릅니다');
      S.mon.v = v;
      if ($('#m-int').value !== '5분') bad.push('수집 간격은 이 센터 표준인 5분이어야 합니다');
      if ($('#m-thr').value !== '80%') bad.push('경고 기준은 사용률 80%가 표준입니다');
      if (bad.length) { S.mon.reg = false; fail('등록 값이 맞지 않습니다', '<ul>' + bad.map(b => '<li>' + b + '</li>').join('') + '</ul>'); render(); return; }
      S.mon.reg = true; S.mon.checks = []; good('등록되었습니다', '이제 검증을 실행하세요.'); render();
    },
    'mon-verify'() {
      const d = S.dev, ip = S.mon.v.ip, ck = [];
      const ping = d.reach(ip) || (d.svi[99] && d.svi[99].ip === ip && d.reach(LabCLI.REQ.gw));
      ck.push({ ok: !!ping, t: '관제 서버 → ' + ip + ' ping ' + (ping ? '응답' : '실패') });
      const snmp = !!ping && d.snmp.includes(S.mon.v.comm);
      ck.push({ ok: snmp, t: 'SNMP 응답 ' + (snmp ? '정상 (ifHCInOctets 수집)' : '없음') });
      S.mon.checks = ck;
      if (!ping) { fail('장비에 닿지 않습니다', '관리 IP·게이트웨이·업링크 trunk(VLAN 99 허용)·링크 상태 중 하나가 틀립니다. <b>콘솔로 돌아가서</b> show ip interface brief, show interfaces status, ping으로 어디서 막히는지 확인하세요.'); render(); return; }
      if (!snmp) { fail('SNMP 응답이 없습니다', 'community가 장비 설정과 일치하는지 확인하세요.'); render(); return; }
      good('검증 통과', '5분 뒤 첫 수집을 기다립니다…'); render(); S.mon.t = 'run';
      let n = 0; drawGraph(true, 0);
      const iv = setInterval(() => {
        n++; drawGraph(true, n);
        if (n >= 12) { clearInterval(iv); S.mon.ok = true; good('그래프가 들어옵니다', '5분 간격 첫 12개 샘플(1시간치)이 수집됐습니다. 두 업링크 모두 값이 들어오는지 확인하세요.'); if (STEPS[S.step].id === 'mon') { render(); drawGraph(true, 12); } }
      }, 160);
    },
    copy() { const t = report(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => alert('복사했습니다.'), () => { const r = document.createRange(); r.selectNodeContents($('#rep')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); },
    restart() { fresh(); go(0); },
  };
  ACT.next = (orig => function () {
    if (STEPS[S.step].id === 'mon') { S.tEnd = Date.now(); try { const ms = S.tEnd - S.t0, b = JSON.parse(localStorage.getItem('idclab-best') || 'null'); const t = Math.floor(ms / 60000) + '분 ' + (Math.floor(ms / 1000) % 60) + '초'; if (!b || S.miss < b.miss || (S.miss === b.miss && ms < b.ms)) localStorage.setItem('idclab-best', JSON.stringify({ ms, miss: S.miss, time: t })); } catch (e) {} }
    orig();
  })(ACT.next);

  /* ---------- 터미널 ---------- */
  function cliMount() {
    const term = $('#term'), inp = $('#ci'), d = S.dev;
    const paint = () => {
      term.innerHTML = S.cliLog.map(l => l.p ? '<span class="p">' + esc(l.p) + '</span> ' + esc(l.c) : esc(l.o)).join('\n');
      term.scrollTop = term.scrollHeight; $('#pr').textContent = d.prompt();
      const ts = d.tasks(); $('#tasks').innerHTML = ts.map(t => '<li class="' + (t.ok ? 'ok' : '') + '">' + esc(t.label) + '</li>').join('');
      $('#cli-next').disabled = !ts.every(t => t.ok);
    };
    if (!S.cliLog.length) S.cliLog.push({ o: '--- 콘솔 연결됨 (9600 8N1, 가상) ---\n엔터를 누르면 시작합니다. 먼저 enable 이 필요합니다.\n' });
    paint(); if (S.console) inp.focus();
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const c = inp.value; S.cliLog.push({ p: d.prompt(), c });
        if (c.trim()) { S.hist.push(c); S.histIdx = S.hist.length; }
        d.run(c).forEach(o => S.cliLog.push({ o })); inp.value = ''; paint();
      } else if (e.key === 'ArrowUp') { if (S.histIdx > 0) inp.value = S.hist[--S.histIdx]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { inp.value = S.histIdx < S.hist.length - 1 ? S.hist[++S.histIdx] : (S.histIdx = S.hist.length, ''); e.preventDefault(); }
    });
    term.addEventListener('click', () => S.console && inp.focus());
  }

  /* ---------- 그래프 ---------- */
  function drawGraph(live, n) {
    const cv = $('#gr'); if (!cv) return; const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = '#0b0e12'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#26303a'; g.lineWidth = 1; g.fillStyle = '#6f7b87'; g.font = '16px sans-serif';
    [0, 20, 40, 60, 80, 100].forEach(p => { const y = h - 24 - p / 100 * (h - 44); g.beginPath(); g.moveTo(40, y); g.lineTo(w - 6, y); g.stroke(); g.fillText(p + '%', 4, y + 5); });
    g.strokeStyle = '#e2674d'; g.setLineDash([6, 5]); const y80 = h - 24 - 0.8 * (h - 44); g.beginPath(); g.moveTo(40, y80); g.lineTo(w - 6, y80); g.stroke(); g.setLineDash([]);
    if (!live) { g.fillStyle = '#6f7b87'; g.fillText('검증을 통과하면 여기에 그래프가 나타납니다', 120, h / 2); return; }
    [['#6fb1e8', 22, 5], ['#e0a030', 14, 3]].forEach((s, k) => {
      g.strokeStyle = s[0]; g.lineWidth = 2.5; g.beginPath();
      for (let i = 0; i < n; i++) { const v = s[1] + 9 * Math.sin(i * 0.7 + k * 2) + (i * 37 % 7) * 0.6, x = 40 + i * ((w - 60) / 11), y = h - 24 - v / 100 * (h - 44); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    });
    g.fillStyle = '#6fb1e8'; g.fillText('Te1/1/1 (CORE-A)', 50, 20); g.fillStyle = '#e0a030'; g.fillText('Te1/1/2 (CORE-B)', 230, 20);
  }

  /* ---------- 시작 ---------- */
  document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => { const u = S.mount.railsU || 40; Scene3D.setView(b.dataset.view, { u }); }));
  $('#restart').addEventListener('click', () => { if (confirm('처음부터 다시 할까요?')) ACT.restart(); });
  Scene3D.init($('#cv'), { item: onItem, target: onTarget, plane: onPlane, hover: onHover, empty: () => { if (S.held) { release(); render(); } } });
  fresh(); go(0); timer = setInterval(tick, 500); tick();
  window.__lab = { get S() { return S; }, ACT, Scene3D };
})();
