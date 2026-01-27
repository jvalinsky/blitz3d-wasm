//
//  Lexer.swift
//  Blitz3DCompiler
//
//  Lexical analyzer for Blitz3D BASIC
//

public struct Lexer {
    private let source: String
    private var currentIndex: String.Index
    private var currentLine: Int
    private var currentColumn: Int
    private let sourceFile: String
    private let lineMap: [Int: (file: String, line: Int)]?
    private var lineStarts: [String.Index]  // For line lookup
    
    public init(source: String, sourceFile: String = "unknown", lineMap: [Int: (file: String, line: Int)]? = nil) {
        self.source = source
        self.sourceFile = sourceFile
        self.lineMap = lineMap
        self.currentIndex = source.startIndex
        self.currentLine = 1
        self.currentColumn = 1
        self.lineStarts = [source.startIndex]
        
        CompilerLogger.trace("DEBUG_LEXER: Initialized with source length: \(source.count) characters")
        
        // Pre-compute line starts for error reporting
        var idx = source.startIndex
        while idx < source.endIndex {
            if source[idx] == "\n" {
                lineStarts.append(source.index(after: idx))
            }
            idx = source.index(after: idx)
        }
        
        CompilerLogger.trace("DEBUG_LEXER: Found \(lineStarts.count) lines")
    }
    
    public mutating func nextToken() -> Token {
        skipWhitespace()
        
        let startLine = currentLine
        let startColumn = currentColumn
        
        guard currentIndex < source.endIndex else {
            CompilerLogger.trace("DEBUG_LEXER: Reached EOF at line \(currentLine), column \(currentColumn)")
            return makeToken(.endOfFile, text: "", line: currentLine, column: currentColumn)
        }
        
        let ch = source[currentIndex]
        
        if ch == "\n" {
            advance()
            currentLine += 1
            currentColumn = 1
            return makeToken(.newline, text: "\n", line: startLine, column: startColumn)
        }
        
        // Comments
        if ch == "'" || ch == ";" {
            skipComment()
            return nextToken()
        }

        // SCPCB/IDE metadata lines can begin with "=;" (treat as a comment line).
        if ch == "=" && startColumn == 1, let next = peek(offset: 1), next == ";" {
            advance() // consume '='
            skipComment() // now positioned at ';'
            return nextToken()
        }
        
        // String literals
        if ch == "\"" {
            return readStringLiteral(startLine: startLine, startColumn: startColumn)
        }
        
        // Numbers (including floats like .01)
        if ch.isASCII && ch.isNumber {
            return readNumber(startLine: startLine, startColumn: startColumn)
        }
        
        // Floats starting with . (like .01, .5)
        if ch == "." {
            if let next = peek(offset: 1), next.isASCII && next.isNumber {
                return readNumber(startLine: startLine, startColumn: startColumn)
            }
        }
        
        // Hex literals
        if ch == "$" {
            return readHexLiteral(startLine: startLine, startColumn: startColumn)
        }

        // Binary literals (%10101)
        if ch == "%" {
            // Check if followed by binary digits (0 or 1)
            if let next = peek(offset: 1), next == "0" || next == "1" {
                return readBinaryLiteral(startLine: startLine, startColumn: startColumn)
            }
            // Otherwise fall through - % will be handled as type suffix or error
        }

        // Identifiers and keywords
        if ch.isASCII && (ch.isLetter || ch == "_") {
            return readIdentifierOrKeyword(startLine: startLine, startColumn: startColumn)
        }
        
        // Operators and punctuation
        return readOperatorOrPunctuation(startLine: startLine, startColumn: startColumn)
    }
    
    public mutating func tokenize() -> [Token] {
        var tokens: [Token] = []
        
        while true {
            let token = nextToken()
            tokens.append(token)
            
            if token.type == .endOfFile {
                break
            }
        }
        
        return tokens
    }
    
    // MARK: - Private Methods
    
    private mutating func skipWhitespace() {
        while currentIndex < source.endIndex {
            let ch = source[currentIndex]
            
            if ch.isWhitespace && ch != "\n" {
                advance()
            } else {
                break
            }
        }
    }
    
    private mutating func advance() {
        if currentIndex < source.endIndex {
            currentIndex = source.index(after: currentIndex)
            currentColumn += 1
        }
    }
    
    private func peek(offset: Int = 0) -> Character? {
        let idx = source.index(currentIndex, offsetBy: offset, limitedBy: source.endIndex)
        return idx != nil && idx! < source.endIndex ? source[idx!] : nil
    }
    
    private mutating func skipComment() {
        while currentIndex < source.endIndex {
            let ch = source[currentIndex]
            if ch == "\n" {
                break
            }
            advance()
        }
    }
    
    private mutating func readStringLiteral(startLine: Int, startColumn: Int) -> Token {
        advance()  // Skip opening quote
        
        var text = ""
        while currentIndex < source.endIndex {
            let ch = source[currentIndex]
            
            if ch == "\"" {
                // Check for escaped quote ("")
                if let next = peek(offset: 1), next == "\"" {
                    text.append("\"")
                    advance()
                    advance()
                } else {
                    advance()  // Skip closing quote
                    break
                }
            } else if ch == "%" || ch == "#" || ch == "$" {
                // Type suffixes can appear in strings (SCPCB quirk)
                text.append(ch)
                advance()
            } else {
                text.append(ch)
                advance()
            }
        }
        
        return makeToken(.stringLiteral, text: text, line: startLine, column: startColumn)
    }
    
