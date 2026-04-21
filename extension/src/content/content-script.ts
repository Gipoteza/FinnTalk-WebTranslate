import { TextBlock, OutgoingMessage } from '../types'

// Хранит оригинальные значения текстовых узлов
const nodeOriginals = new Map<Text, string>()
const nodeTranslations = new Map<Text, string>()
let allBlocks: TextBlock[] = []
const translatedBlocks = new Map<string, string>()

// Собирает все текстовые узлы страницы (кроме script/style)
function collectTextNodes(): Text[] {
  const result: Text[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT
      if ((node.nodeValue?.trim().length ?? 0) < 3) return NodeFilter.FILTER_SKIP
      return NodeFilter.FILTER_ACCEPT
    }
  })
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) result.push(node)
  return result
}

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
    // Сохраняем оригиналы и собираем текст
    nodeOriginals.clear()
    nodeTranslations.clear()
    translatedBlocks.clear()
    allBlocks = []

    const nodes = collectTextNodes()
    for (const node of nodes) nodeOriginals.set(node, node.nodeValue ?? '')

    const rawText = nodes.map(n => n.nodeValue ?? '').join(' ')
    allBlocks = splitIntoBlocks(rawText)
    sendResponse({ rawText, blocks: allBlocks })
    return false
  }

  if (message.type === 'REPLACE_BLOCK') {
    translatedBlocks.set(message.blockId, message.text)
    // Применяем перевод как только получили все блоки
    if (allBlocks.length > 0 && translatedBlocks.size >= allBlocks.length) {
      applyTranslation()
    }
    return false
  }

  if (message.type === 'RESTORE_ORIGINAL') {
    for (const [node, original] of nodeOriginals) node.nodeValue = original
    return false
  }

  if (message.type === 'SHOW_TRANSLATION') {
    for (const [node, translated] of nodeTranslations) node.nodeValue = translated
    return false
  }

  return false
})

function applyTranslation(): void {
  // Собираем полный переведённый текст по порядку блоков
  const fullText = allBlocks.map(b => translatedBlocks.get(b.id) ?? b.text).join(' ')
  // Разбиваем на части по пробелам/переносам
  const parts = fullText.split(/\s{2,}|\n+/).filter(s => s.trim().length >= 3)

  const nodes = Array.from(nodeOriginals.keys())
  let idx = 0
  for (const node of nodes) {
    if (idx >= parts.length) break
    const translated = parts[idx++]
    node.nodeValue = translated
    nodeTranslations.set(node, translated)
  }
}