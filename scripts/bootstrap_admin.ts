import dotenv from 'dotenv';
dotenv.config({ override: true });

import { bootstrapInitialAdmin } from '../src/db/seed.ts';

/**
 * CLI EXPLÍCITO DE INICIALIZAÇÃO DO PRIMEIRO ADMINISTRADOR EM PRODUÇÃO
 * 
 * Regra: NUNCA executa automaticamente por seed ou inicialização de servidor.
 * Deve ser disparado manualmente e de forma explícita pelo operador de infraestrutura/devops.
 * 
 * Uso:
 *   npx tsx scripts/bootstrap_admin.ts --name="Nome Admin" --email="admin@empresa.com" --pin="123456" [--tenantId="tenant-corp"] [--tenantName="Empresa"]
 * Ou via variáveis de ambiente:
 *   ADMIN_INITIAL_NAME="Nome Admin" ADMIN_INITIAL_EMAIL="admin@empresa.com" ADMIN_INITIAL_PIN="123456" npx tsx scripts/bootstrap_admin.ts
 */
async function main() {
  const args = process.argv.slice(2);
  const parsedArgs: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...valParts] = arg.slice(2).split('=');
      parsedArgs[key] = valParts.join('=');
    }
  }

  const name = parsedArgs.name || process.env.ADMIN_INITIAL_NAME;
  const email = parsedArgs.email || process.env.ADMIN_INITIAL_EMAIL;
  const pin = parsedArgs.pin || process.env.ADMIN_INITIAL_PIN;
  const tenantId = parsedArgs.tenantId || process.env.ADMIN_INITIAL_TENANT_ID || 'tenant-corp';
  const tenantName = parsedArgs.tenantName || process.env.ADMIN_INITIAL_TENANT_NAME || 'Organização Corporativa';
  const tenantCnpj = parsedArgs.tenantCnpj || process.env.ADMIN_INITIAL_TENANT_CNPJ || '00.000.000/0001-00';
  const uid = parsedArgs.uid || process.env.ADMIN_INITIAL_UID;

  if (!name || !email || !pin) {
    console.error('================================================================');
    console.error(' ERRO: Parâmetros obrigatórios ausentes para o primeiro administrador.');
    console.error('================================================================');
    console.error('Uso:');
    console.error('  npx tsx scripts/bootstrap_admin.ts --name="Nome" --email="admin@corp.com" --pin="123456"');
    console.error('Ou via env:');
    console.error('  ADMIN_INITIAL_NAME="Nome" ADMIN_INITIAL_EMAIL="admin@corp.com" ADMIN_INITIAL_PIN="123456" npx tsx scripts/bootstrap_admin.ts');
    process.exit(1);
  }

  try {
    console.log('================================================================');
    console.log(' INICIALIZAÇÃO EXPLÍCITA DO PRIMEIRO ADMINISTRADOR EM PRODUÇÃO');
    console.log('================================================================');

    const result = await bootstrapInitialAdmin({
      name,
      email,
      pin,
      tenantId,
      tenantName,
      tenantCnpj,
      uid
    });

    console.log('================================================================');
    console.log(' SUCESSO: Administrador inicial configurado com êxito:');
    console.log(` Tenant: ${result.tenantId}`);
    console.log(` E-mail: ${result.email}`);
    console.log(` UID:    ${result.uid}`);
    console.log('================================================================');
    process.exit(0);
  } catch (error: any) {
    console.error('================================================================');
    console.error(' FALHA NO BOOTSTRAP DO PRIMEIRO ADMINISTRADOR:');
    console.error(` ${error.message}`);
    console.error('================================================================');
    process.exit(1);
  }
}

main();
