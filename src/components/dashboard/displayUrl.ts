// A destination as people read it in a table: no scheme, no leading www.
// 'https://www.youtube.com/watch?v=x' reads 'youtube.com/watch?v=x'. Display
// only: the full URL stays in the title attribute and in the data.
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
}
