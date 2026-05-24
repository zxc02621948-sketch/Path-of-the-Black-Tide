// Extracted from js/core/game.js. Keeps the original object API while making this system easier to maintain.
const GameDarkMonsters = {
  _triggerPendingDarkMonsterChase() {
    if (G.modal || G.phase === 'over' || G.combat) return false;
    const monster = this._nextPendingDarkMonster();
    if (!monster) return false;

    monster.pendingChase = false;
    const enemy = this._darkMonsterEnemy(monster, { activeHunt: false });
    const cell = {
      type: 'enemy',
      cleared: false,
      content: { enemy },
    };
    this._log(`黑暗化身 Lv.${monster.level || 0} 發動被動追殺。`, 'danger');
    this._triggerCombat(cell, {
      source: 'darkMonsterPassive',
      darkMonsterId: monster.id,
      darkMonsterRef: monster,
    });
    return true;
  },

  _triggerActiveDarkMonsterHuntAt(x, y) {
    if (G.modal || G.phase === 'over' || G.combat) return false;
    const monster = this._activeDarkMonsterAt(x, y);
    if (!monster) return false;
    const underlyingCell = G.map?.[y]?.[x] || null;

    const enemy = this._darkMonsterEnemy(monster, { activeHunt: true });
    const cell = {
      type: 'enemy',
      cleared: false,
      content: { enemy },
    };
    const levelNote = enemy.darkMonsterCombatLevel !== enemy.darkMonsterOriginalLevel
      ? `（黑鐵冠：戰鬥等級視為 Lv.${enemy.darkMonsterCombatLevel}）`
      : '';
    this._log(`主動討伐黑暗化身 Lv.${monster.level || 0}${levelNote}。`, 'danger');
    this._triggerCombat(cell, {
      source: 'darkMonsterActive',
      darkMonsterId: monster.id,
      darkMonsterRef: monster,
      underlyingCell,
    });
    return true;
  },

  _continueAfterActiveDarkMonsterVictory(cell) {
    this._closeModal();
    if (!cell || G.phase === 'over') {
      Render.fullRender();
      return;
    }
    if (cell.x !== G.playerX || cell.y !== G.playerY) {
      Render.fullRender();
      return;
    }
    if (this._triggerActiveDarkMonsterHuntAt(cell.x, cell.y)) return;
    if (G.phase === 'night' && cell.corrupted) {
      this._triggerCorruptedAmbush(cell);
      return;
    }
    if (cell.cleared) {
      if (cell.droppedRelics?.length > 0) {
        this._triggerRelic(cell);
        return;
      }
      Render.fullRender();
      return;
    }
    this._triggerCell(cell);
  },

  _activeDarkMonsterAt(x, y) {
    if (!Array.isArray(G.darkMonsters)) return null;
    return G.darkMonsters
      .filter(monster =>
        monster &&
        monster.pendingChase !== true &&
        monster.x === x &&
        monster.y === y
      )
      .sort((a, b) => (b.level || 0) - (a.level || 0))[0] || null;
  },

  _nextPendingDarkMonster() {
    if (!Array.isArray(G.darkMonsters)) return null;
    return G.darkMonsters
      .filter(monster => monster?.pendingChase === true)
      .sort((a, b) => {
        const timerDiff = (a.chaseTimer || 0) - (b.chaseTimer || 0);
        if (timerDiff !== 0) return timerDiff;
        return (b.level || 0) - (a.level || 0);
      })[0] || null;
  },

  _darkMonsterEnemy(monster, opts = {}) {
    const originalLevel = Math.max(0, Number(monster?.level) || 0);
    const combatLevel = opts.activeHunt
      ? this._darkMonsterActiveCombatLevel(originalLevel)
      : originalLevel;
    const enemy = typeof getDarkMonsterEnemy === 'function'
      ? getDarkMonsterEnemy(combatLevel)
      : (typeof randomEnemyForDay === 'function'
        ? randomEnemyForDay(true, Math.max(1, combatLevel))
        : randomEnemy(true));
    const crownNote = combatLevel !== originalLevel
      ? `\n\n\u9ed1\u9435\u51a0\u58d3\u5236\uff1a\u672c\u5834\u6230\u9b25\u8996\u70ba Lv.${combatLevel}\u3002`
      : '';
    return {
      ...enemy,
      id: `dark_monster_${monster.id}`,
      name: `黑暗化身 Lv.${originalLevel}`,
      icon: 'D',
      iconImage: 'assets/enemies/dark-monster-icon.png',
      desc: `從黑暗 ${originalLevel} 中凝結出的化身。牠的強度由生成當下的黑暗層數決定：每 1 層黑暗使生命 +10%，每 5 層黑暗使攻擊 +1。生成後不會因黑暗繼續上升而即時變強。${crownNote}`,
      darkMonster: true,
      darkMonsterOriginalLevel: originalLevel,
      darkMonsterCombatLevel: combatLevel,
      darkMonsterActiveHunt: !!opts.activeHunt,
    };
  },

  _darkMonsterActiveCombatLevel(level) {
    const crown = this._blackIronCrownHolder();
    if (!crown) return level;
    const effect = crown.fusedRelic?.id === 'black_iron_crown'
      ? crown.fusedRelic.effect
      : crown.relic?.effect;
    const reduction = effect?.value || 2;
    const minLevel = effect?.minLevel || 5;
    return Math.max(minLevel, level - reduction);
  },

  _blackIronCrownHolder() {
    return this._aliveSquad().find(char =>
      char.relic?.id === 'black_iron_crown' || char.fusedRelic?.id === 'black_iron_crown'
    ) || null;
  },
  _settleDarkMonsterPassiveVictory(monsterId, monsterRef = null) {
    const before = Math.max(0, Number(G.darkness) || 0);
    const beforeCount = Array.isArray(G.darkMonsters) ? G.darkMonsters.length : 0;
    if (Array.isArray(G.darkMonsters)) {
      G.darkMonsters = G.darkMonsters.filter(monster =>
        monster !== monsterRef && monster?.id !== monsterId
      );
    }
    G.darkness = Math.max(0, before - 1);
    const removed = Array.isArray(G.darkMonsters) && G.darkMonsters.length < beforeCount;
    this._log(`被動追殺勝利：黑暗 ${before} → ${G.darkness}。`, 'reward');
    Render.fullRender();
    return { before, after: G.darkness, removed };
  },

  _settleDarkMonsterActiveVictory(monsterId, monsterRef = null) {
    if (!Array.isArray(G.darkMonsters)) G.darkMonsters = [];
    G.darkMonsters = G.darkMonsters.filter(monster =>
      monster !== monsterRef && monster?.id !== monsterId
    );
    G.darkness = Math.max(0, (Number(G.darkness) || 0) - 3);
    for (const monster of G.darkMonsters) {
      monster.chaseTimer = (monster.chaseTimer || 0) + 1;
      if (monster.pendingChase === true && monster.chaseTimer > 0) {
        monster.pendingChase = false;
      }
    }
    this._log('主動討伐勝利：黑暗 -3，其他黑暗化身追殺倒數 +1。', 'reward');
    Render.fullRender();
  },

  _maybeSpawnDailyDarkMonster() {
    if ((G.darkness || 0) < 5) return false;
    if (!Array.isArray(G.darkMonsters)) G.darkMonsters = [];
    const cell = this._pickDarkMonsterSpawnCell();
    if (!cell) return false;
    G.darkMonsters.push({
      id: `dark_${G.day}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      level: G.darkness,
      x: cell.x,
      y: cell.y,
      chaseTimer: 3,
    });
    return true;
  },

  _maybeSpawnUniqueStrongEnemy() {
    const enemyId = 'dice_corruptor';
    const threshold = CONFIG.UNIQUE_STRONG_ENEMY_DARKNESS || 12;
    if (G.phase !== 'night') return false;
    if ((G.darkness || 0) < threshold) return false;
    if (!Array.isArray(G.spawnedUniqueEnemies)) G.spawnedUniqueEnemies = [];
    if (!Array.isArray(G.defeatedUniqueEnemies)) G.defeatedUniqueEnemies = [];
    if (G.spawnedUniqueEnemies.includes(enemyId) || G.defeatedUniqueEnemies.includes(enemyId)) return false;
    if (this._mapHasEnemy(enemyId)) {
      G.spawnedUniqueEnemies.push(enemyId);
      return false;
    }
    if (typeof getEnemyById !== 'function') return false;
    const enemy = getEnemyById(enemyId);
    if (!enemy) return false;
    const cell = this._pickUniqueStrongSpawnCell();
    if (!cell) return false;
    cell.type = 'enemy';
    cell.revealed = true;
    cell.cleared = false;
    cell.visited = false;
    cell.hiddenSite = null;
    cell.corrupted = false;
    cell.content = { enemy: { ...enemy }, uniqueStrong: true };
    G.spawnedUniqueEnemies.push(enemyId);
    this._log(`黑暗 ${G.darkness}：深污腐骰宿主在遠處現身。`, 'danger');
    return true;
  },

  _mapHasEnemy(enemyId) {
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (cell?.content?.enemy?.id === enemyId && !cell.cleared) return true;
      }
    }
    return false;
  },

  _pickUniqueStrongSpawnCell() {
    const candidates = [];
    const minDistance = CONFIG.DARKNESS_BOSS_MIN_DISTANCE || 5;
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (!cell || cell.type !== 'empty' || cell.content || cell.hiddenSite || cell.cleared) continue;
        if (cell.x === G.playerX && cell.y === G.playerY) continue;
        if (this._darkMonsterOccupies(cell.x, cell.y)) continue;
        if (MapGen.distance(G.playerX, G.playerY, cell.x, cell.y) < minDistance) continue;
        candidates.push(cell);
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) =>
      MapGen.distance(G.playerX, G.playerY, b.x, b.y) -
      MapGen.distance(G.playerX, G.playerY, a.x, a.y)
    );
    return candidates[Math.floor(Math.random() * Math.min(8, candidates.length))];
  },

  _updateDarkMonstersDaily() {
    if (!Array.isArray(G.darkMonsters)) G.darkMonsters = [];
    for (const monster of G.darkMonsters) {
      monster.chaseTimer = (monster.chaseTimer || 0) - 1;
      this._moveDarkMonsterTowardPlayer(monster);
      if (monster.chaseTimer <= 0 || (monster.x === G.playerX && monster.y === G.playerY)) {
        monster.pendingChase = true;
      }
    }
  },

  _moveDarkMonsterTowardPlayer(monster) {
    const dx = Math.sign(G.playerX - monster.x);
    const dy = Math.sign(G.playerY - monster.y);
    const preferX = Math.abs(G.playerX - monster.x) >= Math.abs(G.playerY - monster.y);
    const attempts = preferX
      ? [[dx, 0], [0, dy]]
      : [[0, dy], [dx, 0]];
    for (const [stepX, stepY] of attempts) {
      if (stepX === 0 && stepY === 0) continue;
      const nx = monster.x + stepX;
      const ny = monster.y + stepY;
      if (!this._isValidDarkMonsterCell(nx, ny)) continue;
      if (this._darkMonsterOccupies(nx, ny, monster)) continue;
      monster.x = nx;
      monster.y = ny;
      return true;
    }
    return false;
  },

  _isValidDarkMonsterCell(x, y) {
    return !!G.map?.[y]?.[x];
  },

  _darkMonsterOccupies(x, y, except = null) {
    if (!Array.isArray(G.darkMonsters)) return false;
    return G.darkMonsters.some(monster =>
      monster &&
      monster !== except &&
      monster.x === x &&
      monster.y === y
    );
  },

  _pickDarkMonsterSpawnCell() {
    const candidates = [];
    for (const row of (G.map || [])) {
      for (const cell of row || []) {
        if (!cell) continue;
        if (cell.x === G.playerX && cell.y === G.playerY) continue;
        if (this._darkMonsterOccupies(cell.x, cell.y)) continue;
        candidates.push(cell);
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  },
};

Object.assign(Game, GameDarkMonsters);
