export interface TrieNode { command?: string; children: Map<string, TrieNode> }
export interface TrieMatch { command?: string; prefix: boolean; consumed: string[] }

export class CommandTrie {
  readonly root: TrieNode = { children: new Map() };
  constructor(mappings: Record<string, string>) {
    for (const [sequence, command] of Object.entries(mappings)) this.add(sequence, command);
  }
  add(sequence: string, command: string): void {
    let node = this.root;
    for (const key of [...sequence]) {
      let child = node.children.get(key);
      if (!child) { child = { children: new Map() }; node.children.set(key, child); }
      node = child;
    }
    node.command = command;
  }
  match(input: string[]): TrieMatch {
    let node = this.root;
    for (const key of input) {
      const child = node.children.get(key);
      if (!child) return { prefix: false, consumed: [] };
      node = child;
    }
    return node.command === undefined
      ? { prefix: node.children.size > 0, consumed: input }
      : { command: node.command, prefix: node.children.size > 0, consumed: input };
  }
  has(sequence: string): boolean { return !!this.match([...sequence]).command; }
}
