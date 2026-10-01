import {isDevelopment} from './valueChecks.js';

describe('isDevelopment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('follows NODE_ENV, so the warnings stay out of a production build', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDevelopment()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDevelopment()).toBe(false);
  });

  it('is false, without throwing, where there is no process at all', () => {
    // A browser bundle whose bundler did not replace `process.env.NODE_ENV`.
    vi.stubGlobal('process', undefined);
    try {
      expect(isDevelopment()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
