import type {StorybookConfig} from '@storybook/react-vite';
import react from '@vitejs/plugin-react';
import remarkGfm from 'remark-gfm';

const config: StorybookConfig = {
  // Stories live next to the source they document, inside each package. Picking them up
  // from here rather than copying them into this app is what keeps a story honest: it
  // imports the component the same way a consumer's editor would.
  stories: [
    '../src/**/*.mdx',
    // Guides live inside the package they document, for the same reason the stories do:
    // next to the code, so they are edited in the same commit that changes it. (The tarball
    // ships `dist` only; what an installed consumer reads is the package README.)
    '../../../packages/*/src/**/*.mdx',
    '../../../packages/*/src/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    {
      name: '@storybook/addon-docs',
      // Storybook's MDX compiler runs plain CommonMark, which silently renders a GFM table
      // as one paragraph of pipe characters. The guides lean on tables (peer matrix, theme
      // overrides, prop groups), so without this they read as line noise.
      options: {mdxPluginOptions: {mdxCompileOptions: {remarkPlugins: [remarkGfm]}}},
    },
    '@storybook/addon-a11y',
    '@storybook/addon-links',
    '@storybook/addon-vitest',
    // Visual regression. Inert until a Chromatic project token exists: the panel offers to
    // set one up and nothing else runs. Interaction and a11y tests do not depend on it.
    '@chromatic-com/storybook',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    // Prop tables come from the TypeScript types, so the docs page cannot drift from the
    // signature. react-docgen-typescript is the slower reader but the only one that
    // follows an interface through an `extends`, which every prop type here does.
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      // Globbed against the Vite root (`apps/storybook`), so the `../../` is load-bearing:
      // these paths are the parser's file list, not just a filter. The default
      // (`**/*.tsx`) never leaves this app, which leaves every package component
      // undocumented and only says so in a startup warning.
      include: ['../../packages/*/src/**/*.tsx'],
      tsconfigPath: './tsconfig.docgen.json',
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  // `@storybook/react-vite` ships no React plugin of its own (Vite's esbuild handles the
  // JSX), so the React Compiler would not run here. The table's components depend on it
  // for the memoization they are written against, which means without this the showcase
  // and its browser tests exercise different behaviour from the published build.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), react({babel: {plugins: ['babel-plugin-react-compiler']}})],
  }),
};

export default config;
