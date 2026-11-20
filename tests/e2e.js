// 전체 흐름 e2e: node tests/e2e.js [URL]   (Playwright 필요)
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8766/';
const OUT = process.env.OUT || '/tmp/e2e-';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(600);
  const settle = async () => { await p.waitForFunction(() => !__lab.Scene3D.goal && !__lab.Scene3D.tweens.length, null, { timeout: 8000 }); await p.waitForTimeout(150); };
  const clickItem = async id => { await settle(); const pt = await p.evaluate(i => __lab.Scene3D.screenOfItem(i), id); await p.mouse.move(pt.x, pt.y); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(100); await settle(); };
  const clickTarget = async id => { await settle(); const pt = await p.evaluate(i => __lab.Scene3D.screenOfTarget(i), id); if (!pt) throw new Error('no target ' + id); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(150); };
  const clickU = async u => { await settle(); const pt = await p.evaluate(u => { const C = __lab.Scene3D.consts; return __lab.Scene3D.project(new THREE.Vector3(0, C.yOf(u), 0)); }, u); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(200); };
  const fb = async () => ((await p.textContent('.fb').catch(() => '')) || '').slice(0, 60);
  const shot = n => p.screenshot({ path: OUT + n + '.png' });
  const step = async n => console.log(n.padEnd(14), await fb(), JSON.stringify(await p.evaluate(() => ({ m: __lab.S.mount, held: __lab.S.held, goal: !!__lab.Scene3D.goal, tw: __lab.Scene3D.tweens.length }))));

  // 1 입고
  await settle(); await shot('1-recv');
  const scen = await p.evaluate(() => __lab.S.scen);
  for (const id of { clean: [], serial: ['serial'], missing: ['sfp'], damaged: ['look'] }[scen]) await p.click('[data-act=flag][data-id=' + id + ']');
  await p.click('[data-act=recv-submit]'); await p.waitForTimeout(1200); await shot('1b-opened'); await p.click('[data-act=next]');
  // 2 PDU: 먼저 16A (실패 기대) -> 다시 꺼내기 -> 32A
  await settle(); await shot('2-pdu-start');
  await p.fill('#p-total', '17.05'); await p.fill('#p-norm', '8.5'); await p.fill('#p-fail', '17.05'); await p.fill('#p-warn', '22.4'); await p.fill('#p-crit', '25.6');
  await clickItem('pdu16a'); await shot('2b-held'); await clickTarget('slotL'); await settle();
  await clickItem('pdu16b'); await clickTarget('slotR'); await settle();
  await p.click('[data-act=pdu-do]'); await step('pdu16:'); await shot('2c-fail');
  console.log('kept inputs', await p.inputValue('#p-total'));
  await p.click('[data-act=pdu-reset]'); await settle();
  await clickItem('pdu32a'); await clickTarget('slotL'); await settle(); await clickItem('pdu32b'); await clickTarget('slotR'); await settle();
  await p.click('[data-act=pdu-do]'); await step('pdu32:'); await shot('2d-ok'); await p.click('[data-act=next]');
  // 3 마운트: 레일(잘못된 U20) -> 레일 U39 -> 스위치 방향 전면(실패) -> 다시 -> 후면
  await settle();
  await clickItem('rails'); await clickU(37); await step('rails U37:');
  await clickItem('rails'); await clickU(39); await settle(); await step('rails U39:'); await shot('3-rails');
  await p.check('input[name=face][value=front]'); await clickItem('switch'); await clickU(39); await settle(); await step('face front:'); await shot('3b-wrongface');
  await p.click('[data-act=mount-redo]'); await settle();
  await p.check('input[name=face][value=rear]'); await clickItem('switch'); await clickU(39); await settle(); await step('face rear:'); await shot('3c-ok');
  await p.click('[data-act=next]');
  // 4 전원: 같은 PDU 먼저
  await settle(); await shot('4-power-start');
  const dump = async l => console.log(l, JSON.stringify(await p.evaluate(() => ({ held: __lab.S.held, pend: __lab.S.pend && __lab.S.pend.psu, used: __lab.S.power.used, conn: Object.keys(__lab.S.power.conn), nt: __lab.Scene3D.targetMeshes.map(t => t.userData.tid).slice(0, 3) }))));
  await clickItem('cord1'); await dump('held c1'); await clickTarget('psu1'); await dump('psu1'); await clickTarget('o:A:0'); await dump('out'); await clickItem('cord2'); await dump('held c2'); await clickTarget('psu2'); await clickTarget('o:A:1'); await step('same PDU:');
  await p.click('[data-act=power-reset]');
  await clickItem('cord1'); await clickTarget('psu1'); await clickTarget('o:A:0'); await clickItem('cord2'); await clickTarget('psu2'); await clickTarget('o:B:0'); await step('A/B:'); await shot('4b-power-ok');
  await p.click('[data-act=next]');
  // 5 광
  await settle();
  await clickItem('fib1'); await clickTarget('t1'); await clickTarget('CORE-A'); await clickItem('fib2'); await clickTarget('t2'); await clickTarget('CORE-B');
  for (const i of [1, 2]) { const f = await p.$('[data-act=flip][data-i="' + i + '"]'); if (f) await f.click(); }
  for (const i of [1, 2]) await p.check('[data-act=label][data-i="' + i + '"]');
  await settle(); await shot('5-fiber'); await p.click('[data-act=fiber-done]');
  // 6 콘솔
  await settle(); console.log('input disabled before console:', await p.isDisabled('#ci'));
  await clickItem('console'); await clickTarget('con'); await settle(); await shot('6-console');
  const cmds = ['enable', 'conf t', 'hostname SW-BD-R12-01', 'vlan 99', 'name MGMT', 'exit', 'vlan 100', 'exit', 'int vlan 99', 'ip address 10.10.99.21 255.255.255.0', 'no shutdown', 'exit', 'ip default-gateway 10.10.99.1', 'int range te1/1/1 - 2', 'switchport mode trunk', 'switchport trunk allowed vlan 99,100', 'description to-CORE', 'exit', 'snmp-server community kwanje-ro ro', 'end', 'wr', 'show lldp neighbors', 'ping 10.10.99.1'];
  for (const c of cmds) { await p.fill('#ci', c); await p.press('#ci', 'Enter'); }
  await shot('6b-cli'); console.log('cli-next disabled:', await p.getAttribute('#cli-next', 'disabled')); await p.click('#cli-next');
  await p.fill('#m-name', 'SW-BD-R12-01'); await p.fill('#m-ip', '10.10.99.21'); await p.fill('#m-comm', 'kwanje-ro');
  await p.click('[data-act=mon-reg]'); await p.click('[data-act=mon-verify]'); await p.waitForTimeout(2600); await shot('7-mon');
  await p.click('[data-act=next]'); await p.waitForTimeout(800); await shot('8-done');
  console.log('scen', scen, 'errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
