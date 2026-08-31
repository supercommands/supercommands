(function () {
  try {
    var root = document.documentElement;

    var tintHint = window.localStorage && window.localStorage.getItem('cmdos_warm_tint_startup_hint');
    var rawStrength = window.localStorage && window.localStorage.getItem('cmdos_warm_tint_strength_startup_hint');
    var strength = 100;
    if (rawStrength !== null && rawStrength !== undefined) {
      var parsed = parseInt(rawStrength, 10);
      if (Number.isFinite(parsed)) {
        strength = Math.min(100, Math.max(0, parsed));
      }
    }

    if (tintHint === 'true') {
      root.dataset.warmTint = 'enabled';
    } else {
      root.dataset.warmTint = 'disabled';
    }

    var raw = window.localStorage && window.localStorage.getItem('cmdos_theme_startup_snapshot');
    if (!raw) return;

    var snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object') return;

    if (snapshot.warmTint && typeof snapshot.warmTint.color === 'string') {
      var maxOpacity = (typeof snapshot.warmTint.opacity === 'number' && Number.isFinite(snapshot.warmTint.opacity)) ? snapshot.warmTint.opacity : 0;
      var effectiveOpacity = Math.min(maxOpacity, Math.max(0, (maxOpacity * strength) / 100));
      root.style.setProperty('--appearance-warm-tint-color', snapshot.warmTint.color);
      root.style.setProperty('--appearance-warm-tint-opacity', String(tintHint === 'true' ? effectiveOpacity : 0));
    }

    var tokens = snapshot && snapshot.tokens;
    if (!tokens || typeof tokens !== 'object') return;

    root.classList.toggle('dark', Boolean(snapshot.isDark));
    if (typeof snapshot.themeId === 'string') {
      root.dataset.appearanceThemeId = snapshot.themeId;
    }

    Object.keys(tokens).forEach(function (key) {
      var value = tokens[key];
      if (typeof value === 'string') {
        root.style.setProperty('--color-' + key, value);
      }
    });

    var glassBlur = typeof snapshot.glassBlur === 'string' ? snapshot.glassBlur : '12px';
    root.style.setProperty('--glass-blur', 'blur(' + glassBlur + ') saturate(1.2)');
    root.style.setProperty('--color-backdrop', 'blur(' + glassBlur + ') saturate(1.2)');
  } catch (error) {
    // Fallback CSS remains available if the startup snapshot is absent or corrupt.
  }
})();

