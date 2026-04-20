import { Router, Request, Response } from 'express';

const router = Router();

// URL OpenAI API
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Вспомогательная функция: проверка наличия API-ключа и проксирование запроса к OpenAI
async function proxyToOpenAI(body: object, res: Response): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Если ключ не задан — возвращаем ошибку 500
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY не задан в переменных окружения' });
    return;
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Возвращаем ответ OpenAI клиенту как есть
    res.status(response.status).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    res.status(500).json({ error: `Ошибка при запросе к OpenAI: ${message}` });
  }
}

// POST /api/detect-topic — определение тематики текста
router.post('/api/detect-topic', async (req: Request, res: Response) => {
  const { text, model = 'gpt-4o-mini' } = req.body as { text: string; model?: string };

  const body = {
    model,
    messages: [
      {
        role: 'system',
        content: 'Определи тематику текста. Ответь одним словом из списка: медицина, юриспруденция, финансы, техника, IT, бытовая, деловая, разговорная.',
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 20,
  };

  await proxyToOpenAI(body, res);
});

// POST /api/translate — перевод блока текста с финского на русский
router.post('/api/translate', async (req: Request, res: Response) => {
  const { text, systemPrompt, model = 'gpt-4o-mini' } = req.body as {
    text: string;
    systemPrompt: string;
    model?: string;
  };

  const body = {
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: text,
      },
    ],
  };

  await proxyToOpenAI(body, res);
});

// POST /api/quality-check — проверка качества перевода
router.post('/api/quality-check', async (req: Request, res: Response) => {
  const { original, translated, model = 'gpt-4o-mini' } = req.body as {
    original: string;
    translated: string;
    model?: string;
  };

  const body = {
    model,
    messages: [
      {
        role: 'system',
        content: 'Ты редактор переводов с финского на русский. Проверь качество перевода и при необходимости исправь его. Верни только исправленный текст без комментариев.',
      },
      {
        role: 'user',
        content: `Оригинал (финский):\n${original}\n\nПеревод (русский):\n${translated}`,
      },
    ],
  };

  await proxyToOpenAI(body, res);
});

export default router;
