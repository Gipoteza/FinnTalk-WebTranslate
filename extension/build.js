const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const outdir = 'dist'

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
  treeShaking: false,  // отключаем tree-shaking чтобы не убирать side effects
})

// Копируем статику
const copies = [
  ['src/popup/popup.html', 'dist/popup/popup.html'],
  ['src/popup/popup.css', 'dist/popup/popup.css'],
  ['src/options/options.html', 'dist/options/options.html'],
  ['src/options/options.css', 'dist/options/options.css'],
  ['manifest.json', 'dist/manifest.json'],
]

// Копируем иконки если они существуют
const iconFiles = ['icon16.png', 'icon48.png', 'icon128.png']
for (const icon of iconFiles) {
  const src = `src/icons/${icon}`
  const dest = `dist/icons/${icon}`
  if (fs.existsSync(src)) {
    copies.push([src, dest])
  }
}

for (const [src, dest] of copies) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

// Копируем иконки
const iconSizes = [16, 32, 48, 128]
fs.mkdirSync('dist/icons', { recursive: true })
for (const size of iconSizes) {
  const iconPath = `icons/icon${size}.png`
  if (fs.existsSync(iconPath)) {
    fs.copyFileSync(iconPath, `dist/icons/icon${size}.png`)
  }
}

console.log('Build complete')
