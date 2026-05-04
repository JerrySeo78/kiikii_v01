import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { VideoScene } from './scenes/VideoScene'
import { SelectMemberScene } from './scenes/SelectMemberScene'
import { HomeScene } from './scenes/HomeScene'
import { RoomScene } from './scenes/RoomScene'
import { MiniGameSelectScene } from './scenes/MiniGameSelectScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 'transparent',
  transparent: true,
  scene: [BootScene, VideoScene, SelectMemberScene, HomeScene, RoomScene, MiniGameSelectScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

new Phaser.Game(config)
