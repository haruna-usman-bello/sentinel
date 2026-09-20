"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/lib/actions/accounts";
import { changePasswordSchema, fieldErrors } from "@/lib/validation";

export function ChangePasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = changePasswordSchema.safeParse({
      current: data.get("current"),
      next: data.get("next"),
      repeat: data.get("repeat"),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await changePasswordAction(parsed.data);
      if (result.ok) {
        toast.success(result.message, { description: result.description });
        form.reset();
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        toast.error(result.error);
      }
    });
  }

  const labelClass =
    "text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase";

  return (
    <form onSubmit={submit} className="flex flex-col gap-[11px]">
      <div className="flex flex-col gap-1">
        <Label htmlFor="current" className={labelClass}>
          Current password
        </Label>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.current}
        />
        {errors.current ? (
          <p className="text-critical text-[0.8rem]">{errors.current}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="next" className={labelClass}>
          New password
        </Label>
        <Input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.next}
        />
        {errors.next ? (
          <p className="text-critical text-[0.8rem]">{errors.next}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="repeat" className={labelClass}>
          Repeat new password
        </Label>
        <Input
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.repeat}
        />
        {errors.repeat ? (
          <p className="text-critical text-[0.8rem]">{errors.repeat}</p>
        ) : null}
      </div>

      <p className="text-muted-foreground m-0 text-[0.83rem]">
        At least 8 characters. Changing it signs out every other session on your account.
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
