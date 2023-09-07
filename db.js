const sql = require('mssql');

const connectionString = process.env.DB_CONNECT_STRING;

// Create a single connection pool
const poolPromise = new sql.ConnectionPool(connectionString)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL');
    return pool;
  })
  .catch(err => console.log('Database Connection Failed! Bad Config:', err));

// Export it for use in other files
module.exports = {
  sql,
  poolPromise
};
