/**
 * WASM Validation Test Runner
 * Standalone script to run comprehensive WASM validation
 */

const WASMValidationSuite = require('./lib/wasm-validation-suite');
const path = require('path');

async function runValidationSuite() {
    console.log("Starting WASM Validation Suite...\n");
    
    const suite = new WASMValidationSuite();
    
    try {
        const results = await suite.runValidationSuite({
            port: 8082,
            headless: process.argv.includes('--headless') ? "new" : false,
            timeout: 30000,
            includeBrowserTests: true
        });

        // Generate and save report
        const report = suite.generateReport(results);
        
        // Save to reports directory
        const fs = require('fs');
        const reportsDir = path.join(__dirname, 'reports');
        
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(reportsDir, `wasm-validation-${timestamp}.txt`);
        const jsonPath = path.join(reportsDir, `wasm-validation-${timestamp}.json`);
        
        fs.writeFileSync(reportPath, report);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

        console.log(report);
        console.log(`\nReports saved to:`);
        console.log(`- Text: ${reportPath}`);
        console.log(`- JSON: ${jsonPath}`);

        // Exit with appropriate code
        process.exit(results.summary.failedTests > 0 ? 1 : 0);

    } catch (error) {
        console.error("Validation suite failed:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    runValidationSuite();
}

module.exports = { runValidationSuite };