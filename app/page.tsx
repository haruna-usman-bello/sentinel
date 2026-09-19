import { redirect } from "next/navigation";

import { currentRole } from "@/lib/session";

export default async function RootPage() {
  const role = await currentRole();
  redirect(role ? role.home : "/sign-in");
}
