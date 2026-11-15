export const BUSINESS_ROLES = ["owner", "admin", "employee"] as const;

export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const EMPLOYEE_PERMISSIONS = [
  "scan",
  "issue_stamps",
  "issue_points",
  "redeem",
  "view_customers",
  "manage_campaigns",
  "manage_settings",
  "manage_team",
] as const;

export type EmployeePermission = (typeof EMPLOYEE_PERMISSIONS)[number];

export type PermissionMap = Partial<Record<EmployeePermission, boolean>>;

const PRIVILEGED_ROLES = new Set<BusinessRole>(["owner", "admin"]);

export function isBusinessRole(value: string): value is BusinessRole {
  return BUSINESS_ROLES.some((role) => role === value);
}

export function hasPermission(
  role: string,
  stored: PermissionMap,
  permission: EmployeePermission,
): boolean {
  if (!isBusinessRole(role)) {
    return false;
  }
  if (PRIVILEGED_ROLES.has(role)) {
    return true;
  }
  return stored[permission] === true;
}

export function emptyEmployeePermissions(): Record<EmployeePermission, boolean> {
  return {
    scan: false,
    issue_stamps: false,
    issue_points: false,
    redeem: false,
    view_customers: false,
    manage_campaigns: false,
    manage_settings: false,
    manage_team: false,
  };
}

export function defaultEmployeePermissions(): Record<EmployeePermission, boolean> {
  return {
    ...emptyEmployeePermissions(),
    scan: true,
    issue_stamps: true,
    issue_points: true,
    redeem: true,
    view_customers: true,
  };
}
