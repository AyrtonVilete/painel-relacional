import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { NEXUS_ORG_ID } from "@/lib/pdvnet/constants";
import { getClientPanelData } from "@/lib/pdvnet/client-panel";
import { ClientPanel } from "@/components/dashboard/client-panel";

// Queries Azure DevOps live on every load (read-only) instead of the
// once-daily pdvnet_tickets sync — this panel is meant for "what's
// happening right now", so it can't be a day stale.
export const dynamic = "force-dynamic";

export default async function WqSurfPanelPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  // Same gate as /dashboard/pdvnet: this is Nexus's own Azure DevOps data.
  if (membership.organization_id !== NEXUS_ORG_ID) {
    redirect("/dashboard");
  }

  let data;
  let loadError: string | null = null;
  try {
    data = await getClientPanelData("WQ Surf");
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Erro desconhecido ao consultar o Azure DevOps";
  }

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
        membersById={new Map()}
      />

      <main className="mx-auto w-full max-w-[100rem] flex-1 px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              WQ Surf — Acompanhamento
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Chamados do Azure DevOps para o cliente WQ Surf, consultados ao vivo (somente
              leitura).
            </p>
          </div>
          <Link
            href="/dashboard/pdvnet"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Voltar ao PDVNET
          </Link>
        </div>

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            Não foi possível consultar o Azure DevOps agora: {loadError}
          </div>
        ) : (
          data && <ClientPanel data={data} />
        )}
      </main>
    </div>
  );
}
