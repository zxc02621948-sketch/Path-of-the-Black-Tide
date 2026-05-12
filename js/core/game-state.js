// game-state methods extracted from js/core/game.js.
const GameStateHelpers = {
  _placeNightBox() {
    // 舊黑夜遺匣已移除，保留空函式避免舊存檔或舊呼叫造成錯誤。
  },

  _placeNightRelics() {
    const pool = this._getAvailableRelics(getNightRelics());
    let placed = 0;
    for (let y = 0; y < CONFIG.MAP_SIZE && placed < CONFIG.NIGHT_RELIC_PLACEMENT_COUNT; y++) {
      for (let x = 0; x < CONFIG.MAP_SIZE && placed < CONFIG.NIGHT_RELIC_PLACEMENT_COUNT; x++) {
        const cell = G.map[y][x];
        if (cell.type === 'empty' && !cell.hiddenSite && !cell.revealed && !cell.cleared && placed < pool.length) {
          cell.type = 'relic';
          cell.content = { relic: { ...pool[placed] } };
          placed++;
        }
      }
    }
  },

  // Section.
  // Section.
  _applyDarkness(delta, reason = '') {
    if (G.phase === 'over' || G.phase === 'dawn') return;
    const prev = Math.max(0, G.darkness || 0);
    const maxDark = CONFIG.DARKNESS_MAX_THRESHOLD || CONFIG.DARKNESS_DEVOUR_THRESHOLD || 10;
    if (delta < 0) {
      G.darkness = Math.max(0, prev - Math.abs(delta));
    } else {
      G.darkness = Math.min(maxDark, prev + delta);
    }
    if (delta !== 0) {
      const changeLabel = delta > 0 ? `黑暗 +${delta}` : `黑暗 -${Math.abs(delta)}`;
      const prevLabel = `黑暗 ${prev}`;
      const nextLabel = `黑暗 ${G.darkness}`;
      this._log(`${reason ? `${reason}：` : ''}${changeLabel}（${prevLabel} → ${nextLabel}）`, delta > 0 ? 'danger' : 'reward');
    }
    const reachedMilestone = delta > 0 ? this._nextDarknessMilestone(prev, G.darkness) : null;
    if (this._checkDevoured()) return;
    if (reachedMilestone) this._showDarknessMilestoneOnce(reachedMilestone);
    Render.renderTopBar();
  },

  _nextDarknessMilestone(prev, next) {
    const milestones = [5, 10, 15];
    return milestones
      .filter(value => prev < value && next >= value)
      .sort((a, b) => b - a)[0] || null;
  },

  _showDarknessMilestoneOnce(value) {
    if (!G.darknessMilestones) G.darknessMilestones = {};
    if (G.darknessMilestones[value]) return;
    const info = this._darknessMilestoneInfo(value);
    if (!info) return;
    G.darknessMilestones[value] = true;
    this._queueSystemModal({
      title: info.title,
      desc: info.desc,
      choices: [{ label: '知道了', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _darknessMilestoneInfo(value) {
    const devourAt = CONFIG.DARKNESS_MAX_THRESHOLD || CONFIG.DARKNESS_DEVOUR_THRESHOLD || 20;
    const infos = {
      5: {
        title: '黑暗怪已出現',
        desc: [
          '黑暗凝成了追獵者。從現在開始，黑暗怪會在地圖上出現並朝小隊移動。',
          '牠們身上的顏色代表追殺倒數：綠色還有 3 天，黃色還有 2 天，紅色是最後 1 天。倒數歸零，或追上小隊所在位置時，會發動追殺戰鬥。',
          '擊敗追殺而來的黑暗怪可使黑暗 -1；主動討伐黑暗怪可使黑暗 -3，並震懾其他黑暗怪，使牠們的追殺延後 1 天。',
        ].join('\n\n'),
      },
      10: {
        title: '黑暗正在壯大',
        desc: [
          '邊境的黑暗已經不再只是霧。黑暗怪會持續逼近，拖延會讓牠們更容易追上小隊。',
          '每次結束今天前，請確認隊伍狀態、附近威脅，以及是否需要血祭、休息或主動清除黑暗。',
        ].join('\n\n'),
      },
      15: {
        title: '黑暗逼近吞噬',
        desc: [
          `黑暗已經接近極限。若黑暗達到 ${devourAt}，邊境會吞噬一切，遊戲將直接結束。`,
          '接下來每一次提高黑暗都可能造成致命後果。請優先降低黑暗、擊破黑暗怪，或準備撐到黎明。',
        ].join('\n\n'),
      },
    };
    return infos[value] || null;
  },

  _showNightIntroOnce() {
    if (G.nightIntroShown) return;
    G.nightIntroShown = true;
    this._queueSystemModal({
      title: '黑夜降臨',
      desc: [
        `第 ${CONFIG.NIGHT_START_DAY || 10} 天開始，邊境進入黑夜。`,
        `黑夜結束今天時，全隊會受到 ${CONFIG.NIGHT_END_HP_COST || 2} 點黑夜侵蝕。`,
        '黑暗每日上升得更快，黑暗怪也會持續追蹤小隊。休息點會變成殘火點，可用來撤離；點燃火把能暫時提高黑夜視野。',
      ].join('\n\n'),
      choices: [{ label: '進入黑夜', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _queueSystemModal(cfg) {
    if (!cfg || G.phase === 'over') return;
    if (!Array.isArray(G.pendingSystemModals)) G.pendingSystemModals = [];
    if (G.modal || G.combat) {
      G.pendingSystemModals.push(cfg);
      return;
    }
    this._openModal(cfg);
  },

  _flushSystemModal() {
    if (G.phase === 'over' || G.modal || G.combat) return false;
    if (!Array.isArray(G.pendingSystemModals) || G.pendingSystemModals.length === 0) return false;
    const cfg = G.pendingSystemModals.shift();
    this._openModal(cfg);
    return true;
  },

  _checkDevoured() {
    if ((G.darkness || 0) >= (CONFIG.DARKNESS_MAX_THRESHOLD || CONFIG.DARKNESS_DEVOUR_THRESHOLD)) {
      this._endGame('devoured');
      return true;
    }
    return false;
  },

  // Game Dark Monsters methods live in js/core/dark-monsters.js.

  _maybeSpawnErosionBoss() {
    if (G.erosionBossSpawned) return false;
    G.erosionBossSpawned = true;

    // Section.
    const cell = G.map[G.playerY][G.playerX];
    const boss = getErosionBossEnemy();
    cell.content = { ...cell.content, enemy: boss, reward: 'erosion' };
    this._log('黑暗侵蝕聚集成敵人，腐化頭目出現。', 'danger');
    this._triggerCombat(cell);
    return true;
  },

  _checkLose() {
    const dead = G.squad.filter(c => c.hp <= 0 && !c.dead);
    for (const char of dead) {
      this._markCharDead(char);
    }

    this._updateResonances();

    if (G.squad.every(c => c.dead || c.hp <= 0)) { this._endGame('lose'); return true; }
    Render.fullRender();
    return false;
  },

  _endGame(result) {
    G.phase = 'over';
    G.modal = null;
    this._saveNotes();

    if (result === 'evacuate' || result === 'dawn') {
      if (G.libraryUnlocked) {
        for (const char of G.squad) {
          for (const r of [char.relic, char.fusedRelic].filter(Boolean)) {
            if (r.effect?.type === 'unlock_library') continue;
            if (!G.library.find(l => l.id === r.id)) G.library.push({ ...r });
          }
        }
        this._saveLibrary();
      }
    }

    if (result === 'lose' || result === 'devoured') {
      Render.playGameOverIntro(result, G, () => Render.showGameOver(result, G));
      return;
    }
    Render.showGameOver(result, G);
  },

  // Section.
  // Section.
  _unlockNote(relicId, extra = false) {
    if (!G.notes[relicId]) G.notes[relicId] = [];
    const relic = getRelicById(relicId);
    if (!relic) return;
    const next = G.notes[relicId].length;
    const max  = extra ? relic.lore.length - 1 : Math.min(next, relic.lore.length - 1);
    if (next <= max && relic.lore[next]) G.notes[relicId].push(next);
  },

  _getFirstLore(relicId) {
    const relic = getRelicById(relicId);
    return (relic?.lore?.length > 0) ? relic.lore[0] : null;
  },

  getNotes() {
    const result = [];
    for (const [relicId, indices] of Object.entries(G.notes)) {
      const relic = getRelicById(relicId);
      if (!relic) continue;
      for (const idx of indices) {
        result.push({ relic, text: relic.lore[idx], locationHint: relic.locationHint });
      }
    }
    return result;
  },

  // Section.
  // Section.
  _spawnChar(cls, usedNames, forceName) {
    const fixed = typeof CLASS_FIXED_CHARACTER !== 'undefined' ? CLASS_FIXED_CHARACTER[cls] : null;
    const tmpl = fixed || { name: forceName || CHARACTER_CLASSES[cls].name, cls };
    const char = createCharacter(forceName || tmpl.name, cls);
    char.flavor = tmpl.flavor || '';
    return char;
  },

  _removeCharFromSquad(char) {
    this._removeRelicEffect(char, char.relic);
    this._removeRelicEffect(char, char.fusedRelic);
    this._removeFusionBonus(char, char.fusedRelic);
    G.squad = G.squad.filter(c => c.id !== char.id);
  },

  _markCharDead(char) {
    char.hp = 0;
    char.dead = true;
    char.deathLocation = { x: G.playerX, y: G.playerY };
    this._log(`${char.name} 倒下了。`, 'danger');

    if (char.fusedRelic) {
      this._dropRelicAt(G.playerX, G.playerY, char.fusedRelic, char.name, 'fusedRelic');
      this._log(`${char.name} 的融合遺落物「${char.fusedRelic.name}」留在原地。`, 'dim');
      this._log(`${char.name} 的融合聖物失去效果。`, 'danger');
      this._removeRelicEffect(char, char.fusedRelic);
      this._removeFusionBonus(char, char.fusedRelic);
      char.fusedRelic = null;
    }

    if (char.relic) {
      this._dropRelicAt(G.playerX, G.playerY, char.relic, char.name, 'relic');
      this._removeRelicEffect(char, char.relic);
      this._log(`${char.name} 的遺落物「${char.relic.name}」留在原地。`, 'dim');
      char.relic = null;
    }
  },

  _dropRelicAt(x, y, relic, ownerName = null, slot = 'relic') {
    const cell = G.map[y]?.[x];
    if (!cell || !relic) return;
    if (!cell.droppedRelics) cell.droppedRelics = [];
    cell.droppedRelics.push({ ...relic, _droppedBy: ownerName, _droppedSlot: slot });
  },

  _reviveChar(char, hp = 1) {
    char.dead = false;
    char.hp = Math.min(char.maxHp, Math.max(1, hp));
    this._log(`${char.name} 被救起，恢復 ${char.hp} HP。`, 'reward');
    this._updateResonances();
  },

  _healAliveSquad(healAmount, includeRestBonus = false) {
    const healed = [];
    for (const char of this._aliveSquad()) {
      if (char.hp < char.maxHp) {
        const baseHeal = typeof healAmount === 'function' ? healAmount(char) : healAmount;
        const maxHeal = includeRestBonus ? this._restHealAmount(char, baseHeal) : baseHeal;
        const gain = Math.min(maxHeal, char.maxHp - char.hp);
        char.hp += gain;
        healed.push(`${char.name} +${gain}`);
      }
    }

    return healed;
  },

  _markRestUsed(cell) {
    cell.cleared = true;
    cell.restUsedDay = G.day;
  },

  _restCooldownRemaining(cell) {
    if (!cell || cell.type !== 'rest' || !cell.cleared) return 0;
    const refreshDays = CONFIG.REST_REFRESH_DAYS || 5;
    if (!Number.isFinite(cell.restUsedDay)) return refreshDays;
    return Math.max(0, refreshDays - (G.day - cell.restUsedDay));
  },

  _refreshRestPoints() {
    if (!Array.isArray(G.map)) return;
    for (const row of G.map) {
      for (const cell of row) {
        if (cell?.type !== 'rest' || !cell.cleared) continue;
        if (!Number.isFinite(cell.restUsedDay)) cell.restUsedDay = G.day;
        if (this._restCooldownRemaining(cell) > 0) continue;
        cell.cleared = false;
        cell.restUsedDay = null;
      }
    }
  },

  _restHealAmount(target, baseHeal) {
    // Section.
    const hasFused = this._aliveSquad().some(c => c.fusedRelic?.effect?.type === 'rest_heal_bonus');
    const hasCarried = target.relic?.effect?.type === 'rest_heal_bonus';
    const bonusRate = (hasFused || hasCarried)
      ? (target.relic?.effect?.value ?? target.fusedRelic?.effect?.value ?? 0.20)
      : 0;
    const bonus = bonusRate > 0 ? Math.ceil(target.maxHp * bonusRate) : 0;
    return baseHeal + bonus;
  },

  _reduceIncomingDamage(char, amount, allowCarriedIron = false, allowWagerPenalty = false, logs = null) {
    let damage = Math.max(0, amount);
    return CombatStatus.applyIncomingRiskBonuses(char, damage, {
      allowRemorse: allowWagerPenalty,
      allowBacklash: allowWagerPenalty,
      logs,
      damageLabel: '受傷',
      resultLabel: '傷害',
    });
  },

  _aliveSquad() {
    return G.squad.filter(c => !c.dead && c.hp > 0);
  },

  _needsRescue() {
    return G.squad.length < CONFIG.MAX_SQUAD_SIZE;
  },

  _squadHasRelic(relicId) {
    return G.squad.some(c => c.relic?.id === relicId || c.fusedRelic?.id === relicId);
  },

  _getRelicIdsInRun() {
    const ids = new Set();
    for (const char of G.squad) {
      if (char.relic) ids.add(char.relic.id);
      if (char.fusedRelic) ids.add(char.fusedRelic.id);
    }
    for (const row of G.map) {
      for (const cell of row) {
        if (!cell.cleared && cell.content?.relic) ids.add(cell.content.relic.id);
        for (const r of (cell.droppedRelics || [])) ids.add(r.id);
      }
    }
    for (const site of (G.echoSites || [])) {
      if (!site.defeated && site.reservedRelicId) ids.add(site.reservedRelicId);
    }
    return ids;
  },

  _getAvailableRelics(pool) {
    const used = this._getRelicIdsInRun();
    return pool.filter(r => !used.has(r.id));
  },

  _dedupeMapRelics() {
    const seen = new Set();
    for (const char of G.squad) {
      if (char.relic) seen.add(char.relic.id);
      if (char.fusedRelic) seen.add(char.fusedRelic.id);
    }
    for (const row of G.map) {
      for (const cell of row) {
        const r = cell.content?.relic;
        if (r) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
          } else {
            const alt = getDayRelics().find(c => !seen.has(c.id));
            if (alt) { cell.content = { relic: { ...alt } }; seen.add(alt.id); }
            else { cell.type = 'empty'; cell.content = null; }
          }
        }
        if (cell.droppedRelics?.length) {
          cell.droppedRelics = cell.droppedRelics.filter(d => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
          });
          if (cell.droppedRelics.length === 0) delete cell.droppedRelics;
        }
      }
    }
  },

  _removeMapRelicsById(relicId) {
    for (const row of G.map) {
      for (const cell of row) {
        if (cell.content?.relic?.id === relicId) {
          cell.type = 'empty'; cell.content = null; cell.cleared = true;
        }
        if (cell.droppedRelics?.length) {
          cell.droppedRelics = cell.droppedRelics.filter(r => r.id !== relicId);
          if (cell.droppedRelics.length === 0) delete cell.droppedRelics;
        }
      }
    }
  },

  _log(msg, type = '') {
    G.log.unshift({ msg, type, day: G.day ?? null });
    if (G.log.length > 80) G.log.pop();
    Render.renderLog();
  },

  _openModal(cfg) { G.modal = cfg; Render.showModal(cfg); },
  _closeModal() {
    G.modal = null;
    Render.hideModal();
    this._flushSystemModal();
  },

  // Section.
  _loadNotes()             { try { return JSON.parse(localStorage.getItem('bbn_notes')    || '{}'); } catch { return {}; } },
  _saveNotes()             { localStorage.setItem('bbn_notes',    JSON.stringify(G.notes)); },
  _loadVisitedTerrains()   { try { return JSON.parse(localStorage.getItem('bbn_terrain') || '[]'); } catch { return []; } },
  _saveVisitedTerrains()   { localStorage.setItem('bbn_terrain', JSON.stringify(G.visitedTerrains)); },
  _recordTerrain(type)     { if (type === 'empty') return; if (!G.visitedTerrains.includes(type)) { G.visitedTerrains.push(type); this._saveVisitedTerrains(); } },
  _loadLibrary()         { try { return this._filterLibraryRelics(JSON.parse(localStorage.getItem('bbn_library') || '[]')); } catch { return []; } },
  _saveLibrary()         { localStorage.setItem('bbn_library', JSON.stringify(this._filterLibraryRelics(G.library))); },
  _loadLibraryUnlocked() { return localStorage.getItem('bbn_library_unlocked') === 'true'; },
  _saveLibraryUnlocked() { localStorage.setItem('bbn_library_unlocked', 'true'); },

  _applyStartingLibraryRelic(relicId, carrierCls = null) {
    if (!relicId || !G.libraryUnlocked) return;
    G.library = this._filterLibraryRelics(G.library);
    const idx = G.library.findIndex(r => r.id === relicId);
    if (idx === -1 || G.squad.length === 0) return;
    const [relic] = G.library.splice(idx, 1);
    const carrier = (carrierCls && G.squad.find(c => c.cls === carrierCls)) || G.squad[0];
    carrier.relic = { ...relic };
    this._applyRelicEquip(carrier, relic);
    this._saveLibrary();
    this._log(`${carrier.name} 從聖物庫攜帶「${relic.name}」出發。`, 'reward');
  },

  _filterLibraryRelics(relics) {
    return (relics || []).filter(r => r?.effect?.type !== 'unlock_library' && !!getRelicById(r.id));
  },
};

Object.assign(Game, GameStateHelpers);
