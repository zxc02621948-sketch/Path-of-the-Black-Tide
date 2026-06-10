// character-details methods extracted from js/core/game.js.
const GameCharacterDetails = {
  showRelicDetail(charId, slot) {
    if (G.modal) return;
    const char = G.squad.find(c => c.id === charId);
    const relic = slot === 'fusedRelic' ? char?.fusedRelic : char?.relic;
    if (!char || !relic) return;
    const isFused = slot === 'fusedRelic';
    const desc = typeof relicEffectDesc === 'function' ? relicEffectDesc(relic, isFused) : relic.desc;
    const fusionNote = !isFused && typeof relicFusionDesc === 'function' ? relicFusionDesc(relic) : '';
    this._openModal({
      title: relic.name,
      titleHtml: EquipmentIcon.label(relic, 'equipment-inline-icon relic-detail-icon'),
      desc: [
        desc,
        fusionNote ? `融合後：${fusionNote}` : '',
        relic.locationHint ? `取得線索：${relic.locationHint}` : '',
      ].filter(Boolean).join('\n'),
      choices: [{ label: '關閉', action: () => this._closeModal() }],
    });
  },

  showCharacterDetail(charId) {
    if (G.modal) return;
    const char = G.squad.find(c => c.id === charId);
    if (!char) return;
    const cls = CHARACTER_CLASSES[char.cls];
    const portrait = char.portrait
      ? '<div class="character-detail-portrait"><img src="' + char.portrait + '" alt="' + char.name + '"></div>'
      : '<div class="character-detail-portrait fallback">' + cls.icon + '</div>';
    const weapon = char.weapon ? EquipmentIcon.label(char.weapon, 'equipment-inline-icon weapon-detail-icon') + '：' + char.weapon.desc : '無';
    const gear = char.gear ? EquipmentIcon.label(char.gear, 'equipment-inline-icon gear-detail-icon') + '：' + char.gear.desc : '無';
    const relic = char.relic ? EquipmentIcon.label(char.relic, 'equipment-inline-icon relic-detail-icon') + '：' + this._relicDescText(char.relic, false) : '無';
    const fused = char.fusedRelic ? this._characterFusedRelicText(char.fusedRelic) : '無';
    const sideInfo = this._characterDetailSideInfo(char, cls);
    const resonanceInfo = this._characterResonanceDetailHtml(char);
    const passiveHtml = this._characterPassiveSectionsHtml(cls);
    this._openModal({
      title: char.name + '（' + cls.name + '）',
      characterDetail: true,
      descHtml: '<div class="character-detail-modal"><div class="character-detail-side">' + portrait + sideInfo + '</div><div class="character-detail-info"><div class="character-detail-grid"><div><span>HP</span><b>' + char.hp + '/' + char.maxHp + '</b></div><div><span>攻擊</span><b>' + (char.attack ?? cls.attack ?? 0) + '</b></div><div><span>狀態</span><b>' + (char.dead ? '倒下' : '存活') + '</b></div></div><div class="character-detail-stack">' + resonanceInfo + '<div class="character-detail-block"><strong>職業能力</strong>' + passiveHtml + '</div><div class="character-detail-block"><strong>武器</strong><p>' + weapon + '</p></div><div class="character-detail-block"><strong>裝備</strong><p>' + gear + '</p></div><div class="character-detail-block"><strong>聖物</strong><p>' + relic + '</p><p>' + fused + '</p></div></div></div></div>',
      choices: [{ label: '關閉', action: () => this._closeModal() }],
    });
  },

  _characterPassiveSectionsHtml(cls) {
    const sections = typeof classPassiveSections === 'function' ? classPassiveSections(cls) : [];
    if (!sections.length) {
      return '<p>' + this._escapeHtmlLocal(cls?.passiveDesc || '') + '</p>';
    }
    return '<div class="passive-section-list character-passive-section-list">' + sections.map(section => (
      '<div class="passive-section passive-section-' + this._escapeHtmlLocal(section.type || 'general') + '">' +
        '<span class="passive-section-label">' + this._escapeHtmlLocal(section.label || '職業被動') + '</span>' +
        '<span class="passive-section-text">' + this._escapeHtmlLocal(section.text || '') + '</span>' +
      '</div>'
    )).join('') + '</div>';
  },

  _characterFusedRelicText(relic) {
    if (!relic) return '無';
    return EquipmentIcon.label(relic, 'equipment-inline-icon relic-detail-icon') + '：' + this._relicDescText(relic, true);
  },

  _relicDescText(relic, fused = false) {
    if (typeof relicEffectDesc === 'function') return relicEffectDesc(relic, fused);
    return relic?.desc || '';
  },

  _characterDetailSideInfo(char, cls) {
    const bodyRes = (G.activeResonances || []).filter(res => res.isBody && res.bodyChar?.id === char.id);
    const resText = bodyRes.length ? bodyRes.map(res => res.name).join('、') : '無';
    const weapon = char.weapon?.name || '無';
    const gear = char.gear?.name || '無';
    return '<div class="character-detail-side-info">' +
      '<div><span>定位</span><b>' + cls.name + '</b></div>' +
      '<div><span>共鳴</span><b>' + resText + '</b></div>' +
      '<div><span>武器</span><b>' + weapon + '</b></div>' +
      '<div><span>裝備</span><b>' + gear + '</b></div>' +
    '</div>';
  },

  _characterResonanceDetailHtml(char) {
    const resonances = (G.activeResonances || []).filter(res => res.isBody && res.bodyChar?.id === char.id);
    if (resonances.length === 0) {
      return '<div class="character-detail-block character-detail-resonance"><strong>共鳴</strong><p>目前沒有同身共鳴。</p></div>';
    }
    const rows = resonances.map(res => {
      const source = this._resonanceSourceText(res, char);
      return '<div class="character-detail-resonance-item"><b>' + res.name + '</b><p>' + this._resonanceEffectText(res).replace(/\n/g, '<br>') + '</p>' + (source ? '<small>' + source + '</small>' : '') + '</div>';
    }).join('');
    return '<div class="character-detail-block character-detail-resonance"><strong>共鳴</strong>' + rows + '</div>';
  },

  _resonanceSourceText(res, char) {
    if (res.id === 'dodeca_lucky_dice') return '條件：已融合幸運星 + 賭命骰子。';
    if (res.id === 'dodeca_fate_dice') return '條件：已融合賭命骰子 + 幸運星。';
    if (res.id === 'star_hunter_eye') return '條件：已融合鷹眼羽飾 + 鷹眼透鏡。';
    if (res.id === 'star_breaker_eye') return '條件：已融合鷹眼透鏡 + 鷹眼羽飾。';
    if (res.id === 'dual_banner_formation') return '條件：戰爭旗 + 鷹眼旗，且其中一面已融合。';
    if (res.id === 'greatsword_resonance') return '條件：已融合沉鐵劍鞘 + 銀蜂針。';
    if (res.id === 'rapier_resonance') return '條件：已融合銀蜂針 + 沉鐵劍鞘。';
    const relics = (res.relics || []).map(id => getRelicById(id)?.name || id).join(' + ');
    return relics ? '條件：' + relics + '。' : '';
  },

  _resonanceActivatedText(resonances = []) {
    if (!resonances.length) return '';
    return '\n\n聖物共鳴啟動：\n' + resonances
      .map(res => `${res.name}：${this._resonanceEffectText(res)}`)
      .join('\n\n');
  },


};

Object.assign(Game, GameCharacterDetails);
