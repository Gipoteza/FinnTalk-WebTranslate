// Модуль взаимодействия с Railway Proxy Server
// Все запросы направляются к proxyUrl (Railway), а не напрямую к OpenAI

import type { Topic, GptModel } from '../types'

// URL прокси-сервера зашит в расширение
const DEFAULT_PROXY_URL = 'https://finntalk-webtranslate-production.up.railway.app'

export class ApiClient {
  private proxyUrl: string
  private model: GptModel

  constructor(proxyUrl: string = DEFAULT_PROXY_URL, model: GptModel) {
    this.proxyUrl = proxyUrl || DEFAULT_PROXY_URL
    this.model = model
  }

  async detectTopic(text: string): Promise<Topic> {
    const response = await fetch(`${this.proxyUrl}/api/detect-topic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model: this.model }),
    })

    if (!response.ok) {
      const error = new Error(`HTTP error ${response.status}`) as Error & { code: number }
      error.code = response.status
      throw error
    }

    const data = await response.json()
    return data.choices[0].message.content as Topic
  }

  async translateBlock(block: string, systemPrompt: string): Promise<string> {
    const response = await fetch(`${this.proxyUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: block, systemPrompt, model: this.model }),
    })

    if (!response.ok) {
      const error = new Error(`HTTP error ${response.status}`) as Error & { code: number }
      error.code = response.status
      throw error
    }

    const data = await response.json()
    return data.choices[0].message.content as string
  }

  async qualityCheck(original: string, translated: string): Promise<string> {
    const response = await fetch(`${this.proxyUrl}/api/quality-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original, translated, model: this.model }),
    })

    if (!response.ok) {
      const error = new Error(`HTTP error ${response.status}`) as Error & { code: number }
      error.code = response.status
      throw error
    }

    const data = await response.json()
    return data.choices[0].message.content as string
  }
}
