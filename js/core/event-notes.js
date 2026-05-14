// event-notes methods extracted from js/core/event-handlers.js.
const GameEventNotes = {
  _triggerNote(ev) {
    const rescueClue = ev.revealRescueBoss && this._needsRescue() ? this._revealRescueBoss() : '';
    const altarClue = this._tryRevealAltarClue(ev);
    const revealNote = ev.revealIfNoRescue && !this._needsRescue()
      ? this._revealNearbyFromEvent(ev.revealIfNoRescue)
      : '';
    this._log(`獲得探險筆記：${ev.name}。`, 'reward');
    const noteChoices = [];
    if (this._progressEventDelta(ev) < 0) {
      noteChoices.push({
        label: '進行黑暗降低判定',
        action: () => this._resolveNoteDarknessReduction(ev, rescueClue, altarClue + revealNote),
      });
    } else {
      noteChoices.push({ label: '記下', action: () => { this._completeProgressEvent(ev); this._closeModal(); Render.fullRender(); } });
    }
    this._openModal({
      title: `探險筆記：${ev.name}`,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n${ev.noteText || '你們記下了這段線索。'}${rescueClue}${altarClue}${revealNote}`,
      choices: noteChoices,
    });
  },

  _resolveNoteDarknessReduction(ev, rescueClue = '', revealNote = '') {
    const delta = this._progressEventDelta(ev);
    if (typeof delta !== 'number' || delta >= 0) {
      this._completeProgressEvent(ev);
      this._closeModal();
      Render.fullRender();
      return;
    }

    const roll = Dice.rollRaw();
    const success = roll >= 4;
    const amount = ev.purificationRoll && roll === 6 ? 2 : Math.abs(delta);
    let resultText = `\n\n淨化判定：${Dice.face(roll)}（${roll}），`;

    if (success) {
      const reduction = this._applyDarknessReductionWithOverflow(ev, amount, `${ev.name} 淨化`);
      this._log(`${ev.name} 淨化成功：黑暗 -${reduction.actual}。`, 'reward');
      resultText += `${ev.purificationRoll && roll === 6 ? '大成功' : '成功'}：黑暗 -${reduction.actual}。${reduction.text.replace(/^\n\n/, '')}`;
    } else {
      this._log(`${ev.name} 淨化失敗：黑暗不變。`, 'dim');
      resultText += '失敗：黑暗不變。';
    }

    this._openModal({
      title: `探險筆記：${ev.name}`,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n${ev.noteText || '你們記下了這段線索。'}${rescueClue}${revealNote}\n\n正在進行淨化判定。`,
      preDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n${ev.noteText || '你們記下了這段線索。'}${rescueClue}${revealNote}\n\n正在進行淨化判定。`,
      resultDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n${ev.noteText || '你們記下了這段線索。'}${rescueClue}${revealNote}${resultText}`,
      resultAppend: resultText,
      dice: { type: success ? 'neutral' : 'danger', label: '淨化骰', value: roll, raw: roll, animate: true },
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _revealNearbyFromEvent(range = 1) {
    let count = 0;
    for (const cell of this._valuableHiddenCellsNear(G.playerX, G.playerY, range)) {
      if (cell.hiddenSite) {
        this._revealHiddenSite(cell);
      } else {
        cell.revealed = true;
        if (cell.type === 'altar') cell.altarHidden = false;
      }
      count++;
    }
    return count > 0 ? `\n\n線索揭露附近 ${count} 處值得調查的位置。` : '\n\n附近沒有新的重要線索可揭露。';
  },

  _valuableHiddenCellsNear(x, y, range = 1) {
    const cells = [];
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > range) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= CONFIG.MAP_SIZE || ny >= CONFIG.MAP_SIZE) continue;
        const cell = G.map?.[ny]?.[nx];
        if (!cell || cell.revealed || cell.cleared) continue;
        if (this._isValuableRevealCell(cell)) cells.push(cell);
      }
    }
    return cells;
  },

  _isValuableRevealCell(cell) {
    if (cell.hiddenSite) return true;
    if (cell.droppedRelics?.length > 0) return true;
    if (cell.content?.relic || cell.content?.enemy || cell.content?.chest || cell.content?.event || cell.content?.eventPending) return true;
    return ['forest', 'ruins', 'cave', 'rest', 'relic', 'enemy', 'chest', 'altar'].includes(cell.type);
  },

  _tryRevealAltarClue(ev) {
    if (!ev.revealAltarClue) return '';
    const hiddenAltars = this._hiddenSiteCells('altar');
    if (hiddenAltars.length === 0) {
      return this._revealNearbyFromEvent(ev.altarClueFallbackRange || 3);
    }

    const revealedAltars = this._revealedAltarCount();
    const chance = revealedAltars === 0 ? 1 : (ev.altarClueChance ?? 0.6);
    if (Math.random() > chance) {
      return '\n\n線索提到了能讓聖物共鳴的古老神壇，但方向仍不完整。';
    }

    const cell = this._nearestHiddenSiteCell('altar');
    if (!cell) return '';
    this._revealHiddenSite(cell);
    this._log(`線索揭露神壇位置 (${cell.x},${cell.y})。`, 'reward');
    return `\n\n線索指向一座能讓聖物融合的古老神壇 (${cell.x},${cell.y})。`;
  },

  _hiddenSiteCells(type) {
    const cells = [];
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (cell.hiddenSite?.type === type) cells.push(cell);
      }
    }
    return cells;
  },

  _nearestHiddenSiteCell(type) {
    return this._hiddenSiteCells(type)
      .sort((a, b) =>
        MapGen.distance(G.playerX, G.playerY, a.x, a.y) -
        MapGen.distance(G.playerX, G.playerY, b.x, b.y)
      )[0] || null;
  },

  _revealedAltarCount() {
    let count = 0;
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (cell.type === 'altar' && !cell.hiddenSite) count++;
      }
    }
    return count;
  },

  _revealHiddenSite(cell) {
    const site = cell?.hiddenSite;
    if (!site) return false;
    delete cell.hiddenSite;
    cell.revealed = true;
    cell.cleared = false;
    cell.reserved = false;

    if (site.type === 'altar') {
      cell.type = 'altar';
      cell.content = null;
      cell.altarHidden = false;
      cell.altarUsedDay = site.altarUsedDay || 0;
      return true;
    }

    if (site.type === 'rescue') {
      cell.type = 'enemy';
      cell.content = site.content ? { ...site.content, enemy: { ...site.content.enemy } } : { enemy: getRescueBossEnemy(), reward: 'rescue' };
      cell.rescueRevealed = true;
      return true;
    }

    return false;
  },

  _revealRescueBoss() {
    for (const row of G.map) {
      for (const cell of row) {
        if (cell.hiddenSite?.type === 'rescue') {
          this._revealHiddenSite(cell);
          this._log('揭露救援 Boss 線索。', 'reward');
          return '\n\n揭露了一處救援 Boss 線索。';
        }
        if (cell.content?.reward !== 'rescue' || cell.cleared) continue;
        const wasRevealed = cell.revealed;
        cell.revealed = true;
        cell.rescueRevealed = true;
        this._log('揭露救援 Boss 線索。', 'reward');
        return wasRevealed
          ? '\n\n救援 Boss 線索已揭露。'
          : '\n\n揭露了一處救援 Boss 線索。';
      }
    }
    return '';
  },


};

Object.assign(Game, GameEventNotes);
