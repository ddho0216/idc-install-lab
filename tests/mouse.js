// 마우스 전용 플레이 확인 (실제 마우스 이벤트): node tests/mouse.js [URL]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8770/', OUT = process.env.OUT || '/tmp/ms-';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); });
  const w = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: OUT + n + '.png' });
  const raf = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const still = () => p.waitForFunction(() => !__g.walk && !__g.tw.length, null, { timeout: 30000 });
  const proj = (x, y, z) => p.evaluate(([x, y, z]) => __g.project(new THREE.Vector3(x, y, z)), [x, y, z]);
  const clickAt = async (x, y, z) => { const q = await proj(x, y, z); await p.mouse.move(q.x, q.y); await raf(); await p.mouse.click(q.x, q.y); await w(150); };
  const pos = () => p.evaluate(() => [+__g.pos.x.toFixed(2), +__g.pos.z.toFixed(2)]);
  await p.goto(URL + '?fast'); await w(500); await p.click('[data-s="1"]'); await w(800);
  await p.click('#modal [data-a=close]'); await w(300);
  console.log('start', await pos());
  // 1) 바닥 클릭 이동
  await p.evaluate(() => { __g.yaw = 0; __g.pitch = -0.4; }); await w(200);
  await clickAt(0.6, 0, 3.4); await still(); console.log('floor click ->', await pos());
  // 2) 빠른 이동 버튼
  await p.click('#quick [data-go=bench]'); await still(); await w(600); console.log('quick bench ->', await pos()); await shot('1-bench');
  // 3) 멀리서 박스 클릭 → 자동 접근 후 개봉
  await p.click('#quick [data-go=front]'); await still(); await w(500);
  await p.evaluate(() => { __g.yaw = 0.9; __g.pitch = -0.2; });
  const bp = await p.evaluate(() => { const m = __g.S2 ? null : null; const S = __g.S; const h = S.box.hit; h.updateMatrixWorld(true); const v = h.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }).catch(() => null);
  console.log('box hit pos', bp);
  await p.evaluate(() => { __g.lookAt(__g.S.box.hit.getWorldPosition(new THREE.Vector3())); }); await w(300);
  await clickAt(...bp); await still(); await w(2400); console.log('box open after far click:', await p.evaluate(() => __g.S.box.open), 'pos', await pos()); await shot('2-box-open');
  // 4) 클립보드 클릭 → 창
  await p.click('#quick [data-go=bench]'); await still(); await w(300);
  await p.evaluate(() => { __g.lookAt(new THREE.Vector3(-3.95, 0.86, -1.05)); }); await w(300); await clickAt(-3.95, 0.86, -1.05); await w(400);
  console.log('clipboard modal:', await p.evaluate(() => !document.querySelector('#modal').hidden && /입고서/.test(document.querySelector('#modal').innerText))); await p.click('#modal [data-a=recvOk]'); await w(300);
  // 5) 시계 등 소품 상호작용
  await p.click('#quick [data-go=front]'); await still(); await w(300); await p.evaluate(() => { __g.lookAt(new THREE.Vector3(-6.9, 2.4, -1.6)); }); await w(300);
  await clickAt(-6.9, 2.4, -1.6); await still(); await w(600); console.log('clock toast:', await p.evaluate(() => [...document.querySelectorAll('.tt')].map(t => t.textContent).pop()));
  // 6) 우클릭 내려놓기 / 손에 든 것 버튼
  await p.click('#quick [data-go=bench]'); await still(); await w(300);
  await p.evaluate(() => { __g.lookAt(__g.items.rails.hit.getWorldPosition(new THREE.Vector3())); }); await w(300);
  const rp = await p.evaluate(() => { const v = __g.items.rails.hit.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }); await clickAt(...rp); await w(300);
  console.log('held:', await p.evaluate(() => __g.hold && __g.hold.label), 'handbar buttons:', await p.evaluate(() => document.querySelectorAll('#handbar .hb').length)); await shot('3-held');
  await p.click('#handbar [data-hb=drop]'); await w(300); console.log('after drop held:', await p.evaluate(() => !!__g.hold));
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
