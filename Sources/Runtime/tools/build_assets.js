#!/usr/bin/env node

/**
 * SCPCB Asset Bundle Builder
 * Creates asset bundles from SCPCB game assets for Blitz3D-WASM
 * 
 * Usage: node build_assets.js <source_dir> <output_file> [--no-compress]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Configuration
const DEFAULT_EXTENSIONS = ['.rmesh', '.bmp', '.jpg', '.png', '.b3d', '.wav', '.ogg'];
const COMPRESSION_LEVEL = 6;

class AssetBundleBuilder {
    constructor() {
        this.files = [];
        this.totalSize = 0;
    }

    /**
     * Scan a directory and collect all matching files
     */
    scanDirectory(dir, extensions) {
        console.log(`Scanning directory: ${dir}`);
        const items = fs.readdirSync(dir);
        let fileCount = 0;

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                // Recursively scan subdirectories
                const subdirFiles = this.scanDirectory(fullPath, extensions);
                fileCount += subdirFiles;
            } else if (extensions.some(ext => item.toLowerCase().endsWith(ext))) {
                // Add file to bundle
                const relPath = path.relative(dir, fullPath).replace(/\\/g, '/');
                this.addFile(relPath, fullPath);
                fileCount++;
            }
        }

        return fileCount;
    }

    /**
     * Add a file to the bundle
     */
    addFile(relPath, fullPath) {
        const stats = fs.statSync(fullPath);
        console.log(`  Adding: ${relPath} (${(stats.size / 1024).toFixed(2)} KB)`);
        
        let data = fs.readFileSync(fullPath);
        let compressed = false;
        let finalData = data;

        // Optionally compress large files
        if (data.length > 1024) {
            try {
                finalData = zlib.deflateSync(data, { level: COMPRESSION_LEVEL });
                compressed = true;
            } catch (error) {
                console.warn(`  Compression failed for ${relPath}, using uncompressed`);
            }
        }

        this.files.push({
            path: relPath,
            size: stats.size,
            compressedSize: finalData.length,
            compressed: compressed,
            mtime: stats.mtime.toISOString(),
            data: Array.from(finalData)
        });

        this.totalSize += finalData.length;
    }

    /**
     * Create and save the asset bundle
     */
    saveBundle(outputFile) {
        const bundle = {
            version: '1.0',
            created: new Date().toISOString(),
            fileCount: this.files.length,
            totalCompressedSize: this.totalSize,
            files: this.files.map(f => ({
                path: f.path,
                size: f.size,
                compressedSize: f.compressedSize,
                compressed: f.compressed,
                mtime: f.mtime,
                data: f.data
            }))
        };

        const bundleData = JSON.stringify(bundle);
        fs.writeFileSync(outputFile, bundleData);

        console.log(`\nAsset bundle created: ${outputFile}`);
        console.log(`  Files: ${bundle.fileCount}`);
        console.log(`  Compressed size: ${(this.totalSize / 1024 / 1024).toFixed(2)} MB`);

        return bundle;
    }

    /**
     * Print bundle summary
     */
    printSummary() {
        console.log('\nBundle Summary:');
        console.log(`  Total files: ${this.files.length}`);
        
        // Group by extension
        const byExt = {};
        for (const file of this.files) {
            const ext = path.extname(file.path).toLowerCase();
            if (!byExt[ext]) byExt[ext] = { count: 0, size: 0 };
            byExt[ext].count++;
            byExt[ext].size += file.size;
        }

        console.log('  By extension:');
        for (const [ext, data] of Object.entries(byExt)) {
            console.log(`    ${ext}: ${data.count} files (${(data.size / 1024 / 1024).toFixed(2)} MB)`);
        }
    }
}

/**
 * Main entry point
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node build_assets.js <source_dir> <output_file> [--no-compress]');
        console.log('\nOptions:');
        console.log('  --no-compress    Disable compression');
        console.log('  --extensions     Comma-separated file extensions to include');
        process.exit(1);
    }

    const sourceDir = args[0];
    const outputFile = args[1];
    const compress = !args.includes('--no-compress');
    
    // Parse custom extensions
    let extensions = DEFAULT_EXTENSIONS;
    const extArg = args.find(a => a.startsWith('--extensions='));
    if (extArg) {
        extensions = extArg.split('=')[1].split(',').map(e => e.trim());
    }

    // Validate source directory
    if (!fs.existsSync(sourceDir)) {
        console.error(`Error: Source directory not found: ${sourceDir}`);
        process.exit(1);
    }

    if (!fs.statSync(sourceDir).isDirectory()) {
        console.error(`Error: ${sourceDir} is not a directory`);
        process.exit(1);
    }

    // Create bundle
    const builder = new AssetBundleBuilder();
    const fileCount = builder.scanDirectory(sourceDir, extensions);
    
    if (fileCount === 0) {
        console.error('No matching files found');
        process.exit(1);
    }

    builder.printSummary();
    builder.saveBundle(outputFile);

    console.log('\nDone!');
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = AssetBundleBuilder;
