# ========================================
# ESPETO - Setup GitHub + Netlify Secrets
# ========================================
# Pré-requisitos:
# 1. GitHub CLI: https://cli.github.com/ (ver versão: gh --version)
# 2. Netlify CLI: npm install -g netlify-cli (ou: netlify --version)
# 3. Estar autenticado: gh auth status && netlify status

param(
    [string]$GitHubRepo = "jack-182/-espeto-pdv",
    [string]$NetlifySite = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 ESPETO - Setup Secrets" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Cores para output
$Success = "Green"
$Error = "Red"
$Info = "Yellow"
$Warning = "Magenta"

# ========================================
# PASSO 1: Validar Ferramentas
# ========================================
Write-Host "📋 Validando pré-requisitos..." -ForegroundColor $Info

$ghInstalled = gh --version 2>$null
if (-not $ghInstalled) {
    Write-Host "❌ GitHub CLI não instalado!" -ForegroundColor $Error
    Write-Host "   Instale em: https://cli.github.com/" -ForegroundColor $Warning
    exit 1
}
Write-Host "✅ GitHub CLI: $($ghInstalled.Split(' ')[2])" -ForegroundColor $Success

$netlifyInstalled = netlify --version 2>$null
if (-not $netlifyInstalled) {
    Write-Host "❌ Netlify CLI não instalado!" -ForegroundColor $Error
    Write-Host "   Instale: npm install -g netlify-cli" -ForegroundColor $Warning
    exit 1
}
Write-Host "✅ Netlify CLI: $netlifyInstalled" -ForegroundColor $Success

# Validar autenticação GitHub
Write-Host ""
Write-Host "🔐 Validando autenticação GitHub..." -ForegroundColor $Info
$ghAuth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Não autenticado no GitHub!" -ForegroundColor $Error
    Write-Host "   Execute: gh auth login" -ForegroundColor $Warning
    exit 1
}
Write-Host "✅ GitHub autenticado" -ForegroundColor $Success

# ========================================
# PASSO 2: Secrets do Firebase
# ========================================
Write-Host ""
Write-Host "🔥 Adicionando secrets do Firebase..." -ForegroundColor $Info

$firebaseSecrets = @{
    "REACT_APP_FIREBASE_PROJECT_ID" = "imagined-graph-k6pck"
    "REACT_APP_FIREBASE_APP_ID" = "1:260296343980:web:6c64c984f500757e8fba09"
    "REACT_APP_FIREBASE_API_KEY" = "AIzaSyBkuj-Vp4oGuVSWtysV-aRP3oLSStnkrJI"
    "REACT_APP_FIREBASE_AUTH_DOMAIN" = "imagined-graph-k6pck.firebaseapp.com"
    "REACT_APP_FIREBASE_STORAGE_BUCKET" = "imagined-graph-k6pck.firebasestorage.app"
    "REACT_APP_FIREBASE_MESSAGING_SENDER_ID" = "260296343980"
}

foreach ($key in $firebaseSecrets.Keys) {
    $value = $firebaseSecrets[$key]
    Write-Host "  → GitHub: $key" -ForegroundColor Gray
    gh secret set $key --body $value --repo $GitHubRepo 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ GitHub secret adicionado" -ForegroundColor $Success
    } else {
        Write-Host "    ⚠️  Erro ao adicionar (pode já existir)" -ForegroundColor $Warning
    }
}

# ========================================
# PASSO 3: Secrets Opcionais (Twilio, etc)
# ========================================
Write-Host ""
Write-Host "📱 Adicionando secrets Twilio (OPCIONAL)..." -ForegroundColor $Info
Write-Host "⚠️  Se não tiver Twilio setup, deixe em branco" -ForegroundColor $Warning

$twilioSID = Read-Host "  TWILIO_ACCOUNT_SID (Enter para pular)"
if ($twilioSID) {
    gh secret set TWILIO_ACCOUNT_SID --body $twilioSID --repo $GitHubRepo 2>&1 | Out-Null
    Write-Host "    ✅ TWILIO_ACCOUNT_SID adicionado" -ForegroundColor $Success
}

