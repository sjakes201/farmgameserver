const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { poolPromise } = require('../../db');

const sanitize = (user, pass) => {
    if (!user || user.length < 4 || user.length > 24 || !USER_REGEX.test(user)) {
        return false;
    }
    if (!pass || pass.length < 4 || pass.length > 32 || !PASS_REGEX.test(pass)) {
        return false;
    }
    return true;
}


const USER_REGEX = /^[a-zA-Z0-9_.]+$/
const PASS_REGEX = /^[a-zA-Z0-9!@#$%^&*._?-]+$/


module.exports = async function (ws, actionData) {
    let user = actionData.Username;
    let pass = actionData.Password;

    if (!sanitize(user, pass)) {
        return {
            status: 400,
            message: "INVALID PASSWORD"
        };
    }

    let connection;

    try {
        // RETRIEVE ASSOCIATED LOGIN DETAILS

        connection = await poolPromise;
        const request = new sql.Request(connection);

        request.input('user', sql.NVarChar, user);

        let result = await request.query(`SELECT UserID, Password from Logins WHERE Username = @user`);
        let stored_pass = result && result.recordset.length === 1 ? result.recordset[0].Password : null;
        if (!result) {
            return {
                status: 503,
                message: "ACCOUNT DOES NOT EXIST"
            };
        }
        if (!stored_pass) {
            return {
                status: 401,
                message: "ACCOUNT DOES NOT EXIST"
            };
        }
        const passwordMatch = await bcrypt.compare(pass, stored_pass);
        if (!passwordMatch) {
            return {
                status: 401,
                message: "WRONG PASSWORD"
            };
        }

        let stored_ID = result && result.recordset.length === 1 ? result.recordset[0].UserID : -1;
        if (stored_ID < 0) {
            return  {
                status: 403,
                message: "UserID ERROR"
            };
        }

        // CREATE USER AUTH TOKEN AND SET ENCODED IN HEADER
        const token = jwt.sign({ UserID: stored_ID }, process.env.JWT_KEY, { expiresIn: '90d' });
        return  {
            status: 200,
            auth: true,
            token: token,
            message: 'SUCCESS',
        }

    } catch (error) {
        console.log(error);
        return {
            status: 500,
            message: "ERROR"
        };
    } 
}





