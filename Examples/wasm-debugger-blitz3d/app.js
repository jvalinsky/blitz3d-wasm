// Minimal, dependency-free visualizer for BB ↔ WASM mapping.
// Uses sample files in /data but can host real instrumented WASM via bbdbg imports.

const CONFIG = {
  sourceUrl: 'data/sample.bb',
  mappingUrl: 'data/sample.bbdbg.json',
  watUrl: 'data/sample.wat',
  traceUrl: 'data/sample.trace.json', // optional; if wasmUrl is set and bbdbg events are captured, this is ignored
  wasmUrl: null, // set to wasm path when available
  entryExport: 'main'
};

async function loadText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.text();
}

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json();
}

class DebugSession {
  constructor({ mapping, sourceText, watText, trace }) {
    this.mapping = mapping;
    this.sourceLines = sourceText.split(/\r?\n/);
    this.watLines = watText.split(/\r?\n/);
    this.trace = trace || [];
    this.ptr = 0;
    this.stack = [];
    this.current = null;
  }

  reset() {
    this.ptr = 0;
    this.stack = [];
    this.current = null;
  }

  nextEvent() {
    if (this.ptr >= this.trace.length) return null;
    return this.trace[this.ptr++];
  }
}

function renderCode(el, lines, currentSpan) {
  el.innerHTML = '';
  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const lineEl = document.createElement('div');
    lineEl.className = 'line';
    if (currentSpan && lineNumber >= currentSpan.startLine && lineNumber <= currentSpan.endLine) {
      lineEl.classList.add('current');
    }
    lineEl.innerHTML = `<span class="ln">${lineNumber.toString().padStart(4, ' ')} </span>${line.replace(/</g,'&lt;')}`;
    el.appendChild(lineEl);
  });
}

function scrollCurrentIntoView(container) {
  const current = container.querySelector('.line.current');
  if (current) {
    current.scrollIntoView({ block: 'center' });
  }
}

function renderStack(el, stack, mapping) {
  el.innerHTML = '';
  stack.slice().reverse().forEach(frameId => {
    const li = document.createElement('li');
    const func = mapping.symbols?.funcs?.find(f => f.funcId === frameId);
    li.textContent = func ? func.name : `frame ${frameId}`;
    el.appendChild(li);
  });
}

function findSpan(mapping, stmtId) {
  const stmt = mapping.stmts.find(s => s.stmtId === stmtId);
  if (!stmt) return null;
  return mapping.spans.find(sp => sp.spanId === stmt.spanId) || null;
}

function findWasmSite(mapping, stmtId) {
  return mapping.wasm?.stmtSites?.find(s => s.stmtId === stmtId) || null;
}

function renderStatus(session, mapping) {
  const current = session.current;
  document.getElementById('currentStmt').textContent = current?.stmtId ?? '—';
  const funcName = mapping.symbols?.funcs?.find(f => f.funcId === current?.funcId)?.name;
  document.getElementById('currentFunc').textContent = funcName || (current?.funcId ?? '—');
  renderStack(document.getElementById('stack'), session.stack, mapping);
}

function highlightWasm(el, lines, site) {
  el.innerHTML = '';
  let seenStmt = 0;
  lines.forEach((line, idx) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'line';
    const isStmtCall = line.includes('bb_stmt');
    if (site && isStmtCall) {
      if (seenStmt === site.siteIndex) lineEl.classList.add('current');
      seenStmt++;
    }
    lineEl.innerHTML = `<span class="ln">${(idx+1).toString().padStart(4,' ')} </span>${line.replace(/</g,'&lt;')}`;
    el.appendChild(lineEl);
  });
}

function attachControls(session, mapping, sourceLines, watLines) {
  const bbEl = document.getElementById('bbSource');
  const wasmEl = document.getElementById('wasmSource');
  const statusEl = document.getElementById('status');

  function render() {
    const span = session.current ? findSpan(mapping, session.current.stmtId) : null;
    renderCode(bbEl, sourceLines, span);
    const site = session.current ? findWasmSite(mapping, session.current.stmtId) : null;
    highlightWasm(wasmEl, watLines, site);
    renderStatus(session, mapping);
    scrollCurrentIntoView(bbEl);
    scrollCurrentIntoView(wasmEl);
  }

  async function stepOnce() {
    const ev = session.nextEvent();
    if (!ev) {
      statusEl.textContent = 'End of trace';
      return;
    }
    switch (ev.op) {
      case 'enter':
        session.stack.push(ev.funcId ?? ev.frameId);
        session.current = { funcId: ev.funcId, stmtId: null, siteIndex: null };
        break;
      case 'stmt':
        session.current = { funcId: session.stack.at(-1) ?? 0, stmtId: ev.stmtId, siteIndex: ev.siteIndex };
        break;
      case 'leave':
        session.stack.pop();
        session.current = null;
        break;
    }
    statusEl.textContent = '';
    render();
  }

  document.getElementById('btnStep').onclick = stepOnce;
  document.getElementById('btnReset').onclick = () => {
    session.reset();
    statusEl.textContent = 'Reset';
    render();
  };
  document.getElementById('btnContinue').onclick = async () => {
    while (session.ptr < session.trace.length) {
      await stepOnce();
      await new Promise(r => setTimeout(r, 200));
    }
  };

  render();
}

async function init() {
  try {
    const [sourceText, mapping, watText] = await Promise.all([
      loadText(CONFIG.sourceUrl),
      loadJson(CONFIG.mappingUrl),
      loadText(CONFIG.watUrl)
    ]);

    // Either load a static trace, or run a real WASM with bbdbg hooks to capture a trace.
    let trace = [];
    if (CONFIG.wasmUrl) {
      trace = await runWasmAndCaptureTrace(mapping);
    } else if (CONFIG.traceUrl) {
      trace = await loadJson(CONFIG.traceUrl);
    }

    const session = new DebugSession({ mapping, sourceText, watText, trace });
    attachControls(session, mapping, session.sourceLines, session.watLines);
  } catch (err) {
    console.error(err);
    document.getElementById('status').textContent = err.message;
  }
}

async function runWasmAndCaptureTrace(mapping) {
  const events = [];
  const bbdbgImports = {
    enter: (frameId, funcId) => events.push({ op: 'enter', frameId, funcId }),
    stmt: (stmtId, siteIndex) => events.push({ op: 'stmt', stmtId, siteIndex }),
    leave: (frameId) => events.push({ op: 'leave', frameId })
  };

  const imports = { bbdbg: bbdbgImports };
  // Add minimal stubs for other namespaces if needed by your WASM:
  imports.env = imports.env || {};

  const res = await fetch(CONFIG.wasmUrl);
  const bytes = await res.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  const entry = instance.exports[CONFIG.entryExport];
  if (typeof entry !== 'function') {
    throw new Error(`Entry export ${CONFIG.entryExport} not found`);
  }
  entry();
  return events;
}

init();
