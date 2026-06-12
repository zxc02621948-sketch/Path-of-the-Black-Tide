// 聖物取得模擬：依真實掉落規則（加權抽選、不重複、事件二選一異組、
// 回響遺址保留聖物且僅在無共鳴時生成）模擬 20 天一輪能湊出哪些共鳴。
//
// 用法：node scripts/relic-acquisition-sim.js
//
// 模型假設（程式碼之外的遊玩參數）：
// - 每天 1~2 場戰鬥（平均 1.3），第 4 天起 50% 機率遇中型敵，掉落率用 CONFIG 表。
// - 每輪 2 次「事件聖物二選一」（隨機落在第 2~16 天）。
// - 回響遺址線索每天擲一次 10%（僅第 3 天起、無共鳴、活躍 <3 時）。
// - 玩家在遺址生成 2 天後將其清除（取得保留聖物）。
// - 隊伍有劍系與弓系武器（聖物池不被武器需求過濾）。

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_SRC = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8');
const RELICS_SRC = fs.readFileSync(path.join(ROOT, 'js/data/relics.js'), 'utf8');

const boot = new Function(`
  ${CONFIG_SRC}
  ;${RELICS_SRC}
  ;return { CONFIG, RELICS, getDayRelics, ECHO_RELIC_SYSTEMS };
`);
const E = boot();

const DAY_POOL = E.getDayRelics(); // 10 件白天聖物
const SYSTEMS = E.ECHO_RELIC_SYSTEMS; // 5 體系

const PAIRS = {
  wound: ['pain_mask', 'pain_splinter_badge'],
  eagle: ['eagle_eye_feather', 'flaw_lens'],
  fate: ['wager_dice', 'lucky_star'],
  banner: ['war_banner', 'eagle_banner'],
  sword: ['iron_scabbard', 'silver_bee_pin'],
};

const GROUP_BY_ID = {};
for (const [sys, ids] of Object.entries(PAIRS)) for (const id of ids) GROUP_BY_ID[id] = sys;

function relicWeight(r) {
  return Number.isFinite(r.poolWeight) ? r.poolWeight : (E.CONFIG.RARITY_WEIGHTS[r.rarity] ?? 0);
}

function weightedPick(pool) {
  let total = 0;
  const acc = [];
  for (const r of pool) {
    const w = relicWeight(r);
    if (w <= 0) continue;
    total += w;
    acc.push({ r, upper: total });
  }
  if (total <= 0) return null;
  const roll = Math.random() * total;
  return acc.find(a => roll < a.upper)?.r || null;
}

function dropChance(day, tier) {
  const rows = E.CONFIG.COMBAT_RELIC_DROP_CHANCES;
  let chance = 0;
  for (const row of rows) if (day >= row.minDay) chance = row[tier] ?? chance;
  return chance;
}

// strategy: 'generalist'（湊到哪套用哪套，立即融合）
//           'fateHunter'（只想要十二面骰：二選一優先拿命運件、不融合其他組）
function runOnce(strategy) {
  const owned = new Set();
  const reserved = new Set(); // 被遺址佔用
  const sites = []; // {systemId, relicId, clearDay}
  let resonanceFormedDay = null;
  let resonanceSystem = null;
  const completedDayBySystem = {};
  const choiceDays = [2 + Math.floor(Math.random() * 15), 2 + Math.floor(Math.random() * 15)];

  const available = () => DAY_POOL.filter(r => !owned.has(r.id) && !reserved.has(r.id));

  const checkPairs = (day) => {
    for (const [sys, [a, b]] of Object.entries(PAIRS)) {
      if (owned.has(a) && owned.has(b) && !(sys in completedDayBySystem)) {
        completedDayBySystem[sys] = day;
        if (!resonanceFormedDay) {
          if (strategy === 'generalist' || sys === 'fate') {
            resonanceFormedDay = day; // 立即融合 → 啟動共鳴 → 遺址停止生成
            resonanceSystem = sys;
          }
        }
      }
    }
  };

  const gain = (id, day) => {
    if (!id || owned.has(id)) return;
    owned.add(id);
    checkPairs(day);
  };

  for (let day = 1; day <= 20; day++) {
    // 遺址清除（先結算先前標記的）
    for (const site of sites) {
      if (!site.cleared && site.clearDay <= day) {
        site.cleared = true;
        reserved.delete(site.relicId);
        gain(site.relicId, day);
      }
    }

    // 遺址線索（每日一擲）
    const activeSites = sites.filter(s => !s.cleared).length;
    if (day >= (E.CONFIG.ECHO_SITE_MIN_DAY || 3) && !resonanceFormedDay && activeSites < (E.CONFIG.ECHO_SITE_MAX_ACTIVE || 3)) {
      if (Math.random() < (E.CONFIG.ECHO_SITE_EVENT_CHANCE ?? 0.10)) {
        const activeSystems = new Set(sites.filter(s => !s.cleared).map(s => s.systemId));
        const candidates = SYSTEMS.filter(sys => !activeSystems.has(sys.id))
          .map(sys => {
            const halves = PAIRS[sys.id].filter(id => !owned.has(id) && !reserved.has(id));
            return halves.length > 0 ? { id: sys.id, halves } : null;
          })
          .filter(Boolean);
        if (candidates.length > 0) {
          const sys = candidates[Math.floor(Math.random() * candidates.length)];
          const relicId = sys.halves[Math.floor(Math.random() * sys.halves.length)];
          reserved.add(relicId);
          sites.push({ systemId: sys.id, relicId, clearDay: day + 2, cleared: false });
        }
      }
    }

    // 戰鬥掉落
    const fights = Math.random() < 0.3 ? 2 : 1;
    for (let f = 0; f < fights; f++) {
      const tier = day <= 3 ? 'weak' : (Math.random() < 0.5 ? 'weak' : 'medium');
      if (Math.random() < dropChance(day, tier)) {
        const pick = weightedPick(available());
        if (pick) gain(pick.id, day);
      }
    }

    // 事件聖物二選一（異組偏好）
    for (const cd of choiceDays) {
      if (cd !== day) continue;
      const pool = available();
      const first = weightedPick(pool);
      if (!first) continue;
      const firstGroup = GROUP_BY_ID[first.id];
      const diffPool = pool.filter(r => r.id !== first.id && GROUP_BY_ID[r.id] !== firstGroup);
      const fallback = pool.filter(r => r.id !== first.id);
      const second = weightedPick(diffPool.length > 0 ? diffPool : fallback);
      const choices = [first, second].filter(Boolean);
      let pick;
      if (strategy === 'fateHunter') {
        pick = choices.find(r => GROUP_BY_ID[r.id] === 'fate')
          || choices.find(r => owned.has(PAIRS[GROUP_BY_ID[r.id]].find(x => x !== r.id)))
          || choices[0];
      } else {
        // generalist：優先補完已有的半套
        pick = choices.find(r => owned.has(PAIRS[GROUP_BY_ID[r.id]].find(x => x !== r.id)))
          || choices[0];
      }
      gain(pick.id, day);
    }
  }

  return { owned, completedDayBySystem, resonanceSystem, resonanceFormedDay, totalRelics: owned.size };
}

