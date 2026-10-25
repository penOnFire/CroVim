import { beforeEach, describe, expect, it } from 'vitest';
import { blurEditable, getDeepActiveElement, isEditable } from '../../src/content/editable-target';

describe('editable target detection', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('detects supported controls and excludes non-text inputs', () => {
    document.body.innerHTML = '<input id="text"><input id="check" type="checkbox"><div id="box" contenteditable="plaintext-only"></div>';
    expect(isEditable(document.querySelector('#text'))).toBe(true);
    expect(isEditable(document.querySelector('#check'))).toBe(false);
    expect(isEditable(document.querySelector('#box'))).toBe(true);
  });

  it('blurs deep active contenteditable elements', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<div contenteditable="true" id="editor"></div>';
    document.body.append(host);
    const editor = shadow.querySelector('#editor') as HTMLElement;
    editor.focus();
    expect(getDeepActiveElement()).toBe(editor);
    blurEditable();
    expect(getDeepActiveElement()).not.toBe(editor);
  });
});
