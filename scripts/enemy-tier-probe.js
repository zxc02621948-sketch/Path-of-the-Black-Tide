// 探針：找出會生出 undefined name / NaN hp 的敵人/條件
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'enemies.js'), 'utf8');

// enemies.js 內的 G/CONFIG 都用 typeof 守過，給個 stub 保險
const G = { day: 1, darkness: 0 };
const CONFIG = {};
const load = new Function('G', 'CONFIG',
  code + '\n; return { ENEMIES, resolveEnemyTier, getMaxTierMediumEnemy, randomEnemyForDay, getEnemyById };');
const { ENEMIES, resolveEnemyTier, getMaxTierMediumEnemy, randomEnemyForDay } = load(G, CONFIG);

const bad = [];
function check(label, e) {
  if (!e) { bad.push(label + ' => null/undefined'); return; }
  const nameOk = typeof e.name === 'string' && e.name.length > 0;
  const hpOk = Number.isFinite(e.hp);
  const atkOk = Number.isFinite(e.attack);
  if (!nameOk || !hpOk || !atkOk) {
    bad.push(`${label} => name=${e.name} hp=${e.hp} attack=${e.attack} id=${e.id} idx=${e.tierStageIndex}`);
  }
}

// 1) 資料健檢 + 每隻敵人 × 各天數
const days = [1, 2, 3, 4, 5, 7, 10, 12, 15, 20, 25, 30, 999];
for (const base of ENEMIES) {
  if (base.tiers && (!Number.isFinite(base.tierUpDays) || base.tierUpDays <= 0)) {
    bad.push(`DATA: id=${base.id} tier=${base.tier} 有 tiers 但 tierUpDays=${base.tierUpDays}`);
  }
  for (const d of days) check(`resolveEnemyTier(${base.id}, day=${d})`, resolveEnemyTier(base, d));
}

// 2) 兩條隨機路徑
for (let i = 0; i < 300; i++) check(`getMaxTierMediumEnemy#${i}`, getMaxTierMediumEnemy());
for (const d of [1, 2, 4, 8, 15, 30]) for (let i = 0; i < 100; i++) check(`randomEnemyForDay(day=${d})`, randomEnemyForDay(false, d));

if (bad.length === 0) console.log('ALL OK — 沒找到 undefined/NaN 敵人');
else { console.log('FOUND ' + bad.length + ' 個問題（去重後前 40 條）：'); console.log([...new Set(bad)].slice(0, 40).join('\n')); }
