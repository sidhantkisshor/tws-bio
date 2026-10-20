// A destination as people read it in a table: no scheme, no leading www.
// 'https://www.youtube.com/watch?v=x' reads 'youtube.com/watch?v=x'. Display
// only: the full URL stays in the title attribute and in the data.
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
}

/**
 * displayUrl split at the first '/', '?' or '#' after the host, so a ledger
 * row can set the host in ink and the rest in tertiary text:
 * 'https://twsgurukulx.com/r/x' gives { host: 'twsgurukulx.com', rest: '/r/x' }.
 * A trailing lone '/' is dropped.
 */
export function splitDisplayUrl(url: string): { host: string; rest: string } {
  const shown = displayUrl(url)
  const cut = shown.search(/[/?#]/)
  if (cut === -1) return { host: shown, rest: '' }
  const rest = shown.slice(cut)
  return { host: shown.slice(0, cut), rest: rest === '/' ? '' : rest }
}
