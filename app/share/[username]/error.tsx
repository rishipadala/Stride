"use client";

// getProfile() throws on a database error rather than calling
// notFound(), so a hiccup shows this and can be retried -- instead
// of caching "no such person" for 60 seconds.
export default function ShareError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="card animate-in" style={{ maxWidth: 420, textAlign: "center", display: "flex", flexDirection: "column", gap: ".9rem" }}>
        <h1 className="font-title" style={{ fontSize: "2rem", fontWeight: 900, lineHeight: .94, margin: 0 }}>
          Couldn&apos;t load this
        </h1>
        <p style={{ fontSize: ".9rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
          Something went wrong reaching the record. The profile may still be fine.
        </p>
        <button type="button" onClick={reset} className="btn btn-primary" style={{ alignSelf: "center" }}>
          Try again
        </button>
      </div>
    </div>
  );
}
