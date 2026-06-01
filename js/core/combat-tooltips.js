// Combat status popover methods extracted from combat-flow.js.
const GameCombatTooltips = {
  showCombatEnemyDetail(ev = null) {
    const enemy = G.combat?.enemy;
    if (!enemy) return;
    const existingPopover = document.getElementById('combat-status-popover');
    if (existingPopover?.classList.contains('visible') && existingPopover.dataset.combatPopoverKind === 'enemy-detail') {
      existingPopover.classList.remove('visible');
      existingPopover.dataset.combatPopoverKind = '';
      return;
    }
    const nativeInfo = typeof this._activeEnemyNativeWeaknesses === 'function'
      ? this._activeEnemyNativeWeaknesses(enemy)
      : { main: enemy.weakness || null, extras: [] };
    const nativeText = nativeInfo.main
      ? `${Dice.face(nativeInfo.main)} ${nativeInfo.main}`
      : '無';
    const extrasText = nativeInfo.extras?.length
      ? `\n額外原生弱點：${nativeInfo.extras.map(face => `${Dice.face(face)} ${face}`).join('、')}`
      : '';
    const states = [];
    const wounds = CombatStatus.getWounds(enemy);
    if (wounds > 0) states.push(`傷口 ${wounds}/${CombatStatus.maxWounds(enemy)}`);
    if (enemy.blockBroken) states.push('格檔破除中');
    if (enemy.exposed) states.push('揭露中');
    if (enemy.abilityState?.shellCharge > 0) states.push(`蓄撞 ${enemy.abilityState.shellCharge} 層`);
    if (enemy.abilityState?.poisonWeakened) states.push('毒粉潰散');
    if (enemy.abilityState?.nextAttackReduction > 0) states.push(`下次攻擊 -${enemy.abilityState.nextAttackReduction}`);
    if (enemy.abilityState?.executionCountdown && !enemy.abilityState.executionCountdown.executed) {
      states.push(`處刑倒數 ${enemy.abilityState.executionCountdown.remaining}`);
    }
    const abilityNotes = this._combatEnemyAbilityNotes(enemy);
    const titleText = `${enemy.icon || ''} ${enemy.name}`.trim();
    const descText = [
      enemy.desc || enemy.lore || '',
      abilityNotes.length ? `能力：${abilityNotes.join('\n')}` : '',
      `原生弱點：${nativeText}`,
      enemy.weaknessEffect?.desc ? `破除效果：${enemy.weaknessEffect.desc}` : '',
      extrasText,
      states.length ? `目前狀態：${states.join('、')}` : '',
    ].filter(Boolean).join('\n\n');
    this._showCombatStatusPopover(titleText, descText, ev);
    const popover = document.getElementById('combat-status-popover');
    if (popover) popover.dataset.combatPopoverKind = 'enemy-detail';
    this._advanceCombatTutorial?.('enemy_detail', 'guard_button');
  },

  _combatEnemyAbilityNotes(enemy) {
    const abilities = Array.isArray(enemy?.abilities) ? enemy.abilities : [];
    const hasAbility = type => abilities.some(ability => ability?.type === type);
    const notes = [];
    if (hasAbility('dice_pollution')) {
      notes.push('每次行動都會污染骰面：污染孢子污染隨機隊友，撲擊污染被攻擊目標，污潮污染隨機隊友。污染骰面無法被改骰，擲出時傷害歸零並讓牠回血。');
    }
    if (hasAbility('final_boss')) {
      notes.push('黑夜輪轉：閉眼回合遮蔽核心弱點並獲得格檔；開眼回合顯現 1 個核心原生弱點，攻擊追加半個骰數並濺射其他隊友。破除開眼弱點會讓下一次閉眼失去格檔，下一次開眼不濺射。');
      notes.push('黑暗 15+：開眼攻擊若造成實際 HP 傷害，目標下回合無法主戰。');
    }
    if (hasAbility('execution_countdown')) {
      notes.push('處刑倒數：倒數歸零後，下一次行動會處刑牢中的倖存者。處刑不傷害隊伍，但救援會失敗；命中原生弱點可讓倒數 +1。');
    }
    if (hasAbility('shell_regen')) {
      notes.push('再生硬殼：戰鬥開始與每回合開始時會把格檔補回硬殼值。命中原生弱點可破殼，清除格檔並停止本場戰鬥的硬殼再生。攻擊有格檔的目標時傷害 +2。');
    }
    if (hasAbility('block_thorns')) {
      const thornDamage = Math.max(0, enemy?.thornDamage || abilities.find(ability => ability?.type === 'block_thorns')?.damage || 1);
      notes.push(`格檔反震：牠仍有格檔時，被攻擊會反震攻擊者 ${thornDamage} 傷害。命中原生弱點可暫時破甲，阻止格檔與反震。`);
    }
    if (hasAbility('blood_hunt')) {
      const ability = abilities.find(item => item?.type === 'blood_hunt') || {};
      const threshold = Math.round(Math.max(0, Math.min(1, ability.lowHpThreshold ?? 0.5)) * 100);
      const bonus = Math.max(0, ability.damageBonus || 1);
      notes.push(`血味追獵：攻擊時優先盯上生命比例最低的隊友；目標生命低於 ${threshold}% 時傷害 +${bonus}。命中原生弱點可揭露牠，使追獵暫時失效。`);
    }
    return notes;
  },

  showCombatStatusDetail(charId, statusType, ev = null) {
    if (!G.combat) return;
    const char = G.squad.find(c => c.id === charId);
    if (!char) return;
    const isRemorse = statusType === 'remorse';
    const stacks = isRemorse
      ? (char._wagerDiceMissStacks || 0)
      : (char._gamblerBacklashStacks || 0);
    if (stacks <= 0) return;

    const rate = isRemorse ? 30 : 20;
    const titleText = isRemorse ? '懊悔' : '反噬';
    const sourceText = isRemorse
      ? '賭命骰子押注失敗時累積。'
      : '搏命者攻擊骰為雙數時累積。';
    const descText = `${char.name} 目前 ${stacks} 層，下一次受擊流程受到的傷害提高 ${stacks * rate}%。${sourceText}觸發受擊流程後清除。`;

    let popover = document.getElementById('combat-status-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'combat-status-popover';
      popover.className = 'combat-banner-popover combat-status-popover';
      document.body.appendChild(popover);
    }
    popover.replaceChildren();

    const title = document.createElement('div');
    title.className = 'combat-banner-popover-title';
    title.textContent = `${titleText} ${stacks} 層`;
    const desc = document.createElement('div');
    desc.className = 'combat-banner-popover-desc';
    desc.textContent = descText;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'combat-banner-popover-close';
    close.textContent = '關閉';
    close.addEventListener('click', () => popover.classList.remove('visible'));
    popover.append(title, desc, close);

    popover.dataset.combatPopoverKind = 'status';
    popover.classList.add('visible');
    const target = ev?.currentTarget || null;
    const rect = target?.getBoundingClientRect?.() || null;
    const left = rect ? rect.left : (window.innerWidth / 2 - 130);
    const top = rect ? rect.bottom + 6 : (window.innerHeight / 2 - 70);
    popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - popover.offsetWidth - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(top, window.innerHeight - popover.offsetHeight - 8))}px`;

    if (!this._combatStatusOutsideHandler) {
      this._combatStatusOutsideHandler = event => {
        const panel = document.getElementById('combat-status-popover');
        if (!panel?.classList.contains('visible')) return;
        if (event.target.closest?.('#combat-status-popover, .combat-status-badge, .combat-wound-badge, .combat-native-weakness-badge, .combat-temp-weakness-badge, .combat-block-badge, .combat-enemy-detail-button')) return;
        panel.classList.remove('visible');
      };
      document.addEventListener('click', this._combatStatusOutsideHandler);
    }
  },

  showCombatAllyWoundDetail(charId, ev = null) {
    const char = G.squad.find(c => c.id === charId);
    if (!char) return;
    const wounds = CombatStatus.getWounds(char);
    if (wounds <= 0) return;
    const max = CombatStatus.maxWounds(char);
    const bonus = wounds * 5;
    const titleText = `傷口 ${wounds} 層`;
    const descText = `${char.name} 目前有 ${wounds} / ${max} 層傷口，受到的傷害增加 ${bonus}%。每 1 層傷口會讓受到的傷害 +5%，傷口會在戰鬥結束後清除。`;
    this._showCombatStatusPopover(titleText, descText, ev);
  },

  showCombatAllyBlockDetail(charId, ev = null) {
    const char = G.squad.find(c => c.id === charId);
    if (!char) return;
    const block = CombatStatus.getBlock(char);
    if (block <= 0) return;
    const titleText = `格檔 ${block}`;
    const descText = `${char.name} 目前有 ${block} 點格檔。受到傷害時，格檔會先吸收傷害，吸收後降低或清除。`;
    this._showCombatStatusPopover(titleText, descText, ev);
  },

  _showCombatStatusPopover(titleText, descText, ev = null) {
    let popover = document.getElementById('combat-status-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'combat-status-popover';
      popover.className = 'combat-banner-popover combat-status-popover';
      document.body.appendChild(popover);
    }
    popover.replaceChildren();

    const title = document.createElement('div');
    title.className = 'combat-banner-popover-title';
    title.textContent = titleText;
    const desc = document.createElement('div');
    desc.className = 'combat-banner-popover-desc';
    desc.textContent = descText;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'combat-banner-popover-close';
    close.textContent = '關閉';
    close.addEventListener('click', () => popover.classList.remove('visible'));
    popover.append(title, desc, close);

    popover.dataset.combatPopoverKind = 'status';
    popover.classList.add('visible');
    const target = ev?.currentTarget || null;
    const rect = target?.getBoundingClientRect?.() || null;
    const left = rect ? rect.left : (window.innerWidth / 2 - 130);
    const top = rect ? rect.bottom + 6 : (window.innerHeight / 2 - 70);
    popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - popover.offsetWidth - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(top, window.innerHeight - popover.offsetHeight - 8))}px`;

    if (!this._combatStatusOutsideHandler) {
      this._combatStatusOutsideHandler = event => {
        const panel = document.getElementById('combat-status-popover');
        if (!panel?.classList.contains('visible')) return;
        if (event.target.closest?.('#combat-status-popover, .combat-status-badge, .combat-wound-badge, .combat-native-weakness-badge, .combat-temp-weakness-badge, .combat-block-badge, .combat-enemy-detail-button')) return;
        panel.classList.remove('visible');
      };
      document.addEventListener('click', this._combatStatusOutsideHandler);
    }
  },

  showCombatWoundDetail(ev = null) {
    const enemy = G.combat?.enemy;
    if (!enemy) return;
    const wounds = Math.max(0, enemy.wounds || 0);
    if (wounds <= 0) return;
    const max = enemy.woundMax || 15;
    const bonus = wounds * 5;
    const descText = `${enemy.name} 目前 ${wounds} / ${max} 層傷口，通常受到傷害提高 ${bonus}%。每 1 層傷口提供 +5% 受傷害；痛痕共鳴・爆發的持有者攻擊時會忽略這個增傷，改以快速累積並引爆傷口。`;

    let popover = document.getElementById('combat-status-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'combat-status-popover';
      popover.className = 'combat-banner-popover combat-status-popover';
      document.body.appendChild(popover);
    }
    popover.replaceChildren();

    const title = document.createElement('div');
    title.className = 'combat-banner-popover-title';
    title.textContent = `傷口 ${wounds} 層`;
    const desc = document.createElement('div');
    desc.className = 'combat-banner-popover-desc';
    desc.textContent = descText;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'combat-banner-popover-close';
    close.textContent = '關閉';
    close.addEventListener('click', () => popover.classList.remove('visible'));
    popover.append(title, desc, close);

    popover.dataset.combatPopoverKind = 'status';
    popover.classList.add('visible');
    const target = ev?.currentTarget || null;
    const rect = target?.getBoundingClientRect?.() || null;
    const left = rect ? rect.left : (window.innerWidth / 2 - 130);
    const top = rect ? rect.bottom + 6 : (window.innerHeight / 2 - 70);
    popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - popover.offsetWidth - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(top, window.innerHeight - popover.offsetHeight - 8))}px`;

    if (!this._combatStatusOutsideHandler) {
      this._combatStatusOutsideHandler = event => {
        const panel = document.getElementById('combat-status-popover');
        if (!panel?.classList.contains('visible')) return;
        if (event.target.closest?.('#combat-status-popover, .combat-status-badge, .combat-wound-badge, .combat-native-weakness-badge, .combat-temp-weakness-badge, .combat-block-badge, .combat-enemy-detail-button')) return;
        panel.classList.remove('visible');
      };
      document.addEventListener('click', this._combatStatusOutsideHandler);
    }
  },

  showCombatBlockDetail(ev = null) {
    const enemy = G.combat?.enemy;
    if (!enemy) return;
    const block = CombatStatus.getBlock(enemy);
    if (block <= 0) return;
    const titleText = `格檔 ${block}`;
    const descText = `${enemy.name} 目前有 ${block} 點格檔。格檔會先吸收受到的傷害；部分原生弱點效果或武器可以破除或無視格檔。`;
    this._showCombatStatusPopover(titleText, descText, ev);
  },

  showCombatBlockIntentDetail(ev = null) {
    const enemy = G.combat?.enemy;
    const intent = G.combat?.intent;
    if (!enemy || !intent) return;
    const block = enemy.blockBroken ? 0 : Math.max(0, enemy.block || 0);
    if (block <= 0) return;
    const titleText = `格檔意圖 +${block}`;
    const descText = `${enemy.name} 下一次行動後會獲得 ${block} 點格檔。這些格檔會保留到下一輪，先吸收我方造成的傷害。`;
    this._showCombatStatusPopover(titleText, descText, ev);
  },

  showCombatIntentDetail(ev = null) {
    const enemy = G.combat?.enemy;
    const intent = G.combat?.intent;
    if (!enemy || !intent || typeof this._combatIntentView !== 'function') return;
    const view = this._combatIntentView(intent, enemy);
    if (!view) return;
    const titleText = '敵人意圖';
    const descText = view.title || this._combatIntentLabel?.(intent, enemy) || '敵人準備行動。';
    this._showCombatStatusPopover(titleText, descText, ev);
  },

  showCombatNativeWeaknessDetail(value, kind = 'main', ev = null) {
    const enemy = G.combat?.enemy;
    if (!enemy || !value) return;
    const source = kind === 'extra' ? this._combatNativeWeaknessSource(enemy, value) : '';
    const label = kind === 'extra' ? this._combatNativeWeaknessLabel(source) : '原生弱點';
    const effect = enemy.weaknessEffect?.desc || '命中時會觸發此敵人的原生弱點效果。';
    const sourceText = this._combatNativeWeaknessSourceText(source);
    const descText = `${enemy.name} 的${label}為 ${value}。角色攻擊骰命中此骰面時，視為命中原生弱點，通常傷害 +3，並觸發此敵人的原生弱點效果：${effect}${sourceText ? `\n\n${sourceText}` : ''}`;

    let popover = document.getElementById('combat-status-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'combat-status-popover';
      popover.className = 'combat-banner-popover combat-status-popover';
      document.body.appendChild(popover);
    }
    popover.replaceChildren();

    const title = document.createElement('div');
    title.className = 'combat-banner-popover-title';
    title.textContent = `${label} ${value}`;
    const desc = document.createElement('div');
    desc.className = 'combat-banner-popover-desc';
    desc.textContent = descText;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'combat-banner-popover-close';
    close.textContent = '關閉';
    close.addEventListener('click', () => popover.classList.remove('visible'));
    popover.append(title, desc, close);

    popover.dataset.combatPopoverKind = 'status';
    popover.classList.add('visible');
    const target = ev?.currentTarget || null;
    const rect = target?.getBoundingClientRect?.() || null;
    const left = rect ? rect.left : (window.innerWidth / 2 - 130);
    const top = rect ? rect.bottom + 6 : (window.innerHeight / 2 - 70);
    popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - popover.offsetWidth - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(top, window.innerHeight - popover.offsetHeight - 8))}px`;

    if (!this._combatStatusOutsideHandler) {
      this._combatStatusOutsideHandler = event => {
        const panel = document.getElementById('combat-status-popover');
        if (!panel?.classList.contains('visible')) return;
        if (event.target.closest?.('#combat-status-popover, .combat-status-badge, .combat-wound-badge, .combat-native-weakness-badge, .combat-temp-weakness-badge, .combat-block-badge, .combat-enemy-detail-button')) return;
        panel.classList.remove('visible');
      };
      document.addEventListener('click', this._combatStatusOutsideHandler);
    }
  },

  _combatNativeWeaknessSource(enemy, value) {
    if (enemy?.eagleNativeWeakness?.value === value) return enemy.eagleNativeWeakness.source || 'eagle_native';
    if (enemy?.gamblerNativeWeakness === value) return 'gambler_native';
    return enemy?.nativeWeaknessSources?.[value] || '';
  },

  _combatNativeWeaknessLabel(source) {
    const labels = {
      star_hunter_eye: '獵星原生弱點',
      eagle_native: '鷹眼原生弱點',
      flaw_lens: '透鏡原生弱點',
      gambler_native: '搏命原生弱點',
      restored_native: '再生原生弱點',
    };
    return labels[source] || '原生弱點+';
  },

  _combatNativeWeaknessSourceText(source) {
    const texts = {
      star_hunter_eye: '來源：獵星之眼。命中後會移除目前這個弱點，並嘗試改寫為另一個鷹眼暫時原生弱點。',
      eagle_native: '來源：鷹眼旗。這是暫時原生弱點，會依旗面效果持續或到期消失。',
      flaw_lens: '來源：鷹眼透鏡。這是本場戰鬥新增的額外原生弱點，不會因命中自動刷新。',
      gambler_native: '來源：十二面命運骰。搏命者符合條件時會刷新這個額外原生弱點。',
      restored_native: '來源：裂星破滅的弱點再生。當敵人沒有可用原生弱點時重新浮現。',
    };
    return texts[source] || '';
  },

  showCombatTempWeaknessDetail(value, kind = 'normal', ev = null) {
    const enemy = G.combat?.enemy;
    if (!enemy || !value) return;
    const labelMap = {
      normal: '破綻',
      eagle: '鷹眼破綻',
      gambler: '搏命破綻',
    };
    const label = labelMap[kind] || '破綻';
    const sourceMap = {
      normal: '通常由望遠鏡或其他效果暫時暴露。',
      eagle: '來源：鷹眼旗。鷹眼旗產生的破綻同時只能存在 1 個，重新產生時會覆蓋原本的鷹眼弱點。',
      gambler: '來源：搏命者或十二面幸運骰。單數攻擊會刷新這組搏命破綻；十二面幸運骰在 7、9、11 等高單數時可刷新多個。',
    };
    const descText = `${enemy.name} 目前有 ${label} ${value}。角色攻擊骰命中此骰面時，視為命中破綻，本次傷害 +1。${sourceMap[kind] || ''}`;

    let popover = document.getElementById('combat-status-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'combat-status-popover';
      popover.className = 'combat-banner-popover combat-status-popover';
      document.body.appendChild(popover);
    }
    popover.replaceChildren();

    const title = document.createElement('div');
    title.className = 'combat-banner-popover-title';
    title.textContent = `${label} ${value}`;
    const desc = document.createElement('div');
    desc.className = 'combat-banner-popover-desc';
    desc.textContent = descText;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'combat-banner-popover-close';
    close.textContent = '關閉';
    close.addEventListener('click', () => popover.classList.remove('visible'));
    popover.append(title, desc, close);

    popover.dataset.combatPopoverKind = 'status';
    popover.classList.add('visible');
    const target = ev?.currentTarget || null;
    const rect = target?.getBoundingClientRect?.() || null;
    const left = rect ? rect.left : (window.innerWidth / 2 - 130);
    const top = rect ? rect.bottom + 6 : (window.innerHeight / 2 - 70);
    popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - popover.offsetWidth - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(top, window.innerHeight - popover.offsetHeight - 8))}px`;

    if (!this._combatStatusOutsideHandler) {
      this._combatStatusOutsideHandler = event => {
        const panel = document.getElementById('combat-status-popover');
        if (!panel?.classList.contains('visible')) return;
        if (event.target.closest?.('#combat-status-popover, .combat-status-badge, .combat-wound-badge, .combat-native-weakness-badge, .combat-temp-weakness-badge, .combat-block-badge, .combat-enemy-detail-button')) return;
        panel.classList.remove('visible');
      };
      document.addEventListener('click', this._combatStatusOutsideHandler);
    }
  },

};

Object.assign(Game, GameCombatTooltips);
