const jwt = require('jsonwebtoken');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const CONSTANTS = require('../shared/CONSTANTS');
const UPGRADES = require('../shared/UPGRADES');
const { poolPromise } = require('../../db');


const BCRYPT_ROUNDS = CONSTANTS.VALUES.BCRYPT_ROUNDS;
const NUM_CROP_TILES = CONSTANTS.VALUES.NUM_CROP_TILES;

const OATS_TILES = [22, 32, 33, 42, 43];
const CORN_TILES = [17, 18, 26, 27, 28, 36, 37];

module.exports = async function (ws, actionData) {
    // begin transaction
    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);

        // Generate random Username "GUESTUSER" + a random number, check DB, redo until one's available
        let randomUser = `Guest#`;
        let valid = false;
        while (!valid) {
            let randomHex = (Math.floor(Math.random() * 0xFFFFFFFF).toString(16)).padStart(8, '0').toUpperCase();
            randomUser += randomHex;
            request.input('Username', sql.NVarChar, randomUser);
            let isTaken = await request.query('SELECT 1 FROM Logins WHERE Username = @Username');
            if (isTaken.recordset.length > 0) {
                // not unique username
                // guest users have #, a character not permitted in regular usernames
                randomUser = `Guest#`
            } else {
                // unique user
                valid = true;
            }
        }

        // Generate random password
        let randomPass = (Math.floor(Math.random() * 0xFFFFFFFF).toString(16)).padStart(8, '0').toUpperCase();
        let encrypted_pass = await bcrypt.hash(randomPass, BCRYPT_ROUNDS);
        if (encrypted_pass === null) {
            console.log("ENCRYPT FAIL");
            return {
                message: "ENCRYPTION FAILURE, ABORTED"
            };
        }

        // Insert into database, with LastSeen being Date.now() ms and isGuest being 1 for true
        request.input('encrypted_pass', sql.NVarChar, encrypted_pass)
        let createLogin = await request.query(
            `INSERT INTO Logins (Username, Password, LastSeen, isGuest) OUTPUT INSERTED.* VALUES (@Username, @encrypted_pass, ${Date.now()}, 1)`
        )
        const UserID = createLogin.recordset[0].UserID;
        if (!Number.isInteger(UserID)) {
            await transaction.rollback();
            return {
                message: "ERROR GENERATING GUEST ID"
            };
        }
        let tileSQL = "INSERT INTO CropTiles (UserID, TileID, CropID, HarvestsRemaining, PlantTime) VALUES";
        for (let i = 1; i <= NUM_CROP_TILES; i++) {
            if (OATS_TILES.includes(i)) {
                tileSQL = tileSQL.concat(` (@UserID, ${i}, 14, ${UPGRADES.NumHarvests0.oats_seeds}, ${Date.now() - 10000000}),`);
            } else if (CORN_TILES.includes(i)) {
                tileSQL = tileSQL.concat(` (@UserID, ${i}, 10, ${UPGRADES.NumHarvests0.corn_seeds}, ${Date.now() - 10000000}),`);
            } else {
                tileSQL = tileSQL.concat(` (@UserID, ${i}, -1, NULL, NULL),`);
            }
        }
        tileSQL = tileSQL.substring(0, tileSQL.length - 1);
        tileSQL = tileSQL.concat(";");

        request.input('UserID', sql.Int, UserID)
        request.input('now', sql.Decimal, Date.now());
        let createAccount = await request.query(`
            INSERT INTO AnimalManagement (UserID) VALUES (@UserID)
            INSERT INTO Animals (UserID, Animal_ID, Animal_type, Last_produce) VALUES (@UserID, 0, 'chicken', @now)
            ${tileSQL}
            INSERT INTO Machines (UserID) VALUES (@UserID);
            INSERT INTO Profiles (UserID, Balance) VALUES (@UserID, 500);
            INSERT INTO TownContributions (UserID) VALUES (@UserID)
            INSERT INTO Upgrades (UserID) VALUES (@UserID);
            INSERT INTO Inventory_ARTISAN (UserID) VALUES (@UserID)
            INSERT INTO Inventory_PARTS (UserID) VALUES (@UserID)
            INSERT INTO Inventory_SEEDS (UserID, corn_seeds, oats_seeds) VALUES (@UserID, 4, 4);
            INSERT INTO Inventory_PRODUCE (UserID) VALUES (@UserID);
            INSERT INTO TempLeaderboardSum (UserID) VALUES (@UserID)
            INSERT INTO TempLeaderboard (UserID) VALUES (@UserID);
            INSERT INTO Leaderboard (UserID) VALUES (@UserID)
            INSERT INTO LeaderboardSum (UserID) VALUES (@UserID)
            INSERT INTO ORDERS (UserID, goal_1, progress_1, goal_2, progress_2, goal_3, progress_3, goal_4, progress_4, reward_1, reward_4) VALUES (@UserID, 'corn 50', 0, 'chicken_egg 10', 0, 'carrot 25', 0, 'cow_milk 5', 0, 'TimeFertilizer1', 'YieldsFertilizer2')
            INSERT INTO Inventory_EXTRA (UserID) VALUES (@UserID)
            `);

        // Provide auth token in header as if it were a regular UserID
        if (createAccount.rowsAffected.length === 0) {
            await transaction.rollback();
            return {
                message: "ERROR SETTING UP GUEST ACCOUNT DATA"
            };

        }
        const token = jwt.sign({ UserID: UserID }, process.env.JWT_KEY, { expiresIn: "720h" });

        await transaction.commit()
        return {
            auth: true,
            token: token,
            message: 'SUCCESS',
        };
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error)
        return {
            message: 'error'
        }
    }

}





