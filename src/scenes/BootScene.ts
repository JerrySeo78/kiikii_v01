import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)')

    const screen = document.getElementById('boot-screen')!
    const btn    = document.getElementById('boot-btn-wrap')!

    screen.classList.add('visible')
    this.cameras.main.fadeIn(400, 0, 0, 0)

    const onClick = () => {
      btn.removeEventListener('click', onClick)
      this.cameras.main.fadeOut(350, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        screen.classList.remove('visible')
        this.scene.start('VideoScene')
      })
    }

    btn.addEventListener('click', onClick)
  }
}
