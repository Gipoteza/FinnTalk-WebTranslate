import { TextBlock, OutgoingMessage } from '../types'

let extractedNodes: Text[] = []
let originalValues: string[] = []
const translationCache = new Map<string, string>()
let isTranslated = false
let observer: MutationObserver | null = null

function log(...a: unknown[]): void { console.log('[FT-CS]', ...a) }

export function splitIntoBlocks(text: string): TextBlock[] {
  if (!text) return []
  return [{ id: crypto.randomUUID(), text, nodeIds: [] }]
}

// Собирает ВСЕ текстовые узлы страницы (без фильтра по видимости)
function collectAllTextNodes(): Text[] {
  const result: Text[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement
      if (!p) return NodeFilter.FILTER_REJECT
      const tag = p.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT
      if ((node.nodeValue?.trim().length ?? 0) < 2) return NodeFilter.FILTER_SKIP
      return NodeFilter.FILTER_ACCEPT
    }
  })
  let n: Text | null
  while ((n = walker.nextNode() as Text | null)) result.push(n)
  return result
}

log('loaded')

chrome.runtime.onMessage.addListener((message: OutgoingMessage, _sender, sendResponse) => {
  log('msg:', message.type)

  if (message.type === 'EXTRACT_TEXT') {
    extractedNodes = collectAllTextNodes()
    originalValues = extractedNodes.map(n => n.nodeValue ?? '')
    const rawText = originalValues.join('\n')
    log('extracted nodes=', extractedNodes.length, 'chars=', rawText.length)
    sendResponse({ rawText, blocks: splitIntoBlocks(rawText) })
    return false
  }

  if (message.type === 'APPLY_TRANSLATION') {
    const fullText = message.translatedParts.join('\n')
    const lines = fullText.split('\n')
    log('apply: nodes=', extractedNodes.length, 'lines=', lines.length)

    let count = 0
    for (let i = 0; i < extractedNodes.length; i++) {
      const trans = lines[i]?.trim()
      if (trans && trans.length > 0) {
        translationCache.set(originalValues[i].trim(), trans)
        extractedNodes[i].nodeValue = trans
        count++
      }
    }

    isTranslated = true
    log('applied', count, 'nodes')
    startObserver()
    sendResponse({ ok: true, count })
    return false
  }

  if (message.type === 'RESTORE_ORIGINAL') {
    for (let i = 0; i < extractedNodes.length; i++) {
      extractedNodes[i].nodeValue = originalValues[i]
    }
    isTranslated = false
    log('restored')
    return false
  }

  if (message.type === 'SHOW_TRANSLATION') {
    for (let i = 0; i < extractedNodes.length; i++) {
      const cached = translationCache.get(originalValues[i].trim())
      if (cached) extractedNodes[i].nodeValue = cached
    }
    isTranslated = true
    return false
  }

  return false
})

function startObserver(): void {
  if (observer) return
  observer = new MutationObserver(mutations => {
    if (!isTranslated) return
    const newNodes: Text[] = []
    for (const m of mutations) {
      for (const added of Array.from(m.addedNodes)) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue
        const w = document.createTreeWalker(added, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            const p = node.parentElement
            if (!p) return NodeFilter.FILTER_REJECT
            const tag = p.tagName
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT
            const v = node.nodeValue?.trim() ?? ''
            if (v.length < 2) return NodeFilter.FILTER_SKIP
            if (translationCache.has(v)) {
              node.nodeValue = translationCache.get(v)!
              return NodeFilter.FILTER_SKIP
            }
            return NodeFilter.FILTER_ACCEPT
          }
        })
        let n: Text | null
        while ((n = w.nextNode() as Text | null)) newNodes.push(n)
      }
    }
    if (newNodes.length === 0) return
    log('observer: new nodes=', newNodes.length)
    const text = newNodes.map(n => n.nodeValue ?? '').join('\n').slice(0, 3000)
    chrome.runtime.sendMessage({ type: 'TRANSLATE_VISIBLE', text } as any)
      .then((r: any) => {
        if (!r?.translatedText) return
        const tlines = r.translatedText.split('\n')
        for (let i = 0; i < Math.min(newNodes.length, tlines.length); i++) {
          const t = tlines[i]?.trim()
          if (t) { translationCache.set(newNodes[i].nodeValue?.trim() ?? '', t); newNodes[i].nodeValue = t }
        }
      })
      .catch((e: any) => log('observer error:', e))
  })
  observer.observe(document.body, { childList: true, subtree: true })
  log('observer started')
}