#!/usr/bin/env -S deno run -A
/**
 * Texture Optimization Tool
 * - Scans for texture files
 * - Mode 1 (Default): Converts .bmp -> .png using `sips` (macOS).
 * - Mode 2 (--format ktx2): Converts .png/.jpg/.bmp -> .ktx2 using `toktx`.
 * - Options to delete source files.
 *
 * Usage:
 *   deno run -A Tools/optimize_textures.ts --root web/public
 *   deno run -A Tools/optimize_textures.ts --root dist/assets --format ktx2
 *   deno run -A Tools/optimize_textures.ts --check-tools
 */

type Args = {
    root: string;
    deleteSource: boolean;
    format: "png" | "ktx2";
    checkTools: boolean;
};

const parseArgs = (): Args => {
    if (Deno.args.includes("--check-tools") || Deno.args.includes("-h") || Deno.args.includes("--help")) {
        return { root: "", deleteSource: false, format: "png", checkTools: true };
    }

    const rootIdx = Deno.args.findIndex((a) => a === "--root");
    const root = rootIdx >= 0 ? (Deno.args[rootIdx + 1] ?? "web/public") : "web/public";

    // Check for format override
    let format: "png" | "ktx2" = "png";
    const formatIdx = Deno.args.findIndex((a) => a === "--format");
    if (formatIdx >= 0) {
        const val = Deno.args[formatIdx + 1]?.toLowerCase();
        if (val === "ktx2") format = "ktx2";
    }

    const deleteSource = Deno.args.includes("--delete-source");
    return { root, deleteSource, format, checkTools: false };
};

const walk = async function* (dir: string): AsyncGenerator<string> {
    for await (const entry of Deno.readDir(dir)) {
        const p = `${dir}/${entry.name}`;
        if (entry.isDirectory) {
            yield* walk(p);
            continue;
        }
        if (!entry.isFile) continue;
        yield p;
    }
};

const run = async (cmd: string[], cwd?: string) => {
    try {
        const p = new Deno.Command(cmd[0]!, { args: cmd.slice(1), cwd, stdout: "inherit", stderr: "inherit" }).spawn();
        const { code } = await p.status;
        if (code !== 0) {
            throw new Error(`command failed (${code}): ${cmd.join(" ")}`);
        }
    } catch (e) {
        throw new Error(`failed to run ${cmd[0]}: ${e}`);
    }
};

const checkTool = async (cmd: string) => {
    try {
        const p = new Deno.Command(cmd, { args: ["--version"], stdout: "null", stderr: "null" }).spawn();
        return (await p.status).code === 0;
    } catch { return false; }
};

const main = async () => {
    const args = parseArgs();

    if (args.checkTools) {
        const sips = await checkTool("sips");
        const toktx = await checkTool("toktx");
        const basisu = await checkTool("basisu");
        console.log(`[textures] Tool Check:`);
        console.log(`  sips (BMP->PNG): ${sips ? "OK" : "MISSING"}`);
        console.log(`  toktx (KTX2):    ${toktx ? "OK" : "MISSING"}`);
        console.log(`  basisu (KTX2):   ${basisu ? "OK" : "MISSING"}`);
        return;
    }

    console.log(`[textures] Scanning ${args.root} (Target: ${args.format.toUpperCase()})...`);

    if (args.format === "ktx2") {
        await convertToKtx2(args);
    } else {
        await convertBmpToPng(args);
    }
};

// --- BMP -> PNG Logic ---

const convertBmpToPng = async (args: Args) => {
    const hasSips = await checkTool("sips");
    if (!hasSips) {
        console.warn("[textures] 'sips' not found. Skipping BMP->PNG conversion.");
        return;
    }

    const files: string[] = [];
    for await (const p of walk(args.root)) {
        if (p.toLowerCase().endsWith(".bmp")) files.push(p);
    }

    console.log(`[textures] Found ${files.length} .bmp files`);
    if (files.length === 0) return;

    let converted = 0;
    for (const p of files) {
        const dest = p.replace(/\.bmp$/i, ".png");
        if (await isUpToDate(p, dest)) {
            if (args.deleteSource) await Deno.remove(p);
            continue;
        }

        try {
            await run(["sips", "-s", "format", "png", p, "--out", dest]);
            converted++;
            if (args.deleteSource) await Deno.remove(p);
        } catch (e) {
            console.error(`[textures] Failed to convert ${p}: ${e}`);
        }
    }
    console.log(`[textures] Converted ${converted} BMPs to PNG`);
};

// --- KTX2 Logic ---

const convertToKtx2 = async (args: Args) => {
    const hasToktx = await checkTool("toktx");
    if (!hasToktx) {
        console.warn("[textures] 'toktx' not found. Skipping KTX2 conversion.");
        console.warn("Install KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases");
        return;
    }

    const files: string[] = [];
    for await (const p of walk(args.root)) {
        const lower = p.toLowerCase();
        // Convert PNG, JPG, BMP to KTX2
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".bmp")) {
            files.push(p);
        }
    }

    console.log(`[textures] Found ${files.length} candidate files for KTX2 conversion`);
    if (files.length === 0) return;

    let converted = 0;
    for (const p of files) {
        const dest = p.replace(/\.(png|jpg|jpeg|bmp)$/i, ".ktx2");
        if (await isUpToDate(p, dest)) continue;

        try {
            // --t2 for UASTC (best for web), --genmipmap for mipmaps
            await run(["toktx", "--t2", "--genmipmap", dest, p]);
            converted++;
            // Note: We rarely delete source for KTX2, as it's a derived format. 
            // If deleteSource is true, we respect it, but typically we keep sources for KTX2 workflow.
            if (args.deleteSource) await Deno.remove(p);
        } catch (e) {
            console.error(`[textures] Failed to convert ${p}: ${e}`);
        }
    }
    console.log(`[textures] Generated ${converted} KTX2 texture(s).`);
};

// --- Helpers ---

const isUpToDate = async (src: string, dest: string) => {
    try {
        const srcStat = await Deno.stat(src);
        const destStat = await Deno.stat(dest);
        // If dest is newer than src, it's up to date
        if (destStat.mtime && srcStat.mtime && destStat.mtime > srcStat.mtime) {
            return true;
        }
    } catch {
        // Dest likely doesn't exist
    }
    return false;
};

if (import.meta.main) {
    await main();
}
