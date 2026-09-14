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
