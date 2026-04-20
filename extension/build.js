const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const outdir = 'dist'

// Бандлим все точки входа
esbuild.buildSync({
  entryPoints: [
    'src/background/service-worker.ts',
    'src/content/content-script.ts',
    'src/popup/popup.ts',
    'src/options/options.ts',
  ],
  bundle: true,
  outdir,
  outbase: 'src',
  platform: 'browser',
  target: 'chrome110',
  format: 'iife',
  // service worker не может быть IIFE с globalName, оставляем без него
})

// Копируем статику
const copies = [
  ['src/popup/popup.html', 'dist/popup/popup.html'],
  ['src/popup/popup.css', 'dist/popup/popup.css'],
  ['src/options/options.html', 'dist/options/options.html'],
  ['src/options/options.css', 'dist/options/options.css'],
  ['manifest.json', 'dist/manifest.json'],
]

for (const [src, dest] of copies) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

console.log('Build complete')
