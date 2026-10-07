import { AccessFlow, ArchitectureDiagram } from "@/components/docs/diagrams";
import { Code } from "@/components/docs/code";

// Technical documentation for the dev team. Plain JSX on purpose: edit the
// text here and it ships with the next deploy. Code samples use String.raw so
// they are written exactly as shown. Never put a secret, token or webhook URL
// in this file — it is committed to Git.
export function DocsContent() {
  return (
    <main>
    <header className="top">
      <p className="eyebrow">Nexus · uso interno</p>
      <h1>Painel Relacional</h1>
      <p>Sistema multi-tenant de gestão de chamados com Quadro kanban, sprints, agenda, dashboards e integração somente leitura com o Azure DevOps. Esta página reúne o que o time de desenvolvimento precisa para entender, rodar e evoluir o projeto.</p>
      <div className="meta">
        <span><b>Produção</b> painel-relacional.vercel.app</span>
        <span><b>Branch</b> master (deploy automático)</span>
        <span><b>Atualizado</b> 07/10/2026</span>
      </div>
    </header>

    <section id="visao">
      <h2>Visão geral</h2>
      <p>Cada organização tem seu próprio Quadro, clientes, desenvolvedores, sprints e tipos de chamado. O isolamento entre organizações é feito no banco, por Row Level Security, e não apenas na aplicação.</p>
      <div className="grid">
        <div><h4>Quadro</h4><p>Chamados em colunas (status), arraste para mudar de coluna, filtros salvos por usuário, exportação em CSV.</p></div>
        <div><h4>Dashboard</h4><p><code>/dashboard</code> mostra os dados do Quadro. <code>/dashboard/pdvnet</code> e <code>/dashboard/pdvnet/status</code> mostram o espelho do Azure DevOps.</p></div>
        <div><h4>Agenda</h4><p>Reuniões com participantes, ligadas ao fluxo de aprovação dos chamados.</p></div>
        <div><h4>Cobrança</h4><p>Lembrete recorrente por urgência e o botão &quot;Gerar cobrança&quot;, que envia o chamado ao Discord.</p></div>
        <div><h4>Plataforma</h4><p><code>/plataforma</code> é a tela do administrador da plataforma, fora da interface Nexus, que aprova novos acessos.</p></div>
      </div>
      <div className="note warn">
        <p><strong>Não existe API pública para sistemas externos.</strong> Os dados são lidos pelo navegador com <code>supabase-js</code> (protegidos por RLS) ou pelo servidor por Server Actions. As rotas HTTP da seção abaixo são chamadas só por outros sistemas nossos (banco, cron) e exigem segredo.</p>
      </div>
    </section>

    <section id="stack">
      <h2>Tecnologias</h2>
      <div className="tbl"><table>
        <thead><tr><th>Camada</th><th>Tecnologia</th><th>Para quê</th></tr></thead>
        <tbody>
          <tr><td>Framework</td><td className="nw">Next.js 14.2 (App Router)</td><td>Páginas, rotas de API, Server Actions e middleware. Páginas com dados por usuário usam <code>force-dynamic</code>.</td></tr>
          <tr><td>Linguagem</td><td className="nw">TypeScript 5, React 18</td><td>Código tipado; tipos do banco em <code>src/types/database.types.ts</code>.</td></tr>
          <tr><td>Estilo</td><td className="nw">Tailwind CSS 3.4</td><td>Tema claro e escuro; o tema fica num cookie (<code>pr-theme</code>) lido no servidor.</td></tr>
          <tr><td>Interface</td><td className="nw">dnd-kit, recharts, lucide-react, date-fns, clsx</td><td>Arrastar cards, gráficos, ícones, datas.</td></tr>
          <tr><td>Validação</td><td className="nw">zod 4</td><td>Valida o que chega às Server Actions.</td></tr>
          <tr><td>Banco e login</td><td className="nw">Supabase (Postgres, Auth, Storage)</td><td>Dados, RLS, triggers, login, anexos e logos. Clientes: <code>@supabase/ssr</code> e <code>supabase-js</code>.</td></tr>
          <tr><td>Hospedagem</td><td className="nw">Vercel</td><td>Deploy a cada push, variáveis de ambiente e Cron.</td></tr>
          <tr><td>E-mail</td><td className="nw">Resend</td><td>Notificações de chamado.</td></tr>
          <tr><td>Monitoramento</td><td className="nw">Sentry (<code>@sentry/nextjs</code>)</td><td>Erros no navegador, servidor e edge.</td></tr>
          <tr><td>Integrações</td><td className="nw">Azure DevOps REST, Discord webhooks</td><td>Espelho dos work items (leitura) e cobrança no Discord.</td></tr>
        </tbody>
      </table></div>
    </section>

    <section id="arquitetura">
      <h2>Arquitetura</h2>
      <ArchitectureDiagram />
      <h3>Dois tipos de acesso ao banco</h3>
      <ul>
        <li><strong>Com a sessão do usuário</strong> (<code>src/lib/supabase/client.ts</code> e <code>server.ts</code>): tudo passa por RLS. É o caminho normal.</li>
        <li><strong>Com a chave de serviço</strong> (<code>src/lib/supabase/admin.ts</code>, só no servidor): ignora RLS. Usada em webhooks, cron, convites e na tela <code>/plataforma</code>. Nunca vai ao navegador.</li>
      </ul>
      <h3>Estrutura de pastas</h3>
      <Code>{String.raw`src/app/            páginas, rotas (api/, auth/, acesso/) e layouts
src/components/     board, dashboard, settings, agenda, platform, ui
src/lib/            regras por assunto: discord, pdvnet, followup, tickets,
                    members, notifications, supabase, auth, platform...
src/types/          database.types.ts (gerado a partir do banco)
supabase/migrations numeradas 0001 a 0034, aplicadas em ordem
supabase/maintenance scripts pontuais (limpeza), rodados à mão`}</Code>
    </section>

    <section id="http">
      <h2>Endpoints HTTP</h2>
      <p>Rotas em <code>src/app/api</code> e rotas de redirecionamento de login. As rotas <code>/api/notifications</code> e <code>/api/cron</code> são públicas para o middleware de sessão, porque não são chamadas por navegador, e se protegem com segredo próprio.</p>
      <div className="tbl"><table>
        <thead><tr><th>Rota</th><th>Quem chama</th><th>Autenticação</th><th>O que faz</th></tr></thead>
        <tbody>
          <tr><td><span className="m post">POST</span><code>/api/notifications/ticket-history</code></td><td>Trigger do banco</td><td>Header <code>x-webhook-secret</code></td><td>Avisa quando um chamado muda de status (ignora mudanças só de sprint).</td></tr>
          <tr><td><span className="m post">POST</span><code>/api/notifications/ticket-comment</code></td><td>Trigger do banco</td><td>Header <code>x-webhook-secret</code></td><td>Envia por e-mail o aviso de novo comentário. As @menções viram notificações dentro do app (tabela <code>notifications</code>), gravadas pela interface.</td></tr>
          <tr><td><span className="m post">POST</span><code>/api/notifications/ticket-approved</code></td><td>Trigger do banco</td><td>Header <code>x-webhook-secret</code></td><td>Avisa quando <code>approved</code> passa de false para true.</td></tr>
          <tr><td><span className="m get">GET</span><code>/api/cron/pdvnet-sync</code></td><td>Vercel Cron</td><td>Header <code>Authorization: Bearer CRON_SECRET</code></td><td>Sincroniza o Azure DevOps (seção própria abaixo).</td></tr>
          <tr><td><span className="m get">GET</span><code>/auth/callback</code></td><td>Link de e-mail</td><td>Parâmetro <code>code</code></td><td>Troca o código por sessão e redireciona para <code>/acesso/continuar</code>.</td></tr>
          <tr><td><span className="m get">GET</span><code>/acesso/continuar</code></td><td>Navegador</td><td>Sessão</td><td>Decide para onde vai quem acabou de entrar: espera de aprovação ou Quadro. Cria a organização pedida, só depois da aprovação.</td></tr>
        </tbody>
      </table></div>
      <h3>Respostas</h3>
      <ul>
        <li><code>401 &#123;&quot;error&quot;:&quot;Unauthorized&quot;&#125;</code> quando o segredo não confere.</li>
        <li><code>200 &#123;&quot;ok&quot;:true&#125;</code> nos webhooks, inclusive quando não há nada a notificar.</li>
        <li><code>/api/cron/pdvnet-sync</code>: <code>401 Unauthorized</code> sem o Bearer correto; <code>500 &#123;&quot;ok&quot;:false,&quot;error&quot;:&quot;...&quot;&#125;</code> se a sincronização principal falhar.</li>
      </ul>
      <Code label="Resposta do cron em caso de sucesso">{String.raw`{
  "ok": true,
  "synced": 793,              // work items copiados para pdvnet_tickets
  "linkedTickets": 0,         // chamados que ganharam desenvolvedor/data
  "developersCreated": 0,
  "deadlinesChecked": 14,     // chamados abertos comparados com o DevOps
  "deadlinesMatched": 14,
  "deadlinesUpdated": 0,      // Execução prevista alterada a partir do TargetDate
  "concluded": [],            // números dos chamados concluídos por "Done"
  "completionError": "..."    // só aparece se esse último passo falhar
}`}</Code>
      <Code label="Testar o cron manualmente (o segredo vem do ambiente, não digite no histórico do terminal)">{String.raw`curl -H "Authorization: Bearer $CRON_SECRET" \
  https://painel-relacional.vercel.app/api/cron/pdvnet-sync`}</Code>
    </section>

    <section id="webhooks">
      <h2>Webhooks</h2>

      <h3>Entrada: banco para aplicação</h3>
      <p>Três triggers em <code>tickets</code>, <code>ticket_history</code> e <code>ticket_comments</code> chamam as rotas <code>/api/notifications/*</code> com <code>net.http_post</code> (extensão <code>pg_net</code>). Assim, qualquer caminho que mude o dado dispara o aviso, seja o RPC, um <code>update</code> direto ou o sync do DevOps.</p>
      <div className="tbl"><table>
        <thead><tr><th>Trigger</th><th>Tabela e evento</th><th>Corpo enviado</th></tr></thead>
        <tbody>
          <tr><td className="nw"><code>ticket_history_notify</code></td><td>após <code>insert</code> em <code>ticket_history</code></td><td><code>history_id, ticket_id, from_status_id, to_status_id, moved_by</code></td></tr>
          <tr><td className="nw"><code>ticket_comments_notify</code></td><td>após <code>insert</code> em <code>ticket_comments</code></td><td><code>ticket_id, comment_id, author_id</code></td></tr>
          <tr><td className="nw"><code>tickets_notify_approved</code></td><td>após <code>update</code> quando <code>approved</code> vira true</td><td><code>ticket_id, approved_by</code></td></tr>
        </tbody>
      </table></div>
      <p>O segredo fica no Supabase Vault (nome <code>ticket_webhook_secret</code>, nunca no repositório) e a rota o compara com a variável <code>SUPABASE_WEBHOOK_SECRET</code>. Os dois precisam ter o mesmo valor.</p>
      <p>Destinatários do e-mail: quem criou o chamado e os administradores da organização, menos quem fez a ação. O movimento feito pelo sync do DevOps tem <code>moved_by</code> nulo e notifica todos eles.</p>

      <h3>Saída: Discord, &quot;Gerar cobrança&quot;</h3>
      <p>A Server Action <code>sendCobrancaToDiscord</code> lê o chamado do banco pelo id (o navegador só envia o id e a mensagem digitada) e posta um embed. Só funciona para chamados da organização Nexus.</p>
      <div className="tbl"><table>
        <thead><tr><th>Variável</th><th>Destino</th><th>Formato do envio</th></tr></thead>
        <tbody>
          <tr><td className="nw"><code>DISCORD_COBRANCA_WEBHOOK_URL</code></td><td>Canal de texto</td><td><code>embeds</code> + <code>allowed_mentions</code></td></tr>
          <tr><td className="nw"><code>DISCORD_COBRANCA_FORUM_WEBHOOK_URL</code></td><td>Canal Fórum</td><td>o mesmo, mais <code>thread_name</code> (até 100 caracteres, com a data)</td></tr>
          <tr><td className="nw"><code>DISCORD_COBRANCA_SUPERVISOR_MENTION</code></td><td>Opcional</td><td>Menção real: <code>&lt;@ID&gt;</code> (pessoa) ou <code>&lt;@&amp;ID&gt;</code> (cargo)</td></tr>
        </tbody>
      </table></div>
      <div className="note warn"><p><strong>Texto e Fórum não são intercambiáveis.</strong> Canal de texto recusa <code>thread_name</code>, e Fórum exige. Configure a variável que corresponde ao tipo do canal do webhook. Enviar para o tipo errado dá &quot;O Discord recusou a mensagem de cobrança&quot; e nada é postado.</p></div>
      <Code label="Forma da mensagem">{String.raw`{
  "content": "<@ID>",                       // só se "marcar supervisor"
  "embeds": [{
    "title": "Sugestão - #1116414 Favoritos no Board",   // Tipo - #número título
    "url": "https://app.pdvnet.com.br/app/Chamado/1116414",
    "description": "Chamado #1116414 · Abrir no painel\n\n...",
    "color": 15158332,                          // pela urgência
    "fields": [ Cliente, Tipo, Urgência, Execução prevista,
                Prazo, Desenvolvedor, Mensagem ],
    "footer": { "text": "Gerada por Fulano" },
    "timestamp": "2026-10-07T12:00:00.000Z"
  }],
  "allowed_mentions": { "parse": [], "users": ["ID"] },
  "thread_name": "Sugestão - #1116414 ... (07/10)"      // só no Fórum
}`}</Code>
      <p><code>allowed_mentions.parse: []</code> impede que um <code>@everyone</code> ou <code>@here</code> escrito na descrição vire ping. O único ping possível é o do supervisor configurado.</p>
      <p>Se o Discord aceitar, a mesma ação grava <code>last_followup_at = agora</code> no chamado, o que marca a cobrança e recalcula a próxima.</p>

      <h3>Saída: pedidos de acesso</h3>
      <p>Com <code>DISCORD_ACCESS_REQUEST_WEBHOOK_URL</code> definida, cada novo cadastro avisa no Discord (nome, e-mail, organização e link para <code>/plataforma</code>). É opcional e nunca derruba o cadastro se falhar.</p>
    </section>

    <section id="actions">
      <h2>Server Actions</h2>
      <p>Mutações que precisam do servidor ficam em arquivos <code>&quot;use server&quot;</code> em <code>src/lib/*/actions.ts</code>. Elas rodam com a sessão do usuário, então o RLS continua valendo; as que mexem com acesso (plataforma, membros) conferem o papel no servidor, sem confiar no que o navegador diz.</p>
      <div className="tbl"><table>
        <thead><tr><th>Arquivo</th><th>Funções</th></tr></thead>
        <tbody>
          <tr><td className="nw"><code>auth/actions.ts</code></td><td><code>signup</code> (pede acesso, não cria organização), <code>login</code>, <code>logout</code></td></tr>
          <tr><td className="nw"><code>platform/actions.ts</code></td><td><code>approveAccess</code>, <code>rejectAccess</code>, <code>revokeAccess</code>: só administrador da plataforma</td></tr>
          <tr><td className="nw"><code>members/actions.ts</code></td><td><code>inviteMember</code> (aprova o convidado automaticamente), <code>removeMember</code>, <code>updateMemberRole</code></td></tr>
          <tr><td className="nw"><code>discord/actions.ts</code></td><td><code>getCobrancaOptions</code>, <code>sendCobrancaToDiscord</code></td></tr>
          <tr><td className="nw"><code>statuses/actions.ts</code></td><td><code>createStatus</code>, <code>renameStatus</code>, <code>deleteStatus</code>, <code>moveStatus</code>, <code>updateStatusTerminal</code>, <code>updateStatusDenied</code>, <code>updateStatusApproved</code>, <code>updateStatusAwaitingApproval</code></td></tr>
          <tr><td className="nw"><code>meetings/actions.ts</code></td><td><code>createMeeting</code>, <code>updateMeeting</code>, <code>deleteMeeting</code></td></tr>
          <tr><td className="nw"><code>followup/actions.ts</code></td><td><code>upsertFollowupPolicy</code> (intervalo de cobrança por urgência)</td></tr>
          <tr><td className="nw"><code>clients, developers, sprints, ticket-types</code></td><td><code>create…</code> e <code>delete…</code> de cada um; clientes também têm <code>bulkCreateClientRecords</code></td></tr>
          <tr><td className="nw"><code>organizations/actions.ts</code></td><td><code>setOrganizationLogoUrl</code></td></tr>
        </tbody>
      </table></div>
      <p>Criar e editar chamados, aprovar, comentar e mover cards acontece direto do navegador com <code>supabase-js</code>, e o RLS decide. Mover usa o RPC <code>move_ticket</code>, que também grava o histórico.</p>
    </section>

    <section id="banco">
      <h2>Banco de dados</h2>
      <h3>Tabelas</h3>
      <div className="tbl"><table>
        <thead><tr><th>Grupo</th><th>Tabelas</th></tr></thead>
        <tbody>
          <tr><td className="nw">Organização e pessoas</td><td><code>organizations</code>, <code>memberships</code> (papel por organização), <code>profiles</code>, <code>pending_invites</code></td></tr>
          <tr><td className="nw">Quadro</td><td><code>boards</code>, <code>statuses</code>, <code>ticket_types</code>, <code>sprints</code>, <code>clients</code>, <code>developers</code>, <code>layout_preferences</code> (filtros salvos por usuário)</td></tr>
          <tr><td className="nw">Chamados</td><td><code>tickets</code>, <code>ticket_history</code> (somente inserção), <code>ticket_comments</code>, <code>ticket_attachments</code>, <code>notifications</code></td></tr>
          <tr><td className="nw">Cobrança</td><td><code>followup_policies</code> (intervalo em horas por urgência)</td></tr>
          <tr><td className="nw">Agenda</td><td><code>meetings</code>, <code>meeting_participants</code></td></tr>
          <tr><td className="nw">DevOps</td><td><code>pdvnet_tickets</code> (espelho dos work items; escrita só pelo sync, com a chave de serviço)</td></tr>
        </tbody>
      </table></div>
      <p>Enums: <code>membership_role</code> = admin, approver, member. <code>ticket_urgency</code> = low, medium, high, critical. Buckets do Storage: <code>ticket-attachments</code> e <code>org-logos</code>.</p>

      <h3>Colunas de <code>tickets</code> que merecem atenção</h3>
      <div className="tbl"><table>
        <thead><tr><th>Coluna</th><th>Significado</th></tr></thead>
        <tbody>
          <tr><td className="nw"><code>ticket_number</code></td><td>Número do chamado (o mesmo do PDVNET). Único por organização, digitado à mão.</td></tr>
          <tr><td className="nw"><code>deadline</code></td><td>Prazo: previsão de aprovação. Vale enquanto o chamado aguarda aprovação.</td></tr>
          <tr><td className="nw"><code>execution_deadline</code></td><td>Execução prevista. Vem do <code>TargetDate</code> do DevOps quando existe.</td></tr>
          <tr><td className="nw"><code>approved</code></td><td>Marca do botão Aprovar. Só admin ou aprovador altera (trigger).</td></tr>
          <tr><td className="nw"><code>approved_at</code>, <code>approved_by</code></td><td>Gravados por trigger no clique. Não editáveis pelo app. <em>(migração 0033)</em></td></tr>
          <tr><td className="nw"><code>completed_at</code></td><td>Quando entrou numa coluna terminal. Gravado por trigger. <em>(migração 0034)</em></td></tr>
          <tr><td className="nw"><code>last_followup_at</code></td><td>Última cobrança feita.</td></tr>
          <tr><td className="nw"><code>next_followup_due</code></td><td>Calculado por trigger: última cobrança (ou criação) mais o intervalo da urgência.</td></tr>
        </tbody>
      </table></div>

      <h3>Funções e triggers</h3>
      <ul>
        <li><code>move_ticket(ticket, status, sprint)</code>: muda status e sprint e grava <code>ticket_history</code> numa transação. Roda com os privilégios de quem chamou.</li>
        <li><code>create_organization_with_admin(nome, slug)</code>: cria a organização, o administrador, o Quadro e as colunas padrão.</li>
        <li>Helpers de RLS: <code>is_org_member</code>, <code>is_org_admin</code>, <code>is_org_admin_or_approver</code>, <code>ticket_org_id</code>.</li>
        <li>Triggers: permissão para aprovar, <code>approved_at/by</code>, <code>completed_at</code>, <code>next_followup_due</code>, e os três webhooks de saída. Não deixa remover o último administrador de uma organização.</li>
      </ul>
      <div className="note"><p><strong>Alterações de estrutura.</strong> As migrações em <code>supabase/migrations</code> são aplicadas na ordem, pelo SQL Editor do Supabase. As funções de trigger têm <code>EXECUTE</code> revogado de <code>anon</code> e <code>authenticated</code>; confira <code>pg_proc.proacl</code> depois de criar uma nova (as migrações 0005/0006 e 0008/0009 corrigem exatamente isso).</p></div>
    </section>

    <section id="devops">
      <h2>Integração com o Azure DevOps</h2>
      <div className="note warn"><p><strong>Regra imutável: o acesso ao DevOps é somente leitura.</strong> O sistema só faz consultas (WIQL e <code>workitemsbatch</code>). Nenhum código pode criar, alterar ou apagar nada no DevOps.</p></div>
      <p>Organização <code>pdvnet</code>, projeto <code>PDVNET</code>, autenticação básica com PAT (<code>AZURE_DEVOPS_PAT</code>, só no servidor). O cron roda todo dia às 09:00 UTC (06:00 em Brasília) e executa quatro passos em sequência:</p>
      <div className="tbl"><table>
        <thead><tr><th>#</th><th>Função</th><th>O que faz</th></tr></thead>
        <tbody>
          <tr><td>1</td><td className="nw"><code>syncPdvnetTickets</code></td><td>Copia para <code>pdvnet_tickets</code> os work items marcados com as tags de cliente (Relacionamento, Suporte, Urgente, Diretoria, Chamado Antigo, Gestao) ou com <code>Custom.Chamado</code> preenchido.</td></tr>
          <tr><td>2</td><td className="nw"><code>linkAdoDataToTickets</code></td><td>Preenche desenvolvedor e Execução prevista vazios nos chamados do Quadro, a partir do DevOps.</td></tr>
          <tr><td>3</td><td className="nw"><code>syncExecutionDeadlinesFromAdo</code></td><td>Copia o <code>TargetDate</code> do DevOps para a Execução prevista dos chamados abertos. O DevOps é a fonte quando tem data.</td></tr>
          <tr><td>4</td><td className="nw"><code>syncCompletionFromAdo</code></td><td>Move para Concluído o chamado cujos work items estão <code>Done</code> e nenhum segue aberto. Grava a data de fechamento do DevOps. Falha aqui não derruba os passos anteriores.</td></tr>
        </tbody>
      </table></div>
      <h3>Como os dois lados se ligam</h3>
      <ul>
        <li><strong>Chamado do Quadro ↔ work item:</strong> <code>tickets.ticket_number</code> = <code>Custom.Chamado</code>. Um chamado pode ter vários work items (por exemplo, uma Feature e um Bug).</li>
        <li><strong>Estados fechados</strong> (<code>PDVNET_CLOSED_STATES</code>): Done, Removed, Closed, Not Approved. Só <code>Done</code> conta como concluído; Removed e Not Approved são ignorados.</li>
        <li><strong>Campos lidos:</strong> <code>System.Id, Title, WorkItemType, State, Tags, AssignedTo, CreatedDate, ChangedDate</code>; <code>Microsoft.VSTS.Common.ClosedDate, Priority</code>; <code>Microsoft.VSTS.Scheduling.TargetDate</code>; <code>Custom.Cliente, Chamado, Sistema, DevOwner, QAOwner, ApprovedDate, CommitedDate, QADate</code>.</li>
        <li><strong>Datas:</strong> o DevOps guarda como meia-noite local (<code>...T03:00:00Z</code>); usamos a parte da data do timestamp UTC.</li>
      </ul>
    </section>

    <section id="acesso">
      <h2>Acesso, aprovação e papéis</h2>
      <AccessFlow />
      <ul>
        <li>Qualquer pessoa pode pedir acesso, mas só entra quem tem <code>app_metadata.access_approved === true</code>. Esse campo só pode ser escrito com a chave de serviço, então o usuário não consegue se aprovar.</li>
        <li>O middleware (<code>src/lib/supabase/middleware.ts</code>) confere isso a cada requisição, com <code>auth.getUser()</code> (consulta ao Auth, não ao JWT em cache). Aprovar ou revogar vale na próxima requisição.</li>
        <li><code>/plataforma</code> responde 404 para quem não tem <code>app_metadata.platform_admin</code>. Revogar marca <code>access_approved = false</code> e bane a conta.</li>
        <li>Quem é convidado por um administrador da organização já nasce aprovado.</li>
      </ul>
      <div className="tbl"><table>
        <thead><tr><th>Papel</th><th>Pode</th></tr></thead>
        <tbody>
          <tr><td className="nw"><code>admin</code></td><td>Tudo na organização: membros, status, sprints, tipos, excluir chamados, aprovar.</td></tr>
          <tr><td className="nw"><code>approver</code></td><td>Aprovar chamados, além do que o membro faz.</td></tr>
          <tr><td className="nw"><code>member</code></td><td>Ver, criar e editar chamados, comentar, cadastrar clientes.</td></tr>
        </tbody>
      </table></div>
    </section>

    <section id="regras">
      <h2>Regras de negócio</h2>
      <h3>Colunas do Quadro têm significado</h3>
      <p>Cada status pode ter marcas, configuradas em <code>/settings/statuses</code>: <code>is_awaiting_approval</code> (mostra o Prazo no card), <code>is_approved</code> (o botão Aprovar move para lá), <code>is_denied</code> e <code>is_terminal</code> (Concluído). Chamado em coluna terminal ou negada sai do atraso, da cobrança e do sync de datas.</p>
      <h3>Aprovação</h3>
      <p>O botão Aprovar liga <code>approved</code> e, se existir coluna de aprovados, move o card. A data e o autor são gravados pelo banco. Só vale o botão; arrastar o card até &quot;Aprovado&quot; não grava data.</p>
      <h3>Cobrança</h3>
      <ul>
        <li>Intervalo por urgência em <code>followup_policies</code>, ajustável em <code>/settings/followup</code>. Padrões: crítica 72 h, alta 336 h, média 504 h, baixa 720 h.</li>
        <li>A cobrança só existe para chamado <strong>atrasado</strong>: Prazo vencido se aguarda aprovação, senão Execução prevista vencida. A data devida é a maior entre o dia em que atrasou e a última cobrança mais o intervalo (<code>src/lib/followup/due.ts</code>).</li>
        <li>&quot;Gerar cobrança&quot; envia ao Discord e registra a cobrança no chamado. O botão &quot;Marquei a cobrança&quot; só aparece em organizações sem Discord.</li>
      </ul>
      <h3>Conclusão</h3>
      <p>Chamado em coluna terminal para de contar data e mostra &quot;Concluído em&quot;. Pode ser concluído à mão ou pelo sync quando o DevOps marca <code>Done</code>.</p>
      <h3>Recursos só da Nexus</h3>
      <p>Painéis PDVNET, &quot;Gerar cobrança&quot; e o sync do DevOps usam o id fixo da organização Nexus (<code>NEXUS_ORG_ID</code> em <code>src/lib/pdvnet/constants.ts</code>). Outras organizações não os veem.</p>
      <h3>Datas</h3>
      <p>Campos <code>date</code> (Prazo, Execução prevista) são comparados como texto <code>AAAA-MM-DD</code>, sem fuso. Campos <code>timestamptz</code> (aprovação, conclusão) são exibidos e filtrados em horário de Brasília (<code>src/lib/tickets/approval-date.ts</code>).</p>
    </section>

    <section id="ambiente">
      <h2>Variáveis de ambiente</h2>
      <p>Nomes e função apenas. Os valores ficam na Vercel (Production, Preview, Development) e em <code>.env.local</code>, que não vai ao Git. O modelo é <code>.env.example</code>.</p>
      <div className="tbl"><table>
        <thead><tr><th>Variável</th><th>Obrigatória</th><th>Uso</th></tr></thead>
        <tbody>
          <tr><td className="nw"><code>NEXT_PUBLIC_SUPABASE_URL</code></td><td>Sim</td><td>URL do projeto Supabase.</td></tr>
          <tr><td className="nw"><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></td><td>Sim</td><td>Chave pública; o acesso é limitado por RLS.</td></tr>
          <tr><td className="nw"><code>SUPABASE_SERVICE_ROLE_KEY</code></td><td>Sim</td><td>Chave de serviço. Só servidor, ignora RLS.</td></tr>
          <tr><td className="nw"><code>NEXT_PUBLIC_SITE_URL</code></td><td>Sim</td><td>Base dos links de convite, confirmação e &quot;Abrir no painel&quot;.</td></tr>
          <tr><td className="nw"><code>SUPABASE_WEBHOOK_SECRET</code></td><td>Sim</td><td>Segredo dos webhooks do banco (igual ao do Vault).</td></tr>
          <tr><td className="nw"><code>CRON_SECRET</code></td><td>Sim</td><td>Autoriza a Vercel a chamar o cron.</td></tr>
          <tr><td className="nw"><code>AZURE_DEVOPS_ORG</code>, <code>_PROJECT</code>, <code>_PAT</code></td><td>Sim</td><td>Leitura do Azure DevOps. O PAT precisa ser somente leitura.</td></tr>
          <tr><td className="nw"><code>RESEND_API_KEY</code>, <code>RESEND_EMAIL_DOMAIN</code></td><td>Para e-mail</td><td>Envio de notificações.</td></tr>
          <tr><td className="nw"><code>DISCORD_COBRANCA_WEBHOOK_URL</code></td><td>Uma das duas</td><td>Canal de texto da cobrança.</td></tr>
          <tr><td className="nw"><code>DISCORD_COBRANCA_FORUM_WEBHOOK_URL</code></td><td>Uma das duas</td><td>Canal Fórum da cobrança.</td></tr>
          <tr><td className="nw"><code>DISCORD_COBRANCA_SUPERVISOR_MENTION</code></td><td>Não</td><td>Menção do supervisor.</td></tr>
          <tr><td className="nw"><code>DISCORD_ACCESS_REQUEST_WEBHOOK_URL</code></td><td>Não</td><td>Aviso de pedido de acesso.</td></tr>
          <tr><td className="nw"><code>NEXT_PUBLIC_SENTRY_DSN</code>, <code>SENTRY_*</code></td><td>Para Sentry</td><td>Monitoramento e envio de source maps.</td></tr>
        </tbody>
      </table></div>
      <div className="note"><p><strong>Em produção, o webhook de cobrança fica só no ambiente Production.</strong> Preview e desenvolvimento não têm webhook do Discord, para que testes não postem no canal real. Variáveis marcadas como sensíveis na Vercel não podem ser lidas de volta.</p></div>
    </section>

    <section id="deploy">
      <h2>Rodar e publicar</h2>
      <h3>Local</h3>
      <Code>{String.raw`npm install
cp .env.example .env.local     # preencha com os valores do Supabase
npm run dev                    # http://localhost:3000
npm run lint
npx tsc --noEmit               # checagem de tipos
npm run build`}</Code>
      <ol className="plain">
        <li>Crie um projeto no Supabase e aplique as migrações de <code>supabase/migrations</code> em ordem (0001 em diante).</li>
        <li>Para a notificação funcionar, guarde o segredo no Vault com o nome <code>ticket_webhook_secret</code> e use o mesmo valor em <code>SUPABASE_WEBHOOK_SECRET</code>.</li>
        <li>Crie o primeiro usuário e marque <code>app_metadata.platform_admin</code> e <code>access_approved</code> com a chave de serviço, porque o cadastro comum agora exige aprovação.</li>
      </ol>
      <h3>Publicar</h3>
      <ul>
        <li>Um <code>git push</code> na <code>master</code> gera o deploy de produção na Vercel (cerca de 2 minutos, às vezes mais).</li>
        <li>Mudou variável de ambiente? É preciso um novo deploy para valer: <code>vercel redeploy &lt;url&gt; --target production</code>.</li>
        <li>O cron está em <code>vercel.json</code> (<code>0 9 * * *</code>).</li>
      </ul>
      <div className="note warn"><p><strong>Alterar a estrutura do banco não faz parte do deploy.</strong> Migração nova precisa ser rodada à mão no Supabase, antes ou logo depois do código que depende dela. O código novo foi escrito para continuar funcionando enquanto a migração não foi aplicada (a funcionalidade nova fica vazia, nada quebra).</p></div>
    </section>

      <footer>Painel Relacional · documentação interna da Nexus. Esta página não contém senhas, tokens nem URLs de webhook; não os cole aqui.</footer>
    </main>
  );
}
