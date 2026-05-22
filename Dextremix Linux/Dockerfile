# Dockerfile para Dextremix Finance en Linux
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos
COPY backend ./backend
COPY frontend ./frontend

# Compilar frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Configurar backend
WORKDIR /app/backend
RUN npm install
RUN npx prisma generate

# Etapa final de producción
FROM node:20-alpine

WORKDIR /app

# Copiar compilaciones del builder
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend/dist /app/frontend/dist

# Asegurar directorios de uploads y logs
RUN mkdir -p /app/backend/uploads /app/logs

EXPOSE 80

WORKDIR /app/backend
CMD npx prisma db push && npm run db:seed && node src/server.js
