"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_SIZE, type Page } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * At full rollout these tables are the entry point to thousands of rows, which
 * is why they page rather than scroll.
 */
export function DataPager<T>({
  page,
  onPageChange,
}: {
  page: Page<T>;
  onPageChange: (page: number) => void;
}) {
  if (page.total <= PAGE_SIZE) return null;

  const from = (page.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page.page * PAGE_SIZE, page.total);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3">
      <span className="text-muted-foreground text-[0.84rem]">
        Showing {from} to {to} of {page.total}
      </span>
      {/* Previous and next with the position between them: as wide on page 1 as on page 100. */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page.page === 1}
          onClick={() => onPageChange(page.page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </Button>
        <span className="text-muted-foreground min-w-[6.5rem] text-center text-[0.86rem]" aria-live="polite">
          Page {page.page} of {page.pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page.page === page.pages}
          onClick={() => onPageChange(page.page + 1)}
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="text-faint pointer-events-none absolute left-3 size-4" />
      <Input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg pl-9 text-[0.9rem]"
      />
    </div>
  );
}
