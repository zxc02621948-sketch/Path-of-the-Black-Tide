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

    const terrainCounts = {
      forest: CONFIG.MAP_FORESTS,
      ruins: CONFIG.MAP_RUINS,
      cave: CONFIG.MAP_CAVES,
    };
    const terrainPlaced = [];
    const terrainPlacedByType = { forest: [], ruins: [], cave: [] };
    for (const [type, count] of Object.entries(terrainCounts)) {
      for (let i = 0; i < count; i++) {
        const picked = this._takeSpreadPosition(positions, {
          same: terrainPlacedByType[type],
          all: terrainPlaced,
          size,
          sameWeight: 8,
          allWeight: 1.5,
          sectorWeight: 6,
        });
        if (!picked) break;
        const { x, y } = picked;
        grid[y][x].type = type;
        terrainPlaced.push({ x, y });
        terrainPlacedByType[type].push({ x, y });
      }
    }

    for (let i = 0; i < altarPositions.length; i++) {
      const { x, y } = altarPositions[i];
      if (i === 0) {
        grid[y][x].type = 'altar';
        grid[y][x].revealed = true;
        grid[y][x].altarHidden = false;
        grid[y][x].altarUsedDay = 0;
      } else {
        grid[y][x].hiddenSite = { type: 'altar', altarUsedDay: 0 };
      }
    }

    const restPlaced = [];
    const MIN_REST_DIST = CONFIG.MAP_REST_MIN_DISTANCE;
    while (restPlaced.length < CONFIG.MAP_REST_POINTS) {
      const picked = this._takeSpreadPosition(positions, {
        same: restPlaced,
        all: [{ x: cx, y: cy }],
        minSameDistance: MIN_REST_DIST,
        minStartDistance: 3,
        cx,
        cy,
        size,
        sameWeight: 10,
        allWeight: 2,
        sectorWeight: 8,
      });
      if (!picked) break;
      const { x, y } = picked;
      grid[y][x].type = 'rest';
      restPlaced.push({ x, y });
    }

    const dayRelicPool = getDayRelics();
    const relicPlaced = [];
    const MIN_RELIC_DIST = CONFIG.MAP_RELIC_MIN_DISTANCE;
    while (relicPlaced.length < CONFIG.MAP_RELIC_SPOTS && dayRelicPool.length > 0) {
      const picked = this._takeSpreadPosition(positions, {
        same: relicPlaced,
        minSameDistance: MIN_RELIC_DIST,
        size,
        sameWeight: 10,
        sectorWeight: 8,
      });
      if (!picked) break;
      const { x, y } = picked;
      const relic = weightedRelicPick(dayRelicPool);
      grid[y][x].type = 'relic';
      grid[y][x].content = relic ? { relic: { ...relic } } : null;
      relicPlaced.push({ x, y });
    }

    const rescueBossPlaced = [];
    const MIN_RESCUE_BOSS_DIST = CONFIG.MAP_RESCUE_BOSS_MIN_DISTANCE;
    while (rescueBossPlaced.length < CONFIG.MAP_RESCUE_BOSSES) {
      const picked = this._takeSpreadPosition(positions, {
        same: rescueBossPlaced,
        minSameDistance: MIN_RESCUE_BOSS_DIST,
        minStartDistance: MIN_RESCUE_BOSS_DIST,
        cx,
        cy,
        size,
        sameWeight: 10,
        sectorWeight: 8,
      });
      if (!picked) break;
      const { x, y } = picked;
      grid[y][x].hiddenSite = {
        type: 'rescue',
        content: {
          enemy: getRescueBossEnemy(),
          reward: 'rescue',
        },
      };
      rescueBossPlaced.push({ x, y });
    }

    const enemyPlaced = [];
    for (let i = 0; i < CONFIG.MAP_ENEMY_SPOTS; i++) {
      const picked = this._takeSpreadPosition(positions, {
        same: enemyPlaced,
        all: [{ x: cx, y: cy }],
        minStartDistance: 2,
        cx,
        cy,
        size,
        sameWeight: 8,
        allWeight: 1,
        sectorWeight: 7,
      });
      if (!picked) break;
      const { x, y } = picked;
      grid[y][x].type = 'enemy';
      grid[y][x].content = { enemy: randomEnemy(false), scaleWithDay: true };
      enemyPlaced.push({ x, y });
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

  _takeSpreadPosition(positions, options = {}) {
    if (!positions?.length) return null;
    const {
      same = [],
      all = [],
      minSameDistance = 0,
      minStartDistance = 0,
      cx = null,
      cy = null,
      size = CONFIG.MAP_SIZE,
      sameWeight = 8,
      allWeight = 2,
      sectorWeight = 6,
      filter = null,
    } = options;

    const passes = p => {
      if (filter && !filter(p)) return false;
      if (minSameDistance > 0 && same.some(q => this.distance(p.x, p.y, q.x, q.y) < minSameDistance)) return false;
      if (minStartDistance > 0 && Number.isFinite(cx) && Number.isFinite(cy) && this.distance(p.x, p.y, cx, cy) < minStartDistance) return false;
      return true;
    };
    let candidates = positions.filter(passes);
    if (candidates.length === 0) {
      candidates = filter ? positions.filter(filter) : positions;
    }
    if (candidates.length === 0) return null;

    const sameSectorCounts = same.reduce((counts, pos) => {
      const key = this._sectorKey(pos, size);
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    const score = p => {
      const sameDist = this._nearestDistance(p, same, size * 2);
      const allDist = this._nearestDistance(p, all, size * 2);
      const sameSectorCount = sameSectorCounts[this._sectorKey(p, size)] || 0;
      return sameDist * sameWeight + allDist * allWeight - sameSectorCount * sectorWeight + Math.random() * 2;
    };

    let best = candidates[0];
    let bestScore = score(best);
    for (let i = 1; i < candidates.length; i++) {
      const candidateScore = score(candidates[i]);
      if (candidateScore > bestScore) {
        best = candidates[i];
        bestScore = candidateScore;
      }
    }
    const index = positions.indexOf(best);
    if (index >= 0) positions.splice(index, 1);
    return best;
  },

  _nearestDistance(pos, others, fallback) {
    if (!others?.length) return fallback;
    return others.reduce((best, other) => Math.min(best, this.distance(pos.x, pos.y, other.x, other.y)), fallback);
  },

  _sectorKey(pos, size) {
    const sectorSize = Math.max(1, Math.ceil(size / 3));
    return `${Math.floor(pos.x / sectorSize)},${Math.floor(pos.y / sectorSize)}`;
  },

  // 計算兩格的曼哈頓距離

  _altarPositions(size) {
    const count = CONFIG.MAP_ALTARS || 2;
    const minDistance = CONFIG.MAP_ALTAR_MIN_DISTANCE || 7;
    const minStartDistance = CONFIG.MAP_ALTAR_MIN_START_DISTANCE || 4;
    const maxStartDistance = CONFIG.MAP_ALTAR_MAX_START_DISTANCE || 0;
    const edgeMargin = Math.max(0, CONFIG.MAP_ALTAR_EDGE_MARGIN || 0);
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    const candidates = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x === cx && y === cy) continue;
        const startDistance = this.distance(x, y, cx, cy);
        if (startDistance < minStartDistance) continue;
        if (maxStartDistance > 0 && startDistance > maxStartDistance) continue;
        if (edgeMargin > 0 && (
          x < edgeMargin ||
          y < edgeMargin ||
          x >= size - edgeMargin ||
          y >= size - edgeMargin
        )) continue;
        candidates.push({ x, y });
      }
    }
    this._shuffle(candidates);

    if (count >= 2) {
      const spread = this._spreadAltarPositions(candidates, count, minDistance, size, cx, cy);
      if (spread.length >= count) return spread;
    }

    for (let requiredDistance = minDistance; requiredDistance >= 1; requiredDistance--) {
      const valid = [];
      for (const p of candidates) {
        if (valid.every(existing => this.distance(existing.x, existing.y, p.x, p.y) >= requiredDistance)) {
          valid.push(p);
        }
        if (valid.length >= count) return valid;
      }
    }
    if (candidates.length >= count) return candidates.slice(0, count);
    const fallback = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x === cx && y === cy) continue;
        if (this.distance(x, y, cx, cy) < minStartDistance) continue;
        fallback.push({ x, y });
      }
    }
    this._shuffle(fallback);
    return fallback.slice(0, count);
  },

  _spreadAltarPositions(candidates, count, minDistance, size, cx, cy) {
    const buildSpread = requiredDistance => {
      let best = [];
      let bestScore = -Infinity;

      for (const first of candidates) {
        const picked = [first];
        while (picked.length < count) {
          let next = null;
          let nextScore = -Infinity;
          const pickedSectors = new Set(picked.map(pos => this._sectorKey(pos, size)));
          const pickedQuadrants = new Set(picked.map(pos => this._quadrantKey(pos, cx, cy)));
          const avgStart = picked.reduce((sum, pos) => sum + this.distance(pos.x, pos.y, cx, cy), 0) / picked.length;
          for (const candidate of candidates) {
            if (picked.includes(candidate)) continue;
            const distances = picked.map(pos => this.distance(candidate.x, candidate.y, pos.x, pos.y));
            const nearest = Math.min(...distances);
            if (nearest < requiredDistance) continue;
            const sector = this._sectorKey(candidate, size);
            const quadrant = this._quadrantKey(candidate, cx, cy);
            const startDistance = this.distance(candidate.x, candidate.y, cx, cy);
            const score = nearest * 12
              + (pickedQuadrants.has(quadrant) ? 0 : 24)
              + (pickedSectors.has(sector) ? 0 : 10)
              - Math.abs(startDistance - avgStart) * 1.5
              + Math.random() * 2;
            if (score > nextScore) {
              next = candidate;
              nextScore = score;
            }
          }
          if (!next) break;
          picked.push(next);
        }

        if (picked.length >= count) {
          let pairDistance = 0;
          for (let i = 0; i < picked.length; i++) {
            for (let j = i + 1; j < picked.length; j++) {
              pairDistance += this.distance(picked[i].x, picked[i].y, picked[j].x, picked[j].y);
            }
          }
          const sectorCount = new Set(picked.map(pos => this._sectorKey(pos, size))).size;
          const quadrantCount = new Set(picked.map(pos => this._quadrantKey(pos, cx, cy))).size;
          const startDistances = picked.map(pos => this.distance(pos.x, pos.y, cx, cy));
          const startSpread = Math.max(...startDistances) - Math.min(...startDistances);
          const score = pairDistance * 10 + quadrantCount * 24 + sectorCount * 10 - startSpread * 1.5 + Math.random() * 2;
          if (score > bestScore) {
            best = picked;
            bestScore = score;
          }
        }
      }

      return best;
    };

    for (let requiredDistance = minDistance; requiredDistance >= Math.max(1, minDistance - 2); requiredDistance--) {
      const spread = buildSpread(requiredDistance);
      if (spread.length >= count) return this._orderAltarPositions(spread, cx, cy);
    }
    for (let requiredDistance = minDistance; requiredDistance >= 1; requiredDistance--) {
      const spread = buildSpread(requiredDistance);
      if (spread.length >= count) return this._orderAltarPositions(spread, cx, cy);
    }
    return [];
  },

  _orderAltarPositions(positions, cx, cy) {
    return [...positions].sort((a, b) => {
      const da = this.distance(a.x, a.y, cx, cy);
      const db = this.distance(b.x, b.y, cx, cy);
      return da - db || Math.random() - 0.5;
    });
  },

  _quadrantKey(pos, cx, cy) {
    return `${pos.x < cx ? 'w' : 'e'},${pos.y < cy ? 'n' : 's'}`;
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
    const hasOpeningEnemy = opening.some(cell => cell.type === 'enemy' && cell.content?.enemy);
    if (hasOpeningEnemy && interactiveCount >= 3 && terrainTypes.size >= 2) return;

    const desiredTerrains = ['forest', 'ruins', 'cave'].filter(type => !terrainTypes.has(type));
    const preferredTargets = opening.filter(cell => cell.type === 'empty' && !cell.content && !cell.hiddenSite);
    const fallbackTargets = opening.filter(cell => cell.type !== 'enemy' && !cell.hiddenSite && !cell.revealed);
    const targetCells = [...preferredTargets, ...fallbackTargets.filter(cell => !preferredTargets.includes(cell))];
    let targetIndex = 0;

    const swapIntoOpening = sourceCell => {
      const target = targetCells[targetIndex++];
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

    if (!hasOpeningEnemy) {
      const source = this._findOpeningSwapSource(grid, opening, cell => cell.type === 'enemy' && cell.content?.enemy);
      swapIntoOpening(source);
    }

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
