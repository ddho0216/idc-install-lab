/* 가상 스위치 콘솔 (Cisco IOS 비슷한 문법, 제가 만든 가상 장비입니다. 실제 장비 접속 없음) */
(function (root) {
  const REQ = { host: 'SW-BD-R12-01', ip: '10.10.99.21', mask: '255.255.255.0', gw: '10.10.99.1', community: 'kwanje-ro', mgmtServer: '10.10.50.5' };
  const UPLINKS = ['Te1/1/1', 'Te1/1/2'];

  function parsePort(s) {
    const m = /^(te\w*|gi\w*)\s*1\/([01])\/(\d+)$/i.exec(s.trim());
    if (!m) return null;
    const te = /^te/i.test(m[1]);
    const n = +m[3];
    if (te && m[2] === '1' && n >= 1 && n <= 2) return 'Te1/1/' + n;
    if (!te && m[2] === '0' && n >= 1 && n <= 48) return 'Gi1/0/' + n;
    return null;
  }
  function parseRange(str) {
    const out = [];
    for (const part of str.split(',')) {
      const m = /^\s*(te\w*|gi\w*)\s*(1\/[01]\/)(\d+)\s*(?:-\s*(\d+))?\s*$/i.exec(part);
      if (!m) return null;
      const a = +m[3], b = m[4] ? +m[4] : a;
      for (let i = a; i <= b; i++) {
        const p = parsePort(m[1] + m[2] + i);
        if (!p) return null;
        out.push(p);
      }
    }
    return out.length ? out : null;
  }
  function maskOk(m) { return /^(255|254|252|248|240|224|192|128|0)(\.(255|254|252|248|240|224|192|128|0)){3}$/.test(m); }
  function ipOk(s) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every(n => +n <= 255); }
  function toInt(ip) { return ip.split('.').reduce((a, b) => a * 256 + +b, 0); }
  function sameNet(a, b, mask) { const m = toInt(mask); return ((toInt(a) & m) >>> 0) === ((toInt(b) & m) >>> 0); }
  function allowedHas(allowed, v) { return allowed === 'all' || allowed.split(',').map(Number).includes(v); }

  function Device(env) {
    this.env = env; // { serial, link(port) -> {phys, rx, tx, peer} }
    this.mode = 'user'; this.ctx = null;
    this.host = 'Switch'; this.gw = null; this.snmp = [];
    this.vlans = { 1: 'default' }; this.svi = {}; this.ports = {}; this.saved = null;
  }
  const P = Device.prototype;
  P.port = function (n) { return this.ports[n] || (this.ports[n] = { desc: '', mode: 'access', access: 1, allowed: 'all', shut: false }); };
  P.prompt = function () {
    const h = this.host;
    return { user: h + '>', priv: h + '#', config: h + '(config)#', if: h + '(config-if)#', ifr: h + '(config-if-range)#', vlan: h + '(config-vlan)#' }[this.mode];
  };
  P.running = function () {
    const L = ['!', 'hostname ' + this.host, '!'];
    Object.keys(this.vlans).filter(v => v !== '1').sort((a, b) => a - b).forEach(v => { L.push('vlan ' + v, ' name ' + this.vlans[v], '!'); });
    for (const n of Object.keys(this.ports).sort()) {
      const p = this.ports[n];
      L.push('interface ' + n);
      if (p.desc) L.push(' description ' + p.desc);
      if (p.mode === 'trunk') { L.push(' switchport mode trunk'); if (p.allowed !== 'all') L.push(' switchport trunk allowed vlan ' + p.allowed); }
      else if (p.access !== 1) L.push(' switchport access vlan ' + p.access);
      if (p.shut) L.push(' shutdown');
      L.push('!');
    }
    for (const v of Object.keys(this.svi)) {
      const s = this.svi[v];
      L.push('interface Vlan' + v);
      L.push(s.ip ? ' ip address ' + s.ip + ' ' + s.mask : ' no ip address');
      if (s.shut) L.push(' shutdown');
      L.push('!');
    }
    if (this.gw) L.push('ip default-gateway ' + this.gw);
    this.snmp.forEach(c => L.push('snmp-server community ' + c + ' RO'));
    L.push('!', 'end');
    return L.join('\n');
  };
  P.uplinkOk = function (vlan) {
    return UPLINKS.some(n => {
      const p = this.port(n), l = this.env.link(n);
      return l.phys && !p.shut && p.mode === 'trunk' && allowedHas(p.allowed, vlan);
    });
  };
  P.reach = function (ip) {
    const s = this.svi[99];
    if (!s || !s.ip || s.shut || !this.gw) return false;
    if (!sameNet(s.ip, this.gw, s.mask)) return false;
    if (!this.uplinkOk(99)) return false;
    return ip === this.gw || ip === REQ.mgmtServer;
  };
  P.tasks = function () {
    const up = UPLINKS.map(n => this.port(n));
    const s = this.svi[99] || {};
    return [
      { id: 'host', label: '호스트명 ' + REQ.host, ok: this.host === REQ.host },
      { id: 'vlan', label: 'VLAN 99(관리)와 VLAN 100(서버) 만들기', ok: !!this.vlans[99] && !!this.vlans[100] },
      { id: 'svi', label: '관리 IP ' + REQ.ip + '/24 를 Vlan99에 넣고 no shutdown', ok: s.ip === REQ.ip && s.mask === REQ.mask && !s.shut },
      { id: 'gw', label: '기본 게이트웨이 ' + REQ.gw, ok: this.gw === REQ.gw },
      { id: 'trunk', label: '업링크 2개를 trunk, 허용 VLAN 99·100', ok: up.every(p => p.mode === 'trunk' && allowedHas(p.allowed, 99) && allowedHas(p.allowed, 100) && p.allowed !== 'all') },
      { id: 'desc', label: '업링크 2개에 description(상대 장비 이름)', ok: up.every(p => p.desc.trim().length > 0) },
      { id: 'snmp', label: 'SNMP 읽기 전용 community ' + REQ.community, ok: this.snmp.includes(REQ.community) },
      { id: 'save', label: 'write memory 로 저장 (저장 후 변경하면 다시 저장)', ok: this.saved === this.running() },
    ];
  };

  const RULES = [];
  function rule(modes, spec, fn, help) { RULES.push({ modes, spec: spec.split(' '), fn, help }); }
  const CFG = ['config'], IFM = ['if', 'ifr'], PRIV = ['priv'], ANY_SHOW = ['user', 'priv'];

  rule(['user'], 'enable', function (d) { d.mode = 'priv'; return []; }, 'enable : 관리자 모드');
  rule(PRIV, 'disable', function (d) { d.mode = 'user'; return []; });
  rule(['user', 'priv'], 'exit', function (d) { d.mode = 'user'; return []; });
  rule(PRIV, 'configure terminal', function (d) { d.mode = 'config'; return ['Enter configuration commands, one per line.  End with CNTL/Z.']; }, 'configure terminal : 설정 모드');
  rule(PRIV, 'write memory', function (d) { d.saved = d.running(); return ['Building configuration...', '[OK]']; }, 'write memory : 저장');
  rule(PRIV, 'write', function (d) { d.saved = d.running(); return ['Building configuration...', '[OK]']; });
  rule(PRIV, 'copy running-config startup-config', function (d) { d.saved = d.running(); return ['Destination filename [startup-config]?', 'Building configuration...', '[OK]']; });
  rule(ANY_SHOW, 'show version', function (d) { return ['KS-OS Software, Version 16.9.4 (가상)', 'Model Number          : NX-4824T (가상 모델)', 'System Serial Number  : ' + d.env.serial, 'Uptime is 0 minutes', d.host + ' uptime is 0 minutes']; }, 'show version');
  rule(PRIV, 'show running-config', function (d) { return d.running().split('\n'); }, 'show running-config');
  rule(PRIV, 'show startup-config', function (d) { return d.saved ? d.saved.split('\n') : ['startup-config is not present']; });
  rule(PRIV, 'show vlan brief', function (d) {
    const L = ['VLAN Name                             Status    Ports', '---- -------------------------------- --------- ---------'];
    Object.keys(d.vlans).sort((a, b) => a - b).forEach(v => L.push(String(v).padEnd(5) + d.vlans[v].padEnd(33) + 'active'));
    return L;
  }, 'show vlan brief');
  rule(PRIV, 'show ip interface brief', function (d) {
    const L = ['Interface              IP-Address      OK? Method Status                Protocol'];
    const s = d.svi[99];
    if (s) L.push('Vlan99'.padEnd(23) + (s.ip || 'unassigned').padEnd(16) + 'YES manual ' + (s.shut ? 'administratively down' : (d.uplinkOk(99) ? 'up' : 'up')).padEnd(22) + (s.shut ? 'down' : (d.uplinkOk(99) ? 'up' : 'down')));
    for (const n of ['Gi1/0/1', 'Gi1/0/2'].concat(UPLINKS)) {
      const l = d.env.link(n), p = d.port(n);
      const st = p.shut ? 'administratively down' : (l.phys ? 'up' : 'down');
      L.push(n.padEnd(23) + 'unassigned'.padEnd(16) + 'YES unset  ' + st.padEnd(22) + (l.phys && !p.shut ? 'up' : 'down'));
    }
    return L;
  }, 'show ip interface brief');
  rule(PRIV, 'show interfaces status', function (d) {
    const L = ['Port      Name               Status       Vlan       Speed  Type'];
    for (const n of UPLINKS) {
      const l = d.env.link(n), p = d.port(n);
      L.push(n.padEnd(10) + (p.desc || '').slice(0, 18).padEnd(19) + (p.shut ? 'disabled' : (l.phys ? 'connected' : 'notconnect')).padEnd(13) + (p.mode === 'trunk' ? 'trunk' : String(p.access)).padEnd(11) + (l.phys ? 'a-10G' : 'auto') + '  SFP-10GBase-SR');
    }
    return L;
  }, 'show interfaces status');
  rule(PRIV, 'show interfaces * transceiver', function (d, a) {
    const n = parsePort(a[0]);
    if (!n || !UPLINKS.includes(n)) return ['% 이 포트에는 광 모듈이 없습니다. (업링크는 Te1/1/1, Te1/1/2)'];
    const l = d.env.link(n);
    if (!l.hasCable) return [n + ' 광 모듈 인식됨, 케이블 없음', 'Tx Power: -2.4 dBm   Rx Power: N/A (신호 없음)'];
    return [n + ' (SFP-10GBase-SR, 가상)', 'Tx Power: ' + l.tx.toFixed(1) + ' dBm   (정상 범위 -7.3 ~ -1.0)', 'Rx Power: ' + l.rx.toFixed(1) + ' dBm   (정상 범위 -9.9 ~ -1.0)' + (l.rx < -9.9 ? '   <-- 낮음' : '')];
  }, 'show interfaces <포트> transceiver : 광값');
  rule(PRIV, 'show interfaces trunk', function (d) {
    const L = ['Port      Mode  Status     Allowed vlans'];
    for (const n of UPLINKS) { const p = d.port(n), l = d.env.link(n); if (p.mode === 'trunk') L.push(n.padEnd(10) + 'on    ' + (l.phys && !p.shut ? 'trunking ' : 'not-trunk') + '  ' + p.allowed); }
    return L;
  });
  rule(PRIV, 'show lldp neighbors', function (d) {
    const L = ['Device ID           Local Intf   Port ID'];
    for (const n of UPLINKS) { const l = d.env.link(n), p = d.port(n); if (l.phys && !p.shut && l.peer) L.push(l.peer.name.padEnd(20) + n.padEnd(13) + l.peer.port); }
    return L.length > 1 ? L : ['(이웃 장비가 보이지 않습니다. 케이블/광 극성/포트 shutdown 확인)'];
  }, 'show lldp neighbors : 맞은편 장비');
  rule(PRIV, 'ping *', function (d, a) {
    const ip = a[0];
    if (!ipOk(ip)) return ['% Unrecognized host or address'];
    const ok = d.reach(ip);
    return ['Type escape sequence to abort.', 'Sending 5, 100-byte ICMP Echos to ' + ip + ', timeout is 2 seconds:', ok ? '!!!!!' : '.....', ok ? 'Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms' : 'Success rate is 0 percent (0/5)'];
  }, 'ping <IP>');

  rule(CFG, 'hostname *', function (d, a) {
    if (!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(a[0])) return ['% Invalid hostname'];
    d.host = a[0]; return [];
  }, 'hostname <이름>');
  rule(CFG, 'interface range **', function (d, a) {
    const r = parseRange(a[0]); if (!r) return ['% Invalid input detected (포트 범위 확인)'];
    d.mode = 'ifr'; d.ctx = r; return [];
  }, 'interface range <포트들>');
  rule(CFG, 'interface vlan *', function (d, a) {
    const v = +a[0]; if (!(v >= 1 && v <= 4094)) return ['% Invalid VLAN'];
    d.svi[v] = d.svi[v] || { ip: null, mask: null, shut: true };
    d.mode = 'if'; d.ctx = ['Vlan' + v]; return [];
  }, 'interface vlan <번호>');
  rule(CFG, 'interface **', function (d, a) {
    const p = parsePort(a[0]); if (!p) return ['% Invalid interface (예: te1/1/1 , gi1/0/1)'];
    d.port(p); d.mode = 'if'; d.ctx = [p]; return [];
  }, 'interface <포트>');
  rule(CFG, 'vlan *', function (d, a) {
    const v = +a[0]; if (!(v >= 2 && v <= 4094)) return ['% Invalid VLAN'];
    if (!d.vlans[v]) d.vlans[v] = 'VLAN' + String(v).padStart(4, '0');
    d.mode = 'vlan'; d.ctx = [v]; return [];
  }, 'vlan <번호>');
  rule(CFG, 'ip default-gateway *', function (d, a) { if (!ipOk(a[0])) return ['% Invalid IP']; d.gw = a[0]; return []; }, 'ip default-gateway <IP>');
  rule(CFG, 'snmp-server community * ro', function (d, a) { if (!d.snmp.includes(a[0])) d.snmp.push(a[0]); return []; }, 'snmp-server community <문자열> ro');
  rule(CFG, 'snmp-server community * rw', function () { return ['% 읽기/쓰기(RW)는 관제용으로 허용하지 않습니다. RO를 쓰세요.']; });
  rule(['vlan'], 'name *', function (d, a) { d.vlans[d.ctx[0]] = a[0]; return []; }, 'name <이름>');
  rule(IFM, 'description **', function (d, a) { d.ctx.forEach(n => { d.port(n).desc = a[0]; }); return []; }, 'description <글>');
  rule(IFM, 'ip address * *', function (d, a) {
    if (d.ctx[0].indexOf('Vlan') !== 0) return ['% 이 포트는 L2 포트입니다. (Vlan 인터페이스에서만 IP를 줍니다)'];
    if (!ipOk(a[0]) || !maskOk(a[1])) return ['% Invalid input detected'];
    const s = d.svi[+d.ctx[0].slice(4)]; s.ip = a[0]; s.mask = a[1]; return [];
  }, 'ip address <IP> <마스크>');
  rule(IFM, 'no shutdown', function (d) {
    d.ctx.forEach(n => { if (n.indexOf('Vlan') === 0) d.svi[+n.slice(4)].shut = false; else d.port(n).shut = false; }); return [];
  }, 'no shutdown');
  rule(IFM, 'shutdown', function (d) {
    d.ctx.forEach(n => { if (n.indexOf('Vlan') === 0) d.svi[+n.slice(4)].shut = true; else d.port(n).shut = true; }); return [];
  }, 'shutdown');
  rule(IFM, 'switchport mode trunk', function (d) { if (d.ctx[0].indexOf('Vlan') === 0) return ['% Invalid'];
    d.ctx.forEach(n => { d.port(n).mode = 'trunk'; if (d.port(n).allowed === 'all') d.port(n).allowed = 'all'; }); return []; }, 'switchport mode trunk');
  rule(IFM, 'switchport mode access', function (d) { d.ctx.forEach(n => { d.port(n).mode = 'access'; }); return []; });
  rule(IFM, 'switchport access vlan *', function (d, a) {
    const v = +a[0]; if (!(v >= 1 && v <= 4094)) return ['% Invalid VLAN'];
    if (!d.vlans[v]) d.vlans[v] = 'VLAN' + String(v).padStart(4, '0');
    d.ctx.forEach(n => { d.port(n).access = v; }); return [];
  });
  rule(IFM, 'switchport trunk allowed vlan *', function (d, a) {
    if (!/^\d+(,\d+)*$/.test(a[0])) return ['% 쉼표로 구분한 VLAN 번호만 지원합니다. (예: 99,100)'];
    d.ctx.forEach(n => { d.port(n).allowed = a[0]; }); return [];
  }, 'switchport trunk allowed vlan 99,100');
  ['config', 'if', 'ifr', 'vlan'].forEach(m => {
    rule([m], 'exit', function (d) { d.mode = m === 'config' ? 'priv' : 'config'; d.ctx = null; return []; });
    rule([m], 'end', function (d) { d.mode = 'priv'; d.ctx = null; return []; }, 'end');
  });

  Device.prototype.help = function () {
    const set = []; RULES.forEach(r => { if (r.modes.includes(this.mode) && r.help) set.push(r.help); });
    return ['사용할 수 있는 명령 (일부):'].concat(set.map(s => '  ' + s));
  };

  Device.prototype.run = function (line) {
    line = line.trim().replace(/\s+/g, ' ');
    if (!line) return [];
    if (line === '?') return this.help();
    let tokens = line.split(' ');
    let mode = this.mode;
    if (['config', 'if', 'ifr', 'vlan'].includes(mode) && tokens[0].toLowerCase() === 'do' && tokens.length > 1) { tokens = tokens.slice(1); mode = 'priv'; }
    const cands = RULES.filter(r => r.modes.includes(mode));
    const hits = [];
    for (const r of cands) {
      const args = specMatch(tokens, r.spec);
      if (args) hits.push({ r, args });
    }
    const self = this, real = this.mode;
    const exec = function (h) {
      if (mode === real) return h.r.fn(self, h.args);
      self.mode = mode; const out = h.r.fn(self, h.args); self.mode = real; return out;
    };
    if (hits.length === 1) return exec(hits[0]);
    if (hits.length > 1) {
      const exact = hits.filter(h => h.r.spec.every((s, i) => s === '*' || s === '**' || s === tokens[i]));
      if (exact.length === 1) return exec(exact[0]);
      const lit = h => h.r.spec.filter(x => x !== '*' && x !== '**').length;
      const best = Math.max.apply(null, hits.map(lit));
      const top = hits.filter(h => lit(h) === best);
      if (top.length === 1) return exec(top[0]);
      return ['% Ambiguous command: "' + line + '"'];
    }
    if (cands.some(r => partial(tokens, r.spec))) return ['% Incomplete command.'];
    return ["% Invalid input detected. ('?' 로 명령 확인)"];
  };

  function specMatch(tokens, spec) {
    const args = []; let i = 0;
    for (const s of spec) {
      if (s === '*') { if (i >= tokens.length) return null; args.push(tokens[i++]); }
      else if (s === '**') { if (i >= tokens.length) return null; args.push(tokens.slice(i).join(' ')); i = tokens.length; }
      else { if (i >= tokens.length) return null; if (!s.startsWith(tokens[i].toLowerCase())) return null; i++; }
    }
    return i === tokens.length ? args : null;
  }
  function partial(tokens, spec) {
    if (tokens.length >= spec.length) return false;
    for (let i = 0; i < tokens.length; i++) {
      const s = spec[i];
      if (s === '*' || s === '**') continue;
      if (!s.startsWith(tokens[i].toLowerCase())) return false;
    }
    return true;
  }

  const api = { Device, REQ, UPLINKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LabCLI = api;
})(typeof window !== 'undefined' ? window : globalThis);
