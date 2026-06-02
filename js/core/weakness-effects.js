// Shared native weakness break effects.
const WeaknessEffects = {
  apply({ enemy, squad = [], logs = [], round = 1, prefix = '弱點', nativeWeaknessFace = null } = {}) {
    const effect = enemy?.weaknessEffect || {};
    const result = { effect, stunned: false };
    if (!enemy || !effect.type) return result;

    if (effect.type === 'stun') {
      result.stunned = true;
    }

    if (effect.type === 'block_break') {
      enemy.blockBroken = true;
      enemy.blockBrokenUntilRound = (round || 1) + 1;
      CombatStatus.clearBlock(enemy);
      if (enemy.abilityState?.shellCharge) {
        logs.push(`${prefix}：蓄撞 ${enemy.abilityState.shellCharge} → 0。`);
        enemy.abilityState.shellCharge = 0;
      }
      const executionState = enemy.abilityState?.executionCountdown || null;
      if (executionState && !executionState.executed) {
        const delay = Math.max(0, enemy.abilities?.find(ability => ability?.type === 'execution_countdown')?.delayOnBreak || 1);
        const before = Math.max(0, executionState.remaining || 0);
        executionState.remaining = before + delay;
        logs.push(`${prefix}：處刑倒數 ${before} → ${executionState.remaining}。`);
      }
      logs.push(`${prefix}：敵人格檔暫時破除。`);
    }

    if (effect.type === 'fear') {
      CombatStatus.clearBlock(enemy);
      logs.push(`${prefix}：本次無視格檔。`);
    }

    if (effect.type === 'banner_interrupt') {
      if (!enemy.abilityState) enemy.abilityState = {};
      if (!enemy.abilityState.bannerGuardian) enemy.abilityState.bannerGuardian = { stance: 'wound' };
      enemy.abilityState.bannerGuardian.interrupted = true;
      logs.push(`${prefix}：旗勢被打斷，當前旗面效果暫時失效，直到下一次換旗。`);
    }

    if (effect.type === 'weaken_next_attack') {
      const amount = Math.max(1, effect.amount || 1);
      CombatStatus.clearBlock(enemy);
      if (!enemy.abilityState) enemy.abilityState = {};
      enemy.abilityState.nextAttackReduction = Math.max(enemy.abilityState.nextAttackReduction || 0, amount);
      logs.push(`${prefix}：本次無視格檔，敵人下一次攻擊 -${amount}。`);
    }

    if (effect.type === 'poison_weaken') {
      if (!enemy.abilityState) enemy.abilityState = {};
      enemy.abilityState.poisonWeakened = true;
      logs.push(`${prefix}：毒粉潰散，本場戰鬥毒粉傷害 -1。`);
    }

    if (effect.type === 'expose') {
      enemy.exposed = true;
      enemy.exposedUntilRound = (round || 1) + Math.max(1, effect.duration || 1);
      logs.push(`${prefix}：敵人被揭露。`);
    }

    if (effect.type === 'gear_drop_boost') {
      enemy.gearDropBoost = true;
      logs.push(`${prefix}：箱扣鬆脫，勝利後角色裝備掉落率提高。`);
    }

    if (effect.type === 'suppress_pain_growth') {
      if (!enemy.abilityState) enemy.abilityState = {};
      enemy.abilityState.painGrowthSuppressed = true;
      logs.push(`${prefix}：痛痕滋長被破除，牠不再於每回合開始自然累積傷口。`);
    }

    if (effect.type === 'clear_gaze_weaknesses') {
      for (const char of squad || []) CombatStatus.clearNativeWeaknesses(char, { source: 'gaze' });
      logs.push(`${prefix}：裂隙凝視被打斷，我方全體由裂隙凝視產生的原生弱點清除。`);
    }

    if (effect.type === 'add_fate_unlucky') {
      const fateAbility = Array.isArray(enemy?.abilities)
        ? enemy.abilities.find(ability => ability?.type === 'fate_gamble')
        : null;
      const added = EnemyAbilities._addFateUnluckyFace(enemy, fateAbility || {});
      logs.push(added
        ? `${prefix}：命運偏折，擲命守衛新增厄運面 ${added}。`
        : `${prefix}：命運偏折，但擲命守衛的厄運面已達上限。`);
    }

    if (effect.type === 'clear_dice_pollution') {
      EnemyAbilities.clearOneDicePollutionFromAll(squad, logs);
    }

    if (effect.type === 'final_dawn_break') {
      const state = enemy.abilityState?.finalBoss || null;
      const isEyeWeakness = state?.stance === 'open' && enemy.finalBossEyeWeakness === nativeWeaknessFace;
      if (isEyeWeakness) {
        state.skipNextClosedBlock = true;
        state.skipNextOpenSplash = true;
        logs.push(`${prefix}：短暫破曉，下一次閉眼不獲得格檔，下一次開眼不造成濺射。`);
      } else {
        logs.push(`${prefix}：命中外部原生弱點，但沒有撕開黑夜本體。`);
      }
    }

    return result;
  },
};
