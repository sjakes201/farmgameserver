const rateLimitWindowMS = 1 * 60 * 1000; // 1 min
const maxMessagesPerWindow = 600; // Max messages per user in window
const cleanupInterval = 10 * 60 * 1000; // 10 minutes


let userMessageCounts = {};

function checkMessageRateLimit(userID) {
    try {
        const currentTime = Date.now();
        if (!userMessageCounts[userID]) {
            userMessageCounts[userID] = { count: 1, resetTime: currentTime + rateLimitWindowMS };
            return false; // Not exceeded
        }

        const userData = userMessageCounts[userID];
        if (currentTime > userData.resetTime) {
            // Reset the count after the time window has passed
            userMessageCounts[userID] = { count: 1, resetTime: currentTime + rateLimitWindowMS };
            return false;
        }

        if (userData.count >= maxMessagesPerWindow) {
            return true; // Exceeded limit
        }

        userMessageCounts[userID].count += 1;
        return false;
    } catch (error) {
        console.log(error);
        return true;
    }
}

function initializeMessageCleanup() {
    setInterval(() => {
        const currentTime = Date.now();
        for (const userID in userMessageCounts) {
            if (currentTime > userMessageCounts[userID].resetTime) {
                delete userMessageCounts[userID];
            }
        }
    }, cleanupInterval); 
}


module.exports = { checkMessageRateLimit, initializeMessageCleanup }