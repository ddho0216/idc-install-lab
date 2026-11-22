// 레벨 1 자동 플레이 (Playwright). 사용: node tests/play1.js [URL]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8767/';
const OUT = process.env.OUT || '/tmp/play-';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 560 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await p.goto(URL + '?test'); await p.waitForTimeout(500);
  await p.click('[data-s="1"]'); await p.waitForTimeout(600);
  const shot = n => p.screenshot({ path: OUT + n + '.png' });
  const wait = ms => p.waitForTimeout(ms);
  const idle = () => p.waitForFunction(() => !__g.tw.length && !__g.timers.length, null, { timeout: 15000 }).catch(async e => { console.log('IDLE TIMEOUT', await p.evaluate(() => JSON.stringify({ tw: __g.tw.length, tm: __g.timers.length, modal: __g.modal, run: __g.running, hold: !!__g.hold }))); throw e; });
  // 도우미: 위치 이동 + 조준 + 사용
  const goLook = (x, z, tx, ty, tz) => p.evaluate(([x, z, tx, ty, tz]) => { __g.pos.set(x, 0, z); __g.lookAt(new THREE.Vector3(tx, ty, tz)); }, [x, z, tx, ty, tz]);
  const raf = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const press = async () => { await raf(); const f = await p.evaluate(() => { __g.primary(); return __g.focus ? __g.focus.kind + ':' + (__g.focus.obj.userData.item ? __g.focus.obj.userData.item.id : (__g.focus.obj.userData.slot ? __g.focus.obj.userData.slot.name : 'use')) : 'none'; }); if (process.env.V) console.log('  press ->', f); await wait(120); };
  const itemPos = id => p.evaluate(id => { const m = __g.items[id].hit; m.updateMatrixWorld(true); const v = m.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }, id);
  const slotPos = nm => p.evaluate(nm => { const s = __g.slots.find(s => s.userData.slot.name === nm && s.userData.slot.enabled); if (!s) return null; const v = s.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }, nm);
  const grab = async (id, from) => { const q = await itemPos(id); await goLook(from[0], from[1], q[0], q[1], q[2]); await press(); };
  const aimSlot = async (nm, from) => { const q = await slotPos(nm); if (!q) throw new Error('no slot ' + nm); await goLook(from[0], from[1], q[0], q[1], q[2]); await press(); };
  const useAt = async (x, y, z, from) => { await goLook(from[0], from[1], x, y, z); await press(); };
  const toast = () => p.evaluate(() => [...document.querySelectorAll('.tt')].map(t => t.textContent).slice(-2).join(' | '));
  const dismiss = async () => { await p.evaluate(() => { const m = document.querySelector('#modal'); if (!m.hidden) { const b = m.querySelector('[data-a="close"]'); b && b.click(); } }); await wait(150); };

  await shot('0-intro'); await dismiss();
  // 1 박스 개봉
  await useAt(-4.95, 1.0, -0.8, [-4.95, 0.3]); await wait(2200); await shot('1-open');
  // 2 검수
  const scen = await p.evaluate(() => __g.S.scen); console.log('scen', scen);
  await useAt(-3.95, 0.86, -1.05, [-3.95, 0.2]); await shot('2-clip');
  for (const id of { clean: [], serial: ['serial'], missing: ['cab'], damaged: ['look'] }[scen]) await p.click('[data-id=' + id + ']');
  await p.click('[data-a=recvOk]'); await wait(200);
  // 3 PDU: 16A 먼저 (불합격 기대) → 32A로 교체
  const pduSlot = async (id, lr) => { await grab(id, [-6.2, -2.7]); await aimSlot('pdu' + lr, [lr === 'L' ? 0.5 : -0.5, ZR(-4.0)]); await idle(); };
  function ZR(v) { return v; }
  await pduSlot('pdu20a', 'L'); await pduSlot('pdu20b', 'R'); await wait(300); await shot('3-pdu20');
  console.log('inspect pdu(20A):', await p.evaluate(() => __g.inspectList().find(x => x.id === 'pdu').state));
  // 20A 빼내기: LCD 설정 화면에서 빼기
  for (const lr of ['L', 'R']) { const x = lr === 'L' ? 0.262 : -0.262; await useAt(x, 1.5, -3.55, [lr === 'L' ? 0.5 : -0.5, -4.1]); await p.click('[data-a=pduRemove]'); await wait(1000); }
  await pduSlot('pdu32a', 'L'); await pduSlot('pdu32b', 'R'); await wait(300);
  for (const lr of ['L', 'R']) { const x = lr === 'L' ? 0.262 : -0.262; await useAt(x, 1.5, -3.55, [lr === 'L' ? 0.5 : -0.5, -4.1]); await p.fill('#pw', '22.4'); await p.fill('#pc', '25.6'); await p.click('[data-a=pduSave]'); await wait(200); }
  await shot('3b-pdu32');
  // 4 레일 + 서버 (방향 틀리게 먼저)
  const rack = (u) => p.evaluate(u => __g.W.yOfU(u), u);
  const y38 = await rack(5);
  await grab('rails', [-3.75, 0.0]); await goLook(0, -1.8, 0, y38, -2.5); await press(); await idle(); await wait(1900); await shot('4-rails');
  console.log('after rails:', await toast());
  await grab('dev', [-4.95, 0.3]); console.log('hold:', await p.evaluate(() => __g.hold && __g.hold.label));
  await p.evaluate(() => { __g.flip = true; }); await goLook(0, -1.8, 0, y38, -2.5); await wait(300); await shot('4b-aim'); await press(); await wait(2500); await shot('4c-sliding'); await idle(); await wait(1500);
  console.log('dir check:', await p.evaluate(() => __g.inspectList().find(x => x.id === 'dir').state));
  // 방향 틀림 → 빼서 다시
  await useAt(0, y38, -2.5, [0, -1.8]); await idle(); await wait(800); // 장비 빼기
  await p.evaluate(() => { __g.flip = false; }); await grab('dev', [-4.95, 0.3]); await goLook(0, -1.8, 0, y38, -2.5); await press(); await idle(); await wait(2200); await shot('4d-mounted');
  console.log('dir check2:', await p.evaluate(() => __g.inspectList().find(x => x.id === 'dir').state));
  // 5 전원
  const connect = async (id, from, slotA, fromA, slotB, fromB) => { await grab(id, from); await aimSlot(slotA, fromA); await aimSlot(slotB, fromB); await idle(); await wait(300); };
  await connect('cord1', [-4.95, 0.3], 'psu1', [0.2, -4.0], 'PDU-A 3번', [0.5, -4.0]);
  await connect('cord2', [-4.95, 0.3], 'psu2', [-0.2, -4.0], 'PDU-B 3번', [-0.5, -4.0]); await shot('5-power');
  // 6 네트워크
  await connect('cat6', [-4.95, 0.3], 'nic1', [0.2, -4.0], 'SW-ACC-01 Te1/0/11', [0.8, -4.0]); await shot('6-net');
  // 7 부팅
  const bp = await p.evaluate(() => { const v = __g.S ? null : null; const b = __g.usables.find(u => u.userData.use && /서버 전원/.test(typeof u.userData.use.prompt === 'function' ? u.userData.use.prompt() : '')); const w = b.getWorldPosition(new THREE.Vector3()); return [w.x, w.y, w.z]; });
  await useAt(bp[0], bp[1], bp[2], [0.1, -1.7]); await wait(500); await shot('7-boot');
  // 감독관 검수
  // 클램프 미터로 PDU-A 전류 측정
  await grab('meter', [-6.0, -2.75]); await aimSlot('meter-A', [0.5, -4.3]); await wait(200);
  console.log('meter toast:', await p.evaluate(() => [...document.querySelectorAll('.tt')].map(t => t.textContent).pop())); await p.evaluate(() => __g.dropHeld()); await wait(900);
  console.log('final:', JSON.stringify(await p.evaluate(() => __g.inspectList().map(x => x.id + ':' + x.state))));
  await p.evaluate(() => { __g.pos.set(-2.6, 0, 2.2); __g.lookAt(new THREE.Vector3(-2.6, 1.0, 3.2)); }); await wait(200); console.log('npc focus', await p.evaluate(() => JSON.stringify({ f: __g.focus && (__g.focus.obj.userData.use ? 'use:' + (typeof __g.focus.obj.userData.use.prompt === 'function' ? __g.focus.obj.userData.use.prompt() : __g.focus.obj.userData.use.prompt) : 'other'), hold: !!__g.hold, modal: __g.modal, pos: [__g.pos.x, __g.pos.z] }))); await p.evaluate(() => __g.primary()); await wait(300); await p.click('[data-a=inspect]'); await wait(500); await shot('8-inspect');
  console.log('errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
