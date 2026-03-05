export type MovementState = 'idle' | 'run' | 'sprint' | 'jump';

export interface CharacterActionTransition {
  action: string;
  fadeIn?: number;
}

export interface CharacterStateAnimation extends CharacterActionTransition {
  from?: Partial<Record<MovementState, CharacterActionTransition>>;
}

export interface CharacterDefinition {
  modelUrl: string;
  scale: number;
  clipMap: Record<string, string>;
  stateAnimations: Record<MovementState, CharacterStateAnimation>;
  oneShotActions: string[];
  actionChains: Record<string, CharacterActionTransition>;
  defaultFadeIn?: number;
}
