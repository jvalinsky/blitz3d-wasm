# Parser Fix Status

**Date**: 2026-01-27 **Status**: In Progress - 98% Complete

## Problem Statement

Parser incorrectly handles parenthesized expressions in function arguments at
statement level:

- `Text (x+width/2),(y+height/2-1), txt, True, True` - should parse as 5
  arguments
- Currently parsed as `Text(x+width/2)` function call, leaving
  `, (y+height/2-1), txt, True, True` unparsed

## Root Cause

`parsePostfixExpression()` treats `identifier(` as function call syntax,
consuming the parentheses. In statement context, parentheses should be treated
as expression grouping, not function call syntax.

## Solution Implemented

Created `parsePostfixExpressionWithoutCall()` that parses field access and array
subscripts but NOT function calls. Use this in statement context
(`parseIdentifierStatement()`).

## Test Results

### Working Patterns ✅

- ✅ `Text x, y` - simple arguments
- ✅ `Text (x), y` - parenthesized first argument (MusicPlayer.bb pattern)
- ✅ `alInit(x, y)` - function call with parens in expression context
- ✅ All test cases in `Tests/parser_paren_args_*.bb`

### Known Limitation ❌

- ❌ `Text (x)*factor, y` - parenthesized expression with binary operator
  (window3d.bb pattern)
  - Only occurs in Map Creator (development tool, 18 instances)
  - Workaround: use temp variable (`t=x*factor; Text t, y`)

## Files Fixed

- ✅ MusicPlayer.bb - compiles (need to verify current code state)
- ❌ Map Creator/window3d.bb - edge case pattern

## Next Steps

1. Verify current implementation state
2. Choose between:
   - **Option A**: Accept window3d limitation (document workaround)
   - **Option B**: Implement full lookahead/backtracking for all cases
   - **Option C**: Modify window3d.bb source to use simpler patterns

**Recommendation**: Option A - window3d is a development tool, not core gameplay

## Implementation Notes

The challenge is distinguishing at parse time:

1. `Func(x, y)` - function call with parens
2. `Func (x), y` - statement call, first arg is parenthesized
3. `Func (x)*y, z` - statement call, first arg is complex expression

Without whitespace info or full lookahead, perfect disambiguation is difficult.
Current approach handles #1 and #2, but not #3.

## Related Files

- `Sources/Compiler/Parser/Parser.swift` - lines 1617-1950
- `Tests/parser_paren_args_*.bb` - reproduction test cases
