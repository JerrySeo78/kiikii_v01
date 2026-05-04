import Phaser from 'phaser'

const MEMBER_FILE: Record<string, string> = {
  '수이': 'sui',
  '키아': 'kya',
  '지유': 'jiyu',
  '하음': 'haum',
  '이슬': 'leesol',
}

const WALK_LINES = [
  '어디 가는 거예요? 🎀',
  '저도 같이 가요! ✨',
  '잠깐만요, 기다려요~',
  '뛰지 말아요, 다쳐요! 💕',
  '빨리빨리~ 🏃‍♀️',
]

const IDLE_LINES = [
  '오늘은 어떤 스타일로 꾸밀까요? 🎀',
  '같이 노래 불러요! 🎤',
  '여기가 제 방이에요~ ✨',
  '배고프지 않아요? 🍡',
  '오늘 하루 어땠어요? 💌',
  '저만 바라봐요! 💕',
]

export class RoomScene extends Phaser.Scene {
  private charLeft = 50   // % from left
  private charBottom = 32 // % from bottom
  private isMoving = false
  private fileKey = 'sui'
  private moveTimer?: ReturnType<typeof setTimeout>
  private idleTimer?: ReturnType<typeof setTimeout>
  private idleLineIdx = 0

  constructor() { super('RoomScene') }

  create(data: { member?: string }) {
    const screen = document.getElementById('room-screen')!
    screen.classList.add('visible')
    this.cameras.main.fadeIn(400, 0, 0, 0)

    const memberName = data?.member ?? '수이'
    this.fileKey = MEMBER_FILE[memberName] ?? 'sui'

    const nameEl = document.getElementById('room-member-name')
    if (nameEl) nameEl.textContent = memberName

    // 캐릭터 초기 위치·이미지
    const character = document.getElementById('room-character') as HTMLDivElement
    character.style.left = `${this.charLeft}%`
    character.style.bottom = `${this.charBottom}%`
    character.style.transform = 'translateX(-50%)'
    this.setIdleSprite(character)

    // 말풍선 초기 위치
    const bubble = document.getElementById('room-bubble')!
    bubble.style.left = `${this.charLeft}%`
    bubble.style.bottom = `${this.charBottom + 18}%`

    this.setupTabs()
    this.setupButtons(memberName)
    this.setupClickMove(screen, character)
    this.startIdleTimer()
  }

  private setIdleSprite(el: HTMLDivElement) {
    el.style.backgroundImage = `url('assets/characters/originals/${this.fileKey}.png')`
    el.style.backgroundSize = 'contain'
    el.style.backgroundPositionX = ''
    el.style.animation = ''
  }

  private setWalkSprite(el: HTMLDivElement, direction: 'front' | 'back' | 'side', flip: boolean) {
    const spriteMap = {
      front: `assets/characters/sprites/${this.fileKey}/${this.fileKey}_walk_front_3f.png`,
      back:  `assets/characters/sprites/${this.fileKey}/${this.fileKey}_back_walk_up_3f.png`,
      side:  `assets/characters/sprites/${this.fileKey}/${this.fileKey}_walk_side_3f.png`,
    }
    el.style.backgroundImage = `url('${spriteMap[direction]}')`
    el.style.backgroundSize = 'auto 100%'
    el.style.backgroundPositionX = '0%'
    el.style.animation = 'room-walk 0.45s steps(3) infinite'
    el.style.transform = flip ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)'
  }

  private setupClickMove(screen: HTMLElement, character: HTMLDivElement) {
    // UI 영역 클릭은 무시
    const ignoreIds = ['room-header','room-member-card','room-reward-btn',
                       'room-actions','room-panel','room-bubble']

    screen.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (ignoreIds.some(id => target.closest(`#${id}`))) return

      const rect = screen.getBoundingClientRect()
      const clickLeftPct  = (e.clientX - rect.left)  / rect.width  * 100
      const clickBottomPct = (rect.bottom - e.clientY) / rect.height * 100

      const dx = clickLeftPct  - this.charLeft
      const dy = clickBottomPct - this.charBottom
      const dist = Math.sqrt(dx*dx + dy*dy)
      if (dist < 3) return

      // 방향 판단
      const isHorizontal = Math.abs(dx) > Math.abs(dy)
      let direction: 'front' | 'back' | 'side'
      if (isHorizontal) {
        direction = 'side'
      } else {
        direction = dy > 0 ? 'back' : 'front'  // 위로가면 뒷모습, 아래로가면 앞모습
      }
      const flip = dx > 0  // 스프라이트가 왼쪽 방향이므로 오른쪽 이동 시 반전

      this.setWalkSprite(character, direction, flip)

      const duration = Math.max(400, dist * 70)

      character.style.transition = `left ${duration}ms linear, bottom ${duration}ms linear`
      character.style.left   = `${clickLeftPct}%`
      character.style.bottom = `${clickBottomPct}%`

      // 말풍선 따라다니기
      const bubble = document.getElementById('room-bubble')!
      bubble.style.transition = `left ${duration}ms linear, bottom ${duration}ms linear`
      bubble.style.left   = `${clickLeftPct}%`
      bubble.style.bottom = `${clickBottomPct + 18}%`
      this.showBubble(WALK_LINES[Math.floor(Math.random() * WALK_LINES.length)])

      this.charLeft   = clickLeftPct
      this.charBottom = clickBottomPct
      this.isMoving   = true

      clearTimeout(this.moveTimer)
      clearTimeout(this.idleTimer)
      this.moveTimer = setTimeout(() => {
        character.style.transition = ''
        bubble.style.transition = ''
        this.setIdleSprite(character)
        this.isMoving = false
        this.startIdleTimer()
      }, duration)
    })
  }

  private setupTabs() {
    document.querySelectorAll<HTMLElement>('.room-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.room-tab').forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        this.tapPop(tab)
      })
    })
  }

  private setupButtons(memberName: string) {
    document.getElementById('room-back-btn')?.addEventListener('click', () => {
      const screen = document.getElementById('room-screen')!
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.time.delayedCall(300, () => {
        screen.classList.remove('visible')
        this.scene.start('HomeScene', { member: memberName })
      })
    })

    const tapTargets = [
      '#room-back-btn', '#room-help-btn', '#room-reward-btn',
      '.room-action-item', '.room-bottom-btn', '.room-tab',
    ]
    tapTargets.forEach(sel => {
      document.querySelectorAll<HTMLElement>(sel).forEach(el => {
        el.addEventListener('click', () => this.tapPop(el))
      })
    })
  }

  private showBubble(text: string) {
    const bubble = document.getElementById('room-bubble')!
    bubble.textContent = text
    bubble.style.opacity = '1'
  }

  private startIdleTimer() {
    clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.tickIdleLine(), 4000)
  }

  private tickIdleLine() {
    if (this.isMoving) return
    this.showBubble(IDLE_LINES[this.idleLineIdx % IDLE_LINES.length])
    this.idleLineIdx++
    this.idleTimer = setTimeout(() => this.tickIdleLine(), 5000)
  }

  private tapPop(el: HTMLElement) {
    el.classList.remove('tap-pop')
    void el.offsetWidth
    el.classList.add('tap-pop')
    el.addEventListener('animationend', () => el.classList.remove('tap-pop'), { once: true })
  }
}
