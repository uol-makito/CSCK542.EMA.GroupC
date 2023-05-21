const dotenv = require('dotenv');
dotenv.config();

const mysql = require('mysql2');
const pool = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

function getDbPool() {
  return pool;
}

function getExecResult(errorNumber, outputMessage, outputObject) {
  return { errorNumber, outputMessage, outputObject };
}

function getRoleID(userID, callback) {
  pool.query(
    `SELECT RoleID FROM users WHERE UserID = ${userID} LIMIT 1;`,
    (err, results, fields) => {
      if (err) {
        callback(err);
      }
      else {
        callback(null, (results.length > 0) ? results[0].RoleID : -1);
      }
    });
}

module.exports = { getDbPool, getExecResult, getRoleID };