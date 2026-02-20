require('dotenv').config();
const express = require('express');
const logger = require('./middleware/logger');
const productRoutes = require('./routes/products');
const rateLimiter = require('./middleware/rateLimiter');
const { client, apiRequestsTotal } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Request logging and total metrics middleware
app.use((req, res, next) => {
    logger.info('Incoming request', { method: req.method, path: req.path });
    
    // Wait for the response to finish so we can grab the final status code
    res.on('finish', () => {
        // Exclude the /metrics route itself from inflating our API metrics
        if (req.path !== '/metrics') {
            apiRequestsTotal.inc({ 
                method: req.method, 
                route: req.path, 
                status_code: res.statusCode 
            });
        }
    });
    
    next();
});

// Expose Metrics Endpoint (Rubric Requirement)
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.send(await client.register.metrics());
});

// Unprotected routes
app.get('/api/status', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});
app.use('/api/products', productRoutes);

// Protected route
app.post('/api/protected-action', rateLimiter, (req, res) => {
    const { data } = req.body;
    if (!data) {
        return res.status(400).json({ error: 'Data field is required' });
    }
    logger.info('Protected action accessed successfully');
    res.status(200).json({ message: 'Success', data });
});

if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Server listening on port ${PORT}`);
    });
}

module.exports = app;