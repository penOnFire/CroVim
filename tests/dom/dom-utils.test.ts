import { describe, expect, it } from 'vitest';
import { walkOpen } from '../../src/content/dom-utils';
describe('shadow DOM discovery', () => {
  it('walks open shadow roots', () => {
    const host = document.createElement('div'); const shadow = host.attachShadow({ mode: 'open' }); shadow.innerHTML = '<button>Shadow</button>'; document.body.append(host);
    const tags: string[] = []; walkOpen(document, (element) => tags.push(element.tagName));
    expect(tags).toContain('BUTTON');
  });
});
