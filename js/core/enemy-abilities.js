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

  _rollFateGambleFaces(enemy) {
    const state = this._fateGambleState(enemy);
    if (state.luckyFace && Array.isArray(state.unluckyFaces) && state.unluckyFaces.length > 0) {
      return state;
    }
    const luckyFace = Math.ceil(Math.random() * 6);
    let unluckyFace = Math.ceil(Math.random() * 6);
    while (unluckyFace === luckyFace) unluckyFace = Math.ceil(Math.random() * 6);
    state.luckyFace = luckyFace;
    state.unluckyFaces = [unluckyFace];
    return state;
  },

  _addFateUnluckyFace(enemy) {
    const state = this._fateGambleState(enemy);
    const luckyFace = state.luckyFace || null;
    const current = Array.isArray(state.unluckyFaces)
      ? [...new Set(state.unluckyFaces.filter(face => face >= 1 && face <= 6))]
      : (state.unluckyFace ? [state.unluckyFace] : []);
    const available = [1, 2, 3, 4, 5, 6].filter(face => face !== luckyFace && !current.includes(face));
    if (available.length <= 0) {
      state.unluckyFaces = current;
      return null;
    }
    const face = available[Math.floor(Math.random() * available.length)];
    state.unluckyFaces = [...current, face].sort((a, b) => a - b);
    return face;
  },

  _shellChargeState(enemy) {
    this._ensureState(enemy);
    enemy.abilityState.shellCharge = Math.max(0, enemy.abilityState.shellCharge || 0);
    return enemy.abilityState.shellCharge;
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
    const block = Math.max(0, ability.closedBlock || 5);
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

  handlers: {
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
          const hpBonus = darkness * Math.max(0, ability.hpPerDarkness || 0);
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
        const bonus = Math.ceil(roll / 2);
        result.enemyDiceRoll = roll;
        result.counterDmg += bonus;
        logs.push(`${enemy.name} 開眼擲骰 ${roll}，本次攻擊傷害 +${bonus}。`);

        if (state.skipNextOpenSplash) {
          state.skipNextOpenSplash = false;
          logs.push('短暫破曉：本次開眼攻擊不造成濺射。');
          return;
        }

        const splash = Math.max(0, ability.splashDamage || 0);
        if (splash <= 0) return;
        result.aoeCounter = splash;
        result.aoeDamageByChar = {};
        for (const char of EnemyAbilities._aliveSquad(squad)) {
          result.aoeDamageByChar[char.id] = char.id === result.counterTarget.id ? 0 : splash;
        }
        logs.push(`${enemy.name} 開眼濺射，非目標隊友各受到 ${splash} 傷害。`);
      },
    },

    dice_pollution: {
      resolveIntent(ability, { combat }) {
        const round = combat?.round || 1;
        if (round % 3 === 1) return { type: 'pollute', name: '污染孢子' };
        if (round % 3 === 2) return { type: 'attack', polluteTarget: true };
        return { type: 'aoe', polluteRandom: true };
      },

      beforeEnemyAction(ability, { enemy, intent, result, squad, logs }) {
        if (intent?.type === 'pollute') {
          result.enemyAttackFlow = false;
          result.counterDmg = 0;
          result.aoeCounter = 0;
          EnemyAbilities.polluteRandomCharacter(squad, ability, logs);
          logs.push(`${enemy.name} 散出污染孢子，沒有攻擊。`);
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
        logs.push(`污染骰面 ${rollResult.pollutedFace} 觸發：本次傷害歸零，${enemy.name} 恢復 ${result.pollutionHeal} HP。`);
        const selfDamage = Math.max(0, state.empowered || 0) * Math.max(0, ability.empoweredSelfDamage || 1);
        if (selfDamage > 0) {
          attacker.hp = Math.max(0, attacker.hp - selfDamage);
          result.pollutionSelfDamage = selfDamage;
          logs.push(`強化污染反噬：${attacker.name} 受到 ${selfDamage} 傷害。`);
        }
      },
    },

    block_thorns: {
      afterPlayerAttack(ability, { attacker, enemy, logs }) {
        if (!attacker || attacker.hp <= 0 || attacker.dead) return;
        if (enemy.hp <= 0 || CombatStatus.getBlock(enemy) <= 0 || enemy.blockBroken) return;
        const damage = Math.max(0, enemy.thornDamage || ability.damage || 1);
        if (damage <= 0) return;
        attacker.hp = Math.max(0, attacker.hp - damage);
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

    poison_dust: {
      beforeEnemyAction(ability, { enemy, intent, result, logs }) {
        if (intent?.type !== 'aoe') return;
        const roll = Math.ceil(Math.random() * 6);
        const bonus = Math.max(0, enemy.attack || 0);
        const reduction = enemy.abilityState?.poisonWeakened
          ? Math.max(0, ability.weakenReduction || 1)
          : 0;
        const beforeReduction = Math.ceil(roll / 2) + bonus;
        const damage = Math.max(1, beforeReduction - reduction);
        result.enemyDiceRoll = roll;
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
      onCombatStart(ability, { enemy }) {
        EnemyAbilities._rollFateGambleFaces(enemy);
      },

      resolveIntent(ability, { enemy, intent }) {
        const state = EnemyAbilities._rollFateGambleFaces(enemy);
        return {
          ...(intent || { type: 'attack', weight: 1 }),
          fateLuckyFace: state.luckyFace,
          fateUnluckyFaces: [...(state.unluckyFaces || [])],
        };
      },

      beforeEnemyAction(ability, { enemy, result, logs }) {
        if (result.counterDmg <= 0 || !result.counterTarget) return;
        const state = EnemyAbilities._fateGambleState(enemy);
        const luckyFace = state.luckyFace || 1;
        const unluckyFaces = Array.isArray(state.unluckyFaces) && state.unluckyFaces.length > 0
          ? state.unluckyFaces
          : [state.unluckyFace || (luckyFace === 1 ? 2 : 1)];
        const fateRoll = Math.ceil(Math.random() * 6);
        const multiplier = Math.max(1, ability.luckyMultiplier || 1);
        result.fateRoll = fateRoll;
        result.fateLuckyFace = luckyFace;
        result.fateUnluckyFaces = [...unluckyFaces];
        const fateBoardText = `本回合命運盤：幸運 ${luckyFace} / 厄運 ${unluckyFaces.join('、')}。`;

        if (unluckyFaces.includes(fateRoll)) {
          const beforeHp = Math.max(1, enemy.hp || 1);
          enemy.hp = Math.max(1, Math.floor(beforeHp / 2));
          result.enemyAttackFlow = false;
          result.counterDmg = 0;
          result.aoeCounter = 0;
          result.fateSummary = `${fateBoardText}命運骰 ${fateRoll} 命中厄運面，${enemy.name} 剩餘生命減半且本回合不攻擊。`;
          logs.push(`${enemy.name}命運骰 ${fateRoll} 命中厄運面：HP ${beforeHp} → ${enemy.hp}，本回合不攻擊。`);
          return;
        }

        if (fateRoll === luckyFace) {
          const before = result.counterDmg;
          result.counterDmg *= multiplier;
          result.fateSummary = `${fateBoardText}命運骰 ${fateRoll} 命中幸運面，${result.counterTarget.name} 受到 x${multiplier} 傷害。`;
          logs.push(`${enemy.name}命運骰 ${fateRoll} 命中幸運面：傷害 ${before} → ${result.counterDmg}。`);
          return;
        }

        result.fateSummary = `${fateBoardText}命運骰 ${fateRoll} 未命中幸運面或厄運面，擲命守衛普通攻擊。`;
        logs.push(`${enemy.name}命運骰 ${fateRoll} 未命中幸運面或厄運面。`);
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
          CombatStatus.raiseBlock(enemy, block);
          result.enemyAttackFlow = false;
          result.counterDmg = 0;
          result.aoeCounter = 0;
          result.bannerSummary = `${enemy.name} 換成${EnemyAbilities._bannerGuardianStanceName(next)}，並獲得 ${block} 格檔。`;
          logs.push(`${enemy.name}換旗：改為${EnemyAbilities._bannerGuardianStanceName(next)}，格檔 +${block}。`);
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

  _bannerGuardianState(enemy, ability = {}) {
    this._ensureState(enemy);
    if (!enemy.abilityState.bannerGuardian) {
      enemy.abilityState.bannerGuardian = {
        stance: ability.startStance || 'wound',
      };
    }
    return enemy.abilityState.bannerGuardian;
  },

  _bannerGuardianStanceName(stance) {
    return stance === 'damage' ? '戰吼旗' : '創傷旗';
  },
};
