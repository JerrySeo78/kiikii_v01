import Phaser from 'phaser'

export class RhythmScene extends Phaser.Scene {
  constructor() { super('RhythmScene') }

  create() {
    const screen = document.getElementById('rhythm-screen')!
    const iframe  = document.getElementById('rhythm-iframe') as HTMLIFrameElement
    const closeBtn = document.getElementById('rhythm-close-btn')!

    // import.meta.env.BASE_URL = '/kiikii_v01/' (vite base)
    iframe.src = import.meta.env.BASE_URL + 'rhythm/rhythm.html'
    screen.classList.add('visible')

    closeBtn.addEventListener('click', () => this.goBack(), { once: true })
  }

  private goBack() {
    const screen = document.getElementById('rhythm-screen')!
    const iframe  = document.getElementById('rhythm-iframe') as HTMLIFrameElement

    // 카메라 스트림 정지를 위해 iframe src 초기화
    iframe.src = ''
    screen.classList.remove('visible')
    this.scene.start('HomeScene')
  }
}
