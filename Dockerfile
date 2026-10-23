# ==============================================================================
# Dockerfile - Stack Moderno (Node.js 20 Alpine + Express + PostgreSQL)
# Adaptado para Kubernetes con seguridad non-root y arranque ligero
# ==============================================================================
FROM node:20-alpine

# Directorio de trabajo de la aplicación
WORKDIR /usr/src/app

# Copiar manifiestos e instalar dependencias de producción
COPY package*.json ./
RUN npm install --only=production --no-audit --no-fund

# Copiar código fuente
COPY . .

# Configurar usuario no privilegiado UID 101 para alineación con Helm SecurityContext
RUN addgroup -g 101 appuser && adduser -u 101 -D -G appuser appuser \
    && chown -R appuser:appuser /usr/src/app

USER 101:101

# Puerto configurable dinámicamente, por defecto 8080
ENV PORT=8080
EXPOSE 8080

# Comando de inicio del servidor
CMD ["node", "server.js"]
