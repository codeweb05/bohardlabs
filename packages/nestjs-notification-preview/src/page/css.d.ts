// The stories inline the stylesheet, and Vite answers `?inline` with its text.
declare module '*.css?inline' {
  const css: string;
  export default css;
}
