const redis = require('redis');
const logger = require('./logger');
const { rateLimitHitsTotal, rateLimitAllowedTotal } = require('../metrics');

const redisClient = redis.createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));

(async () => {
    try {
        await redisClient.connect();
        logger.info('Connected to Redis for Rate Limiting');
    } catch (err) {
        logger.warn('Could not connect to Redis yet. (Expected if Docker is not running)');
    }
})();

const rateLimiter = async (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const key = `rate_limit:${clientIp}`;
    
    const capacity = parseInt(process.env.RATE_LIMIT_CAPACITY || 10, 10);
    const refillRate = parseInt(process.env.RATE_LIMIT_REFILL_RATE || 1, 10);
    
    try {
        const now = Date.now();
        let bucket = await redisClient.hGetAll(key);
        
        let tokens = capacity;
        let lastRefill = now;
        
        if (Object.keys(bucket).length > 0) {
            tokens = parseFloat(bucket.tokens);
            lastRefill = parseInt(bucket.lastRefill, 10);
            
            const elapsedTime = (now - lastRefill) / 1000;
            const newTokens = elapsedTime * refillRate;
            tokens = Math.min(capacity, tokens + newTokens);
        }
        
        if (tokens >= 1) {
            tokens -= 1;
            
            await redisClient.hSet(key, {
                tokens: tokens.toString(),
                lastRefill: now.toString()
            });
            
            const timeToFull = Math.ceil(capacity / refillRate);
            await redisClient.expire(key, timeToFull);
            
            res.setHeader('X-RateLimit-Limit', capacity);
            res.setHeader('X-RateLimit-Remaining', Math.floor(tokens));
            res.setHeader('X-RateLimit-Reset', Math.floor((now + (1000 / refillRate)) / 1000));
            
            // INCREASE ALLOWED METRIC
            rateLimitAllowedTotal.inc({ route: req.path });
            
            next();
        } else {
            logger.warn('Rate limit exceeded', { ip: clientIp, path: req.path });
            
            res.setHeader('X-RateLimit-Limit', capacity);
            res.setHeader('X-RateLimit-Remaining', 0);
            
            const waitTimeSeconds = (1 - tokens) / refillRate;
            const resetTime = Math.floor((now + (waitTimeSeconds * 1000)) / 1000);
            res.setHeader('X-RateLimit-Reset', resetTime);
            
            // INCREASE BLOCKED METRIC
            rateLimitHitsTotal.inc({ route: req.path });
            
            return res.status(429).json({ error: 'Too Many Requests' });
        }
    } catch (error) {
        logger.error('Rate Limiter Error', { error: error.message });
        next();
    }
};

module.exports = rateLimiter;