import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { removeMember } from "@/lib/members/actions";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { MemberRoleSelect } from "@/components/settings/member-role-select";
import { DeleteButton } from "@/components/settings/delete-button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentMembership = await getCurrentMembership();

  // RLS on `memberships` scopes rows to "any org I belong to", not just
  // my current one — an explicit organization_id filter keeps the query
  // correct even if multi-org membership is ever introduced, instead of
  // relying solely on RLS to happen to return the right rows.
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, user_id, role, created_at")
    .eq("organization_id", currentMembership?.organization_id ?? "")
    .order("created_at", { ascending: true });

  const memberUserIds = (memberships ?? []).map((m) => m.user_id);

  const { data: profiles } =
    memberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", memberUserIds)
      : { data: [] };

  const namesById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name])
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Membros
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Convide pessoas para sua organização e gerencie os papéis de
          acesso.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <InviteMemberForm />
      </div>

      {memberships && memberships.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {memberships.map((m) => {
                const isSelf = m.user_id === user?.id;
                return (
                  <tr key={m.id}>
                    <td className="px-5 py-3 text-slate-800 dark:text-slate-200">
                      {namesById.get(m.user_id) || "Convite pendente"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                          (você)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <MemberRoleSelect
                        membershipId={m.id}
                        currentRole={m.role}
                        disabled={isSelf}
                      />
                    </td>
                    <td className="w-12 px-3 py-3 text-right">
                      {!isSelf && (
                        <DeleteButton
                          action={removeMember.bind(null, m.id)}
                          confirmMessage={`Remover ${
                            namesById.get(m.user_id) || "este convite pendente"
                          } da organização?`}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Users} label="Nenhum membro ainda" />
      )}
    </div>
  );
}
