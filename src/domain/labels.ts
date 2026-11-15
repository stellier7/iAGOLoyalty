import type { BusinessStatus, MemberRole, MemberStatus } from "@/server/types";

export function roleLabel(role: MemberRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "employee":
      return "Employee";
    default: {
      const unknown: never = role;
      return unknown;
    }
  }
}

export function businessStatusLabel(status: BusinessStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "pending":
      return "Pending";
    default: {
      const unknown: never = status;
      return unknown;
    }
  }
}

export function memberStatusLabel(status: MemberStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "invited":
      return "Invited";
    case "revoked":
      return "Revoked";
    default: {
      const unknown: never = status;
      return unknown;
    }
  }
}
