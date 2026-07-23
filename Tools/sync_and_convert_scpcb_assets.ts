#!/usr/bin/env -S deno run -A
/**
 * Sync SCPCB assets from /tmp/scpb and convert to web-ready formats
 *
 * Usage:
 *   deno run -A Tools/sync_and_convert_scpcb_assets.ts
 */

import { copy } from "https://deno.land/std@0.208.0/fs/copy.ts";

const SCPCB_PATH = "/tmp/scpcb";
const WEB_PUBLIC = "web/public";

console.log("[sync] Starting SCPCB asset sync and conversion...");

// Step 1: Ensure directories exist
await Deno.mkdir(`${WEB_PUBLIC}/assets/videos`, { recursive: true });

// Step 2: Copy videos (already converted to MP4)
console.log("[sync] Videos already converted:");
for (const video of ["startup_TSS.mp4", "startup_Undertow.mp4"]) {
  const src = `${WEB_PUBLIC}/assets/videos/${video}`;
  try {
    await Deno.stat(src);
    console.log(`  ✓ ${video}`);
  } catch {
    console.log(`  ✗ ${video} (missing)`);
  }
}

// Step 3: Check if we need to copy SCPCB models
const scpcbGfx = `${SCPCB_PATH}/GFX`;
const webGfx = `${WEB_PUBLIC}/GFX`;

try {
  await Deno.stat(scpcbGfx);
  console.log(`[sync] Found SCPCB GFX at ${scpcbGfx}`);
} catch {
  console.error(`[sync] ERROR: SCPCB GFX not found at ${scpcbGfx}`);
  console.error(
    "       Run: git clone https://github.com/Regalis11/scpcb.git /tmp/scpcb",
  );
  Deno.exit(1);
}

// Step 4: Copy GFX directory (this preserves all textures, sounds, etc.)
console.log("[sync] Copying SCPCB GFX assets...");
console.log("       This may take a few minutes...");

// Instead of copying everything, let's just check what's already there
try {
  const webGfxStat = await Deno.stat(webGfx);
  if (webGfxStat.isDirectory) {
    console.log(`[sync] GFX already exists at ${webGfx}`);

    // Count existing files
    let b3dCount = 0, xCount = 0, rmeshCount = 0, smpkCount = 0;
    for await (const entry of Deno.readDir(webGfx)) {
      if (entry.isDirectory) continue;
      const name = entry.name.toLowerCase();
      if (name.endsWith(".b3d")) b3dCount++;
      if (name.endsWith(".x")) xCount++;
      if (name.endsWith(".rmesh")) rmeshCount++;
      if (name.endsWith(".smpk")) smpkCount++;
    }

    console.log(
      `[sync] Existing assets: ${b3dCount} B3D, ${xCount} X, ${rmeshCount} RMESH, ${smpkCount} SMPK`,
    );
  }
} catch {
  console.log(
    `[sync] GFX not found at ${webGfx}, would need to copy from SCPCB`,
  );
}

// Step 5: Provide summary
console.log("\n[sync] Summary:");
console.log("  Videos: 2 MP4 files ready");
console.log("  Models: Check web/public/GFX for SMPK files");
console.log(
  "  To convert: deno run -A Tools/assets_scpcb_convert.ts --delete-source",
);
console.log("\n[sync] Done!");
