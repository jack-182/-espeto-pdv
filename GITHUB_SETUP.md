# 🐙 GitHub + Netlify + WhatsApp Setup

## 📋 Guia Completo de Integração

Este documento explica como configurar o Espeto com GitHub, Netlify e WhatsApp.

---

## 1️⃣ Criar Repositório no GitHub

### Passo 1: Criar Repo

```bash
# No diretório do projeto
git init
git add .
git commit -m "Initial commit: Espeto MVP"
git branch -M main

# Conectar ao GitHub
git remote add origin https://github.com/seu-usuario/espeto-pdv.git
git push -u origin main
```

### Passo 2: Proteger Branch Main

No GitHub:
1. Ir para **Settings** → **Branches**
2. Clique em **Add rule**
3. Configure:
   - Branch name pattern: `main`
   - ✅ Require status checks to pass before merging
   - ✅ Require pull request reviews before merging
   - ✅ Dismiss stale pull request approvals when new commits are pushed

---

## 2️⃣ Configurar Secrets no GitHub

Vá para **Settings** → **Secrets and variables** → **Actions**

### Adicionar Secrets (clique em "New repository secret"):

```
NETLIFY_AUTH_TOKEN=seu_token_netlify
NETLIFY_SITE_ID=seu_site_id_netlify
DOCKER_USERNAME=seu_usuario_docker
DOCKER_PASSWORD=seu_token_docker
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=seu_auth_token
TWILIO_WHATSAPP_NUMBER=+5585988888888
FIREBASE_PROJECT_ID=seu-projeto
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
COOLIFY_WEBHOOK_URL=https://coolify.seu.servidor/webhook
COOLIFY_TOKEN=seu_token_coolify
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
API_URL=https://espeto-api.netlify.app
```

### Como obter cada secret:

**NETLIFY_AUTH_TOKEN:**
```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Fazer login
netlify login

# Token estará em ~/.netlify/state.json
# Ou gerar em https://app.netlify.com/user/applications/personal
```

**DOCKER_CREDENTIALS:**
```bash
# Criar token em https://hub.docker.com/settings/security
# Usar username e token
```

**TWILIO (WhatsApp):**
1. Ir para https://www.twilio.com/console
2. Copiar Account SID e Auth Token
3. Habilitar WhatsApp Sandbox em https://www.twilio.com/console/sms/whatsapp/learn
4. Número de Sandbox: +1 415 523 8886 (ou seu número custom)

**FIREBASE:**
1. Ir para Firebase Console
2. Project Settings → Service Accounts
3. Generate new private key (JSON)
4. Copiar privateKey (remover quebras de linha)

**COOLIFY:**
1. Ir para Coolify Admin Dashboard
2. API Tokens → Create New Token
3. Copiar token

**SLACK:**
1. Ir para https://api.slack.com/apps
2. Create New App → From scratch
3. Incoming Webhooks → Add New Webhook to Workspace
4. Copiar URL

---

## 3️⃣ Configurar Netlify

### Passo 1: Conectar GitHub ao Netlify

1. Ir para https://netlify.com
2. New site from Git
3. Escolher GitHub
4. Autorizar Netlify no GitHub
5. Selecionar repositório `espeto-pdv`

### Passo 2: Configurações de Build

**Build settings:**
- Base directory: `/`
- Build command: `npm run build`
- Publish directory: `dist`

**Environment variables:**
```
REACT_APP_API_URL=https://espeto-api.netlify.app
NODE_ENV=production
VITE_API_URL=https://espeto-api.netlify.app
```

### Passo 3: Deploy

Netlify fará deploy automático ao fazer push para main.

---

## 4️⃣ Testar WhatsApp Alerts

### Teste Manual:

```bash
curl -X POST http://localhost:3000/api/v1/alerts/test-whatsapp \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+55 85 98888-8888"
  }'

# Response: 
# {
#   "success": true,
#   "message": "✅ WhatsApp funcionando! Mensagem de teste foi enviada.",
#   "isConfigured": true
# }
```

