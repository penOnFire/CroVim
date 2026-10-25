import type { Settings } from '../../shared/types';

const lines = (value: string): string[] => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

export function settingsToForm(settings: Settings): Record<string, string | boolean> {
  return {
    scrollStep: String(settings.scrollStep), smoothScroll: settings.smoothScroll,
    hintCharacters: settings.hintCharacters, hintMode: settings.hintMode,
    findRegex: settings.findRegex, findSmartCase: settings.findSmartCase, theme: settings.theme,
    keyMappings: Object.entries(settings.keyMappings).map(([key, command]) => `${key}=${command}`).join('\n'),
    excludedPatterns: settings.excludedPatterns.join('\n'),
    searchEngines: settings.searchEngines.map((engine) => `${engine.keyword}=${engine.url}|${engine.name}`).join('\n'),
  };
}

export function formToSettings(form: HTMLFormElement): Partial<Settings> {
  const value = (name: string): string => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  const checked = (name: string): boolean => (form.elements.namedItem(name) as HTMLInputElement).checked;
  const keyMappings: Record<string, string> = {};
  lines(value('keyMappings')).forEach((line) => {
    const split = line.indexOf('=');
    if (split > 0 && line.slice(split + 1).trim()) keyMappings[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  });
  const searchEngines = lines(value('searchEngines')).flatMap((line) => {
    const split = line.indexOf('=');
    const pipe = line.indexOf('|', split + 1);
    if (split <= 0 || pipe <= split + 1) return [];
    return [{ keyword: line.slice(0, split).trim(), url: line.slice(split + 1, pipe).trim(), name: line.slice(pipe + 1).trim() || line.slice(0, split).trim() }];
  });
  return {
    scrollStep: Number(value('scrollStep')), smoothScroll: checked('smoothScroll'),
    hintCharacters: value('hintCharacters'), hintMode: value('hintMode') as Settings['hintMode'],
    findRegex: checked('findRegex'), findSmartCase: checked('findSmartCase'), theme: value('theme') as Settings['theme'],
    keyMappings, excludedPatterns: lines(value('excludedPatterns')), searchEngines,
  };
}

export function validateDraft(x: { scrollStep: number; hintCharacters: string }): boolean {
  return Number.isFinite(x.scrollStep) && x.scrollStep >= 10 && x.scrollStep <= 2000 && new Set([...x.hintCharacters]).size >= 2;
}
