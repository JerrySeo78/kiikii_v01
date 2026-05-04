/**
 * generate-room-actions.mjs
 * 멤버 룸 우측 액션 버튼 이미지 생성: 오늘의보이스 / 편지 / AR포즈
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
const OUT = path.join(ROOT, 'public', 'assets', 'ui')
fs.mkdirSync(OUT, { recursive: true })

const REF = path.join(ROOT, 'keyscreen', '5_member_room.png')
const refB64 = fs.readFileSync(REF).toString('base64')

const STYLE = `K-pop cute mobile game UI icon. Square image.
Soft glossy 3D chibi style. Magenta (#FF00FF) flat solid background.
Icon centered, taking up ~65% of image. No text. No rounded container around the icon.`

const ICONS = [
  {
    name: 'room_voice',
    prompt: `A cute microphone icon with sound waves. Pink glossy 3D microphone with sparkles, K-pop idol style. ${STYLE}`
  },
  {
    name: 'room_letter',
    prompt: `A cute envelope/letter icon. Pink sealed envelope with a heart seal, ribbon, K-pop cute style. ${STYLE}`
  },
  {
    name: 'room_ar',
    prompt: `A cute AR camera icon. Pink smartphone with sparkle AR effect coming out of the screen, holographic stars. K-pop cute game style. ${STYLE}`
  },
]

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

async function genImage(prompt) {
  const keys = Object.keys(process.env).filter(k => k.startsWith('GOOGLE_API_KEY'))
  const key = process.env[keys[0]]
  const ai = new GoogleGenAI({ apiKey: key })
  const res = await ai.models.generateContent({
    model: MODEL,
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

async function run() {
  for (let i = 0; i < ICONS.length; i++) {
    const icon = ICONS[i]
    console.log(`\n🎨 [${i+1}/${ICONS.length}] ${icon.name}...`)
    const data = await genImage(icon.prompt)
    const rawPath = path.join(OUT, `${icon.name}_raw.png`)
    const sqPath  = rawPath + '_sq.png'
    const outPath = path.join(OUT, `${icon.name}.png`)
    fs.writeFileSync(rawPath, Buffer.from(data, 'base64'))
    await sharp(rawPath).resize(128, 128, { fit: 'fill' }).png().toFile(sqPath)
    await removeBg(sqPath, outPath)
    fs.unlinkSync(sqPath)
    console.log(`✅ ${icon.name}.png`)
    if (i < ICONS.length - 1) await new Promise(r => setTimeout(r, 1500))
  }
  console.log('\n=== 완료 ===')
}

run().catch(e => { console.error('💥', e.message); process.exit(1) })
