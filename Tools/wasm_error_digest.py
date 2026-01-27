#!/usr/bin/env python3
import argparse
import bisect
import json
import os
import re
import shutil
import subprocess
import sys


BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
BASE64_INDEX = {c: i for i, c in enumerate(BASE64_CHARS)}


def env_int(name, default):
    value = os.getenv(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def decode_vlq(segment, index):
    result = 0
    shift = 0
    while index < len(segment):
        char = segment[index]
        index += 1
        digit = BASE64_INDEX.get(char)
        if digit is None:
            raise ValueError(f"Invalid base64 VLQ char: {char}")
        continuation = digit & 0x20
        digit &= 0x1F
        result |= digit << shift
        shift += 5
        if continuation == 0:
            break
    value = result >> 1
    if result & 1:
        value = -value
    return value, index


def decode_source_map(map_path):
    with open(map_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    mappings_str = data.get("mappings", "")
    sources = data.get("sources", [])
    offsets = []
    source_index = 0
    source_line = 0
    source_column = 0
    generated_offset = 0
    for line in mappings_str.split(";"):
        if not line:
            continue
        for segment in line.split(","):
            if not segment:
                continue
            idx = 0
            delta, idx = decode_vlq(segment, idx)
            generated_offset += delta
            delta, idx = decode_vlq(segment, idx)
            source_index += delta
            delta, idx = decode_vlq(segment, idx)
            source_line += delta
            delta, idx = decode_vlq(segment, idx)
            source_column += delta
            offsets.append(
                (generated_offset, source_index, source_line + 1, source_column + 1)
            )
    return offsets, sources


def find_source_for_offset(mappings, sources, offset):
    offsets = [m[0] for m in mappings]
    idx = bisect.bisect_right(offsets, offset) - 1
    if idx < 0:
        return None
    mapping = mappings[idx]
    source_idx = mapping[1]
    if source_idx < 0 or source_idx >= len(sources):
        return None
    return {
        "file": sources[source_idx],
        "line": mapping[2],
        "column": mapping[3],
        "mapping_offset": mapping[0],
    }


def run_wasm_validate(wasm_path):
    if shutil.which("wasm-validate") is None:
        raise RuntimeError("wasm-validate not found on PATH")
    result = subprocess.run(
        ["wasm-validate", wasm_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return "\n".join([result.stdout.strip(), result.stderr.strip()]).strip()


def parse_errors(text):
    errors = []
    for line in text.splitlines():
        if "error:" not in line:
            continue
        match = re.search(r"^(.*?):([0-9a-fA-F]+):\s+error:\s+(.*)$", line)
        if match:
            file_path = match.group(1)
            offset_hex = match.group(2)
            message = match.group(3).strip()
            errors.append(
                {
                    "file": file_path,
                    "offset": int(offset_hex, 16),
                    "offset_hex": offset_hex.lower(),
                    "message": message,
                }
            )
        else:
            message = line.split("error:", 1)[1].strip()
            errors.append(
                {"file": None, "offset": None, "offset_hex": None, "message": message}
            )
    return errors


def categorize(message):
    msg = message.lower()
    if "type mismatch in drop" in msg:
        return "drop_mismatch"
    if "type mismatch in call" in msg:
        return "call_mismatch"
    if "type mismatch at end" in msg or "type mismatch in return" in msg:
        return "block_result_mismatch"
    if "type mismatch in" in msg:
        return "type_mismatch"
    if "expected [] but got" in msg:
        return "stack_unbalanced"
    if "local variable out of range" in msg:
        return "local_out_of_range"
    if "global variable out of range" in msg:
        return "global_out_of_range"
    if "invalid opcode" in msg:
        return "invalid_opcode"
    if "function signature mismatch" in msg:
        return "signature_mismatch"
    if "unreachable" in msg:
        return "unreachable"
    return "other"


def simplify_objdump_line(line):
    line = re.sub(r"^\s*[0-9a-fA-F]+:\s+", "", line)
    line = re.sub(r"^(?:[0-9a-fA-F]{2}\s+)+", "", line)
    return line.strip()


def parse_objdump_imports(wasm_path):
    if shutil.which("wasm-objdump") is None:
        return {}
    result = subprocess.run(
        ["wasm-objdump", "-x", wasm_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    imports = {}
    for line in result.stdout.splitlines():
        if "__bbdbg_" not in line:
            continue
        func_match = re.search(r"func\[(\d+)\]", line)
        name_match = re.search(r"<([^>]+)>", line)
        if not func_match or not name_match:
            continue
        idx = int(func_match.group(1))
        name = name_match.group(1)
        if "." in name:
            name = name.split(".")[-1]
        imports[name] = idx
    return imports


def parse_objdump_instructions(wasm_path):
    if shutil.which("wasm-objdump") is None:
        return []
    result = subprocess.run(
        ["wasm-objdump", "-d", wasm_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    lines = result.stdout.splitlines()
    functions = []
    current = None
    for line in lines:
        line_stripped = line.strip()
        if line_stripped.startswith("func["):
            if current:
                functions.append(current)
            current = {
                "header": line_stripped,
                "instructions": [],
                "start_offset": None,
                "end_offset": None,
            }
            continue
        if current is None:
            continue
        match = re.match(r"^\s*([0-9a-fA-F]+):\s+([^\s]+)\s*(.*)$", line)
        if not match:
            continue
        offset = int(match.group(1), 16)
        op = match.group(2)
        args = match.group(3).strip()
        if current["start_offset"] is None:
            current["start_offset"] = offset
        current["end_offset"] = offset
        current["instructions"].append(
            {
                "offset": offset,
                "op": op,
                "args": args,
                "raw": line,
            }
        )
    if current:
        functions.append(current)
    return functions


def parse_objdump(wasm_path, needed_offsets, context_lines):
    if shutil.which("wasm-objdump") is None:
        return {}, []
    result = subprocess.run(
        ["wasm-objdump", "-d", wasm_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    lines = result.stdout.splitlines()
    offset_to_info = {}
    current_func = None
    for idx, line in enumerate(lines):
        line_stripped = line.strip()
        if line_stripped.startswith("func["):
            current_func = line_stripped
        match = re.match(r"^\s*([0-9a-fA-F]+):", line)
        if match:
            offset = int(match.group(1), 16)
            if offset in needed_offsets:
                start = max(0, idx - context_lines)
                end = min(len(lines), idx + context_lines + 1)
                context = lines[start:end] if context_lines > 0 else []
                offset_to_info[offset] = {
                    "function": current_func,
                    "instruction": simplify_objdump_line(line),
                    "context": context,
                }
    return offset_to_info, lines


def load_bbdbg(bbdbg_path):
    with open(bbdbg_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    files = {f["id"]: f["path"] for f in data.get("files", [])}
    functions = {fn["id"]: fn for fn in data.get("functions", [])}
    return files, functions


def attach_bbdbg_metadata(errors, functions, imports, bbdbg_files, bbdbg_functions):
    if not functions:
        return {}
    func_ranges = []
    for func in functions:
        start = func.get("start_offset")
        end = func.get("end_offset")
        if start is None or end is None:
            continue
        func_ranges.append((start, end, func))

    enter_idx = imports.get("__bbdbg_enter")
    stmt_idx = imports.get("__bbdbg_stmt")

    for func in functions:
        func["debug_func_id"] = None
        func["stmt_events"] = []
        last_consts = []
        for instr in func["instructions"]:
            if instr["op"] == "i32.const":
                try:
                    value = int(instr["args"], 0)
                    last_consts.append((instr["offset"], value))
                    if len(last_consts) > 2:
                        last_consts.pop(0)
                except ValueError:
                    continue
            if instr["op"] == "call":
                try:
                    call_idx = int(instr["args"], 0)
                except ValueError:
                    continue
                if enter_idx is not None and call_idx == enter_idx and last_consts:
                    func["debug_func_id"] = last_consts[-1][1]
                if stmt_idx is not None and call_idx == stmt_idx and len(last_consts) >= 2:
                    file_id = last_consts[-2][1]
                    line_no = last_consts[-1][1]
                    func["stmt_events"].append(
                        {"offset": instr["offset"], "fileId": file_id, "line": line_no}
                    )

    for err in errors:
        offset = err.get("offset")
        if offset is None:
            continue
        target = None
        for start, end, func in func_ranges:
            if start <= offset <= end:
                target = func
        if not target:
            continue
        func_id = target.get("debug_func_id")
        if func_id is not None and func_id in bbdbg_functions:
            fn_info = bbdbg_functions[func_id]
            file_path = bbdbg_files.get(fn_info.get("fileId"))
            err["bbdbg_function"] = {
                "id": func_id,
                "name": fn_info.get("name"),
                "signature": fn_info.get("signature"),
                "file": file_path,
                "startLine": fn_info.get("startLine"),
                "endLine": fn_info.get("endLine"),
            }
        stmt_events = target.get("stmt_events", [])
        stmt_event = None
        for event in stmt_events:
            if event["offset"] <= offset:
                stmt_event = event
            else:
                break
        if stmt_event:
            file_path = bbdbg_files.get(stmt_event["fileId"])
            err["bbdbg_stmt"] = {
                "file": file_path,
                "line": stmt_event["line"],
            }
    return errors


def build_summary(errors):
    categories = {}
    message_counts = {}
    for err in errors:
        category = categorize(err["message"])
        categories[category] = categories.get(category, 0) + 1
        message_counts[err["message"]] = message_counts.get(err["message"], 0) + 1
    top_messages = sorted(
        message_counts.items(), key=lambda x: (-x[1], x[0])
    )
    return categories, top_messages


def main():
    parser = argparse.ArgumentParser(
        description="Compact wasm-validate error digest with optional source/objdump mapping."
    )
    parser.add_argument("wasm", nargs="?", help="WASM file to validate")
    parser.add_argument("--log", help="Existing wasm-validate output to parse")
    parser.add_argument("--map", dest="map_path", help="Source map path (.wasm.map)")
    parser.add_argument("--bbdbg", dest="bbdbg_path", help="Debug metadata (.bbdbg.json)")
    parser.add_argument("--context", type=int, default=1, help="Objdump context lines")
    parser.add_argument("--max", dest="max_items", type=int, default=5, help="Max samples")
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    parser.add_argument("--no-objdump", action="store_true", help="Skip wasm-objdump")
    parser.add_argument("--no-source", action="store_true", help="Skip source map decoding")
    parser.add_argument(
        "--max-map-mb",
        type=int,
        default=env_int("B3D_DIGEST_MAX_MAP_MB", 64),
        help="Skip source map decode when map exceeds this size in MB (0 disables)",
    )
    parser.add_argument(
        "--max-objdump-mb",
        type=int,
        default=env_int("B3D_DIGEST_MAX_OBJDUMP_MB", 64),
        help="Skip wasm-objdump when wasm exceeds this size in MB (0 disables)",
    )
    args = parser.parse_args()

    if not args.wasm and not args.log:
        print("Error: provide a wasm file or --log output", file=sys.stderr)
        sys.exit(1)

    raw_output = ""
    if args.log:
        with open(args.log, "r", encoding="utf-8") as f:
            raw_output = f.read()
    else:
        try:
            raw_output = run_wasm_validate(args.wasm)
        except RuntimeError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(2)

    errors = parse_errors(raw_output)
    if not errors:
        if args.json:
            print(json.dumps({"status": "ok", "errors": 0}, indent=2))
        else:
            print("No wasm-validate errors found.")
        return

    categories, top_messages = build_summary(errors)

    mappings = []
    sources = []
    if not args.no_source:
        map_path = args.map_path
        if not map_path and args.wasm:
            candidate = f"{args.wasm}.map"
            if os.path.exists(candidate):
                map_path = candidate
        if map_path and os.path.exists(map_path):
            try:
                max_map_bytes = args.max_map_mb * 1024 * 1024
                if args.max_map_mb and os.path.getsize(map_path) > max_map_bytes:
                    if not args.json:
                        print(
                            f"Warning: skipping source map (> {args.max_map_mb} MB): {map_path}",
                            file=sys.stderr,
                        )
                else:
                    mappings, sources = decode_source_map(map_path)
            except Exception as exc:
                if not args.json:
                    print(f"Warning: failed to parse source map: {exc}", file=sys.stderr)

    offsets = {err["offset"] for err in errors if err["offset"] is not None}
    objdump_info = {}
    objdump_lines = []
    objdump_functions = []
    imports = {}
    if args.wasm and not args.no_objdump:
        allow_objdump = True
        if args.max_objdump_mb:
            try:
                max_objdump_bytes = args.max_objdump_mb * 1024 * 1024
                if os.path.getsize(args.wasm) > max_objdump_bytes:
                    allow_objdump = False
                    if not args.json:
                        print(
                            f"Warning: skipping wasm-objdump (> {args.max_objdump_mb} MB): {args.wasm}",
                            file=sys.stderr,
                        )
            except OSError:
                pass
        if allow_objdump:
            if offsets:
                objdump_info, objdump_lines = parse_objdump(
                    args.wasm, offsets, args.context
                )
            objdump_functions = parse_objdump_instructions(args.wasm)
            imports = parse_objdump_imports(args.wasm)

    bbdbg_files = {}
    bbdbg_functions = {}
    if args.wasm:
        bbdbg_path = args.bbdbg_path
        if not bbdbg_path:
            candidate = args.wasm.replace(".wasm", ".bbdbg.json")
            if os.path.exists(candidate):
                bbdbg_path = candidate
        if bbdbg_path and os.path.exists(bbdbg_path):
            try:
                bbdbg_files, bbdbg_functions = load_bbdbg(bbdbg_path)
            except Exception as exc:
                if not args.json:
                    print(f"Warning: failed to parse bbdbg file: {exc}", file=sys.stderr)

    if bbdbg_functions and objdump_functions:
        errors = attach_bbdbg_metadata(
            errors, objdump_functions, imports, bbdbg_files, bbdbg_functions
        )

    samples = []
    for err in errors[: args.max_items]:
        detail = {
            "offset": err["offset_hex"],
            "message": err["message"],
            "category": categorize(err["message"]),
        }
        if err["offset"] is not None and mappings and sources:
            source = find_source_for_offset(mappings, sources, err["offset"])
            if source:
                detail["source"] = source
        if err["offset"] in objdump_info:
            detail.update(objdump_info[err["offset"]])
        if err.get("bbdbg_function"):
            detail["bbdbg_function"] = err["bbdbg_function"]
        if err.get("bbdbg_stmt"):
            detail["bbdbg_stmt"] = err["bbdbg_stmt"]
        samples.append(detail)

    if args.json:
        payload = {
            "file": args.wasm or None,
            "errors": len(errors),
            "categories": categories,
            "top_messages": [
                {"message": msg, "count": count}
                for msg, count in top_messages[: args.max_items]
            ],
            "samples": samples,
        }
        print(json.dumps(payload, indent=2))
        return

    print("WASM ERROR DIGEST")
    if args.wasm:
        print(f"file: {args.wasm}")
    print(f"errors: {len(errors)}")
    print("")
    print("categories:")
    for name, count in sorted(categories.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {name}: {count}")
    print("")
    print("top messages:")
    for msg, count in top_messages[: args.max_items]:
        print(f"  ({count}) {msg}")
    print("")
    print("samples:")
    for sample in samples:
        offset = sample.get("offset")
        if offset:
            print(f"  0x{offset} {sample['message']}")
        else:
            print(f"  {sample['message']}")
        if "function" in sample and sample["function"]:
            print(f"    func: {sample['function']}")
        if "instruction" in sample and sample["instruction"]:
            print(f"    instr: {sample['instruction']}")
        if "source" in sample:
            source = sample["source"]
            print(
                f"    source: {source['file']}:{source['line']}:{source['column']}"
            )
        if "bbdbg_function" in sample:
            fn = sample["bbdbg_function"]
            name = fn.get("name") or "unknown"
            span = f"{fn.get('startLine')}..{fn.get('endLine')}"
            file_path = fn.get("file") or "unknown"
            print(f"    bbdbg func: {name} ({file_path}:{span})")
        if "bbdbg_stmt" in sample:
            stmt = sample["bbdbg_stmt"]
            file_path = stmt.get("file") or "unknown"
            print(f"    bbdbg stmt: {file_path}:{stmt.get('line')}")
        context = sample.get("context", [])
        for line in context:
            print(f"      {line}")


if __name__ == "__main__":
    main()
