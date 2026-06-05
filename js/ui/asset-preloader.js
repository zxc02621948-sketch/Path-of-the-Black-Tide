// Non-blocking image preloader for deployed builds.
const AssetPreloader = {
  loaded: new Set(),
  queued: new Set(),
  queue: [],
  active: 0,
  maxConcurrent: 3,
  startedDeferred: false,

  init() {
    this.preload([
      'assets/start-bg.png',
      'assets/title-logo.png',
      'assets/site-thumbnail.png',
      'assets/ui/guide-explore-map.png',
      'assets/ui/guide-relics-glow.png',
      'assets/ui/guide-equipment-cache.png',
      'assets/ui/guide-dark-avatar-countdown.png',
      'assets/ui/guide-notes-book.png',
      'assets/ui/modal-panel-frame.png',
      'assets/ui/choice-button-frame.png',
    ], { priority: true });
  },

  preloadGameAssets() {
    this.preload(this._criticalGameAssets(), { priority: true });
    this.preload(this._dataImageAssets(), { priority: false });
  },

  preload(urls = [], opts = {}) {
    const list = Array.isArray(urls) ? urls : [urls];
    for (const raw of list) {
      const url = this._cleanUrl(raw);
      if (!url || this.loaded.has(url) || this.queued.has(url)) continue;
      this.queued.add(url);
      if (opts.priority) {
        this.queue.unshift(url);
      } else {
        this.queue.push(url);
      }
    }
    this._schedule();
  },

  _schedule() {
    const run = () => this._pump();
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 1200 });
    } else {
      setTimeout(run, 80);
    }
  },

  _pump() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = !!connection?.saveData;
    const slowNetwork = /(^|-)2g$/.test(String(connection?.effectiveType || ''));
    const limit = saveData || slowNetwork ? 1 : this.maxConcurrent;

    while (this.active < limit && this.queue.length > 0) {
      const url = this.queue.shift();
      this._loadImage(url);
    }
  },

  _loadImage(url) {
    this.active += 1;
    const img = new Image();
    img.decoding = 'async';
    if ('fetchPriority' in img) img.fetchPriority = 'low';
    img.onload = img.onerror = () => {
      this.active = Math.max(0, this.active - 1);
      this.loaded.add(url);
      if (this.queue.length > 0) this._schedule();
    };
    img.src = url;
  },

  _criticalGameAssets() {
    return [
      'assets/ui/map-panel-bg.png',
      'assets/ui/log-panel-bg.png',
      'assets/ui/squad-panel-bg.png',
      'assets/ui/squad-card-bg.png',
      'assets/ui/combat-arena-frame.png',
      'assets/ui/inventory-panel-bg.png',
      'assets/ui/inventory-empty-slot-bg.png',
      'assets/ui/bag-icon.png',
      'assets/terrain/forest-tile.png?v=2',
      'assets/terrain/ruins-tile.png?v=2',
      'assets/terrain/cave-tile.png?v=2',
      'assets/terrain/altar-tile.png',
      'assets/terrain/rest-tile.png',
      'assets/terrain/rest-tile-used.png',
      'assets/enemies/common-monster-card-bg.png',
      'assets/enemies/full-card-atmosphere-bg.png',
      'assets/enemies/dark-avatar-combat.png',
      'assets/enemies/dark-avatar-card-bg.png',
      'assets/enemies/dark-monster-icon.png',
      'assets/relics/star-hunter-eye-resonance.png',
      'assets/relics/star-breaker-eye-resonance.png',
      'assets/relics/dodeca-fate-dice-resonance.png',
      'assets/relics/dodeca-lucky-dice-resonance.png',
      'assets/relics/dual-banner-formation-resonance.png',
      'assets/events/dark-avatar-chase-backdrop.png',
      'assets/events/dark-avatar-hunt-bound.png',
      'assets/icons/native-weakness-icon.png',
      'assets/icons/block-icon-clean.png',
      'assets/icons/wound-icon.png',
      'assets/icons/intent-attack-single.png',
      'assets/icons/intent-attack-all.png',
      'assets/icons/block-intent-icon-red.png',
      'assets/effects/sword-slash-sprite-grid.png',
      'assets/effects/dagger-slash-sprite.png',
      'assets/effects/bow-arrow-sprite-mask.png',
      'assets/effects/silver-bee-pin-sprite-grid.png',
      'assets/effects/fate-d12-weakness-sprite.png',
      'assets/effects/fate-d12-burst-sprite.png',
      'assets/effects/lucky-d12-weakness-sprite.png',
      'assets/effects/lucky-d12-burst-sprite.png',
      'assets/effects/dark-avatar-skill-sprite.png',
      ...Array.from({ length: 10 }, (_, digit) => `assets/effects/damage-digits/${digit}.png`),
    ];
  },

  _dataImageAssets() {
    const roots = [
      typeof CHARACTER_CLASSES !== 'undefined' ? CHARACTER_CLASSES : null,
      typeof CHARACTER_POOL !== 'undefined' ? CHARACTER_POOL : null,
      typeof EQUIPMENT !== 'undefined' ? EQUIPMENT : null,
      typeof WEAPONS !== 'undefined' ? WEAPONS : null,
      typeof GEARS !== 'undefined' ? GEARS : null,
      typeof RELICS !== 'undefined' ? RELICS : null,
      typeof RESONANCES !== 'undefined' ? RESONANCES : null,
      typeof ECHO_RELIC_SYSTEMS !== 'undefined' ? ECHO_RELIC_SYSTEMS : null,
      typeof ENEMIES !== 'undefined' ? ENEMIES : null,
      typeof EVENT_POOL !== 'undefined' ? EVENT_POOL : null,
    ];
    const urls = new Set([
      'assets/events/fate-gambling-table.png',
      'assets/events/fate-table-blood-wager.png',
      'assets/events/fate-table-night-wager.png',
      'assets/events/fate-table-life-wager.png',
      'assets/events/fate-table-blood-fail.png',
      'assets/events/fate-table-night-fail.png',
      'assets/events/fate-table-life-fail.png',
      'assets/events/echo-site-wound.png',
      'assets/events/echo-site-eagle.png',
      'assets/events/echo-site-fate.png',
      'assets/events/echo-site-banner.png',
      'assets/ui/treasure-chest-map.png',
      'assets/ui/dark-gift-chest-map.png',
      'assets/ui/battle-map-icon.png',
      'assets/ui/cage-warden-map.png',
      'assets/game-over-bg.png',
    ]);
    for (const root of roots) this._collectImageUrls(root, urls);
    return [...urls];
  },

  _collectImageUrls(value, urls, depth = 0) {
    if (depth > 8 || value == null) return;
    if (typeof value === 'string') {
      const url = this._cleanUrl(value);
      if (url) urls.add(url);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) this._collectImageUrls(item, urls, depth + 1);
      return;
    }
    if (typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'function') continue;
      if (/image|icon|avatar|portrait|background|backdrop|src/i.test(key)) {
        this._collectImageUrls(child, urls, depth + 1);
      } else if (typeof child === 'object') {
        this._collectImageUrls(child, urls, depth + 1);
      }
    }
  },

  _cleanUrl(value) {
    const url = String(value || '').trim();
    if (!url || !/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(url)) return '';
    if (/^(https?:|data:|blob:)/i.test(url)) return '';
    return url;
  },
};
