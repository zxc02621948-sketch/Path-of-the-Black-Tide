// 地圖生成
const MapGen = {
  generate(isNight) {
    const size = CONFIG.MAP_SIZE;
    const grid = [];

    // Create the base map grid first; renderMap expects every row/cell to exist.
    for (let y = 0; y < size; y++) {
      grid[y] = [];
      for (let x = 0; x < size; x++) {
        grid[y][x] = this._emptyCell(x, y);
      }
    }

    const positions = [];
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    const altarPositions = this._altarPositions(size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x === cx && y === cy) continue;
        if (altarPositions.some(p => p.x === x && p.y === y)) continue;
        positions.push({ x, y });
      }
    }
    this._shuffle(positions);

    let idx = 0;

    const terrainCounts = {
      forest: CONFIG.MAP_FORESTS,
      ruins: CONFIG.MAP_RUINS,
      cave: CONFIG.MAP_CAVES,
    };
    for (const [type, count] of Object.entries(terrainCounts)) {
      for (let i = 0; i < count && idx < positions.length; i++, idx++) {
        const { x, y } = positions[idx];
        grid[y][x].type = type;
      }
    }

    for (let i = 0; i < altarPositions.length; i++) {
      const { x, y } = altarPositions[i];
      if (i === 0) {
        grid[y][x].type = 'altar';
        grid[y][x].altarHidden = false;
        grid[y][x].altarUsedDay = 0;
      } else {
        grid[y][x].hiddenSite = { type: 'altar', altarUsedDay: 0 };
      }
    }

    const restPlaced = [];
    const MIN_REST_DIST = CONFIG.MAP_REST_MIN_DISTANCE;
    for (let attempt = 0; attempt < positions.length && restPlaced.length < CONFIG.MAP_REST_POINTS; attempt++) {
      if (idx >= positions.length) break;
      const { x, y } = positions[idx++];
      const tooClose = restPlaced.some(r => Math.abs(r.x - x) + Math.abs(r.y - y) < MIN_REST_DIST);
      if (tooClose) continue;
      grid[y][x].type = 'rest';
      restPlaced.push({ x, y });
    }

    const dayRelicPool = getDayRelics();
    const relicPlaced = [];
    const MIN_RELIC_DIST = CONFIG.MAP_RELIC_MIN_DISTANCE;
    for (let attempt = 0; attempt < positions.length && relicPlaced.length < CONFIG.MAP_RELIC_SPOTS; attempt++) {
      if (idx >= positions.length || dayRelicPool.length === 0) break;
      const { x, y } = positions[idx++];
      const tooClose = relicPlaced.some(r => Math.abs(r.x - x) + Math.abs(r.y - y) < MIN_RELIC_DIST);
      if (tooClose) continue;
      const relic = weightedRelicPick(dayRelicPool);
      grid[y][x].type = 'relic';
      grid[y][x].content = relic ? { relic: { ...relic } } : null;
      relicPlaced.push({ x, y });
    }

    const rescueBossPlaced = [];
    const MIN_RESCUE_BOSS_DIST = CONFIG.MAP_RESCUE_BOSS_MIN_DISTANCE;
    for (let attempt = 0; attempt < positions.length && rescueBossPlaced.length < CONFIG.MAP_RESCUE_BOSSES; attempt++) {
      if (idx >= positions.length) break;
      const { x, y } = positions[idx++];
      const tooCloseToStart = this.distance(x, y, cx, cy) < MIN_RESCUE_BOSS_DIST;
      const tooCloseToBoss = rescueBossPlaced.some(r => this.distance(r.x, r.y, x, y) < MIN_RESCUE_BOSS_DIST);
      if (tooCloseToStart || tooCloseToBoss) continue;
      grid[y][x].hiddenSite = {
        type: 'rescue',
        content: {
          enemy: getRescueBossEnemy(),
          reward: 'rescue',
        },
      };
      rescueBossPlaced.push({ x, y });
    }

    for (let i = 0; i < CONFIG.MAP_ENEMY_SPOTS; i++) {
      if (idx >= positions.length) break;
      const { x, y } = positions[idx++];
      grid[y][x].type = 'enemy';
      grid[y][x].content = { enemy: randomEnemy(false) };
    }

    const EMPTY_EVENT_CHANCE = 0.30;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = grid[y][x];
        if (['forest', 'ruins', 'cave'].includes(cell.type)) {
          cell.content = { eventPending: true };
        } else if (cell.type === 'empty' && !cell.content && !cell.hiddenSite && Math.random() < EMPTY_EVENT_CHANCE) {
          cell.content = { eventPending: true };
        }
      }
    }

    this._ensureOpeningArea(grid, cx, cy);

    // Initial reveal is handled by game.js.
    return grid;
  },

  _emptyCell(x, y) {
    return {
      type: 'empty',
      x, y,
      revealed: false,
      cleared: false,
      visited: false,
      content: null,
    };
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // 計算兩格的曼哈頓距離

  _altarPositions(size) {
    const count = CONFIG.MAP_ALTARS || 2;
    const minDistance = CONFIG.MAP_ALTAR_MIN_DISTANCE || 7;
    const minStartDistance = CONFIG.MAP_ALTAR_MIN_START_DISTANCE || 4;
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    const candidates = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x === cx && y === cy) continue;
        if (this.distance(x, y, cx, cy) < minStartDistance) continue;
        candidates.push({ x, y });
      }
    }
    this._shuffle(candidates);

    for (let requiredDistance = minDistance; requiredDistance >= 1; requiredDistance--) {
      const valid = [];
      for (const p of candidates) {
        if (valid.every(existing => this.distance(existing.x, existing.y, p.x, p.y) >= requiredDistance)) {
          valid.push(p);
        }
        if (valid.length >= count) return valid;
      }
    }
    return candidates.slice(0, count);
  },

  _ensureOpeningArea(grid, cx, cy) {
    const opening = [];
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (x === cx && y === cy) continue;
        const dist = this.distance(x, y, cx, cy);
        if (dist >= 1 && dist <= 2) opening.push(grid[y][x]);
      }
    }
    const isInteractive = cell => ['forest', 'ruins', 'cave', 'enemy', 'rest'].includes(cell.type) || !!cell.content?.eventPending;
    const terrainTypes = new Set(opening.filter(cell => ['forest', 'ruins', 'cave'].includes(cell.type)).map(cell => cell.type));
    const interactiveCount = opening.filter(isInteractive).length;
    if (interactiveCount >= 3 && terrainTypes.size >= 2) return;

    const desiredTerrains = ['forest', 'ruins', 'cave'].filter(type => !terrainTypes.has(type));
    const targetEmpty = opening.filter(cell => cell.type === 'empty' && !cell.content && !cell.hiddenSite);
    let targetIndex = 0;

    const swapIntoOpening = sourceCell => {
      const target = targetEmpty[targetIndex++];
      if (!target || !sourceCell) return false;
      const sourceType = sourceCell.type;
      const sourceContent = sourceCell.content || null;
      const sourceHiddenSite = sourceCell.hiddenSite || null;
      sourceCell.type = target.type;
      sourceCell.content = target.content || null;
      sourceCell.hiddenSite = target.hiddenSite || null;
      target.type = sourceType;
      target.content = sourceContent;
      target.hiddenSite = sourceHiddenSite;
      return true;
    };

    for (const type of desiredTerrains) {
      const source = this._findOpeningSwapSource(grid, opening, cell => cell.type === type);
      swapIntoOpening(source);
    }

    while (opening.filter(isInteractive).length < 3) {
      const source = this._findOpeningSwapSource(grid, opening, isInteractive);
      if (!swapIntoOpening(source)) break;
    }
  },

  _findOpeningSwapSource(grid, opening, predicate) {
    const openingSet = new Set(opening);
    const candidates = [];
    for (const row of grid) {
      for (const cell of row) {
        if (openingSet.has(cell)) continue;
        if (cell.revealed) continue;
        if (cell.hiddenSite) continue;
        if (predicate(cell)) candidates.push(cell);
      }
    }
    this._shuffle(candidates);
    return candidates[0] || null;
  },

  distance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  },

  // 取得四方向相鄰格
  neighbors(x, y, grid) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    const result = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < CONFIG.MAP_SIZE && ny >= 0 && ny < CONFIG.MAP_SIZE) {
        result.push(grid[ny][nx]);
      }
    }
    return result;
  },

  isAdjacent(x1, y1, x2, y2) {
    return this.distance(x1, y1, x2, y2) === 1;
  },
};
