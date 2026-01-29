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
  }

  // Test 2: Valid magic number
  console.log("\nTest 2: Valid WASM magic number");
  const buf = Deno.readFileSync(filePath);
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

  // Test 4: Parse sections
  console.log("\nTest 4: Parse WASM sections");
  let pos = 8;
  const sections = [];
  while (pos < buf.length) {
    // Read section id
    const id = buf[pos++];

    // Read payload size (varuint32)
    let size = 0, shift = 0, byte;
    do {
      byte = buf[pos++];
      size |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);

    sections.push({ id, size });
    pos += size;
  }

  const foundIds = sections.map((s) => s.id).sort((a, b) => a - b);

  console.log(`  Found sections: ${sections.map((s) => s.id).join(", ")}`);

  // Check required sections (Data section is optional)
  const requiredSections = [1, 2, 3, 5, 7, 10]; // Type, Import, Function, Memory, Export, Code
  const hasDataSection = foundIds.includes(11);

  const allPresent = requiredSections.every((id) => foundIds.includes(id));
  if (allPresent) {
    console.log(`  ✓ All required sections present`);
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
  console.log("\nTest 5: Section order");
  const sectionOrder = sections.map((s) => s.id);
  const expectedOrder = [1, 2, 3, 5, 7, 10, 11];
  // Custom sections (id=0) can appear anywhere; ignore them for ordering checks.
  const nonCustomOrder = sectionOrder.filter((id) => id !== 0);
  const isOrdered = nonCustomOrder.length >= 2 &&
    nonCustomOrder.every((id, i) => i === 0 || id >= nonCustomOrder[i - 1]);
  if (isOrdered) {
    console.log(`  ✓ Sections in valid order`);
    passed++;
  } else {
    console.log(`  ✗ Sections out of order: ${sectionOrder.join(", ")}`);
    failed++;
  }

  // Test 6: Code section has functions
  console.log("\nTest 6: Code section has functions");
  const codeSection = sections.find((s) => s.id === 10);
  if (codeSection && codeSection.size > 0) {
    console.log(`  ✓ Code section size: ${codeSection.size} bytes`);
    passed++;
  } else {
    console.log(`  ✗ No code section or empty`);
    failed++;
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

// Run tests
const wasmPath = Deno.args[0] || "Sources/Runtime/input_test.wasm";
const success = validateWASM(wasmPath);
Deno.exit(success ? 0 : 1);
