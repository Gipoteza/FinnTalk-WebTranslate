// Feature: finnish-to-russian-translator, Property 12: retry on network error

import fc from 'fast-check'
import { RequestQueue } from '../src/background/queue'

// Минимальное количество итераций
fc.configureGlobal({ numRuns: 100 })

describe('RequestQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // --- Unit-тесты ---

  it('успешный запрос выполняется ровно 1 раз', async () => {
    const queue = new RequestQueue()
    const fn = jest.fn().mockResolvedValue('ok')

    const promise = queue.enqueue(fn)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(fn).toHaveBeenCalledTimes(1)
    expect(result).toBe('ok')
  })

  it('после успешного выполнения возвращает результат', async () => {
    const queue = new RequestQueue()
    const fn = jest.fn().mockResolvedValue(42)

    const promise = queue.enqueue(fn)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toBe(42)
  })

  it('при сетевой ошибке выполняется ровно 3 попытки', async () => {
    const queue = new RequestQueue()
    const networkError = new Error('Network error')
    const fn = jest.fn().mockRejectedValue(networkError)

    const promise = queue.enqueue(fn).catch(() => {})
    await jest.runAllTimersAsync()
    await promise

    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('при HTTP 401 выполняется только 1 попытка (не повторяет)', async () => {
    const queue = new RequestQueue()
    const err401 = Object.assign(new Error('Unauthorized'), { code: 401 })
    const fn = jest.fn().mockRejectedValue(err401)

    const promise = queue.enqueue(fn).catch(() => {})
    await jest.runAllTimersAsync()
    await promise

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('при HTTP 401 бросает ошибку с кодом 401', async () => {
    const queue = new RequestQueue()
    const err401 = Object.assign(new Error('Unauthorized'), { code: 401 })
    const fn = jest.fn().mockRejectedValue(err401)

    await expect(
      Promise.all([queue.enqueue(fn), jest.runAllTimersAsync()]).then(([r]) => r)
    ).rejects.toMatchObject({ code: 401 })
  })

  it('при HTTP 429 очередь вызывает pause — задержка >= 60000мс', async () => {
    const queue = new RequestQueue()
    const err429 = Object.assign(new Error('Too Many Requests'), { code: 429 })

    // Первые 3 вызова бросают 429
    const fn = jest.fn().mockRejectedValue(err429)

    const pauseSpy = jest.spyOn(queue, 'pause')

    const promise = queue.enqueue(fn).catch(() => {})
    await jest.runAllTimersAsync()
    await promise

    expect(pauseSpy).toHaveBeenCalled()
    const calledWith = pauseSpy.mock.calls[0][0]
    expect(calledWith).toBeGreaterThanOrEqual(60000)
  })

  it('после 3 неудачных попыток бросает последнюю ошибку', async () => {
    const queue = new RequestQueue()
    const networkError = new Error('Network failure')
    const fn = jest.fn().mockRejectedValue(networkError)

    await expect(
      Promise.all([queue.enqueue(fn), jest.runAllTimersAsync()]).then(([r]) => r)
    ).rejects.toThrow('Network failure')
  })

  // --- Property-based тест ---

  it('Свойство 12: для любого запроса с сетевой ошибкой выполняется ровно 3 попытки', async () => {
    // **Validates: Requirements 7.1**
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMessage) => {
          const queue = new RequestQueue()
          const networkError = new Error(errorMessage)
          let callCount = 0

          const fn = jest.fn().mockImplementation(() => {
            callCount++
            return Promise.reject(networkError)
          })

          const promise = queue.enqueue(fn).catch(() => {})
          await jest.runAllTimersAsync()
          await promise

          return callCount === 3
        }
      )
    )
  })
})
