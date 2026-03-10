const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkMarch() {
    try {
        console.log("Checking tools in TT1 for L1-M1:");
        const tools = await pool.query("SELECT tool_id FROM tool WHERE tooltype_id = 'TT1' AND tool_id LIKE 'T-L1-M1-%'");
        console.table(tools.rows);

        console.log("\nChecking March data summarize per tool:");
        const res = await pool.query(`
            SELECT 
                tool_id, 
                usage_date, 
                cycle_accumulated, 
                daily_insert_use 
            FROM tool_status_monitor 
            WHERE tool_id IN (SELECT tool_id FROM tool WHERE tooltype_id = 'TT1' AND tool_id LIKE 'T-L1-M1-%')
            AND EXTRACT(YEAR FROM usage_date) = 2024
            AND EXTRACT(MONTH FROM usage_date) = 3
            ORDER BY usage_date, tool_id
        `);

        // Group by date to see the SUM vs individual
        const daily = {};
        res.rows.forEach(r => {
            const date = r.usage_date.toISOString().split('T')[0];
            if (!daily[date]) daily[date] = { sum: 0, tools: [] };
            daily[date].sum += parseInt(r.cycle_accumulated);
            daily[date].tools.push({ id: r.tool_id, val: r.cycle_accumulated });
        });

        console.log("\nDaily Comparison (Individual vs SUM):");
        Object.keys(daily).sort().forEach(date => {
            const d = daily[date];
            const details = d.tools.map(t => `${t.id}: ${t.val}`).join(' | ');
            console.log(`${date} | SUM: ${d.sum} | Details: ${details}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkMarch();
