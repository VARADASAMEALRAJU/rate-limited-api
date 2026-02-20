const client = require('prom-client');

// This automatically collects standard Node.js metrics (CPU, Memory, etc.)
client.collectDefaultMetrics();

// Custom Metric 1: Total API Requests
const apiRequestsTotal = new client.Counter({
    name: 'api_requests_total',
    help: 'Total number of API requests',
    labelNames: ['method', 'route', 'status_code']
});

// Custom Metric 2: Rate Limit Hits (Blocked requests)
const rateLimitHitsTotal = new client.Counter({
    name: 'rate_limit_hits_total',
    help: 'Total number of rate limit exceeded events',
    labelNames: ['route']
});

// Custom Metric 3: Rate Limit Allowed (Passed requests)
const rateLimitAllowedTotal = new client.Counter({
    name: 'rate_limit_allowed_total',
    help: 'Total number of requests allowed by rate limiter',
    labelNames: ['route']
});

module.exports = {
    client,
    apiRequestsTotal,
    rateLimitHitsTotal,
    rateLimitAllowedTotal
};