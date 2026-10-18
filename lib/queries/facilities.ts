import "server-only";

import { prisma } from "@/lib/prisma";

/** How many facilities a state has on the register. */
export async function countFacilities(state: string): Promise<number> {
  return prisma.facility.count({ where: { stateName: state } });
}

/** The LGAs of a state that have at least one facility, alphabetical. */
export async function listLgas(state: string): Promise<string[]> {
  const rows = await prisma.facility.findMany({
    where: { stateName: state },
    distinct: ["lgaName"],
    select: { lgaName: true },
    orderBy: { lgaName: "asc" },
  });
  return rows.map((r) => r.lgaName);
}
