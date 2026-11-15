import { z } from "zod";
import { CURRENCIES, LOCALES, TIMEZONES } from "@/domain/markets";

const localeValues = LOCALES.map((locale) => locale.value) as [string, ...string[]];

export const businessDraftSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timezone: z.enum(TIMEZONES),
  currency: z.enum(CURRENCIES),
  locale: z.enum(localeValues),
  contactEmail: z.union([z.email(), z.literal("")]),
  ownerEmail: z.email(),
});

export type BusinessDraft = z.infer<typeof businessDraftSchema>;
