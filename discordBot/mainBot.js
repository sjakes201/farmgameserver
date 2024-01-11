process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
    // Handle the rejection or just log it.
});


const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, // For reading messages
        GatewayIntentBits.MessageContent // To access message content
    ]
});

const BOT_TOKEN = 'MTE0MzM2Nzc5NTY4MjMyMDQzNA.GAgjGJ.5yo4XsnHyoyO7FGYhoIR4OHiuGvaRlqDdyExSY'
const SERVER_ID = '1141813454244687882';

const { poolPromise } = require('../db');
const { pokeUser } = require('./discordPoke')
const sql = require('mssql');



const CATEGORIES_ALLTIME = [
    ['TOP 3 GOLD ALLTIME', 'Balance'],
    ['TOP 3 XP ALLTIME', 'XP'],
    ['TOP 3 CARROT ALLTIME', 'carrot'],
    ['TOP 3 MELON ALLTIME', 'melon'],
    ['TOP 3 CAULIFLOWER ALLTIME', 'cauliflower'],
    ['TOP 3 PUMPKIN ALLTIME', 'pumpkin'],
    ['TOP 3 YAM ALLTIME', 'yam'],
    ['TOP 3 BEET ALLTIME', 'beet'],
    ['TOP 3 PARSNIP ALLTIME', 'parsnip'],
    ['TOP 3 BAMBOO ALLTIME', 'bamboo'],
    ['TOP 3 HOPS ALLTIME', 'hops'],
    ['TOP 3 CORN ALLTIME', 'corn'],
    ['TOP 3 POTATO ALLTIME', 'potato'],
    ['TOP 3 BLUEBERRY ALLTIME', 'blueberry'],
    ['TOP 3 GRAPE ALLTIME', 'grape'],
    ['TOP 3 OATS ALLTIME', 'oats'],
    ['TOP 3 STRAWBERRY ALLTIME', 'strawberry'],
    ['TOP 3 COW MILK ALLTIME', 'cow_milk'],
    ['TOP 3 CHICKEN EGG ALLTIME', 'chicken_egg'],
    ['TOP 3 DUCK EGG ALLTIME', 'duck_egg'],
    ['TOP 3 QUAIL EGG ALLTIME', 'quail_egg'],
    ['TOP 3 YAK MILK ALLTIME', 'yak_milk'],
    ['TOP 3 SHEEP WOOL ALLTIME', 'sheep_wool'],
    ['TOP 3 GOAT MILK ALLTIME', 'goat_milk'],
    ['TOP 3 OSTRICH EGG ALLTIME', 'ostrich_egg']]

const CATEGORIES_WEEKLY = [
    ['TOP 3 CARROT WEEKLY', 'carrot'],
    ['TOP 3 MELON WEEKLY', 'melon'],
    ['TOP 3 CAULIFLOWER WEEKLY', 'cauliflower'],
    ['TOP 3 PUMPKIN WEEKLY', 'pumpkin'],
    ['TOP 3 YAM WEEKLY', 'yam'],
    ['TOP 3 BEET WEEKLY', 'beet'],
    ['TOP 3 PARSNIP WEEKLY', 'parsnip'],
    ['TOP 3 BAMBOO WEEKLY', 'bamboo'],
    ['TOP 3 HOPS WEEKLY', 'hops'],
    ['TOP 3 CORN WEEKLY', 'corn'],
    ['TOP 3 POTATO WEEKLY', 'potato'],
    ['TOP 3 BLUEBERRY WEEKLY', 'blueberry'],
    ['TOP 3 GRAPE WEEKLY', 'grape'],
    ['TOP 3 OATS WEEKLY', 'oats'],
    ['TOP 3 STRAWBERRY WEEKLY', 'strawberry'],
    ['TOP 3 COW MILK WEEKLY', 'cow_milk'],
    ['TOP 3 CHICKEN EGG WEEKLY', 'chicken_egg'],
    ['TOP 3 DUCK EGG WEEKLY', 'duck_egg'],
    ['TOP 3 QUAIL EGG WEEKLY', 'quail_egg'],
    ['TOP 3 YAK MILK WEEKLY', 'yak_milk'],
    ['TOP 3 SHEEP WOOL WEEKLY', 'sheep_wool'],
    ['TOP 3 GOAT MILK WEEKLY', 'goat_milk'],
    ['TOP 3 OSTRICH EGG WEEKLY', 'ostrich_egg']]


