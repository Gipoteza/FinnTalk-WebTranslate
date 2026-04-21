import { TextBlock, OutgoingMessage } from '../types'

let originalHTML: string | null = null
let translatedHTML: string | null = null
const translatedBlocks = new Map<string, string>()
let allBlocks: TextBlock[] = []

export function splitIntoBlocks(text: string): TextBlock[] {
  if (text.length === 0) return []
  const breakRegex = /[.!?](?=\s|$)/g
  const breakPositions: number[] = []
  let m: RegExpExecArray | null
  while ((m = breakRegex.exec(text)) !== null) breakPositions.push(m.index + m[0].length)
  const sentences: string[] = []
  let pos = 0
  for (const bp of breakPositions) { if (bp > pos) { sentences.push(text.slice(pos, bp)); pos = bp } }
  if (pos < text.length) sentences.push(text.slice(pos))
  if (sentences.length === 0) return [{ id: crypto.randomUUID(), text, nodeIds: [] }]
  const blocks: TextBlock[] = []
  let current = ''
  for (const sentence of sentences) {
    current += sentence
    if (current.length >= 2000) { blocks.push({ id: crypto.randomUUID(), text: current, nodeIds: [] }); current = '' }
  }
  if (current.length > 0) blocks.push({ id: crypto.randomUUID(), text: current, nodeIds: [] })
  return blocks
}

chrome.runtime.onMessage.addListener((message: OutgoingMessage, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_TEXT') {
    originalHTML = document.body.innerHTML
    translatedHTML = null
    translatedBlocks.clear()
    const rawText = document.body.innerText
    allBlocks = splitIntoBlocks(rawText)
    sendResponse({ rawText, blocks: allBlocks })
    return false
  }

  if (message.type === 'REPLACE_BLOCK') {
    translatedBlocks.set(message.blockId, message.text)
    if (allBlocks.length > 0 && translatedBlocks.size >= allBlocks.length) {
      const fullText = allBlocks.map(b => translatedBlocks.get(b.id) ?? b.text).join('\n\n')
      replacePageText(fullText)
    }
    return false
  }

  if (message.type === 'RESTORE_ORIGINAL') {
    if (originalHTML !== null) { translatedHTML = document.body.innerHTML; document.body.innerHTML = originalHTML }
    return false
  }

  if (message.type === 'SHOW_TRANSLATION') {
    if (translatedHTML !== null) document.body.innerHTML = translatedHTML
    return false
  }

  return false
})

function replacePageText(translatedText: string): void {
  if (!originalHTML) return
  const temp = document.createElement('div')
  temp.innerHTML = originalHTML
  const parts = translatedText.split(/\n+/).filter(s => s.trim().length > 0)
  let idx = 0
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null) && idx < parts.length) {
    if ((node.nodeValue?.trim().length ?? 0) >= 3) node.nodeValue = parts[idx++]
  }
  translatedHTML = temp.innerHTML
  document.body.innerHTML = translatedHTML
}