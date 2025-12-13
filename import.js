//! funcionality

import { Pathfinder } from "./game_map/pathfinder.js";
import { ConfigLoader } from "./game_configs/configLoader.js";
import { SpriteLoader } from "./game_configs/spriteLoader.js";
import { Player } from "./game/player.js";

//! debug
import { DebugManager } from "./debug/debugManager.js";

//! objects actions
import { MoveAction } from "./game_objects/actions/moveAction.js";
import { AttackAction } from "./game_objects/actions/attackAction.js";
import { TeleportAction } from "./game_objects/actions/teleportAction.js";
import { AuraAction } from "./game_objects/actions/auraAction.js";

//! object

import { GameObject, resetObjectIdCounter } from "./game_objects/gameObject.js";
import { Particle } from "./game_objects/particle.js";
import { Effect } from "./game_objects/effect.js";
import { Animator } from "./game_objects/animator.js";
import { Renderer } from "./game_objects/renderer.js";

//! managers

import { ObjectManager } from "./game_objects/objectManager.js";
import { GridManager } from "./game_map/gridManager.js";
import { ActionManager } from "./game_objects/actionManager.js";
import { InputManager } from "./input/inputManager.js";
import { InterfaceManager } from "./input/interfaceManager.js";
import { EffectManager } from "./game_objects/effectManager.js";

export {
  ObjectManager,
  GridManager,
  ActionManager,
  InputManager,
  GameObject,
  resetObjectIdCounter,
  Animator,
  Renderer,
  MoveAction,
  AttackAction,
  TeleportAction,
  AuraAction,
  Pathfinder,
  ConfigLoader,
  Particle,
  Effect,
  EffectManager,
  SpriteLoader,
  Player,
  InterfaceManager,
  DebugManager,
};
