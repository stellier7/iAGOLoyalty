import { EMPLOYEE_PERMISSIONS } from "@/domain/permissions";
import { memberStatusLabel, roleLabel } from "@/domain/labels";
import { InviteMemberForm } from "@/components/business-forms";
import { SubmitButton } from "@/components/submit-button";
import { PERMISSION_LABELS } from "@/server/types";
import { listInvitations, listTeam } from "@/server/queries";
import { revokeMemberAction, savePermissionsAction } from "@/server/actions";
import { canManageTeam, requireWorkspace } from "@/server/workspace";

export const metadata = { title: "Team" };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  if (!workspace.business || !workspace.membership || !canManageTeam(workspace.membership)) {
    return <p className="text-sm">Team management is limited to owners, admins, and employees with team permission.</p>;
  }

  const team = await listTeam(workspace.userId, workspace.business.id);
  const invitations = await listInvitations(workspace.userId, workspace.business.id);
  const suspended = workspace.business.status !== "active";

  return (
    <div className="grid gap-10">
      {params.error ? <p className="text-sm text-destructive">{params.error}</p> : null}
      <section className="overflow-x-auto">
        <h2 className="font-heading text-3xl">Team</h2>
        <table className="mt-4 w-full min-w-[40rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Email</th>
              <th className="py-2 font-medium">Role</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Access</th>
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.userId} className="border-t align-top">
                <td className="py-3">{member.fullName ?? "Unnamed"}</td>
                <td className="py-3">{member.email}</td>
                <td className="py-3">{roleLabel(member.role)}</td>
                <td className="py-3">{memberStatusLabel(member.status)}</td>
                <td className="py-3">
                  {member.status === "active" && member.role === "employee" && !suspended ? (
                    <form action={savePermissionsAction} className="grid gap-2">
                      <input type="hidden" name="businessId" value={workspace.business?.id} />
                      <input type="hidden" name="memberId" value={member.userId} />
                      {EMPLOYEE_PERMISSIONS.map((permission) => (
                        <label key={permission} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name={`permission_${permission}`}
                            defaultChecked={member.permissions[permission] === true}
                          />
                          {PERMISSION_LABELS[permission]}
                        </label>
                      ))}
                      <SubmitButton variant="outline">Save permissions</SubmitButton>
                    </form>
                  ) : null}
                  {member.status === "active" && member.userId !== workspace.userId && !suspended ? (
                    <form action={revokeMemberAction} className="mt-2">
                      <input type="hidden" name="businessId" value={workspace.business?.id} />
                      <input type="hidden" name="memberId" value={member.userId} />
                      <SubmitButton variant="ghost" pendingLabel="Revoking…">
                        Revoke access
                      </SubmitButton>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="font-heading text-2xl">Pending invitations</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {invitations.filter((invitation) => !invitation.acceptedAt).length === 0 ? (
            <li className="text-muted-foreground">No pending invitations.</li>
          ) : (
            invitations
              .filter((invitation) => !invitation.acceptedAt)
              .map((invitation) => (
                <li key={invitation.id}>
                  {invitation.email} · {roleLabel(invitation.role)} · expires {formatWhen(invitation.expiresAt, workspace.business?.timezone ?? "UTC")}
                </li>
              ))
          )}
        </ul>
      </section>
      {suspended ? (
        <p className="text-sm text-muted-foreground">Invitations are paused while the business is suspended.</p>
      ) : (
        <section className="max-w-xl">
          <h2 className="font-heading text-2xl">Invite someone</h2>
          <div className="mt-4">
            <InviteMemberForm businessId={workspace.business.id} />
          </div>
        </section>
      )}
    </div>
  );
}

function formatWhen(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone }).format(new Date(value));
}
