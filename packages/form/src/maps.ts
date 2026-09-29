// Filled in by its own task. The entry exists now so the build and the exports map
// cover all four from the start. A type-only placeholder (rather than a bare `export {}`)
// because oxlint and eslint both reject an empty export specifier list; erased at
// runtime, so this entry's public surface stays empty until its task replaces it.
export type Placeholder = Record<string, never>;
