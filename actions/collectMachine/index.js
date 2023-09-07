const MACHINESINFO = require('../shared/MACHINESINFO');
const sql = require('mssql');
const { poolPromise } = require('../../db'); 


module.exports = async function (ws, actionData) {
    
    const UserID = ws.UserID;


    // slot should be int [1,6]
    let slot = actionData.slot;
    if (!([1, 2, 3, 4, 5, 6].includes(slot))) {
        return {
            message: 'invalid machine slot number'
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

        // Get all data to check, update starttime to -1 (SQL +Machines)
        let slotQuery = await request.query(`
            SELECT Slot${slot}, Slot${slot}Level, Slot${slot}StartTime, Slot${slot}ProduceReceived FROM Machines WHERE UserID = @UserID
            UPDATE Machines SET Slot${slot}StartTime = -1, Slot${slot}ProduceReceived = 0 WHERE UserID = @UserID
        `)
        if (![0, 1, 2].includes(slotQuery.recordset[0][`Slot${slot}`])) {
            await transaction.rollback();
            return {
                message: `No machine built at slot ${slot}`
            };
        }
        let slotType = MACHINESINFO.machineTypeFromIDS[slotQuery.recordset[0][`Slot${slot}`]]; //'cheese' 'cloth' 'mayonnaise'
        let startTime = slotQuery.recordset[0][`Slot${slot}StartTime`];
        let slotLevel = slotQuery.recordset[0][`Slot${slot}Level`];
        let numProcessed = slotQuery.recordset[0][`Slot${slot}ProduceReceived`];
        if (startTime === -1) {
            await transaction.rollback();
            return {
                message: `Nothing being processed at machine ${slot}`
            };
        }
        // Check time was done (and was not NULL) and that ProduceRecieved was not 0
        let timeNeededMS = MACHINESINFO[`${slotType}MachineInfo`][`tier${slotLevel}`].timeInMs;
        let timePassedMS = Date.now() - startTime;
        if (timePassedMS > timeNeededMS) {
            // Randomize quality based on level and quantity via MACHINESINFO probabilities
            // the first number that our random gen is LESS than is quality. [q3, q2, q1, q0] explanation in MACHINESINFO
            let probabilityArray = MACHINESINFO[`${slotType}MachineInfo`][`tier${slotLevel}`].probabilities;

            // [q3, q2, q1, q0] counts in this array as well
            let numPerQuality = [0, 0, 0, 0]
            for (let j = 0; j < numProcessed; ++j) {
                //once per item processed
                let randDecimal = Math.random();
                let quality = -1;
                for (let i = probabilityArray.length - 1; i >= 0; --i) {
                    if (randDecimal < probabilityArray[probabilityArray.length - 1 - i]) {
                        quality = i;
                        // just in case config wrong
                        quality = quality === -1 ? 0 : quality;
                        numPerQuality[numPerQuality.length - 1 - i] += 1;
                        break;
                    }
                }
            }

            // Increment (SQl -Machines +Inventory_ARTISAN) 
            // build query
            request.input('q0Increase', sql.Int, numPerQuality[3])
            request.input('q1Increase', sql.Int, numPerQuality[2])
            request.input('q2Increase', sql.Int, numPerQuality[1])
            request.input('q3Increase', sql.Int, numPerQuality[0])
            let invQuery = await request.query(`
                UPDATE Inventory_ARTISAN SET
                ${slotType}Q0 = ${slotType}Q0 + @q0Increase, ${slotType}Q1 = ${slotType}Q1 + @q1Increase, ${slotType}Q2 = ${slotType}Q2 + @q2Increase, ${slotType}Q3 = ${slotType}Q3 + @q3Increase
                WHERE UserID = @UserID
                `)

            if(invQuery.rowsAffected.length === 0) {
                await transaction.rollback();
                return {
                    message: "ERROR updating artisan goods count"
                };
            }
            await transaction.commit()
            return {
                message: "SUCCESS",
                [`${slotType}Q0`]: numPerQuality[3],
                [`${slotType}Q1`]: numPerQuality[2],
                [`${slotType}Q2`]: numPerQuality[1],
                [`${slotType}Q3`]: numPerQuality[0],
            };
        } else {
            await transaction.rollback();
            return {
                message: "Not finished"
            };
        }
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return  {
            message: 'UNCAUGHT ERROR IN /useMachine endpoint'
        }
    } 
}





