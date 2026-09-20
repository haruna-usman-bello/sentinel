import { vi } from "vitest";

import type { SessionUser } from "@/lib/types";

/**
 * The server-only guard and Next's request-bound APIs have no meaning under
 * Vitest; the session is replaced by whoever the test says is signed in.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

export const signedIn: { user: SessionUser | null } = { user: null };

vi.mock("@/lib/session", async () => {
  const { ROLES } = await import("@/lib/roles");
  const currentSession = async () =>
    signedIn.user ? { user: signedIn.user, role: ROLES[signedIn.user.role] } : null;
  return {
    currentSession,
    requireSession: async () => {
      const session = await currentSession();
      if (!session) throw new Error("Not signed in.");
      return session;
    },
  };
});
