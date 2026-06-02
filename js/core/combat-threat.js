// Enemy intent targeting and combat threat helpers extracted from combat-flow.js.
const GameCombatThreat = {
  _resolveCombatIntent(enemy) {
    const base = typeof resolveIntent === 'function'
      ? resolveIntent(enemy)
      : { type: 'attack', weight: 1 };
    const tutorialIntent = this._combatTutorialForcedIntent(enemy);
    const resolved = tutorialIntent || EnemyAbilities.resolveIntent(enemy, G.combat, base) || base;
    const intent = { ...resolved, targetId: null, targetName: null };
    if (['attack', 'block_attack', 'dice_attack'].includes(intent.type)) {
      const target = this._pickEnemyIntentTarget(intent, enemy);
      intent.targetId = target?.id || null;
      intent.targetName = target?.name || null;
    }
    return intent;
  },

  _combatTutorialForcedIntent(enemy) {
    if (!enemy || enemy.id !== 'shadow_worm') return null;
    if (!G.combatTutorial?.active || G.combatTutorial.completed) return null;
    return { type: 'attack', weight: 1, tutorialForced: true };
  },

  _pickEnemyIntentTarget(intent = null, enemy = null) {
    const alive = this._aliveSquad();
    if (alive.length === 0) return null;
    if (alive.length === 1) return alive[0];
    if (intent?.preferLowestHp) {
      return [...alive].sort((a, b) => {
        const aRatio = (a.hp || 0) / Math.max(1, a.maxHp || a.hp || 1);
        const bRatio = (b.hp || 0) / Math.max(1, b.maxHp || b.hp || 1);
        return aRatio - bRatio;
      })[0] || alive[0];
    }

    const threatMap = G.combat?.threat || {};
    const weighted = [];
    const totalThreat = alive.reduce((sum, char) => sum + Math.max(0, threatMap[char.id] || 0), 0);
    if (totalThreat <= 0) {
      const weight = 1 / alive.length;
      for (const char of alive) weighted.push({ char, weight });
    } else {
      const weights = alive.map(char => ({ char, weight: 3 + Math.max(0, threatMap[char.id] || 0) }));
      const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
      for (const entry of weights) weighted.push({ char: entry.char, weight: entry.weight / total });
    }

    let roll = Math.random();
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.char;
    }
    return weighted[weighted.length - 1]?.char || alive[0];
  },

  _addCombatThreat(attacker, combatResult = null, isFollowUp = false) {
    if (!G.combat || !attacker) return;
    if (!G.combat.threat) G.combat.threat = {};
    const current = G.combat.threat[attacker.id] || 0;
    let gain = isFollowUp ? 1 : 2;
    const damage = combatResult?.damage || 0;
    if (damage >= 10) gain += Math.floor((damage - 10) / 5) + 1;
    G.combat.threat[attacker.id] = Math.min(10, current + gain);
  },

  _halveCombatThreat(charId) {
    if (!G.combat?.threat || !charId) return;
    G.combat.threat[charId] = Math.floor((G.combat.threat[charId] || 0) / 2);
  },

  _combatIntentLabel(intent, enemy) {
    if (!intent) return '';
    if (intent.type === 'pollute') return `${intent.name || '污染孢子'}：污染 1 名隊友骰面`;
    if (intent.type === 'self_wound') return `${intent.name || '撕裂自身'}　傷口 +${intent.amount || 0}`;
    if (intent.type === 'banner_switch') {
      const next = intent.toStance === 'damage' ? '戰吼旗' : '創傷旗';
      return `🚩 換旗　切換為${next}，格檔 +${enemy?.block || 0}`;
    }
    const base = this._combatIntentDamageLabel(intent, enemy) || intentLabel(intent, enemy);
    const fateText = this._combatIntentFateText(intent, enemy);
    const label = fateText ? `${base}${fateText}` : base;
    if (!['attack', 'block_attack', 'dice_attack'].includes(intent.type)) return base;
    if (intent.targetName) return `${label} → ${intent.targetName}`;
    return `${label} → 隊伍成員`;
  },

  _combatIntentFateText(intent, enemy) {
    const ability = Array.isArray(enemy?.abilities)
      ? enemy.abilities.find(item => item?.type === 'fate_gamble')
      : null;
    if (!ability || intent?.type !== 'attack') return '';
    const state = enemy?.abilityState?.fateGamble || {};
    const luckyFaces = [...new Set([
      ...(Array.isArray(intent?.fateLuckyFaces) ? intent.fateLuckyFaces : []),
      ...(intent?.fateLuckyFace ? [intent.fateLuckyFace] : []),
      ...(Array.isArray(state.luckyFaces) ? state.luckyFaces : []),
      ...(state.luckyFace ? [state.luckyFace] : []),
    ])].filter(face => face >= 1 && face <= 6).sort((a, b) => a - b);
    const unluckyFaces = [...new Set([
      ...(Array.isArray(intent?.fateUnluckyFaces) ? intent.fateUnluckyFaces : []),
      ...(Array.isArray(state.unluckyFaces) ? state.unluckyFaces : []),
    ])].filter(face => face >= 1 && face <= 6).sort((a, b) => a - b);
    if (luckyFaces.length <= 0 || unluckyFaces.length <= 0) return '';
    return `（幸運 ${luckyFaces.join('、')} / 厄運 ${unluckyFaces.join('、')}）`;
  },

  _combatIntentDamageLabel(intent, enemy) {
    const painBonus = this._enemyPainGrowthAttackBonus(enemy);
    const bannerInfo = this._enemyBannerGuardianIntentInfo(enemy, intent);
    const bannerDamageBonus = bannerInfo.damageBonus || 0;
    if (painBonus <= 0 && bannerDamageBonus <= 0 && !bannerInfo.woundText) return null;

    const atk = enemy?.attack || 0;
    const blk = enemy?.block || 0;
    const totalBonus = painBonus + bannerDamageBonus;
    const weakDamageDie = ['weak', 'medium'].includes(enemy?.tier);
    const attackText = weakDamageDie ? `${atk + totalBonus}+骰（三面骰）` : `${atk + totalBonus}`;
    const diceText = weakDamageDie
      ? `${atk + totalBonus > 0 ? `${atk + totalBonus}+` : ''}骰（三面骰）`
      : `1d6 +${totalBonus}`;
    const bonusParts = [];
    if (painBonus > 0) bonusParts.push(`痛痕 +${painBonus}`);
    if (bannerDamageBonus > 0) bonusParts.push(`戰吼旗 +${bannerDamageBonus}`);
    if (bannerInfo.woundText) bonusParts.push(bannerInfo.woundText);
    const bonusText = bonusParts.length > 0 ? `（${bonusParts.join('，')}）` : '';
    switch (intent?.type) {
      case 'attack':
        return `⚔️ 攻擊主戰者　${attackText} 傷${bonusText}`;
      case 'block_attack':
        return `🛡️⚔️ 格檔 +${blk}，攻擊主戰者 ${attackText} 傷${bonusText}`;
      case 'aoe':
        return `🌊 全體攻擊　各 ${Math.max(1, atk - 2) + totalBonus} 傷${bonusText}`;
      case 'dice_attack':
        return `🎲 擲骰攻擊　${diceText} 傷${bonusText}`;
      default:
        return null;
    }
  },

  _enemyBannerGuardianIntentInfo(enemy, intent) {
    const ability = Array.isArray(enemy?.abilities)
      ? enemy.abilities.find(item => item?.type === 'banner_guardian')
      : null;
    if (!ability || !['attack', 'block_attack', 'dice_attack', 'aoe'].includes(intent?.type)) {
      return { damageBonus: 0, woundText: '' };
    }
    const stance = intent?.bannerStance || enemy?.abilityState?.bannerGuardian?.stance || ability.startStance || 'wound';
    if (enemy?.abilityState?.bannerGuardian?.interrupted) {
      return { damageBonus: 0, woundText: '旗面中斷' };
    }
    if (stance === 'damage') return { damageBonus: Math.max(0, ability.damageBonus || 0), woundText: '' };
    const stacks = Math.max(0, ability.woundStacks || 0);
    return { damageBonus: 0, woundText: stacks > 0 ? `創傷旗：全隊傷口 +${stacks}` : '' };
  },

  _enemyPainGrowthAttackBonus(enemy) {
    const ability = Array.isArray(enemy?.abilities)
      ? enemy.abilities.find(item => item?.type === 'pain_growth')
      : null;
    if (!ability) return 0;
    const per = Math.max(1, ability.attackBonusPerWounds || 0);
    return Math.floor(Math.max(0, enemy.wounds || 0) / per);
  },
};

Object.assign(Game, GameCombatThreat);
