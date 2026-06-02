// Modal and combat scene rendering extracted from js/ui/render.js.
const RenderModal = {
  showModal(cfg) {
    this._hideCombatTip();
    this._hideCombatBannerPopover();
    this._hideCombatStatusPopover();
    this._ensureCombatLogDelegation();
    if (cfg?.combat || cfg?.combatAnims) this._preloadCombatDamageDigits();
    if (this._modalTypeTimer) {
      clearInterval(this._modalTypeTimer);
      this._modalTypeTimer = null;
    }
    const modal = document.getElementById('event-modal');
    const contentEl = modal.querySelector('.modal-content');
    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-desc');
    delete descEl.dataset.combatResultDeferred;
    if (this._modalFxCleanup) {
      this._modalFxCleanup();
      this._modalFxCleanup = null;
    }
    contentEl.querySelectorAll(':scope > .combat-tools, :scope > .combat-bag-panel, :scope > .combat-log-open, :scope > .event-fx-layer').forEach(el => el.remove());
    contentEl.classList.toggle('combat-modal', !!cfg.combat);
    contentEl.classList.toggle('narrative-modal', !cfg.combat && (cfg.desc || '').length > 900);
    contentEl.classList.toggle('character-detail-content', !!cfg.characterDetail);
    contentEl.classList.toggle('wager-modal-content', !!cfg.wagerModal);
    contentEl.classList.toggle('tutorial-modal', !!cfg.tutorialModal);
    contentEl.classList.toggle('event-backdrop-modal', !!cfg.eventBackdrop);
    contentEl.classList.remove(
      'fate-roll-success',
      'fate-fail-blood',
      'fate-fail-night',
      'fate-fail-life',
      'event-hit',
      'event-dark-hit',
      'event-clear',
      'event-ambush',
      'event-scene',
      'event-discover',
      'event-reward',
      'event-quiet',
      'event-intro-scene',
      'resonance-awaken'
    );
    const activeIntroFx = cfg.introFx || this._defaultModalIntroFx(cfg);
    const activeResultFx = cfg.resultFx || '';
    if (cfg.eventSfx) {
      const eventSfxVolume = Number.isFinite(cfg.eventSfxVolume) ? cfg.eventSfxVolume : undefined;
      AudioManager?.playSfx?.(cfg.eventSfx, eventSfxVolume);
    }
    if (activeIntroFx) contentEl.classList.add(`event-intro-${activeIntroFx}`);
    if (cfg.titleHtml) {
      titleEl.innerHTML = cfg.titleHtml;
    } else {
      titleEl.textContent = cfg.title || '';
    }
    const shouldAnimateDice = !cfg.combat && (
      (cfg.dice && cfg.dice.animate !== false) ||
      (cfg.enemyDice && cfg.enemyDice.animate !== false)
    );
    const hasDeferredResult = shouldAnimateDice && !cfg.descHtml
      && (
        typeof cfg.resultDesc === 'string' ||
        typeof cfg.resultAppend === 'string' ||
        typeof cfg.resultAppendHtml === 'string' ||
        typeof cfg.preDescHtml === 'string'
      );
    if (activeResultFx && !hasDeferredResult) {
      contentEl.classList.add(activeResultFx);
      this._playModalResultFx(contentEl, activeResultFx);
      if (cfg.resultSfx) {
        const resultSfxVolume = Number.isFinite(cfg.resultSfxVolume) ? cfg.resultSfxVolume : undefined;
        this._playModalResultSfx(cfg.resultSfx, resultSfxVolume);
      }
    }
    if (cfg.descHtml) {
      descEl.innerHTML = cfg.descHtml;
    } else if (hasDeferredResult) {
      descEl.innerHTML = '';
      const introEl = document.createElement('div');
      introEl.className = 'modal-desc-intro';
      if (cfg.preDescHtml) {
        introEl.innerHTML = cfg.preDescHtml;
      } else {
        introEl.textContent = cfg.preDesc || cfg.desc || '';
      }
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
      if (typeof cfg.resultAppendHtml === 'string') {
        descEl.dataset.resultAppendHtml = cfg.resultAppendHtml;
      } else {
        delete descEl.dataset.resultAppendHtml;
      }
      if (typeof cfg.preDescHtml === 'string') {
        descEl.dataset.preDescHtml = cfg.preDescHtml;
      } else {
        delete descEl.dataset.preDescHtml;
      }
      if (cfg.resultTitle) {
        descEl.dataset.resultTitle = cfg.resultTitle;
      } else {
        delete descEl.dataset.resultTitle;
      }
      if (cfg.resultBackdrop) {
        descEl.dataset.resultBackdrop = cfg.resultBackdrop;
      } else {
        delete descEl.dataset.resultBackdrop;
      }
      if (activeResultFx) {
        descEl.dataset.resultFx = activeResultFx;
      } else {
        delete descEl.dataset.resultFx;
      }
      if (cfg.resultSfx) {
        descEl.dataset.resultSfx = cfg.resultSfx;
      } else {
        delete descEl.dataset.resultSfx;
      }
      if (Number.isFinite(cfg.resultSfxVolume)) {
        descEl.dataset.resultSfxVolume = String(cfg.resultSfxVolume);
      } else {
        delete descEl.dataset.resultSfxVolume;
      }
    } else {
      delete descEl.dataset.resultDesc;
      delete descEl.dataset.preDesc;
      delete descEl.dataset.resultAppend;
      delete descEl.dataset.resultAppendHtml;
      delete descEl.dataset.preDescHtml;
      delete descEl.dataset.resultTitle;
      delete descEl.dataset.resultBackdrop;
      delete descEl.dataset.resultSfx;
      delete descEl.dataset.resultSfxVolume;
      delete descEl.dataset.resultFx;
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
      this.updateCombatTutorialInline(combatScene.tutorial || null, sceneEl);
      descEl.before(sceneEl);
      if (cfg.enemyDice && cfg.enemyDice.animate !== false && !cfg.combatAnims) {
        requestAnimationFrame(() => this._animateCombatEnemyDice(sceneEl, cfg.enemyDice));
      }
      const combatBagPanel = sceneEl.querySelector('.combat-bag-panel');
      if (combatBagPanel) contentEl.appendChild(combatBagPanel);

      // Section.
      const enemyCard = sceneEl.querySelector('.hoverable-enemy');
      const enemyHoverTarget = sceneEl.querySelector('.combat-enemy-detail-button');
      if (enemyHoverTarget && cfg.combat.enemy) {
        const e = cfg.combat.enemy;
        const nativeInfo = this._activeEnemyNativeWeaknesses(e);
        const nativeText = nativeInfo.main
          ? `${Dice.face(nativeInfo.main)} ${nativeInfo.main}${e.weaknessDesc ? `（${e.weaknessDesc}）` : ''}`
          : '已被裂星破壞';
        const extraText = nativeInfo.extras.length
          ? `<div class="cct-row"><span class="cct-label">原生+</span>${nativeInfo.extras.map(w => `${Dice.face(w)} ${w}`).join('、')}</div>`
          : '';
        const abilityRows = this._combatEnemyAbilityRowsHtml(e);
        let tip = document.getElementById('combat-float-tip');
        if (!tip) { tip = document.createElement('div'); tip.id = 'combat-float-tip'; document.body.appendChild(tip); }
        const enemyHtml = `
          <div class="cct-name">${e.icon || '⚔️'} ${e.name}</div>
          ${e.desc ? `<div class="cct-row" style="margin-bottom:7px;color:var(--text)">${e.desc}</div>` : ''}
          <div class="cct-row"><span class="cct-label">格檔</span>${e.block}</div>
          <div class="cct-row"><span class="cct-label">攻擊</span>${e.attack}</div>
          <div class="cct-row"><span class="cct-label">原生弱點</span>${nativeText}</div>
          ${extraText}
          ${abilityRows}
          ${e.tempWeakness ? `<div class="cct-row"><span class="cct-label">破綻</span>${e.tempWeakness}</div>` : ''}
        `;
        enemyHoverTarget.addEventListener('mouseenter', () => {
          tip.innerHTML = enemyHtml;
          const rows = [...tip.querySelectorAll('.cct-row')];
          const firstStatRow = e.desc ? 1 : 0;
          rows.slice(firstStatRow, firstStatRow + 2).forEach(row => row.remove());
          tip.classList.add('visible');
        });
        enemyHoverTarget.addEventListener('mousemove', ev => {
          const x = ev.clientX + 16, y = ev.clientY + 12;
          tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 8) + 'px';
          tip.style.top = y + 'px';
        });
        enemyHoverTarget.addEventListener('mouseleave', () => tip.classList.remove('visible'));
      }

      const fateBoard = sceneEl.querySelector('.fate-board-effect');
      if (fateBoard && cfg.combat.enemy?.fateGamble) {
        const fateGamble = cfg.combat.enemy.fateGamble;
        const luckyFaces = Array.isArray(fateGamble.luckyFaces) && fateGamble.luckyFaces.length > 0
          ? fateGamble.luckyFaces
          : (fateGamble.luckyFace ? [fateGamble.luckyFace] : []);
        const unluckyFaces = Array.isArray(fateGamble.unluckyFaces) ? fateGamble.unluckyFaces : [];
        let tip = document.getElementById('combat-float-tip');
        if (!tip) { tip = document.createElement('div'); tip.id = 'combat-float-tip'; document.body.appendChild(tip); }
        const fateHtml = `
          <div class="cct-name">🎲 命運盤</div>
          <div class="cct-row"><span class="cct-label">幸運</span>${luckyFaces.join('、')}</div>
          <div class="cct-row"><span class="cct-label">厄運</span>${unluckyFaces.join('、')}</div>
          <div class="cct-row">擲命守衛攻擊前會擲命運骰。命中幸運面會提高本次傷害並新增幸運面；命中厄運面會讓牠自損並使本回合攻擊減半。</div>
        `;
        fateBoard.addEventListener('mouseenter', () => {
          tip.innerHTML = fateHtml;
          tip.classList.add('visible');
        });
        fateBoard.addEventListener('mousemove', ev => {
          const x = ev.clientX + 16, y = ev.clientY + 12;
          tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 8) + 'px';
          tip.style.top = y + 'px';
        });
        fateBoard.addEventListener('mouseleave', () => tip.classList.remove('visible'));
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

        const usesTouchTooltip = !!window.matchMedia?.('(pointer: coarse)').matches;
        sceneEl.querySelectorAll('.combat-unit.selectable').forEach(unit => {
          const charId = unit.dataset.charId;
          const charData = cfg.combat.squad.find(c => c.id === charId);
          if (!charData) return;

          if (usesTouchTooltip) {
            let longPressTimer = null;
            let startX = 0;
            let startY = 0;
            const clearLongPress = () => {
              if (!longPressTimer) return;
              clearTimeout(longPressTimer);
              longPressTimer = null;
            };
            const showTouchTip = ev => {
              tip.innerHTML = this._combatCharInfoHtml(charData);
              tip.classList.add('visible');
              const rect = unit.getBoundingClientRect();
              const maxX = window.innerWidth - tip.offsetWidth - 8;
              const x = Math.max(8, Math.min(rect.left, maxX));
              const y = Math.max(8, rect.top - tip.offsetHeight - 10);
              tip.style.left = x + 'px';
              tip.style.top = y + 'px';
              unit.dataset.longPressSuppressClick = 'true';
              ev.preventDefault();
            };
            unit.addEventListener('pointerdown', ev => {
              if (ev.pointerType === 'mouse') return;
              startX = ev.clientX;
              startY = ev.clientY;
              clearLongPress();
              longPressTimer = setTimeout(() => showTouchTip(ev), 560);
            });
            unit.addEventListener('pointermove', ev => {
              if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) clearLongPress();
            });
            unit.addEventListener('pointerup', clearLongPress);
            unit.addEventListener('pointercancel', clearLongPress);
            unit.addEventListener('click', ev => {
              if (unit.dataset.longPressSuppressClick !== 'true') return;
              ev.preventDefault();
              ev.stopImmediatePropagation();
              delete unit.dataset.longPressSuppressClick;
            }, true);
          } else {
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
          }
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

    if (cfg.eventBackdrop) {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-extra event-backdrop-img';
      backdrop.style.backgroundImage = `url("${String(cfg.eventBackdrop).replace(/"/g, '%22')}")`;
      contentEl.prepend(backdrop);
    } else if (cfg.eventImage) {
      const image = document.createElement('img');
      image.className = 'modal-extra event-illustration-img';
      image.src = cfg.eventImage;
      image.alt = cfg.eventImageAlt || '';
      contentEl.appendChild(image);
    }

    choicesEl.innerHTML = '';
    const combatActionsEl = cfg.combat ? contentEl.querySelector('.combat-actions') : null;
    if (combatActionsEl) combatActionsEl.innerHTML = '';
    const actionHost = combatActionsEl || choicesEl;
    for (const choice of (cfg.choices || [])) {
      const btn = document.createElement('button');
      const combatContinueClass = cfg.combat && choice.label === '繼續' ? ' combat-continue-choice' : '';
      const extraClass = `${combatContinueClass}${choice.className ? ` ${choice.className}` : ''}`;
      btn.className = `choice-btn${choice.danger ? ' danger-choice' : ''}${choice.hint ? ' has-choice-hint' : ''}${extraClass}`;
      btn.title = choice.hint ? `${choice.label || ''}\n${choice.hint}` : (choice.label || '');
      const label = document.createElement('span');
      label.className = 'choice-label';
      if (choice.labelHtml) {
        label.innerHTML = choice.labelHtml;
      } else {
        label.textContent = choice.label;
      }
      btn.appendChild(label);
      if (choice.hint) {
        const hint = document.createElement('span');
        hint.className = 'choice-hint';
        hint.textContent = choice.hint;
        btn.appendChild(hint);
      }
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
    descEl.classList.toggle('has-combat-log-open', !!(cfg.combat && cfg.combatLog && cfg.combatLog.length > 0));
    if (cfg.combat && cfg.combatLog && cfg.combatLog.length > 0) {
      this._combatLogParentCfg = cfg;
      const detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'combat-log-open';
      detailBtn.textContent = '詳細紀錄';
      detailBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this._openCombatLogModal(cfg);
      });
      contentEl.appendChild(detailBtn);
    } else {
      this._combatLogParentCfg = null;
    }

    modal.classList.remove('hidden');
    contentEl.scrollTop = 0;
    descEl.scrollTop = 0;
    choicesEl.scrollTop = 0;
    if (cfg.combat) {
      this._bindCombatIntentArrowResize();
      requestAnimationFrame(() => this._positionCombatIntentArrow());
      setTimeout(() => this._positionCombatIntentArrow(), 160);
    } else {
      this._unbindCombatIntentArrowResize();
    }

    // Section.
    if (cfg.combatAnims) {
      const delay = Number.isFinite(cfg.combatAnims.delay) ? cfg.combatAnims.delay : 120;
      const playerDamageEvents = Array.isArray(cfg.combatAnims.playerDamageEvents) ? cfg.combatAnims.playerDamageEvents : [];
      const incomingDamageEvents = Array.isArray(cfg.combatAnims.incomingDamageEvents) ? cfg.combatAnims.incomingDamageEvents : [];
      const healEvents = Array.isArray(cfg.combatAnims.healEvents) ? cfg.combatAnims.healEvents : [];
      const playerFollowHits = Math.max(0, cfg.combatAnims.playerFollowHits || 0, playerDamageEvents.length);
      const playerFollowStepMs = 380;
      const guardBlock = Math.max(0, cfg.combatAnims.guardBlock || 0);
      const hasEnemyBlockChange = Number.isFinite(cfg.combatAnims.enemyBlockBefore) || Number.isFinite(cfg.combatAnims.enemyBlockAfter);
      const hasNextRoundEvasion = cfg.combatAnims.nextRoundEvasionByChar && Object.keys(cfg.combatAnims.nextRoundEvasionByChar).length > 0;
      const hasCombatAnim = playerFollowHits > 0 || incomingDamageEvents.length > 0 || healEvents.length > 0 || guardBlock > 0 || hasEnemyBlockChange || hasNextRoundEvasion || !!(cfg.combatAnims.counterTarget || cfg.combatAnims.aoe || cfg.combatAnims.enemyBlock);
      const hasEnemyAttack = !!(cfg.combatAnims.counterTarget || cfg.combatAnims.aoe);
      const enemyDiceWindup = hasEnemyAttack && cfg.enemyDice && cfg.enemyDice.animate !== false ? 760 : 0;
      const lockMs = delay + (guardBlock > 0 ? 260 : 0) + playerFollowHits * playerFollowStepMs + (incomingDamageEvents.length > 0 ? 520 : 0) + (cfg.combatAnims.enemyBlock ? 220 : 0) + enemyDiceWindup + (healEvents.length > 0 ? 520 : 0) + 720;
      if (cfg.combat?.enemy?.defeated) {
        const defeatDelay = playerDamageEvents.length > 0
          ? delay + playerFollowHits * playerFollowStepMs + 120
          : delay + 240;
        this._scheduleCombatEnemyDefeatState(combatSceneEl, defeatDelay, cfg.combat.enemy);
      }
      if (playerDamageEvents.length > 0) {
        this._deferCombatResultText(descEl, delay + playerFollowHits * playerFollowStepMs + 120);
      }
      if (hasCombatAnim && combatActionsEl && cfg.combatAnims.lockActions !== false) {
        const buttons = [...new Set([
          ...combatSceneEl.querySelectorAll('button'),
          ...choicesEl.querySelectorAll('button'),
        ])];
        const selectableUnits = [...combatSceneEl.querySelectorAll('.combat-unit.selectable, .combat-unit.item-target')];
        const intentArrow = combatSceneEl.querySelector('.combat-intent-arrow');
        combatSceneEl.classList.add('combat-anim-locked-scene');
        if (cfg.syncAudioAfterCombatAnims) {
          choicesEl.classList.add('combat-result-waiting');
          combatActionsEl?.classList.add('combat-result-waiting');
        }
        if (intentArrow) intentArrow.hidden = true;
        buttons.forEach(btn => { btn.disabled = true; });
        selectableUnits.forEach(unit => unit.classList.add('combat-anim-locked'));
        if (G.combat) G.combat.actionInProgress = true;
        setTimeout(() => {
          combatSceneEl.classList.remove('combat-anim-locked-scene');
          choicesEl.classList.remove('combat-result-waiting');
          combatActionsEl?.classList.remove('combat-result-waiting');
          buttons.forEach(btn => { btn.disabled = false; });
          selectableUnits.forEach(unit => unit.classList.remove('combat-anim-locked'));
          if (G.combat) G.combat.actionInProgress = false;
          this._positionCombatIntentArrow();
          if (cfg.syncAudioAfterCombatAnims) AudioManager?.sync?.();
        }, lockMs);
      }
      if (cfg.syncAudioAfterCombatAnims && (!hasCombatAnim || !combatActionsEl || cfg.combatAnims.lockActions === false)) {
        setTimeout(() => AudioManager?.sync?.(), hasCombatAnim ? lockMs : 0);
      }
      this._preparePlayerDamageSequence(playerDamageEvents);
      this._prepareEnemyBlockSequence(cfg.combatAnims);
      this._prepareAllyStatusSequence(cfg.combatAnims);
      this._prepareHealSequence(healEvents);
      this._prepareIncomingDamageSequence(incomingDamageEvents);
      setTimeout(() => this._triggerCounterAnims({ ...cfg.combatAnims, enemyDice: cfg.enemyDice || null, playerFollowStepMs }), delay);
    } else if (cfg.combat?.enemy?.defeated) {
      this._scheduleCombatEnemyDefeatState(combatSceneEl, 0, cfg.combat.enemy);
    }
  },

  _scheduleCombatEnemyDefeatState(sceneEl, delayMs = 0, enemy = null) {
    const apply = () => {
      const enemyCard = sceneEl?.querySelector?.('.combat-enemy-card.pending-defeated');
      if (!enemyCard?.isConnected) return;
      enemyCard.classList.remove('pending-defeated');
      enemyCard.classList.add('defeated');
      if (enemy?.deathSfx) AudioManager?.playSfx?.(enemy.deathSfx, enemy.deathSfxVolume ?? 0.55);
    };
    const delay = Math.max(0, Number(delayMs) || 0);
    if (delay <= 0) {
      requestAnimationFrame(apply);
      return;
    }
    setTimeout(apply, delay);
  },

  _combatBloodSplatterHtml(seed = '', variant = 'enemy') {
    const text = String(seed || variant);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash >>>= 0;
    const positions = ['0%', '50%', '100%'];
    const col = hash % 3;
    const row = Math.floor(hash / 3) % 3;
    const rotation = (Math.floor(hash / 9) % 43) - 21;
    const scale = variant === 'ally'
      ? 0.9 + ((Math.floor(hash / 387) % 13) / 100)
      : 1.04 + ((Math.floor(hash / 387) % 18) / 100);
    const flip = hash % 2 === 0 ? 1 : -1;
    return `<span class="combat-blood-splatter ${variant}" aria-hidden="true" style="--blood-pos-x:${positions[col]};--blood-pos-y:${positions[row]};--blood-rot:${rotation}deg;--blood-scale:${scale.toFixed(2)};--blood-flip:${flip};"></span>`;
  },

  _ensureCombatLogDelegation() {
    if (this._combatLogDelegationReady) return;
    this._combatLogDelegationReady = true;
    document.addEventListener('click', event => {
      const btn = event.target?.closest?.('.combat-log-open');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const cfg = this._combatLogParentCfg || (typeof G !== 'undefined' ? G.modal : null);
      if (cfg?.combatLog?.length) this._openCombatLogModal(cfg);
    }, true);
  },

  _deferCombatResultText(descEl, revealMs = 0) {
    if (!descEl || descEl.dataset.combatResultDeferred) return;
    const originalHtml = descEl.innerHTML;
    const token = `${Date.now()}-${Math.random()}`;
    descEl.dataset.combatResultDeferred = token;
      descEl.innerHTML = '<div class="combat-result-pending">攻擊中...</div>';
    setTimeout(() => {
      if (descEl.dataset.combatResultDeferred !== token) return;
      descEl.innerHTML = originalHtml;
      delete descEl.dataset.combatResultDeferred;
    }, Math.max(0, revealMs || 0));
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

  _openCombatLogModal(parentCfg) {
    try {
      const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[ch]));
      const sections = this._combatLogSections(parentCfg.combatLog || [], parentCfg.combat || null);
      const sectionHtml = sections
        .filter(section => section.lines.length > 0)
        .map(section => `
          <section class="combat-log-section">
            <h3>${escapeHtml(section.title)}</h3>
            <div class="combat-log-lines">${section.lines.map(line => `<div>${escapeHtml(line)}</div>`).join('')}</div>
          </section>
        `).join('');
      this._closeCombatLogOverlay();
      const overlay = document.createElement('div');
      overlay.className = 'combat-log-overlay';
      overlay.innerHTML = `
        <div class="combat-log-panel" role="dialog" aria-modal="true" aria-label="戰鬥詳細紀錄">
          <div class="combat-log-panel-head">
            <h2>戰鬥詳細紀錄</h2>
            <button type="button" class="combat-log-panel-close" aria-label="關閉">返回戰鬥</button>
          </div>
          <div class="combat-log-modal">${sectionHtml || '<div class="combat-log-empty">沒有詳細紀錄。</div>'}</div>
        </div>
      `;
      overlay.addEventListener('click', event => {
        if (event.target === overlay) this._closeCombatLogOverlay();
      });
      overlay.querySelector('.combat-log-panel-close')?.addEventListener('click', () => this._closeCombatLogOverlay());
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));
    } catch (err) {
      console.error('Failed to open combat log modal', err);
      const logs = Array.isArray(parentCfg?.combatLog) ? parentCfg.combatLog.map(line => String(line || '')).filter(Boolean) : [];
      this.showModal({
        title: '戰鬥詳細紀錄',
        desc: logs.length ? logs.join('\n') : '沒有詳細紀錄。',
        typeText: false,
        choices: [{ label: '返回', action: () => this.showModal({ ...parentCfg, combatAnims: null }) }],
      });
    }
  },

  _closeCombatLogOverlay() {
    document.querySelectorAll('.combat-log-overlay').forEach(el => el.remove());
  },

  triggerCombatFollowUp(charId) {
    const action = this._combatFollowUpActions?.[charId];
    if (typeof action === 'function') action();
  },

  _groupCombatLog(lines = [], combat = null) {
    const enemyName = combat?.enemy?.name || '';
    const squadNames = (combat?.squad || []).map(char => char.name).filter(Boolean);
    const grouped = { player: [], enemy: [], other: [] };
    for (const raw of lines) {
      const line = String(raw || '');
      if (!line) continue;
      if (enemyName && line.includes(enemyName)) {
        grouped.enemy.push(line);
      } else if (squadNames.some(name => line.includes(name))) {
        grouped.player.push(line);
      } else {
        grouped.other.push(line);
      }
    }
    return grouped;
  },

  _combatLogSections(lines = [], combat = null) {
    const labelFor = line => {
      const enemyName = combat?.enemy?.name || '';
      const squadNames = (combat?.squad || []).map(char => char.name).filter(Boolean);
      if (enemyName && line.includes(enemyName)) return '敵方';
      if (squadNames.some(name => line.includes(name))) return '我方';
      return '其他';
    };
    const sections = [];
    for (const raw of lines) {
      const line = String(raw || '');
      if (!line) continue;
      const title = labelFor(line);
      const last = sections[sections.length - 1];
      if (last?.title === title) {
        last.lines.push(line);
      } else {
        sections.push({ title, lines: [line] });
      }
    }
    return sections;
  },

  _escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  },

  _escapeAttr(value) {
    return this._escapeHtml(value);
  },

  _positionCombatIntentArrow() {
    const scene = document.querySelector('.combat-scene');
    const arrow = scene?.querySelector('.combat-intent-arrow');
    if (!scene || !arrow) return;
    if (scene.classList.contains('combat-anim-locked-scene')) {
      arrow.hidden = true;
      return;
    }
    const targetId = arrow.dataset.targetId || '';
    const source = scene.querySelector('.combat-enemy-card');
    const target = [...scene.querySelectorAll('.combat-unit[data-char-id]')]
      .find(unit => unit.dataset.charId === targetId);
    if (!source || !target) {
      arrow.hidden = true;
      return;
    }
    arrow.hidden = false;
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const gapRight = targetRect.left - sourceRect.right;
    const gapLeft = sourceRect.left - targetRect.right;
    const horizontal = gapRight > -12 || gapLeft > -12;
    const targetOnRight = targetRect.left >= sourceRect.left;
    const x1 = horizontal
      ? (targetOnRight ? sourceRect.right - 4 : sourceRect.left + 4)
      : sourceRect.left + sourceRect.width / 2;
    const y1 = sourceRect.top + sourceRect.height / 2;
    const x2 = horizontal
      ? (targetOnRight ? targetRect.left + 6 : targetRect.right - 6)
      : targetRect.left + targetRect.width / 2;
    const y2 = horizontal ? targetRect.top + targetRect.height / 2 : targetRect.top - 8;
    arrow.setAttribute('viewBox', `0 0 ${Math.max(1, window.innerWidth)} ${Math.max(1, window.innerHeight)}`);
    arrow.querySelector('line')?.setAttribute('x1', x1);
    arrow.querySelector('line')?.setAttribute('y1', y1);
    arrow.querySelector('line')?.setAttribute('x2', x2);
    arrow.querySelector('line')?.setAttribute('y2', y2);
    arrow.querySelector('circle')?.setAttribute('cx', x1);
    arrow.querySelector('circle')?.setAttribute('cy', y1);
  },

  _bindCombatIntentArrowResize() {
    if (this._combatIntentArrowResizeHandler) return;
    this._combatIntentArrowResizeHandler = () => {
      if (this._combatIntentArrowResizeFrame) cancelAnimationFrame(this._combatIntentArrowResizeFrame);
      this._combatIntentArrowResizeFrame = requestAnimationFrame(() => {
        this._combatIntentArrowResizeFrame = null;
        this._positionCombatIntentArrow();
      });
    };
    window.addEventListener('resize', this._combatIntentArrowResizeHandler);
    window.addEventListener('orientationchange', this._combatIntentArrowResizeHandler);
  },

  _unbindCombatIntentArrowResize() {
    if (!this._combatIntentArrowResizeHandler) return;
    window.removeEventListener('resize', this._combatIntentArrowResizeHandler);
    window.removeEventListener('orientationchange', this._combatIntentArrowResizeHandler);
    this._combatIntentArrowResizeHandler = null;
    if (this._combatIntentArrowResizeFrame) {
      cancelAnimationFrame(this._combatIntentArrowResizeFrame);
      this._combatIntentArrowResizeFrame = null;
    }
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
    AudioManager?.playSfx?.('dice');
    if (roleDiceEl) {
      roleDiceEl.classList.add('dice-rolling');
      this._setModalDiceFace(faceEl, roleDiceEl, Math.ceil(Math.random() * sides));
    } else {
      diceEl.classList.add('dice-rolling');
      this._setModalDiceFace(faceEl, roleDiceEl, Math.ceil(Math.random() * sides));
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

  _animateCombatEnemyDice(sceneEl, dice) {
    const diceEl = sceneEl?.querySelector('.combat-floating-enemy-dice .combat-card-dice.enemy');
    if (!diceEl) return;
    const finalValue = Number(dice?.value || 1);
    const sides = Math.max(1, Number(diceEl.dataset.sides || dice?.sides || 6));
    let count = 0;
    const STEPS = 10;
    const MS = 72;
    AudioManager?.playSfx?.('dice');
    diceEl.classList.add('dice-rolling');
    this._setModalDiceFace(null, diceEl, Math.ceil(Math.random() * sides));
    const timer = setInterval(() => {
      count++;
      if (count < STEPS) {
        this._setModalDiceFace(null, diceEl, Math.ceil(Math.random() * sides));
        return;
      }
      clearInterval(timer);
      this._setModalDiceFace(null, diceEl, finalValue);
      diceEl.classList.remove('dice-rolling');
      diceEl.classList.add('dice-pip-settled');
    }, MS);
  },

  _revealModalAfterDice() {
    const descEl = document.getElementById('modal-desc');
    const choicesEl = document.getElementById('modal-choices');
    if (descEl && ('resultDesc' in descEl.dataset || 'resultAppend' in descEl.dataset)) {
      const resultDesc = descEl.dataset.resultDesc;
      const preDesc = descEl.dataset.preDesc || '';
      const hasExplicitAppend = 'resultAppend' in descEl.dataset;
      const hasExplicitAppendHtml = 'resultAppendHtml' in descEl.dataset;
      const resultAppend = descEl.dataset.resultAppend;
      const resultAppendHtml = descEl.dataset.resultAppendHtml;
      const preDescHtml = descEl.dataset.preDescHtml;
      const resultTitle = descEl.dataset.resultTitle;
      const resultBackdrop = descEl.dataset.resultBackdrop;
      const resultFx = descEl.dataset.resultFx;
      const resultSfx = descEl.dataset.resultSfx;
      const resultSfxVolume = Number(descEl.dataset.resultSfxVolume);
      delete descEl.dataset.resultDesc;
      delete descEl.dataset.preDesc;
      delete descEl.dataset.resultAppend;
      delete descEl.dataset.resultAppendHtml;
      delete descEl.dataset.preDescHtml;
      delete descEl.dataset.resultTitle;
      delete descEl.dataset.resultBackdrop;
      delete descEl.dataset.resultFx;
      delete descEl.dataset.resultSfx;
      delete descEl.dataset.resultSfxVolume;
      if (resultTitle) {
        const titleEl = document.getElementById('modal-title');
        if (titleEl) titleEl.textContent = resultTitle;
      }
      if (resultBackdrop) {
        const contentEl = document.querySelector('#event-modal .modal-content');
        const backdropEl = contentEl?.querySelector('.event-backdrop-img');
        if (backdropEl) backdropEl.style.backgroundImage = `url("${String(resultBackdrop).replace(/"/g, '%22')}")`;
      }
      if (resultFx) {
        const contentEl = document.querySelector('#event-modal .modal-content');
        contentEl?.classList.add(resultFx);
        this._playModalResultFx(contentEl, resultFx);
      }
      if (resultSfx) {
        this._playModalResultSfx(resultSfx, Number.isFinite(resultSfxVolume) ? resultSfxVolume : undefined);
      }
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
        if (preDescHtml) {
          introEl.innerHTML = preDescHtml;
        } else {
          introEl.textContent = preDesc || introEl.textContent;
        }
        introEl.classList.remove('typing');
      }
      resultEl.textContent = '';
      resultEl.hidden = false;
      resultEl.classList.remove('typing');
      resultEl.classList.remove(
        'fate-result-reveal',
        'fate-roll-success',
        'fate-fail-blood',
        'fate-fail-night',
        'fate-fail-life'
      );
      if (resultFx) resultEl.classList.add('fate-result-reveal', resultFx);
      const currentText = introEl ? introEl.textContent : descEl.textContent;
      const resultText = hasExplicitAppend
        ? resultAppend
        : this._resultAppendText(preDesc, resultDesc);
      const cleanResultText = String(resultText || '').replace(/^\n+/, '');
      const separator = !introEl && currentText && cleanResultText ? '\n\n' : '';
      if (hasExplicitAppendHtml) {
        resultEl.innerHTML = `${!introEl && currentText ? '<br><br>' : ''}${resultAppendHtml || ''}`;
        if (choicesEl) {
          [...choicesEl.querySelectorAll('button')].forEach(btn => { btn.disabled = false; });
          choicesEl.classList.remove('result-waiting');
          choicesEl.style.visibility = '';
          choicesEl.style.pointerEvents = '';
        }
        return;
      }
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

  _defaultModalResultFx(cfg) {
    return '';
  },

  _defaultModalIntroFx(cfg) {
    if (!cfg || cfg.combat || cfg.combatAnims || cfg.characterDetail || cfg.tutorialModal || cfg.wagerModal) return '';
    if (!cfg.resultFx && (cfg.eventImage || cfg.eventBackdrop)) return 'scene';
    return '';
  },

  _playModalResultSfx(id, volume) {
    if (!id) return;
    if (id === 'eventInjury') {
      const playInjury = () => AudioManager?.playEventInjurySfx?.(volume);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(playInjury);
      } else {
        playInjury();
      }
      return;
    }
    const play = () => AudioManager?.playSfx?.(id, volume);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(play);
    } else {
      play();
    }
  },

  _playModalResultFx(contentEl, fx) {
    if (!contentEl || typeof FxPlayer === 'undefined') return;
    if (this._modalFxCleanup) {
      this._modalFxCleanup();
      this._modalFxCleanup = null;
    }
    contentEl.querySelectorAll(':scope > .event-fx-layer').forEach(el => el.remove());
    if (fx === 'event-discover') {
      this._modalFxCleanup = FxPlayer.after(140, () => {
        if (!contentEl.isConnected) return;
        this._modalFxCleanup = FxPlayer.layer(contentEl, 'event-fx-layer event-discover-fx-layer', [
          { className: 'event-discover-fx-glow' },
          { className: 'event-discover-fx-ring' },
          { className: 'event-discover-fx-ray event-discover-fx-ray-a' },
          { className: 'event-discover-fx-ray event-discover-fx-ray-b' },
          { className: 'event-discover-fx-mote', style: { '--x': '24%', '--y': '42%', '--delay': '160ms' } },
          { className: 'event-discover-fx-mote', style: { '--x': '40%', '--y': '30%', '--delay': '240ms' } },
          { className: 'event-discover-fx-mote', style: { '--x': '64%', '--y': '36%', '--delay': '200ms' } },
          { className: 'event-discover-fx-mote', style: { '--x': '72%', '--y': '56%', '--delay': '320ms' } },
        ], 1280);
      });
      return;
    }
    if (fx === 'event-reward') {
      this._modalFxCleanup = FxPlayer.after(120, () => {
        if (!contentEl.isConnected) return;
        this._modalFxCleanup = FxPlayer.layer(contentEl, 'event-fx-layer event-reward-fx-layer', [
          { className: 'event-reward-fx-warmth' },
          { className: 'event-reward-fx-sheen' },
          { className: 'event-reward-fx-spark', style: { '--x': '22%', '--y': '64%', '--delay': '180ms' } },
          { className: 'event-reward-fx-spark', style: { '--x': '38%', '--y': '44%', '--delay': '260ms' } },
          { className: 'event-reward-fx-spark', style: { '--x': '58%', '--y': '34%', '--delay': '220ms' } },
          { className: 'event-reward-fx-spark', style: { '--x': '76%', '--y': '58%', '--delay': '340ms' } },
        ], 1180);
      });
      return;
    }
    if (fx === 'event-quiet') {
      this._modalFxCleanup = FxPlayer.after(180, () => {
        if (!contentEl.isConnected) return;
        this._modalFxCleanup = FxPlayer.layer(contentEl, 'event-fx-layer event-quiet-fx-layer', [
          { className: 'event-quiet-fx-hush' },
          { className: 'event-quiet-fx-dust', style: { '--x': '28%', '--y': '46%', '--delay': '0ms' } },
          { className: 'event-quiet-fx-dust', style: { '--x': '48%', '--y': '34%', '--delay': '180ms' } },
          { className: 'event-quiet-fx-dust', style: { '--x': '62%', '--y': '58%', '--delay': '260ms' } },
          { className: 'event-quiet-fx-dust', style: { '--x': '74%', '--y': '42%', '--delay': '360ms' } },
        ], 1320);
      });
      return;
    }
    if (fx === 'resonance-awaken') {
      this._modalFxCleanup = FxPlayer.after(100, () => {
        if (!contentEl.isConnected) return;
        this._modalFxCleanup = FxPlayer.layer(contentEl, 'event-fx-layer resonance-awaken-fx-layer', [
          { className: 'resonance-awaken-fx-vignette' },
          { className: 'resonance-awaken-fx-beam resonance-awaken-fx-beam-a' },
          { className: 'resonance-awaken-fx-beam resonance-awaken-fx-beam-b' },
          { className: 'resonance-awaken-fx-rune resonance-awaken-fx-rune-a' },
          { className: 'resonance-awaken-fx-rune resonance-awaken-fx-rune-b' },
          { className: 'resonance-awaken-fx-rune resonance-awaken-fx-rune-c' },
          { className: 'resonance-awaken-fx-mote', style: { '--x': '20%', '--y': '54%', '--delay': '120ms' } },
          { className: 'resonance-awaken-fx-mote', style: { '--x': '34%', '--y': '28%', '--delay': '220ms' } },
          { className: 'resonance-awaken-fx-mote', style: { '--x': '62%', '--y': '32%', '--delay': '160ms' } },
          { className: 'resonance-awaken-fx-mote', style: { '--x': '78%', '--y': '58%', '--delay': '280ms' } },
        ], 1500);
      });
      return;
    }
    if (fx !== 'event-ambush') return;
    const embers = [
      ['22%', '68%', '-16px', '10px', '280ms', '2px'],
      ['34%', '72%', '-20px', '6px', '380ms', '2px'],
      ['66%', '70%', '18px', '8px', '340ms', '2px'],
      ['78%', '64%', '14px', '12px', '460ms', '2px'],
    ];
    const warningLines = [
      ['30%', '48%', '220ms', '120px'],
      ['50%', '51%', '340ms', '170px'],
      ['70%', '47%', '460ms', '120px'],
    ];
    this._modalFxCleanup = FxPlayer.after(180, () => {
      if (!contentEl.isConnected) return;
      this._modalFxCleanup = FxPlayer.layer(contentEl, 'event-fx-layer event-ambush-fx-layer', [
        { className: 'event-ambush-fx-field' },
        { className: 'event-ambush-fx-shadow event-ambush-fx-shadow-left' },
        { className: 'event-ambush-fx-shadow event-ambush-fx-shadow-right' },
        { className: 'event-ambush-fx-eye' },
        ...warningLines.map(([x, y, delay, width]) => ({
          className: 'event-ambush-fx-warning-line',
          style: {
            '--x': x,
            '--y': y,
            '--delay': delay,
            '--w': width,
          },
        })),
        ...embers.map(([x, y, dx, dy, delay, size]) => ({
          className: 'event-ambush-fx-ember',
          style: {
            '--x': x,
            '--y': y,
            '--dx': dx,
            '--dy': dy,
            '--delay': delay,
            '--size': size,
          },
        })),
      ], 1350);
    });
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

  _preparePlayerDamageSequence(events = []) {
    const cleanEvents = events.filter(event => Number.isFinite(event?.from) && Number.isFinite(event?.to));
    if (cleanEvents.length === 0) return;
    this._setDisplayedEnemyHp(cleanEvents[0].from);
    const blockEvent = cleanEvents.find(event => Number.isFinite(event?.enemyBlockBefore));
    if (blockEvent) this._setDisplayedEnemyBlock(blockEvent.enemyBlockBefore);
  },

  _setDisplayedEnemyHp(value) {
    const fill = document.querySelector('.combat-enemy-hp-fill');
    const text = document.querySelector('.combat-enemy-hp-text');
    const max = Number(text?.dataset.maxHp || 0);
    const hp = Math.max(0, Math.round(value || 0));
    if (fill && max > 0) {
      const pct = Math.max(0, Math.min(100, (hp / max) * 100));
      fill.style.width = `${pct}%`;
      fill.classList.toggle('critical', pct <= 25);
      fill.classList.toggle('low', pct > 25 && pct <= 50);
    }
    if (text && max > 0) text.textContent = `${hp}/${max}`;
  },

  _prepareEnemyBlockSequence(anims = {}) {
    if (Number.isFinite(anims?.enemyBlockBefore)) this._setDisplayedEnemyBlock(anims.enemyBlockBefore);
  },

  _setDisplayedEnemyBlock(value) {
    const panel = document.querySelector('.combat-enemy-block-panel');
    if (!panel) return;
    const block = Math.max(0, Math.round(value || 0));
    const valueEl = panel.querySelector('.combat-enemy-block-value');
    if (valueEl) valueEl.textContent = String(block);
    panel.classList.toggle('empty', block <= 0);
    panel.disabled = block <= 0;
    if (block > 0) {
      panel.setAttribute('onclick', 'event.stopPropagation(); Game.showCombatBlockDetail(event)');
      panel.setAttribute('title', `格檔 ${block}：會先抵銷受到的傷害`);
      panel.removeAttribute('aria-hidden');
    } else {
      panel.removeAttribute('onclick');
      panel.setAttribute('title', '');
      panel.setAttribute('aria-hidden', 'true');
    }
  },

  _prepareAllyStatusSequence(anims = {}) {
    const beforeGroups = [anims?.guardBlockBeforeByChar, anims?.nextRoundBlockBeforeByChar];
    beforeGroups
      .filter(blocks => blocks && typeof blocks === 'object')
      .forEach(blocks => {
        Object.entries(blocks).forEach(([charId, block]) => this._setDisplayedAllyBlock(charId, block, { animateBreak: false }));
      });
    const evasionBefore = anims?.nextRoundEvasionBeforeByChar;
    if (evasionBefore && typeof evasionBefore === 'object') {
      Object.entries(evasionBefore).forEach(([charId, chance]) => this._setDisplayedAllyEvasion(charId, chance));
    }
  },

  _prepareIncomingDamageSequence(events = []) {
    const cleanEvents = events.filter(event => event?.targetId && Number.isFinite(event.from) && Number.isFinite(event.to));
    for (const event of cleanEvents) {
      this._setDisplayedAllyHp(event.targetId, event.from);
      if (Number.isFinite(event.allyBlockBefore)) this._setDisplayedAllyBlock(event.targetId, event.allyBlockBefore, { animateBreak: false });
    }
  },

  _prepareHealSequence(events = []) {
    const cleanEvents = events.filter(event => event?.targetId && Number.isFinite(event.from) && Number.isFinite(event.to));
    for (const event of cleanEvents) this._setDisplayedAllyHp(event.targetId, event.from);
  },

  _setDisplayedAllyHp(charId, value) {
    const unit = document.querySelector(`.combat-unit[data-char-id="${charId}"]`);
    if (!unit) return;
    const fill = unit.querySelector('.combat-ally-hp-fill');
    const text = unit.querySelector('.combat-ally-hp-text');
    const max = Number(text?.dataset.maxHp || 0);
    const hp = Math.max(0, Math.round(value || 0));
    if (fill && max > 0) {
      const pct = Math.max(0, Math.min(100, (hp / max) * 100));
      fill.style.width = `${pct}%`;
      fill.classList.toggle('critical', pct <= 25);
      fill.classList.toggle('low', pct > 25 && pct <= 50);
    }
    if (text && max > 0) text.textContent = `${hp}/${max}`;
    unit.classList.toggle('down', hp <= 0);
    if (hp > 0) {
      unit.querySelectorAll('.combat-blood-splatter.ally').forEach(el => el.remove());
    } else if (!unit.querySelector('.combat-blood-splatter.ally')) {
      unit.insertAdjacentHTML('beforeend', this._combatBloodSplatterHtml(charId, 'ally'));
    }
  },

  _setDisplayedAllyBlock(charId, value, opts = {}) {
    const unit = document.querySelector(`.combat-unit[data-char-id="${charId}"]`);
    if (!unit) return;
    const block = Math.max(0, Math.round(value || 0));
    let badge = unit.querySelector('.combat-block-badge.ally');
    if (!badge && block > 0) {
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'combat-block-badge ally';
      badge.setAttribute('onclick', `event.stopPropagation(); Game.showCombatAllyBlockDetail('${charId}', event)`);
      badge.innerHTML = `
        <span class="combat-block-main">
          <img class="combat-block-icon" src="assets/icons/block-icon-clean.png" alt="格檔">
          <strong>${block}</strong>
        </span>
      `;
      const statusRow = unit.querySelector('.combat-unit-main') || unit;
      statusRow.appendChild(badge);
    }
    if (!badge) return;
    if (block <= 0) {
      if (opts.animateBreak === false) {
        badge.remove();
        return;
      }
      badge.classList.add('anim-guard-break');
      setTimeout(() => badge.remove(), 180);
      return;
    }
    const valueEl = badge.querySelector('strong');
    if (valueEl) valueEl.textContent = String(block);
    badge.title = `格檔 ${block}：會先吸收受到的傷害`;
  },

  _setDisplayedAllyEvasion(charId, value) {
    const unit = document.querySelector(`.combat-unit[data-char-id="${charId}"]`);
    if (!unit) return;
    const chance = Math.max(0, Math.min(50, Math.round(value || 0)));
    let badge = unit.querySelector('.combat-status-badge.evasion');
    if (chance <= 0) {
      badge?.remove();
      return;
    }
    const html = this._combatAllyEvasionBadgeHtml({ id: charId }, chance).trim();
    if (badge) {
      badge.outerHTML = html;
    } else {
      const statusRow = unit.querySelector('.combat-unit-main') || unit;
      statusRow.insertAdjacentHTML('beforeend', html);
    }
  },

  _showCombatDamageNumber(targetEl, damage, opts = {}) {
    if (!targetEl || !Number.isFinite(damage) || damage <= 0) return;
    const sceneEl = opts.scene || targetEl.closest('.combat-scene');
    if (!sceneEl) return;
    const targetRect = targetEl.getBoundingClientRect();
    const sceneRect = sceneEl.getBoundingClientRect();
    const pop = document.createElement('div');
    const kindClass = opts.kind ? ` ${opts.kind}` : '';
    pop.className = `combat-damage-pop ${opts.side === 'ally' ? 'ally' : 'enemy'}${kindClass}`;
    pop.setAttribute('aria-hidden', 'true');
    const digits = String(Math.round(damage)).split('');
    if (opts.kind === 'heal') {
      pop.textContent = String(Math.round(damage));
    } else {
      for (const char of digits) {
        const digit = Number(char);
        if (!Number.isFinite(digit)) continue;
        const img = document.createElement('img');
        img.className = 'combat-damage-digit';
        img.src = `assets/effects/damage-digits/${digit}.png`;
        img.alt = '';
        pop.appendChild(img);
      }
    }
    if (!pop.children.length && !pop.textContent) return;
    const x = targetRect.left - sceneRect.left + targetRect.width / 2;
    const y = targetRect.top - sceneRect.top + (opts.side === 'ally' ? 30 : 104) + (opts.offsetY || 0);
    pop.style.left = `${Math.round(x)}px`;
    pop.style.top = `${Math.round(y)}px`;
    sceneEl.appendChild(pop);
    FxPlayer.removeAfter(pop, 1220);
  },

  _showCombatHitEffect(targetEl, effect = '', opts = {}) {
    if (!targetEl || !effect) return;
    const sceneEl = opts.scene || targetEl.closest('.combat-scene');
    if (!sceneEl) return;
    const targetRect = targetEl.getBoundingClientRect();
    const sceneRect = sceneEl.getBoundingClientRect();
    const sourceRect = opts.sourceEl?.getBoundingClientRect?.() || null;
    const fx = document.createElement('div');
    fx.className = `combat-hit-effect hit-${effect}`;
    fx.setAttribute('aria-hidden', 'true');
    const x = targetRect.left - sceneRect.left + targetRect.width / 2;
    const y = targetRect.top - sceneRect.top + (opts.side === 'ally' ? 54 : 72);
    fx.style.left = `${Math.round(x)}px`;
    fx.style.top = `${Math.round(y)}px`;
    if (sourceRect) {
      const sourceX = sourceRect.left + sourceRect.width / 2;
      const sourceY = sourceRect.top + sourceRect.height / 2;
      const targetX = targetRect.left + targetRect.width / 2;
      const targetY = targetRect.top + (opts.side === 'ally' ? 54 : 72);
      const angle = Math.atan2(targetY - sourceY, targetX - sourceX) * 180 / Math.PI;
      fx.style.setProperty('--hit-angle', `${angle}deg`);
    }
    sceneEl.appendChild(fx);
    FxPlayer.removeAfter(fx, effect === 'wound-burst' ? 860 : 760);
  },

  _showCombatAttackTrail(targetEl, trail = '', opts = {}) {
    if (!targetEl || !trail || !['pierce', 'slash', 'strike', 'silver_bee_pin', 'iron_scabbard', 'star_hunter_eye', 'star_breaker', 'shell_impact', 'jaw_bite', 'poison_cloud', 'dark_avatar'].includes(trail)) return;
    const sceneEl = opts.scene || targetEl.closest('.combat-scene');
    let sourceRect = opts.sourceEl?.getBoundingClientRect?.() || null;
    if (!sceneEl || !sourceRect) return;
    const targetRect = targetEl.getBoundingClientRect();
    const sceneRect = sceneEl.getBoundingClientRect();
    const sourceWeaponFamily = opts.weaponFamily || opts.sourceEl?.dataset?.weaponFamily || '';
    const swordSlash = trail === 'slash' && sourceWeaponFamily === 'sword';
    const daggerSlash = trail === 'slash' && sourceWeaponFamily === 'dagger';
    const ironScabbard = trail === 'iron_scabbard';
    const starHunterEye = trail === 'star_hunter_eye';
    const starBreaker = trail === 'star_breaker';
    const shellImpact = trail === 'shell_impact';
    const jawBite = trail === 'jaw_bite';
    const poisonCloud = trail === 'poison_cloud';
    const darkAvatar = trail === 'dark_avatar';
    if (darkAvatar) {
      sourceRect = opts.sourceEl?.querySelector?.('.combat-enemy-sprite')?.getBoundingClientRect?.() || sourceRect;
    }
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const fixedTargetTrail = swordSlash || daggerSlash || ironScabbard || starHunterEye || starBreaker || shellImpact || jawBite || poisonCloud;
    const enemyFigureRect = fixedTargetTrail && opts.side === 'enemy'
      ? targetEl.querySelector('.combat-enemy-figure')?.getBoundingClientRect?.()
      : null;
    const enemySpriteRect = fixedTargetTrail && opts.side === 'enemy' && !targetEl.classList.contains('has-card-bg')
      ? targetEl.querySelector('.combat-enemy-sprite')?.getBoundingClientRect?.()
      : null;
    const allyArtRect = darkAvatar && opts.side === 'ally'
      ? targetEl.querySelector('.combat-character-art')?.getBoundingClientRect?.()
      : null;
    const allyMainRect = darkAvatar && opts.side === 'ally'
      ? targetEl.querySelector('.combat-unit-main')?.getBoundingClientRect?.()
      : null;
    const impactRect = allyArtRect || allyMainRect || enemySpriteRect || enemyFigureRect || targetRect;
    const targetX = impactRect.left + impactRect.width / 2;
    const targetY = darkAvatar && opts.side === 'ally'
      ? impactRect.top + impactRect.height * 0.42
      : targetEl.classList.contains('has-card-bg') && fixedTargetTrail
      ? targetRect.top + 118
      : (impactRect === targetRect ? targetRect.top + (opts.side === 'ally' ? 54 : 72) : impactRect.top + impactRect.height / 2);
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.max(120, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const fx = document.createElement('div');
    const trailClass = String(trail).replace(/_/g, '-');
    fx.className = `combat-attack-trail trail-${trailClass}${swordSlash ? ' trail-sword-slash' : ''}${daggerSlash ? ' trail-dagger-slash' : ''}`;
    fx.setAttribute('aria-hidden', 'true');
    if (trail === 'pierce' || trail === 'silver_bee_pin' || darkAvatar) {
      fx.style.left = `${Math.round(sourceX - sceneRect.left)}px`;
      fx.style.top = `${Math.round(sourceY - sceneRect.top)}px`;
      fx.style.width = `${Math.round(distance)}px`;
      fx.style.setProperty('--trail-angle', `${angle}deg`);
    } else if (fixedTargetTrail) {
      fx.style.left = `${Math.round(targetX - sceneRect.left)}px`;
      fx.style.top = `${Math.round(targetY - sceneRect.top)}px`;
      fx.style.setProperty('--trail-angle', `${angle}deg`);
    } else {
      fx.style.left = `${Math.round(targetX - sceneRect.left)}px`;
      fx.style.top = `${Math.round(targetY - sceneRect.top)}px`;
      fx.style.setProperty('--trail-angle', `${sourceX <= targetX ? -32 : 32}deg`);
    }
    sceneEl.appendChild(fx);
    const durationByTrail = {
      pierce: 620,
      slash: daggerSlash ? 700 : (swordSlash ? 740 : 620),
      strike: 620,
      silver_bee_pin: 620,
      iron_scabbard: 940,
      star_hunter_eye: 720,
      star_breaker: 820,
      shell_impact: 760,
      jaw_bite: 760,
      poison_cloud: 820,
      dark_avatar: 920,
    };
    FxPlayer.removeAfter(fx, durationByTrail[trail] || 620);
  },

  _pulseCombatImpact(sceneEl, damage = 0, opts = {}) {
    if (!sceneEl) return;
    const cls = opts.crushing ? 'combat-impact-crushing' : (damage >= 8 ? 'combat-impact-heavy' : 'combat-impact-light');
    sceneEl.classList.remove('combat-impact-light', 'combat-impact-heavy', 'combat-impact-crushing');
    FxPlayer.restartClass(sceneEl, cls, opts.crushing ? 430 : (damage >= 8 ? 280 : 210));
  },

  _preloadCombatDamageDigits() {
    if (this._combatDamageDigitsPreloaded) return;
    this._combatDamageDigitsPreloaded = true;
    this._combatDamageDigitsImages = Array.from({ length: 10 }, (_, digit) => {
      const img = new Image();
      img.src = `assets/effects/damage-digits/${digit}.png`;
      return img;
    });
  },

  _triggerCounterAnims({ playerAttacker, playerFollowHits = 0, playerDamageEvents = [], incomingDamageEvents = [], healEvents = [], playerFollowStepMs = 380, guardBlock = 0, guardTargetId = null, guardRemainingBlockByChar = null, nextRoundBlockBeforeByChar = null, nextRoundBlockByChar = null, nextRoundEvasionBeforeByChar = null, nextRoundEvasionByChar = null, counterTarget, aoe, enemyBlock, enemyBlockAfter = null, enemyDice = null, enemyAttackTrail = '', enemyAttackTrailFamily = '', enemyAttackSfx = '', enemyAttackSfxVolume = null }) {
    this._preloadCombatDamageDigits();
    const enemyCard = document.querySelector('.combat-enemy-card');
    const combatScene = enemyCard?.closest('.combat-scene') || document.querySelector('.combat-scene');
    const findAllyUnit = charId => combatScene?.querySelector(`.combat-unit.ally[data-char-id="${charId}"]`) || null;
    const playAllyDeathSfxOnce = event => {
      if (!event?.targetId || !event.deathSfx) return;
      const char = (typeof G !== 'undefined' ? G.squad : [])
        ?.find?.(item => item?.id === event.targetId);
      if (char?._deathSfxPlayed) return;
      if (char) char._deathSfxPlayed = true;
      AudioManager?.playSfx?.(event.deathSfx, event.deathSfxVolume ?? 0.58);
    };
    const damageEvents = Array.isArray(playerDamageEvents) ? playerDamageEvents : [];
    const incomingEvents = Array.isArray(incomingDamageEvents) ? incomingDamageEvents : [];
    const healingEvents = Array.isArray(healEvents) ? healEvents : [];
    const remainingBlocks = guardRemainingBlockByChar && typeof guardRemainingBlockByChar === 'object' ? guardRemainingBlockByChar : null;
    const nextRoundBlocks = nextRoundBlockByChar && typeof nextRoundBlockByChar === 'object' ? nextRoundBlockByChar : null;
    const nextRoundEvasions = nextRoundEvasionByChar && typeof nextRoundEvasionByChar === 'object' ? nextRoundEvasionByChar : null;
    const shouldShowGuard = Math.max(0, guardBlock || 0) > 0;
    const followHits = Math.max(0, playerFollowHits || 0, damageEvents.length);
    const followStep = Math.max(260, playerFollowStepMs || 380);
    if (!followHits && !incomingEvents.length && !healingEvents.length && !shouldShowGuard && !counterTarget && !aoe && !enemyBlock && !remainingBlocks && !nextRoundBlocks && !nextRoundEvasions) return;
    let lastBlockUpSfxAt = 0;
    const playBlockUpSfx = () => {
      const now = performance.now();
      if (now - lastBlockUpSfxAt < 90) return;
      lastBlockUpSfxAt = now;
      AudioManager?.playSfx?.('blockUp', 0.48);
    };
    let lastFullBlockSfxAt = 0;
    const playFullBlockSfx = () => {
      const now = performance.now();
      if (now - lastFullBlockSfxAt < 90) return;
      lastFullBlockSfxAt = now;
      AudioManager?.playSfx?.('blockFull', 0.52);
    };
    const showBlockUpBurst = targetEl => {
      if (!targetEl) return;
      const burst = document.createElement('span');
      burst.className = 'combat-block-up-burst';
      burst.setAttribute('aria-hidden', 'true');
      burst.innerHTML = '<img src="assets/icons/block-icon-clean.png" alt="">';
      targetEl.appendChild(burst);
      setTimeout(() => burst.remove(), 620);
    };
    let remainingBlocksApplied = false;
    const applyRemainingBlocks = () => {
      if (!remainingBlocks || remainingBlocksApplied) return;
      remainingBlocksApplied = true;
      Object.entries(remainingBlocks).forEach(([charId, block]) => this._setDisplayedAllyBlock(charId, block));
    };
    let nextRoundBlocksApplied = false;
    const applyNextRoundStatuses = () => {
      if (nextRoundBlocksApplied) return;
      nextRoundBlocksApplied = true;
      if (nextRoundBlocks) {
        Object.entries(nextRoundBlocks).forEach(([charId, block]) => {
          this._setDisplayedAllyBlock(charId, block);
          const unit = findAllyUnit(charId);
          if (!unit) return;
          playBlockUpSfx();
          showBlockUpBurst(unit);
          FxPlayer.restartClass(unit, 'anim-guard-up', 520);
          const badge = unit.querySelector('.combat-block-badge');
          if (badge) FxPlayer.restartClass(badge, 'anim-guard-badge', 520);
        });
      }
      if (nextRoundEvasions) {
        Object.entries(nextRoundEvasions).forEach(([charId, chance]) => {
          this._setDisplayedAllyEvasion(charId, chance);
          const unit = findAllyUnit(charId);
          if (!unit) return;
          FxPlayer.restartClass(unit, 'anim-evasion-up', 520);
          const badge = unit.querySelector('.combat-status-badge.evasion');
          if (badge) FxPlayer.restartClass(badge, 'anim-evasion-badge', 520);
        });
      }
    };

    if (shouldShowGuard) {
      const guardUnits = guardTargetId
        ? [...document.querySelectorAll(`.combat-unit.ally[data-char-id="${guardTargetId}"]`)]
        : [...document.querySelectorAll('.combat-unit.ally:not(.empty-slot)')];
      guardUnits.forEach(el => {
        playBlockUpSfx();
        showBlockUpBurst(el);
        FxPlayer.restartClass(el, 'anim-guard-up', 520);
        const badge = el.querySelector('.combat-block-badge');
        if (badge) FxPlayer.restartClass(badge, 'anim-guard-badge', 520);
      });
      setTimeout(applyRemainingBlocks, 80);
    }

    for (let i = 0; i < followHits; i++) {
      setTimeout(() => {
        const attackerEl = playerAttacker ? findAllyUnit(playerAttacker) : null;
        if (attackerEl) {
          FxPlayer.restartClass(attackerEl, 'anim-lunge', 340);
        }
        if (enemyCard) {
          setTimeout(() => {
            FxPlayer.restartClass(enemyCard, 'anim-hit', 300);
            const damageEvent = damageEvents[i];
            if (damageEvent) {
              const relicFx = damageEvent.relicFx || '';
              const delayedRelicFx = ['star_hunter_eye', 'star_breaker'].includes(relicFx);
              const attackTrail = delayedRelicFx
                ? (damageEvent.attackTrail || damageEvent.hitEffect)
                : (relicFx || damageEvent.attackTrail || damageEvent.hitEffect);
              const hitEffect = damageEvent.hitEffect || '';
              const layeredWeaponHit = ['slash', 'strike', 'pierce', 'silver_bee_pin', 'iron_scabbard', 'star_hunter_eye', 'star_breaker'].includes(attackTrail);
              const visualHitEffect = relicFx ? '' : (hitEffect === 'eagle-mark' && layeredWeaponHit ? 'weak-flash' : hitEffect);
              const heavyRelicImpact = ['iron_scabbard', 'star_breaker'].includes(relicFx);
              this._pulseCombatImpact(combatScene, damageEvent.damage, { crushing: heavyRelicImpact });
              if (damageEvent.sfx) AudioManager?.playSfx?.(damageEvent.sfx, 0.44);
              this._showCombatAttackTrail(enemyCard, attackTrail, { side: 'enemy', scene: combatScene, sourceEl: attackerEl });
              if (Number.isFinite(damageEvent.enemyBlockAfter)) {
                this._setDisplayedEnemyBlock(damageEvent.enemyBlockAfter);
                if (damageEvent.enemyBlockAbsorbed > 0 && damageEvent.damage <= 0) playFullBlockSfx();
              }
              if (delayedRelicFx) {
                setTimeout(() => {
                  this._showCombatAttackTrail(enemyCard, relicFx, { side: 'enemy', scene: combatScene, sourceEl: attackerEl });
                }, 180);
              }
              if (heavyRelicImpact) {
                setTimeout(() => {
                  FxPlayer.restartClass(enemyCard, 'anim-heavy-relic-hit', 620);
                }, delayedRelicFx ? 180 : 0);
              }
              if (relicFx === 'iron_scabbard' && attackerEl) {
                setTimeout(() => {
                  FxPlayer.restartClass(attackerEl, 'anim-iron-scabbard-empower', 760);
                }, 160);
              }
              if (visualHitEffect && (!['slash', 'strike', 'pierce'].includes(visualHitEffect) || visualHitEffect !== attackTrail)) {
                this._showCombatHitEffect(enemyCard, visualHitEffect, { side: 'enemy', scene: combatScene, sourceEl: attackerEl });
              }
              const showDamageNumber = () => this._showCombatDamageNumber(enemyCard, damageEvent.damage, {
                side: 'enemy',
                scene: combatScene,
                offsetY: relicFx ? -24 : 0,
              });
              setTimeout(showDamageNumber, delayedRelicFx ? 300 : (relicFx ? 220 : 140));
            }
          }, 120);
        }
        const damageEvent = damageEvents[i];
        if (damageEvent && Number.isFinite(damageEvent.to)) {
          setTimeout(() => this._setDisplayedEnemyHp(damageEvent.to), 170);
        }
      }, i * followStep);
    }

    // 敵方攻擊前先晃動提示
    const followDelay = (shouldShowGuard ? 260 : 0) + followHits * followStep;
    if (enemyBlock && enemyCard) {
      setTimeout(() => {
        playBlockUpSfx();
        showBlockUpBurst(enemyCard);
        FxPlayer.restartClass(enemyCard, 'anim-block-up', 430);
        if (Number.isFinite(enemyBlockAfter)) this._setDisplayedEnemyBlock(enemyBlockAfter);
      }, followDelay);
    }

    const attackDelay = followDelay + (enemyBlock ? 220 : 0);
    const hasEnemyAttack = !!(counterTarget || aoe);
    const enemyDiceWindup = hasEnemyAttack && enemyDice && enemyDice.animate !== false ? 760 : 0;
    if (enemyDiceWindup && enemyCard) {
      setTimeout(() => {
        this._animateCombatEnemyDice(enemyCard.closest('.combat-scene'), enemyDice);
      }, attackDelay);
    }
    const enemyHitDelay = attackDelay + enemyDiceWindup;
    if (hasEnemyAttack && enemyCard) {
      setTimeout(() => {
        FxPlayer.restartClass(enemyCard, 'anim-pulse-left', 400);
      }, enemyHitDelay);
    }

    // Section.
    setTimeout(() => {
      if (aoe) {
        if (enemyAttackSfx) AudioManager?.playSfx?.(enemyAttackSfx, enemyAttackSfxVolume ?? 0.42);
        combatScene?.querySelectorAll('.combat-unit.ally:not(.empty-slot)').forEach(el => {
          this._showCombatAttackTrail(el, enemyAttackTrail, { side: 'ally', scene: combatScene, sourceEl: enemyCard, weaponFamily: enemyAttackTrailFamily });
          FxPlayer.restartClass(el, 'anim-hit', 420);
        });
        for (const event of incomingEvents) {
          if (!event?.targetId) continue;
          const targetEl = findAllyUnit(event.targetId);
          if (targetEl) this._pulseCombatImpact(combatScene, event.damage);
          if (Number.isFinite(event.allyBlockAfter)) this._setDisplayedAllyBlock(event.targetId, event.allyBlockAfter);
          if (event.fullBlock) playFullBlockSfx();
          if (targetEl) setTimeout(() => this._showCombatDamageNumber(targetEl, event.damage, { side: 'ally', scene: combatScene }), 140);
          if (Number.isFinite(event.to)) this._setDisplayedAllyHp(event.targetId, event.to);
          if (Number.isFinite(event.to) && event.to <= 0) playAllyDeathSfxOnce(event);
        }
      } else if (counterTarget) {
        const el = findAllyUnit(counterTarget);
        if (el) {
          if (enemyAttackSfx) AudioManager?.playSfx?.(enemyAttackSfx, enemyAttackSfxVolume ?? 0.42);
          this._showCombatAttackTrail(el, enemyAttackTrail, { side: 'ally', scene: combatScene, sourceEl: enemyCard, weaponFamily: enemyAttackTrailFamily });
          el.classList.add('anim-hit');
          const event = incomingEvents.find(item => item?.targetId === counterTarget);
          if (event) this._pulseCombatImpact(combatScene, event.damage);
          if (event && Number.isFinite(event.allyBlockAfter)) this._setDisplayedAllyBlock(event.targetId, event.allyBlockAfter);
          if (event?.fullBlock) playFullBlockSfx();
          if (event) setTimeout(() => this._showCombatDamageNumber(el, event.damage, { side: 'ally', scene: combatScene }), 140);
          setTimeout(() => el.classList.remove('anim-hit'), 420);
        }
        const event = incomingEvents.find(item => item?.targetId === counterTarget);
        if (event && Number.isFinite(event.to)) {
          this._setDisplayedAllyHp(event.targetId, event.to);
          if (event.to <= 0) playAllyDeathSfxOnce(event);
        }
      }
      if (remainingBlocks) {
        applyRemainingBlocks();
      }
    }, enemyHitDelay + 270);

    if (nextRoundBlocks || nextRoundEvasions) {
      const nextBlockDelay = hasEnemyAttack
        ? enemyHitDelay + 700
        : followDelay + (incomingEvents.length > 0 ? 900 : 360);
      setTimeout(applyNextRoundStatuses, nextBlockDelay);
    }

    if (!hasEnemyAttack && incomingEvents.length > 0) {
      const reactionDelay = followDelay + (enemyBlock ? 220 : 0) + 260;
      setTimeout(() => {
        for (const event of incomingEvents) {
          if (!event?.targetId) continue;
          const targetEl = findAllyUnit(event.targetId);
          if (!targetEl) continue;
          this._pulseCombatImpact(combatScene, event.damage);
          FxPlayer.restartClass(targetEl, 'anim-hit', 420);
          if (Number.isFinite(event.allyBlockAfter)) this._setDisplayedAllyBlock(event.targetId, event.allyBlockAfter);
          if (event.fullBlock) playFullBlockSfx();
          setTimeout(() => this._showCombatDamageNumber(targetEl, event.damage, {
            side: 'ally',
            scene: combatScene,
          }), 120);
          if (Number.isFinite(event.to)) {
            setTimeout(() => this._setDisplayedAllyHp(event.targetId, event.to), 160);
            if (event.to <= 0) setTimeout(() => playAllyDeathSfxOnce(event), 160);
          }
        }
      }, reactionDelay);
    }

    if (healingEvents.length > 0) {
      const healDelay = hasEnemyAttack ? enemyHitDelay + 620 : attackDelay + 220;
      setTimeout(() => this._triggerHealAnims(healingEvents, combatScene, findAllyUnit), healDelay);
    }
  },

  _triggerHealAnims(events = [], combatScene = null, findAllyUnit = null) {
    if (!combatScene || !findAllyUnit) return;
    for (const event of events) {
      if (!event?.targetId || !Number.isFinite(event.amount) || event.amount <= 0) continue;
      const targetEl = findAllyUnit(event.targetId);
      if (!targetEl) continue;
      FxPlayer.restartClass(targetEl, 'anim-heal', 520);
      this._showCombatDamageNumber(targetEl, event.amount, {
        side: 'ally',
        scene: combatScene,
        kind: 'heal',
        offsetY: -8,
      });
      if (Number.isFinite(event.to)) this._setDisplayedAllyHp(event.targetId, event.to);
    }
  },

  _combatSceneHtml(combat) {
    const enemyHpPct = combat.enemy.maxHp > 0 ? (combat.enemy.hp / combat.enemy.maxHp) * 100 : 0;
    const enemyHpClass = enemyHpPct <= 25 ? 'critical' : enemyHpPct <= 50 ? 'low' : '';
    const nativeInfo = this._activeEnemyNativeWeaknesses(combat.enemy);
    const weaknessDescHtml = nativeInfo.main && combat.enemy.weaknessDesc
      ? `<div class="combat-weakness-effect">⚡ ${combat.enemy.weaknessDesc}</div>`
      : '';
    const fateGamble = combat.enemy.fateGamble || null;
    const fateLuckyFaces = Array.isArray(fateGamble?.luckyFaces) && fateGamble.luckyFaces.length > 0
      ? fateGamble.luckyFaces
      : (fateGamble?.luckyFace ? [fateGamble.luckyFace] : []);
    const fateGambleHtml = fateLuckyFaces.length > 0 && Array.isArray(fateGamble.unluckyFaces) && fateGamble.unluckyFaces.length > 0
      ? `<button type="button" class="combat-weakness-effect fate-board-effect" onclick="event.stopPropagation(); Game.showCombatFateBoardDetail(event)" title="命運盤：左側為幸運骰面，右側為厄運骰面">
          <span class="fate-board-faces lucky" aria-label="幸運骰面">${fateLuckyFaces.join('、')}</span>
          <img class="fate-board-icon" src="assets/icons/fate-guardian-dice.png" alt="命運盤">
          <span class="fate-board-faces unlucky" aria-label="厄運骰面">${fateGamble.unluckyFaces.join('、')}</span>
        </button>`
      : '';
    const bannerGuardian = combat.enemy.bannerGuardian || null;
    const bannerGuardianHtml = bannerGuardian
      ? `<div class="combat-weakness-effect">旗面：${bannerGuardian.interrupted ? '已中斷，換旗前不生效' : (bannerGuardian.stance === 'damage' ? '戰吼旗（攻擊傷害 +3）' : '創傷旗（攻擊前全隊傷口 +4）')}</div>`
      : '';
    const selectable = !!combat.selectable;
    const itemTargeting = !!combat.itemTargeting;
    const guardTargeting = !!combat.guardTargeting;
    const tutorial = combat.tutorial || null;
    const tutorialTarget = tutorial?.target || '';
    const tutorialTargetId = tutorial?.targetId || '';
    if (combat.onFollowUpTarget && combat.followUpTargetId) {
      if (!this._combatFollowUpActions) this._combatFollowUpActions = {};
      this._combatFollowUpActions[combat.followUpTargetId] = combat.onFollowUpTarget;
    }

    let squadHtml = combat.squad.map(char => {
      const cls = CHARACTER_CLASSES[char.cls];
      const hpPct = char.maxHp > 0 ? (char.hp / char.maxHp) * 100 : 0;
      const hpClass = hpPct <= 25 ? 'critical' : hpPct <= 50 ? 'low' : '';
      const isActive = combat.attackerId === char.id;
      const isDown = char.hp <= 0;
      const hasFollowUpAction = typeof combat.onFollowUpTarget === 'function';
      const isFollowUpTarget = hasFollowUpAction && combat.followUpTargetId === char.id && !isDown;
      const isFollowUpStatus = (combat.followUpStatusId || combat.followUpTargetId) === char.id && !isDown;
      const showPlayerDice = combat.playerDice && combat.attackerId === char.id;
      const isIntimidated = !!char.finalEyeIntimidated && !isDown;
      const canClick = ((selectable && !isIntimidated) || itemTargeting || guardTargeting || isFollowUpTarget) && !isDown;
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
      const evasionChance = Math.max(0, Math.min(50, Math.floor(char.evasionChance || 0)));
      const evasionBadgeHtml = evasionChance > 0 && !isDown
        ? this._combatAllyEvasionBadgeHtml(char, evasionChance)
        : '';
      const intimidateHtml = isIntimidated ? `
        <button type="button" class="combat-status-badge intimidated"
          onclick="event.stopPropagation()"
          title="開眼威懾：本回合無法主戰">
          <span>懾</span>
          <strong>封</strong>
        </button>
      ` : '';
      const pollutionFaces = Array.isArray(char.dicePollution?.faces) ? char.dicePollution.faces : [];
      const pollutionEmpowered = Math.max(0, char.dicePollution?.empowered || 0);
      const pollutionHtml = pollutionFaces.length > 0 && !isDown ? `
        <button type="button" class="combat-status-badge dice-pollution"
          onclick="event.stopPropagation()"
          title="污染骰面：${pollutionFaces.join('、')}${pollutionEmpowered > 0 ? `；強化污染 ${pollutionEmpowered} 層` : ''}">
          <span>☣️</span>
          <strong>${pollutionFaces.join('.')}${pollutionEmpowered > 0 ? `+${pollutionEmpowered}` : ''}</strong>
        </button>
      ` : '';
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
      const clickAttr = guardTargeting && !isDown
        ? `onclick="Game.selectCombatGuardTarget('${char.id}')"`
        : itemTargeting && !isDown
        ? `onclick="Game.useCombatInventoryItemOnTarget('${char.id}')"`
        : isFollowUpTarget
        ? `onclick="Render.triggerCombatFollowUp('${char.id}')"`
        : (selectable && !isDown && !isIntimidated ? `onclick="Game.selectCombatAttacker('${char.id}')"` : '');
      const battleArt = char.battleArt || (typeof CLASS_BATTLE_ART !== 'undefined' ? CLASS_BATTLE_ART[char.cls] : '');
      const weaponFamily = char.weapon?.family || char.weapon?.id || '';
      const tutorialAllyHighlight = !isDown && (
        tutorialTarget === 'ally' ||
        ((tutorialTarget === 'guard_ally' || tutorialTarget === 'item_ally') && tutorialTargetId === char.id)
      );
      return `
        <${tag} class="combat-unit ally${isActive ? ' active' : ''}${isDown ? ' down' : ''}${isIntimidated ? ' intimidated' : ''}${canClick ? ' selectable' : ''}${isFollowUpStatus ? ' followup-ready' : ''}${(itemTargeting || guardTargeting) && !isDown ? ' item-target' : ''}${isIntentTarget ? ' intent-targeted' : ''}${tutorialAllyHighlight ? ' combat-tutorial-highlight' : ''}"
          data-char-id="${char.id}" data-weapon-family="${weaponFamily}" ${clickAttr}>
          ${isFollowUpStatus ? `<div class="combat-followup-badge"><strong>${combat.followUpLabel || '追擊'}</strong><span>${combat.followUpHint || '點擊追擊'}</span></div>` : ''}
          ${battleArt ? `<div class="combat-character-art" aria-hidden="true"><img src="${battleArt}" alt=""></div>` : ''}
          ${isDown ? this._combatBloodSplatterHtml(char.id || char.name, 'ally') : ''}
          <div class="combat-unit-main">
            <span class="combat-sprite">${cls.icon}</span>
            <span class="combat-name">${char.name}</span>
            ${gazeBadgeHtml}
            ${woundBadgeHtml}
            ${blockBadgeHtml}
            ${evasionBadgeHtml}
            ${intimidateHtml}
            ${pollutionHtml}
            ${remorseHtml}
            ${backlashHtml}
            ${wagerHtml}
            ${bannerHtml}
          </div>
          <div class="combat-stat-line">攻擊 ${char.attack ?? cls.attack ?? 0}${threat > 0 ? `　仇恨 ${threat}/10` : ''}</div>
          <div class="combat-threat-meter${threat > 0 ? '' : ' empty'}" title="${threat > 0 ? `仇恨 ${threat}/10` : ''}"><span style="width:${Math.min(100, threat * 10)}%"></span></div>
          <div class="combat-hp-row">
            <div class="combat-hp-bar"><div class="combat-hp-fill combat-ally-hp-fill ${hpClass}" style="width:${hpPct}%"></div></div>
            <span class="combat-ally-hp-text" data-max-hp="${char.maxHp}">${char.hp}/${char.maxHp}</span>
          </div>
          ${showPlayerDice ? this._combatDicePips(combat.playerDice.value, 'player', char.cls, combat.playerDice.sides, this._d12DiceType(combat.playerDice)) : ''}
        </${tag}>
      `;
    }).join('');
    const maxSquadSlots = (typeof CONFIG !== 'undefined' && CONFIG.MAX_SQUAD_SIZE) || 3;
    for (let i = combat.squad.length; i < maxSquadSlots; i++) {
      squadHtml += `
        <div class="combat-unit ally empty-slot" aria-hidden="true">
          <div class="combat-unit-main">
            <span class="combat-sprite">＋</span>
            <span class="combat-name">空位</span>
          </div>
          <div class="combat-stat-line">可救援隊友</div>
          <div class="combat-hp-row">
            <div class="combat-hp-bar"><div class="combat-hp-fill" style="width:0%"></div></div>
            <span>--/--</span>
          </div>
        </div>
      `;
    }

    const bagItems = (combat.inventory || []).filter(entry => entry.item && entry.item.useInCombat !== false);
    const intentArrowHtml = this._combatIntentArrowHtml(combat);
    const bagHtml = combat.showBag ? `
      <div class="combat-bag-panel">
        <div class="combat-bag-dialog" role="dialog" aria-label="小隊背包">
          <div class="combat-bag-header">
            <strong>小隊背包</strong>
            <button type="button" class="combat-bag-close" onclick="Game.openCombatBag()" aria-label="關閉背包">×</button>
          </div>
          <div class="combat-bag-list">
            ${bagItems.length > 0 ? bagItems.map(entry => {
              const item = entry.item;
              const blocked = item.useType === 'roll_mod' && combat.rollItemBlocked;
              const countText = entry.count > 1 ? ` x${entry.count}` : '';
              const tutorialItemClass = tutorialTarget === 'bag_item' && item.id === 'whetstone' ? ' combat-tutorial-highlight' : '';
              const indexArg = JSON.stringify(entry.index);
              return `<button class="combat-bag-item${tutorialItemClass}" data-item-id="${this._escapeAttr(item.id || '')}" ${blocked ? 'disabled' : ''} onclick="Game.selectCombatBagItem(${this._escapeAttr(indexArg)})">
                <span>${EquipmentIcon.label(item, 'equipment-inline-icon item-combat-icon')}${countText}</span>
                <small>${blocked ? '本次攻擊已使用擲骰道具' : item.desc}</small>
              </button>`;
            }).join('') : '<div class="combat-bag-empty">背包沒有可在戰鬥中使用的道具</div>'}
          </div>
        </div>
      </div>
    ` : '';

    const enemyCardVars = [];
    if (combat.enemy.cardBgImage) enemyCardVars.push(`--enemy-card-bg: url('${combat.enemy.cardBgImage}')`);
    if (combat.enemy.iconImage === 'assets/enemies/dark-avatar-combat.png') {
      const darkLevel = Math.max(0, Number(combat.enemy.darkMonsterOriginalLevel || combat.enemy.darkMonsterCombatLevel || 0));
      const scale = Math.min(1.34, 1 + Math.min(darkLevel, 24) * 0.02);
      enemyCardVars.push(`--dark-avatar-scale: ${scale.toFixed(3)}`);
    }
    const enemyCardBgStyle = enemyCardVars.length
      ? ` style="${enemyCardVars.join('; ')}"`
      : '';
    const enemyCardBgClass = combat.enemy.cardBgImage ? ' has-card-bg' : '';
    const enemyCardIdClass = combat.enemy.id
      ? ` enemy-${String(combat.enemy.id).replace(/[^a-z0-9_-]/gi, '-')}`
      : '';
    const enemyDefeatedClass = combat.enemy.defeated ? ' pending-defeated' : '';
    const enemySelfTargetClass = combat.intent?.targetSelf ? ' self-targeted' : '';
    const enemyHoverTitle = this._combatEnemyHoverTitle(combat.enemy);
    const guardCancelLocked = guardTargeting && tutorial?.step === 'guard_target';
    const guardButtonClass = `combat-guard-button${guardTargeting ? ' active' : ''}${combat.canGuard || guardTargeting ? '' : ' disabled'}${guardCancelLocked ? ' disabled' : ''}${tutorialTarget === 'guard' ? ' combat-tutorial-highlight' : ''}`;
    const bagButtonClass = `combat-bag-button${combat.canUseBag ? '' : ' disabled'}${tutorialTarget === 'bag' ? ' combat-tutorial-highlight' : ''}`;
    const guardButtonAction = guardCancelLocked
      ? 'disabled'
      : guardTargeting
      ? 'onclick="Game.cancelCombatGuardTargeting()"'
      : (combat.canGuard ? 'onclick="Game.selectCombatGuard()"' : 'disabled');

    return `
      ${intentArrowHtml}
      ${bagHtml}
      <div class="combat-enemy-card hoverable-enemy${enemyCardBgClass}${enemyCardIdClass}${enemyDefeatedClass}${enemySelfTargetClass}${tutorialTarget === 'enemy' ? ' combat-tutorial-highlight' : ''}"${enemyCardBgStyle}>
        ${combat.enemyDice ? `<div class="combat-floating-enemy-dice">${this._combatDicePips(combat.enemyDice.animate === false ? combat.enemyDice.value : null, 'enemy', null, combat.enemyDice.sides)}</div>` : ''}
        ${this._combatEnemyDamageDiePanelHtml(combat.enemy)}
        <div class="combat-side-label" aria-hidden="true"></div>
        <div class="combat-enemy-figure">
          <div class="combat-enemy-stance-column">
            ${this._combatEnemyIntentHtml(combat.intent)}
            <div class="combat-enemy-stance-divider" aria-hidden="true"></div>
            ${this._combatEnemyBlockPanelHtml(combat.enemy)}
            ${this._combatEnemyAttackPanelHtml(combat.enemy)}
          </div>
          <button type="button" class="combat-enemy-sprite combat-enemy-detail-button"
            onclick="event.stopPropagation(); Game.showCombatEnemyDetail(event)"
            aria-label="${enemyHoverTitle}">
            ${combat.enemy.hideIconInCombat ? '' : this._enemyIconHtml(combat.enemy)}
          </button>
          ${this._combatEnemyStatusIconsHtml(combat.enemy)}
          ${combat.enemy.defeated ? this._combatBloodSplatterHtml(combat.enemy.id || combat.enemy.name, 'enemy') : ''}
        </div>
        <div class="combat-enemy-name">${combat.enemy.name}</div>
        <div class="combat-hp-row">
          <div class="combat-hp-bar"><div class="combat-hp-fill combat-enemy-hp-fill ${enemyHpClass}" style="width:${enemyHpPct}%"></div></div>
          <span class="combat-enemy-hp-text" data-max-hp="${combat.enemy.maxHp}">${combat.enemy.hp}/${combat.enemy.maxHp}</span>
        </div>
        <div class="combat-enemy-divider" aria-hidden="true"></div>
        <div class="combat-enemy-info-panel">
          ${this._combatWeaknessRowHtml(combat.enemy)}
          ${this._combatInfoEffectHtml(combat.enemy.disabledNativeWeaknesses?.length ? `裂星破壞：${combat.enemy.disabledNativeWeaknesses.map(w => `${Dice.face(w)} ${w}`).join('、')}` : '')}
          ${this._combatInfoEffectHtml(combat.enemy.executionCountdown && !combat.enemy.executionCountdown.executed ? `處刑倒數：${combat.enemy.executionCountdown.remaining}` : '')}
          ${this._combatInfoEffectHtml(fateGambleHtml)}
          ${this._combatInfoEffectHtml(bannerGuardianHtml)}
          ${this._combatInfoEffectHtml(weaknessDescHtml)}
        </div>
      </div>
      <div class="combat-center">
        <div class="combat-tools">
          <div class="combat-actions"></div>
          <div class="combat-vs">VS</div>
          <div class="combat-bottom-tools">
            <button class="${guardButtonClass}" ${guardButtonAction} title="${guardTargeting ? '取消格檔指定' : (combat.canGuard ? '格檔：選一名角色，擲骰並獲得等同骰數的格檔；不消耗主戰' : `格檔冷卻：還需 ${combat.guardCooldown || 0} 回合`)}">${guardTargeting ? '取消格檔' : '格檔'}${combat.canGuard || guardTargeting ? '' : `<small>${combat.guardCooldown || 0}</small>`}</button>
            <button class="${bagButtonClass}" ${combat.canUseBag ? 'onclick="Game.openCombatBag()"' : 'disabled'} title="小隊背包"><img class="combat-bag-icon" src="assets/ui/bag-icon.png" alt="">背包</button>
          </div>
        </div>
        ${itemTargeting ? `<button class="btn-tiny combat-cancel-item" onclick="Game.cancelCombatItemTargeting()">取消道具</button>` : ''}
      </div>
      <div class="combat-squad-card">
        <div class="combat-side-label">小隊</div>
        ${squadHtml}
      </div>
      <div class="combat-status-bar${selectable ? ' selectable-hint' : ''}">${combat.status || '選擇一名角色出手'}</div>
    `;
  },

  _combatTutorialCardHtml(tutorial = null) {
    if (!tutorial) return '';
    if (tutorial.hideCard) return '';
    const nextButton = tutorial.step === 'guard_cooldown'
      ? '<button type="button" class="combat-tutorial-next" onclick="Game.continueCombatTutorial()">下一步</button>'
      : '';
    return `
      <div class="combat-tutorial-card target-${tutorial.target || 'none'}" data-step="${tutorial.step || ''}">
        <div class="combat-tutorial-step">戰鬥教學</div>
        <div class="combat-tutorial-title">${this._escapeHtml(tutorial.title || '')}</div>
        <div class="combat-tutorial-body">${this._escapeHtml(tutorial.body || '')}</div>
        <div class="combat-tutorial-cta">${this._escapeHtml(tutorial.cta || '')}</div>
        ${nextButton}
      </div>
    `;
  },

  updateCombatTutorialInline(tutorial = null, sceneOverride = null) {
    const scene = sceneOverride || document.querySelector('.combat-scene');
    if (!scene) return;
    scene.querySelectorAll('.combat-tutorial-highlight').forEach(el => el.classList.remove('combat-tutorial-highlight'));
    scene.querySelector('.combat-tutorial-card')?.remove();
    if (!tutorial) return;
    const target = tutorial.target || '';
    if (target === 'enemy') scene.querySelector('.combat-enemy-detail-button')?.classList.add('combat-tutorial-highlight');
    if (target === 'popover_close') document.querySelector('#combat-status-popover .combat-banner-popover-close')?.classList.add('combat-tutorial-highlight');
    if (target === 'guard') scene.querySelector('.combat-guard-button')?.classList.add('combat-tutorial-highlight');
    if (target === 'bag') scene.querySelector('.combat-bag-button')?.classList.add('combat-tutorial-highlight');
    if (target === 'bag_item') scene.querySelector('.combat-bag-item[data-item-id="whetstone"]')?.classList.add('combat-tutorial-highlight');
    if (target === 'guard_ally' && tutorial.targetId) {
      scene.querySelectorAll('.combat-unit.ally').forEach(el => {
        if (el.dataset.charId === tutorial.targetId) el.classList.add('combat-tutorial-highlight');
      });
    }
    if (target === 'ally') {
      scene.querySelectorAll('.combat-unit.ally:not(.empty-slot):not(.down)').forEach(el => el.classList.add('combat-tutorial-highlight'));
    }
    const cardHtml = this._combatTutorialCardHtml(tutorial);
    if (cardHtml) scene.insertAdjacentHTML('beforeend', cardHtml);
  },

  _combatEnemyAbilityRowsHtml(enemy) {
    const rows = typeof Game !== 'undefined' && typeof Game._combatEnemyAbilityNotes === 'function'
      ? Game._combatEnemyAbilityNotes(enemy)
      : [];
    return rows.map(text => `<div class="cct-row"><span class="cct-label">能力</span>${this._escapeHtml(text)}</div>`).join('');
  },

  _combatEnemyHoverTitle(enemy) {
    const lines = [`${enemy?.name || '敵人'}：點擊查看詳細資訊`];
    if (typeof Game !== 'undefined' && typeof Game._combatEnemyAbilityNotes === 'function') {
      lines.push(...Game._combatEnemyAbilityNotes(enemy));
    }
    if (enemy?.weaknessDesc) lines.push(`破除效果：${enemy.weaknessDesc}`);
    return this._escapeHtml(lines.filter(Boolean).join('\n'));
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
      this._combatSuspiciousFlawBadgeHtml(enemy),
    ].filter(Boolean);
    if (icons.length === 0) return '';
    return `<div class="combat-enemy-status-icons">${icons.join('')}</div>`;
  },

  _combatSuspiciousFlawBadgeHtml(enemy) {
    if (!enemy?.suspiciousFlaw) return '';
    return `
      <button type="button" class="combat-suspicious-flaw-badge"
        title="可疑弱點：探索者可消耗，差 1 視為命中原生弱點">
        <span>疑</span>
      </button>
    `;
  },

  _combatWeaknessRowHtml(enemy) {
    const badges = [
      ...this._combatNativeWeaknessBadgesHtml(enemy),
      ...this._combatTempWeaknessBadgesHtml(enemy),
    ];
    if (badges.length === 0) {
      return '';
    }
    return `<div class="combat-weakness-icon-row">${badges.join('')}</div>`;
  },

  _combatInfoEffectHtml(content) {
    if (!content) return '';
    if (String(content).includes('combat-weakness-effect')) return content;
    return `<div class="combat-weakness-effect">${content}</div>`;
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

  _combatAllyEvasionBadgeHtml(char, chance) {
    const reduction = Math.floor(chance / 10);
    return `
      <button type="button" class="combat-status-badge evasion"
        onclick="event.stopPropagation()"
        title="閃避率 ${chance}%：受擊時有機率免傷；未閃避時傷害 -${reduction}，受擊後歸 0">
        <span>避</span>
        <strong>${chance}%</strong>
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

  _combatEnemyAttackPanelHtml(enemy) {
    const attack = Number(enemy?.attack || 0);
    return `<div class="combat-enemy-attack-panel" title="敵人基礎攻擊力">攻 ${attack}</div>`;
  },

  _combatEnemyDamageDiePanelHtml(enemy) {
    const sides = Math.max(0, Number(enemy?.damageDieSides || 0));
    if (sides <= 0) return '';
    const label = sides === 3 ? '三面骰' : `${sides} 面骰`;
    return `<div class="combat-enemy-damage-die-panel" title="敵方傷害骰">${label}</div>`;
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
    const pending = value == null;
    const d12Class = diceSides > 6 ? ' dice-d12' : '';
    const d12TypeClass = diceSides > 6 && d12Type ? ` dice-d12-${d12Type}` : '';
    const faceClass = !pending && diceSides <= 6 && value >= 1 && value <= 6 ? `dice-face-${value}` : '';
    return `<div class="combat-card-dice ${side} ${this._diceThemeClass(cls)}${d12Class}${d12TypeClass} ${faceClass}" data-sides="${diceSides}" aria-label="${pending ? '骰子判定中' : `骰出 ${value}`}">
      ${pending ? '<strong class="dice-number">?</strong>' : this._dicePipHtml(value, diceSides)}
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
    if (char.weapon) rows.push(`<div class="cct-row"><span class="cct-label">武器</span>${EquipmentIcon.label(char.weapon, 'equipment-inline-icon weapon-tooltip-icon')}：${char.weapon.desc}</div>`);
    if (char.gear)   rows.push(`<div class="cct-row"><span class="cct-label">裝備</span>${EquipmentIcon.label(char.gear, 'equipment-inline-icon gear-tooltip-icon')}：${char.gear.desc}</div>`);
    if (char.relic)  rows.push(`<div class="cct-row"><span class="cct-label">聖物</span>${EquipmentIcon.label(char.relic, 'equipment-inline-icon relic-tooltip-icon')}：${typeof relicEffectDesc === 'function' ? relicEffectDesc(char.relic, false) : char.relic.desc}</div>`);
    if (char.fusedRelic) rows.push(`<div class="cct-row"><span class="cct-label">融合聖物</span>✨ ${EquipmentIcon.label(char.fusedRelic, 'equipment-inline-icon relic-tooltip-icon')}：${typeof relicEffectDesc === 'function' ? relicEffectDesc(char.fusedRelic, true) : char.fusedRelic.desc}</div>`);
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
    this._unbindCombatIntentArrowResize();
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
