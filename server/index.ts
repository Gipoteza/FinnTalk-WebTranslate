import express from 'express';
import cors from 'cors';
import proxyRoutes from './routes/proxy';

const app = express();

// Порт из переменной окружения или 3000 по умолчанию
const PORT = process.env.PORT || 3000;

// Настройка CORS: разрешаем только запросы от Chrome-расширений и null (локальное тестирование)
app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, curl) и chrome-extension://
    if (!origin || origin === 'null' || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin не разрешён'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// Парсинг JSON-тела запроса
app.use(express.json());

// Подключение маршрутов проксирования
app.use(proxyRoutes);

// Health check эндпоинт
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Proxy сервер запущен на порту ${PORT}`);
});

export default app;
