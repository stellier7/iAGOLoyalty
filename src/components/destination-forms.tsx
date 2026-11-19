"use client";

import { useActionState } from "react";
import {
  DESTINATION_STATUSES,
  DESTINATION_TYPE_LABELS,
  DESTINATION_TYPES,
  type DestinationStatus,
  type DestinationType,
} from "@/domain/qr-redirect";
import { SelectField, TextField } from "@/components/fields";
import { FormError } from "@/components/credential-forms";
import { SubmitButton } from "@/components/submit-button";
import { createDestinationAction, updateDestinationAction } from "@/server/qr-redirect-actions";

const typeOptions = DESTINATION_TYPES.map((value) => ({
  value,
  label: DESTINATION_TYPE_LABELS[value],
}));

const statusOptions = DESTINATION_STATUSES.map((value) => ({
  value,
  label: value === "active" ? "Active" : "Inactive",
}));

export function CreateDestinationForm({
  businessOptions,
}: {
  businessOptions: readonly { value: string; label: string }[];
}) {
  const [state, action] = useActionState(createDestinationAction, {});

  return (
    <form action={action} className="grid max-w-xl gap-4">
      <TextField label="Business name" name="businessName" defaultValue="Perfumes y Belleza" required />
      <SelectField
        label="Linked business (optional)"
        name="businessId"
        defaultValue=""
        options={[{ value: "", label: "None" }, ...businessOptions]}
      />
      <SelectField
        label="Destination type"
        name="destinationType"
        defaultValue="google_reviews"
        options={typeOptions}
      />
      <TextField
        label="How many QR codes"
        name="count"
        type="number"
        defaultValue="1"
        required
        step="1"
      />
      <TextField
        label="Destination URL (optional)"
        name="destinationUrl"
        type="url"
        placeholder="Leave blank to print first. Scans go to the iAGO home page until you set Google."
      />
      <TextField
        label="Permanent QR code (optional)"
        name="code"
        placeholder="Leave blank to assign the next code (001, 002, …)"
      />
      <SelectField label="Status" name="status" defaultValue="active" options={statusOptions} />
      <p className="text-sm text-muted-foreground">
        Create up to 50 empty codes at once. Each gets a permanent `/go/001` style link. Set the Google
        review URL later without reprinting.
      </p>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Saving…">Create destination</SubmitButton>
    </form>
  );
}

export function EditDestinationForm({
  id,
  businessName,
  businessId,
  destinationType,
  destinationUrl,
  status,
  businessOptions,
}: {
  id: string;
  businessName: string;
  businessId: string | null;
  destinationType: DestinationType;
  destinationUrl: string | null;
  status: DestinationStatus;
  businessOptions: readonly { value: string; label: string }[];
}) {
  const [state, action] = useActionState(updateDestinationAction, {});

  return (
    <form action={action} className="grid max-w-xl gap-4">
      <input type="hidden" name="id" value={id} />
      <TextField label="Business name" name="businessName" defaultValue={businessName} required />
      <SelectField
        label="Linked business (optional)"
        name="businessId"
        defaultValue={businessId ?? ""}
        options={[{ value: "", label: "None" }, ...businessOptions]}
      />
      <SelectField
        label="Destination type"
        name="destinationType"
        defaultValue={destinationType}
        options={typeOptions}
      />
      <TextField
        label="Destination URL"
        name="destinationUrl"
        type="url"
        defaultValue={destinationUrl ?? ""}
        placeholder="Paste the Google review link when you have it"
      />
      <SelectField label="Status" name="status" defaultValue={status} options={statusOptions} />
      <p className="text-sm text-muted-foreground">
        Changing the destination URL or reassigning the business does not change the permanent QR code or URL.
        Leave the URL blank to keep sending scanners to the iAGO home page.
      </p>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Saving…">Save destination</SubmitButton>
    </form>
  );
}
