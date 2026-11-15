"use client";

import { useActionState } from "react";
import type { CustomerCopy } from "@/domain/customer-copy";
import { enrollAction } from "@/server/loyalty-actions";
import { FormError } from "@/components/credential-forms";
import { TextField } from "@/components/fields";
import { SubmitButton } from "@/components/submit-button";

export function EnrollForm({
  slug,
  locale,
  copy,
}: {
  slug: string;
  locale: string;
  copy: CustomerCopy;
}) {
  const [state, action] = useActionState(enrollAction, {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="locale" value={locale} />
      <TextField label={copy.firstName} name="firstName" autoComplete="given-name" required />
      <TextField label={copy.lastName} name="lastName" autoComplete="family-name" required />
      <TextField label={copy.email} name="email" type="email" autoComplete="email" required />
      <TextField label={`${copy.phone} (${copy.optional})`} name="phone" type="tel" autoComplete="tel" />
      <TextField label={`${copy.birthday} (${copy.optional})`} name="birthday" type="date" />
      <label className="flex items-start gap-2 text-sm leading-5">
        <input className="mt-1" type="checkbox" name="accept" required />
        <span>{copy.accept}</span>
      </label>
      <label className="flex items-start gap-2 text-sm leading-5">
        <input className="mt-1" type="checkbox" name="emailConsent" />
        <span>{copy.emailConsent}</span>
      </label>
      <label className="flex items-start gap-2 text-sm leading-5">
        <input className="mt-1" type="checkbox" name="whatsappConsent" />
        <span>{copy.whatsappConsent}</span>
      </label>
      <label className="flex items-start gap-2 text-sm leading-5">
        <input className="mt-1" type="checkbox" name="smsConsent" />
        <span>{copy.smsConsent}</span>
      </label>
      <FormError message={state.error} />
      <SubmitButton pendingLabel={copy.joinPending}>{copy.joinSubmit}</SubmitButton>
    </form>
  );
}
