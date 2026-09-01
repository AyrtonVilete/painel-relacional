import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/get-current-membership";
import { OrgLogoForm } from "@/components/settings/org-logo-form";

export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage() {
  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, logo_url")
    .eq("id", membership.organization_id)
    .single();

  if (!organization) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Organização
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Personalize o logo exibido ao lado do nome da organização no topo do
          painel.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <OrgLogoForm
          organizationId={organization.id}
          currentLogoUrl={organization.logo_url}
        />
      </div>
    </div>
  );
}
