# 📱 WhatsApp Alerts Setup & Guide

## O Sistema de Alertas WhatsApp do Espeto

Quando um **desvio de caixa > 5%** é detectado, o proprietário recebe uma **mensagem WhatsApp automática em tempo real**.

---

## 🚀 1. Setup do Twilio (WhatsApp)

### Passo 1: Criar Conta Twilio

1. Ir para https://www.twilio.com/try-twilio
2. Fazer signup (precisará de telefone)
3. Ir para Twilio Console: https://www.twilio.com/console

### Passo 2: Copiar Credenciais

Na console, você verá:
- **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Auth Token**: (não compartilhar!)
- Copiar ambos para variáveis de ambiente

### Passo 3: Ativar WhatsApp Sandbox

1. Ir para https://www.twilio.com/console/sms/whatsapp/learn
2. Clique em **Start with SMS Sandbox**
3. Você receberá um número de sandbox: `+1 415 523 8886`
4. Guardar este número

### Passo 4: Validar Seu Telefone (do Proprietário)

Para testar:
1. Enviar uma mensagem de teste no sandbox
2. Twilio enviará confirmação por WhatsApp
3. Responder com a palavra-chave
4. Seu número estará validado para 72 horas

---

## 🔐 2. Configurar Variáveis de Ambiente

### .env (desenvolvimento)

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=seu_auth_token_aqui
TWILIO_WHATSAPP_NUMBER=+15155255236  # Número sandbox ou seu número custom
```

### GitHub Secrets (produção)

```
TWILIO_ACCOUNT_SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN: seu_auth_token
TWILIO_WHATSAPP_NUMBER: +5585988888888  # Seu número Business (se tiver)
```

### Docker Compose

```yaml
environment:
  TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID}
  TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN}
  TWILIO_WHATSAPP_NUMBER: ${TWILIO_WHATSAPP_NUMBER}
```

---

## 🧪 3. Testar WhatsApp Localmente

### Opção 1: Via API

```bash
# Teste simples
curl -X POST http://localhost:3000/api/v1/alerts/test-whatsapp \
  -H "Authorization: Bearer {SEU_TOKEN_FIREBASE}" \
  -H "X-Tenant-Id: tenant-1" \
  -H "X-Store-Id: store-001" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+55 85 98888-8888"
  }'

# Response esperado:
# {
#   "success": true,
#   "message": "✅ WhatsApp funcionando! Mensagem de teste foi enviada.",
#   "isConfigured": true
# }
```

### Opção 2: Via Dashboard (criar manual)

1. Logar no http://localhost:5173
2. Ir para Configurações → Alertas
3. Clicar "Testar WhatsApp"
4. Inserir seu telefone
5. Aguardar mensagem WhatsApp

### Opção 3: Disparar Desvio Real

1. Abrir caixa com R$ 500
2. Sistema registra R$ 1000 em vendas
3. Fechar caixa declarando R$ 900 (desvio 10%)
4. ✅ Proprietário recebe WhatsApp automático!

---

## 📝 4. Formato das Mensagens WhatsApp

### Alerta de Desvio (CRÍTICO)

```
🚨 ALERTA CRÍTICO - DESVIO DE CAIXA

Loja: Espeto Bahia Show - Loja Centro
Mensagem: Desvio de 10% detectado
Valor do Desvio: R$ 100.00
Percentual: 10%
Horário: 27/09/2026 17:30:45

⚠️ Investigação recomendada imediatamente!
```

### Alerta de Venda Alta

```
📈 ÓTIMA NOTÍCIA - VENDA ACIMA DO NORMAL

Loja: Espeto Bahia Show - Matriz
Valor: R$ 5.250,00
Hora: 27/09/2026 12:15:00

🎉 Dia está sendo produtivo!
```

### Alerta de Sangria

```
💰 MOVIMENTAÇÃO - SANGRIA REALIZADA

Loja: Bahia Tabacaria Show
Valor da Sangria: R$ 500.00
Operador: João da Silva
Horário: 27/09/2026 16:45:00
```

---

## 🔔 5. Fluxo Automático

```
Garçom fecha caixa com desvio
    ↓
CashService.closeCashSession() detecta desvio > 5%
    ↓
