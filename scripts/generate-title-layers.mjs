/**
 * generate-title-layers.mjs
 * keyscreen/title.png → 2개 레이어 생성
 *
 * 1. title_bg.png  — 버튼 제거 (인페인팅), 배경만
 * 2. title_btn.png — "시작하기" 버튼 단독 생성
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

const TITLE = path.join(ROOT, 'keyscreen', 'title.png')
const OUT   = path.join(ROOT, 'assets', 'bg')
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
  const b64 = fs.readFileSync(TITLE).toString('base64')
  const meta = await sharp(TITLE).metadata()
  console.log(`   원본: ${meta.width}×${meta.height}`)

  const data = await call([
    { inlineData: { mimeType: 'image/png', data: b64 } },
    { text: `This is a K-pop mobile game title screen.
Remove the white pill-shaped button at the bottom that says "시작하기".
Replace the button area with natural continuation of the scene — more pink flowers, ground texture, petals — matching the existing art style exactly.
Keep everything else IDENTICAL: the KiiiKiii logo, all 5 characters, the sunset background, the lighting, all decorative elements.
Output the same image but with the button replaced by natural scenery.` }
  ])

  const rawPath = path.join(OUT, 'title_bg_raw.png')
  fs.writeFileSync(rawPath, Buffer.from(data, 'base64'))
  const raw = await sharp(rawPath).metadata()
  console.log(`   raw: ${raw.width}×${raw.height}`)

  // 원본과 동일한 비율로 리사이즈
  await sharp(rawPath)
    .resize(meta.width, meta.height, { fit: 'fill' })
    .png()
    .toFile(path.join(OUT, 'title_bg.png'))
  console.log(`✅ title_bg.png — ${meta.width}×${meta.height}`)
}

async function generateBtn() {
  console.log('\n🎨 버튼 생성...')
  const b64 = fs.readFileSync(TITLE).toString('base64')

  const data = await call([
    { inlineData: { mimeType: 'image/png', data: b64 } },
    { text: `Extract and recreate ONLY the "시작하기" button from the bottom of this image.
Generate just the button element on a transparent or solid magenta (#FF00FF) background.
The button should be: white pill shape, soft shadow, "✦ 시작하기 ✦" text in Korean, same style as in the image.
Output: just the button, centered, with magenta (#FF00FF) background. No other elements.
Wide format, button should take up most of the image width.` }
  ])

  const rawPath = path.join(OUT, 'title_btn_raw.png')
  fs.writeFileSync(rawPath, Buffer.from(data, 'base64'))
  const raw = await sharp(rawPath).metadata()
  console.log(`   raw: ${raw.width}×${raw.height}`)

  // 마젠타 배경 제거 → 투명 PNG
  const { data: px, info } = await sharp(rawPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const buf = Buffer.from(px)
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i+1], b = buf[i+2]
    if (r > 180 && g < 80 && b > 180) buf[i+3] = 0  // 마젠타 → 투명
  }

  const alphaPath = path.join(OUT, 'title_btn.png')
  await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(alphaPath)
  console.log(`✅ title_btn.png — ${info.width}×${info.height}`)
}

async function run() {
  await generateBg()
  await generateBtn()
  console.log('\n=== 완료 ===')
}

run().catch(e => { console.error('💥', e.message); process.exit(1) })
