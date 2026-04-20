import fc from 'fast-check'
import { normalizeTopic, buildSystemPrompt, VALID_TOPICS } from '../src/background/topic-detector'
import type { Topic, TranslationStyle } from '../src/types'

// Конфигурация fast-check: минимум 100 итераций
fc.configureGlobal({ numRuns: 100 })

const ALL_TOPICS: Topic[] = [
  'медицина',
  'юриспруденция',
  'финансы',
  'техника',
  'IT',
  'бытовая',
  'деловая',
  'разговорная',
]

const ALL_STYLES: TranslationStyle[] = ['буквальный', 'литературный', 'нейтральный']

// Ключевые слова тематик, которые должны присутствовать в промпте
const TOPIC_KEYWORDS: Record<Topic, string> = {
  'медицина': 'медицинск',
  'юриспруденция': 'юридическ',
  'финансы': 'финансов',
  'техника': 'техническ',
  'IT': 'IT',
  'бытовая': 'разговорный стиль',
  'деловая': 'деловой стиль',
  'разговорная': 'разговорный стиль',
}

// Ключевые слова стилей
const STYLE_KEYWORDS: Record<TranslationStyle, string> = {
  'буквальный': 'максимально близко',
  'литературный': 'свободно',
  'нейтральный': 'точно',
}

describe('normalizeTopic', () => {
  // Feature: finnish-to-russian-translator, Property 2: topic normalization
  it('для любой строки возвращает одну из 8 допустимых тематик', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = normalizeTopic(s)
        return VALID_TOPICS.includes(result)
      })
    )
  })

  it('корректно маппит известные тематики', () => {
    expect(normalizeTopic('медицина')).toBe('медицина')
    expect(normalizeTopic('юриспруденция')).toBe('юриспруденция')
    expect(normalizeTopic('финансы')).toBe('финансы')
    expect(normalizeTopic('техника')).toBe('техника')
    expect(normalizeTopic('IT')).toBe('IT')
    expect(normalizeTopic('it')).toBe('IT')
    expect(normalizeTopic('бытовая')).toBe('бытовая')
    expect(normalizeTopic('деловая')).toBe('деловая')
    expect(normalizeTopic('разговорная')).toBe('разговорная')
  })

  it('игнорирует пробелы вокруг строки', () => {
    expect(normalizeTopic('  медицина  ')).toBe('медицина')
    expect(normalizeTopic('\tIT\n')).toBe('IT')
  })

  it('для неизвестных строк возвращает "бытовая"', () => {
    expect(normalizeTopic('')).toBe('бытовая')
    expect(normalizeTopic('unknown')).toBe('бытовая')
    expect(normalizeTopic('123')).toBe('бытовая')
    expect(normalizeTopic('медицина2')).toBe('бытовая')
  })
})

describe('buildSystemPrompt', () => {
  // Feature: finnish-to-russian-translator, Property 3: system prompt coverage
  it('для любой комбинации topic + style промпт содержит ключевое слово тематики и инструкцию стиля', () => {
    const topicArb = fc.constantFrom(...ALL_TOPICS)
    const styleArb = fc.constantFrom(...ALL_STYLES)

    fc.assert(
      fc.property(topicArb, styleArb, (topic, style) => {
        const prompt = buildSystemPrompt(topic, style)
        const hasTopicKeyword = prompt.includes(TOPIC_KEYWORDS[topic])
        const hasStyleKeyword = prompt.includes(STYLE_KEYWORDS[style])
        return hasTopicKeyword && hasStyleKeyword
      })
    )
  })

  it('промпт содержит базовую инструкцию переводчика', () => {
    const prompt = buildSystemPrompt('бытовая', 'нейтральный')
    expect(prompt).toContain('профессиональный переводчик с финского на русский')
  })

  it('промпт не пустой для всех комбинаций', () => {
    for (const topic of ALL_TOPICS) {
      for (const style of ALL_STYLES) {
        expect(buildSystemPrompt(topic, style).length).toBeGreaterThan(0)
      }
    }
  })
})
