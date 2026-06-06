// Enemy ability hooks. Individual enemies can opt in through enemy.abilities.
const EnemyAbilities = {
  onCombatStart(enemy, combat, logs = []) {
    this._ensureState(enemy);
    for (const ability of this._abilities(enemy)) {
      this._run(ability, 'onCombatStart', { enemy, combat, logs });
    }
  },

  onRoundStart(enemy, combat, logs = []) {
    this._ensureState(enemy);
    for (const ability of this._abilities(enemy)) {
      this._run(ability, 'onRoundStart', { enemy, combat, logs });
    }
  },

  afterPlayerAttack(result, context) {
    const enemy = context?.enemy;
    if (!enemy) return;
    this._ensureState(enemy);
    for (const ability of this._abilities(enemy)) {
      this._run(ability, 'afterPlayerAttack', { ...context, result });
    }
  },

  beforeEnemyAction(result, context) {
    const enemy = context?.enemy;
    if (!enemy) return;
    this._ensureState(enemy);
    for (const ability of this._abilities(enemy)) {
      this._run(ability, 'beforeEnemyAction', { ...context, result });
    }
  },

  beforePlayerDamage(result, context) {
    const enemy = context?.enemy;
    if (!enemy) return;
    this._ensureState(enemy);
    for (const ability of this._abilities(enemy)) {
      this._run(ability, 'beforePlayerDamage', { ...context, result });
    }
  },

  afterEnemyAction(result, context) {
    const enemy = context?.enemy;
    if (!enemy) return;
    this._ensureState(enemy);
    for (const ability of this._abilities(enemy)) {
      this._run(ability, 'afterEnemyAction', { ...context, result });
    }
  },

  afterEnemyBlock(context) {
    const enemy = context?.enemy;
    if (!enemy) return;
    this._ensureState(enemy);
    for (const ability of this._abilities(enemy)) {
      this._run(ability, 'afterEnemyBlock', context);
    }
  },

  resolveIntent(enemy, combat, baseIntent) {
    this._ensureState(enemy);
    let intent = baseIntent ? { ...baseIntent } : null;
    for (const ability of this._abilities(enemy)) {
      const handler = this.handlers?.[ability.type]?.resolveIntent;
      if (typeof handler !== 'function') continue;
      const next = handler(ability, { enemy, combat, intent });
      if (next) intent = next;
    }
    return intent;
  },

  _ensureState(enemy) {
    if (!enemy.abilityState) enemy.abilityState = {};
  },

  _abilities(enemy) {
    return Array.isArray(enemy?.abilities) ? enemy.abilities.filter(Boolean) : [];
  },

  _run(ability, hook, context) {
    const handler = this.handlers?.[ability.type]?.[hook];
    if (typeof handler === 'function') handler(ability, context);
  },

  _painGrowthSelfDamage(enemy, ability, stacks) {
    const damage = Math.max(0, Math.floor(stacks * (ability.selfDamagePerStack ?? 0)));
    if (damage <= 0) return 0;
    enemy.hp = Math.max(1, (enemy.hp || 1) - damage);
    return damage;
  },

  _aliveSquad(squad = []) {
    return (Array.isArray(squad) ? squad : []).filter(char => char && !char.dead && char.hp > 0);
  },

  _addPartyGazeWeaknesses(squad, logs, sourceName, count = 1) {
    const added = [];
    for (const char of this._aliveSquad(squad)) {
      for (let i = 0; i < count; i++) {
        const face = CombatStatus.addNativeWeakness(char, null, { source: 'gaze' });
        if (face) added.push(`${char.name} ${face}`);
      }
    }
    if (added.length > 0) {
      logs.push(`${sourceName}的裂隙凝視：${added.join('、')} 獲得原生弱點。`);
    }
  },

  _fateGambleState(enemy) {
    this._ensureState(enemy);
    if (!enemy.abilityState.fateGamble) enemy.abilityState.fateGamble = {};
    return enemy.abilityState.fateGamble;
  },

  _fateFaceList(value, fallback = []) {
    const list = Array.isArray(value) ? value : (value ? [value] : fallback);
    return [...new Set(list.map(face => Math.floor(Number(face) || 0)).filter(face => face >= 1 && face <= 6))];
  },

  _rollFateGambleFaces(enemy, ability = {}, round = 1) {
    const state = this._fateGambleState(enemy);
    const interval = Math.max(1, ability.rerollEvery || 2);
    const boardIndex = Math.floor((Math.max(1, round || 1) - 1) / interval);
    if (
      state.boardIndex === boardIndex &&
      Array.isArray(state.luckyFaces) && state.luckyFaces.length > 0 &&
      Array.isArray(state.unluckyFaces) && state.unluckyFaces.length > 0
    ) {
      return state;
    }
    const maxLucky = Math.max(1, ability.maxLuckyFaces || 3);
    const maxUnlucky = Math.max(1, ability.maxUnluckyFaces || 3);
    const luckyCount = Math.min(maxLucky, Math.max(1, this._fateFaceList(state.luckyFaces, [state.luckyFace]).length || 1));
    const unluckyCount = Math.min(maxUnlucky, Math.max(1, this._fateFaceList(state.unluckyFaces, [state.unluckyFace]).length || 1));
    const faces = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    const luckyFaces = faces.slice(0, luckyCount).sort((a, b) => a - b);
    const unluckyFaces = faces.slice(luckyCount, luckyCount + unluckyCount).sort((a, b) => a - b);
    state.boardIndex = boardIndex;
    state.luckyFaces = luckyFaces;
    state.luckyFace = luckyFaces[0] || null;
    state.unluckyFaces = unluckyFaces;
    return state;
  },

  _addFateFace(enemy, kind = 'unlucky', ability = {}) {
    const state = this._fateGambleState(enemy);
    const isLucky = kind === 'lucky';
    const ownKey = isLucky ? 'luckyFaces' : 'unluckyFaces';
    const otherKey = isLucky ? 'unluckyFaces' : 'luckyFaces';
    const max = Math.max(1, isLucky ? (ability.maxLuckyFaces || 3) : (ability.maxUnluckyFaces || 3));
    const current = this._fateFaceList(state[ownKey], isLucky ? [state.luckyFace] : [state.unluckyFace]);
    const other = this._fateFaceList(state[otherKey], isLucky ? [state.unluckyFace] : [state.luckyFace]);
    if (current.length >= max) {
      state[ownKey] = current;
      if (isLucky) state.luckyFace = current[0] || null;
      return null;
    }
    const available = [1, 2, 3, 4, 5, 6].filter(face => !other.includes(face) && !current.includes(face));
    if (available.length <= 0) {
      state[ownKey] = current;
      if (isLucky) state.luckyFace = current[0] || null;
      return null;
    }
    const face = available[Math.floor(Math.random() * available.length)];
    state[ownKey] = [...current, face].sort((a, b) => a - b);
    if (isLucky) state.luckyFace = state.luckyFaces[0] || null;
    return face;
  },

  _addFateUnluckyFace(enemy, ability = {}) {
    return this._addFateFace(enemy, 'unlucky', ability);
  },

  _addFateLuckyFace(enemy, ability = {}) {
    return this._addFateFace(enemy, 'lucky', ability);
  },

  _shellChargeState(enemy) {
    this._ensureState(enemy);
    enemy.abilityState.shellCharge = Math.max(0, enemy.abilityState.shellCharge || 0);
    return enemy.abilityState.shellCharge;
  },

  _applyShellRegen(enemy, ability = {}, logs = []) {
    this._ensureState(enemy);
    if (enemy.abilityState.shellRegenBroken || enemy.blockBroken) return 0;
    const values = Array.isArray(ability.blockByStage) ? ability.blockByStage : [];
    const stage = Math.max(0, Math.floor(enemy.tierStageIndex || 0));
    const targetBlock = Math.max(0, values[stage] ?? values[values.length - 1] ?? ability.block ?? enemy.block ?? 0);
    const current = CombatStatus.getBlock(enemy);
    const gain = Math.max(0, targetBlock - current);
    if (gain <= 0) return 0;
    CombatStatus.raiseBlock(enemy, gain);
    logs.push(`${enemy.name} 甲殼再生：格檔 +${gain}。`);
    return gain;
  },

  _dicePollutionState(char) {
    if (!char.dicePollution) char.dicePollution = { faces: [], empowered: 0 };
    if (!Array.isArray(char.dicePollution.faces)) char.dicePollution.faces = [];
    char.dicePollution.faces = [...new Set(char.dicePollution.faces)]
      .map(face => Number(face))
      .filter(face => Number.isFinite(face) && face > 0)
      .sort((a, b) => a - b);
    char.dicePollution.empowered = Math.max(0, char.dicePollution.empowered || 0);
    return char.dicePollution;
  },

  _combatDiceSides(char) {
    const isDodeca = (char?.fusedRelic?.id === 'wager_dice' && char?.relic?.id === 'lucky_star') ||
      (char?.fusedRelic?.id === 'lucky_star' && char?.relic?.id === 'wager_dice');
    return isDodeca ? 12 : 6;
  },

  _dicePollutionLimit(char) {
    return Math.max(1, Math.floor(this._combatDiceSides(char) / 2));
  },

  isPollutedRoll(char, rawFace, sides = 6) {
    if (!char || !rawFace) return false;
    const state = this._dicePollutionState(char);
    return state.faces.includes(Number(rawFace));
  },

  pollutedRollFace(char, rawFace, finalFace, sides = 6) {
    if (!char) return null;
    const state = this._dicePollutionState(char);
    const raw = Number(rawFace);
    const final = Number(finalFace);
    if (Number.isFinite(raw) && state.faces.includes(raw)) return raw;
    if (Number.isFinite(final) && state.faces.includes(final)) return final;
    return null;
  },

  polluteCharacter(char, ability, logs = []) {
    if (!char || char.dead || char.hp <= 0) return false;
    const state = this._dicePollutionState(char);
    const sides = this._combatDiceSides(char);
    const limit = this._dicePollutionLimit(char);
    if (state.faces.length >= limit) {
      const maxEmpowered = Math.max(0, ability.empoweredMax || 3);
      const before = state.empowered || 0;
      state.empowered = Math.min(maxEmpowered, before + 1);
      logs.push(`${char.name} 的污染已滿，強化污染 ${before} → ${state.empowered} 層。`);
      return true;
    }
    const available = Array.from({ length: sides }, (_, index) => index + 1)
      .filter(face => !state.faces.includes(face));
    if (available.length <= 0) return false;
    const face = available[Math.floor(Math.random() * available.length)];
    state.faces.push(face);
    state.faces.sort((a, b) => a - b);
    logs.push(`${char.name} 的骰面 ${face} 被污染。`);
    return true;
  },

  polluteRandomCharacter(squad, ability, logs = []) {
    const alive = this._aliveSquad(squad);
    if (alive.length <= 0) return false;
    const target = alive[Math.floor(Math.random() * alive.length)];
    return this.polluteCharacter(target, ability, logs);
  },

  clearOneDicePollutionFromAll(squad, logs = []) {
    const cleared = [];
    for (const char of this._aliveSquad(squad)) {
      const state = this._dicePollutionState(char);
      if (state.faces.length <= 0) continue;
      const index = Math.floor(Math.random() * state.faces.length);
      const face = state.faces.splice(index, 1)[0];
      cleared.push(`${char.name} ${face}`);
    }
    if (cleared.length > 0) logs.push(`污染破除：清除 ${cleared.join('、')}。`);
    return cleared;
  },

  _finalBossState(enemy) {
    this._ensureState(enemy);
    if (!enemy.abilityState.finalBoss) enemy.abilityState.finalBoss = {};
    return enemy.abilityState.finalBoss;
  },

  _finalBossPrepareRound(enemy, combat, ability, logs = []) {
    if (!enemy || !combat) return null;
    const state = this._finalBossState(enemy);
    const round = Math.max(1, combat.round || 1);
    if (state.preparedRound === round) return state;

    state.preparedRound = round;
    state.stance = round % 2 === 0 ? 'open' : 'closed';

    if (state.stance === 'open') {
      const faces = [1, 2, 3, 4, 5, 6].filter(face => face !== state.lastEyeWeakness);
      const face = faces[Math.floor(Math.random() * faces.length)] || Math.ceil(Math.random() * 6);
      state.lastEyeWeakness = face;
      enemy.weakness = face;
      enemy.finalBossEyeWeakness = face;
      if (CombatStatus.getBlock(enemy) > 0) CombatStatus.clearBlock(enemy);
      logs.push(`${enemy.name} 開眼，原生弱點顯現為 ${face}。`);
      return state;
    }

    enemy.weakness = null;
    enemy.finalBossEyeWeakness = null;
    if (state.skipNextClosedBlock) {
      state.skipNextClosedBlock = false;
      logs.push('短暫破曉：本次閉眼沒有獲得格檔。');
      return state;
    }
    const darkness = Math.max(0, Math.floor(Number.isFinite(enemy.finalBossDarkness) ? enemy.finalBossDarkness : (state.darkness || 0)));
    const block = Math.max(0, this._finalBossTierValue(ability, darkness, 'closedBlock', ability.closedBlock || 5));
    if (block > 0) {
      CombatStatus.raiseBlock(enemy, block);
      logs.push(`${enemy.name} 閉眼遮蔽，獲得格檔 ${block}。`);
    }
    return state;
  },

  _executionCountdownState(enemy, ability = {}) {
    this._ensureState(enemy);
    if (!enemy.abilityState.executionCountdown) {
      enemy.abilityState.executionCountdown = {
        remaining: Math.max(1, ability.turns || 5),
        executed: false,
      };
    }
    return enemy.abilityState.executionCountdown;
  },

  _finalBossDarknessTier(ability, darkness = 0) {
    const tiers = Array.isArray(ability?.darknessTiers) ? ability.darknessTiers : [];
    const available = tiers
      .filter(tier => Math.max(0, tier?.minDarkness || 0) <= darkness)
      .sort((a, b) => Math.max(0, a.minDarkness || 0) - Math.max(0, b.minDarkness || 0));
    return available.length > 0 ? available[available.length - 1] : null;
  },

  _finalBossTierValue(ability, darkness, key, fallback = 0) {
    const tier = this._finalBossDarknessTier(ability, darkness);
    return Number.isFinite(tier?.[key]) ? tier[key] : fallback;
  },

  handlers: {
    first_strike: {
      beforeEnemyAction(ability, { enemy, intent, result, logs }) {
        const state = enemy.abilityState || (enemy.abilityState = {});
        if (intent?.type === 'worm_coil') {
          const block = Math.max(0, ability.coilBlock ?? 2);
          const bonus = Math.max(0, ability.coilDamageBonus ?? 1);
          if (block > 0) CombatStatus.raiseBlock(enemy, block);
          state.firstStrikeCoilDamageBonus = Math.max(0, state.firstStrikeCoilDamageBonus || 0) + bonus;
          result.enemyAttackFlow = false;
          result.counterDmg = 0;
          result.aoeCounter = 0;
          result.enemyBlockGain = Math.max(0, result.enemyBlockGain || 0) + block;
          result.firstStrikeSummary = `${enemy.name} 蜷縮蓄勢，獲得 ${block} 格檔，下一次先攻傷害 +${bonus}。`;
          logs.push(`${enemy.name} 蜷縮蓄勢：格檔 +${block}，下一次先攻傷害 +${bonus}。`);
          return;
        }

        const charge = Math.max(0, state.firstStrikeCoilDamageBonus || 0);
        if (charge <= 0 || result.counterDmg <= 0) return;
        result.counterDmg += charge;
        state.firstStrikeCoilDamageBonus = 0;
        logs.push(`${enemy.name} 釋放蓄勢：本次先攻傷害 +${charge}。`);
      },
    },

    execution_countdown: {
      onCombatStart(ability, { enemy, logs }) {
        const state = EnemyAbilities._executionCountdownState(enemy, ability);
        logs.push(`${enemy.name} 準備處刑：倒數 ${state.remaining}。`);
      },

      resolveIntent(ability, { enemy, intent }) {
        const state = EnemyAbilities._executionCountdownState(enemy, ability);
        if (!state.executed && state.remaining <= 0) {
          return { type: 'execution', weight: 1 };
        }
        return intent;
      },

      beforeEnemyAction(ability, { enemy, result, logs }) {
        const state = EnemyAbilities._executionCountdownState(enemy, ability);
        if (state.executed || state.remaining > 0) return;
        state.executed = true;
        enemy.rescueExecuted = true;
        result.enemyAttackFlow = false;
        result.counterDmg = 0;
        result.aoeCounter = 0;
        logs.push(`${enemy.name} 執行處刑，牢中的倖存者死亡。`);
      },

      afterEnemyAction(ability, { enemy, intent, logs }) {
        const state = EnemyAbilities._executionCountdownState(enemy, ability);
        if (state.executed || intent?.type === 'execution') return;
        const before = state.remaining;
        state.remaining = Math.max(0, before - 1);
        logs.push(`${enemy.name} 的處刑倒數 ${before} → ${state.remaining}。`);
      },
    },

    final_boss: {
      onCombatStart(ability, { enemy, combat, logs }) {
        const state = EnemyAbilities._finalBossState(enemy);
        if (!state.scaled) {
          const darkness = Math.max(0, Math.floor(Number.isFinite(enemy.finalBossDarkness) ? enemy.finalBossDarkness : ((typeof G !== 'undefined' && G?.darkness) || 0)));
          state.scaled = true;
          state.darkness = darkness;
          const tierHpBonus = EnemyAbilities._finalBossTierValue(ability, darkness, 'hpBonus', 0);
          const hpBonus = darkness * Math.max(0, ability.hpPerDarkness || 0) + Math.max(0, tierHpBonus);
          const attackBonus = Math.floor(darkness / Math.max(1, ability.attackPerDarkness || 5));
          if (!enemy.finalBossPrescaled) {
            enemy.maxHp = Math.max(1, (enemy.maxHp || enemy.hp || 1) + hpBonus);
            enemy.hp = Math.max(1, (enemy.hp || 1) + hpBonus);
            enemy.attack = Math.max(0, (enemy.attack || 0) + attackBonus);
          }
          logs.push(`黑暗強化：黑暗 ${darkness}，${enemy.name} 最大生命 +${hpBonus}，攻擊 +${attackBonus}。`);
        }
        EnemyAbilities._finalBossPrepareRound(enemy, combat, ability, logs);
      },

      onRoundStart(ability, { enemy, combat, logs }) {
        EnemyAbilities._finalBossPrepareRound(enemy, combat, ability, logs);
      },

      resolveIntent(ability, { enemy, combat }) {
        const state = EnemyAbilities._finalBossPrepareRound(enemy, combat, ability, []);
        if (state?.stance === 'open') return { type: 'attack', finalEye: true, name: '黑夜開眼' };
        return { type: 'attack', name: '閉眼壓迫' };
      },

      beforeEnemyAction(ability, { enemy, intent, result, squad, logs }) {
        if (!intent?.finalEye || result.counterDmg <= 0 || !result.counterTarget) return;
        const state = EnemyAbilities._finalBossState(enemy);
        const roll = Math.ceil(Math.random() * 6);
        const darkness = Math.max(0, Math.floor(Number.isFinite(enemy.finalBossDarkness) ? enemy.finalBossDarkness : (state.darkness || 0)));
        const eyeDamageBonus = Math.max(0, EnemyAbilities._finalBossTierValue(ability, darkness, 'eyeDamageBonus', 0));
        const bonus = Math.ceil(roll / 2) + eyeDamageBonus;
        result.enemyDiceRoll = roll;
        result.counterDmg += bonus;
        logs.push(`${enemy.name} 開眼擲骰 ${roll}，本次攻擊傷害 +${bonus}。`);

        if (state.skipNextOpenSplash) {
          state.skipNextOpenSplash = false;
          logs.push('短暫破曉：本次開眼攻擊不造成濺射。');
          return;
        }

        const splash = Math.max(0, EnemyAbilities._finalBossTierValue(ability, darkness, 'splashDamage', ability.splashDamage || 0));
        const blackLight = Math.max(0, EnemyAbilities._finalBossTierValue(ability, darkness, 'blackLightDamage', 0));
        if (splash <= 0 && blackLight <= 0) return;
        result.aoeDamageByChar = {};
        let highestAoe = 0;
        for (const char of EnemyAbilities._aliveSquad(squad)) {
          const value = (char.id === result.counterTarget.id ? 0 : splash) + blackLight;
          result.aoeDamageByChar[char.id] = value;
          highestAoe = Math.max(highestAoe, value);
        }
        result.aoeCounter = highestAoe;
        if (splash > 0) logs.push(`${enemy.name} 開眼濺射，非目標隊友各受到 ${splash} 傷害。`);
        if (blackLight > 0) logs.push(`${enemy.name} 終夜黑光，全隊各受到 ${blackLight} 傷害。`);
      },
    },

    dice_pollution: {
      resolveIntent(ability, { combat }) {
        const round = combat?.round || 1;
        if (round % 3 === 1) return { type: 'pollute', name: '\u6c61\u67d3\u8108\u885d' };
        if (round % 3 === 2) return { type: 'attack', polluteTarget: true };
        return { type: 'aoe', polluteRandom: true };
      },

      beforeEnemyAction(ability, { attacker, enemy, intent, result, squad, logs }) {
        if (intent?.type === 'pollute') {
          const pulseDamage = Math.max(0, ability.pollutePulseDamage || 0);
          result.enemyAttackFlow = pulseDamage > 0;
          result.counterDmg = 0;
          result.aoeCounter = pulseDamage;
          if (ability.polluteActiveAttacker && attacker && !attacker.dead && attacker.hp > 0) {
            EnemyAbilities.polluteCharacter(attacker, ability, logs);
          }
          EnemyAbilities.polluteRandomCharacter(squad, ability, logs);
          const extra = Math.max(0, ability.extraRandomPollutions || 0);
          for (let i = 0; i < extra; i++) EnemyAbilities.polluteRandomCharacter(squad, ability, logs);
          if (pulseDamage > 0) {
            logs.push(`${enemy.name} \u91cb\u653e\u6c61\u67d3\u8108\u885d\uff0c\u5168\u968a\u627f\u53d7 ${pulseDamage} \u50b7\u5bb3\u3002`);
          } else {
            logs.push(`${enemy.name} \u91cb\u653e\u6c61\u67d3\u5b62\u5b50\uff0c\u6c92\u6709\u76f4\u63a5\u653b\u64ca\u3002`);
          }
          return;
        }
        if (intent?.polluteTarget && result.counterTarget) {
          EnemyAbilities.polluteCharacter(result.counterTarget, ability, logs);
        }
        if (intent?.polluteRandom) {
          EnemyAbilities.polluteRandomCharacter(squad, ability, logs);
        }
      },

      beforePlayerDamage(ability, { attacker, enemy, rollResult, result, logs }) {
        if (!rollResult?.pollutedFaceHit) return;
        const state = EnemyAbilities._dicePollutionState(attacker);
        const heal = Math.max(0, ability.heal || 6);
        const beforeHp = enemy.hp || 0;
        enemy.hp = Math.min(enemy.maxHp || enemy.hp || 0, beforeHp + heal);
        result.damage = 0;
        result.pollutionTriggered = true;
        result.pollutionHeal = enemy.hp - beforeHp;
        state.faces = state.faces.filter(face => face !== Number(rollResult.pollutedFace));
        logs.push(`\u6c61\u67d3\u9ab0\u9762 ${rollResult.pollutedFace} \u89f8\u767c\uff1a\u672c\u6b21\u50b7\u5bb3\u6b78\u96f6\uff0c${enemy.name} \u6062\u5fa9 ${result.pollutionHeal} HP\uff0c\u8a72\u6c61\u67d3\u9762\u6e05\u9664\u3002`);
        const baseSelfDamage = Math.max(0, ability.pollutedFaceSelfDamage || 0);
        const empoweredSelfDamage = Math.max(0, state.empowered || 0) * Math.max(0, ability.empoweredSelfDamage || 1);
        const selfDamage = baseSelfDamage + empoweredSelfDamage;
        if (selfDamage > 0) {
          attacker.hp = Math.max(0, attacker.hp - selfDamage);
          result.pollutionSelfDamage = selfDamage;
          logs.push(`\u6c61\u67d3\u53cd\u566c\uff1a${attacker.name} \u53d7\u5230 ${selfDamage} \u50b7\u5bb3\u3002`);
        }
      },
    },
    block_thorns: {
      afterPlayerAttack(ability, { attacker, enemy, result, logs }) {
        if (!attacker || attacker.hp <= 0 || attacker.dead) return;
        if (enemy.hp <= 0 || CombatStatus.getBlock(enemy) <= 0 || enemy.blockBroken) return;
        let damage = Math.max(0, enemy.thornDamage || ability.damage || 1);
        if (damage <= 0) return;
        let finalDamage = damage;
        if (result) {
          result.guardRemainingBlockByChar = result.guardRemainingBlockByChar && typeof result.guardRemainingBlockByChar === 'object'
            ? result.guardRemainingBlockByChar
            : {};
        }
        finalDamage = CombatStatus.applyExplorerEvasion(attacker, finalDamage, logs, '反震');
        damage = finalDamage;
        if (CombatStatus.getBlock(attacker) > 0) {
          const allyBlockBefore = CombatStatus.getBlock(attacker);
          const blockResult = CombatStatus.consumeBlock(attacker, damage);
          finalDamage = blockResult.damage;
          if (result) result.guardRemainingBlockByChar[attacker.id] = blockResult.block;
          if (blockResult.absorbed > 0) logs.push(`${attacker.name} 的格檔抵銷 ${blockResult.absorbed} 點反震。`);
          if (result && blockResult.absorbed > 0 && finalDamage <= 0) {
            result.incomingDamageEvents = Array.isArray(result.incomingDamageEvents)
              ? result.incomingDamageEvents
              : [];
            result.incomingDamageEvents.push({
              type: 'block_thorns_blocked',
              targetId: attacker.id,
              damage: 0,
              from: attacker.hp,
              to: attacker.hp,
              allyBlockBefore,
              allyBlockAfter: blockResult.block,
              allyBlockAbsorbed: blockResult.absorbed,
              fullBlock: true,
            });
          }
        }
        damage = finalDamage;
        if (finalDamage > 0) {
          const beforeHp = attacker.hp;
          attacker.hp = Math.max(0, attacker.hp - finalDamage);
          if (result) {
            result.incomingDamageEvents = Array.isArray(result.incomingDamageEvents)
              ? result.incomingDamageEvents
              : [];
            result.incomingDamageEvents.push({
              type: 'block_thorns',
              targetId: attacker.id,
              damage: finalDamage,
              from: beforeHp,
              to: attacker.hp,
            });
          }
        }
        logs.push(`${enemy.name} 格檔反震：${attacker.name} 受到 ${damage} 點傷害。`);
      },
    },

    shell_charge: {
      afterEnemyBlock(ability, { enemy, logs }) {
        const before = EnemyAbilities._shellChargeState(enemy);
        const max = Math.max(1, ability.maxStacks || 3);
        enemy.abilityState.shellCharge = Math.min(max, before + 1);
        logs.push(`${enemy.name} 縮殼蓄撞：${before} → ${enemy.abilityState.shellCharge} 層。`);
      },

      beforeEnemyAction(ability, { enemy, result, logs }) {
        const stacks = EnemyAbilities._shellChargeState(enemy);
        if (stacks <= 0) return;
        if (result.counterDmg <= 0 && result.aoeCounter <= 0) return;
        const bonus = stacks * Math.max(1, ability.bonusPerStack || 1);
        if (result.counterDmg > 0) result.counterDmg += bonus;
        if (result.aoeCounter > 0) result.aoeCounter += bonus;
        enemy.abilityState.shellCharge = 0;
        logs.push(`${enemy.name} 釋放蓄撞：${stacks} 層，本次傷害 +${bonus}，蓄撞歸零。`);
      },
    },

    shell_regen: {
      onCombatStart(ability, { enemy, logs }) {
        EnemyAbilities._applyShellRegen(enemy, ability, logs);
      },

      onRoundStart(ability, { enemy, logs }) {
        EnemyAbilities._applyShellRegen(enemy, ability, logs);
      },

      afterPlayerAttack(ability, { enemy, result, logs }) {
        if (!result?.nativeWeaknessBreakHit) return;
        enemy.abilityState.shellRegenBroken = true;
        const beforeBlock = CombatStatus.getBlock(enemy);
        if (beforeBlock > 0) CombatStatus.clearBlock(enemy);
        logs.push(`${enemy.name} 原生弱點被命中，甲殼破裂：格檔清除，本場不再再生硬殼。`);
      },

      beforeEnemyAction(ability, { enemy, result, logs }) {
        if (result.counterDmg <= 0 || !result.counterTarget) return;
        if (CombatStatus.getBlock(result.counterTarget) <= 0) return;
        const bonus = Math.max(0, ability.blockTargetDamageBonus || 0);
        if (bonus <= 0) return;
        result.counterDmg += bonus;
        logs.push(`${enemy.name} 咬住防線破口：目標有格檔，本次傷害 +${bonus}。`);
      },
    },

    poison_dust: {
      beforeEnemyAction(ability, { enemy, intent, result, logs }) {
        if (intent?.type !== 'aoe') return;
        const roll = Math.ceil(Math.random() * 3);
        const bonus = Math.max(0, enemy.attack || 0);
        const reduction = enemy.abilityState?.poisonWeakened
          ? Math.max(0, ability.weakenReduction || 1)
          : 0;
        const beforeReduction = roll + bonus;
        const damage = Math.max(1, beforeReduction - reduction);
        result.enemyDiceRoll = roll;
        result.enemyDiceSides = 3;
        result.aoeCounter = damage;
        result.enemyAttackFlow = true;
        logs.push(`${enemy.name} 毒粉骰 ${roll}：全體傷害 ${damage}${reduction > 0 ? `（毒粉潰散 -${reduction}）` : ''}。`);
      },
    },

    blood_hunt: {
      resolveIntent(ability, { enemy, intent }) {
        if (enemy.exposed) return null;
        if (!['attack', 'block_attack', 'dice_attack'].includes(intent?.type)) return null;
        return {
          ...(intent || { type: 'attack', weight: 1 }),
          preferLowestHp: true,
        };
      },

      beforeEnemyAction(ability, { enemy, result, logs }) {
        if (enemy.exposed || result.counterDmg <= 0 || !result.counterTarget) return;
        const target = result.counterTarget;
        const maxHp = Math.max(1, target.maxHp || target.hp || 1);
        const threshold = Math.max(0, Math.min(1, ability.lowHpThreshold ?? 0.5));
        if ((target.hp || 0) / maxHp >= threshold) return;
        const bonus = Math.max(0, ability.damageBonus || 1);
        if (bonus <= 0) return;
        result.counterDmg += bonus;
        logs.push(`${enemy.name} 追獵血味：${target.name} 生命低於一半，本次傷害 +${bonus}。`);
      },
    },

    pain_growth: {
      onCombatStart(ability, { enemy, combat, logs }) {
        if (enemy.abilityState?.painGrowthSuppressed) return;
        const stacks = Math.max(0, ability.naturalStacks || 0);
        if (stacks <= 0) return;
        const { before, after } = CombatStatus.addWounds(enemy, stacks);
        const selfDamage = EnemyAbilities._painGrowthSelfDamage(enemy, ability, stacks);
        logs.push(`${enemy.name}的痛痕滋長：傷口 ${before} → ${after} 層，自身 HP -${selfDamage}。`);
      },

      onRoundStart(ability, { enemy, combat, logs }) {
        if (enemy.abilityState?.painGrowthSuppressed) return;
        const stacks = Math.max(0, ability.naturalStacks || 0);
        if (stacks <= 0) return;
        const { before, after } = CombatStatus.addWounds(enemy, stacks);
        const selfDamage = EnemyAbilities._painGrowthSelfDamage(enemy, ability, stacks);
        logs.push(`${enemy.name}的痛痕滋長：傷口 ${before} → ${after} 層，自身 HP -${selfDamage}。`);
      },

      resolveIntent(ability, { enemy, combat }) {
        const interval = Math.max(1, ability.specialEvery || 0);
        const round = combat?.round || 1;
        if (round <= 0 || round % interval !== 0) return null;
        return {
          type: 'self_wound',
          amount: Math.max(0, ability.specialStacks || 0),
          name: '撕裂自身',
        };
      },

      beforeEnemyAction(ability, { enemy, intent, result, logs }) {
        if (intent?.type === 'self_wound') {
          const stacks = Math.max(0, intent.amount || ability.specialStacks || 0);
          const { before, after } = CombatStatus.addWounds(enemy, stacks);
          const selfDamage = EnemyAbilities._painGrowthSelfDamage(enemy, ability, stacks);
          result.enemyAttackFlow = false;
          result.counterDmg = 0;
          result.aoeCounter = 0;
          logs.push(`${enemy.name}撕裂自身：傷口 ${before} → ${after} 層，自身 HP -${selfDamage}。`);
          return;
        }

        const per = Math.max(1, ability.attackBonusPerWounds || 0);
        const wounds = CombatStatus.getWounds(enemy);
        const bonus = Math.floor(wounds / per);
        if (bonus <= 0) return;
        if (result.counterDmg > 0) result.counterDmg += bonus;
        if (result.aoeCounter > 0) result.aoeCounter += bonus;
        if (result.counterDmg > 0 || result.aoeCounter > 0) {
          logs.push(`${enemy.name}的痛痕轉為攻勢：傷口 ${wounds} 層，攻擊傷害 +${bonus}。`);
        }
      },
    },

    rift_gaze: {
      onCombatStart(ability, { enemy, combat, logs }) {
        EnemyAbilities._addPartyGazeWeaknesses(combat?.squad || [], logs, enemy.name, Math.max(1, ability.addPerRound || 1));
      },

      onRoundStart(ability, { enemy, combat, logs }) {
        EnemyAbilities._addPartyGazeWeaknesses(combat?.squad || [], logs, enemy.name, Math.max(1, ability.addPerRound || 1));
      },

      beforeEnemyAction(ability, { enemy, squad, result, logs }) {
        if (result.counterDmg <= 0 && result.aoeCounter <= 0) return;
        const gazeRoll = Math.ceil(Math.random() * 6);
        const nativeDamageBonus = Math.max(0, ability.nativeDamageBonus ?? 3);
        result.gazeRoll = gazeRoll;

        if (result.counterDmg > 0 && result.counterTarget) {
          const target = result.counterTarget;
          const hit = CombatStatus.applyNativeWeaknessHit(target, gazeRoll, result.counterDmg, {
            source: 'gaze',
            damageBonus: nativeDamageBonus,
          });
          if (hit.hit) {
            result.counterDmg = hit.damage;
            result.gazeSummary = `裂隙凝視骰 ${gazeRoll} 命中 ${target.name}，傷害 +${nativeDamageBonus} 並移除該弱點。`;
            logs.push(`${enemy.name}凝視骰 ${gazeRoll} 命中 ${target.name} 的原生弱點：傷害 ${hit.before} → ${result.counterDmg}，移除該弱點。`);
          } else {
            result.gazeSummary = `裂隙凝視骰 ${gazeRoll} 未命中 ${target.name} 的原生弱點。`;
            logs.push(`${enemy.name}凝視骰 ${gazeRoll} 未命中 ${target.name} 的原生弱點。`);
          }
          return;
        }

        if (result.aoeCounter > 0) {
          const damageByChar = {};
          const hitNames = [];
          for (const char of EnemyAbilities._aliveSquad(squad)) {
            const hit = CombatStatus.applyNativeWeaknessHit(char, gazeRoll, result.aoeCounter, {
              source: 'gaze',
              damageBonus: nativeDamageBonus,
            });
            let damage = hit.damage;
            if (hit.hit) {
              hitNames.push(char.name);
            }
            damageByChar[char.id] = damage;
          }
          result.aoeDamageByChar = damageByChar;
          if (hitNames.length > 0) {
            result.gazeSummary = `裂隙凝視骰 ${gazeRoll} 命中 ${hitNames.join('、')}，命中者傷害 +${nativeDamageBonus} 並移除該弱點。`;
            logs.push(`${enemy.name}凝視骰 ${gazeRoll} 命中 ${hitNames.join('、')} 的原生弱點：命中者傷害 +${nativeDamageBonus}，並移除該弱點。`);
          } else {
            result.gazeSummary = `裂隙凝視骰 ${gazeRoll} 未命中任何原生弱點。`;
            logs.push(`${enemy.name}凝視骰 ${gazeRoll} 未命中任何原生弱點。`);
          }
        }
      },
    },

    fate_gamble: {
      onCombatStart(ability, { enemy, combat }) {
        EnemyAbilities._rollFateGambleFaces(enemy, ability, combat?.round || 1);
      },

      resolveIntent(ability, { enemy, combat, intent }) {
        const state = EnemyAbilities._rollFateGambleFaces(enemy, ability, combat?.round || 1);
        const luckyFaces = EnemyAbilities._fateFaceList(state.luckyFaces, [state.luckyFace]);
        const unluckyFaces = EnemyAbilities._fateFaceList(state.unluckyFaces, [state.unluckyFace]);
        return {
          ...(intent || { type: 'attack', weight: 1 }),
          fateLuckyFace: luckyFaces[0] || null,
          fateLuckyFaces: luckyFaces,
          fateUnluckyFaces: unluckyFaces,
        };
      },

      beforeEnemyAction(ability, { enemy, result, logs }) {
        if (result.counterDmg <= 0 || !result.counterTarget) return;
        const state = EnemyAbilities._fateGambleState(enemy);
        const luckyFaces = EnemyAbilities._fateFaceList(state.luckyFaces, [state.luckyFace || 1]);
        const unluckyFaces = EnemyAbilities._fateFaceList(state.unluckyFaces, [state.unluckyFace || (luckyFaces[0] === 1 ? 2 : 1)]);
        const fateRoll = Math.ceil(Math.random() * 6);
        const multiplier = Math.max(1, ability.luckyMultiplier || 1);
        result.fateRoll = fateRoll;
        result.fateLuckyFace = luckyFaces[0] || null;
        result.fateLuckyFaces = [...luckyFaces];
        result.fateUnluckyFaces = [...unluckyFaces];
        const fateBoardText = `本回合命運盤：幸運 ${luckyFaces.join('、')} / 厄運 ${unluckyFaces.join('、')}。`;

        if (unluckyFaces.includes(fateRoll)) {
          const beforeHp = Math.max(1, enemy.hp || 1);
          const selfDamage = Math.max(1, Math.floor(beforeHp * (ability.unluckySelfDamageRate ?? 0.25)));
          enemy.hp = Math.max(1, beforeHp - selfDamage);
          const beforeSingle = result.counterDmg;
          const beforeAoe = result.aoeCounter;
          if (result.counterDmg > 0) result.counterDmg = Math.ceil(result.counterDmg / 2);
          if (result.aoeCounter > 0) result.aoeCounter = Math.ceil(result.aoeCounter / 2);
          result.fateSummary = `${fateBoardText}命運骰 ${fateRoll} 命中厄運面，${enemy.name} 失去 ${selfDamage} HP，且本回合攻擊減半。`;
          logs.push(`${enemy.name}命運骰 ${fateRoll} 命中厄運面：HP ${beforeHp} → ${enemy.hp}，攻擊 ${beforeSingle || beforeAoe} → ${result.counterDmg || result.aoeCounter}。`);
          return;
        }

        if (luckyFaces.includes(fateRoll)) {
          const before = result.counterDmg;
          result.counterDmg *= multiplier;
          const added = EnemyAbilities._addFateLuckyFace(enemy, ability);
          const luckyGrowth = added ? `新增幸運面 ${added}。` : '幸運面已達上限。';
          result.fateSummary = `${fateBoardText}命運骰 ${fateRoll} 命中幸運面，${result.counterTarget.name} 受到 x${multiplier} 傷害，${luckyGrowth}`;
          logs.push(`${enemy.name}命運骰 ${fateRoll} 命中幸運面：傷害 ${before} → ${result.counterDmg}，${luckyGrowth}`);
          return;
        }

        result.fateSummary = `${fateBoardText}命運骰 ${fateRoll} 未命中幸運面或厄運面，擲命守衛普通攻擊。`;
        logs.push(`${enemy.name}命運骰 ${fateRoll} 未命中幸運面或厄運面。`);
      },
    },

    sword_law_guardian: {
      onCombatStart(ability, { enemy, logs }) {
        const state = EnemyAbilities._swordLawState(enemy, ability);
        logs.push(`${enemy.name}的劍律甦醒：基礎攻擊 ${state.baseAttack}。`);
      },

      resolveIntent(ability, { enemy, intent }) {
        const state = EnemyAbilities._swordLawState(enemy, ability);
        return {
          ...(intent || { type: 'attack', weight: 1 }),
          type: 'attack',
          swordLaw: true,
          swordLawBaseAttack: state.baseAttack,
        };
      },

      beforeEnemyAction(ability, { enemy, result, logs }) {
        const state = EnemyAbilities._swordLawState(enemy, ability);
        const roll = Math.ceil(Math.random() * 6);
        const lowMax = Math.max(1, ability.lowMax || 3);
        const growMin = Math.max(lowMax + 1, ability.growMin || 4);
        const before = state.baseAttack;
        result.enemyDiceRoll = roll;
        result.enemyDiceSides = 6;
        result.enemyAttackFlow = true;

        if (roll <= lowMax) {
          const hits = Math.max(1, roll);
          const damage = Math.max(0, before * hits);
          result.counterDmg = damage;
          result.counterDamageHits = Array.from({ length: hits }, (_, index) => ({
            damage: before,
            followDelayMs: index === 0 ? 0 : Math.max(120, 190 - index * 25),
            attackTrail: 'slash',
            hitEffect: 'slash',
          }));
          result.firstStrikeSummary = `${enemy.name}劍律骰 ${roll}：銀蜂律，${before} 傷 × ${hits} 刺 = ${damage}。`;
          logs.push(`${enemy.name}劍律骰 ${roll}：銀蜂連刺 ${hits} 次，每刺 ${before} 傷，合計 ${damage}。`);
          return;
        }

        const growth = Math.max(1, ability.growAmount || 1);
        state.baseAttack = before + growth;
        enemy.attack = state.baseAttack;
        result.counterDmg = state.baseAttack;
        result.firstStrikeSummary = `${enemy.name}劍律骰 ${roll}：沉鐵律，基礎攻擊 ${before} → ${state.baseAttack}，造成 ${state.baseAttack} 傷害。`;
        logs.push(`${enemy.name}劍律骰 ${roll}：沉鐵蓄勢，基礎攻擊 ${before} → ${state.baseAttack}，造成 ${state.baseAttack} 傷害。`);
      },
    },

    banner_guardian: {
      onCombatStart(ability, { enemy }) {
        EnemyAbilities._bannerGuardianState(enemy, ability);
      },

      resolveIntent(ability, { enemy, combat }) {
        const state = EnemyAbilities._bannerGuardianState(enemy, ability);
        const step = ((Math.max(1, combat?.round || 1) - 1) % 3) + 1;
        if (step === 3) {
          return {
            type: 'banner_switch',
            weight: 1,
            fromStance: state.stance,
            toStance: state.stance === 'wound' ? 'damage' : 'wound',
          };
        }
        return {
          type: step === 1 ? 'attack' : 'aoe',
          weight: 1,
          bannerStance: state.stance,
        };
      },

      beforeEnemyAction(ability, { enemy, squad, intent, result, logs }) {
        const state = EnemyAbilities._bannerGuardianState(enemy, ability);
        if (intent?.type === 'banner_switch') {
          const next = intent.toStance || (state.stance === 'wound' ? 'damage' : 'wound');
          const block = Math.max(0, ability.switchBlock ?? enemy.block ?? 0);
          state.stance = next;
          state.interrupted = false;
          CombatStatus.raiseBlock(enemy, block);
          result.enemyAttackFlow = false;
          result.counterDmg = 0;
          result.aoeCounter = 0;
          result.bannerSummary = `${enemy.name} 換成${EnemyAbilities._bannerGuardianStanceName(next)}，並獲得 ${block} 格檔。`;
          logs.push(`${enemy.name}換旗：改為${EnemyAbilities._bannerGuardianStanceName(next)}，格檔 +${block}。`);
          return;
        }

        if (state.interrupted) {
          result.bannerSummary = `${enemy.name}的${EnemyAbilities._bannerGuardianStanceName(state.stance)}被中斷，本回合旗面效果不生效。`;
          logs.push(`${enemy.name}的${EnemyAbilities._bannerGuardianStanceName(state.stance)}被中斷：旗面效果不生效。`);
          return;
        }

        if (state.stance === 'wound') {
          const stacks = Math.max(0, ability.woundStacks || 0);
          if (stacks <= 0) return;
          const changed = [];
          for (const char of EnemyAbilities._aliveSquad(squad)) {
            const { before, after } = CombatStatus.addWounds(char, stacks);
            changed.push(`${char.name} ${before}→${after}`);
          }
          if (changed.length > 0) {
            result.bannerSummary = `${enemy.name}的創傷旗展開：全隊傷口 +${stacks}。`;
            logs.push(`${enemy.name}的創傷旗：全隊傷口 +${stacks}（${changed.join('、')}）。`);
          }
          return;
        }

        if (state.stance === 'damage') {
          const bonus = Math.max(0, ability.damageBonus || 0);
          if (bonus <= 0) return;
          if (result.counterDmg > 0) result.counterDmg += bonus;
          if (result.aoeCounter > 0) result.aoeCounter += bonus;
          if (result.counterDmg > 0 || result.aoeCounter > 0) {
            result.bannerSummary = `${enemy.name}的戰吼旗展開：攻擊傷害 +${bonus}。`;
            logs.push(`${enemy.name}的戰吼旗：攻擊傷害 +${bonus}。`);
          }
        }
      },
    },
  },

  _swordLawState(enemy, ability = {}) {
    this._ensureState(enemy);
    if (!enemy.abilityState.swordLawGuardian) {
      const base = Math.max(1, Math.floor(ability.baseAttack || enemy.attack || 2));
      enemy.abilityState.swordLawGuardian = { baseAttack: base };
      enemy.attack = base;
    }
    const state = enemy.abilityState.swordLawGuardian;
    state.baseAttack = Math.max(Math.max(1, ability.minBaseAttack || 1), Math.floor(state.baseAttack || ability.baseAttack || enemy.attack || 2));
    enemy.attack = state.baseAttack;
    return state;
  },

  _bannerGuardianState(enemy, ability = {}) {
    this._ensureState(enemy);
    if (!enemy.abilityState.bannerGuardian) {
      enemy.abilityState.bannerGuardian = {
        stance: ability.startStance || 'wound',
        interrupted: false,
      };
    }
    return enemy.abilityState.bannerGuardian;
  },

  _bannerGuardianStanceName(stance) {
    return stance === 'damage' ? '戰吼旗' : '創傷旗';
  },
};
