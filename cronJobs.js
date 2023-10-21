const decreaseHappinessTimer = require('./actions/decreaseHappinessTIMER/index')
const refreshLeaderboardTIMER = require('./actions/refreshLeaderboardTIMER/index')
const updateMarketPricesTIMER = require('./actions/updateMarketPricesTIMER/index')
const clearTempLeaderboardTIMER = require('./actions/clearTempLeaderboardTIMER/index')

const cron = require('node-cron');

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

    let leaderboardCycle = 1;
    // Cycle every 3 minutes, total refresh every 12
    cron.schedule('*/3 * * * *', async () => {
        if (process.env.RUN_LEADERBOARD_REFRESH === "true") {
            try {
                leaderboardCycle = (leaderboardCycle % 4) + 1;

                await refreshLeaderboardTIMER(leaderboardCycle);
                console.log(`Successfully ran refreshLeaderboardTIMER cycle ${leaderboardCycle}`);
            } catch (error) {
                console.log('Error running refreshLeaderboardTIMER:', error);
            }
        } else {
            console.log("Not running leaderboard refresh")
        }
    });
    console.log("Started cronjob file")
};


module.exports = { scheduleTasks }