(function () {
  const G = window.G, $ = G.$;
  G.init($('#cv'));
  let best = {}; try { best = JSON.parse(localStorage.getItem('idc-best') || '{}'); } catch (e) {}
  const stars = n => best[n] ? '★'.repeat(best[n].stars) + '☆'.repeat(3 - best[n].stars) + ' ' + best[n].score + '점' : '아직 기록 없음';
  const start = n => { G.startLevel(n); };
  const hash = (location.hash || '').replace('#', '');
  const menu = () => {
    $('#start').innerHTML = '<div class="card"><h2 style="font-size:30px">IDC 신입 엔지니어</h2><p class="sub">걸어다니며 장비를 직접 집어 랙에 설치하고, 감독관 검수를 통과하세요. (장비·값은 모두 가상)</p>' +
      '<div class="lv"><button data-s="1"><b>1레벨 · 서버 설치</b><span class="mini">입고 검수 · PDU 전류 계산 · 레일 · 장착 · 전원 A/B · 네트워크 · 부팅</span><br><span class="stars" style="font-size:16px">' + stars(1) + '</span></button>' +
      '<button data-s="2"><b>2레벨 · 스위치 설치</b><span class="mini">레일 · 장착 · 전원 · 광 업링크 · 콘솔 설정 · 관제 연동</span><br><span class="stars" style="font-size:16px">' + stars(2) + '</span></button></div>' +
      '<h3>조작</h3><p class="mini"><kbd>W A S D</kbd> 이동 · 마우스 시점 · <kbd>E</kbd>/클릭 집기·사용·설치 · <kbd>R</kbd> 장비 방향 · <kbd>Q</kbd> 내려놓기 · <kbd>Tab</kbd> 작업지시서 · <kbd>H</kbd> 도움말</p></div>';
    $('#start').querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => start(+b.dataset.s)));
  };
  menu();
  if (hash === '1' || hash === '2') { $('#start').innerHTML = '<div class="card"><h2>' + (hash === '1' ? '1레벨 · 서버 설치' : '2레벨 · 스위치 설치') + '</h2><p class="sub">준비되면 시작하세요. 시작하면 화면이 고정됩니다 (Esc로 해제).</p><div class="row"><button class="btn" id="go">시작</button><button class="btn ghost" id="mn">메뉴</button></div></div>'; $('#go').onclick = () => start(+hash); $('#mn').onclick = () => { location.hash = ''; location.reload(); }; }
  window.__g = G;
})();
