const AudioManager = {
  tracks: {
    exploreEarly: 'assets/audio/explore-early.mp3',
    exploreNight: 'assets/audio/explore-night.mp3',
    battleNormal: 'assets/audio/battle-normal.mp3',
    battleGuardian: 'assets/audio/battle-final.mp3',
    battleDarkAvatar: 'assets/audio/battle-dark-avatar.mp3',
    battleFinal: 'assets/audio/battle-guardian.mp3',
    gameOver: 'assets/audio/game-over.wav',
  },
  sfx: {
    button: 'assets/audio/sfx/ui-button.ogg',
    dice: 'assets/audio/sfx/dice-shake.ogg',
    hover: 'assets/audio/sfx/ui-hover.ogg',
    blockUp: 'assets/audio/sfx/block-up.mp3',
    blockFull: 'assets/audio/sfx/block-full.mp3',
    bowShot: 'assets/audio/sfx/bow-shot.wav',
    swordWoosh: 'assets/audio/sfx/sword-woosh.wav',
    daggerWoosh: 'assets/audio/sfx/dagger-woosh.wav',
    silverBeePinCut: 'assets/audio/sfx/silver-bee-pin-cut.mp3',
    ironScabbardSlice: 'assets/audio/sfx/iron-scabbard-slice.mp3',
    darkMonsterGrowl: 'assets/audio/sfx/dark-monster-growl.mp3',
    shadowWormSpawnGrowl: 'assets/audio/sfx/shadow-worm-spawn-growl.wav',
    rotCrawlerSpawnHiss: 'assets/audio/sfx/rot-crawler-spawn-hiss.wav',
    diceCorruptorSpawn: 'assets/audio/sfx/dice-corruptor-spawn.wav',
    plagueMothSpawn: 'assets/audio/sfx/plague-moth-spawn.wav',
    mimicSpawnGrowl: 'assets/audio/sfx/mimic-spawn-growl.wav',
    mimicDeathCrateBreak: 'assets/audio/sfx/mimic-death-crate-break.mp3',
    warriorDeath: 'assets/audio/sfx/warrior-death-laowei.mp3',
    explorerDeath: 'assets/audio/sfx/explorer-death-linjia.mp3',
    scholarDeath: 'assets/audio/sfx/scholar-death-chenshuming.mp3',
    supportDeath: 'assets/audio/sfx/support-death-xiaoci.mp3',
    rotKnightSpawnRoar: 'assets/audio/sfx/rot-knight-spawn-roar.wav',
    shadowHunterSpawnRoar: 'assets/audio/sfx/shadow-hunter-spawn-roar.wav',
    forestDarkGrowth: 'assets/audio/sfx/forest-dark-growth.wav',
    ruinsEnemy: 'assets/audio/sfx/ruins-enemy.wav',
    caveEyes: 'assets/audio/sfx/cave-eyes.wav',
    eventInjury1: 'assets/audio/sfx/event-injury-3yell5.wav?v=trim1',
    eventInjury2: 'assets/audio/sfx/event-injury-3yell3.wav?v=trim1',
    eventInjury3: 'assets/audio/sfx/event-injury-3yell4.wav?v=trim1',
    eventInjury4: 'assets/audio/sfx/event-injury-1yell7.wav?v=trim1',
    eventInjury5: 'assets/audio/sfx/event-injury-1yell6.wav?v=trim1',
  },
  volume: 0.46,
  trackVolumes: {
    battleGuardian: 0.9,
    battleFinal: 0.98,
    gameOver: 0.82,
  },
  sfxVolume: 0.42,
  hoverVolume: 0.18,
  hoverCooldownMs: 140,
  fadeMs: 900,
  currentId: '',
  currentAudio: null,
  fadeTimer: null,
  fadeTokens: new WeakMap(),
  unlocked: false,
  wantedId: '',
  resumeTrackIds: ['exploreEarly', 'exploreNight'],
  resumeTimes: {},
  lastHoverSfxAt: 0,
  preloadedTracks: {},
  preloadedSfx: {},
  pageHidden: false,
  toneContext: null,

  init() {
    if (this.ready) return;
    this.ready = true;
    const unlock = () => this.unlock();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('pointerdown', () => this.sync());
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('keydown', () => this.sync());
    document.addEventListener('click', ev => this.handleDocumentClick(ev));
    document.addEventListener('pointerover', ev => this.handleDocumentHover(ev));
    document.addEventListener('visibilitychange', () => this.handlePageVisibility(document.hidden));
    window.addEventListener('pagehide', () => this.handlePageVisibility(true));
    window.addEventListener('pageshow', () => this.handlePageVisibility(document.hidden));
    this.handlePageVisibility(document.hidden);
    this.preloadTracks();
  },

  unlock() {
    this.unlocked = true;
    this.preloadSfx();
    this.preloadTracks();
    this.sync();
  },

  sync() {
    const nextId = this.resolveTrackId();
    if (!nextId) {
      this.stop();
      return;
    }
    this.wantedId = nextId;
    if (!this.unlocked || this.pageHidden) return;
    this.play(nextId);
  },

  resolveTrackId() {
    if (typeof G === 'undefined') return 'exploreEarly';
    const enemy = G.combat?.enemy || null;
    const reward = G.combat?.reward || null;
    if (enemy) {
      if (enemy.finalBoss || reward === 'final_boss') return 'battleFinal';
      if (enemy.darkMonster) return 'battleDarkAvatar';
      if (enemy.echoGuardian) return 'battleGuardian';
      return 'battleNormal';
    }
    if (G.phase === 'over') {
      return ['lose', 'devoured'].includes(G.gameResult) ? 'gameOver' : '';
    }
    return G.phase === 'night' ? 'exploreNight' : 'exploreEarly';
  },

  play(trackId) {
    if (!trackId || this.pageHidden) return;
    if (this.currentId === trackId) {
      if (!this.currentAudio) {
        this.currentId = '';
      } else {
        if (this.currentAudio.paused) {
          this.resumeCurrent();
        } else if (this.currentAudio.volume <= 0) {
          this.fade(this.currentAudio, this.currentAudio.volume, this.trackVolume(trackId), this.fadeMs);
        }
        return;
      }
    }
    const audio = this.trackAudio(trackId);
    if (!audio) return;
    const previousId = this.currentId;
    this.currentId = trackId;
    const previous = this.currentAudio;
    this.rememberTrackTime(previousId, previous);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    this.restoreTrackTime(trackId, audio);
    try {
      if (audio.readyState === 0) audio.load();
    } catch (err) {}
    this.currentAudio = audio;
    audio.play()
      .then(() => {
        this.fade(audio, 0, this.trackVolume(trackId), this.fadeMs);
        if (previous) {
          this.fade(previous, previous.volume, 0, this.fadeMs, () => {
            this.rememberTrackTime(previousId, previous);
            previous.pause();
          });
        }
      })
      .catch(() => {
        this.currentAudio = previous || null;
        this.currentId = previous ? previousId : '';
        setTimeout(() => this.sync(), 250);
      });
  },

  resumeCurrent() {
    const audio = this.currentAudio;
    if (!this.unlocked || !this.currentId || this.pageHidden) return;
    if (!audio) {
      const trackId = this.currentId;
      this.currentId = '';
      this.play(trackId);
      return;
    }
    audio.play()
      .then(() => {
        if (audio.volume <= 0) this.fade(audio, audio.volume, this.trackVolume(this.currentId), this.fadeMs);
      })
      .catch(() => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
          this.currentId = '';
        }
      });
  },

  rememberTrackTime(trackId, audio) {
    if (!trackId || !audio || !this.resumeTrackIds.includes(trackId)) return;
    if (!Number.isFinite(audio.currentTime)) return;
    this.resumeTimes[trackId] = audio.currentTime;
  },

  restoreTrackTime(trackId, audio) {
    const savedTime = this.resumeTimes[trackId];
    if (!savedTime || !Number.isFinite(savedTime)) return;
    try {
      audio.currentTime = savedTime;
    } catch (err) {
      audio.addEventListener('loadedmetadata', () => {
        try {
          audio.currentTime = savedTime;
        } catch (error) {}
      }, { once: true });
    }
  },

  handleDocumentClick(ev) {
    if (this.pageHidden) return;
    const button = ev.target?.closest?.('button');
    if (!button || button.disabled) return;
    this.playSfx('button');
    this.sync();
  },

  handleDocumentHover(ev) {
    if (this.pageHidden) return;
    if (!this.canPlayHoverSfx(ev)) return;
    const target = ev.target?.closest?.('button, [role="button"], .clickable, .choice-card, .combat-unit, .inventory-item');
    if (!target || target.disabled || target.getAttribute?.('aria-disabled') === 'true') return;
    if (ev.relatedTarget && target.contains(ev.relatedTarget)) return;
    const now = performance.now();
    if (now - this.lastHoverSfxAt < this.hoverCooldownMs) return;
    this.lastHoverSfxAt = now;
    this.playSfx('hover', this.hoverVolume);
  },

  canPlayHoverSfx(ev = null) {
    if (ev?.pointerType && ev.pointerType !== 'mouse') return false;
    if (!window.matchMedia) return true;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  },

  playSfx(id, volume = this.sfxVolume) {
    if (!this.unlocked || this.pageHidden) return;
    const src = this.sfx[id];
    if (!src) return;
    const audio = this.preloadedSfx[id]?.cloneNode?.() || new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  },

  playRandomSfx(ids = [], volume = this.sfxVolume) {
    const pool = Array.isArray(ids) ? ids.filter(id => this.sfx[id]) : [];
    if (!pool.length) return;
    const id = pool[Math.floor(Math.random() * pool.length)];
    this.playSfx(id, volume);
  },

  playEventInjurySfx(volume = 0.5) {
    this.playRandomSfx(['eventInjury1', 'eventInjury2', 'eventInjury3', 'eventInjury4', 'eventInjury5'], volume);
  },

  playDayTransitionSfx(phase = 'day') {
    if (!this.unlocked || this.pageHidden) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      if (!this.toneContext) this.toneContext = new AudioContextClass();
      const ctx = this.toneContext;
      const resumePromise = ctx.resume?.();
      resumePromise?.catch?.(() => {});
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const darkPhase = phase === 'night' || phase === 'nightfall';
      const freqs = phase === 'dawn'
        ? [196, 247, 330, 392]
        : (darkPhase ? [165, 123, 82] : [196, 147, 220]);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(darkPhase ? 0.09 : 0.06, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      gain.connect(ctx.destination);
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.type = darkPhase ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.07);
        osc.connect(gain);
        osc.start(now + index * 0.07);
        osc.stop(now + 1.05 + index * 0.03);
      });
      setTimeout(() => gain.disconnect(), 1300);
    } catch (err) {}
  },

  preloadSfx(id = '') {
    const ids = id ? [id] : Object.keys(this.sfx);
    ids.forEach(sfxId => {
      if (this.preloadedSfx[sfxId]) return;
      const src = this.sfx[sfxId];
      if (!src) return;
      const audio = new Audio(src);
      audio.preload = 'auto';
      try {
        audio.load();
      } catch (err) {}
      this.preloadedSfx[sfxId] = audio;
    });
  },

  preloadTracks(id = '') {
    const ids = id ? [id] : Object.keys(this.tracks);
    ids.forEach(trackId => this.trackAudio(trackId));
  },

  trackAudio(trackId) {
    if (!trackId || !this.tracks[trackId]) return null;
    if (this.preloadedTracks[trackId]) return this.preloadedTracks[trackId];
    const audio = new Audio(this.tracks[trackId]);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    try {
      audio.load();
    } catch (err) {}
    this.preloadedTracks[trackId] = audio;
    return audio;
  },

  trackVolume(trackId) {
    return Math.max(0, Math.min(1, this.trackVolumes?.[trackId] ?? this.volume));
  },

  stop() {
    this.wantedId = '';
    this.currentId = '';
    const audio = this.currentAudio;
    this.currentAudio = null;
    if (audio) this.fade(audio, audio.volume, 0, this.fadeMs, () => audio.pause());
  },

  handlePageVisibility(isHidden) {
    const hidden = !!isHidden;
    if (this.pageHidden === hidden) return;
    this.pageHidden = hidden;
    if (hidden) {
      this.pauseForBackground();
      return;
    }
    this.sync();
  },

  pauseForBackground() {
    const audio = this.currentAudio;
    if (!audio) return;
    this.rememberTrackTime(this.currentId, audio);
    try {
      audio.pause();
    } catch (err) {}
  },

  fade(audio, from, to, duration, done = null) {
    if (!audio) return;
    const token = {};
    this.fadeTokens.set(audio, token);
    const start = performance.now();
    const tick = now => {
      if (this.fadeTokens.get(audio) !== token) return;
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      audio.volume = from + (to - from) * t;
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      audio.volume = to;
      this.fadeTokens.delete(audio);
      if (typeof done === 'function') done();
    };
    requestAnimationFrame(tick);
  },
};

window.AudioManager = AudioManager;
