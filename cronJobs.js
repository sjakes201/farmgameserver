const decreaseHappinessTimer = require('./serverActions/decreaseHappinessTIMER/index')
const refreshLeaderboardTIMER = require('./serverActions/refreshLeaderboardTIMER/index')
const updateMarketPricesTIMER = require('./serverActions/updateMarketPricesTIMER/index')
const clearTempLeaderboardTIMER = require('./serverActions/clearTempLeaderboardTIMER/index')
const transferInactiveLeaders = require('./serverActions/transferInactiveLeaders/index');
const updateMarketMultipliers = require('./serverActions/updateMarketMultipliers/index')
const resetExpiredIndivGoals = require('./serverActions/resetExpiredIndivGoals/index')
// const distributeEventRewards = require('./serverActions/distributeEventRewards/index')

const cron = require('node-cron');

// Schedule tasks
const scheduleTasks = () => {
    // distributeEventRewards()
    // Run clear temp leaderboard midnight Sunday
    cron.schedule('59 23 * * SUN', async () => {
        try {
            await clearTempLeaderboardTIMER();
            console.log('Successfully ran clearTempLeaderboardTIMER');
        } catch (error) {
            console.log('Error running clearTempLeaderboardTIMER:', error);
        }
    });

    // Run market multipliers randomizer every 12 hours
    cron.schedule('0 0,12 * * *', async () => {
        try {
            await updateMarketMultipliers();
            console.log('Successfully ran updateMarketMultipliers');
        } catch (error) {
            console.log('Error running updateMarketMultipliers:', error);
        }
    });

    // Run transfer inactive leaders every 24 hours
    cron.schedule('0 0 * * *', async () => {
        try {
            await transferInactiveLeaders();
            console.log('Successfully ran transferInactiveLeaders');
        } catch (error) {
            console.log('Error running transferInactiveLeaders:', error);
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
    refreshLeaderboardTIMER(1);

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

    cron.schedule('*/1 * * * *', async () => {
        try {
            await resetExpiredIndivGoals()
            console.log(`Successfully ran resetExpiredIndivGoals`);
        } catch (error) {
            console.log('Error running resetExpiredIndivGoals:', error);
        }
    });

    console.log("Started cronjob file")
};


module.exports = { scheduleTasks }