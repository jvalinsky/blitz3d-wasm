/**
 * Blitz3D AST (Abstract Syntax Tree)
 * 
 * Represents the parsed structure of Blitz3D programs
 */

export interface SourceLocation {
  line: number;
  column: number;
}

export interface Node {
  kind: string;
  loc?: SourceLocation;
}

// ============================================================================
// Program
// ============================================================================

export interface Program extends Node {
  kind: 'Program';
  statements: Statement[];
}

// ============================================================================
// Statements
// ============================================================================

export type Statement =
  | VariableDeclaration
  | FunctionDeclaration
  | TypeDeclaration
  | DataStatement
  | ReadStatement
  | RestoreStatement
  | Assignment
  | IfStatement
  | ForStatement
  | WhileStatement
  | RepeatStatement
  | SelectStatement
  | ReturnStatement
  | ExpressionStatement
  | LabelStatement
  | GotoStatement
  | GosubStatement
  | EndStatement
  | IncludeStatement;

export interface VariableDeclaration extends Node {
  kind: 'VariableDeclaration';
  scope: 'Local' | 'Global' | 'Const' | 'Dim';
  name: string;
  type?: TypeAnnotation;
  initializer?: Expression;
  dimensions?: Expression[]; // For arrays: Dim arr(10, 20)
}

export interface FunctionDeclaration extends Node {
  kind: 'FunctionDeclaration';
  name: string;
  parameters: Parameter[];
  returnType?: TypeAnnotation;
  body: Statement[];
}

export interface Parameter {
  name: string;
  type?: TypeAnnotation;
  defaultValue?: Expression;
}

export interface TypeDeclaration extends Node {
  kind: 'TypeDeclaration';
  name: string;
  fields: Field[];
}

export interface Field {
  name: string;
  type?: TypeAnnotation;
  dimensions?: Expression[]; // For array fields
}

export interface DataStatement extends Node {
  kind: 'DataStatement';
  values: Expression[];
  label?: string;
}

export interface ReadStatement extends Node {
  kind: 'ReadStatement';
  variables: Identifier[];
}

export interface RestoreStatement extends Node {
  kind: 'RestoreStatement';
  label?: string;
}

export interface Assignment extends Node {
  kind: 'Assignment';
  target: Expression; // Variable, field access, or array element
  value: Expression;
}

export interface IfStatement extends Node {
  kind: 'IfStatement';
  condition: Expression;
  thenBranch: Statement[];
  elseIfBranches?: ElseIfBranch[];
  elseBranch?: Statement[];
}

export interface ElseIfBranch {
  condition: Expression;
  body: Statement[];
}

export interface ForStatement extends Node {
  kind: 'ForStatement';
  variable: string;
  start: Expression;
  end: Expression;
  step?: Expression;
  body: Statement[];
}

export interface WhileStatement extends Node {
  kind: 'WhileStatement';
  condition: Expression;
  body: Statement[];
}

export interface RepeatStatement extends Node {
  kind: 'RepeatStatement';
  body: Statement[];
  condition?: Expression; // Until condition (optional for Forever)
}

export interface SelectStatement extends Node {
  kind: 'SelectStatement';
  value: Expression;
  cases: CaseClause[];
  defaultCase?: Statement[];
}

export interface CaseClause {
  values: Expression[];
  body: Statement[];
}

export interface ReturnStatement extends Node {
  kind: 'ReturnStatement';
  value?: Expression;
}

export interface ExpressionStatement extends Node {
  kind: 'ExpressionStatement';
  expression: Expression;
}

export interface LabelStatement extends Node {
  kind: 'LabelStatement';
  name: string;
}

export interface GotoStatement extends Node {
  kind: 'GotoStatement';
  label: string;
}

export interface GosubStatement extends Node {
  kind: 'GosubStatement';
  label: string;
}

export interface EndStatement extends Node {
  kind: 'EndStatement';
}

export interface IncludeStatement extends Node {
  kind: 'IncludeStatement';
  filename: string;
}

// ============================================================================
// Expressions
// ============================================================================

