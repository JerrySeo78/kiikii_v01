/**
 * generate-room-bg.mjs
 * keyscreen/5_member_room.png → 캐릭터·UI 제거된 순수 방 배경 생성
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

const SRC = path.join(ROOT, 'keyscreen', '5_member_room.png')
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
  console.log('🎨 멤버 룸 배경 생성 (캐릭터·UI 전체 제거)...')
  const b64 = fs.readFileSync(SRC).toString('base64')
  const meta = await sharp(SRC).metadata()
  console.log(`   원본: ${meta.width}×${meta.height}`)

  const data = await call([
    { inlineData: { mimeType: 'image/png', data: b64 } },
    { text: `This is a K-pop mobile game member room screen.
Remove ALL UI elements and the chibi character, return ONLY the pure room background artwork.

Elements to REMOVE:
- The chibi character (수이) standing in the center of the room
- Speech bubble / dialogue text
- Top header bar (back arrow, title "멤버 하우스/꾸미기", question mark button)
- Left panel (member info card: 수이, 친밀도 Lv.6, 720/1000 bar, 친밀도 보상 button)
- Right panel (오늘의 보이스, 편지, AR포즈 buttons)
- Bottom UI panel (꾸미기 tabs: 의상/가구/선물/대화, item grids, 저장/미리보기/꾸미기 적용 buttons)
- Any icons, labels, text overlays

Elements to KEEP and FILL IN naturally:
- The beautiful pink romantic bedroom interior
- Large arched window showing ocean/beach sunset view with palm trees
- String lights / fairy lights hanging across the ceiling and window
- Pink and white decorative bed with pillows
- Vanity mirror / dressing table area
- Pink suitcase / travel props
- Plush toys (pink bear/rabbit)
- Decorative flowers and plants
- Warm pink and purple ambient lighting
- The circular rug on the floor (where the character stood — fill naturally)
- Overall dreamy, cozy K-pop idol room atmosphere

Where UI panels covered the room, fill with natural continuation of the room interior.
Output the same dimensions as input — a clean full room background with no characters or UI.` }
  ])

  const rawPath = path.join(OUT, '5_room_bg_raw.png')
  fs.writeFileSync(rawPath, Buffer.from(data, 'base64'))
  const raw = await sharp(rawPath).metadata()
  console.log(`   raw: ${raw.width}×${raw.height}`)

  await sharp(rawPath)
    .resize(meta.width, meta.height, { fit: 'fill' })
    .png()
    .toFile(path.join(OUT, '5_room_bg.png'))
  console.log(`✅ 5_room_bg.png — ${meta.width}×${meta.height}`)
}

generateBg()
  .then(() => console.log('\n=== 완료 ==='))
  .catch(e => { console.error('💥', e.message); process.exit(1) })
