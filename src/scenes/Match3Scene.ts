import Phaser from 'phaser'
import { SoundFX } from '../utils/SoundFX'

const COLS = 7
const ROWS = 7

// 스테이지별 활성 타일 수: 1~5→5종, 6~10→6종, 11~20→7종, 21~30→8종
const ALL_TILE_KEYS = ['m3_flower', 'm3_shell', 'm3_star', 'm3_diamond', 'm3_heart', 'm3_ticket', 'm3_camera', 'm3_tag']
const TILE_FILES: Record<string, string> = {
  m3_flower:  'assets/titles/tile_r0_c0.png',
  m3_shell:   'assets/titles/tile_r0_c1.png',
  m3_star:    'assets/titles/tile_r0_c2.png',
  m3_diamond: 'assets/titles/tile_r0_c3.png',
  m3_heart:   'assets/titles/tile_r0_c4.png',
  m3_ticket:  'assets/titles/tile_r2_c5.png',
  m3_camera:  'assets/titles/tile_r2_c6.png',
  m3_tag:     'assets/titles/tile_r0_c5.png',
}

function getActiveKeys(stage: number): string[] {
  if (stage <= 5)  return ALL_TILE_KEYS.slice(0, 5)
  if (stage <= 10) return ALL_TILE_KEYS.slice(0, 6)
  if (stage <= 20) return ALL_TILE_KEYS.slice(0, 7)
  return ALL_TILE_KEYS
}

// ── 스테이지 데이터 (1~30) ──
interface StageData {
  moves:       number
  targetScore: number   // 3스타 기준
  camera:      number
  ticket:      number
}

function buildStages(): StageData[] {
  const stages: StageData[] = []
  for (let i = 1; i <= 30; i++) {
    const t = (i - 1) / 29   // 0→1 선형 보간
    stages.push({
      moves:       Math.round(35 - t * 10),        // 35→25
      targetScore: Math.round(300 + t * 4700),     // 300→5000
      camera:      Math.round(6  + t * 14),        // 6→20
      ticket:      Math.round(6  + t * 14),        // 6→20
    })
  }
  return stages
}
const STAGES = buildStages()
let CURRENT_STAGE = 1

interface TileObj {
  key: string
  sprite: Phaser.GameObjects.Image
  row: number
  col: number
}

export class Match3Scene extends Phaser.Scene {
  private board: (TileObj | null)[][] = []
  private tileSize = 0
  private boardX = 0
  private boardY = 0
  private movesLeft = 0
  private score = 0
  private busy = false
  private missionProgress: number[] = []
  private comboCount = 0
  private missions: { key: string; label: string; target: number }[] = []

  constructor() { super('Match3Scene') }

  preload() {
    for (const [key, path] of Object.entries(TILE_FILES)) {
      this.load.image(key, path)
    }
    this.load.image('match3-bg', 'assets/screens/4_home_bg.png')
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    // 캔버스를 HTML 오버레이(z-index:10) 위로 올려 타일이 보이게 함
    this.sys.game.canvas.style.zIndex = '11'

    document.getElementById('match3-screen')!.classList.add('visible')
    this.cameras.main.fadeIn(300, 0, 0, 0)
    document.getElementById('match3-close-btn')?.addEventListener('click', () => { SoundFX.tick(); this.goBack() })

    this.initStageData()
    this.syncMissionUI()
    this.initStageUI()

    // 파티클용 텍스처 생성
    this.createSparkTexture()

    // 배경 이미지 (canvas에 직접 그림)
    this.add.image(W / 2, H / 2, 'match3-bg')
      .setDisplaySize(W, H)
      .setDepth(0)

    // HTML 오버레이 높이 (상단바 128 + 중간 270)
    const overlayH = 365
    const cardPad  = 10   // 카드 내부 여백
    const bottomMargin = 20

    // 타일 크기: 가용 공간을 계산하되 최대 74px로 제한
    const maxTileW = Math.floor((W - cardPad * 2 - 16) / COLS)
    const maxTileH = Math.floor((H - overlayH - cardPad * 2 - bottomMargin) / ROWS)
    this.tileSize  = Math.min(maxTileW, maxTileH, 74)

    const boardW = this.tileSize * COLS
    const boardH = this.tileSize * ROWS
    this.boardX  = Math.floor((W - boardW) / 2)
    this.boardY  = overlayH + cardPad

    // 카드 배경 → 보드 배경 → 타일 순서
    this.drawBoardCard(boardW, boardH, cardPad)
    this.drawBoardBg(boardW, boardH)
    this.initBoard()
  }

