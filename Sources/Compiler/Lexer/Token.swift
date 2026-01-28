//
//  Token.swift
//  Blitz3DCompiler
//
//  Token types for the Blitz3D BASIC lexer
//

public enum TokenType: Equatable, Hashable {
    // Keywords
    case keywordDim
    case keywordGoto
    case keywordGosub
    case keywordReturn
    case keywordExit
    case keywordIf
    case keywordThen
    case keywordElse
    case keywordEndIf
    case keywordElseIf
    case keywordWhile
    case keywordWend
    case keywordFor
    case keywordTo
    case keywordStep
    case keywordNext
    case keywordFunction
    case keywordEndFunction
    case keywordType
    case keywordEndType
    case keywordEach
    case keywordLocal
    case keywordGlobal
    case keywordField
    case keywordConst
    case keywordSelect
    case keywordCase
    case keywordDefault
    case keywordEndSelect
    case keywordRepeat
    case keywordUntil
    case keywordForever
    case keywordData
    case keywordRead
    case keywordRestore
    case keywordAbs
    case keywordSgn
    case keywordMod
    case keywordPi
    case keywordTrue
    case keywordFalse
    case keywordInt
    case keywordFloat
    case keywordStr
    case keywordInclude
    case keywordNew
    case keywordDelete
    case keywordFirst
    case keywordLast
    case keywordInsert
    case keywordBefore
    case keywordAfter
    case keywordNull
    case keywordObject
    case keywordHandle
    case keywordAnd
    case keywordOr
    case keywordXor
    case keywordNot
    case keywordShl
    case keywordShr
    case keywordSar
    
    // Literals
    case integerLiteral
    case floatLiteral
    case stringLiteral
    
    // Identifiers
    case identifier
    
    // Operators
    case plus
    case minus
    case multiply
    case divide
    case equals
    case notEquals
    case lessThan
    case greaterThan
    case lessThanOrEqual
    case greaterThanOrEqual
    case power              // ^ exponent operator
    
    // Punctuation
    case leftParen
    case rightParen
    case leftBracket
    case rightBracket
    case comma
    case backslash  // For field access: obj\field
    case colon      // Statement separator
    case period
    case newline    // Newline character
    
    // Special
    case endOfFile
    case error
    
    // Type suffixes (attached to identifiers)
    case intSuffix     // %
    case floatSuffix   // #
    case stringSuffix  // $
}

public struct Token: Equatable {
    public let type: TokenType
    public let text: String
    public let line: Int
    public let column: Int
    public let sourceFile: String
    public let hadLeadingWhitespace: Bool
    
    public init(type: TokenType, text: String, line: Int, column: Int, sourceFile: String = "unknown", hadLeadingWhitespace: Bool = false) {
        self.type = type
        self.text = text
        self.line = line
        self.column = column
        self.sourceFile = sourceFile
        self.hadLeadingWhitespace = hadLeadingWhitespace
    }
    
    public var sourceLocation: String {
        return "\(sourceFile):\(line):\(column)"
    }
    
    public var description: String {
        return "Token(\(type), \"\(text)\", at \(sourceLocation))"
    }
}

extension TokenType: CustomStringConvertible {
    public var description: String {
        switch self {
        case .keywordDim: return "Dim"
        case .keywordGoto: return "Goto"
        case .keywordGosub: return "Gosub"
        case .keywordReturn: return "Return"
        case .keywordExit: return "Exit"
        case .keywordIf: return "If"
        case .keywordThen: return "Then"
        case .keywordElse: return "Else"
        case .keywordEndIf: return "EndIf"
        case .keywordElseIf: return "ElseIf"
        case .keywordWhile: return "While"
        case .keywordWend: return "Wend"
        case .keywordFor: return "For"
        case .keywordTo: return "To"
        case .keywordStep: return "Step"
        case .keywordNext: return "Next"
        case .keywordFunction: return "Function"
        case .keywordEndFunction: return "End Function"
        case .keywordType: return "Type"
        case .keywordEndType: return "End Type"
        case .keywordEach: return "Each"
        case .keywordLocal: return "Local"
        case .keywordGlobal: return "Global"
        case .keywordField: return "Field"
        case .keywordConst: return "Const"
        case .keywordSelect: return "Select"
        case .keywordCase: return "Case"
        case .keywordDefault: return "Default"
        case .keywordEndSelect: return "End Select"
        case .keywordRepeat: return "Repeat"
        case .keywordUntil: return "Until"
        case .keywordForever: return "Forever"
        case .keywordData: return "Data"
        case .keywordRead: return "Read"
        case .keywordRestore: return "Restore"
        case .keywordAbs: return "Abs"
        case .keywordSgn: return "Sgn"
        case .keywordMod: return "Mod"
        case .keywordPi: return "Pi"
        case .keywordTrue: return "True"
        case .keywordFalse: return "False"
        case .keywordInt: return "Int"
        case .keywordFloat: return "Float"
        case .keywordStr: return "Str"
        case .keywordInclude: return "Include"
        case .keywordNew: return "New"
        case .keywordDelete: return "Delete"
        case .keywordFirst: return "First"
        case .keywordLast: return "Last"
        case .keywordInsert: return "Insert"
        case .keywordBefore: return "Before"
        case .keywordAfter: return "After"
        case .keywordNull: return "Null"
        case .keywordObject: return "Object"
        case .keywordHandle: return "Handle"
        case .keywordAnd: return "And"
        case .keywordOr: return "Or"
        case .keywordXor: return "Xor"
        case .keywordNot: return "Not"
        case .keywordShl: return "Shl"
        case .keywordShr: return "Shr"
        case .keywordSar: return "Sar"
        case .integerLiteral: return "integer"
        case .floatLiteral: return "float"
        case .stringLiteral: return "string"
        case .identifier: return "identifier"
        case .plus: return "+"
        case .minus: return "-"
        case .multiply: return "*"
        case .divide: return "/"
        case .equals: return "="
        case .notEquals: return "<>"
        case .lessThan: return "<"
        case .greaterThan: return ">"
        case .lessThanOrEqual: return "<="
        case .greaterThanOrEqual: return ">="
        case .power: return "^"
        case .leftParen: return "("
        case .rightParen: return ")"
        case .leftBracket: return "["
        case .rightBracket: return "]"
        case .comma: return ","
        case .backslash: return "\\"
        case .colon: return ":"
        case .period: return "."
        case .newline: return "\\n"
        case .endOfFile: return "<EOF>"
        case .error: return "<ERROR>"
        case .intSuffix: return "%"
        case .floatSuffix: return "#"
        case .stringSuffix: return "$"
        }
    }
}
