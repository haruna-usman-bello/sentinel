"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOutOtherSessionsAction, updateOwnPhoneAction } from "@/lib/actions/accounts";
import { cn } from "@/lib/utils";
import { fieldErrors, ownPhoneSchema } from "@/lib/validation";

import { ChangePasswordForm } from "./change-password-form";

/** Changing the password is occasional, so it opens in a dialog rather than sitting on the page. */
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Enter your current password, then the new one twice.</DialogDescription>
        </DialogHeader>
        <ChangePasswordForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Same as device", icon: Monitor },
] as const;

/** Light, dark or the device's own setting, as one three-way switch. */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; until then nothing is shown as chosen.
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = inBrowser ? (theme ?? "system") : null;

  return (
    <div role="group" aria-label="Theme" className="bg-secondary inline-flex flex-wrap gap-1 rounded-lg p-1">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={current === value}
          onClick={() => setTheme(value)}
          className={cn(
            "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.86rem] font-medium outline-none focus-visible:ring-[3px]",
            current === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon aria-hidden className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Changing one's own phone number, confirmed with the current password. */
export function EditPhoneDialog({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(current);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = ownPhoneSchema.safeParse({ phone, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await updateOwnPhoneAction(parsed.data);
      if (result.ok) {
        toast.success(result.message, { description: result.description });
        setPassword("");
        setOpen(false);
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPhone(current);
          setPassword("");
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change phone number</DialogTitle>
          <DialogDescription>
            Alerts go to this number once SMS is set up. Your coordinator sees the change in the activity log.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="own-phone" className="text-[0.88rem] font-medium">
              Phone number
            </Label>
            <Input
              id="own-phone"
              value={phone}
              inputMode="tel"
              placeholder="+234…"
              aria-invalid={!!errors.phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {errors.phone ? (
              <p className="text-critical text-[0.84rem]">{errors.phone}</p>
            ) : (
              <p className="text-muted-foreground text-[0.84rem]">Leave it blank to remove it.</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="own-phone-password" className="text-[0.88rem] font-medium">
              Current password
            </Label>
            <Input
              id="own-phone-password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={!!errors.password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password ? <p className="text-critical text-[0.84rem]">{errors.password}</p> : null}
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save phone number"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Ends every other session on this account; this one stays signed in. */
export function SignOutOthersButton({ others }: { others: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || others === 0}
      onClick={() =>
        startTransition(async () => {
          const result = await signOutOtherSessionsAction();
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      {pending ? "Signing out…" : "Sign out other devices"}
    </Button>
  );
}