$twilioToken = Read-Host "  TWILIO_AUTH_TOKEN (Enter para pular)"
if ($twilioToken) {
    gh secret set TWILIO_AUTH_TOKEN --body $twilioToken --repo $GitHubRepo 2>&1 | Out-Null
    Write-Host "    ✅ TWILIO_AUTH_TOKEN adicionado" -ForegroundColor $Success
}

$twilioNumber = Read-Host "  TWILIO_WHATSAPP_NUMBER (Enter para pular)"
if ($twilioNumber) {
    gh secret set TWILIO_WHATSAPP_NUMBER --body $twilioNumber --repo $GitHubRepo 2>&1 | Out-Null
    Write-Host "    ✅ TWILIO_WHATSAPP_NUMBER adicionado" -ForegroundColor $Success
}

# ========================================
# PASSO 4: Secrets do Netlify
# ========================================
Write-Host ""
Write-Host "🌐 Configurando Netlify..." -ForegroundColor $Info

if (-not $NetlifySite) {
    Write-Host "  Listando seus sites Netlify..." -ForegroundColor Gray
    $sites = netlify sites:list 2>&1 | Select-String "Name:"
    if ($sites) {
        Write-Host "  Sites disponíveis:" -ForegroundColor Gray
        Write-Host $sites -ForegroundColor Gray
    }
    $NetlifySite = Read-Host "  Qual é o Site ID do Netlify?"
}

if ($NetlifySite) {
    Write-Host ""
    Write-Host "  → Netlify: Adicionando secrets em $NetlifySite" -ForegroundColor Gray

    foreach ($key in $firebaseSecrets.Keys) {
        $value = $firebaseSecrets[$key]
        Write-Host "    → $key" -ForegroundColor Gray
        netlify env:set $key $value --site=$NetlifySite 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "      ✅ Netlify env adicionado" -ForegroundColor $Success
        } else {
            Write-Host "      ⚠️  Erro (pode já existir)" -ForegroundColor $Warning
        }
    }

    if ($twilioSID) {
        netlify env:set TWILIO_ACCOUNT_SID $twilioSID --site=$NetlifySite 2>&1 | Out-Null
        netlify env:set TWILIO_AUTH_TOKEN $twilioToken --site=$NetlifySite 2>&1 | Out-Null
        netlify env:set TWILIO_WHATSAPP_NUMBER $twilioNumber --site=$NetlifySite 2>&1 | Out-Null
        Write-Host "    ✅ Secrets Twilio adicionados no Netlify" -ForegroundColor $Success
    }
} else {
    Write-Host "⏭️  Pulando Netlify (você pode configurar depois no painel)" -ForegroundColor $Warning
}

# ========================================
# PASSO 5: Resumo
# ========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Setup Completo!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor $Info
Write-Host ""
Write-Host "1. ✅ Secrets adicionados no GitHub" -ForegroundColor $Success
Write-Host "   → https://github.com/$GitHubRepo/settings/secrets/actions" -ForegroundColor Gray
Write-Host ""
if ($NetlifySite) {
    Write-Host "2. ✅ Secrets adicionados no Netlify" -ForegroundColor $Success
    Write-Host "   → https://app.netlify.com/sites/$NetlifySite/settings/build-deploy" -ForegroundColor Gray
} else {
    Write-Host "2. ⏳ Adicione manualmente no Netlify:" -ForegroundColor $Warning
    Write-Host "   → https://app.netlify.com/sites/SEU-SITE/settings/build-deploy" -ForegroundColor Gray
}
Write-Host ""
Write-Host "3. 🚀 Trigger novo deploy:" -ForegroundColor $Info
Write-Host "   → GitHub: Push novo commit ou Trigger no Actions" -ForegroundColor Gray
Write-Host "   → Netlify: Clique 'Trigger deploy' no painel" -ForegroundColor Gray
Write-Host ""
Write-Host "4. ✔️  Testar login em produção" -ForegroundColor $Info
Write-Host ""
Write-Host "💡 Se erros ocorrerem, verifique:" -ForegroundColor $Warning
Write-Host "   • gh auth status (GitHub autenticado?)" -ForegroundColor Gray
Write-Host "   • netlify status (Netlify conectado?)" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 Pronto!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
