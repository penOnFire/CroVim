import { describe, expect, it } from 'vitest';
import { buildTextIndex, searchIndex, rangeForOffsets } from '../../src/content/find/text-index';
describe('text index', () => {
  it('finds matches across text nodes and maps ranges', () => {
    document.body.innerHTML = '<p>Hello <b>world</b> hello</p>';
    const index = buildTextIndex(); expect(index.text).toContain('world');
    expect(searchIndex(index, 'hello')).toHaveLength(2);
    expect(rangeForOffsets(index, 0, 5)?.toString()).toBe('Hello');
  });
});
