import Phaser from 'phaser'

const MCOLS = 7
const MROWS = 7
const MERGE_CHAIN = ['flower', 'shell', 'star', 'diamond', 'heart', 'ticket', 'camera', 'tag']
const TILE_FILES: Record<string, string> = {
  flower:  'assets/merge_tiles/tile_r0_c0.png',
  shell:   'assets/merge_tiles/tile_r0_c1.png',
  star:    'assets/merge_tiles/tile_r0_c2.png',
  diamond: 'assets/merge_tiles/tile_r0_c3.png',
  heart:   'assets/merge_tiles/tile_r0_c4.png',
  ticket:  'assets/merge_tiles/tile_r2_c5.png',
  camera:  'assets/merge_tiles/tile_r2_c6.png',
  tag:     'assets/merge_tiles/tile_r0_c5.png',
}

interface MergeCell {
  key: string | null
  sprite: Phaser.GameObjects.Image | null
  row: number
  col: number
}

export class MergeScene extends Phaser.Scene {
  private grid: MergeCell[][] = []
  private cellSize = 0
  private gridX = 0
  private gridY = 0

  // 타일 드래그
  private dragCell: MergeCell | null = null
  private dragSprite: Phaser.GameObjects.Image | null = null

  // 요술단지
  private jarSprite!: Phaser.GameObjects.Image
  private jarDragging = false
  private jarDragStartX = 0
  private jarDragStartY = 0
  private jarDragStartTime = 0

  constructor() { super('MergeScene') }

