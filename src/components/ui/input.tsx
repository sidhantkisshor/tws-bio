import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

// Day Book input: surface fill, 1px edge border, 3px radius, placeholder in
// tertiary text. 44px and 16px text on phones (so iOS does not zoom), 36px and
// 14px from sm up. Focus moves the border to the accent and adds the 2px ring.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-ctl border border-edge bg-surface px-3 py-1 text-base text-ink transition-[color,background-color,border-color] duration-150 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-text-3 focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-rule disabled:bg-sunk disabled:text-text-3 aria-invalid:border-neg sm:h-9 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
