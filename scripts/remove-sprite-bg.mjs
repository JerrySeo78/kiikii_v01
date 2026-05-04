/**
 * remove-sprite-bg.mjs
 * 캐릭터 스프라이트 배경 제거:
 * 1) 엣지 flood-fill로 외부 흰 배경 제거
 * 2) 내부 흰색 섬(머리카락 틈 등) connected-component 분석으로 제거
 *    (작은 덩어리만 제거, 흰 양말 같은 큰 덩어리는 보존)
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SPRITES_DIR = path.join(ROOT, 'public', 'assets', 'characters', 'sprites')

// 내부 섬 제거 임계값: 이 픽셀 수 이하면 제거
const ISLAND_MAX_SIZE = parseInt(process.env.ISLAND_MAX || '800')
// 흰색 판정 임계값
const WHITE_THRESHOLD = 40
// 배경색 판정 임계값 (엣지 flood-fill용)
const EDGE_THRESHOLD = 40

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
}

async function removeBg(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const W = info.width, H = info.height
  const buf = Buffer.from(data)

  // ── 1. 코너 샘플링으로 배경색 감지 ──────────────────────
  const corners = [[0,0],[W-1,0],[0,H-1],[W-1,H-1],[1,1],[W-2,1],[1,H-2],[W-2,H-2]]
  let tr=0, tg=0, tb=0
  corners.forEach(([x,y]) => {
    const i = (y*W+x)*4
    tr += buf[i]; tg += buf[i+1]; tb += buf[i+2]
  })
  const bgR = tr/corners.length, bgG = tg/corners.length, bgB = tb/corners.length

  const isWhiteBg = colorDist(bgR, bgG, bgB, 255, 255, 255) <= 30

  // ── 2. 엣지 flood-fill로 외부 배경 제거 ──────────────────
  let edgeRemoved = 0
  if (isWhiteBg) {
    const visited = new Uint8Array(W * H)
    const queue = []
    const seed = (x, y) => {
      if (x<0||y<0||x>=W||y>=H) return
      const idx = y*W+x
      if (visited[idx]) return
      visited[idx] = 1
      const i = idx*4
      if (buf[i+3] > 0 && colorDist(buf[i], buf[i+1], buf[i+2], bgR, bgG, bgB) < EDGE_THRESHOLD) {
        buf[i+3] = 0
        edgeRemoved++
        queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1])
      }
    }
    for (let x=0; x<W; x++) { seed(x,0); seed(x,H-1) }
    for (let y=0; y<H; y++) { seed(0,y); seed(W-1,y) }
    while (queue.length) seed(...queue.pop())
  }

  // ── 3. 내부 흰색 섬 제거 ─────────────────────────────────
  // 남은 불투명 흰색 픽셀을 connected component로 그룹화
  const labeled = new Int32Array(W * H).fill(-1)
  let islandCount = 0
  let islandRemoved = 0

  const isWhitePixel = (idx) => {
    const i = idx*4
    return buf[i+3] > 0 &&
      buf[i] > 200 && buf[i+1] > 200 && buf[i+2] > 200 &&
      colorDist(buf[i], buf[i+1], buf[i+2], 255, 255, 255) < WHITE_THRESHOLD
  }

  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      const idx = y*W+x
      if (labeled[idx] !== -1) continue
      if (!isWhitePixel(idx)) continue

      // BFS로 연결 컴포넌트 수집
      const component = []
      const q = [idx]
      labeled[idx] = islandCount
      while (q.length) {
        const cur = q.pop()
        component.push(cur)
        const cx = cur % W, cy = Math.floor(cur / W)
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = cx+dx, ny = cy+dy
          if (nx<0||ny<0||nx>=W||ny>=H) continue
          const nidx = ny*W+nx
          if (labeled[nidx] !== -1) continue
          if (!isWhitePixel(nidx)) continue
          labeled[nidx] = islandCount
          q.push(nidx)
        }
      }

      // 작은 섬이면 투명 처리
      if (component.length <= ISLAND_MAX_SIZE) {
        for (const pidx of component) {
          buf[pidx*4+3] = 0
          islandRemoved++
        }
      }
      islandCount++
    }
  }

  if (!isWhiteBg && islandCount === 0) {
    process.stdout.write(`스킵 (배경 rgb(${Math.round(bgR)},${Math.round(bgG)},${Math.round(bgB)}))\n`)
    return false
  }

  await sharp(buf, { raw: { width:W, height:H, channels:4 } })
    .png()
    .toFile(inputPath)

  process.stdout.write(`엣지:${edgeRemoved}px 섬:${islandRemoved}px(${islandCount}개 중 작은 것)\n`)
  return true
}

async function run() {
  const target = process.argv[2]  // 특정 파일만 처리할 경우 경로 지정

  let files
  if (target) {
    files = [path.resolve(target)]
  } else {
    files = fs.readdirSync(SPRITES_DIR, { recursive: true })
      .filter(f => f.endsWith('.png'))
      .map(f => path.join(SPRITES_DIR, f))
  }

  console.log(`총 ${files.length}개 스프라이트 처리 (ISLAND_MAX=${ISLAND_MAX_SIZE})\n`)
  let processed = 0

  for (const file of files) {
    const rel = path.relative(SPRITES_DIR, file)
    process.stdout.write(`  ${rel} ... `)
    const changed = await removeBg(file)
    if (changed) processed++
  }

  console.log(`\n완료: ${processed}/${files.length}개 처리`)
}

run().catch(e => { console.error('💥', e.message); process.exit(1) })
