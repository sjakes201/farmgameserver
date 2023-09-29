const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const BOT_TOKEN = 'MTE0MzM2Nzc5NTY4MjMyMDQzNA.GAgjGJ.5yo4XsnHyoyO7FGYhoIR4OHiuGvaRlqDdyExSY'
const SERVER_ID = '1141813454244687882';

const { poolPromise } = require('../db');

client.once('ready', () => {
    console.log('Bot online!')
    assignLeaderboardRoles();
    setInterval(() => {
        assignLeaderboardRoles();
    }, 3600000)
})

async function getSQLData() {
    try {
        const connection = await poolPromise;
        let data = await connection.query(`
        SELECT Leaderboard.*, DiscordData.DiscordID
        FROM Leaderboard
        INNER JOIN DiscordData ON Leaderboard.UserID = DiscordData.UserID;
        `)
        return data.recordset;
    } catch (error) {
        console.log(error)
        return {}
    }
}

const CATEGORIES = [
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

async function assignLeaderboardRoles() {
    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (!guild) return;
        let data = await getSQLData();

        const setRoles = async (roleName, category, allMembers) => {
            await removeRoleFromAllMembers(roleName, allMembers)
            for (const user of data) {
                if (!user[category] || user[category] > 3) return;
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
        CATEGORIES.forEach((catArr) => {
            setRoles(catArr[0], catArr[1], allMembersData);
        })
    } catch (error) {
        console.log(error)
    }
}

async function removeRoleFromAllMembers(roleName, allMembers) {
    const guild = client.guilds.cache.get(SERVER_ID);
    if (!guild) return;

    // Fetch the role by its name
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
        console.log(`Role ${roleName} not found.`);
        return;
    }

    // Iterate through each member and check if they have the role
    for (const member of allMembers.values()) {
        if (member.roles.cache.has(role.id)) {  // Check if member has the role
            try {
                await member.roles.remove(role);
                console.log(`Removed role from ${member.user.tag}`);
            } catch (error) {
                console.error(`Error removing role from ${member.user.tag}:`, error);
            }
        }
    }
}


try {
    client.login(BOT_TOKEN)
} catch (error) {
    console.log(error)
}