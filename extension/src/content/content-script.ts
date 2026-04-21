import { TextBlock, OutgoingMessage } from '../types'

let isTranslated = false
const translationCache = new Map<string, string>()

function log(...args: unknown[]): void { console.log('[FT-CS]', ...args) }

export function splitIntoBlocks(text: string): TextBlock[] {
  if (text.length === 0) return []
  return [{ id: crypto.randomUUID(), text, nodeIds: [] }]
}

// Собирает видимые текстовые узлы (только те что в viewport или только что появились)
function getVisibleTextNodes(): Text[] {
  const result: Text[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT
      const trimmed = node.nodeValue?.trim() ?? ''
      if (trimmed.length < 2) return NodeFilter.FILTER_SKIP
      // Проверяем видимость элемента
      const rect = parent.getBoundingClientRect()
      const style = window.getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return NodeFilter.FILTER_SKIP
      return NodeFilter.FILTER_ACCEPT
    }
  })
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) result.push(node)
  return result
}

// Переводит текстовые узлы через background
async function translateNodes(nodes: Text[]): Promise<void> {
  if (nodes.length === 0) return

  // Фильтруем уже переведённые
  const toTranslate = nodes.filter(n => {
    const orig = n.nodeValue?.trim() ?? ''
    return orig.length > 1 && !translationCache.has(orig)
  })

  if (toTranslate.length === 0) {
    // Применяем кэш
    for (const node of nodes) {
      const orig = node.nodeValue?.trim() ?? ''
      const cached = translationCache.get(orig)
      if (cached) node.nodeValue = cached
    }
    return
  }

  const rawText = toTranslate.map(n => n.nodeValue ?? '').join('\n')
  log('translateNodes: sending', toTranslate.length, 'nodes, chars=', rawText.length)

  const response = await chrome.runtime.sendMessage({
    type: 'TRANSLATE_VISIBLE',
    text: rawText.slice(0, 3000),
  })

  if (!response?.translatedText) return

  const origLines = rawText.split('\n')
  const transLines = response.translatedText.split('\n')

  // Кэшируем и применяем
  for (let i = 0; i < Math.min(origLines.length, transLines.length); i++) {
    const orig = origLines[i].trim()
    const trans = transLines[i]?.trim()
    if (orig && trans) translationCache.set(orig, trans)
  }

  for (const node of nodes) {
    const orig = node.nodeValue?.trim() ?? ''
    const cached = translationCache.get(orig)
    if (cached) node.nodeValue = cached
  }
}

log('content script loaded')

chrome.runtime.onMessage.addListener((message: OutgoingMessage, _sender, sendResponse) => {
  log('onMessage:', message.type)

  if (message.type === 'EXTRACT_TEXT') {
    const nodes = getVisibleTextNodes()
    const rawText = nodes.map(n => n.nodeValue ?? '').join('\n')
    log('EXTRACT_TEXT: nodes=', nodes.length, 'chars=', rawText.length)
    sendResponse({ rawText, blocks: splitIntoBlocks(rawText) })
    return false
  }

  if (message.type === 'APPLY_TRANSLATION') {
    const translatedText = message.translatedParts.join('\n')
    const nodes = getVisibleTextNodes()
    const origLines = nodes.map(n => n.nodeValue?.trim() ?? '')
    const transLines = translatedText.split('\n').map(s => s.trim()).filter(s => s.length > 0)

    log('APPLY_TRANSLATION: nodes=', nodes.length, 'transLines=', transLines.length)

    let count = 0
    for (let i = 0; i < Math.min(nodes.length, transLines.length); i++) {
      const orig = origLines[i]
      const trans = transLines[i]
      if (orig && trans) {
        translationCache.set(orig, trans)
        nodes[i].nodeValue = trans
        count++
      }
    }

    isTranslated = true
    log('applied', count, 'translations')

    // Слушаем появление новых элементов (меню, дропдауны)
    observeNewContent()

    sendResponse({ ok: true, count })
    return false
  }

  if (message.type === 'RESTORE_ORIGINAL') {
    // Восстанавливаем из кэша
    const nodes = getVisibleTextNodes()
    for (const node of nodes) {
      const trans = node.nodeValue?.trim() ?? ''
      // Ищем оригинал по переводу
      for (const [orig, t] of translationCache) {
        if (t === trans) { node.nodeValue = orig; break }
      }
    }
    isTranslated = false
    log('restored original')
    return false
  }

  return false
})

let observer: MutationObserver | null = null

function observeNewContent(): void {
  if (observer) return // уже наблюдаем

  observer = new MutationObserver((mutations) => {
    if (!isTranslated) return

    const newNodes: Text[] = []
    for (const mutation of mutations) {
      for (const added of Array.from(mutation.addedNodes)) {
        if (added.nodeType === Node.ELEMENT_NODE) {
          const walker = document.createTreeWalker(added, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              const parent = node.parentElement
              if (!parent) return NodeFilter.FILTER_REJECT
              const tag = parent.tagName
              if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT
              const trimmed = node.nodeValue?.trim() ?? ''
              if (trimmed.length < 2) return NodeFilter.FILTER_SKIP
              // Только если ещё не переведён
              if (translationCache.has(trimmed)) return NodeFilter.FILTER_SKIP
              return NodeFilter.FILTER_ACCEPT
            }
          })
          let node: Text | null
          while ((node = walker.nextNode() as Text | null)) newNodes.push(node)
        }
      }
    }

    if (newNodes.length > 0) {
      log('MutationObserver: new nodes=', newNodes.length)
      translateNodes(newNodes).catch(err => log('translateNodes error:', err))
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  log('MutationObserver started')
}