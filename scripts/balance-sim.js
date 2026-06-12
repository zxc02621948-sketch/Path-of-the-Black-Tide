// 平衡模擬器：直接載入遊戲本體的戰鬥結算程式碼（CombatRules / CombatStatus /
// EnemyAbilities / WeaknessEffects），重建流程層（回合循環、威脅選目標、弓追擊、
// 骰子修正），以蒙地卡羅方式量測各流派輸出與各敵人勝率。
//
// 用法：node scripts/balance-sim.js
// 輸出：scripts/balance-sim-report.md
//
// 模擬假設（與真實遊玩的差異）：
// - 玩家策略固定：每回合由「主力」主戰（死亡則遞補），不使用守勢、不用道具、不舉旗。
// - 賭命骰子永遠押注最大的幾個骰面。
// - 每場戰鬥隊伍滿血開打（不模擬地圖損耗）。
// - 旗幟聖物（戰爭旗/鷹眼旗/雙旗戰陣）與後排裝備（守衛護符等）未納入。
// - AOE 流程中的 _reduceIncomingDamage（道具減傷）視為無效果（未用道具）。

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/config.js',
  'js/data/equipment.js',
  'js/data/characters.js',
  'js/data/enemies.js',
  'js/data/relics.js',
  'js/data/resonances.js',
  'js/core/combat-status.js',
  'js/core/weakness-effects.js',
  'js/core/enemy-abilities.js',
  'js/core/combat.js',
];

const source = FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');

const boot = new Function(`
  var G = { activeResonances: [] };
  var Dice = {
    rollRaw() { return Math.ceil(Math.random() * 6); },
    rollRawSides(n) { return Math.ceil(Math.random() * n); },
    roll(type, char) {
      const raw = Math.ceil(Math.random() * 6);
      const floor = ((typeof CONFIG !== 'undefined' && CONFIG.FLOOR_BONUS && char && CONFIG.FLOOR_BONUS[char.cls]) || {})[type] || 1;
      const value = Math.max(raw, floor);
      return { raw, value, floored: value > raw, sides: 6 };
    },
    face(v) { return String(v); },
  };
  ${source}
  ;return {
    setG(g) { G = g; },
    CONFIG, EQUIPMENT, WEAPONS, GEARS, CHARACTER_CLASSES, createCharacter,
    ENEMIES, resolveEnemyTier, resolveIntent, getEnemyById, getFinalBossEnemy,
    getDarkMonsterEnemy, getEchoGuardianEnemy, getTreasureMimicEnemy,
    RELICS, getRelicById, RESONANCES, checkResonances,
    CombatStatus, WeaknessEffects, EnemyAbilities, CombatRules,
  };
`);

const E = boot();
const { CombatStatus, EnemyAbilities, CombatRules } = E;

// ── 工具 ─────────────────────────────────────────────────────────

function getWeapon(id) { return { ...E.WEAPONS.find(w => w.id === id) }; }
function getGear(id) { return { ...E.GEARS.find(g => g.id === id) }; }

let charSeq = 0;
function buildChar(spec) {
  const c = E.createCharacter(spec.name || spec.cls, spec.cls, `sim_${charSeq++}`);
  if (spec.weapon) c.weapon = getWeapon(spec.weapon);
  if (spec.gear) c.gear = getGear(spec.gear);
  if (spec.relic) {
    const r = E.getRelicById(spec.relic);
    c.relic = { ...r };
  }
  if (spec.fused) {
    const r = E.getRelicById(spec.fused);
    c.fusedRelic = { ...r, effect: r.fusedEffect || r.effect, fused: true };
    c.maxHp -= 1; // 融合代價
    c.hp = c.maxHp;
  }
  return c;
}

function deepCloneEnemy(e) {
  const clone = JSON.parse(JSON.stringify(e));
  clone.maxHp = clone.maxHp || clone.hp;
  return clone;
}

function buildEnemy(spec) {
  if (spec.kind === 'tiered') {
    const base = E.getEnemyById(spec.id);
    return deepCloneEnemy(E.resolveEnemyTier(base, spec.day));
  }
  if (spec.kind === 'darkMonster') return deepCloneEnemy(E.getDarkMonsterEnemy(spec.darkness));
  if (spec.kind === 'finalBoss') return deepCloneEnemy(E.getFinalBossEnemy(spec.darkness));
  if (spec.kind === 'guardian') return deepCloneEnemy(E.getEchoGuardianEnemy(spec.systemId));
  return deepCloneEnemy(E.getEnemyById(spec.id));
}

// ── 骰子流程（移植 dice-flow.js） ─────────────────────────────────

function hasDodecaFate(char) {
  return char?.fusedRelic?.id === 'wager_dice' && char?.relic?.id === 'lucky_star';
}
function hasDodecaLucky(char) {
  return char?.fusedRelic?.id === 'lucky_star' && char?.relic?.id === 'wager_dice';
}
function hasStarHunterEye(char) {
  return !!char && char.fusedRelic?.id === 'eagle_eye_feather' && char.relic?.id === 'flaw_lens';
}
function hasStarBreakerEye(char) {
  return !!char && char.fusedRelic?.id === 'flaw_lens' && char.relic?.id === 'eagle_eye_feather';
}

function teamLuckyStarRelic(squad) {
  const fused = squad.find(c => !c.dead && c.hp > 0 && c.fusedRelic?.id === 'lucky_star')?.fusedRelic;
  if (fused) return fused;
  return squad.find(c => !c.dead && c.hp > 0 && c.relic?.id === 'lucky_star')?.relic || null;
}

