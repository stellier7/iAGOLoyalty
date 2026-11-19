"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isDestinationStatus,
  isDestinationType,
  isQrRedirectCode,
  parseDestinationUrl,
} from "@/domain/qr-redirect";
import { isNextRedirect, toActionError } from "@/lib/errors";
import { currentUserId } from "@/server/current-user";
import {
  createQrRedirect,
  createQrRedirectBatch,
  updateQrRedirect,
} from "@/server/qr-redirects";
import { getProfile } from "@/server/queries";
import type { ActionState } from "@/server/types";

async function requireAdminUserId(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) {
    return null;
  }
  const profile = await getProfile(userId);
  if (!profile || profile.platformRole !== "super_admin") {
    return null;
  }
  return userId;
}

function readDestinationFields(formData: FormData) {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const destinationTypeRaw = String(formData.get("destinationType") ?? "").trim();
  const destinationUrlRaw = String(formData.get("destinationUrl") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "active").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const businessIdRaw = String(formData.get("businessId") ?? "").trim();

  if (!isDestinationType(destinationTypeRaw)) {
    throw new Error("iago:invalid_destination_type");
  }
  if (!isDestinationStatus(statusRaw)) {
    throw new Error("iago:invalid_status");
  }
  if (codeRaw && !isQrRedirectCode(codeRaw)) {
    throw new Error("iago:invalid_qr_code");
  }

  const destinationUrl = parseDestinationUrl(destinationUrlRaw, destinationTypeRaw);

  return {
    businessName,
    destinationType: destinationTypeRaw,
    destinationUrl,
    status: statusRaw,
    code: codeRaw || null,
    businessId: businessIdRaw || null,
  };
}

export async function createDestinationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireAdminUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }

  try {
    const fields = readDestinationFields(formData);
    const countRaw = String(formData.get("count") ?? "1").trim();
    const count = Number.parseInt(countRaw, 10);
    if (!Number.isFinite(count) || count < 1 || count > 50) {
      return { error: "Create between 1 and 50 QR codes at a time." };
    }

    if (count > 1) {
      if (fields.code) {
        return { error: "Leave the permanent QR code blank when creating more than one." };
      }
      if (fields.destinationUrl) {
        return { error: "Batch QR codes start empty. Set each Google link after they are created." };
      }
      await createQrRedirectBatch(userId, {
        count,
        businessName: fields.businessName,
        destinationType: fields.destinationType,
        status: fields.status,
        businessId: fields.businessId,
      });
      revalidatePath("/admin/destinations");
      redirect("/admin/destinations");
    }

    const created = await createQrRedirect(userId, fields);
    revalidatePath("/admin/destinations");
    redirect(`/admin/destinations/${created.id}`);
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    return { error: toActionError(error) };
  }
}

export async function updateDestinationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireAdminUserId();
  if (!userId) {
    return { error: "Sign in again to continue." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "That destination is no longer available." };
  }

  try {
    const fields = readDestinationFields(formData);
    await updateQrRedirect(userId, id, {
      businessName: fields.businessName,
      destinationType: fields.destinationType,
      destinationUrl: fields.destinationUrl,
      status: fields.status,
      businessId: fields.businessId,
    });
    revalidatePath("/admin/destinations");
    revalidatePath(`/admin/destinations/${id}`);
    redirect(`/admin/destinations/${id}`);
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    return { error: toActionError(error) };
  }
}
