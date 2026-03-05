import * as THREE from 'three';
import type { StaticBody } from 'shared';
import { GROUND_SIZE } from 'shared';
import { CharacterFactory } from './character/CharacterFactory.js';
import type { CharacterAnimator, CharacterDefinition, MovementState } from './character/index.js';

interface PlayerEntry {
  root: THREE.Group;
  animator: CharacterAnimator | null;
}

export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  private playerEntries = new Map<string, PlayerEntry>();
  private characterFactory: CharacterFactory;

  constructor(characterDefinition: CharacterDefinition) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 12, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.body.appendChild(this.renderer.domElement);

    this.setupLights();
    this.setupGround();
    this.characterFactory = new CharacterFactory(characterDefinition);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0x404060, 0.8);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e6, 1.5);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
    fill.position.set(-10, 10, -10);
    this.scene.add(fill);
  }

  private setupGround() {
    const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE, 0x444466, 0x333355);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  private createPlayerFromTemplate(): PlayerEntry | null {
    const animator = this.characterFactory.createCharacter();
    if (!animator) return null;
    return { root: animator.root, animator };
  }

  private createPlaceholderPlayer(color: number): PlayerEntry {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    const root = new THREE.Group();
    root.add(mesh);
    return { root, animator: null };
  }

  private disposePlaceholder(root: THREE.Group) {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
        else m?.dispose();
      }
    });
  }

  private tryUpgradePlaceholder(id: string, entry: PlayerEntry): PlayerEntry {
    if (entry.animator) return entry;

    const upgraded = this.createPlayerFromTemplate();
    if (!upgraded) return entry;

    upgraded.root.position.copy(entry.root.position);
    upgraded.root.quaternion.copy(entry.root.quaternion);

    this.scene.remove(entry.root);
    this.disposePlaceholder(entry.root);
    this.scene.add(upgraded.root);
    this.playerEntries.set(id, upgraded);
    return upgraded;
  }

  addStaticBodies(bodies: StaticBody[]) {
    for (const b of bodies) {
      const geometry = new THREE.BoxGeometry(b.size.x, b.size.y, b.size.z);
      const material = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.7,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(b.position.x, b.position.y, b.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  getOrCreatePlayerMesh(id: string, color: number): THREE.Group {
    let entry = this.playerEntries.get(id);
    if (!entry) {
      entry = this.createPlayerFromTemplate() ?? this.createPlaceholderPlayer(color);
      this.scene.add(entry.root);
      this.playerEntries.set(id, entry);
    } else {
      entry = this.tryUpgradePlaceholder(id, entry);
    }
    return entry.root;
  }

  setPlayerMovementState(id: string, state: MovementState) {
    const entry = this.playerEntries.get(id);
    if (!entry?.animator) return;
    entry.animator.setState(state);
  }

  removePlayerMesh(id: string) {
    const entry = this.playerEntries.get(id);
    if (entry) {
      this.scene.remove(entry.root);
      // Only dispose geometry/materials for placeholders; animated character meshes share template assets.
      if (!entry.animator) {
        this.disposePlaceholder(entry.root);
      }
      this.playerEntries.delete(id);
    }
  }

  update(deltaSeconds: number) {
    for (const entry of this.playerEntries.values()) {
      entry.animator?.update(deltaSeconds);
    }
  }

  updateCamera(targetPos: THREE.Vector3) {
    const offset = new THREE.Vector3(0, 12, 15);
    const desired = targetPos.clone().add(offset);
    this.camera.position.lerp(desired, 0.05);
    this.camera.lookAt(targetPos);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
