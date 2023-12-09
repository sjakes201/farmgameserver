const rateLimitWindowMS = 1 * 60 * 1000; // 1 min
const maxConnectionsPerIP = 15; // Max connections per IP in one window
const cleanupInterval = 10 * 60 * 1000; // 10 minutes

let ipConnectionCounts = {};

function checkRateLimit(ip) {
    try {
        const currentTime = Date.now();
        if (!ipConnectionCounts[ip]) {
            ipConnectionCounts[ip] = { count: 1, resetTime: currentTime + rateLimitWindowMS };
            return false; // Not exceeded
        }

        const ipData = ipConnectionCounts[ip];
        if (currentTime > ipData.resetTime) {
            // Reset the count after the time window has passed
            ipConnectionCounts[ip] = { count: 1, resetTime: currentTime + rateLimitWindowMS };
            return false;
        }

        if (ipData.count >= maxConnectionsPerIP) {
            return true; // Exceeded limit
        }

        ipConnectionCounts[ip].count += 1;
        return false;
    } catch (error) {
        console.log(error);
        return true;
    }
}

function initializeCleanUp() {
    setInterval(() => {
        const currentTime = Date.now();
        for (const ip in ipConnectionCounts) {
            if (currentTime > ipConnectionCounts[ip].resetTime) {
                delete ipConnectionCounts[ip];
            }
        }
    }, cleanupInterval);
}

module.exports = {
    checkRateLimit,
    initializeCleanUp
};