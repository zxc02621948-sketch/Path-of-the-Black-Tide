// Dice and roll modifier methods extracted from js/core/game.js.
const GameDiceFlow = {
  _rollWithMods(diceType, char, opts = {}) {
    const base = (this._hasDodecaFateDice(char, diceType) || this._hasDodecaLuckyDice(char, diceType))
      ? this._rollDodecaCombat(char)
      : Dice.roll(diceType, char);
    base.naturalRaw = base.raw;
    let value = base.value;
    const pollutedFace = diceType === 'combat' && typeof EnemyAbilities !== 'undefined'
      ? EnemyAbilities.pollutedRollFace?.(char, base.raw, base.value, base.sides || 6)
      : null;
    const pollutionLocked = !!pollutedFace;
    if (pollutionLocked) {
      return {
        ...base,
        value: pollutedFace,
        floored: false,
        pollutionLocked: true,
        pollutedFaceHit: true,
        pollutedFace,
        charId: char?.id || null,
        charCls: char?.cls || null,
      };
    }

    if (G.rollMods.length > 0) {
      const mod = G.rollMods.shift();
      if (mod.type === 'reroll_keep_high') {
        const second = Dice.roll(diceType, char);
        this._log(`\u64f2\u9ab0\u4fee\u6b63\u81ea\u52d5\u91cd\u64f2 ${Dice.face(second.value)}\uff08${second.value}\uff09\uff0c\u4fdd\u7559\u8f03\u9ad8\u7d50\u679c\u3002`, 'reward');
        value = Math.max(value, second.value);
      } else if (mod.type === 'floor_one' && value === 1) {
        value = mod.value;
        this._log(`\u64f2\u9ab0\u4fdd\u5e95\uff1a1 \u8996\u70ba ${mod.value}\u3002`, 'reward');
      }
    }

    const result = { ...base, value, charId: char?.id || null, charCls: char?.cls || null };
    if (diceType === 'combat') this._applyBoneDiceBagCombatRoll(char, result);
    if (diceType === 'combat') this._applyLuckyStarCombatRoll(char, result);
    if (diceType === 'explore') {
      const successMin = opts.successMin || 3;
      this._applyExorcismRingExploreRoll(result, successMin);
      this._applyGamblerExploreReroll(result, char, successMin);
    }
    return result;
  },

  _applyBoneDiceBagCombatRoll(char, rollResult) {
    const effect = char?.gear?.effect;
    if (effect?.type !== 'low_roll_flip') return rollResult;
    const uses = char._boneDiceBagUses || 0;
    const limit = effect.usesPerCombat || 2;
    const map = effect.map || {};
    const nextValue = map[rollResult.value];
    if (uses >= limit || !nextValue) return rollResult;

    const original = rollResult.value;
    char._boneDiceBagUses = uses + 1;
    rollResult.boneDiceBagAdjusted = { from: original, to: nextValue };
    rollResult.boneDiceBagSuppressScholarBacklash = char.cls === 'scholar' && nextValue % 2 === 0;
    rollResult.raw = nextValue;
    rollResult.value = nextValue;
    rollResult.floored = true;
    return rollResult;
  },

  _hasDodecaFateDice(char, diceType = 'combat') {
    return diceType === 'combat' &&
      char?.fusedRelic?.id === 'wager_dice' &&
      char?.relic?.id === 'lucky_star';
  },

  _hasDodecaLuckyDice(char, diceType = 'combat') {
    return diceType === 'combat' &&
      char?.fusedRelic?.id === 'lucky_star' &&
      char?.relic?.id === 'wager_dice';
  },

  _rollDodecaCombat(char) {
    const raw = Dice.rollRawSides(12);
    const floor = CONFIG.FLOOR_BONUS[char.cls]?.combat || 1;
    const value = Math.max(raw, floor);
    return {
      raw,
      naturalRaw: raw,
      value,
      floored: value > raw,
      sides: 12,
      dodecaFateDice: this._hasDodecaFateDice(char),
      dodecaLuckyDice: this._hasDodecaLuckyDice(char),
    };
  },

  _applyLuckyStarCombatRoll(char, rollResult) {
    const relic = this._teamLuckyStarRelic();
    if (relic?.effect?.type !== 'lucky_star') return rollResult;

    const limit = relic.effect.lowRollToSixUses || 1;
    if (!G.combat) return rollResult;
    G.combat.luckyStarUses = G.combat.luckyStarUses || 0;
    if (G.combat.luckyStarUses < limit && rollResult.value < 3) {
      G.combat.luckyStarUses++;
      rollResult.luckyStarForced = true;
      rollResult.value = 6;
      rollResult.floored = true;
      this._log('幸運星：本場戰鬥的低骰自動改為 6。', 'reward');
    }

    const raiseLimit = relic.effect.sixToTwelveUses || 0;
    const canRaiseToTwelve = raiseLimit > 0 && (rollResult.sides || 6) >= 12 && rollResult.value === 6;
    if (canRaiseToTwelve) {
      G.combat.luckyStarSixToTwelveUses = G.combat.luckyStarSixToTwelveUses || 0;
      if (G.combat.luckyStarSixToTwelveUses < raiseLimit) {
        G.combat.luckyStarSixToTwelveUses++;
        const chance = relic.effect.sixToTwelveChance ?? 0.5;
        if (Math.random() < chance) {
          rollResult.luckyStarRaisedToTwelve = true;
          rollResult.value = 12;
          rollResult.floored = true;
          this._log('幸運星融合：12 面骰擲出 6，自動改為 12。', 'reward');
        }
      }
    }
    return rollResult;
  },

  _teamLuckyStarRelic() {
    const fused = this._aliveSquad().find(char => char.fusedRelic?.id === 'lucky_star')?.fusedRelic;
    if (fused) return fused;
    return this._aliveSquad().find(char => char.relic?.id === 'lucky_star')?.relic || null;
  },

  _applyExorcismRingExploreRoll(rollResult, successMin = 3) {
    const holder = this._exorcismRingHolder();
    if (!holder || holder._exorcismRingUsed) return rollResult;

    const effect = holder.fusedRelic?.id === 'exorcism_ring'
      ? holder.fusedRelic.effect
      : holder.relic?.effect;
    if (effect?.type !== 'exorcism_ring') return rollResult;

    if (effect.guaranteedSuccess) {
      holder._exorcismRingUsed = true;
      if (rollResult.value < successMin) {
        rollResult.value = successMin;
        rollResult.floored = true;
      }
      rollResult.exorcismRing = 'success';
      this._log(`${holder.name} 的驅邪戒發光，今天第一次探索骰視為成功。`, 'reward');
      return rollResult;
    }

    if (rollResult.value >= successMin) return rollResult;

    holder._exorcismRingUsed = true;
    const second = Dice.roll('explore', holder);
    rollResult.raw = second.raw;
    rollResult.value = second.value;
    rollResult.floored = second.floored;
    rollResult.exorcismRing = 'reroll';
    this._log(`${holder.name} 的驅邪戒觸發，探索失敗自動重擲為 ${Dice.face(second.value)}（${second.value}）。`, 'reward');
    return rollResult;
  },

  _applyGamblerExploreReroll(rollResult, roller, successMin = 3) {
    const threshold = Math.max(1, Number(successMin) || 3);
    if (!rollResult || rollResult.value >= threshold) return rollResult;
    if (rollResult.gamblerExploreReroll || G.gamblerExploreRerollDay === G.day) return rollResult;

    const gambler = this._availableExploreGambler();
    if (!gambler) return rollResult;

    const before = {
      raw: rollResult.raw,
      value: rollResult.value,
      floored: !!rollResult.floored,
    };
    G.gamblerExploreRerollDay = G.day || 1;
    gambler.hp = Math.max(1, Math.max(0, gambler.hp || 0) - 1);

    const second = Dice.roll('explore', roller);
    rollResult.raw = second.raw;
    rollResult.value = second.value;
    rollResult.floored = !!second.floored;
    rollResult.charId = roller?.id || null;
    rollResult.charCls = roller?.cls || null;
    rollResult.gamblerExploreReroll = {
      gamblerId: gambler.id,
      gamblerName: gambler.name,
      hpCost: 1,
      from: before.value,
      fromRaw: before.raw,
      to: second.value,
      toRaw: second.raw,
      successMin: threshold,
    };

    const tone = second.value >= threshold ? 'reward' : 'danger';
    this._log(`${gambler.name} 壞命重擲：以 1 HP 為代價，${Dice.face(before.value)}（${before.value}）→ ${Dice.face(second.value)}（${second.value}）。`, tone);
    return rollResult;
  },

  _availableExploreGambler() {
    return this._aliveSquad().find(char => char.cls === 'scholar' && !char.dead && char.hp > 1) || null;
  },

  _gamblerExploreRerollText(rollResult) {
    const info = rollResult?.gamblerExploreReroll;
    if (!info) return '';
    const name = info.gamblerName || '搏命者';
    const cost = info.hpCost > 0 ? `，${name} -${info.hpCost} HP` : '';
    return `壞命重擲${cost}：${Dice.face(info.from)}（${info.from}）→ ${Dice.face(info.to)}（${info.to}）。`;
  },

  _exorcismRingHolder() {
    return this._aliveSquad().find(char =>
      char.fusedRelic?.id === 'exorcism_ring' || char.relic?.id === 'exorcism_ring'
    ) || null;
  },
  _maybePromptGamblerReroll() {
    return false;
  },

  _getAvailableGambler() {
    return null;
  },

  _gamblerRerollsLeft() {
    return 0;
  },

  _spendGamblerReroll() {
    G.gamblerRerollsLeft = Math.max(0, this._gamblerRerollsLeft() - 1);
    this._syncGamblerRerollDisplay();
  },

  _syncGamblerRerollDisplay() {
    const left = this._gamblerRerollsLeft();
    for (const char of G.squad || []) {
      if (char.cls === 'scholar') char.gamblerRerollsLeft = left;
    }
  },

  // Section.
  // Section.

};

Object.assign(Game, GameDiceFlow);
