import type { SupabaseClient } from "@supabase/supabase-js";
import type postgres from "postgres";
import {
  isDestinationStatus,
  isDestinationType,
  type DestinationStatus,
  type DestinationType,
} from "@/domain/qr-redirect";
import { getDataMode } from "@/lib/config";
import { withAnon, withUser } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Sql = postgres.TransactionSql;

export type QrRedirectRecord = {
  id: string;
  code: string;
  businessName: string;
  businessId: string | null;
  destinationType: DestinationType;
  destinationUrl: string | null;
  status: DestinationStatus;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedQrRedirect = {
  code: string;
  destinationUrl: string | null;
  destinationType: DestinationType;
  placeholder: boolean;
};

type RedirectRow = {
  id: string;
  code: string;
  business_name: string;
  business_id: string | null;
  destination_type: string;
  destination_url: string | null;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function mapRow(row: RedirectRow): QrRedirectRecord {
  if (!isDestinationType(row.destination_type)) {
    throw new Error("iago:invalid_destination_type");
  }
  if (!isDestinationStatus(row.status)) {
    throw new Error("iago:invalid_status");
  }
  return {
    id: row.id,
    code: row.code,
    businessName: row.business_name,
    businessId: row.business_id,
    destinationType: row.destination_type,
    destinationUrl: row.destination_url,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function readAsUser<T>(userId: string, local: (tx: Sql) => Promise<T>, remote: (client: SupabaseClient) => Promise<T>) {
  if (getDataMode() === "supabase") {
    return remote(await createSupabaseServerClient());
  }
  return withUser(userId, local);
}

export async function listQrRedirects(userId: string): Promise<QrRedirectRecord[]> {
  const rows = await readAsUser<RedirectRow[]>(
    userId,
    async (tx) => {
      const result = await tx<RedirectRow[]>`
        select id, code, business_name, business_id, destination_type, destination_url, status, created_at, updated_at
        from public.qr_redirects
        order by code
      `;
      return [...result];
    },
    async (client) => {
      const { data, error } = await client
        .from("qr_redirects")
        .select("id, code, business_name, business_id, destination_type, destination_url, status, created_at, updated_at")
        .order("code");
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as RedirectRow[];
    },
  );
  return rows.map(mapRow);
}

export async function getQrRedirect(userId: string, id: string): Promise<QrRedirectRecord | null> {
  const rows = await listQrRedirects(userId);
  return rows.find((row) => row.id === id) ?? null;
}

export async function resolveQrRedirect(code: string): Promise<ResolvedQrRedirect | null> {
  if (getDataMode() === "supabase") {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("resolve_qr_redirect", { p_code: code });
    if (error) {
      throw new Error(error.message);
    }
    return mapResolved(data);
  }

  const rows = await withAnon(
    (tx) => tx<{ resolve_qr_redirect: unknown }[]>`
      select public.resolve_qr_redirect(${code}) as resolve_qr_redirect
    `,
  );
  return mapResolved(rows[0]?.resolve_qr_redirect ?? null);
}

function mapResolved(raw: unknown): ResolvedQrRedirect | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as {
    code?: string;
    destination_url?: string | null;
    destination_type?: string;
    placeholder?: boolean;
  };
  if (!row.code || !row.destination_type || !isDestinationType(row.destination_type)) {
    return null;
  }
  const destinationUrl =
    typeof row.destination_url === "string" && row.destination_url.trim()
      ? row.destination_url
      : null;
  return {
    code: row.code,
    destinationUrl,
    destinationType: row.destination_type,
    placeholder: destinationUrl === null || row.placeholder === true,
  };
}

export async function createQrRedirect(
  userId: string,
  input: {
    businessName: string;
    destinationType: DestinationType;
    destinationUrl: string | null;
    status: DestinationStatus;
    code?: string | null;
    businessId?: string | null;
  },
): Promise<QrRedirectRecord> {
  if (getDataMode() === "supabase") {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("create_qr_redirect", {
      p_business_name: input.businessName,
      p_destination_type: input.destinationType,
      p_destination_url: input.destinationUrl,
      p_status: input.status,
      p_code: input.code ?? null,
      p_business_id: input.businessId ?? null,
    });
    if (error) {
      throw new Error(error.message);
    }
    return mapRpcResult(data);
  }

  const rows = await withUser(userId, (tx) =>
    tx<{ create_qr_redirect: Record<string, unknown> }[]>`
      select public.create_qr_redirect(
        ${input.businessName},
        ${input.destinationType},
        ${input.destinationUrl},
        ${input.status},
        ${input.code ?? null},
        ${input.businessId ?? null}::uuid
      ) as create_qr_redirect
    `,
  );
  return mapRpcResult(rows[0]?.create_qr_redirect);
}

export async function createQrRedirectBatch(
  userId: string,
  input: {
    count: number;
    businessName: string;
    destinationType: DestinationType;
    status: DestinationStatus;
    businessId?: string | null;
  },
): Promise<string[]> {
  if (getDataMode() === "supabase") {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("create_qr_redirect_batch", {
      p_count: input.count,
      p_business_name: input.businessName,
      p_destination_type: input.destinationType,
      p_status: input.status,
      p_business_id: input.businessId ?? null,
    });
    if (error) {
      throw new Error(error.message);
    }
    return mapBatchResult(data);
  }

  const rows = await withUser(userId, (tx) =>
    tx<{ create_qr_redirect_batch: { codes?: string[] } }[]>`
      select public.create_qr_redirect_batch(
        ${input.count},
        ${input.businessName},
        ${input.destinationType},
        ${input.status},
        ${input.businessId ?? null}::uuid
      ) as create_qr_redirect_batch
    `,
  );
  return mapBatchResult(rows[0]?.create_qr_redirect_batch);
}

export async function updateQrRedirect(
  userId: string,
  id: string,
  input: {
    businessName: string;
    destinationType: DestinationType;
    destinationUrl: string | null;
    status: DestinationStatus;
    businessId?: string | null;
  },
): Promise<QrRedirectRecord> {
  if (getDataMode() === "supabase") {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("update_qr_redirect", {
      p_id: id,
      p_business_name: input.businessName,
      p_destination_type: input.destinationType,
      p_destination_url: input.destinationUrl,
      p_status: input.status,
      p_business_id: input.businessId ?? null,
    });
    if (error) {
      throw new Error(error.message);
    }
    return mapRpcResult(data);
  }

  const rows = await withUser(userId, (tx) =>
    tx<{ update_qr_redirect: Record<string, unknown> }[]>`
      select public.update_qr_redirect(
        ${id}::uuid,
        ${input.businessName},
        ${input.destinationType},
        ${input.destinationUrl},
        ${input.status},
        ${input.businessId ?? null}::uuid
      ) as update_qr_redirect
    `,
  );
  return mapRpcResult(rows[0]?.update_qr_redirect);
}

function mapBatchResult(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("iago:not_found");
  }
  const codes = (raw as { codes?: unknown }).codes;
  if (!Array.isArray(codes) || !codes.every((code) => typeof code === "string")) {
    throw new Error("iago:not_found");
  }
  return codes;
}

function mapRpcResult(raw: unknown): QrRedirectRecord {
  if (!raw || typeof raw !== "object") {
    throw new Error("iago:not_found");
  }
  const row = raw as {
    id: string;
    code: string;
    business_name: string;
    business_id: string | null;
    destination_type: string;
    destination_url: string | null;
    status: string;
  };
  return mapRow({
    id: row.id,
    code: row.code,
    business_name: row.business_name,
    business_id: row.business_id,
    destination_type: row.destination_type,
    destination_url: row.destination_url ?? null,
    status: row.status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
