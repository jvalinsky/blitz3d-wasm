function validateWASM(filePath) {
  console.log(`\n=== WASM Validation Tests ===\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: File exists
  console.log("Test 1: File exists");
  try {
    const stat = Deno.statSync(filePath);
    console.log(`  ✓ ${filePath} exists (${stat.size} bytes)`);
    passed++;
  } catch {
    console.log(`  ✗ File not found: ${filePath}`);
    failed++;
    console.log("\n========================================");
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log("========================================\n");
    return false;
  }

  const buf = Deno.readFileSync(filePath);

  // Test 2: Valid WASM magic number
  console.log("\nTest 2: Valid WASM magic number");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = toHex(buf.subarray(0, 4));
  if (magic === "0061736d") {
    console.log(`  ✓ Magic number: 0x${magic}`);
    passed++;
  } else {
    console.log(`  ✗ Invalid magic: 0x${magic} (expected 0x0061736d)`);
    failed++;
  }

  // Test 3: Valid version
  console.log("\nTest 3: Valid WASM version");
  const version = view.getUint32(4, true);
  if (version === 1) {
    console.log(`  ✓ Version: ${version}`);
    passed++;
  } else {
    console.log(`  ✗ Invalid version: ${version} (expected 1)`);
    failed++;
  }

  // Test 4: WebAssembly.validate
  console.log("\nTest 4: WebAssembly.validate");
  const valid = WebAssembly.validate(buf);
  if (valid) {
    console.log("  ✓ Engine validation passed");
    passed++;
  } else {
    console.log("  ✗ Engine validation failed");
    failed++;
  }

  // Test 4: Parse sections
  console.log("\nTest 5: Parse WASM sections");
  if (!valid) {
    console.log("  ○ Skipping section parsing (module is invalid)");
  } else {
    let pos = 8;
    const sections = [];
    while (pos < buf.length) {
      // Read section id
      const id = buf[pos++];
      if (id > 11) {
        console.log(`  ✗ Invalid section id ${id} at byte offset ${pos - 1}`);
        failed++;
        break;
      }

      // Read payload size (varuint32)
      let size = 0, shift = 0, byte;
      do {
        byte = buf[pos++];
        size |= (byte & 0x7f) << shift;
        shift += 7;
      } while (byte & 0x80);

      if (pos + size > buf.length) {
        console.log(
          `  ✗ Section ${id} overruns file: payload=${size} pos=${pos} len=${buf.length}`,
        );
        failed++;
        break;
      }

      sections.push({ id, size });
      pos += size;
    }

    const foundIds = sections.map((s) => s.id).sort((a, b) => a - b);

    console.log(`  Found sections: ${sections.map((s) => s.id).join(", ")}`);

    // Minimal sanity checks (different compilers may omit many sections).
    const requiredSections = [1, 3, 10]; // Type, Function, Code
    const hasDataSection = foundIds.includes(11);

    const allPresent = requiredSections.every((id) => foundIds.includes(id));
    if (allPresent) {
      console.log(
        `  ✓ Required sections present (${requiredSections.join(", ")})`,
      );
      console.log(
        `  ${hasDataSection ? "✓" : "○"} Data section: ${
          hasDataSection
            ? "present"
            : "not present (no Data statements in source)"
        }`,
      );
      passed++;
    } else {
      console.log(
        `  ✗ Missing sections. Expected: ${requiredSections.join(", ")}`,
      );
      failed++;
    }

    // Test 5: Section order
    console.log("\nTest 6: Section order");
    const sectionOrder = sections.map((s) => s.id);
    // Custom sections (id=0) can appear anywhere; ignore them for ordering checks.
    const nonCustomOrder = sectionOrder.filter((id) => id !== 0);
    const isOrdered = nonCustomOrder.length >= 2 &&
      nonCustomOrder.every((id, i) => i === 0 || id > nonCustomOrder[i - 1]);
    if (isOrdered) {
      console.log(`  ✓ Sections in valid order`);
      passed++;
    } else {
      console.log(`  ✗ Sections out of order: ${sectionOrder.join(", ")}`);
      failed++;
    }

    // Test 6: Code section has functions
    console.log("\nTest 7: Code section has functions");
    const codeSection = sections.find((s) => s.id === 10);
    if (codeSection && codeSection.size > 0) {
      console.log(`  ✓ Code section size: ${codeSection.size} bytes`);
      passed++;
    } else {
      console.log(`  ✗ No code section or empty`);
      failed++;
    }
  }

  // Summary
  console.log("\n========================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  return failed === 0;
}

function toHex(buffer) {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function exists(p) {
  try {
    Deno.statSync(p);
    return true;
  } catch {
    return false;
  }
}

// Run tests
const pickDefaultWasm = () => {
  if (Deno.args[0]) return Deno.args[0];
  if (exists("dist/scpcb.wasm")) return "dist/scpcb.wasm";
  if (exists("Main.wasm")) return "Main.wasm";
  return "Sources/Runtime/input_test.wasm";
};

const wasmPath = pickDefaultWasm();
const success = validateWASM(wasmPath);
Deno.exit(success ? 0 : 1);
