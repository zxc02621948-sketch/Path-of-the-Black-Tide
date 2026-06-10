// Combat retreat methods extracted from combat-flow.js.
const GameCombatRetreat = {
  _canRetreatCombat() {
    const combat = G.combat;
    const enemy = combat?.enemy;
    if (!combat || !enemy) return false;
    if (combat.tutorialCombat || (G.combatTutorial?.active && !G.combatTutorial?.completed)) return false;
    if (enemy.canRetreat) return true;
    if (enemy.darkMonster || enemy.boss || enemy.rescueBoss || enemy.noRetreat || enemy.tier === 'strong') return false;
    if (combat.source === 'darkMonsterPassive' || combat.source === 'darkMonsterActive') return false;
    if (['rescue', 'treasure_mimic', 'warehouse_mimic', 'dark_gift_mimic'].includes(combat.reward)) return false;
    return true;
  },

  _retreatChoiceLabel() {
    const enemy = G.combat?.enemy;
    const intent = G.combat?.intent;
    if (!enemy || !intent) return '撤退（黑暗 +1）';
    if (intent.type === 'attack' || intent.type === 'block_attack') {
      const target = intent.targetName || '目標';
      const damageText = this._retreatIntentDamageText(enemy);
      return `撤退（黑暗 +1，${target} 承受 ${damageText} 傷）`;
    }
    if (intent.type === 'dice_attack') {
      const target = intent.targetName || '目標';
      const damageText = this._retreatIntentDiceText(enemy);
      return `撤退（黑暗 +1，${target} 承受 ${damageText} 傷）`;
    }
    if (intent.type === 'aoe') {
      return `撤退（黑暗 +1，全隊各 ${Math.max(1, (enemy.attack || 0) - 2)} 傷）`;
    }
    if (intent.type === 'worm_coil') return '撤退（黑暗 +1，不受傷）';
    if (intent.type === 'block') return '撤退（黑暗 +1，不受傷）';
    return '撤退（黑暗 +1，承受意圖）';
  },

  _retreatDetailText() {
    const enemy = G.combat?.enemy;
    const intent = G.combat?.intent;
    const lines = ['撤退後黑暗 +1。'];
    if (!enemy || !intent) return lines.join('\n');
    if (intent.type === 'attack' || intent.type === 'block_attack') {
      const target = intent.targetName || '目標';
      lines.push(`${target} 會承受 ${this._retreatIntentDamageText(enemy)} 點傷害。`);
    } else if (intent.type === 'dice_attack') {
      const target = intent.targetName || '目標';
      lines.push(`${target} 會承受 ${this._retreatIntentDiceText(enemy)} 傷害。`);
    } else if (intent.type === 'aoe') {
      lines.push(`全隊各承受 ${Math.max(1, (enemy.attack || 0) - 2)} 點傷害。`);
    } else if (intent.type === 'worm_coil') {
      lines.push('敵人正在蜷縮蓄勢，撤退不會受到傷害。');
    } else if (intent.type === 'block' || intent.type === 'banner_switch') {
      lines.push('敵人正在防禦，撤退不會受到傷害。');
    } else {
      lines.push('撤退時會承受敵人當前意圖。');
    }
    return lines.join('\n');
  },

  _retreatCombat() {
    const logs = this._applyRetreatIntentDamage();
    this._applyDarkness(1, '撤退');
    if (G.phase === 'over') return;
    for (const line of logs) this._log(line, 'danger');
    this._log('隊伍撤退，黑暗逼近。', 'danger');
    this._clearSquadCombatCarryover();
    G.combat = null;
    G.combatMods = [];
    this._closeModal();
    if (this._checkLose()) return;
    Render.fullRender();
  },

  _applyRetreatIntentDamage() {
    const enemy = G.combat?.enemy;
    const intent = G.combat?.intent;
    const logs = [];
    if (!enemy || !intent) return logs;

    if (intent.type === 'attack' || intent.type === 'block_attack') {
      const target = this._retreatIntentTarget(intent) || this._aliveSquad()[0];
      if (target) {
        const die = CombatRules._enemyAttackDamageDie(enemy);
        const rawDamage = Math.max(0, enemy.attack || 0) + die.roll;
        const damage = this._applyRetreatDamage(target, rawDamage);
        logs.push(`${enemy.name} 趁撤退攻擊 ${target.name}，造成 ${damage} 傷害。`);
      }
    } else if (intent.type === 'dice_attack') {
      const target = this._retreatIntentTarget(intent) || this._aliveSquad()[0];
      if (target) {
        const die = CombatRules._enemyAttackDamageDie(enemy);
        const roll = die.roll > 0 ? die.roll : Math.ceil(Math.random() * 6);
        const rawDamage = die.roll > 0 ? Math.max(0, enemy.attack || 0) + roll : roll;
        const damage = this._applyRetreatDamage(target, rawDamage);
        logs.push(`${enemy.name} 趁撤退擲骰攻擊 ${target.name}：${roll}，造成 ${damage} 傷害。`);
      }
    } else if (intent.type === 'aoe') {
      const damage = Math.max(1, (enemy.attack || 0) - 2);
      for (const char of this._aliveSquad()) {
        const dealt = this._applyRetreatDamage(char, damage);
        logs.push(`${enemy.name} 趁撤退波及 ${char.name}，造成 ${dealt} 傷害。`);
      }
    } else if (intent.type === 'block') {
      logs.push(`${enemy.name} 採取防禦，隊伍趁隙撤離。`);
    } else if (intent.type === 'worm_coil') {
      logs.push(`${enemy.name} 蜷縮蓄勢，隊伍趁隙撤離。`);
    }
    this._clearWagerDicePenaltyAfterEnemyFlow(logs);
    return logs;
  },

  _retreatIntentDamageText(enemy) {
    const atk = Math.max(0, enemy?.attack || 0);
    return ['weak', 'medium'].includes(enemy?.tier) ? `${atk}+骰（三面骰）` : `${atk}`;
  },

  _retreatIntentDiceText(enemy) {
    if (!['weak', 'medium'].includes(enemy?.tier)) return '1d6';
    const atk = Math.max(0, enemy?.attack || 0);
    return `${atk > 0 ? `${atk}+` : ''}骰（三面骰）`;
  },

  _retreatIntentTarget(intent) {
    return this._aliveSquad().find(char => char.id === intent?.targetId) || null;
  },

  _applyRetreatDamage(char, amount) {
    let damage = this._reduceIncomingDamage(char, amount, true, true);
    if (CombatStatus.getBlock(char) > 0 && damage > 0) {
      damage = CombatStatus.consumeBlock(char, damage).damage;
    }
    char.hp = Math.max(0, char.hp - damage);
    return damage;
  },

};

Object.assign(Game, GameCombatRetreat);
