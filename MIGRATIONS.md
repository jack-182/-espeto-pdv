# Guia de Migrations do PostgreSQL (Drizzle ORM) — PDV B2B

Este documento descreve a política e a operação formal de migrations do banco de dados relacional PostgreSQL (Cloud SQL).

---

## 1. Princípios de Banco de Dados de Produção
- **Zero Push Destrutivo**: `db push` ou re-criações destrutivas de schema são terminantemente proibidas em produção.
- **Versionamento Estrito**: Toda alteração no schema relacional deve possuir um arquivo SQL versionado e imutável no diretório `./drizzle/`.
- **Idempotência e Segurança**: O runner de migração (`npm run db:migrate`) registra as migrations aplicadas na tabela de controle `__drizzle_migrations`, prevenindo execuções duplicadas e garantindo compatibilidade com ambientes limpos e bases legadas.

---

## 2. Como Executar Migrations Existentes

Para aplicar as migrations pendentes no banco configurado via variáveis de ambiente (`SQL_HOST`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`):

```bash
npm run db:migrate
```

O comando:
1. Conecta ao Cloud SQL PostgreSQL com pool seguro;
2. Verifica e cria a tabela de auditoria `__drizzle_migrations`;
3. Executa apenas as migrations que ainda não foram aplicadas em ordem sequencial;
4. Realiza transações atômicas com `SAVEPOINT` e tratamento não-destrutivo.

---

## 3. Como Criar Novas Migrations

Sempre que o arquivo `src/db/schema.ts` for atualizado:

1. Gere os arquivos SQL incrementais:
   ```bash
   npm run db:generate
   ```
   Isso criará o novo arquivo versionado dentro de `./drizzle/` (ex: `0002_xxx.sql`).

2. Revise o SQL gerado para garantir compatibilidade e performance.

3. Aplique no banco de dados:
   ```bash
   npm run db:migrate
   ```

---

## 4. Histórico de Migrations Versionadas

| Arquivo | Descrição | Status |
|---|---|---|
| `0000_icy_switch.sql` | Schema inicial corporativo (Tenants, Lojas, Usuários, Produtos, Estoque, Pedidos, Auditoria, Sessões de Caixa) | Aplicado |
| `0001_pretty_zemo.sql` | Adiciona `store_id` e `fingerprint` (SHA-256) na tabela `idempotency_keys` | Aplicado |
| `0002_rate_limit_buckets.sql` | Cria tabela distribuída `rate_limit_buckets` com índice único `(key, scope)` para atomicidade e concorrência no PostgreSQL | Aplicado |
| `0003_saas_b2b_entities.sql` | Expansão SaaS B2B Multi-tenant: campos de razão/fantasia em tenants e stores, tabelas plans, subscriptions e user_invitations | Novo |

---

## 5. Variáveis de Ambiente Necessárias

| Variável | Descrição |
|---|---|
| `SQL_HOST` | Host do Cloud SQL PostgreSQL |
| `SQL_DB_NAME` | Nome do banco de dados relacional |
| `SQL_ADMIN_USER` | Usuário administrador com privilégios DDL |
| `SQL_ADMIN_PASSWORD` | Senha do usuário administrador |
