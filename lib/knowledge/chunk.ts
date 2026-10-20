/**
 * Heading-aware chunking for the knowledge base (KB-4). Pure and deterministic.
 *
 * Text arrives as markdown-like plain text (extract.ts turns DOCX headings into `#` lines).
 * Each heading starts a new section; a section is packed paragraph by paragraph up to
 * ~`targetTokens`, and each following chunk of the same section repeats ~`overlapTokens` of
 * the previous one so an answer split across a boundary is still retrievable. Paragraphs that
 * are too big are split by sentence, then by word. No chunk exceeds `maxTokens`.
 *
 * Tokens are estimated as characters / 4, which is close enough for sizing chunks.
 */

export interface ChunkOptions {
  targetTokens: number
  maxTokens: number
  overlapTokens: number
}

export const CHUNK_DEFAULTS: ChunkOptions = { targetTokens: 600, maxTokens: 800, overlapTokens: 80 }

export interface Chunk {
  ordinal: number
  heading: string | null
  content: string
  tokenCount: number
}

const CHARS_PER_TOKEN = 4
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const PARAGRAPH_SEPARATOR = "\n\n"

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

interface Section {
  heading: string | null
  paragraphs: string[]
}

function sections(text: string): Section[] {
  const result: Section[] = []
  let current: Section = { heading: null, paragraphs: [] }
  let buffer: string[] = []

  const flushParagraphs = () => {
    const body = buffer.join("\n")
    buffer = []
    for (const paragraph of body.split(/\n\s*\n/)) {
      const trimmed = paragraph.trim()
      if (trimmed) current.paragraphs.push(trimmed)
    }
  }

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = HEADING.exec(line)
    if (heading) {
      flushParagraphs()
      if (current.paragraphs.length > 0 || current.heading !== null) result.push(current)
      current = { heading: heading[2].trim(), paragraphs: [] }
    } else {
      buffer.push(line)
    }
  }
  flushParagraphs()
  result.push(current)
  return result.filter((section) => section.paragraphs.length > 0)
}

/** Splits `text` into pieces of at most `maxChars`, preferring sentence, then word, boundaries. */
function splitLong(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const pieces: string[] = []
  let current = ""
  const push = () => {
    if (current) pieces.push(current)
    current = ""
  }
  const units = text.split(/(?<=[.!?])\s+/).flatMap((sentence) =>
    sentence.length <= maxChars ? [sentence] : sentence.split(/\s+/)
  )
  for (const unit of units) {
    if (unit.length > maxChars) {
      push()
      for (let i = 0; i < unit.length; i += maxChars) pieces.push(unit.slice(i, i + maxChars))
      continue
    }
    const candidate = current ? `${current} ${unit}` : unit
    if (candidate.length > maxChars) {
      push()
      current = unit
    } else {
      current = candidate
    }
  }
  push()
  return pieces
}

/** The last ~`tokens` of `text`, starting at a word boundary. */
function tail(text: string, tokens: number): string {
  const maxChars = tokens * CHARS_PER_TOKEN
  if (text.length <= maxChars) return text
  const slice = text.slice(text.length - maxChars)
  const boundary = slice.search(/\s/)
  return (boundary === -1 ? slice : slice.slice(boundary)).trim()
}

export function chunkDocument(text: string, options: ChunkOptions = CHUNK_DEFAULTS): Chunk[] {
  const { targetTokens, maxTokens, overlapTokens } = options
  // A chunk is at most one packed body plus the carried overlap, so the body leaves room for it.
  const targetChars = Math.max(
    1,
    Math.min(targetTokens, maxTokens - overlapTokens) * CHARS_PER_TOKEN - PARAGRAPH_SEPARATOR.length
  )
  const chunks: Chunk[] = []

  const emit = (heading: string | null, content: string) => {
    chunks.push({ ordinal: chunks.length, heading, content, tokenCount: estimateTokens(content) })
  }

  for (const section of sections(text)) {
    const pieces = section.paragraphs.flatMap((paragraph) => splitLong(paragraph, targetChars))
    let current = ""
    for (const piece of pieces) {
      const candidate = current ? `${current}${PARAGRAPH_SEPARATOR}${piece}` : piece
      if (current && candidate.length > targetChars) {
        emit(section.heading, current)
        current = `${tail(current, overlapTokens)}${PARAGRAPH_SEPARATOR}${piece}`
      } else {
        current = candidate
      }
    }
    if (current) emit(section.heading, current)
  }
  return chunks
}
