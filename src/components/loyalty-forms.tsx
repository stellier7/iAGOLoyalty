"use client";

import { useActionState } from "react";
import { CURRENCIES } from "@/domain/markets";
import { REWARD_TYPES, rewardTypeLabel } from "@/domain/loyalty-labels";
import {
  createProgramAction,
  createRewardAction,
  createStampCodeAction,
  setStampRewardAction,
  updateBrandingAction,
} from "@/server/loyalty-actions";
import type { LoyaltyProgram } from "@/server/loyalty-types";
import { FormError } from "@/components/credential-forms";
import { SelectField, TextField } from "@/components/fields";
import { SubmitButton } from "@/components/submit-button";

export function ProgramForm({ businessId, currency }: { businessId: string; currency: string }) {
  const [state, action] = useActionState(createProgramAction, {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="businessId" value={businessId} />
      <TextField label="Program name" name="name" required />
      <SelectField
        label="Program type"
        name="programType"
        defaultValue="stamps"
        options={[
          { value: "stamps", label: "Stamp card" },
          { value: "points", label: "Points" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Stamps to complete" name="stampsRequired" type="number" defaultValue="10" />
        <TextField label="Points per currency unit" name="pointsRate" type="number" step="0.0001" defaultValue="1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Minimum purchase" name="minPurchase" type="number" step="0.01" defaultValue="0" />
        <TextField label="Stamp cooldown seconds" name="cooldown" type="number" defaultValue="300" />
        <SelectField
          label="Currency"
          name="currency"
          defaultValue={currency}
          options={CURRENCIES.map((item) => ({ value: item, label: item }))}
        />
      </div>
      <TextField label="Terms shown at enrollment" name="terms" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPrimary" defaultChecked />
        Primary program for new cards
      </label>
      <p className="text-sm text-muted-foreground">
        Stamp cards use the stamp count. Points programs use the rate and ignore the stamp count. The database calculates points from the purchase amount.
      </p>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Saving…">Create program</SubmitButton>
    </form>
  );
}

export function RewardForm({ programs }: { programs: LoyaltyProgram[] }) {
  const [state, action] = useActionState(createRewardAction, {});
  return (
    <form action={action} className="grid gap-4">
      <SelectField
        label="Program"
        name="programId"
        defaultValue={programs[0]?.id}
        options={programs.map((program) => ({ value: program.id, label: program.name }))}
      />
      <TextField label="Reward name" name="name" required />
      <TextField label="Description" name="description" />
      <SelectField
        label="Type"
        name="rewardType"
        defaultValue="free_product"
        options={REWARD_TYPES.map((type) => ({ value: type, label: rewardTypeLabel(type) }))}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Points cost" name="pointsCost" type="number" />
        <TextField label="Inventory" name="inventory" type="number" />
        <TextField label="Limit per customer" name="perCustomer" type="number" />
      </div>
      <p className="text-sm text-muted-foreground">
        Leave the points cost empty when this reward is granted by completing a stamp card. A points cost makes it a catalog reward staff can redeem directly.
      </p>
      <FormError message={state.error} />
      <SubmitButton>Create reward</SubmitButton>
    </form>
  );
}

export function StampRewardButton({ programId, rewardId }: { programId: string; rewardId: string }) {
  return (
    <form action={setStampRewardAction}>
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="rewardId" value={rewardId} />
      <SubmitButton variant="outline">Use for completed stamp cards</SubmitButton>
    </form>
  );
}

export function StampCodeForm({ businessId, programs }: { businessId: string; programs: LoyaltyProgram[] }) {
  const [state, action] = useActionState(createStampCodeAction, {});
  const stampPrograms = programs.filter((program) => program.programType === "stamps");
  if (stampPrograms.length === 0) {
    return <p className="text-sm text-muted-foreground">Create a stamp program before printing a stamp code.</p>;
  }
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="businessId" value={businessId} />
      <SelectField
        label="Stamp program"
        name="programId"
        defaultValue={stampPrograms[0]?.id}
        options={stampPrograms.map((program) => ({ value: program.id, label: program.name }))}
      />
      <TextField label="Label" name="label" defaultValue="Counter" />
      <SelectField
        label="Code"
        name="kind"
        defaultValue="static"
        options={[
          { value: "static", label: "Static location code" },
          { value: "rotating", label: "Rotating code, 60 seconds" },
        ]}
      />
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Creating…">Create stamp code</SubmitButton>
    </form>
  );
}

export function BrandingForm({
  businessId,
  brandColor,
  brandColorSecondary,
  logoUrl,
}: {
  businessId: string;
  brandColor: string | null;
  brandColorSecondary: string | null;
  logoUrl: string | null;
}) {
  const [state, action] = useActionState(updateBrandingAction, {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="businessId" value={businessId} />
      <TextField label="Brand color" name="brandColor" defaultValue={brandColor ?? "#1F4D3A"} />
      <TextField label="Accent color" name="brandColorSecondary" defaultValue={brandColorSecondary ?? "#C4A574"} />
      <TextField label="Logo URL" name="logoUrl" type="url" defaultValue={logoUrl ?? ""} />
      <p className="text-sm text-muted-foreground">
        Colors use a hex value such as #1F4D3A. The logo is an https address. File upload waits until Supabase Storage is connected.
      </p>
      <FormError message={state.error} />
      <SubmitButton>Save branding</SubmitButton>
    </form>
  );
}
