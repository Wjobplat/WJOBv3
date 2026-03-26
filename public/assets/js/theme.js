/* ================================================================
   W-JOB — Theme Manager v2.0
   Dark / Light mode avec persistance localStorage
   ================================================================ */
(function () {
  var THEME_KEY = 'wjob-theme';

  var MOON_PATH = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  var SUN_PATHS = '<circle cx="12" cy="12" r="5"/>' +
    '<line x1="12" y1="1" x2="12" y2="3"/>' +
    '<line x1="12" y1="21" x2="12" y2="23"/>' +
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>' +
    '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
    '<line x1="1" y1="12" x2="3" y2="12"/>' +
    '<line x1="21" y1="12" x2="23" y2="12"/>' +
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>' +
    '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    updateIcons(theme);
    updateTitle(theme);
  }

  function updateIcons(theme) {
    document.querySelectorAll('[data-theme-icon]').forEach(function (svg) {
      svg.innerHTML = (theme === 'light') ? MOON_PATH : SUN_PATHS;
    });
    /* fallback: icons inside the toggle button */
    document.querySelectorAll('.theme-toggle-btn svg, #theme-toggle-btn svg').forEach(function (svg) {
      svg.innerHTML = (theme === 'light') ? MOON_PATH : SUN_PATHS;
    });
  }

  function updateTitle(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.title = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre';
    });
    var btns = document.querySelectorAll('.top-nav-action[onclick*="toggleTheme"]');
    btns.forEach(function (btn) {
      btn.title = theme === 'dark' ? 'Mode clair' : 'Mode sombre';
    });
  }

  window.toggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };

  /* Apply immediately (before paint) to avoid flash */
  var saved = 'dark';
  try { saved = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', saved);

  /* Update icons once DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyTheme(saved); });
  } else {
    applyTheme(saved);
  }
})();
