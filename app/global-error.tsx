"use client";

/**
 * The last resort: a failure in the root layout, before the app's styles and
 * fonts are in place. It has to carry its own document, so it is deliberately
 * plain — reaching it means very little else is working.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "6rem 1.5rem",
          maxWidth: "38rem",
          marginInline: "auto",
          lineHeight: 1.6,
        }}
      >
        <h1 style={{ fontSize: "1.6rem", margin: "0 0 1rem" }}>Sentinel is not reachable</h1>
        <p style={{ margin: "0 0 1rem" }}>
          The system could not start. No flag or decision has been changed. Try again in a
          moment; if it keeps happening, tell the system administrator.
        </p>
        {error.digest ? (
          <p style={{ margin: "0 0 1.5rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
            Reference {error.digest}
          </p>
        ) : null}
        <button type="button" onClick={reset} style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
