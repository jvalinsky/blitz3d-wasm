export const normalizePath = (p: string) =>
  String(p || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

export const rewriteSourceModelPath = (p: string) =>
  p.replace(/\.(b3d|x|rmesh)$/i, ".smpk");

export const openFileCandidates = (path: string): string[] => {
  const rp = normalizePath(path);
  const rpLower = rp.toLowerCase();
  const rewritten = rewriteSourceModelPath(rp);

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    const r = normalizePath(p);
    if (!r) return;
    const k = r.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(r);
  };

  push(rp);
  if (rewritten !== rp) push(rewritten);

  if (!rpLower.startsWith("assets/")) {
    push(`assets/${rp}`);
    if (rewritten !== rp) push(`assets/${rewritten}`);
  } else {
    const stripped = rp.slice("assets/".length);
    push(stripped);
    const strippedRewritten = rewriteSourceModelPath(stripped);
    if (strippedRewritten !== stripped) push(strippedRewritten);
  }

  // Dev convenience: some older manifests/servers place Data/* at root.
  if (rpLower.startsWith("data/")) {
    const stripped = rp.slice("data/".length);
    push(stripped);
    const strippedRewritten = rewriteSourceModelPath(stripped);
    if (strippedRewritten !== stripped) push(strippedRewritten);
    if (!rpLower.startsWith("assets/")) {
      push(`assets/${stripped}`);
      if (strippedRewritten !== stripped) push(`assets/${strippedRewritten}`);
    }
  }

  return out;
};
