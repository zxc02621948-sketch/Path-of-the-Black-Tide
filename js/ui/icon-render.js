const EquipmentIcon = {
  html(item = {}, className = 'equipment-inline-icon') {
    if (item.iconImage) {
      const alt = this._escapeAttr(item.name || item.icon || '');
      return `<img class="${className}" src="${item.iconImage}" alt="${alt}">`;
    }
    return item.icon || '◆';
  },

  label(item = {}, className = 'equipment-inline-icon') {
    return `${this.html(item, className)} ${item.name || ''}`.trim();
  },

  _escapeAttr(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },
};
