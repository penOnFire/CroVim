import { describe, expect, it, beforeEach, vi } from 'vitest';
import { FindMode } from '../../src/content/find/find-mode';

beforeEach(() => {
  document.body.innerHTML = '';
  Element.prototype.scrollIntoView = vi.fn();
});

describe('FindMode', () => {
  it('searches text with SmartCase and selects the first match', () => {
    document.body.innerHTML = '<p>alpha ALPHA alpha</p>';
    const mode = new FindMode();
    expect(mode.search('alpha')).toBe(3);
    expect(mode.currentIndex()).toBe(1);
    expect(mode.search('alpha', false, false)).toBe(2);
    expect(mode.search('ALPHA')).toBe(1);
  });

  it('supports regular expressions and rejects invalid patterns', () => {
    document.body.innerHTML = '<p>item 12, item 34</p>';
    const mode = new FindMode();
    expect(mode.search(String.raw`item \d+`, true)).toBe(2);
    expect(mode.search('[', true)).toBe(0);
    expect(mode.currentIndex()).toBe(0);
  });

  it('wraps next and previous navigation', () => {
    document.body.innerHTML = '<p>one two one</p>';
    const mode = new FindMode();
    mode.search('one');
    expect(mode.next()?.toString()).toBe('one');
    expect(mode.currentIndex()).toBe(2);
    expect(mode.next()?.toString()).toBe('one');
    expect(mode.currentIndex()).toBe(1);
    expect(mode.next(true)?.toString()).toBe('one');
    expect(mode.currentIndex()).toBe(2);
    expect(mode.next(true)?.toString()).toBe('one');
    expect(mode.currentIndex()).toBe(1);
  });
});