function rollWithMods(char, squad, combat, opts = {}) {
  let base;
  if (hasDodecaFate(char) || hasDodecaLucky(char)) {
    const raw = Math.ceil(Math.random() * 12);
    const floor = (E.CONFIG.FLOOR_BONUS[char.cls] || {}).combat || 1;
    const value = Math.max(raw, floor);
    base = {
      raw, naturalRaw: raw, value, floored: value > raw, sides: 12,
      dodecaFateDice: hasDodecaFate(char), dodecaLuckyDice: hasDodecaLucky(char),
    };
  } else {
    const raw = Math.ceil(Math.random() * 6);
    const floor = (E.CONFIG.FLOOR_BONUS[char.cls] || {}).combat || 1;
    const value = Math.max(raw, floor);
    base = { raw, naturalRaw: raw, value, floored: value > raw, sides: 6 };
  }

  const pollutedFace = EnemyAbilities.pollutedRollFace(char, base.raw, base.value, base.sides || 6);
  if (pollutedFace) {
    return { ...base, value: pollutedFace, floored: false, pollutionLocked: true, pollutedFaceHit: true, pollutedFace, charId: char.id, charCls: char.cls };
  }

  const result = { ...base, charId: char.id, charCls: char.cls };

  // 骨骰袋
  const bagEffect = char.gear?.effect;
  if (bagEffect?.type === 'low_roll_flip') {
    const uses = char._boneDiceBagUses || 0;
    const limit = bagEffect.usesPerCombat || 2;
    const next = (bagEffect.map || {})[result.value];
    if (uses < limit && next) {
      char._boneDiceBagUses = uses + 1;
      result.raw = next;
      result.value = next;
      result.floored = true;
    }
  }

  // 幸運星（程式碼條件：value < 3 才轉 6；desc 寫小於等於 3 — 以程式碼為準）
  const luckyRelic = teamLuckyStarRelic(squad);
  if (luckyRelic?.effect?.type === 'lucky_star') {
    const limit = luckyRelic.effect.lowRollToSixUses || 1;
    combat.luckyStarUses = combat.luckyStarUses || 0;
    if (combat.luckyStarUses < limit && result.value < 3) {
      combat.luckyStarUses++;
      result.value = 6;
      result.floored = true;
    }
    const raiseLimit = luckyRelic.effect.sixToTwelveUses || 0;
    if (raiseLimit > 0 && (result.sides || 6) >= 12 && result.value === 6) {
      combat.luckyStarSixToTwelveUses = combat.luckyStarSixToTwelveUses || 0;
      if (combat.luckyStarSixToTwelveUses < raiseLimit) {
        combat.luckyStarSixToTwelveUses++;
        if (Math.random() < (luckyRelic.effect.sixToTwelveChance ?? 0.5)) {
          result.value = 12;
          result.floored = true;
        }
      }
    }
  }

  if (opts.starHunterForceSix && !result.pollutionLocked) {
    result.value = 6;
    result.floored = true;
    result.starHunterForceSixNoWeakness = true;
  }
  return result;
}

// ── 意圖與目標（移植 combat-threat.js） ───────────────────────────

function aliveSquad(squad) { return squad.filter(c => c && !c.dead && c.hp > 0); }

function pickEnemyTarget(intent, squad, combat) {
  const alive = aliveSquad(squad);
  if (alive.length === 0) return null;
  if (alive.length === 1) return alive[0];
  if (intent?.preferLowestHp) {
    return [...alive].sort((a, b) =>
      (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp)))[0];
  }
  const threatMap = combat.threat || {};
  const totalThreat = alive.reduce((s, c) => s + Math.max(0, threatMap[c.id] || 0), 0);
  let weighted;
  if (totalThreat <= 0) {
    weighted = alive.map(c => ({ char: c, weight: 1 / alive.length }));
  } else {
    const weights = alive.map(c => ({ char: c, weight: 3 + Math.max(0, threatMap[c.id] || 0) }));
    const total = weights.reduce((s, w) => s + w.weight, 0);
    weighted = weights.map(w => ({ char: w.char, weight: w.weight / total }));
  }
  let r = Math.random();
  for (const w of weighted) { r -= w.weight; if (r <= 0) return w.char; }
  return weighted[weighted.length - 1].char;
}

function resolveCombatIntent(enemy, squad, combat) {
  const base = E.resolveIntent(enemy);
  const resolved = EnemyAbilities.resolveIntent(enemy, combat, base) || base;
  const intent = { ...resolved, targetId: null, targetName: null };
  if (['attack', 'block_attack', 'dice_attack'].includes(intent.type)) {
    const target = pickEnemyTarget(intent, squad, combat);
    intent.targetId = target?.id || null;
    intent.targetName = target?.name || null;
  }
  return intent;
}

function addThreat(combat, attacker, result, isFollowUp) {
  if (!combat.threat) combat.threat = {};
  const current = combat.threat[attacker.id] || 0;
  let gain = isFollowUp ? 1 : 2;
  const dmg = result?.damage || 0;
  if (dmg >= 10) gain += Math.floor((dmg - 10) / 5) + 1;
  combat.threat[attacker.id] = Math.min(10, current + gain);
}

function halveThreat(combat, charId) {
  if (!combat.threat || !charId) return;
  combat.threat[charId] = Math.floor((combat.threat[charId] || 0) / 2);
}

function clearPendingRemorse(squad) {
  for (const c of squad) CombatStatus.clearPendingIncomingRisks(c);
}

// ── 敵方單獨行動（先攻 / 弓延遲；鏡像 combat.js 941-1141） ─────────

function enemyDamageDie(enemy) {
  const sides = Math.max(0, Math.floor(enemy?.damageDieSides || 0));
  if (sides > 0) return { roll: Math.ceil(Math.random() * sides), sides };
  if (!['weak', 'medium'].includes(enemy?.tier)) return { roll: 0, sides: 0 };
  return { roll: Math.ceil(Math.random() * 3), sides: 3 };
}

function finalEyeBlockPierce(enemy) {
  const ability = (enemy.abilities || []).find(a => a?.type === 'final_boss');
  if (!ability) return 0;
  const darkness = Math.max(0, Math.floor(enemy.finalBossDarkness || 0));
  return Math.max(0, CombatRules._finalBossTierValue(ability, darkness, 'blockPierceDamage', ability.blockPierceDamage || 0));
}

