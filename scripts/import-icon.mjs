#!/usr/bin/env node

import {existsSync,readFileSync, writeFileSync} from 'fs'
import {basename,resolve} from 'path'
import SVGPath from 'svgpath'
import {fileURLToPath} from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ICONS_DIR = resolve(__dirname, '../src/components/icons')
const TARGET_SIZE = 24

function parseArgs(argv) {
  const args = argv.slice(2)
  let name = null
  let svgFile = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i]
    } else if (!args[i].startsWith('--')) {
      svgFile = args[i]
    }
  }

  if (!svgFile) {
    console.error('Usage: node scripts/import-icon.mjs --name IconName /path/to/icon.svg')
    process.exit(1)
  }

  if (!name) {
    // Derive name from filename: "donor-line.svg" -> "DonorLine"
    name = basename(svgFile, '.svg')
      .replace(/[-_]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase())
  }

  return {name, svgFile: resolve(svgFile)}
}

function extractViewBox(svg) {
  const match = svg.match(/viewBox=["']([^"']+)["']/)
  if (!match) {
    console.error('Error: No viewBox found in SVG')
    process.exit(1)
  }
  const [, , width, height] = match[1].split(/\s+/).map(Number)
  return {width, height}
}

function extractPaths(svg) {
  const paths = []
  const pathRegex = /<path[^>]*\bd=["']([^"']+)["'][^>]*\/?>/g
  let match
  while ((match = pathRegex.exec(svg)) !== null) {
    paths.push(match[1])
  }
  if (paths.length === 0) {
    console.error('Error: No <path d="..."> elements found in SVG')
    process.exit(1)
  }
  return paths
}

function rescalePath(pathData, sourceWidth, sourceHeight) {
  if (sourceWidth === TARGET_SIZE && sourceHeight === TARGET_SIZE) {
    return pathData
  }
  const sx = TARGET_SIZE / sourceWidth
  const sy = TARGET_SIZE / sourceHeight
  return SVGPath(pathData).scale(sx, sy).round(4).toString()
}

function generateFile(name, paths) {
  const exportName = `${name}_Stroke2_Corner0_Rounded`

  if (paths.length === 1) {
    return [
      `import {createSinglePathSVG} from './TEMPLATE'`,
      ``,
      `export const ${exportName} = createSinglePathSVG({`,
      `  path: '${paths[0]}',`,
      `})`,
      ``,
    ].join('\n')
  }

  const pathEntries = paths.map(p => `    '${p}',`).join('\n')
  return [
    `import {createMultiPathSVG} from './TEMPLATE'`,
    ``,
    `export const ${exportName} = createMultiPathSVG({`,
    `  paths: [`,
    pathEntries,
    `  ],`,
    `})`,
    ``,
  ].join('\n')
}

// Main
const {name, svgFile} = parseArgs(process.argv)

if (!existsSync(svgFile)) {
  console.error(`Error: File not found: ${svgFile}`)
  process.exit(1)
}

const svg = readFileSync(svgFile, 'utf-8')
const {width, height} = extractViewBox(svg)
const rawPaths = extractPaths(svg)
const scaledPaths = rawPaths.map(p => rescalePath(p, width, height))
const output = generateFile(name, scaledPaths)
const outPath = resolve(ICONS_DIR, `${name}.tsx`)

writeFileSync(outPath, output)
console.log(`Created ${outPath}`)
console.log(`  Source viewBox: 0 0 ${width} ${height}`)
console.log(`  Paths: ${scaledPaths.length}`)
console.log(`  Export: ${name}_Stroke2_Corner0_Rounded`)
