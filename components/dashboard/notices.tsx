"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";

export function DenialNotice() {
  const { denial } = useDashboard();
  if (!denial) return null;

  return (
    <div role="alert" className="bg-critical-soft max-w-[72ch] rounded-lg px-4 py-3 text-[0.92rem]">
      <strong className="font-semibold">{denial.title}</strong> {denial.body}
    </div>
  );
}
