const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkReset() {
    try {
        console.log("Checking reset dates for TT1 tools in March:");
        const res = await pool.query(`
            SELECT tool_id, usage_date, cycle_accumulated
            FROM tool_status_monitor
            WHERE tool_id IN ('T-L1-M1-1', 'T-L1-M1-21')
            AND EXTRACT(YEAR FROM usage_date) = 2024
            AND EXTRACT(MONTH FROM usage_date) = 3
            ORDER BY tool_id, usage_date
        `);

        let lastId = null;
        res.rows.forEach(r => {
            if (r.tool_id !== lastId) {
                console.log(`\nTool: ${r.tool_id}`);
                lastId = r.tool_id;
            }
            if (parseInt(r.cycle_accumulated) < 500 && r.usage_date.getDate() > 1) { // Likely reset
                console.log(`  RESET at ${r.usage_date.toISOString().split('T')[0]} (Value: ${r.cycle_accumulated})`);
            }
        });
    } catch (err) { console.error(err); }
    finally { await pool.end(); }
}

checkReset();
