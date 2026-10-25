export function openVomnibar(shadow?: ShadowRoot, mode: 'new' | 'current' = 'new', bus: EventTarget = document): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = `${chrome.runtime.getURL('pages/vomnibar.html')}#${mode}`;
  iframe.title = 'CroVim Vomnibar';
  iframe.className = 'vomnibar-frame';
  (shadow ?? document.documentElement).append(iframe);
  const close = (): void => { iframe.remove(); bus.dispatchEvent(new CustomEvent('crovim:vomnibar-close')); };
  window.addEventListener('message', (event) => {
    if (event.source === iframe.contentWindow && (event.data?.type === 'crovim:close' || event.data?.type === 'crovim:vomnibar-close')) close();
  }, { once: true });
  return iframe;
}
