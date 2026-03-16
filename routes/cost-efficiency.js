const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // API for Tool Cost Efficiency Summary
    router.get('/summary', async (req, res) => {
        try {
            const { year, month, line, machine } = req.query;
            const yrVal = parseInt(year) || 2024;
            const moVal = parseInt(month) || 2;
            console.log(`Fetching summary for ${yrVal}/${moVal} Line:${line} Mach:${machine}`);

            let query = `
                SELECT 
                    COALESCE(SUM(daily_tool_cost::numeric), 0) as total_cost,
                    COALESCE(AVG(daily_tool_cost::numeric), 0) as avg_daily_cost,
                    COALESCE(COUNT(DISTINCT tool_id), 0) as tool_count
                FROM daily_tool_cost
                WHERE EXTRACT(YEAR FROM usage_date) = $1
                AND EXTRACT(MONTH FROM usage_date) = $2
            `;
            const params = [yrVal, moVal];

            let paramIdx = 3;
            if (line && line !== 'All') {
                query += ` AND line_id = $${paramIdx++}`;
                params.push(line);
            }
            if (machine && machine !== 'All') {
                query += ` AND machine_id = $${paramIdx++}`;
                params.push(machine);
            }

            const result = await pool.query(query, params);
            res.json({ success: true, summary: result.rows[0] });
        } catch (err) {
            console.error("Summary API crash:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // API for Daily Tool Cost
    router.get('/daily', async (req, res) => {
        try {
            const { year, month, line, machine } = req.query;
            const yrVal = parseInt(year) || 2024;
            const moVal = parseInt(month) || 2;

            let query = `
                SELECT 
                    (usage_date AT TIME ZONE 'Asia/Bangkok')::DATE::TEXT as date,
                    SUM(daily_tool_cost::numeric) as total_cost
                FROM daily_tool_cost
                WHERE EXTRACT(YEAR FROM usage_date) = $1
                AND EXTRACT(MONTH FROM usage_date) = $2
            `;
            const params = [yrVal, moVal];
            let paramIdx = 3;

            if (line && line !== 'All') {
                query += ` AND line_id = $${paramIdx++}`;
                params.push(line);
            }
            if (machine && machine !== 'All') {
                query += ` AND machine_id = $${paramIdx++}`;
                params.push(machine);
            }

            query += ` GROUP BY 1 ORDER BY 1 ASC`;

            const result = await pool.query(query, params);
            res.json({ success: true, data: result.rows });
        } catch (err) {
            console.error("Daily Cost API crash:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // API for Tool Rankings
    router.get('/rankings', async (req, res) => {
        try {
            const { year, month, line, machine } = req.query;
            const yrVal = parseInt(year) || 2024;
            const moVal = parseInt(month) || 2;

            // Tool ID Ranking
            let toolQuery = `
                SELECT 
                    tool_id,
                    SUM(daily_tool_cost::numeric) as total_cost
                FROM daily_tool_cost
                WHERE EXTRACT(YEAR FROM usage_date) = $1
                AND EXTRACT(MONTH FROM usage_date) = $2
            `;
            const params = [yrVal, moVal];
            let paramIdx = 3;

            if (line && line !== 'All') {
                toolQuery += ` AND line_id = $${paramIdx++}`;
                params.push(line);
            }
            if (machine && machine !== 'All') {
                toolQuery += ` AND machine_id = $${paramIdx++}`;
                params.push(machine);
            }
            toolQuery += ` GROUP BY tool_id ORDER BY total_cost DESC LIMIT 10`;

            // Tool Type Ranking
            let typeQuery = `
                SELECT 
                    tooltype_id,
                    SUM(daily_tool_cost::numeric) as total_cost
                FROM daily_tool_cost
                WHERE EXTRACT(YEAR FROM usage_date) = $1
                AND EXTRACT(MONTH FROM usage_date) = $2
            `;
            const typeParams = [yrVal, moVal];
            let typeParamIdx = 3;
            if (line && line !== 'All') {
                typeQuery += ` AND line_id = $${typeParamIdx++}`;
                typeParams.push(line);
            }
            if (machine && machine !== 'All') {
                typeQuery += ` AND machine_id = $${typeParamIdx++}`;
                typeParams.push(machine);
            }
            typeQuery += ` GROUP BY tooltype_id ORDER BY total_cost DESC LIMIT 10`;

            const [toolRes, typeRes] = await Promise.all([
                pool.query(toolQuery, params),
                pool.query(typeQuery, typeParams)
            ]);

            res.json({
                success: true,
                toolRanking: toolRes.rows,
                typeRanking: typeRes.rows
            });
        } catch (err) {
            console.error("Rankings API crash:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // API for Detailed Cost Table
    router.get('/details', async (req, res) => {
        try {
            const { year, month, line, machine } = req.query;
            const yrVal = parseInt(year) || 2024;
            const moVal = parseInt(month) || 2;

            let query = `
                SELECT 
                    (usage_date AT TIME ZONE 'Asia/Bangkok')::DATE::TEXT as date,
                    tool_id,
                    machine_id,
                    line_id,
                    tooltype_id,
                    daily_insert_use,
                    baht_per_use::numeric,
                    daily_tool_cost::numeric as cost
                FROM daily_tool_cost
                WHERE EXTRACT(YEAR FROM usage_date) = $1
                AND EXTRACT(MONTH FROM usage_date) = $2
            `;
            const params = [yrVal, moVal];
            let paramIdx = 3;

            if (line && line !== 'All') {
                query += ` AND line_id = $${paramIdx++}`;
                params.push(line);
            }
            if (machine && machine !== 'All') {
                query += ` AND machine_id = $${paramIdx++}`;
                params.push(machine);
            }

            query += ` ORDER BY usage_date DESC, tool_id ASC LIMIT 100`;

            const result = await pool.query(query, params);
            res.json({ success: true, data: result.rows });
        } catch (err) {
            console.error("Details API crash:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Summary APIs for Line, Machine, Type (Directly from daily_tool_cost)
    router.get('/line-summary', async (req, res) => {
        try {
            const { year, month } = req.query;
            const result = await pool.query(`
                SELECT COALESCE(NULLIF(TRIM(line_id), ''), 'Unknown Line') as id, SUM(daily_tool_cost::numeric) as total_cost 
                FROM daily_tool_cost 
                WHERE EXTRACT(YEAR FROM usage_date) = $1 AND EXTRACT(MONTH FROM usage_date) = $2
                GROUP BY 1 ORDER BY 2 DESC LIMIT 5
            `, [parseInt(year) || 2024, parseInt(month) || 2]);
            res.json({ success: true, data: result.rows });
        } catch (err) {
            res.json({ success: false, data: [], error: err.message });
        }
    });

    router.get('/machine-summary', async (req, res) => {
        try {
            const { year, month } = req.query;
            const result = await pool.query(`
                SELECT COALESCE(NULLIF(TRIM(machine_id), ''), 'Unknown Mach') as id, SUM(daily_tool_cost::numeric) as total_cost 
                FROM daily_tool_cost 
                WHERE EXTRACT(YEAR FROM usage_date) = $1 AND EXTRACT(MONTH FROM usage_date) = $2
                GROUP BY 1 ORDER BY 2 DESC LIMIT 5
            `, [parseInt(year) || 2024, parseInt(month) || 2]);
            res.json({ success: true, data: result.rows });
        } catch (err) {
            res.json({ success: false, data: [], error: err.message });
        }
    });

    router.get('/type-summary', async (req, res) => {
        try {
            const { year, month } = req.query;
            const result = await pool.query(`
                SELECT COALESCE(NULLIF(TRIM(tooltype_id), ''), 'Unknown Type') as id, SUM(daily_tool_cost::numeric) as total_cost 
                FROM daily_tool_cost 
                WHERE EXTRACT(YEAR FROM usage_date) = $1 AND EXTRACT(MONTH FROM usage_date) = $2
                GROUP BY 1 ORDER BY 2 DESC LIMIT 5
            `, [parseInt(year) || 2024, parseInt(month) || 2]);
            res.json({ success: true, data: result.rows });
        } catch (err) {
            res.json({ success: false, data: [], error: err.message });
        }
    });

    return router;
};
