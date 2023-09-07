const UPGRADES = require('../shared/UPGRADES');
const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {
    // GET USERID
    const UserID = ws.UserID;
    const upgrade = actionData.upgrade;
    const tier = actionData.tier;

    if (!(upgrade in UPGRADES.UpgradeCosts)) {
        return {
            message: "UPGRADE NOT FOUND"
        };
    }

    if (tier >= UPGRADES.UpgradeCosts[upgrade].length || !Number.isInteger(tier)) {

        return {
            message: "INVALID TIER"
        };
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();

        const request = new sql.Request(transaction)

        request.input('UserID', sql.Int, UserID);

        // Increment animal management if capacity type (SQL +AnimalManagement)
        if (upgrade === "coopCapacityUpgrade") {
            let increase = UPGRADES.CapacityIncreases.Coop[tier];
            request.input('increase', sql.Int, increase);
            await request.query(`UPDATE AnimalManagement SET CoopCapacity = CoopCapacity + @increase WHERE UserID = @UserID`)
        } else if (upgrade === "barnCapacityUpgrade") {
            let increase = UPGRADES.CapacityIncreases.Barn[tier];
            request.input('increase', sql.Int, increase);
            await request.query(`UPDATE AnimalManagement SET BarnCapacity = BarnCapacity + @increase WHERE UserID = @UserID`)
        }

        // Check if we could have afforded it (SQL -AnimalManagement +Profiles)
        let cost = UPGRADES.UpgradeCosts[upgrade][tier]
        request.input('cost', sql.Int, cost);

        let updateBalance = await request.query(`
        UPDATE Profiles SET Balance = Balance - @cost WHERE UserID = @UserID
        SELECT Balance FROM Profiles WHERE UserID = @UserID
        `)
        if (updateBalance.recordset[0].Balance < 0) {
            console.log('INSUFFICIENT BALANCE');
            await transaction.rollback();
            return {
                message: "INSUFFICIENT BALANCE"
            };
        }
        // Increase upgrades, if not above limit, commit (SQL -Profiles +Upgrades)
        let updateUpgrades = await request.query(`
        UPDATE Upgrades SET ${upgrade} = ${upgrade} + 1 WHERE UserID = @UserID
        SELECT ${upgrade} FROM Upgrades WHERE UserID = @UserID
        `)
        if (upgrade === 'deluxePermit' || upgrade === 'exoticPermit') {
            if (updateUpgrades.recordset[0][upgrade] !== true) {
                await transaction.rollback();
                return  {
                    message: "ALREADY PURCHASED PERMIT"
                };
            }
        } else if (updateUpgrades.recordset[0][upgrade] !== tier + 1) {
            await transaction.rollback();
            return {
                message: "INVALID TIER"
            };
        }

        if (updateUpgrades.recordset[0][upgrade] > UPGRADES.UpgradeCosts[upgrade].length) {
            console.log("MAX UPGRADE TIER REACHED");
            await transaction.rollback();
            return {
                message: "MAX UPGRADE TIER REACHED"
            };
        }

        await transaction.commit();
        return  {
            message: "SUCCESS",
            upgrade: upgrade,
            newUpgradeTier: tier + 1
        };

    } catch (error) {
        console.log(error);
        if (transaction) transaction.rollback();
        return {
            message: '/purchaseUpgrade call error'
        };
    } 
}
