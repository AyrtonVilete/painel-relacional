# Painel Relacional

SaaS multi-tenant de gestão de chamados (suporte, problemas e sugestões) com
board estilo kanban, sprints e dashboard de relatórios.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Auth), isolamento multi-tenant via Row Level Security
- `dnd-kit` para drag and drop
- Tailwind CSS

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar um projeto no Supabase

1. Crie um projeto em https://supabase.com/dashboard
2. Em **Project Settings → API**, copie:
   - `Project URL`
   - `anon public` key
   - `service_role` key (mantenha em segredo, nunca exponha no client)

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `.env.local` com os valores do passo anterior.

### 4. Rodar as migrations

As migrations estão em `supabase/migrations/`, na ordem em que devem ser
aplicadas:

- `0001_init_schema.sql` — tabelas e enums
- `0002_functions_triggers.sql` — bootstrap de organização/convites e a
  função `move_ticket` (que atualiza o chamado e grava o histórico em
  `ticket_history` atomicamente)
- `0003_rls_policies.sql` — políticas de RLS multi-tenant

Aplique via [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

Ou cole o conteúdo de cada arquivo, em ordem, no **SQL Editor** do painel do
Supabase.

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

## Estrutura

```
src/
  app/                     rotas (App Router)
  lib/supabase/
    client.ts              client Supabase para Client Components
    server.ts               client Supabase para Server Components/Actions
    admin.ts                client com service role (uso restrito ao servidor)
    middleware.ts           refresh de sessão + proteção de rotas
  types/database.types.ts   tipos TypeScript do schema
supabase/migrations/        migrations SQL (schema, funções, RLS)
```

## Notas de modelagem

- Toda tabela com dado de organização tem RLS habilitado; o isolamento entre
  organizações é garantido no banco, não apenas na aplicação.
- `ticket_history` é somente-inserção: nenhuma política de update/delete
  existe para essa tabela. Toda movimentação de card (troca de status e/ou
  sprint) deve passar pela função `move_ticket`, que atualiza o chamado e
  grava o histórico na mesma transação.
- Estendi `ticket_history` com `from_status_id`/`to_status_id` além de
  `from_sprint_id`/`to_sprint_id` do modelo original, já que o board também
  precisa logar movimentação entre colunas (status), não só entre sprints.
- `statuses` e `ticket_types` são configuráveis por organização/board — não
  há enum fixo no código.
