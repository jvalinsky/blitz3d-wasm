const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log('PAGE LOG:', msg.text());
        if (msg.text().includes('Test execution finished.')) {
            process.exit(0);
        }
    });

    try {
        await page.goto('http://localhost:8000/index_test.html');
        // Wait up to 10 seconds for completion
        setTimeout(() => {
            console.error('Test timed out');
            process.exit(1);
        }, 10000);
    } catch (e) {
        console.error('Failed to run test:', e);
        process.exit(1);
    }
})();
