"use client";

// RHF tracks formState through a Proxy; the React Compiler optimizes those
// reads away, so errors and isSubmitting would never re-render without this.
"use no memo";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, LinkSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DataLabel } from "@/components/ui/prose";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cancelInvite,
  changeMemberRole,
  inviteMember,
  removeMember,
} from "@/server/actions/org-members";

// Mirrors the server's bounds. Client validation is UX only — the action
// re-validates with the same rules.
const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(160),
  role: z.enum(["admin", "member"]),
});

type InviteValues = z.infer<typeof inviteSchema>;

export function InviteForm() {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  });

  const onSubmit = form.handleSubmit((values) => {
    // Built from the validated values, not the submit event: RHF awaits async
    // validation before this runs, by which point React has nulled the event's
    // currentTarget.
    const data = new FormData();
    data.set("email", values.email);
    data.set("role", values.role);

    start(async () => {
      const result = await inviteMember(null, data);
      if (!result.ok) {
        form.setError("email", { message: result.error });
        return;
      }

      const url = `${window.location.origin}/join/${result.invitationId}`;
      setLink(url);
      form.reset();

      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied.");
      } catch {
        // Clipboard needs a permission the browser may refuse; the link is
        // rendered below either way, so this is not a failure.
        toast.success("Invite created.");
      }
    });
  });

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="flex-1 gap-2">
            <FieldLabel htmlFor="invite-email">
              <DataLabel>Email</DataLabel>
            </FieldLabel>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="teammate@company.com"
              aria-invalid={form.formState.errors.email ? true : undefined}
              {...form.register("email")}
            />
          </Field>

          <Field className="gap-2 sm:w-36">
            <FieldLabel htmlFor="invite-role">
              <DataLabel>Role</DataLabel>
            </FieldLabel>
            <Select
              defaultValue="member"
              onValueChange={(v) =>
                form.setValue("role", v as "admin" | "member")
              }
            >
              {/* w-full, not the component's default w-fit: the trigger has to
                  fill the field or it stops lining up with the input beside it. */}
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Button type="submit" disabled={pending}>
            {pending ? "Inviting…" : "Invite"}
          </Button>
        </div>
        <FieldError errors={[form.formState.errors.email]} />
      </form>

      {link ? (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3">
          <LinkSimpleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1">
            <p className="break-all font-mono text-xs">{link}</p>
            <p className="text-muted-foreground text-xs">
              We don't send invite emails yet — send this link to them yourself.
              It works once, for that email address.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MemberRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: "admin" | "member";
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <Select
      value={role}
      disabled={disabled || pending}
      onValueChange={(next) =>
        start(async () => {
          const result = await changeMemberRole(
            userId,
            next as "admin" | "member",
          );
          if (!result.ok) toast.error(result.error);
          else toast.success("Role updated.");
        })
      }
    >
      <SelectTrigger size="sm" className="w-28" aria-label="Change role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">Member</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function RemoveMemberButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Remove ${name}`}
        onClick={() => setConfirming(true)}
      >
        <XIcon className="size-4" />
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await removeMember(userId);
            if (!result.ok) {
              toast.error(result.error);
              setConfirming(false);
              return;
            }
            toast.success(`${name} removed.`);
          })
        }
      >
        <CheckIcon className="size-4" />
        Remove
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}

export function CancelInviteButton({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Cancel the invite to ${email}`}
      onClick={() =>
        start(async () => {
          const result = await cancelInvite(invitationId);
          if (!result.ok) toast.error(result.error);
          else toast.success("Invite cancelled.");
        })
      }
    >
      <XIcon className="size-4" />
    </Button>
  );
}
