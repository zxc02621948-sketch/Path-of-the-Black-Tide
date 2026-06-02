// Extracted from js/ui/render.js. Keeps the original object API while making notes maintainable.
const RenderNotes = {
  showNotes() {
    const modal = document.getElementById('notes-modal');
    const content = document.getElementById('notes-content');
    if (!modal || !content) return;
    if (typeof Game !== 'undefined' && typeof Game._syncKnownRelicNotes === 'function') {
      Game._syncKnownRelicNotes();
    }
    content.innerHTML = '';

    const totalNotes = Object.values(G.notes || {}).reduce((sum, entries) => sum + entries.length, 0);
    const notesCountEl = document.getElementById('notes-count');
    if (notesCountEl) notesCountEl.textContent = totalNotes > 0 ? `[${totalNotes}]` : '';

    const tabs = document.createElement('div');
    tabs.className = 'notes-tabs';

    const guideTab = this._createNotesTab('遊玩指南', true);
    const relicTab = this._createNotesTab('聖物筆記');
    const terrainTab = this._createNotesTab('地形情報');
    const equipmentTab = this._createNotesTab('武器裝備');
    const rulesTab = this._createNotesTab('規則索引');
    tabs.append(guideTab, relicTab, terrainTab, equipmentTab, rulesTab);
    content.appendChild(tabs);

    const area = document.createElement('div');
    area.className = 'notes-area';
    content.appendChild(area);

    const showTab = (activeTab, render) => {
      for (const tab of [guideTab, relicTab, terrainTab, equipmentTab, rulesTab]) {
        tab.classList.toggle('active', tab === activeTab);
      }
      area.innerHTML = '';
      render.call(this, area);
      this._resetNotesScroll(modal, content, area);
    };

    guideTab.addEventListener('click', () => showTab(guideTab, this.renderGuideNotes));
    relicTab.addEventListener('click', () => showTab(relicTab, this._renderRelicNotesGrid));
    terrainTab.addEventListener('click', () => showTab(terrainTab, this._renderTerrainNotes));
    equipmentTab.addEventListener('click', () => showTab(equipmentTab, this._renderEquipmentNotes));
    rulesTab.addEventListener('click', () => showTab(rulesTab, this._renderRulesNotes));
    showTab(guideTab, this.renderGuideNotes);

    const libraryRelics = (G.library || []).filter(relic => relic?.effect?.type !== 'unlock_library');
    if (G.libraryUnlocked && libraryRelics.length > 0) {
      const libSection = document.createElement('div');
      libSection.id = 'library-section';
      libSection.innerHTML = `<h4 style="color:var(--accent);margin:14px 0 8px">聖物庫（${libraryRelics.length}）</h4>`;
      for (const relic of libraryRelics) {
        const display = this._relicDisplay(relic);
        const item = document.createElement('div');
        item.className = 'library-relic';
        item.innerHTML = `${display.iconHtml || display.icon} <span class="relic-name">${display.name}</span> <span class="relic-holder">${display.desc}</span>`;
        libSection.appendChild(item);
      }
      content.appendChild(libSection);
    }

    modal.classList.remove('hidden');
    this._resetNotesScroll(modal, content, area);
  },

  _resetNotesScroll(...elements) {
    requestAnimationFrame(() => {
      for (const el of elements) {
        if (el) el.scrollTop = 0;
      }
    });
  },

  _createNotesTab(label, active = false) {
    const tab = document.createElement('button');
    tab.className = `notes-tab${active ? ' active' : ''}`;
    tab.textContent = label;
    return tab;
  },

  _renderEquipmentNotes(container) {
    const weapons = typeof WEAPONS !== 'undefined' ? this._orderedWeaponNotes(WEAPONS) : [];
    const sections = [
      { title: '武器', items: weapons, display: item => this._weaponDisplay(item) },
      { title: '裝備', items: typeof GEARS !== 'undefined' ? GEARS : [], display: item => this._gearDisplay(item) },
      { title: '消耗品', items: typeof EQUIPMENT !== 'undefined' ? EQUIPMENT : [], display: item => this._itemDisplay(item) },
    ];

    for (const section of sections) {
      const group = document.createElement('details');
      group.className = 'equipment-note-group';
      group.open = true;

      const summary = document.createElement('summary');
      summary.className = 'equipment-note-title';
      summary.innerHTML = `<span class="equipment-note-title-text">${section.title}<em>（${section.items.length}）</em></span>`;
      group.appendChild(summary);

      const list = document.createElement('div');
      list.className = 'equipment-note-list';

      for (const item of section.items) {
        const display = section.display(item);
        const tags = [
          item.tier && item.tier > 1 ? `進階 ${item.tier}` : '',
          item.minDay ? `第 ${item.minDay} 天後` : '',
        ].filter(Boolean);

        const entry = document.createElement('div');
        entry.className = 'equipment-note-entry';
        entry.innerHTML = `
          <div class="equipment-note-head">
            <span class="equipment-note-icon">${display.iconHtml || display.icon}</span>
            <span class="equipment-note-name">${display.name}</span>
            ${tags.map(tag => `<span class="equipment-note-tag">${tag}</span>`).join('')}
          </div>
          <div class="equipment-note-desc">${display.desc}</div>
        `;
        list.appendChild(entry);
      }

      if (section.items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'notes-empty';
        empty.textContent = `尚無${section.title}資料。`;
        list.appendChild(empty);
      }

      group.appendChild(list);
      container.appendChild(group);
    }
  },

  _renderRulesNotes(container) {
    const sections = [
      {
        title: '骰子與傷害',
        items: [
          ['攻擊骰', '攻擊時擲骰，最終骰面會加上角色攻擊與各種加成後計算傷害。'],
          ['自然骰與最終骰', '自然骰是原始骰面；最終骰是保底、道具、聖物或共鳴調整後用來計算的骰面。'],
          ['最終傷害', '最終傷害會先套用武器、裝備、聖物與共鳴加成，再處理格檔、減傷與固定傷害。'],
          ['傷害向下取整', '百分比調整造成小數時向下取整；若規則寫最低值，會套用該最低值。'],
        ],
      },
      {
        title: '弱點與破綻',
        items: [
          ['原生弱點', '原生弱點代表單位身上的穩定弱點。主戰攻擊命中時傷害 +3，並會觸發敵人的破除效果；追擊仍可獲得傷害與追擊判定，但不會觸發敵人的原生弱點破除效果。'],
          ['破綻', '破綻只看最終骰面。基礎命中時傷害 +1，部分職業、聖物或共鳴會改變加成。'],
          ['破綻刷新', '產生破綻時，會排除所有目前有效的原生弱點骰面；若沒有可用骰面，該次破綻生成無效。同來源再次產生時會刷新或覆蓋原本的破綻。'],
          ['原生弱點刷新', '產生新的原生弱點時，只會避開其他原生弱點；破綻不會阻止原生弱點生成。若沒有可用骰面，該次原生弱點生成無效。'],
          ['可疑弱點', '探索者主戰未命中原生弱點時會標記可疑弱點；之後若骰面與原生弱點差 1，可能消耗標記並轉為命中原生弱點。'],
        ],
      },
      {
        title: '傷口',
        items: [
          ['傷口層數', '每 1 層傷口會使該單位受到的傷害提高 5%，目前上限通常為 15 層。'],
          ['我方傷口', '我方角色若在戰鬥中獲得傷口，只會影響該場戰鬥，下一場戰鬥會重新歸零。'],
          ['傷口爆發', '部分武器、裝備或聖物會消耗或引爆傷口，造成額外固定傷害。'],
          ['傷口流派', '痛苦面具、痛苦徽記、太刀與傷口裝備會圍繞傷口疊層、放大或爆發。'],
        ],
      },
      {
        title: '旗幟',
        items: [
          ['舉旗', '持有旗子聖物的角色主戰攻擊前，可以選擇要舉起哪一件旗，旗面會自動決定。新旗面會取代同一件旗目前的旗面。'],
          ['輔助判定', '輔助舉旗以本次攻擊骰判定：1-2 失敗，3-4 為二階，5-6 為三階。'],
          ['融合旗', '融合旗不會舉旗失敗。非輔助舉起時直接二階；輔助舉起時 1-4 二階，5-6 三階。'],
          ['雙旗戰陣', '同一角色持有戰爭旗與鷹眼旗，且其中一面已融合時，可同時維持一面戰爭旗與一面鷹眼旗。雙旗並立時戰吼旗傷害提高，且輔助獲得守勢減傷。'],
        ],
      },
      {
        title: '戰鬥節奏',
        items: [
          ['仇恨', '攻擊會提高角色仇恨，高傷害會額外增加。敵人攻擊後，被攻擊者仇恨會降低。'],
          ['格檔', '格檔是通用狀態，會先吸收受到的傷害。敵人通常由意圖產生格檔；我方目前主要由盾牌獲得格檔。'],
          ['戰鼓', '戰鼓會提供接下來幾次我方主戰攻擊加成，但持鼓者主戰時骰面附加傷害減半。'],
        ],
      },
      {
        title: '地圖與事件',
        items: [
          ['行動', '白天移動、探索與原地休息會消耗行動。夜晚黑暗化身會追擊隊伍，黑夜結束今天時黑暗會更快壯大。'],
          ['原地休息', '白天可消耗 1 行動，讓全體存活角色恢復 2 HP。無法復活倒下角色。'],
          ['黑暗化身', '黑暗化身使用固定基底，生成時會依當下黑暗層數決定強度：每 1 層黑暗使生命 +10%，每 5 層黑暗使攻擊 +1。生成後不會因黑暗繼續上升而即時變強。擊敗追殺黑暗化身只會移除該化身，不會降低黑暗；主動討伐可使黑暗 -2，並讓其他黑暗化身追殺延後 1 天。主動討伐中若本場曾命中並擊破原生弱點，額外黑暗 -1，每場最多一次。'],
          ['休息點', '休息點可以恢復生命；使用過的休息點會依照規則重新變為可用。'],
          ['神壇', '神壇每日可用一次。血祭需探索骰判定；融合聖物消耗 1 行動且必定成功。'],
          ['藏寶圖', '藏寶圖會指引一處寶箱位置。黑暗化身不應吞掉已生成的寶箱獎勵。'],
        ],
      },
    ];

    for (const section of sections) {
      const group = document.createElement('details');
      group.className = 'equipment-note-group rules-note-group';
      group.open = true;

      const summary = document.createElement('summary');
      summary.className = 'equipment-note-title';
      summary.innerHTML = `<span class="equipment-note-title-text">${section.title}<em>（${section.items.length}）</em></span>`;
      group.appendChild(summary);

      const list = document.createElement('div');
      list.className = 'equipment-note-list rules-note-list';
      for (const [name, desc] of section.items) {
        const entry = document.createElement('div');
        entry.className = 'equipment-note-entry rules-note-entry';
        entry.innerHTML = `
          <div class="equipment-note-head"><span class="equipment-note-name">${name}</span></div>
          <div class="equipment-note-desc">${desc}</div>
        `;
        list.appendChild(entry);
      }

      group.appendChild(list);
      container.appendChild(group);
    }
  },

  _orderedWeaponNotes(weapons) {
    const result = [];
    const used = new Set();
    const byId = new Map((weapons || []).map(weapon => [weapon.id, weapon]));
    const baseWeapons = (weapons || []).filter(weapon => (weapon.tier || 1) === 1);

    for (const weapon of baseWeapons) {
      result.push(weapon);
      used.add(weapon.id);
      const upgraded = weapon.upgradeTo ? byId.get(weapon.upgradeTo) : null;
      if (upgraded) {
        result.push(upgraded);
        used.add(upgraded.id);
      }
    }

    for (const weapon of weapons || []) {
      if (!used.has(weapon.id)) result.push(weapon);
    }

    return result;
  },

  _renderRelicNotesGrid(container) {
    const relics = typeof RELICS !== 'undefined' ? RELICS : [];
    if (relics.length === 0) {
      container.innerHTML = '<p class="notes-empty">尚無聖物資料。</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'relic-note-grid';

    for (const relic of relics) {
      if (!relic?.id || relic.effect?.type === 'unlock_library') continue;
      const display = this._relicDisplay(relic);
      const total = display.lore.length;
      const unlocked = this._unlockedRelicLore(relic, display);
      const isUnlocked = unlocked.length > 0;
      const item = document.createElement('div');
      item.className = `relic-note-icon${isUnlocked ? '' : ' locked'}`;
      item.innerHTML = `
        <span class="relic-note-emoji">${isUnlocked ? (display.iconHtml || display.icon) : '?'}</span>
        <span class="relic-note-name">${isUnlocked ? display.name : '未知聖物'}</span>
        <span class="relic-note-count">${isUnlocked ? `${unlocked.length}/${total}` : '0/?'}</span>
      `;
      item.addEventListener('click', () => {
        container.innerHTML = '';
        this._renderRelicLoreDetail(container, relic);
      });
      grid.appendChild(item);
    }

    container.appendChild(grid);
    this._renderRelicResonanceList(container);
  },

  _renderRelicResonanceList(container) {
    const section = document.createElement('div');
    section.className = 'relic-resonance-section';

    const title = document.createElement('div');
    title.className = 'relic-lore-title';
    title.textContent = '聖物共鳴組合';
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'relic-note-grid resonance-note-grid';
    for (const res of this._resonanceNotes()) {
      const relicDisplays = (res.relics || []).map(id => this._relicDisplay(this._getRelicById(id) || { id }));
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'relic-note-icon resonance-note-icon';
      item.innerHTML = `
        <span class="relic-note-emoji">${relicDisplays.map(display => display.iconHtml || display.icon).join('')}</span>
        <span class="relic-note-name">${res.name}</span>
      `;
      item.addEventListener('click', () => {
        container.innerHTML = '';
        this._renderRelicResonanceDetail(container, res);
        this._resetNotesScroll(document.getElementById('notes-modal'), document.getElementById('notes-content'), container);
      });
      grid.appendChild(item);
    }
    section.appendChild(grid);

    container.appendChild(section);
  },

  _renderRelicResonanceDetail(container, res) {
    const back = document.createElement('button');
    back.className = 'btn-secondary btn-small notes-back-btn';
    back.textContent = '返回';
    back.addEventListener('click', () => {
      container.innerHTML = '';
      this._renderRelicNotesGrid(container);
    });
    container.appendChild(back);

    const title = document.createElement('div');
    title.className = 'relic-lore-title';
    title.textContent = res.name;
    container.appendChild(title);

    const body = document.createElement('div');
    body.className = 'resonance-detail-card';
    body.innerHTML = `
      <div class="resonance-detail-kicker">${res.desc}</div>
      <div class="resonance-detail-effect">${res.body || '共鳴效果已啟動。'}</div>
      ${res.detail?.length ? `<ul class="resonance-detail-list">${res.detail.map(line => `<li>${line}</li>`).join('')}</ul>` : ''}
    `;
    container.appendChild(body);

    const pairTitle = document.createElement('div');
    pairTitle.className = 'resonance-subtitle';
    pairTitle.textContent = '配套聖物';
    container.appendChild(pairTitle);

    const pair = document.createElement('div');
    pair.className = 'resonance-relic-pair';
    const slots = this._resonanceRelicSlots(res);
    for (const entry of slots) {
      const relic = this._getRelicById(entry.id) || { id: entry.id };
      const display = this._relicDisplay(relic);
      const effectText = entry.slot === '融合聖物' ? (display.fusedDesc || display.desc) : display.desc;
      const item = document.createElement('div');
      item.className = 'resonance-relic-card';
      item.innerHTML = `
        <div class="resonance-relic-head">
          <span class="equipment-note-icon">${display.iconHtml || display.icon}</span>
          <span class="equipment-note-name">${display.name}</span>
          <span class="equipment-note-tag">${entry.slot}</span>
        </div>
        <div class="equipment-note-desc">${effectText}</div>
      `;
      pair.appendChild(item);
    }
    container.appendChild(pair);

    const related = this._resonanceRelatedRules(res.id);
    if (related.length > 0) {
      const ruleTitle = document.createElement('div');
      ruleTitle.className = 'resonance-subtitle';
      ruleTitle.textContent = '相關規則';
      container.appendChild(ruleTitle);

      const rules = document.createElement('div');
      rules.className = 'resonance-related-rules';
      for (const [name, desc] of related) {
        const rule = document.createElement('div');
        rule.className = 'resonance-rule-card';
        rule.innerHTML = `<strong>${name}</strong><span>${desc}</span>`;
        rules.appendChild(rule);
      }
      container.appendChild(rules);
    }
  },

  _resonanceRelicSlots(res) {
    const ids = res.relics || [];
    if (res.id === 'dual_banner_formation') {
      return ids.map(id => ({ id, slot: '其中一面融合' }));
    }
    return [
      { id: ids[0], slot: '融合聖物' },
      { id: ids[1], slot: '攜帶聖物' },
    ].filter(entry => entry.id);
  },

  _resonanceRelatedRules(id) {
    const rules = {
      pain_resonance: [
        ['\u50b7\u53e3', '\u6bcf\u5c64\u901a\u5e38\u6703\u4f7f\u8a72\u55ae\u4f4d\u53d7\u5230\u50b7\u5bb3\u63d0\u9ad8 5%\uff1b\u7206\u767c\u5171\u9cf4\u7684\u6301\u6709\u8005\u653b\u64ca\u6642\u6703\u5ffd\u7565\u6575\u4eba\u8eab\u4e0a\u7684\u50b7\u53e3\u589e\u50b7\u3002'],
        ['\u50b7\u53e3\u7d2f\u7a4d', '\u9020\u6210\u50b7\u5bb3\u5f8c\uff0c\u4f9d\u6700\u7d42\u9ab0\u9762\u7684\u4e00\u534a\u9644\u52a0\u50b7\u53e3\uff1b\u75db\u82e6\u9762\u5177\u4ecd\u6703\u4f9d\u539f\u59cb\u50b7\u5bb3\u9644\u52a0\u50b7\u53e3\u3002'],
        ['\u50b7\u53e3\u7206\u767c', '\u50b7\u53e3\u9054 10 \u5c64\u6642\u5f15\u7206\uff0c\u6bcf\u5c64\u9020\u6210 2 \u9ede\u56fa\u5b9a\u50b7\u5bb3\uff0c\u7206\u767c\u5f8c\u4fdd\u7559\u7d04\u4e09\u5206\u4e4b\u4e00\u50b7\u53e3\u3002'],
      ],
      pain_scar_resonance: [
        ['傷口', '每層傷口通常會使該單位受到傷害提高 5%；折磨共鳴保留敵人身上的這個增傷。'],
        ['高層傷口', '折磨共鳴在 5 層以上開始額外放大傷害，10 層以上會進入更高加成。'],
      ],
      greatsword_resonance: [
        ['氣勢', '氣勢會提高持有者的基礎攻擊力。氣勢 1 等於基礎攻擊 +1，持續到本場戰鬥結束。'],
        ['重劍', '高骰視為重劍；沉鐵劍律不提高觸發率。融合沉鐵劍鞘時，每次重劍命中合計獲得 8 點氣勢；若劍系主戰攻擊未打出重劍，氣勢 -3。氣勢 20 以上未打出重劍時，改為失去一半氣勢。'],
      ],
      rapier_resonance: [
        ['\u523a\u528d\u5f37\u5316', '\u6c89\u9435\u528d\u9798\u4e0d\u518d\u89f8\u767c\u91cd\u528d\uff0c\u6539\u70ba\u5f37\u5316\u523a\u528d\u3002'],
        ['\u9023\u64ca\u589e\u50b7', '\u672c\u6b21\u523a\u528d\u6bcf\u6210\u529f\u9023\u64ca 1 \u6b21\uff0c\u5f8c\u7e8c\u9023\u64ca\u50b7\u5bb3\u984d\u5916 +1\uff0c\u6700\u591a +5\u3002'],
      ],
      star_hunter_eye: [
        ['鷹眼鎖定', '命中獵星產生的鷹眼暫時原生弱點後，本回合進入鷹眼鎖定；鎖定期間弓追擊不再需要命中原生弱點也能繼續，且獵星追擊傷害改為追擊次數 x5。'],
        ['相鄰判定', '探索者的可疑弱點採環狀相鄰，1 與 6 視為相鄰，讓邊界弱點不會比較難觸發。'],
        ['追加攻擊', '追加攻擊不觸發敵人行動，也不觸發敵人的原生弱點破除效果，但仍會消耗本回合追擊次數。'],
      ],
      star_breaker_eye: [
        ['原生弱點', '裂星破滅只會破壞真正命中的原生弱點；鷹眼羽飾的視為命中不會破壞。'],
        ['裂星破壞', '被破壞的原生弱點會暫時失效；非無弱點敵人回合開始前會補回可用原生弱點。'],
      ],
      dodeca_fate_dice: [
        ['原生弱點', '命運骰可以命中原生弱點，並以原生弱點作為高爆發核心。'],
        ['押注', '賭命骰子押中會提高傷害，12 面骰押中時額外再加上本次骰面；懊悔時下次受擊流程受到的傷害 +30%，最多 2 層。'],
        ['自然骰', '自然骰 12 且觸發共鳴弱點時，會把命運骰爆發推到最高。'],
      ],
      dodeca_lucky_dice: [
        ['破綻', '幸運骰不命中原生弱點，主要吃破綻與破綻倍數。'],
        ['押注', '12 面骰押中賭命時額外再加上本次骰面；懊悔仍會累積下次受擊風險。'],
      ],
      dual_banner_formation: [
        ['舉旗', '持旗角色主戰攻擊前選擇要舉哪一件旗，旗面自動決定。'],
        ['雙旗', '戰爭旗與鷹眼旗可以同時維持，但同一件旗再次舉起會覆蓋原本旗面。雙旗並立時，戰吼旗固定傷害提高 50%。'],
        ['輔助守勢', '場上每有 1 面由持有者展開的旗，持有者受到的傷害降低 20%。'],
        ['輔助', '輔助用本次攻擊骰決定旗階；融合旗不會舉旗失敗。'],
      ],
    };
    return rules[id] || [];
  },

  _renderRelicLoreDetail(container, relic) {
    const display = this._relicDisplay(relic);
    const unlockedLore = this._unlockedRelicLore(relic, display);
    const isUnlocked = unlockedLore.length > 0;

    const back = document.createElement('button');
    back.className = 'btn-secondary btn-small notes-back-btn';
    back.textContent = '返回';
    back.addEventListener('click', () => {
      container.innerHTML = '';
      this._renderRelicNotesGrid(container);
    });
    container.appendChild(back);

    const title = document.createElement('div');
    title.className = 'relic-lore-title';
    title.innerHTML = isUnlocked ? `${display.iconHtml || display.icon} ${display.name}` : '? 未知聖物';
    container.appendChild(title);

    if (isUnlocked) {
      container.appendChild(this._createRelicEffectBlock(display.desc, display.fusedDesc));
    }

    const list = document.createElement('div');
    list.className = 'relic-lore-list';
    if (unlockedLore.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'relic-lore-entry';
      empty.innerHTML = '<span class="relic-lore-num">未解鎖</span><span class="relic-lore-text">取得這件聖物後，探險筆記會記錄它的來歷。</span>';
      list.appendChild(empty);
    }
    for (const item of unlockedLore) {
      const entry = document.createElement('div');
      entry.className = 'relic-lore-entry';
      const label = this._relicLoreLabel(item.index, display.lore.length);
      entry.innerHTML = `<span class="relic-lore-num">${label}</span><span class="relic-lore-text">${item.text}</span>`;
      list.appendChild(entry);
    }
    if (display.locationHint) {
      const hint = document.createElement('div');
      hint.className = 'note-hint';
      hint.textContent = `取得線索：${display.locationHint}`;
      list.appendChild(hint);
    }
    container.appendChild(list);
  },

  _unlockedRelicLore(relic = {}, display = null) {
    const data = display || this._relicDisplay(relic);
    const lore = Array.isArray(data.lore) ? data.lore : [];
    if (!relic?.id || lore.length === 0) return [];
    const unlocked = Array.isArray(G.notes?.[relic.id]) ? G.notes[relic.id] : [];
    return unlocked
      .filter(index => Number.isInteger(index) && index >= 0 && index < lore.length)
      .sort((a, b) => a - b)
      .map(index => ({ index, text: lore[index] }));
  },

  _relicLoreLabel(index, total = 0) {
    if (index === 0) return '聖物記述';
    if (index === 1 && total >= 2) return '共鳴線索';
    return `記述 ${index + 1}`;
  },

  _createRelicEffectBlock(desc, fusedDesc = '') {
    const effect = document.createElement('div');
    effect.className = 'relic-note-effect';

    const title = document.createElement('strong');
    title.textContent = '聖物效果';
    effect.appendChild(title);

    const base = document.createElement('span');
    base.textContent = desc || '尚無說明。';
    effect.appendChild(base);

    if (fusedDesc) {
      const fused = document.createElement('div');
      fused.className = 'relic-note-fused-effect';

      const label = document.createElement('b');
      label.textContent = '融合後';
      fused.appendChild(label);

      const text = document.createElement('span');
      text.textContent = fusedDesc;
      fused.appendChild(text);
      effect.appendChild(fused);
    }

    return effect;
  },

  _renderTerrainNotes(container) {
    const terrains = [
      { icon: '◇', name: '平地', desc: '常見的空曠地形，通常觸發普通事件或資源事件。', tags: ['普通', '事件', '探索'] },
      { image: 'assets/terrain/forest-tile.png?v=2', icon: '森', name: '森林', desc: '樹影遮蔽視線，較容易遇到探索事件、資源與潛伏危險。', tags: ['探索', '資源', '危險'] },
      { image: 'assets/terrain/ruins-tile.png?v=2', icon: '墟', name: '廢墟', desc: '舊文明殘跡，常藏有事件、聖物線索與陷阱。', tags: ['事件', '聖物', '陷阱'] },
      { image: 'assets/terrain/cave-tile.png?v=2', icon: '穴', name: '洞穴', desc: '黑暗與迷失並存，可能帶來高風險事件與寶藏。', tags: ['危險', '寶藏', '探索'] },
      { image: 'assets/terrain/altar-tile.png', icon: '壇', name: '神壇', desc: '每日可使用一次，可血祭降低黑暗或融合聖物。', tags: ['血祭', '融合', '黑暗'] },
      { image: 'assets/terrain/rest-tile.png', icon: '火', name: '休息點', desc: '可恢復生命。用過後會熄滅，等待規則刷新後再次可用。', tags: ['恢復', '休息', '刷新'] },
    ];

    for (const info of terrains) {
      const entry = document.createElement('div');
      entry.className = 'terrain-note-entry';
      const visual = info.image
        ? `<img class="terrain-note-image" src="${info.image}" alt="${info.name}">`
        : `<span class="terrain-note-icon">${info.icon}</span>`;
      entry.innerHTML = `
        <div class="terrain-note-visual">
          ${visual}
          <div class="terrain-note-name">${info.name}</div>
        </div>
        <div class="terrain-note-body">
          <div class="terrain-note-desc">${info.desc}</div>
          <div class="terrain-note-tags">${info.tags.map(tag => `<span class="terrain-tag">${tag}</span>`).join('')}</div>
        </div>
      `;
      container.appendChild(entry);
    }
  },

  _getRelicById(id) {
    if (typeof getRelicById === 'function') return getRelicById(id);
    return (typeof RELICS !== 'undefined' ? RELICS : []).find(relic => relic.id === id) || null;
  },

  _relicDisplay(relic = {}) {
    const overrides = {
      war_banner: {
        name: '戰爭旗',
        icon: '旗',
        desc: '主戰攻擊前，可選擇舉起戰爭旗，旗面自動決定。戰吼面：每回合開始時對敵人造成 5/8/10 點固定傷害。創傷面：每回合第一次擊中時施加 1/2/3 層傷口。非輔助舉旗為 1 階，若此旗已融合則為 2 階。輔助舉旗以本次攻擊骰判定：1-2 失敗，3-4 為 2 階，5-6 為 3 階；若此旗已融合，1-4 為 2 階，5-6 為 3 階。',
        fusedDesc: '主戰攻擊前，可選擇舉起戰爭旗，旗面自動決定。戰吼面：每回合開始時對敵人造成 5/8/10 點固定傷害。創傷面：每回合第一次擊中時施加 1/2/3 層傷口。融合後此旗不會舉旗失敗；非輔助舉起時直接成為 2 階，輔助舉起時 1-4 為 2 階，5-6 為 3 階。',
        lore: ['布面殘破，號令卻仍能讓隊伍重新排成一線。'],
        locationHint: '支援路線事件或普通聖物中可能出現。',
      },
      eagle_banner: {
        name: '鷹眼旗',
        icon: '旗',
        desc: '主戰攻擊前，可選擇舉起鷹眼旗，旗面自動決定。破綻面：每回合附加 1 個鷹眼破綻；命中該破綻時 1/2/3 階額外傷害 +0/+2/+3。原生面：命中任一原生弱點時傷害 +3/+3/+4；2 階若最終骰面大於 3，新增 1 個鷹眼暫時原生弱點 2 回合；3 階若最終骰面大於 2，新增 1 個鷹眼暫時原生弱點 3 回合。鷹眼旗產生的弱點同時只能存在 1 個，且可互相覆蓋。非輔助舉旗為 1 階，若此旗已融合則為 2 階。輔助舉旗以本次攻擊骰判定：1-2 失敗，3-4 為 2 階，5-6 為 3 階；若此旗已融合，1-4 為 2 階，5-6 為 3 階。',
        fusedDesc: '主戰攻擊前，可選擇舉起鷹眼旗，旗面自動決定。破綻面：每回合附加 1 個鷹眼破綻；命中該破綻時 1/2/3 階額外傷害 +0/+2/+3。原生面：命中任一原生弱點時傷害 +3/+3/+4；2 階若最終骰面大於 3，新增 1 個鷹眼暫時原生弱點 2 回合；3 階若最終骰面大於 2，新增 1 個鷹眼暫時原生弱點 3 回合。融合後此旗不會舉旗失敗；非輔助舉起時直接成為 2 階，輔助舉起時 1-4 為 2 階，5-6 為 3 階。',
        lore: ['旗尖所指之處，連陰影都露出裂縫。'],
        locationHint: '支援路線事件或普通聖物中可能出現。',
      },
      wager_dice: {
        name: '賭命骰子',
        icon: '骰',
        desc: '戰鬥開始後，持有者主戰前可押注骰面。若本次攻擊命中押注骰面，傷害 +4；若未命中，下次受擊回合受到的傷害 +30%，最多 2 層。',
        fusedDesc: '可押注 4 個骰面，命中仍為傷害 +4；懊悔懲罰仍最多 2 層。',
        lore: ['骰子沉甸甸的，像把一小段命運握在掌心。'],
        locationHint: '普通聖物獎勵中可能出現。',
      },
      lucky_star: {
        name: '幸運星',
        icon: '星',
        desc: '攻擊骰最終為 6 時傷害 +2；每場戰鬥前 1 次可將小於等於 3 的攻擊骰面改為 6，且免疫以此方式造成的雙數副作用。',
        fusedDesc: '每場戰鬥前 2 次可改為 6；完全免疫最終骰面 6 與 12 的雙數懲罰。若使用 12 面骰，每場戰鬥前 2 次骰到 6 時有 50% 機率改為 12，且 12 傷害 +4。',
        lore: ['它不像星星，更像一枚不肯熄滅的小小承諾。'],
        locationHint: '普通聖物獎勵中可能出現。',
      },
      exorcism_ring: {
        name: '驅邪戒',
        icon: '戒',
        desc: '每天第一次探索骰若未達成功門檻，會自動重骰一次，並採用重骰結果。',
        fusedDesc: '每天第一次探索骰必定成功：若骰面低於成功門檻，將最終骰面提高到該門檻。',
        lore: ['戒面刻著細小符文，靠近黑暗時會微微發熱。'],
        locationHint: '黑夜聖物獎勵中可能出現。',
      },
      iron_scabbard: {
        name: '沉鐵劍鞘',
        icon: '▰',
        desc: '持有者使用劍系武器主戰時，高骰視為重劍。重劍命中後獲得 3 點氣勢，直到戰鬥結束；每 1 點氣勢使自身基礎攻擊 +1。',
        fusedDesc: '重劍命中後獲得的氣勢改為 5 點。',
        lore: ['劍鞘比劍更沉。拔劍時，手腕會記住那份重量。'],
        locationHint: '普通聖物獎勵中可能出現。',
      },
      silver_bee_pin: {
        name: '銀蜂針',
        icon: '◇',
        desc: '持有者使用劍系武器主戰時，低骰視為刺劍。刺劍命中後保底 1 次連擊，之後觸發連擊：第一次機率 80%，之後每次連擊機率 -20%；連擊傷害為本次傷害的 50%。',
        fusedDesc: '第一次連擊機率 90%，之後每次連擊機率 -10%，最低 10%。',
        lore: ['針尾銀亮，像一隻停在劍柄上的蜂。出劍越快，嗡鳴越細。'],
        locationHint: '普通聖物獎勵中可能出現。',
      },
      eagle_eye_feather: {
        name: '鷹眼羽飾',
        icon: '羽',
        desc: '主戰使用弓時，最終骰面至少為 5，可視為命中原生弱點並觸發弓追擊；此視為命中不會破壞原生弱點。',
        fusedDesc: '每場戰鬥第一次由鷹眼羽飾觸發的弓追加攻擊，額外傷害 +3。',
        lore: ['羽毛仍記得天空的高度。'],
        locationHint: '普通聖物獎勵中可能出現。',
      },
      flaw_lens: {
        name: '鷹眼透鏡',
        icon: '鏡',
        desc: '主戰攻擊命中原生弱點時，有 50% 機率新增 1 個原生弱點；每場戰鬥最多成功新增 1 次，失敗不消耗機會。',
        fusedDesc: '本場第一次命中原生弱點後，必定新增 1 個原生弱點；命中原生弱點時傷害 +2。',
        lore: ['透鏡裡的裂紋，總能對準敵人最薄的地方。'],
        locationHint: '普通聖物獎勵中可能出現。',
      },
      pain_mask: {
        name: '痛苦面具',
        icon: '面',
        desc: '主戰造成傷害時，每 4 點原始傷害附加 1 層傷口。',
        fusedDesc: '主戰造成傷害時，每 4 點原始傷害附加 1 層傷口。若敵人傷口達 15 層，會引爆並消耗所有傷口，每層造成 2 點固定傷害。',
        lore: ['面具內側沒有臉，只有咬緊的痛。'],
        locationHint: '普通聖物獎勵中可能出現。',
      },
      pain_splinter_badge: {
        name: '痛苦徽記',
        icon: '血',
        desc: '主戰造成傷害時，附加 1 層傷口。攻擊有傷口的敵人時，最終傷害提高 10%；每 3 層傷口額外 +5%，最高 25%。',
        fusedDesc: '主戰造成傷害時，附加 2 層傷口。攻擊有傷口的敵人時，最終傷害提高 15%；每 3 層傷口額外 +5%，最高 35%，並將傷口上限提高至 20。',
        lore: ['徽記像乾涸的傷疤，碰到鮮血時又重新發亮。'],
        locationHint: '普通聖物獎勵中可能出現。',
      },
      black_iron_crown: {
        name: '黑鐵王冠',
        icon: '冠',
        desc: '主動討伐黑暗化身時，若黑暗化身等級高於 5，戰鬥等級 -2，最低降至 5。被動追殺不會降低等級。',
        fusedDesc: '保留主動討伐時戰鬥等級 -2，最低 5；主動討伐黑暗化身時，全隊對黑暗化身造成的傷害 +10%，至少 +1。',
        lore: ['它不是為王準備的，而是為仍敢直視黑夜的人。'],
        locationHint: '黑夜聖物獎勵中可能出現。',
      },
    };

    const data = overrides[relic.id] || {};
    return {
      name: data.name || relic.name || relic.id || '未知聖物',
      icon: data.icon || relic.icon || '◆',
      iconHtml: EquipmentIcon.html({ ...relic, icon: data.icon || relic.icon || '◆' }, 'equipment-inline-icon relic-inline-icon'),
      desc: relic.desc || data.desc || '尚無說明。',
      fusedDesc: (typeof relicFusionDesc === 'function' ? relicFusionDesc(relic) : '') || data.fusedDesc || (relic.fusedEffect ? '融合後效果已套用。' : ''),
      lore: relic.lore || data.lore || [],
      locationHint: data.locationHint || relic.locationHint || '',
    };
  },

  _weaponDisplay(weapon = {}) {
    const overrides = {
      sword: ['劍', '劍', '主戰時，最終骰面 1-3 傷害 +1；4 以上傷害 +2。'],
      bow: ['弓', '弓', '主戰時，命中原生弱點後，可追加攻擊。追擊不會觸發敵人的原生弱點破除效果。每回合最多額外追擊 2 次。'],
      dagger: ['匕首', '匕', '主戰時，命中弱點與破綻時額外 +2 傷害。'],
      battle_drum: ['戰鼓', '鼓', '主戰攻擊後，敲響戰鼓：接下來 2 次我方主戰攻擊 +1 攻擊。持鼓者主戰時，骰面附加傷害減半。'],
      healing_staff: ['祈癒杖', '+', '主戰時，命中原生弱點後，全隊恢復生命。'],
      katana: ['太刀', '劍', '主戰造成傷害時，施加 1 層傷口。'],
      sword_plus: ['裁衡劍', '劍', '主戰時，最終骰面 1-3 傷害 +2；4 以上傷害 +4。'],
      bow_plus: ['逐星弓', '弓', '主戰時，命中原生弱點後可追加攻擊。追擊不會觸發敵人的原生弱點破除效果。每回合最多額外追擊 3 次。'],
      dagger_plus: ['影牙匕首', '匕', '主戰時，命中弱點與破綻時額外 +2 傷害；未命中任何弱點或破綻時，額外造成等同最終骰面的傷害。'],
      battle_drum_plus: ['星盤戰鼓', '鼓', '主戰攻擊後，接下來 3 次我方主戰攻擊 +1 攻擊。持鼓者主戰時，骰面附加傷害減半。'],
      healing_staff_plus: ['晨星祈杖', '+', '主戰時，本次攻擊無視敵人格檔。命中原生弱點時，全隊恢復 2 HP。'],
      soul_cutter_katana: ['斷魂太刀', '劍', '主戰造成傷害時施加 1 層傷口；命中 8 層以上傷口敵人時本次傷害 +3；若本次攻擊觸發傷口引爆，額外造成 10 點固定傷害。'],
    };
    const data = overrides[weapon.id] || [];
    return {
      name: data[0] || weapon.name || weapon.id || '未知武器',
      icon: data[1] || weapon.icon || '◆',
      iconHtml: EquipmentIcon.html({ ...weapon, icon: data[1] || weapon.icon || '◆' }, 'equipment-note-img weapon-note-icon'),
      desc: data[2] || weapon.desc || '尚無說明。',
    };
  },

  _gearDisplay(gear = {}) {
    const overrides = {
      shield: ['盾牌', '盾', '主戰攻擊時，獲得等同骰面一半的格檔，向下取整，最低 1。'],
      grappling_hook: ['鉤索', '索', '主戰攻擊時，若原本未命中任何弱點，最終骰面 +1 並重新判定命中。每回合限一次；若因此命中原生弱點，不會觸發弓追擊。'],
      telescope: ['望遠鏡', '鏡', '若裝備者不是主戰者，敵人新增 1 個破綻。'],
      guard_charm: ['守衛護符', '盾', '若裝備者不是主戰者，主戰者攻擊時，裝備者獲得 1 格檔，並使裝備者仇恨 +1。'],
      targeting_pennant: ['瞄準旗標', '準', '若裝備者不是主戰者，主戰者本次攻擊命中敵人原生弱點時，傷害 +2。追擊不觸發此效果。'],
      bandage: ['繃帶包', '繃', '主戰攻擊後，治療生命比例最低的隊友 3 HP。每場戰鬥限一次。'],
      first_aid_pouch: ['急救藥囊', '藥', '戰鬥開始時，生命低於一半的隊友各恢復 2 HP。每場戰鬥觸發一次。'],
      night_pack: ['黑夜行囊', '包', '戰鬥開始時，若目前為黑夜，全隊恢復 1 HP；若黑暗達 10 以上，改為恢復 2 HP。'],
      kindling_bell: ['引火鈴', '鈴', '若裝備者不是主戰者，回合結束時，若主戰者仇恨至少 5，主戰者仇恨歸 0，裝備者仇恨變為 2。'],
      cracked_dice_pendant: ['裂骰墜飾', '骰', '主戰攻擊骰原始骰面為 1 或 6 時，傷害 +3；若為 1，攻擊後自身受到 1 傷害。'],
      serrated_oil: ['鋸齒油', '油', '主戰攻擊時，若最終骰面至少為 5 且造成傷害，額外施加 1 層傷口。每回合限一次。'],
      corrosive_oil: ['腐蝕油', '蝕', '主戰命中任一弱點且敵人至少 5 層傷口時，消耗 1 層傷口並造成 3 點固定傷害。每回合限一次。'],
      bone_dice_bag: ['骨骰袋', '骰', '每場戰鬥前 2 次，攻擊骰 1/2/3 會翻為 6/5/4。若因此觸發搏命者雙數，免疫該次反噬與減傷。'],
    };
    const data = overrides[gear.id] || [];
    return {
      name: data[0] || gear.name || gear.id || '未知裝備',
      icon: data[1] || gear.icon || '◆',
      iconHtml: EquipmentIcon.html({ ...gear, icon: data[1] || gear.icon || '◆' }, 'equipment-note-img gear-note-icon'),
      desc: data[2] || gear.desc || '尚無說明。',
    };
  },

  _itemDisplay(item = {}) {
    const overrides = {
      herb_pack: ['草藥包', '草', '立即使用，恢復目標 30% 最大生命；輔助使用時恢復 40%。'],
      wish_chest: ['祈願寶箱', '箱', '使用後可選擇休整、聖物、裝備、武器升級或黎明祈願。'],
      whetstone: ['磨刀石', '石', '本場戰鬥主戰攻擊 +1。'],
      leather_patch: ['皮革補片', '片', '下一次敵方攻擊傷害 -2。'],
      bone_dice: ['骨骰', '骰', '下一次骰子判定重骰，保留較高結果。'],
      focus_charm: ['專注護符', '符', '下一次骰子判定，若擲出 1 改為 2。'],
    };
    const data = overrides[item.id] || [];
    return {
      name: data[0] || item.name || item.id || '未知道具',
      icon: data[1] || item.icon || '◆',
      iconHtml: EquipmentIcon.html({ ...item, icon: data[1] || item.icon || '◆' }, 'equipment-note-img item-note-icon'),
      desc: data[2] || item.desc || '尚無說明。',
    };
  },

  _resonanceNotes() {
    return [
      {
        id: 'pain_resonance',
        name: '痛痕共鳴・爆發',
        relics: ['pain_mask', 'pain_splinter_badge'],
        desc: '同身：融合痛苦面具 + 痛苦徽記。',
        body: '\u653b\u64ca\u6642\u4e0d\u5403\u50b7\u53e3\u589e\u50b7\uff1b\u9020\u6210\u50b7\u5bb3\u5f8c\u4f9d\u6700\u7d42\u9ab0\u9762\u9644\u52a0\u50b7\u53e3\u3002\u50b7\u53e3\u9054 10 \u5c64\u6642\u5f15\u7206\uff0c\u6bcf\u5c64\u9020\u6210 2 \u9ede\u56fa\u5b9a\u50b7\u5bb3\uff0c\u7206\u767c\u5f8c\u4fdd\u7559\u7d04\u4e09\u5206\u4e4b\u4e00\u50b7\u53e3\u3002',
        detail: ['\u75db\u82e6\u5fbd\u8a18\u7684\u76f4\u63a5\u9644\u52a0\u50b7\u53e3\u4e0d\u6703\u984d\u5916\u89f8\u767c\uff1b\u75db\u82e6\u9762\u5177\u4ecd\u6703\u4f9d\u539f\u59cb\u50b7\u5bb3\u9644\u52a0\u50b7\u53e3\u3002'],
      },
      {
        id: 'pain_scar_resonance',
        name: '痛痕共鳴・折磨',
        relics: ['pain_splinter_badge', 'pain_mask'],
        desc: '同身：融合痛苦徽記 + 痛苦面具。',
        body: '持有者攻擊 5 層以上傷口的敵人時，該次擊中最終傷害額外提高 30%；若目標有 10 層以上傷口，改為提高 50%。',
        detail: ['折磨共鳴不消耗傷口，適合長線堆疊與多段命中。'],
      },
      {
        id: 'greatsword_resonance',
        name: '沉鐵劍律',
        relics: ['iron_scabbard', 'silver_bee_pin'],
        desc: '同身：融合沉鐵劍鞘 + 銀蜂針。',
        body: '銀蜂針不再觸發刺劍連擊，改為強化重劍。重劍命中後，除了沉鐵劍鞘原本的氣勢外，額外獲得 3 點氣勢。氣勢 1 等於基礎攻擊 +1；此外，每 5 點既有氣勢，使本次重劍傷害 +1。',
        detail: ['融合沉鐵劍鞘時，每次重劍命中合計獲得 8 點氣勢。若劍系主戰攻擊未打出重劍，氣勢 -3；氣勢 20 以上時改為失去一半氣勢。此共鳴不補重劍觸發率，也不提供低骰刺劍效果。'],
      },
      {
        id: 'rapier_resonance',
        name: '銀蜂劍律',
        relics: ['silver_bee_pin', 'iron_scabbard'],
        desc: '同身：融合銀蜂針 + 沉鐵劍鞘。',
        body: '\u6c89\u9435\u528d\u9798\u4e0d\u518d\u89f8\u767c\u91cd\u528d\uff0c\u6539\u70ba\u5f37\u5316\u523a\u528d\u3002\u672c\u6b21\u523a\u528d\u6bcf\u6210\u529f\u9023\u64ca 1 \u6b21\uff0c\u5f8c\u7e8c\u9023\u64ca\u50b7\u5bb3\u984d\u5916 +1\uff0c\u6700\u591a +5\u3002',
        detail: ['\u6b64\u5171\u9cf4\u4e0d\u63d0\u4f9b\u9ad8\u9ab0\u91cd\u528d\u6548\u679c\uff1b\u9280\u8702\u91dd\u7684\u523a\u528d\u898f\u5247\u7167\u5e38\u751f\u6548\uff0c\u6c89\u9435\u528d\u9798\u53ea\u8ffd\u52a0\u9023\u64ca\u589e\u50b7\u3002'],
      },
      {
        id: 'star_hunter_eye',
        name: '獵星之眼',
        relics: ['eagle_eye_feather', 'flaw_lens'],
        desc: '同身：融合鷹眼羽飾 + 鷹眼透鏡。',
        body: '持有者每次使用弓攻擊前，若敵人沒有獵星產生的鷹眼暫時原生弱點，新增 1 個；命中該弱點後進入鷹眼鎖定，本回合弓追擊不再需要命中原生弱點也能繼續。未鎖定時弓追加攻擊傷害 +2；鷹眼鎖定期間改為追擊次數 x5。若同回合觸發 2 次以上追加攻擊，最後一次追加攻擊的攻擊骰必定視為 6。',
        detail: ['鷹眼暫時原生弱點可觸發弓追擊，且不會在命中前刷新。探索者的可疑弱點採環狀相鄰，1 與 6 視為相鄰。強制 6 不會額外觸發原生弱點破除，也不會因此再延伸新的弓追擊。'],
      },
      {
        id: 'star_breaker_eye',
        name: '裂星破滅',
        relics: ['flaw_lens', 'eagle_eye_feather'],
        desc: '同身：融合鷹眼透鏡 + 鷹眼羽飾。',
        body: '持有者使用弓主戰命中任一原生弱點時，破壞這次命中的原生弱點，額外造成 20 點固定傷害。',
        detail: [
          '任一原生弱點包含敵人的主要原生弱點、額外原生弱點與暫時原生弱點。',
          '同一回合可以破壞多個原生弱點。',
          '若敵人沒有可破壞的原生弱點，不會造成裂星破滅的固定傷害。',
          '非無弱點敵人每回合開始前會補到 2 個可用原生弱點。',
        ],
      },
      {
        id: 'dodeca_fate_dice',
        name: '十二面命運骰',
        relics: ['wager_dice', 'lucky_star'],
        desc: '同身：融合賭命骰子 + 幸運星。',
        body: '攻擊骰改為 1d12，可以命中原生弱點；若使用賭命骰子，可額外押注 3 個骰面，押中時額外再加上本次骰面；搏命者單數刷新原生弱點，其他職業只有 7、9、11 會刷新；命中原生弱點或視為命中原生弱點時最終傷害 x4；最終骰值等於原生弱點 x2 時額外觸發共鳴弱點。',
        detail: [
          '命中破綻不會觸發命運骰 x2；破綻倍數是十二面幸運骰的玩法。',
          '命中原生弱點或共鳴弱點會使最終傷害 x4。',
          '共鳴弱點會套用該原生弱點效果。',
          '自然骰出 12 且觸發共鳴弱點時，最終傷害改為 x5。',
        ],
      },
      {
        id: 'dodeca_lucky_dice',
        name: '十二面幸運骰',
        relics: ['lucky_star', 'wager_dice'],
        desc: '同身：融合幸運星 + 賭命骰子。',
        body: '攻擊骰改為 1d12且不命中原生弱點；若使用賭命骰子，可額外押注 3 個骰面，押中時額外再加上本次骰面；搏命者單數刷新破綻，7、9、11 刷新 2 個；其他職業只有 7、9、11 會刷新 1 個；命中破綻或破綻倍數時獲得額外傷害。',
        detail: [
          '最終骰值等於破綻，或是任一破綻的倍數時，視為命中破綻，傷害 +3。',
          '每個符合倍數的破綻額外使傷害 +16。',
          '破綻為 1 時，所有最終骰值都視為它的倍數。',
        ],
      },
      {
        id: 'dual_banner_formation',
        name: '雙旗戰陣',
        relics: ['war_banner', 'eagle_banner'],
        desc: '同身：同時持有戰爭旗與鷹眼旗，且其中一面已融合。',
        body: '戰鬥中可同時維持 1 面戰爭旗與 1 面鷹眼旗；雙旗並立時，戰吼旗固定傷害提高 50%，且場上每面旗使持有者受到的傷害降低 20%。',
        detail: [
          '再次舉起同一件旗時，會覆蓋該旗目前的旗面。',
          '不同旗可並存，因此可以同時保留一個戰爭旗效果與一個鷹眼旗效果。',
          '戰吼旗的雙旗增傷只提高旗幟自身的固定傷害。',
          '融合旗不會舉旗失敗；輔助舉融合旗時 1-4 為二階，5-6 為三階。',
        ],
      },
    ];
  },
};

Object.assign(Render, RenderNotes);