function resolveEnemyActionOnly(enemy, squad, intent, mainAttacker, combat, logs) {
  if (!enemy || enemy.hp <= 0) return null;
  const round = combat.round;

  if ((intent?.type === 'block' || intent?.type === 'block_attack') && !enemy.blockBroken) {
    const blockVal = Math.max(0, enemy.block || 0);
    if (blockVal > 0) {
      CombatStatus.raiseBlock(enemy, blockVal);
      EnemyAbilities.afterEnemyBlock({ enemy, intent, block: blockVal, logs, round });
    }
  }

  let counterDmg = 0;
  let aoeCounter = 0;
  let enemyAttackFlow = ['attack', 'block_attack', 'dice_attack', 'aoe'].includes(intent?.type);
  if (enemyAttackFlow) {
    if (intent.type === 'attack' || intent.type === 'block_attack' || intent.type === 'dice_attack') {
      const die = enemyDamageDie(enemy);
      counterDmg = Math.max(0, enemy.attack || 0) + die.roll;
      if (intent.type === 'dice_attack' && die.roll <= 0) counterDmg = Math.ceil(Math.random() * 6);
    } else if (intent.type === 'aoe') {
      aoeCounter = Math.max(1, (enemy.attack || 0) - 2);
    }
  }

  const counterTarget = counterDmg > 0
    ? (squad.find(c => c.id === intent?.targetId && c.hp > 0 && !c.dead) || mainAttacker)
    : null;
  const result = {
    counterDmg, aoeCounter, enemyAttackFlow, counterTarget,
    counterTargetId: counterTarget?.id || null,
    aoeDamageByChar: null, enemyDiceRoll: null,
  };
  EnemyAbilities.beforeEnemyAction(result, { attacker: mainAttacker, enemy, squad, intent, logs, round });
  counterDmg = Math.max(0, result.counterDmg || 0);
  aoeCounter = Math.max(0, result.aoeCounter || 0);
  enemyAttackFlow = !!result.enemyAttackFlow;

  if (enemyAttackFlow && (counterDmg > 0 || aoeCounter > 0)) {
    const reduction = Math.max(0, enemy.abilityState?.nextAttackReduction || 0);
    if (reduction > 0) {
      counterDmg = Math.max(0, counterDmg - reduction);
      aoeCounter = Math.max(0, aoeCounter - reduction);
      enemy.abilityState.nextAttackReduction = 0;
    }
  }

  // 單體
  if (counterDmg > 0 && result.counterTarget) {
    const target = result.counterTarget;
    let dmg = CombatStatus.applyWoundTakenBonus(target, counterDmg, logs);
    dmg = CombatStatus.applyExplorerEvasion(target, dmg, logs, '敵方攻擊');
    let pierce = 0;
    if (CombatStatus.getBlock(target) > 0) {
      const blocked = CombatStatus.consumeBlock(target, dmg);
      dmg = blocked.damage;
      if (intent?.finalEye && blocked.absorbed > 0) pierce = finalEyeBlockPierce(enemy);
    }
    if (dmg > 0 || pierce > 0) {
      dmg = CombatStatus.applyIncomingRiskBonuses(target, dmg, { allowRemorse: true, allowBacklash: true, logs });
      const total = dmg + pierce;
      const before = target.hp;
      target.hp = Math.max(0, target.hp - total);
      CombatStatus.recordGamblerPainBlock(target, before, target.hp, logs);
      if (intent?.finalEye && (enemy.finalBossDarkness || 0) >= 15 && before > target.hp) {
        target.finalEyeIntimidatedUntilRound = Math.max(target.finalEyeIntimidatedUntilRound || 0, round + 1);
      }
    }
  }

  // 全體
  if (aoeCounter > 0) {
    for (const c of aliveSquad(squad)) {
      let dmg = Math.max(0, result.aoeDamageByChar?.[c.id] ?? aoeCounter);
      dmg = CombatStatus.applyWoundTakenBonus(c, dmg, logs);
      dmg = CombatStatus.applyExplorerEvasion(c, dmg, logs, '全體傷害');
      if (CombatStatus.getBlock(c) > 0 && dmg > 0) {
        dmg = CombatStatus.consumeBlock(c, dmg).damage;
      }
      const before = c.hp;
      c.hp = Math.max(0, c.hp - dmg);
      CombatStatus.recordGamblerPainBlock(c, before, c.hp, logs);
    }
  }

  EnemyAbilities.afterEnemyAction(result, { attacker: mainAttacker, enemy, squad, intent, logs, round });

  if (enemyAttackFlow) {
    if (result.counterTargetId) halveThreat(combat, result.counterTargetId);
    clearPendingRemorse(squad);
  }
  return result;
}

// ── 弓追擊判定 ───────────────────────────────────────────────────

function eagleFeatherRelic(char) {
  return char?.fusedRelic?.id === 'eagle_eye_feather'
    ? char.fusedRelic
    : (char?.relic?.id === 'eagle_eye_feather' ? char.relic : null);
}

function eagleFeatherCanTrigger(char, rollResult) {
  const relic = eagleFeatherRelic(char);
  if (!relic || rollResult.starHunterForceSixNoWeakness) return false;
  const min = relic.effect?.finalMin ?? 5;
  return (rollResult.value ?? rollResult.raw) >= min;
}

function hasStarHunterLock(char, combat) {
  return hasStarHunterEye(char) &&
    combat.starHunterEyeLockRound === combat.round &&
    combat.starHunterEyeLockOwnerId === char.id;
}

function prepareStarHunterWeakness(char, enemy, combat) {
  if (!hasStarHunterEye(char)) return;
  if (char.weapon?.effect?.type !== 'bow_followup') return;
  if (enemy.eagleNativeWeakness?.source === 'star_hunter_eye') return;
  const value = CombatRules._nextEagleWeakness(enemy, enemy.weakness);
  if (value) {
    CombatRules._setEagleWeakness(enemy, { kind: 'native', value, duration: null, round: combat.round, source: 'star_hunter_eye' });
  }
}

function canBowFollowUp(char, result, enemy, rollResult, combat) {
  if (!char || !enemy || enemy.hp <= 0) return false;
  if (char.hp <= 0 || char.dead) return false;
  if (char.weapon?.effect?.type !== 'bow_followup') return false;
  if (rollResult.starHunterForceSixNoWeakness) return false;
  if (result.grapplingHookAssisted && result.realWeaknessHit) return false;
  const locked = hasStarHunterLock(char, combat);
  if (!locked && !result.realWeaknessHit && !eagleFeatherCanTrigger(char, rollResult)) return false;
  const max = char.weapon.effect.maxPerRound || 2;
  return (combat.bowFollowUps || 0) < max;
}

