/**
 * Parses a combined cursor string into separate cursors for private and wrapped feeds.
 * @param {string | undefined} cursor - The combined cursor string in format "privateCursor|wrappedCursor"
 */
export function parseCursor(
  cursor: string | undefined,
): [cursorA: string | undefined, cursorB: string | undefined] {
  let cursorA: string | undefined
  let cursorB: string | undefined

  if (cursor) {
    const splitIndex = cursor.indexOf('|')
    if (splitIndex !== -1) {
      cursorA = cursor.substring(0, splitIndex)
      cursorB = cursor.substring(splitIndex + 1)
    }
  }

  return [cursorA, cursorB]
}

export function mergeCursors(
  cursorA: string | undefined,
  cursorB: string | undefined,
): string | undefined {
  // Combine cursors for next request
  let mergedCursor: string | undefined = `${cursorA || 'EOF'}|${
    cursorB || 'EOF'
  }`

  if (mergedCursor === 'EOF|EOF') mergedCursor = undefined

  return mergedCursor
}
