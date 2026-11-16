const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const wasmFile = path.join(__dirname, '..', 'dist', 'ctb_mesh.wasm')
const stubs = {
  fd_close: () => 0,
  fd_seek: () => 0,
  fd_write: () => 0,
  proc_exit: () => {},
}

async function main () {
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasmFile), {
    wasi_snapshot_preview1: stubs,
  })
  const { ctb_encode_mesh: encode, malloc, free, memory } = instance.exports
  const size = 65 * 65
  const heightsPtr = malloc(size * Float32Array.BYTES_PER_ELEMENT)
  const neighborsPtr = malloc(4 * Uint32Array.BYTES_PER_ELEMENT)
  const outSizePtr = malloc(Int32Array.BYTES_PER_ELEMENT)
  new Float32Array(memory.buffer, heightsPtr, size).fill(0)
  new Uint32Array(memory.buffer, neighborsPtr, 4).fill(0)
  new Int32Array(memory.buffer, outSizePtr, 1).fill(0)

  const outputPtr = encode(heightsPtr, neighborsPtr, 65, 0, 0, 0, outSizePtr)
  const outputSize = new Int32Array(memory.buffer, outSizePtr, 1)[0]
  if (!outputPtr || outputSize <= 0) throw new Error('ctb_encode_mesh returned no bytes')

  const gzipped = Buffer.from(new Uint8Array(memory.buffer, outputPtr, outputSize))
  const terrain = zlib.gunzipSync(gzipped)
  if (terrain.length < 88) throw new Error(`quantized-mesh output is too short: ${terrain.length}`)

  free(outSizePtr)
  free(neighborsPtr)
  free(heightsPtr)
  process.stdout.write(`WASM smoke test passed (${gzipped.length} gzip bytes, ${terrain.length} terrain bytes)\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
