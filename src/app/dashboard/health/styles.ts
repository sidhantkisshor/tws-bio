// Shared by the Overview "Needs a look" strip, the Health rows and the
// destination check (a client component), so it lives in a module with no
// imports.

/**
 * A text link in the accent color. Below `sm` an invisible pseudo element
 * grows its hit area to 44px tall without moving the layout.
 */
export const fixLinkClass =
  "focus-ring relative rounded-[2px] text-sm text-accent-text underline decoration-accent-text/40 decoration-1 underline-offset-[3px] transition-colors duration-150 hover:decoration-current max-sm:after:absolute max-sm:after:-inset-x-2 max-sm:after:-inset-y-3.5 max-sm:after:content-['']"
