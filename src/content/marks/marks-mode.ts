export class MarksMode {
  set(key: string): void {
    localStorage.setItem(`crovimMark|${location.href.split('#')[0]}|${key}`, JSON.stringify({ scrollX, scrollY, hash: location.hash }));
  }
  goto(key: string): void {
    try {
      const value = JSON.parse(localStorage.getItem(`crovimMark|${location.href.split('#')[0]}|${key}`) ?? 'null') as { scrollX?: number; scrollY?: number; hash?: string } | null;
      if (value) { scrollTo(value.scrollX ?? 0, value.scrollY ?? 0); if (value.hash) location.hash = value.hash; }
    } catch { /* malformed local marks are ignored */ }
  }
}