export type Expression =
  | IntegerLiteral
  | FloatLiteral
  | StringLiteral
  | Identifier
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | FieldAccess
  | ArrayAccess
  | NewExpression
  | FirstExpression
  | LastExpression
  | BeforeExpression
  | AfterExpression
  | HandleExpression
  | ObjectCastExpression;

export interface IntegerLiteral extends Node {
  kind: 'IntegerLiteral';
  value: number;
}

export interface FloatLiteral extends Node {
  kind: 'FloatLiteral';
  value: number;
}

export interface StringLiteral extends Node {
  kind: 'StringLiteral';
  value: string;
}

export interface Identifier extends Node {
  kind: 'Identifier';
  name: string;
  type?: TypeAnnotation; // For type suffixes: x%, y#, s$
}

export interface BinaryExpression extends Node {
  kind: 'BinaryExpression';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export type BinaryOperator =
  | '+' | '-' | '*' | '/' | 'Mod' | '^'
  | '=' | '<>' | '<' | '<=' | '>' | '>='
  | 'And' | 'Or' | 'Xor'
  | 'Shl' | 'Shr' | 'Sar';

export interface UnaryExpression extends Node {
  kind: 'UnaryExpression';
  operator: UnaryOperator;
  operand: Expression;
}

export type UnaryOperator = '+' | '-' | 'Not';

export interface CallExpression extends Node {
  kind: 'CallExpression';
  callee: string;
  arguments: Expression[];
}

export interface FieldAccess extends Node {
  kind: 'FieldAccess';
  object: Expression;
  field: string;
}

export interface ArrayAccess extends Node {
  kind: 'ArrayAccess';
  array: Expression;
  indices: Expression[];
}

export interface NewExpression extends Node {
  kind: 'NewExpression';
  typeName: string;
}

export interface FirstExpression extends Node {
  kind: 'FirstExpression';
  typeName: string;
}

export interface LastExpression extends Node {
  kind: 'LastExpression';
  typeName: string;
}

export interface BeforeExpression extends Node {
  kind: 'BeforeExpression';
  object: Expression;
}

export interface AfterExpression extends Node {
  kind: 'AfterExpression';
  object: Expression;
}

export interface HandleExpression extends Node {
  kind: 'HandleExpression';
  object: Expression;
}

export interface ObjectCastExpression extends Node {
  kind: 'ObjectCastExpression';
  typeName: string;
  object: Expression;
}

// ============================================================================
// Type Annotations
// ============================================================================

export interface TypeAnnotation {
  name: string; // 'Int', 'Float', 'String', or custom type name
  suffix?: '%' | '#' | '$'; // Type suffix
}

// ============================================================================
// Utilities
// ============================================================================

export function inferTypeFromSuffix(suffix?: string): TypeAnnotation | undefined {
  if (!suffix) return undefined;
  
  switch (suffix) {
    case '%': return { name: 'Int', suffix: '%' };
    case '#': return { name: 'Float', suffix: '#' };
    case '$': return { name: 'String', suffix: '$' };
    default: return undefined;
  }
}

export function isStatement(node: Node): node is Statement {
  return [
    'VariableDeclaration',
    'FunctionDeclaration',
    'TypeDeclaration',
    'DataStatement',
    'ReadStatement',
    'RestoreStatement',
    'Assignment',
    'IfStatement',
    'ForStatement',
    'WhileStatement',
    'RepeatStatement',
    'SelectStatement',
    'ReturnStatement',
    'ExpressionStatement',
    'LabelStatement',
    'GotoStatement',
    'GosubStatement',
    'EndStatement',
    'IncludeStatement',
  ].includes(node.kind);
}

export function isExpression(node: Node): node is Expression {
  return [
    'IntegerLiteral',
    'FloatLiteral',
    'StringLiteral',
    'Identifier',
    'BinaryExpression',
    'UnaryExpression',
    'CallExpression',
    'FieldAccess',
    'ArrayAccess',
    'NewExpression',
    'FirstExpression',
    'LastExpression',
    'BeforeExpression',
    'AfterExpression',
    'HandleExpression',
    'ObjectCastExpression',
  ].includes(node.kind);
}
