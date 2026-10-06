import "server-only";

// Optional heads-up in Discord when someone asks for access, so the person
// who approves doesn't have to remember to open /plataforma. Does nothing
// unless DISCORD_ACCESS_REQUEST_WEBHOOK_URL is set, and never throws: a
// Discord outage must not break signup.
export async function notifyAccessRequest(request: {
  fullName: string;
  orgName: string;
  email: string;
}) {
  const url = process.env.DISCORD_ACCESS_REQUEST_WEBHOOK_URL;
  if (!url || !/^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\//.test(url)) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const trim = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max - 1)}…` : value;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "Novo pedido de acesso ao Painel Relacional",
            color: 0xf59e0b,
            fields: [
              { name: "Nome", value: trim(request.fullName, 200) || "—", inline: true },
              { name: "E-mail", value: trim(request.email, 200), inline: true },
              { name: "Organização", value: trim(request.orgName, 200) || "—", inline: true },
              ...(siteUrl
                ? [{ name: "Aprovar ou recusar", value: `${siteUrl}/plataforma`, inline: false }]
                : []),
            ],
            timestamp: new Date().toISOString(),
          },
        ],
        // These are values typed by a stranger: never let them ping anyone.
        allowed_mentions: { parse: [] },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Intentionally ignored, see above.
  }
}
