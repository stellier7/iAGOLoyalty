"use client";

import { useState, useActionState } from "react";
import { CURRENCIES, LOCALES, TIMEZONES } from "@/domain/markets";
import { EMPLOYEE_PERMISSIONS, defaultEmployeePermissions } from "@/domain/permissions";
import { createBusinessAction, inviteMemberAction, savePlatformSettingAction, updateBusinessAction, updateNameAction } from "@/server/actions";
import { PERMISSION_LABELS } from "@/server/types";
import { SelectField, TextField } from "@/components/fields";
import { FormError } from "@/components/credential-forms";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";

export function CreateBusinessForm() {
  const [state, action] = useActionState(createBusinessAction, {});

  return (
    <form action={action} className="grid gap-4">
      <TextField label="Business name" name="name" required />
      <TextField label="Public slug" name="slug" />
      <p className="text-sm text-muted-foreground">Leave the slug blank to generate it from the business name. Enrollment will live at /join/that-slug.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Time zone" name="timezone" defaultValue="America/Tegucigalpa" options={TIMEZONES.map((zone) => ({ value: zone, label: zone }))} />
        <SelectField label="Currency" name="currency" defaultValue="HNL" options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))} />
        <SelectField label="Customer language" name="locale" defaultValue="es" options={LOCALES} />
      </div>
      <TextField label="Contact email" name="contactEmail" type="email" />
      <TextField label="Owner email" name="ownerEmail" type="email" required />
      <FormError message={state.error} />
      {state.inviteUrl ? <InviteLink url={state.inviteUrl} /> : null}
      <SubmitButton pendingLabel="Creating…">Create business</SubmitButton>
    </form>
  );
}

export function BusinessProfileForm({
  businessId,
  name,
  timezone,
  currency,
  locale,
  contactEmail,
}: {
  businessId: string;
  name: string;
  timezone: string;
  currency: string;
  locale: string;
  contactEmail: string | null;
}) {
  const [state, action] = useActionState(updateBusinessAction, {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="businessId" value={businessId} />
      <TextField label="Business name" name="name" defaultValue={name} required />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Time zone" name="timezone" defaultValue={timezone} options={TIMEZONES.map((zone) => ({ value: zone, label: zone }))} />
        <SelectField label="Currency" name="currency" defaultValue={currency} options={CURRENCIES.map((item) => ({ value: item, label: item }))} />
        <SelectField label="Customer language" name="locale" defaultValue={locale} options={LOCALES} />
      </div>
      <TextField label="Contact email" name="contactEmail" type="email" defaultValue={contactEmail ?? ""} />
      <FormError message={state.error} />
      <SubmitButton>Save business profile</SubmitButton>
    </form>
  );
}

export function NameForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateNameAction, {});
  return (
    <form action={action} className="grid gap-4">
      <TextField label="Your name" name="fullName" defaultValue={fullName} required />
      <FormError message={state.error} />
      <SubmitButton>Save name</SubmitButton>
    </form>
  );
}

export function InviteMemberForm({ businessId }: { businessId: string }) {
  const [state, action] = useActionState(inviteMemberAction, {});
  const [role, setRole] = useState("employee");
  const defaults = defaultEmployeePermissions();

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="businessId" value={businessId} />
      <TextField label="Email" name="email" type="email" required />
      <div className="grid gap-1.5">
        <label htmlFor="role" className="text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="employee">Employee</option>
        </select>
      </div>
      {role === "employee" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Employee permissions</legend>
          {EMPLOYEE_PERMISSIONS.map((permission) => (
            <label key={permission} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`permission_${permission}`}
                defaultChecked={defaults[permission]}
              />
              {PERMISSION_LABELS[permission]}
            </label>
          ))}
        </fieldset>
      ) : null}
      <FormError message={state.error} />
      {state.inviteUrl ? <InviteLink url={state.inviteUrl} /> : null}
      <SubmitButton pendingLabel="Creating invitation…">Create invitation</SubmitButton>
    </form>
  );
}

export function PlatformSettingForm({
  settingKey,
  label,
  value,
}: {
  settingKey: string;
  label: string;
  value: string;
}) {
  const [state, action] = useActionState(savePlatformSettingAction, {});
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="key" value={settingKey} />
      <TextField label={label} name="value" defaultValue={value} required />
      <FormError message={state.error} />
      <div>
        <Button type="submit" variant="outline">
          Save
        </Button>
      </div>
    </form>
  );
}

function InviteLink({ url }: { url: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/40 p-3">
      <p className="text-sm">Email delivery is not configured. Share this invitation link. It expires in 7 days and is shown only now.</p>
      <a className="text-sm break-all text-primary underline" href={url}>
        {url}
      </a>
    </div>
  );
}
