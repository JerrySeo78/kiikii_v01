/**
 * generate-home-bg.mjs
 * keyscreen/4_home_1.png → UI 제거된 순수 배경 생성
 */
import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const envPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  })
}

const MODEL = 'gemini-2.5-flash-image'
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

const SRC = path.join(ROOT, 'keyscreen', '4_home_1.png')
const OUT = path.join(ROOT, 'public', 'assets', 'screens')
fs.mkdirSync(OUT, { recursive: true })

async function call(parts) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ parts }],
    config: { responseModalities: ['image', 'text'] }
  })
  const all = response.candidates?.[0]?.content?.parts ?? []
  const img = all.find(p => p.inlineData?.mimeType?.startsWith('image/'))
  if (!img) throw new Error('No image: ' + all.map(p => p.text?.slice(0, 200)).join(''))
  return img.inlineData.data
}

async function generateBg() {
  console.log('🎨 홈 배경 생성 (UI 전체 제거)...')
  const b64 = fs.readFileSync(SRC).toString('base64')
  const meta = await sharp(SRC).metadata()
  console.log(`   원본: ${meta.width}×${meta.height}`)

  const data = await call([
    { inlineData: { mimeType: 'image/png', data: b64 } },
    { text: `This is a K-pop mobile game home screen.
Remove ALL UI elements completely and return ONLY the pure background artwork:

Elements to REMOVE:
- Top profile bar (avatar, level, nickname, heart/gold/diamond stats, mail/bell/settings icons)
- Left panel: member card (수이 with intimacy bar) and member list (키아, 지유, 하음, 이슬)
- Right panel: "오늘의 플랜" checklist panel
- Center: the chibi character illustration (수이) standing on the pier
- Bottom: the large pink "오늘의 게임 플레이" button
- Bottom: the tab navigation bar (홈/플레이/박스/상점/토크/메뉴)
- Any text labels, icons, or overlays

Elements to KEEP and FILL IN naturally:
- The full sunset/dusk scene: sky with purple-pink gradient, sun setting on horizon
- The wooden pier/boardwalk extending into the ocean
- Palm trees on both sides
- String lights hanging across the top
- Tropical flowers (pink hibiscus) at the bottom corners
- Pink suitcases and camera props on the pier
- The ocean/sea in the background
- Overall warm romantic atmosphere

Where UI panels covered the background, fill with natural continuation of the scene.
Output the same dimensions as input — a clean, full background with no characters or UI.` }
  ])

  const rawPath = path.join(OUT, '4_home_bg_raw.png')
  fs.writeFileSync(rawPath, Buffer.from(data, 'base64'))
  const raw = await sharp(rawPath).metadata()
  console.log(`   raw: ${raw.width}×${raw.height}`)

  await sharp(rawPath)
    .resize(meta.width, meta.height, { fit: 'fill' })
    .png()
    .toFile(path.join(OUT, '4_home_bg.png'))
  console.log(`✅ 4_home_bg.png — ${meta.width}×${meta.height}`)
}

generateBg()
  .then(() => console.log('\n=== 완료 ==='))
  .catch(e => { console.error('💥', e.message); process.exit(1) })
