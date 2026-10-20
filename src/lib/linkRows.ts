// Row rules for the dashboard Links table. Kept free of heavy imports, because
// LinksTable loads this module on every visit to the links page.

/**
 * True for a Resource Drop row (`r/{slug}`). The /r/[slug] route creates the
 * row on the first click and redirects without reading it, so is_active, the
 * destination, the expiry and the click limit change nothing a visitor sees.
 * Deleting one cascades its click history away, and the next click starts a
 * fresh row at zero. Custom codes cannot contain '/', so the prefix marks
 * these rows and only these.
 */
export function isResourceDropRow(shortCode: string): boolean {
  return shortCode.startsWith('r/')
}

/** Ids of the rows on screen that bulk actions may touch, in screen order. */
export function selectableLinkIds(
  rows: readonly { id: string; short_code: string }[],
): string[] {
  return rows.filter((row) => !isResourceDropRow(row.short_code)).map((row) => row.id)
}

/**
 * The part of a selection that bulk actions act on. The table is not remounted
 * when the page, search or filters change, so a selection can still name rows
 * that are no longer on screen. A bulk delete must never reach those.
 */
export function effectiveSelection(
  selected: ReadonlySet<string>,
  selectableIds: readonly string[],
): string[] {
  return selectableIds.filter((id) => selected.has(id))
}
