import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromFile } from 'geotiff'
import { createTerrainArchive } from './lib/terrain-archive.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function main () {
  const [inputFile, outputFile, zoomArgument] = process.argv.slice(2)
  if (!inputFile || !outputFile || zoomArgument === undefined) {
    throw new Error('Usage: node examples/geotiff-to-zip.mjs <input.tif> <output.zip> <maxZoom>')
  }

  const tiff = await fromFile(path.resolve(inputFile))
  const image = await tiff.getImage()
  const maxZoom = Number(zoomArgument)
  const wasmBytes = fs.readFileSync(path.join(ROOT, 'dist', 'ctb_mesh.wasm'))
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    wasi_snapshot_preview1: {
      fd_close: () => 0,
      fd_seek: () => 0,
      fd_write: () => 0,
      proc_exit: () => {},
    },
  })

  const archive = await createTerrainArchive(image, instance.exports, maxZoom)
  const outputPath = path.resolve(outputFile)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, archive)
  process.stdout.write(`Wrote ${outputPath} (zoom 0-${maxZoom})\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
