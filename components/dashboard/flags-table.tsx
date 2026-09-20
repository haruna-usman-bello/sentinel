"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SeverityRule, SignalTag, StatusPill } from "@/components/dashboard/badges";
import { FlagDecision } from "@/components/dashboard/flag-decision";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { monthLabel, severityOf } from "@/lib/domain";
import type { Flag } from "@/lib/types";

export function FlagsTable({
  flags,
  showLga = true,
  showState = false,
  empty,
}: {
  flags: Flag[];
  showLga?: boolean;
  showState?: boolean;
  empty?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Facility</TableHead>
            <TableHead>Disease</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Signal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flags.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-[0.83rem]">
                {empty ?? "Nothing to show."}
              </TableCell>
            </TableRow>
          ) : (
            flags.map((flag) => {
              return (
                <TableRow
                  key={flag.id}
                  className="hover:bg-secondary cursor-pointer align-top"
                  onClick={() => router.push(`/flags/${flag.id}`)}
                >
                  <TableCell>
                    <SeverityRule level={severityOf(flag)} />
                    <Link
                      href={`/flags/${flag.id}`}
                      className="font-semibold hover:underline focus-visible:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {flag.facilityName}
                    </Link>
                    <div className="text-faint mt-[2px] font-mono text-[0.7rem]">
                      {flag.facility}
                      {showLga ? ` · ${flag.lga} LGA` : ""}
                      {showState ? ` · ${flag.state}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    {flag.disease}
                    <div className="mt-[3px]">
                      <SignalTag type={flag.type} />
                    </div>
                  </TableCell>
                  <TableCell className="tnum font-mono whitespace-nowrap">
                    {monthLabel(flag.period)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {flag.type === "statistical" ? (
                      <>
                        <span className="tnum font-mono">{flag.cases} cases</span>
                        <div className="text-faint mt-[2px] font-mono text-[0.7rem]">
                          {flag.z?.toFixed(1)}× usual
                        </div>
                      </>
                    ) : (
                      <span className="text-warning font-mono">no report</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={flag.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <FlagDecision flag={flag} />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
