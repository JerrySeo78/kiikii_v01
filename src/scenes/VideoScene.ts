import Phaser from 'phaser'

export class VideoScene extends Phaser.Scene {
  constructor() { super('VideoScene') }

  create() {
    const screen = document.getElementById('video-screen')!
    const video  = document.getElementById('video-player') as HTMLVideoElement
    screen.classList.add('visible')
    this.cameras.main.fadeIn(300, 0, 0, 0)

    video.currentTime = 0
    video.muted = false
    video.play().catch(() => { video.muted = true; video.play() })

    const advance = () => {
      video.pause()
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        screen.classList.remove('visible')
        this.scene.start('SelectMemberScene')
      })
    }

    video.addEventListener('ended', advance, { once: true })

    const skipBtn = document.getElementById('video-skip-btn')!
    skipBtn.addEventListener('click', () => {
      video.removeEventListener('ended', advance)
      advance()
    }, { once: true })
  }
}
