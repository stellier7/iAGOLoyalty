"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isStampCode, membershipTokenFromInput } from "@/domain/card-token";
import { customerLocale, customerMessage } from "@/domain/customer-copy";
import { isNextRedirect, toActionError } from "@/lib/errors";
import { readCardToken } from "@/lib/card-cookie";
import { rateBucket } from "@/lib/public-request";
import { currentUserId } from "@/server/current-user";
import {
  collectStamp,
  createProgram,
  createReward,
  createStampCode,
  enrollCustomer,
  setStampReward,
  staffAddStamp,
  staffRecordPurchase,
  staffRedeem,
  updateBranding,
} from "@/server/loyalty";
import type { LoyaltyActionState } from "@/server/loyalty-types";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,80}$/;

function readKey(formData: FormData) {
  const key = String(formData.get("idempotencyKey") ?? "");
  return IDEMPOTENCY_KEY.test(key) ? key : null;
}

function failure(error: unknown, noun: "stamp" | "purchase"): LoyaltyActionState {
  if (isNextRedirect(error)) {
    throw error;
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("iago:duplicate_scan")) {
    return {
      duplicate: true,
      error:
        noun === "stamp"
          ? "That looks like a second stamp a few seconds after the last one. Confirm it if this is another visit."
          : "That looks like a second purchase a few seconds after the last one. Confirm it if this is another purchase.",
    };
  }
  return { error: toActionError(error) };
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : Number.NaN;
}

export async function enrollAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const locale = customerLocale(String(formData.get("locale") ?? "en"));
  const birthday = String(formData.get("birthday") ?? "").trim();
  try {
    const result = await enrollCustomer({
      slug: String(formData.get("slug") ?? ""),
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? "").trim() || null,
      birthday: birthday || null,
      accept: formData.get("accept") === "on",
      emailConsent: formData.get("emailConsent") === "on",
      whatsappConsent: formData.get("whatsappConsent") === "on",
      smsConsent: formData.get("smsConsent") === "on",
      rateBucket: await rateBucket(`enroll:${String(formData.get("slug") ?? "")}`),
    });
    redirect(`/c/${result.publicToken}`);
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    return { error: customerMessage(locale, error) };
  }
}

export async function collectStampAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const locale = customerLocale(String(formData.get("locale") ?? "en"));
  const code = String(formData.get("code") ?? "");
  const cardToken = await readCardToken();
  const key = readKey(formData);
  if (!isStampCode(code) || !key) {
    return { error: customerMessage(locale, new Error("iago:stamp_code_invalid")) };
  }
  if (!cardToken) {
    return { error: customerMessage(locale, new Error("iago:not_found")) };
  }
  try {
    await collectStamp({
      cardToken,
      code,
      source: formData.get("via") === "nfc" ? "customer_nfc" : "customer_qr",
      idempotencyKey: key,
      rateBucket: await rateBucket(`stamp:${code}`),
    });
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    return { error: customerMessage(locale, error) };
  }
  redirect(`/c/${cardToken}`);
}

export async function createProgramAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const userId = await currentUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }
  const programType = String(formData.get("programType") ?? "");
  const stampsRequired = optionalNumber(formData.get("stampsRequired"));
  const pointsRate = optionalNumber(formData.get("pointsRate"));
  const minPurchase = optionalNumber(formData.get("minPurchase")) ?? 0;
  const cooldown = optionalNumber(formData.get("cooldown")) ?? 300;
  if (Number.isNaN(minPurchase) || Number.isNaN(cooldown) || (programType === "stamps" && (stampsRequired === null || Number.isNaN(stampsRequired)))) {
    return { error: "Check the program numbers and try again." };
  }
  if (programType === "points" && (pointsRate === null || Number.isNaN(pointsRate))) {
    return { error: "Enter how many points each currency unit earns." };
  }
  try {
    await createProgram(userId, {
      businessId: String(formData.get("businessId") ?? ""),
      name: String(formData.get("name") ?? ""),
      programType,
      stampsRequired: programType === "stamps" ? stampsRequired : null,
      pointsPerCurrencyUnit: programType === "points" ? pointsRate : null,
      minPurchase,
      currency: String(formData.get("currency") ?? ""),
      cooldown,
      isPrimary: formData.get("isPrimary") === "on",
      terms: String(formData.get("terms") ?? "").trim() || null,
    });
    revalidatePath("/app/programs");
    revalidatePath("/app");
  } catch (error) {
    return failure(error, "stamp");
  }
  return {};
}

