document.addEventListener('DOMContentLoaded', () => {
    // State management
    const state = {
        filters: {
            line: 'All',
            machine: 'All',
            year: '2024',
            month: '2'
        },
        charts: {
            trend: null,
            toolRanking: null,
            lineDonut: null,
            typeDonut: null,
            machineDonut: null
        }
    };

    // DOM Elements
    const elements = {
        yearSelect: document.getElementById('year-select'),
        monthSelect: document.getElementById('month-select'),
        totalCost: document.getElementById('total-cost'),
        avgDailyCost: document.getElementById('avg-daily-cost'),
        activeTools: document.getElementById('active-tools'),
        loadingIndicator: document.getElementById('loading-indicator'),
        lineDonut: document.getElementById('line-donut-chart'),
        typeDonut: document.getElementById('type-donut-chart'),
        machineDonut: document.getElementById('machine-donut-chart')
    };

    // Initialize Filters
    async function initFilters() {
        try {
            const res = await fetch('/api/filters');
            const data = await res.json();

            // Filters for line and machine are removed

            // Populate Years
            if (elements.yearSelect) {
                elements.yearSelect.innerHTML = data.years.map(y => `<option value="${y}">${y}</option>`).join('');
                elements.yearSelect.value = state.filters.year;
            }

            // Populate Months (1-12)
            if (elements.monthSelect) {
                elements.monthSelect.innerHTML = data.months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
                elements.monthSelect.value = state.filters.month;
            }

        } catch (e) {
            console.error("Failed to load filters:", e);
        }
    }

    // Initialize Charts
    function initCharts() {
        // Trend Chart (Line/Area)
        const trendOptions = {
            series: [{ name: 'Daily Cost', data: [] }],
            chart: {
                height: 350,
                type: 'area',
                toolbar: { show: false },
                background: 'transparent',
                foreColor: '#a0a0ab',
                zoom: { enabled: false },
                selection: { enabled: false }
            },
            colors: ['#a855f7'],
            dataLabels: { enabled: false },
            stroke: { 
                curve: 'smooth', 
                width: 5,
                colors: ['#a855f7']
            },
            markers: {
                size: 6,
                colors: ['#a855f7'],
                strokeColors: '#fff',
                strokeWidth: 3,
                hover: { size: 8 }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.4,
                    opacityTo: 0.1,
                    colorStops: [
                        { offset: 0, color: '#a855f7', opacity: 0.4 },
                        { offset: 100, color: '#ec4899', opacity: 0 }
                    ]
                }
            },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                xaxis: { lines: { show: true } },
                yaxis: { lines: { show: true } }
            },
            xaxis: {
                categories: [],
                axisBorder: { show: false },
                axisTicks: { show: true, color: 'rgba(255,255,255,0.1)' },
                labels: {
                    style: { colors: '#a0a0ab', fontSize: '12px' },
                    rotate: 0,
                    hideOverlappingLabels: false
                }
            },
            yaxis: {
                labels: {
                    style: { colors: '#a0a0ab' },
                    formatter: (val) => '฿' + (val || 0).toLocaleString()
                }
            },
            tooltip: { theme: 'dark', x: { show: true } }
        };
        state.charts.trend = new ApexCharts(document.querySelector("#cost-chart"), trendOptions);
        state.charts.trend.render();

        // Tool Ranking Chart (Bar)
        const rankingOptions = {
            series: [{ name: 'Cost', data: [] }],
            chart: {
                type: 'bar',
                height: '100%',
                toolbar: { show: false },
                foreColor: '#a0a0ab'
            },
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    horizontal: true,
                    barHeight: '60%',
                    distributed: true
                }
            },
            colors: ['#00d2ff', '#00ffff', '#39ff14', '#00ead3', '#00f5d4', '#4cc9f0'],
            dataLabels: { 
                enabled: true,
                style: {
                    colors: ['#fff'],
                    fontSize: '10px'
                },
                formatter: (val) => '฿' + Math.round(val).toLocaleString()
            },
            xaxis: {
                categories: [],
                labels: { 
                    style: { colors: '#a0a0ab' },
                    formatter: (val) => '฿' + (val || 0).toLocaleString() 
                }
            },
            grid: { 
                borderColor: 'rgba(255, 255, 255, 0.03)',
                xaxis: { lines: { show: true } }
            },
            legend: { show: false },
            tooltip: { theme: 'dark' }
        };

        state.charts.toolRanking = new ApexCharts(document.querySelector("#tool-ranking-chart"), rankingOptions);
        state.charts.toolRanking.render();

        state.charts.typeRanking = new ApexCharts(document.querySelector("#type-ranking-chart"), rankingOptions);
        state.charts.typeRanking.render();

        const modernPalette = ['#00d2ff', '#39ff14', '#00ffff', '#4cc9f0', '#22d3ee', '#0ea5e9', '#6ee7b7'];

        // Donut Chart Options
        const donutOptions = (id, colors) => ({
            series: [],
            chart: {
                id: id,
                type: 'donut',
                height: 240,
                background: 'transparent',
                foreColor: '#a0a0ab'
            },
            colors: colors,
            labels: [],
            stroke: { show: false },
            dataLabels: { enabled: false },
            legend: {
                position: 'right',
                offsetY: 20,
                fontSize: '12px',
                fontFamily: 'Outfit, sans-serif',
                itemMargin: { vertical: 6 },
                markers: { radius: 6 }
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '75%',
                        labels: {
                            show: true,
                            name: { show: true, fontSize: '14px', fontWeight: 600, color: '#a0a0ab', offsetY: -10 },
                            value: { show: true, fontSize: '20px', fontWeight: 800, color: '#fff', offsetY: 10, formatter: (val) => '฿' + parseInt(val || 0).toLocaleString() },
                            total: { 
                                show: true, 
                                label: 'Total', 
                                fontSize: '14px', 
                                fontWeight: 600, 
                                color: '#a0a0ab', 
                                formatter: (w) => {
                                    const totals = w.globals.seriesTotals || [];
                                    const sum = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) : 0;
                                    return '฿' + Math.round(sum).toLocaleString();
                                }
                            }
                        }
                    }
                }
            },
            tooltip: { theme: 'dark' }
        });

        if (elements.lineDonut) {
            state.charts.lineDonut = new ApexCharts(elements.lineDonut, donutOptions('line-donut', modernPalette));
            state.charts.lineDonut.render();
        }

        if (elements.typeDonut) {
            state.charts.typeDonut = new ApexCharts(elements.typeDonut, donutOptions('type-donut', modernPalette));
            state.charts.typeDonut.render();
        }

        if (elements.machineDonut) {
            state.charts.machineDonut = new ApexCharts(elements.machineDonut, donutOptions('machine-donut', modernPalette));
            state.charts.machineDonut.render();
        }
    }

    // Click-away handler — dismiss stuck tooltip/crosshair when clicking outside the chart
    document.addEventListener('click', (e) => {
        const chartEl = document.querySelector('#cost-chart');
        if (chartEl && !chartEl.contains(e.target)) {
            const svg = chartEl.querySelector('svg');
            if (svg) {
                svg.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            }
        }
    });

    // Fetch and Update Dashboard
    async function updateDashboard() {
        if (elements.loadingIndicator) elements.loadingIndicator.classList.remove('hidden');

        try {
            const query = `?year=${state.filters.year}&month=${state.filters.month}&line=All&machine=All`;
            
            // Perform Parallel Fetch for all markers
            const responses = await Promise.all([
                fetch('/api/cost-efficiency/summary' + query),
                fetch('/api/cost-efficiency/daily' + query),
                fetch('/api/cost-efficiency/rankings' + query),
                fetch('/api/cost-efficiency/details' + query),
                fetch('/api/cost-efficiency/line-summary' + query),
                fetch('/api/cost-efficiency/machine-summary' + query),
                fetch('/api/cost-efficiency/type-summary' + query)
            ]);

            const getJson = async (res) => {
                if (!res.ok) {
                    console.warn(`Fetch failed for ${res.url}: ${res.status}`);
                    return { success: false, data: [] };
                }
                try { return await res.json(); } 
                catch (e) { return { success: false, data: [] }; }
            };

            const summary = await getJson(responses[0]);
            const daily = await getJson(responses[1]);
            const rankings = await getJson(responses[2]);
            const details = await getJson(responses[3]);
            const lineSummary = await getJson(responses[4]);
            const machSummary = await getJson(responses[5]);
            const typeSummary = await getJson(responses[6]);

            console.log("Dashboard Data Loaded:", { summary, lineSummary, typeSummary, machSummary });

            // Update Summary Cards
            if (summary.success && summary.summary) {
                const s = summary.summary;
                if (elements.totalCost) elements.totalCost.textContent = '฿' + (parseFloat(s.total_cost) || 0).toLocaleString(undefined, {minimumFractionDigits: 2});
                if (elements.avgDailyCost) elements.avgDailyCost.textContent = '฿' + (parseFloat(s.avg_daily_cost) || 0).toLocaleString(undefined, {minimumFractionDigits: 2});
                if (elements.activeTools) elements.activeTools.textContent = s.tool_count || 0;
            }

            // Update Trend Chart
            if (daily.success && daily.data.length > 0) {
                const labels = daily.data.map(d => d.date.split('-')[2]); // Just day number
                const values = daily.data.map(d => parseFloat(d.total_cost));
                state.charts.trend.updateOptions({
                    xaxis: { categories: labels },
                    series: [{ name: 'Daily Cost', data: values }]
                });
            }

            // Update Rankings
            if (rankings.success) {
                // Tool Ranking
                state.charts.toolRanking.updateOptions({
                    xaxis: { categories: (rankings.toolRanking || []).map(r => r.tool_id) },
                    series: [{ name: 'Total Cost', data: (rankings.toolRanking || []).map(r => parseFloat(r.total_cost)) }]
                });

                // Type Ranking
                state.charts.typeRanking.updateOptions({
                    xaxis: { categories: (rankings.typeRanking || []).map(r => r.tooltype_id) },
                    series: [{ name: 'Total Cost', data: (rankings.typeRanking || []).map(r => parseFloat(r.total_cost)) }]
                });
            }

            // Update Distribution (3 Donuts)
            updateDonutChart(state.charts.lineDonut, lineSummary ? lineSummary.data : []);
            updateDonutChart(state.charts.typeDonut, typeSummary ? typeSummary.data : []);
            updateDonutChart(state.charts.machineDonut, machSummary ? machSummary.data : []);


            // Update Details Table
            if (details.success) {
                const tbody = document.getElementById('details-body');
                if (tbody) {
                    tbody.innerHTML = (details.data || []).map(row => `
                        <tr>
                            <td style="color: var(--text-secondary)">${row.date}</td>
                            <td style="color: var(--neon-blue); font-weight: 700;">${row.tool_id}</td>
                            <td>${row.machine_id}</td>
                            <td>${row.line_id}</td>
                            <td>${row.tooltype_id}</td>
                            <td style="color: var(--neon-green)">${(parseInt(row.daily_insert_use) || 0).toLocaleString()}</td>
                            <td style="color: var(--text-secondary)">฿${parseFloat(row.baht_per_use || 0).toFixed(4)}</td>
                            <td style="color: var(--neon-cyan); font-weight: 800;">฿${parseFloat(row.cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                    `).join('');
                }
            }

        } catch (e) {
            console.error("Update Dashboard failed:", e);
        } finally {
            if (elements.loadingIndicator) elements.loadingIndicator.classList.add('hidden');
        }
    }

    function formatDonutLabel(id) {
        if (!id || id === 'N/A') return id;
        const s = String(id).trim();
        // Tool Type: starts with TT followed by digits (e.g. TT17)
        const ttMatch = s.match(/^(TT)(\d+)$/i);
        if (ttMatch) return `${s} — Tooltype ${ttMatch[2]}`;
        // Machine: starts with M followed by digits (e.g. M6)
        const mMatch = s.match(/^(M)(\d+)$/i);
        if (mMatch) return `${s} — Machine ${mMatch[2]}`;
        // Line: starts with L followed by digits (e.g. L2)
        const lMatch = s.match(/^(L)(\d+)$/i);
        if (lMatch) return `${s} — Line ${lMatch[2]}`;
        // Fallback: return as-is
        return s;
    }

    function updateDonutChart(chart, data) {
        if (!chart || !data) return;
        const labels = data.map(item => formatDonutLabel(String(item.id || 'N/A')));
        const series = data.map(item => parseFloat(item.total_cost || 0));

        chart.updateOptions({
            labels: labels,
            series: series
        });
    }

    // Event Listeners
    if (elements.yearSelect) {
        elements.yearSelect.addEventListener('change', (e) => {
            state.filters.year = e.target.value;
            updateDashboard();
        });
    }

    if (elements.monthSelect) {
        elements.monthSelect.addEventListener('change', (e) => {
            state.filters.month = e.target.value;
            updateDashboard();
        });
    }

    // Execute Initialization
    (async () => {
        await initFilters();
        initCharts();
        updateDashboard();
    })();
});