function simulate(strategy, n) {
  const stats = {
    n,
    totalRelics: 0,
    firstResonanceDaySum: 0,
    firstResonanceCount: 0,
    firstSystemCounts: {},
    pairCompleted: {},
    pairDaySum: {},
    anyPairCount: 0,
  };
  for (const sys of Object.keys(PAIRS)) {
    stats.pairCompleted[sys] = 0;
    stats.pairDaySum[sys] = 0;
  }
  for (let i = 0; i < n; i++) {
    const r = runOnce(strategy);
    stats.totalRelics += r.totalRelics;
    if (Object.keys(r.completedDayBySystem).length > 0) stats.anyPairCount++;
    if (r.resonanceFormedDay) {
      stats.firstResonanceDaySum += r.resonanceFormedDay;
      stats.firstResonanceCount++;
      stats.firstSystemCounts[r.resonanceSystem] = (stats.firstSystemCounts[r.resonanceSystem] || 0) + 1;
    }
    for (const [sys, day] of Object.entries(r.completedDayBySystem)) {
      stats.pairCompleted[sys]++;
      stats.pairDaySum[sys] += day;
    }
  }
  return stats;
}

const N = 20000;
const out = [];
const w = s => out.push(s ?? '');

w('# 聖物取得模擬（' + N + ' 輪 / 策略）');
w();
for (const strategy of ['generalist', 'fateHunter']) {
  const s = simulate(strategy, N);
  w(`## 策略：${strategy === 'generalist' ? '隨緣派（湊到哪套融哪套）' : '鎖定命運骰（只融命運組）'}`);
  w();
  w(`- 平均一輪取得聖物數：${(s.totalRelics / N).toFixed(2)} 件`);
  w(`- 至少湊滿一組配對的機率：${(s.anyPairCount / N * 100).toFixed(1)}%`);
  if (s.firstResonanceCount > 0) {
    w(`- 啟動第一個共鳴的機率：${(s.firstResonanceCount / N * 100).toFixed(1)}%，平均成形日：第 ${(s.firstResonanceDaySum / s.firstResonanceCount).toFixed(1)} 天`);
    const dist = Object.entries(s.firstSystemCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([sys, c]) => `${sys} ${(c / s.firstResonanceCount * 100).toFixed(1)}%`)
      .join('、');
    w(`- 第一個成形的體系分布：${dist}`);
  }
  w();
  w('| 配對 | 20天內湊滿機率 | 平均湊滿日 |');
  w('|---|---|---|');
  for (const sys of Object.keys(PAIRS)) {
    const c = s.pairCompleted[sys];
    const avgDay = c > 0 ? (s.pairDaySum[sys] / c).toFixed(1) : '-';
    w(`| ${sys} | ${(c / N * 100).toFixed(1)}% | 第 ${avgDay} 天 |`);
  }
  w();
}

const reportPath = path.join(__dirname, 'relic-acquisition-report.md');
fs.writeFileSync(reportPath, out.join('\n'), 'utf8');
console.log('Report written: ' + reportPath);