// ── 賭命骰子押注策略 ─────────────────────────────────────────────

function wagerDiceFor(char, combat) {
  if (!char || char.dead || char.hp <= 0) return null;
  const effect = char.fusedRelic?.effect?.type === 'wager_dice'
    ? char.fusedRelic.effect
    : (char.relic?.effect?.type === 'wager_dice' ? char.relic.effect : null);
  if (!effect) return null;
  const dodeca = hasDodecaFate(char) || hasDodecaLucky(char);
  const sides = dodeca ? 12 : 6;
  const count = (effect.faces || 3) + (dodeca ? 3 : 0);
  const faces = [];
  for (let f = sides; f >= 1 && faces.length < count; f--) faces.push(f);
  return {
    active: true, charId: char.id, faces,
    damageBonus: effect.damageBonus || 4,
    missPenaltyRate: effect.missPenaltyRate || 0.30,
    maxMissStacks: effect.maxMissStacks || 2,
  };
}

// ── 主戰鬥模擬 ───────────────────────────────────────────────────

function runFight(squadSpecs, enemySpec, opts = {}) {
  const maxRounds = opts.maxRounds || 40;
  const squad = squadSpecs.map(buildChar);
  const enemy = buildEnemy(enemySpec);
  const G = { activeResonances: E.checkResonances(squad), combat: null };
  E.setG(G);

  const combat = {
    round: 1, threat: {}, bowFollowUps: 0,
    luckyStarUses: 0, luckyStarSixToTwelveUses: 0,
    starHunterEyeLockRound: 0, starHunterEyeLockOwnerId: null,
    eagleFeatherDamageUsed: false,
    battleDrum: null,
    squad,
  };
  G.combat = combat;
  const logs = [];

  EnemyAbilities.onCombatStart(enemy, combat, logs);
  let intent = resolveCombatIntent(enemy, squad, combat);

  const startHp = squad.map(c => c.hp);
  const damagePerRound = [];
  const hasFirstStrike = (enemy.abilities || []).some(a => a?.type === 'first_strike');

  let win = false;
  let rounds = 0;

  while (combat.round <= maxRounds) {
    rounds = combat.round;
    const enemyHpAtRoundStart = enemy.hp;
    const alive = aliveSquad(squad);
    if (alive.length === 0) break;

    // 選主戰者：主力優先，受開眼威懾者跳過
    const actable = alive.filter(c => !(c.finalEyeIntimidatedUntilRound >= combat.round));
    const attacker = actable[0] || null;
    if (!attacker) {
      // 全員被威懾：跳過我方行動，敵人照常行動
      resolveEnemyActionOnly(enemy, squad, intent, alive[0], combat, logs);
      if (aliveSquad(squad).length === 0) break;
      finishRound();
      continue;
    }

    // 先攻敵人
    let preempted = false;
    let preemptStunned = false;
    if (hasFirstStrike) {
      if ((enemy.firstStrikeStunnedUntilRound || 0) > combat.round - 1 && (enemy.firstStrikeStunnedUntilRound || 0) >= combat.round) {
        preemptStunned = true;
      } else {
        resolveEnemyActionOnly(enemy, squad, intent, attacker, combat, logs);
        preempted = true;
        if (aliveSquad(squad).length === 0) break;
      }
    }

    // 戰鼓加成（主戰攻擊）
    let drumBonus = 0;
    if (combat.battleDrum && combat.battleDrum.remaining > 0) drumBonus = combat.battleDrum.value || 1;

    // 主攻擊
    prepareStarHunterWeakness(attacker, enemy, combat);
    const wager = wagerDiceFor(attacker, combat);
    const rollResult = rollWithMods(attacker, squad, combat, {});
    const deferBow = !preempted && !preemptStunned && attacker.weapon?.effect?.type === 'bow_followup';
    let result = CombatRules.resolveRound({
      attacker, enemy, squad, rollResult,
      combatMods: [], resonanceAttackBonus: 0,
      intent, round: combat.round,
      suppressEnemyAction: preempted || preemptStunned || deferBow,
      deferEnemyAction: deferBow,
      allowNativeWeaknessEffect: true,
      eagleFeatherDamageBonus: 0,
      eagleFeatherNativeCandidate: eagleFeatherCanTrigger(attacker, rollResult),
      starHunterEyeDamageBonus: 0,
      bowFollowUpDamageBonus: 0,
      starBreakerActive: hasStarBreakerEye(attacker),
      wagerDice: wager,
      battleDrumAttackBonus: drumBonus,
      banner: null,
    });
    if (result.starHunterEyeLockTriggered && hasStarHunterEye(attacker)) {
      combat.starHunterEyeLockRound = combat.round;
      combat.starHunterEyeLockOwnerId = attacker.id;
    }
    EnemyAbilities.afterPlayerAttack(result, { attacker, enemy, squad, combat, logs: result.logs, rollResult, opts: {} });
    if (preempted && result.stunned && enemy.hp > 0) {
      enemy.firstStrikeStunnedUntilRound = combat.round + 1;
    }
    addThreat(combat, attacker, result, false);
    applyAoeFromResult(result, squad, logs);
    if (result.enemyAttackFlow) {
      if (result.counterTargetId) halveThreat(combat, result.counterTargetId);
      clearPendingRemorse(squad);
    }

    // 弓追擊
    let lastRoll = rollResult;
    let lastResult = result;
    while (enemy.hp > 0 && canBowFollowUp(attacker, lastResult, enemy, lastRoll, combat)) {
      const eagleTriggered = !lastResult.realWeaknessHit && eagleFeatherCanTrigger(attacker, lastRoll);
      const eagleRelic = eagleTriggered ? eagleFeatherRelic(attacker) : null;
      const next = (combat.bowFollowUps || 0) + 1;
      combat.bowFollowUps = next;
      const fOpts = {};
      let starBonus = 0;
      let forceSix = false;
      if (hasStarHunterEye(attacker)) {
        starBonus = hasStarHunterLock(attacker, combat) ? next * 5 : 2;
        if (next >= (attacker.weapon?.effect?.maxPerRound || 2)) forceSix = true;
      }
      let eagleBonus = 0;
      if (eagleRelic?.effect?.firstFollowUpDamageBonus && !combat.eagleFeatherDamageUsed) {
        combat.eagleFeatherDamageUsed = true;
        eagleBonus = eagleRelic.effect.firstFollowUpDamageBonus;
      }
      prepareStarHunterWeakness(attacker, enemy, combat);
      const fRoll = rollWithMods(attacker, squad, combat, { starHunterForceSix: forceSix });
      const fResult = CombatRules.resolveRound({
        attacker, enemy, squad, rollResult: fRoll,
        combatMods: [], resonanceAttackBonus: 0,
        intent, round: combat.round,
        suppressEnemyAction: true, deferEnemyAction: false,
        allowNativeWeaknessEffect: false,
        eagleFeatherDamageBonus: eagleBonus,
        eagleFeatherNativeCandidate: eagleFeatherCanTrigger(attacker, fRoll),
        starHunterEyeDamageBonus: starBonus,
        bowFollowUpDamageBonus: 0,
        starBreakerActive: hasStarBreakerEye(attacker),
        wagerDice: wager,
        battleDrumAttackBonus: 0,
        banner: null,
      });
      if (fResult.starHunterEyeLockTriggered && hasStarHunterEye(attacker)) {
        combat.starHunterEyeLockRound = combat.round;
        combat.starHunterEyeLockOwnerId = attacker.id;
      }
      EnemyAbilities.afterPlayerAttack(fResult, { attacker, enemy, squad, combat, logs: fResult.logs, rollResult: fRoll, opts: { bowFollowUp: true } });
      addThreat(combat, attacker, fResult, true);
      lastRoll = fRoll;
      lastResult = fResult;
    }

    // 弓延遲的敵方行動
    if (deferBow && enemy.hp > 0 && aliveSquad(squad).length > 0) {
      resolveEnemyActionOnly(enemy, squad, intent, attacker, combat, logs);
    }

    damagePerRound.push(Math.max(0, enemyHpAtRoundStart - enemy.hp));

    if (enemy.hp <= 0) { win = true; break; }
    if (aliveSquad(squad).length === 0) break;

    // 戰鼓：消耗與刷新
    if (combat.battleDrum && combat.battleDrum.remaining > 0) combat.battleDrum.remaining--;
    if (attacker.weapon?.effect?.type === 'battle_drum') {
      combat.battleDrum = { remaining: attacker.weapon.effect.durationAttacks || 2, value: attacker.weapon.effect.attackBonus || 1 };
      if ((attacker.weapon.effect.teamBlockRounds || 0) > 0) {
        combat.battleDrumBlock = { rounds: attacker.weapon.effect.teamBlockRounds, value: attacker.weapon.effect.teamBlockValue || 1 };
      }
    }

    // 探索者閃避準備
    for (const c of squad) {
      if (c.cls !== 'explorer' || c.hp <= 0 || c.dead) continue;
      const mainGain = c.id === attacker.id ? (result.roll || 0) * 3 : 0;
      c._evasionChancePending = Math.min(50, (c._evasionChancePending || 0) + 10 + mainGain);
    }

    // 輔助治療
    applySupportHeal(squad, attacker, combat);

    finishRound();
  }

  function applyAoeFromResult(result, squad, logs) {
    if (!result || result.aoeCounter <= 0) return;
    for (const c of aliveSquad(squad)) {
      let dmg = Math.max(0, result.aoeDamageByChar?.[c.id] ?? result.aoeCounter);
      dmg = CombatStatus.applyWoundTakenBonus(c, dmg, logs);
      dmg = CombatStatus.applyExplorerEvasion(c, dmg, logs, '全體傷害');
      if (CombatStatus.getBlock(c) > 0 && dmg > 0) {
        dmg = CombatStatus.consumeBlock(c, dmg).damage;
      }
      const before = c.hp;
      c.hp = Math.max(0, c.hp - dmg);
      CombatStatus.recordGamblerPainBlock(c, before, c.hp, logs);
    }
  }

  function applySupportHeal(squad, attacker, combat) {
    const support = squad.find(c => c.cls === 'support' && c.hp > 0 && !c.dead);
    if (!support) return;
    combat.threat[support.id] = Math.min(10, (combat.threat[support.id] || 0) + 1);
    const count = support.id === attacker?.id ? 2 : 1;
    const targets = squad
      .filter(c => c && c.hp > 0 && !c.dead && c.hp < c.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))
      .slice(0, count);
    for (const t of targets) t.hp = Math.min(t.maxHp, t.hp + 1);
  }

  function finishRound() {
    // 弱點效果過期（沿用舊回合編號判定）
    const r = combat.round;
    // 回合結束：我方格檔消散、每回合旗標重置
    for (const c of squad) {
      CombatStatus.clearBlock(c);
      c._grapplingHookUsedRound = false;
      c._corrosiveOilUsedRound = false;
      c._serratedOilUsedRound = false;
      c._rapierGuaranteedFollowUpsUsed = 0;
    }
    combat.round++;
    // 過期判定（round 已 +1，對應原始 _clearExpiredWeaknessEffects 在 round++ 前以舊值判定，
    // 但 blockBrokenUntilRound = 破除回合 +1，效果等同「下一回合結束時恢復」）
    if (enemy.blockBrokenUntilRound && combat.round - 1 >= enemy.blockBrokenUntilRound) {
      enemy.blockBroken = false;
      enemy.blockBrokenUntilRound = null;
    }
    if (enemy.exposedUntilRound && combat.round - 1 >= enemy.exposedUntilRound) {
      enemy.exposed = false;
      enemy.exposedUntilRound = null;
    }
    if (enemy.eagleNativeWeakness?.expiresRound && combat.round - 1 >= enemy.eagleNativeWeakness.expiresRound) {
      CombatStatus.setEagleNativeWeakness(enemy, null);
    }
    // 裂星：補回原生弱點至 2 個
    if (Number.isFinite(enemy.weakness) || enemy.weakness === null) {
      const anyBreaker = aliveSquad(squad).some(c => hasStarBreakerEye(c));
      if (anyBreaker && Number.isFinite(enemy.weakness) !== false && enemy.weakness !== null) {
        if (CombatRules._nativeWeaknessSet(enemy).size === 0) {
          let guard = 0;
          while (CombatRules._nativeWeaknessSet(enemy).size < 2 && guard++ < 10) {
            const v = CombatRules._randomNativeWeakness(enemy);
            if (!v) break;
            CombatStatus.addExtraNativeWeakness(enemy, v, { source: 'restored_native' });
          }
        }
      }
    }
    // 回合開始效果
    EnemyAbilities.onRoundStart(enemy, combat, logs);
    // 我方準備效果生效
    for (const c of squad) {
      const wBlock = Math.max(0, Math.floor(c._warriorGuardPendingBlock || 0));
      if (c.cls === 'warrior' && wBlock > 0) {
        c._warriorGuardPendingBlock = 0;
        if (c.hp > 0 && !c.dead) CombatStatus.raiseBlock(c, wBlock);
      }
      const gBlock = Math.max(0, Math.floor(c._gamblerPainPendingBlock || 0));
      if (c.cls === 'scholar' && gBlock > 0) {
        c._gamblerPainPendingBlock = 0;
        if (c.hp > 0 && !c.dead) CombatStatus.raiseBlock(c, gBlock);
      }
      const pend = Math.max(0, Math.floor(c._evasionChancePending || 0));
      if (c.cls === 'explorer' && pend > 0) {
        c._evasionChancePending = 0;
        if (c.hp > 0 && !c.dead) CombatStatus.addEvasionChance(c, pend);
      }
    }
    // 星盤戰鼓：全體格檔（鏡像 combat-flow.js _applyBattleDrumTeamBlock）
    if (combat.battleDrumBlock && (combat.battleDrumBlock.rounds || 0) > 0) {
      const bv = Math.max(0, Math.floor(combat.battleDrumBlock.value || 0));
      if (bv > 0) {
        for (const c of squad) {
          if (!c || c.dead || c.hp <= 0) continue;
          CombatStatus.raiseBlock(c, CombatStatus.getBlock(c) + bv);
        }
      }
      combat.battleDrumBlock.rounds = Math.max(0, combat.battleDrumBlock.rounds - 1);
      if (combat.battleDrumBlock.rounds <= 0) combat.battleDrumBlock = null;
    }
    combat.bowFollowUps = 0;
    intent = resolveCombatIntent(enemy, squad, combat);
    // 標記死亡
    for (const c of squad) { if (c.hp <= 0) c.dead = true; }
  }

  for (const c of squad) { if (c.hp <= 0) c.dead = true; }
  const hpLost = squad.reduce((s, c, i) => s + (startHp[i] - Math.max(0, c.hp)), 0);
  const deaths = squad.filter(c => c.dead || c.hp <= 0).length;
  return { win, rounds, hpLost, deaths, damagePerRound, totalStartHp: startHp.reduce((a, b) => a + b, 0) };
}

