const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    // Define the absolute path to the locally installed Chrome v146
    const chromePath = path.resolve(__dirname, '../../chrome/mac_arm-146.0.7642.0/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

    console.log(`Using Chrome executable at: ${chromePath}`);

    const browser = await puppeteer.launch({
        // CRITICAL: Force use of the new Chrome
        executablePath: chromePath,

        // FIX 1: Use the new Headless mode
        headless: "new",

        // FIX 2: Stability args
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            // '--disable-gpu' // Removed to allow WebGL
            '--use-gl=swiftshader' // Try software rendering if hardware fails
        ],
        dumpio: true
    });

    const page = await browser.newPage();

    page.on('console', async msg => {
        const text = msg.text();
        let args = "";
        try {
            args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
            args = JSON.stringify(args);
        } catch (e) { }

        console.log(`[Browser] ${text} ${args}`);

        if (text.includes("MeshTest Complete")) {
            console.log("SUCCESS: MeshTest ran to completion!");
            process.exit(0);
        }

        if (text.includes("WASM LOAD ERROR")) {
            console.error("FAILURE: WASM Load Error detected.");
            await browser.close();
            process.exit(1);
        }
    });

    page.on('pageerror', err => {
        console.error(`[Browser Error] ${err}`);
    });

    try {
        const port = process.env.PORT || 8080;
        console.log(`Navigating to http://localhost:${port}/index_mesh.html...`);
        const t = Date.now();
        await page.goto(`http://localhost:${port}/index_mesh.html?v=${t}`);

        await new Promise(r => setTimeout(r, 5000));

        console.error("Test finished (TIMEOUT). Closing.");
        await browser.close();
        process.exit(1);
    } catch (e) {
        console.error("Error:", e);
        await browser.close();
        process.exit(1);
    }
})();
