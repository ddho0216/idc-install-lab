const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user/9efb4158-d7e6-5068-b529-afd4cbdc5fca/scratchpad/v2-';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('http://localhost:8766/');
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '1-recv.png' });
  // step0: mark expected flag per scenario via state
  const scen = await p.evaluate(() => __lab.S.scen);
  const map = { clean: [], serial: ['serial'], missing: ['sfp'], damaged: ['look'] }[scen];
  for (const id of map) await p.click('[data-act=flag][data-id=' + id + ']');
  await p.click('[data-act=recv-submit]'); await p.click('[data-act=next]'); await p.screenshot({ path: OUT + '1b-recv.png' });
  // step PDU: 16A 먼저(실패 기대), 그다음 32A
  await p.fill('#p-total', '17.05'); await p.fill('#p-norm', '8.5'); await p.fill('#p-fail', '17.05'); await p.selectOption('#p-rate', '16');
  await p.fill('#p-warn', '11.2'); await p.fill('#p-crit', '12.8'); await p.click('[data-act=pdu-do]');
  console.log('pdu16:', (await p.textContent('.fb')).slice(0, 40), 'kept total=', await p.inputValue('#p-total'));
  await p.selectOption('#p-rate', '32'); await p.fill('#p-warn', '22.4'); await p.fill('#p-crit', '25.6'); await p.click('[data-act=pdu-do]');
  await p.waitForTimeout(1800); await p.screenshot({ path: OUT + '2b-pdu.png' }); await p.click('[data-act=next]');
  // step1: wrong first (front), then right
  await p.fill('#u', '38'); await p.check('input[name=face][value=front]'); await p.click('[data-act=mount-do]');
  await p.waitForTimeout(600); await p.screenshot({ path: OUT + '2-mount-wrong.png' });
  await p.check('input[name=face][value=rear]'); await p.click('[data-act=mount-do]'); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '3-mount-ok.png' });
  await p.click('[data-act=next]');
  // step2 power: same PDU first
  await p.selectOption('#s2', 'A'); await p.selectOption('#o1', '1'); await p.selectOption('#o2', '2'); await p.click('[data-act=power-do]');
  const fb1 = await p.textContent('.fb');
  await p.selectOption('#s2', 'B'); await p.click('[data-act=power-do]'); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '4-power.png' });
  await p.click('[data-act=next]');
  // step3 fiber
  await p.selectOption('#c1', 'CORE-A'); await p.click('[data-act=connect][data-i="1"]');
  await p.selectOption('#c2', 'CORE-B'); await p.click('[data-act=connect][data-i="2"]');
  for (const i of [1, 2]) { const f = await p.$('[data-act=flip][data-i="' + i + '"]'); if (f) await f.click(); }
  for (const i of [1, 2]) await p.check('[data-act=label][data-i="' + i + '"]');
  await p.waitForTimeout(1500); await p.screenshot({ path: OUT + '5-fiber.png' });
  await p.click('[data-act=fiber-done]');
  // step4 cli
  const cmds = ['enable', 'conf t', 'hostname SW-BD-R12-01', 'vlan 99', 'name MGMT', 'exit', 'vlan 100', 'exit', 'int vlan 99', 'ip address 10.10.99.21 255.255.255.0', 'no shutdown', 'exit', 'ip default-gateway 10.10.99.1', 'int range te1/1/1 - 2', 'switchport mode trunk', 'switchport trunk allowed vlan 99,100', 'description to-CORE', 'exit', 'snmp-server community kwanje-ro ro', 'end', 'wr', 'show lldp neighbors', 'ping 10.10.99.1'];
  for (const c of cmds) { await p.fill('#ci', c); await p.press('#ci', 'Enter'); }
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '6-cli.png' });
  console.log('next disabled?', await p.getAttribute('#cli-next', 'disabled'));
  await p.click('#cli-next');
  await p.fill('#m-name', 'SW-BD-R12-01'); await p.fill('#m-ip', '10.10.99.21'); await p.fill('#m-comm', 'kwanje-ro');
  await p.click('[data-act=mon-reg]'); await p.click('[data-act=mon-verify]'); await p.waitForTimeout(2600);
  await p.screenshot({ path: OUT + '7-mon.png' });
  await p.click('[data-act=next]'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '8-done.png' });
  console.log('scen', scen, 'fb1', fb1.slice(0, 40), 'errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
