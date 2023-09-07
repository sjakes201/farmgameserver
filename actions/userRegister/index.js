const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CONSTANTS = require('../shared/CONSTANTS');
const { poolPromise } = require('../../db');


// helper functions

const USER_REGEX = /^[a-zA-Z0-9_.]+$/
const PASS_REGEX = /^[a-zA-Z0-9!@#$%^&*._?-]+$/
const BCRYPT_ROUNDS = CONSTANTS.VALUES.BCRYPT_ROUNDS;

const sanitize = (user, pass) => {
    if (!user || user.length < 4 || user.length > 24 || !USER_REGEX.test(user)) {
        return false;
    }
    if (!pass || pass.length < 4 || pass.length > 32 || !PASS_REGEX.test(pass)) {
        return false;
    }
    return true;
}

module.exports = async function (ws, actionData) {

    // Check for guest account to claim
    const UserID = ws.UserID;


    // Receive and check inputs
    let user = actionData.Username;
    let pass = actionData.Password;
    let email = actionData.Email;

    if (!sanitize(user, pass)) {
        return {
            status: 400,
            message: "CREDENTIALS DO NOT SATISFY FORMAT"
        };
    }

    // Encrypt password
    let encrypted_pass = await bcrypt.hash(pass, BCRYPT_ROUNDS);

    let connection;
    let transaction;
    try {
        // Establish sql connection
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);

        request.input('username', sql.NVarChar, user);
        request.input('encryptedPass', sql.NVarChar, encrypted_pass);
        request.input('UserID', sql.Int, UserID);
        request.input('email', sql.VarChar, email)

        // Check for valid guest account
        let checkGuest = await request.query(`
            SELECT isGuest FROM Logins WHERE UserID = @UserID
        `)
        if (!(checkGuest.recordset[0].isGuest == 1)) {
            await transaction.rollback();
            return {
                status: 400,
                message: "ACCOUNT NOT GUEST ACCOUNT, ALREADY CLAIMED"
            };
        }

        // Claim account

        try {
            await request.query(`
                UPDATE Logins
                SET Username = @username, Password = @encryptedPass, isGuest = 0, Email = ${email === '' ? 'NULL' : '@email'}
                WHERE UserID = @UserID
            `);
        } catch (err) {
            console.log(err);
            if (err.originalError && err.originalError.info && err.originalError.info.number === 2601) {
                await transaction.rollback();
                return {
                    status: 409,
                    message: "EMAIL ALREADY ASSOCIATED WITH ACCOUNT"
                };
            } else {
                await transaction.rollback();
                return {
                    status: 409,
                    message: "Not unique Username"
                };
            }
        }
        await request.query(`
            UPDATE TempLeaderboard
            SET Username = @username
            WHERE UserID = @UserID
        `)
        await request.query(`
            UPDATE Leaderboard
            SET Username = @username
            WHERE UserID = @UserID
        `)
        await transaction.commit();
        //Refresh auth token
        const token = jwt.sign({ UserID: UserID }, process.env.JWT_KEY, { expiresIn: "720h" });
        return {
            status: 200,
            auth: true,
            token: token,
            message: 'SUCCESS',
        }
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
        if (error.number == 2601 || error.number == 2627) {
            // not unique username
            return {
                status: 409,
                message: "NOT UNIQUE USERNAME"
            }
        }
        else {
            return {
                status: 500,
                message: "UNCAUGHT ERROR"
            }
        }
    }
}





