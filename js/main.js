// 入口：頁面載入後初始化
document.addEventListener('DOMContentLoaded', () => {
  AudioManager?.init?.();
  const startScreen  = document.getElementById('start-screen');
  const gameScreen   = document.getElementById('game-screen');
  const gameoverScr  = document.getElementById('gameover-screen');
  const selectModal  = document.getElementById('squad-select-modal');
  const notesModal   = document.getElementById('notes-modal');

  // ─── 開始新局 ────────────────────────────────────────────
  document.getElementById('btn-new-game').addEventListener('click', () => {
    openSquadSelect();
  });

  // ─── 選角畫面 ────────────────────────────────────────────
  let selectedClasses = [];
  let selectedLibraryRelicId = null;
  let selectedLibraryCarrierCls = null;

  function openSquadSelect() {
    selectModal.classList.remove('hidden');
    selectedClasses = [];
    selectedLibraryRelicId = null;
    selectedLibraryCarrierCls = null;
    updateSelectUI();
  }

  function updateSelectUI() {
    const container = document.getElementById('squad-select');
    const libraryRelics = getLibraryRelics();
    if (selectedLibraryRelicId && !libraryRelics.some(r => r.id === selectedLibraryRelicId)) {
      selectedLibraryRelicId = null;
    }
    // 若選的職業已從 selectedClasses 移除，重置攜帶者
    if (selectedLibraryCarrierCls && !selectedClasses.includes(selectedLibraryCarrierCls)) {
      selectedLibraryCarrierCls = null;
    }
    Render.renderSquadSelect(
      container,
      selectedClasses,
      toggleClass,
      libraryRelics,
      selectedLibraryRelicId,
      toggleLibraryRelic,
      selectedLibraryCarrierCls,
      toggleLibraryCarrier
    );

    const confirmBtn = document.getElementById('btn-confirm-squad');
    // 若選了聖物庫聖物，必須同時指定攜帶者才能出發
    const needCarrier = selectedLibraryRelicId && !selectedLibraryCarrierCls;
    confirmBtn.disabled = selectedClasses.length < CONFIG.STARTING_SQUAD_SIZE || needCarrier;
    if (selectedClasses.length < CONFIG.STARTING_SQUAD_SIZE) {
      confirmBtn.textContent = `再選 ${CONFIG.STARTING_SQUAD_SIZE - selectedClasses.length} 人`;
    } else if (needCarrier) {
      confirmBtn.textContent = `請指定攜帶者`;
    } else {
      confirmBtn.textContent = `出發（${selectedClasses.length} 人）`;
    }
  }

  function toggleClass(clsId) {
    const idx = selectedClasses.indexOf(clsId);
    if (idx !== -1) {
      selectedClasses.splice(idx, 1);
    } else if (selectedClasses.length < CONFIG.STARTING_SQUAD_SIZE) {
      selectedClasses.push(clsId);
    }
    updateSelectUI();
  }

  function toggleLibraryRelic(relicId) {
    selectedLibraryRelicId = selectedLibraryRelicId === relicId ? null : relicId;
    if (!selectedLibraryRelicId) selectedLibraryCarrierCls = null;
    updateSelectUI();
  }

  function toggleLibraryCarrier(clsId) {
    selectedLibraryCarrierCls = selectedLibraryCarrierCls === clsId ? null : clsId;
    updateSelectUI();
  }

  function getLibraryRelics() {
    const unlocked = localStorage.getItem('bbn_library_unlocked') !== 'false';
    if (!unlocked) return [];
    return safeParseStorage('bbn_library', [])
      .map(r => getRelicById(r?.id))
      .filter(r => r?.effect?.type !== 'unlock_library');
  }

  function safeParseStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  document.getElementById('btn-confirm-squad').addEventListener('click', () => {
    if (selectedClasses.length < CONFIG.STARTING_SQUAD_SIZE) return;
    if (selectedLibraryRelicId && !selectedLibraryCarrierCls) return;
    selectModal.classList.add('hidden');
    startGame(selectedClasses, selectedLibraryRelicId, selectedLibraryCarrierCls);
  });

  document.getElementById('btn-cancel-squad').addEventListener('click', () => {
    selectModal.classList.add('hidden');
  });

  // ─── 啟動遊戲 ────────────────────────────────────────────
  function startGame(classes, startingLibraryRelicId = null, startingLibraryCarrierCls = null) {
    AudioManager?.unlock?.();
    startScreen.style.display = 'none';
    gameoverScr.style.display = 'none';
    gameoverScr.classList.remove('active');
    gameScreen.style.display = 'flex';
    gameScreen.classList.add('active');
    Game.init(classes, startingLibraryRelicId, startingLibraryCarrierCls);
    AudioManager?.sync?.();
  }

  // ─── 結束今天 ────────────────────────────────────────────
  document.getElementById('btn-end-day').addEventListener('click', () => {
    Game.endDay();
  });

  document.getElementById('btn-field-rest')?.addEventListener('click', () => {
    Game.fieldRest();
  });

  document.getElementById('turn-end-float')?.addEventListener('click', () => {
    Game.endDay();
  });

  // ─── 筆記 ────────────────────────────────────────────────
  document.getElementById('btn-open-notes').addEventListener('click', () => {
    Render.showNotes();
  });

  document.getElementById('btn-open-log')?.addEventListener('click', () => {
    document.body.classList.add('mobile-log-open');
  });

  document.getElementById('btn-close-log')?.addEventListener('click', () => {
    document.body.classList.remove('mobile-log-open');
  });

  document.getElementById('btn-dev-tool')?.addEventListener('click', () => {
    Game.openDevTool();
  });

  document.getElementById('btn-close-notes').addEventListener('click', () => {
    notesModal.classList.add('hidden');
  });

  // ─── 重新開始 ────────────────────────────────────────────
  document.getElementById('btn-restart').addEventListener('click', () => {
    gameoverScr.style.display = 'none';
    gameoverScr.classList.remove('active');
    startScreen.style.display = 'flex';
    startScreen.classList.add('active');
    AudioManager?.sync?.();
  });

  // ─── 檢查聖物庫狀態，決定是否顯示筆記按鈕 ───────────────
  const lib = localStorage.getItem('bbn_library_unlocked') !== 'false';
  const notes = safeParseStorage('bbn_notes', {});
  const visitedTerrains = safeParseStorage('bbn_terrain', []);
  const hasNotes = Object.keys(notes).length > 0 || visitedTerrains.length > 0;

  // 起始畫面的筆記按鈕（只有存有筆記才顯示）
  const btnNotesStart = document.getElementById('btn-notes-start');
  if (btnNotesStart) {
    btnNotesStart.style.display = 'block';
    btnNotesStart.addEventListener('click', () => {
      // 開一個簡單 modal 來顯示筆記（遊戲未開始時）
      const tempNotes = safeParseStorage('bbn_notes', {});
      // 載入到當前全域狀態暫時顯示
      G.notes = tempNotes;
      G.notes = safeParseStorage('bbn_notes', {});
      G.visitedTerrains = safeParseStorage('bbn_terrain', []);
      G.squad = [];
      G.library = getLibraryRelics();
      G.libraryUnlocked = lib;
      G.activeResonances = [];
      Render.showNotes();
    });
  }

  // 按 Escape 關閉任意 modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!notesModal.classList.contains('hidden')) {
        notesModal.classList.add('hidden');
      }
    }
  });
});
