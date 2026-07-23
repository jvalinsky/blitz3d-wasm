export const normalizeRel = (p: string) => p.replace(/\\/g, "/");

export const basename = (p: string) => {
  const n = normalizeRel(p);
  const i = n.lastIndexOf("/");
  return i >= 0 ? n.slice(i + 1) : n;
};

export const buildCaseInsensitiveMap = async (dir: string) => {
  const map = new Map<string, string>();
  try {
    for await (const e of Deno.readDir(dir)) {
      if (!e.isFile) continue;
      map.set(e.name.toLowerCase(), e.name);
    }
  } catch {
    // ignore
  }
  return map;
};

export const resolveTextureName = async (
  dir: string,
  lowerNameToActual: Map<string, string>,
  rawName: string,
  destinationFormat?: string,
): Promise<string> => {
  const raw = (rawName ?? "").split("\0", 1)[0]!.trim();
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "");
  if (!cleaned) return "";
  const base = basename(cleaned).replace(/[\u0000-\u001f\u007f]/g, "");
  if (!base) return "";

  const candidates: string[] = [base];

  if (destinationFormat === "ktx2") {
    // If KTX2 is requested, it takes precedence.
    candidates.unshift(base.replace(/\.(bmp|png|jpg|jpeg|tga)$/i, ".ktx2"));
  }

  // SCPCB assets sometimes ship as PNG while formats reference BMP.
  // Also support JPG/TGA -> PNG if we do that in future.
  if (base.toLowerCase().endsWith(".bmp")) {
    candidates.push(base.replace(/\.bmp$/i, ".png"));
  }

  for (const c of candidates) {
    // Prefer the actual on-disk casing if we can find it
    const actual = lowerNameToActual.get(c.toLowerCase());
    if (actual) return actual;

    try {
      const st = await Deno.stat(`${dir}/${c}`);
      if (st.isFile) return c;
    } catch {
      // fall through
    }
  }

  // Give up: keep the basename as-is
  return base;
};
