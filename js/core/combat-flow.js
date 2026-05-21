// Combat flow methods extracted from js/core/game.js.
// Keeps the original Game API while reducing the size of the core coordinator.
const GameCombatFlow = {
  // Section.
  // Section.
  _triggerCombat(cell, opts = {}) {
    const enemy = cell.content?.enemy;
    if (!enemy) { cell.cleared = true; Render.fullRender(); return; }
    for (const char of G.squad) {
      char._ironShardUsed = false;
      char._boneDiceBagUses = 0;
      char._flawLensUsed = false;
      char._grapplingHookUsedRound = false;
      char._corrosiveOilUsedRound = false;
      char._serratedOilUsedRound = false;
      char._greatswordMomentum = 0;
      char._rapierGuaranteedFollowUpsUsed = 0;
      CombatStatus.clearIncomingRiskState(char);
      char.dicePollution = null;
      CombatStatus.clearNativeWeaknesses(char, { source: 'gaze' });
      CombatStatus.clearBattleWounds(char);
    }

    G.combat = {
      enemy: { ...enemy, maxHp: enemy.hp, blockBroken: false, blockBrokenUntilRound: null, exposed: false, exposedUntilRound: null, _block: 0, woundMax: enemy.woundMax || 15, wounds: Math.max(0, Math.min(enemy.woundMax || 15, enemy.wounds || 0)), gamblerTempWeakness: null, gamblerTempWeaknesses: [], gamblerNativeWeakness: null, eagleTempWeakness: null, eagleNativeWeakness: null, extraWeaknesses: [], disabledNativeWeaknesses: [], suspiciousFlaw: false, suspiciousFlawMarkedRound: 0 },
      cell,
      reward: cell.content?.reward || (enemy.rescueBoss ? 'rescue' : null),
      source: opts.source || null,
      darkMonsterId: opts.darkMonsterId || null,
      darkMonsterRef: opts.darkMonsterRef || null,
      underlyingCell: opts.underlyingCell || null,
      round: 1,
      itemUsedRound: 0,
      rollItemUsedRound: 0,
      guardReadyRound: 1,
      luckyStarUses: 0,
      bowFollowUps: 0,
      wagerDice: null,
      wagerDicePlans: {},
      battleDrum: null,
      banner: null,
      banners: [],
      supportTacticalDamageRound: 0,
      bandageUsed: {},
      threat: {},
      eagleFeatherDamageUsed: false,
      starHunterEyeRound: 0,
      bagOpen: false,
      pendingInventoryItemIndex: null,
      guardTargeting: false,
      intent: null,
      actionInProgress: false,
    };
    G.combat.intent = this._resolveCombatIntent(G.combat.enemy);
    this._ensureRoundStartNativeWeakness(G.combat.enemy);
    EnemyAbilities.onCombatStart(G.combat.enemy, { ...G.combat, squad: G.squad });
    this._applyCombatStartGear(G.combat.enemy);

    G.combatMods = [...G.combatMods];
    this._showCombatModal();
  },

  _showCombatModal() {
    const { enemy } = G.combat;

    const modDesc = G.combatMods.length > 0 ? '\n\n戰鬥調整存在。' : '';

    this._openModal({
      title: `遭遇：${enemy.name}`,
      desc: `${enemy.desc}\n\nHP ${enemy.hp}/${enemy.maxHp} / 攻擊 ${enemy.attack}${modDesc}`,
      combat: {
        ...this._buildCombatScene(enemy, null, this._combatStatusText()),
        selectable: !this._combatItemTargeting() && !G.combat.actionInProgress,
        itemTargeting: this._combatItemTargeting(),
        guardTargeting: this._combatGuardTargeting(),
        showBag: !!G.combat.bagOpen,
        inventory: this._combatInventoryView(),
        canUseBag: this._canUseCombatBag(),
        canGuard: this._canUseCombatGuard(),
        guardCooldown: this._combatGuardCooldown(),
        rollItemBlocked: G.combat.rollItemUsedRound === G.combat.round,
      },
      choices: this._combatActionChoices(),
    });
  },

  _doCombatRound(attacker, forcedRollResult = null, opts = {}) {
    const { enemy, cell, reward, source, darkMonsterId, darkMonsterRef } = G.combat;

    const resonanceAttackBonus = 0;

    if (!opts.bowFollowUp) {
      const roundStart = this._applyRoundStartBannerDamageIfNeeded(attacker);
      if (roundStart?.victory) return;
      if (roundStart?.logs?.length) {
        G.combat._pendingRoundStartLogs = [
          ...(G.combat._pendingRoundStartLogs || []),
          ...roundStart.logs,
        ];
      }
    }

    if (!forcedRollResult) {
      if (!opts.bowFollowUp && !opts.bannerPrompted && this._canRaiseBannerBeforeAttack(attacker)) {
        this._promptRaiseBannerBeforeAttack(attacker, opts);
        return;
      }
      G.combat.wagerDice = !opts.bowFollowUp ? this._combatWagerDiceForAttacker(attacker) : null;
      const rollResult = this._rollWithMods('combat', attacker);
      if (opts.starHunterForceSix) this._applyStarHunterForceSix(rollResult);
      const canReroll  = attacker.cls === 'scholar' &&
                         this._gamblerRerollsLeft() > 0 &&
                         !rollResult.gamblerResolved &&
                         !rollResult.pollutionLocked &&
                         !opts.starHunterForceSix;
      if (canReroll) {
        let resolved = false;
        this._openModal({
          title: '搏命者重擲',
          desc: [
            `${attacker.name} 擲出攻擊骰。`,
            `目標：${enemy.name}`,
            `目前骰面：${Dice.face(rollResult.value)}（${rollResult.value}）`,
            `${attacker.name} 今天剩餘重擲：${this._gamblerRerollsLeft()}`,
            '可以接受目前結果，或消耗 1 次重擲。',
          ].join('\n'),
          dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: rollResult.value, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
          choices: [
            {
              label: '使用目前結果',
              action: () => {
                if (resolved) return;
                resolved = true;
                this._showCombatDicePreview(rollResult, attacker, () => {
                  this._closeModal();
                  this._combatAttackAnim(attacker, () => this._doCombatRound(attacker, { ...rollResult, gamblerResolved: true }, opts));
                });
              },
            },
            {
              label: `重擲（${attacker.name}）`,
              action: () => {
                if (resolved) return;
                resolved = true;
                this._spendGamblerReroll();
                const next = { ...this._rollWithMods('combat', attacker), gamblerResolved: true };
                if (opts.starHunterForceSix) this._applyStarHunterForceSix(next);
                this._log(`${attacker.name} 重擲後得到 ${Dice.face(next.value)}（${next.value}）。`, 'reward');
                this._showCombatDicePreview(next, attacker, () => {
                  this._closeModal();
                  this._combatAttackAnim(attacker, () => this._doCombatRound(attacker, next, opts));
                });
              },
            },
          ],
        });
        return;
      }
      // 先顯示骰子動畫，再進入攻擊結算。
      this._showCombatDicePreview(rollResult, attacker, () => {
        this._combatAttackAnim(attacker, () => this._doCombatRound(attacker, rollResult, opts));
      });
      return;
    }
    const rollResult = forcedRollResult;
    const battleDrumAttackBonus = !opts.bowFollowUp ? this._battleDrumAttackBonus() : 0;
    const supportTacticalActive = this._supportTacticalActive(attacker);
    const supportTacticalDamageBonus = supportTacticalActive && !opts.bowFollowUp && G.combat.supportTacticalDamageRound !== G.combat.round ? 1 : 0;
    if (supportTacticalDamageBonus > 0) G.combat.supportTacticalDamageRound = G.combat.round;
    const deferBowEnemyAction = !opts.bowFollowUp && attacker.weapon?.effect?.type === 'bow_followup';
    const preCombatLogs = [];
    if (G.combat._pendingRoundStartLogs?.length) {
      preCombatLogs.push(...G.combat._pendingRoundStartLogs);
      G.combat._pendingRoundStartLogs = [];
    }
    if (!opts.bowFollowUp) {
      preCombatLogs.push(...this._applyRearGuardGear(attacker));
    }
    if (!opts.bowFollowUp && opts.pendingBanner) {
      preCombatLogs.push(...this._activatePendingBannerForRoll(attacker, opts.pendingBanner, rollResult));
    }
    const starHunterEyePrepared = this._prepareStarHunterEyeWeakness(attacker);
    const combatResult = CombatRules.resolveRound({
      attacker,
      enemy,
      squad: G.squad,
      rollResult,
      combatMods: G.combatMods,
      resonanceAttackBonus,
      intent: G.combat.intent,
      round: G.combat.round,
      suppressEnemyAction: !!opts.bowFollowUp || deferBowEnemyAction,
      deferEnemyAction: deferBowEnemyAction,
      allowNativeWeaknessEffect: !opts.bowFollowUp,
      eagleFeatherDamageBonus: opts.eagleFeatherDamageBonus || 0,
      eagleFeatherNativeCandidate: this._eagleFeatherCanTrigger(attacker, rollResult),
      starHunterEyeDamageBonus: opts.starHunterEyeDamageBonus || 0,
      bowFollowUpDamageBonus: opts.bowFollowUpDamageBonus || 0,
      starBreakerActive: this._hasStarBreakerEye(attacker),
      wagerDice: G.combat.wagerDice,
      battleDrumAttackBonus,
      banner: this._activeCombatBanners(),
      supportTacticalDamageBonus,
      supportTacticalDamageReduce: supportTacticalActive ? 1 : 0,
    });
    if (combatResult.enemyActionDeferred) {
      G.combat.deferredEnemyAction = {
        attackerId: attacker.id,
        intent: G.combat.intent ? { ...G.combat.intent } : null,
        round: G.combat.round,
        combatMods: [...(G.combatMods || [])],
        wagerDice: G.combat.wagerDice ? { ...G.combat.wagerDice } : null,
        supportTacticalDamageReduce: supportTacticalActive ? 1 : 0,
      };
    }
    if (starHunterEyePrepared) {
      preCombatLogs.push(starHunterEyePrepared);
    }
    if (preCombatLogs.length > 0) {
      combatResult.logs.unshift(...preCombatLogs);
    }
    EnemyAbilities.afterPlayerAttack(combatResult, {
      attacker,
      enemy,
      squad: G.squad,
      combat: G.combat,
      logs: combatResult.logs,
      rollResult,
      opts,
    });
    const damageEvents = Array.isArray(combatResult.playerDamageEvents) ? combatResult.playerDamageEvents : [];
    combatResult.latestPlayerDamageEvents = [...damageEvents];
    if (opts.bowFollowUp) {
      const previousEvents = Array.isArray(G.combat.playerDamageEventsThisAttack)
        ? G.combat.playerDamageEventsThisAttack
        : [];
      G.combat.playerDamageEventsThisAttack = [...previousEvents, ...damageEvents];
    } else {
      G.combat.playerDamageEventsThisAttack = [...damageEvents];
    }
    if (!opts.bowFollowUp) {
      this._spendBattleDrumCharge(combatResult.logs);
      this._refreshBattleDrum(attacker, combatResult.logs);
      this._applyBandageGearHeal(attacker, combatResult.logs);
    }
    this._addCombatThreat(attacker, combatResult, !!opts.bowFollowUp);
    const roll = combatResult.roll;
    const displayRoll = rollResult.displayValue || roll;
    const enemyDead = combatResult.enemyDead;

    // 全隊反擊傷害。
    if (combatResult.aoeCounter > 0) {
      const alive = this._aliveSquad();
      const allowWagerIncoming = !G.combat.wagerDice;
      const variedAoe = combatResult.aoeDamageByChar && Object.keys(combatResult.aoeDamageByChar).length > 0;
      if (!Array.isArray(combatResult.incomingDamageEvents)) combatResult.incomingDamageEvents = [];
      this._log(combatResult.counterDmg > 0 && combatResult.counterTargetName
        ? `${enemy.name} 反擊主目標 ${combatResult.counterTargetName}，其餘隊友濺射 ${combatResult.aoeCounter} 傷害。`
        : (variedAoe
          ? `${enemy.name} 反擊全隊，基礎 ${combatResult.aoeCounter} 傷害。`
          : `${enemy.name} 反擊全隊，造成 ${combatResult.aoeCounter} 傷害。`), 'danger');
      for (const c of alive) {
        let incomingAoe = Math.max(0, combatResult.aoeDamageByChar?.[c.id] ?? combatResult.aoeCounter);
        incomingAoe = CombatStatus.applyWoundTakenBonus(c, incomingAoe, combatResult.logs);
        let reduced = this._reduceIncomingDamage(c, incomingAoe, true, allowWagerIncoming, combatResult.logs);
        if (CombatStatus.getBlock(c) > 0 && reduced > 0) {
          const blockResult = CombatStatus.consumeBlock(c, reduced);
          reduced = blockResult.damage;
          combatResult.logs.push(`${c.name} 的格檔吸收 ${blockResult.absorbed}，剩餘格檔 ${blockResult.block}`);
        }
        const beforeHp = c.hp;
        c.hp = Math.max(0, c.hp - reduced);
        if (reduced > 0) {
          combatResult.incomingDamageEvents.push({
            type: 'aoe',
            targetId: c.id,
            damage: reduced,
            from: beforeHp,
            to: c.hp,
          });
        }
      }
    }
    if (combatResult.enemyAttackFlow) {
      if (combatResult.counterTargetId) this._halveCombatThreat(combatResult.counterTargetId);
      this._clearWagerDicePenaltyAfterEnemyFlow(combatResult.logs);
    }

    G.combatMods = [];

    if (attacker.hp <= 0) {
      const echoMod = CombatRules.fallenEchoMod(G.squad, attacker);
      if (echoMod) {
        const { char, ...mod } = echoMod;
        G.combatMods.push(mod);
        this._log(`${char.name} 的搏命餘響：下次攻擊骰 +${mod.value}。`, 'reward');
      }
    }

    if (enemyDead) {
      this._handleCombatVictory({
        attacker,
        enemy,
        cell,
        reward,
        source,
        darkMonsterId,
        darkMonsterRef,
        combatResult,
        roll,
        rollResult,
      });
      return;
    }

    if (this._handleDevTestDefeat(combatResult, attacker, enemy, roll, rollResult)) return;
    if (this._checkLose()) return;

    if (this._canBowFollowUp(attacker, combatResult, enemy, rollResult)) {
      this._showBowFollowUpPrompt(attacker, combatResult, roll, rollResult);
    } else {
      this._finishCombatRound(attacker, combatResult, roll, rollResult);
    }
  },

  _combatFinalHitDesc(attacker, enemy, combatResult = {}) {
    const damage = Math.max(0, combatResult.damage || 0);
    if (damage > 0) return `${attacker.name} 最後一擊對 ${enemy.name} 造成 ${damage} 點傷害。`;
    return `${attacker.name} 最後一擊擊敗 ${enemy.name}。`;
  },

  _handleDevTestDefeat(combatResult, attacker, enemy, roll, rollResult) {
    if (!G.combat || G.combat.source !== 'devTest') return false;
    if (!G.squad.every(c => c.dead || c.hp <= 0)) return false;
    const displayRoll = rollResult.displayValue || roll;
    for (const char of G.squad) {
      char.dead = false;
      char.hp = Math.max(1, Math.min(char.maxHp || 1, char.hp || 1));
      CombatStatus.clearBlock(char);
    }
    this._endWagerDiceAttackFlow();
    G.combat = null;
    this._log('測試戰鬥失敗：測試模式不會結束遊戲，隊伍已恢復至 1 HP。', 'dim');
    const diceLabel = attacker ? `${attacker.name} 的攻擊骰` : '守勢骰';
    this._openModal({
      title: '測試戰鬥失敗',
      desc: `${enemy.name} 擊倒了測試隊伍。\n\n測試戰鬥失敗不會結束遊戲，隊伍已恢復至 1 HP。`,
      combatLog: combatResult.logs,
      combat: this._buildCombatScene(enemy, attacker, '測試戰鬥失敗'),
      dice: { type: 'combat', label: diceLabel, value: displayRoll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
      choices: [{ label: '確認', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
    return true;
  },

  _canBowFollowUp(attacker, combatResult, enemy, rollResult) {
    if (!G.combat || !attacker || !enemy || enemy.hp <= 0) return false;
    if (attacker.hp <= 0 || attacker.dead) return false;
    if (attacker.weapon?.effect?.type !== 'bow_followup') return false;
    if (rollResult.starHunterForceSixNoWeakness) return false;
    if (combatResult.grapplingHookAssisted && combatResult.realWeaknessHit) return false;
    if (!combatResult.realWeaknessHit && !this._eagleFeatherCanTrigger(attacker, rollResult)) return false;
    const max = attacker.weapon.effect.maxPerRound || 2;
    return (G.combat.bowFollowUps || 0) < max;
  },

  _applyBandageGearHeal(attacker, logs = []) {
    const effect = attacker?.gear?.effect;
    if (!G.combat || effect?.type !== 'battlefield_bandage') return false;
    if (G.combat.bandageUsed?.[attacker.id]) return false;
    const target = this._lowestHpRatioTarget();
    if (!target) return false;

    G.combat.bandageUsed[attacker.id] = true;
    const heal = effect.value || 3;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + heal);
    const gained = target.hp - before;
    if (gained <= 0) return false;
    logs.push(`${attacker.gear.name}：${attacker.name} 急救 ${target.name}，恢復 ${gained} HP`);
    return true;
  },

  _lowestHpRatioTarget() {
    return this._aliveSquad()
      .filter(char => char.hp < char.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.hp - b.hp)[0] || null;
  },

  _eagleFeatherCanTrigger(attacker, rollResult) {
    const relic = this._eagleFeatherRelic(attacker);
    if (!relic || rollResult.starHunterForceSixNoWeakness) return false;
    const min = relic.effect?.finalMin ?? relic.effect?.naturalMin ?? 5;
    return (rollResult.value ?? rollResult.raw) >= min;
  },

  _eagleFeatherRelic(attacker) {
    return attacker?.fusedRelic?.id === 'eagle_eye_feather'
      ? attacker.fusedRelic
      : (attacker?.relic?.id === 'eagle_eye_feather' ? attacker.relic : null);
  },

  _hasStarHunterEye(char) {
    return !!char && char.fusedRelic?.id === 'eagle_eye_feather' && char.relic?.id === 'flaw_lens';
  },

  _prepareStarHunterEyeWeakness(attacker) {
    const enemy = G.combat?.enemy;
    if (!enemy || !attacker) return '';
    if (!this._hasStarHunterEye(attacker)) return '';
    if (attacker.weapon?.effect?.type !== 'bow_followup') return '';
    if (enemy.eagleNativeWeakness?.source === 'star_hunter_eye') return '';
    const value = CombatRules._nextEagleWeakness(enemy, enemy.weakness);
    G.combat.starHunterEyeRound = G.combat.round;
    if (!value) return '獵星之眼：沒有可用骰面新增鷹眼暫時原生弱點。';
    CombatRules._setEagleWeakness(enemy, { kind: 'native', value, duration: null, round: G.combat.round, source: 'star_hunter_eye' });
    return `獵星之眼：戰鬥節奏校準，新增鷹眼暫時原生弱點 ${value}，命中後消失。`;
  },

  _hasStarBreakerEye(char) {
    return !!char && char.fusedRelic?.id === 'flaw_lens' && char.relic?.id === 'eagle_eye_feather';
  },

  _applyStarHunterForceSix(rollResult) {
    if (rollResult?.pollutionLocked) {
      this._log('污染骰面鎖定，獵星之眼無法改變本次骰面。', 'danger');
      return rollResult;
    }
    rollResult.value = 6;
    rollResult.floored = true;
    rollResult.starHunterForceSixNoWeakness = true;
    this._log('獵星之眼：最後一次弓追擊視為 6，不額外觸發弱點破除。', 'reward');
    return rollResult;
  },

  _showBowFollowUpPrompt(attacker, combatResult, roll, rollResult) {
    const enemy = G.combat.enemy;
    const displayRoll = rollResult.displayValue || roll;
    const max = attacker.weapon?.effect?.maxPerRound || 2;
    const used = G.combat.bowFollowUps || 0;
    const eagleTriggered = !combatResult.realWeaknessHit && this._eagleFeatherCanTrigger(attacker, rollResult);
    const eagleRelic = eagleTriggered ? this._eagleFeatherRelic(attacker) : null;
    const damageLine = combatResult.damage > 0
      ? `本次攻擊造成 ${combatResult.damage} 點傷害。`
      : '本次攻擊造成 0 點傷害。';
    const followUpAction = () => {
      if (attacker.hp <= 0 || attacker.dead) {
        this._closeModal();
        this._finishCombatRound(attacker, combatResult, roll, rollResult);
        return;
      }
      const nextFollowUpCount = (G.combat.bowFollowUps || 0) + 1;
      G.combat.bowFollowUps = nextFollowUpCount;
      const followUpOpts = { bowFollowUp: true };
      const followUpDamageStep = attacker.weapon?.effect?.followUpDamageStep || 0;
      if (followUpDamageStep > 0) followUpOpts.bowFollowUpDamageBonus = followUpDamageStep * nextFollowUpCount;
      if (this._hasStarHunterEye(attacker)) {
        followUpOpts.starHunterEyeDamageBonus = 2;
        if (nextFollowUpCount >= (attacker.weapon?.effect?.maxPerRound || 2)) followUpOpts.starHunterForceSix = true;
      }
      if (eagleRelic?.effect?.firstFollowUpDamageBonus && !G.combat.eagleFeatherDamageUsed) {
        G.combat.eagleFeatherDamageUsed = true;
        followUpOpts.eagleFeatherDamageBonus = eagleRelic.effect.firstFollowUpDamageBonus;
      }
      this._doCombatRound(attacker, null, followUpOpts);
    };
    const latestPlayerDamageEvents = Array.isArray(combatResult.latestPlayerDamageEvents)
      ? combatResult.latestPlayerDamageEvents
      : (Array.isArray(combatResult.playerDamageEvents) ? combatResult.playerDamageEvents : []);
    const promptAnimResult = {
      ...combatResult,
      playerDamageEvents: latestPlayerDamageEvents,
      rapierDamageEvents: [],
      rapierFollowHits: 0,
      incomingDamageEvents: [],
      guardBlock: 0,
      guardTargetId: null,
      guardRemainingBlockByChar: null,
      counterDmg: 0,
      counterTargetId: null,
      aoeCounter: 0,
      enemyBlockGain: 0,
      enemyAttackFlow: false,
    };
    combatResult.skipPlayerDamageAnims = true;
    this._openModal({
      title: '弓追擊',
      desc: eagleTriggered
        ? `${attacker.name} 的鷹眼羽飾讓最終骰面 ${rollResult.value} 視為命中原生弱點，可追加攻擊。\n${damageLine}\n\n本回合追擊：${used}/${max}`
        : `${attacker.name} 命中原生弱點，可追加攻擊。\n${damageLine}\n\n本回合追擊：${used}/${max}`,
      combatLog: combatResult.logs,
      combat: {
        ...this._buildCombatScene(enemy, attacker, this._combatStatusText()),
        selectable: false,
        itemTargeting: false,
        showBag: false,
        inventory: this._combatInventoryView(),
        canUseBag: false,
        rollItemBlocked: true,
        followUpTargetId: attacker.id,
        followUpLabel: `追擊 剩${max - used}`,
        followUpHint: '點擊角色卡繼續追擊',
        onFollowUpTarget: followUpAction,
      },
      combatAnims: this._combatResultAnims(attacker, promptAnimResult, 120),
      dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: displayRoll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
      choices: [
        {
          label: '結束攻擊',
          action: () => {
            this._closeModal();
            this._finishCombatRound(attacker, combatResult, roll, rollResult);
          },
        },
      ],
    });
  },

  _canRaiseBannerBeforeAttack(attacker) {
    if (!G.combat || !attacker || attacker.hp <= 0 || attacker.dead) return false;
    return this._bannerRelics(attacker).some(entry =>
      entry.faces.some(face => !this._sameBannerFaceActive(entry.relic.id, face.id))
    );
  },

  _bannerRelics(char) {
    return [char?.relic, char?.fusedRelic].filter(Boolean).map(relic => {
      const effect = relic.effect?.type === 'banner' ? relic.effect : null;
      if (!effect) return null;
      return { relic, faces: effect.faces || [], fused: !!effect.fused };
    }).filter(entry => entry && entry.faces.length > 0);
  },

  _promptRaiseBannerBeforeAttack(attacker, opts = {}) {
    const entries = this._bannerRelics(attacker).filter(entry =>
      entry.faces.some(face => !this._sameBannerFaceActive(entry.relic.id, face.id))
    );
    const choices = [];
    for (const entry of entries) {
      choices.push({
        label: `舉起 ${entry.relic.name}`,
        action: () => this._resolveRaiseBannerBeforeAttack(attacker, entry, opts),
      });
    }
    choices.push({
      label: '不舉旗',
      action: () => {
        this._doCombatRound(attacker, null, { ...opts, bannerPrompted: true });
      },
    });
    this._openModal({
      title: '舉旗',
      desc: this._hasDualBannerResonance(attacker)
        ? `${attacker.name} 可以在攻擊前選擇要舉起哪一件旗。旗面會自動決定，雙旗戰陣可同時維持 1 面戰爭旗與 1 面鷹眼旗。`
        : `${attacker.name} 可以在攻擊前選擇是否舉旗。旗面會自動決定，新旗面會取代目前旗面。`,
      combat: {
        ...this._buildCombatScene(G.combat.enemy, attacker, this._combatStatusText()),
        selectable: false,
        itemTargeting: false,
        showBag: false,
        inventory: this._combatInventoryView(),
        canUseBag: false,
        rollItemBlocked: true,
      },
      choices,
    });
  },

  _bannerEntryDetail(entry, supportRoll) {
    const parts = [];
    for (const face of entry.faces) {
      if (this._sameBannerFaceActive(entry.relic.id, face.id)) continue;
      const baseValue = Array.isArray(face.values) ? face.values[0] : 0;
      parts.push(`${face.name}：${this._bannerFaceEffectText(face, baseValue)}`);
    }
    let text = parts.length > 0 ? parts.join('；') : '目前沒有可替換的旗面';
    if (supportRoll) {
      return entry.fused
        ? `${text}。輔助舉起融合旗：1-4 二階，5-6 三階。`
        : `${text}。輔助舉旗需判定：1-2 失敗，3-4 二階，5-6 三階。`;
    }
    return entry.fused
      ? `${text}。融合旗由非輔助舉起時直接二階。`
      : `${text}。`;
  },

  _bannerFaceEffectText(face, baseValue) {
    if (face.type === 'banner_round_damage') {
      return `每回合開始時造成 ${baseValue} 點固定傷害`;
    }
    if (face.type === 'hit_damage_bonus') {
      return `全隊擊中傷害 +${baseValue}`;
    }
    if (face.type === 'first_hit_wound') {
      return `每回合第一次擊中施加 ${baseValue} 層傷口`;
    }
    if (face.type === 'eagle_temp_weakness') {
      return '每回合附加 1 個鷹眼破綻，高階命中時額外增傷';
    }
    if (face.type === 'eagle_native_weakness') {
      return '命中任一原生弱點時增傷，高階可新增鷹眼暫時原生弱點';
    }
    return face.name || '旗面效果';
  },

  _autoBannerFace(entry) {
    const faces = entry.faces.filter(face => !this._sameBannerFaceActive(entry.relic.id, face.id));
    if (faces.length === 0) return null;
    return faces[Math.floor(Math.random() * faces.length)];
  },

  _resolveRaiseBannerBeforeAttack(attacker, entry, opts = {}) {
    const face = this._autoBannerFace(entry);
    if (!face) {
      this._doCombatRound(attacker, null, { ...opts, bannerPrompted: true });
      return;
    }
    const pendingBanner = { entry, face };
    this._doCombatRound(attacker, null, { ...opts, bannerPrompted: true, pendingBanner });
  },

  _activatePendingBannerForRoll(attacker, pendingBanner, rollResult) {
    const entry = pendingBanner?.entry;
    const face = pendingBanner?.face;
    if (!entry || !face) return [];
    const logs = [];
    let level = entry.fused ? 2 : 1;
    if (attacker.cls === 'support') {
      const value = rollResult.value;
      if (!entry.fused && value <= 2) {
        logs.push(`執旗判定：${attacker.name} 擲出 ${Dice.face(value)}（${value}），舉旗失敗，旗面不變。`);
        return logs;
      }
      level = value >= 5 ? 3 : 2;
      logs.push(`執旗判定：${attacker.name} 擲出 ${Dice.face(value)}（${value}），${level === 3 ? '三階成功' : '二階成功'}。`);
    }
    const raised = {
      relicId: entry.relic.id,
      name: entry.relic.name,
      faceId: face.id,
      faceName: face.name,
      faceType: face.type,
      values: face.values || [],
      nativeDamage: face.nativeDamage || null,
      rollGreaterThan: face.rollGreaterThan || null,
      durations: face.durations || null,
      level,
      ownerId: attacker.id,
      ownerName: attacker.name,
      usedThisRound: false,
    };
    const active = this._activeCombatBanners();
    const maxBanners = this._hasDualBannerResonance(attacker) ? 2 : 1;
    const next = maxBanners > 1
      ? active.filter(banner => banner.relicId !== entry.relic.id)
      : [];
    next.push(raised);
    G.combat.banners = next.slice(-maxBanners);
    G.combat.banner = G.combat.banners[G.combat.banners.length - 1] || null;
    logs.push(`${attacker.name} 舉起 ${entry.relic.name}・${face.name}（${level} 階）。`);
    return logs;
  },

  showCombatBannerDetail(charId, relicId, faceId, ev = null) {
    if (!G.combat) return;
    const banner = this._activeCombatBanners().find(activeBanner =>
      activeBanner.ownerId === charId && activeBanner.relicId === relicId && activeBanner.faceId === faceId
    );
    if (!banner) return;
    let popover = document.getElementById('combat-banner-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'combat-banner-popover';
      popover.className = 'combat-banner-popover';
      document.body.appendChild(popover);
    }
    popover.replaceChildren();

    const title = document.createElement('div');
    title.className = 'combat-banner-popover-title';
    title.textContent = `${banner.name}・${banner.faceName}`;
    const desc = document.createElement('div');
    desc.className = 'combat-banner-popover-desc';
    desc.textContent = this._combatBannerDetailText(banner);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'combat-banner-popover-close';
    close.textContent = '關閉';
    close.addEventListener('click', () => popover.classList.remove('visible'));
    popover.append(title, desc, close);

    popover.classList.add('visible');
    const target = ev?.currentTarget || null;
    const rect = target?.getBoundingClientRect?.() || null;
    const left = rect ? rect.left : (window.innerWidth / 2 - 130);
    const top = rect ? rect.bottom + 6 : (window.innerHeight / 2 - 70);
    popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - popover.offsetWidth - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(top, window.innerHeight - popover.offsetHeight - 8))}px`;

    if (!this._combatBannerOutsideHandler) {
      this._combatBannerOutsideHandler = event => {
        const panel = document.getElementById('combat-banner-popover');
        if (!panel?.classList.contains('visible')) return;
        if (event.target.closest?.('#combat-banner-popover, .combat-banner-badge')) return;
        panel.classList.remove('visible');
      };
      document.addEventListener('click', this._combatBannerOutsideHandler);
    }
  },

  _combatBannerView(banner) {
    return {
      relicId: banner.relicId,
      faceId: banner.faceId,
      name: banner.name,
      faceName: banner.faceName,
      shortName: this._combatBannerShortName(banner),
      level: banner.level || 1,
    };
  },

  _combatBannerShortName(banner) {
    if (banner.faceType === 'banner_round_damage') return '戰吼旗';
    if (banner.faceType === 'hit_damage_bonus') return '戰吼旗';
    if (banner.faceType === 'first_hit_wound') return '創傷旗';
    if (banner.faceType === 'eagle_temp_weakness') return '破綻旗';
    if (banner.faceType === 'eagle_native_weakness') return '原生旗';
    return banner.faceName || banner.name || '旗';
  },

  _combatBannerDetailText(banner) {
    const value = this._bannerLevelValue(banner.values, banner.level);
    if (banner.faceType === 'banner_round_damage') {
      return `目前 ${banner.level} 階。每回合開始時對敵人造成 ${value} 點固定傷害。`;
    }
    if (banner.faceType === 'hit_damage_bonus') {
      return `目前 ${banner.level} 階。全隊擊中時，本次傷害 +${value}。`;
    }
    if (banner.faceType === 'first_hit_wound') {
      return `目前 ${banner.level} 階。每回合第一次擊中敵人時，施加 ${value} 層傷口。`;
    }
    if (banner.faceType === 'eagle_temp_weakness') {
      return `目前 ${banner.level} 階。每回合附加 1 個鷹眼破綻；高階命中時可額外提高傷害。`;
    }
    if (banner.faceType === 'eagle_native_weakness') {
      const nativeDamage = this._bannerLevelValue(banner.nativeDamage, banner.level);
      return `目前 ${banner.level} 階。命中原生弱點時傷害 +${nativeDamage}；高階可新增鷹眼暫時原生弱點。`;
    }
    return `目前 ${banner.level} 階。`;
  },

  _bannerLevelValue(values, level = 1) {
    const list = Array.isArray(values) ? values : [];
    return list[Math.max(0, (level || 1) - 1)] || 0;
  },

  _applyRoundStartBannerDamage(enemy, logs = null) {
    if (!enemy || enemy.hp <= 0) return null;
    const banners = this._activeCombatBanners();
    const warcry = banners.find(banner => banner.faceType === 'banner_round_damage');
    if (!warcry) return null;
    const owner = G.squad.find(char => char.id === warcry.ownerId && !char.dead && char.hp > 0) || null;
    let damage = this._bannerLevelValue(warcry.values, warcry.level);
    if (damage <= 0) return null;
    const dual = owner ? (G.activeResonances || []).find(res =>
      res?.effect?.type === 'dual_banner_formation' && res?.bodyChar?.id === owner.id
    ) : null;
    const ownerBannerCount = owner ? banners.filter(banner => banner.ownerId === owner.id).length : 0;
    if (dual && ownerBannerCount >= 2) {
      const rate = Math.max(0, dual.effect?.warcryDamageRate ?? 0.5);
      const bonus = Math.floor(damage * rate);
      damage += bonus;
      if (logs) logs.push(`雙旗戰陣：雙旗並立，戰吼旗傷害 +${bonus}。`);
    }
    const before = enemy.hp;
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (logs) logs.push(`${warcry.name}・${warcry.faceName}：回合開始造成 ${damage} 點固定傷害（${before} → ${enemy.hp}）。`);
    return { banner: warcry, owner, damage, from: before, to: enemy.hp, enemyDead: enemy.hp <= 0 };
  },

  _applyRoundStartBannerDamageIfNeeded(actor = null) {
    if (!G.combat?.enemy || G.combat.enemy.hp <= 0) return null;
    const round = G.combat.round || 1;
    if (G.combat._warcryBannerDamageRound === round) return null;
    G.combat._warcryBannerDamageRound = round;

    const logs = [];
    const result = this._applyRoundStartBannerDamage(G.combat.enemy, logs);
    if (!result) return logs.length ? { logs } : null;
    if (!result.enemyDead) return { logs };

    const attacker = result.owner || actor || this._aliveSquad()[0] || null;
    if (!attacker) return { logs };
    const combatResult = {
      damage: result.damage,
      weaknessHit: false,
      logs,
      playerDamageEvents: [{
        type: 'fixed',
        damage: result.damage,
        from: result.from,
        to: result.to,
      }],
      incomingDamageEvents: [],
      enemyBlockGain: 0,
      counterDmg: 0,
      counterTargetId: null,
      counterTargetName: null,
      aoeCounter: 0,
      aoeDamageByChar: null,
      enemyDiceRoll: null,
      enemyAttackFlow: false,
      enemyDead: true,
    };
    this._handleCombatVictory({
      attacker,
      enemy: G.combat.enemy,
      cell: G.combat.cell,
      reward: G.combat.reward,
      source: G.combat.source,
      darkMonsterId: G.combat.darkMonsterId,
      darkMonsterRef: G.combat.darkMonsterRef,
      combatResult,
      roll: 0,
      rollResult: { raw: 0, value: 0, sides: 6, charCls: attacker.cls },
    });
    return { logs, victory: true };
  },

  _activeCombatBanners() {
    if (!G.combat) return [];
    const banners = Array.isArray(G.combat.banners)
      ? G.combat.banners.filter(Boolean)
      : (G.combat.banner ? [G.combat.banner] : []);
    const active = banners.filter(banner => this._combatBannerOwnerAlive(banner));
    if (Array.isArray(G.combat.banners) && active.length !== G.combat.banners.length) {
      G.combat.banners = active;
      G.combat.banner = active[active.length - 1] || null;
    } else if (!Array.isArray(G.combat.banners) && G.combat.banner && active.length === 0) {
      G.combat.banner = null;
    }
    return active;
  },

  _combatBannerOwnerAlive(banner) {
    const owner = G.squad?.find(char => char.id === banner.ownerId);
    return !!owner && owner.hp > 0 && !owner.dead;
  },

  _sameBannerFaceActive(relicId, faceId) {
    return this._activeCombatBanners().some(banner => banner.relicId === relicId && banner.faceId === faceId);
  },

  _hasDualBannerResonance(char) {
    if (!char) return false;
    const relicIds = new Set([char.relic?.id, char.fusedRelic?.id].filter(Boolean));
    const hasBoth = relicIds.has('war_banner') && relicIds.has('eagle_banner');
    const hasFusedBanner = ['war_banner', 'eagle_banner'].includes(char.fusedRelic?.id);
    return hasBoth && hasFusedBanner;
  },

  _applyDeferredEnemyAction(attacker, combatResult) {
    const deferred = G.combat?.deferredEnemyAction;
    if (!deferred) return false;
    G.combat.deferredEnemyAction = null;

    const enemy = G.combat?.enemy;
    const logs = combatResult.logs || [];
    if (!enemy || enemy.hp <= 0) return false;

    const intent = deferred.intent || G.combat.intent || null;
    const round = deferred.round || G.combat.round || 1;
    const squad = G.squad || [];
    let enemyBlockGain = 0;
    const enemyWillBlock = !enemy.blockBroken && (intent?.type === 'block' || intent?.type === 'block_attack');
    if (enemyWillBlock) {
      const blockVal = Math.max(0, enemy.block || 0);
      if (blockVal > 0) {
        CombatStatus.raiseBlock(enemy, blockVal);
        enemyBlockGain = blockVal;
        logs.push(`${enemy.name} 格檔 +${blockVal}`);
        EnemyAbilities.afterEnemyBlock?.({
          enemy,
          intent,
          block: blockVal,
          logs,
          round,
        });
      }
    }

    let counterDmg = 0;
    let aoeCounter = 0;
    let enemyDiceRoll = null;
    let enemyAttackFlow = ['attack', 'block_attack', 'dice_attack', 'aoe'].includes(intent?.type);
    if (enemyAttackFlow) {
      if (intent?.type === 'attack' || intent?.type === 'block_attack') counterDmg = enemy.attack;
      else if (intent?.type === 'dice_attack') {
        enemyDiceRoll = Math.ceil(Math.random() * 6);
        counterDmg = enemyDiceRoll;
        logs.push(`${enemy.name} 擲骰攻擊：${counterDmg}`);
      } else if (intent?.type === 'aoe') {
        aoeCounter = Math.max(1, enemy.attack - 2);
      }
    }

    const fallbackTarget = squad.find(c => c.id === attacker?.id && c.hp > 0 && !c.dead)
      || squad.find(c => c.hp > 0 && !c.dead)
      || null;
    const counterTarget = counterDmg > 0
      ? (squad.find(c => c.id === intent?.targetId && c.hp > 0 && !c.dead) || fallbackTarget)
      : null;
    const enemyActionResult = {
      counterDmg,
      aoeCounter,
      enemyDiceRoll,
      enemyAttackFlow,
      counterTarget,
      counterTargetId: counterTarget?.id || null,
      counterTargetName: counterTarget?.name || null,
      aoeDamageByChar: null,
      gazeSummary: null,
      fateSummary: null,
      bannerSummary: null,
      fateLuckyFace: null,
      fateUnluckyFaces: null,
    };

    EnemyAbilities.beforeEnemyAction(enemyActionResult, {
      attacker,
      enemy,
      squad,
      intent,
      logs,
      round,
    });

    counterDmg = Math.max(0, enemyActionResult.counterDmg || 0);
    aoeCounter = Math.max(0, enemyActionResult.aoeCounter || 0);
    enemyDiceRoll = enemyActionResult.enemyDiceRoll;
    enemyAttackFlow = !!enemyActionResult.enemyAttackFlow;
    const aoeDamageByChar = enemyActionResult.aoeDamageByChar || null;

    if (enemyAttackFlow && (counterDmg > 0 || aoeCounter > 0)) {
      const attackReduction = Math.max(0, enemy.abilityState?.nextAttackReduction || 0);
      if (attackReduction > 0) {
        const beforeSingle = counterDmg;
        const beforeAoe = aoeCounter;
        counterDmg = Math.max(0, counterDmg - attackReduction);
        aoeCounter = Math.max(0, aoeCounter - attackReduction);
        enemy.abilityState.nextAttackReduction = 0;
        logs.push(`${enemy.name} 黑霧裂解：下一次攻擊 -${attackReduction}（${beforeSingle > 0 ? `${beforeSingle} → ${counterDmg}` : `全體 ${beforeAoe} → ${aoeCounter}`}）。`);
      }
    }

    if (counterDmg > 0 && counterTarget) {
      const armorReduce = (deferred.combatMods || []).filter(m => m.type === 'damage_reduce').reduce((s, m) => s + m.value, 0);
      if (armorReduce > 0) {
        counterDmg = Math.max(0, counterDmg - armorReduce);
        logs.push(`護甲道具：反擊 -${armorReduce}，剩餘 ${counterDmg}`);
      }
      if ((deferred.supportTacticalDamageReduce || 0) > 0 && counterTarget.id === attacker?.id) {
        counterDmg = Math.max(0, counterDmg - deferred.supportTacticalDamageReduce);
        logs.push(`輔助戰術支援：${attacker.name} 受擊傷害 -${deferred.supportTacticalDamageReduce}，剩餘 ${counterDmg}`);
      }
      counterDmg = CombatStatus.applyWoundTakenBonus(counterTarget, counterDmg, logs);
      counterDmg = CombatStatus.applyBannerBearerDamageReduction(counterTarget, counterDmg, logs);
      if (CombatStatus.getBlock(counterTarget) > 0) {
        const blockResult = CombatStatus.consumeBlock(counterTarget, counterDmg);
        counterDmg = blockResult.damage;
        logs.push(`格檔吸收 ${blockResult.absorbed}，剩餘格檔 ${blockResult.block}，反擊 ${counterDmg}`);
      }
      if (counterDmg > 0) {
        counterDmg = CombatStatus.applyIncomingRiskBonuses(counterTarget, counterDmg, {
          allowRemorse: !deferred.wagerDice?.active,
          allowBacklash: true,
          logs,
          damageLabel: '受擊傷害',
          resultLabel: '反擊',
        });
        const beforeHp = counterTarget.hp;
        counterTarget.hp = Math.max(0, counterTarget.hp - counterDmg);
        combatResult.incomingDamageEvents = Array.isArray(combatResult.incomingDamageEvents) ? combatResult.incomingDamageEvents : [];
        combatResult.incomingDamageEvents.push({
          type: 'counter',
          targetId: counterTarget.id,
          damage: counterDmg,
          from: beforeHp,
          to: counterTarget.hp,
        });
        logs.push(`${enemy.name} 攻擊 ${counterTarget.name}，造成 ${counterDmg} 傷害。`);
      } else {
        logs.push(`${enemy.name} 的反擊被完全抵消。`);
      }
    }

    if (aoeCounter > 0) {
      const alive = this._aliveSquad();
      const variedAoe = aoeDamageByChar && Object.keys(aoeDamageByChar).length > 0;
      logs.push(variedAoe
        ? `${enemy.name} 全體攻擊，各自承受最多 ${aoeCounter} 傷害。`
        : `${enemy.name} 全體攻擊，全隊各 ${aoeCounter} 傷害。`);
      combatResult.incomingDamageEvents = Array.isArray(combatResult.incomingDamageEvents) ? combatResult.incomingDamageEvents : [];
      for (const c of alive) {
        let incomingAoe = Math.max(0, aoeDamageByChar?.[c.id] ?? aoeCounter);
        incomingAoe = CombatStatus.applyWoundTakenBonus(c, incomingAoe, logs);
        let reduced = this._reduceIncomingDamage(c, incomingAoe, true, !deferred.wagerDice, logs);
        if (CombatStatus.getBlock(c) > 0 && reduced > 0) {
          const blockResult = CombatStatus.consumeBlock(c, reduced);
          reduced = blockResult.damage;
          logs.push(`${c.name} 格檔吸收 ${blockResult.absorbed}，剩餘格檔 ${blockResult.block}`);
        }
        const beforeHp = c.hp;
        c.hp = Math.max(0, c.hp - reduced);
        if (reduced > 0) {
          combatResult.incomingDamageEvents.push({
            type: 'aoe',
            targetId: c.id,
            damage: reduced,
            from: beforeHp,
            to: c.hp,
          });
        }
      }
    } else if (enemyAttackFlow && counterDmg <= 0) {
      logs.push(`${enemy.name} 沒有造成傷害。`);
    } else if (intent?.type === 'block') {
      logs.push(`${enemy.name} 採取防禦，沒有反擊。`);
    } else if (intent?.type === 'banner_switch' && !enemyActionResult.bannerSummary) {
      logs.push(`${enemy.name} 換旗整隊，沒有攻擊。`);
    }

    EnemyAbilities.afterEnemyAction(enemyActionResult, {
      attacker,
      enemy,
      squad,
      intent,
      logs,
      round,
    });

    combatResult.enemyBlockGain = Math.max(0, combatResult.enemyBlockGain || 0) + enemyBlockGain;
    combatResult.counterDmg = counterDmg;
    combatResult.counterTargetId = counterTarget?.id || null;
    combatResult.counterTargetName = counterTarget?.name || null;
    combatResult.aoeCounter = aoeCounter;
    combatResult.aoeDamageByChar = aoeDamageByChar;
    combatResult.enemyDiceRoll = enemyDiceRoll;
    combatResult.gazeRoll = enemyActionResult.gazeRoll || null;
    combatResult.gazeSummary = enemyActionResult.gazeSummary || null;
    combatResult.fateRoll = enemyActionResult.fateRoll || null;
    combatResult.fateSummary = enemyActionResult.fateSummary || null;
    combatResult.bannerSummary = enemyActionResult.bannerSummary || null;
    combatResult.fateLuckyFace = enemyActionResult.fateLuckyFace || null;
    combatResult.fateUnluckyFaces = Array.isArray(enemyActionResult.fateUnluckyFaces) ? enemyActionResult.fateUnluckyFaces : [];
    combatResult.enemyAttackFlow = enemyAttackFlow;
    combatResult.enemyActionDeferred = false;
    return true;
  },

  _finishCombatRound(attacker, combatResult, roll, rollResult) {
        const enemy = G.combat.enemy;
        const displayRoll = rollResult.displayValue || roll;
        const appliedDeferredEnemyAction = this._applyDeferredEnemyAction(attacker, combatResult);
        if (appliedDeferredEnemyAction && combatResult.enemyAttackFlow) {
          if (combatResult.counterTargetId) this._halveCombatThreat(combatResult.counterTargetId);
          this._clearWagerDicePenaltyAfterEnemyFlow(combatResult.logs);
        }

        if (appliedDeferredEnemyAction && attacker.hp <= 0) {
          const echoMod = CombatRules.fallenEchoMod(G.squad, attacker);
          if (echoMod) {
            const { char, ...mod } = echoMod;
            G.combatMods.push(mod);
            this._log(`${char.name} 的餘響支援下一次攻擊骰 +${mod.value}。`, 'reward');
          }
        }

        if (appliedDeferredEnemyAction) {
          if (this._handleDevTestDefeat(combatResult, attacker, enemy, roll, rollResult)) return;
          if (this._checkLose()) return;
        }

        this._endWagerDiceAttackFlow();
        this._clearExpiredWeaknessEffects(enemy);
        for (const banner of this._activeCombatBanners()) banner.usedThisRound = false;
        for (const char of G.squad) {
          CombatStatus.clearBlock(char);
          char._grapplingHookUsedRound = false;
          char._corrosiveOilUsedRound = false;
          char._serratedOilUsedRound = false;
          char._rapierGuaranteedFollowUpsUsed = 0;
        }
        this._applyRearThreatTransfer(attacker, combatResult.logs);
        G.combat.round++;
        this._ensureRoundStartNativeWeakness(enemy, combatResult.logs);
        EnemyAbilities.onRoundStart(enemy, { ...G.combat, squad: G.squad }, combatResult.logs);
        G.combat.bowFollowUps = 0;
        G.combat.playerDamageEventsThisAttack = [];
        G.combat.itemUsedRound = 0;
        G.combat.rollItemUsedRound = 0;
        G.combat.bagOpen = false;
        G.combat.pendingInventoryItemIndex = null;
        G.combat.intent = this._resolveCombatIntent(enemy);
        G.combat.actionInProgress = false;
  
        // Section.
        const summaryLines = [];
        if (combatResult.damage > 0) {
          summaryLines.push(`${attacker.name} 攻擊 ${enemy.name}，造成 ${combatResult.damage} 傷害${combatResult.weaknessHit ? '，命中弱點。' : '。'}`);
        } else {
          summaryLines.push(`${attacker.name} 的攻擊被格檔，造成 0 傷害。`);
        }
        if (combatResult.stunned) {
          summaryLines.push(`${enemy.name} 失衡，本回合無法行動。`);
        } else if (combatResult.counterDmg > 0 && combatResult.aoeCounter > 0) {
          summaryLines.push(`${enemy.name} 攻擊主目標 ${combatResult.counterTargetName || attacker.name}，造成 ${combatResult.counterDmg} 傷害；其餘隊友濺射 ${combatResult.aoeCounter} 傷害。`);
        } else if (combatResult.aoeCounter > 0) {
          const variedAoe = combatResult.aoeDamageByChar && Object.keys(combatResult.aoeDamageByChar).length > 0;
          summaryLines.push(variedAoe
            ? `${enemy.name} 反擊全隊，基礎 ${combatResult.aoeCounter} 傷害，凝視命中者加倍。`
            : `${enemy.name} 反擊全隊，造成 ${combatResult.aoeCounter} 傷害。`);
        } else if (combatResult.counterDmg > 0) {
          summaryLines.push(`${enemy.name} 攻擊 ${combatResult.counterTargetName || attacker.name}，造成 ${combatResult.counterDmg} 傷害。`);
        } else {
          summaryLines.push(`${enemy.name} 本回合沒有造成傷害。`);
        }
        if (combatResult.gazeSummary) summaryLines.push(combatResult.gazeSummary);
        if (combatResult.fateSummary) summaryLines.push(combatResult.fateSummary);
        if (combatResult.bannerSummary) summaryLines.push(combatResult.bannerSummary);
  
        this._openModal({
          title: `戰鬥：第 ${G.combat.round - 1} 回合結果`,
          desc: summaryLines.join('\n'),
          combatLog: combatResult.logs,
          combat: {
            ...this._buildCombatScene(enemy, attacker, this._combatStatusText()),
            selectable: true,
            itemTargeting: false,
            showBag: false,
            inventory: this._combatInventoryView(),
            canUseBag: this._canUseCombatBag(),
            canGuard: this._canUseCombatGuard(),
            guardCooldown: this._combatGuardCooldown(),
            rollItemBlocked: G.combat.rollItemUsedRound === G.combat.round,
          },
          combatAnims: this._combatResultAnims(attacker, combatResult, 120),
          dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: displayRoll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
          enemyDice: combatResult.gazeRoll
            ? { type: 'danger', label: '裂隙凝視骰', value: combatResult.gazeRoll, sides: 6 }
            : (combatResult.fateRoll
              ? {
                type: 'danger',
                label: combatResult.fateLuckyFace
                  ? `命運骰（幸運 ${combatResult.fateLuckyFace} / 厄運 ${(combatResult.fateUnluckyFaces || []).join('、')}）`
                  : '命運骰',
                value: combatResult.fateRoll,
                sides: 6,
              }
              : (combatResult.enemyDiceRoll
                ? { type: 'danger', label: `${enemy.name} 的攻擊骰`, value: combatResult.enemyDiceRoll, sides: 6 }
                : null)),
          choices: this._combatActionChoices(),
        });
    },

  _combatResultAnims(attacker, combatResult = {}, delay = 400) {
    const playerDamageEvents = combatResult.skipPlayerDamageAnims
      ? []
      : (Array.isArray(combatResult.playerDamageEvents)
        ? combatResult.playerDamageEvents
        : (Array.isArray(combatResult.rapierDamageEvents) ? combatResult.rapierDamageEvents : []));
    return {
      playerAttacker: attacker?.id || null,
      playerFollowHits: Math.max(combatResult.rapierFollowHits || 0, playerDamageEvents.length),
      playerDamageEvents,
      incomingDamageEvents: Array.isArray(combatResult.incomingDamageEvents) ? combatResult.incomingDamageEvents : [],
      guardBlock: combatResult.guardBlock || 0,
      guardTargetId: combatResult.guardTargetId || null,
      guardRemainingBlockByChar: combatResult.guardRemainingBlockByChar || null,
      counterTarget: combatResult.enemyAttackFlow && combatResult.counterTargetId
        ? combatResult.counterTargetId
        : (combatResult.counterDmg > 0 ? (attacker?.id || null) : null),
      aoe: combatResult.aoeCounter > 0,
      enemyBlock: combatResult.enemyBlockGain > 0,
      delay,
    };
  },

  _ensureRoundStartNativeWeakness(enemy, logs = []) {
    if (!G.combat || !enemy || !Number.isFinite(enemy.weakness)) return;
    if (!this._combatHasStarBreakerEye()) return;
    if (CombatRules._nativeWeaknessSet(enemy).size > 0) return;
    const generated = [];
    while (CombatRules._nativeWeaknessSet(enemy).size < 2) {
      const value = CombatRules._randomNativeWeakness(enemy);
      if (!value) break;
      CombatStatus.addExtraNativeWeakness(enemy, value, { source: 'restored_native' });
      generated.push(value);
    }
    if (generated.length > 0) {
      logs.push(`原生弱點重新浮現：${enemy.name} 獲得原生弱點 ${generated.join('、')}。`);
    }
  },

  _combatHasStarBreakerEye() {
    return this._aliveSquad().some(char => this._hasStarBreakerEye(char));
  },

  _clearExpiredWeaknessEffects(enemy) {
    if (!G.combat || !enemy) return;
    const round = G.combat.round || 1;
    if (enemy.blockBrokenUntilRound && round >= enemy.blockBrokenUntilRound) {
      enemy.blockBroken = false;
      enemy.blockBrokenUntilRound = null;
      this._log('敵人格檔恢復。', 'info');
    }
    if (enemy.exposedUntilRound && round >= enemy.exposedUntilRound) {
      enemy.exposed = false;
      enemy.exposedUntilRound = null;
      this._log('敵人破綻狀態結束。', 'info');
    }
    if (enemy.eagleNativeWeakness?.expiresRound && round >= enemy.eagleNativeWeakness.expiresRound) {
      CombatStatus.setEagleNativeWeakness(enemy, null);
      this._log('鷹眼暫時原生弱點消失。', 'info');
    }
  },

  selectCombatAttacker(charId) {
    if (this._combatItemTargeting() || this._combatGuardTargeting() || G.combat?.actionInProgress) return;
    if (G.combat) G.combat.bagOpen = false;
    const char = G.squad.find(c => c.id === charId);
    if (!char || char.dead || char.hp <= 0) return;
    if (G.combat) G.combat.attackerId = char.id;
    document.querySelectorAll('.combat-unit.ally.active').forEach(el => el.classList.remove('active'));
    document.querySelector(`.combat-unit.ally[data-char-id="${char.id}"]`)?.classList.add('active');
    G.combat.actionInProgress = true;
    this._doCombatRound(char);
  },

  selectCombatGuard() {
    if (!G.combat || this._combatItemTargeting() || G.combat.actionInProgress) return;
    if (!this._canUseCombatGuard()) return;
    G.combat.guardTargeting = true;
    G.combat.bagOpen = false;
    G.combat.pendingInventoryItemIndex = null;
    this._showCombatModal();
  },

  selectCombatGuardTarget(charId) {
    if (!G.combat || !this._combatGuardTargeting() || G.combat.actionInProgress) return;
    const enemy = G.combat.enemy;
    if (!enemy || enemy.hp <= 0) return;
    const target = G.squad.find(c => c.id === charId);
    if (!target || target.dead || target.hp <= 0) return;

    const roundStart = this._applyRoundStartBannerDamageIfNeeded(target);
    if (roundStart?.victory) return;
    if (roundStart?.logs?.length) {
      G.combat._pendingRoundStartLogs = [
        ...(G.combat._pendingRoundStartLogs || []),
        ...roundStart.logs,
      ];
    }

    G.combat.actionInProgress = true;
    G.combat.guardTargeting = false;
    G.combat.bagOpen = false;
    G.combat.attackerId = null;
    document.querySelectorAll('.combat-unit.ally.active').forEach(el => el.classList.remove('active'));

    const roll = Dice.rollRaw();
    this._showCombatGuardDicePreview(roll, () => this._resolveCombatGuard(roll, target.id));
  },

  cancelCombatGuardTargeting() {
    if (!G.combat || G.combat.actionInProgress) return;
    G.combat.guardTargeting = false;
    this._showCombatModal();
  },

  _resolveCombatGuard(roll, targetId) {
    if (!G.combat) return;
    const enemy = G.combat.enemy;
    if (!enemy || enemy.hp <= 0) return;
    const target = G.squad.find(c => c.id === targetId && c.hp > 0 && !c.dead);
    if (!target) {
      G.combat.actionInProgress = false;
      this._showCombatModal();
      return;
    }
    const block = Math.max(1, roll || 0);
    const logs = [
      ...(G.combat._pendingRoundStartLogs || []),
      `守勢骰 ${Dice.face(roll)}（${roll}）：${target.name} 獲得格檔 ${block}。`,
    ];
    G.combat._pendingRoundStartLogs = [];
    const guardBlockByChar = {};
    CombatStatus.raiseBlock(target, block);
    guardBlockByChar[target.id] = CombatStatus.getBlock(target);
    logs.push(`${target.name} 格檔 +${block}`);

    const combatResult = {
      damage: 0,
      weaknessHit: false,
      logs,
      incomingDamageEvents: [],
      enemyBlockGain: 0,
      counterDmg: 0,
      counterTargetId: null,
      counterTargetName: null,
      aoeCounter: 0,
      aoeDamageByChar: null,
      enemyDiceRoll: null,
      enemyAttackFlow: false,
      guardBlock: block,
      guardTargetId: target.id,
      guardRemainingBlockByChar: {},
    };

    G.combat.deferredEnemyAction = {
      intent: G.combat.intent,
      round: G.combat.round,
      combatMods: G.combatMods || [],
      wagerDice: null,
    };
    const appliedEnemyAction = this._applyDeferredEnemyAction(null, combatResult);

    if (appliedEnemyAction) {
      if (combatResult.counterTargetId) this._halveCombatThreat(combatResult.counterTargetId);
      if (this._handleDevTestDefeat(combatResult, null, enemy, roll, { value: roll })) return;
      if (this._checkLose()) return;
    }

    const guardRemainingBlockByChar = {};
    for (const char of this._aliveSquad()) {
      guardRemainingBlockByChar[char.id] = CombatStatus.getBlock(char);
    }
    combatResult.guardRemainingBlockByChar = guardRemainingBlockByChar;

    this._clearExpiredWeaknessEffects(enemy);
    for (const banner of this._activeCombatBanners()) banner.usedThisRound = false;
    for (const char of G.squad) {
      CombatStatus.clearBlock(char);
      char._grapplingHookUsedRound = false;
      char._corrosiveOilUsedRound = false;
      char._serratedOilUsedRound = false;
      char._rapierGuaranteedFollowUpsUsed = 0;
    }

    G.combat.guardReadyRound = (G.combat.round || 1) + 4;
    G.combat.round++;
    this._ensureRoundStartNativeWeakness(enemy, combatResult.logs);
    EnemyAbilities.onRoundStart(enemy, { ...G.combat, squad: G.squad }, combatResult.logs);
    G.combat.bowFollowUps = 0;
    G.combat.itemUsedRound = 0;
    G.combat.rollItemUsedRound = 0;
    G.combat.bagOpen = false;
    G.combat.pendingInventoryItemIndex = null;
    G.combat.guardTargeting = false;
    G.combat.intent = this._resolveCombatIntent(enemy);
    G.combat.actionInProgress = false;

    const summaryLines = [`${target.name} 採取守勢，擲出 ${Dice.face(roll)}（${roll}），獲得 ${block} 格檔。`];
    if (combatResult.counterDmg > 0 && combatResult.aoeCounter > 0) {
      summaryLines.push(`${enemy.name} 攻擊主目標 ${combatResult.counterTargetName || '小隊'}，造成 ${combatResult.counterDmg} 傷害；其餘隊友濺射 ${combatResult.aoeCounter} 傷害。`);
    } else if (combatResult.aoeCounter > 0) {
      summaryLines.push(`${enemy.name} 攻擊全隊，基礎 ${combatResult.aoeCounter} 傷害。`);
    } else if (combatResult.counterDmg > 0) {
      summaryLines.push(`${enemy.name} 攻擊 ${combatResult.counterTargetName || '小隊'}，造成 ${combatResult.counterDmg} 傷害。`);
    } else {
      summaryLines.push(`${enemy.name} 本回合沒有造成傷害。`);
    }
    if (combatResult.gazeSummary) summaryLines.push(combatResult.gazeSummary);
    if (combatResult.fateSummary) summaryLines.push(combatResult.fateSummary);
    if (combatResult.bannerSummary) summaryLines.push(combatResult.bannerSummary);

    const combatScene = this._buildCombatScene(enemy, null, this._combatStatusText());
    combatScene.squad = combatScene.squad.map(char => ({
      ...char,
      block: Math.max(char.block || 0, guardBlockByChar[char.id] || 0),
    }));

    this._openModal({
      title: `戰鬥：第 ${G.combat.round - 1} 回合結果`,
      desc: summaryLines.join('\n'),
      combatLog: combatResult.logs,
      combat: {
        ...combatScene,
        selectable: true,
        itemTargeting: false,
        guardTargeting: false,
        showBag: false,
        inventory: this._combatInventoryView(),
        canUseBag: this._canUseCombatBag(),
        canGuard: this._canUseCombatGuard(),
        guardCooldown: this._combatGuardCooldown(),
        rollItemBlocked: G.combat.rollItemUsedRound === G.combat.round,
      },
      combatAnims: this._combatResultAnims(null, combatResult, 300),
      dice: { type: 'combat', label: '守勢骰', value: roll, raw: roll, floored: false, charCls: 'neutral', sides: 6 },
      enemyDice: combatResult.gazeRoll
        ? { type: 'danger', label: '裂隙凝視骰', value: combatResult.gazeRoll, sides: 6 }
        : (combatResult.fateRoll
          ? {
            type: 'danger',
            label: combatResult.fateLuckyFace
              ? `命運骰（幸運 ${combatResult.fateLuckyFace} / 厄運 ${(combatResult.fateUnluckyFaces || []).join('、')}）`
              : '命運骰',
            value: combatResult.fateRoll,
            sides: 6,
          }
          : (combatResult.enemyDiceRoll
            ? { type: 'danger', label: `${enemy.name} 的攻擊骰`, value: combatResult.enemyDiceRoll, sides: 6 }
            : null)),
      choices: this._combatActionChoices(),
    });
  },

  _canUseCombatGuard() {
    if (!G.combat || G.combat.actionInProgress || this._combatItemTargeting() || this._combatGuardTargeting()) return false;
    if (!this._aliveSquad().length) return false;
    return (G.combat.round || 1) >= (G.combat.guardReadyRound || 1);
  },

  _combatGuardTargeting() {
    return !!G.combat?.guardTargeting;
  },

  _combatGuardCooldown() {
    if (!G.combat) return 0;
    return Math.max(0, (G.combat.guardReadyRound || 1) - (G.combat.round || 1));
  },

  _combatActionChoices() {
    if (!this._canRetreatCombat()) return [];
    return [{
      label: '撤退',
      danger: true,
      detailTitle: '確認撤退',
      detail: this._retreatDetailText(),
      confirmLabel: '確認撤退',
      backLabel: '取消',
      action: () => this._retreatCombat(),
    }];
  },

  _supportTacticalActive(attacker) {
    if (!G.combat || !attacker || attacker.dead || attacker.hp <= 0) return false;
    return G.squad.some(c => c.id !== attacker.id && c.cls === 'support' && c.hp > 0 && !c.dead);
  },

  _applyCombatStartGear(enemy = null) {
    if (!G.combat) return [];
    const logs = [];
    for (const holder of G.squad || []) {
      if (!holder || holder.dead || holder.hp <= 0) continue;
      const effect = holder.gear?.effect;
      if (effect?.type !== 'combat_start_low_hp_heal') continue;
      const threshold = Math.max(0, Math.min(1, effect.threshold ?? 0.5));
      const heal = Math.max(0, effect.value || 0);
      if (heal <= 0) continue;
      const healed = [];
      for (const target of G.squad || []) {
        if (!target || target.dead || target.hp <= 0 || target.hp >= target.maxHp) continue;
        const ratio = (target.hp || 0) / Math.max(1, target.maxHp || target.hp || 1);
        if (ratio >= threshold) continue;
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + heal);
        const gained = target.hp - before;
        if (gained > 0) healed.push(`${target.name} +${gained}`);
      }
      if (healed.length > 0) {
        logs.push(`${holder.gear.name}：${healed.join('、')} HP。`);
      }
    }
    for (const holder of G.squad || []) {
      if (!holder || holder.dead || holder.hp <= 0) continue;
      const effect = holder.gear?.effect;
      if (effect?.type !== 'combat_start_night_heal') continue;
      if (G.phase !== 'night') continue;
      const heal = (G.darkness || 0) >= (effect.darkThreshold || 10)
        ? Math.max(0, effect.thresholdValue || effect.value || 0)
        : Math.max(0, effect.value || 0);
      if (heal <= 0) continue;
      const healed = [];
      for (const target of this._aliveSquad()) {
        if (!target || target.hp >= target.maxHp) continue;
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + heal);
        const gained = target.hp - before;
        if (gained > 0) healed.push(`${target.name} +${gained}`);
      }
      if (healed.length > 0) {
        logs.push(`${holder.gear.name}：黑夜補給，${healed.join('、')} HP。`);
      }
    }
    for (const line of logs) this._log(line, 'reward');
    return logs;
  },

  _applyRearGuardGear(attacker) {
    if (!G.combat || !attacker) return [];
    if (!G.combat.threat) G.combat.threat = {};
    const logs = [];
    const supporters = G.squad.filter(c =>
      c.id !== attacker.id &&
      c.hp > 0 &&
      !c.dead &&
      c.gear?.effect?.type === 'rear_guard_block_threat'
    );
    for (const char of supporters) {
      const effect = char.gear.effect;
      const block = Math.max(0, effect.block || 0);
      const threat = Math.max(0, effect.threat || 0);
      if (block > 0) {
        const beforeBlock = CombatStatus.getBlock(char);
        CombatStatus.setBlock(char, beforeBlock + block);
      }
      if (threat > 0) {
        const beforeThreat = G.combat.threat[char.id] || 0;
        G.combat.threat[char.id] = Math.min(10, beforeThreat + threat);
      }
      const parts = [];
      if (block > 0) parts.push(`格檔 +${block}`);
      if (threat > 0) parts.push(`仇恨 +${threat}`);
      if (parts.length > 0) logs.push(`${char.gear.name}：${char.name} 非主戰，${parts.join('，')}。`);
    }
    return logs;
  },

  _applyRearThreatTransfer(attacker, logs = []) {
    if (!G.combat || !attacker || attacker.dead || attacker.hp <= 0) return false;
    if (!G.combat.threat) G.combat.threat = {};
    const currentThreat = Math.max(0, G.combat.threat[attacker.id] || 0);
    const holder = (G.squad || []).find(char =>
      char.id !== attacker.id &&
      char.hp > 0 &&
      !char.dead &&
      char.gear?.effect?.type === 'rear_threat_transfer' &&
      currentThreat >= Math.max(0, char.gear.effect.threshold || 5)
    );
    if (!holder) return false;
    const nextThreat = Math.max(0, holder.gear.effect.value || 2);
    G.combat.threat[attacker.id] = 0;
    G.combat.threat[holder.id] = nextThreat;
    logs.push(`${holder.gear.name}：${holder.name} 承接 ${attacker.name} 的仇恨，${attacker.name} 仇恨歸 0，${holder.name} 仇恨變為 ${nextThreat}。`);
    return true;
  },

  _combatStatusText() {
    if (!G.combat) return '戰鬥尚未開始。';
    if (this._combatItemTargeting()) {
      const item = this._inventoryItem(G.inventory[G.combat.pendingInventoryItemIndex]);
      return item ? `選擇 ${item.icon} ${item.name} 的目標。` : '選擇道具目標。';
    }
    if (this._combatGuardTargeting()) {
      return '選擇一名角色獲得本次守勢格檔。';
    }
    const drum = G.combat?.battleDrum;
    const drumText = drum && drum.remaining > 0
      ? `戰鼓：接下來 ${drum.remaining} 次主戰攻擊 +${drum.value || 1} 攻擊。`
      : '';
    const bannerText = this._activeCombatBanners()
      .map(banner => `${banner.name}・${banner.faceName}：${banner.level} 階。`)
      .join(' ');
    return ['點擊角色卡選擇主戰者，或使用格檔／背包。', drumText, bannerText].filter(Boolean).join(' ');
  },

  _combatInventoryView() {
    this._ensureInventory();
    return (G.inventory || []).map((slot, index) => {
      const item = this._inventoryItem(slot);
      return { index, item, count: slot.count || 1 };
    }).filter(entry => entry.item);
  },

  _wagerDiceEffect(char) {
    if (!char || char.dead || char.hp <= 0) return null;
    if (char.fusedRelic?.effect?.type === 'wager_dice') return char.fusedRelic.effect;
    if (char.relic?.effect?.type === 'wager_dice') return char.relic.effect;
    return null;
  },

  _wagerDiceSides(char) {
    return (this._hasDodecaFateDice(char) || this._hasDodecaLuckyDice(char)) ? 12 : 6;
  },

  _wagerDiceFaceCount(char, effect = null) {
    const wagerEffect = effect || this._wagerDiceEffect(char);
    if (!wagerEffect) return 0;
    const dodecaResonance = this._hasDodecaFateDice(char) || this._hasDodecaLuckyDice(char);
    return (wagerEffect.faces || 3) + (dodecaResonance ? 3 : 0);
  },

  _combatWagerDiceForAttacker(attacker) {
    const plan = G.combat?.wagerDicePlans?.[attacker?.id];
    const effect = this._wagerDiceEffect(attacker);
    if (!plan?.active || !effect || !Array.isArray(plan.faces) || plan.faces.length === 0) return null;
    return {
      active: true,
      charId: attacker.id,
      faces: [...plan.faces],
      damageBonus: effect.damageBonus || 4,
      missPenaltyRate: effect.missPenaltyRate || 0.30,
      maxMissStacks: effect.maxMissStacks || 3,
    };
  },

  toggleCombatWagerDice(charId) {
    if (!G.combat || G.phase === 'over') return;
    const char = G.squad.find(c => c.id === charId);
    if (!char || char.dead || char.hp <= 0 || !this._wagerDiceEffect(char)) return;
    if (!G.combat.wagerDicePlans) G.combat.wagerDicePlans = {};
    if (G.combat.wagerDicePlans[char.id]?.active) {
      delete G.combat.wagerDicePlans[char.id];
      this._log(`${char.name} 取消賭命骰子押注。`, 'dim');
      this._showCombatModal();
      return;
    }
    this._promptWagerDice(char);
  },

  _promptWagerDice(attacker) {
    const effect = this._wagerDiceEffect(attacker);
    if (!effect || !G.combat) return false;
    const sides = this._wagerDiceSides(attacker);
    const faceCount = this._wagerDiceFaceCount(attacker, effect);
    const faces = Array.from({ length: sides }, (_, i) => i + 1);
    const selected = new Set();
    let resolved = false;
    const faceButtons = faces.map(face => `<button type="button" class="wager-face-btn" data-face="${face}">${face}</button>`).join('');
    const descHtml = `
      <div class="wager-dice-panel">
        <p>${attacker.name} 可以在主戰前押注 ${faceCount} 個骰面。弓的追加攻擊會沿用這次押注。</p>
        <div class="wager-face-grid">${faceButtons}</div>
        <p class="wager-dice-hint">押中：該擊傷害 +${effect.damageBonus || 4}。沒押中：懊悔 +1 層，最多 ${effect.maxMissStacks || 3} 層。</p>
      </div>
    `;

    this._openModal({
      title: '賭命骰子',
      wagerModal: true,
      typeText: false,
      descHtml,
      choices: [
        {
          label: `確認押注（0/${faceCount}）`,
          action: () => {
            if (resolved) return;
            if (selected.size !== faceCount) return;
            resolved = true;
            document.querySelectorAll('#modal-choices .choice-btn, .wager-face-btn').forEach(btn => { btn.disabled = true; });
            if (!G.combat.wagerDicePlans) G.combat.wagerDicePlans = {};
            G.combat.wagerDicePlans[attacker.id] = {
              active: true,
              faces: [...selected].sort((a, b) => a - b),
            };
            attacker._wagerDicePenaltyRate = effect.missPenaltyRate || 0.30;
            this._log(`${attacker.name} 設定賭命骰子押注：${[...selected].sort((a, b) => a - b).join('、')}。`, 'info');
            this._showCombatModal();
          },
        },
        {
          label: '返回',
          action: () => {
            if (resolved) return;
            resolved = true;
            document.querySelectorAll('#modal-choices .choice-btn, .wager-face-btn').forEach(btn => { btn.disabled = true; });
            this._showCombatModal();
          },
        },
      ],
    });

    const confirmBtn = document.querySelector('#modal-choices .choice-btn');
    if (confirmBtn) confirmBtn.disabled = true;
    const update = () => {
      if (!confirmBtn) return;
      confirmBtn.disabled = selected.size !== faceCount;
      const label = confirmBtn.querySelector('.choice-label');
      if (label) label.textContent = `確認押注（${selected.size}/${faceCount}）`;
    };
    document.querySelectorAll('.wager-face-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const face = Number(btn.dataset.face);
        if (selected.has(face)) {
          selected.delete(face);
          btn.classList.remove('selected');
        } else if (selected.size < faceCount) {
          selected.add(face);
          btn.classList.add('selected');
        }
        update();
      });
    });
    return true;
  },

  _endWagerDiceAttackFlow() {
    if (G.combat) G.combat.wagerDice = null;
  },

  _clearWagerDicePenaltyAfterEnemyFlow(logs = null) {
    for (const char of G.squad || []) {
      for (const entry of CombatStatus.clearPendingIncomingRisks(char)) {
        if (logs) {
          const source = entry.type === 'remorse' ? '賭命骰子' : '搏命反噬';
          logs.push(`${source}：敵方攻擊流程結束，清除 ${char.name} 的${entry.name} ${entry.stacks} 層。`);
        }
      }
    }
  },

  _battleDrumAttackBonus() {
    const drum = G.combat?.battleDrum;
    if (!drum || (drum.remaining || 0) <= 0) return 0;
    return drum.value || 0;
  },

  _spendBattleDrumCharge(logs = null) {
    const drum = G.combat?.battleDrum;
    if (!drum || (drum.remaining || 0) <= 0) return;
    drum.remaining = Math.max(0, (drum.remaining || 0) - 1);
    if (logs) logs.push(`戰鼓：增幅剩餘 ${drum.remaining} 次主戰攻擊`);
    if (drum.remaining <= 0) G.combat.battleDrum = null;
  },

  _refreshBattleDrum(attacker, logs = null) {
    const effect = attacker?.weapon?.effect;
    if (effect?.type !== 'battle_drum') return;
    G.combat.battleDrum = {
      ownerId: attacker.id,
      ownerName: attacker.name,
      value: effect.attackBonus || 1,
      remaining: effect.durationAttacks || 2,
    };
    if (logs) {
      logs.push(`戰鼓：${attacker.name} 敲響戰鼓，接下來 ${G.combat.battleDrum.remaining} 次我方主戰攻擊 +${G.combat.battleDrum.value} 攻擊`);
    }
  },

  // Section.
  _showCombatDicePreview(rollResult, attacker, callback) {
    const attackerEl = document.querySelector(`.combat-unit[data-char-id="${attacker.id}"]`);
    if (!attackerEl) { callback(); return; }
    const sides = Math.max(1, Number(rollResult.sides || 6));

    const pipHtml = v => {
      if (sides > 6 || v > 6) return `<strong class="dice-number">${v}</strong>`;
      const P = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
      const on = new Set(P[Math.max(1, Math.min(6, v))] || [5]);
      return Array.from({ length: 9 }, (_, i) =>
        `<span class="${on.has(i + 1) ? 'on' : ''}"></span>`).join('');
    };
    const randomFace = () => Math.ceil(Math.random() * sides);
    const setDiceFaceClass = (el, value) => {
      el.classList.remove('dice-face-1', 'dice-face-2', 'dice-face-3', 'dice-face-4', 'dice-face-5', 'dice-face-6');
      if (sides <= 6 && value >= 1 && value <= 6) el.classList.add(`dice-face-${value}`);
    };

    attackerEl.querySelector('.combat-card-dice.player')?.remove();

    const diceEl = document.createElement('div');
    const initialFace = randomFace();
    const d12TypeClass = rollResult.dodecaLuckyDice ? ' dice-d12-lucky' : (rollResult.dodecaFateDice ? ' dice-d12-fate' : '');
    diceEl.className = `combat-card-dice player dice-theme-${attacker.cls || 'neutral'}${sides > 6 ? ' dice-d12' : ''}${sides > 6 ? d12TypeClass : ''}`;
    diceEl.dataset.sides = String(sides);
    setDiceFaceClass(diceEl, initialFace);
    diceEl.innerHTML = pipHtml(initialFace);
    diceEl.classList.add('dice-rolling');
    attackerEl.appendChild(diceEl);

    let count = 0;
    const STEPS = 10;
    const MS    = 75;

    const timer = setInterval(() => {
      count++;
      if (count < STEPS) {
        const face = randomFace();
        setDiceFaceClass(diceEl, face);
        diceEl.innerHTML = pipHtml(face);
      } else {
        clearInterval(timer);
        setDiceFaceClass(diceEl, rollResult.value);
        diceEl.innerHTML = pipHtml(rollResult.value);
        diceEl.classList.remove('dice-rolling');
        diceEl.classList.add('dice-pip-settled');
      }
    }, MS);

    setTimeout(() => {
      clearInterval(timer);
      callback();
    }, MS * STEPS + 320);
  },

  _showCombatGuardDicePreview(roll, callback) {
    const guardButton = document.querySelector('.combat-guard-button');
    if (!guardButton) { callback(); return; }

    const pipHtml = v => {
      const P = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
      const on = new Set(P[Math.max(1, Math.min(6, v))] || [5]);
      return Array.from({ length: 9 }, (_, i) =>
        `<span class="${on.has(i + 1) ? 'on' : ''}"></span>`).join('');
    };
    const setDiceFaceClass = (el, value) => {
      el.classList.remove('dice-face-1', 'dice-face-2', 'dice-face-3', 'dice-face-4', 'dice-face-5', 'dice-face-6');
      if (value >= 1 && value <= 6) el.classList.add(`dice-face-${value}`);
    };
    const randomFace = () => Math.ceil(Math.random() * 6);

    document.querySelectorAll('.combat-tools button').forEach(btn => { btn.disabled = true; });
    document.querySelector('.combat-guard-dice')?.remove();

    const diceEl = document.createElement('div');
    const initialFace = randomFace();
    diceEl.className = 'combat-card-dice player combat-guard-dice dice-theme-neutral';
    diceEl.dataset.sides = '6';
    setDiceFaceClass(diceEl, initialFace);
    diceEl.innerHTML = pipHtml(initialFace);
    diceEl.classList.add('dice-rolling');
    guardButton.before(diceEl);

    let count = 0;
    const STEPS = 10;
    const MS = 75;
    const timer = setInterval(() => {
      count++;
      if (count < STEPS) {
        const face = randomFace();
        setDiceFaceClass(diceEl, face);
        diceEl.innerHTML = pipHtml(face);
      } else {
        clearInterval(timer);
        setDiceFaceClass(diceEl, roll);
        diceEl.innerHTML = pipHtml(roll);
        diceEl.classList.remove('dice-rolling');
        diceEl.classList.add('dice-pip-settled');
      }
    }, MS);

    setTimeout(() => {
      clearInterval(timer);
      callback();
    }, MS * STEPS + 360);
  },

  _showModalDicePreview(rollResult, label, callback) {
    const modal = document.querySelector('.modal-content');
    const choices = document.getElementById('modal-choices');
    if (!modal || !choices) { callback(); return; }

    const pipHtml = v => {
      const P = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
      const on = new Set(P[Math.max(1, Math.min(6, v))] || [5]);
      return Array.from({ length: 9 }, (_, i) =>
        `<span class="${on.has(i + 1) ? 'on' : ''}"></span>`).join('');
    };

    choices.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
    modal.querySelector('.trap-dice-preview')?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'trap-dice-preview dice-preview-inject';
    const initialTrapFace = Math.ceil(Math.random() * 6);
    wrap.innerHTML = `
      <div class="trap-dice-label">${label || '判定骰'}</div>
      <div class="combat-card-dice trap-dice ${this._diceThemeClassFromRoll(rollResult, label)}">${pipHtml(initialTrapFace)}</div>
    `;
    choices.before(wrap);

    const diceEl = wrap.querySelector('.trap-dice');
    const setDiceFaceClass = (el, value) => {
      el.classList.remove('dice-face-1', 'dice-face-2', 'dice-face-3', 'dice-face-4', 'dice-face-5', 'dice-face-6');
      if (value >= 1 && value <= 6) el.classList.add(`dice-face-${value}`);
    };
    setDiceFaceClass(diceEl, initialTrapFace);
    diceEl.classList.add('dice-rolling');
    let count = 0;
    const STEPS = 10;
    const MS = 75;
    const timer = setInterval(() => {
      count++;
      if (count < STEPS) {
        const face = Math.ceil(Math.random() * 6);
        setDiceFaceClass(diceEl, face);
        diceEl.innerHTML = pipHtml(face);
      } else {
        clearInterval(timer);
        setDiceFaceClass(diceEl, rollResult.value);
        diceEl.innerHTML = pipHtml(rollResult.value);
        diceEl.classList.remove('dice-rolling');
        diceEl.classList.add('dice-pip-settled');
      }
    }, MS);

    setTimeout(() => { clearInterval(timer); callback(); }, MS * STEPS + 320);
  },

  _diceThemeClassFromLabel(label = '') {
    const text = String(label || '');
    const char = (G.squad || []).find(c => c?.name && text.includes(c.name));
    return `dice-theme-${char?.cls || 'neutral'}`;
  },

  _diceThemeClassFromRoll(rollResult = null, label = '') {
    return rollResult?.charCls ? `dice-theme-${rollResult.charCls}` : this._diceThemeClassFromLabel(label);
  },

  // Section.
  _combatAttackAnim(attacker, callback) {
    if (callback) callback();
  },

  _buildCombatScene(enemy, attacker, status) {
    const intent = G.combat?.intent || enemy._victoryIntent || null;
    const activeBanners = this._activeCombatBanners();
    const attackerId = attacker?.id || G.combat?.attackerId || null;
    return {
      status,
      attackerId,
      intentLabel: intent ? this._combatIntentLabel(intent, enemy) : null,
      intent: this._combatIntentView(intent, enemy),
      enemy: {
        id: enemy.id, name: enemy.name, icon: enemy.icon,
        iconImage: enemy.iconImage || null,
        iconFlipX: !!enemy.iconFlipX,
        iconScale: enemy.iconScale || null,
        iconSoftEdge: !!enemy.iconSoftEdge,
        cardBgImage: enemy.cardBgImage || null,
        hideIconInCombat: !!enemy.hideIconInCombat,
        desc: enemy.desc || '',
        hp: enemy.hp, maxHp: enemy.maxHp || enemy.hp,
        block: CombatStatus.getBlock(enemy),
        currentBlock: CombatStatus.getBlock(enemy),
        woundMax: enemy.woundMax || 15,
        wounds: enemy.wounds || 0,
        attack: enemy.attack, weakness: enemy.weakness,
        tempWeakness: CombatStatus.tempWeaknesses(enemy, 'normal')[0] || null,
        eagleTempWeakness: CombatStatus.tempWeaknesses(enemy, 'eagle')[0] || null,
        eagleNativeWeakness: enemy.eagleNativeWeakness || null,
        extraWeaknesses: CombatStatus.nativeWeaknesses(enemy, 'extra'),
        disabledNativeWeaknesses: CombatStatus.disabledNativeWeaknesses(enemy),
        nativeWeaknessSources: { ...(enemy.nativeWeaknessSources || {}) },
        suspiciousFlaw: !!enemy.suspiciousFlaw,
        gamblerNativeWeakness: enemy.gamblerNativeWeakness || null,
        gamblerTempWeakness: CombatStatus.tempWeaknesses(enemy, 'gambler')[0] || null,
        gamblerTempWeaknesses: CombatStatus.tempWeaknesses(enemy, 'gambler'),
        fateGamble: enemy.abilityState?.fateGamble
          ? {
            luckyFace: enemy.abilityState.fateGamble.luckyFace || null,
            unluckyFaces: Array.isArray(enemy.abilityState.fateGamble.unluckyFaces)
              ? [...enemy.abilityState.fateGamble.unluckyFaces]
              : [],
          }
          : null,
        bannerGuardian: enemy.abilityState?.bannerGuardian
          ? { stance: enemy.abilityState.bannerGuardian.stance || 'wound' }
          : null,
        executionCountdown: enemy.abilityState?.executionCountdown
          ? {
            remaining: Math.max(0, enemy.abilityState.executionCountdown.remaining || 0),
            executed: !!enemy.abilityState.executionCountdown.executed,
          }
          : null,
        weaknessDesc: enemy.weaknessEffect?.desc || '',
      },
      squad: G.squad.map(c => ({
        id: c.id, name: c.name, cls: c.cls, hp: c.hp, maxHp: c.maxHp, attack: (c.attack || 0) + Math.max(0, c._greatswordMomentum || 0),
        weapon: c.weapon || null,
        gear: c.gear || null,
        relic: c.relic ? { name: c.relic.name, icon: c.relic.icon, iconImage: c.relic.iconImage, desc: c.relic.desc } : null,
        fusedRelic: c.fusedRelic ? { name: c.fusedRelic.name, icon: c.fusedRelic.icon, iconImage: c.fusedRelic.iconImage, desc: c.fusedRelic.desc } : null,
        wagerDiceMissStacks: c._wagerDiceMissStacks || 0,
        gamblerBacklashStacks: c._gamblerBacklashStacks || 0,
        canWagerDice: !!this._wagerDiceEffect(c),
        wagerDiceFaces: G.combat?.wagerDicePlans?.[c.id]?.faces || [],
        gazeWeaknesses: [...CombatStatus.nativeWeaknesses(c, 'gaze')],
        woundMax: c.woundMax || 15,
        wounds: c.wounds || 0,
        block: CombatStatus.getBlock(c),
        dicePollution: c.dicePollution
          ? {
            faces: Array.isArray(c.dicePollution.faces) ? [...c.dicePollution.faces] : [],
            empowered: Math.max(0, c.dicePollution.empowered || 0),
          }
          : null,
        threat: G.combat?.threat?.[c.id] || 0,
        activeBanners: activeBanners
          .filter(banner => banner.ownerId === c.id)
          .map(banner => this._combatBannerView(banner)),
      })),
    };
  },

  _combatIntentView(intent, enemy) {
    if (!intent || !enemy) return null;
    const type = intent.type || '';
    const block = enemy.blockBroken ? 0 : Math.max(0, enemy.block || 0);
    const painBonus = typeof this._enemyPainGrowthAttackBonus === 'function'
      ? this._enemyPainGrowthAttackBonus(enemy)
      : 0;
    const bannerInfo = typeof this._enemyBannerGuardianIntentInfo === 'function'
      ? this._enemyBannerGuardianIntentInfo(enemy, intent)
      : { damageBonus: 0 };
    const attackBonus = painBonus + (bannerInfo.damageBonus || 0);
    const baseAttack = Math.max(0, enemy.attack || 0);
    const target = {
      targetId: intent.targetId || null,
      targetName: intent.targetName || null,
    };
    if (type === 'attack') {
      if (intent.finalEye) {
        const splash = Math.max(0, enemy.abilities?.find(ability => ability?.type === 'final_boss')?.splashDamage || 0);
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-single.png',
          text: `攻${baseAttack}+半骰`,
          title: `黑夜開眼：單體攻擊造成 ${baseAttack}+半個骰數 傷害${splash > 0 ? `，其他隊友各受 ${splash} 濺射傷害` : ''}`,
        };
      }
      const damage = baseAttack + attackBonus;
      const polluteText = intent.polluteTarget ? '，並污染目標 1 個骰面' : '';
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-single.png',
        text: `攻${damage}`,
        title: intent.targetName ? `攻擊 ${intent.targetName}，造成 ${damage} 傷害${polluteText}` : `單體攻擊，造成 ${damage} 傷害${polluteText}`,
      };
    }
    if (type === 'block_attack') {
      const damage = baseAttack + attackBonus;
      if (block <= 0) {
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-single.png',
          text: `攻${damage}`,
          title: intent.targetName ? `攻擊 ${intent.targetName}，造成 ${damage} 傷害` : `單體攻擊，造成 ${damage} 傷害`,
        };
      }
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-block-attack.png',
        text: `攻${damage}/防${block}`,
        title: intent.targetName ? `攻擊 ${intent.targetName}，造成 ${damage} 傷害；行動後格檔 +${block}` : `單體攻擊，造成 ${damage} 傷害；行動後格檔 +${block}`,
      };
    }
    if (type === 'aoe' && intent.polluteRandom) {
      const damage = Math.max(1, baseAttack - 2) + attackBonus;
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-all.png',
        text: `攻${damage}`,
        title: `全體攻擊，對全隊造成 ${damage} 傷害，並污染 1 名隊友的骰面`,
      };
    }
    if (type === 'aoe') {
      const poisonDust = Array.isArray(enemy.abilities) && enemy.abilities.some(ability => ability?.type === 'poison_dust');
      if (poisonDust) {
        const bonusText = baseAttack + attackBonus > 0 ? `+${baseAttack + attackBonus}` : '';
        const weakenedText = enemy.abilityState?.poisonWeakened ? '，已潰散 -1' : '';
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-all.png',
          text: `半骰數${bonusText}`,
          title: `全體毒粉，造成骰面折半${bonusText}傷害${weakenedText}，最低 1`,
        };
      }
      const damage = Math.max(1, baseAttack - 2) + attackBonus;
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-all.png',
        text: `全${damage}`,
        title: `全體攻擊，對全隊造成 ${damage} 傷害`,
      };
    }
    if (type === 'pollute') {
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-all.png',
        text: '污染',
        title: '污染 1 名隊友的骰面，不造成傷害',
      };
    }
    if (type === 'execution') {
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-single.png',
        text: '處刑',
        title: '處刑牢中的倖存者。本回合不攻擊隊伍，但救援會失敗。',
      };
    }
    if (type === 'dice_attack') {
      const bonusText = attackBonus > 0 ? `+${attackBonus}` : '';
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-single.png',
        text: `骰數${bonusText}`,
        title: intent.targetName ? `攻擊 ${intent.targetName}，造成骰數${bonusText}傷害` : `單體擲骰攻擊，造成骰數${bonusText}傷害`,
      };
    }
    if ((type === 'block' || type === 'banner_switch') && block > 0) {
      return {
        type,
        ...target,
        icon: 'assets/icons/block-intent-icon-red.png',
        text: `防${block}`,
        title: type === 'banner_switch' ? `換旗後格檔 +${block}` : `行動後格檔 +${block}`,
      };
    }
    return null;
  },


};

Object.assign(Game, GameCombatFlow);
