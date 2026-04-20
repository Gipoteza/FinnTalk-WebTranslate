// Очередь API-запросов с контролем частоты и экспоненциальным backoff
// Реализует повторные попытки: 1с → 2с → 4с (максимум 3 попытки)

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class RequestQueue {
  private _paused = false
  private _pauseUntil = 0

  async enqueue<T>(request: () => Promise<T>): Promise<T> {
    // Ждём окончания паузы, если она активна
    if (this._paused) {
      const remaining = this._pauseUntil - Date.now()
      if (remaining > 0) {
        await delay(remaining)
      }
      this._paused = false
    }

    const delays = [1000, 2000, 4000]
    let lastError: any

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await request()
      } catch (err: any) {
        lastError = err

        // HTTP 401 — не повторяем, сразу бросаем
        if (err && err.code === 401) {
          throw err
        }

        // HTTP 429 — пауза 60 секунд перед повтором
        if (err && err.code === 429) {
          this.pause(60000)
          await delay(60000)
        } else {
          // Сетевая или другая ошибка — экспоненциальный backoff
          if (attempt < delays.length) {
            await delay(delays[attempt])
          }
        }
      }
    }

    throw lastError
  }

  pause(durationMs: number): void {
    this._paused = true
    this._pauseUntil = Date.now() + durationMs
  }

  getStatus(): { paused: boolean; pauseRemainingMs: number } {
    if (!this._paused) {
      return { paused: false, pauseRemainingMs: 0 }
    }
    const remaining = this._pauseUntil - Date.now()
    if (remaining <= 0) {
      this._paused = false
      return { paused: false, pauseRemainingMs: 0 }
    }
    return { paused: true, pauseRemainingMs: remaining }
  }
}
