"use client";

import { useActionState, useState } from "react";
import type { CustomerCopy } from "@/domain/customer-copy";
import { collectStampAction } from "@/server/loyalty-actions";
import { FormError } from "@/components/credential-forms";
import { SubmitButton } from "@/components/submit-button";

export function StampForm({
  code,
  via,
  locale,
  copy,
}: {
  code: string;
  via: "nfc" | "qr";
  locale: string;
  copy: CustomerCopy;
}) {
  const [state, action] = useActionState(collectStampAction, {});
  const [key] = useState(() => crypto.randomUUID());
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="via" value={via} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <FormError message={state.error} />
      <SubmitButton pendingLabel={copy.stampPending}>{copy.stampSubmit}</SubmitButton>
    </form>
  );
}