  // ── 미션 UI 동기화 ──
  // ── 스파클 텍스처 (소프트 원) 생성 ──
  private createSparkTexture() {
    if (this.textures.exists('spark')) return
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    // 중심이 밝고 가장자리가 부드럽게 사라지는 원
    for (let r = 8; r >= 1; r--) {
      g.fillStyle(0xffffff, r / 8)
      g.fillCircle(8, 8, r)
    }
    g.generateTexture('spark', 16, 16)
    g.destroy()
  }

  // ── 광원 이펙트 (가산 블렌딩 글로우 + 소량 스파클) ──
  private spawnGlowEffect(x: number, y: number, combo: number) {
    const glowColor = combo >= 5 ? 0xffd700   // 골드
                    : combo >= 4 ? 0x44ccff   // 하늘
                    : combo >= 3 ? 0xcc44ff   // 보라
                    : 0xff44aa                // 핫핑크

    // ① 메인 글로우
    const g = this.add.graphics()
    g.fillStyle(glowColor, 0.9)
    g.fillCircle(0, 0, this.tileSize * 0.38)
    g.setPosition(x, y).setDepth(52)
    g.setBlendMode(Phaser.BlendModes.ADD)

    this.tweens.add({
      targets: g,
      scaleX: 1.6, scaleY: 1.6, alpha: 0,
      duration: 200, ease: 'Quad.Out',
      onComplete: () => g.destroy()
    })

    // ② 보조 글로우
    const g2 = this.add.graphics()
    g2.fillStyle(0xffffff, 0.35)
    g2.fillCircle(0, 0, this.tileSize * 0.25)
    g2.setPosition(x, y).setDepth(51)
    g2.setBlendMode(Phaser.BlendModes.ADD)

    this.tweens.add({
      targets: g2,
      scaleX: 2.2, scaleY: 2.2, alpha: 0,
      duration: 280, ease: 'Quad.Out',
      onComplete: () => g2.destroy()
    })

    // ③ 소량 스파클 (4개) — 빛이 튀는 느낌
    const emitter = this.add.particles(x, y, 'spark', {
      speed:    { min: 30, max: 110 },
      angle:    { min: 0,  max: 360 },
      scale:    { start: 0.7, end: 0 },
      alpha:    { start: 1,   end: 0 },
      lifespan: 380,
      tint:     glowColor,
      quantity: 4,
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    })
    emitter.setDepth(53)
    emitter.explode(4)
    this.time.delayedCall(450, () => emitter.destroy())
  }

