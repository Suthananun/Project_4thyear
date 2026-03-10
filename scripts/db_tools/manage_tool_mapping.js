const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Usage:
  node manage_tool_mapping.js --list
  node manage_tool_mapping.js --update <tool_id> <new_type>

Examples:
  node manage_tool_mapping.js --list
  node manage_tool_mapping.js --update T-L1-M1-1 TT2
        `);
        process.exit(0);
    }

    try {
        if (args[0] === '--list') {
            const res = await pool.query("SELECT tool_id, tooltype_id FROM tool ORDER BY tool_id");
            console.log("\nCurrent Tool Mappings:");
            console.table(res.rows);
        }
        else if (args[0] === '--update') {
            const toolId = args[1];
            const newType = args[2];

            if (!toolId || !newType) {
                console.error("Error: Both <tool_id> and <new_type> are required for updates.");
                process.exit(1);
            }

            // Check if tool exists
            const checkRes = await pool.query("SELECT * FROM tool WHERE tool_id = $1", [toolId]);
            if (checkRes.rows.length === 0) {
                console.error(`Error: Tool '${toolId}' not found in database.`);
                process.exit(1);
            }

            // Update
            await pool.query("UPDATE tool SET tooltype_id = $1 WHERE tool_id = $2", [newType, toolId]);
            console.log(`Successfully updated tool '${toolId}' to type '${newType}'.`);
        }
        else {
            console.log("Unknown command. Use --help for usage details.");
        }
    } catch (err) {
        console.error("Database Error:", err.message);
    } finally {
        await pool.end();
    }
}

main();
