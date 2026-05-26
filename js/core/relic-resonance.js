// relic-resonance methods extracted from js/core/game.js.
const GameRelicResonance = {
  _applyRelicEquip(char, relic) {
    RelicRules.applyEquip(G, char, relic);
  },

  _removeRelicEffect(char, relic) {
    RelicRules.removeEquip(G, char, relic);
  },

  _fusionBonusDesc(relic) {
    return RelicRules.fusionBonusDesc(relic);
  },

  _applyFusionBonus(char, relic) {
    RelicRules.applyFusionBonus(G, char, relic);
  },

  _removeFusionBonus(char, relic) {
    RelicRules.removeFusionBonus(G, char, relic);
  },

  // Section.
  getVisionRange() {
    let range = G.phase === 'night' ? CONFIG.NIGHT_VISION_RANGE : CONFIG.DAY_VISION_RANGE;
    range += RelicRules.visionBonus(G, G.phase);

    if (G.phase === 'night') {
      if (G.torchActive > 0) range += 1;
    }

    for (const res of (G.activeResonances || [])) {
      if (res.effect.type === 'extra_vision')      range += res.effect.value;
      if (res.effect.type === 'night_vision_stack' && G.phase === 'night') range += res.effect.value;
    }

    return Math.max(1, range);
  },

  _revealAround(x, y) {
    const range = this.getVisionRange();
    this._revealAroundCustom(x, y, range, { revealAltars: false });
  },

  _revealAroundCustom(x, y, range, opts = {}) {
    const size  = CONFIG.MAP_SIZE;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > range) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          const cell = G.map[ny][nx];
          if (cell.type === 'altar' && cell.altarHidden && !opts.revealAltars) continue;
          if (cell.type === 'altar' && opts.revealAltars) cell.altarHidden = false;
          cell.revealed = true;
        }
      }
    }
  },

  // Section.
  // Section.
  _updateResonances(opts = {}) {
    const prev = G.activeResonanceKeys || new Set();
    G.activeResonances = [
      ...checkResonances(G.squad),
      ...this._specialActiveResonances(),
    ];
    G.activeResonanceKeys = new Set();
    const newly = [];
    // 腐化頭目直接在玩家位置觸發。
    if (!G._altarRollGranted && G.activeResonances.some(r => r.effect.type === 'altar_extra_roll')) {
      G.altarExtraRollAvail = true;
      G._altarRollGranted = true;
    }

    for (const res of G.activeResonances) {
      const key = res.isBody
        ? `${res.id}:body:${res.bodyChar?.id || 'unknown'}`
        : `${res.id}:squad`;
      G.activeResonanceKeys.add(key);
      if (!prev.has(key)) {
        this._log(`聖物共鳴啟動：${res.name}。`, 'reward');
        newly.push(res);
      }
    }
    if (opts.announceModal && newly.length > 0) {
      this._showResonanceActivatedModal(newly);
    }
    return newly;
  },

  _showResonanceActivatedModal(resonances = []) {
    const lines = resonances.map(res => {
      const owner = res.bodyChar?.name ? `${res.bodyChar.name}：` : '';
      return `${owner}${res.name}\n${this._resonanceEffectText(res)}`;
    }).join('\n\n');
    this._openModal({
      title: resonances.length > 1 ? '聖物共鳴啟動' : `聖物共鳴啟動：${resonances[0]?.name || ''}`,
      desc: lines,
      choices: [{ label: '確認', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _resonanceEffectText(res) {
    if (!res) return '共鳴效果已啟動。';
    switch (res.id) {
      case 'dodeca_fate_dice':
        return [
          `${res.bodyChar?.name || '持有者'} 主戰時，攻擊骰改為 1d12。`,
          '搏命者單數攻擊時，刷新 1 個原生弱點；其他職業只有 7、9、11 會刷新。',
          '若使用賭命骰子，押中時額外再加上本次骰面。',
          '命中原生弱點或視為命中原生弱點時，最終傷害 x4。',
          '可以命中原生弱點；若最終骰值等於某個原生弱點 x2，額外觸發共鳴弱點效果。',
          '自然骰出 12 且觸發共鳴弱點時，最終傷害改為 x5。',
        ].join('\n');
      case 'dodeca_lucky_dice':
        return [
          `${res.bodyChar?.name || '持有者'} 主戰時，攻擊骰改為 1d12，且不會命中原生弱點。`,
          '搏命者單數攻擊時刷新搏命破綻，且 7、9、11 會刷新 2 個。',
          '其他職業只有 7、9、11 會刷新 1 個破綻。',
          '若使用賭命骰子，押中時額外再加上本次骰面。',
          '最終骰值等於破綻，或是任一破綻的倍數時，視為命中破綻，傷害 +3。',
          '若最終骰值是任一破綻的倍數，每個符合的破綻額外使傷害 +16。',
          '破綻為 1 時，所有最終骰值都視為它的倍數。',
          '攻擊骰 6 仍觸發幸運星 +2；攻擊骰 12 觸發幸運星融合 +4。',
        ].join('\n');
      case 'star_hunter_eye':
        return [
          `${res.bodyChar?.name || '持有者'} 每次使用弓攻擊前，若敵人沒有獵星產生的鷹眼暫時原生弱點，新增 1 個；命中後改為新的鷹眼暫時原生弱點。`,
          '弓的追加攻擊傷害 +2。',
          '若同一回合觸發 2 次以上追加攻擊，最後一次追加攻擊的攻擊骰必定視為 6。',
          '這個強制 6 不會額外觸發原生弱點破除，也不會因此再延伸新的弓追擊。',
        ].join('\n');
      case 'star_breaker_eye':
        return [
          `${res.bodyChar?.name || '持有者'} 使用弓主戰命中任一原生弱點時，破壞這次命中的原生弱點，額外造成 10 點固定傷害。`,
          '任一原生弱點包含敵人的主要原生弱點、額外原生弱點與暫時原生弱點。',
          '同一回合可以破壞多個原生弱點。',
          '若敵人沒有可破壞的原生弱點，不會造成裂星破滅的固定傷害。',
          '非無弱點敵人每回合開始前會補到 2 個可用原生弱點。',
        ].join('\n');
      case 'dual_banner_formation':
        return [
          `${res.bodyChar?.name || '持有者'} 同時持有戰爭旗與鷹眼旗，且其中一面已融合。`,
          '戰鬥中可同時維持 1 面戰爭旗與 1 面鷹眼旗。',
          '雙旗並立時，戰吼旗固定傷害提高 50%。',
          '場上每有 1 面由持有者展開的旗，持有者受到的傷害降低 20%。',
          '再次舉起同一件旗時，會覆蓋該旗目前的旗面；不同旗可並存。',
        ].join('\n');
      case 'greatsword_resonance':
        return [
          `${res.bodyChar?.name || '持有者'} 融合沉鐵劍鞘並攜帶銀蜂針。`,
          '銀蜂針不再觸發刺劍連擊，改為強化重劍。',
          '重劍命中後額外獲得 5 點氣勢。',
          '每 5 點氣勢，使重劍傷害 +1。',
        ].join('\n');
      case 'rapier_resonance':
        return [
          `${res.bodyChar?.name || '持有者'} 融合銀蜂針並攜帶沉鐵劍鞘。`,
          '沉鐵劍鞘不再觸發重劍，改為強化刺劍。',
          '每回合前 2 次刺劍連擊必定成功，且不降低後續連擊機率。',
          '本次刺劍每成功連擊 1 次，後續連擊傷害 +1。',
        ].join('\n');
      default:
        return res.effect?.desc || '共鳴效果已啟動。';
    }
  },

  _specialActiveResonances() {
    const active = [];
    for (const char of this._aliveSquad()) {
      if (this._hasDodecaFateDice(char)) {
        active.push({
          id: 'dodeca_fate_dice',
          name: '十二面命運骰',
          isBody: true,
          bodyChar: char,
          effect: {
            type: 'dodeca_fate_dice',
            desc: '攻擊骰改為 1d12；若使用賭命骰子，可額外押注 3 個骰面，押中時額外再加上本次骰面；搏命者單數刷新原生弱點，其他職業只有 7、9、11 會刷新；命中原生弱點或視為命中原生弱點時最終傷害 x4；最終骰值等於原生弱點 x2 時額外觸發共鳴弱點；自然 12 觸發時改為 x5。',
          },
        });
      }
      if (this._hasDodecaLuckyDice(char)) {
        active.push({
          id: 'dodeca_lucky_dice',
          name: '十二面幸運骰',
          isBody: true,
          bodyChar: char,
          effect: {
            type: 'dodeca_lucky_dice',
            desc: '攻擊骰改為 1d12且不命中原生弱點；若使用賭命骰子，可額外押注 3 個骰面，押中時額外再加上本次骰面；搏命者單數刷新破綻，7、9、11 刷新 2 個；其他職業只有 7、9、11 會刷新 1 個；最終骰值等於或為破綻倍數時視為命中破綻 +3；每個符合倍數的破綻額外 +16，破綻 1 會使所有骰面符合倍數。',
          },
        });
      }
      if (this._hasStarHunterEye(char)) {
        active.push({
          id: 'star_hunter_eye',
          name: '獵星之眼',
          isBody: true,
          bodyChar: char,
          effect: {
            type: 'star_hunter_eye',
            desc: `${char.name} 每次弓攻擊前可補上鷹眼暫時原生弱點；弓追擊傷害 +2，最後一次追擊可穩定為 6。`,
          },
        });
      }
      if (this._hasStarBreakerEye(char)) {
        active.push({
          id: 'star_breaker_eye',
          name: '裂星破滅',
          isBody: true,
          bodyChar: char,
          effect: {
            type: 'star_breaker_eye',
            desc: `${char.name} 使用弓命中原生弱點時破壞弱點並造成固定爆發。`,
          },
        });
      }
      if (this._hasDualBannerResonance(char)) {
        active.push({
          id: 'dual_banner_formation',
          name: '雙旗戰陣',
          isBody: true,
          bodyChar: char,
          relics: ['war_banner', 'eagle_banner'],
          effect: {
            type: 'dual_banner_formation',
            warcryDamageRate: 0.5,
            bearerDamageReductionPerBanner: 0.2,
            desc: `${char.name} 可同時維持 1 面戰爭旗與 1 面鷹眼旗。雙旗並立時，戰吼旗固定傷害提高 50%；場上每有 1 面由 ${char.name} 展開的旗，${char.name} 受到的傷害降低 20%。`,
          },
        });
      }
    }
    return active;
  },

  // Section.
  _getResonanceEffectValue(type) {
    return G.activeResonances
      .filter(r => r.effect.type === type)
      .reduce((sum, r) => sum + (r.effect.value || 0), 0);
  },

  // Section.
  _getResonanceBodyChar(type) {
    const res = G.activeResonances.find(r => r.effect.type === type && r.isBody);
    return res ? res.bodyChar : null;
  },


};

Object.assign(Game, GameRelicResonance);
