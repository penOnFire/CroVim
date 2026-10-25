export function hintLabels(count: number, alphabet = 'asdf'): string[] {
  const chars = [...new Set([...alphabet])];
  if (chars.length < 2) throw new Error('alphabet needs two unique characters');
  if (count <= 0) return [];
  const labels: string[] = [];
  let width = 1;
  while (chars.length ** width < count) width++;
  for (let n = 0; n < count; n++) {
    let value = n; let label = '';
    for (let i = 0; i < width; i++) {
      label = chars[value % chars.length]! + label;
      value = Math.floor(value / chars.length);
    }
    labels.push(label);
  }
  return labels;
}

export function filterLabels(labels: string[], query: string): string[] {
  return labels.filter((label) => label.startsWith(query));
}
