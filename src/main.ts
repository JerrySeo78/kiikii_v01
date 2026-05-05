import './styles/base.css'
import './styles/boot.css'
import './styles/select-member.css'
import './styles/room.css'
import './styles/minigame.css'
import './styles/home.css'
import './styles/match3.css'
import './styles/merge.css'
import './styles/rhythm.css'
import Phaser from 'phaser'
import { SoundFX } from './utils/SoundFX'
import { BootScene } from './scenes/BootScene'
import { VideoScene } from './scenes/VideoScene'
import { SelectMemberScene } from './scenes/SelectMemberScene'
import { HomeScene } from './scenes/HomeScene'
import { RoomScene } from './scenes/RoomScene'
import { MiniGameSelectScene } from './scenes/MiniGameSelectScene'
import { Match3Scene } from './scenes/Match3Scene'
import { MergeScene } from './scenes/MergeScene'
import { RhythmScene } from './scenes/RhythmScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: 'transparent',
  transparent: true,
  scene: [BootScene, VideoScene, SelectMemberScene, HomeScene, RoomScene, MiniGameSelectScene, Match3Scene, MergeScene, RhythmScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

new Phaser.Game(config)

// 전역 버튼 터치 효과음: cursor:pointer인 HTML 요소를 탭할 때 tick
document.addEventListener('pointerdown', (e) => {
  const el = e.target as HTMLElement
  if (window.getComputedStyle(el).cursor === 'pointer' || el.tagName === 'BUTTON') {
    SoundFX.tick()
  }
}, { passive: true })
