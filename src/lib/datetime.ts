// `<input type="datetime-local">` holds the viewer's local wall-clock time with
// no zone, while `links.expires_at` is a timestamptz. Sending the bare input
// value makes Postgres read it as UTC, so an expiry set in India landed 5h30m
// late. Going through Date keeps the instant right in both directions.

/** A stored ISO timestamp as a datetime-local value in the viewer's zone. */
export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** A datetime-local value, read in the viewer's zone, as an ISO timestamp. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null
  // A date-time string with no offset parses as local time.
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
