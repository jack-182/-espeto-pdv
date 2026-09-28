# 🔐 Setup Secrets - Guia Rápido

## 🎯 O Que Este Script Faz

Automaticamente adiciona **credenciais Firebase** em:
- ✅ **GitHub** (para CI/CD)
- ✅ **Netlify** (para production build)

---

## 📋 Pré-Requisitos

### 1️⃣ GitHub CLI
```powershell
# Verificar se está instalado
gh --version

# Se não tiver, instale em:
# https://cli.github.com/
```

### 2️⃣ Netlify CLI
```powershell
# Instalar (requer Node.js + npm)
npm install -g netlify-cli

# Verificar
netlify --version
```

### 3️⃣ Autenticar GitHub
```powershell
gh auth login
# Siga as instruções (browser vai abrir)
```

---

## 🚀 Como Executar

### Opção 1: Automático (Recomendado)

```powershell
# Abrir PowerShell como Administrator
# Navegar para a pasta do projeto
cd "C:\Users\b04jps\OneDrive - TUPY SA\Área de Trabalho\Espeto\sistema-pdv-&-gestão-comercial"

# Executar script
.\setup-secrets.ps1
```

**O script vai:**
1. ✅ Validar se GitHub CLI + Netlify CLI estão instalados
2. ✅ Validar autenticação GitHub
3. ✅ Adicionar secrets Firebase automaticamente no GitHub
4. ✅ Pedir Site ID do Netlify
5. ✅ Adicionar secrets no Netlify (opcional)
6. ✅ Pedir credenciais Twilio (opcional)

---

### Opção 2: Manual (Se Script Falhar)

#### No GitHub:

```powershell
# Adicione cada secret via CLI
gh secret set REACT_APP_FIREBASE_PROJECT_ID --body "imagined-graph-k6pck" --repo jack-182/-espeto-pdv
gh secret set REACT_APP_FIREBASE_API_KEY --body "AIzaSyBkuj-Vp4oGuVSWtysV-aRP3oLSStnkrJI" --repo jack-182/-espeto-pdv
gh secret set REACT_APP_FIREBASE_AUTH_DOMAIN --body "imagined-graph-k6pck.firebaseapp.com" --repo jack-182/-espeto-pdv
gh secret set REACT_APP_FIREBASE_STORAGE_BUCKET --body "imagined-graph-k6pck.firebasestorage.app" --repo jack-182/-espeto-pdv
gh secret set REACT_APP_FIREBASE_MESSAGING_SENDER_ID --body "260296343980" --repo jack-182/-espeto-pdv
gh secret set REACT_APP_FIREBASE_APP_ID --body "1:260296343980:web:6c64c984f500757e8fba09" --repo jack-182/-espeto-pdv
```

#### No Netlify:

```powershell
# Após verificar seu Site ID
netlify env:set REACT_APP_FIREBASE_PROJECT_ID imagined-graph-k6pck --site=seu-site-id
netlify env:set REACT_APP_FIREBASE_API_KEY AIzaSyBkuj-Vp4oGuVSWtysV-aRP3oLSStnkrJI --site=seu-site-id
# ... etc
```

---

## 📝 Encontrar Site ID do Netlify

```powershell
# Listar seus sites
netlify sites:list

# Procure pela coluna "Site ID"
# Exemplo: "mellow-kleicha-eb0e47"
```

Ou acesse: https://app.netlify.com/user/sites

---

## ✅ Verificar Se Funcionou

### GitHub
```powershell
# Listar secrets adicionados
gh secret list --repo jack-182/-espeto-pdv
```

### Netlify
```powershell
# Listar env vars
netlify env:list --site=seu-site-id
```

---

## 🚀 Próximos Passos

### 1️⃣ Trigger Novo Deploy

**GitHub Actions:**
- Ir para: https://github.com/jack-182/-espeto-pdv
- Fazer novo commit ou push

**Netlify:**
- Ir para: https://app.netlify.com
- Clicar "Trigger deploy" → "Deploy site"

### 2️⃣ Aguardar Build

- GitHub Actions: ~5-8 minutos
- Netlify: ~3-5 minutos

### 3️⃣ Testar Login

- Abrir sua URL Netlify
- Tentar fazer login com Google

---

## 🆘 Troubleshooting

### "GitHub CLI not found"
```powershell
# Instale em: https://cli.github.com/
# Ou via Chocolatey: choco install gh
```

### "Not authenticated to GitHub"
```powershell
gh auth login
# Siga as instruções (browser vai abrir)
```

### "Netlify CLI not found"
```powershell
npm install -g netlify-cli
# Requer Node.js + npm instalados
```

### "Netlify not authenticated"
```powershell
netlify login
# Browser vai abrir para autorizar
```

### Script diz "Access Denied"
```powershell
# PowerShell está bloqueando scripts
# Execute como Admin e rode:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Depois tente novamente
```

---

## 📞 Se Algo Der Errado

1. ✅ Verifique pré-requisitos acima
2. ✅ Tente opção "Manual"
3. ✅ Verifique logs do GitHub Actions
4. ✅ Verifique logs do Netlify Build

---

**Pronto! 🎉**

Seus secrets estão seguros e configurados em produção.
