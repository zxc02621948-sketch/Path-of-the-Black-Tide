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

    for (const { x, y } of altarPositions) {
      grid[y][x].hiddenSite = { type: 'altar', altarUsedDay: 0 };
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
      reserved: false,
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
    const configured = Array.isArray(CONFIG.MAP_ALTAR_POSITIONS) ? CONFIG.MAP_ALTAR_POSITIONS : [];
    const valid = [];
    for (const p of configured
      .filter(p => Number.isInteger(p.x) && Number.isInteger(p.y))
      .filter(p => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size)) {
      if (valid.every(existing => this.distance(existing.x, existing.y, p.x, p.y) >= minDistance)) {
        valid.push(p);
      }
      if (valid.length >= count) break;
    }
    if (valid.length >= count) return valid;
    for (const fallback of [
      { x: 2, y: 2 },
      { x: size - 3, y: size - 3 },
    ]) {
      if (fallback.x >= 0 && fallback.y >= 0 && fallback.x < size && fallback.y < size &&
          valid.every(existing => this.distance(existing.x, existing.y, fallback.x, fallback.y) >= minDistance)) {
        valid.push(fallback);
      }
      if (valid.length >= count) break;
    }
    return valid.slice(0, count);
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
