#!/usr/bin/env python3
"""
SCPCB Asset Extraction Tool

Extracts assets from SCPCB ZIP files and prepares them for WASM runtime.
Supports password-protected ZIPs via command-line or manifest.
"""

import argparse
import json
import os
import sys
import zipfile
from pathlib import Path
from typing import Optional

class AssetExtractor:
    def __init__(self, source_dir: str, output_dir: str, password: Optional[str] = None):
        self.source_dir = Path(source_dir)
        self.output_dir = Path(output_dir)
        self.password = password
        self.manifest = {
            "version": "1.0",
            "files": [],
            "embedAssets": True,
            "totalSize": 0
        }
    
    def extract_from_zip(self, zip_path: Path, password: Optional[str] = None) -> None:
        """Extract all files from a ZIP archive."""
        try:
            with zipfile.ZipFile(zip_path, 'r') as zf:
                for info in zf.infolist():
                    if not info.is_dir():
                        try:
                            data = zf.read(info.filename)
                        except RuntimeError:
                            pwd = password or self.password
                            if pwd:
                                data = zf.read(info.filename, pwd=pwd.encode())
                            else:
                                print(f"WARNING: Encrypted file {info.filename} - skipping")
                                continue
                        
                        out_path = self.output_dir / info.filename
                        out_path.parent.mkdir(parents=True, exist_ok=True)
                        out_path.write_bytes(data)
                        
                        self.manifest["files"].append({
                            "path": info.filename,
                            "size": len(data),
                            "compressed": info.compress_type != zipfile.ZIP_STORED,
                            "crc32": info.CRC
                        })
                        self.manifest["totalSize"] += len(data)
                        
        except zipfile.BadZipFile:
            print(f"ERROR: Invalid ZIP file {zip_path}")
            sys.exit(1)
    
    def extract_all(self) -> None:
        """Extract all assets from source directory."""
        print(f"Extracting assets from {self.source_dir}...")
        
        if self.output_dir.exists():
            import shutil
            shutil.rmtree(self.output_dir)
        self.output_dir.mkdir(parents=True)
        
        zip_files = [
            "pcb_data.zip",
            "pcb_music.zip",
            "pcb_mods.zip"
        ]
        
        for zf_name in zip_files:
            zf_path = self.source_dir / zf_name
            if zf_path.exists():
                print(f"  Processing {zf_name}...")
                self.extract_from_zip(zf_path)
        
        manifest_path = self.output_dir / "manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f, indent=2)
        
        print(f"Extracted {len(self.manifest['files'])} files ({self.manifest['totalSize']/1024/1024:.1f} MB)")

def main():
    parser = argparse.ArgumentParser(description="Extract SCPCB assets for WASM build")
    parser.add_argument("--source", "-s", default="../scpcb", help="Source directory with ZIP files")
    parser.add_argument("--output", "-o", default="./build/assets", help="Output directory")
    parser.add_argument("--password", "-p", help="ZIP password (if encrypted)")
    parser.add_argument("--list", action="store_true", help="Just list ZIP contents")
    
    args = parser.parse_args()
    
    extractor = AssetExtractor(args.source, args.output, args.password)
    
    if args.list:
        for zf_name in ["pcb_data.zip", "pcb_music.zip", "pcb_mods.zip"]:
            zf_path = Path(args.source) / zf_name
            if zf_path.exists():
                print(f"\n{zf_name}:")
                with zipfile.ZipFile(zf_path, 'r') as zf:
                    for info in zf.infolist()[:20]:
                        print(f"  {info.filename}")
                    if len(zf.infolist()) > 20:
                        print(f"  ... and {len(zf.infolist()) - 20} more files")
    else:
        extractor.extract_all()

if __name__ == "__main__":
    main()
