import { buildTextIndex, rangeForOffsets, searchIndex } from './text-index';

export class FindMode {
  query = ''; matches: Array<[number, number]> = []; current = -1;
  constructor(private readonly root?: Node) {}
  private targetRoot(): Node { return this.root ?? document.body ?? document.documentElement; }
  search(query: string, regex = false, smartCase = true): number {
    this.query = query; this.matches = searchIndex(buildTextIndex(this.targetRoot()), query, regex, smartCase);
    this.current = this.matches.length ? 0 : -1; this.highlight(); return this.matches.length;
  }
  next(backward = false): Range | null {
    if (!this.matches.length) return null;
    this.current = (this.current + (backward ? -1 : 1) + this.matches.length) % this.matches.length;
    return this.highlight();
  }
  currentIndex(): number { return this.current < 0 ? 0 : this.current + 1; }
  private highlight(): Range | null {
    const match = this.matches[this.current]; if (!match) return null;
    const range = rangeForOffsets(buildTextIndex(this.targetRoot()), match[0], match[1]); if (!range) return null;
    const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range); range.startContainer.parentElement?.scrollIntoView({ block: 'center' });
    return range;
  }
}
