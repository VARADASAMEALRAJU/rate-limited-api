# Stage 1: Build environment
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install ALL dependencies (including dev)
RUN npm ci
# Copy source code
COPY . .
# CRITICAL FIX: Delete development/testing packages before moving to prod!
RUN npm prune --omit=dev

# Stage 2: Runtime production environment
FROM node:20-alpine
WORKDIR /app
# Copy the clean, pruned files from the builder stage
COPY --from=builder /app .
EXPOSE 8080
CMD ["npm", "start"]