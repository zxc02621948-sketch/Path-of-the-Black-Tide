// Shared combat statuses for any battle unit, ally or enemy.
const CombatStatus = {
  defaultWoundMax: 15,

  maxWounds(unit) {
    return Math.max(0, unit?.woundMax || this.defaultWoundMax);
  },

  getWounds(unit) {
    if (!unit) return 0;
    return Math.max(0, Math.min(this.maxWounds(unit), unit.wounds || 0));
  },

  setWounds(unit, stacks) {
    if (!unit) return 0;
    unit.woundMax = this.maxWounds(unit);
    unit.wounds = Math.max(0, Math.min(unit.woundMax, stacks || 0));
    return unit.wounds;
  },

  addWounds(unit, stacks) {
    if (!unit) return { before: 0, after: 0, added: 0 };
    const before = this.getWounds(unit);
    const after = this.setWounds(unit, before + Math.max(0, stacks || 0));
    return { before, after, added: Math.max(0, after - before) };
  },

  clearBattleWounds(unit) {
    if (!unit) return 0;
    unit.woundMax = this.maxWounds(unit);
    unit.wounds = 0;
    return unit.wounds;
  },

  getBlock(unit) {
    if (!unit) return 0;
    const current = Math.max(0, unit._block || 0);
    const legacyShield = Math.max(0, unit._shield || 0);
    if (legacyShield > current) unit._block = legacyShield;
    if (unit._shield) unit._shield = 0;
    return Math.max(0, unit._block || 0);
  },

  setBlock(unit, value) {
    if (!unit) return 0;
    unit._block = Math.max(0, value || 0);
    if (unit._shield) unit._shield = 0;
    return unit._block;
  },

  raiseBlock(unit, value) {
    if (!unit) return 0;
    const next = Math.max(this.getBlock(unit), Math.max(0, value || 0));
    return this.setBlock(unit, next);
  },

  clearBlock(unit) {
    return this.setBlock(unit, 0);
  },

  consumeBlock(unit, damage) {
    let remainingDamage = Math.max(0, damage || 0);
    const before = this.getBlock(unit);
    const absorbed = Math.min(before, remainingDamage);
    if (absorbed > 0) {
      remainingDamage -= absorbed;
      this.setBlock(unit, before - absorbed);
    }
    return {
      absorbed,
      damage: remainingDamage,
      block: this.getBlock(unit),
    };
  },

  applyWoundTakenBonus(target, amount, logs = null) {
    let damage = Math.max(0, amount || 0);
    if (!target || damage <= 0) return damage;
    const wounds = this.getWounds(target);
    if (wounds <= 0) return damage;
    const bonus = Math.floor(damage * wounds * 0.05);
    if (bonus <= 0) {
      if (logs) logs.push(`${target.name} 傷口 ${wounds} 層：受傷害提高 ${wounds * 5}%，本次未增加整數傷害。`);
      return damage;
    }
    damage += bonus;
    if (logs) logs.push(`${target.name} 傷口 ${wounds} 層：受傷害 +${bonus}，傷害 ${damage}`);
    return damage;
  },

  applyBannerBearerDamageReduction(unit, amount, logs = null) {
    let damage = Math.max(0, amount || 0);
    if (!unit || damage <= 0 || typeof G === 'undefined' || !G.combat) return damage;
    const res = (G.activeResonances || []).find(item =>
      item?.effect?.type === 'dual_banner_formation' && item?.bodyChar?.id === unit.id
    );
    if (!res) return damage;
    const banners = Array.isArray(G.combat.banners)
      ? G.combat.banners.filter(Boolean)
      : (G.combat.banner ? [G.combat.banner] : []);
    const count = banners.filter(banner => banner.ownerId === unit.id).length;
    if (count <= 0) return damage;
    const rate = Math.max(0, res.effect?.bearerDamageReductionPerBanner ?? 0.2);
    const reduction = Math.floor(damage * Math.min(0.95, count * rate));
    if (reduction <= 0) return damage;
    damage = Math.max(0, damage - reduction);
    if (logs) logs.push(`雙旗戰陣：${unit.name} 受旗陣守護，傷害 -${reduction}，剩餘 ${damage}`);
    return damage;
  },

  addRemorse(unit, stacks = 1, opts = {}) {
    if (!unit) return { before: 0, after: 0, added: 0 };
    const maxStacks = Math.max(0, opts.maxStacks ?? 3);
    const before = Math.max(0, unit._wagerDiceMissStacks || 0);
    const after = Math.min(maxStacks, before + Math.max(0, stacks || 0));
    unit._wagerDiceMissStacks = after;
    unit._wagerDicePenaltyRate = opts.rate ?? unit._wagerDicePenaltyRate ?? 0.30;
    return { before, after, added: Math.max(0, after - before) };
  },

  addBacklash(unit, stacks = 1, opts = {}) {
    if (!unit) return { before: 0, after: 0, added: 0 };
    const maxStacks = Math.max(0, opts.maxStacks ?? 3);
    const before = Math.max(0, unit._gamblerBacklashStacks || 0);
    const after = Math.min(maxStacks, before + Math.max(0, stacks || 0));
    unit._gamblerBacklashStacks = after;
    unit._gamblerBacklashRate = opts.rate ?? unit._gamblerBacklashRate ?? 0.20;
    return { before, after, added: Math.max(0, after - before) };
  },

  applyIncomingRiskBonuses(unit, amount, opts = {}) {
    let damage = Math.max(0, amount || 0);
    if (!unit || damage <= 0) return damage;
    const logs = opts.logs || null;
    const damageLabel = opts.damageLabel || '受擊傷害';
    const resultLabel = opts.resultLabel || '傷害';

    if (opts.allowRemorse !== false) {
      const stacks = Math.max(0, unit._wagerDiceMissStacks || 0);
      if (stacks > 0 && damage > 0) {
        const rate = unit._wagerDicePenaltyRate || 0.30;
        const bonus = Math.max(1, Math.ceil(damage * rate * stacks));
        damage += bonus;
        unit._wagerDicePenaltyPendingClear = true;
        if (logs) logs.push(`懊悔：${unit.name} ${stacks} 層，本次${damageLabel} +${bonus}，${resultLabel} ${damage}`);
      }
    }

    if (opts.allowBacklash !== false) {
      const stacks = Math.max(0, unit._gamblerBacklashStacks || 0);
      if (stacks > 0 && damage > 0) {
        const rate = unit._gamblerBacklashRate || 0.20;
        const bonus = Math.max(1, Math.ceil(damage * rate * stacks));
        damage += bonus;
        unit._gamblerBacklashPendingClear = true;
        if (logs) logs.push(`反噬：${unit.name} ${stacks} 層，本次${damageLabel} +${bonus}，${resultLabel} ${damage}`);
      }
    }

    return damage;
  },

  clearPendingIncomingRisks(unit) {
    if (!unit) return [];
    const cleared = [];
    if (unit._wagerDicePenaltyPendingClear) {
      const stacks = Math.max(0, unit._wagerDiceMissStacks || 0);
      unit._wagerDiceMissStacks = 0;
      unit._wagerDicePenaltyPendingClear = false;
      if (stacks > 0) cleared.push({ type: 'remorse', name: '懊悔', stacks });
    }
    if (unit._gamblerBacklashPendingClear) {
      const stacks = Math.max(0, unit._gamblerBacklashStacks || 0);
      unit._gamblerBacklashStacks = 0;
      unit._gamblerBacklashPendingClear = false;
      if (stacks > 0) cleared.push({ type: 'backlash', name: '反噬', stacks });
    }
    return cleared;
  },

  clearIncomingRiskState(unit) {
    if (!unit) return;
    unit._wagerDiceMissStacks = 0;
    unit._wagerDicePenaltyRate = 0;
    unit._wagerDicePenaltyPendingClear = false;
    unit._gamblerBacklashStacks = 0;
    unit._gamblerBacklashRate = 0;
    unit._gamblerBacklashPendingClear = false;
  },

  nativeWeaknesses(unit, source = 'gaze') {
    if (!unit) return [];
    if (source === 'gaze') {
      if (!Array.isArray(unit.gazeWeaknesses)) unit.gazeWeaknesses = [];
      unit.gazeWeaknesses = this._validFaces(unit.gazeWeaknesses);
      return unit.gazeWeaknesses;
    }
    if (source === 'enemy') {
      const disabled = this.disabledNativeWeaknesses(unit);
      const result = [];
      const add = value => {
        const face = Number(value);
        if (face >= 1 && face <= 6 && !disabled.includes(face) && !result.includes(face)) result.push(face);
      };
      add(unit.weakness);
      for (const face of this.nativeWeaknesses(unit, 'extra')) add(face);
      if (unit.eagleNativeWeakness?.value) add(unit.eagleNativeWeakness.value);
      return result.sort((a, b) => a - b);
    }
    if (source === 'used') {
      return this._validFaces([
        unit.weakness,
        ...this.nativeWeaknesses(unit, 'extra'),
        unit.eagleNativeWeakness?.value || null,
        ...this.disabledNativeWeaknesses(unit),
      ]);
    }
    if (!Array.isArray(unit.extraWeaknesses)) unit.extraWeaknesses = [];
    unit.extraWeaknesses = this._validFaces(unit.extraWeaknesses);
    return unit.extraWeaknesses;
  },

  disabledNativeWeaknesses(unit) {
    if (!unit) return [];
    if (!Array.isArray(unit.disabledNativeWeaknesses)) unit.disabledNativeWeaknesses = [];
    unit.disabledNativeWeaknesses = this._validFaces(unit.disabledNativeWeaknesses);
    return unit.disabledNativeWeaknesses;
  },

  addNativeWeakness(unit, face = null, opts = {}) {
    if (!unit) return null;
    const list = this.nativeWeaknesses(unit, opts.source || 'gaze');
    const available = this._faces().filter(value => !list.includes(value));
    if (available.length <= 0) return null;
    const value = face && available.includes(face)
      ? face
      : available[Math.floor(Math.random() * available.length)];
    list.push(value);
    list.sort((a, b) => a - b);
    return value;
  },

  addExtraNativeWeakness(unit, face, opts = {}) {
    const value = Number(face);
    if (!unit || value < 1 || value > 6) return null;
    const list = this.nativeWeaknesses(unit, 'extra');
    if (!list.includes(value)) list.push(value);
    list.sort((a, b) => a - b);
    if (opts.source) {
      if (!unit.nativeWeaknessSources) unit.nativeWeaknessSources = {};
      unit.nativeWeaknessSources[value] = opts.source;
    }
    return value;
  },

  removeExtraNativeWeakness(unit, face) {
    if (!unit || !face) return false;
    const list = this.nativeWeaknesses(unit, 'extra');
    const before = list.length;
    unit.extraWeaknesses = list.filter(value => value !== face);
    if (unit.nativeWeaknessSources) delete unit.nativeWeaknessSources[face];
    return unit.extraWeaknesses.length !== before;
  },

  setEagleNativeWeakness(unit, data = null) {
    if (!unit) return null;
    if (!data?.value) {
      if (unit.eagleNativeWeakness?.value) this.removeExtraNativeWeakness(unit, unit.eagleNativeWeakness.value);
      unit.eagleNativeWeakness = null;
      return null;
    }
    if (unit.eagleNativeWeakness?.value) this.removeExtraNativeWeakness(unit, unit.eagleNativeWeakness.value);
    const value = Number(data.value);
    if (value < 1 || value > 6) {
      unit.eagleNativeWeakness = null;
      return null;
    }
    unit.eagleNativeWeakness = {
      value,
      expiresRound: data.expiresRound ?? null,
      source: data.source || null,
    };
    this.addExtraNativeWeakness(unit, value, { source: data.source || 'eagle_native' });
    return unit.eagleNativeWeakness;
  },

  nativeWeaknessSource(unit, face) {
    if (!unit || !face) return null;
    if (unit.eagleNativeWeakness?.value === face) return unit.eagleNativeWeakness.source || 'eagle_native';
    if (unit.gamblerNativeWeakness === face) return 'gambler_native';
    return unit.nativeWeaknessSources?.[face] || null;
  },

  shatterNativeWeakness(unit, face) {
    if (!unit || !face) return false;
    let shattered = false;
    if (unit.eagleNativeWeakness?.value === face) {
      this.setEagleNativeWeakness(unit, null);
      shattered = true;
    }
    if (this.removeExtraNativeWeakness(unit, face)) shattered = true;
    const disabled = this.disabledNativeWeaknesses(unit);
    if (face === unit.weakness && !disabled.includes(face)) {
      disabled.push(face);
      disabled.sort((a, b) => a - b);
      shattered = true;
    }
    return shattered;
  },

  consumeNativeWeakness(unit, face, opts = {}) {
    if (!unit || !face) return false;
    const list = this.nativeWeaknesses(unit, opts.source || 'gaze');
    const index = list.indexOf(face);
    if (index < 0) return false;
    list.splice(index, 1);
    return true;
  },

  clearNativeWeaknesses(unit, opts = {}) {
    if (!unit) return 0;
    const list = this.nativeWeaknesses(unit, opts.source || 'gaze');
    const count = list.length;
    list.splice(0, list.length);
    return count;
  },

  applyNativeWeaknessHit(unit, face, damage, opts = {}) {
    const before = Math.max(0, damage || 0);
    const source = opts.source || 'gaze';
    const hit = this.consumeNativeWeakness(unit, face, { source });
    if (!hit) return { hit: false, before, damage: before, bonus: 0 };
    const bonus = Math.max(0, opts.damageBonus ?? 3);
    return {
      hit: true,
      before,
      damage: before + bonus,
      bonus,
    };
  },

  tempWeaknesses(unit, source = null) {
    if (!unit) return [];
    const list = [];
    const add = value => {
      const face = Number(value);
      if (face >= 1 && face <= 6 && !list.includes(face)) list.push(face);
    };
    if (!source || source === 'normal') add(unit.tempWeakness);
    if (!source || source === 'eagle') add(unit.eagleTempWeakness);
    if (!source || source === 'gambler') {
      add(unit.gamblerTempWeakness);
      for (const face of (Array.isArray(unit.gamblerTempWeaknesses) ? unit.gamblerTempWeaknesses : [])) add(face);
    }
    return list.sort((a, b) => a - b);
  },

  setTempWeakness(unit, face, opts = {}) {
    if (!unit) return null;
    const value = Number(face);
    const normalized = value >= 1 && value <= 6 ? value : null;
    const source = opts.source || 'normal';
    if (source === 'eagle') {
      unit.eagleTempWeakness = normalized;
    } else if (source === 'gambler') {
      unit.gamblerTempWeakness = normalized;
      unit.gamblerTempWeaknesses = normalized ? [normalized] : [];
    } else {
      unit.tempWeakness = normalized;
    }
    return normalized;
  },

  setTempWeaknesses(unit, faces, opts = {}) {
    if (!unit) return [];
    const values = this._validFaces(faces);
    const source = opts.source || 'normal';
    if (source === 'gambler') {
      unit.gamblerTempWeaknesses = values;
      unit.gamblerTempWeakness = values[0] || null;
    } else {
      this.setTempWeakness(unit, values[0] || null, opts);
    }
    return values;
  },

  clearTempWeakness(unit, opts = {}) {
    if (!unit) return;
    const source = opts.source || 'normal';
    if (source === 'eagle') {
      unit.eagleTempWeakness = null;
    } else if (source === 'gambler') {
      unit.gamblerTempWeakness = null;
      unit.gamblerTempWeaknesses = [];
    } else {
      unit.tempWeakness = null;
    }
  },

  _faces() {
    return [1, 2, 3, 4, 5, 6];
  },

  _validFaces(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(Number)
      .filter(face => face >= 1 && face <= 6))]
      .sort((a, b) => a - b);
  },
};
