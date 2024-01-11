const sql = require('mssql');
const { poolPromise } = require('../../db'); 

module.exports = async function (UserID, invalidActionType) {
    try {
        let connection = await poolPromise;
        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID)
        const result = await request.query(`
            MERGE INTO InvalidActions AS Target
            USING (SELECT @UserID AS UserID) AS Source
            ON Target.UserID = Source.UserID
            WHEN MATCHED THEN 
                UPDATE SET Target.${invalidActionType} = ISNULL(Target.${invalidActionType}, 0) + 1
            WHEN NOT MATCHED THEN 
                INSERT (UserID, ${invalidActionType})
                VALUES (@UserID, 1);
        `)
    } catch (error) {
        console.log(error)
    }

}