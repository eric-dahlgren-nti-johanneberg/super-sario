import { setupKeyboard } from './contols/input'
import { loadEntities } from './entity/entities'
import { GameContext } from './game-context'
import { createTextLayer } from './layers/color'
import { createColorLayer } from './layers/text'
import { createCollisionLayer } from './layers/collision'
import { Scene } from './level/Scene'
import { SceneRunner } from './level/scene-runner'
import { Font, loadFont } from './loaders/font'
import { createLevelLoader } from './loaders/level'
import { createPlayerEnv, makePlayer } from './player'
import { raise } from './raise'
import { Timer } from './timer'
import { createPlayerProgressLayer } from './layers/player-progress'
import { Level } from './level/level'
import { LevelSpecTrigger } from './loaders'
import { Entity } from './entity/entity'
import { Player } from './traits/player'

const main = async (canvas: HTMLCanvasElement): Promise<void> => {
  const context = canvas.getContext('2d') || raise('Canvas not supported')
  // slipp skriva `Math#floor` en massa gånger
  context.imageSmoothingEnabled = false

  const [entityFactory, font] = await Promise.all([loadEntities(), loadFont()])

  const loadLevel = createLevelLoader(entityFactory)

  const sceneRunner = new SceneRunner()

  const sario = entityFactory.sario?.() || raise('no sario found')
  makePlayer(sario, 'SARIO')

  const inputRouter = setupKeyboard(window)
  inputRouter.addReceiver(sario)

  async function runLevel(name: string) {
    const loadScreen = new Scene()
    loadScreen.comp.layers.push(createColorLayer('black'))
    loadScreen.comp.layers.push(createTextLayer(font, `LOADING ${name}...`))
    sceneRunner.addScene(loadScreen)
    sceneRunner.runNext()

    await new Promise((resolve) => setTimeout(resolve, 500))

    const level = await loadLevel(name)

    level.events.listen(
      Level.EVENT_TRIGGER,
      (spec: LevelSpecTrigger, trigger: Entity, touches: Set<Entity>) => {
        if (spec.type === 'goto') {
          for (const entity of touches) {
            if (entity.getTrait(Player)) {
              runLevel(spec.name)
              return
            }
          }
        }
      },
    )

    sario.pos.set(0, 0)
    sario.vel.set(0, 0)
    level.entities.add(sario)

    const playerEnv = createPlayerEnv(sario)
    level.entities.add(playerEnv)

    const progress = level.comp.layers.push(
      createPlayerProgressLayer(font, level),
    )

    level.comp.layers.push(createCollisionLayer(level))
    sceneRunner.addScene(level)
    sceneRunner.runNext()
  }

  const timer = new Timer()

  timer.update = function update(deltaTime) {
    if (!document.hasFocus()) return

    const gameContext: GameContext = {
      deltaTime,
      entityFactory,
      graphicsContext: context,
    }

    sceneRunner.update(gameContext)
  }

  timer.start()

  runLevel('1-1')
}

const canvas = document.getElementById('screen')
if (canvas instanceof HTMLCanvasElement) {
  main(canvas).catch(console.error)
} else {
  console.warn('Canvas not found')
}
