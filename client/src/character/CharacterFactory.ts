import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CharacterAnimator } from './CharacterAnimator.js';
import type { CharacterDefinition } from './types.js';

interface CharacterTemplate {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export class CharacterFactory {
  private readonly loader = new GLTFLoader();
  private template: CharacterTemplate | null = null;

  constructor(private readonly definition: CharacterDefinition) {
    void this.loadTemplate().catch((err) => {
      console.error('Failed to load character GLB:', err);
    });
  }

  async loadTemplate() {
    if (this.template) return;

    const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
      this.loader.load(
        this.definition.modelUrl,
        (loaded) => resolve({ scene: loaded.scene, animations: loaded.animations ?? [] }),
        undefined,
        reject
      );
    });

    this.template = {
      scene: gltf.scene,
      animations: gltf.animations,
    };
  }

  createCharacter(): CharacterAnimator | null {
    if (!this.template) return null;

    const cloned = SkeletonUtils.clone(this.template.scene) as THREE.Group;
    cloned.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    cloned.scale.setScalar(this.definition.scale);

    const mixer = new THREE.AnimationMixer(cloned);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const [clipName, actionKey] of Object.entries(this.definition.clipMap)) {
      const clip = this.findClipByExactName(this.template.animations, clipName);
      if (!clip) continue;
      actions.set(actionKey, mixer.clipAction(clip));
    }

    return new CharacterAnimator({
      root: cloned,
      mixer,
      actions,
      definition: this.definition,
    });
  }

  private findClipByExactName(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | undefined {
    return clips.find((clip) => clip.name === name);
  }
}
