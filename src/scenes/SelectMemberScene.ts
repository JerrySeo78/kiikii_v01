import Phaser from 'phaser'

export class SelectMemberScene extends Phaser.Scene {
  private selectedMember: string | null = null

  constructor() { super('SelectMemberScene') }

  create() {
    const screen = document.getElementById('select-member-screen')!
    const btn    = document.getElementById('select-member-btn-wrap')!
    screen.classList.add('visible')
    this.cameras.main.fadeIn(300, 0, 0, 0)

    document.querySelectorAll<HTMLElement>('.member-zone').forEach(zone => {
      zone.addEventListener('click', () => {
        document.querySelectorAll('.member-zone').forEach(z => z.classList.remove('selected'))
        zone.classList.add('selected')
        this.selectedMember = zone.dataset.member ?? null
      })
    })

    const onConfirm = () => {
      if (!this.selectedMember) return
      btn.removeEventListener('click', onConfirm)
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        screen.classList.remove('visible')
        this.scene.start('HomeScene', { member: this.selectedMember })
      })
    }
    btn.addEventListener('click', onConfirm)
  }
}