client.once('ready', () => {
    console.log('Bot online!')
    if (process.env.NODE_ENV !== "TESTING") {
        assignWeeklyLeaderboardRoles();
        assignFarmerRoleToLinkedUsers();
        assignAllTimeLeaderboardRoles();
        setInterval(() => {
            assignWeeklyLeaderboardRoles();
            assignAllTimeLeaderboardRoles();
            assignFarmerRoleToLinkedUsers();
        }, 3600000)
    }
})

function getDirectImageLink(fileName) {
    switch (fileName) {
        case "animal_lover":
            return "https://drive.google.com/uc?id=1AN_gRilYzqCDRIfGdGZGmba6V1OGKf-m";
        case "baseball_player":
            return "https://drive.google.com/uc?id=1l0cfroCm63GoyLkevWtoe5M7a3cuvhb1";
        case "beach_guy":
            return "https://drive.google.com/uc?id=17SfRYF3zy0qAqDcNFp3JS7gG5h-dZWIr";
        case "blue_scythe":
            return "https://drive.google.com/uc?id=1O5GkTijrTnNR6NWrvqlfzIh8cCiSqJbJ";
        case "chef":
            return "https://drive.google.com/uc?id=1o_4GM1hVxPu1ZsCEA2E9hHZfnphu2A_z";
        case "chicken_emperor":
            return "https://drive.google.com/uc?id=1SgJqoZo8bofrN1E4Fs0TyuK-6KKuvtiI";
        case "chicken_friend":
            return "https://drive.google.com/uc?id=1h7GwWMJ4IfVL7gIpdWuyAzq8gqU_NnNV";
        case "cool_guy":
            return "https://drive.google.com/uc?id=14JERegch627J7Ub1mTsjuvQuhEImMMIw";
        case "cowboy":
            return "https://drive.google.com/uc?id=1B7aTTW3FOBQBrj57XLvzqO3mIjfZe3lP";
        case "cow_friend":
            return "https://drive.google.com/uc?id=1lk5TDgFMS2xafFGBxA-t5r04Va_4KmwI";
        case "deluxe_owner":
            return "https://drive.google.com/uc?id=1Jqe6SoaGTUFm78bd8ltO-i7OYA19cvSu";
        case "did_poke":
            return "https://drive.google.com/uc?id=1PraOsSqf-oWMan-iGzDYkWVmbuEV35L9";
        case "doctor_stethoscope":
            return "https://drive.google.com/uc?id=1pg_CtWEfrmueS8SXICtM9sVxejJ8Fqvt";
        case "dragon_man":
            return "https://drive.google.com/uc?id=1bRTV-4Hg_m4A9Z_oA7Nxcdadc-18W8No";
        case "exotic_owner":
            return "https://drive.google.com/uc?id=1U8E3Lf5tBnbr7LsYjQpFI54kYx8Evkgq";
        case "famous_minutes":
            return "https://drive.google.com/uc?id=1t5LdpCeFMJaCCZhcO4UHgUzBQcaqlAkO";
        case "farmer_hoe":
            return "https://drive.google.com/uc?id=1bsl8KS2mohs8Ecb4b1_ir7gVOeyTAs8z";
        case "fighter_blue":
            return "https://drive.google.com/uc?id=1R6Na9S_N-o-GWVw7T_xJ-24___gBDDL7";
        case "fighter_purple":
            return "https://drive.google.com/uc?id=17TY5Rawoqb_mfdSYFy9DVENnmp0wT1J7";
        case "fighter_red":
            return "https://drive.google.com/uc?id=15hIaF42GdJ_5XWrYH_XNsoSHkGGI4sb9";
        case "football_player":
            return "https://drive.google.com/uc?id=1B8UwpYxN9o2EEMLYjUByXibgvc9jiAin";
        case "grape_lord":
            return "https://drive.google.com/uc?id=1IJexMa8bmDFuapQLSRjjU-JTwluOVD4u";
        case "grateful_farmer":
            return "https://drive.google.com/uc?id=1vaBHfb1mNqiUy3op-ppTT_8Em2EzY7-c";
        case "hacker_guy":
            return "https://drive.google.com/uc?id=1vMwgSDiYBVPkAta0BbPChv7cn_kFheoQ";
        case "helmet_warrior":
            return "https://drive.google.com/uc?id=1FAjqykcQorkZimak-jhV9ZTtbqlTQqtN";
        case "hold_corn":
            return "https://drive.google.com/uc?id=1YOTN1qkDdt-SbG6Wis41TwmaEGLHU2NH";
        case "hold_heart":
            return "https://drive.google.com/uc?id=1c3zMfP1pGAByXHRq5WVHEV1xEEejTaqP";
        case "hold_pitchfork":
            return "https://drive.google.com/uc?id=1HDJcahkS9IN03MrHfGouTWOUKPxaU3oz";
        case "king":
            return "https://drive.google.com/uc?id=1m3jixdm-EoPJtq_p8v7GfRGEIB8cY0h7";
        case "link_discord":
            return "https://drive.google.com/uc?id=1ntG1eSvGSPIdf-1rWLYthFxArhlO98NA";
        case "machine_hammer":
            return "https://drive.google.com/uc?id=1SuOOHApcw7tBIR7tqtt1o7quxZ02NR9n";
        case "market_analyst":
            return "https://drive.google.com/uc?id=1YlZdrwbB5ZPsQHKvddtdZtahskTOd9v0";
        case "ninja":
            return "https://drive.google.com/uc?id=1PVXo_3cU5eRsX1LTPO6J2uyLtBIYV7Re";
        case "reg_blue":
            return "https://drive.google.com/uc?id=1SmZplbeTprY7ofm1-6-D-Rs6LCYtHbXK";
        case "reg_green":
            return "https://drive.google.com/uc?id=18US0_GxEJnP8EITBh5ice558MRk57LVi";
        case "reg_maroon":
            return "https://drive.google.com/uc?id=17ceAAwGE-P_OdLtDafZjw2v0EhdgnGvu";
        case "reg_purple":
            return "https://drive.google.com/uc?id=1Fgpq71zolYXkL68b50X7t0NEk-lnh-kq";
        case "rich_1":
            return "https://drive.google.com/uc?id=1wgbJ16KxD8b-Lj2BovcC1GmmZb3wASAm";
        case "rich_2":
            return "https://drive.google.com/uc?id=17aPXcD23_z02cluxhN11eB576pWtFN3Y";
        case "sleepy_bro":
            return "https://drive.google.com/uc?id=16_7SMX11La0vpNuhF-kG6FmGffZg1mdd";
        case "soccer_player":
            return "https://drive.google.com/uc?id=1dJebnsqwhXj2f5AF2iu_kjY5NYT8rcWj";
        case "spanish_dueler":
            return "https://drive.google.com/uc?id=1IJexMa8bmDFuapQLSRjjU-JTwluOVD4u";
        case "visor_robot":
            return "https://drive.google.com/uc?id=1vaBHfb1mNqiUy3op-ppTT_8Em2EzY7-c";
        case "wizard":
            return "https://drive.google.com/uc?id=1vMwgSDiYBVPkAta0BbPChv7cn_kFheoQ";
        case "zeus":
            return "https://drive.google.com/uc?id=1FAjqykcQorkZimak-jhV9ZTtbqlTQqtN";
        default:
            return "https://drive.google.com/uc?id=17ceAAwGE-P_OdLtDafZjw2v0EhdgnGvu"; // default to homie
    }
}


