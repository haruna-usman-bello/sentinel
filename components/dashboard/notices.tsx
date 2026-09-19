"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";

export function DenialNotice() {
  const { denial } = useDashboard();
  if (!denial) return null;

  return (
    <div
      role="alert"
      className="bg-critical-soft border-critical/40 flex items-start gap-[11px] rounded-md border px-[15px] py-[13px]"
    >
      <span className="bg-critical mt-px shrink-0 rounded-[3px] px-[7px] py-[2px] font-mono text-[0.65rem] font-semibold text-white">
        Denied
      </span>
      <div className="text-[0.85rem]">
        <strong className="font-semibold">{denial.title}</strong>
        <br />
        {denial.body}
      </div>
    </div>
  );
}
