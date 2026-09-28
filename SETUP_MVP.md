# Espeto MVP - Setup & Documentação

## 🚀 Quick Start

### Pré-requisitos
- Node.js 20+
- PostgreSQL 15+
- Docker (opcional, para compose)
- Firebase Admin SDK

### 1. Setup do Backend

```bash
cd sistema-pdv-&-gestão-comercial

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais Firebase e DB

# Rodar migrations do banco
npm run db:migrate

# Iniciar servidor
npm run dev
# Servidor escuta em http://localhost:3000
```

### 2. Setup do Frontend

Frontend já está integrado no mesmo monorepo. Acesse em:
- http://localhost:5173 (Vite dev server)

## 📊 Fluxo MVP: Abrir/Fechar Caixa com Alertas

### Cenário 1: Caixa Sem Desvios ✅

```
1. Garçom abre caixa com R$500 de fundo
   POST /api/v1/cash-sessions
   {
     "terminalId": "CAIXA-01",
     "initialFund": 500.00
   }
   → Response: { "sessionId": "session-123", "status": "ABERTO" }

2. Durante o turno: vendas são registradas (no sistema)
   Sistema contabiliza: R$1000 em dinheiro

3. Garçom fecha caixa (declara exatamente o que tem)
   POST /api/v1/cash-sessions/session-123/close
   {
     "declaredCash": 1000.00,
     "declaredPix": 500.00,
     "declaredCard": 300.00
   }
   
   → Sistema calcula:
     - Declared Cash: 1000
     - System Cash: 1000
     - Desvio: 0% ✅ OK
   
   → Response: { 
       "status": "FECHADO",
       "alertCreated": false,
       "desvio": { "total": 0, "percentual": 0 }
     }
```

### Cenário 2: Desvio Crítico (> 5%) 🚨

```
1. Sistema registrou: R$1000 em dinheiro (correto)

2. Garçom fecha caixa declarando MENOS:
   POST /api/v1/cash-sessions/session-123/close
   {
     "declaredCash": 900.00,  ← R$100 a menos!
     "declaredPix": 500.00,
     "declaredCard": 300.00
   }
   
   → Sistema calcula:
     - Declared Cash: 900
     - System Cash: 1000
     - Desvio: 100 / 1000 = 10% ⚠️ CRÍTICO!
   
   → AÇÕES AUTOMÁTICAS:
     1. Cria notificação no DB (notifications table)
     2. Envia via WebSocket ao dono em TEMPO REAL 🔴
     3. Envia email de alerta
     4. Toca som de alarme no dashboard
     5. Registra tudo em auditoria
   
   → Response: {
       "status": "FECHADO",
       "alertCreated": true,
       "desvio": {
         "total": 100.00,
         "percentual": 10.00
       }
     }
   
   → Dashboard do Dono recebe:
     {
       "type": "ALERTA_DESVIO",
       "level": "CRITICO",
       "title": "🚨 Desvio de Caixa Detectado",
       "message": "Loja: store-001 | Desvio: R$ 100.00 (10%)",
       "storeId": "store-001",
       "desvios": { ... }
     }
```

## 🔌 Integração Frontend

### CloseCashModal Component

Componente React para fechar caixa com validação de desvios.

**Uso:**

```tsx
import { CloseCashModal } from '@/components/modals/CloseCashModal';
import { useCashService } from '@/services/cash.service';

function MyPage() {
  const { closeCashSession } = useCashService();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        Fechar Caixa
      </button>

      <CloseCashModal
        sessionId="session-123"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCloseCashSession={closeCashSession}
      />
    </>
  );
}
```

### DashboardDono Component

Dashboard centralizado do dono com notificações em tempo real.

**Features:**
- 3 cards de KPI (Faturamento, Desvios, Alertas)
- Cards de cada loja (status, faturamento, desvios)
- Alertas críticos flutuantes (sticky)
- WebSocket para notificações em tempo real
- Som + notificação do navegador

**Uso:**

```tsx
import { DashboardDono } from '@/components/dashboard/DashboardDono';

function App() {
  return <DashboardDono />;
}
```

### useWebSocket Hook

Hook para conectar ao WebSocket e receber alertas em tempo real.

**Uso:**

```tsx
import { useWebSocket } from '@/hooks/useWebSocket';

function Component() {
  const { socket, data, isConnected } = useWebSocket('alerts');

  useEffect(() => {
    if (data?.type === 'ALERTA_DESVIO') {
      console.log('Desvio detectado:', data.desvios);
    }
  }, [data]);

  return <div>Status: {isConnected ? 'Conectado' : 'Desconectado'}</div>;
}
```

## 📡 APIs REST

