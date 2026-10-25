import { sendRpc } from '../../shared/rpc';
import type { Completion } from '../../background/vomnibar-search';
import { renderResults, selected } from './vomnibar-ui';
import './vomnibar.css';

const query = document.querySelector<HTMLInputElement>('#query');
const list = document.querySelector<HTMLElement>('#results');
let results: Completion[] = [];
let active = 0;
const close = () => window.parent.postMessage({ type: 'crovim:vomnibar-close' }, '*');
const draw = () => { if (!list) return; renderResults(list, results, active); list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' }); };
const choose = (newTab: boolean) => {
  const result = results[active];
  if (!result) return;
  void sendRpc('url.open', { url: result.url, active: !newTab }).then(close);
};
let request = 0;
query?.addEventListener('input', () => {
  const current = ++request;
  void sendRpc<Completion[]>('omnibar.complete', { query: query.value }).then((next) => {
    if (current !== request) return;
    results = next; active = 0; draw();
  }).catch(() => { results = []; draw(); });
});
query?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') { event.preventDefault(); active = Math.min(active + 1, Math.max(results.length - 1, 0)); draw(); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); active = Math.max(active - 1, 0); draw(); }
  else if (event.key === 'Enter') { event.preventDefault(); choose(event.shiftKey); }
  else if (event.key === 'Escape') { event.preventDefault(); close(); }
});
list?.addEventListener('click', (event) => {
  const item = (event.target as Element).closest<HTMLElement>('[data-index]');
  if (!item) return;
  active = Number(item.dataset.index); choose(false);
});
list?.addEventListener('mousemove', (event) => {
  const item = (event.target as Element).closest<HTMLElement>('[data-index]');
  if (item) { active = Number(item.dataset.index); selected([...list.children], active); }
});
