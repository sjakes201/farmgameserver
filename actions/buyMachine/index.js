const MACHINESINFO = require('../shared/MACHINESINFO');
const sql = require('mssql');
const { poolPromise } = require('../../db');

module.exports = async function (ws, actionData) {

    // type is string 'cheese' 'cloth' 'mayonnaise'
    let type = actionData.type;
    // slot is int 1,2,3,4,5 or 6
    let slot = actionData.slot;
    // tier is int 1 is init buy, tier 2 is first upgrade, tier 3 is second upgrade
    let tier = actionData.tier;

    const UserID = ws.UserID;

    if (!([1, 2, 3, 4, 5, 6].includes(slot))) {
        return {
            message: 'invalid machine slot number'
        };
    }

    if (!([1, 2, 3].includes(tier))) {
        return {
            message: 'invalid tier'
        };
    }

    // Get data from MachinesInfo
    let costs;
    switch (type) {
        case 'cheese':
            costs = MACHINESINFO.cheeseMachineCost[`tier${tier}`];
            break;
        case 'cloth':
            costs = MACHINESINFO.clothMachineCost[`tier${tier}`];
            break;
        case 'mayonnaise':
            costs = MACHINESINFO.mayonnaiseMachineCost[`tier${tier}`];
            break;
        default:
            return {
                message: 'invalid machine type'
            };
    }

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('moneyCost', sql.Int, costs.Money)
        request.input('gearsCost', sql.Int, costs.Gears)
        request.input('sheetsCost', sql.Int, costs.MetalSheets)
        request.input('boltsCost', sql.Int, costs.Bolts)

        /*
            This can be used to purchase AND upgrade
            Select old data, then set to new data. Compare old data and new to ensure a valid upgrade:
                - Level/tier should have been 1 less than current (increasing same tier or changing 0 which is nothing to first tier of something)
                - Slot should have either been -1 (nothing there) or the same type because it's an upgrade (typeID)
            SQL +Machines
        */
        let typeID = MACHINESINFO.machineTypeIDS[type];
        request.input('typeID', sql.Int, typeID)
        request.input('newTier', sql.Int, tier)

        let curSlotQuery = await request.query(`
            SELECT Slot${slot}, Slot${slot}Level FROM Machines WHERE UserID = @UserID
            UPDATE Machines SET Slot${slot} = @typeID, Slot${slot}Level = @newTier WHERE UserID = @UserID
        `)
        if (curSlotQuery.recordset[0][`Slot${slot}Level`] !== tier - 1) {
            // was not either an init buy (tier 0 to tier 1) or an upgrade (tier 1 -> 2 or 2 -> 3)
            await transaction.rollback();
            return {
                message: "INVALID TIER REQUEST"
            };
        }
        if (!(curSlotQuery.recordset[0][`Slot${slot}`] === -1 || curSlotQuery.recordset[0][`Slot${slot}`] === typeID)) {
            // was not either an empty spot (-1) or the previous tier for this upgrade (same typeID)
            await transaction.rollback();
            return {
                message: "INVALID MACHINE TYPE"
            };
        }

        // update bal cost (SQL -Machines +Profiles)
        let balQuery = await request.query(`
            UPDATE Profiles SET Balance = Balance - @moneyCost WHERE UserID = @UserID
            SELECT Balance FROM Profiles WHERE UserID = @UserID
        `)
        if (balQuery.recordset[0].Balance < 0) {
            await transaction.rollback();
            return {
                message: "INSUFFICIENT BALANCE"
            };
        }

        // deduct parts from inventory (SQL -Profiles +Inventory_PARTS)
        let partsQuery = await request.query(`
            UPDATE Inventory_PARTS SET Gears = Gears - @gearsCost, MetalSheets = MetalSheets - @sheetsCost, Bolts = Bolts - @boltsCost WHERE UserID = @UserID
            SELECT Gears, MetalSheets, Bolts FROM Inventory_PARTS WHERE UserID = @UserID
        `)
        if (partsQuery.recordset[0].Gears < 0 || partsQuery.recordset[0].MetalSheets < 0 || partsQuery.recordset[0].Bolts < 0) {
            await transaction.rollback();
            return {
                message: "INSUFFICIENT PARTS"
            };
        }
        await transaction.commit()
        return {
            message: "SUCCESS"
        }
    } catch (error) {
        console.log(error);
        if (transaction) await transaction.rollback()
        return {
            message: 'UNCAUGHT ERROR IN /buyMachine endpoint'
        };
    }
}
