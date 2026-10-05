/**
 * Ambient declarations for non-code imports.
 *
 * Rsbuild resolves the CSS through its own pipeline; TypeScript only needs to know
 * that a stylesheet import is a valid side-effect import.
 */

declare module '*.css';
declare module '*.svg' {
  const url: string;
  export default url;
}

/** Raw text import, used to read the invariant token layer for the export. */
declare module '*?raw' {
  const content: string;
  export default content;
}