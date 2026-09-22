import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-[640px] flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-[1.9rem] font-semibold">Page not found</h1>
      <p className="text-muted-foreground m-0">
        There is nothing at this address. If you followed a link to a flag, it may have
        been raised in a state or LGA your role does not cover.
      </p>
      <Button asChild>
        <Link href="/">Back to your dashboard</Link>
      </Button>
    </main>
  );
}
