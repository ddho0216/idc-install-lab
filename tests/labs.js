// 실습실 자동 테스트: node tests/labs.js [URL]   (예: python3 -m http.server 8790 후 실행)
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8790/labs.html';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const drag = async (a, c) => { const A = await p.evaluate(i => __labs.pin(i), a), C = await p.evaluate(i => __labs.pin(i), c); await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.mouse.move((A.x + C.x) / 2, (A.y + C.y) / 2, { steps: 4 }); await p.mouse.move(C.x, C.y, { steps: 4 }); await p.mouse.up(); };
  const tap = async id => { const t = await p.evaluate(i => __labs.tapObj(i), id); await p.mouse.click(t.x, t.y); await p.waitForTimeout(150); };
  const steps = () => p.evaluate(() => __labs.steps());
  const slider = (i, v) => p.evaluate(([i, v]) => { const r = document.querySelectorAll('input[type=range]')[i]; r.value = v; r.dispatchEvent(new Event('input')); }, [i, v]);
  const go = async id => { await p.evaluate(i => __labs.go(i), id); await p.waitForTimeout(700); };

  await p.goto(URL + '#/lab/power'); await p.waitForTimeout(1500);
  await drag('PSU1', 'A1'); await drag('PSU2', 'A2');
  ok((await steps())[1] === false, '전원: PSU2를 A에 꽂으면 2단계 미완료');
  await p.evaluate(() => { }); await p.click('#bar button:has-text("선 모두 제거")');
  await drag('PSU1', 'A1'); await drag('PSU2', 'B1');
  await p.click('#bar button:has-text("20A")'); ok((await steps())[2] === false, '전원: 20A는 80% 기준 위반(16.4A/20A)');
  await p.click('#bar button:has-text("32A")'); ok((await steps())[2] === true, '전원: 32A 통과');
  await tap('feedA'); ok((await steps())[3] === true, '전원: A 끊어도 서버 유지');
  await slider(0, 16); ok((await steps())[4] === true, '전원: 16대+한쪽 전원 → 트립');

  await go('fiber');
  await drag('SW_TX', 'CORE_TX'); ok((await p.evaluate(() => __labs.wires())) === 1 && !(await p.evaluate(() => __labs.state().up)), '광: TX-TX는 링크 안 올라옴');
  await p.click('#bar button:has-text("선 모두 제거")');
  await drag('SW_TX', 'CORE_RX'); await drag('SW_RX', 'CORE_TX');
  ok((await p.evaluate(() => __labs.state().up)) === true, '광: TX↔RX 엇갈리게 이으면 UP');
  await p.click('#bar button:has-text("긁힘")'); ok(!(await p.evaluate(() => __labs.state().up)), '광: 긁힘이면 DOWN');
  await p.click('#bar button:has-text("깨끗")'); ok((await steps()).every(Boolean), '광: 전 단계 완료');

  await go('airflow');
  await tap('srv3'); ok((await steps())[0], '공기: 뒤집힌 서버 바로잡음');
  for (const i of [2, 5, 8]) await tap('blank' + i);
  ok((await steps())[1], '공기: 빈 슬롯 막음');
  await slider(1, 90); ok((await steps())[2], '공기: 부하 90%에서도 27℃ 이하');
  await slider(0, 28); ok((await steps())[3], '공기: 공급 28℃ → 경고');

  await go('rack');
  await tap('u5'); await tap('u7'); ok((await steps())[1], '랙: 서버 2대 아래쪽');
  await p.click('#bar button:has-text("스위치")'); await tap('u23'); ok((await steps())[2] && (await steps())[3], '랙: 스위치 위, 무게중심 OK');
  console.log('page errors:', errs); ok(errs.length === 0, '콘솔 오류 없음');
  await b.close(); process.exit(fails ? 1 : 0);
})();