### POST /api/v1/cash-sessions
**Abrir novo caixa**

Headers obrigatórios:
```
Authorization: Bearer {idToken}
X-Tenant-Id: tenant-123
X-Store-Id: store-001
```

Body:
```json
{
  "terminalId": "CAIXA-01",
  "initialFund": 500.00
}
```

Response:
```json
{
  "sessionId": "session-abc123",
  "status": "ABERTO",
  "initialFund": 500.00,
  "openedAt": "2026-09-27T10:00:00Z"
}
```

---

### POST /api/v1/cash-sessions/:sessionId/close
**Fechar caixa e validar desvios** ⚡ CRITICAL ENDPOINT

Headers:
```
Authorization: Bearer {idToken}
X-Tenant-Id: tenant-123
X-Store-Id: store-001
```

Body:
```json
{
  "declaredCash": 1000.00,
  "declaredPix": 500.00,
  "declaredCard": 300.00,
  "notes": "Tudo confere"
}
```

Response:
```json
{
  "sessionId": "session-abc123",
  "status": "FECHADO",
  "desvio": {
    "cash": 50.00,
    "pix": 0,
    "card": 0,
    "total": 50.00,
    "percentual": 5.00
  },
  "alertCreated": false,
  "closedAt": "2026-09-27T18:00:00Z"
}
```

---

### GET /api/v1/cash-sessions
**Listar sessões**

Query:
```
?status=ABERTO&limit=10&offset=0
```

Response:
```json
{
  "sessions": [
    {
      "sessionId": "session-123",
      "status": "ABERTO",
      "initialFund": 500.00,
      "openedAt": "2026-09-27T10:00:00Z"
    }
  ],
  "total": 1
}
```

## 🧪 Testes

### Rodar testes de unidade (Caixa + Alertas)

```bash
npm run test:cash
# Rodará: src/modules/cash/cash.service.spec.ts
```

Testes cobrem:
- ✅ Cálculo de desvios (0%, 2%, 5%, 50%)
- ✅ Detecção de roubo (desvio gigante)
- ✅ Isolamento multi-tenant
- ✅ Criação de alertas críticos
- ✅ Auditoria de todas ações
- ✅ Notificações em tempo real via WebSocket

### Rodar testes de segurança

```bash
npm run test:security
# Valida: multi-tenancy, RBAC, isolamento dados
```

## 📊 Monitoramento & Alertas

### Métricas para Acompanhar

1. **Taxa de Desvios**
   - Quantos caixas fecham com desvio > 5%?
   - Meta: < 2% do total

2. **Tempo de Resposta (API)**
   - POST /close: Target < 200ms
   - GET /owner/dashboard: Target < 500ms

3. **Conectividade WebSocket**
   - Clientes conectados
   - Latência de notificações
   - Taxa de reconexão

4. **Desvios Financeiros**
   - Total diário de desvios
   - Por loja
   - Por operador (futura investigação)

## 🔐 Segurança Implementada

### MVP (Semana 1-2)
- ✅ Multi-tenancy com isolamento rigoroso
- ✅ RBAC (Owner > Admin > Manager > Cashier)
- ✅ JWT + Firebase Auth
- ✅ Auditoria completa (audit_logs)
- ✅ Validação Zod em todos endpoints
- ✅ Rate limiting básico

### Phase 2+ (Roadmap)
- 🔄 Row-Level Security (RLS) no PostgreSQL
- 🔄 Criptografia de PII
- 🔄 Proteção contra SQL injection (Drizzle já protege)
- 🔄 DDoS protection (Cloudflare)

## 🚀 Deploy para Produção

### Docker

```bash
# Build image
docker build -t espeto:latest .

# Run com compose
docker-compose up -d

# Verificar
curl http://localhost:3000/health
```

### Coolify

```bash
# Via CLI
coolify deploy --service espeto --branch main

# Ou webhook automático (configurar no GitHub Actions)
```

## 📞 Troubleshooting

### "Token JWT inválido"
→ Verificar Firebase credentials no .env

### "Tenant não encontrado"
→ Enviar header `X-Tenant-Id` nas requisições

### "WebSocket desconectado"
→ Verificar conexão internet e CORS em production

### Desvio não cria alerta
→ Confirmar que desvio > 5% do total
→ Verificar se AlertService está injetado

## 📝 Próximos Passos (Fases 2-4)

- [ ] Sangria/Suprimento de caixa
- [ ] Gerentes por loja
- [ ] Produtos + cardápio
- [ ] Integração Stripe (PIX, Cartão)
- [ ] App mobile
- [ ] Analytics + IA insights
- [ ] Sistema de comissões

---

**Desenvolvido com ❤️ para eliminar vazamento de caixa**
