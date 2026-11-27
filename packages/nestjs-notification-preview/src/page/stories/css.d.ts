// The stories inline the stylesheet a consumer imports; Vite answers `?inline` with its text.
declare module '*.css?inline' {
  const css: string;
  export default css;
}
