# WASM Analyzer for Blitz3D Compiler

Comprehensive analysis toolkit for validating and debugging WebAssembly output from the Blitz3D compiler.

## Features

- **Stack Balance Validation**: Verifies WASM modules don't have stack underflow/overflow using the WASM spec 3-stack algorithm
- **Type Consistency Checking**: Detects type mismatches in function calls and operations  
- **Control Flow Analysis**: Validates block structure and branch depths
- **Code Metrics**: Instruction counts, function sizes, stack depths, branch/call statistics
- **Visualizations**: SVG charts and interactive HTML dashboards
- **Multiple Report Formats**: Text, JSON, Markdown, JUnit XML

## Installation

```bash
cd Tools/analyzer
npm install
```

## Quick Start

### CLI Usage

```bash
# Analyze a single WASM file
node cli.js output.wasm

# Analyze all files in a directory
node cli.js ./compiled/

# Watch file for changes and re-analyze
node cli.js -w Main.wasm

# Compare two WASM files
node cli.js -c before.wasm after.wasm

# Batch analyze files matching pattern
node cli.js -b "*.wasm"

# Verbose output with full report
node cli.js output.wasm -v
```

### Programmatic Usage

```javascript
import { WASMAnalyzer } from './core.js';
import { visualizeAnalysis } from './visualize.js';
import { generateReport } from './report.js';

// Analyze a WASM file
const analysis = await WASMAnalyzer.fromFile('output.wasm');
const report = analysis.generateReport();

// Generate visualizations
const files = visualizeAnalysis(report);

// Print summary
console.log(`Functions: ${report.summary.totalFunctions}`);
console.log(`Stack Valid: ${report.summary.stackValid}`);
```

## Output Files

When analyzing, the following files are generated:

| File | Description |
|------|-------------|
| `dashboard.html` | Interactive summary dashboard with metrics |
| `stack-depth.svg` | Bar chart of max stack depth per function |
| `instructions.svg` | Top 15 most frequent instructions |
| `function-sizes.svg` | Function size distribution |
| `errors.svg` | Error heatmap by instruction index |
| `analysis.json` | Complete analysis data (JSON) |

## Analysis Aspects

### Stack Balance

The analyzer simulates WASM's three-stack validation algorithm (from the [WASM spec](https://webassembly.github.io/spec/core/appendix/algorithm.html)):

- **Value Stack (vals)**: Tracks types of values on operand stack
- **Control Stack (ctrls)**: Tracks block nesting and stack heights
- **Initialization Stack (inits)**: Tracks initialized local variables

Common issues detected:
```
type mismatch at end of `if true` branch, expected [] but got [i32]
Stack underflow at instruction 42
Function ends with 2 values on stack
```

### Type Consistency

Verifies:
- Function call argument types match signatures
- Numeric literal types are correct
- Type conversion operations are valid

### Control Flow

Validates:
- Block structure (if/loop nesting)
- Branch depths don't exceed control stack
- All blocks are properly closed

### Code Metrics

- Instruction frequency distribution
- Function size (in instructions)
- Stack depth per function
- Branch and call counts
- Local variable counts

## Report Formats

### Text Report (Default)

```
================================================================================
                    WASM COMPILATION ANALYSIS REPORT
================================================================================
Generated: 2026-01-20T14:00:00.000Z

EXECUTIVE SUMMARY
────────────────────────────────────────────────────────────────────────────────

Overall Status: ✓ ALL CHECKS PASSED

Module Statistics:
  • Total Functions:     42
  • Total Instructions:  2847
  • Type Signatures:     18
  • Global Variables:    5

Validation Results:
  ✓ Stack Balance:       PASS
  ✓ Type Consistency:    PASS
  ✓ Control Flow:        PASS
```

### JSON Report

```javascript
{
  "timestamp": "2026-01-20T14:00:00.000Z",
  "summary": {
    "totalFunctions": 4,
    "totalTypes": 50,
    "totalGlobals": 8,
    "totalInstructions": 66,
    "stackValid": true,
    "typeValid": true,
    "controlFlowValid": true
  },
  "stackBalance": { /* ... */ },
  "metrics": { /* ... */ }
}
```

### JUnit XML (for CI/CD)

Generates JUnit-compatible XML for integration with CI systems.

## Integration with Build Process

### package.json

```json
{
  "scripts": {
    "compile": "swift run blitz3d-wasm input.bb -o output.wasm",
    "analyze": "node Tools/analyzer/cli.js output.wasm",
    "test": "npm run compile && npm run analyze"
  }
}
```

### GitHub Actions

```yaml
- name: Compile and Analyze
  run: |
    swift run blitz3d-wasm Main.bb -o Main.wasm
    node Tools/analyzer/cli.js Main.wasm

- name: Upload Analysis
  uses: actions/upload-artifact@v4
  with:
    name: wasm-analysis
    path: Tools/analyzer/visualization/
```

## API Reference

### WASMAnalyzer

```javascript
// Create analyzer from file
const analyzer = await WASMAnalyzer.fromFile('output.wasm');

// Generate full report
const report = analyzer.generateReport();

// Access specific analyses
const stackReport = analyzer.analyzeStackBalance();
const typeReport = analyzer.analyzeTypeConsistency();
const cfReport = analyzer.analyzeControlFlow();
const metrics = analyzer.calculateMetrics();
```

### ReportGenerator

```javascript
const generator = new ReportGenerator(analysis);

// Generate different formats
const text = generator.generateTextReport();
const json = generator.generateJSONReport();
const markdown = generator.generateMarkdownReport();
const junit = generator.generateJUnitXML();

// Save to file
generator.saveReport('report.txt', 'text');
generator.saveReport('report.json', 'json');
```

## Dependencies

Uses **@webassemblyjs/wasm-parser** for WASM binary parsing:
- AST-based parsing of WASM binaries
- Full support for all WASM instruction types
- Works in Node.js and browser environments

## Troubleshooting

### "No module parsed"

Ensure the file is a valid WASM binary:
```bash
wasm-validate output.wasm
```

### Out of memory

Increase Node.js memory limit:
```bash
node --max-old-space-size=4096 cli.js large.wasm
```

## Common Issues & Fixes

### Issue: "Type mismatch at end of if branch"

**Cause**: Function call return values not being dropped when used as statements.

**Fix**:
```blitz3d
' Before (problematic)
If SomeFunction() Then
    DoSomething()
End If

' After (fixed)
Local result = SomeFunction()
If result Then
    DoSomething()
End If
```

### Issue: "Stack too shallow"

**Cause**: Function call expects arguments on stack but they weren't pushed.

**Fix**: Ensure expression generation pushes arguments in correct order.

## Performance

The analyzer processes ~1000-5000 instructions/second. For large modules:
- Use batch processing for multiple files
- Consider parallel analysis for directory scans

## Architecture

```
Tools/analyzer/
├── core.js        # WASMAnalyzer class with stack balance, type, control flow analysis
├── visualize.js   # SVG charts and HTML dashboard generation
├── report.js      # Text/JSON/JUnit report generation
├── cli.js         # Command-line interface
├── test.js        # Test suite
├── package.json   # Dependencies
└── README.md      # This file
```

## License

MIT - See repository root for details.
