const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const svgPath = path.join(__dirname, 'icons', 'icon.svg')
const svgBuffer = fs.readFileSync(svgPath)
const sizes = [16, 32, 48, 128]

Promise.all(sizes.map(size =>
  sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(path.join(__dirname, 'icons', `icon${size}.png`))
    .then(() => console.log(`icon${size}.png created`))
)).then(() => console.log('All icons created'))
  .catch(e => console.error(e))
