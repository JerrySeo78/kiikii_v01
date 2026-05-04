import Phaser from 'phaser'

export class MiniGameSelectScene extends Phaser.Scene {
  constructor() { super('MiniGameSelectScene') }

  create() {
    const screen = document.getElementById('minigame-select-screen')!
    screen.classList.add('visible')
    this.cameras.main.fadeIn(250, 0, 0, 0)

    document.getElementById('minigame-btn-merge')?.addEventListener('click', () => {
      this.close(() => this.scene.start('HomeScene'))  // 머지게임 Scene으로 교체 예정
    })

    document.getElementById('minigame-btn-match3')?.addEventListener('click', () => {
      this.close(() => this.scene.start('Match3Scene'))
    })

    document.getElementById('minigame-btn-rhythm')?.addEventListener('click', () => {
      this.close(() => this.scene.start('HomeScene'))  // 리듬게임 Scene으로 교체 예정
    })

    document.getElementById('minigame-close-btn')?.addEventListener('click', () => {
      this.close(() => this.scene.start('HomeScene'))
    })
  }

  private close(next: () => void) {
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      document.getElementById('minigame-select-screen')!.classList.remove('visible')
      next()
    })
  }
}
