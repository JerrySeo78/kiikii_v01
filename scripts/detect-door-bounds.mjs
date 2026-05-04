/**
 * detect-door-bounds.mjs
 * Sharp 픽셀 분석으로 각 문의 색상 범위를 감지 → SVG path 출력
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMG = path.join(ROOT, 'public', 'assets', 'screens', '3_select_member_bg.png')

// 각 문의 색상 범위 (RGB)
const DOORS = [
  {
    member: '수이', color: '#f472b6',
    match: (r, g, b) => r > 200 && g < 140 && b > 140 && r > g + 80  // 핑크
  },
  {
    member: '키아', color: '#a78bfa',
    match: (r, g, b) => r > 130 && r < 210 && g < 150 && b > 180 && b > r + 20  // 보라
  },
  {
    member: '지유', color: '#d4a853',
    // 베이지: 황토색 계열 (r>g>b, 따뜻한 톤)
    match: (r, g, b) => r > 180 && g > 140 && g < 200 && b > 90 && b < 160 && r > g && g > b + 40
  },
  {
    member: '하음', color: '#fb923c',
    match: (r, g, b) => r > 200 && g > 100 && g < 180 && b < 80 && r > g + 50  // 오렌지
  },
  {
    member: '이슬', color: '#c084fc',
    match: (r, g, b) => r > 150 && r < 220 && g < 150 && b > 200 && b > r + 20  // 라벤더
  },
]

// 픽셀이 해당 범위에 많이 몰려 있는 열/행의 바운딩 박스 계산
function detectBounds(pixels, width, height, matchFn, minDensity = 0.05) {
  const rowHits = new Array(height).fill(0)
  const colHits = new Array(width).fill(0)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      if (matchFn(pixels[i], pixels[i+1], pixels[i+2])) {
        rowHits[y]++
        colHits[x]++
      }
    }
  }

  const rowThresh = width * minDensity
  const colThresh = height * minDensity

  const rows = rowHits.map((v, i) => [i, v]).filter(([, v]) => v > rowThresh)
  const cols = colHits.map((v, i) => [i, v]).filter(([, v]) => v > colThresh)

  if (!rows.length || !cols.length) return null

  const y1 = rows[0][0], y2 = rows[rows.length - 1][0]
  const x1 = cols[0][0], x2 = cols[cols.length - 1][0]
  return { x1, y1, x2, y2 }
}

async function run() {
  const { data, info } = await sharp(IMG)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const W = info.width, H = info.height
  console.log(`이미지 크기: ${W}×${H}`)

  const results = []

  for (const door of DOORS) {
    const bounds = detectBounds(data, W, H, door.match)
    if (!bounds) {
      console.warn(`⚠️  ${door.member}: 감지 실패`)
      continue
    }

    const { x1, y1, x2, y2 } = bounds
    const doorW = x2 - x1
    // arch 반경: 문 너비의 약 40% (반원형 아치)
    const archRadius = Math.round(doorW * 0.40)

    console.log(`${door.member}: x(${x1}~${x2}) y(${y1}~${y2}) w=${doorW} archR=${archRadius}`)
    results.push({ member: door.member, color: door.color, x1, y1, x2, y2, archRadius })
  }

  console.log('\n--- SVG paths ---')
  results.forEach(({ member, color, x1, y1, x2, y2, archRadius: r }) => {
    const d =
      `M${x1 + r},${y1} ` +
      `Q${x1},${y1} ${x1},${y1 + r} ` +
      `L${x1},${y2} L${x2},${y2} ` +
      `L${x2},${y1 + r} ` +
      `Q${x2},${y1} ${x2 - r},${y1} Z`

    console.log(`\n<!-- ${member} -->`)
    console.log(`<path class="member-zone" data-member="${member}" d="${d}"/>`)
    console.log(`/* stroke: ${color} */`)
  })

  fs.writeFileSync(
    path.join(ROOT, 'scripts', 'door-bounds.json'),
    JSON.stringify(results, null, 2)
  )
  console.log('\n✅ 완료: scripts/door-bounds.json')
}

run().catch(e => { console.error('💥', e.message); process.exit(1) })
