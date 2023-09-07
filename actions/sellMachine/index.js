const MACHINESINFO = require('../shared/MACHINESINFO');
const sql = require('mssql');
const { poolPromise } = require('../../db'); 


module.exports = async function (ws, actionData) {

    // Get and check params
    let slot = actionData.slot;

    if (!([1, 2, 3, 4, 5, 6].includes(slot))) {;
        return {
            message: 'invalid machine slot number'
        };
    }

    const UserID = ws.UserID;



    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);

        // Select what was there, then set to defaults (SQL +Machines)

        let currentMachineQuery = await request.query(`
        SELECT Slot${slot}, Slot${slot}Level FROM Machines WHERE UserID = @UserID
        UPDATE Machines SET Slot${slot} = -1, Slot${slot}Level = 0, Slot${slot}StartTime = -1, Slot${slot}ProduceReceived = 0 WHERE UserID = @UserID
        `)
        // if was already nothing, return no machine present
        if (currentMachineQuery.recordset[0][`Slot${slot}`] === -1) {
            // there was nothing there
            await transaction.rollback();
            return {
                message: `No machine at slot ${slot}`
            };
        }
        // calculate refund
        let previousMachineLevel = currentMachineQuery.recordset[0][`Slot${slot}Level`];
        let refund = MACHINESINFO.sellRefunds[`tier${previousMachineLevel}`];

        // give parts to inventory parts (SQL -Machines +Inventory_PARTS)
        request.input('gearsRefund', sql.Int, refund.Gears)
        request.input('sheetsRefund', sql.Int, refund.MetalSheets)
        request.input('boltsRefund', sql.Int, refund.Bolts)
        let refundQuery = await request.query(`
        UPDATE Inventory_PARTS SET 
        Gears = Gears + @gearsRefund, MetalSheets = MetalSheets + @sheetsRefund, Bolts = Bolts + @boltsRefund
        WHERE UserID = @UserID
        `)
        if (refundQuery.rowsAffected[0] === 0) {
            await transaction.rollback();
            return {
                message: "ERROR updating Inventory_PARTS for parts refund"
            };
        }

        await transaction.commit()
        return {
            message: 'success'
        };
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return {
            message: 'UNCAUGHT ERROR IN /sellMachine endpoint'
        }
    } 
}





