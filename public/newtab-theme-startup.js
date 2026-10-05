(function () {
  try {
    var root = document.documentElement;
    var startupWallpaperId = window.localStorage && (
      window.localStorage.getItem('supercommands_wallpaper_id_startup_hint') ||
      window.localStorage.getItem('cmdos_wallpaper_id_startup_hint')
    );
    var isPackagedWallpaperId = function (id) {
      return typeof id === 'string' && id !== 'none' && id !== 'custom' && /^[A-Za-z0-9._-]+$/.test(id);
    };
    var releaseStartupGuard = function () {
      delete root.dataset.startupWallpaperPending;
    };
    if (!isPackagedWallpaperId(startupWallpaperId)) {
      root.dataset.startupWallpaperPending = 'true';
      root.style.setProperty('background', 'var(--color-rootBg)', 'important');
      window.setTimeout(releaseStartupGuard, 180);

      var chromeLocal = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
      if (chromeLocal) {
        chromeLocal.get(['wallpaper-id-storage-key'], function (result) {
          var storedWallpaperId = result && result['wallpaper-id-storage-key'];
          if (isPackagedWallpaperId(storedWallpaperId)) {
            try {
              window.localStorage && window.localStorage.setItem('supercommands_wallpaper_id_startup_hint', storedWallpaperId);
            } catch (storageError) {
              // The canonical chrome.storage value still drives the current tab.
            }
          } else {
            try {
              window.localStorage && window.localStorage.setItem('supercommands_wallpaper_id_startup_hint', storedWallpaperId === 'custom' ? 'custom' : 'none');
            } catch (storageError) {
              // The hint only optimizes startup.
            }
          }
          releaseStartupGuard();
        });
      } else {
        releaseStartupGuard();
      }
    }

    var tintHint = window.localStorage && (
      window.localStorage.getItem('supercommands_warm_tint_startup_hint') ||
      window.localStorage.getItem('cmdos_warm_tint_startup_hint')
    );
    var rawStrength = window.localStorage && (
      window.localStorage.getItem('supercommands_warm_tint_strength_startup_hint') ||
      window.localStorage.getItem('cmdos_warm_tint_strength_startup_hint')
    );
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

    var raw = window.localStorage && (
      window.localStorage.getItem('supercommands_theme_startup_snapshot') ||
      window.localStorage.getItem('cmdos_theme_startup_snapshot')
    );
    if (!raw) return;

    var snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object') return;
    if (startupWallpaperId && startupWallpaperId !== 'none' && snapshot.isDark === false) return;

    if (snapshot.warmTint && typeof snapshot.warmTint.color === 'string') {
      var maxOpacity = (typeof snapshot.warmTint.opacity === 'number' && Number.isFinite(snapshot.warmTint.opacity)) ? snapshot.warmTint.opacity : 0;
      var effectiveOpacity = Math.min(maxOpacity, Math.max(0, (maxOpacity * strength) / 100));
      root.style.setProperty('--appearance-warm-tint-color', snapshot.warmTint.color);
      root.style.setProperty('--appearance-warm-tint-opacity', String(tintHint === 'true' ? effectiveOpacity : 0));
    }

    var tokens = snapshot && snapshot.tokens;
    if (!tokens || typeof tokens !== 'object') return;

    root.classList.toggle('dark', Boolean(snapshot.isDark));
    root.style.colorScheme = snapshot.isDark ? 'dark' : 'light';
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
    try {
      delete document.documentElement.dataset.startupWallpaperPending;
    } catch (cleanupError) {
      // Fallback CSS remains available.
    }
    // Fallback CSS remains available if the startup snapshot is absent or corrupt.
  }
})();
