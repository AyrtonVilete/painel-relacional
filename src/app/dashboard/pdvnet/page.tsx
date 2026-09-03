import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { NEXUS_ORG_ID } from "@/lib/pdvnet/constants";
import { computePdvnetStats } from "@/lib/pdvnet/compute-stats";
import { PdvnetCharts } from "@/components/dashboard/pdvnet-charts";

// Per-user data, same caching caveat as /board and /dashboard.
export const dynamic = "force-dynamic";

export default async function PdvnetDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  // This page mirrors Nexus's own Azure DevOps backlog — not relevant to
  // (and not something) other tenants should see, so it's gated at the
  // route level, not just hidden from the nav.
  if (membership.organization_id !== NEXUS_ORG_ID) {
    redirect("/dashboard");
  }

  const [{ data: tickets }, { data: orgMemberships }] = await Promise.all([
    supabase
      .from("pdvnet_tickets")
      .select("*")
      .eq("organization_id", membership.organization_id),
    supabase
      .from("memberships")
      .select("user_id")
      .eq("organization_id", membership.organization_id),
  ]);

  const orgMemberUserIds = (orgMemberships ?? []).map((m) => m.user_id);
  const { data: memberProfiles } =
    orgMemberUserIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", orgMemberUserIds)
      : { data: [] };

  const membersById = new Map(
    (memberProfiles ?? []).map((p) => [p.id, p.full_name ?? "Sem nome"])
  );

  const stats = computePdvnetStats(tickets ?? []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <AppHeader
        orgName={membership.organizations?.name ?? "Painel Relacional"}
        orgLogoUrl={membership.organizations?.logo_url}
        organizationId={membership.organization_id}
        userEmail={user?.email}
        role={membership.role}
        isAdmin={membership.role === "admin"}
        active="pdvnet"
        currentUserId={user?.id ?? ""}
        membersById={membersById}
      />

      <main className="mx-auto w-full max-w-[100rem] flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            PDVNET
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Chamados de cliente escalados pro time de desenvolvimento, sincronizados a
            partir do Azure DevOps.
          </p>
        </div>

        <PdvnetCharts stats={stats} />
      </main>
    </div>
  );
}
