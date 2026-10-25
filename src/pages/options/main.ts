import { sendRpc } from '../../shared/rpc';
import { validateSettings } from '../../shared/settings-schema';
import type { Settings } from '../../shared/types';
import { formToSettings, settingsToForm } from './settings-form';
import './options.css';

const form = document.querySelector<HTMLFormElement>('#settings');
const output = document.querySelector<HTMLOutputElement>('output');
const reset = document.querySelector<HTMLButtonElement>('#reset');
if (form && output) {
  form.noValidate = true;
  const controls = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const fill = (settings: Settings) => Object.entries(settingsToForm(settings)).forEach(([name, value]) => {
    const control = controls(name);
    if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = String(value);
  });
  void sendRpc<Settings>('settings.get').then(fill).catch((error: Error) => { output.textContent = error.message; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    output.textContent = 'Saving…';
    let patch: Partial<Settings>;
    try { patch = formToSettings(form); } catch (error) {
      output.dataset.state = 'error'; output.textContent = error instanceof Error ? error.message : 'Could not read settings.'; return;
    }
    const errors = validateSettings(patch);
    if (errors.length) { output.dataset.state = 'error'; output.textContent = errors.join('; '); return; }
    void sendRpc<Settings>('settings.update', patch).then(() => {
      output.dataset.state = 'success'; output.textContent = 'Saved settings.'; 
    }).catch((error: Error) => { output.dataset.state = 'error'; output.textContent = error.message; });
  });
  reset?.addEventListener('click', () => void sendRpc<Settings>('settings.reset').then((settings) => {
    fill(settings); output.dataset.state = 'success'; output.textContent = 'Defaults restored.';
  }).catch((error: Error) => { output.dataset.state = 'error'; output.textContent = error.message; }));
}
