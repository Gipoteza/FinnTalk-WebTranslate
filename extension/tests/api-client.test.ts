import { ApiClient } from '../src/background/api-client'

const PROXY_URL = 'https://my-proxy.railway.app'
const MODEL = 'gpt-4o-mini' as const

function makeFetchMock(status: number, body: object) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  })
}

const successBody = {
  choices: [{ message: { content: 'бытовая' } }],
}

describe('ApiClient', () => {
  let client: ApiClient

  beforeEach(() => {
    client = new ApiClient(PROXY_URL, MODEL)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('detectTopic', () => {
    it('отправляет POST на {proxyUrl}/api/detect-topic', async () => {
      const mockFetch = makeFetchMock(200, successBody)
      ;(globalThis as any).fetch = mockFetch

      await client.detectTopic('Tämä on testi')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe(`${PROXY_URL}/api/detect-topic`)
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body)
      expect(body.text).toBe('Tämä on testi')
      expect(body.model).toBe(MODEL)
    })

    it('возвращает тематику из choices[0].message.content', async () => {
      ;(globalThis as any).fetch = makeFetchMock(200, { choices: [{ message: { content: 'медицина' } }] })

      const result = await client.detectTopic('some text')
      expect(result).toBe('медицина')
    })
  })

  describe('translateBlock', () => {
    it('отправляет POST на {proxyUrl}/api/translate', async () => {
      const mockFetch = makeFetchMock(200, { choices: [{ message: { content: 'Привет' } }] })
      ;(globalThis as any).fetch = mockFetch

      await client.translateBlock('Hei', 'system prompt')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe(`${PROXY_URL}/api/translate`)
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body)
      expect(body.text).toBe('Hei')
      expect(body.systemPrompt).toBe('system prompt')
      expect(body.model).toBe(MODEL)
    })
  })

  describe('qualityCheck', () => {
    it('отправляет POST на {proxyUrl}/api/quality-check', async () => {
      const mockFetch = makeFetchMock(200, { choices: [{ message: { content: 'Привет мир' } }] })
      ;(globalThis as any).fetch = mockFetch

      await client.qualityCheck('Hei maailma', 'Привет мир')

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe(`${PROXY_URL}/api/quality-check`)
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body)
      expect(body.original).toBe('Hei maailma')
      expect(body.translated).toBe('Привет мир')
    })
  })

  describe('обработка HTTP ошибок', () => {
    it('при HTTP 401 бросает ошибку с кодом 401', async () => {
      ;(globalThis as any).fetch = makeFetchMock(401, {})

      await expect(client.detectTopic('text')).rejects.toMatchObject({ code: 401 })
    })

    it('при HTTP 429 бросает ошибку с кодом 429', async () => {
      ;(globalThis as any).fetch = makeFetchMock(429, {})

      await expect(client.translateBlock('text', 'prompt')).rejects.toMatchObject({ code: 429 })
    })

    it('при HTTP 500 бросает ошибку с кодом 500', async () => {
      ;(globalThis as any).fetch = makeFetchMock(500, {})

      await expect(client.qualityCheck('orig', 'trans')).rejects.toMatchObject({ code: 500 })
    })
  })
})
