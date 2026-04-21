// Генерирует иконки расширения в SVG и конвертирует в PNG
// Запуск: node generate-icons.js

const fs = require('fs')
const path = require('path')

// SVG иконка: флаг Финляндии + стрелки перевода
function createSVG(size) {
  const r = size * 0.15 // радиус скругления
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a5fb4"/>
      <stop offset="100%" style="stop-color:#0d3d8a"/>
    </linearGradient>
    <linearGradient id="bubble" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.95"/>
      <stop offset="100%" style="stop-color:#d0e4ff;stop-opacity:0.9"/>
    </linearGradient>
  </defs>
  
  <!-- Фон с скруглёнными углами -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  
  <!-- Флаг Финляндии: белый фон верхней части -->
  <rect x="0" y="0" width="${size}" height="${size * 0.45}" rx="${r}" ry="${r}" fill="white" opacity="0.15"/>
  
  <!-- Синий крест (горизонтальная полоса) -->
  <rect x="0" y="${size * 0.32}" width="${size}" height="${size * 0.18}" fill="#1a5fb4" opacity="0.8"/>
  
  <!-- Синий крест (вертикальная полоса) -->
  <rect x="${size * 0.28}" y="0" width="${size * 0.18}" height="${size}" fill="#1a5fb4" opacity="0.8"/>
  
  <!-- Белый крест поверх (тонкий) -->
  <rect x="0" y="${size * 0.35}" width="${size}" height="${size * 0.12}" fill="white" opacity="0.3"/>
  <rect x="${size * 0.31}" y="0" width="${size * 0.12}" height="${size}" fill="white" opacity="0.3"/>
  
  <!-- Речевой пузырь -->
  <ellipse cx="${size * 0.62}" cy="${size * 0.62}" rx="${size * 0.3}" ry="${size * 0.22}" fill="url(#bubble)"/>
  <polygon points="${size * 0.38},${size * 0.72} ${size * 0.32},${size * 0.82} ${size * 0.48},${size * 0.76}" fill="url(#bubble)"/>
  
  <!-- Стрелка вправо (перевод) -->
  <path d="M${size*0.5},${size*0.56} L${size*0.72},${size*0.56} L${size*0.66},${size*0.5} L${size*0.78},${size*0.62} L${size*0.66},${size*0.74} L${size*0.72},${size*0.68} L${size*0.5},${size*0.68} Z" 
        fill="#1a5fb4" opacity="0.9"/>
  
  <!-- Стрелка влево (обратно) -->
  <path d="M${size*0.7},${size*0.58} L${size*0.48},${size*0.58} L${size*0.54},${size*0.52} L${size*0.42},${size*0.64} L${size*0.54},${size*0.76} L${size*0.48},${size*0.7} L${size*0.7},${size*0.7} Z" 
        fill="white" opacity="0.8"/>
</svg>`
}

const sizes = [16, 32, 48, 128]
const outDir = path.join(__dirname, '..', '..', 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of sizes) {
  const svg = createSVG(size)
  fs.writeFileSync(path.join(outDir, `icon${size}.svg`), svg)
  console.log(`Created icon${size}.svg`)
}

console.log('SVG icons created in extension/src/icons/../icons/')
console.log('To use as PNG: convert SVGs using an online tool or sharp/canvas npm package')
