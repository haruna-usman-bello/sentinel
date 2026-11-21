import { ChevronRight } from "lucide-react";

import { Status } from "@/components/dashboard/badges";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Disclosure, KeyValue } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { monthLong, stampLabel } from "@/lib/domain";
import { listPeriods } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import { ingestionOverview, listIngestRuns, listMappings } from "@/lib/queries/system";
import { cn } from "@/lib/utils";

import { DiseaseMappingFields, FacilityMappingList } from "./dhis2-mapping";
import { FacilityImport } from "./facility-import";
import { RunIngestionButton } from "./run-ingestion-button";

const RESULT = {
  ok: { label: "Done", tone: "success" },
  warn: { label: "Partial", tone: "warning" },
  fail: { label: "Failed", tone: "critical" },
} as const;

/** One step of setting up the connection. Setup is a real sequence, so the steps are numbered. */
function SetupStep({
  number,
  title,
  progress,
  done,
  defaultOpen = false,
  children,
}: {
  number: number;
  title: string;
  progress: string;
  done: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="border-b">
      <details open={defaultOpen} className="group/step">
        <summary className="hover:bg-secondary/60 focus-visible:ring-ring/50 grid cursor-pointer list-none grid-cols-[1.75rem_minmax(0,1fr)_1rem] items-center gap-3 rounded-md px-1 py-3 outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className={cn(
              "grid size-7 place-items-center rounded-full border-[1.5px] text-[0.8rem] font-bold",
              done ? "bg-success border-success text-white dark:text-background" : "text-muted-foreground",
            )}
          >
            {number}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[0.95rem] font-semibold">{title}</span>
            <span className="text-muted-foreground text-[0.85rem]">
              {done ? <span className="sr-only">Done. </span> : null}
              {progress}
            </span>
          </span>
          <ChevronRight
            aria-hidden
            className="text-faint size-4 transition-transform group-open/step:rotate-90 motion-reduce:transition-none"
          />
        </summary>
        <div className="pt-1 pb-5 pl-1 sm:pl-11">{children}</div>
      </details>
    </li>
  );
}

export default async function IngestPage() {
  const { role } = await viewer();
  if (role.key !== "sysadmin") return <RoleGate allow={["sysadmin"]} />;

  const [runs, connection, periods, mappings] = await Promise.all([
    listIngestRuns(),
    ingestionOverview(),
    listPeriods(),
    listMappings(),
  ]);
  const last = runs[0];
  const period = periods.at(-1);
  const linkedDiseases = mappings.diseases.filter((d) => d.dataElement).length;
  const allLinked = connection.facilities > 0 && connection.mapped === connection.facilities;

  const holding = period
    ? `Sentinel holds case counts up to ${monthLong(period)}.`
    : "Sentinel holds no case counts yet.";

  return (
    <>
      <PageHeader title="DHIS2 connection" />
      <PageBody>
        <section
          className={cn(
            "flex flex-wrap items-start justify-between gap-x-8 gap-y-4 rounded-xl px-5 py-4",
            connection.live && connection.mapped ? "bg-success-soft" : "bg-warning-soft",
          )}
        >
          <div className="flex max-w-[64ch] min-w-0 flex-col gap-1.5">
            {!connection.live ? (
              <>
                <Status tone="warning" className="text-[0.95rem]">Not connected</Status>
                <p className="text-[0.92rem]">
                  {holding} Scheduled pulls skip the download until DHIS2 is set up, and detection
                  runs on what is already held.
                </p>
                <p className="text-muted-foreground text-[0.88rem]">
                  To connect, add <code className="font-mono text-[0.9em]">DHIS2_BASE_URL</code> and
                  an access token in <code className="font-mono text-[0.9em]">DHIS2_PAT</code> (or{" "}
                  <code className="font-mono text-[0.9em]">DHIS2_USERNAME</code> and{" "}
                  <code className="font-mono text-[0.9em]">DHIS2_PASSWORD</code>) to the deployment&apos;s
                  settings.
                </p>
              </>
            ) : connection.mapped === 0 ? (
              <>
                <Status tone="warning" className="text-[0.95rem]">Connected, but nothing to pull yet</Status>
                <p className="text-[0.92rem]">
                  {holding} A pull returns nothing until facilities are linked to their organisation
                  units in step 4.
                </p>
              </>
            ) : (
              <>
                <Status tone="success" className="text-[0.95rem]">Connected</Status>
                <p className="text-[0.92rem]">
                  {holding} Pulls cover {connection.mapped} of {connection.facilities} facilities.
                </p>
              </>
            )}
            <p className="text-muted-foreground text-[0.88rem]">{connection.schedule}.</p>
          </div>
          <RunIngestionButton />
        </section>

        <ol className="m-0 list-none border-t p-0" aria-label="Setup">
          <SetupStep
            number={1}
            title="Connect to DHIS2"
            progress={connection.live ? (connection.endpoint ?? "Connected") : "Address and access token not set"}
            done={connection.live}
          >
            <KeyValue
              items={[
                {
                  term: "Address",
                  value: connection.endpoint ? (
                    <span className="break-all">{connection.endpoint}</span>
                  ) : (
                    "Not set"
                  ),
                },
                { term: "Signs in with", value: connection.auth },
                { term: "Schedule", value: connection.schedule },
                { term: "If a pull fails", value: connection.onFailure },
              ]}
            />
          </SetupStep>
          <SetupStep
            number={2}
            title="Read the facility register"
            progress={
              connection.facilities
                ? `${connection.facilities} ${connection.facilities === 1 ? "facility" : "facilities"} on the register`
                : "No facility on the register yet"
            }
            done={connection.facilities > 0}
            defaultOpen={connection.live && connection.facilities === 0}
          >
            <FacilityImport configured={connection.live} />
          </SetupStep>
          <SetupStep
            number={3}
            title="Link each disease to its data element"
            progress={`${linkedDiseases} of ${mappings.diseases.length} linked`}
            done={mappings.diseases.length > 0 && linkedDiseases === mappings.diseases.length}
          >
            <DiseaseMappingFields diseases={mappings.diseases} />
          </SetupStep>
          <SetupStep
            number={4}
            title="Link each facility to its organisation unit"
            progress={`${connection.mapped} of ${connection.facilities} linked`}
            done={allLinked}
          >
            <FacilityMappingList facilities={mappings.facilities} />
          </SetupStep>
        </ol>

        <Disclosure
          title="Recent pulls"
          count={runs.length}
          note={last ? `Last: ${stampLabel(last.at)}, ${RESULT[last.status].label.toLowerCase()}` : "None yet"}
        >
          {runs.length ? (
            <ul className="m-0 list-none border-t p-0">
              {/* Two pulls can fall in the same minute, so the time alone is not a key. */}
              {runs.map((run, i) => (
                <li key={`${run.at}/${i}`} className="border-line-soft flex flex-col gap-1 border-b py-3">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[0.92rem] font-semibold">{stampLabel(run.at)}</span>
                    <Status tone={RESULT[run.status].tone}>{RESULT[run.status].label}</Status>
                  </span>
                  <span className="text-muted-foreground text-[0.86rem]">
                    {run.note || "No detail recorded."}{" "}
                    {run.records ? `${run.records} records from ${run.orgUnits} units, ` : ""}
                    {(run.durationMs / 1000).toFixed(1)} seconds.
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-[0.9rem]">No pull has run yet.</p>
          )}
        </Disclosure>
      </PageBody>
    </>
  );
}
