const AudioManager = {
  tracks: {
    exploreEarly: 'assets/audio/explore-early.mp3',
    exploreNight: 'assets/audio/explore-night.mp3',
    battleNormal: 'assets/audio/battle-normal.mp3',
    battleGuardian: 'assets/audio/battle-guardian.mp3',
    battleFinal: 'assets/audio/battle-final.mp3',
  },
  sfx: {
    button: 'assets/audio/sfx/ui-button.ogg',
    dice: 'assets/audio/sfx/dice-shake.ogg',
    hover: 'assets/audio/sfx/ui-hover.ogg',
    bowShot: 'assets/audio/sfx/bow-shot.wav',
    swordWoosh: 'assets/audio/sfx/sword-woosh.wav',
    daggerWoosh: 'assets/audio/sfx/dagger-woosh.wav',
    silverBeePinCut: 'assets/audio/sfx/silver-bee-pin-cut.mp3',
    ironScabbardSlice: 'assets/audio/sfx/iron-scabbard-slice.mp3',
    darkMonsterGrowl: 'assets/audio/sfx/dark-monster-growl.mp3',
    forestDarkGrowth: 'assets/audio/sfx/forest-dark-growth.wav',
    ruinsEnemy: 'assets/audio/sfx/ruins-enemy.wav',
    caveEyes: 'assets/audio/sfx/cave-eyes.wav',
    caveRazorStoneInjury: 'assets/audio/sfx/cave-razor-stone-injury-tight.wav',
    forestSnareTrapFail: 'assets/audio/sfx/forest-snare-trap-fail-tight.wav',
  },
  volume: 0.46,
  trackVolumes: {
    battleFinal: 0.98,
  },
  sfxVolume: 0.42,
  hoverVolume: 0.18,
  hoverCooldownMs: 140,
  fadeMs: 900,
  currentId: '',
  currentAudio: null,
  fadeTimer: null,
  unlocked: false,
  wantedId: '',
  resumeTrackIds: ['exploreEarly', 'exploreNight'],
  resumeTimes: {},
  lastHoverSfxAt: 0,
  preloadedSfx: {},

  init() {
    if (this.ready) return;
    this.ready = true;
    const unlock = () => this.unlock();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('click', ev => this.handleDocumentClick(ev));
    document.addEventListener('pointerover', ev => this.handleDocumentHover(ev));
  },

  unlock() {
    this.unlocked = true;
    this.preloadSfx();
    this.sync();
  },

  sync() {
    const nextId = this.resolveTrackId();
    if (!nextId) {
      this.stop();
      return;
    }
    this.wantedId = nextId;
    if (!this.unlocked) return;
    this.play(nextId);
  },

  resolveTrackId() {
    if (typeof G === 'undefined') return 'exploreEarly';
    const enemy = G.combat?.enemy || null;
    const reward = G.combat?.reward || null;
    if (enemy) {
      if (enemy.finalBoss || reward === 'final_boss') return 'battleFinal';
      if (enemy.echoGuardian) return 'battleGuardian';
      return 'battleNormal';
    }
    if (G.phase === 'over') return '';
    return G.phase === 'night' ? 'exploreNight' : 'exploreEarly';
  },

  play(trackId) {
    if (!trackId) return;
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
    const src = this.tracks[trackId];
    if (!src) return;
    const previousId = this.currentId;
    this.currentId = trackId;
    const previous = this.currentAudio;
    this.rememberTrackTime(previousId, previous);
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    this.restoreTrackTime(trackId, audio);
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
      });
  },

  resumeCurrent() {
    const audio = this.currentAudio;
    if (!this.unlocked || !this.currentId) return;
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
    const button = ev.target?.closest?.('button');
    if (!button || button.disabled) return;
    this.playSfx('button');
  },

  handleDocumentHover(ev) {
    const target = ev.target?.closest?.('button, [role="button"], .clickable, .choice-card, .combat-unit, .inventory-item');
    if (!target || target.disabled || target.getAttribute?.('aria-disabled') === 'true') return;
    if (ev.relatedTarget && target.contains(ev.relatedTarget)) return;
    const now = performance.now();
    if (now - this.lastHoverSfxAt < this.hoverCooldownMs) return;
    this.lastHoverSfxAt = now;
    this.playSfx('hover', this.hoverVolume);
  },

  playSfx(id, volume = this.sfxVolume) {
    if (!this.unlocked) return;
    const src = this.sfx[id];
    if (!src) return;
    const audio = this.preloadedSfx[id]?.cloneNode?.() || new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
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

  fade(audio, from, to, duration, done = null) {
    if (!audio) return;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      audio.volume = from + (to - from) * t;
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      audio.volume = to;
      if (typeof done === 'function') done();
    };
    requestAnimationFrame(tick);
  },
};

window.AudioManager = AudioManager;
