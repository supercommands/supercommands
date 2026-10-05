/**
 * Shared command-terminal search adapter.
 *
 * This is a thin bridge into the existing shared `searchAll()` engine. It does
 * not rank independently, own Chrome behavior, render rows, execute commands,
 * or duplicate command/entity metadata.
 */
export * from './searchAdapter';
