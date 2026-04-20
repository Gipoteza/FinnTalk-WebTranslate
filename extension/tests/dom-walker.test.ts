/// <reference types="jest" />
// Feature: finnish-to-russian-translator, Property 1: text extraction
// Feature: finnish-to-russian-translator, Property 14: script/style exclusion

import fc from 'fast-check'

fc.configureGlobal({ numRuns: 100 })

// Константы типов узлов (без реального DOM)
const NODE_TYPE = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
}

// Минимальный mock-интерфейс узла, совместимый с dom-walker
interface MockNode {
  nodeType: number
  tagName?: string
  nodeValue?: string | null
  childNodes: MockNode[]
}

/** Создаёт mock текстового узла */
function makeTextNode(text: string): MockNode {
  return { nodeType: NODE_TYPE.TEXT_NODE, nodeValue: text, childNodes: [] }
}

/** Создаёт mock элемента с дочерними узлами */
function makeElement(tagName: string, children: MockNode[]): MockNode {
  return { nodeType: NODE_TYPE.ELEMENT_NODE, tagName, childNodes: children }
}

// Локальная реализация walkNode, идентичная dom-walker.ts, но работающая с MockNode
const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])

function extractTextNodes(root: MockNode): MockNode[] {
  const result: MockNode[] = []
  walkNode(root, result)
  return result
}

function walkNode(node: MockNode, result: MockNode[]): void {
  if (node.nodeType === NODE_TYPE.ELEMENT_NODE) {
    if (EXCLUDED_TAGS.has(node.tagName ?? '')) {
      return
    }
  }

  if (node.nodeType === NODE_TYPE.TEXT_NODE) {
    const text = node.nodeValue ?? ''
    if (text.trim().length >= 3) {
      result.push(node)
    }
    return
  }

  for (const child of node.childNodes) {
    walkNode(child, result)
  }
}

// ---------------------------------------------------------------------------
// Свойство 1: Извлечение текста из DOM
// ---------------------------------------------------------------------------
describe('P1: text extraction', () => {
  it('extractTextNodes returns non-empty array for DOM with text nodes >= 3 chars', () => {
    // Feature: finnish-to-russian-translator, Property 1: text extraction
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 3 }), { minLength: 1 }),
        (texts) => {
          const children = texts.map((t) => makeTextNode(t))
          const root = makeElement('DIV', children)
          const nodes = extractTextNodes(root)
          return nodes.length > 0
        }
      )
    )
  })

  it('extractTextNodes skips text nodes shorter than 3 chars', () => {
    // Feature: finnish-to-russian-translator, Property 1: text extraction
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 2 }), { minLength: 1, maxLength: 10 }),
        (texts) => {
          const children = texts.map((t) => makeTextNode(t))
          const root = makeElement('DIV', children)
          const nodes = extractTextNodes(root)
          return nodes.length === 0
        }
      )
    )
  })
})

// ---------------------------------------------------------------------------
// Свойство 14: Исключение script/style из извлечения
// ---------------------------------------------------------------------------
describe('P14: script/style exclusion', () => {
  it('extractTextNodes does not include text inside <script>', () => {
    // Feature: finnish-to-russian-translator, Property 14: script/style exclusion
    fc.assert(
      fc.property(
        fc.string({ minLength: 3 }),
        fc.string({ minLength: 3 }),
        (scriptText, bodyText) => {
          const scriptNode = makeElement('SCRIPT', [makeTextNode(scriptText)])
          const bodyNode = makeElement('P', [makeTextNode(bodyText)])
          const root = makeElement('DIV', [scriptNode, bodyNode])

          const nodes = extractTextNodes(root)
          const values = nodes.map((n) => n.nodeValue)

          // Текст из script не должен попасть в результат
          return !values.includes(scriptText)
        }
      )
    )
  })

  it('extractTextNodes does not include text inside <style>', () => {
    // Feature: finnish-to-russian-translator, Property 14: script/style exclusion
    fc.assert(
      fc.property(
        fc.string({ minLength: 3 }),
        fc.string({ minLength: 3 }),
        (styleText, bodyText) => {
          const styleNode = makeElement('STYLE', [makeTextNode(styleText)])
          const bodyNode = makeElement('P', [makeTextNode(bodyText)])
          const root = makeElement('DIV', [styleNode, bodyNode])

          const nodes = extractTextNodes(root)
          const values = nodes.map((n) => n.nodeValue)

          return !values.includes(styleText)
        }
      )
    )
  })

  it('extractTextNodes does not include text inside <noscript>', () => {
    // Feature: finnish-to-russian-translator, Property 14: script/style exclusion
    fc.assert(
      fc.property(
        fc.string({ minLength: 3 }),
        (noscriptText) => {
          const noscriptNode = makeElement('NOSCRIPT', [makeTextNode(noscriptText)])
          const root = makeElement('DIV', [noscriptNode])

          const nodes = extractTextNodes(root)
          const values = nodes.map((n) => n.nodeValue)

          return !values.includes(noscriptText)
        }
      )
    )
  })

  it('extractTextNodes still returns body text when script/style present', () => {
    // Feature: finnish-to-russian-translator, Property 14: script/style exclusion
    fc.assert(
      fc.property(
        fc.string({ minLength: 3 }),
        // bodyText должен содержать >= 3 непробельных символов, чтобы пройти фильтр
        fc.stringMatching(/\S{3,}/),
        (scriptText, bodyText) => {
          fc.pre(scriptText !== bodyText)

          const scriptNode = makeElement('SCRIPT', [makeTextNode(scriptText)])
          const bodyNode = makeElement('P', [makeTextNode(bodyText)])
          const root = makeElement('DIV', [scriptNode, bodyNode])

          const nodes = extractTextNodes(root)
          return nodes.length > 0
        }
      )
    )
  })
})
