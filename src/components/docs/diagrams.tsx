// Hand-drawn SVG so the docs need no diagram library. Colors come from the
// docs theme variables (see docs.css), so both themes work.

function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
}) {
  const cx = x + w / 2;
  return (
    <g>
      <rect className="dg-node" x={x} y={y} width={w} height={h} rx={8} />
      <text className="dg-title" x={cx} y={sub ? y + h / 2 - 3 : y + h / 2 + 5} textAnchor="middle">
        {title}
      </text>
      {sub && (
        <text className="dg-sub" x={cx} y={y + h / 2 + 14} textAnchor="middle">
          {sub}
        </text>
      )}
    </g>
  );
}

function Edge({ d }: { d: string }) {
  return <path className="dg-edge" d={d} markerEnd="url(#dg-arrow)" />;
}

export function ArchitectureDiagram() {
  return (
    <div className="diagram">
      <svg
        viewBox="0 0 900 370"
        role="img"
        aria-label="Navegador chama o Next.js na Vercel, que lê e grava no Supabase. O Supabase chama o Next.js por webhook. O cron da Vercel dispara a sincronização, que lê o Azure DevOps. O Next.js envia e-mail pelo Resend e mensagens ao Discord."
      >
        <defs>
          <marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path className="dg-arrow" d="M0 0 L10 5 L0 10 z" />
          </marker>
        </defs>

        <Node x={20} y={150} w={140} h={56} title="Navegador" />
        <Node x={330} y={140} w={200} h={76} title="Next.js" sub="Vercel" />
        <Node x={720} y={140} w={160} h={76} title="Supabase" sub="Postgres · Auth · Storage" />
        <Node x={330} y={16} w={200} h={50} title="Vercel Cron" sub="09:00 UTC" />
        <Node x={60} y={300} w={190} h={50} title="Azure DevOps" />
        <Node x={355} y={300} w={150} h={50} title="Resend" />
        <Node x={620} y={300} w={150} h={50} title="Discord" />

        <Edge d="M160 178 L330 178" />
        <text className="dg-label" x={245} y={168} textAnchor="middle">páginas e Server Actions</text>

        <Edge d="M530 162 L720 162" />
        <text className="dg-label" x={625} y={152} textAnchor="middle">supabase-js com RLS</text>

        <Edge d="M720 196 L530 196" />
        <text className="dg-label" x={625} y={214} textAnchor="middle">trigger + pg_net</text>
        <text className="dg-label" x={625} y={227} textAnchor="middle">POST /api/notifications/*</text>

        <Edge d="M430 66 L430 140" />
        <text className="dg-label" x={442} y={108}>GET /api/cron/pdvnet-sync</text>

        <Edge d="M380 216 L190 300" />
        <text className="dg-label" x={262} y={262} textAnchor="end">somente leitura</text>

        <Edge d="M430 216 L430 300" />
        <text className="dg-label" x={442} y={262}>e-mail</text>

        <Edge d="M480 216 L660 300" />
        <text className="dg-label" x={600} y={262}>webhook de cobrança</text>
      </svg>
    </div>
  );
}

const ACCESS_STEPS = [
  { title: "/signup", sub: "pede acesso" },
  { title: "Conta criada", sub: "sem acesso" },
  { title: "/aguardando-aprovacao", sub: "tela de espera" },
  { title: "/plataforma", sub: "administrador aprova" },
  { title: "/acesso/continuar", sub: "cria a organização" },
  { title: "/board", sub: "acesso liberado" },
];

export function AccessFlow() {
  return (
    <ol className="flow" aria-label="Etapas do pedido de acesso">
      {ACCESS_STEPS.map((step) => (
        <li key={step.title}>
          <strong>{step.title}</strong>
          <span>{step.sub}</span>
        </li>
      ))}
    </ol>
  );
}
