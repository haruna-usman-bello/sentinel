"use client";

import { useEffect } from "react";

/**
 * The outermost boundary inside the app's own shell. It catches what the
 * per-screen boundary cannot: a failure in the dashboard layout itself,
 * which in practice means the database was unreachable when the session was
 * looked up. Without this the browser shows Next's default server-error
 * page, which tells a surveillance officer nothing.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sentinel failed to load:", error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-[620px] flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-[1.9rem] font-semibold">Sentinel is not reachable</h1>
      <p className="text-muted-foreground m-0">
        The system could not be loaded, so nothing is shown rather than something
        partial. No flag or decision has been changed by this.
      </p>
      <p className="text-muted-foreground m-0">
        This is almost always the database being briefly unreachable. Try again in a
        moment; if it keeps happening, tell the system administrator.
      </p>
      {error.digest ? (
        <p className="text-faint m-0 font-mono text-[0.72rem]">
          Reference {error.digest} — quote this when reporting it.
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-[0.87rem] font-medium"
      >
        Try again
      </button>
    </main>
  );
}
