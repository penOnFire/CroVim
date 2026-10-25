import { describe, expect, it } from 'vitest';
import { CommandTrie } from '../../src/content/command-trie';
import { defaults } from '../../src/shared/settings-schema';

describe('command trie', () => {
  const trie = new CommandTrie(defaults().keyMappings);

  it.each(['j', 'k', 'F', '?'])('matches single-key command %s', (key) => {
    expect(trie.match([key])).toMatchObject({ command: defaults().keyMappings[key], prefix: false, consumed: [key] });
  });

  it.each(['gg', 'gu', 'gU', 'gt', 'gT', 'g0', 'g$', 'yy', 'yf', '<<', '>>', '[[', ']]'])(
    'matches multi-key sequence %s',
    (sequence) => {
      expect(trie.match([...sequence])).toMatchObject({
        command: defaults().keyMappings[sequence],
        consumed: [...sequence],
      });
    },
  );

  it('reports prefixes without prematurely dispatching them', () => {
    expect(trie.match(['g'])).toMatchObject({ prefix: true, consumed: ['g'] });
    expect(trie.match(['y'])).toMatchObject({ prefix: true, consumed: ['y'] });
    expect(trie.match(['z'])).toMatchObject({ prefix: true, consumed: ['z'] });
  });

  it('rejects unknown sequences and exposes exact mappings', () => {
    expect(trie.match(['q'])).toEqual({ prefix: false, consumed: [] });
    expect(trie.match(['g', 'q'])).toEqual({ prefix: false, consumed: [] });
    expect(trie.has('gg')).toBe(true);
    expect(trie.has('gq')).toBe(false);
  });
});
