const decreaseHappinessTimer = require('./actions/decreaseHappinessTIMER/index')
const refreshLeaderboardTIMER = require('./actions/refreshLeaderboardTIMER/index')
const updateMarketPricesTIMER = require('./actions/updateMarketPricesTIMER/index')
const clearTempLeaderboardTIMER = require('./actions/clearTempLeaderboardTIMER/index')




const cron = require('node-cron');

console.log("Started cronjob file")

// Schedule tasks
const scheduleTasks = () => {

    // Run clear temp leaderboard midnight Sunday
    cron.schedule('59 23 * * SUN', async () => {
        try {
            await clearTempLeaderboardTIMER();
            console.log('Successfully ran clearTempLeaderboardTIMER');
        } catch (error) {
            console.log('Error running clearTempLeaderboardTIMER:', error);
        }
    });

    // Run update market prices every 2 hours
    cron.schedule('0 */2 * * *', async () => {
        try {
            await updateMarketPricesTIMER();
            console.log('Successfully ran updateMarketPricesTIMER');
        } catch (error) {
            console.log('Error running updateMarketPricesTIMER:', error);
        }
    });

    // Run decrease animal happiness every 1 hour 
    cron.schedule('0 */1 * * *', async () => {
        try {
            await decreaseHappinessTimer();
            console.log('Successfully ran decreaseHappinessTimer');
        } catch (error) {
            console.log('Error running decreaseHappinessTimer:', error);
        }
    });

    // Refresh leaderboards every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        if(process.env.RUN_LEADERBOARD_REFRESH === "true") {
            try {
                await refreshLeaderboardTIMER();
                console.log('Successfully ran refreshLeaderboardTIMER');
            } catch (error) {
                console.log('Error running refreshLeaderboardTIMER:', error);
            }
        } else {
            console.log("Not running leaderboard refresh")
        }
    });
};

module.exports = scheduleTasks;
