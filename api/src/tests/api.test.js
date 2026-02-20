const request = require('supertest');
const app = require('../main'); // Imports your Express app without starting the server
const redis = require('redis');

// Mock Redis to prevent our tests from failing if a real database isn't running locally
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(),
    hGetAll: jest.fn().mockResolvedValue({}),
    hSet: jest.fn().mockResolvedValue(),
    expire: jest.fn().mockResolvedValue(),
  }),
}));

describe('API Endpoints & Rate Limiting', () => {
    
    test('GET /api/status should return 200 and healthy status', async () => {
        const response = await request(app).get('/api/status');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'healthy' });
    });

    test('POST /api/products should fail validation without correct fields', async () => {
        const response = await request(app)
            .post('/api/products')
            .send({ name: 'Test Product' }); // Missing description and price
        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
    });

    test('POST /api/products should create a product', async () => {
        const response = await request(app)
            .post('/api/products')
            .send({ name: 'Laptop', description: 'A fast computer', price: 999 });
        expect(response.status).toBe(201);
        expect(response.body.name).toBe('Laptop');
        expect(response.body.id).toBeDefined();
    });

    test('GET /api/products should return a list of products', async () => {
        const response = await request(app).get('/api/products');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBeTruthy();
    });

    test('POST /api/protected-action requires data field', async () => {
        const response = await request(app).post('/api/protected-action').send({});
        expect(response.status).toBe(400);
    });

    test('GET /metrics should return Prometheus metrics', async () => {
        const response = await request(app).get('/metrics');
        expect(response.status).toBe(200);
        expect(response.text).toContain('api_requests_total');
    });
});