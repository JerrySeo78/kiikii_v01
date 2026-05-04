/**
 * generate-tabbar.mjs
 * 하단 탭바 배경 + 6개 아이콘 생성
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

const MODEL_IMG  = 'gemini-2.5-flash-image'
const MODEL_TEXT = 'gemini-2.5-flash'
const OUT_UI  = path.join(ROOT, 'public', 'assets', 'ui')
const OUT_SCR = path.join(ROOT, 'public', 'assets', 'screens')
fs.mkdirSync(OUT_UI,  { recursive: true })
fs.mkdirSync(OUT_SCR, { recursive: true })

const REF    = path.join(ROOT, 'keyscreen', '4_home_1.png')
const refB64 = fs.readFileSync(REF).toString('base64')

// ── 키 컬러별 스타일 ──────────────────────────────────────
const STYLE = (bg) => `K-pop cute mobile game UI style. Soft, glossy, rounded 3D icon.
Solid ${bg} background — perfectly flat and uniform. No gradients on the background.
Icon centered, taking up ~70% of the image. No text. Square output.
IMPORTANT: NO rounded rectangle container around the icon, just the icon on flat ${bg}.`

const ICONS = [
  { name: 'tab_home',  bg: 'magenta (#FF00FF)',
    prompt: `A cute house/home icon. Tall compact shape — the house must be SQUARE or slightly taller than wide, NOT wider than tall. Pink roof with a heart shape, small door at the bottom. Chibi 3D game UI style. The icon must fit naturally in a square canvas with equal margins on all sides.` },
  { name: 'tab_play',  bg: 'magenta (#FF00FF)',
    prompt: `A cute game controller icon. Rounded purple/lavender game pad, chibi cute style.` },
  { name: 'tab_box',   bg: 'magenta (#FF00FF)',
    prompt: `A cute closed gift box icon. Square box body with a ribbon wrapped around it and a large decorative bow on top. Pink and white colors. Solid 3D chibi game UI style. It must clearly look like a wrapped present/gift box.` },
  { name: 'tab_shop',  bg: 'green (#00FF00)',
    prompt: `A cute shopping bag icon. Pink paper shopping bag with ribbon handles, chibi game style.` },
  { name: 'tab_talk',  bg: 'magenta (#FF00FF)',
    prompt: `A cute speech bubble / chat icon. Rounded speech bubble with three dots inside, chibi game style, soft purple/pink.` },
  { name: 'tab_menu',  bg: 'magenta (#FF00FF)',
    prompt: `A hamburger menu icon with exactly THREE thick rounded horizontal bars, evenly spaced and stacked vertically. Warm pink color, glossy 3D look, chibi game UI style. All three bars must be clearly visible and the same size.` },
]

// ── 플러드필 배경 제거 ────────────────────────────────────
function colorDist(r1,g1,b1,r2,g2,b2) {
  return Math.sqrt((r1-r2)**2+(g1-g2)**2+(b1-b2)**2)
}
async function removeBg(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, buf = Buffer.from(data)
  const visited = new Uint8Array(W * H)

  const corners = [[0,0],[W-1,0],[0,H-1],[W-1,H-1],[1,1],[W-2,1],[1,H-2],[W-2,H-2]]
  let tr=0,tg=0,tb=0
  corners.forEach(([x,y]) => { const i=(y*W+x)*4; tr+=buf[i]; tg+=buf[i+1]; tb+=buf[i+2] })
  const bgR=tr/corners.length, bgG=tg/corners.length, bgB=tb/corners.length
  console.log(`   bg: rgb(${Math.round(bgR)},${Math.round(bgG)},${Math.round(bgB)})`)

  const THRESH = 65
  const queue = []
  const seed = (x,y) => {
    if (x<0||y<0||x>=W||y>=H) return
    const idx=y*W+x; if(visited[idx]) return; visited[idx]=1
    const i=idx*4
    if (colorDist(buf[i],buf[i+1],buf[i+2],bgR,bgG,bgB)<THRESH) {
      buf[i+3]=0; queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1])
    }
  }
  for(let x=0;x<W;x++){seed(x,0);seed(x,H-1)}
  for(let y=0;y<H;y++){seed(0,y);seed(W-1,y)}
  while(queue.length) seed(...queue.pop())

  await sharp(buf,{raw:{width:W,height:H,channels:4}}).png().toFile(outputPath)
}

// ── Gemini 호출 ───────────────────────────────────────────
function getClient(index) {
  const keys = Object.keys(process.env).filter(k => k.startsWith('GOOGLE_API_KEY'))
  return new GoogleGenAI({ apiKey: process.env[keys[index % keys.length]] })
}

async function genImage(client, prompt) {
  const res = await client.models.generateContent({
    model: MODEL_IMG,
    contents: [{ parts: [
      { inlineData: { mimeType: 'image/png', data: refB64 } },
      { text: prompt }
    ]}],
    config: { responseModalities: ['image','text'] }
  })
  const parts = res.candidates?.[0]?.content?.parts ?? []
  const img = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))
  if (!img) throw new Error('No image: ' + parts.map(p=>p.text?.slice(0,100)).join(''))
  return img.inlineData.data
}

// ── 1. 탭바 배경 ──────────────────────────────────────────
async function generateTabBg() {
  console.log('\n🎨 탭바 배경 생성...')
  const client = getClient(0)
  const data = await genImage(client, `Generate a bottom navigation tab bar background for a K-pop mobile game.
A wide horizontal strip (landscape orientation, about 6:1 aspect ratio).
Style: soft frosted glass panel, warm pink-white gradient (lighter at top, slightly deeper pink at bottom).
Top edge: gently rounded corners. Bottom edge: straight.
Subtle inner glow and soft drop shadow on top edge.
No icons, no text, no dividers — just the clean background panel.
The overall feel should match this K-pop game's aesthetic: soft, feminine, warm pastel pink.`)

  const rawPath = path.join(OUT_SCR, 'tabbar_bg_raw.png')
  fs.writeFileSync(rawPath, Buffer.from(data, 'base64'))
  const raw = await sharp(rawPath).metadata()
  // 390×70 비율로 리사이즈
  await sharp(rawPath).resize(390, 70, { fit: 'fill' }).png().toFile(path.join(OUT_SCR, 'tabbar_bg.png'))
  console.log(`✅ tabbar_bg.png (${raw.width}×${raw.height} → 390×70)`)
}

// ── 2. 탭 아이콘들 ────────────────────────────────────────
async function generateIcons() {
  const targets = process.argv[2] ? process.argv[2].split(',') : null
  const list = targets ? ICONS.filter(ic => targets.includes(ic.name)) : ICONS

  for (let i = 0; i < list.length; i++) {
    const icon = list[i]
    console.log(`\n🎨 [${i+1}/${list.length}] ${icon.name}...`)
    const client = getClient(i)
    const data = await genImage(client, `${icon.prompt}\n${STYLE(icon.bg)}`)

    const rawPath = path.join(OUT_UI, `${icon.name}_raw.png`)
    const sqPath  = rawPath + '_sq.png'
    const outPath = path.join(OUT_UI, `${icon.name}.png`)

    fs.writeFileSync(rawPath, Buffer.from(data, 'base64'))
    await sharp(rawPath).resize(128, 128, { fit: 'fill' }).png().toFile(sqPath)
    await removeBg(sqPath, outPath)
    fs.unlinkSync(sqPath)
    console.log(`✅ ${icon.name}.png`)

    if (i < list.length - 1) await new Promise(r => setTimeout(r, 1500))
  }
}

// ── 실행 ──────────────────────────────────────────────────
async function run() {
  const mode = process.argv[3] ?? 'all'
  if (mode === 'bg'   || mode === 'all') await generateTabBg()
  if (mode === 'icon' || mode === 'all') await generateIcons()
  console.log('\n=== 완료 ===')
}

run().catch(e => { console.error('💥', e.message); process.exit(1) })
