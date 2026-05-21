// Combat victory settlement extracted from combat-flow.js.
const GameCombatVictoryFlow = {
  _handleCombatVictory({ attacker, enemy, cell, reward, source, darkMonsterId, darkMonsterRef, combatResult, roll, rollResult }) {
    this._endWagerDiceAttackFlow();
    enemy._victoryIntent = G.combat?.intent || null;
    this._log(`${attacker.name} 擊敗 ${enemy.name}。`, 'reward');
    const finalHitDesc = this._combatFinalHitDesc(attacker, enemy, combatResult);
    this._applyKillHeal(attacker);

    if (source === 'darkMonsterPassive') {
      this._settleDarkMonsterPassiveVictory(darkMonsterId, darkMonsterRef);
      G.combat = null;
      this._openModal({
        title: '擊退黑暗化身',
        desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n黑暗化身消失，黑暗 -1。`,
        combatLog: combatResult.logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return true;
    }

    if (source === 'darkMonsterActive') {
      const underlyingCell = G.combat.underlyingCell || null;
      this._settleDarkMonsterActiveVictory(darkMonsterId, darkMonsterRef);
      G.combat = null;
      this._openModal({
        title: '主動討伐成功',
        desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n黑暗 -3，其他黑暗化身追殺倒數延後 1 天。`,
        combatLog: combatResult.logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims: this._combatResultAnims(attacker, combatResult, 250),
        dice: this._combatVictoryDice(attacker, roll, rollResult),
        choices: [{ label: '繼續', action: () => this._continueAfterActiveDarkMonsterVictory(underlyingCell) }],
      });
      return true;
    }

    cell.cleared = true;
    const combatReward = reward || cell.content?.reward || (enemy.rescueBoss ? 'rescue' : null);
    const terrainEvent = cell.content?.event || null;
    if (terrainEvent) this._completeProgressEvent(terrainEvent);
    if (terrainEvent?.winSmallReward) {
      G.combat = null;
      this._settleTerrainCombatSmallReward(terrainEvent, enemy, attacker, roll, rollResult, combatResult.logs, this._combatResultAnims(attacker, combatResult, 250));
      return true;
    }

    if (combatReward === 'corrupted') {
      cell.corrupted = false;
      cell.type = 'empty';
      cell.content = null;
    }
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
    if (combatReward === 'dark_gift_mimic') {
      enemy.darkGiftOpened = !!combatResult.darkGiftNativeOpen;
      this._settleDarkGiftMimicVictory(cell, enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, this._combatResultAnims(attacker, combatResult, 250));
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
      this._settleStrongEnemyVictory(enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, source, combatResult);
      return true;
    }

    this._settleStandardCombatVictory(cell, enemy, attacker, roll, rollResult, combatResult.logs, finalHitDesc, combatReward, combatResult);
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
        label: '救出倖存者',
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
    this._openModal({
      title: '強敵戰利品',
      desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n牠的污染殘骸中留下 1 個祈願寶箱。`,
      combatLog: logs,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
      combatAnims: this._combatResultAnims(attacker, combatResult, 250),
      dice: this._combatVictoryDice(attacker, roll, rollResult),
      choices: [{
        label: '收下祈願寶箱',
        action: () => {
          const added = this._awardWishChest(`${enemy.name} 戰利品`);
          if (added) {
            this._closeModal();
            Render.fullRender();
          }
        },
      }],
    });
  },

  _settleStandardCombatVictory(cell, enemy, attacker, roll, rollResult, logs, finalHitDesc, combatReward, combatResult = null) {
    let droppedRelic = null;
    const combatAnims = this._combatResultAnims(attacker, combatResult, 250);
    const canDropRelic = this._canCombatDropRelic(enemy, combatReward);
    const pool = canDropRelic
      ? this._getAvailableRelics(this._relicRewardPoolForPhase())
      : [];
    if (pool.length > 0 && Math.random() < CONFIG.COMBAT_RELIC_DROP_CHANCE) {
      droppedRelic = weightedRelicPick(pool);
      cell.content = { relic: { ...droppedRelic } };
      cell.cleared = false;
      cell.type = 'relic';
      this._log(`${enemy.name} 掉落聖物「${droppedRelic.name}」。`, 'reward');
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
      setTimeout(() => this._triggerRelic(cell), this._combatAnimWaitMs(combatAnims));
      return;
    }
    const dropDesc = droppedRelic
      ? isEventDrop
        ? ''
        : `\n\n掉落聖物「${droppedRelic.name}」，可選擇拾取。`
      : '';
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
          this._closeModal();
          Render.fullRender();
        },
      }],
    });
  },

  _canCombatDropRelic(enemy, combatReward = null) {
    if (!enemy) return false;
    if (enemy.boss || enemy.rescueBoss || enemy.echoGuardian || enemy.treasureMimic || enemy.darkGiftMimic) return false;
    return !['rescue', 'corrupted', 'treasure_mimic', 'dark_gift_mimic', 'echo_site', 'dev_test'].includes(combatReward);
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
