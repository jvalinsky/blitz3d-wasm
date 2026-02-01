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
export interface Program extends Node {
    kind: 'Program';
    statements: Statement[];
}
export type Statement = VariableDeclaration | FunctionDeclaration | TypeDeclaration | DataStatement | Assignment | IfStatement | ForStatement | WhileStatement | RepeatStatement | SelectStatement | ReturnStatement | ExpressionStatement | LabelStatement | GotoStatement | IncludeStatement;
export interface VariableDeclaration extends Node {
    kind: 'VariableDeclaration';
    scope: 'Local' | 'Global' | 'Const' | 'Dim';
    name: string;
    type?: TypeAnnotation;
    initializer?: Expression;
    dimensions?: Expression[];
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
    dimensions?: Expression[];
}
export interface DataStatement extends Node {
    kind: 'DataStatement';
    values: Expression[];
    label?: string;
}
export interface Assignment extends Node {
    kind: 'Assignment';
    target: Expression;
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
    condition?: Expression;
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
export interface IncludeStatement extends Node {
    kind: 'IncludeStatement';
    filename: string;
}
export type Expression = IntegerLiteral | FloatLiteral | StringLiteral | Identifier | BinaryExpression | UnaryExpression | CallExpression | FieldAccess | ArrayAccess | NewExpression | FirstExpression | LastExpression | BeforeExpression | AfterExpression | HandleExpression | ObjectCastExpression;
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
    type?: TypeAnnotation;
}
export interface BinaryExpression extends Node {
    kind: 'BinaryExpression';
    operator: BinaryOperator;
    left: Expression;
    right: Expression;
}
export type BinaryOperator = '+' | '-' | '*' | '/' | 'Mod' | '^' | '=' | '<>' | '<' | '<=' | '>' | '>=' | 'And' | 'Or' | 'Xor' | 'Shl' | 'Shr' | 'Sar';
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
export interface TypeAnnotation {
    name: string;
    suffix?: '%' | '#' | '$';
}
export declare function inferTypeFromSuffix(suffix?: string): TypeAnnotation | undefined;
export declare function isStatement(node: Node): node is Statement;
export declare function isExpression(node: Node): node is Expression;
