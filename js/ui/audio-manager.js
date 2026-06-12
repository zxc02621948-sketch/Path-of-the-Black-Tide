const AudioManager = {
  tracks: {
    exploreEarly: 'assets/audio/explore-early.mp3',
    exploreNight: 'assets/audio/explore-night.mp3',
    battleNormal: 'assets/audio/battle-normal.mp3',
    // Intentionally swapped: these two files were renamed by mood, not by current track id.
    battleGuardian: 'assets/audio/battle-final.mp3',
    battleDarkAvatar: 'assets/audio/battle-dark-avatar.wav',
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
    weakpointHit: 'assets/audio/sfx/weakpoint-hit.wav',
    resonancePainBurst: 'assets/audio/sfx/resonance-pain-burst.wav',
    resonancePainTorment: 'assets/audio/sfx/resonance-pain-torment.wav',
    resonanceIronGreatsword: 'assets/audio/sfx/resonance-iron-greatsword.wav',
    resonanceFateD12: 'assets/audio/sfx/resonance-fate-d12.wav',
    resonanceLuckyD12: 'assets/audio/sfx/resonance-lucky-d12.wav',
    resonanceStarHunterEye: 'assets/audio/sfx/resonance-star-hunter-eye.wav',
    resonanceStarBreakerEye: 'assets/audio/sfx/resonance-star-breaker-eye.wav',
    resonanceDualBanner: 'assets/audio/sfx/resonance-dual-banner.wav',
    resonanceRapier: 'assets/audio/sfx/resonance-rapier.wav',
    silverBeePinCut: 'assets/audio/sfx/silver-bee-pin-cut.mp3',
    ironScabbardSlice: 'assets/audio/sfx/iron-scabbard-slice.mp3',
    damageTierSurgeElectric: 'assets/audio/sfx/damage-tier-surge-electric.mp3',
    damageTierFinisherRumble: 'assets/audio/sfx/damage-tier-finisher-rumble.wav',
    dayEndTransition: 'assets/audio/sfx/day-end-transition.wav',
    nightfallTransition: 'assets/audio/sfx/nightfall-transition.wav',
    fateD12Normal: 'assets/audio/sfx/fate-d12-normal.wav',
    fateD12Burst: 'assets/audio/sfx/fate-d12-burst.wav',
    luckyD12Normal: 'assets/audio/sfx/lucky-d12-normal.wav',
    luckyD12Burst: 'assets/audio/sfx/lucky-d12-burst.wav',
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
  retryTimers: {},
  watchdogTimer: null,
  healthSnapshot: null,
  quietSince: 0,
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
    this.ensureBgmWatchdog();
  },

  resolveTrackId() {
    if (typeof G === 'undefined') return 'exploreEarly';
    if (G.phase === 'over') {
      return ['lose', 'devoured'].includes(G.gameResult) ? 'gameOver' : '';
    }
    const combat = G.combat || G.modal?.combat || null;
    if (combat?.suppressBgm) return '';
    const enemy = combat?.enemy || null;
    const reward = combat?.reward || null;
    if (enemy) {
      if (enemy.finalBoss || reward === 'final_boss') return 'battleFinal';
      if (enemy.darkMonster) return 'battleDarkAvatar';
      if (enemy.echoGuardian) return 'battleGuardian';
      return 'battleNormal';
    }
    return G.phase === 'night' ? 'exploreNight' : 'exploreEarly';
  },

  play(trackId) {
    if (!trackId || this.pageHidden) return;
    this.wantedId = trackId;
    this.ensureBgmWatchdog();
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
    this.cancelRetry(trackId);
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
        this.cancelRetry(trackId);
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
        this.scheduleRetry(trackId);
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
        this.cancelRetry(this.currentId);
        if (audio.volume <= 0) this.fade(audio, audio.volume, this.trackVolume(this.currentId), this.fadeMs);
      })
      .catch(() => {
        const trackId = this.currentId;
        if (this.currentAudio === audio) {
          this.currentAudio = null;
          this.currentId = '';
        }
        this.scheduleRetry(trackId);
      });
  },

  scheduleRetry(trackId, attempt = 1) {
    if (!trackId || this.retryTimers[trackId] || this.pageHidden) return;
    this.ensureBgmWatchdog();
    const delay = Math.min(1200, 160 * attempt);
    this.retryTimers[trackId] = setTimeout(() => {
      delete this.retryTimers[trackId];
      if (this.wantedId !== trackId || this.pageHidden) return;
      this.play(trackId);
      const audio = this.currentAudio;
      if (this.wantedId === trackId && (!audio || audio.paused)) {
        this.scheduleRetry(trackId, attempt + 1);
      }
    }, delay);
  },

  cancelRetry(trackId = '') {
    if (trackId) {
      if (this.retryTimers[trackId]) clearTimeout(this.retryTimers[trackId]);
      delete this.retryTimers[trackId];
      return;
    }
    Object.keys(this.retryTimers).forEach(id => this.cancelRetry(id));
  },

  ensureBgmWatchdog() {
    if (this.watchdogTimer || !this.unlocked || this.pageHidden || !this.wantedId) return;
    this.watchdogTimer = setInterval(() => this.checkBgmHealth(), 700);
  },

  cancelBgmWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = null;
    this.healthSnapshot = null;
    this.quietSince = 0;
  },

  checkBgmHealth() {
    if (!this.unlocked || this.pageHidden) return;
    const desiredId = this.resolveTrackId();
    if (!desiredId) {
      this.stop();
      return;
    }
    if (desiredId !== this.wantedId) {
      this.sync();
      return;
    }
    const audio = this.currentAudio;
    if (this.currentId !== desiredId || !audio) {
      this.forceReplay(desiredId);
      return;
    }
    if (audio.paused || audio.ended || audio.error) {
      this.forceReplay(desiredId);
      return;
    }

    const now = performance.now();
    const targetVolume = this.trackVolume(desiredId);
    const tooQuiet = audio.volume <= Math.max(0.02, targetVolume * 0.08);
    if (tooQuiet) {
      if (!this.quietSince) this.quietSince = now;
      if (now - this.quietSince > 1400) {
        this.fade(audio, audio.volume, targetVolume, 260);
        this.quietSince = now;
      }
    } else {
      this.quietSince = 0;
    }

    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const snapshot = this.healthSnapshot;
    if (!snapshot || snapshot.trackId !== desiredId) {
      this.healthSnapshot = { trackId: desiredId, currentTime, at: now };
      return;
    }
    if (Math.abs(currentTime - snapshot.currentTime) > 0.03) {
      this.healthSnapshot = { trackId: desiredId, currentTime, at: now };
      return;
    }
    if (now - snapshot.at > 2400) {
      this.forceReplay(desiredId);
    }
  },

  forceReplay(trackId) {
    if (!trackId || this.wantedId !== trackId || this.pageHidden) return;
    const audio = this.currentAudio;
    if (audio) {
      this.fadeTokens.set(audio, {});
      this.rememberTrackTime(this.currentId, audio);
      try {
        audio.pause();
      } catch (err) {}
      delete this.preloadedTracks[trackId];
    }
    this.currentAudio = null;
    this.currentId = '';
    this.healthSnapshot = null;
    this.quietSince = 0;
    this.play(trackId);
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
    this.sync();
    this.playSfx('button');
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

  playSfx(id, volume = this.sfxVolume, opts = null) {
    if (!this.unlocked || this.pageHidden) return null;
    const src = this.sfx[id];
    if (!src) return null;
    const audio = this.preloadedSfx[id]?.cloneNode?.() || new Audio(src);
    audio.volume = volume;
    if (opts && Number.isFinite(opts.rate) && opts.rate > 0) {
      try {
        audio.playbackRate = opts.rate;
        audio.preservesPitch = false;
      } catch (e) { /* 老瀏覽器不支援 preservesPitch */ }
    }
    audio.play().catch(() => {});
    return audio;
  },

  playRandomSfx(ids = [], volume = this.sfxVolume) {
    const pool = Array.isArray(ids) ? ids.filter(id => this.sfx[id]) : [];
    if (!pool.length) return null;
    const id = pool[Math.floor(Math.random() * pool.length)];
    return this.playSfx(id, volume);
  },

  playEventInjurySfx(volume = 0.5) {
    return this.playRandomSfx(['eventInjury1', 'eventInjury2', 'eventInjury3', 'eventInjury4', 'eventInjury5'], volume);
  },

  playDayTransitionSfx(phase = 'day') {
    if (!this.unlocked || this.pageHidden) return;
    const phaseSfx = {
      day: { id: 'dayEndTransition', volume: 0.52, delayMs: 820 },
      nightfall: { id: 'nightfallTransition', volume: 0.58 },
    }[phase];
    if (phaseSfx?.id && this.sfx[phaseSfx.id]) {
      if (phaseSfx.delayMs > 0) {
        setTimeout(() => this.playSfx(phaseSfx.id, phaseSfx.volume), phaseSfx.delayMs);
      } else {
        this.playSfx(phaseSfx.id, phaseSfx.volume);
      }
      return;
    }
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
    this.bindTrackHealthEvents(trackId, audio);
    try {
      audio.load();
    } catch (err) {}
    this.preloadedTracks[trackId] = audio;
    return audio;
  },

  bindTrackHealthEvents(trackId, audio) {
    if (!audio || audio._bbnHealthBound) return;
    audio._bbnHealthBound = true;
    ['ended', 'error', 'stalled', 'emptied', 'abort'].forEach(eventName => {
      audio.addEventListener(eventName, () => {
        if (this.currentAudio !== audio || this.wantedId !== trackId || this.pageHidden) return;
        this.forceReplay(trackId);
      });
    });
    audio.addEventListener('pause', () => {
      if (this.currentAudio !== audio || this.wantedId !== trackId || this.pageHidden) return;
      this.scheduleRetry(trackId);
    });
  },

  trackVolume(trackId) {
    return Math.max(0, Math.min(1, this.trackVolumes?.[trackId] ?? this.volume));
  },

  stop(immediate = false) {
    this.wantedId = '';
    this.currentId = '';
    this.cancelRetry();
    this.cancelBgmWatchdog();
    const audio = this.currentAudio;
    this.currentAudio = null;
    if (!audio) return;
    if (immediate) {
      this.fadeTokens.set(audio, {});
      audio.volume = 0;
      audio.pause();
      return;
    }
    this.fade(audio, audio.volume, 0, this.fadeMs, () => audio.pause());
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
