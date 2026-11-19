"use client";

import { useActionState, useState } from "react";
import {
  DEFAULT_QR_FALLBACK_URL,
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

function urlHelpForType(type: DestinationType): string {
  switch (type) {
    case "google_reviews":
      return "Paste a Google Maps or Google review link (maps.app.goo.gl, google.com, …).";
    case "instagram":
      return "Paste an Instagram profile or post URL.";
    case "whatsapp":
      return "Paste a WhatsApp link such as https://wa.me/...";
    case "website":
      return `Paste any website URL, or leave blank for ${DEFAULT_QR_FALLBACK_URL}.`;
    case "custom":
      return "Paste any http(s) URL.";
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

export function CreateDestinationForm({
  businessOptions,
}: {
  businessOptions: readonly { value: string; label: string }[];
}) {
  const [state, action] = useActionState(createDestinationAction, {});
  const [destinationType, setDestinationType] = useState<DestinationType>("website");

  return (
    <form action={action} className="grid max-w-xl gap-4">
      <TextField label="Business name" name="businessName" defaultValue="Perfumes y Belleza" required />
      <SelectField
        label="Linked business (optional)"
        name="businessId"
        defaultValue=""
        options={[{ value: "", label: "None" }, ...businessOptions]}
      />
      <div className="grid gap-1.5">
        <label htmlFor="destinationType" className="text-sm font-medium">
          Destination type
        </label>
        <select
          id="destinationType"
          name="destinationType"
          value={destinationType}
          onChange={(event) => setDestinationType(event.target.value as DestinationType)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
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
        type="text"
        placeholder={urlHelpForType(destinationType)}
      />
      <TextField
        label="Permanent QR code (optional)"
        name="code"
        placeholder="Leave blank to assign the next code (001, 002, …)"
      />
      <SelectField label="Status" name="status" defaultValue="active" options={statusOptions} />
      <p className="text-sm text-muted-foreground">
        Destination URL is where scanners land after the permanent QR. Leave blank to send them to{" "}
        {DEFAULT_QR_FALLBACK_URL}. Change type first (Website, Google Reviews, Instagram, …) so the URL
        matches.
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
  destinationType: initialType,
  destinationUrl: initialUrl,
  status,
  businessOptions,
}: {
  id: string;
  businessName: string;
  businessId: string | null;
  destinationType: DestinationType;
  destinationUrl: string;
  status: DestinationStatus;
  businessOptions: readonly { value: string; label: string }[];
}) {
  const [state, action] = useActionState(updateDestinationAction, {});
  const [destinationType, setDestinationType] = useState<DestinationType>(initialType);

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
      <div className="grid gap-1.5">
        <label htmlFor="destinationType" className="text-sm font-medium">
          Destination type
        </label>
        <select
          id="destinationType"
          name="destinationType"
          value={destinationType}
          onChange={(event) => setDestinationType(event.target.value as DestinationType)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <TextField
        label="Destination URL"
        name="destinationUrl"
        type="text"
        defaultValue={initialUrl}
        placeholder={urlHelpForType(destinationType)}
      />
      <SelectField label="Status" name="status" defaultValue={status} options={statusOptions} />
      <p className="text-sm text-muted-foreground">
        This Destination URL is what the QR opens today. Changing it does not change the permanent QR code (
        /go/…). Leave blank to send scanners to {DEFAULT_QR_FALLBACK_URL}. For Google review NFC cards, set
        type to Google Reviews and paste the Maps link.
      </p>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Saving…">Save destination</SubmitButton>
    </form>
  );
}
