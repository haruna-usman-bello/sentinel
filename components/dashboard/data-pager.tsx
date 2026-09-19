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
    <nav
      aria-label="Pagination"
      className="bg-secondary border-line-soft flex flex-wrap items-center justify-between gap-3 border-t px-[14px] py-[10px]"
    >
      <span className="text-muted-foreground font-mono text-[0.74rem]">
        Showing {from}–{to} of {page.total}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="bg-card size-7"
          disabled={page.page === 1}
          onClick={() => onPageChange(page.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        {Array.from({ length: page.pages }, (_, i) => i + 1).map((n) => (
          <Button
            key={n}
            variant={n === page.page ? "default" : "outline"}
            size="icon"
            className={cn("size-7 font-mono text-[0.78rem]", n !== page.page && "bg-card")}
            aria-current={n === page.page ? "page" : undefined}
            onClick={() => onPageChange(n)}
          >
            {n}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon"
          className="bg-card size-7"
          disabled={page.page === page.pages}
          onClick={() => onPageChange(page.page + 1)}
          aria-label="Next page"
        >
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
      <Search className="text-faint pointer-events-none absolute left-3 size-3.5" />
      <Input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[230px] rounded-full pl-8 text-[0.82rem]"
      />
    </div>
  );
}
