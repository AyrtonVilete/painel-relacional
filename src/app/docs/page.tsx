import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { NEXUS_ORG_ID } from "@/lib/pdvnet/constants";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsToc } from "@/components/docs/docs-toc";
import "@/components/docs/docs.css";

// Internal architecture notes: keep them out of search results.
export const metadata: Metadata = {
  title: "Documentação · Painel Relacional",
  robots: { index: false, follow: false },
};

// Per-user (membership/org) data, same caching caveat as /board and /dashboard.
export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  // Describes how Nexus's own system is built and wired (endpoints, webhooks,
  // integrations) — for Nexus's developers only, so it's gated at the route
  // level, not just hidden from the nav. Login and approval are already
  // enforced for every page by the middleware.
  if (membership.organization_id !== NEXUS_ORG_ID) {
    redirect("/dashboard");
  }

  const { data: orgMemberships } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", membership.organization_id);

  const orgMemberUserIds = (orgMemberships ?? []).map((m) => m.user_id);
  const { data: memberProfiles } =
    orgMemberUserIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", orgMemberUserIds)
      : { data: [] };

  const membersById = new Map(
    (memberProfiles ?? []).map((p) => [p.id, p.full_name ?? "Sem nome"])
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <AppHeader
        orgName={membership.organizations?.name ?? "Painel Relacional"}
        orgLogoUrl={membership.organizations?.logo_url}
        organizationId={membership.organization_id}
        userEmail={user?.email}
        role={membership.role}
        isAdmin={membership.role === "admin"}
        active="docs"
        currentUserId={user?.id ?? ""}
        membersById={membersById}
      />

      <div className="docs-root flex-1">
        <div className="shell">
          <DocsToc />
          <DocsContent />
        </div>
      </div>
    </div>
  );
}
