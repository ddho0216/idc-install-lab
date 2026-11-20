/* IDC 장비 설치 실습: 단계 진행·검증 (가상 환경, 모든 값은 제가 만든 가상 데이터) */
(function () {
  const $ = s => document.querySelector(s);
  const C = Scene3D.consts;
  const STEPS = [
    { id: 'recv', t: '입고·검수', s: '입고서와 현물 대조' },
    { id: 'pdu', t: 'PDU 설치', s: '전류 계산·정격·설치' },
    { id: 'mount', t: '랙 마운트', s: '위치와 방향 정하기' },
    { id: 'power', t: '전원 연결', s: 'A/B 이중화' },
    { id: 'fiber', t: '광 케이블링', s: '코어 두 대에 연결' },
    { id: 'cli', t: '콘솔 설정', s: 'IP·VLAN·트렁크·저장' },
    { id: 'mon', t: '관제 연동', s: '등록하고 그래프 확인' },
    { id: 'done', t: '완료', s: '작업 기록' },
  ];
  const IX = id => STEPS.findIndex(x => x.id === id);
  // 가상 전력 조건 (제가 만든 값)
  const VOLT = 220, SERVERS = 8, SERVER_W = 450, SW_W = 150, LOAD_W = SERVERS * SERVER_W + SW_W, LOAD_A = LOAD_W / VOLT;
  const SERIAL = 'FOC2547A1BQ';
  let S, timer;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function fresh() {
    const scen = pick(['clean', 'serial', 'missing', 'damaged']);
    S = {
      step: 0, max: 0, t0: Date.now(), tEnd: null, miss: 0, hints: 0, scen, fb: null,
      rows: [
        { id: 'model', name: '모델명', note: 'NX-4824T', box: 'NX-4824T' },
        { id: 'serial', name: '시리얼 번호', note: SERIAL, box: scen === 'serial' ? 'FOC2547A18Q' : SERIAL },
        { id: 'psu', name: '전원 모듈(PSU)', note: '2개', box: '2개' },
        { id: 'cord', name: '전원 코드', note: '2개', box: '2개' },
        { id: 'rail', name: '랙 레일 킷', note: '1세트', box: '1세트' },
        { id: 'sfp', name: 'SFP+ 광 모듈', note: '2개', box: scen === 'missing' ? '1개' : '2개' },
        { id: 'pdu', name: 'PDU(멀티탭)', note: '2대', box: '2대' },
        { id: 'look', name: '외관', note: '이상 없음', box: scen === 'damaged' ? '랙 귀(브래킷) 휘어짐' : '이상 없음' },
      ],
      flags: {}, recvOk: false,
      pdu: { ok: false }, mount: { u: 40, face: 'rear', ok: false },
      power: { 1: { side: 'A', out: 8 }, 2: { side: 'B', out: 8 }, ok: false },
      fiber: { 1: { core: '', wrong: false, label: false }, 2: { core: '', wrong: false, label: false }, polBad: pick([[true, false], [false, true], [false, false]]), ok: false },
      mon: { reg: false, ok: false, t: null }, cliLog: [], hist: [], histIdx: 0,
    };
    S.dev = new LabCLI.Device({ serial: SERIAL, link: linkOf });
    Scene3D.unmount(); Scene3D.ghost(null); Scene3D.resetPdus();
    Scene3D.setSwState({ sys: 'off', up: [false, false], psuLed: false });
  }
  function linkOf(n) {
    const i = n === 'Te1/1/1' ? 1 : n === 'Te1/1/2' ? 2 : 0, f = i && S.fiber[i];
    if (!f || !f.core) return { phys: false, hasCable: false };
    const ok = !f.wrong;
    return { phys: ok, hasCable: true, tx: -2.3, rx: ok ? -3.1 : -40.0, peer: ok ? { name: f.core, port: 'Te1/0/12' } : null };
  }
  function fail(title, msg) { S.miss++; S.fb = { t: 'bad', title, msg }; head(); }
  function good(title, msg) { S.fb = { t: 'ok', title, msg }; }
  function fbHtml() { return S.fb ? '<div class="fb ' + S.fb.t + '"><b>' + esc(S.fb.title) + '</b>' + S.fb.msg + '</div>' : ''; }
  function hintBtn(text) { return '<details><summary data-act="hint">힌트 보기 (쓰면 기록에 남습니다)</summary><p class="why" id="hintbox" hidden>' + text + '</p></details>'; }

  /* ---------- 상단·단계 표시 ---------- */
  function head() {
    $('#miss').textContent = '실수 ' + S.miss;
    $('#steps').innerHTML = '<ol>' + STEPS.map((s, i) =>
      '<li class="' + (i < S.step ? 'done' : '') + (i === S.step ? ' cur' : '') + '"' + (i <= S.max && (i === IX('cli') || i === IX('mon')) ? ' data-act="goto" data-i="' + i + '" style="cursor:pointer"' : '') + '><div>' + s.t + '<small>' + s.s + '</small></div></li>').join('') + '</ol>';
  }
  function tick() {
    const ms = (S.tEnd || Date.now()) - S.t0, m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
    $('#timer').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function go(i) {
    S.step = i; S.max = Math.max(S.max, i); S.fb = null; render();
    Scene3D.setView({ recv: 'front', pdu: 'pdu', mount: 'front_up', power: 'rear', fiber: 'top', cli: 'top', mon: 'top', done: 'front' }[STEPS[i].id]);
  }

  /* ---------- 단계별 화면 ---------- */
  function render() {
    head();
    const P = $('#panel'), id = STEPS[S.step].id;
    P.innerHTML = VIEW[id]();
    if (id === 'cli') { cliMount(); }
    if (id === 'mon') { drawGraph(false); }
    P.scrollTop = 0;
  }
  const VIEW = {
    recv() {
      const done = S.recvOk;
      return '<h2>1. 입고·검수</h2><p class="sub">박스가 도착했습니다. 입고서와 박스 안 현물을 한 줄씩 대조하세요.</p>' +
        '<div class="why"><b>왜 하나요</b> 설치 전에 이상을 찾아야 합니다. 설치한 뒤에 시리얼이 다르거나 부품이 빠진 걸 발견하면 반품·교체 책임이 불분명해집니다.</div>' +
        '<table class="cmp"><tr><th>항목</th><th>입고서</th><th>박스 현물</th><th>판정</th></tr>' +
        S.rows.map(r => '<tr><td>' + r.name + '</td><td class="mono">' + esc(r.note) + '</td><td class="mono">' + esc(r.box) + '</td><td>' +
          '<button class="flag' + (S.flags[r.id] ? ' on' : '') + '" data-act="flag" data-id="' + r.id + '" type="button" aria-pressed="' + !!S.flags[r.id] + '"' + (done ? ' disabled' : '') + '>' + (S.flags[r.id] ? '이상' : '정상') + '</button></td></tr>').join('') +
        '</table><p class="mini">다른 점이 있는 줄만 "이상"으로 바꾸세요. 모두 같으면 그대로 제출합니다.</p>' +
        '<div class="row">' + (done ? '<button class="btn" data-act="next" type="button">다음: PDU 설치</button>' : '<button class="btn" data-act="recv-submit" type="button">검수 결과 제출</button>') + '</div>' +
        fbHtml() + (done ? '' : hintBtn('글자를 한 자씩 읽어 보세요. 시리얼은 한 글자만 달라도 다른 장비입니다. 개수도 입고서와 같은지 보세요.'));
    },
    pdu() {
      const P = S.pdu, I = S.pduIn || {}, v = (id, ph) => '<input id="' + id + '" type="number" step="0.1" min="0" value="' + (I[id] == null ? '' : I[id]) + '" placeholder="' + ph + '" style="width:92px" ' + (P.ok ? 'disabled' : '') + '>';
      const sel = (id, opts, cur) => '<select id="' + id + '"' + (P.ok ? ' disabled' : '') + '>' + opts.map(o => '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
      return '<h2>2. PDU(멀티탭) 설치</h2><p class="sub">랙 옆에 세워 둔 PDU 2대를 꺼내 랙 후면에 답니다. 먼저 전류를 계산해서 정격을 정합니다.</p>' +
        '<div class="why"><b>PDU란</b> 랙 안에서 쓰는 전원 멀티탭입니다. 서버·스위치 전원이 여기에 꽂힙니다. 전원 계통이 두 개(A/B)라 PDU도 2대입니다.</div>' +
        '<h3>작업 요청서 (가상)</h3><table class="cmp" style="font-size:13px">' +
        '<tr><td>전압</td><td>단상 ' + VOLT + 'V</td></tr>' +
        '<tr><td>이 랙의 예정 부하</td><td>서버 ' + SERVERS + '대 × ' + SERVER_W + 'W + 스위치 1대 ' + SW_W + 'W = <b>' + LOAD_W.toLocaleString() + 'W</b></td></tr>' +
        '<tr><td>전원 구성</td><td>A/B 이중화. 평소엔 반반 나눠 씀</td></tr>' +
        '<tr><td>안전 기준</td><td>PDU 정격 전류의 <b>80%</b>까지만 사용</td></tr>' +
        '<tr><td>경보 설정</td><td>정격의 70%에서 경고, 80%에서 위험</td></tr>' +
        '<tr><td>설치 위치</td><td>PDU-A 후면 <b>왼쪽</b>, PDU-B 후면 <b>오른쪽</b></td></tr></table>' +
        '<h3>① 전류 계산 &nbsp;<span class="mini">전류(A) = 전력(W) ÷ 전압(V)</span></h3>' +
        '<div class="row">총 부하 ' + v('p-total', 'A') + ' A</div>' +
        '<div class="row">평소 PDU 1대 부하 ' + v('p-norm', 'A') + ' A</div>' +
        '<div class="row">한쪽이 꺼졌을 때 남은 PDU 1대 부하 ' + v('p-fail', 'A') + ' A</div>' +
        '<h3>② PDU 정격</h3><div class="row">' + sel('p-rate', [[0, '선택'], [16, '16A'], [20, '20A'], [32, '32A']], +I['p-rate'] || 0) + '</div>' +
        '<h3>③ PDU 경보 임계값</h3><div class="row">경고 ' + v('p-warn', 'A') + ' A &nbsp; 위험 ' + v('p-crit', 'A') + ' A</div>' +
        '<h3>④ 설치 위치 (후면에서 본 방향)</h3><div class="row">PDU-A ' + sel('p-sa', [['L', '왼쪽'], ['R', '오른쪽']], I['p-sa'] || 'L') + ' &nbsp; PDU-B ' + sel('p-sb', [['L', '왼쪽'], ['R', '오른쪽']], I['p-sb'] || 'R') + '</div>' +
        '<div class="row">' + (P.ok ? '<button class="btn" data-act="next" type="button">다음: 랙 마운트</button>' : '<button class="btn" data-act="pdu-do" type="button">계산 확인하고 PDU 설치</button>') + '</div>' +
        fbHtml() + (P.ok ? '' : hintBtn('정상 시에는 두 PDU가 부하를 반반 나눠 갖고, 한쪽이 꺼지면 남은 한 대가 전부 감당합니다. 그때 부하가 "정격 × 0.8"을 넘으면 안 됩니다.'));
    },
    mount() {
      const m = S.mount, done = m.ok;
      return '<h2>3. 랙 마운트</h2><p class="sub">비어 있는 U와 장비 방향을 정해 랙에 넣습니다. 3D 랙을 클릭해도 U가 선택됩니다.</p>' +
        '<div class="why"><b>이 장비의 특징 (제가 정한 가상 모델)</b> 1U 스위치. 포트 48개·전원(PSU 2개)·팬이 <b>한쪽 면</b>에 몰려 있고, 그 면으로 더운 공기를 내보냅니다. 반대면이 흡기입니다.</div>' +
        '<h3>위치 (U 번호, 아래가 1)</h3><div class="row"><button class="btn ghost" data-act="u-" type="button" aria-label="한 칸 아래">−</button>' +
        '<input id="u" type="number" min="1" max="42" value="' + m.u + '" style="width:70px" data-act="u-in"><button class="btn ghost" data-act="u+" type="button" aria-label="한 칸 위">+</button>' +
        '<span class="mini" id="ustate"></span></div>' +
        '<h3>포트·전원이 있는 면을 어느 쪽으로?</h3><div class="row"><label><input type="radio" name="face" value="front"' + (m.face === 'front' ? ' checked' : '') + ' data-act="face"> 전면(콜드 아일)</label>' +
        '<label><input type="radio" name="face" value="rear"' + (m.face === 'rear' ? ' checked' : '') + ' data-act="face"> 후면(핫 아일, 서버 NIC가 있는 쪽)</label></div>' +
        '<div class="row">' + (done ? '<button class="btn" data-act="next" type="button">다음: 전원 연결</button>' : '<button class="btn" data-act="mount-do" type="button">장착</button>') + '</div>' +
        fbHtml() + (done ? '' : hintBtn('빈 랙입니다. 아래쪽은 무거운 서버 ' + SERVERS + '대가 들어갈 자리입니다. 스위치는 서버와 연결되니 위쪽에 두는 "TOR(Top of Rack)" 구성이 일반적입니다. 면은 "더운 공기가 나가는 면"이 어느 aisle을 향해야 하는지 생각해 보세요.'));
    },
    power() {
      const o = (n, sel) => Array.from({ length: 12 }, (_, i) => '<option value="' + (i + 1) + '"' + (i + 1 === sel ? ' selected' : '') + '>' + (i + 1) + '번</option>').join('');
      const row = n => '<div class="row"><b style="width:50px">PSU' + n + '</b><select id="s' + n + '"><option value="A"' + (S.power[n].side === 'A' ? ' selected' : '') + '>PDU-A</option><option value="B"' + (S.power[n].side === 'B' ? ' selected' : '') + '>PDU-B</option></select>' +
        '<select id="o' + n + '">' + o(n, S.power[n].out) + '</select></div>';
      return '<h2>4. 전원 연결</h2><p class="sub">전원 모듈 2개를 PDU 콘센트에 연결합니다. 후면에서 보면 왼쪽이 PDU-A, 오른쪽이 PDU-B입니다.</p>' +
        '<div class="why"><b>전류</b> 이 스위치는 ' + SW_W + 'W 입니다. PSU 2개가 반반 나눠 쓰므로 각 PSU는 약 ' + (SW_W / 2 / VOLT).toFixed(2) + 'A 입니다.</div>' +
        row(1) + row(2) +
        '<div class="row">' + (S.power.ok ? '<button class="btn" data-act="next" type="button">다음: 광 케이블링</button>' : '<button class="btn" data-act="power-do" type="button">연결하고 전원 켜기</button>') + '</div>' +
        fbHtml() + (S.power.ok ? '' : hintBtn('PDU는 서로 다른 전원 계통(A/B)입니다. 한쪽 계통이 정전·차단기 작업으로 꺼져도 장비가 살아 있으려면 PSU 두 개를 어떻게 나눠야 할까요?'));
    },
    fiber() {
      const f = S.fiber, cores = '<option value="">선택</option><option>CORE-A</option><option>CORE-B</option>';
      const row = i => {
        const x = f[i], conn = !!x.core, up = conn && !x.wrong;
        return '<div class="row"><b style="width:56px">T' + i + '</b><select id="c' + i + '"' + (conn ? ' disabled' : '') + '>' + cores.replace('>' + x.core + '<', ' selected>' + x.core + '<') + '</select>' +
          (conn ? '<span class="mini">링크 ' + (up ? '<b style="color:var(--ok)">UP</b>' : '<b style="color:var(--bad)">DOWN</b>') + '</span>' +
            (up ? '' : '<button class="btn ghost" data-act="flip" data-i="' + i + '" type="button">Tx/Rx 뒤집기</button>') +
            '<label class="mini"><input type="checkbox" data-act="label" data-i="' + i + '"' + (x.label ? ' checked' : '') + '> 양끝 라벨</label>' : '<button class="btn ghost" data-act="connect" data-i="' + i + '" type="button">연결</button>') + '</div>';
      };
      const ready = f[1].core && f[2].core && f[1].core !== f[2].core && !f[1].wrong && !f[2].wrong && f[1].label && f[2].label;
      return '<h2>5. 광 케이블링</h2><p class="sub">업링크 T1(Te1/1/1), T2(Te1/1/2)를 옆 랙의 코어 스위치에 광으로 연결합니다.</p>' +
        '<div class="why"><b>알아둘 것</b> 광은 한 가닥이 Tx(송신), 한 가닥이 Rx(수신)입니다. 한쪽의 Tx는 반대쪽 Rx로 가야 합니다. 3D에서 노란 선이 광 케이블입니다.</div>' +
        row(1) + row(2) +
        '<p class="mini">링크가 DOWN이면 케이블이 연결돼도 불이 안 들어옵니다. 원인을 찾아 고치세요. 연결이 끝나면 라벨을 붙입니다.</p>' +
        '<div class="row">' + (ready ? '<button class="btn" data-act="fiber-done" type="button">다음: 콘솔 설정</button>' : '<button class="btn" disabled type="button">연결·링크·라벨을 모두 마치면 열립니다</button>') + '</div>' +
        fbHtml() + hintBtn('한쪽 링크만 DOWN이라면 그 케이블의 Tx/Rx가 뒤집혔을 가능성이 큽니다. 코어 두 대에 서로 다르게 연결해야 코어 한 대가 죽어도 살아 있습니다.');
    },
    cli() {
      const R = LabCLI.REQ;
      return '<h2>6. 콘솔 설정</h2><p class="sub">콘솔 케이블로 접속했습니다. 작업 요청서대로 설정하고 저장하세요. (가상 장비, 실제 접속 아님)</p>' +
        '<h3>작업 요청서</h3><table class="cmp mono" style="font-size:12px">' +
        '<tr><td>호스트명</td><td>' + R.host + '</td></tr><tr><td>관리 VLAN</td><td>99 (MGMT), 서버 VLAN 100</td></tr><tr><td>관리 IP</td><td>' + R.ip + ' / ' + R.mask + '</td></tr>' +
        '<tr><td>게이트웨이</td><td>' + R.gw + '</td></tr><tr><td>업링크</td><td>Te1/1/1(CORE-A), Te1/1/2(CORE-B): trunk, VLAN 99·100</td></tr><tr><td>SNMP</td><td>' + R.community + ' (읽기 전용)</td></tr></table>' +
        '<h3>진행</h3><ul class="chk" id="tasks"></ul>' +
        '<div class="term" id="term" tabindex="0" aria-label="가상 터미널 출력"></div><div class="termin"><span id="pr"></span><input id="ci" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="명령 입력"></div>' +
        '<p class="mini">위/아래 화살표로 이전 명령 · <code>?</code> 로 명령 도움말 · <code>conf t</code> 처럼 줄여 써도 됩니다.</p>' +
        '<div class="row"><button class="btn" id="cli-next" data-act="cli-next" type="button" disabled>다음: 관제 연동</button></div>' +
        '<details><summary>쓸 수 있는 명령 모아보기</summary><div class="why mono" style="font-size:12px">enable<br>configure terminal<br>hostname &lt;이름&gt;<br>vlan 99 → name MGMT<br>interface vlan 99 → ip address … / no shutdown<br>ip default-gateway &lt;IP&gt;<br>interface range te1/1/1 - 2 → switchport mode trunk / switchport trunk allowed vlan 99,100 / description …<br>snmp-server community … ro<br>end → write memory<br>확인: show ip interface brief · show interfaces status · show lldp neighbors · show interfaces te1/1/1 transceiver · ping &lt;IP&gt;</div></details>' + fbHtml();
    },
    mon() {
      const d = S.dev, M = S.mon;
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
    const m = S.mount, p = S.power, f = S.fiber, d = S.dev;
    return ['[신규 장비 설치 작업 기록 - 가상 실습]',
      '장비: NX-4824T (가상) / 시리얼 ' + SERIAL + ' / 입고 검수: ' + ({ clean: '이상 없음', serial: '시리얼 불일치 → 교체 접수 가정', missing: 'SFP+ 1개 누락 → 추가 요청 가정', damaged: '랙 귀 휘어짐 → 교체 접수 가정' }[S.scen]),
      'PDU: PDU-A(후면 좌)·PDU-B(후면 우) 각 ' + S.pdu.rate + 'A, 경고 ' + S.pdu.warn + 'A / 위험 ' + S.pdu.crit + 'A (예정 부하 ' + LOAD_A.toFixed(1) + 'A, 한쪽 장애 시에도 한도 ' + (S.pdu.rate * 0.8).toFixed(1) + 'A 이내)',
      '위치: R12 U' + m.u + ' (포트면 후면)', '전원: PSU1 → PDU-' + p[1].side + ' ' + p[1].out + '번, PSU2 → PDU-' + p[2].side + ' ' + p[2].out + '번',
      '업링크: Te1/1/1 ↔ ' + f[1].core + ' Te1/0/12, Te1/1/2 ↔ ' + f[2].core + ' Te1/0/12' + (f[1].wrong || f[2].wrong ? '' : ' (광 극성 확인 완료)'),
      '설정: ' + d.host + ', Vlan99 ' + LabCLI.REQ.ip + '/24, GW ' + LabCLI.REQ.gw + ', 업링크 trunk(99,100), SNMP RO, write memory 완료',
      '관제: 등록, ping·SNMP 응답 확인, 5분 후 트래픽 그래프 수신 확인'].join('\n');
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, i = +el.dataset.i;
    const A = ACT[a]; if (A) { A(el, i); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    if (el.dataset.act === 'u-in' || el.dataset.act === 'face') { ACT.preview(); }
    if (el.dataset.act === 'label') { S.fiber[+el.dataset.i].label = el.checked; render(); }
  });
  document.addEventListener('keydown', e => { if (e.target.id === 'u' && e.key === 'Enter') ACT['mount-do'](); });

  function mountRule(u, face) {
    if (!(u >= 1 && u <= 42)) return { ok: false, t: 'U 범위(1~42)를 벗어났습니다.' };
    if (u === 42) return { ok: false, t: 'U42(맨 위)는 케이블 트레이를 잡는 점검 공간이라 비워 두는 규칙입니다.' };
    if (u < 38) return { ok: false, t: 'U' + u + ': 아래~중간은 서버 ' + SERVERS + '대가 들어갈 자리입니다. 스위치는 서버와 케이블로 이어지니 랙 상단(U38~41)에 둡니다(TOR 구성, 제가 정한 가정).' };
    return { ok: true, t: 'U' + u + ' 사용 가능' };
  }

  const ACT = {
    hint() { S.hints++; const b = $('#hintbox'); if (b) { b.hidden = false; } },
    goto(el, i) { if (i === S.step) return; go(i); },
    next() { go(S.step + 1); },
    flag(el) { const id = el.dataset.id; S.flags[id] = !S.flags[id]; render(); },
    'recv-submit'() {
      const exp = { clean: [], serial: ['serial'], missing: ['sfp'], damaged: ['look'] }[S.scen];
      const got = Object.keys(S.flags).filter(k => S.flags[k]);
      const missed = exp.filter(k => !got.includes(k)), extra = got.filter(k => !exp.includes(k));
      if (!missed.length && !extra.length) {
        S.recvOk = true;
        good(exp.length ? '이상 항목을 정확히 찾았습니다' : '모두 정상입니다', exp.length ? '현장에서는 <b>사진을 찍고 입고 담당·공급사에 반품/교체(RMA)를 접수</b>합니다. 이 실습에서는 교체품이 도착했다고 보고 계속 진행합니다.' : '입고서와 현물이 일치합니다.');
        render();
      } else {
        fail('검수 결과가 맞지 않습니다', (missed.length ? '놓친 항목: <b>' + missed.map(k => S.rows.find(r => r.id === k).name).join(', ') + '</b>. ' : '') + (extra.length ? '정상인데 이상으로 표시한 항목: <b>' + extra.map(k => S.rows.find(r => r.id === k).name).join(', ') + '</b>. ' : '') + '입고서와 박스 값을 다시 비교하세요.');
        render();
      }
    },
    'pdu-do'() {
      const n = id => parseFloat($('#' + id).value), near = (a, b, t) => Math.abs(a - b) <= t;
      const tot = n('p-total'), nor = n('p-norm'), fl = n('p-fail'), rate = +$('#p-rate').value, warn = n('p-warn'), crit = n('p-crit');
      const sa = $('#p-sa').value, sb = $('#p-sb').value;
      S.pduIn = {}; ['p-total', 'p-norm', 'p-fail', 'p-rate', 'p-warn', 'p-crit', 'p-sa', 'p-sb'].forEach(k => { S.pduIn[k] = $('#' + k).value; });
      const f = (t, m) => { fail(t, m); render(); };
      if (!near(tot, LOAD_A, 0.3)) return f('총 부하 전류가 맞지 않습니다', '전류(A) = 전력(W) ÷ 전압(V) 입니다. 총 전력은 ' + SERVERS + '×' + SERVER_W + ' + ' + SW_W + ' = ' + LOAD_W + 'W, 전압은 ' + VOLT + 'V 입니다.');
      if (!near(nor, LOAD_A / 2, 0.2)) return f('평소 PDU 1대 부하가 맞지 않습니다', 'A/B 두 대가 부하를 반반 나눠 가지므로 총 부하의 절반입니다.');
      if (!near(fl, LOAD_A, 0.3)) return f('한쪽 장애 시 부하가 맞지 않습니다', '한쪽 PDU(전원 계통)가 꺼지면 남은 PDU 1대가 총 부하를 전부 감당합니다.');
      if (!rate) return f('PDU 정격을 고르세요', '한쪽 장애 시 부하를 감당할 수 있는 정격이어야 합니다.');
      if (LOAD_A > rate * 0.8) return f(rate + 'A PDU로는 부족합니다', '사용 한도는 ' + rate + 'A × 80% = <b>' + (rate * 0.8).toFixed(1) + 'A</b> 인데, 한쪽 장애 시 부하는 ' + LOAD_A.toFixed(1) + 'A 입니다. 이 상태에서 한 계통이 꺼지면 남은 PDU의 차단기가 내려가 랙 전체가 정전될 수 있습니다.');
      if (!near(warn, rate * 0.7, 0.3) || !near(crit, rate * 0.8, 0.3)) return f('경보 임계값이 맞지 않습니다', rate + 'A 기준 경고 = ' + rate + ' × 70% = ' + (rate * 0.7).toFixed(1) + 'A, 위험 = ' + rate + ' × 80% = ' + (rate * 0.8).toFixed(1) + 'A 입니다.');
      if (sa === sb) return f('두 PDU를 같은 쪽에 달 수 없습니다', 'PDU-A와 PDU-B는 서로 반대 쪽 기둥에 답니다.');
      if (sa !== 'L') return f('위치가 요청서와 다릅니다', '작업 요청서는 PDU-A 후면 왼쪽, PDU-B 후면 오른쪽입니다. 후면에서 보는 방향 기준으로 일관되게 달아야 나중에 헷갈리지 않습니다.');
      S.pdu = { ok: true, rate, warn, crit };
      Scene3D.installPdu('A', sa, 'PDU-A ' + rate + 'A'); Scene3D.installPdu('B', sb, 'PDU-B ' + rate + 'A'); Scene3D.setView('rear');
      good('PDU 설치 완료', '각 PDU ' + rate + 'A, 경고 ' + warn + 'A / 위험 ' + crit + 'A. 한쪽 장애 시에도 ' + LOAD_A.toFixed(1) + 'A ≤ 사용 한도 ' + (rate * 0.8).toFixed(1) + 'A 로 버팁니다.'); render();
    },
    'u-'() { $('#u').value = Math.max(1, +$('#u').value - 1); ACT.preview(); },
    'u+'() { $('#u').value = Math.min(42, +$('#u').value + 1); ACT.preview(); },
    preview() {
      if (STEPS[S.step].id !== 'mount') return;
      const u = +$('#u').value, r = mountRule(u, null);
      S.mount.u = u; S.mount.face = (document.querySelector('input[name=face]:checked') || {}).value || 'rear';
      Scene3D.ghost(u >= 1 && u <= 42 ? u : null, r.ok);
      const st = $('#ustate'); if (st) { st.textContent = r.t; st.style.color = r.ok ? 'var(--ok)' : 'var(--bad)'; }
    },
    'mount-do'() {
      ACT.preview(); const u = S.mount.u, face = S.mount.face, r = mountRule(u, face);
      if (!r.ok) { fail('이 위치는 안 됩니다', r.t); render(); ACT.preview(); return; }
      Scene3D.ghost(null); Scene3D.mount(u, face);
      if (face !== 'rear') {
        Scene3D.setView('front');
        fail('방향이 맞지 않습니다', '포트·전원·팬 면이 <b>전면(콜드 아일)</b>을 향했습니다. 이 장비는 그 면으로 더운 공기를 뿜기 때문에 찬 통로로 열기가 나옵니다. 또 전원 코드가 PDU가 있는 후면까지 앞으로 돌아가야 하고, 서버 NIC와도 면이 다릅니다. 후면으로 바꿔 다시 장착하세요.');
        render(); ACT.preview(); return;
      }
      S.mount.ok = true; Scene3D.setView('rear');
      good('장착 완료', 'R12 U' + u + ', 포트면이 후면(핫 아일)을 향합니다. 3D를 후면으로 돌렸습니다.'); render();
    },
    'power-do'() {
      const g = n => ({ side: $('#s' + n).value, out: +$('#o' + n).value });
      S.power[1] = g(1); S.power[2] = g(2);
      Scene3D.clearCables(); Scene3D.power(1, S.power[1].side, S.power[1].out - 1); Scene3D.power(2, S.power[2].side, S.power[2].out - 1);
      if (S.power[1].side === S.power[2].side) {
        Scene3D.setSwState({ psuLed: true, sys: 'boot' });
        fail('두 PSU가 같은 PDU에 연결됐습니다', '이러면 PDU-' + S.power[1].side + ' 계통이 꺼지는 순간 스위치가 통째로 꺼집니다. 이중화 전원을 쓰는 이유가 사라집니다. PSU1과 PSU2를 서로 다른 PDU(A/B)에 나눠 꽂으세요.'); render(); return;
      }
      S.power.ok = true; Scene3D.setSwState({ psuLed: true, sys: 'boot' });
      good('전원 이중화 완료', 'PSU1→PDU-' + S.power[1].side + ', PSU2→PDU-' + S.power[2].side + '. 각 PDU 부하 약 ' + (SW_W / 2 / VOLT).toFixed(2) + 'A (사용 한도 ' + (S.pdu.rate * 0.8).toFixed(1) + 'A). 전원이 들어가 부팅 중입니다(SYS 램프가 주황). 한 계통이 꺼져도 장비는 살아 있습니다.'); render();
    },
    connect(el, i) {
      const v = $('#c' + i).value; if (!v) { fail('연결할 코어를 고르세요', 'T' + i + ' 가 연결될 코어 스위치를 먼저 선택합니다.'); render(); return; }
      S.fiber[i].core = v; S.fiber[i].wrong = S.fiber.polBad[i - 1];
      Scene3D.fiber(i, v); syncLeds();
      if (S.fiber[i].wrong) { S.miss++; S.fb = { t: 'bad', title: 'T' + i + ' 링크가 올라오지 않습니다', msg: '케이블은 연결됐는데 LED가 꺼져 있습니다. 광 Tx/Rx가 뒤집혔을지 모릅니다. <b>Tx/Rx 뒤집기</b>를 눌러 보세요.' }; }
      else good('T' + i + ' 링크 UP', S.fiber[i].core + ' 와 연결되어 포트 LED가 초록색입니다.');
      const o = i === 1 ? 2 : 1;
      if (S.fiber[o].core && S.fiber[o].core === v) { S.miss++; S.fb = { t: 'bad', title: '두 업링크가 같은 코어에 연결됐습니다', msg: '코어 한 대가 죽으면 이 스위치는 통째로 단절됩니다. 한 쪽은 CORE-A, 다른 쪽은 CORE-B로 연결해야 합니다. (연결을 되돌리려면 "처음부터"를 누르세요)' }; }
      render();
    },
    flip(el, i) { S.fiber[i].wrong = !S.fiber[i].wrong; syncLeds(); good('Tx/Rx를 뒤집었습니다', 'T' + i + ' 링크가 ' + (S.fiber[i].wrong ? '여전히 DOWN' : 'UP으로 올라왔습니다') + '.'); render(); },
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
  ACT.next = (function (orig) {
    return function () {
      if (STEPS[S.step].id === 'mon') { S.tEnd = Date.now(); try { const ms = S.tEnd - S.t0, b = JSON.parse(localStorage.getItem('idclab-best') || 'null'); const t = Math.floor(ms / 60000) + '분 ' + (Math.floor(ms / 1000) % 60) + '초'; if (!b || S.miss < b.miss || (S.miss === b.miss && ms < b.ms)) localStorage.setItem('idclab-best', JSON.stringify({ ms, miss: S.miss, time: t })); } catch (e) {} }
      orig();
    };
  })(ACT.next);

  function syncLeds() { Scene3D.setSwState({ up: [!!linkOf('Te1/1/1').phys, !!linkOf('Te1/1/2').phys] }); }

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
    paint(); inp.focus();
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const c = inp.value; S.cliLog.push({ p: d.prompt(), c });
        if (c.trim()) { S.hist.push(c); S.histIdx = S.hist.length; }
        d.run(c).forEach(o => S.cliLog.push({ o })); inp.value = ''; paint();
      } else if (e.key === 'ArrowUp') { if (S.histIdx > 0) inp.value = S.hist[--S.histIdx]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { inp.value = S.histIdx < S.hist.length - 1 ? S.hist[++S.histIdx] : (S.histIdx = S.hist.length, ''); e.preventDefault(); }
    });
    term.addEventListener('click', () => inp.focus());
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
  document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => Scene3D.setView(b.dataset.view)));
  $('#restart').addEventListener('click', () => { if (confirm('처음부터 다시 할까요?')) ACT.restart(); });
  Scene3D.init($('#cv'), { onPickU: u => { if (STEPS[S.step].id === 'mount' && !S.mount.ok) { $('#u').value = u; ACT.preview(); } } });
  fresh(); go(0); timer = setInterval(tick, 500); tick();
  window.__lab = { get S() { return S; }, ACT, Scene3D };
})();
