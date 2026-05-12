// Modal and combat scene rendering extracted from js/ui/render.js.
const RenderModal = {
  showModal(cfg) {
    this._hideCombatTip();
    this._hideCombatBannerPopover();
    this._hideCombatStatusPopover();
    if (this._modalTypeTimer) {
      clearInterval(this._modalTypeTimer);
      this._modalTypeTimer = null;
    }
    const modal = document.getElementById('event-modal');
    const contentEl = modal.querySelector('.modal-content');
    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-desc');
    contentEl.classList.toggle('combat-modal', !!cfg.combat);
    contentEl.classList.toggle('narrative-modal', !cfg.combat && (cfg.desc || '').length > 900);
    contentEl.classList.toggle('character-detail-content', !!cfg.characterDetail);
    contentEl.classList.toggle('wager-modal-content', !!cfg.wagerModal);
    titleEl.textContent = cfg.title || '';
    const shouldAnimateDice = !cfg.combat && (
      (cfg.dice && cfg.dice.animate !== false) ||
      (cfg.enemyDice && cfg.enemyDice.animate !== false)
    );
    const hasDeferredResult = shouldAnimateDice && !cfg.descHtml
      && (typeof cfg.resultDesc === 'string' || typeof cfg.resultAppend === 'string');
    if (cfg.descHtml) {
      descEl.innerHTML = cfg.descHtml;
    } else if (hasDeferredResult) {
      descEl.innerHTML = '';
      const introEl = document.createElement('div');
      introEl.className = 'modal-desc-intro';
      introEl.textContent = cfg.preDesc || cfg.desc || '';
      const resultEl = document.createElement('div');
      resultEl.className = 'modal-desc-result';
      resultEl.hidden = true;
      descEl.append(introEl, resultEl);
    } else {
      descEl.textContent = cfg.desc || '';
    }
    if (hasDeferredResult) {
      descEl.dataset.resultDesc = cfg.resultDesc || '';
      descEl.dataset.preDesc = cfg.preDesc || cfg.desc || '';
      if (typeof cfg.resultAppend === 'string') {
        descEl.dataset.resultAppend = cfg.resultAppend;
      } else {
        delete descEl.dataset.resultAppend;
      }
    } else {
      delete descEl.dataset.resultDesc;
      delete descEl.dataset.preDesc;
      delete descEl.dataset.resultAppend;
    }

    const choicesEl = document.getElementById('modal-choices');
    modal.querySelectorAll('.modal-extra').forEach(el => el.remove());
    contentEl.classList.toggle('has-dice', !!cfg.dice);
    if (shouldAnimateDice) {
      choicesEl.style.visibility = 'hidden';
      choicesEl.style.pointerEvents = 'none';
    } else {
      choicesEl.style.visibility = '';
      choicesEl.style.pointerEvents = '';
    }

    const shouldTypeIntro = !cfg.combat && !cfg.descHtml && (cfg.typeText !== false);
    if (shouldTypeIntro) {
      const introTargetEl = hasDeferredResult
        ? descEl.querySelector('.modal-desc-intro')
        : descEl;
      const introText = introTargetEl.textContent;
      introTargetEl.textContent = '';
      if (!shouldAnimateDice) {
        choicesEl.style.visibility = 'hidden';
        choicesEl.style.pointerEvents = 'none';
      }
      this._typeModalText(introTargetEl, introText, () => {
        if (!shouldAnimateDice) {
          choicesEl.style.visibility = '';
          choicesEl.style.pointerEvents = '';
        }
      });
    }

    let combatSceneEl = null;
    if (cfg.combat) {
      const sceneEl = document.createElement('div');
      combatSceneEl = sceneEl;
      sceneEl.className = 'modal-extra combat-scene';
      const combatScene = { ...cfg.combat, playerDice: cfg.dice || null, enemyDice: cfg.enemyDice || null };
      sceneEl.innerHTML = this._combatSceneHtml(combatScene);
      descEl.before(sceneEl);

      // Section.
      const enemyCard = sceneEl.querySelector('.hoverable-enemy');
      if (enemyCard && cfg.combat.enemy) {
        const e = cfg.combat.enemy;
        const nativeInfo = this._activeEnemyNativeWeaknesses(e);
        const nativeText = nativeInfo.main
          ? `${Dice.face(nativeInfo.main)} ${nativeInfo.main}${e.weaknessDesc ? `（${e.weaknessDesc}）` : ''}`
          : '已被裂星破壞';
        const extraText = nativeInfo.extras.length
          ? `<div class="cct-row"><span class="cct-label">原生+</span>${nativeInfo.extras.map(w => `${Dice.face(w)} ${w}`).join('、')}</div>`
          : '';
        let tip = document.getElementById('combat-float-tip');
        if (!tip) { tip = document.createElement('div'); tip.id = 'combat-float-tip'; document.body.appendChild(tip); }
        const enemyHtml = `
          <div class="cct-name">${e.icon || '⚔️'} ${e.name}</div>
          ${e.desc ? `<div class="cct-row" style="margin-bottom:7px;color:var(--text)">${e.desc}</div>` : ''}
          <div class="cct-row"><span class="cct-label">HP</span>${e.hp} / ${e.maxHp}</div>
          <div class="cct-row"><span class="cct-label">格檔</span>${e.block}</div>
          <div class="cct-row"><span class="cct-label">攻擊</span>${e.attack}</div>
          <div class="cct-row"><span class="cct-label">原生弱點</span>${nativeText}</div>
          ${extraText}
          ${e.tempWeakness ? `<div class="cct-row"><span class="cct-label">破綻</span>${e.tempWeakness}</div>` : ''}
        `;
        enemyCard.addEventListener('mouseenter', () => { tip.innerHTML = enemyHtml; tip.classList.add('visible'); });
        enemyCard.addEventListener('mousemove', ev => {
          const x = ev.clientX + 16, y = ev.clientY + 12;
          tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 8) + 'px';
          tip.style.top = y + 'px';
        });
        enemyCard.addEventListener('mouseleave', () => tip.classList.remove('visible'));
      }

      // Section.
      if (cfg.combat.selectable) {
        let tip = document.getElementById('combat-float-tip');
        if (!tip) {
          tip = document.createElement('div');
          tip.id = 'combat-float-tip';
          document.body.appendChild(tip);
        }
        tip.classList.remove('visible');

        sceneEl.querySelectorAll('.combat-unit.selectable').forEach(unit => {
          const charId = unit.dataset.charId;
          const charData = cfg.combat.squad.find(c => c.id === charId);
          if (!charData) return;

          unit.addEventListener('mouseenter', () => {
            tip.innerHTML = this._combatCharInfoHtml(charData);
            tip.classList.add('visible');
          });
          unit.addEventListener('mousemove', e => {
            const x = e.clientX + 16;
            const y = e.clientY + 12;
            // Section.
            const maxX = window.innerWidth - tip.offsetWidth - 8;
            tip.style.left = Math.min(x, maxX) + 'px';
            tip.style.top = y + 'px';
          });
          unit.addEventListener('mouseleave', () => {
            tip.classList.remove('visible');
          });
        });
      }
    }

    if (cfg.dice || cfg.enemyDice) {
      const diceRow = document.createElement('div');
      diceRow.className = 'modal-extra dice-row';

      if (cfg.enemyDice) {
        const enemyDiceEl = document.createElement('div');
        enemyDiceEl.className = `dice-result dice-${cfg.enemyDice.type || 'danger'} dice-compact ${this._diceThemeClass(cfg.enemyDice.charCls, cfg.enemyDice.label)}`;
        enemyDiceEl.innerHTML = `
          <div class="dice-label">${cfg.enemyDice.label}</div>
          <div class="dice-face">${Dice.face(cfg.enemyDice.value)}</div>
          <div class="dice-value">結果 ${cfg.enemyDice.value}</div>
        `;
        diceRow.appendChild(enemyDiceEl);
        if (!cfg.combat && cfg.enemyDice.animate !== false) this._animateModalDice(enemyDiceEl, cfg.enemyDice.value, this._revealModalAfterDice);
      }

      if (cfg.dice) {
        const diceEl = document.createElement('div');
        diceEl.className = `dice-result dice-${cfg.dice.type || 'neutral'}${cfg.combat ? ' dice-compact' : ''} ${this._diceThemeClass(cfg.dice.charCls, cfg.dice.label)}`;
        diceEl.innerHTML = `
          <div class="dice-label">${cfg.dice.label || '骰子結果'}</div>
          ${this._modalDiceFaceHtml(cfg.dice)}
          <div class="dice-value">結果 ${cfg.dice.value}</div>
          ${cfg.dice.floored ? `<div class="dice-note">原始 ${cfg.dice.raw}，已套用修正。</div>` : ''}
        `;
        diceRow.appendChild(diceEl);
        if (!cfg.combat && cfg.dice.animate !== false) this._animateModalDice(diceEl, cfg.dice.value, this._revealModalAfterDice);
      }

      if (cfg.combat) {
        diceRow.classList.add('hidden');
        descEl.before(diceRow);
      } else {
        choicesEl.before(diceRow);
      }
    }

    choicesEl.innerHTML = '';
    const combatActionsEl = combatSceneEl?.querySelector('.combat-actions');
    if (combatActionsEl) combatActionsEl.innerHTML = '';
    const actionHost = combatActionsEl || choicesEl;
    for (const choice of (cfg.choices || [])) {
      const btn = document.createElement('button');
      btn.className = `choice-btn${choice.danger ? ' danger-choice' : ''}`;
      const label = document.createElement('span');
      label.className = 'choice-label';
      label.textContent = choice.label;
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        if (choice.detail) {
          this._openChoiceDetailModal(cfg, choice);
          return;
        }
        choice.action();
      });
      actionHost.appendChild(btn);
    }
    choicesEl.classList.toggle('modal-choices-empty', !!combatActionsEl);

    // Section.
    if (cfg.combatLog && cfg.combatLog.length > 0) {
      const detailEl = document.createElement('details');
      detailEl.className = 'combat-detail-log';
      detailEl.innerHTML = `<summary>戰鬥詳細紀錄</summary><div class="combat-log-lines">${cfg.combatLog.map(l => `<div>${l}</div>`).join('')}</div>`;
      descEl.appendChild(detailEl);
    }

    modal.classList.remove('hidden');
    contentEl.scrollTop = 0;
    descEl.scrollTop = 0;
    choicesEl.scrollTop = 0;
    if (cfg.combat) {
      requestAnimationFrame(() => this._positionCombatIntentArrow());
      setTimeout(() => this._positionCombatIntentArrow(), 160);
    }

    // Section.
    if (cfg.combatAnims) {
      const delay = Number.isFinite(cfg.combatAnims.delay) ? cfg.combatAnims.delay : 120;
      const hasEnemyAnim = !!(cfg.combatAnims.counterTarget || cfg.combatAnims.aoe || cfg.combatAnims.enemyBlock);
      const lockMs = delay + (cfg.combatAnims.enemyBlock ? 220 : 0) + 720;
      if (hasEnemyAnim && combatActionsEl) {
        const buttons = [...combatActionsEl.querySelectorAll('button')];
        const selectableUnits = [...combatSceneEl.querySelectorAll('.combat-unit.selectable')];
        buttons.forEach(btn => { btn.disabled = true; });
        selectableUnits.forEach(unit => unit.classList.add('combat-anim-locked'));
        if (G.combat) G.combat.actionInProgress = true;
        setTimeout(() => {
          buttons.forEach(btn => { btn.disabled = false; });
          selectableUnits.forEach(unit => unit.classList.remove('combat-anim-locked'));
          if (G.combat) G.combat.actionInProgress = false;
        }, lockMs);
      }
      setTimeout(() => this._triggerCounterAnims(cfg.combatAnims), delay);
    }
  },

  _openChoiceDetailModal(parentCfg, choice) {
    const detailCfg = {
      title: choice.detailTitle || choice.label,
      desc: String(choice.detail || ''),
      typeText: false,
      choices: [
        {
          label: choice.confirmLabel || choice.label,
          danger: !!choice.danger,
          action: () => choice.action(),
        },
        {
          label: choice.backLabel || '返回',
          action: () => {
            if (typeof G !== 'undefined') G.modal = parentCfg;
            this.showModal(parentCfg);
          },
        },
      ],
    };
    if (typeof G !== 'undefined') G.modal = detailCfg;
    this.showModal(detailCfg);
  },

  _positionCombatIntentArrow() {
    const scene = document.querySelector('.combat-scene');
    const arrow = scene?.querySelector('.combat-intent-arrow');
    if (!scene || !arrow) return;
    const targetId = arrow.dataset.targetId || '';
    const source = scene.querySelector('.combat-enemy-sprite');
    const target = [...scene.querySelectorAll('.combat-unit[data-char-id]')]
      .find(unit => unit.dataset.charId === targetId);
    if (!source || !target) {
      arrow.hidden = true;
      return;
    }
    arrow.hidden = false;
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const horizontal = targetRect.left > sourceRect.right;
    const x1 = horizontal ? sourceRect.right + 2 : sourceRect.left + sourceRect.width / 2;
    const y1 = sourceRect.top + sourceRect.height / 2;
    const x2 = horizontal ? targetRect.left - 8 : targetRect.left + targetRect.width / 2;
    const y2 = horizontal ? targetRect.top + targetRect.height / 2 : targetRect.top - 8;
    arrow.setAttribute('viewBox', `0 0 ${Math.max(1, window.innerWidth)} ${Math.max(1, window.innerHeight)}`);
    arrow.querySelector('line')?.setAttribute('x1', x1);
    arrow.querySelector('line')?.setAttribute('y1', y1);
    arrow.querySelector('line')?.setAttribute('x2', x2);
    arrow.querySelector('line')?.setAttribute('y2', y2);
    arrow.querySelector('circle')?.setAttribute('cx', x1);
    arrow.querySelector('circle')?.setAttribute('cy', y1);
  },

  _animateModalDice(diceEl, finalValue, onDone = null) {
    const faceEl = diceEl.querySelector('.dice-face');
    const valueEl = diceEl.querySelector('.dice-value');
    if (!faceEl) return;
    if (valueEl) valueEl.style.visibility = 'hidden';
    const roleDiceEl = faceEl.querySelector('.combat-card-dice');
    const sides = Math.max(1, Number(roleDiceEl?.dataset.sides || diceEl.dataset.sides || 6));

    let count = 0;
    const STEPS = 10;
    const MS = 75;
    if (roleDiceEl) {
      roleDiceEl.classList.add('dice-rolling');
    } else {
      diceEl.classList.add('dice-rolling');
    }
    const timer = setInterval(() => {
      count++;
      if (count < STEPS) {
        this._setModalDiceFace(faceEl, roleDiceEl, Math.ceil(Math.random() * sides));
      } else {
        clearInterval(timer);
        this._setModalDiceFace(faceEl, roleDiceEl, finalValue);
        diceEl.classList.remove('dice-rolling');
        if (roleDiceEl) roleDiceEl.classList.remove('dice-rolling');
        diceEl.classList.add('dice-pip-settled');
        if (valueEl) valueEl.style.visibility = '';
        if (onDone) onDone.call(this);
      }
    }, MS);
  },

  _setModalDiceFace(faceEl, roleDiceEl, value) {
    if (!roleDiceEl) {
      faceEl.textContent = Dice.face(value);
      return;
    }
    roleDiceEl.classList.remove('dice-face-1', 'dice-face-2', 'dice-face-3', 'dice-face-4', 'dice-face-5', 'dice-face-6');
    const sides = Math.max(1, Number(roleDiceEl.dataset.sides || 6));
    if (sides <= 6 && value >= 1 && value <= 6) roleDiceEl.classList.add(`dice-face-${value}`);
    roleDiceEl.innerHTML = this._dicePipHtml(value, sides);
  },

  _revealModalAfterDice() {
    const descEl = document.getElementById('modal-desc');
    const choicesEl = document.getElementById('modal-choices');
    if (descEl && ('resultDesc' in descEl.dataset || 'resultAppend' in descEl.dataset)) {
      const resultDesc = descEl.dataset.resultDesc;
      const preDesc = descEl.dataset.preDesc || '';
      const hasExplicitAppend = 'resultAppend' in descEl.dataset;
      const resultAppend = descEl.dataset.resultAppend;
      delete descEl.dataset.resultDesc;
      delete descEl.dataset.preDesc;
      delete descEl.dataset.resultAppend;
      if (this._modalTypeTimer) {
        clearInterval(this._modalTypeTimer);
        this._modalTypeTimer = null;
      }
      const introEl = descEl.querySelector('.modal-desc-intro');
      let resultEl = descEl.querySelector('.modal-desc-result');
      if (!resultEl) {
        resultEl = document.createElement('div');
        resultEl.className = 'modal-desc-result';
        descEl.appendChild(resultEl);
      }
      if (introEl) {
        introEl.textContent = preDesc || introEl.textContent;
        introEl.classList.remove('typing');
      }
      resultEl.textContent = '';
      resultEl.hidden = false;
      resultEl.classList.remove('typing');
      const currentText = introEl ? introEl.textContent : descEl.textContent;
      const resultText = hasExplicitAppend
        ? resultAppend
        : this._resultAppendText(preDesc, resultDesc);
      const cleanResultText = String(resultText || '').replace(/^\n+/, '');
      const separator = !introEl && currentText && cleanResultText ? '\n\n' : '';
      this._typeModalText(resultEl, `${separator}${cleanResultText}`, () => {
        if (choicesEl) {
          choicesEl.style.visibility = '';
          choicesEl.style.pointerEvents = '';
        }
      }, { append: true });
      return;
    }
    if (choicesEl) {
      choicesEl.style.visibility = '';
      choicesEl.style.pointerEvents = '';
    }
  },

  _resultAppendText(preDesc = '', resultDesc = '') {
    const before = String(preDesc || '');
    const after = String(resultDesc || '');
    if (!before) return after;
    if (after.startsWith(before)) return after.slice(before.length);

    let i = 0;
    const max = Math.min(before.length, after.length);
    while (i < max && before[i] === after[i]) i++;
    return after.slice(i).replace(/^\s+/, '');
  },

  _typeModalText(el, text, onDone = null, opts = {}) {
    if (!el) {
      if (onDone) onDone.call(this);
      return;
    }
    if (this._modalTypeTimer) {
      clearInterval(this._modalTypeTimer);
      this._modalTypeTimer = null;
    }

    const append = !!opts.append;
    const prefix = append ? el.textContent : '';
    const addition = String(text || '');
    const fullText = `${prefix}${addition}`;
    const startIndex = append ? prefix.length : 0;
    const step = fullText.length > 260 ? 4 : fullText.length > 120 ? 3 : 2;
    let index = startIndex;
    let done = false;
    el.textContent = prefix;
    el.classList.add('typing');

    const finish = () => {
      if (done) return;
      done = true;
      if (this._modalTypeTimer) {
        clearInterval(this._modalTypeTimer);
        this._modalTypeTimer = null;
      }
      el.textContent = fullText;
      el.classList.remove('typing');
      el.removeEventListener('click', finish);
      if (onDone) onDone.call(this);
    };

    el.addEventListener('click', finish);
    this._modalTypeTimer = setInterval(() => {
      index = Math.min(fullText.length, index + step);
      el.textContent = fullText.slice(0, index);
      el.scrollTop = el.scrollHeight;
      if (index >= fullText.length) finish();
    }, 24);
  },

  _triggerCounterAnims({ counterTarget, aoe, enemyBlock }) {
    const enemyCard = document.querySelector('.combat-enemy-card');
    if (!counterTarget && !aoe && !enemyBlock) return;

    // 敵人反擊前先晃動提示
    if (enemyBlock && enemyCard) {
      enemyCard.classList.add('anim-block-up');
      setTimeout(() => enemyCard.classList.remove('anim-block-up'), 430);
    }

    const attackDelay = enemyBlock ? 220 : 0;
    if ((counterTarget || aoe) && enemyCard) {
      setTimeout(() => {
        enemyCard.classList.add('anim-pulse-left');
        setTimeout(() => enemyCard.classList.remove('anim-pulse-left'), 400);
      }, attackDelay);
    }

    // Section.
    setTimeout(() => {
      if (aoe) {
        document.querySelectorAll('.combat-unit.ally').forEach(el => {
          el.classList.add('anim-hit');
          setTimeout(() => el.classList.remove('anim-hit'), 420);
        });
      } else if (counterTarget) {
        const el = document.querySelector(`.combat-unit[data-char-id="${counterTarget}"]`);
        if (el) {
          el.classList.add('anim-hit');
          setTimeout(() => el.classList.remove('anim-hit'), 420);
        }
      }
    }, attackDelay + 270);
  },

  _combatSceneHtml(combat) {
    const enemyHpPct = combat.enemy.maxHp > 0 ? (combat.enemy.hp / combat.enemy.maxHp) * 100 : 0;
    const enemyHpClass = enemyHpPct <= 25 ? 'critical' : enemyHpPct <= 50 ? 'low' : '';
    const nativeInfo = this._activeEnemyNativeWeaknesses(combat.enemy);
    const weaknessDescHtml = nativeInfo.main && combat.enemy.weaknessDesc
      ? `<div class="combat-weakness-effect">⚡ ${combat.enemy.weaknessDesc}</div>`
      : '';
    const fateGamble = combat.enemy.fateGamble || null;
    const fateGambleHtml = fateGamble?.luckyFace && Array.isArray(fateGamble.unluckyFaces) && fateGamble.unluckyFaces.length > 0
      ? `<div class="combat-weakness-effect">命運盤：幸運 ${Dice.face(fateGamble.luckyFace)} ${fateGamble.luckyFace}／厄運 ${fateGamble.unluckyFaces.map(face => `${Dice.face(face)} ${face}`).join('、')}</div>`
      : '';
    const bannerGuardian = combat.enemy.bannerGuardian || null;
    const bannerGuardianHtml = bannerGuardian
      ? `<div class="combat-weakness-effect">旗面：${bannerGuardian.stance === 'damage' ? '戰吼旗（攻擊傷害 +2）' : '創傷旗（攻擊前全隊傷口 +2）'}</div>`
      : '';
    const selectable = !!combat.selectable;
    const itemTargeting = !!combat.itemTargeting;

    const squadHtml = combat.squad.map(char => {
      const cls = CHARACTER_CLASSES[char.cls];
      const hpPct = char.maxHp > 0 ? (char.hp / char.maxHp) * 100 : 0;
      const hpClass = hpPct <= 25 ? 'critical' : hpPct <= 50 ? 'low' : '';
      const isActive = combat.attackerId === char.id;
      const isDown = char.hp <= 0;
      const showPlayerDice = combat.playerDice && combat.attackerId === char.id;
      const canClick = (selectable || itemTargeting) && !isDown;
      const isIntentTarget = this._combatShouldShowIntentArrow(combat) && combat.intent?.targetId === char.id;
      const threat = char.threat || 0;
      const wagerFaces = Array.isArray(char.wagerDiceFaces) ? char.wagerDiceFaces : [];
      const wagerActive = wagerFaces.length > 0;
      const gazeWeaknesses = CombatStatus.nativeWeaknesses(char, 'gaze');
      const gazeBadgeHtml = gazeWeaknesses.length > 0 && !isDown
        ? this._combatAllyNativeWeaknessBadgeHtml(gazeWeaknesses)
        : '';
      const wounds = Math.max(0, Math.min(char.woundMax || 15, char.wounds || 0));
      const woundBadgeHtml = wounds > 0 && !isDown
        ? this._combatAllyWoundBadgeHtml(char, wounds)
        : '';
      const block = Math.max(0, char.block || 0);
      const blockBadgeHtml = block > 0 && !isDown
        ? this._combatAllyBlockBadgeHtml(char, block)
        : '';
      const remorseStacks = char.wagerDiceMissStacks || 0;
      const remorseHtml = remorseStacks > 0 && !isDown ? `
        <button type="button" class="combat-status-badge remorse"
          onclick="event.stopPropagation(); Game.showCombatStatusDetail('${char.id}', 'remorse', event)"
          title="懊悔 ${remorseStacks} 層，下次受擊流程受到的傷害提高 ${remorseStacks * 30}%">
          <img src="assets/icons/remorse-icon.png" alt="懊悔">
          <strong>+${remorseStacks * 30}%</strong>
        </button>
      ` : '';
      const backlashStacks = char.gamblerBacklashStacks || 0;
      const backlashHtml = backlashStacks > 0 && !isDown ? `
        <button type="button" class="combat-status-badge backlash"
          onclick="event.stopPropagation(); Game.showCombatStatusDetail('${char.id}', 'backlash', event)"
          title="反噬 ${backlashStacks} 層，下次受擊流程受到的傷害提高 ${backlashStacks * 20}%">
          <img src="assets/icons/backlash-icon.png" alt="反噬">
          <strong>+${backlashStacks * 20}%</strong>
        </button>
      ` : '';
      const wagerHtml = char.canWagerDice && !isDown ? `
        <button type="button"
          class="combat-wager-toggle${wagerActive ? ' active' : ''}"
          onclick="event.stopPropagation(); Game.toggleCombatWagerDice('${char.id}')"
          title="${wagerActive ? `取消押注：${wagerFaces.join('、')}` : '設定賭命骰子押注'}">
          <span class="wager-icon">🎲</span>
          ${wagerActive ? `<small>${wagerFaces.join(' ')}</small>` : '<span class="wager-state">押注</span>'}
        </button>
      ` : '';
      const bannerHtml = Array.isArray(char.activeBanners) && char.activeBanners.length > 0
        ? char.activeBanners.map(banner => `
          <button type="button"
            class="combat-banner-badge"
            onclick="event.stopPropagation(); Game.showCombatBannerDetail('${char.id}', '${banner.relicId}', '${banner.faceId}', event)">
            <span class="banner-icon">🚩</span>
            <span>${banner.shortName || banner.faceName}</span>
            <strong>${banner.level}階</strong>
          </button>
        `).join('')
        : '';
      const tag = 'div';
      const clickAttr = itemTargeting && !isDown
        ? `onclick="Game.useCombatInventoryItemOnTarget('${char.id}')"`
        : (selectable && !isDown ? `onclick="Game.selectCombatAttacker('${char.id}')"` : '');
      return `
        <${tag} class="combat-unit ally${isActive ? ' active' : ''}${isDown ? ' down' : ''}${canClick ? ' selectable' : ''}${itemTargeting && !isDown ? ' item-target' : ''}${isIntentTarget ? ' intent-targeted' : ''}"
          data-char-id="${char.id}" ${clickAttr}>
          <div class="combat-unit-main">
            <span class="combat-sprite">${cls.icon}</span>
            <span class="combat-name">${char.name}</span>
            ${gazeBadgeHtml}
            ${woundBadgeHtml}
            ${blockBadgeHtml}
            ${remorseHtml}
            ${backlashHtml}
            ${wagerHtml}
            ${bannerHtml}
          </div>
          <div class="combat-stat-line">攻擊 ${char.attack ?? cls.attack ?? 0}${threat > 0 ? `　仇恨 ${threat}/10` : ''}</div>
          ${threat > 0 ? `<div class="combat-threat-meter" title="仇恨 ${threat}/10"><span style="width:${Math.min(100, threat * 10)}%"></span></div>` : ''}
          <div class="combat-hp-row">
            <div class="combat-hp-bar"><div class="combat-hp-fill ${hpClass}" style="width:${hpPct}%"></div></div>
            <span>${char.hp}/${char.maxHp}</span>
          </div>
          ${showPlayerDice ? this._combatDicePips(combat.playerDice.value, 'player', char.cls, combat.playerDice.sides, this._d12DiceType(combat.playerDice)) : ''}
        </${tag}>
      `;
    }).join('');

    const bagItems = (combat.inventory || []).filter(entry => entry.item && entry.item.useInCombat !== false);
    const intentArrowHtml = this._combatIntentArrowHtml(combat);
    const bagHtml = combat.showBag ? `
      <div class="combat-bag-panel">
        ${bagItems.length > 0 ? bagItems.map(entry => {
          const item = entry.item;
          const blocked = item.useType === 'roll_mod' && combat.rollItemBlocked;
          const countText = entry.count > 1 ? ` x${entry.count}` : '';
          return `<button class="combat-bag-item" ${blocked ? 'disabled' : ''} onclick="Game.selectCombatBagItem(${entry.index})">
            <span>${item.icon} ${item.name}${countText}</span>
            <small>${blocked ? '本次攻擊已使用擲骰道具' : item.desc}</small>
          </button>`;
        }).join('') : '<div class="combat-bag-empty">背包沒有可在戰鬥中使用的道具</div>'}
      </div>
    ` : '';

    return `
      <div class="combat-tools">
        <div class="combat-actions"></div>
        <button class="combat-bag-button${combat.canUseBag ? '' : ' disabled'}" ${combat.canUseBag ? 'onclick="Game.openCombatBag()"' : 'disabled'} title="小隊背包">🎒 背包</button>
      </div>
      ${intentArrowHtml}
      ${bagHtml}
      <div class="combat-enemy-card hoverable-enemy">
        ${combat.enemyDice ? this._combatDicePips(combat.enemyDice.value, 'enemy', null, combat.enemyDice.sides) : ''}
        <div class="combat-side-label">敵人</div>
        <div class="combat-enemy-figure">
          <div class="combat-enemy-stance-column">
            ${this._combatEnemyIntentHtml(combat.intent)}
            <div class="combat-enemy-stance-divider" aria-hidden="true"></div>
            ${this._combatEnemyBlockPanelHtml(combat.enemy)}
          </div>
          <button type="button" class="combat-enemy-sprite combat-enemy-detail-button"
            onclick="event.stopPropagation(); Game.showCombatEnemyDetail(event)"
            title="查看敵人詳情">
            ${this._enemyIconHtml(combat.enemy)}
          </button>
          ${this._combatEnemyStatusIconsHtml(combat.enemy)}
        </div>
        <div class="combat-enemy-name">${combat.enemy.name}</div>
        <div class="combat-hp-row">
          <div class="combat-hp-bar"><div class="combat-hp-fill ${enemyHpClass}" style="width:${enemyHpPct}%"></div></div>
          <span>${combat.enemy.hp}/${combat.enemy.maxHp}</span>
        </div>
        ${this._combatWeaknessRowHtml(combat.enemy)}
        <div class="combat-stat-line">攻擊 ${combat.enemy.attack}</div>
        ${combat.enemy.disabledNativeWeaknesses?.length ? `<div class="combat-weakness-effect">裂星破壞：${combat.enemy.disabledNativeWeaknesses.map(w => `${Dice.face(w)} ${w}`).join('、')}</div>` : ''}
        ${combat.enemy.suspiciousFlaw ? `<div class="combat-weakness-effect">可疑弱點：探索者可消耗，差 1 視為命中原生弱點</div>` : ''}
        ${combat.enemy.eagleNativeWeakness ? `<div class="combat-weakness-effect">鷹眼暫時原生弱點：${Dice.face(combat.enemy.eagleNativeWeakness.value)} ${combat.enemy.eagleNativeWeakness.value}</div>` : ''}
        ${fateGambleHtml}
        ${bannerGuardianHtml}
        ${weaknessDescHtml}
      </div>
      <div class="combat-center">
        <div class="combat-vs">VS</div>
        ${itemTargeting ? `<button class="btn-tiny combat-cancel-item" onclick="Game.cancelCombatItemTargeting()">取消道具</button>` : ''}
      </div>
      <div class="combat-squad-card">
        <div class="combat-side-label">小隊</div>
        ${squadHtml}
      </div>
      <div class="combat-status-bar${selectable ? ' selectable-hint' : ''}">${combat.status || '選擇一名角色出手'}</div>
    `;
  },

  _combatShouldShowIntentArrow(combat) {
    const type = combat?.intent?.type || '';
    return !!combat?.intent?.targetId && ['attack', 'block_attack', 'dice_attack'].includes(type);
  },

  _combatIntentArrowHtml(combat) {
    if (!this._combatShouldShowIntentArrow(combat)) return '';
    const targetId = String(combat.intent.targetId).replace(/"/g, '&quot;');
    return `
      <svg class="combat-intent-arrow" data-target-id="${targetId}" aria-hidden="true" focusable="false">
        <defs>
          <marker id="combat-intent-arrow-head" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
        </defs>
        <line x1="0" y1="0" x2="0" y2="0"></line>
        <circle cx="0" cy="0" r="3"></circle>
      </svg>
    `;
  },

  _activeEnemyNativeWeaknesses(enemy) {
    const disabled = new Set(CombatStatus.disabledNativeWeaknesses(enemy));
    const main = enemy?.weakness && !disabled.has(enemy.weakness) ? enemy.weakness : null;
    const extras = CombatStatus.nativeWeaknesses(enemy, 'extra')
      .filter(w => w && !disabled.has(w) && w !== main);
    return { main, extras };
  },

  _combatEnemyStatusIconsHtml(enemy) {
    const icons = [
      this._combatWoundBadgeHtml(enemy),
    ].filter(Boolean);
    if (icons.length === 0) return '';
    return `<div class="combat-enemy-status-icons">${icons.join('')}</div>`;
  },

  _combatWeaknessRowHtml(enemy) {
    const badges = [
      ...this._combatNativeWeaknessBadgesHtml(enemy),
      ...this._combatTempWeaknessBadgesHtml(enemy),
    ];
    if (badges.length === 0) return '';
    return `<div class="combat-weakness-icon-row">${badges.join('')}</div>`;
  },

  _combatNativeWeaknessBadgesHtml(enemy) {
    const nativeInfo = this._activeEnemyNativeWeaknesses(enemy);
    const badges = [];
    if (nativeInfo.main) badges.push(this._combatNativeWeaknessBadgeHtml(nativeInfo.main, 'main', '原生', enemy));
    for (const value of nativeInfo.extras) {
      const source = this._enemyNativeWeaknessSource(enemy, value);
      badges.push(this._combatNativeWeaknessBadgeHtml(value, 'extra', this._enemyNativeWeaknessLabel(source), enemy, source));
    }
    return badges;
  },

  _combatNativeWeaknessBadgeHtml(value, kind, label, enemy, source = '') {
    return `
      <button type="button" class="combat-native-weakness-badge ${kind === 'extra' ? 'extra' : 'main'}"
        onclick="event.stopPropagation(); Game.showCombatNativeWeaknessDetail(${value}, '${kind}', event)"
        title="${label} ${value}${enemy?.weaknessDesc ? `：${enemy.weaknessDesc}` : ''}">
        <span class="combat-native-weakness-main">
          <img src="assets/icons/native-weakness-icon.png" alt="原生弱點">
          <strong>${value}</strong>
        </span>
        <span class="combat-native-weakness-label">${label}</span>
      </button>
    `;
  },

  _enemyNativeWeaknessSource(enemy, value) {
    if (enemy?.eagleNativeWeakness?.value === value) return enemy.eagleNativeWeakness.source || 'eagle_native';
    if (enemy?.gamblerNativeWeakness === value) return 'gambler_native';
    return enemy?.nativeWeaknessSources?.[value] || '';
  },

  _enemyNativeWeaknessLabel(source) {
    const labels = {
      star_hunter_eye: '獵星',
      eagle_native: '鷹眼',
      flaw_lens: '透鏡',
      gambler_native: '搏命',
      restored_native: '再生',
    };
    return labels[source] || '原生+';
  },

  _combatAllyNativeWeaknessBadgeHtml(values) {
    const faces = (Array.isArray(values) ? values : [values])
      .map(Number)
      .filter(face => face >= 1 && face <= 6)
      .sort((a, b) => a - b);
    const label = faces.join('.');
      const title = faces.length > 1
        ? `原生弱點 ${faces.join('、')}：被對應效果命中時，傷害 +3 並移除命中的弱點。`
        : `原生弱點 ${label}：被對應效果命中時，傷害 +3 並移除。`;
    return `
      <span class="combat-native-weakness-badge ally" title="${title}">
        <span class="combat-native-weakness-main">
          <img src="assets/icons/native-weakness-icon.png" alt="原生弱點">
        </span>
        <strong class="ally-native-weakness-value">${label}</strong>
      </span>
    `;
  },

  _combatAllyWoundBadgeHtml(char, wounds) {
    const max = char?.woundMax || 15;
    const bonus = wounds * 5;
    return `
      <button type="button" class="combat-wound-badge ally"
        onclick="event.stopPropagation(); Game.showCombatAllyWoundDetail('${char.id}', event)"
        title="傷口 ${wounds} / ${max}，目前受傷害 +${bonus}%">
        <span class="combat-wound-main">
          <img src="assets/icons/wound-icon.png" alt="傷口">
          <strong>${wounds}</strong>
        </span>
        <span class="combat-wound-bonus">+${bonus}%</span>
      </button>
    `;
  },

  _combatAllyBlockBadgeHtml(char, block) {
    return `
      <button type="button" class="combat-block-badge ally"
        onclick="event.stopPropagation(); Game.showCombatAllyBlockDetail('${char.id}', event)"
        title="格檔 ${block}：會先吸收受到的傷害">
        <span class="combat-block-main">
          <img class="combat-block-icon" src="assets/icons/block-icon-clean.png" alt="格檔">
          <strong>${block}</strong>
        </span>
      </button>
    `;
  },

  _combatTempWeaknessBadgesHtml(enemy) {
    const badges = [];
    const used = new Set();
    const add = (value, kind, label) => {
      if (!value) return;
      const key = `${kind}:${value}`;
      if (used.has(key)) return;
      used.add(key);
      badges.push(this._combatTempWeaknessBadgeHtml(value, kind, label));
    };
    for (const value of CombatStatus.tempWeaknesses(enemy, 'normal')) add(value, 'normal', '破綻');
    for (const value of CombatStatus.tempWeaknesses(enemy, 'eagle')) add(value, 'eagle', '鷹眼');
    const gamblerWeaknesses = CombatStatus.tempWeaknesses(enemy, 'gambler');
    for (const value of gamblerWeaknesses) add(value, 'gambler', '搏命');
    return badges;
  },

  _combatTempWeaknessBadgeHtml(value, kind, label) {
    return `
      <button type="button" class="combat-temp-weakness-badge ${kind}"
        onclick="event.stopPropagation(); Game.showCombatTempWeaknessDetail(${value}, '${kind}', event)"
        title="${label}破綻 ${value}：命中傷害 +1">
        <span class="combat-temp-weakness-main">
          <img src="assets/icons/temp-weakness-icon.png" alt="破綻">
          <strong>${value}</strong>
        </span>
        <span class="combat-temp-weakness-label">${label}</span>
      </button>
    `;
  },

  _combatWoundBadgeHtml(enemy) {
    const wounds = Math.max(0, enemy?.wounds || 0);
    if (wounds <= 0) return '';
    const max = enemy?.woundMax || 15;
    const bonus = wounds * 5;
    return `
      <button type="button" class="combat-wound-badge"
        onclick="event.stopPropagation(); Game.showCombatWoundDetail(event)"
        title="傷口 ${wounds} / ${max}，目前受傷害 +${bonus}%">
        <span class="combat-wound-main">
          <img src="assets/icons/wound-icon.png" alt="傷口">
          <strong>${wounds}</strong>
        </span>
        <span class="combat-wound-bonus">+${bonus}%</span>
      </button>
    `;
  },

  _combatEnemyIntentHtml(intent) {
    if (!intent?.icon || !intent?.text) {
      return `
        <button type="button" class="combat-enemy-intent-panel empty"
          disabled aria-hidden="true" tabindex="-1">
          <span aria-hidden="true"></span>
        </button>
      `;
    }
    return `
      <button type="button" class="combat-enemy-intent-panel ${intent.type || ''}"
        onclick="event.stopPropagation(); Game.showCombatIntentDetail(event)"
        title="${intent.title || '敵人意圖'}">
        <img src="${intent.icon}" alt="敵人意圖">
        <strong>${intent.text}</strong>
      </button>
    `;
  },

  _combatEnemyBlockPanelHtml(enemy) {
    const block = Math.max(0, enemy?.currentBlock || enemy?.block || 0);
    return `
      <button type="button" class="combat-enemy-block-panel${block > 0 ? '' : ' empty'}"
        ${block > 0 ? 'onclick="event.stopPropagation(); Game.showCombatBlockDetail(event)"' : 'disabled aria-hidden="true"'}
        title="${block > 0 ? `格檔 ${block}：會先吸收受到的傷害` : ''}">
        <img class="combat-enemy-block-icon" src="assets/icons/block-icon-clean.png" alt="格檔">
        <strong class="combat-enemy-block-value">${block}</strong>
      </button>
    `;
  },

  _combatDicePips(value, side, cls = null, sides = 6, d12Type = null) {
    const diceSides = Math.max(1, Number(sides || 6));
    const d12Class = diceSides > 6 ? ' dice-d12' : '';
    const d12TypeClass = diceSides > 6 && d12Type ? ` dice-d12-${d12Type}` : '';
    const faceClass = diceSides <= 6 && value >= 1 && value <= 6 ? `dice-face-${value}` : '';
    return `<div class="combat-card-dice ${side} ${this._diceThemeClass(cls)}${d12Class}${d12TypeClass} ${faceClass}" data-sides="${diceSides}" aria-label="骰出 ${value}">
      ${this._dicePipHtml(value, diceSides)}
    </div>`;
  },

  _dicePipHtml(value, sides = 6) {
    if (sides > 6 || value > 6) return `<strong class="dice-number">${value}</strong>`;
    const patterns = {
      1: [5],
      2: [1, 9],
      3: [1, 5, 9],
      4: [1, 3, 7, 9],
      5: [1, 3, 5, 7, 9],
      6: [1, 3, 4, 6, 7, 9],
    };
    const active = new Set(patterns[value] || [5]);
    return Array.from({ length: 9 }, (_, i) => `<span class="${active.has(i + 1) ? 'on' : ''}"></span>`).join('');
  },

  _modalDiceFaceHtml(dice) {
    const cls = dice?.charCls || this._classFromDiceLabel(dice?.label);
    if (!cls) return `<div class="dice-face">${Dice.face(dice?.value)}</div>`;
    return `<div class="dice-face dice-face-role">${this._combatDicePips(dice.value, 'modal', cls, dice.sides, this._d12DiceType(dice))}</div>`;
  },

  _d12DiceType(dice) {
    if (dice?.dodecaLuckyDice) return 'lucky';
    if (dice?.dodecaFateDice) return 'fate';
    return null;
  },

  _diceThemeClass(cls = null, label = '') {
    const resolvedCls = cls || this._classFromDiceLabel(label);
    return resolvedCls ? `dice-theme-${resolvedCls}` : 'dice-theme-neutral';
  },

  _classFromDiceLabel(label = '') {
    const text = String(label || '');
    if (!text || !Array.isArray(G.squad)) return null;
    const char = G.squad.find(c => c?.name && text.includes(c.name));
    return char?.cls || null;
  },

  _combatCharInfoHtml(char) {
    const cls = CHARACTER_CLASSES[char.cls];
    const rows = [];
    rows.push(`<div class="cct-name">${cls.icon} ${char.name}（${cls.name}）</div>`);
    rows.push(`<div class="cct-row"><span class="cct-label">被動</span>${cls.passiveDesc}</div>`);
    if (char.weapon) rows.push(`<div class="cct-row"><span class="cct-label">武器</span>${char.weapon.icon} ${char.weapon.name}：${char.weapon.desc}</div>`);
    if (char.gear)   rows.push(`<div class="cct-row"><span class="cct-label">裝備</span>${char.gear.icon} ${char.gear.name}：${char.gear.desc}</div>`);
    if (char.relic)  rows.push(`<div class="cct-row"><span class="cct-label">聖物</span>${char.relic.icon} ${char.relic.name}：${char.relic.desc}</div>`);
    if (char.fusedRelic) rows.push(`<div class="cct-row"><span class="cct-label">融合聖物</span>✨ ${char.fusedRelic.icon} ${char.fusedRelic.name}：${char.fusedRelic.desc}</div>`);
    const resonances = (G.activeResonances || []).filter(res => res.isBody && res.bodyChar?.id === char.id);
    for (const res of resonances) {
      rows.push(`<div class="cct-row"><span class="cct-label">共鳴</span>${res.name}：${res.effect?.desc || '共鳴效果已啟動。'}</div>`);
    }
    if (char.wagerDiceMissStacks > 0) rows.push(`<div class="cct-row"><span class="cct-label">懊悔</span>${char.wagerDiceMissStacks} 層，下次受擊流程受到的傷害提高 ${char.wagerDiceMissStacks * 30}%</div>`);
    if (char.gamblerBacklashStacks > 0) rows.push(`<div class="cct-row"><span class="cct-label">反噬</span>${char.gamblerBacklashStacks} 層，下次受擊流程受到的傷害提高 ${char.gamblerBacklashStacks * 20}%</div>`);
    if (char.threat > 0) rows.push(`<div class="cct-row"><span class="cct-label">仇恨</span>${char.threat}/10，單體意圖更容易鎖定此角色；被單體攻擊命中後仇恨減半</div>`);
    return rows.join('');
  },

  hideModal() {
    this._hideCombatTip();
    this._hideCombatBannerPopover();
    this._hideCombatStatusPopover();
    document.getElementById('event-modal').classList.add('hidden');
    this.fullRender();
  },

  _hideCombatBannerPopover() {
    document.getElementById('combat-banner-popover')?.classList.remove('visible');
  },

  _hideCombatStatusPopover() {
    document.getElementById('combat-status-popover')?.classList.remove('visible');
  },

  // Section.
  // Render Notes methods live in js/ui/notes-render.js.


};

Object.assign(Render, RenderModal);
