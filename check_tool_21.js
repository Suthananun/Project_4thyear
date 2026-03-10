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
        console.log("Checking T-L1-M1-21 data for March:");
        const res = await pool.query(`
            SELECT usage_date, cycle_accumulated
            FROM tool_status_monitor
            WHERE tool_id = 'T-L1-M1-21'
            AND EXTRACT(YEAR FROM usage_date) = 2024
            AND EXTRACT(MONTH FROM usage_date) = 3
            ORDER BY usage_date ASC
        `);
        res.rows.forEach(r => {
            console.log(`Date: ${r.usage_date.toISOString().split('T')[0]} | Usage: ${r.cycle_accumulated}`);
        });
    } catch (err) { console.error(err); }
    finally { await pool.end(); }
}

check();
