/// <reference types="jest" />
// Feature: finnish-to-russian-translator, Unit tests for Popup UI HTML structure

import * as fs from 'fs'
import * as path from 'path'

const htmlPath = path.resolve(__dirname, '../src/popup/popup.html')
const html = fs.readFileSync(htmlPath, 'utf-8')

describe('popup.html — структура', () => {
  it('содержит кнопку с id="btn-translate"', () => {
    expect(html).toContain('id="btn-translate"')
  })

  it('содержит кнопку с id="btn-auto-translate"', () => {
    expect(html).toContain('id="btn-auto-translate"')
  })

  it('содержит кнопку с id="btn-show-original"', () => {
    expect(html).toContain('id="btn-show-original"')
  })

  it('содержит radio buttons с name="style"', () => {
    expect(html).toContain('name="style"')
  })

  it('содержит три radio button для стиля', () => {
    const matches = html.match(/name="style"/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBe(3)
  })

  it('содержит блок прогресса с id="progress"', () => {
    expect(html).toContain('id="progress"')
  })

  it('содержит span с id="progress-text"', () => {
    expect(html).toContain('id="progress-text"')
  })

  it('содержит блок ошибки с id="error-message"', () => {
    expect(html).toContain('id="error-message"')
  })

  it('содержит блок тематики с id="topic-display"', () => {
    expect(html).toContain('id="topic-display"')
  })

  it('содержит ссылку "Открыть настройки"', () => {
    expect(html).toContain('Открыть настройки')
  })
})
