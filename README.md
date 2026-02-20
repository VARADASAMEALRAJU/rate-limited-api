
# Rate-Limited & Observable API Service

## Overview
This project is a robust, production-ready backend API service built with Node.js and Express. It demonstrates advanced backend engineering patterns, specifically focusing on API resilience through distributed rate limiting and deep operational insight through a comprehensive observability stack. 

The entire system is containerized using Docker multi-stage builds and orchestrated via Docker Compose, ensuring a seamless, reproducible development and testing environment.

## Architecture & Features
* **Core API:** RESTful Express.js application with data validation.
* **Rate Limiting:** Implements the **Token Bucket** algorithm to protect resources. State is distributed and persisted using an in-memory **Redis** datastore, ensuring rate limits are accurately tracked across potential multiple API instances.
* **Observability:**
    * **Structured Logging:** Uses `winston` for JSON-formatted logging to standard output, fully compatible with Docker log aggregators.
    * **Custom Metrics:** Exposes total requests, allowed requests, and blocked requests via the Prometheus Node.js client at `/metrics`.
    * **Monitoring:** A fully configured **Prometheus** instance scrapes the API, and a pre-configured **Grafana** dashboard visualizes the traffic and rate-limit events in real-time.
* **Containerization:** Utilizes an optimized, multi-stage `Dockerfile` to minimize the production image size and surface area.

## Prerequisites
* Docker
* Docker Compose (v3.8+)

## Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd rate-limited-api

```

2. **Configure Environment Variables:**
A `.env.example` file is provided. To customize the application locally:
```bash
cp .env.example .env

```


*(Note: The `docker-compose.yml` provides the default values needed to run the stack immediately).*
3. **Start the System:**
Build and run the entire stack (API, Redis, Prometheus, Grafana) in the background:
```bash
docker-compose up -d --build

```


4. **Verify Health:**
Check the API health status:
```bash
curl http://localhost:8080/api/status

```



## Accessing Observability Dashboards

### Prometheus

* **URL:** `http://localhost:9090`
* **Details:** Access raw metrics and execute PromQL queries. Verify the API is being scraped by navigating to *Status > Targets*.

### Grafana

* **URL:** `http://localhost:3000`
* **Credentials:** `admin` / `admin` (Configured via environment variables)
* **Details:** 1. Log in and navigate to **Connections > Data Sources** to ensure Prometheus (`http://prometheus:9090`) is connected.
2. Navigate to **Dashboards > Import** and upload the `api_dashboard.json` located in the `grafana/dashboards/` directory.

## Testing the Application

Automated tests are written using `jest` and `supertest` to verify routing, validation, and rate limiting logic.

**To run the test suite inside the container:**

```bash
docker-compose exec api npm test

```

## API Documentation

### 1. Health Check

* **Endpoint:** `GET /api/status`
* **Response:** `200 OK`
```json
{ "status": "healthy" }

```



### 2. Create Product

* **Endpoint:** `POST /api/products`
* **Payload Requirements:** `name` (string), `description` (string), `price` (number).
* **Response:** `201 Created`
```json
{
  "id": "uuid-string",
  "name": "Laptop",
  "description": "High performance",
  "price": 999
}

```



### 3. List Products

* **Endpoint:** `GET /api/products`
* **Response:** `200 OK` (Returns an array of product objects)

### 4. Protected Action (Rate Limited)

* **Endpoint:** `POST /api/protected-action`
* **Payload:** `{"data": "any string"}`
* **Rate Limit Logic:** Uses a Token Bucket algorithm backed by Redis.
* **Success Response:** `200 OK`
* **Rate Limit Exceeded Response:** `429 Too Many Requests`
```json
{ "error": "Too Many Requests" }

```



**Rate Limit Headers:**
Every response to this endpoint includes the following HTTP headers to inform the client of their status:

* `X-RateLimit-Limit`: The maximum capacity of the token bucket (Default: 10).
* `X-RateLimit-Remaining`: The number of tokens currently available.
* `X-RateLimit-Reset`: Unix timestamp indicating when the next token will be added to the bucket.

## Triggering the Rate Limiter (Demo)

To visually see the rate limiter working in Grafana, send a rapid burst of requests to the protected endpoint using this terminal command:

```bash
for i in {1..15}; do curl -i -X POST http://localhost:8080/api/protected-action -H "Content-Type: application/json" -d '{"data": "test"}'; done

```

You will observe the first 10 requests succeed, followed by `429` errors, which will be immediately reflected on your Grafana dashboard.

```

