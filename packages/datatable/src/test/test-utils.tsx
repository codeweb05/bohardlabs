import {ThemeProvider, createTheme} from '@mui/material';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {RenderOptions} from '@testing-library/react';
import {render} from '@testing-library/react';
import type {ReactElement, ReactNode} from 'react';

/**
 * A stock MUI theme, not an app theme. The table has to look right under whatever palette
 * a consumer hands it, so pinning tests to a branded theme would hide exactly the coupling
 * this package is trying to avoid.
 */
const testTheme = createTheme();

const activeClients = new Set<QueryClient>();

export function createTestQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {retry: false, gcTime: 0, staleTime: 0},
      mutations: {retry: false},
    },
  });
  activeClients.add(client);
  return client;
}

export function clearAllTestQueryClients(): void {
  for (const client of activeClients) {
    client.clear();
    client.unmount();
  }
  activeClients.clear();
}

function AllTheProviders({children}: Readonly<{children: ReactNode}>) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={testTheme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

export function createTestWrapper(): {
  wrapper: ({children}: Readonly<{children: ReactNode}>) => ReactElement;
  queryClient: QueryClient;
} {
  const queryClient = createTestQueryClient();
  const wrapper = ({children}: Readonly<{children: ReactNode}>) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={testTheme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
  return {wrapper, queryClient};
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {wrapper: AllTheProviders, ...options});
}

/**
 * Row fixture. `[key: string]: unknown` is what satisfies the table's `RowData`
 * constraint: an interface gets no implicit index signature, so without it every
 * `<DataTable<TestRole>>` in the suite fails to typecheck.
 */
export interface TestRole {
  readonly id: string;
  readonly name: string;
  readonly roleType: 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOM';
  readonly description?: string | null;
  readonly permissions?: {id: string; resource: string; action: string}[];
  readonly createdAt?: string;
  readonly [key: string]: unknown;
}

export function generateTestRoles(count: number): TestRole[] {
  const roleTypes = ['SUPER_ADMIN', 'ADMIN', 'CUSTOM'] as const;
  return Array.from({length: count}, (_, i) => ({
    id: `role-${i + 1}`,
    name: `Role ${i + 1}`,
    roleType: roleTypes[i % 3],
    description: i % 2 === 0 ? `Description for role ${i + 1}` : null,
    permissions: Array.from({length: (i % 5) + 1}, (_unused, j) => ({
      id: `perm-${i}-${j}`,
      resource: 'CONFIG',
      action: 'VIEW',
    })),
    createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

export {fireEvent, screen, waitFor} from '@testing-library/react';
export {customRender as render};
