const sql = require('mssql');

module.exports = async function (context, myTimer) {
    if(process.env.NODE_ENV === "testing") {
        console.log("TESTING ENV, NOT RUNNING")
        ws.send(JSON.stringify( {
            status: 200,
            body: {
                message: "TEST ENV NOT RUNNING"
            }
        }));
        return;
    }
    let connection;
    let transaction;
    try {
        connection = await poolPromise;
        transaction = new sql.Transaction(connection);
        await transaction.begin();
        const request = new sql.Request(transaction);

        let reset = await request.query(`
            UPDATE TempLeaderboardSum
            SET carrot = 0, melon = 0, cauliflower = 0, pumpkin = 0, yam = 0, beet = 0, parsnip = 0, bamboo = 0, hops = 0, corn = 0,
            potato = 0, blueberry = 0, grape = 0, oats = 0, strawberry = 0, cow_milk = 0, chicken_egg = 0, duck_egg = 0, quail_egg = 0,
            yak_milk = 0, sheep_wool = 0, goat_milk = 0, ostrich_egg = 0, llama_wool = 0, kiwi_egg = 0
        `)
        if (reset.rowsAffected[0] === 0) {
            await transaction.rollback();
            return;
        }

        await transaction.commit();
    } catch (error) {
        if (transaction) await transaction.rollback()
        console.log(error);
    } finally {
        if (connection) await connection.close();
    }
};





