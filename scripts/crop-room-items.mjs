/**
 * crop-room-items.mjs
 * keyscreen/5_member_room.png 에서 아이템 썸네일 크롭
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC  = path.join(ROOT, 'keyscreen', '5_member_room.png')
const OUT  = path.join(ROOT, 'public', 'assets', 'ui', 'room_items')
fs.mkdirSync(OUT, { recursive: true })

// 941×1672 이미지 기준 좌표
// 각 항목: { name, left, top, width, height }
const ITEMS = [
  // ── 의상 ──────────────────────────────────────
  { name: 'outfit_01', left:  14, top: 1060, width: 152, height: 220 },
  { name: 'outfit_02', left: 196, top: 1060, width: 152, height: 220 },
  { name: 'outfit_03', left: 378, top: 1060, width: 152, height: 220 },
  { name: 'outfit_04', left: 560, top: 1060, width: 152, height: 220 },
  { name: 'outfit_05', left: 742, top: 1060, width: 152, height: 220 },

  // ── 가구 ──────────────────────────────────────
  { name: 'furniture_01', left:  14, top: 1432, width: 152, height: 152 },
  { name: 'furniture_02', left: 196, top: 1432, width: 152, height: 152 },
  { name: 'furniture_03', left: 378, top: 1432, width: 152, height: 152 },
  { name: 'furniture_04', left: 560, top: 1432, width: 152, height: 152 },
]

async function run() {
  for (const item of ITEMS) {
    const outPath = path.join(OUT, `${item.name}.png`)
    await sharp(SRC)
      .extract({ left: item.left, top: item.top, width: item.width, height: item.height })
      .resize(128, 128)
      .png()
      .toFile(outPath)
    console.log(`✅ ${item.name}.png`)
  }
  console.log('\n=== 완료 ===')
}

run().catch(e => { console.error('💥', e.message); process.exit(1) })
