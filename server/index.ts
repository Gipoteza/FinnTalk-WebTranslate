import express from 'express';
import cors from 'cors';
import path from 'path';
import proxyRoutes from './routes/proxy';

const app = express();
const PORT = process.env.PORT || 3000;

// Раздача статических файлов (лендинг)
app.use(express.static(path.join(__dirname, '../public')));

// CORS только для Chrome-расширений
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === 'null' || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin не разрешён'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use(proxyRoutes);

// Скачивание ZIP расширения
app.get('/download', (_req, res) => {
  const zipPath = path.join(__dirname, '../public/finnish-translator.zip');
  res.download(zipPath, 'finnish-translator.zip');
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

export default app;
