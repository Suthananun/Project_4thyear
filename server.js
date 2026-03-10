const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API for Tool Usage Report
app.get('/api/tool-usage-report', async (req, res) => {
    try {
        const { year, month, line, machine, tooltype } = req.query;

        if (!line || !machine || !tooltype) {
            return res.json({ success: false, error: "Line, Machine, and Tool Type are required" });
        }

        const yrVal = parseInt(year) || 2024;
        const moVal = parseInt(month) || 2;

        // Use LIKE pattern for filtering by Line and Machine inside the tool_id
        // Pattern: T-L1-M1-%
        const toolIdPattern = `T-${line}-${machine}-%`;
        const params = [toolIdPattern, tooltype, yrVal, moVal];

        let query = `
            SELECT 
                (v.usage_date AT TIME ZONE 'Asia/Bangkok')::DATE::TEXT as date, 
                v.tool_id,
                v.cycle_accumulated as accumulated_usage,
                v.std as max_life
            FROM tool_status_monitor v
            JOIN tool t ON v.tool_id = t.tool_id
            WHERE t.tool_id LIKE $1
            AND t.tooltype_id = $2
            AND EXTRACT(YEAR FROM v.usage_date) = $3
            AND EXTRACT(MONTH FROM v.usage_date) = $4
            ORDER BY 1 ASC, v.tool_id ASC
        `;

        try {
            const result = await pool.query(query, params);

            if (result.rows.length > 0) {
                const dataFormatted = result.rows.map(row => ({
                    date: row.date,
                    tool_id: row.tool_id,
                    accumulated_insert_use: row.accumulated_usage,
                    max_insert_use: row.max_life
                }));

                // For the summary cards, we use the tool with the highest usage percentage on the latest day
                const latestDate = dataFormatted[dataFormatted.length - 1].date;
                const latestData = dataFormatted.filter(d => d.date === latestDate);

                let worstTool = latestData[0];
                latestData.forEach(d => {
                    const pct = (d.accumulated_insert_use / d.max_insert_use);
                    const worstPct = (worstTool.accumulated_insert_use / worstTool.max_insert_use);
                    if (pct > worstPct) worstTool = d;
                });

                return res.json({
                    success: true,
                    data: dataFormatted,
                    maxLife: worstTool.max_insert_use,
                    monthEndUsage: worstTool.accumulated_insert_use,
                    toolCount: latestData.length
                });
            } else {
                // Fallback: Get max life from tooltype table if no usage data
                const fallbackRes = await pool.query("SELECT std FROM tooltype WHERE tooltype_id = $1", [tooltype]);
                const maxLife = fallbackRes.rows.length > 0 ? fallbackRes.rows[0].std : 500000;

                return res.json({
                    success: true,
                    data: [],
                    maxLife,
                    monthEndUsage: 0
                });
            }
        } catch (e) {
            console.error("DB Query failed:", e.message);
            return res.status(500).json({ success: false, error: "Database query failed" });
        }

    } catch (err) {
        console.error("Endpoint crash:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API for filters
app.get('/api/filters', async (req, res) => {
    try {
        // Parse lines and machines from tool_id: T-L1-M1-1
        const lineResult = await pool.query(`
            SELECT DISTINCT split_part(tool_id, '-', 2) as line 
            FROM tool 
            WHERE tool_id LIKE 'T-%' 
            ORDER BY line
        `);

        const machineResult = await pool.query(`
            SELECT DISTINCT split_part(tool_id, '-', 3) as machine 
            FROM tool 
            WHERE tool_id LIKE 'T-%' 
            ORDER BY machine
        `);

        const tooltypeResult = await pool.query(`
            SELECT DISTINCT tooltype_id 
            FROM tool 
            ORDER BY tooltype_id
        `);

        // Dynamic dates from DB
        const dateRange = await pool.query("SELECT (MIN(usage_date) AT TIME ZONE 'Asia/Bangkok')::DATE::TEXT as min, (MAX(usage_date) AT TIME ZONE 'Asia/Bangkok')::DATE::TEXT as max FROM tool_usage_daily");
        const minDate = dateRange.rows[0].min;
        const maxDate = dateRange.rows[0].max;

        res.json({
            lines: lineResult.rows.map(r => r.line),
            machines: machineResult.rows.map(r => r.machine),
            tooltypes: tooltypeResult.rows.map(r => r.tooltype_id),
            years: [2024, 2025, 2026],
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            minDate,
            maxDate
        });
    } catch (e) {
        console.error("Filters crash:", e);
        res.status(500).json({ success: false, error: "Failed to fetch filters" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
