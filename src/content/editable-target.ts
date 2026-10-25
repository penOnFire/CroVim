const excludedInputTypes = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'color', 'range', 'hidden']);

export function getDeepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let active = root.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function isInsideCrovimUi(element: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (current.id === 'crovim-ui-root') return true;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot && root.host instanceof Element ? root.host : current.parentElement;
  }
  return false;
}

function editableElement(element: Element): boolean {
  if (element instanceof HTMLInputElement && excludedInputTypes.has(element.type.toLowerCase())) return false;
  if (element.matches('input,textarea,select')) return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return element.matches('[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"],[role="textbox"],[role="searchbox"],[role="combobox"]');
}

export function isEditable(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null;
  if (element && isInsideCrovimUi(element)) return false;
  while (element) {
    if (editableElement(element)) return true;
    const root = element.getRootNode();
    element = root instanceof ShadowRoot && root.host instanceof Element ? root.host : element.parentElement;
  }
  return false;
}

export function blurEditable(): void {
  const deepActive = getDeepActiveElement();
  const active = document.activeElement;
  let current: Element | null = deepActive ?? active;
  while (current) {
    if (current instanceof HTMLElement && editableElement(current)) {
      current.blur();
    }
    const root = current.getRootNode();
    current = root instanceof ShadowRoot && root.host instanceof Element ? root.host : current.parentElement;
  }
  if (deepActive instanceof HTMLElement) deepActive.blur();
  if (active instanceof HTMLElement) active.blur();
  const selection = window.getSelection();
  if (selection && deepActive && isEditable(deepActive)) selection.removeAllRanges();
  if (document.activeElement && isEditable(document.activeElement) && document.body) {
    const hadTabIndex = document.body.hasAttribute('tabindex');
    if (!hadTabIndex) document.body.setAttribute('tabindex', '-1');
    document.body.focus({ preventScroll: true });
    if (!hadTabIndex) document.body.removeAttribute('tabindex');
  }
}
