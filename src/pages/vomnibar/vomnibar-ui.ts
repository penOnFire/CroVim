export interface DisplayResult { title: string; url: string; source: string; match?: number[] }

export function selected(items: Element[], index: number): Element | undefined {
  items.forEach((item, itemIndex) => {
    const active = itemIndex === index;
    item.classList.toggle('selected', active);
    item.setAttribute('aria-selected', String(active));
  });
  return items[index];
}

export function highlighted(text: string, matches: number[] = []): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const positions = new Set(matches);
  let run = '';
  [...text].forEach((character, index) => {
    if (positions.has(index)) {
      if (run) { fragment.append(run); run = ''; }
      const mark = document.createElement('mark'); mark.textContent = character; fragment.append(mark);
    } else run += character;
  });
  if (run) fragment.append(run);
  return fragment;
}

export function renderResults(list: HTMLElement, results: DisplayResult[], activeIndex: number): void {
  list.replaceChildren(...results.map((result, index) => {
    const item = document.createElement('li');
    item.id = `result-${index}`; item.dataset.url = result.url; item.dataset.index = String(index);
    item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(index === activeIndex));
    const title = document.createElement('strong'); title.append(highlighted(result.title || result.url, result.match));
    const url = document.createElement('span'); url.textContent = result.url;
    const badge = document.createElement('b'); badge.className = `badge badge-${result.source}`; badge.textContent = result.source;
    item.append(badge, title, url); item.classList.toggle('selected', index === activeIndex);
    list.append(item); return item;
  }));
}
