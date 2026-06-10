// Combat flow methods extracted from js/core/game.js.
// Keeps the original Game API while reducing the size of the core coordinator.
const GameCombatFlow = {
  // Section.
  // Section.
  _triggerCombat(cell, opts = {}) {
    let tutorialCombat = false;
    if (this._shouldUseCombatTutorialEnemy(opts)) {
      const tutorialEnemy = typeof getEnemyById === 'function' ? getEnemyById('shadow_worm') : null;
      if (tutorialEnemy) {
        cell.content = { ...(cell.content || {}), enemy: tutorialEnemy };
        G.combatTutorial = { active: true, step: 'enemy_detail', completed: false, firstCombatStarted: true };
        tutorialCombat = true;
        if (G.guideQuest) G.guideQuest.firstCombatStarted = true;
      }
    }
    const enemy = this._resolveCombatEnemyForCurrentDay(cell.content?.enemy, cell, opts);
    if (!enemy) { cell.cleared = true; Render.fullRender(); return; }
    cell.content.enemy = enemy;
    for (const char of G.squad) {
      char._ironShardUsed = false;
      char._boneDiceBagUses = 0;
      char._flawLensUsed = false;
      char._grapplingHookUsedRound = false;
      char._corrosiveOilUsedRound = false;
      char._serratedOilUsedRound = false;
      char._greatswordMomentum = 0;
      char._rapierGuaranteedFollowUpsUsed = 0;
      char._warriorGuardPendingBlock = 0;
      char._gamblerPainPendingBlock = 0;
      char._evasionChancePending = 0;
      char.finalEyeIntimidatedUntilRound = 0;
      CombatStatus.clearBlock(char);
      CombatStatus.clearIncomingRiskState(char);
      CombatStatus.clearEvasionChance(char);
      char.dicePollution = null;
      CombatStatus.clearNativeWeaknesses(char, { source: 'gaze' });
      CombatStatus.clearBattleWounds(char);
    }

    G.combat = {
      enemy: { ...enemy, maxHp: enemy.hp, blockBroken: false, blockBrokenUntilRound: null, exposed: false, exposedUntilRound: null, _block: 0, woundMax: enemy.woundMax || 15, wounds: Math.max(0, Math.min(enemy.woundMax || 15, enemy.wounds || 0)), gamblerTempWeakness: null, gamblerTempWeaknesses: [], gamblerNativeWeakness: null, eagleTempWeakness: null, eagleNativeWeakness: null, extraWeaknesses: [], disabledNativeWeaknesses: [], suspiciousFlaw: false, suspiciousFlawMarkedRound: 0 },
      cell,
      reward: cell.content?.reward || (enemy.rescueBoss ? 'rescue' : null),
      tutorialCombat,
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
      bannerPlans: {},
      bandageUsed: {},
      threat: {},
      eagleFeatherDamageUsed: false,
      starHunterEyeRound: 0,
      starHunterEyeLockRound: 0,
      starHunterEyeLockOwnerId: null,
      darkMonsterNativeWeaknessBreak: false,
      combatLogsThisAttack: [],
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
    AudioManager?.sync?.();
    setTimeout(() => AudioManager?.sync?.(), 120);
    const spawnSfx = G.combat.enemy.spawnSfx || (G.combat.enemy.darkMonster ? 'darkMonsterGrowl' : '');
    const spawnSfxVolume = G.combat.enemy.spawnSfx ? (G.combat.enemy.spawnSfxVolume ?? 0.5) : 0.62;
    if (spawnSfx) setTimeout(() => AudioManager?.playSfx?.(spawnSfx, spawnSfxVolume), 120);
  },

  _resolveCombatEnemyForCurrentDay(enemy, cell = null, opts = {}) {
    if (!enemy || opts.source === 'devTest') return enemy;
    if (cell?.content?.reward && !cell?.content?.scaleWithDay) return enemy;
    if (!['weak', 'medium'].includes(enemy.tier)) return enemy;
    if (typeof getEnemyById !== 'function' || typeof resolveEnemyTier !== 'function') return enemy;
    const base = getEnemyById(enemy.id);
    if (!base?.tiers) return enemy;
    return resolveEnemyTier(base, G.day || 1);
  },

  _showCombatModal() {
    const { enemy } = G.combat;
    const actableSquad = this._combatActableSquad();
    const shouldAutoSkip = this._combatShouldAutoSkipPlayerTurn();
    const canTutorialAttack = this._combatTutorialAllows('attack');
    const canTutorialGuard = this._combatTutorialAllows('guard');

    const modDesc = G.combatMods.length > 0 ? '\n\n戰鬥調整存在。' : '';

    this._openModal({
      title: `遭遇：${enemy.name}`,
      desc: `${enemy.desc}\n\nHP ${enemy.hp}/${enemy.maxHp} / 攻擊 ${enemy.attack}${modDesc}`,
      combat: {
        ...this._buildCombatScene(enemy, null, shouldAutoSkip ? '震攝壓住最後的意志，無人能行動。' : this._combatStatusText()),
        selectable: canTutorialAttack && !shouldAutoSkip && actableSquad.length > 0 && !this._combatItemTargeting() && !G.combat.actionInProgress,
        itemTargeting: this._combatItemTargeting(),
        guardTargeting: this._combatGuardTargeting(),
        showBag: !!G.combat.bagOpen,
        inventory: this._combatInventoryView(),
        canUseBag: this._combatTutorialAllows('bag') && this._canUseCombatBag(),
        canGuard: canTutorialGuard && this._canUseCombatGuard(),
        guardCooldown: this._combatGuardCooldown(),
        rollItemBlocked: G.combat.rollItemUsedRound === G.combat.round,
      },
      choices: this._combatActionChoices(),
    });
    if (shouldAutoSkip) this._scheduleAutoSkipPlayerTurn(720);
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
      if (!opts.bowFollowUp) {
        const pendingBanner = this._combatPendingBannerForAttacker(attacker);
        if (pendingBanner) opts = { ...opts, pendingBanner };
      }
      G.combat.wagerDice = !opts.bowFollowUp ? this._combatWagerDiceForAttacker(attacker) : null;
      const rollResult = this._rollWithMods('combat', attacker);
      if (opts.starHunterForceSix) this._applyStarHunterForceSix(rollResult);
      // 先顯示骰子動畫，再進入攻擊結算。
      this._showCombatDicePreview(rollResult, attacker, () => {
        this._combatAttackAnim(attacker, () => this._doCombatRound(attacker, rollResult, opts));
      });
      return;
    }
    const rollResult = forcedRollResult;
    const battleDrumAttackBonus = !opts.bowFollowUp ? this._battleDrumAttackBonus() : 0;
    const firstStrikeEnemyActed = !opts.bowFollowUp && !!G.combat.firstStrikeEnemyActed;
    const deferBowEnemyAction = !opts.bowFollowUp && !firstStrikeEnemyActed && attacker.weapon?.effect?.type === 'bow_followup';
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
      suppressEnemyAction: !!opts.bowFollowUp || deferBowEnemyAction || firstStrikeEnemyActed,
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
    });
    if (combatResult.starHunterEyeLockTriggered && this._hasStarHunterEye(attacker)) {
      G.combat.starHunterEyeLockRound = G.combat.round;
      G.combat.starHunterEyeLockOwnerId = attacker.id;
    }
    if (combatResult.enemyActionDeferred) {
      G.combat.deferredEnemyAction = {
        attackerId: attacker.id,
        intent: G.combat.intent ? { ...G.combat.intent } : null,
        round: G.combat.round,
        combatMods: [...(G.combatMods || [])],
        wagerDice: G.combat.wagerDice ? { ...G.combat.wagerDice } : null,
      };
    }
    if (starHunterEyePrepared) {
      preCombatLogs.push(starHunterEyePrepared);
    }
    if (firstStrikeEnemyActed) {
      const firstStrikeSkippedByStun = !!G.combat.firstStrikeSkippedByStun;
      G.combat.firstStrikeEnemyActed = false;
      G.combat.firstStrikeSkippedByStun = false;
      combatResult.enemyActionDeferred = false;
      G.combat.deferredEnemyAction = null;
      const preemptiveLogs = Array.isArray(G.combat.preemptiveLogsThisRound)
        ? G.combat.preemptiveLogsThisRound
        : [];
      G.combat.preemptiveLogsThisRound = [];
      preCombatLogs.unshift(...preemptiveLogs);
      combatResult.logs = combatResult.logs.filter(line => line !== '追加攻擊不觸發敵人行動。');
      if (firstStrikeSkippedByStun) {
        combatResult.enemyPreemptiveStunned = true;
      } else {
        preCombatLogs.push(`${enemy.name} 本回合已先攻，攻擊後不再行動。`);
        combatResult.enemyPreemptiveActed = true;
      }
      if (combatResult.stunned && !combatResult.enemyDead) {
        enemy.firstStrikeStunnedUntilRound = Math.max(enemy.firstStrikeStunnedUntilRound || 0, (G.combat.round || 1) + 1);
        combatResult.firstStrikeStunQueued = true;
        combatResult.logs.push(`${enemy.name} 被震懾，下一回合無法先攻。`);
      }
    }
    if (preCombatLogs.length > 0) {
      combatResult.logs.unshift(...preCombatLogs);
    }
    if (G.combat?.source === 'darkMonsterActive' && combatResult.nativeWeaknessBreakHit) {
      G.combat.darkMonsterNativeWeaknessBreak = true;
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
    this._recordCombatLogsThisAttack(combatResult, !!opts.bowFollowUp);
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

    // 全隊敵方攻擊傷害。
    if (combatResult.aoeCounter > 0) {
      const alive = this._aliveSquad();
      const variedAoe = combatResult.aoeDamageByChar && Object.keys(combatResult.aoeDamageByChar).length > 0;
      if (!Array.isArray(combatResult.incomingDamageEvents)) combatResult.incomingDamageEvents = [];
      this._log(combatResult.counterDmg > 0 && combatResult.counterTargetName
        ? `${enemy.name} 攻擊主目標 ${combatResult.counterTargetName}，其餘隊友濺射 ${combatResult.aoeCounter} 傷害。`
        : (variedAoe
          ? `${enemy.name} 攻擊全隊，基礎 ${combatResult.aoeCounter} 傷害。`
          : `${enemy.name} 攻擊全隊，造成 ${combatResult.aoeCounter} 傷害。`), 'danger');
      for (const c of alive) {
        let incomingAoe = Math.max(0, combatResult.aoeDamageByChar?.[c.id] ?? combatResult.aoeCounter);
        incomingAoe = CombatStatus.applyWoundTakenBonus(c, incomingAoe, combatResult.logs);
        let reduced = this._reduceIncomingDamage(c, incomingAoe, true, true, combatResult.logs);
        reduced = CombatStatus.applyExplorerEvasion(c, reduced, combatResult.logs, '全體傷害');
        let allyBlockBefore = null;
        let allyBlockAfter = null;
        if (CombatStatus.getBlock(c) > 0 && reduced > 0) {
          allyBlockBefore = CombatStatus.getBlock(c);
          const blockResult = CombatStatus.consumeBlock(c, reduced);
          reduced = blockResult.damage;
          allyBlockAfter = blockResult.block;
          combatResult.logs.push(`${c.name} 的格檔吸收 ${blockResult.absorbed}，剩餘格檔 ${blockResult.block}`);
        }
        const beforeHp = c.hp;
        c.hp = Math.max(0, c.hp - reduced);
        CombatStatus.recordGamblerPainBlock(c, beforeHp, c.hp, combatResult.logs);
        if (reduced > 0) {
          combatResult.incomingDamageEvents.push({
            type: 'aoe',
            targetId: c.id,
            damage: reduced,
            from: beforeHp,
            to: c.hp,
            allyBlockBefore,
            allyBlockAfter,
          });
        }
      }
    }
    if (combatResult.enemyAttackFlow) {
      if (combatResult.counterTargetId) this._halveCombatThreat(combatResult.counterTargetId);
      this._clearWagerDicePenaltyAfterEnemyFlow(combatResult.logs);
    }
    combatResult.skipExplorerEvasionGain = !!opts.bowFollowUp;
    if (!opts.bowFollowUp && !enemyDead && !combatResult.enemyActionDeferred) {
      this._applyExplorerEvasionGain(attacker, roll, combatResult.logs);
      combatResult.explorerEvasionGainApplied = true;
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
      if (!combatResult.skipSupportTeamHeal) {
        this._applySupportTeamHeal(attacker, combatResult.logs, combatResult, {
          addThreat: false,
          logWhenNoHeal: false,
        });
      }
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

    if (this._handleCombatDefeatAfterAnimation(combatResult, attacker, enemy, roll, rollResult)) return;

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

  _handleCombatDefeatAfterAnimation(combatResult, attacker, enemy, roll, rollResult) {
    if (!G.combat) return false;
    if (!G.squad.every(c => c.dead || c.hp <= 0)) return false;
    const isDevTest = G.combat.source === 'devTest';
    const displayRoll = rollResult.displayValue || roll;
    this._endWagerDiceAttackFlow();
    const diceLabel = attacker ? `${attacker.name} 的攻擊骰` : '守勢骰';
    const summaryLines = this._combatDefeatSummaryLines(attacker, enemy, combatResult, roll);
    const enemyDice = combatResult.gazeRoll
      ? { type: 'danger', label: '裂隙凝視骰', value: combatResult.gazeRoll, sides: 6 }
      : (combatResult.fateRoll
        ? {
          type: 'danger',
          label: (combatResult.fateLuckyFaces?.length || combatResult.fateLuckyFace)
            ? `命運骰（幸運 ${(combatResult.fateLuckyFaces?.length ? combatResult.fateLuckyFaces : [combatResult.fateLuckyFace]).join('、')} / 厄運 ${(combatResult.fateUnluckyFaces || []).join('、')}）`
            : '命運骰',
          value: combatResult.fateRoll,
          sides: 6,
        }
        : (combatResult.enemyDiceRoll
          ? { type: 'danger', label: `${enemy.name} 的攻擊骰`, value: combatResult.enemyDiceRoll, sides: combatResult.enemyDiceSides || 6 }
          : null));
    const combatAnims = this._combatResultAnims(attacker, combatResult, 120);
    this._openModal({
      title: `戰鬥：第 ${G.combat.round || 1} 回合結果`,
      desc: summaryLines.join('\n'),
      combatLog: combatResult.logs,
      combat: {
        ...this._buildCombatScene(enemy, attacker, this._combatStatusText()),
        selectable: false,
        itemTargeting: false,
        guardTargeting: false,
        showBag: false,
        inventory: [],
        canUseBag: false,
        canGuard: false,
        guardCooldown: 0,
        rollItemBlocked: true,
      },
      combatAnims,
      dice: { type: 'combat', label: diceLabel, value: displayRoll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
      enemyDice,
      choices: [],
    });
    const finishDelay = this._combatResultAnimDuration(combatAnims, enemyDice) + 120;
    setTimeout(() => {
      if (isDevTest) {
        this._openDevTestDefeatResult(enemy);
      } else {
        this._closeModal();
        this._checkLose();
      }
    }, finishDelay);
    return true;
  },

  _openDevTestDefeatResult(enemy) {
    this._log('測試戰鬥失敗：測試模式不會結束遊戲，隊伍已恢復至 1 HP。', 'dim');
    for (const char of G.squad) {
      char.dead = false;
      char.hp = Math.max(1, Math.min(char.maxHp || 1, char.hp || 1));
    }
    this._clearSquadCombatCarryover();
    G.combat = null;
    this._openModal({
      title: '測試戰鬥失敗',
      desc: `${enemy.name} 擊倒了測試隊伍。\n\n測試戰鬥失敗不會結束遊戲，隊伍已恢復至 1 HP。`,
      choices: [{ label: '確認', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _combatDefeatSummaryLines(attacker, enemy, combatResult = {}, roll = 0) {
    const lines = [];
    if (combatResult.guardBlock > 0 && combatResult.guardTargetId) {
      const target = (G.squad || []).find(char => char.id === combatResult.guardTargetId);
      lines.push(`${target?.name || '隊伍'} 採取守勢，獲得 ${combatResult.guardBlock} 格檔。`);
    } else if (attacker) {
      if (combatResult.damage > 0) {
        lines.push(`${attacker.name} 攻擊 ${enemy.name}，造成 ${combatResult.damage} 傷害${combatResult.weaknessHit ? '，命中弱點。' : '。'}`);
      } else {
        lines.push(`${attacker.name} 的攻擊被格檔，造成 0 傷害。`);
      }
    }
    if (combatResult.counterDmg > 0 && combatResult.aoeCounter > 0) {
      lines.push(`${enemy.name} 攻擊主目標 ${combatResult.counterTargetName || attacker?.name || '小隊'}，造成 ${combatResult.counterDmg} 傷害；其餘隊友濺射 ${combatResult.aoeCounter} 傷害。`);
    } else if (combatResult.aoeCounter > 0) {
      lines.push(`${enemy.name} 攻擊全隊，造成 ${combatResult.aoeCounter} 傷害。`);
    } else if (combatResult.counterDmg > 0) {
      lines.push(`${enemy.name} 攻擊 ${combatResult.counterTargetName || attacker?.name || '小隊'}，造成 ${combatResult.counterDmg} 傷害。`);
    } else if (roll > 0 && combatResult.guardBlock > 0) {
      lines.push(`${enemy.name} 本回合沒有造成傷害。`);
    }
    if (combatResult.gazeSummary) lines.push(combatResult.gazeSummary);
    if (combatResult.firstStrikeSummary) lines.push(combatResult.firstStrikeSummary);
    if (combatResult.fateSummary) lines.push(combatResult.fateSummary);
    if (combatResult.bannerSummary) lines.push(combatResult.bannerSummary);
    return lines;
  },

  _combatResultAnimDuration(combatAnims = {}, enemyDice = null) {
    const delay = Number.isFinite(combatAnims.delay) ? combatAnims.delay : 120;
    const playerDamageEvents = Array.isArray(combatAnims.playerDamageEvents) ? combatAnims.playerDamageEvents : [];
    const incomingDamageEvents = Array.isArray(combatAnims.incomingDamageEvents) ? combatAnims.incomingDamageEvents : [];
    const healEvents = Array.isArray(combatAnims.healEvents) ? combatAnims.healEvents : [];
    const playerFollowHits = Math.max(0, combatAnims.playerFollowHits || 0, playerDamageEvents.length);
    const playerFollowStepMs = 380;
    const guardBlock = Math.max(0, combatAnims.guardBlock || 0);
    const hasEnemyAttack = !!(combatAnims.counterTarget || combatAnims.aoe);
    const enemyDiceWindup = hasEnemyAttack && enemyDice && enemyDice.animate !== false ? 760 : 0;
    return delay
      + (guardBlock > 0 ? 260 : 0)
      + playerFollowHits * playerFollowStepMs
      + (incomingDamageEvents.length > 0 ? 520 : 0)
      + (combatAnims.enemyBlock ? 220 : 0)
      + enemyDiceWindup
      + (healEvents.length > 0 ? 520 : 0)
      + 720;
  },

  _combatSplitIncomingHitEvents(rawHits, totalDamage, baseEvent = {}) {
    const total = Math.max(0, Math.floor(Number(totalDamage) || 0));
    if (total <= 0) return [{ ...baseEvent, damage: 0 }];
    const raw = Array.isArray(rawHits)
      ? rawHits
        .map(hit => ({
          ...hit,
          damage: Math.max(0, Math.floor(Number(hit?.damage) || 0)),
        }))
        .filter(hit => hit.damage > 0)
      : [];
    if (raw.length <= 1) return [{ ...baseEvent, ...(raw[0] || {}), damage: total }];

    const slotCount = Math.min(raw.length, total);
    const rawTotal = raw.reduce((sum, hit) => sum + hit.damage, 0) || total;
    let remaining = total;
    const damages = [];
    for (let i = 0; i < slotCount; i += 1) {
      const slotsLeft = slotCount - i;
      const scaled = Math.round(total * (raw[i]?.damage || 1) / rawTotal);
      const value = i === slotCount - 1
        ? remaining
        : Math.max(1, Math.min(remaining - (slotsLeft - 1), scaled));
      damages.push(value);
      remaining -= value;
    }

    let hpCursor = Number.isFinite(baseEvent.from) ? baseEvent.from : null;
    const finalHp = Number.isFinite(baseEvent.to) ? baseEvent.to : null;
    return damages.map((damage, index) => {
      const rawHit = raw[index] || {};
      const isLast = index === damages.length - 1;
      const from = hpCursor;
      const to = from !== null && finalHp !== null
        ? (isLast ? finalHp : Math.max(finalHp, from - damage))
        : baseEvent.to;
      hpCursor = Number.isFinite(to) ? to : hpCursor;
      const event = {
        ...baseEvent,
        ...rawHit,
        damage,
        from,
        to,
        multiHitIndex: index,
        multiHitTotal: damages.length,
      };
      if (index > 0) {
        event.allyBlockBefore = null;
        event.allyBlockAfter = null;
        event.allyBlockAbsorbed = 0;
        event.fullBlock = false;
      }
      return event;
    });
  },

  _canBowFollowUp(attacker, combatResult, enemy, rollResult) {
    if (!G.combat || !attacker || !enemy || enemy.hp <= 0) return false;
    if (attacker.hp <= 0 || attacker.dead) return false;
    if (attacker.weapon?.effect?.type !== 'bow_followup') return false;
    if (rollResult.starHunterForceSixNoWeakness) return false;
    if (combatResult.grapplingHookAssisted && combatResult.realWeaknessHit) return false;
    const starHunterLocked = this._hasStarHunterEyeLock(attacker);
    if (!starHunterLocked && !combatResult.realWeaknessHit && !this._eagleFeatherCanTrigger(attacker, rollResult)) return false;
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

  _hasStarHunterEyeLock(char) {
    return !!G.combat &&
      !!char &&
      this._hasStarHunterEye(char) &&
      G.combat.starHunterEyeLockRound === G.combat.round &&
      G.combat.starHunterEyeLockOwnerId === char.id;
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
    return `獵星之眼：戰鬥節奏校準，新增鷹眼暫時原生弱點 ${value}，命中後鎖定並改寫。`;
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
    const starHunterLocked = this._hasStarHunterEyeLock(attacker);
    const eagleRelic = eagleTriggered ? this._eagleFeatherRelic(attacker) : null;
    const damageLine = combatResult.damage > 0
      ? `本次攻擊造成 ${combatResult.damage} 點傷害。`
      : '本次攻擊造成 0 點傷害。';
    const autoToken = `${G.combat.round}:${attacker.id}:${used}:${Date.now()}`;
    G.combat.autoBowFollowUpToken = autoToken;
    const followUpAction = () => {
      if (!G.combat || G.combat.autoBowFollowUpToken !== autoToken) return;
      G.combat.autoBowFollowUpToken = null;
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
        followUpOpts.starHunterEyeDamageBonus = this._hasStarHunterEyeLock(attacker)
          ? nextFollowUpCount * 5
          : 2;
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
    const combatAnims = this._combatResultAnims(attacker, promptAnimResult, 120);
    combatResult.skipPlayerDamageAnims = true;
    this._openModal({
      title: '弓連擊中',
      desc: starHunterLocked && !combatResult.realWeaknessHit && !eagleTriggered
        ? `${attacker.name} 已鎖定鷹眼弱點，本回合弓追擊會自動連射。\n${damageLine}\n\n本回合追擊：${used}/${max}`
        : (eagleTriggered
          ? `${attacker.name} 的鷹眼羽飾讓最終骰面 ${rollResult.value} 視為命中原生弱點，弓會自動追擊。\n${damageLine}\n\n本回合追擊：${used}/${max}`
          : `${attacker.name} 命中原生弱點，弓會自動追擊。\n${damageLine}\n\n本回合追擊：${used}/${max}`),
      combatLog: combatResult.logs,
      combat: {
        ...this._buildCombatScene(enemy, attacker, this._combatStatusText()),
        selectable: false,
        itemTargeting: false,
        showBag: false,
        inventory: this._combatInventoryView(),
        canUseBag: false,
        rollItemBlocked: true,
        followUpStatusId: attacker.id,
        followUpLabel: '連擊中...',
        followUpHint: '自動追擊',
      },
      combatAnims,
      dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: displayRoll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
      choices: [],
    });
    const triggerAutoFollowUp = () => {
      if (!G.combat || G.combat.autoBowFollowUpToken !== autoToken) return;
      if (G.modal?.title !== '弓連擊中') {
        window.setTimeout(triggerAutoFollowUp, 250);
        return;
      }
      followUpAction();
    };
    window.setTimeout(triggerAutoFollowUp, this._combatResultAnimDuration(combatAnims, null) + 80);
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

  toggleCombatBannerPlan(charId, relicId) {
    if (!G.combat || G.phase === 'over' || G.combat.actionInProgress) return;
    if (this._combatItemTargeting() || this._combatGuardTargeting()) return;
    const char = G.squad.find(c => c.id === charId);
    if (!char || char.dead || char.hp <= 0) return;
    const entry = this._bannerRelics(char).find(candidate =>
      candidate.relic.id === relicId &&
      candidate.faces.some(face => !this._sameBannerFaceActive(candidate.relic.id, face.id))
    );
    if (!entry) return;
    if (!G.combat.bannerPlans) G.combat.bannerPlans = {};
    const current = G.combat.bannerPlans[char.id];
    if (current?.relicId === relicId) {
      delete G.combat.bannerPlans[char.id];
    } else {
      G.combat.bannerPlans[char.id] = { relicId };
    }
    if (G) G.bannerGuideDismissed = true;
    this._showCombatModal();
  },

  _combatPendingBannerForAttacker(attacker) {
    const plan = G.combat?.bannerPlans?.[attacker?.id];
    if (plan && G.combat?.bannerPlans) delete G.combat.bannerPlans[attacker.id];
    const entry = plan
      ? this._eligibleBannerEntries(attacker).find(candidate => candidate.relic.id === plan.relicId)
      : this._autoBannerEntryForAttacker(attacker);
    if (!entry) return null;
    const face = this._autoBannerFace(entry);
    return face ? { entry, face } : null;
  },

  _eligibleBannerEntries(char) {
    return this._bannerRelics(char).filter(entry =>
      entry.faces.some(face => !this._sameBannerFaceActive(entry.relic.id, face.id))
    );
  },

  _autoBannerEntryForAttacker(attacker) {
    const entries = this._eligibleBannerEntries(attacker);
    if (entries.length === 0) return null;
    const activeRelicIds = new Set(
      this._activeCombatBanners()
        .filter(banner => banner.ownerId === attacker?.id)
        .map(banner => banner.relicId)
    );
    const missingEntries = entries.filter(entry => !activeRelicIds.has(entry.relic.id));
    if (missingEntries.length === 0) return null;
    if (this._hasDualBannerResonance(attacker)) {
      return missingEntries.find(entry => entry.relic.id === attacker.fusedRelic?.id) || missingEntries[0];
    }
    return missingEntries[0];
  },

  _combatBannerSlotsForChar(char, allowPlanning = false) {
    const activeByRelic = new Map(this._activeCombatBanners().map(banner => [banner.relicId, banner]));
    const plannedRelicId = G.combat?.bannerPlans?.[char?.id]?.relicId || null;
    return this._bannerRelics(char)
      .map(entry => {
        const active = activeByRelic.get(entry.relic.id);
        const canPlan = allowPlanning && entry.faces.some(face => !this._sameBannerFaceActive(entry.relic.id, face.id));
        if (!active && !canPlan) return null;
        const availableFaces = entry.faces
          .filter(face => !this._sameBannerFaceActive(entry.relic.id, face.id))
          .map(face => face.name)
          .filter(Boolean);
        return {
          id: entry.relic.id,
          name: entry.relic.name || '旗子',
          icon: entry.relic.icon || '旗',
          iconImage: entry.relic.iconImage || '',
          activeBanner: active ? this._combatBannerView(active) : null,
          canPlan,
          planned: plannedRelicId === entry.relic.id,
          faceText: availableFaces.length > 0 ? availableFaces.join(' / ') : '沒有可替換旗面',
          detail: this._bannerEntryDetail(entry, null),
        };
      })
      .filter(Boolean);
  },

  _combatBannerGuideView(targetId = '') {
    return {
      step: 'banner_guide',
      target: 'banner',
      targetId,
      title: '舉旗與換面',
      body: '主戰時會自動補立還沒在場上的旗。雙旗戰陣會先舉融合旗，再補另一面；已立起的旗不會自動換面。',
      cta: '想指定優先舉哪面旗，或想在下次主戰更換旗面時，再點角色框內的旗子圖示。',
      bannerGuide: true,
    };
  },

  _shouldShowBannerGuide() {
    if (G?.bannerGuideDismissed) return false;
    try {
      return localStorage.getItem('bbn_banner_guide_disabled') !== 'true';
    } catch {
      return true;
    }
  },

  dismissBannerGuide(persist = false) {
    if (G) G.bannerGuideDismissed = true;
    if (persist) {
      try { localStorage.setItem('bbn_banner_guide_disabled', 'true'); } catch {}
    }
    document.querySelectorAll('[data-banner-guide], .combat-tutorial-card[data-step="banner_guide"]').forEach(el => el.remove());
    document.querySelectorAll('.combat-banner-choice-toggle.combat-tutorial-highlight, .combat-banner-badge.changeable.combat-tutorial-highlight').forEach(el => {
      el.classList.remove('combat-tutorial-highlight');
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
      iconImage: entry.relic.iconImage || '',
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
      iconImage: banner.iconImage || '',
      faceName: banner.faceName,
      shortName: this._combatBannerShortName(banner),
      level: banner.level || 1,
      detail: this._combatBannerDetailText(banner),
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
      enemyDiceSides: 6,
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
    let enemyBlockBeforeAction = null;
    let enemyBlockAfterAction = null;
    const enemyWillBlock = !enemy.blockBroken && (intent?.type === 'block' || intent?.type === 'block_attack');
    if (enemyWillBlock) {
      const blockVal = Math.max(0, enemy.block || 0);
      if (blockVal > 0) {
        enemyBlockBeforeAction = CombatStatus.getBlock(enemy);
        CombatStatus.raiseBlock(enemy, blockVal);
        enemyBlockAfterAction = CombatStatus.getBlock(enemy);
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
    let enemyDiceSides = 6;
    let enemyAttackFlow = ['attack', 'block_attack', 'dice_attack', 'aoe'].includes(intent?.type);
    if (enemyAttackFlow) {
      if (intent?.type === 'attack' || intent?.type === 'block_attack') {
        const damageDie = CombatRules._enemyAttackDamageDie(enemy);
        counterDmg = Math.max(0, enemy.attack || 0) + damageDie.roll;
        if (damageDie.roll > 0) {
          enemyDiceRoll = damageDie.roll;
          enemyDiceSides = damageDie.sides;
          logs.push(`${enemy.name} 傷害骰 ${damageDie.roll}：攻擊傷害 ${counterDmg}。`);
        }
      }
      else if (intent?.type === 'dice_attack') {
        const damageDie = CombatRules._enemyAttackDamageDie(enemy);
        if (damageDie.roll > 0) {
          enemyDiceRoll = damageDie.roll;
          enemyDiceSides = damageDie.sides;
          counterDmg = Math.max(0, enemy.attack || 0) + damageDie.roll;
          logs.push(`${enemy.name} 擲骰攻擊：基礎 ${Math.max(0, enemy.attack || 0)} + 傷害骰 ${damageDie.roll} = ${counterDmg}。`);
        } else {
          enemyDiceRoll = Math.ceil(Math.random() * 6);
          enemyDiceSides = 6;
          counterDmg = enemyDiceRoll;
          logs.push(`${enemy.name} 擲骰攻擊：${counterDmg}`);
        }
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
      enemyBlockGain,
      enemyBlockBeforeAction,
      enemyBlockAfterAction,
      enemyDiceRoll,
      enemyDiceSides,
      enemyAttackFlow,
      counterTarget,
      counterTargetId: counterTarget?.id || null,
      counterTargetName: counterTarget?.name || null,
      aoeDamageByChar: null,
      gazeSummary: null,
      fateSummary: null,
      bannerSummary: null,
      fateLuckyFace: null,
      fateLuckyFaces: null,
      fateUnluckyFaces: null,
      counterDamageHits: null,
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
    enemyBlockGain = Math.max(0, enemyActionResult.enemyBlockGain || 0);
    enemyBlockBeforeAction = enemyActionResult.enemyBlockBeforeAction ?? enemyBlockBeforeAction;
    enemyBlockAfterAction = enemyActionResult.enemyBlockAfterAction ?? enemyBlockAfterAction;
    enemyDiceRoll = enemyActionResult.enemyDiceRoll;
    enemyDiceSides = enemyActionResult.enemyDiceSides || enemyDiceSides;
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
        logs.push(`護甲道具：敵方攻擊 -${armorReduce}，剩餘 ${counterDmg}`);
      }
      counterDmg = CombatStatus.applyWoundTakenBonus(counterTarget, counterDmg, logs);
      counterDmg = CombatStatus.applyBannerBearerDamageReduction(counterTarget, counterDmg, logs);
      counterDmg = CombatStatus.applyExplorerEvasion(counterTarget, counterDmg, logs, '敵方攻擊傷害');
      let finalEyePierceDamage = 0;
      let allyBlockBefore = null;
      let allyBlockAfter = null;
      let allyBlockAbsorbed = 0;
      if (CombatStatus.getBlock(counterTarget) > 0) {
        allyBlockBefore = CombatStatus.getBlock(counterTarget);
        const blockResult = CombatStatus.consumeBlock(counterTarget, counterDmg);
        counterDmg = blockResult.damage;
        allyBlockAfter = blockResult.block;
        allyBlockAbsorbed = blockResult.absorbed;
        logs.push(`格檔吸收 ${blockResult.absorbed}，剩餘格檔 ${blockResult.block}，敵方攻擊 ${counterDmg}`);
        if (intent?.finalEye && blockResult.absorbed > 0) {
          finalEyePierceDamage = CombatRules._finalEyeBlockPierceDamage(enemy);
          if (finalEyePierceDamage > 0) logs.push(`${enemy.name} 破盾滲光：格檔吸收黑夜開眼，額外造成 ${finalEyePierceDamage} 固定傷害。`);
        }
      }
      if (counterDmg > 0 || finalEyePierceDamage > 0) {
        counterDmg = CombatStatus.applyIncomingRiskBonuses(counterTarget, counterDmg, {
          allowRemorse: true,
          allowBacklash: true,
          logs,
          damageLabel: '受擊傷害',
          resultLabel: '敵方攻擊',
        });
        const totalCounterDamage = counterDmg + finalEyePierceDamage;
        const beforeHp = counterTarget.hp;
        counterTarget.hp = Math.max(0, counterTarget.hp - totalCounterDamage);
        CombatStatus.recordGamblerPainBlock(counterTarget, beforeHp, counterTarget.hp, logs);
        if (intent?.finalEye && CombatRules._finalEyeIntimidates(enemy) && beforeHp > counterTarget.hp) {
          counterTarget.finalEyeIntimidatedUntilRound = Math.max(counterTarget.finalEyeIntimidatedUntilRound || 0, (G.combat?.round || 1) + 1);
          logs.push(`${enemy.name} 開眼威懾：${counterTarget.name} 下回合無法主戰。`);
        }
        combatResult.incomingDamageEvents = Array.isArray(combatResult.incomingDamageEvents) ? combatResult.incomingDamageEvents : [];
        const counterEvents = this._combatSplitIncomingHitEvents(enemyActionResult.counterDamageHits, totalCounterDamage, {
          type: 'counter',
          targetId: counterTarget.id,
          from: beforeHp,
          to: counterTarget.hp,
          allyBlockBefore,
          allyBlockAfter,
          allyBlockAbsorbed,
          fullBlock: allyBlockAbsorbed > 0 && totalCounterDamage <= 0,
        });
        combatResult.incomingDamageEvents.push(...counterEvents);
        counterDmg = totalCounterDamage;
        logs.push(`${enemy.name} 攻擊 ${counterTarget.name}，造成 ${counterDmg} 傷害。`);
      } else {
        if (allyBlockAbsorbed > 0 && counterTarget) {
          combatResult.incomingDamageEvents = Array.isArray(combatResult.incomingDamageEvents) ? combatResult.incomingDamageEvents : [];
          combatResult.incomingDamageEvents.push({
            type: 'counter_blocked',
            targetId: counterTarget.id,
            damage: 0,
            from: counterTarget.hp,
            to: counterTarget.hp,
            allyBlockBefore,
            allyBlockAfter,
            allyBlockAbsorbed,
            fullBlock: true,
          });
        }
        logs.push(`${enemy.name} 的攻擊被完全抵消。`);
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
        let reduced = this._reduceIncomingDamage(c, incomingAoe, true, true, logs);
        reduced = CombatStatus.applyExplorerEvasion(c, reduced, logs, '全體傷害');
        if (CombatStatus.getBlock(c) > 0 && reduced > 0) {
          const blockResult = CombatStatus.consumeBlock(c, reduced);
          reduced = blockResult.damage;
          logs.push(`${c.name} 格檔吸收 ${blockResult.absorbed}，剩餘格檔 ${blockResult.block}`);
        }
        const beforeHp = c.hp;
        c.hp = Math.max(0, c.hp - reduced);
        CombatStatus.recordGamblerPainBlock(c, beforeHp, c.hp, logs);
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
      logs.push(`${enemy.name} 採取防禦，沒有攻擊。`);
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
    if (enemyBlockBeforeAction !== null) combatResult.enemyBlockBeforeAction = enemyBlockBeforeAction;
    if (enemyBlockAfterAction !== null) combatResult.enemyBlockAfterAction = enemyBlockAfterAction;
    combatResult.counterDmg = counterDmg;
    combatResult.counterTargetId = counterTarget?.id || null;
    combatResult.counterTargetName = counterTarget?.name || null;
    combatResult.aoeCounter = aoeCounter;
    combatResult.aoeDamageByChar = aoeDamageByChar;
    combatResult.enemyDiceRoll = enemyDiceRoll;
    combatResult.enemyDiceSides = enemyDiceSides;
    combatResult.gazeRoll = enemyActionResult.gazeRoll || null;
    combatResult.gazeSummary = enemyActionResult.gazeSummary || null;
    combatResult.firstStrikeSummary = enemyActionResult.firstStrikeSummary || null;
    combatResult.fateRoll = enemyActionResult.fateRoll || null;
    combatResult.fateSummary = enemyActionResult.fateSummary || null;
    combatResult.bannerSummary = enemyActionResult.bannerSummary || null;
    combatResult.fateLuckyFace = enemyActionResult.fateLuckyFace || null;
    combatResult.fateLuckyFaces = Array.isArray(enemyActionResult.fateLuckyFaces) ? enemyActionResult.fateLuckyFaces : [];
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
          if (this._handleCombatDefeatAfterAnimation(combatResult, attacker, enemy, roll, rollResult)) return;
        }
        if (!combatResult.skipExplorerEvasionGain && !combatResult.explorerEvasionGainApplied) {
          this._applyExplorerEvasionGain(attacker, roll, combatResult.logs);
          combatResult.explorerEvasionGainApplied = true;
        }
        if (!combatResult.skipSupportTeamHeal) this._applySupportTeamHeal(attacker, combatResult.logs, combatResult);

        this._endWagerDiceAttackFlow();
        this._clearExpiredWeaknessEffects(enemy);
        for (const banner of this._activeCombatBanners()) banner.usedThisRound = false;
        this._clearEndOfRoundBlocks(combatResult.logs);
        for (const char of G.squad) {
          char._grapplingHookUsedRound = false;
          char._corrosiveOilUsedRound = false;
          char._serratedOilUsedRound = false;
          char._rapierGuaranteedFollowUpsUsed = 0;
        }
        this._applyRearThreatTransfer(attacker, combatResult.logs);
        G.combat.round++;
        const nextRoundBlockBeforeByChar = {};
        const nextRoundEvasionBeforeByChar = {};
        for (const char of G.squad || []) {
          if (char?.id) nextRoundBlockBeforeByChar[char.id] = CombatStatus.getBlock(char);
          if (char?.id) nextRoundEvasionBeforeByChar[char.id] = CombatStatus.getEvasionChance(char);
        }
        this._appendNextRoundStartLogs(enemy, combatResult.logs);
        const nextRoundBlockByChar = {};
        const nextRoundEvasionByChar = {};
        for (const char of G.squad || []) {
          if (!char?.id) continue;
          const beforeBlock = Math.max(0, nextRoundBlockBeforeByChar[char.id] || 0);
          const afterBlock = CombatStatus.getBlock(char);
          if (afterBlock > beforeBlock) nextRoundBlockByChar[char.id] = afterBlock;
          const beforeEvasion = Math.max(0, nextRoundEvasionBeforeByChar[char.id] || 0);
          const afterEvasion = CombatStatus.getEvasionChance(char);
          if (afterEvasion > beforeEvasion) nextRoundEvasionByChar[char.id] = afterEvasion;
        }
        if (Object.keys(nextRoundBlockByChar).length > 0) {
          combatResult.nextRoundBlockBeforeByChar = nextRoundBlockBeforeByChar;
          combatResult.nextRoundBlockByChar = nextRoundBlockByChar;
        }
        if (Object.keys(nextRoundEvasionByChar).length > 0) {
          combatResult.nextRoundEvasionBeforeByChar = nextRoundEvasionBeforeByChar;
          combatResult.nextRoundEvasionByChar = nextRoundEvasionByChar;
        }
        G.combat.bowFollowUps = 0;
        G.combat.playerDamageEventsThisAttack = [];
        G.combat.combatLogsThisAttack = [];
        G.combat.itemUsedRound = 0;
        G.combat.rollItemUsedRound = 0;
        G.combat.bagOpen = false;
        G.combat.pendingInventoryItemIndex = null;
        G.combat.intent = this._resolveCombatIntent(enemy);
        G.combat.actionInProgress = false;
  
        // Section.
        const summaryLines = [];
        if (combatResult.playerTurnSkipped) {
          summaryLines.push('隊伍被震攝壓制，這回合無法出手。');
        } else if (combatResult.damage > 0) {
          summaryLines.push(`${attacker.name} 攻擊 ${enemy.name}，造成 ${combatResult.damage} 傷害${combatResult.weaknessHit ? '，命中弱點。' : '。'}`);
        } else {
          summaryLines.push(`${attacker.name} 的攻擊被格檔，造成 0 傷害。`);
        }
        if (combatResult.enemyPreemptiveStunned && combatResult.firstStrikeStunQueued) {
          summaryLines.push(`${enemy.name} 本回合被震懾無法先攻，且下一回合仍會被震懾。`);
        } else if (combatResult.enemyPreemptiveStunned) {
          summaryLines.push(`${enemy.name} 被震懾，本回合無法先攻。`);
        } else if (combatResult.firstStrikeStunQueued) {
          summaryLines.push(`${enemy.name} 失衡，下一回合無法先攻。`);
        } else if (combatResult.stunned) {
          summaryLines.push(`${enemy.name} 失衡，本回合無法行動。`);
        } else if (combatResult.enemyPreemptiveActed) {
          summaryLines.push(`${enemy.name} 本回合已先攻。`);
        } else if (combatResult.counterDmg > 0 && combatResult.aoeCounter > 0) {
          summaryLines.push(`${enemy.name} 攻擊主目標 ${combatResult.counterTargetName || attacker.name}，造成 ${combatResult.counterDmg} 傷害；其餘隊友濺射 ${combatResult.aoeCounter} 傷害。`);
        } else if (combatResult.aoeCounter > 0) {
          const variedAoe = combatResult.aoeDamageByChar && Object.keys(combatResult.aoeDamageByChar).length > 0;
          summaryLines.push(variedAoe
            ? `${enemy.name} 攻擊全隊，基礎 ${combatResult.aoeCounter} 傷害，凝視命中者加倍。`
            : `${enemy.name} 攻擊全隊，造成 ${combatResult.aoeCounter} 傷害。`);
        } else if (combatResult.counterDmg > 0) {
          summaryLines.push(`${enemy.name} 攻擊 ${combatResult.counterTargetName || attacker.name}，造成 ${combatResult.counterDmg} 傷害。`);
        } else {
          summaryLines.push(`${enemy.name} 本回合沒有造成傷害。`);
        }
        if (combatResult.gazeSummary) summaryLines.push(combatResult.gazeSummary);
        if (combatResult.firstStrikeSummary) summaryLines.push(combatResult.firstStrikeSummary);
        if (combatResult.fateSummary) summaryLines.push(combatResult.fateSummary);
        if (combatResult.bannerSummary) summaryLines.push(combatResult.bannerSummary);
        const hasActableNext = this._combatActableSquad().length > 0;
        const combatAnims = this._combatResultAnims(attacker, combatResult, 120);
  
        this._openModal({
          title: `戰鬥：第 ${G.combat.round - 1} 回合結果`,
          desc: summaryLines.join('\n'),
          combatLog: combatResult.logs,
          combat: {
            ...this._buildCombatScene(enemy, attacker, this._combatStatusText()),
            selectable: hasActableNext,
            itemTargeting: false,
            showBag: false,
            inventory: this._combatInventoryView(),
            canUseBag: this._canUseCombatBag(),
            canGuard: this._canUseCombatGuard(),
            guardCooldown: this._combatGuardCooldown(),
            rollItemBlocked: G.combat.rollItemUsedRound === G.combat.round,
          },
          combatAnims,
          dice: combatResult.playerTurnSkipped ? null : { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: displayRoll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
          enemyDice: combatResult.gazeRoll
            ? { type: 'danger', label: '裂隙凝視骰', value: combatResult.gazeRoll, sides: 6 }
            : (combatResult.fateRoll
              ? {
                type: 'danger',
                label: (combatResult.fateLuckyFaces?.length || combatResult.fateLuckyFace)
                  ? `命運骰（幸運 ${(combatResult.fateLuckyFaces?.length ? combatResult.fateLuckyFaces : [combatResult.fateLuckyFace]).join('、')} / 厄運 ${(combatResult.fateUnluckyFaces || []).join('、')}）`
                  : '命運骰',
                value: combatResult.fateRoll,
                sides: 6,
              }
              : (combatResult.enemyDiceRoll
                ? { type: 'danger', label: `${enemy.name} 的攻擊骰`, value: combatResult.enemyDiceRoll, sides: combatResult.enemyDiceSides || 6 }
                : null)),
          choices: this._combatActionChoices(),
        });
        if (!hasActableNext && this._combatShouldAutoSkipPlayerTurn()) {
          this._scheduleAutoSkipPlayerTurn(this._combatResultAnimDuration(combatAnims, combatResult.enemyDiceRoll ? { animate: true } : null) + 240);
        }
    },

  _combatResultAnims(attacker, combatResult = {}, delay = 400) {
    const playerDamageEvents = combatResult.skipPlayerDamageAnims
      ? []
      : (Array.isArray(combatResult.playerDamageEvents)
        ? combatResult.playerDamageEvents
        : (Array.isArray(combatResult.rapierDamageEvents) ? combatResult.rapierDamageEvents : []));
    const enemy = G.combat?.enemy || null;
    const enrichIncomingEvent = event => {
      if (!event || !event.targetId) return event;
      const target = (G.squad || []).find(char => char?.id === event.targetId);
      const deathSfx = target?.deathSfx || (typeof CLASS_DEATH_SFX !== 'undefined' ? CLASS_DEATH_SFX[target?.cls] : '');
      return {
        ...event,
        deathSfx: Number.isFinite(event.to) && event.to <= 0 ? (deathSfx || '') : '',
        deathSfxVolume: target?.deathSfxVolume,
      };
    };
    return {
      playerAttacker: attacker?.id || null,
      playerFollowHits: Math.max(combatResult.rapierFollowHits || 0, playerDamageEvents.length),
      playerDamageEvents,
      incomingDamageEvents: Array.isArray(combatResult.incomingDamageEvents) ? combatResult.incomingDamageEvents.map(enrichIncomingEvent) : [],
      healEvents: Array.isArray(combatResult.healEvents) ? combatResult.healEvents : [],
      guardBlock: combatResult.guardBlock || 0,
      guardTargetId: combatResult.guardTargetId || null,
      guardRemainingBlockByChar: combatResult.guardRemainingBlockByChar || null,
      nextRoundBlockBeforeByChar: combatResult.nextRoundBlockBeforeByChar || null,
      nextRoundBlockByChar: combatResult.nextRoundBlockByChar || null,
      nextRoundEvasionBeforeByChar: combatResult.nextRoundEvasionBeforeByChar || null,
      nextRoundEvasionByChar: combatResult.nextRoundEvasionByChar || null,
      counterTarget: combatResult.enemyAttackFlow && combatResult.counterTargetId
        ? combatResult.counterTargetId
        : (combatResult.counterDmg > 0 ? (attacker?.id || null) : null),
      aoe: combatResult.aoeCounter > 0,
      enemyBlock: combatResult.enemyBlockGain > 0,
      enemyBlockBefore: Number.isFinite(combatResult.enemyBlockBeforeAction) ? combatResult.enemyBlockBeforeAction : null,
      enemyBlockAfter: Number.isFinite(combatResult.enemyBlockAfterAction) ? combatResult.enemyBlockAfterAction : null,
      enemyAttackTrail: enemy?.attackTrail || '',
      enemyAttackTrailFamily: enemy?.attackTrailFamily || '',
      enemyAttackSfx: enemy?.attackSfx || '',
      enemyAttackSfxVolume: enemy?.attackSfxVolume,
      delay,
    };
  },

  _recordCombatLogsThisAttack(combatResult, isBowFollowUp = false) {
    if (!G.combat || !combatResult) return;
    const currentLogs = Array.isArray(combatResult.logs) ? [...combatResult.logs] : [];
    const previousLogs = isBowFollowUp && Array.isArray(G.combat.combatLogsThisAttack)
      ? G.combat.combatLogsThisAttack
      : [];
    G.combat.combatLogsThisAttack = [...previousLogs, ...currentLogs];
    combatResult.logs = [...G.combat.combatLogsThisAttack];
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
    if (!this._combatTutorialAllows('attack')) return;
    if (G.combat) G.combat.bagOpen = false;
    const char = G.squad.find(c => c.id === charId);
    if (!char || char.dead || char.hp <= 0) return;
    if (this._isFinalEyeIntimidated(char)) {
      this._log(`${char.name} 仍被開眼威懾，本回合無法主戰。`, 'danger');
      this._showCombatModal();
      return;
    }
    if (G.combat) G.combat.attackerId = char.id;
    if (G.combat) G.combat.instantItemBadges = [];
    this._advanceCombatTutorial('attack_role', null);
    document.querySelectorAll('.combat-unit.ally.active').forEach(el => el.classList.remove('active'));
    document.querySelector(`.combat-unit.ally[data-char-id="${char.id}"]`)?.classList.add('active');
    G.combat.actionInProgress = true;
    if (this._triggerEnemyFirstStrikeBeforeAttack(char)) return;
    this._doCombatRound(char);
  },

  _triggerEnemyFirstStrikeBeforeAttack(attacker) {
    if (!G.combat || !attacker || attacker.hp <= 0 || attacker.dead) return false;
    const enemy = G.combat.enemy;
    const hasFirstStrike = Array.isArray(enemy?.abilities) && enemy.abilities.some(ability => ability?.type === 'first_strike');
    if (!hasFirstStrike || G.combat.firstStrikeEnemyActed) return false;
    if (Math.max(0, enemy.firstStrikeStunnedUntilRound || 0) >= (G.combat.round || 1)) {
      enemy.firstStrikeStunnedUntilRound = 0;
      G.combat.firstStrikeEnemyActed = true;
      G.combat.firstStrikeSkippedByStun = true;
      G.combat.preemptiveLogsThisRound = [`${enemy.name} 被震懾，本回合無法先攻。`];
      return false;
    }

    const logs = [`${enemy.name} 搶得先機，在 ${attacker.name} 出手前先攻。`];
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
      enemyDiceSides: 6,
      enemyAttackFlow: false,
      intent: G.combat.intent,
    };
    G.combat.deferredEnemyAction = {
      attackerId: attacker.id,
      intent: G.combat.intent ? { ...G.combat.intent } : null,
      round: G.combat.round,
      combatMods: [...(G.combatMods || [])],
      wagerDice: null,
    };
    this._applyDeferredEnemyAction(attacker, combatResult);
    G.combat.firstStrikeEnemyActed = true;
    G.combat.preemptiveLogsThisRound = [...combatResult.logs];

    if (combatResult.counterTargetId) this._halveCombatThreat(combatResult.counterTargetId);
    if (this._handleCombatDefeatAfterAnimation(combatResult, attacker, enemy, 0, { value: 0 })) return true;

    const summaryLines = [`${enemy.name} 先攻。`];
    if (combatResult.counterDmg > 0 && combatResult.aoeCounter > 0) {
      summaryLines.push(`${enemy.name} 攻擊主目標 ${combatResult.counterTargetName || attacker.name}，造成 ${combatResult.counterDmg} 傷害；其餘隊友濺射 ${combatResult.aoeCounter} 傷害。`);
    } else if (combatResult.aoeCounter > 0) {
      summaryLines.push(`${enemy.name} 攻擊全隊，造成 ${combatResult.aoeCounter} 傷害。`);
    } else if (combatResult.counterDmg > 0) {
      summaryLines.push(`${enemy.name} 攻擊 ${combatResult.counterTargetName || attacker.name}，造成 ${combatResult.counterDmg} 傷害。`);
    } else {
      summaryLines.push(`${enemy.name} 本次先攻沒有造成傷害。`);
    }
    if (combatResult.gazeSummary) summaryLines.push(combatResult.gazeSummary);
    if (combatResult.firstStrikeSummary) summaryLines.push(combatResult.firstStrikeSummary);
    if (combatResult.fateSummary) summaryLines.push(combatResult.fateSummary);
    if (combatResult.bannerSummary) summaryLines.push(combatResult.bannerSummary);

    this._openModal({
      title: '敵方先攻',
      desc: summaryLines.join('\n'),
      combatLog: combatResult.logs,
      combat: {
        ...this._buildCombatScene(enemy, attacker, this._combatStatusText()),
        selectable: false,
        itemTargeting: false,
        guardTargeting: false,
        showBag: false,
        inventory: this._combatInventoryView(),
        canUseBag: false,
        canGuard: false,
        rollItemBlocked: true,
      },
      combatAnims: this._combatResultAnims(attacker, combatResult, 120),
      enemyDice: combatResult.enemyDiceRoll
        ? { type: 'danger', label: `${enemy.name} 的攻擊骰`, value: combatResult.enemyDiceRoll, sides: combatResult.enemyDiceSides || 6 }
        : null,
      choices: [],
    });
    const combatAnims = this._combatResultAnims(attacker, combatResult, 120);
    window.setTimeout(() => {
      if (!G.combat) return;
      if (attacker.hp <= 0 || attacker.dead) {
        G.combat.actionInProgress = false;
        this._showCombatModal();
        return;
      }
      G.combat.actionInProgress = true;
      this._doCombatRound(attacker);
    }, this._combatResultAnimDuration(combatAnims, combatResult.enemyDiceRoll ? { animate: true } : null) + 80);
    return true;
  },

  _isFinalEyeIntimidated(char) {
    if (!G.combat || !char) return false;
    return Math.max(0, char.finalEyeIntimidatedUntilRound || 0) >= (G.combat.round || 1);
  },

  _combatTutorialStepMeta(step = '') {
    const metas = {
      enemy_detail: {
        step: 'enemy_detail',
        target: 'enemy',
        title: '先觀察敵人',
        body: '點擊黑影蠕蟲的圖卡，可以查看牠的弱點與特性。這隻怪物會在你選定主戰者後優先攻擊。',
        cta: '點擊敵人圖卡',
      },
      enemy_detail_close: {
        step: 'enemy_detail_close',
        target: 'popover_close',
        hideCard: true,
        title: '關閉敵人說明',
        body: '你已經看過黑影蠕蟲的特性。先把這張說明卡關閉，接著再學習如何用格檔承受攻擊。',
        cta: '點擊說明卡上的關閉',
      },
      guard_button: {
        step: 'guard_button',
        target: 'guard',
        title: '用格檔承受攻擊',
        body: '怪物攻擊前，可以按格檔並擲一顆骰。指定角色會獲得等同骰面數值的格檔，用來抵禦接下來的傷害。',
        cta: '點擊格檔',
      },
      guard_target: {
        step: 'guard_target',
        target: G.combat?.intent?.targetId ? 'guard_ally' : 'ally',
        targetId: G.combat?.intent?.targetId || null,
        title: '指定保護對象',
        body: G.combat?.intent?.targetName
          ? `敵人現在準備攻擊 ${G.combat.intent.targetName}。點擊他來上格檔，擲出的骰數會變成格檔值，先吸收接下來的傷害。`
          : '選擇要上格檔的角色。擲出的骰數會變成他的格檔值，格檔會先吸收傷害，讓血量不會直接被打掉。',
        cta: G.combat?.intent?.targetName ? `點擊 ${G.combat.intent.targetName}` : '點擊一張角色圖卡',
      },
      item_bag: {
        step: 'item_bag',
        target: 'bag',
        title: '使用戰鬥道具',
        body: '補給也能扭轉戰局。這裡先給你一個磨刀石，它可以讓本場戰鬥的主戰攻擊 +1。',
        cta: '點擊背包',
      },
      item_select: {
        step: 'item_select',
        target: 'bag_item',
        hideCard: true,
        title: '選擇道具',
        body: '背包中會列出可在戰鬥使用的道具。選擇磨刀石，準備在這場戰鬥中強化攻勢。',
        cta: '點擊磨刀石',
      },
      item_target: {
        step: 'item_target',
        target: 'item_ally',
        title: '指定使用者',
        body: '選擇任一名還能行動的角色來激活磨刀石。道具使用後，本回合仍可選擇主戰者攻擊。',
        cta: '點擊一張角色圖卡',
      },
      attack_role: {
        step: 'attack_role',
        target: 'ally',
        title: '選擇主戰者',
        body: '戰鬥採用主戰制：每回合只有一名角色能攻擊。點擊角色圖卡，決定這回合由誰出手。',
        cta: '點擊角色圖卡攻擊',
      },
    };
    if (step === 'guard_cooldown') {
      return {
        step: 'guard_cooldown',
        target: 'guard',
        title: '格檔會進入冷卻',
        body: '格檔每兩回合只能使用一次。使用後會進入冷卻；善用格檔能幫隊伍穩住局勢，甚至扭轉危險的戰局。',
        cta: '看完格檔說明後點擊下一步',
      };
    }
    return metas[step] || null;
  },

  _combatTutorialView() {
    if (!G.combatTutorial?.active || G.combatTutorial.completed) return null;
    return this._combatTutorialStepMeta(G.combatTutorial.step);
  },

  _combatTutorialAllows(action = '') {
    if (!G.combatTutorial?.active || G.combatTutorial.completed) return true;
    const step = G.combatTutorial.step;
    if (step === 'enemy_detail') return action === 'enemy_detail';
    if (step === 'enemy_detail_close') return action === 'enemy_detail_close';
    if (step === 'guard_button') return action === 'guard';
    if (step === 'guard_target') return action === 'guard_target';
    if (step === 'guard_cooldown') return action === 'tutorial_next';
    if (['item_bag', 'item_select'].includes(step)) return action === 'bag';
    if (step === 'item_target') return action === 'item_target' || action === 'bag';
    if (step === 'attack_role') return action === 'attack';
    return true;
  },

  _advanceCombatTutorial(expectedStep, nextStep = null) {
    if (!G.combatTutorial?.active || G.combatTutorial.completed) return false;
    if (G.combatTutorial.step !== expectedStep) return false;
    if (nextStep) {
      G.combatTutorial.step = nextStep;
    } else {
      G.combatTutorial.completed = true;
      G.combatTutorial.active = false;
    }
    Render.updateCombatTutorialInline?.(this._combatTutorialView());
    this._syncCombatTutorialDomLocks();
    return true;
  },

  _ensureCombatTutorialWhetstone() {
    if (!G.combatTutorial?.active || G.combatTutorial.completed || G.combatTutorial.whetstoneGranted) return;
    if (typeof getEquipById !== 'function') return;
    const item = getEquipById('whetstone');
    if (!item) return;
    this._ensureInventory();
    const hasWhetstone = (G.inventory || []).some(slot => this._inventoryItem(slot)?.id === 'whetstone');
    if (!hasWhetstone) {
      const result = this._addInventoryItem(item);
      if (!result?.added && G.combat) {
        G.combat.tutorialWhetstone = { item: { ...item }, count: 1 };
      }
      this._log('戰鬥教學：獲得道具「磨刀石」。', 'reward');
    }
    G.combatTutorial.whetstoneGranted = true;
  },

  _syncCombatTutorialDomLocks() {
    if (!G.combat || typeof document === 'undefined') return;
    if (!G.combatTutorial?.active || G.combatTutorial.completed) return;
    const guardButton = document.querySelector('.combat-guard-button');
    if (guardButton && !this._combatGuardTargeting()) {
      const allowGuard = this._combatTutorialAllows('guard') && this._canUseCombatGuard();
      guardButton.disabled = !allowGuard;
      guardButton.classList.toggle('disabled', !allowGuard);
      if (allowGuard) {
        guardButton.setAttribute('onclick', 'Game.selectCombatGuard()');
      } else {
        guardButton.removeAttribute('onclick');
      }
    }
    const bagButton = document.querySelector('.combat-bag-button');
    if (bagButton) {
      const allowBag = this._combatTutorialAllows('bag') && this._canUseCombatBag();
      bagButton.disabled = !allowBag;
      bagButton.classList.toggle('disabled', !allowBag);
      if (allowBag) {
        bagButton.setAttribute('onclick', 'Game.openCombatBag()');
      } else {
        bagButton.removeAttribute('onclick');
      }
    }
    if (!this._combatTutorialAllows('attack') && !this._combatItemTargeting() && !this._combatGuardTargeting()) {
      document.querySelectorAll('.combat-unit.ally.selectable').forEach(unit => {
        unit.classList.remove('selectable');
        unit.removeAttribute('onclick');
      });
    }
  },

  continueCombatTutorial() {
    if (!this._combatTutorialAllows('tutorial_next')) return;
    if (this._advanceCombatTutorial('guard_cooldown', 'item_bag')) {
      this._ensureCombatTutorialWhetstone();
      this._showCombatModal();
    }
  },

  _combatActableSquad() {
    if (!G.combat) return [];
    return this._aliveSquad().filter(char => !this._isFinalEyeIntimidated(char));
  },

  _combatShouldAutoSkipPlayerTurn() {
    if (!G.combat || G.combat.actionInProgress) return false;
    if (this._combatItemTargeting() || this._combatGuardTargeting()) return false;
    const alive = this._aliveSquad();
    return alive.length > 0 && this._combatActableSquad().length === 0;
  },

  _scheduleAutoSkipPlayerTurn(delayMs = 600) {
    if (!G.combat) return;
    const token = `${G.combat.round || 1}-${Date.now()}-${Math.random()}`;
    G.combat.autoSkipToken = token;
    window.setTimeout(() => {
      if (!G.combat || G.combat.autoSkipToken !== token) return;
      if (!this._combatShouldAutoSkipPlayerTurn()) return;
      this._skipCombatTurnForNoActingCharacters();
    }, Math.max(0, delayMs || 0));
  },

  _skipCombatTurnForNoActingCharacters() {
    if (!this._combatShouldAutoSkipPlayerTurn()) return false;
    const enemy = G.combat.enemy;
    if (!enemy || enemy.hp <= 0) return false;
    const fallback = this._aliveSquad()[0] || null;
    if (!fallback) return false;
    const round = G.combat.round || 1;
    const locked = this._aliveSquad().filter(char => this._isFinalEyeIntimidated(char));
    const names = locked.map(char => char.name).join('、');
    G.combat.actionInProgress = true;
    G.combat.bagOpen = false;
    G.combat.guardTargeting = false;
    G.combat.pendingInventoryItemIndex = null;
    G.combat.deferredEnemyAction = {
      attackerId: fallback.id,
      intent: G.combat.intent ? { ...G.combat.intent } : null,
      round,
      combatMods: [...(G.combatMods || [])],
      wagerDice: null,
    };
    const combatResult = {
      damage: 0,
      weaknessHit: false,
      logs: [`${names || '隊伍'} 被震攝壓制，錯失本回合行動。`],
      incomingDamageEvents: [],
      enemyBlockGain: 0,
      counterDmg: 0,
      counterTargetId: null,
      counterTargetName: null,
      aoeCounter: 0,
      aoeDamageByChar: null,
      enemyDiceRoll: null,
      enemyDiceSides: 6,
      enemyAttackFlow: false,
      intent: G.combat.intent,
      skipExplorerEvasionGain: true,
      skipSupportTeamHeal: true,
      skipPlayerDamageAnims: true,
      playerTurnSkipped: true,
    };
    this._finishCombatRound(fallback, combatResult, 0, {
      value: 0,
      displayValue: 0,
      raw: 0,
      floored: 0,
      sides: 6,
      charCls: fallback.cls,
    });
    return true;
  },

  selectCombatGuard() {
    if (!G.combat || this._combatItemTargeting() || G.combat.actionInProgress) return;
    if (!this._combatTutorialAllows('guard')) return;
    if (!this._canUseCombatGuard()) return;
    this._advanceCombatTutorial('guard_button', 'guard_target');
    G.combat.guardTargeting = true;
    G.combat.bagOpen = false;
    G.combat.pendingInventoryItemIndex = null;
    this._showCombatModal();
  },

  selectCombatGuardTarget(charId) {
    if (!G.combat || !this._combatGuardTargeting() || G.combat.actionInProgress) return;
    if (!this._combatTutorialAllows('guard_target')) return;
    const enemy = G.combat.enemy;
    if (!enemy || enemy.hp <= 0) return;
    const target = G.squad.find(c => c.id === charId);
    if (!target || target.dead || target.hp <= 0) return;
    if (
      G.combatTutorial?.active &&
      !G.combatTutorial.completed &&
      G.combatTutorial.step === 'guard_target' &&
      G.combat.intent?.targetId &&
      target.id !== G.combat.intent.targetId
    ) return;
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
    if (G.combatTutorial?.active && !G.combatTutorial.completed) return;
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
    const guardBlockBeforeByChar = {};
    guardBlockBeforeByChar[target.id] = CombatStatus.getBlock(target);
    CombatStatus.setBlock(target, CombatStatus.getBlock(target) + block);
    guardBlockByChar[target.id] = CombatStatus.getBlock(target);
    logs.push(`${target.name} 格檔 +${block}`);

    G.combat.guardReadyRound = (G.combat.round || 1) + 2;
    G.combat.bowFollowUps = 0;
    G.combat.bagOpen = false;
    G.combat.pendingInventoryItemIndex = null;
    G.combat.guardTargeting = false;
    G.combat.actionInProgress = false;
    G.combat._pendingRoundStartLogs = [
      ...(G.combat._pendingRoundStartLogs || []),
      ...logs,
    ];
    this._advanceCombatTutorial('guard_target', 'guard_cooldown');

    const combatScene = this._buildCombatScene(enemy, null, this._combatStatusText());
    combatScene.squad = combatScene.squad.map(char => ({
      ...char,
      block: Math.max(char.block || 0, guardBlockByChar[char.id] || 0),
    }));

    this._openModal({
      title: '格檔準備',
      desc: `${target.name} 擲出 ${Dice.face(roll)}（${roll}），獲得 ${block} 格檔。`,
      combatLog: logs,
      combat: {
        ...combatScene,
        selectable: this._combatTutorialAllows('attack'),
        itemTargeting: false,
        guardTargeting: false,
        showBag: false,
        inventory: this._combatInventoryView(),
        canUseBag: this._combatTutorialAllows('bag') && this._canUseCombatBag(),
        canGuard: this._combatTutorialAllows('guard') && this._canUseCombatGuard(),
        guardCooldown: this._combatGuardCooldown(),
        rollItemBlocked: G.combat.rollItemUsedRound === G.combat.round,
      },
      combatAnims: {
        guardBlock: block,
        guardTargetId: target.id,
        guardBlockBeforeByChar,
        guardRemainingBlockByChar: guardBlockByChar,
        delay: 120,
        lockActions: false,
      },
      dice: { type: 'combat', label: '守勢骰', value: roll, raw: roll, floored: false, charCls: 'neutral', sides: 6 },
      choices: this._combatActionChoices(),
    });
  },

  _canUseCombatGuard() {
    if (!G.combat || G.combat.actionInProgress || this._combatItemTargeting() || this._combatGuardTargeting()) return false;
    if (!this._aliveSquad().length) return false;
    if (this._combatActableSquad().length <= 0) return false;
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
    if (G.combatTutorial?.active && !G.combatTutorial.completed) return [];
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

  _applyExplorerEvasionGain(attacker, roll, logs = []) {
    const finalRoll = Math.max(0, Math.floor(roll || 0));
    for (const char of G.squad || []) {
      if (!char || char.cls !== 'explorer' || char.hp <= 0 || char.dead) continue;
      const baseGain = 10;
      const mainGain = char.id === attacker?.id ? finalRoll * 3 : 0;
      const gain = Math.max(0, Math.floor(baseGain + mainGain));
      if (gain <= 0) continue;
      const before = Math.max(0, Math.floor(char._evasionChancePending || 0));
      char._evasionChancePending = Math.min(50, before + gain);
      if (char._evasionChancePending <= before) continue;
      const parts = [`每回合 +${baseGain}%`];
      if (mainGain > 0) parts.push(`主戰骰面 +${mainGain}%`);
      logs.push(`身法：${char.name} ${parts.join('、')}，下回合閃避率準備 ${before}% → ${char._evasionChancePending}%。`);
    }
  },

  _clearEndOfRoundBlocks(logs = []) {
    for (const char of G.squad || []) {
      const block = CombatStatus.getBlock(char);
      if (block > 0) logs.push(`回合結束：${char.name} 剩餘格檔 ${block} 消散。`);
      CombatStatus.clearBlock(char);
    }
  },

  _clearSquadCombatCarryover() {
    for (const char of G.squad || []) {
      if (!char) continue;
      char._warriorGuardPendingBlock = 0;
      char._gamblerPainPendingBlock = 0;
      char._evasionChancePending = 0;
      char.finalEyeIntimidatedUntilRound = 0;
      CombatStatus.clearBlock(char);
      CombatStatus.clearEvasionChance(char);
    }
  },

  _appendNextRoundStartLogs(enemy, logs = []) {
    const nextRoundLogs = [];
    this._ensureRoundStartNativeWeakness(enemy, nextRoundLogs);
    EnemyAbilities.onRoundStart(enemy, { ...G.combat, squad: G.squad }, nextRoundLogs);
    nextRoundLogs.push(...this._applyRoundStartPlayerPendingEffects());
    if (nextRoundLogs.length > 0) {
      logs.push(...nextRoundLogs.map(line => `下一回合準備：${line}`));
    }
  },

  _applyRoundStartPlayerPendingEffects() {
    const logs = [];
    this._applyPendingWarriorGuardBlocks(logs);
    this._applyPendingGamblerPainBlocks(logs);
    this._applyPendingExplorerEvasionGain(logs);
    return logs;
  },

  _applySupportTeamHeal(attacker, logs = [], combatResult = null, options = {}) {
    const support = (G.squad || []).find(char => char?.cls === 'support' && char.hp > 0 && !char.dead);
    if (!support) return 0;
    if (!G.combat.threat) G.combat.threat = {};
    const addThreat = options.addThreat !== false;
    const logWhenNoHeal = options.logWhenNoHeal !== false;
    const beforeThreat = Math.max(0, G.combat.threat[support.id] || 0);
    if (addThreat) G.combat.threat[support.id] = Math.min(10, beforeThreat + 1);
    const afterThreat = Math.max(0, G.combat.threat[support.id] || 0);
    const targetCount = support.id === attacker?.id ? 2 : 1;
    const targets = (G.squad || [])
      .filter(char => char && char.hp > 0 && !char.dead && char.hp < char.maxHp)
      .sort((a, b) => {
        const aPct = a.maxHp > 0 ? a.hp / a.maxHp : 1;
        const bPct = b.maxHp > 0 ? b.hp / b.maxHp : 1;
        return aPct - bPct || a.hp - b.hp;
      })
      .slice(0, targetCount);
    const healed = [];
    const healEvents = [];
    for (const char of targets) {
      const before = char.hp;
      char.hp = Math.min(char.maxHp, char.hp + 1);
      const gained = char.hp - before;
      if (gained > 0) {
        healed.push(`${char.name} +${gained}`);
        healEvents.push({
          targetId: char.id,
          amount: gained,
          from: before,
          to: char.hp,
        });
      }
    }
    if (combatResult && healEvents.length > 0) {
      combatResult.healEvents = [
        ...(Array.isArray(combatResult.healEvents) ? combatResult.healEvents : []),
        ...healEvents,
      ];
    }
    if (healed.length > 0) {
      const threatText = addThreat ? `，仇恨 ${beforeThreat} → ${afterThreat}` : '';
      logs.push(`輔助：${support.name} 穩住傷勢，${healed.join('、')} HP${threatText}。`);
    } else if (logWhenNoHeal) {
      const threatText = addThreat ? `，仇恨 ${beforeThreat} → ${afterThreat}` : '';
      logs.push(`輔助：${support.name} 維持治療陣線${threatText}。`);
    }
    return healed.length;
  },

  _applyPendingWarriorGuardBlocks(logs = []) {
    for (const char of G.squad || []) {
      const block = Math.max(0, Math.floor(char?._warriorGuardPendingBlock || 0));
      if (!char || char.cls !== 'warrior' || block <= 0) continue;
      char._warriorGuardPendingBlock = 0;
      if (char.hp <= 0 || char.dead) continue;
      CombatStatus.raiseBlock(char, block);
      logs.push(`戰士：${char.name} 架勢成形，獲得格檔 ${block}。`);
    }
  },

  _applyPendingGamblerPainBlocks(logs = []) {
    for (const char of G.squad || []) {
      const block = Math.max(0, Math.floor(char?._gamblerPainPendingBlock || 0));
      if (!char || char.cls !== 'scholar' || block <= 0) continue;
      char._gamblerPainPendingBlock = 0;
      if (char.hp <= 0 || char.dead) continue;
      CombatStatus.raiseBlock(char, block);
      logs.push(`搏命者：${char.name} 把痛楚壓成防線，獲得格檔 ${block}。`);
    }
  },

  _applyPendingExplorerEvasionGain(logs = []) {
    for (const char of G.squad || []) {
      const pending = Math.max(0, Math.floor(char?._evasionChancePending || 0));
      if (!char || char.cls !== 'explorer' || pending <= 0) continue;
      char._evasionChancePending = 0;
      if (char.hp <= 0 || char.dead) continue;
      const result = CombatStatus.addEvasionChance(char, pending);
      if (result.added <= 0) continue;
      logs.push(`探索者：${char.name} 身法成形，閃避率 ${result.before}% → ${result.after}%。`);
    }
  },

  _combatStatusText() {
    if (!G.combat) return '戰鬥尚未開始。';
    if (this._combatItemTargeting()) {
      const idx = G.combat.pendingInventoryItemIndex;
      const slot = String(idx) === 'tutorial_whetstone' ? G.combat.tutorialWhetstone : G.inventory[idx];
      const item = this._inventoryItem(slot);
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
    const entries = (G.inventory || []).map((slot, index) => {
      const item = this._inventoryItem(slot);
      return { index, item, count: slot.count || 1 };
    }).filter(entry => entry.item);
    const tutorialItem = G.combat?.tutorialWhetstone?.item;
    if (tutorialItem) {
      entries.push({
        index: 'tutorial_whetstone',
        item: tutorialItem,
        count: G.combat.tutorialWhetstone.count || 1,
        tutorialItem: true,
      });
    }
    return entries;
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
      maxMissStacks: effect.maxMissStacks || 2,
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
        <p>${attacker.name} 可押注 ${faceCount} 個骰面。押注會持續到取消或改押注，弓的追加攻擊也會沿用。</p>
        <div class="wager-face-grid">${faceButtons}</div>
        <p class="wager-dice-hint">押中：該擊傷害 +${effect.damageBonus || 4}。沒押中：懊悔 +1 層，最多 ${effect.maxMissStacks || 2} 層。</p>
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
    AudioManager?.playSfx?.('dice');

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
    AudioManager?.playSfx?.('dice');
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
    AudioManager?.playSfx?.('dice');
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
    const inCombat = !!G.combat;
    const intent = inCombat ? G.combat.intent : (enemy?._victoryIntent || null);
    const attackerId = attacker?.id || G.combat?.attackerId || null;
    const allowBannerPlanning = inCombat
      && !G.combat.actionInProgress
      && !this._combatItemTargeting()
      && !this._combatGuardTargeting()
      && this._combatTutorialAllows('attack');
    const combatTutorial = this._combatTutorialView();
    const bannerGuideCharId = allowBannerPlanning && this._shouldShowBannerGuide()
      ? (G.squad || []).find(c =>
        c && !c.dead && c.hp > 0 && this._combatBannerSlotsForChar(c, allowBannerPlanning).length > 0
      )?.id || null
      : null;
    return {
      status,
      tutorial: combatTutorial || (bannerGuideCharId ? this._combatBannerGuideView(bannerGuideCharId) : null),
      attackerId,
      intentLabel: intent ? this._combatIntentLabel(intent, enemy) : null,
      intent: this._combatIntentView(intent, enemy),
      enemy: {
        id: enemy.id, name: enemy.name, icon: enemy.icon,
        finalBoss: !!enemy.finalBoss,
        darkMonster: !!enemy.darkMonster,
        echoGuardian: !!enemy.echoGuardian,
        iconImage: enemy.iconImage || null,
        iconFlipX: !!enemy.iconFlipX,
        iconScale: enemy.iconScale || null,
        iconSoftEdge: !!enemy.iconSoftEdge,
        darkMonsterOriginalLevel: enemy.darkMonsterOriginalLevel || 0,
        darkMonsterCombatLevel: enemy.darkMonsterCombatLevel || 0,
        defeated: !inCombat && !!attacker,
        cardBgImage: enemy.cardBgImage || null,
        hideIconInCombat: !!enemy.hideIconInCombat,
        deathSfx: enemy.deathSfx || '',
        deathSfxVolume: enemy.deathSfxVolume,
        attackTrail: enemy.attackTrail || '',
        attackTrailFamily: enemy.attackTrailFamily || '',
        attackSfx: enemy.attackSfx || '',
        attackSfxVolume: enemy.attackSfxVolume,
        damageDieSides: Math.max(0, Math.floor(enemy.damageDieSides || 0)),
        abilities: Array.isArray(enemy.abilities)
          ? enemy.abilities.map(ability => ({ ...ability }))
          : [],
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
            luckyFaces: Array.isArray(enemy.abilityState.fateGamble.luckyFaces)
              ? [...enemy.abilityState.fateGamble.luckyFaces]
              : (enemy.abilityState.fateGamble.luckyFace ? [enemy.abilityState.fateGamble.luckyFace] : []),
            unluckyFaces: Array.isArray(enemy.abilityState.fateGamble.unluckyFaces)
              ? [...enemy.abilityState.fateGamble.unluckyFaces]
              : [],
          }
          : null,
        bannerGuardian: enemy.abilityState?.bannerGuardian
          ? {
            stance: enemy.abilityState.bannerGuardian.stance || 'wound',
            interrupted: !!enemy.abilityState.bannerGuardian.interrupted,
          }
          : null,
        executionCountdown: enemy.abilityState?.executionCountdown
          ? {
            remaining: Math.max(0, enemy.abilityState.executionCountdown.remaining || 0),
            executed: !!enemy.abilityState.executionCountdown.executed,
          }
          : null,
        damageDieSides: Math.max(0, Math.floor(enemy.damageDieSides || 0)) || (['weak', 'medium'].includes(enemy.tier) ? 3 : 0),
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
        evasionChance: CombatStatus.getEvasionChance(c),
        finalEyeIntimidated: this._isFinalEyeIntimidated(c),
        finalEyeIntimidatedUntilRound: c.finalEyeIntimidatedUntilRound || 0,
        dicePollution: c.dicePollution
          ? {
            faces: Array.isArray(c.dicePollution.faces) ? [...c.dicePollution.faces] : [],
            empowered: Math.max(0, c.dicePollution.empowered || 0),
          }
          : null,
        threat: G.combat?.threat?.[c.id] || 0,
        combatItemBadges: this._combatItemBadgesForChar(c),
        bannerSlots: this._combatBannerSlotsForChar(c, allowBannerPlanning),
      })),
    };
  },

  _combatItemBadgesForChar(char) {
    if (!G.combat || !char) return [];
    const badges = [];
    const seen = new Set();
    const pushBadge = (raw, stateType) => {
      if (!raw || raw.sourceCharId !== char.id) return;
      const id = `${stateType}:${raw.sourceItemId || raw.sourceItemName || raw.source || raw.type}`;
      if (seen.has(id)) return;
      seen.add(id);
      badges.push({
        id,
        stateType,
        type: raw.type || '',
        name: raw.sourceItemName || raw.source || '道具',
        icon: raw.sourceItemIcon || '',
        iconImage: raw.sourceItemIconImage || '',
        desc: this._combatItemBadgeDesc(raw),
      });
    };
    for (const mod of G.combatMods || []) pushBadge(mod, 'combat');
    for (const mod of G.rollMods || []) pushBadge(mod, 'roll');
    for (const badge of G.combat.instantItemBadges || []) {
      if (badge?.charId !== char.id || badge.round !== (G.combat.round || 1)) continue;
      const id = `instant:${badge.itemId || badge.name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      badges.push({ ...badge, id, stateType: 'instant' });
    }
    return badges;
  },

  _combatItemBadgeDesc(mod) {
    if (!mod) return '道具效果生效中';
    if (mod.type === 'attack_bonus') return `攻擊骰 +${mod.value}`;
    if (mod.type === 'damage_reduce') return `本次受傷 -${mod.value}`;
    if (mod.type === 'reroll_keep_high') return '下次擲骰重骰取高';
    if (mod.type === 'floor_one') return `下次擲骰 1 視為 ${mod.value}`;
    return '道具效果生效中';
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
    const damageDieSides = Math.max(0, Math.floor(enemy?.damageDieSides || 0));
    const weakDamageDie = damageDieSides > 0 || ['weak', 'medium'].includes(enemy?.tier);
    const damageText = (damage) => weakDamageDie ? `${damage}+骰` : `${damage}`;
    const damageTitleText = (damage) => weakDamageDie ? `${damage}+骰（三面骰）` : `${damage}`;
    const target = {
      targetId: intent.targetId || null,
      targetName: intent.targetName || null,
    };
    if (type === 'attack') {
      if (intent.finalEye) {
        const ability = enemy.abilities?.find(item => item?.type === 'final_boss') || null;
        const darkness = Math.max(0, Math.floor(Number.isFinite(enemy.finalBossDarkness) ? enemy.finalBossDarkness : 0));
        const splash = Math.max(0, CombatRules._finalBossTierValue(ability, darkness, 'splashDamage', ability?.splashDamage || 0));
        const blackLight = Math.max(0, CombatRules._finalBossTierValue(ability, darkness, 'blackLightDamage', 0));
        const eyeDamageBonus = Math.max(0, CombatRules._finalBossTierValue(ability, darkness, 'eyeDamageBonus', 0));
        const eyeDamageText = eyeDamageBonus > 0 ? `+${eyeDamageBonus}` : '';
        const splashText = splash > 0 ? `，其他隊友各受 ${splash} 濺射傷害` : '';
        const blackLightText = blackLight > 0 ? `，全隊各受 ${blackLight} 黑光傷害` : '';
        const intimidateText = darkness >= 15 ? '，若造成實際 HP 傷害，目標下回合無法主戰' : '';
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-single.png',
          text: `${baseAttack}+半骰${eyeDamageText}`,
          title: `黑夜開眼：單體攻擊造成 ${baseAttack}+半個骰數${eyeDamageText} 傷害${splashText}${blackLightText}${intimidateText}`,
        };
      }
      const damage = baseAttack + attackBonus;
      const polluteText = intent.polluteTarget ? '，並污染目標 1 個骰面' : '';
      const damageLabel = damageText(damage);
      const titleDamageLabel = damageTitleText(damage);
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-single.png',
        text: damageLabel,
        title: intent.targetName ? `攻擊 ${intent.targetName}，造成 ${titleDamageLabel} 傷害${polluteText}` : `單體攻擊，造成 ${titleDamageLabel} 傷害${polluteText}`,
      };
    }
    if (type === 'block_attack') {
      const damage = baseAttack + attackBonus;
      const damageLabel = damageText(damage);
      const titleDamageLabel = damageTitleText(damage);
      if (block <= 0) {
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-single.png',
          text: damageLabel,
          title: intent.targetName ? `攻擊 ${intent.targetName}，造成 ${titleDamageLabel} 傷害` : `單體攻擊，造成 ${titleDamageLabel} 傷害`,
        };
      }
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-block-attack.png',
        text: `${damageLabel}/防${block}`,
        title: intent.targetName ? `攻擊 ${intent.targetName}，造成 ${titleDamageLabel} 傷害；行動後格檔 +${block}` : `單體攻擊，造成 ${titleDamageLabel} 傷害；行動後格檔 +${block}`,
      };
    }
    if (type === 'aoe' && intent.polluteRandom) {
      const damage = Math.max(1, baseAttack - 2) + attackBonus;
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-all.png',
          text: `全${damage}`,
          title: `全體攻擊，對全隊造成 ${damage} 傷害，並污染 1 名隊友的骰面`,
        };
    }
    if (type === 'aoe') {
      const poisonDust = Array.isArray(enemy.abilities)
        ? enemy.abilities.find(ability => ability?.type === 'poison_dust')
        : null;
      if (poisonDust) {
        const bonusText = baseAttack + attackBonus > 0 ? `+${baseAttack + attackBonus}` : '';
        const cap = Number.isFinite(poisonDust.maxDamage) ? Math.max(1, poisonDust.maxDamage) : null;
        const capText = cap ? `，最多 ${cap}` : '';
        const weakenedText = enemy.abilityState?.poisonWeakened ? '，已潰散 -1' : '';
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-all.png',
          text: cap ? `骰最多${cap}` : `骰${bonusText}`,
          title: `全體毒粉，造成 骰（三面骰）${bonusText} 傷害${capText}${weakenedText}，最低 1`,
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
      const ability = Array.isArray(enemy.abilities)
        ? enemy.abilities.find(item => item?.type === 'dice_pollution')
        : null;
      const pulseDamage = Math.max(0, ability?.pollutePulseDamage || 0);
      const randomPollutions = 1 + Math.max(0, ability?.extraRandomPollutions || 0);
      const activeText = ability?.polluteActiveAttacker ? '\u4e3b\u6230\u8005\u8207 ' : '';
      if (pulseDamage > 0) {
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-all.png',
          text: `\u5168${pulseDamage}`,
          title: `\u6c61\u67d3\u8108\u885d\uff1a\u5168\u968a\u627f\u53d7 ${pulseDamage} \u50b7\u5bb3\uff0c\u4e26\u6c61\u67d3${activeText}${randomPollutions} \u540d\u96a8\u6a5f\u968a\u53cb\u7684\u9ab0\u9762`,
        };
      }
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-all.png',
        text: '\u6c61\u67d3',
        title: '\u6c61\u67d3 1 \u540d\u968a\u53cb\u7684\u9ab0\u9762\uff0c\u4e0d\u9020\u6210\u50b7\u5bb3',
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
    if (type === 'self_wound') {
      const amount = Math.max(0, intent.amount || 0);
      return {
        type,
        targetSelf: true,
        icon: 'assets/icons/wound-icon.png',
        text: `傷${amount}`,
        title: `撕裂自身：本回合不攻擊，對自己施加 ${amount} 層傷口並自損`,
      };
    }
    if (type === 'dice_attack') {
      if (weakDamageDie) {
        const fixedDamage = baseAttack + attackBonus;
        const fixedText = fixedDamage > 0 ? `${fixedDamage}+` : '';
        const weakLabel = `${fixedText}骰`;
        const weakTitle = `${fixedText}骰（三面骰）`;
        return {
          type,
          ...target,
          icon: 'assets/icons/intent-attack-single.png',
          text: weakLabel,
          title: intent.targetName ? `攻擊 ${intent.targetName}，造成 ${weakTitle} 傷害` : `單體擲骰攻擊，造成 ${weakTitle} 傷害`,
        };
      }
      const bonusText = attackBonus > 0 ? `+${attackBonus}` : '';
      return {
        type,
        ...target,
        icon: 'assets/icons/intent-attack-single.png',
        text: `骰數${bonusText}`,
        title: intent.targetName ? `攻擊 ${intent.targetName}，造成骰數${bonusText}傷害` : `單體擲骰攻擊，造成骰數${bonusText}傷害`,
      };
    }
    if (type === 'worm_coil') {
      const ability = Array.isArray(enemy.abilities) ? enemy.abilities.find(item => item?.type === 'first_strike') : null;
      const coilBlock = Math.max(0, ability?.coilBlock ?? 2);
      const coilBonus = Math.max(0, ability?.coilDamageBonus ?? 1);
      return {
        type,
        ...target,
        icon: 'assets/icons/block-intent-icon-red.png',
        text: `防${coilBlock}/蓄+${coilBonus}`,
        title: `蜷縮蓄勢：本回合不攻擊，格檔 +${coilBlock}，下一次先攻傷害 +${coilBonus}`,
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
