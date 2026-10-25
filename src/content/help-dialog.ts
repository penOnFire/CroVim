export function showHelp(root: ShadowRoot, mappings: Record<string, string>): HTMLDialogElement {
  const dialog = document.createElement('dialog'); dialog.className = 'help-dialog';
  const heading = document.createElement('h2'); heading.textContent = 'CroVim commands'; dialog.append(heading);
  const filter = document.createElement('input'); filter.placeholder = 'Filter commands'; filter.setAttribute('aria-label', 'Filter commands'); dialog.append(filter);
  const list = document.createElement('ul'); dialog.append(list);
  const render = (): void => {
    const query = filter.value.toLowerCase(); list.replaceChildren(...Object.entries(mappings)
      .filter(([key, command]) => `${key} ${command}`.toLowerCase().includes(query))
      .map(([key, command]) => { const item = document.createElement('li'); item.textContent = `${key} — ${command}`; return item; }));
  };
  filter.addEventListener('input', render);   dialog.addEventListener('cancel', (event) => { event.preventDefault(); dialog.close(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  root.append(dialog); dialog.showModal(); render(); return dialog;
}
