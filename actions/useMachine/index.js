const MACHINESINFO = require('../shared/MACHINESINFO');
const sql = require('mssql');
const { poolPromise } = require('../../db'); 


module.exports = async function (ws, actionData) {
    // Get and check inputs

    // slot should be int [1,6]
    let slot = actionData.slot;

    // machineType should be 'cheese' 'cloth' or 'mayonnaise'
    let machineType = actionData.machineType;

    if(!Object.keys(MACHINESINFO.machineTypeIDS).includes(machineType)) {
        return {
            message: `Invalid machine type '${machineType}'`
        };
    }
    /* ingredients should be object with properties for items and counts for values, ex:
    ingredients = {
        chicken_egg: 5,
        ostrich_egg: 1,
    }
    */
    let ingredients = actionData.ingredients;




    const UserID = ws.UserID;

    // check slot is valid num
    if (!([1, 2, 3, 4, 5, 6].includes(slot))) {
        return {
            message: 'invalid machine slot number'
        };
    }
    // sum ingredients and create inventory deduction query
    let deductQuery = `UPDATE Inventory_PRODUCE SET `
    let checkQuery = `SELECT `

    let sum = 0;
    let allIngredients = Object.keys(ingredients);
    if (allIngredients.length === 0) {
        return {
            message: "No ingredients submited"
        };
    }
    for (let i = 0; i < allIngredients.length; ++i) {
        if (MACHINESINFO[`${machineType}MachineInfo`].validInputs.includes(allIngredients[i])) {
            if(ingredients[allIngredients[i]] < 0) {
                return {
                    message: `Must submit nonnegative ingredient counts, submitted ${ingredients[allIngredients[i]]} ${allIngredients[i]}`
                };
            }
            sum += ingredients[allIngredients[i]];
            deductQuery += `${allIngredients[i]} = ${allIngredients[i]} - ${ingredients[allIngredients[i]]}, `
            checkQuery += `${allIngredients[i]}, `
        } else {
            return {
                message: "Invalid input for machine type"
            };
        }
    }
    // remove ,
    deductQuery = deductQuery.substring(0, deductQuery.length - 2)
    checkQuery = checkQuery.substring(0, checkQuery.length - 2)

    deductQuery += ` WHERE UserID = @UserID`
    checkQuery += ` FROM Inventory_PRODUCE WHERE UserID = @UserID`

    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('UserID', sql.Int, UserID);
        request.input('sum', sql.Int, sum);

        // Check that machine exists and is available, set new data (SQL +Machines)
        let curMachine = await request.query(`
            SELECT 
            Slot${slot}, Slot${slot}Level, Slot${slot}StartTime 
            FROM Machines WHERE UserID = @UserID

            UPDATE Machines SET 
            Slot${slot}StartTime = ${Date.now()}, Slot${slot}ProduceReceived = @sum 
            WHERE UserID = @UserID
        `)
        // check capacity was valid, slot is right type, StartTime was -1
        if(![0,1,2].includes(curMachine.recordset[0][`Slot${slot}`])) {
            await transaction.rollback()
            return {
                message: `No machine built at slot ${slot}`
            };
        }
        let correctMachineID = MACHINESINFO.machineTypeIDS[machineType], realMachineID = curMachine.recordset[0][`Slot${slot}`]
        let correctCapacity = MACHINESINFO[`${machineType}MachineInfo`][`tier${curMachine.recordset[0][`Slot${slot}Level`]}`].capacity;
        if (sum > correctCapacity) {
            await transaction.rollback();
            return {
                message: `CAPACITY ERROR: ${sum} ingredients attempted, ${correctCapacity} capacity for machine level`
            };
        }
        if (correctMachineID !== realMachineID) {
            await transaction.rollback();
            return{
                message: "INVALID produce for machine type"
            };
        }
        if(curMachine.recordset[0][`Slot${slot}StartTime`] !== -1) {;
            await transaction.rollback();
            return {
                message: `Machine ${slot} not free`
            } ;
        }
        // Take produce from inventory (SQL -Machines +Inventory_PRODUCE)
        let updateInvQuery = await request.query(`
        ${deductQuery}
        ${checkQuery}
        `)
        let allItems = Object.keys(updateInvQuery.recordset[0])
        for(let i = 0; i < allItems.length; ++i) {
            if(updateInvQuery.recordset[0][allItems[i]] < 0) {
                await transaction.rollback();
                return {
                    message: "INSUFFICIENT produce"
                };
            }
        }

        await transaction.commit()
        return {
            message: 'SUCCESS'
        }
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        return {
            message: 'UNCAUGHT ERROR IN /useMachine endpoint'
        }
    }

}





