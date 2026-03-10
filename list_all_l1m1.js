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
        const res = await pool.query("SELECT tool_id, tooltype_id FROM tool WHERE tool_id LIKE 'T-L1-M1-%' ORDER BY tool_id");
        res.rows.forEach(r => {
            console.log(`${r.tool_id} -> ${r.tooltype_id}`);
        });
    } catch (err) { console.error(err); }
    finally { await pool.end(); }
}

check();
