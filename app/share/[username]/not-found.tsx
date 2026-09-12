import Link from "next/link";

// Reached when the username is malformed, unknown, or the owner
// hasn't turned sharing on. All three look identical on purpose:
// a private profile shouldn't be distinguishable from one that
// doesn't exist, or the page becomes a username oracle.
export default function ShareNotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--shell-pad)" }}>
      <div className="card animate-in" style={{ maxWidth: 420, textAlign: "center", display: "flex", flexDirection: "column", gap: ".9rem" }}>
        <h1 className="font-title page-title" style={{ margin: 0 }}>
          Nothing here
        </h1>
        <p style={{ fontSize: ".9rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
          This profile is private, or the link is wrong. Check the spelling and try again.
        </p>
        <Link href="/" className="btn btn-primary" style={{ alignSelf: "center" }}>
          Go to Stride
        </Link>
      </div>
    </div>
  );
}
