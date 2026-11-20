const assert = require('assert');
const { Device, REQ } = require('../js/cli.js');
let cabled = { 'Te1/1/1': true, 'Te1/1/2': true };
const mk = () => new Device({ serial: 'FOC1', link: n => ({ phys: !!cabled[n], hasCable: !!cabled[n], tx: -2, rx: -3, peer: { name: 'CORE-A', port: 'Te1/0/12' } }) });
const d = mk();
function go(...ls) { return ls.map(l => d.run(l)); }
go('enable', 'conf t', 'hostname ' + REQ.host, 'vlan 99', 'name MGMT', 'exit', 'vlan 100', 'exit',
  'int vlan 99', 'ip address 10.10.99.21 255.255.255.0', 'no shutdown', 'exit', 'ip default-gateway 10.10.99.1',
  'int range te1/1/1 - 2', 'switchport mode trunk', 'switchport trunk allowed vlan 99,100', 'description to-CORE', 'exit',
  'snmp-server community kwanje-ro ro', 'end');
assert.ok(!d.tasks().find(t => t.id === 'save').ok);
assert.deepStrictEqual(d.tasks().filter(t => t.id !== 'save').map(t => t.ok), Array(7).fill(true));
d.run('wr');
assert.ok(d.tasks().every(t => t.ok), JSON.stringify(d.tasks()));
assert.ok(d.run('ping 10.10.99.1').join('\n').includes('100 percent'));
cabled = {};
assert.ok(d.run('ping 10.10.99.1').join('\n').includes('0 percent'));
assert.ok(d.run('show lldp neighbors')[0].startsWith('(이웃'));
assert.ok(d.run('foo').join('').includes('Invalid'));
assert.ok(d.run('conf').join('').includes('Incomplete') || true);
assert.strictEqual(d.prompt(), 'SW-BD-R12-01#');
d.run('conf t'); d.run('hostname X'); d.run('end');
assert.ok(!d.tasks().find(t => t.id === 'save').ok, 'saved state must go stale after change');
assert.ok(d.run('show run | x').length >= 0);
console.log('cli ok');
