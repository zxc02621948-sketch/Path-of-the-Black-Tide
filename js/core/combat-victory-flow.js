// Combat victory settlement extracted from combat-flow.js.
const GameCombatVictoryFlow = {
  _handleCombatVictory({ attacker, enemy, cell, reward, source, darkMonsterId, darkMonsterRef, combatResult, roll, rollResult }) {
    this._endWagerDiceAttackFlow();
    const resolvedSource = source === 'darkMonsterActive' || source === 'darkMonsterPassive'
      ? source
      : (enemy?.darkMonster
      ? (enemy.darkMonsterActiveHunt ? 'darkMonsterActive' : 'darkMonsterPassive')
      : source);
    const resolvedDarkMonsterId = darkMonsterId || G.combat?.darkMonsterId || null;
    const resolvedDarkMonsterRef = darkMonsterRef || G.combat?.darkMonsterRef || null;
    enemy._victoryIntent = G.combat?.intent || null;
    this._log(`${attacker.name} 擊敗 ${enemy.name}。`, 'reward');
    const finalHitDesc = this._combatFinalHitDesc(attacker, enemy, combatResult);
    this._applyKillHeal(attacker);

    if (resolvedSource === 'darkMonsterPassive') {
      const darkResult = this._settleDarkMonsterPassiveVictory(resolvedDarkMonsterId, resolvedDarkMonsterRef);
      const enemyName = enemy.name;
      this._clearSquadCombatCarryover();
      G.combat = null;
      this._openModal({
        title: `${enemy.name} 被擊敗`,
        desc: [
          `${enemy.name} 被擊敗。`,
          finalHitDesc,
        ].join('\n\n'),
        combatLog: combatResult.logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '繼續', action: () => this._openPassiveDarkMonsterVictoryEvent(enemyName, darkResult) }],
      });
      return true;
    }

    if (resolvedSource === 'darkMonsterActive') {
      const underlyingCell = G.combat.underlyingCell || null;
      const nativeWeaknessBreak = !!G.combat.darkMonsterNativeWeaknessBreak;
      const darkResult = this._settleDarkMonsterActiveVictory(resolvedDarkMonsterId, resolvedDarkMonsterRef, { nativeWeaknessBreak });
      const weaknessRewardLine = darkResult.nativeBonus > 0
        ? '本場命中並擊破原生弱點，額外壓制黑暗 -1。'
        : '若主動討伐時命中並擊破原生弱點，可額外壓制黑暗 -1。';
      const levelRewardLine = darkResult.levelBonus > 0
        ? `黑暗化身 Lv.${darkResult.monsterLevel} 達到 Lv.10+，主動追擊額外壓制黑暗 -1。`
        : 'Lv.10 以上的黑暗化身主動討伐成功時，會再額外壓制黑暗 -1。';
      const enemyName = enemy.name;
      this._clearSquadCombatCarryover();
      G.combat = null;
      this._openModal({
        title: `${enemy.name} 被擊敗`,
        desc: [
          `${enemy.name} 被擊敗。`,
          finalHitDesc,
        ].join('\n\n'),
        combatLog: combatResult.logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{
          label: '繼續',
          action: () => this._openActiveDarkMonsterVictoryEvent(enemyName, darkResult, weaknessRewardLine, levelRewardLine, underlyingCell),
        }],
      });
      return true;
    }

    cell.cleared = true;
    const combatReward = reward || cell.content?.reward || (enemy.rescueBoss ? 'rescue' : null);
    const terrainEvent = cell.content?.event || null;
    if (terrainEvent) this._completeProgressEvent(terrainEvent);
    if (combatReward === 'corrupted') {
      cell.corrupted = false;
      cell.type = 'empty';
      cell.content = null;
    }
    this._clearSquadCombatCarryover();
    G.combat = null;

    if (source !== 'devTest' && (combatReward === 'final_boss' || enemy.finalBoss)) {
      G.finalBossDefeated = true;
      this._openModal({
        title: '黎明破曉',
        desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n夜幕之瞳碎裂，第一道真正的光落在邊境上。`,
        combatLog: combatResult.logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '迎接黎明', action: () => this._endGame('dawn') }],
      });
      return true;
    }

    if (combatReward === 'rescue') {
      this._settleRescueCombatVictory(enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, combatResult);
      return true;
    }

    if (combatReward === 'corrupted') {
      const desc = `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n這片腐化區域被清理。`;
      this._openModal({
        title: '戰鬥勝利',
        desc,
        combatLog: combatResult.logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return true;
    }

    if (combatReward === 'treasure_mimic') {
      this._settleTreasureMimicVictory(cell, enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, this._combatResultAnims(attacker, combatResult, 250));
      return true;
    }
    if (combatReward === 'warehouse_mimic') {
      this._settleWarehouseMimicVictory(cell, enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, this._combatResultAnims(attacker, combatResult, 250));
      return true;
    }
    if (combatReward === 'dark_gift_mimic') {
      enemy.darkGiftOpened = !!combatResult.darkGiftNativeOpen;
      this._settleDarkGiftMimicVictory(cell, enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, this._combatResultAnims(attacker, combatResult, 250));
      return true;
    }
    if (combatReward === 'fallen_traveler') {
      this._settleFallenTravelerVictory(cell, enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, this._combatResultAnims(attacker, combatResult, 250));
      return true;
    }
    if (combatReward === 'echo_site') {
      this._settleEchoSiteVictory(cell, enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, this._combatResultAnims(attacker, combatResult, 250));
      return true;
    }
    if (combatReward === 'dev_test') {
      this._openModal({
        title: '測試戰鬥結束',
        desc: `${enemy.name} 已被擊敗。\n${finalHitDesc}\n\n測試戰鬥不會結算地圖格獎勵。`,
        combatLog: combatResult.logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return true;
    }

    if (enemy.tier === 'strong') {
      this._settleStrongEnemyVictory(enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, resolvedSource, combatResult);
      return true;
    }

    this._settleStandardCombatVictory(cell, enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, combatReward, combatResult, terrainEvent);
    return true;
  },

  _combatVictoryDice(attacker, roll, rollResult) {
    return {
      type: 'combat',
      label: `${attacker.name} 攻擊骰`,
      value: roll,
      raw: rollResult.raw,
      floored: rollResult.floored,
      charCls: rollResult.charCls,
      sides: rollResult.sides,
      dodecaFateDice: rollResult.dodecaFateDice,
      dodecaLuckyDice: rollResult.dodecaLuckyDice,
    };
  },

  _openPassiveDarkMonsterVictoryEvent(enemyName, darkResult) {
    this._openModal({
      title: '黑暗暫退',
      desc: [
        `${enemyName} 的形體在霧中崩散。`,
        '你們暫時擊退了黑暗化身，但牠早已準備好退路，潛入黑霧等待下一次追獵。',
        `黑暗值不變（${darkResult.before} → ${darkResult.after}）。`,
        darkResult.willRespawn ? '明天，牠會在別處重新潛伏並繼續追殺。' : '',
        '只有主動出擊才能有效延遲黑暗襲擊，並抑制黑暗增長。',
      ].filter(Boolean).join('\n\n'),
      resultFx: 'event-quiet',
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _openActiveDarkMonsterVictoryEvent(enemyName, darkResult, weaknessRewardLine, levelRewardLine, underlyingCell) {
    this._openModal({
      title: '主動討伐成功',
      desc: [
        `${enemyName} 的黑霧被你們撕開，殘影向後退入更深的夜色。`,
        '你們沒有等黑暗逼近，而是反過來撕開它的形體。',
        `黑暗 ${darkResult.before} → ${darkResult.after}（-${darkResult.reduction}）。`,
        weaknessRewardLine,
        levelRewardLine,
        '其他黑暗化身追殺倒數延後 1 天。',
      ].join('\n\n'),
      resultFx: 'event-quiet',
      choices: [{ label: '繼續', action: () => this._continueAfterActiveDarkMonsterVictory(underlyingCell) }],
    });
  },

  _applyKillHeal(attacker) {
    const killHeal = attacker.fusedRelic?.effect?.type === 'kill_heal'
      ? attacker.fusedRelic.effect.fusedValue
      : (attacker.relic?.effect?.type === 'kill_heal' ? attacker.relic.effect.value : 0);
    if (killHeal <= 0 || attacker.hp <= 0 || attacker.hp >= attacker.maxHp) return;
    const before = attacker.hp;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + killHeal);
    this._log(`${attacker.name} 恢復 ${attacker.hp - before} HP。`, 'reward');
  },

  _settleRescueCombatVictory(enemy, attacker, roll, rollResult, logs, finalHitDesc, combatResult = null) {
    if (enemy.rescueExecuted) {
      this._openModal({
        title: '救援失敗',
        desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n你們打倒了看守，但牢中的倖存者已被處刑。`,
        combatLog: logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    if (!this._needsRescue()) {
      for (const char of this._aliveSquad()) char.hp = Math.min(char.maxHp, char.hp + 1);
      this._openModal({
        title: '戰鬥勝利',
        desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n隊伍暫時不需要救援，全隊恢復 1 HP。`,
        combatLog: logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }
    this._openModal({
      title: '戰鬥勝利',
      desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n你們找到倖存者的線索。`,
      combatLog: logs,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
      combatAnims: this._combatResultAnims(attacker, combatResult, 250),
      dice: this._combatVictoryDice(attacker, roll, rollResult),
      choices: [{
        label: '繼續',
        action: () => {
          this._closeModal();
          this._triggerRescue({
            name: '受困的倖存者',
            desc: '倖存者被困在黑暗邊境深處，仍保有加入隊伍的意志。',
          });
        },
      }],
    });
  },

  _settleStrongEnemyVictory(enemy, attacker, roll, rollResult, logs, finalHitDesc, source, combatResult = null) {
    if (enemy.unique && source !== 'devTest') {
      if (!Array.isArray(G.defeatedUniqueEnemies)) G.defeatedUniqueEnemies = [];
      if (!G.defeatedUniqueEnemies.includes(enemy.id)) G.defeatedUniqueEnemies.push(enemy.id);
    }
    const combatAnims = this._combatResultAnims(attacker, combatResult, 250);
    this._openModal({
      title: '強敵戰利品',
      desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n牠的污染殘骸中留下 1 個祈願寶箱。`,
      combatLog: logs,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
      combatAnims,
      dice: this._combatVictoryDice(attacker, roll, rollResult),
      choices: [],
    });
    setTimeout(() => this._openWishChestLootModal(`${enemy.name} 戰利品`, logs), this._combatAnimWaitMs(combatAnims));
  },

  _settleStandardCombatVictory(cell, enemy, attacker, roll, rollResult, logs, finalHitDesc, combatReward, combatResult = null, terrainEvent = null) {
    let droppedRelic = null;
    const combatAnims = this._combatResultAnims(attacker, combatResult, 250);
    const canDropRelic = this._canCombatDropRelic(enemy, combatReward);
    const tutorialDrop = this._shouldGuaranteeCombatTutorialRelic(enemy, combatReward);
    const pool = canDropRelic || tutorialDrop
      ? this._getAvailableRelics(this._relicRewardPoolForPhase())
      : [];
    const dropChance = this._combatRelicDropChance(enemy);
    if (pool.length > 0 && (tutorialDrop || Math.random() < dropChance)) {
      droppedRelic = tutorialDrop ? this._pickGuideTutorialRelic(pool) : weightedRelicPick(pool);
      cell.content = { relic: { ...droppedRelic } };
      cell.cleared = false;
      cell.type = 'relic';
      if (tutorialDrop && G.combatTutorial) {
        G.combatTutorial.guaranteedRelicDropped = true;
        this._markCombatTutorialCompleted?.();
      }
      const dropPrefix = tutorialDrop ? '教學戰鬥獎勵' : `${enemy.name} 掉落聖物`;
      this._log(`${dropPrefix}「${droppedRelic.name}」。`, 'reward');
    }

    const isEventDrop = droppedRelic?.eventOnly;
    if (droppedRelic && !isEventDrop) {
      this._openModal({
        title: '戰鬥勝利',
        desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n掉落聖物「${droppedRelic.name}」，可選擇拾取。`,
        combatLog: logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims,
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [],
      });
      setTimeout(() => {
        this._openCombatVictoryTutorialIfNeeded(() => this._triggerRelic(cell));
      }, this._combatAnimWaitMs(combatAnims));
      return;
    }
    const dropDesc = droppedRelic
      ? isEventDrop
        ? ''
        : `\n\n掉落聖物「${droppedRelic.name}」，可選擇拾取。`
      : '';
    if (!droppedRelic && terrainEvent?.winSmallReward) {
      this._settleTerrainCombatSmallReward(terrainEvent, enemy, attacker, roll, rollResult, logs, combatAnims);
      return;
    }
    this._openModal({
      title: '戰鬥勝利',
      desc: `${enemy.name} 被擊敗。\n${finalHitDesc}${dropDesc}`,
      combatLog: logs,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
      combatAnims,
      dice: this._combatVictoryDice(attacker, roll, rollResult),
      choices: [{
        label: '繼續',
        action: () => {
          this._openCombatVictoryTutorialIfNeeded(() => {
            this._closeModal();
            Render.fullRender();
          });
        },
      }],
    });
  },

  _settleFallenTravelerVictory(cell, enemy, attacker, roll, rollResult, logs, finalHitDesc, combatAnims) {
    const weapon = randomWeaponForSquad(G.squad);
    if (!weapon) {
      cell.type = 'empty';
      cell.content = null;
      cell.cleared = true;
      this._openModal({
        title: '倒下的旅人',
        desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n你們從旅人身邊取回他的遺物，卻已經沒有你們用得上的武器了。`,
        combatLog: logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims,
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }
    const reward = { type: 'weapon', label: '武器', ...weapon };
    this._log(`倒下的旅人留下武器「${weapon.name}」。`, 'reward');
    this._openModal({
      title: '倒下的旅人',
      desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n守在屍體旁的威脅散去，旅人手裡的武器終於能取下。`,
      combatLog: logs,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
      combatAnims,
      dice: this._combatVictoryDice(attacker, roll, rollResult),
      choices: [],
    });
    setTimeout(() => this._openDarkGiftRewardAssignModal(cell, reward, logs, '倒下的旅人'), this._combatAnimWaitMs(combatAnims));
  },

  _openCombatVictoryTutorialIfNeeded(onDone = null) {
    const tutorial = G.combatTutorial || null;
    if (!tutorial?.firstCombatStarted || tutorial.victoryHintShown) {
      if (typeof onDone === 'function') onDone();
      return false;
    }
    tutorial.victoryHintShown = true;
    const relicLine = tutorial.guaranteedRelicDropped
      ? '這場教學戰鬥留下了一件聖物。聖物能大幅改變或強化隊伍能力，是提高存活機率的關鍵。'
      : '戰鬥結束後，有機會取得能大幅改變或強化隊伍能力的聖物。聖物是提高存活機率的關鍵。';
    this._openModal({
      title: '戰鬥教學：黑夜會變強',
      desc: [
        '這只是開始。',
        '隨著天數推進，黑夜會越來越深，怪物也會逐漸變強。',
        `${relicLine}它們不是單純的獎勵，而是撐到最後的生存手段。`,
        '抓緊時間探索，取得聖物、裝備與共鳴。',
        '除了戰鬥，森林、遺跡、洞穴等地形事件也可能找到聖物。',
      ].join('\n\n'),
      tutorialModal: true,
      choices: [{
        label: '繼續',
        action: () => {
          if (typeof onDone === 'function') onDone();
        },
      }],
    });
    return true;
  },

  _shouldGuaranteeCombatTutorialRelic(enemy, combatReward = null) {
    const tutorial = G.combatTutorial || null;
    if (this._isCombatTutorialCompleted?.()) return false;
    if (!tutorial?.firstCombatStarted || tutorial.victoryHintShown || tutorial.guaranteedRelicDropped) return false;
    if (enemy?.id !== 'shadow_worm') return false;
    return this._canCombatDropRelic(enemy, combatReward);
  },

  _canCombatDropRelic(enemy, combatReward = null) {
    if (!enemy) return false;
    if (enemy.boss || enemy.rescueBoss || enemy.echoGuardian || enemy.treasureMimic || enemy.darkGiftMimic) return false;
    return !['rescue', 'corrupted', 'treasure_mimic', 'warehouse_mimic', 'dark_gift_mimic', 'echo_site', 'dev_test'].includes(combatReward);
  },

  _combatRelicDropChance(enemy) {
    const tier = enemy?.tier;
    if (!['weak', 'medium'].includes(tier)) return CONFIG.COMBAT_RELIC_DROP_CHANCE || 0;
    const table = Array.isArray(CONFIG.COMBAT_RELIC_DROP_CHANCES) ? CONFIG.COMBAT_RELIC_DROP_CHANCES : [];
    const day = Math.max(1, G.day || 1);
    let active = null;
    for (const row of table) {
      if (day >= (row.minDay || 1)) active = row;
    }
    if (!active || !Number.isFinite(active[tier])) return CONFIG.COMBAT_RELIC_DROP_CHANCE || 0;
    return Math.max(0, Math.min(1, active[tier]));
  },

  _combatAnimWaitMs(combatAnims = null) {
    if (!combatAnims) return 0;
    const delay = Number.isFinite(combatAnims.delay) ? combatAnims.delay : 120;
    const playerDamageEvents = Array.isArray(combatAnims.playerDamageEvents) ? combatAnims.playerDamageEvents : [];
    const playerFollowHits = Math.max(0, combatAnims.playerFollowHits || 0, playerDamageEvents.length);
    const guardBlock = Math.max(0, combatAnims.guardBlock || 0);
    const enemyBlock = combatAnims.enemyBlock ? 220 : 0;
    const hasCombatAnim = playerFollowHits > 0 || guardBlock > 0 || !!(combatAnims.counterTarget || combatAnims.aoe || combatAnims.enemyBlock);
    if (!hasCombatAnim) return delay;
    return delay + (guardBlock > 0 ? 260 : 0) + playerFollowHits * 380 + enemyBlock + 760;
  },
};

Object.assign(Game, GameCombatVictoryFlow);
