import { cn } from '@/lib/utils'

// Class helpers for the two choice controls in Day Book. Apply them to links
// or buttons; give the selected one aria-current="page" (links) or
// aria-pressed / aria-selected / aria-checked (buttons).

/** The sunk track of a segmented control (time range, theme). */
export function segmentedTrack(className?: string): string {
  return cn('inline-grid grid-flow-col auto-cols-fr gap-0.5 rounded-ctl bg-sunk p-[3px]', className)
}

/** One option on the track: a surface chip with an edge border when selected. 44px tall on phones with the track. */
export function segmentedItem(active: boolean, className?: string): string {
  return cn(
    'focus-ring inline-flex h-[38px] items-center justify-center rounded-[2px] border px-3 text-[13px] font-medium whitespace-nowrap outline-none transition-[color,background-color,border-color] duration-150 md:h-[30px]',
    active ? 'border-edge bg-surface text-ink' : 'border-transparent text-text-2 hover:text-ink',
    className,
  )
}

/**
 * A filter chip (All 116, Live 109...). Text with the count in tertiary text
 * (wrap the count in `<span className={chipCount(active)}>`). Selected: ink-2
 * fill with page-colored text.
 */
export function chip(active: boolean, className?: string): string {
  return cn(
    'focus-ring inline-flex h-11 shrink-0 items-center gap-1.5 rounded-ctl border border-transparent px-2.5 text-[13px] font-medium whitespace-nowrap outline-none transition-[color,background-color] duration-150 sm:h-8',
    active ? 'bg-ink-2 text-page' : 'text-text-2 hover:bg-hover hover:text-ink',
    className,
  )
}

export function chipCount(active: boolean): string {
  return cn('font-normal tabular-nums', active ? 'text-page/80' : 'text-text-3')
}
