// Feature: finnish-to-russian-translator, Property 7: style change applies forward

import fc from 'fast-check'
import { getBlocksToProcess } from '../src/background/service-worker'
import type { TextBlock } from '../src/types'

// Генератор TextBlock
const arbitraryTextBlock = (): fc.Arbitrary<TextBlock> =>
  fc.record({
    id: fc.uuid(),
    text: fc.string({ minLength: 1, maxLength: 100 }),
    nodeIds: fc.array(fc.string({ minLength: 1, maxLength: 20 })),
  })

describe('getBlocksToProcess', () => {
  // Property 7: Изменение стиля применяется к следующим блокам
  // Для любого массива блоков и индекса K, getBlocksToProcess(blocks, K)
  // возвращает только блоки с индексом >= K
  it('возвращает только блоки начиная с currentIndex', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryTextBlock(), { minLength: 0, maxLength: 20 }),
        fc.nat(20),
        (blocks, k) => {
          const result = getBlocksToProcess(blocks, k)
          const expected = blocks.slice(k)

          // Длина совпадает
          if (result.length !== expected.length) return false

          // Каждый элемент совпадает по id
          for (let i = 0; i < result.length; i++) {
            if (result[i].id !== expected[i].id) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('возвращает пустой массив если currentIndex >= длины массива', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryTextBlock(), { minLength: 0, maxLength: 10 }),
        blocks => {
          const result = getBlocksToProcess(blocks, blocks.length)
          return result.length === 0
        }
      ),
      { numRuns: 100 }
    )
  })

  it('возвращает все блоки если currentIndex = 0', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryTextBlock(), { minLength: 0, maxLength: 20 }),
        blocks => {
          const result = getBlocksToProcess(blocks, 0)
          return result.length === blocks.length
        }
      ),
      { numRuns: 100 }
    )
  })
})
