const sql = require('mssql');
const sgMail = require('@sendgrid/mail')
const { poolPromise } = require('../../db');

function generateResetCode() {
    let resetCode = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < 10; i++) {
        resetCode += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return resetCode;
}

module.exports = async function (ws, actionData) {

    const email = actionData?.email;

    if (!email.includes('@') || !email.includes('.') || email.includes(' ')) {
        return {
            message: "INVALID EMAIL"
        };
    }

    let connection;
    try {
        connection = await poolPromise;
        const request = new sql.Request(connection);

        const resetCode = generateResetCode();
        // Now + 15 minutes (in ms)
        let codeExpire = Date.now() + 900000;

        request.input('email', sql.VarChar, email);
        request.input('resetCode', sql.VarChar, resetCode)
        request.input('codeExpire', sql.Decimal, codeExpire)

        let result = await request.query(`UPDATE Logins SET ResetCode = @resetCode, CodeExpire = @codeExpire WHERE Email = @email`)

        if (result.rowsAffected[0] === 0) {
            throw "EMAIL NOT ASSOCIATED WITH AN ACCOUNT"
        } else {
            let resetLinkWithParams = `https://mango-ground-0a52e740f.3.azurestaticapps.net/passwordReset?email=${email}&code=${resetCode}`
            sgMail.setApiKey(process.env.SENDGRID_API_KEY)
            const msg = {
                to: email,
                from: 'livefarmgame.service@gmail.com',
                subject: 'Farmgame password reset',
                text: `Hello,\nRequested password reset link: \n${resetLinkWithParams}\nIf you did not request a password reset, you can safely ignore this email.`,
                html: `Hello,<br>Requested password reset link:<br>${resetLinkWithParams}<br>If you did not request a password reset, you can safely ignore this email.`,
            };

            sgMail
                .send(msg)
                .then(() => {
                    console.log('Email sent')
                })
                .catch((error) => {
                    console.error(error)
                })
        }
    } catch (error) {
        console.log(error);
    } finally {
        return {
            message: 'Sent email if account associated with email exists'
        }
    }


}






