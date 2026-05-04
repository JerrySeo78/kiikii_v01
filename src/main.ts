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
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 'transparent',
  transparent: true,
  scene: [BootScene, VideoScene, SelectMemberScene, HomeScene, RoomScene, MiniGameSelectScene, Match3Scene, MergeScene, RhythmScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

new Phaser.Game(config)