// ── 統計工具 ─────────────────────────────────────────────────────

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function quantile(arr, q) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function simulate(squadSpecs, enemySpec, n, opts = {}) {
  const stats = { wins: 0, rounds: [], hpLost: [], deaths: [], dprAll: [], dprByRound: [] };
  for (let i = 0; i < n; i++) {
    const r = runFight(squadSpecs, enemySpec, opts);
    if (r.win) stats.wins++;
    stats.rounds.push(r.rounds);
    stats.hpLost.push(r.hpLost);
    stats.deaths.push(r.deaths);
    stats.dprAll.push(avg(r.damagePerRound));
    r.damagePerRound.forEach((d, idx) => {
      if (!stats.dprByRound[idx]) stats.dprByRound[idx] = [];
      stats.dprByRound[idx].push(d);
    });
    stats.totalStartHp = r.totalStartHp;
  }
  stats.n = n;
  return stats;
}

// ── 實驗定義 ─────────────────────────────────────────────────────

const N_LADDER = 3000;
const N_FIGHT = 2000;
const out = [];
function w(line = '') { out.push(line); }

w('# 黑潮之途 數值模擬報告');
w();
w(`引擎：直接載入遊戲本體 CombatRules/CombatStatus/EnemyAbilities/WeaknessEffects。`);
w(`樣本數：輸出階梯 ${N_LADDER} 場/組，遭遇戰 ${N_FIGHT} 場/組。`);
w();
w('## 模擬假設');
w('- 固定主力主戰（死亡遞補）、不守勢、不用道具、不舉旗。');
w('- 賭命骰子永遠押最大的幾個面。每場滿血開打。');
w('- 旗幟聖物與後排裝備未納入。');
w();

