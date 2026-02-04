import { safeSync } from '../TryCatch/safeSync.js';

const THEME_KEY = 'ui-theme';
const LIGHT_CLASS = 'light-theme';

export function initThemeEvents() {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (!themeBtn) return;

  // apply saved theme on load
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'light') {
    document.body.classList.add(LIGHT_CLASS);
  }

  themeBtn.addEventListener(
    'click',
    safeSync(() => {
      const isLight = document.body.classList.toggle(LIGHT_CLASS);
      localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    })
  );
}