async function randomPoke() {
    try {
        const connection = await poolPromise;
        let res = await connection.query(`
            SELECT TOP 1 UserID FROM Logins WHERE isGuest = 0 ORDER BY NEWID();
        `)
        let UserID = res.recordset[0].UserID;
        if (!UserID) return false;
        let request = new sql.Request(connection);
        request.input('UserID', sql.Int, UserID);
        let pokeRes = await request.query(`
            UPDATE Profiles SET receivedPokes = receivedPokes + 1 WHERE UserID = @UserID;
            SELECT Username FROM Logins WHERE UserID = @UserID
        `)
        let chosenUser = pokeRes.recordset[0].Username;
        return chosenUser;
    } catch (error) {
        console.log(error)
        return false;
    }
}

async function randomFeed() {
    try {
        const connection = await poolPromise;
        let res = await connection.query(`
            SELECT TOP 1 A.Animal_ID, L.Username, L.UserID
            FROM Animals A
            LEFT JOIN Logins L ON A.UserID = L.UserID
            WHERE L.isGuest = 0 
            ORDER BY NEWID();
        `)
        let animalID = res.recordset[0].Animal_ID;
        let username = res.recordset[0].Username;
        let UserID = res.recordset[0].UserID;

        let request = new sql.Request(connection);
        request.input('animalID', sql.Int, animalID);
        request.input('UserID', sql.Int, UserID);

        let feedRes = await request.query(`
            UPDATE Animals 
            SET 
                Happiness = Happiness + 0.05
            WHERE Animal_ID = @animalID AND UserID = @UserID

            SELECT
                Happiness, Animal_type
            FROM Animals
            WHERE Animal_ID = @animalID AND UserID = @UserID
        `)
        return {
            Animal_type: feedRes.recordset[0].Animal_type,
            newHappiness: feedRes.recordset[0].Happiness,
            targetUsername: username
        }
    } catch (error) {
        console.log(error)
        return false;
    }

}

