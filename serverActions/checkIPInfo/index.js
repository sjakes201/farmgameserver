const sql = require('mssql');
const { poolPromise } = require('../../db'); 

module.exports = async function (IP) {
    try {
        let connection = await poolPromise;
        let request = new sql.Request(connection);
        request.input('IP', sql.NVarChar(256), IP)
        const result = await request.query(`
            SELECT COUNT(*) AS count FROM BannedIPs fo WHERE IPAddress = @IP
        `)
        return result.recordset[0].count > 0
    } catch (error) {
        console.log(error)
        return false;
    }

}