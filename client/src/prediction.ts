import RAPIER from '@dimforge/rapier3d-compat';
import {
  PLAYER_SPEED,
  PLAYER_SIZE,
  GRAVITY,
  GROUND_SIZE,
  TICK_MS,
  type PlayerInput,
  type PlayerState,
  type StaticBody,
  type Vec3,
} from 'shared';

/**
 * Client-side prediction engine.
 *
 * Maintains a local Rapier physics world that mirrors the server's static geometry.
 * The local player's body is simulated ahead using unacknowledged inputs.
 *
 * Reconciliation flow:
 * 1. Server state arrives with `lastProcessedInput` sequence number
 * 2. Snap local body to server-authoritative position
 * 3. Discard all inputs up to and including the acknowledged sequence
 * 4. Re-simulate remaining unacknowledged inputs to get the predicted position
 */
export class PredictionEngine {
  private world!: RAPIER.World;
  private localBody: RAPIER.RigidBody | null = null;
  private pendingInputs: PlayerInput[] = [];
  private inputSeq = 0;

  async init(staticBodies: StaticBody[]) {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    this.buildStaticScene(staticBodies);
  }

  private buildStaticScene(bodies: StaticBody[]) {
    const groundDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const groundBody = this.world.createRigidBody(groundDesc);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(GROUND_SIZE / 2, 0.5, GROUND_SIZE / 2),
      groundBody
    );

    for (const b of bodies) {
      if (b.id === 'ground') continue;
      const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(b.position.x, b.position.y, b.position.z);
      const body = this.world.createRigidBody(desc);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.size.x / 2, b.size.y / 2, b.size.z / 2),
        body
      );
    }
  }

  spawnLocalBody(position: Vec3) {
    if (this.localBody) {
      this.world.removeRigidBody(this.localBody);
    }
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setLinearDamping(5.0)
      .lockRotations();
    this.localBody = this.world.createRigidBody(desc);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(PLAYER_SIZE / 2, PLAYER_SIZE / 2, PLAYER_SIZE / 2).setFriction(0.5),
      this.localBody
    );
  }

  nextSeq(): number {
    return ++this.inputSeq;
  }

  applyInputLocally(input: PlayerInput) {
    if (!this.localBody) return;
    this.pendingInputs.push(input);
    this.applyInputToBody(this.localBody, input);
    this.world.step();
  }

  reconcile(serverState: PlayerState) {
    if (!this.localBody) return;

    this.localBody.setTranslation(
      { x: serverState.position.x, y: serverState.position.y, z: serverState.position.z },
      true
    );
    this.localBody.setLinvel(
      { x: serverState.velocity.x, y: serverState.velocity.y, z: serverState.velocity.z },
      true
    );

    this.pendingInputs = this.pendingInputs.filter(
      (inp) => inp.seq > serverState.lastProcessedInput
    );

    for (const input of this.pendingInputs) {
      this.applyInputToBody(this.localBody, input);
      this.world.step();
    }
  }

  getPosition(): Vec3 | null {
    if (!this.localBody) return null;
    const t = this.localBody.translation();
    return { x: t.x, y: t.y, z: t.z };
  }

  private applyInputToBody(body: RAPIER.RigidBody, input: PlayerInput) {
    const { dx, dz } = input;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      const nx = dx / len;
      const nz = dz / len;
      const vel = body.linvel();
      body.setLinvel({ x: nx * PLAYER_SPEED, y: vel.y, z: nz * PLAYER_SPEED }, true);
    }

    if (input.jump) {
      if (this.isGrounded(body)) {
        const vel = body.linvel();
        body.setLinvel({ x: vel.x, y: 9.0, z: vel.z }, true);
      }
    }
  }

  private isGrounded(body: RAPIER.RigidBody): boolean {
    const pos = body.translation();
    const ray = new RAPIER.Ray(
      { x: pos.x, y: pos.y - PLAYER_SIZE / 2, z: pos.z },
      { x: 0, y: -1, z: 0 }
    );
    const hit = this.world.castRay(ray, 0.35, true, undefined, undefined, undefined, body, undefined);
    return hit !== null;
  }
}
