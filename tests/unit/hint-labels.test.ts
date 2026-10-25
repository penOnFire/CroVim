import { describe, expect, it } from 'vitest';
import { hintLabels } from '../../src/content/link-hints/hint-labels';
describe('hint labels', () => {
  it('generates deterministic labels for the requested counts', () => {
    expect(hintLabels(6, 'ab')).toEqual(['aaa', 'aab', 'aba', 'abb', 'baa', 'bab']);
    expect(hintLabels(0)).toEqual([]);
    expect(() => hintLabels(2, 'a')).toThrow();
  });

  it.each([0, 1, 4, 15, 50, 150])('keeps %i labels unique and prefix-free', (count) => {
    const labels = hintLabels(count);
    expect(labels).toHaveLength(count);
    expect(new Set(labels).size).toBe(count);
    for (const label of labels) {
      expect(labels.some((other) => other !== label && other.startsWith(label))).toBe(false);
    }
  });
});
