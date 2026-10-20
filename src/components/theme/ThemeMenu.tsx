'use client'

import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import {
  readThemeChoice,
  setThemeChoice,
  subscribeThemeChoice,
  type ThemeChoice,
} from './theme'

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const serverChoice = (): ThemeChoice => 'system'

/**
 * Light / Dark / System, as three toggle buttons on the sunk track. The
 * choice is stored per viewer (localStorage `tws-theme`) and applied at once.
 */
export function ThemeMenu({ className }: { className?: string }) {
  const choice = useSyncExternalStore(subscribeThemeChoice, readThemeChoice, serverChoice)

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn('grid grid-cols-3 gap-0.5 rounded-ctl bg-sunk p-[3px]', className)}
    >
      {OPTIONS.map((o) => {
        const on = choice === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => setThemeChoice(o.value)}
            className={cn(
              'focus-ring inline-flex h-9 items-center justify-center rounded-[2px] border px-2 text-[13px] font-medium outline-none transition-[color,background-color,border-color] duration-150 md:h-[30px]',
              on
                ? 'border-edge bg-surface text-ink'
                : 'border-transparent text-text-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
