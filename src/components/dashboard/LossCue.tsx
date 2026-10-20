/**
 * A loss is written in parentheses ("(12)", "(4.5%)"). Screen readers skip
 * parentheses at their default punctuation level, so a loss would sound like
 * a plain number. Put this before the figure: it says "down" to screen
 * readers only, and renders nothing for any other text.
 */
export function LossCue({ value }: { value: string }) {
  return value.startsWith('(') ? <span className="sr-only">down </span> : null
}
