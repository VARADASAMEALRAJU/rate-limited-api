const express = require('express');
const crypto = require('crypto'); // Native built-in Node.js module!
const logger = require('../middleware/logger');
const router = express.Router();

// In-memory store for products
const products = [];

// POST /api/products
router.post('/', (req, res) => {
    const { name, description, price } = req.body;

    // Strict Input Validation
    if (!name || !description || typeof price !== 'number') {
        logger.warn('Product validation failed', { body: req.body });
        return res.status(400).json({ error: 'Invalid input: name, description, and price (number) are required.' });
    }

    // Generate a UUID without external packages
    const newProduct = { id: crypto.randomUUID(), name, description, price };
    products.push(newProduct);
    
    logger.info('Product created', { productId: newProduct.id });
    res.status(201).json(newProduct);
});

// GET /api/products
router.get('/', (req, res) => {
    logger.info('Fetched all products');
    res.status(200).json(products);
});

module.exports = router;