  preload() {
    for (const [key, path] of Object.entries(TILE_FILES)) {
      this.load.image(key, path)
    }
    this.load.image('merge-bg', 'assets/screens/4_home_bg.png')
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    this.sys.game.canvas.style.zIndex = '11'
    document.getElementById('merge-screen')!.classList.add('visible')
    this.cameras.main.fadeIn(300, 0, 0, 0)
    document.getElementById('merge-close-btn')?.addEventListener('click', () => this.goBack())

    this.add.image(W / 2, H / 2, 'merge-bg').setDisplaySize(W, H).setDepth(0)

    // ── 레이아웃 계산 ──
    const topH    = 108
    const middleH = Math.min(200, Math.floor(H * 0.27))
    const padX    = 8
    const padY    = 6
    const botPad  = 10

    const cellByW = Math.floor((W - padX * 2) / MCOLS)
    const cellByH = Math.floor((H - topH - middleH - padY - botPad) / MROWS)
    this.cellSize = Math.min(cellByW, cellByH)

    const boardW = this.cellSize * MCOLS
    const boardH = this.cellSize * MROWS
    this.gridX   = Math.floor((W - boardW) / 2)
    this.gridY   = topH + middleH + padY

    this.drawGridCard(boardW, boardH)
    this.initGrid()
    this.createJarTexture()
    this.createJar(boardW, boardH)
    this.seedInitialItems()

    // ── 전역 포인터 이벤트 ──
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.jarDragging) {
        const cell = this.getCellAt(ptr.x, ptr.y)
        if (cell) {
          const cx = this.gridX + cell.col * this.cellSize + this.cellSize / 2
          const cy = this.gridY + cell.row * this.cellSize + this.cellSize / 2
          this.jarSprite.setPosition(cx, cy)
        }
      } else if (this.dragSprite) {
        this.dragSprite.setPosition(ptr.x, ptr.y)
      }
    })

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (this.jarDragging) {
        this.resolveJarInteraction(ptr)
      } else {
        this.onPointerUp(ptr)
      }
    })
  }

  update(_t: number, _dt: number) {
    // no-op (cooldown removed)
  }

  // ── 요술단지 텍스처 생성 ──
  private createJarTexture() {
    const size = 64
    const g = this.make.graphics({ x: 0, y: 0 })

    // 항아리 몸통 (분홍 그라데이션 느낌을 단색으로 근사)
    g.fillStyle(0xffa0c8, 1)
    g.fillEllipse(size / 2, size * 0.62, size * 0.72, size * 0.58)

    // 항아리 목
    g.fillStyle(0xffb8d8, 1)
    g.fillRoundedRect(size * 0.3, size * 0.22, size * 0.4, size * 0.28, 6)

    // 항아리 입구 (타원)
    g.fillStyle(0xffd0e8, 1)
    g.fillEllipse(size / 2, size * 0.22, size * 0.46, size * 0.16)

    // 반짝이 강조 (흰색 하이라이트)
    g.fillStyle(0xffffff, 0.55)
    g.fillEllipse(size * 0.36, size * 0.48, size * 0.14, size * 0.22)

    // 별 ✨ 텍스트는 generateTexture 이후 별도 Text로 처리

    g.generateTexture('magic-jar', size, size)
    g.destroy()
  }

  // ── 요술단지 스프라이트 생성 ──
  private createJar(_boardW: number, _boardH: number) {
    const size = this.cellSize - 10
    const initX = this.gridX + (MCOLS - 0.5) * this.cellSize - this.cellSize / 2
    const initY = this.gridY + (MROWS - 0.5) * this.cellSize - this.cellSize / 2

    this.jarSprite = this.add.image(initX, initY, 'magic-jar')
      .setDisplaySize(size, size)
      .setDepth(9)
      .setInteractive({ useHandCursor: true })

    // 연속 스트레치 애니메이션
    const sx = this.jarSprite.scaleX
    const sy = this.jarSprite.scaleY
    this.tweens.add({
      targets: this.jarSprite,
      scaleX: sx * 1.12,
      scaleY: sy * 0.90,
      duration: 750,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    })

    this.jarSprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.jarDragging    = true
      this.jarDragStartX  = ptr.x
      this.jarDragStartY  = ptr.y
      this.jarDragStartTime = Date.now()
      this.jarSprite.setDepth(15)
    })
  }

  private resolveJarInteraction(ptr: Phaser.Input.Pointer) {
    this.jarDragging = false
    this.jarSprite.setDepth(9)

    const dx = ptr.x - this.jarDragStartX
    const dy = ptr.y - this.jarDragStartY
    const dt = Date.now() - this.jarDragStartTime

    if (Math.sqrt(dx * dx + dy * dy) < 10 && dt < 300) {
      // 탭 → 아이템 생성
      this.spawnFromJar()
    } else {
      // 드래그 종료 → 마지막 셀에 스냅
      const cell = this.getCellAt(ptr.x, ptr.y)
      if (cell) {
        const cx = this.gridX + cell.col * this.cellSize + this.cellSize / 2
        const cy = this.gridY + cell.row * this.cellSize + this.cellSize / 2
        this.jarSprite.setPosition(cx, cy)
      }
    }
  }

  private spawnFromJar() {
    const empty: MergeCell[] = []
    for (let r = 0; r < MROWS; r++)
      for (let c = 0; c < MCOLS; c++)
        if (!this.grid[r][c].key) empty.push(this.grid[r][c])
    if (empty.length === 0) return

    const cell = empty[Math.floor(Math.random() * empty.length)]
    this.placeItem(cell.row, cell.col, MERGE_CHAIN[0], true)
  }

  // ── 그리드 카드 배경 (균일 격자) ──
  private drawGridCard(boardW: number, boardH: number) {
    const g = this.add.graphics().setDepth(1)
    const x = this.gridX - 8, y = this.gridY - 6
    const w = boardW + 16,    h = boardH + 12

    g.fillStyle(0xb060a0, 0.10)
    g.fillRoundedRect(x + 3, y + 5, w, h, 18)
    g.fillStyle(0xfff0f8, 0.93)
    g.fillRoundedRect(x, y, w, h, 18)
    g.lineStyle(2, 0xffb0d4, 0.7)
    g.strokeRoundedRect(x, y, w, h, 18)

    const pad = 3, r = 7
    for (let row = 0; row < MROWS; row++) {
      for (let col = 0; col < MCOLS; col++) {
        const cx = this.gridX + col * this.cellSize + pad
        const cy = this.gridY + row * this.cellSize + pad
        const s  = this.cellSize - pad * 2
        g.fillStyle(0xffeef8, 0.75)
        g.fillRoundedRect(cx, cy, s, s, r)
        g.lineStyle(1, 0xffcce4, 0.6)
        g.strokeRoundedRect(cx, cy, s, s, r)
      }
    }
  }

  // ── 그리드 초기화 ──
  private initGrid() {
    this.grid = []
    for (let r = 0; r < MROWS; r++) {
      this.grid[r] = []
      for (let c = 0; c < MCOLS; c++) {
        this.grid[r][c] = { key: null, sprite: null, row: r, col: c }
        const cx   = this.gridX + c * this.cellSize + this.cellSize / 2
        const cy   = this.gridY + r * this.cellSize + this.cellSize / 2
        const zone = this.add.zone(cx, cy, this.cellSize, this.cellSize)
          .setDepth(5).setInteractive()
        zone.on('pointerdown', () => {
          if (!this.jarDragging) this.onCellDown(r, c)
        })
      }
    }
  }

  // ── 아이템 배치 ──
  private placeItem(row: number, col: number, key: string, animate = false) {
    const cell = this.grid[row][col]
    cell.sprite?.destroy()

    const cx   = this.gridX + col * this.cellSize + this.cellSize / 2
    const cy   = this.gridY + row * this.cellSize + this.cellSize / 2
    const size = this.cellSize - 10

    const sprite = this.add.image(cx, cy, key)
      .setDisplaySize(size, size)
      .setDepth(4)

    cell.key    = key
    cell.sprite = sprite

    if (animate) {
      const sx = sprite.scaleX
      const sy = sprite.scaleY
      sprite.setScale(0)
      this.tweens.add({ targets: sprite, scaleX: sx, scaleY: sy, duration: 260, ease: 'Back.Out' })
    }
  }

  // ── 타일 드래그 시작 ──
  private onCellDown(row: number, col: number) {
    const cell = this.grid[row][col]
    if (!cell.key || !cell.sprite) return

    this.dragCell  = cell
    this.dragSprite = this.add.image(cell.sprite.x, cell.sprite.y, cell.key)
      .setDisplaySize(cell.sprite.displayWidth * 1.12, cell.sprite.displayHeight * 1.12)
      .setDepth(10).setAlpha(0.88)
    cell.sprite.setAlpha(0.25)
  }

  // ── 타일 드래그 해제 ──
  private onPointerUp(ptr: Phaser.Input.Pointer) {
    if (!this.dragCell || !this.dragSprite) return

    this.dragSprite.destroy(); this.dragSprite = null
    this.dragCell.sprite?.setAlpha(1)

    const dst = this.getCellAt(ptr.x, ptr.y)
    const src = this.dragCell
    this.dragCell = null

    if (!dst || (dst.row === src.row && dst.col === src.col)) return

    if (dst.key && dst.key === src.key) {
      this.doMerge(src, dst)
    } else if (!dst.key) {
      this.moveItem(src, dst)
    }
  }

  // ── 포인터 좌표 → 셀 ──
  private getCellAt(x: number, y: number): MergeCell | null {
    const col = Math.floor((x - this.gridX) / this.cellSize)
    const row = Math.floor((y - this.gridY) / this.cellSize)
    if (row < 0 || row >= MROWS || col < 0 || col >= MCOLS) return null
    return this.grid[row][col]
  }

  // ── 머지 ──
  private doMerge(src: MergeCell, dst: MergeCell) {
    const idx = MERGE_CHAIN.indexOf(src.key!)
    if (idx < 0 || idx >= MERGE_CHAIN.length - 1) return

    const nextKey = MERGE_CHAIN[idx + 1]
    src.sprite?.destroy(); src.sprite = null; src.key = null
    dst.sprite?.destroy(); dst.sprite = null; dst.key = null

    this.placeItem(dst.row, dst.col, nextKey, true)
    this.cameras.main.shake(80, 0.004)

    const cx = this.gridX + dst.col * this.cellSize + this.cellSize / 2
    const cy = this.gridY + dst.row * this.cellSize + this.cellSize / 2
    const g  = this.add.graphics().setDepth(8)
    g.fillStyle(0xff88cc, 0.8)
    g.fillCircle(0, 0, this.cellSize * 0.5)
    g.setPosition(cx, cy).setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: g, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 320,
      onComplete: () => g.destroy() })
  }

  // ── 이동 ──
  private moveItem(src: MergeCell, dst: MergeCell) {
    if (!src.key) return
    const key = src.key
    src.sprite?.destroy(); src.sprite = null; src.key = null
    this.placeItem(dst.row, dst.col, key)
    if (dst.sprite) {
      dst.sprite.setScale(dst.sprite.scaleX * 0.88)
      this.tweens.add({ targets: dst.sprite, scaleX: dst.sprite.scaleX / 0.88, scaleY: dst.sprite.scaleY / 0.88, duration: 140, ease: 'Quad.Out' })
    }
  }

  // ── 초기 아이템 배치 ──
  private seedInitialItems() {
    const seeds: [number, number, number][] = [
      [5, 0, 0], [5, 2, 0], [5, 4, 0], [5, 6, 0],
      [4, 1, 0], [4, 3, 0], [4, 5, 0],
      [3, 0, 1], [3, 4, 1],
      [2, 2, 2],
    ]
    for (const [r, c, lvl] of seeds) {
      this.placeItem(r, c, MERGE_CHAIN[lvl])
    }
  }

  private goBack() {
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.sys.game.canvas.style.zIndex = ''
      document.getElementById('merge-screen')!.classList.remove('visible')
      this.scene.start('HomeScene')
    })
  }
}
