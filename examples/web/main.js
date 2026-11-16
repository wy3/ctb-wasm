import { fromBlob } from 'geotiff'
import { createTerrainArchive } from '../lib/terrain-archive.js'
import wasmUrl from '../../dist/ctb_mesh.wasm?url'
import './style.css'

const form = document.querySelector('#generator')
const fileInput = document.querySelector('#geotiff')
const zoomInput = document.querySelector('#max-zoom')
const submitButton = document.querySelector('#submit')
const downloadLink = document.querySelector('#download')
const progress = document.querySelector('#progress')
const status = document.querySelector('#status')
let downloadUrl

const messages = document.documentElement.lang === 'en'
  ? {
      chooseFile: 'Please choose a GeoTIFF file.',
      invalidZoom: 'Maximum zoom must be an integer from 0 to 30.',
      reading: 'Reading GeoTIFF and loading WASM…',
      encoding: 'Encoding tiles',
      ready: 'ZIP generated. If it did not download automatically, use the download link.',
      failed: 'Processing failed: ',
    }
  : {
      chooseFile: '请选择 GeoTIFF 文件。',
      invalidZoom: '最高 Zoom 必须是 0 到 30 之间的整数。',
      reading: '正在读取 GeoTIFF 并加载 WASM…',
      encoding: '正在编码瓦片',
      ready: 'ZIP 已生成；若未自动下载，请点击“下载生成的 ZIP”。',
      failed: '处理失败：',
    }

async function loadWasm () {
  const response = await fetch(wasmUrl)
  if (!response.ok) throw new Error(`WASM 加载失败：HTTP ${response.status}`)

  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {
    wasi_snapshot_preview1: {
      fd_close: () => 0,
      fd_seek: () => 0,
      fd_write: () => 0,
      proc_exit: () => {},
    },
  })
  return instance.exports
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const file = fileInput.files[0]
  const maxZoom = Number(zoomInput.value)
  if (!file) {
    status.textContent = messages.chooseFile
    return
  }
  if (!Number.isInteger(maxZoom) || maxZoom < 0 || maxZoom > 30) {
    status.textContent = messages.invalidZoom
    return
  }

  submitButton.disabled = true
  downloadLink.hidden = true
  if (downloadUrl) URL.revokeObjectURL(downloadUrl)
  progress.hidden = false
  progress.value = 0
  status.textContent = messages.reading

  try {
    const tiff = await fromBlob(file)
    const image = await tiff.getImage()
    const wasm = await loadWasm()
    const archive = await createTerrainArchive(image, wasm, maxZoom, (completed, total) => {
      progress.value = Math.floor((completed / total) * 100)
      status.textContent = `${messages.encoding}: ${completed} / ${total}`
    })

    const blob = new Blob([archive], { type: 'application/zip' })
    downloadUrl = URL.createObjectURL(blob)
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'terrain'
    downloadLink.href = downloadUrl
    downloadLink.download = `${baseName}-terrain.zip`
    downloadLink.hidden = false
    downloadLink.click()

    progress.value = 100
    status.textContent = messages.ready
  } catch (error) {
    status.textContent = `${messages.failed}${error.message}`
  } finally {
    submitButton.disabled = false
  }
})