AlertService.createAlert()
    ├─ Salva em notifications table (DB)
    ├─ Emite via WebSocket ao dono (real-time)
    └─ Chama WhatsAppService.sendAlert() async
        ↓
Twilio envia mensagem WhatsApp
    ↓
🔔 Proprietário recebe no telefone
```

---

## 💡 6. Casos de Uso

### Cenário 1: Roubo Detectado
```
Sistema: R$ 1000
Declarado: R$ 500
Desvio: 50%
→ ALERTA CRÍTICO via WhatsApp + WebSocket
```

### Cenário 2: Desvio Pequeno
```
Sistema: R$ 1000
Declarado: R$ 980
Desvio: 2%
→ SEM ALERTA (abaixo de 5%)
```

### Cenário 3: Vendas Altas
```
Se faturamento do dia > média histórica
→ ALERTA POSITIVO via WhatsApp
→ Motiva equipe + informa dono
```

---

## 🚨 7. Troubleshooting WhatsApp

### Erro: "Twilio credentials not configured"
```bash
# Verificar .env
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN

# Se vazio, configurar:
export TWILIO_ACCOUNT_SID=AC...
export TWILIO_AUTH_TOKEN=...
```

### Erro: "Sandbox not active"
```
- Número sandbox expira após 72h de inatividade
- Resend activation message no Twilio Console
- Ou upgrade para API comercial
```

### Erro: "Invalid phone number"
```
- Garantir que começa com +55 (Brasil)
- Remover parênteses, espaços: +5585988888888
- Validar que telefone foi confirmado no sandbox
```

### Mensagem não chega
```
1. Verificar credenciais Twilio (Account SID + Auth Token)
2. Verificar se número é válido (+55 + DDD + 9 + 8 dígitos)
3. Verificar se telefone foi confirmado (72h)
4. Testar via Twilio Console (https://www.twilio.com/console/sms/messages)
```

### "Rate limited"
```
- Twilio tem limite de 100 msgs/min por default
- Para Espeto com 3 lojas, usar plano PRO
- Contactar Twilio para aumentar limite
```

---

## 📊 8. Monitoramento de Alerts

### Ver logs no servidor:
```bash
tail -f logs/alerts.log

# Grep por WhatsApp
grep "WhatsApp" logs/alerts.log

# Ver erros
grep "ERROR" logs/alerts.log | grep WhatsApp
```

### Dashboard de Alertas (API):

```bash
# Listar todos alertas não lidos
curl -X GET http://localhost:3000/api/v1/alerts \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-Id: tenant-1" \
  -H "X-Store-Id: store-001"

# Response:
# [
#   {
#     "notificationId": "notif-123",
#     "type": "DESVIO_CAIXA",
#     "level": "CRITICO",
#     "title": "Desvio detectado",
#     "message": "Desvio de 10%...",
#     "details": {...},
#     "read": false,
#     "timestamp": "2026-09-27T17:30:45Z"
#   }
# ]
```

---

## 🎓 9. Versão Comercial (Production)

Para usar em produção com seu próprio número:

1. **Upgrade conta Twilio** para $0.0075/msg (cheap!)
2. **Registrar seu número** como Twilio Sender
3. **Aumentar rate limit** (10,000 msgs/dia)
4. **Adicionar backup**: Email (SendGrid) + SMS

### Custo Estimado:
- 100 alertas/dia × 30 dias = 3000 msgs/mês
- 3000 × $0.0075 = **R$ 54/mês** (muito barato!)

---

## 10. Evolução Futura

### Phase 2:
- ✅ Email alerts (SendGrid)
- ✅ SMS alerts (Twilio SMS)
- ✅ Telegram bot
- ✅ Push notifications

### Phase 3:
- ✅ Alertas por limiar (customizável por loja)
- ✅ Horário de silêncio (não enviar à noite)
- ✅ Resumo diário (em vez de alertas individuais)
- ✅ Escalonação (alerta gerente → dono)

---

## 📞 Suporte

**Documentação Twilio:**
https://www.twilio.com/docs/sms/whatsapp/api

**Twilio Console:**
https://www.twilio.com/console

**Status do Sandbox:**
https://www.twilio.com/console/sms/whatsapp/learn

---

**Espeto: Notificações WhatsApp que salvam sua renda** 📱💰
