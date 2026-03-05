import * as THREE from 'three';
import type { CharacterDefinition, MovementState } from './types.js';

export class CharacterAnimator {
  readonly root: THREE.Group;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Map<string, THREE.AnimationAction>;
  private readonly definition: CharacterDefinition;
  private currentState: MovementState = 'idle';
  private previousState: MovementState = 'idle';
  private currentActionKey: string | null = null;
  private currentAction: THREE.AnimationAction | null = null;

  constructor(params: {
    root: THREE.Group;
    mixer: THREE.AnimationMixer;
    actions: Map<string, THREE.AnimationAction>;
    definition: CharacterDefinition;
  }) {
    this.root = params.root;
    this.mixer = params.mixer;
    this.actions = params.actions;
    this.definition = params.definition;

    for (const actionKey of this.definition.oneShotActions) {
      const action = this.actions.get(actionKey);
      if (!action) continue;
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }

    this.mixer.addEventListener('finished', (e: { action: THREE.AnimationAction }) => {
      const actionKey = this.findActionKey(e.action);
      if (!actionKey) return;
      if (actionKey !== this.currentActionKey) return;
      const chain = this.definition.actionChains[actionKey];
      if (!chain) return;
      this.playAction(chain.action, chain.fadeIn);
    });

    const idleAction = this.definition.stateAnimations.idle.action;
    this.playAction(idleAction, this.definition.stateAnimations.idle.fadeIn);
  }

  update(deltaSeconds: number) {
    this.mixer.update(deltaSeconds);
  }

  setState(state: MovementState) {
    if (state === this.currentState) return;

    const prev = this.currentState;
    this.previousState = prev;
    this.currentState = state;

    const stateAnimation = this.definition.stateAnimations[state];
    const fromOverride = stateAnimation.from?.[this.previousState];
    const transition = fromOverride ?? stateAnimation;
    this.playAction(transition.action, transition.fadeIn);
  }

  private playAction(actionKey: string, fadeIn?: number) {
    const nextAction = this.actions.get(actionKey);
    if (!nextAction) return;
    const duration = fadeIn ?? this.definition.defaultFadeIn ?? 0.15;

    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.fadeOut(duration);
    }
    nextAction.reset().fadeIn(duration).play();
    this.currentAction = nextAction;
    this.currentActionKey = actionKey;
  }

  private findActionKey(target: THREE.AnimationAction): string | null {
    for (const [actionKey, action] of this.actions) {
      if (action === target) return actionKey;
    }
    return null;
  }
}
