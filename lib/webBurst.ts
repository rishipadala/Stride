// ============================================================
// The web-shot easter egg.
//
// This used to run off a document-level click listener in AppShell,
// which meant nine DOM nodes and an animation on EVERY click in the
// app — including clicking into a text field. An easter egg that
// fires constantly isn't an easter egg, it's a background process.
//
// Now it's called deliberately, at the one moment in the app that's
// actually a small win: marking your attendance for the day.
// ============================================================

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function webBurst(x: number, y: number) {
  if (typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const container = document.createElement("div");
  container.className = "web-burst";
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;

  for (const deg of ANGLES) {
    const strand = document.createElement("div");
    strand.className = "web-strand";
    strand.style.setProperty("--strand-rot", `rotate(${deg}deg)`);
    container.appendChild(strand);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 400);
}

/** Fires from the centre of the element that was clicked. */
export function webBurstFrom(el: Element | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  webBurst(r.left + r.width / 2, r.top + r.height / 2);
}
