// Theme choice shared by ThemeScript (before first paint), ThemeMenu and the
// Toaster. The stored choice lives in localStorage under THEME_STORAGE_KEY;
// the resolved theme lives on <html> as data-theme="light|dark".

export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'tws-theme'
const CHANGE_EVENT = 'tws-theme-change'

export function readThemeChoice(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Writes data-theme and color-scheme with transitions off, so the switch snaps. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  const theme = choice === 'system' ? systemTheme() : choice
  const style = document.createElement('style')
  style.appendChild(document.createTextNode('*,*::before,*::after{transition:none!important}'))
  document.head.appendChild(style)
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
  // Force a reflow so the new colors commit while transitions are off.
  void root.offsetHeight
  requestAnimationFrame(() => style.remove())
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  applyTheme(choice)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeThemeChoice(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function readResolvedTheme(): ResolvedTheme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function subscribeResolvedTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
