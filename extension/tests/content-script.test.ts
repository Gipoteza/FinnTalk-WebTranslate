/// <reference types="jest" />
// Feature: finnish-to-russian-translator, Property 4: block size invariant

import fc from 'fast-check'
import { splitIntoBlocks } from '../src/content/content-script'
import { extractTextNodes } from '../src/content/dom-walker'

fc.configureGlobal({ numRuns: 100 })

// ---------------------------------------------------------------------------
// Unit-тесты
// ---------------------------------------------------------------------------
describe('splitIntoBlocks — unit tests', () => {
  it('returns one block for text shorter than 2000 chars', () => {
    const text = 'Lyhyt teksti. Tämä on lyhyt.'
    const blocks = splitIntoBlocks(text)
    expect(blocks.length).toBe(1)
  })

  it('each block has a non-empty id', () => {
    const text = 'a'.repeat(5000)
    const blocks = splitIntoBlocks(text)
    for (const block of blocks) {
      expect(block.id).toBeTruthy()
      expect(block.id.length).toBeGreaterThan(0)
    }
  })

  it('returns empty array for empty string', () => {
    expect(splitIntoBlocks('')).toEqual([])
  })

  it('nodeIds is empty array for each block', () => {
    const text = 'Tämä on lause. '.repeat(200)
    const blocks = splitIntoBlocks(text)
    for (const block of blocks) {
      expect(block.nodeIds).toEqual([])
    }
  })

  it('concatenation of all blocks equals original text', () => {
    const text = 'Tämä on lause. '.repeat(200)
    const blocks = splitIntoBlocks(text)
    const joined = blocks.map((b) => b.text).join('')
    expect(joined).toBe(text)
  })
})

// ---------------------------------------------------------------------------
// Unit-тесты для DOM Walker (через mock DOM)
// ---------------------------------------------------------------------------
describe('extractTextNodes — short text filtering', () => {
  it('skips text nodes with fewer than 3 characters', () => {
    // Числовые константы типов узлов (без доступа к глобальному Node)
    const TEXT_NODE = 3
    const ELEMENT_NODE = 1

    function makeTextNode(value: string): Node {
      return {
        nodeType: TEXT_NODE,
        nodeValue: value,
        childNodes: { [Symbol.iterator]: () => [][Symbol.iterator]() },
      } as unknown as Node
    }

    function makeElement(tagName: string, children: Node[]): Node {
      return {
        nodeType: ELEMENT_NODE,
        tagName,
        childNodes: { [Symbol.iterator]: () => children[Symbol.iterator]() },
      } as unknown as Node
    }

    const shortNode = makeTextNode('ab')   // 2 символа — должен быть пропущен
    const longNode = makeTextNode('abc')   // 3 символа — должен быть включён
    const emptyNode = makeTextNode('')     // пустой — должен быть пропущен
    const spaceNode = makeTextNode('  ')   // только пробелы — должен быть пропущен

    const root = makeElement('DIV', [shortNode, longNode, emptyNode, spaceNode])
    const result = extractTextNodes(root)

    expect(result).toHaveLength(1)
    expect((result[0] as unknown as { nodeValue: string }).nodeValue).toBe('abc')
  })
})

// ---------------------------------------------------------------------------
// Свойство 4: Размер блоков текста
// ---------------------------------------------------------------------------
describe('P4: block size invariant', () => {
  it('all blocks except the last have length <= 4000 for any text > 2000 chars', () => {
    // Feature: finnish-to-russian-translator, Property 4: block size invariant
    // Validates: Requirements 2.1
    fc.assert(
      fc.property(
        fc.string({ minLength: 2001, maxLength: 20000 }),
        (text) => {
          const blocks = splitIntoBlocks(text)
          if (blocks.length <= 1) return true
          // Все блоки кроме последнего должны быть <= 4000 символов
          const allButLast = blocks.slice(0, -1)
          return allButLast.every((b) => b.text.length <= 4000)
        }
      )
    )
  })

  it('all blocks have non-empty id for any text > 2000 chars', () => {
    // Feature: finnish-to-russian-translator, Property 4: block size invariant
    fc.assert(
      fc.property(
        fc.string({ minLength: 2001, maxLength: 20000 }),
        (text) => {
          const blocks = splitIntoBlocks(text)
          return blocks.every((b) => b.id.length > 0)
        }
      )
    )
  })

  it('concatenation of blocks equals original text for any input', () => {
    // Feature: finnish-to-russian-translator, Property 4: block size invariant
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20000 }),
        (text) => {
          const blocks = splitIntoBlocks(text)
          const joined = blocks.map((b) => b.text).join('')
          return joined === text
        }
      )
    )
  })
})