export async function createRewardAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const userId = await currentUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }
  const pointsCost = optionalNumber(formData.get("pointsCost"));
  const inventory = optionalNumber(formData.get("inventory"));
  const perCustomer = optionalNumber(formData.get("perCustomer"));
  if ([pointsCost, inventory, perCustomer].some((value) => Number.isNaN(value))) {
    return { error: "Check the reward numbers and try again." };
  }
  try {
    await createReward(userId, {
      programId: String(formData.get("programId") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "").trim() || null,
      rewardType: String(formData.get("rewardType") ?? ""),
      pointsCost,
      discountPercent: null,
      discountAmount: null,
      inventory,
      perCustomer,
    });
    revalidatePath("/app/rewards");
  } catch (error) {
    return failure(error, "stamp");
  }
  return {};
}

export async function setStampRewardAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }
  try {
    await setStampReward(userId, String(formData.get("programId") ?? ""), String(formData.get("rewardId") ?? ""));
    revalidatePath("/app/rewards");
    revalidatePath("/app/programs");
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    redirect(`/app/rewards?error=${encodeURIComponent(toActionError(error))}`);
  }
}

export async function updateBrandingAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const userId = await currentUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }
  const color = String(formData.get("brandColor") ?? "").trim();
  const secondary = String(formData.get("brandColorSecondary") ?? "").trim();
  const logo = String(formData.get("logoUrl") ?? "").trim();
  try {
    await updateBranding(
      userId,
      String(formData.get("businessId") ?? ""),
      color || null,
      secondary || null,
      logo || null,
    );
    revalidatePath("/app/settings");
  } catch (error) {
    return failure(error, "stamp");
  }
  return {};
}

export async function createStampCodeAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const userId = await currentUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }
  try {
    const created = await createStampCode(
      userId,
      String(formData.get("businessId") ?? ""),
      String(formData.get("programId") ?? ""),
      String(formData.get("label") ?? ""),
      String(formData.get("kind") ?? ""),
    );
    redirect(`/app/codes/${created.code}`);
  } catch (error) {
    return failure(error, "stamp");
  }
}

export async function addStampAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const token = membershipTokenFromInput(String(formData.get("token") ?? ""));
  const key = readKey(formData);
  const userId = await currentUserId();
  if (!userId || !token || !key) {
    return { error: "Refresh the page and try that again." };
  }
  try {
    await staffAddStamp(userId, token, key, formData.get("confirm") === "yes");
  } catch (error) {
    return failure(error, "stamp");
  }
  revalidatePath("/app/scan");
  redirect(`/app/scan?token=${encodeURIComponent(token)}&done=stamp`);
}

export async function recordPurchaseAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const token = membershipTokenFromInput(String(formData.get("token") ?? ""));
  const key = readKey(formData);
  const userId = await currentUserId();
  const amount = Number(String(formData.get("amount") ?? ""));
  if (!userId || !token || !key || !Number.isFinite(amount)) {
    return { error: "Enter the purchase amount and try again." };
  }
  const reference = String(formData.get("externalReference") ?? "").trim();
  try {
    await staffRecordPurchase(userId, token, amount, key, reference || null, formData.get("confirm") === "yes");
  } catch (error) {
    return failure(error, "purchase");
  }
  revalidatePath("/app/scan");
  redirect(`/app/scan?token=${encodeURIComponent(token)}&done=purchase`);
}

export async function redeemAction(_state: LoyaltyActionState, formData: FormData): Promise<LoyaltyActionState> {
  const token = membershipTokenFromInput(String(formData.get("token") ?? ""));
  const key = readKey(formData);
  const userId = await currentUserId();
  const target = String(formData.get("target") ?? "");
  const [kind, id] = target.split(":");
  if (!userId || !token || !key || (kind !== "entitlement" && kind !== "reward") || !id) {
    return { error: "Choose a reward to redeem." };
  }
  try {
    await staffRedeem(
      userId,
      token,
      kind === "entitlement" ? id : null,
      kind === "reward" ? id : null,
      key,
    );
  } catch (error) {
    return failure(error, "stamp");
  }
  revalidatePath("/app/scan");
  redirect(`/app/scan?token=${encodeURIComponent(token)}&done=redeem`);
}
