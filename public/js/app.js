let usageChart;
let currentDashboardData = null;
let currentFilterContext = {};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard initializing...");
    initChart();
    await loadFilters();
    await updateDashboard();

    // Event Listeners for filters
    const filters = ['line-select', 'machine-select', 'tooltype-select', 'year-select', 'month-select'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateDashboard);
    });

    // CSV Export
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
});

async function loadFilters() {
    console.log("Loading filters...");
    try {
        const response = await fetch('/api/filters');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("Filters data received:", data);

        const lineSelect = document.getElementById('line-select');
        const machineSelect = document.getElementById('machine-select');
        const tooltypeSelect = document.getElementById('tooltype-select');
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');

        // Populate Lines
        if (data.lines && data.lines.length > 0) {
            lineSelect.innerHTML = '';
            data.lines.forEach(l => {
                const option = document.createElement('option');
                option.value = l;
                option.textContent = l;
                lineSelect.appendChild(option);
            });
            lineSelect.value = data.lines[0];
        }

        // Populate Machines
        if (data.machines && data.machines.length > 0) {
            machineSelect.innerHTML = '';
            data.machines.forEach(m => {
                const option = document.createElement('option');
                option.value = m;
                option.textContent = m;
                machineSelect.appendChild(option);
            });
            machineSelect.value = data.machines[0];
        }

        // Populate Tool Types (Sorted Naturally TT1, TT2, ..., TT10)
        if (data.tooltypes && data.tooltypes.length > 0) {
            tooltypeSelect.innerHTML = '';
            const sortedTypes = data.tooltypes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            sortedTypes.forEach(t => {
                const option = document.createElement('option');
                option.value = t;
                option.textContent = t;
                tooltypeSelect.appendChild(option);
            });
            tooltypeSelect.value = sortedTypes[0];
        }

        // Populate Years
        if (data.years && data.years.length > 0) {
            yearSelect.innerHTML = '';
            data.years.forEach(y => {
                const option = document.createElement('option');
                option.value = y;
                option.textContent = y;
                yearSelect.appendChild(option);
            });
            // Auto-detect best year or default to 2024
            yearSelect.value = data.years.includes(2024) ? "2024" : data.years[0];
        }

        // Populate Months
        monthSelect.innerHTML = '';
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        months.forEach((m, idx) => {
            const option = document.createElement('option');
            option.value = idx + 1;
            option.textContent = m;
            monthSelect.appendChild(option);
        });
        monthSelect.value = "2"; // Default to February where data is
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

async function updateDashboard() {
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.classList.remove('hidden');

    const line = document.getElementById('line-select')?.value;
    const machine = document.getElementById('machine-select')?.value;
    const tooltype = document.getElementById('tooltype-select')?.value;
    const year = parseInt(document.getElementById('year-select')?.value) || 2024;
    const month = parseInt(document.getElementById('month-select')?.value) || 2;

    console.log(`Updating dashboard with: Line=${line}, Machine=${machine}, Tool=${tooltype}, Date=${year}-${month}`);

    if (!line || !machine || !tooltype) {
        console.warn("Missing filter values, skipping update.");
        if (loading) loading.classList.add('hidden');
        return;
    }

    currentFilterContext = { line, machine, tooltype, year, month };

    try {
        // Fetch current, previous, and next month to support 30-day windows across month boundaries
        const dates = [
            getAdjacentMonth(year, month, -1),
            { year, month },
            getAdjacentMonth(year, month, 1)
        ];

        const fetchResults = await Promise.all(dates.map(d =>
            fetch(`/api/tool-usage-report?line=${line}&machine=${machine}&tooltype=${tooltype}&year=${d.year}&month=${d.month}`)
                .then(res => res.json())
        ));

        // Use the current month's result for stats and chart (primary focus)
        const currentResult = fetchResults[1];

        // Merge data for the tool usage table
        const allData = fetchResults.flatMap(r => r.success ? r.data : []);

        if (currentResult.success) {
            currentDashboardData = currentResult.data;
            updateChart(currentResult.data, currentResult.maxLife);
            updateStats(currentResult.data, currentResult.maxLife, currentResult.monthEndUsage);

            // Pass the master data set for table rendering
            renderToolUsageTable(allData, currentResult.maxLife, year, month);
        } else {
            console.error("API error:", currentResult.error);
        }
    } catch (error) {
        console.error('Error updating dashboard:', error);
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

function getAdjacentMonth(y, m, offset) {
    const d = new Date(y, m - 1 + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const toolRunData = {}; // Global store for run-specific data to support switching

function renderToolUsageTable(data, maxLifeFallback, year, month) {
    const container = document.getElementById('usage-table-container');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) return;

    const daysInMonth = new Date(year, month, 0).getDate();

    // Group all data by tool_id and sort by full date
    const toolRawData = {};
    data.forEach(d => {
        if (!toolRawData[d.tool_id]) toolRawData[d.tool_id] = [];
        toolRawData[d.tool_id].push(d);
    });

    const sortedToolIds = Object.keys(toolRawData).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    sortedToolIds.forEach(toolId => {
        const sortedData = toolRawData[toolId].sort((a, b) => a.date.localeCompare(b.date));

        let cycles = [];
        let prevAccum = -1;

        sortedData.forEach(d => {
            const accum = parseFloat(d.accumulated_usage || d.accumulated_insert_use) || 0;
            const max = parseFloat(d.max_life || d.max_insert_use) || maxLifeFallback || 500000;

            // Detect reset: if current accumulated is significantly lower than previous
            if (prevAccum !== -1 && accum < prevAccum && (prevAccum - accum) > 100) {
                // New cycle starts here
                cycles.push({ run: cycles.length + 1, startIndex: sortedData.indexOf(d), startData: d });
            } else if (cycles.length === 0) {
                // Initial cycle
                cycles.push({ run: 1, startIndex: 0, startData: d });
            }
            prevAccum = accum;
        });

        toolRunData[toolId] = {
            cycles: cycles,
            allData: sortedData,
            selectedYear: year,
            selectedMonth: month,
            daysInMonth: daysInMonth,
            maxLifeFallback: maxLifeFallback
        };

        renderSingleToolTable(toolId);
    });
}

function renderSingleToolTable(toolId) {
    const container = document.getElementById('usage-table-container');
    const toolInfo = toolRunData[toolId];
    const { cycles, daysInMonth } = toolInfo;

    // Filter cycles to only show those that START in the selected month
    const relevantCycles = cycles.filter(c => {
        const date = new Date(c.startData.date);
        return (date.getMonth() + 1 === toolInfo.selectedMonth &&
            date.getFullYear() === toolInfo.selectedYear);
    });

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper glass-card';
    tableWrapper.id = `table-wrapper-${toolId}`;
    tableWrapper.style.marginTop = '20px';

    const selectorHtml = relevantCycles.length > 1 ? `
        <div class="run-selector-container">
            <span class="run-label">View:</span>
            <select class="run-selector" onchange="updateToolTableView('${toolId}', this.value)">
                <option value="all">All</option>
                ${relevantCycles.map((c, i) => `<option value="${cycles.indexOf(c)}">Run ${i + 1}</option>`).join('')}
            </select>
        </div>
    ` : '';

    tableWrapper.innerHTML = `
        <table class="usage-table">
            <thead>
                <tr>
                    <th colspan="31" class="tool-id-header">
                        <div class="table-header-flex">
                            <span>Tool: ${toolId}</span>
                            ${selectorHtml}
                        </div>
                    </th>
                </tr>
                <tr class="header-row" id="thead-row-${toolId}"></tr>
            </thead>
            <tbody id="tbody-${toolId}"></tbody>
        </table>
    `;

    container.appendChild(tableWrapper);
    updateToolTableView(toolId, 'all');
}

function updateToolTableView(toolId, viewMode) {
    const toolInfo = toolRunData[toolId];
    const theadRow = document.getElementById(`thead-row-${toolId}`);
    const tbody = document.getElementById(`tbody-${toolId}`);
    if (!theadRow || !tbody) return;

    const { allData, cycles, selectedYear, selectedMonth, daysInMonth } = toolInfo;

    let columns = [];
    let rows = { usage: [], accumulated: [] };
    let highlights = [];

    if (viewMode === 'all') {
        // "All" View: standard month view for the selected month
        for (let d = 1; d <= daysInMonth; d++) {
            columns.push(`${d}/${selectedMonth}`);
        }

        const currentMonthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const monthData = allData.filter(d => d.date.startsWith(currentMonthPrefix));
        const dataMap = {};
        monthData.forEach(d => {
            const day = parseInt(d.date.split('-')[2]);
            dataMap[day] = d;
        });

        let prevAccum = 0;
        // To get correct usage for day 1, we look at the last day of the PREVIOUS month data if available
        const prevMonthData = allData.filter(d => {
            const date = new Date(d.date);
            return (date.getFullYear() === (selectedMonth === 1 ? selectedYear - 1 : selectedYear) &&
                date.getMonth() + 1 === (selectedMonth === 1 ? 12 : selectedMonth - 1));
        });
        if (prevMonthData.length > 0) {
            prevAccum = parseFloat(prevMonthData[prevMonthData.length - 1].accumulated_usage || prevMonthData[prevMonthData.length - 1].accumulated_insert_use) || 0;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dayData = dataMap[d];
            let isChange = false;

            if (dayData) {
                const accum = parseFloat(dayData.accumulated_usage || dayData.accumulated_insert_use) || 0;
                const max = parseFloat(dayData.max_life || dayData.max_insert_use) || toolInfo.maxLifeFallback || 500000;

                let usage = accum - prevAccum;
                if (accum < prevAccum) {
                    usage = accum; // Reset detected
                    isChange = true;
                }

                rows.usage.push(Math.max(0, usage).toLocaleString());
                rows.accumulated.push({ val: accum.toLocaleString(), hit: accum >= max });
                prevAccum = accum;
            } else {
                rows.usage.push('-');
                rows.accumulated.push({ val: '-', hit: false });
            }
            highlights.push(isChange);
        }
    } else {
        // "Change" View: exactly 30 entries from the sorted cross-month data starting from the cycle index
        const cycleIndex = parseInt(viewMode);
        const cycle = cycles[cycleIndex];
        const startIndex = cycle.startIndex;

        // Take up to 30 sequential records from allData starting from startIndex
        const windowData = allData.slice(startIndex, startIndex + 30);

        windowData.forEach((d, i) => {
            const dateParts = d.date.split('-');
            columns.push(`${parseInt(dateParts[2])}/${parseInt(dateParts[1])}`);

            const accum = parseFloat(d.accumulated_usage || d.accumulated_insert_use) || 0;
            const max = parseFloat(d.max_life || d.max_insert_use) || toolInfo.maxLifeFallback || 500000;

            let usage = 0;
            let isChange = false;
            if (i === 0) {
                usage = accum; // First day of the new cycle
                // Highlight the start of a new change (if it's not the very first ever record of the tool)
                // Actually user wants to highlight where it's important.
                isChange = true;
            } else {
                const prevD = windowData[i - 1];
                const prevAcc = parseFloat(prevD.accumulated_usage || prevD.accumulated_insert_use) || 0;
                usage = accum - prevAcc;
            }

            rows.usage.push(Math.max(0, usage).toLocaleString());
            rows.accumulated.push({ val: accum.toLocaleString(), hit: accum >= max });
            highlights.push(isChange);
        });

        // If we have fewer than 30 days of data total in the 3-month set, we can stick to what we have
        // But the user asked for no "-", so we only show what exists in the data.
    }

    // Render Headers with highlight
    theadRow.innerHTML = `<th class="label-cell">Date</th>` +
        columns.map((c, i) => `<th class="${highlights[i] ? 'change-day' : ''}">${c}</th>`).join('');

    // Render Body with highlight
    tbody.innerHTML = `
        <tr class="usage-row">
            <td class="label-cell">Tool used</td>
            ${rows.usage.map((u, i) => `<td class="${highlights[i] ? 'change-day' : ''}">${u}</td>`).join('')}
        </tr>
        <tr class="accumulated-row">
            <td class="label-cell">Accumulated</td>
            ${rows.accumulated.map((a, i) => `<td class="${a.hit ? 'limit-hit' : ''} ${highlights[i] ? 'change-day' : ''}">${a.val}</td>`).join('')}
        </tr>
    `;

    // Adjust colspan of header to match actual rendered columns
    const headerCell = document.querySelector(`#table-wrapper-${toolId} .tool-id-header`);
    if (headerCell) {
        headerCell.colSpan = columns.length + 1;
    }
}

function updateStats(data, maxLifeFallback, monthEndUsage) {
    const container = document.getElementById('summary-section');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="glass-card" style="text-align:center; padding: 40px; color: var(--text-secondary);">NO TOOL DATA FOUND FOR SELECTION</div>';
        return;
    }

    // Group data by tool_id to find latest stats based on DATE
    const tools = {};
    data.forEach(d => {
        const val = parseFloat(d.accumulated_insert_use) || 0;
        const max = parseFloat(d.max_insert_use) || maxLifeFallback || 500000;

        if (!tools[d.tool_id] || d.date >= tools[d.tool_id].lastDate) {
            tools[d.tool_id] = {
                id: d.tool_id,
                maxLife: max,
                currentUsage: val,
                lastDate: d.date
            };
        }
    });

    // Create a card for each tool
    Object.values(tools).sort((a, b) => a.id.localeCompare(b.id)).forEach(tool => {
        const pct = Math.min(100, Math.round((tool.currentUsage / tool.maxLife) * 100));

        let status = 'NORMAL';
        let badgeClass = 'badge-normal';
        let pctClass = 'neon-green-text';

        if (pct >= 100) {
            status = 'REPLACE';
            badgeClass = 'badge-replace';
            pctClass = 'neon-cyan-text';
        } else if (pct >= 80) {
            status = 'WARNING';
            badgeClass = 'badge-warning';
            pctClass = 'neon-blue-text';
        }

        const toolCard = document.createElement('div');
        toolCard.className = 'glass-card tool-card';
        toolCard.innerHTML = `
            <div class="tool-id-label">${tool.id}</div>
            
            <div class="stat-item">
                <span class="mini-stat-label">Condition</span>
                <span class="condition-badge ${badgeClass}">${status}</span>
            </div>

            <div class="stat-item">
                <span class="mini-stat-label">Accumulated</span>
                <span class="mini-stat-value neon-blue-text">${parseInt(tool.currentUsage).toLocaleString()}</span>
            </div>

            <div class="stat-item">
                <span class="mini-stat-label">Max Limit</span>
                <span class="mini-stat-value neon-cyan-text">${parseInt(tool.maxLife).toLocaleString()}</span>
            </div>

            <div class="stat-item">
                <span class="mini-stat-label">Life Used</span>
                <div class="mini-stat-value ${pctClass}">${pct}%</div>
                <div class="mini-progress">
                    <div class="mini-progress-bar" style="width: ${pct}%; background-color: ${status === 'NORMAL' ? 'var(--neon-green)' : (status === 'WARNING' ? 'var(--neon-blue)' : 'var(--neon-cyan)')}"></div>
                </div>
            </div>
        `;
        container.appendChild(toolCard);
    });
}

function initChart() {
    const options = {
        series: [
            { name: 'Accumulated Usage', data: [] },
            { name: 'Tool Life Limit', data: [] }
        ],
        chart: {
            height: 400,
            type: 'line',
            toolbar: { show: false },
            zoom: { enabled: false },
            background: 'transparent',
            foreColor: '#a0a0ab',
            redrawOnParentResize: true
        },
        colors: ['#00d2ff', '#39ff14', '#00ffff', '#b3ff00', '#00ffcc', '#0099ff'],
        stroke: {
            curve: 'smooth',
            width: [4, 2],
            dashArray: [0, 8]
        },
        xaxis: {
            type: 'datetime',
            labels: {
                format: 'dd MMM',
                datetimeUTC: false
            }
        },
        yaxis: {
            labels: {
                formatter: (val) => val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val
            }
        },
        tooltip: {
            theme: 'dark',
            x: {
                format: 'dd MMM yyyy'
            }
        },
        noData: {
            text: 'NO DATA AVAILABLE FOR THIS PERIOD',
            align: 'center',
            verticalAlign: 'middle',
            style: {
                color: '#00d2ff',
                fontSize: '20px',
                fontFamily: 'Inter, sans-serif'
            }
        }
    };

    usageChart = new ApexCharts(document.querySelector("#usage-chart"), options);
    usageChart.render();
}

function updateChart(data, maxLife) {
    if (!data || data.length === 0) {
        usageChart.updateSeries([]);
        return;
    }

    // Group data by tool_id
    const tools = {};
    data.forEach(d => {
        if (!tools[d.tool_id]) tools[d.tool_id] = [];
        const [y, m, day] = d.date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, day);
        tools[d.tool_id].push({
            x: dateObj.setHours(0, 0, 0, 0),
            y: parseFloat(d.accumulated_insert_use) || 0
        });
    });

    const series = [];

    // Add a series for each tool
    Object.keys(tools).forEach(toolId => {
        series.push({
            name: `${toolId}`,
            data: tools[toolId]
        });
    });

    // Add the Tool Life Limit line (red dotted)
    // We base it on the dates from the first tool found
    const firstToolId = Object.keys(tools)[0];
    const limitData = tools[firstToolId].map(pt => ({
        x: pt.x,
        y: parseFloat(maxLife) || 0
    }));

    series.push({
        name: 'Tool Life Limit',
        data: limitData
    });

    usageChart.updateSeries(series);

    // Update stroke and dash array for dynamic number of series
    const strokeWidths = series.map((s, idx) => idx === series.length - 1 ? 2 : 4);
    const dashArrays = series.map((s, idx) => idx === series.length - 1 ? 8 : 0);

    usageChart.updateOptions({
        stroke: {
            width: strokeWidths,
            dashArray: dashArrays
        }
    });

    // Force a resize event to ensure ApexCharts recalculates dimensions
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
}

function exportToCSV() {
    if (!currentDashboardData || currentDashboardData.length === 0) {
        alert("No data available to export! Please select a valid criteria.");
        return;
    }

    // Prepare CSV header
    const headers = ["Date", "Tool ID", "Accumulated Usage", "Max Life Limit"];

    // Process rows
    const rows = currentDashboardData.map(row => [
        row.date,
        row.tool_id,
        row.accumulated_insert_use,
        row.max_insert_use
    ]);

    // Construct CSV content (including UTF-8 BOM)
    let csvContent = "\uFEFF";
    csvContent += headers.join(",") + "\n";
    rows.forEach(r => {
        csvContent += r.join(",") + "\n";
    });

    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const context = currentFilterContext || {};
    const filename = `ToolUsage_${context.line || 'NA'}_${context.machine || 'NA'}_${context.tooltype || 'NA'}_${context.year || ''}_${context.month || ''}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);
}