client.on('messageCreate', async (message) => {
    try {
        // Check if the message is from a bot (to prevent infinite loops or reactions to other bots)
        if (message.author.bot) return;

        let msgText = message.content.toLowerCase();
        let msgSenderID = message.author.id;

        // bot command channel
        if (message.channel.id === '1162264754954448906') {
        }

        // Example: Reply when someone says "hello bot"
        if (msgText === 'hello bot') {
            message.reply('Hello!');
        }

        // '!' is for bot command
        if (msgText.includes('!')) {
            if (msgText.includes('poke') && !(msgText.includes('randompoke')) && msgText.split(" ")) {
                let targetUsername = msgText.split(" ")[1];
                let pokeResult = await pokeUser(msgSenderID, targetUsername);
                message.reply(pokeResult.message)
            }

            if (msgText.includes("profile")) {
                let targetUsername = msgText.split(" ")[1];
                let profileResult = await getProfileData(targetUsername);
                if (!profileResult) {
                    message.reply(`Profile for ${targetUsername} not found. Use their in-game name.`)
                    return;
                }
                const profileEmbed = new EmbedBuilder()
                    .setColor('#0099ff') // Set the color of the embed
                    .setTitle(`${profileResult.Username}'s Profile`) // Set the title of the embed
                    .setDescription(`[View on Farm Game](https://farmgame.live/profile/${profileResult.Username})`)
                    .setThumbnail(getDirectImageLink(profileResult.profilePic))
                    .addFields(
                        { name: 'Town', value: profileResult.townName || 'None', inline: true },
                        { name: 'Balance', value: `$${profileResult.Balance.toLocaleString()}`, inline: true },
                        { name: 'XP', value: profileResult.XP.toLocaleString(), inline: true },
                        { name: 'Received Pokes', value: profileResult.receivedPokes.toString(), inline: true },
                        { name: 'Total Contributed Town XP', value: profileResult.totalContributedTownXP.toLocaleString(), inline: true }
                    )
                    .setTimestamp()

                // Send the embed to the same channel as the message
                message.channel.send({ embeds: [profileEmbed] });
            }

            if (msgText.includes("randompoke")) {
                let poked = await randomPoke();
                if (!poked) {
                    message.reply('Error :(');
                    return;
                }
                message.reply(`
                    Poked ${poked}!
                `)
            }

            if (msgText.includes("randomfeed")) {
                let fed = await randomFeed();
                if(fed) {
                    message.reply(`Fed ${fed.targetUsername}'s ${fed.Animal_type}! Happiness is now ${fed.newHappiness.toFixed(2) * 100}%`)
                }
            }
        }

    } catch (error) {
        console.log(error)
    }
});

async function getSQLData(leaderboardType) {
    try {
        const connection = await poolPromise;
        let data;
        if (leaderboardType === 'ALLTIME') {
            data = await connection.query(`
            SELECT Leaderboard.*, DiscordData.DiscordID
            FROM Leaderboard
            INNER JOIN DiscordData ON Leaderboard.UserID = DiscordData.UserID;
            `)
        } else if (leaderboardType === 'WEEKLY') {
            data = await connection.query(`
            SELECT TempLeaderboard.*, DiscordData.DiscordID
            FROM TempLeaderboard
            INNER JOIN DiscordData ON TempLeaderboard.UserID = DiscordData.UserID;
            `)
        }
        return data.recordset;
    } catch (error) {
        return {}
    }
}

