/**
 * generate-home-ui-icons.mjs
 * 홈 화면 상단 UI 아이콘 생성 (마젠타 배경 → 투명 PNG)
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

const OUT = path.join(ROOT, 'public', 'assets', 'ui')
fs.mkdirSync(OUT, { recursive: true })

// 참조 이미지 (홈 화면 스크린샷)
const REF = path.join(ROOT, 'keyscreen', '4_home_1.png')
const refB64 = fs.readFileSync(REF).toString('base64')

const STYLE_MAGENTA = `K-pop cute mobile game UI style. Soft, glossy, rounded. Warm pastel tones.
Solid magenta (#FF00FF) background — nothing else behind the icon.
The icon should be centered, large, taking up about 70% of the image area.
No shadows outside the icon. No text. Square output.`

const STYLE_GREEN = `K-pop cute mobile game UI style. Soft, glossy, rounded. Warm pastel tones.
Solid bright green (#00FF00) background — nothing else behind the icon.
The icon should be centered, large, taking up about 70% of the image area.
No shadows outside the icon. No text. Square output.`

const ICONS = [
  {
    name: 'avatar_frame',
    keyColor: 'magenta',
    prompt: `A circular avatar frame for a K-pop mobile game.
The image has TWO regions:
1. OUTER RING: thick ornate border with shiny pink gradient, small flowers and stars decorations — this is the visible frame art
2. INNER CIRCLE: must be filled with SOLID PURE MAGENTA (#FF00FF) — no character, no texture, just flat magenta color. This area will be cut out programmatically.
The magenta background outside the frame and the magenta inner circle must be the exact same color #FF00FF.
${STYLE_MAGENTA}`
  },
  {
    name: 'icon_heart',
    keyColor: 'green',
    prompt: `A heart icon for a K-pop mobile game HP/stamina stat.
3D glossy pink-red heart shape, cute and shiny, with a highlight on the upper-left.
Matches the style from this game screenshot.
${STYLE_GREEN}`
  },
  {
    name: 'icon_coin',
    keyColor: 'magenta',
    prompt: `A gold coin/star icon for a K-pop mobile game currency stat.
Circular gold coin with a star emblem on it, shiny metallic texture, warm golden tones.
Matches the style from this game screenshot.
${STYLE_MAGENTA}`
  },
  {
    name: 'icon_diamond',
    keyColor: 'magenta',
    prompt: `A diamond/gem icon for a K-pop mobile game premium currency stat.
Blue-purple faceted diamond gem, glossy and sparkling, cute game UI style.
Matches the style from this game screenshot.
${STYLE_MAGENTA}`
  },
  {
    name: 'icon_mail',
    keyColor: 'green',
    prompt: `A mail/envelope icon for a K-pop mobile game.
Cute rounded envelope, warm pink-red tones, glossy game UI style with a small star seal.
IMPORTANT: The background must be a perfectly FLAT, SOLID, UNIFORM bright green (#00FF00) color.
NO rounded rectangle container. NO frame. NO border around the icon.
Just the envelope icon floating directly on the flat solid green background.
${STYLE_GREEN}`
  },
  {
    name: 'icon_bell',
    keyColor: 'magenta',
    prompt: `A notification bell icon for a K-pop mobile game.
Cute rounded bell shape, warm golden/yellow tones, glossy game UI style.
${STYLE_MAGENTA}`
  },
  {
    name: 'icon_settings',
    keyColor: 'magenta',
    prompt: `A settings gear/cog icon for a K-pop mobile game.
Cute rounded gear shape, soft purple/lavender tones, glossy game UI style.
${STYLE_MAGENTA}`
  },
]

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
}

async function removeKeyColor(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const W = info.width, H = info.height
  const buf = Buffer.from(data)
  const visited = new Uint8Array(W * H)

  // 코너 픽셀로 배경색 감지
  const corners = [[0,0],[W-1,0],[0,H-1],[W-1,H-1],[1,1],[W-2,1],[1,H-2],[W-2,H-2]]
  let tr = 0, tg = 0, tb = 0
  corners.forEach(([x, y]) => {
    const i = (y * W + x) * 4
    tr += buf[i]; tg += buf[i+1]; tb += buf[i+2]
  })
  const bgR = tr / corners.length, bgG = tg / corners.length, bgB = tb / corners.length
  console.log(`   배경색 감지: rgb(${Math.round(bgR)}, ${Math.round(bgG)}, ${Math.round(bgB)})`)

  const THRESHOLD = 65

  // 플러드필: 이미지 가장자리에서 시작해 배경과 유사한 픽셀을 투명으로
  const queue = []
  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const idx = y * W + x
    if (visited[idx]) return
    visited[idx] = 1
    const i = idx * 4
    if (colorDist(buf[i], buf[i+1], buf[i+2], bgR, bgG, bgB) < THRESHOLD) {
      buf[i+3] = 0
      queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1])
    }
  }

  // 4면 가장자리 전체를 시드로 등록
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H-1) }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W-1, y) }

  while (queue.length) seed(...queue.pop())

  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(outputPath)
}

async function generateIcon(icon, index) {
  // API 키를 순환해서 사용 (쿼터 분산)
  const keys = Object.keys(process.env).filter(k => k.startsWith('GOOGLE_API_KEY'))
  const key = process.env[keys[index % keys.length]]
  const client = new GoogleGenAI({ apiKey: key })

  console.log(`\n🎨 [${index + 1}/${ICONS.length}] ${icon.name} 생성 중...`)

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{
      parts: [
        { inlineData: { mimeType: 'image/png', data: refB64 } },
        { text: icon.prompt }
      ]
    }],
    config: { responseModalities: ['image', 'text'] }
  })

  const all = response.candidates?.[0]?.content?.parts ?? []
  const img = all.find(p => p.inlineData?.mimeType?.startsWith('image/'))
  if (!img) throw new Error(`No image for ${icon.name}: ` + all.map(p => p.text?.slice(0, 100)).join(''))

  const rawPath = path.join(OUT, `${icon.name}_raw.png`)
  const finalPath = path.join(OUT, `${icon.name}.png`)

  fs.writeFileSync(rawPath, Buffer.from(img.inlineData.data, 'base64'))

  // 정사각형으로 리사이즈 후 배경 제거
  await sharp(rawPath).resize(256, 256, { fit: 'fill' }).png().toFile(rawPath + '_sq.png')
  await removeKeyColor(rawPath + '_sq.png', finalPath)
  fs.unlinkSync(rawPath + '_sq.png')

  console.log(`✅ ${icon.name}.png`)
}

async function run() {
  const targets = process.argv[2] ? process.argv[2].split(',') : null
  const list = targets ? ICONS.filter(ic => targets.includes(ic.name)) : ICONS
  console.log(`${list.length}개 아이콘 생성 시작\n`)
  for (let i = 0; i < list.length; i++) {
    await generateIcon(list[i], i)
    if (i < list.length - 1) await new Promise(r => setTimeout(r, 2000))
  }
  console.log('\n=== 모든 아이콘 생성 완료 ===')
  console.log(`저장 위치: ${OUT}`)
}

run().catch(e => { console.error('💥', e.message); process.exit(1) })