    private mutating func readNumber(startLine: Int, startColumn: Int) -> Token {
        var text = ""
        var hasDecimal = false
        
        // Handle numbers starting with . (like .01)
        if source[currentIndex] == "." {
            hasDecimal = true
            text.append(".")
            advance()
        }
        
        while currentIndex < source.endIndex {
            let ch = source[currentIndex]
            
            if ch.isASCII && ch.isNumber {
                text.append(ch)
                advance()
            } else if ch == "." && !hasDecimal {
                hasDecimal = true
                text.append(ch)
                advance()
            } else if (ch == "e" || ch == "E") && !text.contains("e") && !text.contains("E") {
                text.append(ch)
                advance()
                if let next = peek(), next == "+" || next == "-" {
                    text.append(next)
                    advance()
                }
            } else {
                break
            }
        }
        
        // Check for type suffix
        if let next = peek(), next == "#" || next == "%" {
            text.append(next)
            advance()
        }
        
        if hasDecimal || text.contains("e") || text.contains("E") {
            return makeToken(.floatLiteral, text: text, line: startLine, column: startColumn)
        } else {
            return makeToken(.integerLiteral, text: text, line: startLine, column: startColumn)
        }
    }
    
    private mutating func readHexLiteral(startLine: Int, startColumn: Int) -> Token {
        advance() // Skip $

        var text = ""
        while currentIndex < source.endIndex {
            let ch = source[currentIndex]
            if ch.isASCII && (ch.isNumber || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F")) {
                text.append(ch)
                advance()
            } else {
                break
            }
        }

        // Convert to integer
        if let value = Int(text, radix: 16) {
            return makeToken(.integerLiteral, text: String(value), line: startLine, column: startColumn)
        }

        return makeToken(.error, text: "$" + text, line: startLine, column: startColumn)
    }

    private mutating func readBinaryLiteral(startLine: Int, startColumn: Int) -> Token {
        advance() // Skip %

        var text = ""
        while currentIndex < source.endIndex {
            let ch = source[currentIndex]
            if ch == "0" || ch == "1" {
                text.append(ch)
                advance()
            } else {
                break
            }
        }

        // Convert to integer
        if let value = Int(text, radix: 2) {
            return makeToken(.integerLiteral, text: String(value), line: startLine, column: startColumn)
        }
        
        return makeToken(.error, text: "%" + text, line: startLine, column: startColumn)
    }
    
    private mutating func readIdentifierOrKeyword(startLine: Int, startColumn: Int) -> Token {
        var text = ""
        
        while currentIndex < source.endIndex {
            let ch = source[currentIndex]
            if ch.isASCII && (ch.isLetter || ch.isNumber || ch == "_") {
                text.append(ch)
                advance()
            } else {
                break
            }
        }
        
        // Check for type suffix
        if let next = peek(), next == "%" || next == "#" || next == "$" {
            text.append(next)
            advance()
        }
        
        let lowercase = text.lowercased()
        
        // Look ahead for multi-word keywords
        if lowercase == "end" || lowercase == "else" {
            // Save current position
            let savedIndex = currentIndex
            let savedLine = currentLine
            let savedColumn = currentColumn
            
            // Skip whitespace
            while currentIndex < source.endIndex {
                let ch = source[currentIndex]
                if ch.isWhitespace && ch != "\n" && ch != "\r" {
                    advance()
                } else {
                    break
                }
            }
            
            // Try to read next word
            var nextWord = ""
            while currentIndex < source.endIndex {
                let ch = source[currentIndex]
                if ch.isASCII && (ch.isLetter || ch.isNumber || ch == "_") {
                    nextWord.append(ch)
                    advance()
                } else {
                    break
                }
            }
            
            // Check if the combined phrase is a keyword
            if !nextWord.isEmpty {
                let combined = text + " " + nextWord
                if let keywordType = keywordMap[combined.lowercased()] {
                    CompilerLogger.trace("DEBUG_LEXER: Matched multi-word keyword '\(combined)' at line \(startLine)")
                    return makeToken(keywordType, text: combined, line: startLine, column: startColumn)
                }
            }
            
            // Not a multi-word keyword - rewind to saved position
            CompilerLogger.trace("DEBUG_LEXER: No multi-word match for '\(text)' + '\(nextWord)', rewinding")
            currentIndex = savedIndex
            currentLine = savedLine
            currentColumn = savedColumn
        }
        
        // Check if it's a keyword
        if let keywordType = keywordMap[lowercase] {
            if keywordType == .keywordFunction {
                CompilerLogger.trace("DEBUG_LEXER: Producing .keywordFunction at line \(startLine)")
            }
            return makeToken(keywordType, text: text, line: startLine, column: startColumn)
        }
        
        return makeToken(.identifier, text: text, line: startLine, column: startColumn)
    }
    
