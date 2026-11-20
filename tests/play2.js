// 레벨 2 자동 플레이. 사용: node tests/play2.js [URL]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8767/';
const OUT = process.env.OUT || '/tmp/play2-';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 560 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await p.goto(URL + '?test'); await p.waitForTimeout(500); await p.click('[data-s="2"]'); await p.waitForTimeout(600);
  const shot = n => p.screenshot({ path: OUT + n + '.png' }), wait = ms => p.waitForTimeout(ms);
  const idle = () => p.waitForFunction(() => !__g.tw.length && !__g.timers.length, null, { timeout: 20000 });
  const goLook = (x, z, tx, ty, tz) => p.evaluate(([x, z, tx, ty, tz]) => { __g.pos.set(x, 0, z); __g.lookAt(new THREE.Vector3(tx, ty, tz)); }, [x, z, tx, ty, tz]);
  const raf = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const press = async () => { await raf(); await p.evaluate(() => __g.primary()); await wait(100); };
  const itemPos = id => p.evaluate(id => { const m = __g.items[id].hit; m.updateMatrixWorld(true); const v = m.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }, id);
  const slotPos = nm => p.evaluate(nm => { const s = __g.slots.find(s => s.userData.slot.name === nm && s.userData.slot.enabled); if (!s) return null; const v = s.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }, nm);
  const usePos = rx => p.evaluate(src => { const re = new RegExp(src); const u = __g.usables.find(u => { const pr = u.userData.use.prompt; return re.test(typeof pr === 'function' ? pr() : pr); }); if (!u) return null; const v = u.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }, rx);
  const grab = async (id, from) => { const q = await itemPos(id); await goLook(from[0], from[1], q[0], q[1], q[2]); await press(); };
  const aimSlot = async (nm, from) => { const q = await slotPos(nm); if (!q) throw new Error('no slot ' + nm); await goLook(from[0], from[1], q[0], q[1], q[2]); await press(); };
  const useAt = async (x, y, z, from) => { await goLook(from[0], from[1], x, y, z); await press(); };
  const useRx = async (rx, from) => { const q = await usePos(rx); if (!q) throw new Error('no use ' + rx); await useAt(q[0], q[1], q[2], from); };
  const dismiss = async () => { await p.evaluate(() => { const m = document.querySelector('#modal'); if (!m.hidden) { const b = m.querySelector('[data-a="close"]'); b && b.click(); } }); await wait(150); };
  const connect = async (id, from, a, fa, c, fc) => { await grab(id, from); await aimSlot(a, fa); await aimSlot(c, fc); await idle(); await wait(300); };
  await dismiss();
  await useAt(-4.95, 1.0, -0.8, [-4.95, 0.3]); await wait(2200);
  const scen = await p.evaluate(() => __g.S.scen); console.log('scen', scen);
  await useAt(-3.95, 0.86, -1.05, [-3.95, 0.2]);
  for (const id of { clean: [], serial: ['serial'], missing: ['cab'], damaged: ['look'] }[scen]) await p.click('[data-id=' + id + ']');
  await p.click('[data-a=recvOk]'); await wait(200);
  const y = await p.evaluate(() => __g.W.yOfU(39));
  await grab('rails', [-3.75, 0.0]); await goLook(0, -1.8, 0, y, -2.5); await press(); await idle(); await wait(1500);
  await p.evaluate(() => { __g.flip = false; }); await grab('dev', [-4.95, 0.3]); await goLook(0, -1.8, 0, y, -2.5); await press(); await idle(); await wait(2200); await shot('1-mounted');
  await connect('cord1', [-4.95, 0.3], 'psu1', [0.2, -4.0], 'PDU-A 3번', [0.5, -4.0]);
  await connect('cord2', [-4.95, 0.3], 'psu2', [-0.2, -4.0], 'PDU-B 3번', [-0.5, -4.0]);
  await connect('fib1', [-4.95, 0.3], 't1', [0.2, -4.0], 'CORE-A', [0.7, -4.0]);
  await connect('fib2', [-4.95, 0.3], 't2', [0.2, -4.0], 'CORE-B', [0.7, -4.0]); await shot('2-fibers');
  // 극성/라벨
  for (let k = 0; k < 2; k++) { for (const rx of ['Tx/Rx 뒤집기 \\(링크 DOWN\\)']) { const q = await usePos(rx); if (q) await useAt(q[0], q[1], q[2], [q[0], -4.0]); } }
  for (const i of [1, 2]) { const q = await usePos('T' + i + ' 라벨 붙이기'); console.log('label use', i, q && q.map(v => +v.toFixed(2))); if (q) { await useAt(q[0], q[1], q[2], [q[0], -4.0]); console.log('  focus', await p.evaluate(() => __g.focus && __g.focus.kind + ':' + (typeof __g.focus.obj.userData.use.prompt === 'function' ? __g.focus.obj.userData.use.prompt() : __g.focus.obj.userData.use.prompt)), 'label', await p.evaluate(i => __g.S.fiber[i].label, i)); } }
  await connect('console', [-4.95, 0.3], 'con', [0.2, -4.0], 'laptop', [-3.4, 0.2]); await shot('3-console');
  // 터미널
  await useRx('노트북', [-3.7, 0.2]); await wait(200);
  const cmds = ['enable', 'conf t', 'hostname SW-BD-R12-01', 'vlan 99', 'name MGMT', 'exit', 'vlan 100', 'exit', 'int vlan 99', 'ip address 10.10.99.21 255.255.255.0', 'no shutdown', 'exit', 'ip default-gateway 10.10.99.1', 'int range te1/1/1 - 2', 'switchport mode trunk', 'switchport trunk allowed vlan 99,100', 'description to-CORE', 'exit', 'snmp-server community kwanje-ro ro', 'end', 'wr', 'show lldp neighbors'];
  for (const c of cmds) { await p.fill('#ci', c); await p.press('#ci', 'Enter'); } await shot('4-term'); await p.click('[data-a=close]'); await wait(200);
  // 관제
  await useRx('관제 PC', [5.0, 2.4]); await p.fill('#mn', 'SW-BD-R12-01'); await p.fill('#mi', '10.10.99.21'); await p.fill('#mc', 'kwanje-ro'); await p.click('[data-a=monReg]'); await wait(200); await p.click('[data-a=monVer]'); await wait(2200); await shot('5-mon'); await p.click('[data-a=close]'); await wait(200);
  console.log('final:', JSON.stringify(await p.evaluate(() => __g.inspectList().map(x => x.id + ':' + x.state))));
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