// 1. 輸出階梯（vs 測試木樁，12 回合）
w('## 一、輸出階梯（vs 測試木樁，12 回合平均）');
w();
w('| Build | 平均DPR | DPR p10 | DPR p90 | R1-3 | R4-6 | R7-9 | R10-12 |');
w('|---|---|---|---|---|---|---|---|');

const LADDER = [
  ['戰士+劍(T1)', [{ cls: 'warrior', weapon: 'sword' }]],
  ['戰士+裁衡劍(T2)', [{ cls: 'warrior', weapon: 'sword_plus' }]],
  ['戰士+裁衡劍+沉鐵劍律(共鳴)', [{ cls: 'warrior', weapon: 'sword_plus', fused: 'iron_scabbard', relic: 'silver_bee_pin' }]],
  ['戰士+裁衡劍+銀蜂劍律(共鳴)', [{ cls: 'warrior', weapon: 'sword_plus', fused: 'silver_bee_pin', relic: 'iron_scabbard' }]],
  ['探索者+弓(T1)', [{ cls: 'explorer', weapon: 'bow' }]],
  ['探索者+逐星弓+獵星之眼(共鳴)', [{ cls: 'explorer', weapon: 'bow_plus', fused: 'eagle_eye_feather', relic: 'flaw_lens' }]],
  ['探索者+逐星弓+裂星破滅(共鳴)', [{ cls: 'explorer', weapon: 'bow_plus', fused: 'flaw_lens', relic: 'eagle_eye_feather' }]],
  ['搏命者+匕首(T1)', [{ cls: 'scholar', weapon: 'dagger' }]],
  ['搏命者+影牙匕首+痛痕折磨(共鳴)', [{ cls: 'scholar', weapon: 'dagger_plus', fused: 'pain_splinter_badge', relic: 'pain_mask' }]],
  ['搏命者+斷魂太刀+痛痕爆發(共鳴)', [{ cls: 'scholar', weapon: 'soul_cutter_katana', fused: 'pain_mask', relic: 'pain_splinter_badge' }]],
  ['搏命者+影牙匕首+十二面命運骰', [{ cls: 'scholar', weapon: 'dagger_plus', fused: 'wager_dice', relic: 'lucky_star' }]],
  ['搏命者+影牙匕首+十二面幸運骰', [{ cls: 'scholar', weapon: 'dagger_plus', fused: 'lucky_star', relic: 'wager_dice' }]],
  ['搏命者+影牙匕首+骨骰袋(裝備)', [{ cls: 'scholar', weapon: 'dagger_plus', gear: 'bone_dice_bag' }]],
  ['輔助+戰鼓(T1)', [{ cls: 'support', weapon: 'battle_drum' }]],
];

