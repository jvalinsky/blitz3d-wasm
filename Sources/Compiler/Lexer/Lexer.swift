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
    private var lineStarts: [String.Index]  // For line lookup
    
    public init(source: String, sourceFile: String = "unknown") {
        self.source = source
        self.sourceFile = sourceFile
        self.currentIndex = source.startIndex
        self.currentLine = 1
        self.currentColumn = 1
        self.lineStarts = [source.startIndex]
        
        // Pre-compute line starts for error reporting
        var idx = source.startIndex
        while idx < source.endIndex {
            if source[idx] == "\n" {
                lineStarts.append(source.index(after: idx))
            }
            idx = source.index(after: idx)
        }
    }
    
    public mutating func nextToken() -> Token {
        skipWhitespace()
        
        let startLine = currentLine
        let startColumn = currentColumn
        
        guard currentIndex < source.endIndex else {
            return Token(type: .endOfFile, text: "", line: currentLine, column: currentColumn, sourceFile: sourceFile)
        }
        
        let ch = source[currentIndex]
        
        if ch == "\n" {
            advance()
            currentLine += 1
            currentColumn = 1
            return Token(type: .newline, text: "\n", line: startLine, column: startColumn, sourceFile: sourceFile)
        }
        
        // Comments
        if ch == "'" || ch == ";" {
            skipComment()
            return nextToken()
        }
        
        // String literals
        if ch == "\"" {
            return readStringLiteral(startLine: startLine, startColumn: startColumn)
        }
        
        // Numbers
        if ch.isASCII && ch.isNumber {
            return readNumber(startLine: startLine, startColumn: startColumn)
        }
        
        // Hex literals
        if ch == "$" {
            return readHexLiteral(startLine: startLine, startColumn: startColumn)
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
        
        return Token(type: .stringLiteral, text: text, line: startLine, column: startColumn, sourceFile: sourceFile)
    }
    
    private mutating func readNumber(startLine: Int, startColumn: Int) -> Token {
        var text = ""
        var hasDecimal = false
        
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
            return Token(type: .floatLiteral, text: text, line: startLine, column: startColumn, sourceFile: sourceFile)
        } else {
            return Token(type: .integerLiteral, text: text, line: startLine, column: startColumn, sourceFile: sourceFile)
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
            return Token(type: .integerLiteral, text: String(value), line: startLine, column: startColumn, sourceFile: sourceFile)
        }
        
        return Token(type: .error, text: "$" + text, line: startLine, column: startColumn, sourceFile: sourceFile)
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
        
        // Check if it's a keyword
        if let keywordType = keywordMap[text.lowercased()] {
            return Token(type: keywordType, text: text, line: startLine, column: startColumn, sourceFile: sourceFile)
        }
        
        return Token(type: .identifier, text: text, line: startLine, column: startColumn, sourceFile: sourceFile)
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
                return Token(type: .notEquals, text: twoChar, line: startLine, column: startColumn, sourceFile: sourceFile)
            case "<=":
                advance()
                return Token(type: .lessThanOrEqual, text: twoChar, line: startLine, column: startColumn, sourceFile: sourceFile)
            case ">=":
                advance()
                return Token(type: .greaterThanOrEqual, text: twoChar, line: startLine, column: startColumn, sourceFile: sourceFile)
            default:
                break
            }
        }
        
        // Single character
        switch ch {
        case "+": return Token(type: .plus, text: "+", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "-": return Token(type: .minus, text: "-", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "*": return Token(type: .multiply, text: "*", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "/": return Token(type: .divide, text: "/", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "=": return Token(type: .equals, text: "=", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "<": return Token(type: .lessThan, text: "<", line: startLine, column: startColumn, sourceFile: sourceFile)
        case ">": return Token(type: .greaterThan, text: ">", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "(": return Token(type: .leftParen, text: "(", line: startLine, column: startColumn, sourceFile: sourceFile)
        case ")": return Token(type: .rightParen, text: ")", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "[": return Token(type: .leftBracket, text: "[", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "]": return Token(type: .rightBracket, text: "]", line: startLine, column: startColumn, sourceFile: sourceFile)
        case ",": return Token(type: .comma, text: ",", line: startLine, column: startColumn, sourceFile: sourceFile)
        case "\\": return Token(type: .backslash, text: "\\", line: startLine, column: startColumn, sourceFile: sourceFile)
        case ":": return Token(type: .colon, text: ":", line: startLine, column: startColumn, sourceFile: sourceFile)
        case ".": return Token(type: .period, text: ".", line: startLine, column: startColumn, sourceFile: sourceFile)
        default:
            return Token(type: .error, text: String(ch), line: startLine, column: startColumn, sourceFile: sourceFile)
        }
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
