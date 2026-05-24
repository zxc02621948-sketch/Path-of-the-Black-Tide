// Opening guide and reusable guide notes.
const RenderTutorial = {
  TUTORIAL_DISABLED_KEY: 'bbn_opening_tutorial_disabled',

  shouldShowOpeningTutorial() {
    try {
      return localStorage.getItem(this.TUTORIAL_DISABLED_KEY) !== 'true';
    } catch {
      return true;
    }
  },

  disableOpeningTutorial() {
    try {
      localStorage.setItem(this.TUTORIAL_DISABLED_KEY, 'true');
    } catch {
      // Ignore storage errors; the button should still close the tutorial.
    }
  },

  tutorialPages() {
    return [
      {
        title: '探索目標',
        kicker: '先活下來，再變強',
        icon: '🧭',
        body: [
          '白天用有限行動探索地圖，尋找聖物、裝備、救援與神壇。',
          '隊伍成形後，靠聖物共鳴與裝備組合撐過黑夜的追獵。',
        ],
        points: ['往新區域探索才有主要收益', '救援可擴充小隊', '神壇可血祭或融合聖物'],
      },
      {
        title: '聖物取得',
        kicker: '流派成形的核心',
        icon: '💎',
        image: 'assets/terrain/altar-tile.png',
        body: [
          '聖物會改變戰鬥規則，是流派成形的核心。',
          '角色先攜帶 1 件聖物；到神壇融合後，普通聖物欄才會空出來。',
          '融合後再攜帶配套聖物，或隊伍湊齊指定聖物，就可能啟動共鳴。',
        ],
        points: ['探索事件可找到聖物', '黑夜空地會出現聖物', '神壇可融合已攜帶聖物'],
      },
      {
        title: '裝備取得',
        kicker: '補上角色的手感',
        icon: '🧰',
        image: 'assets/terrain/ruins-tile.png?v=2',
        body: [
          '武器決定攻擊節奏，裝備則補強生存、支援或流派條件。',
          '裝備通常不直接形成共鳴，但會讓聖物流派更穩。',
        ],
        points: ['寶箱與武器箱', '探索事件獎勵', '特殊敵人或高風險事件', '背包中的消耗品可在需要時使用'],
      },
      {
        title: '黑暗化身',
        kicker: '看懂地圖上的追獵倒數',
        icon: '☠',
        darkTokens: true,
        body: [
          '黑夜降臨後，黑暗化身會出現在地圖上並朝小隊移動。',
          '牠身上的光代表追殺倒數；倒數歸零或追上小隊時會立刻準備追殺戰鬥。',
        ],
        points: ['綠光：還有 3 天', '黃光：還有 2 天', '紅光：最後 1 天', '倒數歸零或追上小隊時，會直接觸發追殺流程'],
      },
      {
        title: '忘記規則時',
        kicker: '回到探險筆記',
        icon: '📖',
        body: [
          '右上角的探險筆記會保留遊玩指南、地形情報、聖物、裝備與規則索引。',
          '如果不知道下一步要做什麼，先確認目前缺的是聖物、裝備、隊友，還是需要降低黑暗。',
        ],
        points: ['遊玩指南可重看本說明', '規則索引查弱點、傷口、共鳴', '武器裝備頁可查取得方向'],
      },
    ];
  },

  showTutorial(pageIndex = 0) {
    const pages = this.tutorialPages();
    const index = Math.max(0, Math.min(pages.length - 1, pageIndex));
    const page = pages[index];
    const choices = [];
    if (index === 0) {
      choices.push({
        label: '不再顯示',
        action: () => {
          this.disableOpeningTutorial();
          Game._closeModal();
        },
      });
    }
    if (index < pages.length - 1) {
      choices.push({ label: '跳過', action: () => Game._closeModal() });
    }
    if (index > 0) {
      choices.push({ label: '上一頁', action: () => this.showTutorial(index - 1) });
    }
    if (index < pages.length - 1) {
      choices.push({ label: '下一頁', action: () => this.showTutorial(index + 1) });
    } else {
      choices.push({ label: '開始探索', action: () => Game._closeModal() });
    }

    Game._openModal({
      title: `遊玩指南 ${index + 1}/${pages.length}：${page.title}`,
      descHtml: this._tutorialPageHtml(page, index, pages.length),
      choices,
      typeText: false,
      tutorialModal: true,
    });
  },

  _tutorialPageHtml(page, index, total) {
    const art = page.darkTokens
      ? this._tutorialDarkTokensHtml()
      : this._tutorialArtHtml(page);
    return `
      <div class="tutorial-page">
        <div class="tutorial-top-spacer" aria-hidden="true"></div>
        <div class="tutorial-progress" aria-label="指南頁數">${Array.from({ length: total }, (_, i) => `<span class="${i === index ? 'active' : ''}"></span>`).join('')}</div>
        <div class="tutorial-layout">
          <div class="tutorial-art">${art}</div>
          <div class="tutorial-copy">
            <div class="tutorial-kicker">${page.kicker}</div>
            ${page.body.map(text => `<p>${text}</p>`).join('')}
            <ul class="tutorial-points">${page.points.map(point => `<li>${point}</li>`).join('')}</ul>
          </div>
        </div>
      </div>
    `;
  },

  _tutorialArtHtml(page) {
    if (page.image) {
      return `<img class="tutorial-art-image" src="${page.image}" alt="">`;
    }
    return `<span class="tutorial-art-icon">${page.icon || '◆'}</span>`;
  },

  _tutorialDarkTokensHtml(extraClass = '') {
    const tokens = [
      ['timer-green', '3'],
      ['timer-yellow', '2'],
      ['timer-red', '1'],
    ];
    return `
      <div class="tutorial-dark-grid${extraClass ? ` ${extraClass}` : ''}">
        ${tokens.map(([cls, label]) => `
          <div class="tutorial-dark-token ${cls}">
            <img src="assets/enemies/dark-monster-icon.png" alt="">
            <span>${label}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderGuideNotes(container) {
    const pages = this.tutorialPages();
    const guide = document.createElement('div');
    guide.className = 'guide-note-list';
    guide.innerHTML = pages.map(page => `
      <section class="guide-note-entry">
        <div class="guide-note-head">
          <span class="guide-note-icon">${page.icon || '◆'}</span>
          <div>
            <h4>${page.title}</h4>
            <p>${page.kicker}</p>
          </div>
        </div>
        ${page.darkTokens ? this._tutorialDarkTokensHtml('guide-dark-grid') : ''}
        ${page.body.map(text => `<p class="guide-note-body">${text}</p>`).join('')}
        <ul class="guide-note-points">${page.points.map(point => `<li>${point}</li>`).join('')}</ul>
      </section>
    `).join('');
    container.appendChild(guide);
  },
};

Object.assign(Render, RenderTutorial);