for (const [name, specs] of LADDER) {
  const s = simulate(specs, { id: 'training_dummy' }, N_LADDER, { maxRounds: 12 });
  const seg = (a, b) => avg([].concat(...s.dprByRound.slice(a, b))).toFixed(1);
  w(`| ${name} | ${avg(s.dprAll).toFixed(1)} | ${quantile(s.dprAll, 0.1).toFixed(1)} | ${quantile(s.dprAll, 0.9).toFixed(1)} | ${seg(0, 3)} | ${seg(3, 6)} | ${seg(6, 9)} | ${seg(9, 12)} |`);
}
w();

// 2. 一般敵人遭遇戰
const PARTY_EARLY = [
  { cls: 'warrior', weapon: 'sword' },
  { cls: 'explorer', weapon: 'bow' },
];
const PARTY_MID = [
  { cls: 'warrior', weapon: 'sword_plus', fused: 'iron_scabbard', relic: 'silver_bee_pin' },
  { cls: 'explorer', weapon: 'bow' },
  { cls: 'support', weapon: 'battle_drum' },
];
const PARTY_MID_WOUND = [
  { cls: 'scholar', weapon: 'katana', fused: 'pain_splinter_badge', relic: 'pain_mask' },
  { cls: 'warrior', weapon: 'sword' },
  { cls: 'support', weapon: 'battle_drum' },
];
const PARTY_LATE_STAR = [
  { cls: 'explorer', weapon: 'bow_plus', fused: 'eagle_eye_feather', relic: 'flaw_lens' },
  { cls: 'warrior', weapon: 'sword_plus', fused: 'iron_scabbard', relic: 'silver_bee_pin' },
  { cls: 'support', weapon: 'battle_drum_plus' },
];
const PARTY_LATE_FATE = [
  { cls: 'scholar', weapon: 'dagger_plus', fused: 'wager_dice', relic: 'lucky_star' },
  { cls: 'warrior', weapon: 'sword_plus', fused: 'iron_scabbard', relic: 'silver_bee_pin' },
  { cls: 'support', weapon: 'battle_drum_plus' },
];

const PARTIES = [
  ['早期隊(戰士+探索者,無聖物)', PARTY_EARLY],
  ['中期隊(沉鐵戰士+探索者+輔助)', PARTY_MID],
  ['中期傷口隊(折磨搏命+戰士+輔助)', PARTY_MID_WOUND],
  ['後期獵星隊', PARTY_LATE_STAR],
  ['後期命運骰隊', PARTY_LATE_FATE],
];

w('## 二、一般敵人遭遇戰（勝率 / 平均回合 / 平均隊伍損血%）');
w();
const WEAK_ENEMIES = ['shadow_worm', 'rot_crawler', 'plague_moth'];
const MEDIUM_ENEMIES = ['rot_knight', 'shadow_hunter'];
const DAYS = [1, 4, 7, 10, 13, 16];

for (const [pname, party] of PARTIES) {
  w(`### ${pname}`);
  w();
  w('| 敵人 | ' + DAYS.map(d => `第${d}天`).join(' | ') + ' |');
  w('|---' + '|---'.repeat(DAYS.length) + '|');
  for (const eid of [...WEAK_ENEMIES, ...MEDIUM_ENEMIES]) {
    const cells = [];
    for (const day of DAYS) {
      const s = simulate(party, { kind: 'tiered', id: eid, day }, N_FIGHT);
      const lossPct = avg(s.hpLost) / s.totalStartHp;
      cells.push(`${pct(s.wins / s.n)} / ${avg(s.rounds).toFixed(1)}回 / 損${pct(lossPct)}`);
    }
    const base = E.getEnemyById(eid);
    w(`| ${base.tiers ? base.tiers[0].name : base.name} | ${cells.join(' | ')} |`);
  }
  w();
}

// 3. 回響守護者
w('## 三、回響守護者（中期隊 / 中期傷口隊 / 後期隊）');
w();
const GUARDIANS = ['wound', 'eagle', 'fate', 'banner', 'sword'];
w('| 守護者 | 中期隊 | 中期傷口隊 | 後期獵星隊 | 後期命運骰隊 |');
w('|---|---|---|---|---|');
for (const sys of GUARDIANS) {
  const cells = [];
  for (const party of [PARTY_MID, PARTY_MID_WOUND, PARTY_LATE_STAR, PARTY_LATE_FATE]) {
    const s = simulate(party, { kind: 'guardian', systemId: sys }, N_FIGHT, { maxRounds: 50 });
    const lossPct = avg(s.hpLost) / s.totalStartHp;
    cells.push(`${pct(s.wins / s.n)} / ${avg(s.rounds).toFixed(1)}回 / 損${pct(lossPct)}`);
  }
  const g = E.getEchoGuardianEnemy(sys);
  w(`| ${g.name} (HP${g.hp}) | ${cells.join(' | ')} |`);
}
w();

