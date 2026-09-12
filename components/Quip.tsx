import { KICKER, type QuoteContext } from "@/lib/quotes";

/**
 * The caption panel that carries every Spidey line in the app.
 *
 * Before this, each of the five surfaces that shows a quote styled it
 * itself, and all five arrived at the same place: .78rem, italic,
 * --text-muted, centred under a hairline. That is the house style for
 * a disclaimer, so the lines read as one and nobody looked at them.
 *
 * Here they get the same press as everything else on the page — inked
 * rule, hard shadow, halftone stock, a red caption tab notched over
 * the top-left and a web strung in the far corner. The panel styling
 * lives in globals.css under QUIP; this file only decides what goes in
 * it.
 *
 * Render it as a SIBLING of your cards, never inside one: .card sets
 * `overflow: hidden`, which would slice the tab and the speech tail
 * clean off.
 *
 * Pass `key={quote}` at the call site if the line can change while
 * mounted — that replays the entrance instead of swapping the text
 * underneath the reader.
 */
export default function Quip({
  quote,
  context = "general",
  kicker,
  plate = false,
  style,
}: {
  /** The line itself. Renders nothing when empty, so callers can start blank. */
  quote: string;
  /** Picks the caption tab's label. Ignored if `kicker` is given. */
  context?: QuoteContext;
  /** Override the tab text for a one-off moment. */
  kicker?: string;
  /** Yellow press plate — for the loud moments: a badge earned, a streak running. */
  plate?: boolean;
  style?: React.CSSProperties;
}) {
  if (!quote) return null;

  return (
    <aside className={plate ? "quip quip-plate" : "quip"} style={style}>
      <span className="quip-kicker">{kicker ?? KICKER[context]}</span>
      <span className="quip-web" aria-hidden="true" />
      <p className="quip-text">{quote}</p>
    </aside>
  );
}
