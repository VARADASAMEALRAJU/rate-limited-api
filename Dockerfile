# Stage 1: Build environment
FROM node:20-alpine AS builder
WORKDIR /app
# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci
# Copy the rest of the application code
COPY . .

# Stage 2: Runtime environment
FROM node:20-alpine
WORKDIR /app
# Copy only the necessary files from the builder stage
COPY --from=builder /app /app
# Expose the port our API runs on
EXPOSE 8080
# Start the application
CMD ["npm", "start"]