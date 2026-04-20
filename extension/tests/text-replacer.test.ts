/// <reference types="jest" />
// Feature: finnish-to-russian-translator, Property 5: HTML structure preservation
// Feature: finnish-to-russian-translator, Property 9: original restore round-trip

import fc from 'fast-check'
import { TextReplacer } from '../src/content/text-replacer'

fc.configureGlobal({ numRuns: 100 })

/** Минимальный mock Text-узла: TextReplacer работает только с nodeValue */
function makeTextNode(value: string): Text {
  return { nodeValue: value } as unknown as Text
}

// ---------------------------------------------------------------------------
// Свойство 5: Сохранение HTML-структуры при замене текста
// ---------------------------------------------------------------------------
describe('P5: HTML structure preservation', () => {
  it('replaceBlock does not change the number of registered blocks', () => {
    // Feature: finnish-to-russian-translator, Property 5: HTML structure preservation
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1 }),
        (blockIds, translatedText) => {
          // Убираем дубликаты, чтобы каждый blockId был уникальным
          const uniqueIds = [...new Set(blockIds)]
          const replacer = new TextReplacer()

          // Регистрируем все блоки
          for (const id of uniqueIds) {
            replacer.registerBlock(id, [makeTextNode('original text')])
          }

          const countBefore = replacer.blockCount

          // Заменяем первый блок
          replacer.replaceBlock(uniqueIds[0], translatedText)

          // Количество блоков не должно измениться
          return replacer.blockCount === countBefore
        }
      )
    )
  })

  it('hasBlock returns true for registered block after replaceBlock', () => {
    // Feature: finnish-to-russian-translator, Property 5: HTML structure preservation
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (blockId, translatedText) => {
          const replacer = new TextReplacer()
          replacer.registerBlock(blockId, [makeTextNode('original')])
          replacer.replaceBlock(blockId, translatedText)

          return replacer.hasBlock(blockId)
        }
      )
    )
  })

  it('replaceBlock updates nodeValue of the text node', () => {
    // Feature: finnish-to-russian-translator, Property 5: HTML structure preservation
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (blockId, originalText, translatedText) => {
          const node = makeTextNode(originalText)
          const replacer = new TextReplacer()
          replacer.registerBlock(blockId, [node])
          replacer.replaceBlock(blockId, translatedText)

          return node.nodeValue === translatedText
        }
      )
    )
  })
})

// ---------------------------------------------------------------------------
// Свойство 9: Round-trip восстановления оригинала
// ---------------------------------------------------------------------------
describe('P9: original restore round-trip', () => {
  it('after replaceBlock and restoreOriginal, nodeValue equals original text', () => {
    // Feature: finnish-to-russian-translator, Property 9: original restore round-trip
    fc.assert(
      fc.property(
        fc.string({ minLength: 3 }),
        fc.string({ minLength: 3 }),
        (originalText, translatedText) => {
          const node = makeTextNode(originalText)
          const replacer = new TextReplacer()
          replacer.registerBlock('block-1', [node])

          replacer.replaceBlock('block-1', translatedText)
          replacer.restoreOriginal()

          return node.nodeValue === originalText
        }
      )
    )
  })

  it('restoreOriginal works for multiple blocks', () => {
    // Feature: finnish-to-russian-translator, Property 9: original restore round-trip
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            original: fc.string({ minLength: 3 }),
            translated: fc.string({ minLength: 3 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (blocks) => {
          // Убираем дубликаты по id
          const unique = blocks.filter(
            (b, i, arr) => arr.findIndex((x) => x.id === b.id) === i
          )

          const replacer = new TextReplacer()
          const nodes: Array<{ node: Text; original: string }> = []

          for (const b of unique) {
            const node = makeTextNode(b.original)
            nodes.push({ node, original: b.original })
            replacer.registerBlock(b.id, [node])
            replacer.replaceBlock(b.id, b.translated)
          }

          replacer.restoreOriginal()

          return nodes.every(({ node, original }) => node.nodeValue === original)
        }
      )
    )
  })

  it('showTranslation after restoreOriginal restores translated text', () => {
    // Feature: finnish-to-russian-translator, Property 9: original restore round-trip
    fc.assert(
      fc.property(
        fc.string({ minLength: 3 }),
        fc.string({ minLength: 3 }),
        (originalText, translatedText) => {
          const node = makeTextNode(originalText)
          const replacer = new TextReplacer()
          replacer.registerBlock('block-1', [node])

          replacer.replaceBlock('block-1', translatedText)
          replacer.restoreOriginal()
          replacer.showTranslation()

          return node.nodeValue === translatedText
        }
      )
    )
  })
})
