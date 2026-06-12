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
        try {
          const seen = JSON.parse(localStorage.getItem('bbn_resonances_seen') || '[]');
          if (!seen.includes(res.id)) {
            seen.push(res.id);
            localStorage.setItem('bbn_resonances_seen', JSON.stringify(seen));
          }
        } catch (e) { /* localStorage 不可用時略過 */ }
      }
    }
    if (opts.announceModal && newly.length > 0) {
      this._showResonanceActivatedModal(newly);
    }
    return newly;
  },

  _showResonanceActivatedModal(resonances = [], opts = {}) {
    const escape = value => this._escapeHtmlLocal ? this._escapeHtmlLocal(value) : String(value ?? '');
    const rows = resonances.map(res => {
      const owner = res.bodyChar?.name || '隊伍';
      const theme = this._resonanceAwakenTheme(res);
      const style = [
        `--res-primary:${theme.primary}`,
        `--res-secondary:${theme.secondary}`,
        `--res-shadow:${theme.shadow}`,
      ].join(';');
      return `
        <section class="resonance-awaken-entry resonance-theme-${escape(theme.key)}" style="${style}">
          <div class="resonance-awaken-heading">
            <span class="resonance-awaken-owner">${escape(owner)}：</span>
            <strong>${escape(res.name || '未知共鳴')}</strong>
          </div>
          <p>${escape(this._resonanceEffectText(res)).replace(/\n/g, '<br>')}</p>
        </section>
      `;
    }).join('');
    const lead = resonances.length > 1
      ? '多股聖物氣息同時交疊，隊伍的戰鬥方式被重新改寫。'
      : '聖物彼此回應，沉睡的力量在這一刻成形。';
    const visualRes = resonances.find(res => res?.iconImage) || null;
    const sfxRes = resonances.find(res => res?.activateSfx) || visualRes || resonances[0] || null;
    this._openModal({
      title: resonances.length > 1 ? '聖物共鳴啟動' : `聖物共鳴啟動：${resonances[0]?.name || ''}`,
      descHtml: `
        ${this._resonanceAwakenIconSceneHtml(visualRes)}
        <div class="resonance-awaken-copy compact">
          <p class="resonance-awaken-lead">${escape(lead)}</p>
          <div class="resonance-awaken-list compact">${rows}</div>
        </div>
      `,
      resultFx: 'resonance-awaken',
      resultSfx: sfxRes?.activateSfx || 'swordWoosh',
      resultSfxVolume: Number.isFinite(sfxRes?.activateSfxVolume) ? sfxRes.activateSfxVolume : 0.32,
      resultSfxDelay: 820,
      interactionLockMs: 2000,
      choices: opts.choices || [{ label: '確認', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _resonanceAwakenIconSceneHtml(res) {
    if (!res?.iconImage) return '';
    const escapeAttr = value => this._escapeAttrLocal
      ? this._escapeAttrLocal(value)
      : String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const theme = this._resonanceAwakenTheme(res);
    const style = [
      `--res-primary:${theme.primary}`,
      `--res-secondary:${theme.secondary}`,
      `--res-shadow:${theme.shadow}`,
    ].join(';');
    const src = escapeAttr(res.iconImage);
    const alt = escapeAttr(res.name || '共鳴');
    return `
      <div class="resonance-awaken-scene resonance-awaken-icon-scene resonance-theme-${escapeAttr(theme.key)}" style="${style}">
        <span class="resonance-awaken-charge-sprite"></span>
        <span class="resonance-awaken-charge-aura"></span>
        <span class="resonance-awaken-wave-sprite"></span>
        <span class="resonance-awaken-impact-flash"></span>
        <span class="resonance-awaken-icon-burst resonance-awaken-icon-burst-a"></span>
        <span class="resonance-awaken-icon-burst resonance-awaken-icon-burst-b"></span>
        <span class="resonance-awaken-icon-ghost resonance-awaken-icon-ghost-a"><img src="${src}" alt=""></span>
        <span class="resonance-awaken-icon-ghost resonance-awaken-icon-ghost-b"><img src="${src}" alt=""></span>
        <span class="resonance-awaken-icon-core-img"><img src="${src}" alt="${alt}"></span>
      </div>
    `;
  },

  _resonanceAwakenTheme(res) {
    const themes = {
      pain_resonance: {
        key: 'pain',
        sigil: '傷',
        primary: 'rgba(230, 54, 42, .92)',
        secondary: 'rgba(255, 178, 112, .78)',
        shadow: 'rgba(130, 0, 0, .52)',
      },
      pain_scar_resonance: {
        key: 'scar',
        sigil: '痕',
        primary: 'rgba(190, 40, 86, .9)',
        secondary: 'rgba(255, 134, 174, .76)',
        shadow: 'rgba(92, 0, 38, .52)',
      },
      greatsword_resonance: {
        key: 'iron',
        sigil: '鐵',
        primary: 'rgba(228, 180, 96, .92)',
        secondary: 'rgba(118, 210, 198, .72)',
        shadow: 'rgba(68, 46, 18, .52)',
      },
      rapier_resonance: {
        key: 'bee',
        sigil: '蜂',
        primary: 'rgba(190, 242, 255, .92)',
        secondary: 'rgba(255, 214, 96, .76)',
        shadow: 'rgba(18, 74, 92, .5)',
      },
      dodeca_fate_dice: {
        key: 'fate',
        sigil: '命',
        primary: 'rgba(184, 116, 255, .92)',
        secondary: 'rgba(255, 222, 122, .8)',
        shadow: 'rgba(54, 18, 96, .52)',
      },
      dodeca_lucky_dice: {
        key: 'lucky',
        sigil: '星',
        primary: 'rgba(255, 228, 112, .94)',
        secondary: 'rgba(124, 218, 255, .78)',
        shadow: 'rgba(100, 74, 10, .5)',
      },
      star_hunter_eye: {
        key: 'eye',
        sigil: '眼',
        primary: 'rgba(92, 214, 255, .92)',
        secondary: 'rgba(255, 248, 172, .8)',
        shadow: 'rgba(18, 42, 96, .5)',
      },
      star_breaker_eye: {
        key: 'breaker',
        sigil: '破',
        primary: 'rgba(255, 70, 54, .9)',
        secondary: 'rgba(255, 214, 90, .78)',
        shadow: 'rgba(96, 10, 10, .52)',
      },
    };
    return themes[res?.id] || {
      key: 'default',
      sigil: '共',
      primary: 'rgba(126, 255, 232, .9)',
      secondary: 'rgba(255, 211, 128, .76)',
      shadow: 'rgba(24, 88, 82, .5)',
    };
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
        ].join('\n');
      case 'star_hunter_eye':
        return [
          `${res.bodyChar?.name || '持有者'} 每次使用弓攻擊前，若敵人沒有獵星產生的鷹眼暫時原生弱點，新增 1 個。`,
          '命中該弱點後進入鷹眼鎖定；本回合弓追擊不再需要命中原生弱點也能繼續。',
          '未鎖定時弓追加攻擊傷害 +2；鷹眼鎖定期間改為追擊次數 x5。',
          '若同一回合觸發 2 次以上追加攻擊，最後一次追加攻擊的攻擊骰必定視為 6。',
          '這個強制 6 不會額外觸發原生弱點破除，也不會因此再延伸新的弓追擊。',
        ].join('\n');
      case 'star_breaker_eye':
        return [
          `${res.bodyChar?.name || '持有者'} 使用弓主戰命中任一原生弱點時，破壞這次命中的原生弱點，額外造成 20 點固定傷害。`,
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
          '重劍命中後額外獲得氣勢。',
          '每 5 點氣勢，使重劍傷害 +1。',
          '氣勢 20 以上未打出重劍時，失去一半氣勢。',
        ].join('\n');
                  case 'rapier_resonance':
        return [
          `${res.bodyChar?.name || '\u6301\u6709\u8005'} \u555f\u52d5\u9280\u8702\u528d\u5f8b\u3002`,
          '\u6c89\u9435\u528d\u9798\u4e0d\u518d\u89f8\u767c\u91cd\u528d\uff0c\u6539\u70ba\u5f37\u5316\u523a\u528d\u3002',
          '\u672c\u6b21\u523a\u528d\u6bcf\u6210\u529f\u9023\u64ca 1 \u6b21\uff0c\u5f8c\u7e8c\u9023\u64ca\u50b7\u5bb3\u984d\u5916 +1\uff0c\u6700\u591a +5\u3002',
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
          iconImage: 'assets/relics/dodeca-fate-dice-resonance.png',
          activateSfx: 'resonanceFateD12',
          activateSfxVolume: 0.48,
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
          iconImage: 'assets/relics/dodeca-lucky-dice-resonance.png',
          activateSfx: 'resonanceLuckyD12',
          activateSfxVolume: 0.48,
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
          iconImage: 'assets/relics/star-hunter-eye-resonance.png',
          activateSfx: 'resonanceStarHunterEye',
          activateSfxVolume: 0.48,
          isBody: true,
          bodyChar: char,
          effect: {
            type: 'star_hunter_eye',
            desc: `${char.name} 每次弓攻擊前可補上鷹眼暫時原生弱點；命中該弱點後，本回合弓追擊不再需要命中原生弱點。未鎖定時弓追擊傷害 +2，鎖定期間改為追擊次數 x5；最後一次追擊可穩定為 6。`,
          },
        });
      }
      if (this._hasStarBreakerEye(char)) {
        active.push({
          id: 'star_breaker_eye',
          name: '裂星破滅',
          iconImage: 'assets/relics/star-breaker-eye-resonance.png',
          activateSfx: 'resonanceStarBreakerEye',
          activateSfxVolume: 0.5,
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
          iconImage: 'assets/relics/dual-banner-formation-resonance.png',
          activateSfx: 'resonanceDualBanner',
          activateSfxVolume: 0.48,
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
