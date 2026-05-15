// Section.
const Render = {
  DARK_MONSTER_ICON_SRC: 'assets/enemies/dark-monster-icon.png',

  // Section.
  fullRender() {
    this._safeRender('top bar', () => this.renderTopBar());
    this._safeRender('map', () => this.renderMap(), 'map-grid');
    this._safeRender('squad', () => this.renderSquad(), 'squad-list');
    this._safeRender('effects', () => this.renderEffects());
    this._safeRender('log', () => this.renderLog());
    this._safeRender('resonances', () => this.renderResonances());
    this._safeRender('phase class', () => this.updatePhaseClass());
  },

  _safeRender(name, fn, fallbackElementId = null) {
    try {
      fn();
    } catch (err) {
      console.error(`Render failed: ${name}`, err);
      if (!fallbackElementId) return;
      const el = document.getElementById(fallbackElementId);
      if (el) {
        el.innerHTML = `<div class="render-error">畫面渲染失敗：${name}</div>`;
      }
    }
  },

  // Section.
  renderTopBar() {
    document.getElementById('day-num').textContent = G.day;
    const actionsLeft = Math.max(0, G.actionsLeft || 0);
    const actionsMax = CONFIG.ACTIONS_PER_DAY || 3;
    const actionsDisplay = document.getElementById('actions-display');
    const actionsLeftEl = document.getElementById('actions-left');
    const actionsHint = document.getElementById('actions-hint');
    if (actionsLeftEl) actionsLeftEl.textContent = actionsLeft;
    if (actionsDisplay) {
      const pipWrap = actionsDisplay.querySelector('.action-pips');
      if (pipWrap && pipWrap.children.length !== actionsMax) {
        pipWrap.innerHTML = Array.from({ length: actionsMax }, () => '<span class="action-pip"></span>').join('');
      }
      actionsDisplay.classList.toggle('actions-empty', actionsLeft <= 0 && G.phase !== 'over');
      actionsDisplay.classList.toggle('actions-low', actionsLeft === 1);
      actionsDisplay.querySelectorAll('.action-pip').forEach((pip, index) => {
        pip.classList.toggle('filled', index < actionsLeft);
      });
    }
    if (actionsHint) {
      actionsHint.textContent = actionsLeft <= 0
        ? '今天已行動完'
        : `還能行動 ${actionsLeft} 次`;
    }
    const turnEndFloat = document.getElementById('turn-end-float');
    if (turnEndFloat) {
      turnEndFloat.classList.toggle('visible', actionsLeft <= 0 && !G.modal && G.phase !== 'over');
    }
    const darkness = Math.max(0, G.darkness || 0);
    const meterMax = CONFIG.DARKNESS_MAX_THRESHOLD || CONFIG.DARKNESS_DEVOUR_THRESHOLD || 20;
    const darkMonsters = Array.isArray(G.darkMonsters) ? G.darkMonsters : [];
    const criticalDarkMonsters = darkMonsters.filter(monster =>
      monster?.pendingChase === true || (monster?.chaseTimer || 0) <= 1
    ).length;
    const light = 0;
    const darknessLabel = document.getElementById('darkness-label');
    const darknessNum = document.getElementById('darkness-num');
    const darknessFill = document.getElementById('darkness-bar-fill');
    const darknessDisplay = document.getElementById('darkness-display');
    const lightChargesDisplay = document.getElementById('light-charges-display');
    if (darknessLabel) darknessLabel.textContent = '黑暗';
    if (darknessNum) darknessNum.textContent = `${darkness} / ${meterMax}`;
    if (lightChargesDisplay) {
      lightChargesDisplay.textContent = G.phase === 'night' && (G.lightCharges || 0) > 0
        ? `光明護火 ${G.lightCharges}`
        : '';
    }
    if (darknessLabel) darknessLabel.textContent = '\u9ed1\u6697';
    if (lightChargesDisplay) lightChargesDisplay.textContent = `黑暗化身 ${darkMonsters.length}｜危急 ${criticalDarkMonsters}`;
    if (darknessFill) darknessFill.style.width = `${Math.min(100, (darkness / meterMax) * 100)}%`;
    if (darknessDisplay) {
      darknessDisplay.classList.toggle('light', false);
      darknessDisplay.classList.toggle('alert', darkness >= CONFIG.DARKNESS_BOSS_THRESHOLD);
      darknessDisplay.classList.toggle('critical', darkness >= CONFIG.DARKNESS_CORRUPT_THRESHOLD);
    }

    const phaseEl = document.getElementById('phase-label');
    if (G.phase === 'day') {
      phaseEl.textContent = '白日探索期';
      phaseEl.className = 'phase-day';
    } else if (G.phase === 'night') {
      phaseEl.textContent = '黑夜降臨';
      phaseEl.className = 'phase-night';
    } else if (G.phase === 'dawn') {
      phaseEl.textContent = '黎明';
      phaseEl.className = 'phase-dawn';
    }

    const endDayBtn = document.getElementById('btn-end-day');
    endDayBtn.disabled = G.phase === 'over' || G.actionsLeft > 0;
    endDayBtn.title = G.actionsLeft > 0 ? '必須先用完今天的行動力' : '';
    endDayBtn.classList.toggle('end-day-ready', G.actionsLeft <= 0 && G.phase !== 'over');
    endDayBtn.textContent = '結束今天';

    const devBtn = document.getElementById('btn-dev-tool');
    if (devBtn) {
      devBtn.disabled = G.phase === 'over';
      devBtn.title = '開發測試用：自由新增聖物、武器與裝備';
    }
  },

  // Section.
  renderMap() {
    const grid = document.getElementById('map-grid');
    const size = CONFIG.MAP_SIZE;
    this._ensureRenderableMap(size);
    if (typeof Game !== 'undefined' && Game._refreshRestPoints) Game._refreshRestPoints();
    const darkMonsterMap = this._darkMonsterMap();

    // Section.
    grid.innerHTML = '';

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = G.map[y][x];
        const el = document.createElement('div');
        el.className = 'map-cell';
        el.dataset.x = x;
        el.dataset.y = y;

        const isPlayer = (x === G.playerX && y === G.playerY);
        const isHiddenRescue = cell.content?.reward === 'rescue' && !cell.rescueRevealed && !isPlayer;

        if (!cell.revealed || isHiddenRescue) {
          el.classList.add('fog');
          el.title = '迷霧尚未揭開';
        } else {
          el.classList.add(`type-${cell.type}`);
          if (cell.cleared) {
            el.classList.add('cleared');
          }

          if (isPlayer) {
            el.classList.add('has-player');
          }

          if (cell.content?.reward === 'rescue') {
            el.classList.add('rescue-target');
          }
          if (cell.content?.reward === 'echo_site') {
            el.classList.add('echo-site-target');
          }
          if (cell.corrupted) {
            el.classList.add('corrupted');
          }

          // Section.
          if (!isPlayer && MapGen.isAdjacent(G.playerX, G.playerY, x, y)) {
            el.classList.add('adjacent-highlight');
          }

          // Section.
          const icon = this._cellIcon(cell, isPlayer);
          const label = this._cellLabel(cell, isPlayer);

          if (icon) {
            const iconEl = document.createElement('div');
            iconEl.className = 'cell-icon';
            iconEl.textContent = icon;
            el.appendChild(iconEl);
          }

          if (label) {
            const labelEl = document.createElement('div');
            labelEl.className = 'cell-label';
            labelEl.textContent = label;
            el.appendChild(labelEl);
          }

          if (cell.droppedRelics?.length > 0) {
            const dropBadge = document.createElement('div');
            dropBadge.className = 'cell-drop-badge';
            dropBadge.textContent = cell.droppedRelics.some(relic => relic?._droppedBy) ? '📦' : '💎';
            dropBadge.title = cell.droppedRelics.some(relic => relic?._droppedBy) ? '此處有遺落物' : '此處有掉落聖物';
            el.appendChild(dropBadge);
          }

          // Section.
          const terrainTypes = ['forest','ruins','cave'];
          if (!isPlayer && !cell.cleared && !cell.visited && terrainTypes.includes(cell.type)) {
            const badge = document.createElement('div');
            badge.className = 'cell-q-badge';
            badge.textContent = '?';
            el.appendChild(badge);
          }

          const restCooldown = this._restCooldownRemaining(cell);
          if (restCooldown > 0) {
            const badge = document.createElement('div');
            badge.className = 'rest-cooldown-badge';
            badge.textContent = restCooldown;
            el.appendChild(badge);
          }

          el.title = this._cellTooltip(cell, isPlayer);
        }

        const darkMonsterEntry = darkMonsterMap.get(`${x},${y}`);
        if (darkMonsterEntry) {
          this._appendDarkMonster(el, darkMonsterEntry);
        }

        if (G.mapMoveLocked) el.classList.add('move-locked');
        el.addEventListener('click', () => Game.handleCellClick(x, y));
        grid.appendChild(el);
      }
    }
  },

  animatePlayerMove(fromX, fromY, toX, toY, onDone = null) {
    const grid = document.getElementById('map-grid');
    const fromCell = grid?.querySelector(`.map-cell[data-x="${fromX}"][data-y="${fromY}"]`);
    const toCell = grid?.querySelector(`.map-cell[data-x="${toX}"][data-y="${toY}"]`);
    if (!fromCell || !toCell) {
      onDone?.();
      return;
    }
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const runner = document.createElement('div');
    runner.className = 'map-player-runner';
    runner.textContent = (G.squad || []).slice(0, 3).map(c => CHARACTER_CLASSES[c.cls]?.icon || '●').join('');
    runner.style.left = `${fromRect.left + fromRect.width / 2}px`;
    runner.style.top = `${fromRect.top + fromRect.height / 2}px`;
    document.body.appendChild(runner);
    fromCell.classList.add('move-origin');
    toCell.classList.add('move-destination');

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      runner.remove();
      fromCell.classList.remove('move-origin');
      toCell.classList.remove('move-destination');
      onDone?.();
    };
    const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
    const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
    runner.addEventListener('transitionend', finish, { once: true });
    requestAnimationFrame(() => {
      runner.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(1.05)`;
    });
    setTimeout(finish, 340);
  },

  _ensureRenderableMap(size = CONFIG.MAP_SIZE) {
    const isValidMap = Array.isArray(G.map)
      && G.map.length === size
      && G.map.every(row => Array.isArray(row) && row.length === size && row.every(cell => cell && Number.isInteger(cell.x) && Number.isInteger(cell.y)));
    if (isValidMap) return;

    G.map = MapGen.generate();
    const center = Math.floor(size / 2);
    if (!Number.isInteger(G.playerX) || G.playerX < 0 || G.playerX >= size) G.playerX = center;
    if (!Number.isInteger(G.playerY) || G.playerY < 0 || G.playerY >= size) G.playerY = center;
    Game._revealAround?.(G.playerX, G.playerY);
    Game._log?.('地圖資料異常，已自動重建目前區域。', 'danger');
  },

  _darkMonsterMap() {
    const byCell = new Map();
    if (!Array.isArray(G.darkMonsters)) return byCell;

    for (const monster of G.darkMonsters) {
      if (!monster || !Number.isFinite(monster.x) || !Number.isFinite(monster.y)) continue;
      const key = `${monster.x},${monster.y}`;
      const entry = byCell.get(key);
      const level = monster.level || 0;

      if (!entry) {
        byCell.set(key, { monster, count: 1 });
      } else {
        entry.count += 1;
        if (level > (entry.monster.level || 0)) {
          entry.monster = monster;
        }
      }
    }

    return byCell;
  },

  _restCooldownRemaining(cell) {
    if (typeof Game !== 'undefined' && Game._restCooldownRemaining) {
      return Game._restCooldownRemaining(cell);
    }
    if (!cell || cell.type !== 'rest' || !cell.cleared) return 0;
    const refreshDays = CONFIG.REST_REFRESH_DAYS || 5;
    if (!Number.isFinite(cell.restUsedDay)) return refreshDays;
    return Math.max(0, refreshDays - (G.day - cell.restUsedDay));
  },

  _appendDarkMonster(el, entry) {
    const monster = entry.monster;
    const badge = document.createElement('div');
    badge.className = `dark-monster ${this._darkMonsterTimerClass(monster)}`;
    badge.title = `Dark monster level ${monster.level || 0}`;

    const icon = document.createElement('span');
    icon.className = 'dark-monster-icon';
    const img = document.createElement('img');
    img.src = this.DARK_MONSTER_ICON_SRC;
    img.alt = '';
    icon.appendChild(img);
    badge.appendChild(icon);

    const level = document.createElement('span');
    level.className = 'dark-monster-level';
    level.textContent = monster.level || 0;
    badge.appendChild(level);

    if (entry.count > 1) {
      const count = document.createElement('span');
      count.className = 'dark-monster-count';
      count.textContent = `x${entry.count}`;
      badge.appendChild(count);
    }

    el.appendChild(badge);
  },

  _darkMonsterTimerClass(monster) {
    if (monster.pendingChase || monster.chaseTimer <= 0) return 'timer-danger';
    if (monster.chaseTimer === 1) return 'timer-red';
    if (monster.chaseTimer === 2) return 'timer-yellow';
    return 'timer-green';
  },

  _cellIcon(cell, isPlayer) {
    if (isPlayer) {
      return (G.squad || []).slice(0, 3).map(c => CHARACTER_CLASSES[c.cls]?.icon || '●').join('');
    }
    if (cell.reserved) return '📌';
    if (cell.cleared) {
      if (cell.droppedRelics?.length > 0) return cell.droppedRelics.some(relic => relic?._droppedBy) ? '📦' : '💎';
      const clearedIcons = { enemy: '☠️', altar: '', rest: '', forest: '', ruins: '', cave: '' };
      return clearedIcons[cell.type] || '';
    }
    if (cell.droppedRelics?.length > 0 && cell.type === 'empty') return cell.droppedRelics.some(relic => relic?._droppedBy) ? '📦' : '💎';
    if (cell.corrupted) return '☣️';
    if (cell.content?.reward === 'rescue') return '🗝️';
    if (cell.content?.reward === 'echo_site') return '◆';
    if (cell.type === 'enemy')  return '⚔️';
    if (cell.type === 'chest')  return '🧰';
    if (cell.type === 'relic')  return '💎';
    if (cell.type === 'rest')   return G.phase === 'night' ? '🔥' : '';
    if (cell.type === 'altar')  return '';
    if (cell.type === 'forest') return '';
    if (cell.type === 'ruins')  return '';
    if (cell.type === 'cave')   return '';
    return '';
  },

  _cellLabel(cell, isPlayer) {
    if (isPlayer) return '';
    if (cell.cleared) {
      if (cell.droppedRelics?.length > 0) return cell.droppedRelics.some(relic => relic?._droppedBy) ? '遺落物' : '聖物';
      if (['forest','ruins','cave','enemy','relic','chest'].includes(cell.type)) return '已清';
      return '';
    }
    if (cell.type === 'altar' && cell.visited)  return '神壇';
    if (cell.type === 'rest')  return G.phase === 'night' ? '殘火' : '休息';
    if (cell.content?.reward === 'rescue') return '頭目';
    if (cell.content?.reward === 'echo_site') return this._cellEchoLabel(cell);
    if (cell.type === 'enemy') return '';
    if (cell.type === 'relic') return '';
    return '';
  },

  _cellTooltip(cell, isPlayer) {
    if (isPlayer) {
      if (cell.type === 'altar') return `小隊位置 (${cell.x}, ${cell.y})，可原地開啟神壇`;
      if (cell.type === 'rest') return `小隊位置 (${cell.x}, ${cell.y})，可原地休息`;
      if (cell.type === 'relic' || cell.droppedRelics?.length > 0) return `小隊位置 (${cell.x}, ${cell.y})，可原地拾取`;
      return `小隊位置 (${cell.x}, ${cell.y})`;
    }
    if (cell.reserved) return '已標記，再次進入可觸發保留的事件';
    if (cell.droppedRelics?.length > 0) {
      return cell.droppedRelics.some(relic => relic?._droppedBy)
        ? '遺落物，倒下者復活後才能取回'
        : '掉落聖物，回到此處可拾取';
    }
    const restCooldown = this._restCooldownRemaining(cell);
    if (restCooldown > 0) return `休息點恢復中，還有 ${restCooldown} 天重新點燃`;
    if (cell.cleared) return '已探索';
    if (cell.corrupted) return '腐化空地，黑夜踏入會遭伏擊';
    if (cell.content?.reward === 'rescue') return '救援頭目，擊敗後可解救角色';
    if (cell.content?.reward === 'echo_site') return `${cell.content?.echoSiteName || '共鳴遺址'}，擊敗守護者可獲得${cell.content?.echoSystemName || '共鳴'}聖物`;
    if (cell.type === 'enemy') return '敵人';
    if (cell.type === 'chest') return '寶箱';
    if (cell.type === 'relic') return '聖物';
    if (cell.type === 'rest')  return G.phase === 'night' ? '殘火點，可治療或點燃火把' : '休息點，回血';
    if (cell.type === 'altar' && cell.visited) return '神壇，血祭 / 融合';
    if (cell.visited) return '已探索，無事';
    return '未知';
  },

  _cellEchoLabel(cell) {
    const name = cell?.content?.echoSystemName || '';
    const shortName = name.replace(/體系$/, '系').trim();
    return shortName || '共鳴';
  },

  // Section.
  _charStatus(char) {
    if (char.dead) return char.deathLocation ? `死亡（遺落物 ${char.deathLocation.x},${char.deathLocation.y}）` : '死亡';
    const block = typeof CombatStatus !== 'undefined' ? CombatStatus.getBlock(char) : Math.max(0, char._block || char._shield || 0);
    if (block > 0) return `格檔 ${block}`;
    const pct = char.maxHp > 0 ? char.hp / char.maxHp : 0;
    if (pct <= 0.25) return '瀕死';
    if (pct <= 0.5)  return '重傷';
    if (pct <= 0.75) return '輕傷';
    return '正常';
  },

  _charStatusClass(char) {
    if (char.dead) return 'status-dead';
    const pct = char.maxHp > 0 ? char.hp / char.maxHp : 0;
    if (pct <= 0.25) return 'status-critical';
    if (pct <= 0.5)  return 'status-low';
    const block = typeof CombatStatus !== 'undefined' ? CombatStatus.getBlock(char) : Math.max(0, char._block || char._shield || 0);
    if (block > 0) return 'status-shield';
    return 'status-ok';
  },

  _passiveDesc(cls) {
    const map = {
      warrior:  '戰鬥骰最低 3',
      explorer: '主戰未命中原生弱點後標記可疑弱點；之後差 1 命中原生弱點時可消耗，視為命中',
      scholar:  '主戰攻擊時，單數視為命中破綻，並刷新敵人破綻且本次傷害 +1；雙數獲得 1 層反噬，下一次受擊流程受到的傷害每層 +20%，最多 3 層，觸發後清空',
      support:  '若輔助不是主戰者，主戰者本回合第一次攻擊傷害 +1；若主戰者本回合受到敵人攻擊，該次傷害 -1',
    };
    return map[cls] || '';
  },

  _passiveShortDesc(cls) {
    const map = {
      warrior:  '戰鬥骰最低 3',
      explorer: '未命中後標記可疑弱點',
      scholar:  '單數視為破綻；雙數疊反噬',
      support:  '非主戰時支援攻防',
    };
    return map[cls] || this._passiveDesc(cls);
  },

  _charPortraitHtml(char, cls, size = 'card') {
    const src = size === 'card' ? (char?.avatar || char?.portrait) : (char?.portrait || char?.avatar);
    if (src) {
      return `<span class="char-portrait ${size}"><img src="${src}" alt="${char.name}"></span>`;
    }
    return `<span class="card-icon">${cls.icon}</span>`;
  },

  _classAvatarHtml(clsId, cls, className = 'class-card-icon') {
    const avatar = typeof CLASS_AVATARS !== 'undefined' ? CLASS_AVATARS[clsId] : '';
    if (avatar) return `<span class="${className} class-avatar"><img src="${avatar}" alt="${cls.name}"></span>`;
    return `<span class="${className}">${cls.icon}</span>`;
  },

  _charResonanceNames(char) {
    if (!char) return [];
    const names = [];
    for (const res of (G.activeResonances || [])) {
      if (res.isBody && res.bodyChar?.id === char.id) names.push(res.name);
    }
    const add = name => { if (!names.includes(name)) names.push(name); };
    if (char.fusedRelic?.id === 'wager_dice' && char.relic?.id === 'lucky_star') add('十二面命運骰');
    if (char.fusedRelic?.id === 'lucky_star' && char.relic?.id === 'wager_dice') add('十二面幸運骰');
    if (char.fusedRelic?.id === 'eagle_eye_feather' && char.relic?.id === 'flaw_lens') add('獵星之眼');
    if (char.fusedRelic?.id === 'flaw_lens' && char.relic?.id === 'eagle_eye_feather') add('裂星破滅');
    return names;
  },

  _charResonanceHtml(char) {
    const resonances = (G.activeResonances || []).filter(res => res.isBody && res.bodyChar?.id === char?.id);
    const names = this._charResonanceNames(char);
    const entries = names.map(name => {
      const res = resonances.find(r => r.name === name);
      return { name, desc: res?.effect?.desc || '' };
    });
    if (entries.length === 0) return '';
    return `
      <div class="card-row card-resonance-row">
        <span class="card-label">共鳴</span>
        <span class="card-val card-resonance-tags">${entries.map(entry => `<span class="card-resonance-tag" title="${entry.desc}">${entry.name}</span>`).join('')}</span>
      </div>
    `;
  },

  _enemyIconHtml(enemy) {
    if (enemy?.iconImage) {
      const flipClass = enemy.iconFlipX ? ' flip-x' : '';
      const scaleClass = enemy.iconScale === 'large' ? ' large' : '';
      const softClass = enemy.iconSoftEdge ? ' soft-edge' : '';
      return `<img class="combat-enemy-img${flipClass}${scaleClass}${softClass}" src="${enemy.iconImage}" alt="${enemy.name}">`;
    }
    return enemy?.icon || '⚔️';
  },

  renderSquad() {
    const list = document.getElementById('squad-list');
    list.innerHTML = '';
    if (typeof Game !== 'undefined' && Game._ensureInventory) Game._ensureInventory();

    for (const char of G.squad) {
      const cls = CHARACTER_CLASSES[char.cls];
      if (!cls) continue;
      const hpPct = char.dead ? 0 : (char.maxHp > 0 ? (char.hp / char.maxHp) * 100 : 0);
      const hpClass = char.dead ? 'critical' : hpPct <= 25 ? 'critical' : hpPct <= 50 ? 'low' : '';
      const threat = G.combat?.threat?.[char.id] || 0;

      // 聖物區塊
      const relicHtml = (() => {
        if (!char.relic && !char.fusedRelic) return `<span class="card-val dim">無</span>`;
        const parts = [];
        if (char.fusedRelic) {
          parts.push(`<span class="card-relic-name fused">🔮 ${char.fusedRelic.icon} ${char.fusedRelic.name}</span>
            <button class="btn-tiny" onclick="Game.showRelicDetail('${char.id}','fusedRelic')">查看</button>`);
        }
        if (char.relic) {
          parts.push(`<span class="card-relic-name">${char.relic.icon} ${char.relic.name}</span>
            <button class="btn-tiny" onclick="Game.showRelicDetail('${char.id}','relic')">查看</button>`);
        }
        return parts.join('<br>');
      })();

      const weaponHtml = char.weapon
        ? `<div class="card-item-name" title="${char.weapon.desc}">${char.weapon.icon} ${char.weapon.name}</div>`
        : `<span class="dim">無武器</span>`;
      const gearHtml = char.gear
        ? `<div class="card-item-name" title="${char.gear.desc}">${char.gear.icon} ${char.gear.name}</div>`
        : `<span class="dim">無裝備</span>`;

      const card = document.createElement('div');
      card.className = `char-card cls-${char.cls}${char.dead ? ' dead' : ''}`;
      card.innerHTML = `
        <div class="card-title-row">
          ${this._charPortraitHtml(char, cls)}
          <span class="card-name">${char.name}</span>
          <span class="card-cls">${cls.name}｜攻擊 ${char.attack ?? cls.attack ?? 0}</span>
          <div class="card-hp-wrap">
            <div class="hp-bar"><div class="hp-fill ${hpClass}" style="width:${hpPct}%"></div></div>
            <span class="hp-text">${char.hp}/${char.maxHp}</span>
          </div>
        </div>
        <div class="card-body-grid">
          <div class="card-col-left">
            <div class="card-row">
              <span class="card-label">狀態</span>
              <span class="card-val ${this._charStatusClass(char)}">${this._charStatus(char)}${threat > 0 ? `　仇恨 ${threat}/10` : ''}</span>
            </div>
            <div class="card-row">
              <span class="card-label">被動</span>
              <span class="card-val" title="${this._passiveDesc(char.cls)}">${this._passiveShortDesc(char.cls)}</span>
            </div>
            <div class="card-row">
              <span class="card-label">聖物</span>
              <span class="card-val">${relicHtml}</span>
            </div>
            ${this._charResonanceHtml(char)}
          </div>
          <div class="card-col-right">
            <div class="card-slot">
              <div class="card-slot-label">武器</div>
              ${weaponHtml}
            </div>
            <div class="card-slot">
              <div class="card-slot-label">裝備</div>
              ${gearHtml}
            </div>
          </div>
        </div>
      `;
      card.addEventListener('click', ev => {
        if (ev.target.closest('button')) return;
        Game.showCharacterDetail(char.id);
      });
      list.appendChild(card);
    }

    if (G.squad.length < CONFIG.MAX_SQUAD_SIZE) {
      const slot = document.createElement('div');
      slot.className = 'char-slot-empty';
      slot.textContent = '空位：可透過救援事件招募隊友';
      list.appendChild(slot);
    }

    const bag = document.createElement('div');
    bag.className = 'inventory-panel';
    const inventory = Array.isArray(G.inventory) ? G.inventory : [];
    const maxItems = CONFIG.MAX_INVENTORY_ITEMS || 3;
    const slots = [];
    for (let i = 0; i < maxItems; i++) {
      const slot = inventory[i];
      const item = slot?.item || slot;
      const count = slot?.count || 1;
      const countText = count > 1 ? ` x${count}` : '';
      slots.push(item
        ? `<div class="inventory-slot filled">
            <div class="inventory-item-main">${item.icon} ${item.name}${countText}</div>
            <div class="inventory-item-desc">${item.desc}</div>
            <button class="btn-tiny" onclick="Game.useInventoryItem(${i})">${item.useType === 'instant' ? '使用' : '激活'}</button>
          </div>`
        : `<div class="inventory-slot empty">空</div>`);
    }
    bag.innerHTML = `
      <div class="inventory-title">小隊背包 <span>${inventory.length}/${maxItems}</span></div>
      <div class="inventory-grid">${slots.join('')}</div>
    `;
    list.appendChild(bag);
  },

  // Section.
  renderRelics() {
    const list = document.getElementById('relic-list');
    list.innerHTML = '';

    const resonanceIds = new Set();
    for (const res of G.activeResonances) {
      for (const id of res.relics) resonanceIds.add(id);
    }

    for (const char of G.squad) {
      const relicSlots = [
        { relic: char.relic, slot: 'relic' },
        { relic: char.fusedRelic, slot: 'fusedRelic' },
      ].filter(item => item.relic);

      for (const { relic, slot } of relicSlots) {
        const item = document.createElement('div');
        item.className = `relic-item${resonanceIds.has(relic.id) ? ' resonating' : ''}`;
        item.innerHTML = `
          <span class="relic-icon">${relic.icon}</span>
          <span class="relic-name">${relic.name}</span>
          <span class="relic-effect">${typeof relicEffectDesc === 'function' ? relicEffectDesc(relic, slot === 'fusedRelic') : relic.desc}</span>
          <span class="relic-holder">${char.name}${slot === 'fusedRelic' ? '（已融合）' : ''}</span>
          <button class="btn-tiny" onclick="Game.showRelicDetail('${char.id}', '${slot}')">查看</button>
        `;
        item.title = typeof relicEffectDesc === 'function' ? relicEffectDesc(relic, slot === 'fusedRelic') : relic.desc;
        list.appendChild(item);
      }
    }

    if (list.children.length === 0) {
      list.innerHTML = '<div class="relic-empty">目前沒有聖物</div>';
    }

  },

  // Section.
  renderEffects() {
    const el = document.getElementById('effects-panel');
    if (!el) return;
    const items = [];

    if (G.torchActive > 0)
      items.push(`火把照明：剩餘 ${G.torchActive} 次移動`);
    for (const m of G.combatMods)
      items.push(`戰鬥道具：${m.type === 'attack_bonus' ? `攻擊骰 +${m.value}` : `受傷 -${m.value}`}（${m.source}）`);
    for (const m of G.rollMods)
      items.push(`擲骰修正：${m.type === 'reroll_keep_high' ? '重骰取高' : `1 視為 ${m.value}`}（${m.source}）`);
    if (G.explorerReserved)
      items.push(`路標標記：(${G.explorerReserved.x}, ${G.explorerReserved.y}) 可再次觸發`);
    else if (G.explorerCooldownExpires > G.day && G.squad.some(c => c.cls === 'explorer'))
      items.push(`路標冷卻：第 ${G.explorerCooldownExpires} 天恢復`);

    el.innerHTML = '';
    if (items.length === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `<h3>狀態效果</h3>${items.map(t => `<div class="effect-tag">${t}</div>`).join('')}`;
  },

  // Section.
  renderResonances() {
    let el = document.getElementById('resonance-panel');
    if (!el) return;
    el.innerHTML = '';
    for (const res of G.activeResonances) {
      const item = document.createElement('div');
      item.className = 'resonance-item';
      item.innerHTML = `🔮 <b>${res.name}</b>（${res.isBody ? '同身' : '隊伍'}）<br><span class="resonance-desc">${res.effect.desc}</span>`;
      el.appendChild(item);
    }
    el.style.display = G.activeResonances.length > 0 ? 'block' : 'none';
  },

  // Section.
  renderLog() {
    const container = document.getElementById('log-messages');
    container.innerHTML = '';

    // Section.
    const dayMap = new Map();
    for (const entry of G.log) {
      const d = entry.day ?? 0;
      if (!dayMap.has(d)) dayMap.set(d, []);
      dayMap.get(d).push(entry);
    }
    const sortedDays = [...dayMap.keys()].sort((a, b) => b - a);

    for (const day of sortedDays) {
      const entries = dayMap.get(day);
      const isCurrent = day === (G.day ?? 0);

      if (isCurrent) {
        // Section.
        const header = document.createElement('div');
        header.className = 'log-day-header';
        header.textContent = day > 0 ? `第 ${day} 天` : '序章';
        container.appendChild(header);
        for (const entry of entries) {
          const el = document.createElement('div');
          el.className = `log-msg ${entry.type || ''}`;
          el.textContent = entry.msg;
          container.appendChild(el);
        }
      } else {
        // 舊日誌折疊
        const details = document.createElement('details');
        details.className = 'log-day-group';
        const summary = document.createElement('summary');
        summary.className = 'log-day-summary';
        summary.textContent = day > 0 ? `第 ${day} 天` : '序章';
        details.appendChild(summary);
        for (const entry of entries) {
          const el = document.createElement('div');
          el.className = `log-msg ${entry.type || ''}`;
          el.textContent = entry.msg;
          details.appendChild(el);
        }
        container.appendChild(details);
      }
    }
  },

  // Section.
  showNightTransition() {
    const overlay = document.getElementById('night-overlay');
    if (!overlay) return;
    overlay.style.opacity = '1';
    setTimeout(() => { overlay.style.opacity = '0'; }, 2000);
  },

  // Section.
  updatePhaseClass() {
    const screen = document.getElementById('game-screen');
    screen.classList.toggle('night-mode', G.phase === 'night');
    screen.classList.toggle('dawn-mode', G.phase === 'dawn');
  },

  _hideCombatTip() {
    const tip = document.getElementById('combat-float-tip');
    if (tip) tip.classList.remove('visible');
  },

  // Section.
  // Modal and combat scene rendering methods live in js/ui/modal-render.js.

  playGameOverIntro(result, state, onDone = null) {
    document.getElementById('event-modal')?.classList.add('hidden');
    document.getElementById('notes-modal')?.classList.add('hidden');
    document.getElementById('squad-select-modal')?.classList.add('hidden');

    const overlay = document.getElementById('gameover-intro');
    if (!overlay) {
      onDone?.();
      return;
    }
    overlay.className = 'gameover-intro';
    overlay.innerHTML = '<div class="gameover-intro-red"></div><img src="assets/game-over-bg.png" alt="GAME OVER">';
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('active');

    window.setTimeout(() => overlay.classList.add('fade-image'), 1200);
    window.setTimeout(() => {
      overlay.classList.remove('active', 'fade-image');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '';
      onDone?.();
    }, 2600);
  },

  showGameOver(result, state) {
    document.getElementById('event-modal')?.classList.add('hidden');
    document.getElementById('notes-modal')?.classList.add('hidden');
    document.getElementById('squad-select-modal')?.classList.add('hidden');

    document.getElementById('game-screen').style.display = 'none';
    const screen = document.getElementById('gameover-screen');
    screen.style.display = 'flex';
    screen.classList.add('active');
    screen.classList.toggle('gameover-failure', result === 'lose' || result === 'devoured');

    const titles = {
      lose: '全滅',
      evacuate: '撤離成功',
      dawn: '黎明抵達',
      devoured: '黑暗吞噬',
    };
    const descs = {
      lose: '小隊倒在黑夜邊境之中。',
      evacuate: '你們帶著殘存的火光撤離了邊境。',
      dawn: '黑夜退去，黎明終於抵達。',
      devoured: '黑暗值達到極限，邊境吞沒了一切。',
    };

    const titleEl = document.getElementById('gameover-title');
    const titleText = result === 'lose' ? '' : (titles[result] || '旅程結束');
    titleEl.textContent = titleText;
    titleEl.hidden = !titleText;
    document.getElementById('gameover-desc').textContent = descs[result] || '';

    const survived = state.squad.map(c => c.name).join('、') || '無';
    const relics = state.squad.flatMap(c => [c.relic, c.fusedRelic].filter(Boolean)).map(r => r.name).join('、') || '無';

    document.getElementById('gameover-results').innerHTML = `
      <div class="gameover-result-line"><span>倖存者：${survived}</span><span>攜帶聖物：${relics}</span></div>
      <div>存活天數：${state.day} 天</div>
      ${state.libraryUnlocked && !state.libraryUnlockedAtStart ? '<div style="color:var(--accent)">聖物庫已解鎖</div>' : ''}
    `;
  },

  // Section.
  _renderCharDetail(clsId, panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const cls = CHARACTER_CLASSES[clsId];
    if (!cls) return;

    const weaponId = _CLASS_DEFAULT_WEAPON?.[clsId];
    const gearId   = _CLASS_DEFAULT_GEAR?.[clsId];
    const weapon   = weaponId ? WEAPONS.find(w => w.id === weaponId) : null;
    const gear     = gearId   ? GEARS.find(g => g.id === gearId)    : null;
    const detailIcon = this._classAvatarHtml(clsId, cls, 'char-detail-icon');

    panel.innerHTML = `
      <div class="char-detail">
        <div class="char-detail-header">
          ${detailIcon}
          <div>
            <div class="char-detail-name">${cls.name}</div>
            <div class="char-detail-flavor">${cls.desc}</div>
          </div>
        </div>

        <div class="char-detail-section">
          <div class="char-detail-row"><span class="detail-label">HP</span><span>${cls.maxHp}</span></div>
          <div class="char-detail-row"><span class="detail-label">攻擊</span><span>${cls.attack}</span></div>
        </div>

        <div class="char-detail-section">
          <div class="char-detail-section-title">職業被動</div>
          <div class="char-detail-passive-name">${cls.passiveDesc}</div>
        </div>

        ${weapon ? `
        <div class="char-detail-section">
          <div class="char-detail-section-title">武器欄</div>
          <div class="char-detail-item">
            <div class="char-detail-item-name">${weapon.icon} ${weapon.name}</div>
            <div class="char-detail-item-desc">${weapon.desc}</div>
          </div>
        </div>` : ''}

        ${gear ? `
        <div class="char-detail-section">
          <div class="char-detail-section-title">裝備欄</div>
          <div class="char-detail-item">
            <div class="char-detail-item-name">${gear.icon} ${gear.name}</div>
            <div class="char-detail-item-desc">${gear.desc}</div>
          </div>
        </div>` : ''}
      </div>
    `;
  },

  // Section.
  renderSquadSelect(container, selected, onToggle, libraryRelics = [], selectedLibraryRelicId = null, onLibraryToggle = null, selectedLibraryCarrierCls = null, onCarrierToggle = null) {
    container.innerHTML = '';

    // Section.
    if (selected[0]) {
      this._renderCharDetail(selected[0], 'squad-detail-left');
    } else {
      const lp = document.getElementById('squad-detail-left');
      if (lp) lp.innerHTML = '<div class="char-detail-placeholder">將滑鼠移到角色卡上</div>';
    }
    if (selected[1]) {
      this._renderCharDetail(selected[1], 'squad-detail-right');
    } else {
      const rp = document.getElementById('squad-detail-right');
      if (rp) rp.innerHTML = '<div class="char-detail-placeholder">選擇第二位角色後顯示</div>';
    }
    for (const [clsId, cls] of Object.entries(CHARACTER_CLASSES)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `class-card${selected.includes(clsId) ? ' selected' : ''}`;
      card.innerHTML = `
        ${this._classAvatarHtml(clsId, cls)}
        <div class="class-card-name">${cls.name}</div>
        <div class="class-card-desc">${cls.desc}</div>
        <div class="class-card-stat">HP ${cls.maxHp}　攻擊 ${cls.attack}</div>
      `;
      card.addEventListener('click', () => onToggle(clsId));
      card.addEventListener('mouseenter', () => {
        // Section.
        if (selected.length === 0) {
          this._renderCharDetail(clsId, 'squad-detail-left');
        } else if (selected.length === 1 && !selected.includes(clsId)) {
          this._renderCharDetail(clsId, 'squad-detail-right');
        }
      });
      container.appendChild(card);
    }

    if (libraryRelics.length > 0 && onLibraryToggle) {
      const section = document.createElement('div');
      section.className = 'library-pick-section';
      section.innerHTML = `
        <h3>聖物庫</h3>
        <p>選擇 1 件已收藏的聖物作為起始攜帶物。</p>
      `;

      const list = document.createElement('div');
      list.className = 'library-pick-list';
      for (const relic of libraryRelics) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `library-pick-card${selectedLibraryRelicId === relic.id ? ' selected' : ''}`;
        item.innerHTML = `
          <span>${relic.icon} ${relic.name}</span>
          <small>${relic.desc}</small>
        `;
        item.addEventListener('click', () => onLibraryToggle(relic.id));
        list.appendChild(item);
      }
      section.appendChild(list);

      // 選擇起始聖物攜帶者
      if (selectedLibraryRelicId && selected.length > 0 && onCarrierToggle) {
        const carrierSection = document.createElement('div');
        carrierSection.className = 'library-carrier-section';
        carrierSection.innerHTML = `<p style="margin:10px 0 6px;color:var(--text-dim);font-size:.9em">選擇攜帶者</p>`;
        const carrierList = document.createElement('div');
        carrierList.className = 'library-pick-list';
        for (const clsId of selected) {
          const cls = CHARACTER_CLASSES[clsId];
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `library-pick-card${selectedLibraryCarrierCls === clsId ? ' selected' : ''}`;
          btn.innerHTML = `${this._classAvatarHtml(clsId, cls, 'library-carrier-avatar')}<span>${cls.name}</span>`;
          btn.addEventListener('click', () => onCarrierToggle(clsId));
          carrierList.appendChild(btn);
        }
        carrierSection.appendChild(carrierList);
        section.appendChild(carrierSection);
      }

      container.appendChild(section);
    }
  },
};
