/**
 * generate-select-member-layers.mjs
 * keyscreen/3_select_member_1.png → 버튼 제거된 배경 생성
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

const SRC = path.join(ROOT, 'keyscreen', '3_select_member_1.png')
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
  if (!img) throw new Error('No image: ' + all.map(p => p.text?.slice(0, 100)).join(''))
  return img.inlineData.data
}

async function generateBg() {
  console.log('🎨 배경 생성 (버튼 제거)...')
  const b64 = fs.readFileSync(SRC).toString('base64')
  const meta = await sharp(SRC).metadata()
  console.log(`   원본: ${meta.width}×${meta.height}`)

  const data = await call([
    { inlineData: { mimeType: 'image/png', data: b64 } },
    { text: `This is a K-pop mobile game member selection screen.
Remove the pink pill-shaped button at the very bottom that says "멤버 선택".
Replace the button area with natural continuation of the scene — wooden floor texture, petals, warm lighting — matching the existing art style exactly.
Keep everything else IDENTICAL: the KiiiKiii logo, the subtitle text "메인 멤버를 선택해주세요", all 5 character doors (수이, 키아, 지유, 하음, 이슬), the cozy house interior background.
Output the same image but with the bottom button replaced by natural floor scenery.` }
  ])

  const rawPath = path.join(OUT, '3_select_member_bg_raw.png')
  fs.writeFileSync(rawPath, Buffer.from(data, 'base64'))
  const raw = await sharp(rawPath).metadata()
  console.log(`   raw: ${raw.width}×${raw.height}`)

  await sharp(rawPath)
    .resize(meta.width, meta.height, { fit: 'fill' })
    .png()
    .toFile(path.join(OUT, '3_select_member_bg.png'))
  console.log(`✅ 3_select_member_bg.png — ${meta.width}×${meta.height}`)
}

generateBg()
  .then(() => console.log('\n=== 완료 ==='))
  .catch(e => { console.error('💥', e.message); process.exit(1) })