  // ── 콤보 텍스트 (콤보 수에 따라 점점 커짐) ──
  private showComboText(combo: number, cy: number) {
    const W = this.scale.width
    const fontSize = Math.min(28 + (combo - 2) * 10, 64)
    const strokeW  = Math.min(4 + combo, 9)
    const color    = combo >= 5 ? '#ffd700'   // 골드
                   : combo >= 4 ? '#44ccff'   // 하늘
                   : combo >= 3 ? '#cc44ff'   // 보라
                   : '#ff44aa'                // 핫핑크

    const text = this.add.text(W / 2, cy, `${combo} COMBO!`, {
      fontSize: `${fontSize}px`,
      fontStyle: 'bold italic',
      color,
      stroke: '#ffffff',
      strokeThickness: strokeW,
      shadow: { offsetX: 0, offsetY: 2, color: '#00000066', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(55).setScale(0.2)

    // 팡 하고 튀어나옴
    this.tweens.add({
      targets: text, scaleX: 1, scaleY: 1,
      duration: 280, ease: 'Back.Out'
    })
    // 잠시 후 위로 사라짐
    this.tweens.add({
      targets: text, y: cy - 70, alpha: 0,
      delay: 550, duration: 380, ease: 'Quad.In',
      onComplete: () => text.destroy()
    })

    // 화면 살짝 흔들어 임팩트
    if (combo >= 3) this.cameras.main.shake(120, 0.005 * Math.min(combo - 1, 4))
  }

  // ── 스테이지 UI 초기화 ──
  private initStageUI() {
    const stage = STAGES[CURRENT_STAGE - 1]
    const stageNumEl = document.getElementById('m3-stage-num')
    if (stageNumEl) stageNumEl.textContent = `${CURRENT_STAGE}`

    // 목표 점수 표시
    const targetEl = document.getElementById('m3-target-score')
    if (targetEl) targetEl.textContent = stage.targetScore.toLocaleString()

    // 이동수 초기화
    const movesEl = document.getElementById('m3-moves')
    if (movesEl) movesEl.textContent = `${stage.moves}`

    // 스코어 초기화
    const scoreEl = document.getElementById('m3-score')
    if (scoreEl) scoreEl.textContent = '0'
  }

  // ── 스테이지 데이터 초기화 (create 및 스테이지 전환 시 공통) ──
  private initStageData() {
    const stage = STAGES[CURRENT_STAGE - 1]
    this.movesLeft = stage.moves
    this.score = 0
    this.comboCount = 0
    this.missions = [
      { key: 'm3_camera', label: '카메라', target: stage.camera },
      { key: 'm3_ticket', label: '티켓',   target: stage.ticket },
    ]
    this.missionProgress = [0, 0]
  }

  private syncMissionUI() {
    const cameraEl = document.getElementById('m3-mission-camera')
    const ticketEl  = document.getElementById('m3-mission-ticket')
    if (cameraEl) cameraEl.textContent = `${Math.max(0, this.missions[0].target - this.missionProgress[0])}`
    if (ticketEl)  ticketEl.textContent  = `${Math.max(0, this.missions[1].target - this.missionProgress[1])}`
  }

  // ── 별 업데이트 (스테이지 목표점수 기준: 40% / 70% / 100%) ──
  private updateStars() {
    const target = STAGES[CURRENT_STAGE - 1].targetScore
    const thresholds = [target * 0.4, target * 0.7, target]
    thresholds.forEach((t, i) => {
      const el = document.getElementById(`m3-star-${i + 1}`)
      if (!el) return
      if (this.score >= t) el.classList.add('active')
      else el.classList.remove('active')
    })
  }

  // ── 카드 배경 (둥근 반투명 패널) ──
  private drawBoardCard(boardW: number, boardH: number, pad: number) {
    const g = this.add.graphics().setDepth(2)
    const x = this.boardX - pad
    const y = this.boardY - pad
    const w = boardW + pad * 2
    const h = boardH + pad * 2
    const r = 20

    // 드롭 섀도
    g.fillStyle(0xb060a0, 0.18)
    g.fillRoundedRect(x + 3, y + 6, w, h, r)

    // 카드 본체 (반투명 흰-핑크)
    g.fillStyle(0xfff0f8, 0.86)
    g.fillRoundedRect(x, y, w, h, r)

    // 테두리
    g.lineStyle(2.5, 0xff9ec8, 0.75)
    g.strokeRoundedRect(x, y, w, h, r)
  }

  // ── 보드 셀 배경 ──
  private drawBoardBg(boardW: number, boardH: number) {
    void boardW; void boardH
    for (let row = 0; row < ROWS; row++) {
      for (let c = 0; c < COLS; c++) {
        const color = (row + c) % 2 === 0 ? 0xf0e0f8 : 0xe8d0f0
        this.add.rectangle(
          this.boardX + c * this.tileSize + 1,
          this.boardY + row * this.tileSize + 1,
          this.tileSize - 2, this.tileSize - 2,
          color
        ).setOrigin(0).setAlpha(0.6).setDepth(3)
      }
    }
  }

  // ── 보드 초기화 ──
  private initBoard() {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.createTile(r, c, this.safeRandomKey(r, c))
      }
    }
    while (this.findMatches().length > 0) {
      const set = new Set(this.findMatches().flat())
      this.removeMatchSet(set, false)
      this.refillInstant()
    }
  }

  // ── 그룹 방향 판별 ──
  private isHorizontalGroup(g: TileObj[]): boolean {
    return g.length >= 2 && g[0].row === g[1].row
  }

  // ── 특수 매치 분류 ──
  // 4H→행 전체, 4V→열 전체, 3H+3V 교차→3×3 폭발, 5+→랜덤 타입 폭탄
  private classifyMatches(groups: TileObj[][]): {
    toRemove: Set<TileObj>
    rowClears: number[]
    colClears: number[]
    explosions: { row: number; col: number }[]
    bombType: string
  } {
    const toRemove = new Set<TileObj>()
    const rowClears: number[] = []
    const colClears: number[] = []
    const explosions: { row: number; col: number }[] = []
    let hasBomb = false
    let bombType = ''

    // L/T 감지: 길이3 가로×세로 교차점
    const h3 = groups.filter(g => this.isHorizontalGroup(g) && g.length === 3)
    const v3 = groups.filter(g => !this.isHorizontalGroup(g) && g.length === 3)
    const usedAsLT = new Set<TileObj[]>()

    for (const hg of h3) {
      for (const vg of v3) {
        const shared = hg.find(ht => vg.some(vt => vt.row === ht.row && vt.col === ht.col))
        if (shared && !usedAsLT.has(hg) && !usedAsLT.has(vg)) {
          usedAsLT.add(hg); usedAsLT.add(vg)
          explosions.push({ row: shared.row, col: shared.col })
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const nr = shared.row + dr, nc = shared.col + dc
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                const t = this.board[nr][nc]; if (t) toRemove.add(t)
              }
            }
        }
      }
    }

