const axios = require('axios');
const qs = require("qs")

module.exports = async function (ws, actionData) {
    // const UserID = ws.UserID;
    // const code = actionData.code;
    let code = '9JhnNsVoFosxvvKeJVJhSVjfrnCKFv';

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', null, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            params: {
                client_id: '1143367795682320434',
                client_secret: '320UL9hiVu6WpjR3QwaVfhhdpn1KZhW5',
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'http://localhost:3000/account',
                scope: 'identify'
            }
        });

        const accessToken = tokenResponse.data.access_token;

        // Use the access token to get user's Discord ID
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log(userResponse.data.id)

    } catch (error) {
        console.log(error)
    }


    return {
        message: "reached bottom"
    }
}
