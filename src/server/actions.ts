"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { businessDraftSchema } from "@/domain/business-draft";
import { isBusinessSlug, slugifyBusinessName } from "@/domain/slug";
import { EMPLOYEE_PERMISSIONS, isBusinessRole, type PermissionMap } from "@/domain/permissions";
import { accountMode, getDataMode } from "@/lib/config";
import { toActionError } from "@/lib/errors";
import { clearSession, safeNextPath, writeBusinessId, writeSession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createLocalUser,
  createSupabaseUser,
  promoteFirstLocalSuperAdmin,
  verifyLocalLogin,
} from "@/server/accounts";
import { currentUserId } from "@/server/current-user";
import {
  acceptInvitation,
  createBusiness,
  createInvitation,
  revokeMember,
  setBusinessStatus,
  setMemberPermissions,
  setPlatformSetting,
  updateBusinessProfile,
  updateOwnProfile,
} from "@/server/mutations";
import { getProfile, listMemberships, previewInvitation } from "@/server/queries";
import type { ActionState } from "@/server/types";

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@") || password.length < 10) {
    return { error: "Enter the email and password for your account." };
  }

  let signedInUserId: string | null = null;
  try {
    const mode = accountMode();
    switch (mode) {
      case "database": {
        const userId = await verifyLocalLogin(email, password);
        if (!userId) {
          return { error: "Those credentials do not match an account." };
        }
        await writeSession(userId);
        signedInUserId = userId;
        break;
      }
      case "supabase": {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          return { error: "Those credentials do not match an account." };
        }
        const { data } = await supabase.auth.getUser();
        signedInUserId = data.user?.id ?? null;
        break;
      }
      case "unconfigured":
        return { error: "Authentication is not configured yet." };
      default: {
        const unknown: never = mode;
        return { error: unknown };
      }
    }
  } catch (error) {
    return { error: toActionError(error) };
  }

  const nextPath = safeNextPath(formData.get("next"));
  if (nextPath) {
    redirect(nextPath);
  }

  if (signedInUserId) {
    try {
      const profile = await getProfile(signedInUserId);
      if (profile?.platformRole === "super_admin") {
        redirect("/admin");
      }
      const memberships = await listMemberships(signedInUserId);
      if (memberships[0]) {
        await writeBusinessId(memberships[0].businessId);
        redirect("/app");
      }
    } catch {
      // Fall through to /enter, which also resolves the destination.
    }
  }

  redirect("/enter");
}

export async function setupAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const expected = process.env.SETUP_TOKEN;
  const provided = String(formData.get("setupToken") ?? "");
  if (!expected || !setupTokensMatch(provided, expected)) {
    return { error: "The setup token does not match." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (fullName.length < 2 || !email.includes("@")) {
    return { error: "Enter your name and email." };
  }

  try {
    const mode = accountMode();
    switch (mode) {
      case "database": {
        const userId = await createLocalUser({ email, password, fullName });
        await promoteFirstLocalSuperAdmin(userId);
        await writeSession(userId);
        break;
      }
      case "supabase": {
        const userId = await createSupabaseUser({ email, password, fullName, superAdmin: true });
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { error: "The admin account was created. Sign in with that email." };
        }
        void userId;
        break;
      }
      case "unconfigured":
        return { error: "Add Supabase or local database settings before setup." };
      default: {
        const unknown: never = mode;
        return { error: unknown };
      }
    }
  } catch (error) {
    return { error: toActionError(error) };
  }

  redirect("/admin");
}

export async function acceptInvitationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    const preview = await previewInvitation(token);
    if (preview.state !== "pending") {
      return { error: "This invitation is no longer available." };
    }

    const mode = accountMode();
    let userId = await currentUserId();
    if (!userId) {
      if (fullName.length < 2) {
        return { error: "Enter your name to create the account." };
      }
      switch (mode) {
        case "database":
          userId = await createLocalUser({ email: preview.email, password, fullName });
          await writeSession(userId);
          break;
        case "supabase": {
          await createSupabaseUser({ email: preview.email, password, fullName });
          const supabase = await createSupabaseServerClient();
          const { error } = await supabase.auth.signInWithPassword({
            email: preview.email,
            password,
          });
          if (error) {
            return { error: "The account was created. Sign in and open the invitation again." };
          }
          const { data } = await supabase.auth.getUser();
          userId = data.user?.id ?? null;
          break;
        }
        case "unconfigured":
          return { error: "Authentication is not configured yet." };
        default: {
          const unknown: never = mode;
          return { error: unknown };
        }
      }
    }

    if (!userId) {
      return { error: "Sign in with the invited email address." };
    }

    const profile = await getProfile(userId);
    if (!profile?.email || profile.email.toLowerCase() !== preview.email.toLowerCase()) {
      return { error: "Sign in with the email address on this invitation." };
    }

    const businessId = await acceptInvitation(userId, token);
    await writeBusinessId(businessId);
  } catch (error) {
    return { error: toActionError(error) };
  }

  redirect("/app");
}

