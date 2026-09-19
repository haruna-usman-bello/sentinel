import { redirect } from "next/navigation";

import { currentSession } from "@/lib/session";

export default async function RootPage() {
  const session = await currentSession();
  redirect(session ? session.role.home : "/sign-in");
}
