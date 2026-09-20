import { RoleGate } from "@/components/dashboard/role-gate";
import { listAccounts, listPostings } from "@/lib/queries/accounts";
import { viewer } from "@/lib/queries/shared";

import { UserManagement } from "./user-management";

export default async function UsersPage() {
  const { role, scope } = await viewer();
  if (role.key !== "sysadmin" && role.key !== "state") {
    return <RoleGate allow={["sysadmin", "state"]} />;
  }

  const [accounts, postings] = await Promise.all([
    listAccounts(scope, role.key),
    listPostings(scope, role.key),
  ]);

  return <UserManagement accounts={accounts} postings={postings} />;
}
