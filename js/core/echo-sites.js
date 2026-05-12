// Resonance echo site event and reward flow.
const GameEchoSites = {
  _maybeCreateEchoSiteClueEvent() {
    if ((G.day || 1) < (CONFIG.ECHO_SITE_MIN_DAY || 3)) return null;
    if ((G.activeResonances || []).length > 0) return null;
    if (this._activeEchoSites().length >= (CONFIG.ECHO_SITE_MAX_ACTIVE || 3)) return null;
    if (!this._hasEchoSitePlacementCell()) return null;
    return this._createEchoSiteClueEvent(false);
  },

  _createEchoSiteClueEvent(ignoreChance = false) {
    if (!ignoreChance && Math.random() >= (CONFIG.ECHO_SITE_EVENT_CHANCE ?? 0.10)) return null;

    const system = this._pickEchoSiteSystem();
    if (!system) return null;
    const relic = this._pickEchoSiteRelic(system);
    if (!relic) return null;

    return {
      id: `echo_site_clue_${system.id}`,
      name: '共鳴遺址的線索',
      type: 'echo_site_clue',
      rarity: 'rare',
      category: 4,
      categoryName: '稀有事件',
      categoryDesc: '指向聖物體系的特殊線索',
      hideEventHeader: true,
      noReserve: true,
      echoSystemId: system.id,
      reservedRelicId: relic.id,
      desc: [
        system.clueText || '你們找到一段殘缺的聖物線索。',
        `它指向一處被黑暗守住的遺址，裡面殘留著「${system.name}」的氣息。`,
      ].join('\n\n'),
    };
  },

  _activeEchoSites() {
    return (G.echoSites || []).filter(site => !site.defeated);
  },

  _pickEchoSiteSystem() {
    const activeSystemIds = new Set(this._activeEchoSites().map(site => site.systemId));
    const systems = getEchoRelicSystems()
      .filter(system => !activeSystemIds.has(system.id))
      .filter(system => this._pickEchoSiteRelic(system));
    if (systems.length === 0) return null;
    return systems[Math.floor(Math.random() * systems.length)];
  },

  _pickEchoSiteRelic(system) {
    const relics = (system?.relics || []).map(id => getRelicById(id)).filter(Boolean);
    const pool = this._getAvailableRelics(relics);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  _hasEchoSitePlacementCell() {
    return this._echoSitePlacementCandidates().length > 0;
  },

  _triggerEchoSiteClue(cell, ev) {
    const system = getEchoRelicSystemById(ev.echoSystemId);
    const relic = getRelicById(ev.reservedRelicId);
    const target = system && relic ? this._placeEchoSite(system, relic) : null;
    if (!target) {
      this._openModal({
        title: '共鳴遺址的線索',
        desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n線索已經破碎，沒有找到可前往的遺址。`,
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }
    this._log(`共鳴遺址出現：${system.siteName} (${target.x},${target.y})。`, 'reward');
    this._openModal({
      title: '共鳴遺址的線索',
      desc: [
        `${this._eventDiceText(ev)}${ev.desc || ''}`,
        `地圖上新增：${system.siteName} (${target.x},${target.y})。`,
        `擊敗守護者後，可獲得一件${system.name}聖物。`,
        system.siteText || '',
        system.guardianText || '',
      ].filter(Boolean).join('\n\n'),
      choices: [{ label: '標記遺址', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _placeEchoSite(system, relic) {
    const candidates = this._echoSitePlacementCandidates();
    if (candidates.length === 0) return null;
    candidates.sort((a, b) =>
      MapGen.distance(G.playerX, G.playerY, b.x, b.y) -
      MapGen.distance(G.playerX, G.playerY, a.x, a.y)
    );
    const cell = candidates[Math.floor(Math.random() * Math.min(8, candidates.length))];
    const site = {
      id: `echo_${system.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      systemId: system.id,
      systemName: system.name,
      siteName: system.siteName,
      reservedRelicId: relic.id,
      x: cell.x,
      y: cell.y,
      defeated: false,
    };
    if (!Array.isArray(G.echoSites)) G.echoSites = [];
    G.echoSites.push(site);
    cell.type = 'enemy';
    cell.revealed = true;
    cell.cleared = false;
    cell.content = {
      enemy: getEchoGuardianEnemy(system.id),
      reward: 'echo_site',
      echoSiteId: site.id,
      echoSystemId: system.id,
      echoSystemName: system.name,
      echoSiteName: system.siteName,
      reservedRelicId: relic.id,
    };
    return cell;
  },

  _echoSitePlacementCandidates() {
    const candidates = [];
    const cx = Math.floor(CONFIG.MAP_SIZE / 2);
    const cy = Math.floor(CONFIG.MAP_SIZE / 2);
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (!cell || cell.cleared || cell.content || cell.hiddenSite || cell.reserved) continue;
        if (cell.type !== 'empty') continue;
        if (MapGen.distance(cx, cy, cell.x, cell.y) < 4) continue;
        candidates.push(cell);
      }
    }
    return candidates;
  },

  _settleEchoSiteVictory(cell, enemy, attacker, roll, rollResult, logs, finalHitDesc) {
    const siteId = cell.content?.echoSiteId;
    const site = (G.echoSites || []).find(item => item.id === siteId);
    const systemName = cell.content?.echoSystemName || site?.systemName || '共鳴';
    const siteName = cell.content?.echoSiteName || site?.siteName || `${systemName}遺址`;
    const relicId = cell.content?.reservedRelicId || site?.reservedRelicId;
    const relic = getRelicById(relicId);
    if (site) site.defeated = true;

    if (!relic || this._squadHasRelic(relic.id)) {
      cell.type = 'empty';
      cell.content = null;
      cell.cleared = true;
      this._openModal({
        title: '共鳴遺址已清除',
        desc: `${enemy.name} 被擊敗。\n${finalHitDesc}\n\n${siteName} 的聖物氣息已經散去。`,
        combatLog: logs,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: roll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    cell.type = 'relic';
    cell.content = { relic: { ...relic } };
    cell.cleared = false;
    this._log(`${siteName} 的守護者倒下，留下聖物「${relic.name}」。`, 'reward');
    const system = getEchoRelicSystemById(cell.content?.echoSystemId || site?.systemId);
    this._openModal({
      title: '共鳴遺址已清除',
      desc: [
        `${enemy.name} 被擊敗。`,
        finalHitDesc,
        system?.victoryText || `${siteName} 的封印裂開，露出「${relic.name}」。`,
        `獲得機會：「${relic.name}」\n${relic.desc}`,
      ].join('\n\n'),
      combatLog: logs,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
      dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: roll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
      choices: [{
        label: `拾取「${relic.name}」`,
        action: () => this._triggerRelic(cell),
      }],
    });
  },
};

Object.assign(Game, GameEchoSites);
