const http = require('http');

http.get('http://localhost:3000/api/tool-usage-report?line=L1&machine=M1&tooltype=TT19&year=2024&month=2', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            console.log("Usage Report Results:");
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.error("Parse Error:", e.message);
            console.log("Raw Body:", data);
        }
        process.exit(0);
    });
}).on('error', (err) => {
    console.error("Fetch Error:", err.message);
    process.exit(1);
});
