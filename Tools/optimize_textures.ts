#!/usr/bin/env -S deno run -A
/**
 * Texture Optimization Tool
 * - Scans for .bmp files
 * - Converts them to .png using `sips` (macOS) or `convert` (ImageMagick) if available.
 * - Options to delete source files.
 *
 * Usage:
 *   deno run -A Tools/optimize_textures.ts --root web/public
 *   deno run -A Tools/optimize_textures.ts --root web/public --delete-source
 */

type Args = {
    root: string;
    deleteSource: boolean;
};

const parseArgs = (): Args => {
    const rootIdx = Deno.args.findIndex((a) => a === "--root");
    const root = rootIdx >= 0 ? (Deno.args[rootIdx + 1] ?? "web/public") : "web/public";
    const deleteSource = Deno.args.includes("--delete-source");
    return { root, deleteSource };
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
        const p = new Deno.Command(cmd[0]!, { args: cmd.slice(1), cwd, stdout: "null", stderr: "piped" }).spawn();
        const { code, stderr } = await p.status;
        if (code !== 0) {
            const errText = new TextDecoder().decode(stderr);
            throw new Error(`command failed (${code}): ${errText}`);
        }
    } catch (e) {
        throw new Error(`failed to run ${cmd[0]}: ${e}`);
    }
};

const hasSips = async () => {
    try {
        const p = new Deno.Command("sips", { args: ["--version"], stdout: "null", stderr: "null" }).spawn();
        return (await p.status).code === 0;
    } catch { return false; }
}

const main = async () => {
    const args = parseArgs();
    console.log(`[textures] Scanning ${args.root}...`);

    const bmpFiles: string[] = [];
    for await (const p of walk(args.root)) {
        if (p.toLowerCase().endsWith(".bmp")) {
            bmpFiles.push(p);
        }
    }

    console.log(`[textures] Found ${bmpFiles.length} .bmp files`);

    if (bmpFiles.length === 0) return;

    const useSips = await hasSips();
    if (!useSips) {
        console.warn("[textures] 'sips' not found. Skipping conversion (this tool currently relies on macOS sips).");
        return;
    }

    let converted = 0;
    for (const p of bmpFiles) {
        const pngBox = p.replace(/\.bmp$/i, ".png");

        // Check if png already exists and is newer?
        try {
            const bmpStat = await Deno.stat(p);
            try {
                const pngStat = await Deno.stat(pngBox);
                if (pngStat.mtime && bmpStat.mtime && pngStat.mtime > bmpStat.mtime) {
                    // PNG is newer, skip
                    if (args.deleteSource) await Deno.remove(p);
                    continue;
                }
            } catch {
                // PNG doesn't exist, proceed
            }
        } catch { }

        try {
            await run(["sips", "-s", "format", "png", p, "--out", pngBox]);
            converted++;
            if (args.deleteSource) {
                await Deno.remove(p);
            }
        } catch (e) {
            console.error(`[textures] Failed to convert ${p}: ${e}`);
        }
    }

    console.log(`[textures] Converted ${converted} BMPs to PNG`);
};

if (import.meta.main) {
    await main();
}
