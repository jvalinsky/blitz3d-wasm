"use strict";
/**
 * Blitz3D AST (Abstract Syntax Tree)
 *
 * Represents the parsed structure of Blitz3D programs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferTypeFromSuffix = inferTypeFromSuffix;
exports.isStatement = isStatement;
exports.isExpression = isExpression;
// ============================================================================
// Utilities
// ============================================================================
function inferTypeFromSuffix(suffix) {
  if (!suffix) {
    return undefined;
  }
  switch (suffix) {
    case "%":
      return { name: "Int", suffix: "%" };
    case "#":
      return { name: "Float", suffix: "#" };
    case "$":
      return { name: "String", suffix: "$" };
    default:
      return undefined;
  }
}
function isStatement(node) {
  return [
    "VariableDeclaration",
    "FunctionDeclaration",
    "TypeDeclaration",
    "DataStatement",
    "Assignment",
    "IfStatement",
    "ForStatement",
    "WhileStatement",
    "RepeatStatement",
    "SelectStatement",
    "ReturnStatement",
    "ExpressionStatement",
    "LabelStatement",
    "GotoStatement",
    "IncludeStatement",
  ].includes(node.kind);
}
function isExpression(node) {
  return [
    "IntegerLiteral",
    "FloatLiteral",
    "StringLiteral",
    "Identifier",
    "BinaryExpression",
    "UnaryExpression",
    "CallExpression",
    "FieldAccess",
    "ArrayAccess",
    "NewExpression",
    "FirstExpression",
    "LastExpression",
    "BeforeExpression",
    "AfterExpression",
    "HandleExpression",
    "ObjectCastExpression",
  ].includes(node.kind);
}
