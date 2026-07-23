/**
 * WASM Output Visualization
 *
 * Generates visual representations of WASM module analysis:
 * - Control flow graphs
 * - Stack depth charts
 * - Instruction distribution
 * - Function size comparisons
 * - Error heatmaps
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { WASMAnalyzer } from "./core.js";

export class WASMVisualizer {
  constructor(analysis) {
    this.analysis = analysis;
    this.outputDir = "./visualization";
  }

  ensureOutputDir() {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateControlFlowSVG(funcIdx, instructions) {
    const nodes = [];
    const edges = [];
    let x = 0, y = 0;
    const width = 120;
    const height = 40;
    const vGap = 50;

    let currentBlock = { id: 0, instructions: [], x, y };
    let blockId = 0;

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      currentBlock.instructions.push(instr.name);

      if (instr.name === "block" || instr.name === "loop") {
        if (currentBlock.instructions.length > 0) {
          nodes.push({ ...currentBlock, id: blockId++ });
        }
        currentBlock = {
          id: blockId++,
          instructions: [],
          x,
          y: y + height + vGap,
        };
        y += height + vGap;
      }

      if (instr.name === "end") {
        if (currentBlock.instructions.length > 0) {
          nodes.push({ ...currentBlock, id: blockId++ });
        }
        currentBlock = {
          id: blockId++,
          instructions: [],
          x,
          y: y + height + vGap,
        };
        y += height + vGap;
      }

      if (instr.name === "br" || instr.name === "br_if") {
        edges.push({
          from: currentBlock.id,
          to: instr.depth,
          type: instr.name === "br" ? "unconditional" : "conditional",
        });
      }
    }

    if (currentBlock.instructions.length > 0) {
      nodes.push({ ...currentBlock, id: blockId++ });
    }

    return this.renderCFGSVG(nodes, edges);
  }

  renderCFGSVG(nodes, edges) {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">`;
    svg += `<defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#666"/>
      </marker>
      <marker id="diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
        <polygon points="0,5 5,0 10,5 5,10" fill="#666"/>
      </marker>
    </defs>`;

    nodes.forEach((node) => {
      const instrText = node.instructions.slice(0, 3).join(", ") +
        (node.instructions.length > 3 ? "..." : "");
      svg += `<g transform="translate(${node.x + 100}, ${node.y})">
        <rect width="${width}" height="${height}" fill="#f5f5f5" stroke="#333" rx="4"/>
        <text x="${width / 2}" y="${
        height / 2
      }" text-anchor="middle" dy="0.3em" font-size="11">
          Block ${node.id}
        </text>
        <text x="${width / 2}" y="${
        height / 2 + 14
      }" text-anchor="middle" dy="0.3em" font-size="9" fill="#666">
          ${instrText}
        </text>
      </g>`;
    });

    edges.forEach((edge) => {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);
      if (fromNode && toNode) {
        const stroke = edge.type === "unconditional" ? "#e74c3c" : "#3498db";
        const midY = (fromNode.y + toNode.y) / 2;
        svg += `<line x1="${fromNode.x + width}" y1="${
          fromNode.y + height / 2
        }" 
          x2="${toNode.x}" y2="${toNode.y + height / 2}" 
          stroke="${stroke}" stroke-width="2" marker-end="url(#arrowhead)"/>`;
      }
    });

    svg += "</svg>";
    return svg;
  }

  generateStackDepthChart() {
    const stackDepths = this.analysis.metrics?.stackDepths || [];

    const data = stackDepths.map((d, i) => ({
      x: `Func ${i}`,
      y: d.max || 0,
    }));

    const maxVal = Math.max(...data.map((d) => d.y), 10);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">`;
    svg += `<style>
      .bar { fill: #3498db; }
      .bar:hover { fill: #2980b9; }
      .axis { font-size: 10px; }
      .label { font-size: 12px; }
    </style>`;

    const barWidth = Math.min(30, 700 / Math.max(data.length, 1));
    const chartHeight = 300;
    const margin = { top: 40, right: 20, bottom: 60, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    data.forEach((d, i) => {
      const barHeight = (d.y / maxVal) * chartHeight;
      const x = margin.left + i * (barWidth + 2);
      const y = margin.top + chartHeight - barHeight;

      svg +=
        `<rect class="bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"/>`;
      svg += `<text class="axis" x="${x + barWidth / 2}" y="${
        margin.top + chartHeight + 15
      }" 
        text-anchor="end" transform="rotate(-45, ${x + barWidth / 2}, ${
        margin.top + chartHeight + 15
      })">
        ${d.x}
      </text>`;
      svg += `<text class="axis" x="${x + barWidth / 2}" y="${
        y - 5
      }" text-anchor="middle">${d.y}</text>`;
    });

    svg += `<text class="label" x="${
      width / 2 + margin.left
    }" y="20" text-anchor="middle">
      Maximum Stack Depth per Function
    </text>`;
    svg += `<text class="label" x="15" y="${
      height / 2 + margin.top
    }" transform="rotate(-90, 15, ${height / 2 + margin.top})" 
      text-anchor="middle">Stack Depth</text>`;

    svg += "</svg>";
    return svg;
  }

  generateInstructionDistributionChart() {
    const counts = this.analysis.metrics?.instructionCounts || {};
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    const maxVal = sorted[0]?.[1] || 1;
    const chartHeight = 300;
    const margin = { top: 40, right: 20, bottom: 100, left: 100 };
    const width = 700 - margin.left - margin.right;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400">`;
    svg += `<style>
      .bar { fill: #2ecc71; }
      .bar-label { font-size: 10px; }
      .count-label { font-size: 10px; }
    </style>`;

    sorted.forEach(([instr, count], i) => {
      const barHeight = (count / maxVal) * chartHeight;
      const x = margin.left;
      const y = margin.top + i * (chartHeight / sorted.length);
      const barWidth = (count / maxVal) * width;

      svg += `<g>
        <text class="bar-label" x="${margin.left - 5}" y="${
        y + 12
      }" text-anchor="end">${instr}</text>
        <rect class="bar" x="${x}" y="${y + 2}" width="${barWidth}" height="${
        chartHeight / sorted.length - 4
      }"/>
        <text class="count-label" x="${x + barWidth + 5}" y="${
        y + 14
      }">${count}</text>
      </g>`;
    });

    svg += `<text x="${
      width / 2 + margin.left
    }" y="20" text-anchor="middle" font-weight="bold">
      Top 15 Instructions by Frequency
    </text>`;
    svg += "</svg>";
    return svg;
  }

  generateFunctionSizeChart() {
    const sizes = this.analysis.metrics?.functionSizes || [];

    const data = sizes.map((size, i) => ({
      func: `Func ${i}`,
      size,
    })).sort((a, b) => b.size - a.size);

    const maxVal = Math.max(...data.map((d) => d.size), 1);
    const chartHeight = 300;
    const margin = { top: 40, right: 20, bottom: 60, left: 50 };
    const width = 800 - margin.left - margin.right;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">`;
    svg += `<style>
      .bar { fill: #9b59b6; }
      .axis { font-size: 9px; }
    </style>`;

    const topN = data.slice(0, 20);
    const barWidth = Math.min(25, (width / topN.length) - 2);

    topN.forEach((d, i) => {
      const barHeight = (d.size / maxVal) * chartHeight;
      const x = margin.left + i * (barWidth + 2);
      const y = margin.top + chartHeight - barHeight;

      svg +=
        `<rect class="bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"/>`;
      svg += `<text class="axis" x="${x + barWidth / 2}" y="${
        margin.top + chartHeight + 15
      }" 
        text-anchor="end" transform="rotate(-45, ${x + barWidth / 2}, ${
        margin.top + chartHeight + 15
      })">
        ${d.func}
      </text>`;
      svg += `<text class="axis" x="${x + barWidth / 2}" y="${
        y - 3
      }" text-anchor="middle" font-size="8">
        ${d.size}
      </text>`;
    });

    svg += `<text x="${
      width / 2 + margin.left
    }" y="20" text-anchor="middle" font-weight="bold">
      Function Size Distribution (Top 20)
    </text>`;
    svg += "</svg>";
    return svg;
  }

  generateErrorHeatmap() {
    const errors = this.analysis.stackBalance?.errors || [];

    // Group errors by function and type
    const errorMap = {};
    errors.forEach((err) => {
      const match = err.match(/at instruction (\d+)/);
      const idx = match ? parseInt(match[1]) : 0;
      const type = err.includes("Type")
        ? "type"
        : err.includes("Stack")
        ? "stack"
        : "other";
      errorMap[idx] = (errorMap[idx] || 0) + 1;
    });

    const entries = Object.entries(errorMap).map(([idx, count]) => ({
      idx: parseInt(idx),
      count,
    }));
    const maxCount = Math.max(...entries.map((e) => e.count), 1);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 100">`;
    svg += `<style>
      .cell { stroke: #fff; }
      .label { font-size: 10px; }
    </style>`;

    entries.forEach((e, i) => {
      const x = i * 15;
      const intensity = e.count / maxCount;
      const color = `rgb(${255}, ${255 - intensity * 200}, ${
        255 - intensity * 200
      })`;

      svg +=
        `<rect class="cell" x="${x}" y="10" width="14" height="40" fill="${color}"/>`;
      svg += `<text class="label" x="${
        x + 7
      }" y="65" text-anchor="middle">${e.idx}</text>`;
    });

    svg +=
      `<text x="300" y="85" text-anchor="middle" font-size="12">Error Distribution by Instruction Index</text>`;
    svg += "</svg>";
    return svg;
  }

  generateSummaryDashboard() {
    const summary = this.analysis.summary || {};
    const metrics = this.analysis.metrics || {};

    const passColor =
      summary.stackValid && summary.typeValid && summary.controlFlowValid
        ? "#27ae60"
        : "#e74c3c";

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>WASM Analysis Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
           margin: 20px; background: #f5f5f5; }
    .dashboard { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
    .status-card { background: ${passColor}; color: white; padding: 20px; 
                   border-radius: 8px; display: inline-block; margin-right: 20px; }
    .status-card h2 { margin: 0; font-size: 48px; }
    .status-card p { margin: 5px 0 0; opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px; }
    .card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .card h3 { margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .metric:last-child { border-bottom: none; }
    .metric-value { font-weight: bold; color: #667eea; }
    .error-list { max-height: 300px; overflow-y: auto; }
    .error { padding: 8px; margin: 5px 0; background: #fee; border-left: 3px solid #e74c3c; 
             font-family: monospace; font-size: 12px; }
    .warning { background: #fef9e7; border-left-color: #f39c12; }
    .chart { width: 100%; height: 300px; }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>WASM Compilation Analysis</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <div style="margin-top: 20px;">
        <div class="status-card">
          <h2>${summary.totalFunctions || 0}</h2>
          <p>Functions</p>
        </div>
        <div class="status-card">
          <h2>${summary.totalInstructions || 0}</h2>
          <p>Instructions</p>
        </div>
        <div class="status-card">
          <h2>${summary.stackValid ? "✓" : "✗"}</h2>
          <p>Stack Valid</p>
        </div>
        <div class="status-card">
          <h2>${summary.typeValid ? "✓" : "✗"}</h2>
          <p>Types Valid</p>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Stack Depth Analysis</h3>
        <div class="metric">
          <span>Maximum Stack Depth</span>
          <span class="metric-value">${metrics.maxStackObserved || 0}</span>
        </div>
        <div class="metric">
          <span>Average Stack Depth</span>
          <span class="metric-value">${
      metrics.stackDepths?.length
        ? (metrics.stackDepths.reduce((sum, d) => sum + (d.max || 0), 0) /
          metrics.stackDepths.length).toFixed(1)
        : 0
    }</span>
        </div>
      </div>

      <div class="card">
        <h3>Function Metrics</h3>
        <div class="metric">
          <span>Average Function Size</span>
          <span class="metric-value">${
      metrics.functionSizes?.length
        ? Math.round(
          metrics.functionSizes.reduce((a, b) => a + b, 0) /
            metrics.functionSizes.length,
        )
        : 0
    } instructions</span>
        </div>
        <div class="metric">
          <span>Largest Function</span>
          <span class="metric-value">${
      Math.max(...metrics.functionSizes, 0)
    } instructions</span>
        </div>
        <div class="metric">
          <span>Total Locals</span>
          <span class="metric-value">${
      metrics.localCounts?.reduce((a, b) => a + b, 0) || 0
    }</span>
        </div>
      </div>

      <div class="card">
        <h3>Control Flow</h3>
        <div class="metric">
          <span>Branch Instructions</span>
          <span class="metric-value">${
      metrics.branchCounts?.reduce((sum, c) => sum + c.branches, 0) || 0
    }</span>
        </div>
        <div class="metric">
          <span>Function Calls</span>
          <span class="metric-value">${
      metrics.callCounts?.reduce((sum, c) => sum + c.calls, 0) || 0
    }</span>
        </div>
      </div>

      <div class="card">
        <h3>Errors & Warnings</h3>
        <div class="error-list">
          ${
      (this.analysis.errors || []).slice(0, 20).map((e) =>
        `<div class="error">${e}</div>`
      ).join("")
    }
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  generateAll() {
    this.ensureOutputDir();

    // Generate summary dashboard
    const dashboard = this.generateSummaryDashboard();
    writeFileSync(`${this.outputDir}/dashboard.html`, dashboard);

    // Generate charts
    const stackChart = this.generateStackDepthChart();
    writeFileSync(`${this.outputDir}/stack-depth.svg`, stackChart);

    const instrChart = this.generateInstructionDistributionChart();
    writeFileSync(`${this.outputDir}/instructions.svg`, instrChart);

    const sizeChart = this.generateFunctionSizeChart();
    writeFileSync(`${this.outputDir}/function-sizes.svg`, sizeChart);

    const errorHeatmap = this.generateErrorHeatmap();
    writeFileSync(`${this.outputDir}/errors.svg`, errorHeatmap);

    // Generate JSON report
    writeFileSync(
      `${this.outputDir}/analysis.json`,
      JSON.stringify(this.analysis, null, 2),
    );

    return {
      dashboard: `${this.outputDir}/dashboard.html`,
      stackChart: `${this.outputDir}/stack-depth.svg`,
      instrChart: `${this.outputDir}/instructions.svg`,
      sizeChart: `${this.outputDir}/function-sizes.svg`,
      errorHeatmap: `${this.outputDir}/errors.svg`,
      jsonReport: `${this.outputDir}/analysis.json`,
    };
  }
}

export function visualizeAnalysis(analysis) {
  const visualizer = new WASMVisualizer(analysis);
  return visualizer.generateAll();
}

export async function visualizeFile(filepath) {
  const analysis = await WASMAnalyzer.fromFile(filepath);
  const report = analysis.generateReport();
  const visualizer = new WASMVisualizer(report);
  return visualizer.generateAll();
}
