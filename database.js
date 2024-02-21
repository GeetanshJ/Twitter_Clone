const mysql = require('mysql');
const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'twitter_clone'
})
con.connect((err) => {
    if (err) throw err;
    console.log("Main connected hun😁!");
})
module.exports = con;