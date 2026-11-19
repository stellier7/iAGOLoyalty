import type { EmployeePermission, PermissionMap } from "@/domain/permissions";

export type PlatformRole = "super_admin" | null;
export type BusinessStatus = "active" | "suspended" | "pending";
export type MemberRole = "owner" | "admin" | "employee";
export type MemberStatus = "active" | "invited" | "revoked";

export type Profile = {
  id: string;
  fullName: string | null;
  email: string | null;
  platformRole: PlatformRole;
};

export type BusinessRecord = {
  id: string;
  name: string;
  slug: string;
  status: BusinessStatus;
  timezone: string;
  currency: string;
  locale: string;
  contactEmail: string | null;
  createdAt: string;
};

export type MembershipRecord = {
  businessId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  permissions: PermissionMap;
  businessName: string;
  businessStatus: BusinessStatus;
};

export type TeamMember = {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: MemberRole;
  status: MemberStatus;
  permissions: PermissionMap;
};

export type InvitationRecord = {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  acceptedAt: string | null;
};

export type SubscriptionRecord = {
  planCode: string;
  status: string;
};

export type InvitationPreview =
  | {
      state: "pending";
      businessName: string;
      email: string;
      role: MemberRole;
      expiresAt: string;
    }
  | { state: "invalid" | "used" | "expired" };

export type PlatformCounts = {
  businesses: number;
  activeMembers: number;
  suspendedBusinesses: number;
};

export type ActionState = {
  error?: string;
  inviteUrl?: string;
  /** Hard navigation target — prefer over redirect() for Safari server-action flows. */
  redirectTo?: string;
};

export const PERMISSION_LABELS: Record<EmployeePermission, string> = {
  scan: "Scan customer QR codes",
  issue_stamps: "Add stamps",
  issue_points: "Add points",
  redeem: "Redeem rewards",
  view_customers: "View customers",
  manage_campaigns: "Manage campaigns",
  manage_settings: "Manage settings",
  manage_team: "Manage team",
};
