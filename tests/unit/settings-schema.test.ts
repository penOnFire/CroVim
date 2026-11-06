import { describe, expect, it } from 'vitest';
import { defaults, normalizeSettings, validateSettings } from '../../src/shared/settings-schema';

describe('settings schema', () => {
  it('has minimalMode: true and Q: hoverHint as defaults', () => {
    const d = defaults();
    expect(d.minimalMode).toBe(true);
    expect(d.keyMappings.Q).toBe('hoverHint');
    expect(d.keyMappings.q).toBeUndefined();
  });

  it('normalizes malformed values without losing defaults', () => {
    const settings = normalizeSettings({
      scrollStep: 99999,
      hintCharacters: 'aabc',
      passKeys: ['x', 1],
      minimalMode: 'not-a-bool',
      keyMappings: { q: 'hoverHint', custom: 'something' },
    });
    expect(settings.scrollStep).toBe(2000);
    expect(settings.hintCharacters).toBe('abc');
    expect(settings.passKeys).toEqual(['x']);
    expect(settings.minimalMode).toBe(true);
    expect(settings.keyMappings.gg).toBe('scrollTop');
    expect(settings.keyMappings.f).toBeUndefined();
    expect(settings.keyMappings.F).toBe('enterHints');
    expect(settings.keyMappings.q).toBeUndefined();
    expect(settings.keyMappings.Q).toBe('hoverHint');
    expect(settings.keyMappings.custom).toBe('something');

    const disabled = normalizeSettings({ minimalMode: false });
    expect(disabled.minimalMode).toBe(false);
  });
  it('reports duplicate search keywords and invalid templates', () => {
    const errors = validateSettings({ ...defaults(), searchEngines: [
      { keyword: 'x', name: 'A', url: 'https://a.test/%s' }, { keyword: 'x', name: 'B', url: 'https://b.test' },
    ] });
    expect(errors.some((error) => error.includes('Duplicate'))).toBe(true);
    expect(errors.some((error) => error.includes('must contain'))).toBe(true);
  });
});
