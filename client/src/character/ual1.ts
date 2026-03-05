import type { CharacterDefinition } from "./types.js";

export const ual1Definition: CharacterDefinition = {
  modelUrl: new URL("../../animations/UAL1_Standard.glb", import.meta.url).href,
  scale: 1,
  clipMap: {
    Idle_Loop: "idle",
    Walk_Loop: "run",
    Sprint_Loop: "sprint",
    Jump_Start: "jump_start",
    Jump_Loop: "jump_loop",
    Jump_Land: "jump_land",
  },
  stateAnimations: {
    idle: {
      action: "idle",
      from: {
        jump: { action: "jump_land", fadeIn: 0.1 },
      },
    },
    run: {
      action: "run",
      from: {
        jump: { action: "jump_land", fadeIn: 0.1 },
      },
    },
    sprint: {
      action: "sprint",
      from: {
        jump: { action: "jump_land", fadeIn: 0.1 },
      },
    },
    jump: { action: "jump_start", fadeIn: 0.1 },
  },
  oneShotActions: ["jump_start", "jump_land"],
  actionChains: {
    jump_start: { action: "jump_loop", fadeIn: 0.1 },
    jump_land: { action: "idle", fadeIn: 0.15 },
  },
  defaultFadeIn: 0.15,
};
