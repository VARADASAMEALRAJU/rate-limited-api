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

// LUA Script ensures token reading and writing happens ATOMICALLY (Fixes Race Condition)
const luaScript = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refillRate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
    local tokens = capacity
    local lastRefill = now

    if bucket[1] then
        tokens = tonumber(bucket[1])
        lastRefill = tonumber(bucket[2])
        local elapsedTime = (now - lastRefill) / 1000
        local newTokens = elapsedTime * refillRate
        tokens = math.min(capacity, tokens + newTokens)
    end

    local allowed = 0
    local remaining = math.floor(tokens)
    local resetTime = math.floor((now + (1000 / refillRate)) / 1000)

    if tokens >= 1 then
        tokens = tokens - 1
        allowed = 1
        remaining = math.floor(tokens)
        redis.call('HMSET', key, 'tokens', tostring(tokens), 'lastRefill', tostring(now))
        local timeToFull = math.ceil(capacity / refillRate)
        redis.call('EXPIRE', key, timeToFull)
    else
        local waitTimeSeconds = (1 - tokens) / refillRate
        resetTime = math.floor((now + (waitTimeSeconds * 1000)) / 1000)
    end

    return {allowed, remaining, resetTime}
`;

const rateLimiter = async (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const key = `rate_limit:${clientIp}`;
    
    const capacity = parseInt(process.env.RATE_LIMIT_CAPACITY || 10, 10);
    const refillRate = parseInt(process.env.RATE_LIMIT_REFILL_RATE || 1, 10);
    const now = Date.now();
    
    try {
        // Execute the atomic Lua script in Redis
        const [allowed, remaining, resetTime] = await redisClient.eval(luaScript, {
            keys: [key],
            arguments: [capacity.toString(), refillRate.toString(), now.toString()]
        });
        
        res.setHeader('X-RateLimit-Limit', capacity);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTime);
        
        if (allowed === 1) {
            rateLimitAllowedTotal.inc({ route: req.path });
            next();
        } else {
            logger.warn('Rate limit exceeded', { ip: clientIp, path: req.path });
            rateLimitHitsTotal.inc({ route: req.path });
            return res.status(429).json({ error: 'Too Many Requests' });
        }
    } catch (error) {
        logger.error('Rate Limiter Error', { error: error.message });
        next(); // Fail open
    }
};

module.exports = rateLimiter;