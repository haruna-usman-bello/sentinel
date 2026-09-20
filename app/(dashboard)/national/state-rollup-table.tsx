"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SeverityRule, StatusPill, Tag } from "@/components/dashboard/badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StateRollup } from "@/lib/domain";

export function StateRollupTable({ rollup }: { rollup: StateRollup[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>State</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead>Open</TableHead>
            <TableHead>Confirmed</TableHead>
            <TableHead>Silent</TableHead>
            <TableHead>Diseases</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rollup.map((row) => {
            const level = row.confirmed > 0 ? "hi" : row.open > 0 ? "md" : "lo";
            const [label, status] =
              row.confirmed > 0
                ? (["Attention", "confirmed"] as const)
                : row.open > 0
                  ? (["Watch", "pending"] as const)
                  : (["Quiet", "closed"] as const);
            return (
              <TableRow
                key={row.state}
                className="hover:bg-secondary cursor-pointer"
                onClick={() =>
                  router.push(`/flags?state=${encodeURIComponent(row.state)}`)
                }
              >
                <TableCell>
                  <SeverityRule level={level} />
                  <Link
                    href={`/flags?state=${encodeURIComponent(row.state)}`}
                    className="font-semibold hover:underline focus-visible:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.state}
                  </Link>
                </TableCell>
                <TableCell className="tnum font-mono">{row.total}</TableCell>
                <TableCell className="tnum font-mono">{row.open}</TableCell>
                <TableCell className="tnum font-mono">
                  {row.confirmed || "—"}
                </TableCell>
                <TableCell className="tnum font-mono">{row.silent || "—"}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {row.diseases.map((d) => (
                      <Tag key={d}>{d}</Tag>
                    ))}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusPill status={status} label={label} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
