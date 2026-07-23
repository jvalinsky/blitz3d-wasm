/**
 * Compiler error handling
 *
 * Provides structured error types with line/column information
 */

export interface SourceLocation {
  line: number;
  column: number;
  length?: number;
}

export class CompilerError extends Error {
  constructor(
    message: string,
    public location?: SourceLocation,
    public source?: string,
  ) {
    super(message);
    this.name = "CompilerError";
  }

  toString(): string {
    if (!this.location) {
      return `${this.name}: ${this.message}`;
    }

    const { line, column, length } = this.location;
    let result =
      `${this.name} at line ${line}, column ${column}: ${this.message}`;

    // Add source code snippet if available
    if (this.source) {
      const lines = this.source.split("\n");
      if (line > 0 && line <= lines.length) {
        const sourceLine = lines[line - 1];
        result += `\n\n${line} | ${sourceLine}`;
        result += `\n${" ".repeat(String(line).length)} | ${
          " ".repeat(column - 1)
        }^`;
        if (length && length > 1) {
          result += "~".repeat(
            Math.min(length - 1, sourceLine.length - column),
          );
        }
      }
    }

    return result;
  }
}

export class LexerError extends CompilerError {
  constructor(message: string, location?: SourceLocation, source?: string) {
    super(message, location, source);
    this.name = "LexerError";
  }
}

export class ParseError extends CompilerError {
  constructor(message: string, location?: SourceLocation, source?: string) {
    super(message, location, source);
    this.name = "ParseError";
  }
}

export class CodeGenError extends CompilerError {
  constructor(message: string, location?: SourceLocation, source?: string) {
    super(message, location, source);
    this.name = "CodeGenError";
  }
}

export class ValidationError extends CompilerError {
  constructor(message: string, location?: SourceLocation, source?: string) {
    super(message, location, source);
    this.name = "ValidationError";
  }
}

/**
 * Collect multiple errors instead of failing on first error
 */
export class ErrorCollector {
  private errors: CompilerError[] = [];
  private warnings: CompilerError[] = [];

  addError(error: CompilerError): void {
    this.errors.push(error);
  }

  addWarning(warning: CompilerError): void {
    this.warnings.push(warning);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  getErrors(): CompilerError[] {
    return this.errors;
  }

  getWarnings(): CompilerError[] {
    return this.warnings;
  }

  clear(): void {
    this.errors = [];
    this.warnings = [];
  }

  toString(): string {
    let result = "";

    if (this.errors.length > 0) {
      result += `${this.errors.length} error(s):\n`;
      result += this.errors.map((e) => e.toString()).join("\n\n");
    }

    if (this.warnings.length > 0) {
      if (result) result += "\n\n";
      result += `${this.warnings.length} warning(s):\n`;
      result += this.warnings.map((w) => w.toString()).join("\n\n");
    }

    return result || "No errors or warnings";
  }
}
