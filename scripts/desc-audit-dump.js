// 傾印每個武器/裝備/聖物/共鳴的 desc 與實際 effect，供文字審查對照。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const boot = new Function(`
  ${read('js/config.js')}
  ;${read('js/data/equipment.js')}
  ;${read('js/data/relics.js')}
  ;${read('js/data/resonances.js')}
  ;return { EQUIPMENT, WEAPONS, GEARS, RELICS, RELIC_FUSED_DESCS, RESONANCES };
`);
const E = boot();

const line = '─'.repeat(70);
function dump(label, items, fields) {
  console.log('\n' + line + '\n## ' + label + '\n' + line);
  for (const it of items) {
    console.log(`\n[${it.id}] ${it.name || ''}`);
    console.log('  desc : ' + (it.desc || '(無)'));
    for (const f of fields) {
      if (it[f] !== undefined) console.log(`  ${f}: ` + JSON.stringify(it[f]));
    }
  }
}

dump('消耗品 EQUIPMENT', E.EQUIPMENT, ['effect']);
dump('武器 WEAPONS', E.WEAPONS, ['family', 'tier', 'effect']);
dump('裝備 GEARS', E.GEARS, ['minDay', 'effect']);

console.log('\n' + line + '\n## 聖物 RELICS（desc / fusedDesc / effect / fusedEffect）\n' + line);
for (const r of E.RELICS) {
  console.log(`\n[${r.id}] ${r.name}  (${r.rarity}${r.poolWeight !== undefined ? ', poolWeight=' + r.poolWeight : ''})`);
  console.log('  desc      : ' + (r.desc || '(無)'));
  console.log('  fusedDesc : ' + (E.RELIC_FUSED_DESCS[r.id] || '(無)'));
  console.log('  effect    : ' + JSON.stringify(r.effect));
  console.log('  fusedEff  : ' + JSON.stringify(r.fusedEffect));
}

console.log('\n' + line + '\n## 共鳴 RESONANCES（desc / bodyEffect.desc / 數值）\n' + line);
for (const res of E.RESONANCES) {
  console.log(`\n[${res.id}] ${res.name}  relics=${JSON.stringify(res.relics)} bodyRequiresFused=${res.bodyRequiresFused}`);
  console.log('  desc          : ' + (res.desc || '(無)'));
  console.log('  bodyEffect    : ' + JSON.stringify(res.bodyEffect));
}
