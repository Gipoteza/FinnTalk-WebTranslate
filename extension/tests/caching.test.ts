/// <reference types="jest" />
// Feature: finnish-to-russian-translator, Property 10: translation caching

import fc from 'fast-check'
import { TextReplacer } from '../src/content/text-replacer'

fc.configureGlobal({ numRuns: 100 })

/** Минимальный mock Text-узла */
function makeTextNode(value: string): Text {
  return { nodeValue: value } as unknown as Text
}

// ---------------------------------------------------------------------------
// Свойство 10: Кэширование перевода
// Validates: Requirements 5.5
// ---------------------------------------------------------------------------
describe('P10: translation caching', () => {
  it('toggling between original and translation does not trigger any fetch calls', () => {
    // Feature: finnish-to-russian-translator, Property 10: translation caching
    // Validates: Requirements 5.5
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch должен не вызываться при переключении кэша')
    })

    try {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (originalText, translatedText) => {
            const node = makeTextNode(originalText)
            const replacer = new TextReplacer()
            const blockId = 'block-cache-test'

            replacer.registerBlock(blockId, [node])

            // Шаг 1: replaceBlock → node.nodeValue === translatedText
            replacer.replaceBlock(blockId, translatedText)
            if (node.nodeValue !== translatedText) return false

            // Шаг 2: restoreOriginal() → node.nodeValue === originalText
            replacer.restoreOriginal()
            if (node.nodeValue !== originalText) return false

            // Шаг 3: showTranslation() → node.nodeValue === translatedText
            replacer.showTranslation()
            if (node.nodeValue !== translatedText) return false

            // fetch не должен был вызываться ни разу
            return fetchSpy.mock.calls.length === 0
          }
        )
      )
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('multiple toggle cycles preserve correct values without fetch', () => {
    // Feature: finnish-to-russian-translator, Property 10: translation caching
    // Validates: Requirements 5.5
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('fetch должен не вызываться при переключении кэша')
    })

    try {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1, max: 10 }),
          (originalText, translatedText, cycles) => {
            const node = makeTextNode(originalText)
            const replacer = new TextReplacer()
            const blockId = 'block-multi-cycle'

            replacer.registerBlock(blockId, [node])
            replacer.replaceBlock(blockId, translatedText)

            // Несколько циклов переключения
            for (let i = 0; i < cycles; i++) {
              replacer.restoreOriginal()
              if (node.nodeValue !== originalText) return false

              replacer.showTranslation()
              if (node.nodeValue !== translatedText) return false
            }

            return fetchSpy.mock.calls.length === 0
          }
        )
      )
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