// 4. 黑暗化身
w('## 四、黑暗化身（各黑暗層數）');
w();
w('| 黑暗 | 早期隊 | 中期隊 | 後期獵星隊 | 後期命運骰隊 |');
w('|---|---|---|---|---|');
for (const dark of [5, 8, 10, 13, 16, 20]) {
  const cells = [];
  for (const party of [PARTY_EARLY, PARTY_MID, PARTY_LATE_STAR, PARTY_LATE_FATE]) {
    const s = simulate(party, { kind: 'darkMonster', darkness: dark }, N_FIGHT);
    const lossPct = avg(s.hpLost) / s.totalStartHp;
    cells.push(`${pct(s.wins / s.n)} / ${avg(s.rounds).toFixed(1)}回 / 損${pct(lossPct)}`);
  }
  const m = E.getDarkMonsterEnemy(dark);
  w(`| ${dark} (HP${m.hp}/攻${m.attack}) | ${cells.join(' | ')} |`);
}
w();

// 5. 深污腐骰宿主
w('## 五、深污腐骰宿主（HP108 / 攻7）');
w();
w('| 隊伍 | 勝率 | 平均回合 | 平均損血% | 平均死亡數 |');
w('|---|---|---|---|---|');
for (const [pname, party] of PARTIES.slice(1)) {
  const s = simulate(party, { id: 'dice_corruptor' }, N_FIGHT, { maxRounds: 60 });
  const lossPct = avg(s.hpLost) / s.totalStartHp;
  w(`| ${pname} | ${pct(s.wins / s.n)} | ${avg(s.rounds).toFixed(1)} | ${pct(lossPct)} | ${avg(s.deaths).toFixed(2)} |`);
}
w();

// 6. 最終 BOSS
w('## 六、夜幕之瞳（各黑暗層數）');
w();
w('| 黑暗 | 中期隊 | 後期獵星隊 | 後期命運骰隊 | 中期傷口隊 |');
w('|---|---|---|---|---|');
for (const dark of [5, 10, 15, 19]) {
  const cells = [];
  for (const party of [PARTY_MID, PARTY_LATE_STAR, PARTY_LATE_FATE, PARTY_MID_WOUND]) {
    const s = simulate(party, { kind: 'finalBoss', darkness: dark }, N_FIGHT, { maxRounds: 60 });
    const lossPct = avg(s.hpLost) / s.totalStartHp;
    cells.push(`${pct(s.wins / s.n)} / ${avg(s.rounds).toFixed(1)}回 / 損${pct(lossPct)} / 死${avg(s.deaths).toFixed(1)}`);
  }
  const b = E.getFinalBossEnemy(dark);
  w(`| ${dark} (HP${b.hp}/攻${b.attack}) | ${cells.join(' | ')} |`);
}
w();

// 7. 星盤戰鼓全體格檔 A/B（同隊伍，僅換 T1/T2 戰鼓，vs AOE 敵人）
w('## 七、星盤戰鼓全體格檔 A/B（同隊，只換 T1/T2 戰鼓，vs AOE 敵人）');
w();
w('| 敵人 | 戰鼓 | 勝率 | 平均損血% | 平均死亡 |');
w('|---|---|---|---|---|');
const DRUM_AB_T1 = [{ cls: 'support', weapon: 'battle_drum' }, { cls: 'warrior', weapon: 'sword' }, { cls: 'explorer', weapon: 'bow' }];
const DRUM_AB_T2 = [{ cls: 'support', weapon: 'battle_drum_plus' }, { cls: 'warrior', weapon: 'sword' }, { cls: 'explorer', weapon: 'bow' }];
const DRUM_AB_ENEMIES = [
  ['虛空毒蛾(第13天 全體毒粉)', { kind: 'tiered', id: 'plague_moth', day: 13 }],
  ['夜幕之瞳(黑暗10 濺射)', { kind: 'finalBoss', darkness: 10 }],
];
for (const [ename, espec] of DRUM_AB_ENEMIES) {
  for (const [label, party] of [['T1 戰鼓(無格檔)', DRUM_AB_T1], ['T2 星盤戰鼓(全體格檔)', DRUM_AB_T2]]) {
    const s = simulate(party, espec, N_FIGHT, { maxRounds: 60 });
    const lossPct = avg(s.hpLost) / s.totalStartHp;
    w(`| ${ename} | ${label} | ${pct(s.wins / s.n)} | ${pct(lossPct)} | ${avg(s.deaths).toFixed(2)} |`);
  }
}
w();

// 8. 裁衡劍 relic-assist A/B（劍系共鳴，T1 劍 vs T2 裁衡劍，木樁 12 回合 DPR）
w('## 八、裁衡劍 relic-assist A/B（劍系共鳴，T1 劍 vs T2 裁衡劍，木樁 DPR）');
w();
w('| 共鳴 | 劍 | 平均DPR |');
w('|---|---|---|');
const SWORD_AB = [
  ['銀蜂劍律', 'silver_bee_pin', 'iron_scabbard'],
  ['沉鐵劍律', 'iron_scabbard', 'silver_bee_pin'],
];
for (const [rname, fused, relic] of SWORD_AB) {
  for (const [swLabel, sw] of [['劍(T1)', 'sword'], ['裁衡劍(T2)', 'sword_plus']]) {
    const s = simulate([{ cls: 'warrior', weapon: sw, fused, relic }], { id: 'training_dummy' }, N_LADDER, { maxRounds: 12 });
    w(`| ${rname} | ${swLabel} | ${avg(s.dprAll).toFixed(1)} |`);
  }
}
w();

const reportPath = path.join(__dirname, 'balance-sim-report.md');
fs.writeFileSync(reportPath, out.join('\n'), 'utf8');
console.log('Report written: ' + reportPath);
