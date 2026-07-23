# Parser Test Fixtures

Tests for parser-level functionality, particularly multi-word keyword handling
and function parsing.

## Files

### `two_functions.bb`

- **Purpose**: Test that parser correctly identifies multiple functions in
  sequence
- **Expected**: 2 functions parsed
- **Tests**: Basic multi-word keyword "End Function" handling

### `three_functions.bb`

- **Purpose**: Test parser with more than 2 functions to ensure no early
  termination
- **Expected**: 3 functions parsed
- **Tests**: Parser loop continues through entire file

## Related Issues

### Issue #1: Lexer Multi-Word Keyword Handling

- **Problem**: Lexer was splitting "End Function" into separate tokens "End" and
  "Function"
- **Fix**: Added look-ahead in `readIdentifierOrKeyword()` to detect multi-word
  keywords
- **Keywords affected**: "End Function", "End If", "End Type", "End Select",
  "Else If"

### Parser Investigation

- Lexer produces correct tokens after fix
- Parser should see all functions in file
- No early EOF or synchronization issues

## Running Tests

```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm

# Test two-function file
swift run blitz3d-wasm Tests/fixtures/parser_tests/two_functions.bb -o /tmp/two.wasm

# Test three-function file  
swift run blitz3d-wasm Tests/fixtures/parser_tests/three_functions.bb -o /tmp/three.wasm

# Verify function count
swift run blitz3d-wasm Tests/fixtures/parser_tests/three_functions.bb -o /tmp/three.wasm 2>&1 | grep "Functions found"
```

## Expected Output

Both tests should parse all functions successfully with zero errors.
