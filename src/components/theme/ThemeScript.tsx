import { THEME_STORAGE_KEY } from './theme'

// Runs in <head> before first paint, so the page never flashes the wrong
// theme. It resolves the stored choice ("light", "dark", or nothing for
// System) to data-theme on <html>, and keeps following the system setting
// and other tabs while the choice is System. Storage can throw (private
// windows, blocked site data), so every access is wrapped.
const script = `(function(){try{var d=document.documentElement,k=${JSON.stringify(
  THEME_STORAGE_KEY,
)},m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var s=null;try{s=window.localStorage.getItem(k)}catch(e){}var t=s==='light'||s==='dark'?s:(m.matches?'dark':'light');d.setAttribute('data-theme',t);d.style.colorScheme=t}a();var r=function(){var s=null;try{s=window.localStorage.getItem(k)}catch(e){}if(s!=='light'&&s!=='dark')a()};if(m.addEventListener)m.addEventListener('change',r);else if(m.addListener)m.addListener(r);window.addEventListener('storage',function(e){if(e.key===k)a()})}catch(e){}})();`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
