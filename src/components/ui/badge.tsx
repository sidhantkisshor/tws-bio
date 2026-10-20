import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Day Book badge: a 1px hairline border, secondary text, no fill ("Opens
// Telegram", "Resource Drop"). `destructive` is a red border and red text
// ("Destination 404"). No colored dots and no pills.
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[2px] border px-1.5 text-[11.5px] leading-none font-medium whitespace-nowrap transition-[color,background-color,border-color] duration-150 focus-ring has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-rule text-text-2 [a&]:hover:bg-hover [a&]:hover:text-ink",
        secondary: "border-transparent bg-sunk text-text-2 [a&]:hover:text-ink",
        destructive: "border-neg text-neg [a&]:hover:bg-hover",
        outline: "border-edge text-ink [a&]:hover:bg-hover",
        ghost: "border-transparent text-text-2 hover:bg-hover hover:text-ink",
        link: "border-transparent px-0 text-accent-text underline underline-offset-[3px] decoration-accent-text/40 hover:decoration-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
