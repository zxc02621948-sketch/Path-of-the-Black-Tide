// game-state methods extracted from js/core/game.js.
const GameStateHelpers = {
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
    if (delta > 0 && typeof this._maybeSpawnUniqueStrongEnemy === 'function') {
      this._maybeSpawnUniqueStrongEnemy();
    }
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
    if (value === 5) {
      G.darknessMilestones[value] = true;
      G.darknessMilestones.darkMonsterSpawnIntro = true;
      this._queueSystemModal(this._darkMonsterIntroModalConfig(0, () => Render.fullRender()));
      return;
    }
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
      10: {
        title: '黑暗正在壯大',
        desc: [
          '邊境的黑暗已經不再只是霧。黑暗化身會持續逼近，拖延會讓牠們更容易追上小隊。',
          '每次結束今天前，請確認隊伍狀態、附近威脅，以及是否需要血祭、休息或主動清除黑暗。',
        ].join('\n\n'),
      },
      15: {
        title: '黑暗逼近吞噬',
        desc: [
          `黑暗已經接近極限。若黑暗達到 ${devourAt}，邊境會吞噬一切，遊戲將直接結束。`,
          '接下來每一次提高黑暗都可能造成致命後果。請優先降低黑暗、擊破黑暗化身，或準備撐到黎明。',
        ].join('\n\n'),
      },
    };
    return infos[value] || null;
  },

  _showDarkMonsterSpawnIntroOnce() {
    if (!G.darknessMilestones) G.darknessMilestones = {};
    if (G.darknessMilestones.darkMonsterSpawnIntro) return;
    const title = '黑暗化身已出現';
    const pending = Array.isArray(G.pendingSystemModals)
      ? G.pendingSystemModals.some(cfg => cfg?.title === title)
      : false;
    if (G.modal?.title === title || pending) {
      G.darknessMilestones.darkMonsterSpawnIntro = true;
      return;
    }
    G.darknessMilestones.darkMonsterSpawnIntro = true;
    this._queueSystemModal(this._darkMonsterIntroModalConfig(0, () => Render.fullRender()));
  },

  _darkMonsterIntroPages() {
    return [
      {
        title: '黑暗化身已出現',
        layout: 'tokens',
        body: [
          '黑暗凝成了化身。從現在開始，黑暗化身會在地圖上出現並朝小隊移動。',
          '牠們身上的顏色代表追殺倒數：綠色還有 3 天，黃色還有 2 天，紅色是最後 1 天。',
          '倒數歸零，或追上小隊所在位置時，會發動追殺戰鬥。',
          '每天最多會觸發 2 場被動追殺；其他已追上的黑暗化身會延後繼續追擊。',
        ],
      },
      {
        title: '黑暗會決定牠的強度',
        layout: 'combat',
        eventImage: 'assets/enemies/dark-avatar-combat.png',
        eventImageClass: 'dark-avatar-intro-art dark-avatar-intro-art-combat',
        body: [
          '黑暗化身生成時會依當下黑暗層數決定強度。',
          '每 1 層黑暗使生命 +10%，每 6 層黑暗使攻擊 +1。',
          '生成後即使黑暗繼續上升，已存在的黑暗化身不會跟著即時變強。',
        ],
      },
      {
        title: '主動討伐能壓低黑暗',
        layout: 'hunt',
        eventImage: 'assets/events/dark-avatar-hunt-bound.png',
        eventImageClass: 'dark-avatar-intro-art dark-avatar-intro-art-hunt',
        body: [
          '擊敗追殺而來的黑暗化身只會暫時擊退牠，不會降低黑暗；隔天牠會在別處重新潛伏。',
          '主動討伐黑暗化身可使黑暗 -2；若目標為 Lv.10 以上，再額外黑暗 -1。',
          '主動討伐勝利後會震懾其他黑暗化身，使牠們的追殺延後 1 天。',
          '主動討伐中若本場曾擊破原生弱點，額外黑暗 -1，每場最多一次。',
        ],
      },
    ];
  },

  _darkMonsterIntroModalConfig(pageIndex = 0, onDone = null) {
    const pages = this._darkMonsterIntroPages();
    const page = pages[Math.max(0, Math.min(pageIndex, pages.length - 1))] || pages[0];
    const choices = [];
    if (pageIndex > 0) {
      choices.push({ label: '上一頁', action: () => this._openDarkMonsterIntroPage(pageIndex - 1, onDone) });
    }
    if (pageIndex < pages.length - 1) {
      choices.push({ label: '下一頁', action: () => this._openDarkMonsterIntroPage(pageIndex + 1, onDone) });
    } else {
      choices.push({
        label: '知道了',
        action: () => {
          this._closeModal();
          if (typeof onDone === 'function') onDone();
        },
      });
    }
    return {
      title: page.title,
      descHtml: this._darkMonsterIntroPageHtml(page, pageIndex, pages.length),
      tutorialModal: true,
      darkAvatarIntro: true,
      eventImage: page.eventImage || '',
      eventImageClass: page.eventImageClass || '',
      eventImageAlt: page.title || '',
      eventSfx: pageIndex === 0 ? 'darkMonsterGrowl' : '',
      eventSfxVolume: 0.45,
      typeText: false,
      choices,
    };
  },

  _openDarkMonsterIntroPage(pageIndex, onDone = null) {
    this._openModal(this._darkMonsterIntroModalConfig(pageIndex, onDone));
  },

  _darkMonsterIntroPageHtml(page, pageIndex, totalPages) {
    const escape = value => this._escapeHtmlLocal ? this._escapeHtmlLocal(value) : String(value ?? '');
    const visual = {
      tokens: this._darkMonsterIntroTokensHtml(),
    }[page.layout] || '';
    return `
      <section class="dark-avatar-guide dark-avatar-guide-page-${escape(page.layout)}">
        <div class="dark-avatar-guide-page">${pageIndex + 1} / ${totalPages}</div>
        <div class="dark-avatar-guide-visual">${visual}</div>
        <div class="dark-avatar-guide-copy">
          ${page.body.map(text => `<p>${escape(text)}</p>`).join('')}
        </div>
      </section>
    `;
  },

  _darkMonsterIntroTokensHtml() {
    const tokens = [
      ['timer-green', '3', '綠色還有 3 天'],
      ['timer-yellow', '2', '黃色還有 2 天'],
      ['timer-red', '1', '紅色是最後 1 天'],
    ];
    return `
      <div class="dark-avatar-guide-tokens">
        ${tokens.map(([cls, count, label]) => `
          <div class="dark-avatar-guide-token">
            <div class="tutorial-dark-token ${cls}">
              <img src="assets/enemies/dark-monster-icon.png" alt="">
              <span>${count}</span>
            </div>
            <strong>${label}</strong>
          </div>
        `).join('')}
      </div>
    `;
  },

  _showNightIntroOnce() {
    if (G.nightIntroShown) return;
    G.nightIntroShown = true;
    this._queueSystemModal({
      title: '黑夜降臨',
      desc: [
        `第 ${CONFIG.NIGHT_START_DAY || 10} 天開始，邊境進入黑夜。`,
        '黑夜結束今天時不再扣生命，但黑暗會更快壯大，並強化最終尾王。',
        '黑暗每日上升得更快，黑暗化身也會持續追蹤小隊。休息點會變成殘火點，可用來治療、救起倒下隊友，或點燃火把暫時提高黑夜視野。',
      ].join('\n\n'),
      choices: [{ label: '進入黑夜', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _queueSystemModal(cfg) {
    if (!cfg || G.phase === 'over') return;
    if (!Array.isArray(G.pendingSystemModals)) G.pendingSystemModals = [];
    if (G.modal || G.combat || this._isWorldTransitionActive()) {
      G.pendingSystemModals.push(cfg);
      return;
    }
    this._openModal(cfg);
  },

  _flushSystemModal() {
    if (G.phase === 'over' || G.modal || G.combat || this._isWorldTransitionActive()) return false;
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
    this._clearSquadCombatCarryover?.();
    G.combat = null;
    G.phase = 'over';
    G.gameResult = result;
    G.modal = null;
    this._saveNotes();
    AudioManager?.sync?.();

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
    let changed = false;
    for (let i = next; i <= max; i++) {
      if (relic.lore[i] && !G.notes[relicId].includes(i)) {
        G.notes[relicId].push(i);
        changed = true;
      }
    }
    if (changed) this._saveNotes();
  },

  _syncKnownRelicNotes() {
    if (!G.notes) G.notes = {};
    for (const relic of G.library || []) {
      if (relic?.id) this._unlockNote(relic.id);
    }
    for (const char of G.squad || []) {
      if (char.relic?.id) this._unlockNote(char.relic.id);
      if (char.fusedRelic?.id) this._unlockNote(char.fusedRelic.id, true);
    }
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
    const deathSfx = char.deathSfx || (typeof CLASS_DEATH_SFX !== 'undefined' ? CLASS_DEATH_SFX[char.cls] : '');
    if (deathSfx && !char._deathSfxPlayed) {
      char._deathSfxPlayed = true;
      AudioManager?.playSfx?.(deathSfx, char.deathSfxVolume ?? 0.58);
    }
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
    char._deathSfxPlayed = false;
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
    damage = CombatStatus.applyBannerBearerDamageReduction(char, damage, logs);
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

  _relicRequiredWeaponFamilies(relic) {
    return Array.isArray(relic?.requiredWeaponFamilies)
      ? relic.requiredWeaponFamilies.filter(Boolean)
      : [];
  },

  _weaponFamilyLabel(family = '') {
    const labels = {
      sword: '劍系武器',
      bow: '弓',
      dagger: '匕首',
      battle_drum: '戰鼓',
      healing_staff: '治療杖',
      katana: '太刀',
    };
    return labels[family] || family || '指定武器';
  },

  _relicRequirementText(relic) {
    const families = this._relicRequiredWeaponFamilies(relic);
    if (!families.length) return '';
    const labels = families.map(family => this._weaponFamilyLabel(family)).join('或');
    return `需要攜帶${labels}`;
  },

  _charMeetsRelicWeaponRequirement(char, relic) {
    const families = this._relicRequiredWeaponFamilies(relic);
    if (!families.length) return true;
    const weaponFamily = char?.weapon?.family || char?.weapon?.id || '';
    return families.includes(weaponFamily);
  },

  _squadMeetsRelicWeaponRequirement(relic) {
    const families = this._relicRequiredWeaponFamilies(relic);
    if (!families.length) return true;
    return (G.squad || []).some(char =>
      !char.dead &&
      char.hp > 0 &&
      this._charMeetsRelicWeaponRequirement(char, relic)
    );
  },

  _filterRelicsByWeaponRequirements(pool) {
    return (pool || []).filter(relic => this._squadMeetsRelicWeaponRequirement(relic));
  },

  _getAvailableRelics(pool, opts = {}) {
    const used = this._getRelicIdsInRun();
    const strict = pool.filter(r => !used.has(r.id));
    const filterWeapons = relics => opts.ignoreWeaponRequirements
      ? relics
      : this._filterRelicsByWeaponRequirements(relics);
    const strictFiltered = filterWeapons(strict);
    if (strict.length > 0) return strictFiltered;

    const heldOrReserved = new Set();
    for (const char of G.squad) {
      if (char.relic) heldOrReserved.add(char.relic.id);
      if (char.fusedRelic) heldOrReserved.add(char.fusedRelic.id);
    }
    for (const row of G.map) {
      for (const cell of row) {
        for (const r of (cell.droppedRelics || [])) heldOrReserved.add(r.id);
      }
    }
    for (const site of (G.echoSites || [])) {
      if (!site.defeated && site.reservedRelicId) heldOrReserved.add(site.reservedRelicId);
    }
    return filterWeapons(pool.filter(r => !heldOrReserved.has(r.id)));
  },

  _relicRewardPoolForPhase(phase = G.phase) {
    const day = getDayRelics();
    if (phase !== 'night') return day;
    return [...day, ...getNightRelics()];
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
          if (!this._squadMeetsRelicWeaponRequirement(r)) {
            const altPool = this._filterRelicsByWeaponRequirements(getDayRelics()).filter(c => !seen.has(c.id));
            const alt = weightedRelicPick(altPool);
            if (alt) { cell.content = { relic: { ...alt } }; seen.add(alt.id); }
            else { cell.type = 'empty'; cell.content = null; }
          } else if (!seen.has(r.id)) {
            seen.add(r.id);
          } else {
            const alt = this._filterRelicsByWeaponRequirements(getDayRelics()).find(c => !seen.has(c.id));
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

  _isWorldTransitionActive() {
    return !!(G.dayTransitionActive || G.nightTransitionActive);
  },

  _isWorldInteractionLocked() {
    return !!(G.modal || G.combat || G.phase === 'over' || G.mapMoveLocked || this._isWorldTransitionActive());
  },

  _openModal(cfg) {
    const waitCombatAnimAudio = !!(cfg?.combat && cfg?.combatAnims && !G.combat);
    const modalCfg = waitCombatAnimAudio
      ? { ...cfg, syncAudioAfterCombatAnims: true }
      : cfg;
    G.modal = modalCfg;
    Render.showModal(modalCfg);
    if (!waitCombatAnimAudio) AudioManager?.sync?.();
  },
  _closeModal() {
    G.modal = null;
    Render.hideModal();
    AudioManager?.sync?.();
    if (this._flushSystemModal()) return;
    this._triggerPendingDarkMonsterChase?.();
  },

  // Section.
  _loadNotes()             { try { return JSON.parse(localStorage.getItem('bbn_notes')    || '{}'); } catch { return {}; } },
  _saveNotes()             { localStorage.setItem('bbn_notes',    JSON.stringify(G.notes)); },
  _loadVisitedTerrains()   { try { return JSON.parse(localStorage.getItem('bbn_terrain') || '[]'); } catch { return []; } },
  _saveVisitedTerrains()   { localStorage.setItem('bbn_terrain', JSON.stringify(G.visitedTerrains)); },
  _recordTerrain(type)     { if (type === 'empty') return; if (!G.visitedTerrains.includes(type)) { G.visitedTerrains.push(type); this._saveVisitedTerrains(); } },
  _loadLibrary()         { try { return this._filterLibraryRelics(JSON.parse(localStorage.getItem('bbn_library') || '[]')); } catch { return []; } },
  _saveLibrary()         { localStorage.setItem('bbn_library', JSON.stringify(this._filterLibraryRelics(G.library))); },
  _loadLibraryUnlocked() { return localStorage.getItem('bbn_library_unlocked') !== 'false'; },
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
    this._unlockNote(relic.id);
    this._saveLibrary();
    this._log(`${carrier.name} 從聖物庫攜帶「${relic.name}」出發。`, 'reward');
  },

  _filterLibraryRelics(relics) {
    return (relics || [])
      .map(r => {
        const latest = getRelicById(r?.id);
        return latest ? { ...latest } : null;
      })
      .filter(r => r?.effect?.type !== 'unlock_library');
  },
};

Object.assign(Game, GameStateHelpers);
