import Link from "next/link";
import { notFound } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/lib/auth/actions";
import { isAccessApproved, isPlatformAdmin } from "@/lib/auth/access";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AccessActions } from "@/components/platform/access-actions";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const APPROVAL_SOURCE: Record<string, string> = {
  platform: "Aprovado por você",
  invite: "Convidado por um administrador",
  grandfathered: "Já usava o sistema",
};

type Meta = { full_name?: string; org_name?: string; org_slug?: string };

function meta(user: User): Meta {
  return (user.user_metadata ?? {}) as Meta;
}

function isBlocked(user: User) {
  const bannedUntil = (user as User & { banned_until?: string | null }).banned_until;
  return Boolean(bannedUntil && new Date(bannedUntil) > new Date());
}

async function listAllUsers() {
  const admin = createAdminClient();
  const users: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Não foi possível listar as contas");
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users;
}

export default async function PlataformaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A 404, not a "forbidden": nobody else needs to learn this page exists.
  if (!user || !isPlatformAdmin(user)) notFound();

  const admin = createAdminClient();
  const [users, { data: memberships }] = await Promise.all([
    listAllUsers(),
    admin.from("memberships").select("user_id, role, organizations(name)"),
  ]);

  const membershipByUser = new Map(
    (memberships ?? []).map((m) => [m.user_id, `${m.organizations?.name ?? "—"} (${m.role})`])
  );

  const byNewest = (a: User, b: User) => b.created_at.localeCompare(a.created_at);
  const blocked = users.filter((u) => isBlocked(u) || u.app_metadata?.revoked_at).sort(byNewest);
  const blockedIds = new Set(blocked.map((u) => u.id));
  const approved = users.filter((u) => isAccessApproved(u) && !blockedIds.has(u.id)).sort(byNewest);
  const waiting = users.filter((u) => !isAccessApproved(u) && !blockedIds.has(u.id));
  // People who asked through the Painel signup form carry the organization
  // they typed; anything else with no access (e.g. accounts that belong to
  // another app sharing this auth project) is kept apart so it doesn't read
  // as a request.
  const requests = waiting.filter((u) => meta(u).org_slug).sort(byNewest);
  const others = waiting.filter((u) => !meta(u).org_slug).sort(byNewest);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">
                Painel Relacional · Plataforma
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Administração de acessos · {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/board">
              <Button type="button" variant="secondary">
                Ir para o painel
              </Button>
            </Link>
            <ThemeToggle />
            <form action={logout}>
              <Button type="submit" variant="secondary">
                <LogOut className="h-4 w-4" aria-hidden />
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        <section>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Pedidos de acesso ({requests.length})
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Quem se cadastrou e ainda não entra no sistema. Ao aprovar, a organização pedida é
            criada no primeiro acesso da pessoa.
          </p>

          <div className="mt-4 space-y-3">
            {requests.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                Nenhum pedido pendente.
              </p>
            )}
            {requests.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {meta(u).full_name || "Sem nome"}
                  </p>
                  <p className="break-all text-sm text-slate-600 dark:text-slate-300">{u.email}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Organização pedida: <span className="font-medium">{meta(u).org_name}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    Pedido em {dateTime.format(new Date(u.created_at))}
                    {u.email_confirmed_at ? " · e-mail confirmado" : " · e-mail não confirmado"}
                  </p>
                </div>
                <AccessActions userId={u.id} kind="pending" />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Com acesso ({approved.length})
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  {["Pessoa", "Organização", "Liberação", "Último acesso", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {approved.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {meta(u).full_name || "Sem nome"}
                        {isPlatformAdmin(u) && (
                          <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                            plataforma
                          </span>
                        )}
                      </p>
                      <p className="break-all text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {membershipByUser.get(u.id) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {APPROVAL_SOURCE[String(u.app_metadata?.approved_via)] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {u.last_sign_in_at ? dateTime.format(new Date(u.last_sign_in_at)) : "Nunca"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== user.id && !isPlatformAdmin(u) && (
                        <AccessActions userId={u.id} kind="approved" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {blocked.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Acesso revogado ({blocked.length})
            </h2>
            <div className="mt-4 space-y-3">
              {blocked.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {meta(u).full_name || "Sem nome"}
                    </p>
                    <p className="break-all text-sm text-slate-600 dark:text-slate-300">{u.email}</p>
                  </div>
                  <AccessActions userId={u.id} kind="blocked" />
                </div>
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              Outras contas sem acesso ({others.length})
            </summary>
            <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Contas que existem no mesmo login mas não vieram do cadastro do Painel (por
                exemplo, de outro aplicativo). Não têm acesso aqui.
              </p>
              {others.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="break-all text-sm text-slate-700 dark:text-slate-200">{u.email}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Criada em {dateTime.format(new Date(u.created_at))}
                    </p>
                  </div>
                  <AccessActions userId={u.id} kind="other" />
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
