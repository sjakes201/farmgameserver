const sql = require('mssql');
const bcrypt = require('bcryptjs');
const CONSTANTS = require('../shared/CONSTANTS');


const PASS_REGEX = /^[a-zA-Z0-9!@#$%^&*._?-]+$/
const BCRYPT_ROUNDS = CONSTANTS.VALUES.BCRYPT_ROUNDS;

module.exports = async function (ws, actionData) {
    const email = actionData?.email;
    const code = actionData?.code;
    const newPass = actionData?.newPass;

    console.log(email, code, newPass)

    let encrypted_pass = await bcrypt.hash(newPass, BCRYPT_ROUNDS);


    if (!newPass || newPass.length < 4 || newPass.length > 32 || !PASS_REGEX.test(newPass)) {
        return {
            message: "INVALID PASSWORD FORMAT"
        };
    }

    if (typeof code !== 'string' || code.length !== 10) {
        return {
            message: "INVALID RESET CODE"
        };
    }

    let connection;
    try {
        connection = await poolPromise;
        let request = new sql.Request(connection);

        request.input('email', sql.VarChar, email);
        request.input('code', sql.VarChar, code);
        request.input('encryptedPass', sql.VarChar, encrypted_pass);

        let expireQuery = await request.query('SELECT CodeExpire FROM Logins WHERE Email = @email');

        if (expireQuery.recordset.length === 0) {
            console.log("NO EMAIL");
            return {
                message: "EMAIL NOT ASSOCIATED WITH ACCOUNT OR BAD CODE"
            };
        }

        let codeExpire = expireQuery.recordset[0].CodeExpire;

        if (Date.now() > codeExpire) {
            // past expiry time
            console.log("CODE EXPIRED")
            return {
                message: "EMAIL NOT ASSOCIATED WITH ACCOUNT OR BAD CODE"
            };
        }
        let correctCode = await request.query(`SELECT ResetCode FROM Logins WHERE Email = @email`);
        console.log(correctCode)
        if (correctCode.recordset[0].ResetCode !== code) {
            console.log("WRONG CODE");
            return {
                message: "EMAIL NOT ASSOCIATED WITH ACCOUNT OR BAD CODE"
            };
        } else {
            let resetPass = await request.query(`UPDATE Logins SET Password = @encryptedPass, ResetCode = null, CodeExpire = null WHERE Email = @email`)
            if(resetPass.rowsAffected[0] === 0) {
                return {
                    message: "ERROR CHANGING PASSWORD"
                };
            } else {
                return {
                    message: "SUCCESS"
                }
            }
        }

    } catch (error) {
        console.log(error);
        return {
            message: "resetPassword error"
        };
    } 
}





