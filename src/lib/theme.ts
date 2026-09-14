import type { Theme } from '@/types/tool';

export const DARK_CLASS = 'dark';
export const THEME_ATTRIBUTE = 'data-theme';
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS, resolveTheme(theme) === 'dark');
  root.setAttribute(THEME_ATTRIBUTE, theme);
}

// The server sets the class from the theme cookie, which covers light and dark.
// Only "system" needs the client, because the server cannot know the OS
// preference. Runs before first paint, so there is nothing to flash.
export const THEME_INIT_SCRIPT = `(function(){try{var r=document.documentElement;if(r.getAttribute('${THEME_ATTRIBUTE}')!=='system')return;r.classList.toggle('${DARK_CLASS}',window.matchMedia('${DARK_MEDIA_QUERY}').matches)}catch(e){}})();`;
