const http = require('http');

http.get('http://localhost:3000/api/filters', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            console.log("Filters Results:");
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
