"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { requestRefreshAction } from "@/lib/actions/system";

export function RunIngestionButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await requestRefreshAction();
          if (result.ok) toast(result.message, { description: result.description });
          else toast.error(result.error);
        })
      }
    >
      {pending ? "Queuing…" : "Run ingestion now"}
    </Button>
  );
}
