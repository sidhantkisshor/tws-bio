import { cva, type VariantProps } from 'class-variance-authority'

// Day Book buttons. One amber fill per view (`default`); everything else is
// neutral. Heights keep the project rule: 44px on phones, 36px from sm up
// (`lg` 40, `sm` 32). Transitions are 150ms on color, background and border
// only, and a press scales to 0.97 for tactile feedback. Each variant sets its
// own border color (never the base), so a raw `buttonVariants()` on a <Link>,
// which skips twMerge, still gets the outline edge.
export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-ctl border bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,scale] duration-150 ease-out outline-none select-none focus-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** The one filled action per view: amber fill, label on accent. */
        default: 'border-transparent bg-accent-fill text-on-accent hover:bg-accent-fill-hover',
        /** Surface fill, edge border, ink label (Export CSV, Cancel, Google). */
        outline:
          'border-edge bg-surface text-ink hover:bg-hover aria-expanded:bg-hover disabled:border-rule disabled:text-text-3 disabled:opacity-100',
        /** Sunk fill for a quiet secondary action. */
        secondary: 'border-transparent bg-sunk text-ink hover:bg-hover aria-expanded:bg-hover',
        /** Quiet: no border, secondary text, hover tint (row actions). */
        ghost: 'border-transparent text-text-2 hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink',
        /** Destructive: red text and border, never a red fill. */
        destructive: 'border-neg bg-surface text-neg hover:bg-hover',
        /** A text link in the accent color. */
        link: 'h-auto! border-transparent px-0! text-accent-text underline decoration-1 underline-offset-[3px] decoration-accent-text/40 hover:decoration-current active:scale-100',
      },
      size: {
        default:
          'h-11 gap-1.5 px-4 sm:h-9 sm:px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 gap-1 px-3 text-[13px] sm:h-8 sm:px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-11 gap-2 px-5 text-[15px] sm:h-10 sm:px-[18px]',
        icon: 'size-11 sm:size-9',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-11 sm:size-8',
        'icon-lg': 'size-11 sm:size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
