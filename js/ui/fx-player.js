const FxPlayer = {
  after(ms, callback) {
    const delay = Math.max(0, Number(ms) || 0);
    const timer = setTimeout(() => {
      if (typeof callback === 'function') callback();
    }, delay);
    return () => clearTimeout(timer);
  },

  frame(callback) {
    const frameId = requestAnimationFrame(() => {
      if (typeof callback === 'function') callback();
    });
    return () => cancelAnimationFrame(frameId);
  },

  restartClass(el, className, duration = 0) {
    if (!el || !className) return () => {};
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    if (!duration) return () => el.classList.remove(className);
    return this.after(duration, () => el.classList.remove(className));
  },

  addClassFor(el, className, duration) {
    if (!el || !className) return () => {};
    el.classList.add(className);
    return this.after(duration, () => el.classList.remove(className));
  },

  removeAfter(el, duration) {
    if (!el) return () => {};
    return this.after(duration, () => el.remove());
  },

  layer(root, className, parts = [], duration = 900) {
    if (!root) return () => {};
    const layer = document.createElement('div');
    layer.className = className;
    layer.setAttribute('aria-hidden', 'true');
    for (const part of parts) {
      if (!part) continue;
      const el = document.createElement(part.tag || 'span');
      el.className = part.className || 'fx-part';
      const styles = part.style || {};
      Object.entries(styles).forEach(([key, value]) => {
        el.style.setProperty(key, String(value));
      });
      layer.appendChild(el);
    }
    root.appendChild(layer);
    const cleanup = this.removeAfter(layer, duration);
    return () => {
      cleanup();
      layer.remove();
    };
  },

  play(steps = []) {
    const cleanups = [];
    for (const step of steps) {
      if (!step) continue;
      const at = Math.max(0, Number(step.at) || 0);
      cleanups.push(this.after(at, () => {
        if (typeof step.call === 'function') {
          step.call();
          return;
        }
        if (step.el && step.className) {
          this.restartClass(step.el, step.className, step.duration || 0);
        }
      }));
    }
    return () => cleanups.forEach(cleanup => cleanup());
  },
};

window.FxPlayer = FxPlayer;
