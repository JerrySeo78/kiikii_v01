import Phaser from 'phaser'

const MEMBER_FILE: Record<string, string> = {
  '수이': 'sui',
  '키아': 'kya',
  '지유': 'jiyu',
  '하음': 'haum',
  '이슬': 'leesol',
}

const MEMBER_TRAIT: Record<string, { icon: string; label: string; bg: string; border: string }> = {
  '수이': { icon: '🌸', label: '청순함', bg: 'rgba(255,220,235,0.88)', border: 'rgba(255,160,200,0.5)' },
  '키아': { icon: '☆',  label: '차분함', bg: 'rgba(225,215,248,0.88)', border: 'rgba(180,160,230,0.5)' },
  '지유': { icon: '♥',  label: '상큼함', bg: 'rgba(255,220,220,0.88)', border: 'rgba(240,160,160,0.5)' },
  '하음': { icon: '♡',  label: '다정함', bg: 'rgba(255,225,200,0.88)', border: 'rgba(240,180,130,0.5)' },
  '이슬': { icon: '♦',  label: '트렌디', bg: 'rgba(210,220,248,0.88)', border: 'rgba(150,170,230,0.5)' },
}

export class HomeScene extends Phaser.Scene {
  constructor() { super('HomeScene') }

  create(data: { member?: string }) {
    const screen = document.getElementById('home-screen')!
    screen.classList.add('visible')
    this.cameras.main.fadeIn(400, 0, 0, 0)

    const memberName = data?.member ?? '수이'
    const fileKey = MEMBER_FILE[memberName] ?? 'sui'

    // 아바타 원
    const avatar = document.getElementById('home-avatar-img') as HTMLDivElement
    avatar.style.backgroundImage = `url('assets/characters/originals/${fileKey}.png')`

    // 중앙 캐릭터 (오리지널 이미지)
    const character = document.getElementById('home-character') as HTMLDivElement
    character.style.backgroundImage = `url('assets/characters/originals/${fileKey}.png')`

    // 친밀도 카드 멤버 이름
    const intimacyName = document.getElementById('intimacy-member-name')
    if (intimacyName) intimacyName.textContent = memberName

    // 멤버 리스트 (선택된 멤버 제외)
    this.setupMemberList(memberName)
    this.setupMemberSelectBtn()
    this.setupRoomBtn(memberName)

    this.setupTapAnimations()
    this.setupTabBar()
  }

  private setupMemberList(_selected: string) {
    const list = document.getElementById('home-member-list')!
    list.innerHTML = ''
    const others = Object.keys(MEMBER_FILE)
    others.forEach(name => {
      const key = MEMBER_FILE[name]
      const trait = MEMBER_TRAIT[name]
      const item = document.createElement('div')
      item.className = 'member-list-item'
      item.style.background = trait.bg
      item.style.borderColor = trait.border
      item.innerHTML = `
        <div class="member-list-thumb" style="background-image:url('assets/characters/originals/${key}.png')"></div>
        <div class="member-list-info">
          <div class="member-list-name">${name}</div>
          <div class="member-list-trait">${trait.icon} ${trait.label}</div>
        </div>
        <div class="member-list-arrow">›</div>
      `
      item.addEventListener('click', () => {
        const character = document.getElementById('home-character') as HTMLDivElement
        character.style.backgroundImage = `url('assets/characters/originals/${key}.png')`
        const intimacyName = document.getElementById('intimacy-member-name')
        if (intimacyName) intimacyName.textContent = name
        this.tapPop(item)
      })
      list.appendChild(item)
    })
  }

  private setupRoomBtn(_memberName: string) {
    const btn = document.querySelector<HTMLElement>('.intimacy-room-btn')
    btn?.addEventListener('click', () => {
      // 클릭 시점의 현재 선택 멤버를 DOM에서 읽음
      const currentMember = document.getElementById('intimacy-member-name')?.textContent ?? '수이'
      const screen = document.getElementById('home-screen')!
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.time.delayedCall(300, () => {
        screen.classList.remove('visible')
        this.scene.start('RoomScene', { member: currentMember })
      })
    })
  }

  private setupMemberSelectBtn() {
    const btn = document.getElementById('home-member-select-btn')!
    const list = document.getElementById('home-member-list')!
    let isOpen = false

    btn.addEventListener('click', () => {
      if (isOpen) {
        list.classList.remove('open')
        list.classList.add('closing')
        setTimeout(() => list.classList.remove('closing'), 400)
      } else {
        list.classList.remove('closing')
        list.classList.add('open')
      }
      isOpen = !isOpen
      this.tapPop(btn)
    })
  }

  private setupTapAnimations() {
    const targets = [
      '.hdr-avatar-wrap',
      '.hdr-actions button',
      '.hdr-plus',
      '#home-play-btn',
      '.action-side-btn',
      '.intimacy-room-btn',
    ]
    targets.forEach(selector => {
      document.querySelectorAll<HTMLElement>(selector).forEach(el => {
        el.addEventListener('click', () => this.tapPop(el))
      })
    })

    document.getElementById('home-play-btn')?.addEventListener('click', () => {
      const screen = document.getElementById('home-screen')!
      this.cameras.main.fadeOut(250, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        screen.classList.remove('visible')
        this.scene.start('MiniGameSelectScene')
      })
    })
  }

  private setupTabBar() {
    document.querySelectorAll<HTMLElement>('.tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        this.tapPop(tab)
      })
    })
  }

  private tapPop(el: HTMLElement) {
    el.classList.remove('tap-pop')
    void el.offsetWidth  // reflow로 애니메이션 리셋
    el.classList.add('tap-pop')
    el.addEventListener('animationend', () => el.classList.remove('tap-pop'), { once: true })
  }
}