### Teste Real (Desvio de Caixa):

1. Abrir caixa
2. Fechar com desvio > 5%
3. Dono recebe mensagem WhatsApp automaticamente! 🔔

---

## 5️⃣ CI/CD Pipeline Explicado

O arquivo `.github/workflows/deploy.yml` faz:

### 1. **Test & Build** (sempre)
```
- npm run lint
- npm run test:cash
- npm run test:security
- npm run build
```

### 2. **Deploy Frontend** (se push em main)
```
- npm run build
- netlify deploy --prod
```

### 3. **Deploy Backend** (se push em main)
```
- docker build
- docker push (Docker Hub)
- Trigger Coolify webhook
```

### 4. **Notificação Slack** (sempre)
- Envia status de deploy em #deployments

---

## 6️⃣ Workflow de Deploy

```
Developer faz push → main
    ↓
GitHub Actions dispara workflow
    ↓
Testes rodam (lint, unit, security)
    ↓
Se passar:
  ├─ Build frontend
  ├─ Deploy Netlify
  ├─ Build Docker
  ├─ Push Docker Hub
  └─ Trigger Coolify
    ↓
Notificação Slack
    ↓
✅ Produção atualizada
```

---

## 7️⃣ Branches & Gitflow

### Main (Produção)
```bash
git checkout main
git pull origin main
git checkout -b feature/minha-feature
# ... código ...
git commit -m "feat: descrição"
git push origin feature/minha-feature
# Abrir PR no GitHub
# Após review: Merge
```

### Develop (Staging)
```bash
# Branch separada para testes antes de produção
git checkout -b develop
# ... testes em staging ...
# Merge para main quando pronto
```

---

## 8️⃣ Monitoramento & Alertas

### Verificar Deployments:
- **Netlify:** https://app.netlify.com/sites/espeto-pdv/overview
- **GitHub Actions:** https://github.com/seu-usuario/espeto-pdv/actions
- **Docker Hub:** https://hub.docker.com/repository/docker/seu-usuario/espeto

### Alerts Configurados:
- ❌ Build falha → Slack
- ✅ Deploy sucede → Slack
- 🚨 Desvio de caixa > 5% → WhatsApp ao dono

---

## 9️⃣ Troubleshooting

### "Build failed in Netlify"
```bash
# Verificar logs localmente
npm run build

# Se erro, verificar:
- Node version (deve ser 20.x)
- Variáveis de ambiente
- Dependencies
```

### "Docker push failed"
```bash
# Verificar Docker login
docker login -u seu_usuario

# Verificar credenciais
cat ~/.docker/config.json
```

### "WhatsApp não está enviando"
```bash
# Verificar se Twilio está configurado
curl -X GET https://api.twilio.com/2010-04-01/Accounts/ACxxx \
  -u ACxxx:seu_auth_token

# Verificar se número está validado
# (WhatsApp Sandbox requer validação)
```

### "Netlify deployment lento"
- Verificar tamanho de build (`npm run build`)
- Considerar code splitting
- Usar CDN para assets estáticos

---

## 🔟 Próximos Passos

- [ ] Configurar **Email** (SendGrid)
- [ ] Configurar **SMS** (Twilio SMS)
- [ ] Adicionar **Monitoring** (Sentry/Datadog)
- [ ] Adicionar **Analytics** (Mixpanel)
- [ ] Configurar **Backups** automáticos (Database)
- [ ] Setup **SSL/TLS** (Let's Encrypt via Coolify)

---

## 📚 Links Úteis

- GitHub: https://github.com/seu-usuario/espeto-pdv
- Netlify: https://app.netlify.com/sites/espeto-pdv
- Twilio Console: https://www.twilio.com/console
- Firebase Console: https://console.firebase.google.com
- Docker Hub: https://hub.docker.com/

---

**Desenvolvido com ❤️ para integração automática e deploy seguro**
