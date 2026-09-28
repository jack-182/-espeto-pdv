import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

/**
 * RUNNER FORMAL DE MIGRATIONS VERSIONADAS (DRIZZLE / POSTGRESQL)
 * 
 * Executa as migrations versionadas presentes em ./drizzle de forma:
 * 1. Não destrutiva (preserva dados existentes)
 * 2. Idempotente (pode ser executado repetidas vezes com segurança)
 * 3. Compatível com ambientes limpos e bancos já provisionados
 * 4. Auditável (grava na tabela __drizzle_migrations)
 */
export async function runMigrations() {
  console.log('================================================================');
  console.log(' INICIANDO EXECUÇÃO DE MIGRATIONS NO POSTGRESQL (CLOUD SQL)');
  console.log('================================================================');

  const pool = new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_ADMIN_USER || process.env.SQL_USER,
    password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();

  try {
    // 1. Garante que a tabela de histórico de migrations existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // 2. Busca histórico das migrations já aplicadas
    const appliedResult = await client.query('SELECT name FROM "__drizzle_migrations"');
    const appliedSet = new Set(appliedResult.rows.map(r => r.name));

    // 3. Lê o diretório de migrations
    const drizzleDir = path.join(process.cwd(), 'drizzle');
    if (!fs.existsSync(drizzleDir)) {
      console.log('Nenhum diretório de migrations encontrado em:', drizzleDir);
      return;
    }

    const sqlFiles = fs.readdirSync(drizzleDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Encontrados ${sqlFiles.length} arquivos de migration.`);

    for (const file of sqlFiles) {
      if (appliedSet.has(file)) {
        console.log(`[PULADA] Migration já aplicada anteriormente: ${file}`);
        continue;
      }

      console.log(`[EXECUTANDO] Aplicando migration: ${file}...`);
      const filePath = path.join(drizzleDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      // Separa os comandos pelo delimitador oficial do drizzle-kit (--> statement-breakpoint)
      const statements = sqlContent
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await client.query('BEGIN');
      try {
        for (const statement of statements) {
          // Ajusta CREATE TABLE para CREATE TABLE IF NOT EXISTS para não falhar em tabelas já existentes
          let safeStatement = statement;
          safeStatement = safeStatement.replace(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i, 'CREATE TABLE IF NOT EXISTS ');
          safeStatement = safeStatement.replace(/^CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
          safeStatement = safeStatement.replace(/^CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/i, 'CREATE INDEX IF NOT EXISTS ');
          safeStatement = safeStatement.replace(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?/i, 'ADD COLUMN IF NOT EXISTS ');

          await client.query('SAVEPOINT stmt_savepoint');
          try {
            await client.query(safeStatement);
            await client.query('RELEASE SAVEPOINT stmt_savepoint');
          } catch (stmtError: any) {
            await client.query('ROLLBACK TO SAVEPOINT stmt_savepoint');
            const code = stmtError.code;
            // 42P07: relation already exists, 42701: duplicate_column, 42710: duplicate_object, 42P16: multiple primary keys
            if (code === '42P07' || code === '42701' || code === '42710' || code === '42P16') {
              console.log(`  (Aviso: Objeto já existente na base, preservando dados: ${stmtError.message})`);
            } else {
              throw stmtError;
            }
          }
        }

        await client.query(
          'INSERT INTO "__drizzle_migrations" (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[SUCESSO] Migration ${file} aplicada com sucesso.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[ERRO] Falha crítica ao aplicar migration ${file}:`, err);
        throw err;
      }
    }

    console.log('================================================================');
    console.log(' TODAS AS MIGRATIONS FORAM PROCESSADAS COM SUCESSO!');
    console.log('================================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

// Se executado diretamente via CLI (tsx src/db/migrate.ts)
if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Falha fatal na execução de migrations:', err);
      process.exit(1);
    });
}