    for (const g of groups) {
      if (usedAsLT.has(g)) continue
      const isH = this.isHorizontalGroup(g)
      if (g.length >= 5) {
        hasBomb = true
        g.forEach(t => toRemove.add(t))
      } else if (g.length === 4 && isH) {
        const row = g[0].row
        if (!rowClears.includes(row)) {
          rowClears.push(row)
          for (let c = 0; c < COLS; c++) { const t = this.board[row][c]; if (t) toRemove.add(t) }
        }
      } else if (g.length === 4 && !isH) {
        const col = g[0].col
        if (!colClears.includes(col)) {
          colClears.push(col)
          for (let r = 0; r < ROWS; r++) { const t = this.board[r][col]; if (t) toRemove.add(t) }
        }
      } else {
        g.forEach(t => toRemove.add(t))
      }
    }

    if (hasBomb) {
      const types = new Set<string>()
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (this.board[r][c]) types.add(this.board[r][c]!.key)
      const arr = [...types]
      bombType = arr[Math.floor(Math.random() * arr.length)]
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const t = this.board[r][c]
          if (t && t.key === bombType) toRemove.add(t)
        }
    }

    return { toRemove, rowClears, colClears, explosions, bombType }
  }

  // ── 특수 효과 비주얼 ──
  private spawnSpecialEffects(
    rowClears: number[], colClears: number[],
    explosions: { row: number; col: number }[],
    bombType: string
  ) {
    const W = this.scale.width
    const boardW = this.tileSize * COLS
    const boardH = this.tileSize * ROWS

    if (rowClears.length > 0 || colClears.length > 0) SoundFX.lineClear()
    if (explosions.length > 0) SoundFX.boom()
    for (const row of rowClears) {
      const y = this.boardY + row * this.tileSize + this.tileSize / 2
      const g = this.add.graphics().setDepth(56)
      g.fillStyle(0xff88cc, 0.8)
      g.fillRect(this.boardX, y - this.tileSize / 2, boardW, this.tileSize)
      g.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() })
      const t = this.add.text(W / 2, y, 'LINE CLEAR!', {
        fontSize: '17px', fontStyle: 'bold', color: '#fff', stroke: '#cc2288', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(57)
      this.tweens.add({ targets: t, y: y - 48, alpha: 0, delay: 180, duration: 450, onComplete: () => t.destroy() })
    }

    for (const col of colClears) {
      const x = this.boardX + col * this.tileSize + this.tileSize / 2
      const g = this.add.graphics().setDepth(56)
      g.fillStyle(0x88ccff, 0.8)
      g.fillRect(x - this.tileSize / 2, this.boardY, this.tileSize, boardH)
      g.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() })
      const t = this.add.text(x, this.boardY + boardH / 2, 'LINE CLEAR!', {
        fontSize: '17px', fontStyle: 'bold', color: '#fff', stroke: '#2288cc', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(57).setAngle(-90)
      this.tweens.add({ targets: t, alpha: 0, delay: 180, duration: 450, onComplete: () => t.destroy() })
    }

    for (const ex of explosions) {
      const x = this.boardX + ex.col * this.tileSize + this.tileSize / 2
      const y = this.boardY + ex.row * this.tileSize + this.tileSize / 2
      const g = this.add.graphics().setDepth(56)
      g.fillStyle(0xffcc44, 0.9)
      g.fillCircle(0, 0, this.tileSize * 1.6)
      g.setPosition(x, y).setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({ targets: g, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 400, onComplete: () => g.destroy() })
      this.cameras.main.shake(180, 0.012)
      const t = this.add.text(x, y, 'BOOM!', {
        fontSize: '22px', fontStyle: 'bold italic', color: '#ffee44', stroke: '#aa4400', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(57)
      this.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 100, duration: 550, onComplete: () => t.destroy() })
    }

    if (bombType) {
      const cy = this.boardY + boardH / 2
      const t = this.add.text(W / 2, cy, 'ALL CLEAR!', {
        fontSize: '26px', fontStyle: 'bold italic', color: '#ffd700', stroke: '#7700cc', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(57).setScale(0.2)
      this.tweens.add({ targets: t, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.Out' })
      this.tweens.add({ targets: t, y: cy - 80, alpha: 0, delay: 600, duration: 500, onComplete: () => t.destroy() })
      this.cameras.main.shake(280, 0.015)
    }
  }

  private safeRandomKey(row: number, col: number): string {
    let key: string
    let tries = 0
    do {
      key = getActiveKeys(CURRENT_STAGE)[Phaser.Math.Between(0, getActiveKeys(CURRENT_STAGE).length - 1)]
      tries++
    } while (tries < 20 && this.wouldMatch(row, col, key))
    return key
  }

  private wouldMatch(row: number, col: number, key: string): boolean {
    if (col >= 2 &&
        this.board[row][col - 1]?.key === key &&
        this.board[row][col - 2]?.key === key) return true
    if (row >= 2 &&
        this.board[row - 1]?.[col]?.key === key &&
        this.board[row - 2]?.[col]?.key === key) return true
    return false
  }

  private createTile(row: number, col: number, key: string, fromTop = false): TileObj {
    const x = this.boardX + col * this.tileSize + this.tileSize / 2
    const y = fromTop
      ? this.boardY - this.tileSize
      : this.boardY + row * this.tileSize + this.tileSize / 2

    const sprite = this.add.image(x, y, key)
      .setDisplaySize(this.tileSize - 4, this.tileSize - 4)
      .setInteractive({ useHandCursor: true })
      .setDepth(4)

    const tile: TileObj = { key, sprite, row, col }
    this.board[row][col] = tile

    sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onDragStart(tile, ptr))
    sprite.on('pointerover', () => { if (!this.busy) sprite.setAlpha(0.85) })
    sprite.on('pointerout',  () => { if (!this.busy) sprite.setAlpha(1) })

    return tile
  }

  private dragTile: TileObj | null = null
  private dragStartX = 0
  private dragStartY = 0
  private dragThreshold = 12  // px — 이 거리 이상 움직이면 방향 확정
  private dragMoveHandler: ((ptr: Phaser.Input.Pointer) => void) | null = null
  private dragUpHandler: (() => void) | null = null

  private onDragStart(tile: TileObj, ptr: Phaser.Input.Pointer) {
    if (this.busy || this.movesLeft <= 0) return
    this.dragTile = tile
    this.dragStartX = ptr.x
    this.dragStartY = ptr.y
    tile.sprite.setTint(0xffff88)

    // 전역 pointermove / pointerup 리스너 등록
    this.dragMoveHandler = (p: Phaser.Input.Pointer) => this.onDragMove(p)
    this.dragUpHandler   = () => this.onDragCancel()

    this.input.on('pointermove', this.dragMoveHandler)
    this.input.on('pointerup',   this.dragUpHandler)
  }

  private onDragMove(ptr: Phaser.Input.Pointer) {
    if (!this.dragTile) return
    const dx = ptr.x - this.dragStartX
    const dy = ptr.y - this.dragStartY
    if (Math.abs(dx) < this.dragThreshold && Math.abs(dy) < this.dragThreshold) return

    // 방향 결정
    let targetRow = this.dragTile.row
    let targetCol = this.dragTile.col
    if (Math.abs(dx) >= Math.abs(dy)) {
      targetCol += dx > 0 ? 1 : -1
    } else {
      targetRow += dy > 0 ? 1 : -1
    }

    this.removeDragListeners()

    // 범위 체크
    if (targetRow < 0 || targetRow >= ROWS || targetCol < 0 || targetCol >= COLS) {
      this.dragTile.sprite.clearTint()
      this.dragTile = null
      return
    }

    const target = this.board[targetRow][targetCol]
    if (!target) {
      this.dragTile.sprite.clearTint()
      this.dragTile = null
      return
    }

    const src = this.dragTile
    src.sprite.clearTint()
    this.dragTile = null
    this.swapTiles(src, target)
  }

  private onDragCancel() {
    this.removeDragListeners()
    if (this.dragTile) {
      this.dragTile.sprite.clearTint()
      this.dragTile = null
    }
  }

  private removeDragListeners() {
    if (this.dragMoveHandler) { this.input.off('pointermove', this.dragMoveHandler); this.dragMoveHandler = null }
    if (this.dragUpHandler)   { this.input.off('pointerup',   this.dragUpHandler);   this.dragUpHandler   = null }
  }

  private swapTiles(a: TileObj, b: TileObj) {
    this.busy = true
    const ax = a.sprite.x, ay = a.sprite.y
    const bx = b.sprite.x, by = b.sprite.y

    SoundFX.swap()
    this.tweens.add({ targets: a.sprite, x: bx, y: by, duration: 150, ease: 'Quad.Out' })
    this.tweens.add({
      targets: b.sprite, x: ax, y: ay, duration: 150, ease: 'Quad.Out',
      onComplete: () => {
        this.board[a.row][a.col] = b
        this.board[b.row][b.col] = a
        const ar = a.row, ac = a.col
        a.row = b.row; a.col = b.col
        b.row = ar;    b.col = ac

        const matches = this.findMatches()
        if (matches.length === 0) {
          // 원위치 + 흔들기
          this.cameras.main.shake(180, 0.008)
          this.tweens.add({ targets: a.sprite, x: ax, y: ay, duration: 150 })
          this.tweens.add({
            targets: b.sprite, x: bx, y: by, duration: 150,
            onComplete: () => {
              this.board[b.row][b.col] = a
              this.board[a.row][a.col] = b
              const br = b.row, bc = b.col
              b.row = a.row; b.col = a.col
              a.row = br;    a.col = bc
              this.busy = false
            }
          })
        } else {
          this.movesLeft--
          this.comboCount = 0
          const movesEl = document.getElementById('m3-moves')
          if (movesEl) movesEl.textContent = `${this.movesLeft}`
          this.processMatches(matches)
        }
      }
    })
  }

  private findMatches(): TileObj[][] {
    const groups: TileObj[][] = []
    // 가로
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 2; c++) {
        const a = this.board[r][c], b = this.board[r][c+1], cc = this.board[r][c+2]
        if (a && b && cc && a.key === b.key && b.key === cc.key) {
          const g = [a, b, cc]
          let i = c + 3
          while (i < COLS && this.board[r][i]?.key === a.key) g.push(this.board[r][i++]!)
          groups.push(g)
        }
      }
    }
    // 세로
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS - 2; r++) {
        const a = this.board[r][c], b = this.board[r+1][c], cc = this.board[r+2][c]
        if (a && b && cc && a.key === b.key && b.key === cc.key) {
          const g = [a, b, cc]
          let i = r + 3
          while (i < ROWS && this.board[i]?.[c]?.key === a.key) g.push(this.board[i++][c]!)
          groups.push(g)
        }
      }
    }
    return groups
  }

  private processMatches(groups: TileObj[][]) {
    this.comboCount++
    const { toRemove, rowClears, colClears, explosions, bombType } = this.classifyMatches(groups)
    this.spawnSpecialEffects(rowClears, colClears, explosions, bombType)
    this.removeMatchSet(toRemove, true)
    this.time.delayedCall(240, () => {
      this.dropTiles(() => {
        this.time.delayedCall(150, () => {
          this.refillBoard(() => {
            this.time.delayedCall(200, () => {
              const next = this.findMatches()
              if (next.length > 0) {
                this.processMatches(next)
              } else {
                this.busy = false
                if (this.movesLeft <= 0) this.onGameOver()
                else this.checkStageClear()
              }
            })
          })
        })
      })
    })
  }

  private removeMatchSet(toRemove: Set<TileObj>, animate: boolean) {
    const multiplier = this.comboCount
    const gained = toRemove.size * 10 * Math.max(1, multiplier)
    this.score += gained

    let sumX = 0, sumY = 0
    toRemove.forEach(tile => { sumX += tile.sprite.x; sumY += tile.sprite.y })
    const cx = sumX / toRemove.size
    const cy = sumY / toRemove.size

    toRemove.forEach(tile => {
      this.board[tile.row][tile.col] = null
      this.missions.forEach((m, i) => {
        if (tile.key === m.key)
          this.missionProgress[i] = Math.min(m.target, this.missionProgress[i] + 1)
      })
      if (animate) {
        this.tweens.add({
          targets: tile.sprite, scaleX: 1.35, scaleY: 1.35,
          duration: 80, ease: 'Quad.Out',
          onComplete: () => {
            this.tweens.add({
              targets: tile.sprite, scaleX: 0, scaleY: 0, alpha: 0,
              duration: 160, ease: 'Quad.In',
              onComplete: () => tile.sprite.destroy()
            })
          }
        })
      } else {
        tile.sprite.destroy()
      }
    })

    this.syncMissionUI()

    if (animate) {
      SoundFX.pop(multiplier)
      toRemove.forEach(tile => this.spawnGlowEffect(tile.sprite.x, tile.sprite.y, multiplier))
      const floatText = this.add.text(cx, cy, `+${gained}`, {
        fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#5a1060', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(52)
      this.tweens.add({
        targets: floatText, y: cy - 55, alpha: 0,
        duration: 800, ease: 'Quad.Out',
        onComplete: () => floatText.destroy()
      })
      if (multiplier >= 2) this.showComboText(multiplier, cy)
    }

    const scoreEl = document.getElementById('m3-score')
    if (scoreEl) scoreEl.textContent = `${this.score}`
    this.updateStars()
  }

  private dropTiles(onComplete: () => void) {
    let pending = 0
    for (let c = 0; c < COLS; c++) {
      let emptyRow = ROWS - 1
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.board[r][c]) {
          if (emptyRow !== r) {
            const tile = this.board[r][c]!
            this.board[emptyRow][c] = tile
            this.board[r][c] = null
            tile.row = emptyRow
            const targetY = this.boardY + emptyRow * this.tileSize + this.tileSize / 2
            pending++
            this.tweens.add({
              targets: tile.sprite, y: targetY,
              duration: 180 + (emptyRow - r) * 30, ease: 'Quad.In',
              onComplete: () => { pending--; if (pending === 0) onComplete() }
            })
          }
          emptyRow--
        }
      }
    }
    if (pending === 0) onComplete()
  }

  private refillBoard(onComplete?: () => void) {
    let pending = 0
    for (let c = 0; c < COLS; c++) {
      let dropCount = 0
      for (let r = 0; r < ROWS; r++) {
        if (!this.board[r][c]) {
          dropCount++
          const key = getActiveKeys(CURRENT_STAGE)[Phaser.Math.Between(0, getActiveKeys(CURRENT_STAGE).length - 1)]
          const tile = this.createTile(r, c, key, true)
          const targetY = this.boardY + r * this.tileSize + this.tileSize / 2
          pending++
          this.tweens.add({
            targets: tile.sprite, y: targetY,
            duration: 180 + dropCount * 50, ease: 'Bounce.Out',
            onComplete: () => { pending--; if (pending === 0) onComplete?.() }
          })
        }
      }
    }
    if (pending === 0) onComplete?.()
  }

  private refillInstant() {
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        if (!this.board[r][c])
          this.createTile(r, c, getActiveKeys(CURRENT_STAGE)[Phaser.Math.Between(0, getActiveKeys(CURRENT_STAGE).length - 1)])
  }

  private checkStageClear() {
    const target = STAGES[CURRENT_STAGE - 1].targetScore
    if (this.score >= target) this.advanceStage()
  }

  private advanceStage() {
    this.busy = true
    const W = this.scale.width, H = this.scale.height
    const isFinal = CURRENT_STAGE >= 30

    // 큰 클리어 텍스트 (박스 없음)
    const titleStr = isFinal ? 'ALL CLEAR!' : `STAGE ${CURRENT_STAGE}`
    const title = this.add.text(W / 2, H / 2 - 70, titleStr, {
      fontSize: '48px', fontStyle: 'bold italic', color: '#ff4495',
      stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(62).setScale(0)

    const clearTxt = this.add.text(W / 2, H / 2 - 10, 'CLEAR!', {
      fontSize: '36px', fontStyle: 'bold italic', color: '#ffffff',
      stroke: '#ff4495', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(62).setScale(0)

    // 둥근 버튼 — Graphics(배경) + Text(레이블)
    const btnLabel = isFinal ? '처음으로' : '다음 스테이지  >'
    const btnY = H / 2 + 80
    const btnW = 200, btnH = 46, btnR = 23

    const btnBg = this.add.graphics().setDepth(62).setAlpha(0)
    const drawBtn = (color: number) => {
      btnBg.clear()
      btnBg.fillStyle(color, 0.92)
      btnBg.fillRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnR)
    }
    drawBtn(0xffa0c8)

    const btnTxt = this.add.text(W / 2, btnY, btnLabel, {
      fontSize: '17px', fontStyle: 'bold', color: '#ffffff',
      fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    }).setOrigin(0.5).setDepth(63).setAlpha(0)

    // 히트 영역
    const hitZone = this.add.zone(W / 2, btnY, btnW, btnH)
      .setDepth(63).setInteractive({ useHandCursor: true })

    // 등장 애니메이션
    SoundFX.stageClear()
    this.cameras.main.shake(250, 0.01)
    this.tweens.add({ targets: title,    scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.Out' })
    this.tweens.add({ targets: clearTxt, scaleX: 1, scaleY: 1, duration: 420, delay: 150, ease: 'Back.Out' })
    this.tweens.add({ targets: [btnBg, btnTxt], alpha: 1, delay: 500, duration: 300 })

    hitZone.on('pointerover', () => drawBtn(0xffb8d8))
    hitZone.on('pointerout',  () => drawBtn(0xffa0c8))

    const all = [title, clearTxt, btnBg, btnTxt, hitZone]
    hitZone.on('pointerup', () => {
      if (isFinal) { this.goBack(); return }
      CURRENT_STAGE++
      all.forEach(o => o.destroy())
      this.resetForStage()
    })
  }

  private resetForStage() {
    // 보드 전체 제거
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.board[r][c]?.sprite.destroy()

    this.initStageData()
    this.initStageUI()
    this.syncMissionUI()

    // 보드 재생성
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.createTile(r, c, this.safeRandomKey(r, c))
    while (this.findMatches().length > 0) {
      const set = new Set(this.findMatches().flat())
      this.removeMatchSet(set, false)
      this.refillInstant()
    }

    this.busy = false
  }

  private onGameOver() {
    SoundFX.gameOver()
    this.showResult(false)
  }

  private showResult(win: boolean) {
    this.busy = true
    const W = this.scale.width, H = this.scale.height
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(60)
    const panel = this.add.rectangle(W / 2, H / 2, 270, 180, 0x2a0a30)
      .setDepth(61).setStrokeStyle(2, 0xff4495)
    void panel

    this.add.text(W / 2, H / 2 - 48, win ? '🎉 미션 클리어!' : '게임 종료', {
      fontSize: '20px', color: win ? '#ffe066' : '#ff9fd0', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(62)

    this.add.text(W / 2, H / 2 - 10, `스코어: ${this.score}`, {
      fontSize: '16px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(62)

    const retry = this.add.text(W / 2 - 60, H / 2 + 40, '다시하기', {
      fontSize: '14px', color: '#fff',
      backgroundColor: '#ff4495', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(62).setInteractive({ useHandCursor: true })
    retry.on('pointerup', () => this.scene.restart())

    const home = this.add.text(W / 2 + 60, H / 2 + 40, '홈으로', {
      fontSize: '14px', color: '#fff',
      backgroundColor: '#6644aa', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(62).setInteractive({ useHandCursor: true })
    home.on('pointerup', () => this.goBack())
  }

  private goBack() {
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.sys.game.canvas.style.zIndex = ''
      document.getElementById('match3-screen')!.classList.remove('visible')
      this.scene.start('HomeScene')
    })
  }
}
