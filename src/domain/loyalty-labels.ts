export const PROGRAM_TYPES = ["stamps", "points"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

export const REWARD_TYPES = [
  "free_product",
  "percentage_discount",
  "fixed_discount",
  "exclusive_offer",
  "promotion",
] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const LEDGER_TYPES = ["stamp_added", "points_earned", "reward_granted", "reward_redeemed"] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const LEDGER_SOURCES = ["scan", "manual", "customer_qr", "customer_nfc", "api", "webhook", "system"] as const;
export type LedgerSource = (typeof LEDGER_SOURCES)[number];

export function programTypeLabel(type: ProgramType): string {
  switch (type) {
    case "stamps":
      return "Stamp card";
    case "points":
      return "Points";
    default: {
      const unknown: never = type;
      return unknown;
    }
  }
}

export function rewardTypeLabel(type: RewardType): string {
  switch (type) {
    case "free_product":
      return "Free product";
    case "percentage_discount":
      return "Percentage discount";
    case "fixed_discount":
      return "Fixed discount";
    case "exclusive_offer":
      return "Exclusive offer";
    case "promotion":
      return "Promotion";
    default: {
      const unknown: never = type;
      return unknown;
    }
  }
}

export function ledgerTypeLabel(type: LedgerType): string {
  switch (type) {
    case "stamp_added":
      return "Stamp added";
    case "points_earned":
      return "Points earned";
    case "reward_granted":
      return "Reward granted";
    case "reward_redeemed":
      return "Reward redeemed";
    default: {
      const unknown: never = type;
      return unknown;
    }
  }
}

export function ledgerSourceLabel(source: LedgerSource): string {
  switch (source) {
    case "scan":
      return "Staff scan";
    case "manual":
      return "Staff entry";
    case "customer_qr":
      return "Stamp QR";
    case "customer_nfc":
      return "NFC tag";
    case "api":
      return "API";
    case "webhook":
      return "Webhook";
    case "system":
      return "System";
    default: {
      const unknown: never = source;
      return unknown;
    }
  }
}

function isListed<T extends string>(values: readonly T[], value: string): value is T {
  return values.some((item) => item === value);
}

export function asProgramType(value: string): ProgramType {
  if (!isListed(PROGRAM_TYPES, value)) {
    throw new Error("iago:invalid_program");
  }
  return value;
}

export function asRewardType(value: string): RewardType {
  if (!isListed(REWARD_TYPES, value)) {
    throw new Error("iago:invalid_reward");
  }
  return value;
}

export function asLedgerType(value: string): LedgerType {
  if (!isListed(LEDGER_TYPES, value)) {
    throw new Error("iago:invalid_transaction");
  }
  return value;
}

export function asLedgerSource(value: string): LedgerSource {
  if (!isListed(LEDGER_SOURCES, value)) {
    throw new Error("iago:invalid_source");
  }
  return value;
}
