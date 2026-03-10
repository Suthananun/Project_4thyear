const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function check() {
    try {
        const res = await pool.query("SELECT tooltype_id FROM tooltype ORDER BY tooltype_id");
        console.table(res.rows);
    } catch (err) { console.error(err); }
    finally { await pool.end(); }
}

check();
