/// <reference types="jest" />
// Feature: finnish-to-russian-translator, Property 11: proxy url round-trip

import * as fs from 'fs'
import * as path from 'path'
import fc from 'fast-check'
import { serializeSettings, deserializeSettings } from '../src/options/options'

fc.configureGlobal({ numRuns: 100 })

// --- Property-тест 12.3 ---
// Свойство 11: Round-trip сохранения Proxy URL
// Validates: Requirements 6.4
describe('Property 11: proxy url round-trip', () => {
  it('для любого proxyUrl deserializeSettings(serializeSettings({ proxyUrl })).proxyUrl === proxyUrl', () => {
    fc.assert(
      fc.property(fc.webUrl(), (proxyUrl) => {
        const serialized = serializeSettings({ proxyUrl })
        const deserialized = deserializeSettings(serialized)
        return deserialized.proxyUrl === proxyUrl
      })
    )
  })
})

// --- Unit-тесты 12.4 ---
const htmlPath = path.resolve(__dirname, '../src/options/options.html')
const html = fs.readFileSync(htmlPath, 'utf-8')

describe('options.html — структура', () => {
  it('содержит переключатель проверки качества id="quality-check"', () => {
    expect(html).toContain('id="quality-check"')
  })

  it('содержит поле URL прокси id="proxy-url"', () => {
    expect(html).toContain('id="proxy-url"')
  })
})

describe('deserializeSettings — дефолтные значения', () => {
  it('возвращает дефолтные значения для пустого объекта', () => {
    const result = deserializeSettings({})
    expect(result.proxyUrl).toBe('')
    expect(result.model).toBe('gpt-4o-mini')
    expect(result.requestsPerMinute).toBe(20)
    expect(result.qualityCheckEnabled).toBe(false)
    expect(result.translationStyle).toBe('нейтральный')
    expect(result.autoTranslate).toBe(false)
  })
})
