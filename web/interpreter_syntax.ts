// Pure (non-DOM) helpers for the Blitz3D interpreter editor UI.

const escapeHtml = (s: string): string => {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const blitzKeywords = new Set(
  [
    "if",
    "then",
    "else",
    "elseif",
    "endif",
    "select",
    "case",
    "default",
    "endselect",
    "for",
    "to",
    "step",
    "next",
    "while",
    "wend",
    "repeat",
    "until",
    "forever",
    "exit",
    "continue",
    "gosub",
    "goto",
    "return",
    "function",
    "endfunction",
    "type",
    "endtype",
    "field",
    "new",
    "delete",
    "first",
    "last",
    "after",
    "before",
    "dim",
    "local",
    "global",
    "const",
    "include",
    "data",
    "read",
    "restore",
    "true",
    "false",
    "null",
    "and",
    "or",
    "not",
    "xor",
    "mod",
  ],
);

const blitzBuiltins = new Set(
  [
    // common across demos
    "print",
    "debuglog",
    "graphics3d",
    "setbuffer",
    "backbuffer",
    "frontbuffer",
    "flip",
    "cls",
    "appterminate",
    "keyhit",
    "keydown",
    "mousex",
    "mousey",
    "mousehit",
    "createcamera",
    "createcube",
    "createsphere",
    "createlight",
    "positionentity",
    "rotateentity",
    "scaleentity",
    "entitycolor",
    "entityalpha",
    "entityfx",
    "cameraclscolor",
    "camerazoom",
    "camerafogmode",
    "camerafogrange",
    "camerafogcolor",
    "renderworld",
    "loadtexture",
    "loadimage",
    "drawimage",
    "text",
    "color",
    "rect",
    "line",
    "sin",
    "cos",
    "tan",
    "abs",
    "sqrt",
    "rand",
    "seedrnd",
    "millisecs",
  ],
);

const isWordChar = (c: string): boolean => /[A-Za-z0-9_]/.test(c);

export function highlightBlitzBasicToHtml(
  source: string,
): { html: string; lineCount: number } {
  const normalized = String(source || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const out: string[] = [];
  let inRemBlock = false;

  for (const lineRaw of lines) {
    const line = String(lineRaw ?? "");
    const trimmed = line.trimStart();

    if (inRemBlock) {
      out.push(`<span class="tok comment">${escapeHtml(line)}</span>`);
      if (/^end\s*rem\b/i.test(trimmed)) inRemBlock = false;
      continue;
    }

    if (/^rem\b/i.test(trimmed)) {
      inRemBlock = true;
      out.push(`<span class="tok comment">${escapeHtml(line)}</span>`);
      continue;
    }

    out.push(highlightBlitzBasicLine(line));
  }

  return { html: out.join("\n"), lineCount: lines.length };
}

export function highlightBlitzBasicLine(line: string): string {
  let i = 0;
  let out = "";

  const emit = (cls: string, text: string) => {
    if (!text) return;
    out += `<span class="tok ${cls}">${escapeHtml(text)}</span>`;
  };
  const emitRaw = (text: string) => {
    if (!text) return;
    out += escapeHtml(text);
  };

  while (i < line.length) {
    const ch = line[i]!;

    // Strings: " ... "
    if (ch === "\"") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\"") {
          // allow "" inside a string
          if (line[j + 1] === "\"") {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      emit("string", line.slice(i, j));
      i = j;
      continue;
    }

    // Line comments: ' or ;
    if (ch === "'" || ch === ";") {
      emit("comment", line.slice(i));
      break;
    }

    // Whitespace
    if (ch === " " || ch === "\t") {
      let j = i + 1;
      while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
      emitRaw(line.slice(i, j));
      i = j;
      continue;
    }

    // Numbers (decimal / float) + optional sign.
    if (ch === "-" || ch === "+" || (ch >= "0" && ch <= "9")) {
      const next = line[i + 1] ?? "";
      const isNumStart = (ch >= "0" && ch <= "9") ||
        ((ch === "-" || ch === "+") && (next >= "0" && next <= "9"));
      if (isNumStart) {
        let j = i + 1;
        while (j < line.length && /[0-9.]/.test(line[j]!)) j++;
        emit("number", line.slice(i, j));
        i = j;
        continue;
      }
    }

    // Hex numbers: $FF
    if (ch === "$") {
      let j = i + 1;
      while (j < line.length && /[0-9a-fA-F]/.test(line[j]!)) j++;
      emit("number", line.slice(i, j));
      i = j;
      continue;
    }

    // Identifiers / keywords / builtins (with optional type suffixes).
    if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_") {
      let j = i + 1;
      while (j < line.length && isWordChar(line[j]!)) j++;
      // type suffixes ($ % # !)
      if (j < line.length && /[$%#!]/.test(line[j]!)) j++;
      const raw = line.slice(i, j);
      const core = raw.replace(/[$%#!]$/, "");
      const lower = core.toLowerCase();

      if (lower === "type" || lower === "endtype") {
        emit("type", raw);
      } else if (blitzKeywords.has(lower)) {
        emit("keyword", raw);
      } else if (blitzBuiltins.has(lower)) {
        emit("builtin", raw);
      } else {
        emit("ident", raw);
      }
      i = j;
      continue;
    }

    // Operators/punct
    if (/[*\\/=<>()\\[\\],.:^]/.test(ch)) {
      emit("operator", ch);
      i += 1;
      continue;
    }

    emitRaw(ch);
    i += 1;
  }

  return out;
}