export async function signOutAction() {
  if (getDataMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  await clearSession();
  redirect("/login");
}

export async function switchBusinessAction(formData: FormData) {
  const businessId = String(formData.get("businessId") ?? "");
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }
  const memberships = await listMemberships(userId);
  if (!memberships.some((membership) => membership.businessId === businessId)) {
    redirect("/app");
  }
  await writeBusinessId(businessId);
  redirect("/app");
}

export async function createBusinessAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  let slug = slugInput;
  if (!slug) {
    try {
      slug = slugifyBusinessName(name);
    } catch {
      return { error: "Enter a name that can become a URL slug." };
    }
  }
  if (!isBusinessSlug(slug)) {
    return { error: "Use a lowercase slug with letters, numbers, and hyphens." };
  }

  const parsed = businessDraftSchema.safeParse({
    name,
    slug,
    timezone: String(formData.get("timezone") ?? ""),
    currency: String(formData.get("currency") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? "").trim(),
    ownerEmail: String(formData.get("ownerEmail") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: "Check the business name, slug, currency, and owner email." };
  }

  try {
    const created = await createBusiness(userId, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      locale: parsed.data.locale,
      contactEmail: parsed.data.contactEmail || null,
      ownerEmail: parsed.data.ownerEmail,
    });
    const inviteUrl = created.invitationToken
      ? `${await requestOrigin()}/invite/${created.invitationToken}`
      : undefined;
    return { inviteUrl };
  } catch (error) {
    return { error: toActionError(error) };
  }
}

export async function inviteMemberAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await currentUserId();
  const businessId = String(formData.get("businessId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !isBusinessRole(role)) {
    return { error: "Choose a valid role." };
  }

  try {
    const token = await createInvitation(
      userId,
      businessId,
      String(formData.get("email") ?? "").trim(),
      role,
      permissionsFromForm(formData),
    );
    return { inviteUrl: `${await requestOrigin()}/invite/${token}` };
  } catch (error) {
    return { error: toActionError(error) };
  }
}

export async function updateBusinessAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }
  try {
    await updateBusinessProfile(userId, String(formData.get("businessId") ?? ""), {
      name: String(formData.get("name") ?? "").trim(),
      timezone: String(formData.get("timezone") ?? ""),
      currency: String(formData.get("currency") ?? ""),
      locale: String(formData.get("locale") ?? ""),
      contactEmail: emptyToNull(formData.get("contactEmail")),
    });
  } catch (error) {
    return { error: toActionError(error) };
  }
  redirect("/app/settings");
}

export async function updateNameAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }
  try {
    await updateOwnProfile(userId, String(formData.get("fullName") ?? ""));
  } catch (error) {
    return { error: toActionError(error) };
  }
  redirect("/app/settings");
}

export async function revokeMemberAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }
  try {
    await revokeMember(
      userId,
      String(formData.get("businessId") ?? ""),
      String(formData.get("memberId") ?? ""),
    );
  } catch (error) {
    if (toActionError(error)) {
      redirect(`/app/team?error=${encodeURIComponent(toActionError(error))}`);
    }
  }
  redirect("/app/team");
}

export async function savePermissionsAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }
  try {
    await setMemberPermissions(
      userId,
      String(formData.get("businessId") ?? ""),
      String(formData.get("memberId") ?? ""),
      permissionsFromForm(formData),
    );
  } catch (error) {
    redirect(`/app/team?error=${encodeURIComponent(toActionError(error))}`);
  }
  redirect("/app/team");
}

export async function setBusinessStatusAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) {
    redirect("/login");
  }
  const businessId = String(formData.get("businessId") ?? "");
  try {
    await setBusinessStatus(userId, businessId, String(formData.get("status") ?? ""));
  } catch (error) {
    redirect(`/admin/businesses/${businessId}?error=${encodeURIComponent(toActionError(error))}`);
  }
  redirect(`/admin/businesses/${businessId}`);
}

export async function savePlatformSettingAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }
  try {
    await setPlatformSetting(
      userId,
      String(formData.get("key") ?? ""),
      String(formData.get("value") ?? ""),
    );
  } catch (error) {
    return { error: toActionError(error) };
  }
  redirect("/admin/settings");
}

function permissionsFromForm(formData: FormData): PermissionMap {
  const permissions: PermissionMap = {};
  for (const permission of EMPLOYEE_PERMISSIONS) {
    permissions[permission] = formData.get(`permission_${permission}`) === "on";
  }
  return permissions;
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function setupTokensMatch(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return timingSafeEqual(left, right);
}

async function requestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
