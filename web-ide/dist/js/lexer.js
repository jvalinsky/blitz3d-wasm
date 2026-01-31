/**
 * Blitz3D Lexer - Tokenization
 *
 * Converts source code into tokens for parsing
 */
export var TokenType;
(function (TokenType) {
    // Literals
    TokenType["INTEGER"] = "INTEGER";
    TokenType["FLOAT"] = "FLOAT";
    TokenType["STRING"] = "STRING";
    // Identifiers and keywords
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    // Keywords
    TokenType["IF"] = "IF";
    TokenType["THEN"] = "THEN";
    TokenType["ELSE"] = "ELSE";
    TokenType["ELSEIF"] = "ELSEIF";
    TokenType["ENDIF"] = "ENDIF";
    TokenType["FOR"] = "FOR";
    TokenType["TO"] = "TO";
    TokenType["STEP"] = "STEP";
    TokenType["NEXT"] = "NEXT";
    TokenType["WHILE"] = "WHILE";
    TokenType["WEND"] = "WEND";
    TokenType["REPEAT"] = "REPEAT";
    TokenType["UNTIL"] = "UNTIL";
    TokenType["FOREVER"] = "FOREVER";
    TokenType["SELECT"] = "SELECT";
    TokenType["CASE"] = "CASE";
    TokenType["DEFAULT"] = "DEFAULT";
    TokenType["END"] = "END";
    TokenType["FUNCTION"] = "FUNCTION";
    TokenType["RETURN"] = "RETURN";
    TokenType["LOCAL"] = "LOCAL";
    TokenType["GLOBAL"] = "GLOBAL";
    TokenType["CONST"] = "CONST";
    TokenType["DIM"] = "DIM";
    TokenType["TYPE"] = "TYPE";
    TokenType["FIELD"] = "FIELD";
    TokenType["NEW"] = "NEW";
    TokenType["DELETE"] = "DELETE";
    TokenType["FIRST"] = "FIRST";
    TokenType["LAST"] = "LAST";
    TokenType["BEFORE"] = "BEFORE";
    TokenType["AFTER"] = "AFTER";
    TokenType["EACH"] = "EACH";
    TokenType["DATA"] = "DATA";
    TokenType["READ"] = "READ";
    TokenType["RESTORE"] = "RESTORE";
    TokenType["INCLUDE"] = "INCLUDE";
    // Operators
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["MULTIPLY"] = "MULTIPLY";
    TokenType["DIVIDE"] = "DIVIDE";
    TokenType["MOD"] = "MOD";
    TokenType["POWER"] = "POWER";
    // Comparisons
    TokenType["EQ"] = "EQ";
    TokenType["NE"] = "NE";
    TokenType["LT"] = "LT";
    TokenType["LE"] = "LE";
    TokenType["GT"] = "GT";
    TokenType["GE"] = "GE";
    // Logical
    TokenType["AND"] = "AND";
    TokenType["OR"] = "OR";
    TokenType["NOT"] = "NOT";
    TokenType["XOR"] = "XOR";
    // Bitwise
    TokenType["SHL"] = "SHL";
    TokenType["SHR"] = "SHR";
    TokenType["SAR"] = "SAR";
    // Punctuation
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["COMMA"] = "COMMA";
    TokenType["COLON"] = "COLON";
    TokenType["DOT"] = "DOT";
    TokenType["BACKSLASH"] = "BACKSLASH";
    // Special
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["EOF"] = "EOF";
    // Type suffixes
    TokenType["PERCENT"] = "PERCENT";
    TokenType["HASH"] = "HASH";
    TokenType["DOLLAR"] = "DOLLAR";
})(TokenType || (TokenType = {}));
const KEYWORDS = {
    'if': TokenType.IF,
    'then': TokenType.THEN,
    'else': TokenType.ELSE,
    'elseif': TokenType.ELSEIF,
    'endif': TokenType.ENDIF,
    'for': TokenType.FOR,
    'to': TokenType.TO,
    'step': TokenType.STEP,
    'next': TokenType.NEXT,
    'while': TokenType.WHILE,
    'wend': TokenType.WEND,
    'repeat': TokenType.REPEAT,
    'until': TokenType.UNTIL,
    'forever': TokenType.FOREVER,
    'select': TokenType.SELECT,
    'case': TokenType.CASE,
    'default': TokenType.DEFAULT,
    'end': TokenType.END,
    'function': TokenType.FUNCTION,
    'return': TokenType.RETURN,
    'local': TokenType.LOCAL,
    'global': TokenType.GLOBAL,
    'const': TokenType.CONST,
    'dim': TokenType.DIM,
    'type': TokenType.TYPE,
    'field': TokenType.FIELD,
    'new': TokenType.NEW,
    'delete': TokenType.DELETE,
    'first': TokenType.FIRST,
    'last': TokenType.LAST,
    'before': TokenType.BEFORE,
    'after': TokenType.AFTER,
    'each': TokenType.EACH,
    'data': TokenType.DATA,
    'read': TokenType.READ,
    'restore': TokenType.RESTORE,
    'include': TokenType.INCLUDE,
    'mod': TokenType.MOD,
    'and': TokenType.AND,
    'or': TokenType.OR,
    'not': TokenType.NOT,
    'xor': TokenType.XOR,
    'shl': TokenType.SHL,
    'shr': TokenType.SHR,
    'sar': TokenType.SAR,
};
export class Lexer {
    constructor(source) {
        this.pos = 0;
        this.line = 1;
        this.column = 1;
        this.errors = [];
        this.source = source;
    }
    tokenize() {
        const tokens = [];
        while (!this.isAtEnd()) {
            this.skipWhitespace();
            if (this.isAtEnd())
                break;
            const token = this.nextToken();
            if (token) {
                tokens.push(token);
            }
        }
        tokens.push({
            type: TokenType.EOF,
            value: '',
            line: this.line,
            column: this.column,
        });
        return { tokens, errors: this.errors };
    }
    nextToken() {
        const start = this.pos;
        const startLine = this.line;
        const startColumn = this.column;
        const ch = this.peek();
        // Comments
        if (ch === ';') {
            this.skipComment();
            return null;
        }
        // Newlines
        if (ch === '\n') {
            this.advance();
            const token = this.makeToken(TokenType.NEWLINE, '\n', startLine, startColumn);
            this.line++;
            this.column = 1;
            return token;
        }
        // Strings
        if (ch === '"') {
            return this.scanString(startLine, startColumn);
        }
        // Numbers
        if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peekNext()))) {
            return this.scanNumber(startLine, startColumn);
        }
        // Identifiers and keywords
        if (this.isAlpha(ch)) {
            return this.scanIdentifier(startLine, startColumn);
        }
        // Operators and punctuation
        switch (ch) {
            case '(':
                this.advance();
                return this.makeToken(TokenType.LPAREN, '(', startLine, startColumn);
            case ')':
                this.advance();
                return this.makeToken(TokenType.RPAREN, ')', startLine, startColumn);
            case ',':
                this.advance();
                return this.makeToken(TokenType.COMMA, ',', startLine, startColumn);
            case ':':
                this.advance();
                return this.makeToken(TokenType.COLON, ':', startLine, startColumn);
            case '.':
                this.advance();
                return this.makeToken(TokenType.DOT, '.', startLine, startColumn);
            case '\\':
                this.advance();
                return this.makeToken(TokenType.BACKSLASH, '\\', startLine, startColumn);
            case '+':
                this.advance();
                return this.makeToken(TokenType.PLUS, '+', startLine, startColumn);
            case '-':
                this.advance();
                return this.makeToken(TokenType.MINUS, '-', startLine, startColumn);
            case '*':
                this.advance();
                return this.makeToken(TokenType.MULTIPLY, '*', startLine, startColumn);
            case '/':
                this.advance();
                return this.makeToken(TokenType.DIVIDE, '/', startLine, startColumn);
            case '^':
                this.advance();
                return this.makeToken(TokenType.POWER, '^', startLine, startColumn);
            case '%':
                this.advance();
                return this.makeToken(TokenType.PERCENT, '%', startLine, startColumn);
            case '#':
                this.advance();
                return this.makeToken(TokenType.HASH, '#', startLine, startColumn);
            case '$':
                this.advance();
                return this.makeToken(TokenType.DOLLAR, '$', startLine, startColumn);
            case '=':
                this.advance();
                return this.makeToken(TokenType.EQ, '=', startLine, startColumn);
            case '<':
                this.advance();
                if (this.peek() === '>') {
                    this.advance();
                    return this.makeToken(TokenType.NE, '<>', startLine, startColumn);
                }
                else if (this.peek() === '=') {
                    this.advance();
                    return this.makeToken(TokenType.LE, '<=', startLine, startColumn);
                }
                return this.makeToken(TokenType.LT, '<', startLine, startColumn);
            case '>':
                this.advance();
                if (this.peek() === '=') {
                    this.advance();
                    return this.makeToken(TokenType.GE, '>=', startLine, startColumn);
                }
                return this.makeToken(TokenType.GT, '>', startLine, startColumn);
            default:
                this.errors.push({
                    message: `Unexpected character: '${ch}'`,
                    line: startLine,
                    column: startColumn,
                });
                this.advance();
                return null;
        }
    }
    scanString(startLine, startColumn) {
        this.advance(); // Skip opening quote
        const start = this.pos;
        while (!this.isAtEnd() && this.peek() !== '"') {
            if (this.peek() === '\n') {
                this.line++;
                this.column = 0;
            }
            this.advance();
        }
        if (this.isAtEnd()) {
            this.errors.push({
                message: 'Unterminated string',
                line: startLine,
                column: startColumn,
            });
        }
        else {
            this.advance(); // Skip closing quote
        }
        const value = this.source.substring(start, this.pos - 1);
        return this.makeToken(TokenType.STRING, value, startLine, startColumn);
    }
    scanNumber(startLine, startColumn) {
        const start = this.pos;
        while (this.isDigit(this.peek())) {
            this.advance();
        }
        // Float?
        if (this.peek() === '.' && this.isDigit(this.peekNext())) {
            this.advance(); // Skip '.'
            while (this.isDigit(this.peek())) {
                this.advance();
            }
            const value = this.source.substring(start, this.pos);
            return this.makeToken(TokenType.FLOAT, value, startLine, startColumn);
        }
        const value = this.source.substring(start, this.pos);
        return this.makeToken(TokenType.INTEGER, value, startLine, startColumn);
    }
    scanIdentifier(startLine, startColumn) {
        const start = this.pos;
        while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
            this.advance();
        }
        // Include type suffix if present (%, #, $)
        if (this.peek() === '%' || this.peek() === '#' || this.peek() === '$') {
            this.advance();
        }
        const value = this.source.substring(start, this.pos);
        const lowerValue = value.toLowerCase();
        // Check for keyword (without type suffix)
        const baseValue = value.replace(/[%#$]$/, '').toLowerCase();
        const type = KEYWORDS[baseValue] || TokenType.IDENTIFIER;
        return this.makeToken(type, value, startLine, startColumn);
    }
    skipWhitespace() {
        while (!this.isAtEnd()) {
            const ch = this.peek();
            if (ch === ' ' || ch === '\t' || ch === '\r') {
                this.advance();
            }
            else {
                break;
            }
        }
    }
    skipComment() {
        while (!this.isAtEnd() && this.peek() !== '\n') {
            this.advance();
        }
    }
    peek() {
        if (this.isAtEnd())
            return '\0';
        return this.source[this.pos];
    }
    peekNext() {
        if (this.pos + 1 >= this.source.length)
            return '\0';
        return this.source[this.pos + 1];
    }
    advance() {
        if (!this.isAtEnd()) {
            this.pos++;
            this.column++;
        }
    }
    isAtEnd() {
        return this.pos >= this.source.length;
    }
    isDigit(ch) {
        return ch >= '0' && ch <= '9';
    }
    isAlpha(ch) {
        return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
    }
    isAlphaNumeric(ch) {
        return this.isAlpha(ch) || this.isDigit(ch);
    }
    makeToken(type, value, line, column) {
        return { type, value, line, column };
    }
}
