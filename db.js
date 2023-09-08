const sql = require('mssql');

const connectionString = process.env.DB_CONNECT_STRING; // Your connection string

// Additional Configuration
const additionalConfig = {
  pool: {
    max: 20,  // maximum number of connections in pool
    min: 0,  // minimum number of connections in pool
    idleTimeoutMillis: 30000 // time (in milliseconds) to wait before closing idle connections
  },
  options: {
    encrypt: true // Use this if you're on Windows Azure
  }
};

// Create a single connection pool
const poolPromise = new sql.ConnectionPool(connectionString, additionalConfig)
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
