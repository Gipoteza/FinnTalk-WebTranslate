import { TextBlock, OutgoingMessage } from '../types'

const nodeOriginals = new Map<Text, string>()
const nodeTranslations = new Map<Text, string>()

function log(...args: unknown[]): void { console.log('[FT-CS]', ...args) }
function logErr(...args: unknown[]): void { console.error('[FT-CS ERROR]', ...args) }

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
  return [{ id: crypto.randomUUID(), text, nodeIds: [] }]
}

log('content script loaded, url=', location.href)

chrome.runtime.onMessage.addListener((message: OutgoingMessage, _sender, sendResponse) => {
  log('onMessage:', message.type)

  if (message.type === 'EXTRACT_TEXT') {
    nodeOriginals.clear()
    nodeTranslations.clear()
    const nodes = collectTextNodes()
    for (const node of nodes) nodeOriginals.set(node, node.nodeValue ?? '')
    const rawText = nodes.map(n => n.nodeValue ?? '').join('\n')
    const blocks = splitIntoBlocks(rawText)
    log('EXTRACT_TEXT: nodes=', nodes.length, 'rawText.length=', rawText.length)
    sendResponse({ rawText, blocks })
    return false
  }

  if (message.type === 'APPLY_TRANSLATION') {
    log('APPLY_TRANSLATION: parts=', message.translatedParts.length, 'total chars=', message.translatedParts.join('').length)
    const fullText = message.translatedParts.join('\n')
    // Разбиваем по переносам строк — каждая строка соответствует одному текстовому узлу
    const lines = fullText.split('\n').filter(s => s.trim().length >= 1)
    log('lines count=', lines.length, 'nodes count=', nodeOriginals.size)
    const nodes = Array.from(nodeOriginals.keys())
    let idx = 0
    for (const node of nodes) {
      if (idx >= lines.length) break
      const translated = lines[idx++]
      node.nodeValue = translated
      nodeTranslations.set(node, translated)
    }
    log('applied', idx, 'translations')
    sendResponse({ ok: true })
    return false
  }

  if (message.type === 'RESTORE_ORIGINAL') {
    for (const [node, original] of nodeOriginals) node.nodeValue = original
    log('restored original')
    return false
  }

  if (message.type === 'SHOW_TRANSLATION') {
    for (const [node, translated] of nodeTranslations) node.nodeValue = translated
    log('showed translation')
    return false
  }

  return false
})