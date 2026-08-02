// PostgREST `.in()` filters serialize into the query string; chunk large id
// lists to stay under URL-length limits.

export function chunk<T>(items: T[], size: number): T[][] {
  // A non-positive size never advances the loop; a fractional one overlaps
  // slices. Both are caller bugs, so fail loudly rather than hang or duplicate.
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
