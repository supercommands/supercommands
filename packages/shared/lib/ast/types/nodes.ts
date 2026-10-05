import type { FieldConfig, FieldType } from './fields.js';

/**
 * Base interface for all AST Nodes.
 * Every node must have a stable unique ID.
 */
export interface BaseASTNode {
  /**
   * A globally unique, immutable ID for this node.
   */
  id: string;

  /**
   * Discriminator for the node type.
   */
  type: string;
}

/**
 * Structural Node: Section
 * Defines a structural boundary or grouping.
 */
export interface SectionNode extends BaseASTNode {
  type: 'section';
  children: ASTNode[];
}

/**
 * Structural Node: Paragraph
 * Represents a standard block of text/fields.
 */
export interface ParagraphNode extends BaseASTNode {
  type: 'paragraph';
  children: ASTNode[];
}

export interface LinkTextMark {
  type: 'link';
  href: string;
}

export type TextMark = LinkTextMark;

/**
 * Content Node: Text
 * Static text content.
 */
export interface TextNode extends BaseASTNode {
  type: 'text';
  value: string;
  marks?: TextMark[];
}

/**
 * Content Node: Field
 * An interactive field with specific behavior driven by its fieldType and config.
 */
export interface FieldNode extends BaseASTNode {
  type: 'field';
  fieldType: FieldType;
  config: FieldConfig;
  /**
   * Optional human-readable alias for authoring expressions.
   */
  alias?: string;
}

/**
 * Content Node: Expression
 * Evaluates dynamically at runtime based on the Runtime Context.
 */
export interface ExpressionNode extends BaseASTNode {
  type: 'expression';
  /**
   * The raw expression string (or pre-compiled expression AST representation).
   */
  expression: string;
}

/**
 * Content Node: Cursor
 * Represents where the text cursor should be placed after snippet insertion.
 */
export interface CursorNode extends BaseASTNode {
  type: 'cursor';
}

/**
 * Union of all structural nodes.
 */
export type StructuralNode = SectionNode | ParagraphNode;

/**
 * Union of all content nodes.
 */
export type ContentNode = TextNode | FieldNode | ExpressionNode | CursorNode;

/**
 * Union of all AST Nodes.
 */
export type ASTNode = StructuralNode | ContentNode;