    private mutating func readOperatorOrPunctuation(startLine: Int, startColumn: Int) -> Token {
        let ch = source[currentIndex]
        advance()
        
        // Two-character operators - check currentIndex is valid BEFORE accessing source
        if currentIndex < source.endIndex {
            let twoChar = String(ch) + String(source[currentIndex])
            
            switch twoChar {
            case "<>":
                advance()
                return makeToken(.notEquals, text: twoChar, line: startLine, column: startColumn)
            case "<=":
                advance()
                return makeToken(.lessThanOrEqual, text: twoChar, line: startLine, column: startColumn)
            case "=<":
                advance()
                return makeToken(.lessThanOrEqual, text: twoChar, line: startLine, column: startColumn)
            case ">=":
                advance()
                return makeToken(.greaterThanOrEqual, text: twoChar, line: startLine, column: startColumn)
            case "=>":
                advance()
                return makeToken(.greaterThanOrEqual, text: twoChar, line: startLine, column: startColumn)
            default:
                break
            }
        }
        
        // Single character
        switch ch {
        case "+": return makeToken(.plus, text: "+", line: startLine, column: startColumn)
        case "-": return makeToken(.minus, text: "-", line: startLine, column: startColumn)
        case "*": return makeToken(.multiply, text: "*", line: startLine, column: startColumn)
        case "/": return makeToken(.divide, text: "/", line: startLine, column: startColumn)
        case "=": return makeToken(.equals, text: "=", line: startLine, column: startColumn)
        case "<": return makeToken(.lessThan, text: "<", line: startLine, column: startColumn)
        case ">": return makeToken(.greaterThan, text: ">", line: startLine, column: startColumn)
        case "(": return makeToken(.leftParen, text: "(", line: startLine, column: startColumn)
        case ")": return makeToken(.rightParen, text: ")", line: startLine, column: startColumn)
        case "[": return makeToken(.leftBracket, text: "[", line: startLine, column: startColumn)
        case "]": return makeToken(.rightBracket, text: "]", line: startLine, column: startColumn)
        case ",": return makeToken(.comma, text: ",", line: startLine, column: startColumn)
        case "\\": return makeToken(.backslash, text: "\\", line: startLine, column: startColumn)
        case ":": return makeToken(.colon, text: ":", line: startLine, column: startColumn)
        case ".": return makeToken(.period, text: ".", line: startLine, column: startColumn)
        case "^": return makeToken(.power, text: "^", line: startLine, column: startColumn)
        default:
            return makeToken(.error, text: String(ch), line: startLine, column: startColumn)
        }
    }

    private func makeToken(_ type: TokenType, text: String, line: Int, column: Int) -> Token {
        if let map = lineMap, let entry = map[line] {
            return Token(type: type, text: text, line: entry.line, column: column, sourceFile: entry.file)
        }
        return Token(type: type, text: text, line: line, column: column, sourceFile: sourceFile)
    }
    
    // Keyword lookup table (case-insensitive)
    private let keywordMap: [String: TokenType] = [
        "dim": .keywordDim,
        "goto": .keywordGoto,
        "gosub": .keywordGosub,
        "return": .keywordReturn,
        "exit": .keywordExit,
        "if": .keywordIf,
        "then": .keywordThen,
        "else": .keywordElse,
        "endif": .keywordEndIf,
        "end if": .keywordEndIf,
        "elseif": .keywordElseIf,
        "else if": .keywordElseIf,
        "while": .keywordWhile,
        "wend": .keywordWend,
        "for": .keywordFor,
        "to": .keywordTo,
        "step": .keywordStep,
        "next": .keywordNext,
        "function": .keywordFunction,
        "end function": .keywordEndFunction,
        "type": .keywordType,
        "end type": .keywordEndType,
        "each": .keywordEach,
        "local": .keywordLocal,
        "global": .keywordGlobal,
        "field": .keywordField,
        "const": .keywordConst,
        "select": .keywordSelect,
        "case": .keywordCase,
        "default": .keywordDefault,
        "end select": .keywordEndSelect,
        "repeat": .keywordRepeat,
        "until": .keywordUntil,
        "forever": .keywordForever,
        "data": .keywordData,
        "read": .keywordRead,
        "restore": .keywordRestore,
        "abs": .keywordAbs,
        "sgn": .keywordSgn,
        "mod": .keywordMod,
        "pi": .keywordPi,
        "true": .keywordTrue,
        "false": .keywordFalse,
        "int": .keywordInt,
        "float": .keywordFloat,
        "str": .keywordStr,
        "include": .keywordInclude,
        "new": .keywordNew,
        "delete": .keywordDelete,
        "first": .keywordFirst,
        "last": .keywordLast,
        "insert": .keywordInsert,
        "before": .keywordBefore,
        "after": .keywordAfter,
        "null": .keywordNull,
        "object": .keywordObject,
        "handle": .keywordHandle,
        "and": .keywordAnd,
        "or": .keywordOr,
        "xor": .keywordXor,
        "not": .keywordNot,
        "shl": .keywordShl,
        "shr": .keywordShr,
        "sar": .keywordSar
    ]
}
