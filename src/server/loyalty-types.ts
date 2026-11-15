import type { LedgerSource, LedgerType, ProgramType, RewardType } from "@/domain/loyalty-labels";

export type LoyaltyActionState = {
  error?: string;
  duplicate?: boolean;
};

export type EnrollmentProfile = {
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandColorSecondary: string | null;
  locale: string;
  currency: string;
  enrollmentOpen: boolean;
  program: {
    name: string;
    type: ProgramType;
    stampsRequired: number | null;
    pointsPerCurrencyUnit: number | null;
    minPurchaseAmount: number;
    terms: string | null;
    currency: string;
  } | null;
};

export type MembershipCard = {
  businessName: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandColorSecondary: string | null;
  locale: string;
  currency: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  programName: string;
  programType: ProgramType;
  stampsBalance: number;
  stampsRequired: number | null;
  pointsBalance: number;
  rewards: string[];
};

export type StampPreview = {
  businessName: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandColorSecondary: string | null;
  locale: string;
  label: string | null;
  kind: "static" | "rotating";
  usable: boolean;
};

export type LoyaltyProgram = {
  id: string;
  name: string;
  programType: ProgramType;
  isPrimary: boolean;
  stampsRequired: number | null;
  cooldownSeconds: number;
  pointsPerCurrencyUnit: number | null;
  minPurchaseAmount: number;
  currency: string;
  terms: string | null;
  stampRewardId: string | null;
};

export type LoyaltyReward = {
  id: string;
  programId: string;
  name: string;
  description: string | null;
  rewardType: RewardType;
  pointsCost: number | null;
  inventoryLimit: number | null;
  redeemedCount: number;
  perCustomerLimit: number | null;
  active: boolean;
};

export type LoyaltyCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  membershipNumber: string;
  pointsBalance: number;
  stampsBalance: number;
  publicToken: string;
};

export type LedgerEntry = {
  id: string;
  createdAt: string;
  type: LedgerType;
  pointsDelta: number;
  stampsDelta: number;
  amount: number | null;
  currency: string | null;
  source: LedgerSource;
  reason: string | null;
  externalReference: string | null;
  membershipNumber: string | null;
  customerName: string | null;
};

export type StampCodeRecord = {
  code: string;
  kind: "static" | "rotating";
  label: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  createdAt: string;
  programId: string;
};

export type LoyaltyCounts = {
  customers: number;
  stampsIssued: number;
  pointsIssued: number;
  redemptions: number;
};

export type BusinessBranding = {
  brandColor: string | null;
  brandColorSecondary: string | null;
  logoUrl: string | null;
};

export type StaffCustomer = {
  firstName: string;
  lastName: string;
  membershipNumber: string;
  stampsBalance: number;
  pointsBalance: number;
  stampsRequired: number | null;
  programType: ProgramType;
  programName: string;
  currency: string;
  entitlements: { id: string; name: string }[];
  rewards: { id: string; name: string; pointsCost: number }[];
};

export type EnrollmentResult = {
  publicToken: string;
  membershipNumber: string;
};

export type StampCodeResult = {
  code: string;
  kind: "static" | "rotating";
  expiresAt: string | null;
  label: string | null;
};
