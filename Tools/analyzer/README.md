# WASM Analyzer for Blitz3D Compiler

Comprehensive analysis toolkit for validating and debugging WebAssembly output from the Blitz3D compiler.

## Features

- **Stack Balance Validation**: Verify WASM modules don't have stack underflow/overflow
- **Type Checking**: Detect type mismatches in function calls and operations
- **Control Flow Analysis**: Validate block structure and branch depths
- **Code Metrics**: Instruction counts, function sizes, stack depths
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
```

### Programmatic Usage

```javascript
import { WASMAnalyzer } from './index.js';
import { visualizeAnalysis } from './visualize.js';
import { generateReport } from './report.js';

// Analyze a WASM file
const analysis = await WASMAnalyzer.fromFile('output.wasm');
const report = analysis.generateReport();

// Generate visualizations
const files = visualizeAnalysis(report);

// Generate text report
const textReport = generateReport(report);
console.log(textReport);
```

## Output Files

When analyzing, the following files are generated in the output directory:

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

The analyzer simulates WASM's three-stack validation algorithm:
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

Common issues:
```
type mismatch in call, expected [i32, f32] but got [f32, i32]
Local 5 used before initialization
```

### Control Flow

Validates:
- Block structure (if/loop/block nesting)
- Branch depths don't exceed control stack
- All blocks are properly closed

Common issues:
```
Invalid branch depth: 5 (max is 3)
Function ends with block depth 1
```

## Report Formats

### Text Report (Default)

```
================================================================================
                    WASM COMPILATION ANALYSIS REPORT
================================================================================
Generated: 2026-01-20T12:00:00.000Z
Blitz3D WASM Compiler Analysis Tool
================================================================================

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

```bash
node cli.js output.wasm -o ./analysis --format json
```

### JUnit XML (for CI/CD)

```bash
node cli.js output.wasm -o ./junit-results.xml --format junit
```

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
    path: analysis-output/
```

## Visualizations

### Interactive Dashboard

Open `dashboard.html` in a browser to see:
- Summary statistics cards
- Stack depth per function chart
- Instruction distribution
- Error list with filtering
- Function size comparison

### Charts

The generated SVG charts can be embedded in documentation:

```html
<img src="stack-depth.svg" alt="Stack depth analysis" />
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

### Issue: "Invalid branch depth"

**Cause**: Branch instruction references control frame that doesn't exist.

**Fix**: Check branch depth matches actual control stack depth at that point.

## API Reference

### WASMAnalyzer

```javascript
// Create analyzer from file
const analyzer = await WASMAnalyzer.fromFile('output.wasm');

// Or from buffer
const buffer = readFileSync('output.wasm');
const analyzer = new WASMAnalyzer(buffer).parse();

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
generator.saveReport('junit.xml', 'junit');
```

### WASMVisualizer

```javascript
const visualizer = new WASMVisualizer(analysis);

// Generate all visualizations
const files = visualizer.generateAll();

// Or generate specific charts
const stackChart = visualizer.generateStackDepthChart();
const cfvGraph = visualizer.generateControlFlowSVG(funcIdx, instructions);
```

## Performance

The analyzer processes ~1000 instructions/second on typical hardware. For large modules:
- Use streaming for files >10MB
- Consider parallel analysis of multiple files

## Troubleshooting

### "No code section found"

The WASM file may be a minimal module without functions, or corrupted.

### "Parse error"

Ensure the file is a valid WASM binary. Try:
```bash
wasm-validate output.wasm
```

### Out of memory

Increase Node.js memory limit:
```bash
node --max-old-space-size=4096 cli.js large.wasm
```

## Contributing

To add new analysis checks:

1. Create analysis method in `index.js`
2. Add to `generateReport()` 
3. Update `WASMVisualizer` for new metrics
4. Add tests in `test/`

## License

MIT - See repository root for details.
