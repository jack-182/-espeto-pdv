# Multi-stage build para Espeto Backend

# ============================================================================
# Stage 1: BUILDER - Compilar código
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production && \
    npm ci --only=development

# Copiar código-fonte
COPY . .

# Build do projeto
RUN npm run build

# ============================================================================
# Stage 2: RUNTIME - Imagem final otimizada
# ============================================================================
FROM node:20-alpine

WORKDIR /app

# Metadados
LABEL maintainer="Espeto <dev@espeto.com.br>"
LABEL version="1.0.0"
LABEL description="Espeto PDV - Sistema de Gestão Multi-Unidade com Alertas"

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Copiar dependências da stage anterior
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copiar arquivos de configuração
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.env.production ./.env

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expor porta
EXPOSE 3000

# User não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Comando para iniciar
CMD ["node", "dist/server.cjs"]
