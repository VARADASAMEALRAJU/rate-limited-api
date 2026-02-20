const request = require('supertest');
const redis = require('redis');

// 1. Mock redis safely to avoid Jest hoisting issues
jest.mock('redis', () => {
  const mClient = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(),
    eval: jest.fn()
  };
  return {
    createClient: jest.fn(() => mClient),
  };
});

const app = require('../main');

describe('API Endpoints & Rate Limiting', () => {
    let mockRedisClient;

    beforeAll(() => {
        // Retrieve the mocked client instance so we can change its behavior in specific tests
        mockRedisClient = redis.createClient();
    });

    beforeEach(() => {
        // Default behavior: Allow the request through the rate limiter
        mockRedisClient.eval.mockResolvedValue([1, 9, Math.floor(Date.now() / 1000) + 1]);
    });

    test('GET /api/status should return 200 and healthy status', async () => {
        const response = await request(app).get('/api/status');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'healthy' });
    });

    test('POST /api/products should fail validation without correct fields', async () => {
        const response = await request(app).post('/api/products').send({ name: 'Test Product' });
        expect(response.status).toBe(400);
    });

    test('POST /api/products should create a product', async () => {
        const response = await request(app)
            .post('/api/products')
            .send({ name: 'Laptop', description: 'A fast computer', price: 999 });
        expect(response.status).toBe(201);
        expect(response.body.name).toBe('Laptop');
    });

    test('GET /api/products should return a list of products', async () => {
        const response = await request(app).get('/api/products');
        expect(response.status).toBe(200);
    });

    test('POST /api/protected-action allows request when tokens are available', async () => {
        const response = await request(app).post('/api/protected-action').send({ data: 'test' });
        expect(response.status).toBe(200);
    });

    test('POST /api/protected-action returns 429 when rate limit exceeded', async () => {
        // Force the mock to return blocked (0) specifically for this test to prove the 429 logic works
        mockRedisClient.eval.mockResolvedValueOnce([0, 0, Math.floor(Date.now() / 1000) + 5]);
        const response = await request(app).post('/api/protected-action').send({ data: 'test' });
        
        expect(response.status).toBe(429);
        expect(response.body.error).toBe('Too Many Requests');
        expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });

    test('GET /metrics should return Prometheus metrics', async () => {
        const response = await request(app).get('/metrics');
        expect(response.status).toBe(200);
        expect(response.text).toContain('api_requests_total');
    });
});