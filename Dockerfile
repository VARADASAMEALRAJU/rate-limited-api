# Stage 1: Build environment
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install ALL dependencies (including jest for testing)
RUN npm ci
COPY . .

# Stage 2: Runtime environment
FROM node:20-alpine
WORKDIR /app
# Copy everything from the builder stage, including the test tools
COPY --from=builder /app .
EXPOSE 8080
CMD ["npm", "start"]