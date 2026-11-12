import { describe, expect, it } from 'vitest';

import { DEFAULT_PORT, loadAppConfig } from './app-config.js';

describe('loadAppConfig', () => {
  it('falls back to the documented local port when PORT is not set', () => {
    expect(loadAppConfig({})).toEqual({ port: DEFAULT_PORT });
    expect(loadAppConfig({ PORT: '' })).toEqual({ port: DEFAULT_PORT });
  });

  it('reads the port from PORT', () => {
    expect(loadAppConfig({ PORT: '8080' })).toEqual({ port: 8080 });
  });

  it('refuses a PORT that is not a valid TCP port', () => {
    expect(() => loadAppConfig({ PORT: 'http' })).toThrow(RangeError);
    expect(() => loadAppConfig({ PORT: '0' })).toThrow(RangeError);
    expect(() => loadAppConfig({ PORT: '70000' })).toThrow(RangeError);
    expect(() => loadAppConfig({ PORT: '30.5' })).toThrow(RangeError);
  });
});