async function assignFarmerRoleToLinkedUsers() {
    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (!guild) return;

        const role = guild.roles.cache.find(r => r.name === 'Farmer');
        if (!role) {
            return;
        }

        const linkedUsers = await getLinkedDiscordUsers();
        for (const discordID of linkedUsers) {
            try {
                let member = guild.members.cache.get(discordID);
                if (!member) {
                    member = await guild.members.fetch(discordID).catch(err => console.log("Member not found:", err));
                }
                if (member && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                }
            } catch (error) {
            }
        }
    } catch (error) {
    }
}

async function getLinkedDiscordUsers() {
    try {
        const connection = await poolPromise;
        let data = await connection.query(`
            SELECT DiscordID FROM DiscordData;
        `);
        return data.recordset.map(row => row.DiscordID);
    } catch (error) {
        return [];
    }
}

async function assignAllTimeLeaderboardRoles() {
    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (!guild) return;
        let data = await getSQLData('ALLTIME');

        const setRoles = async (roleName, category, allMembers) => {
            await removeRoleFromAllMembers(roleName, allMembers)
            for (const user of data) {
                if (!user[category] || user[category] > 3) continue;
                let member = guild.members.cache.get(user.DiscordID)
                if (member === undefined) {
                    member = await guild.members.fetch(user.DiscordID).catch(err => { });
                }
                const role = guild.roles.cache.find(r => r.name === roleName);
                if (member && role) {
                    member.roles.add(role).catch(console.error)
                }

            }
        }

        const allMembersData = await guild.members.fetch();
        CATEGORIES_ALLTIME.forEach((catArr) => {
            setRoles(catArr[0], catArr[1], allMembersData);
        })
    } catch (error) {
    }
}

async function assignWeeklyLeaderboardRoles() {
    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (!guild) return;
        let data = await getSQLData('WEEKLY');

        const setRoles = async (roleName, category, allMembers) => {
            await removeRoleFromAllMembers(roleName, allMembers)
            for (const user of data) {
                if (!user[category] || user[category] > 3) continue;
                let member = guild.members.cache.get(user.DiscordID)
                if (member === undefined) {
                    member = await guild.members.fetch(user.DiscordID).catch(err => console.log("Member not found"));
                }
                const role = guild.roles.cache.find(r => r.name === roleName);
                if (member && role) {
                    member.roles.add(role).catch(console.error)
                }

            }
        }

        const allMembersData = await guild.members.fetch();
        CATEGORIES_WEEKLY.forEach((catArr) => {
            setRoles(catArr[0], catArr[1], allMembersData);
        })
    } catch (error) {
    }
}

async function removeRoleFromAllMembers(roleName, allMembers) {
    const guild = client.guilds.cache.get(SERVER_ID);
    if (!guild) return;

    // Fetch the role by its name
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
        return;
    }

    // Iterate through each member and check if they have the role
    for (const member of allMembers.values()) {
        if (member.roles.cache.has(role.id)) {  // Check if member has the role
            try {
                await member.roles.remove(role);
            } catch (error) { }
        }
    }
}

async function getProfileData(username) {

    try {
        const connection = await poolPromise;
        let request = new sql.Request(connection);
        console.log(username)
        request.input('username', sql.VarChar(32), username);
        let res = await request.query(`
            SELECT 
                L.Username, P.Balance, P.XP, P.receivedPokes, P.totalContributedTownXP, P.profilePic, T.townName     
            FROM Logins L 
            LEFT JOIN Profiles P ON P.UserID = L.UserID
            LEFT JOIN TownMembers TM ON TM.UserID = L.UserID
            LEFT JOIN Towns T ON T.townID = TM.townID
            WHERE L.Username = @username
        `)
        if (res.recordset.length === 0) {
            return false
        }
        return res.recordset[0]
    } catch (error) {
        console.log(error)
        return false
    }
}


try {
    client.login(BOT_TOKEN)
} catch (error) {
    console.log(error)
}