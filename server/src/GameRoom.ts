import RAPIER from '@dimforge/rapier3d-compat';
import {
  TICK_MS,
  NETWORK_SEND_INTERVAL,
  PLAYER_SPEED,
  PLAYER_SIZE,
  GRAVITY,
  GROUND_SIZE,
  type PlayerInput,
  type PlayerState,
  type StaticBody,
  MessageType,
  encodeMessage,
} from 'shared';
import type { WebSocket } from 'ws';

interface ServerPlayer {
  id: string;
  color: number;
  ws: WebSocket;
  body: RAPIER.RigidBody;
  pendingInputs: PlayerInput[];
  lastProcessedInput: number;
}

const COLORS = [0x4fc3f7, 0xef5350, 0x66bb6a, 0xffa726, 0xab47bc, 0xffee58, 0x26c6da, 0xec407a];

export class GameRoom {
  private world!: RAPIER.World;
  private players = new Map<string, ServerPlayer>();
  private staticBodies: StaticBody[] = [];
  private tick = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private colorIndex = 0;

  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    this.createStaticScene();
  }

  private createStaticScene() {
    const groundDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const groundBody = this.world.createRigidBody(groundDesc);
    const groundCollider = RAPIER.ColliderDesc.cuboid(GROUND_SIZE / 2, 0.5, GROUND_SIZE / 2);
    this.world.createCollider(groundCollider, groundBody);
    this.staticBodies.push({
      id: 'ground',
      position: { x: 0, y: -0.5, z: 0 },
      size: { x: GROUND_SIZE, y: 1, z: GROUND_SIZE },
      color: 0x4a4a4a,
    });

    const obstacles: { pos: [number, number, number]; size: [number, number, number]; color: number }[] = [
      { pos: [5, 1, 5], size: [2, 2, 2], color: 0x8d6e63 },
      { pos: [-6, 0.75, -3], size: [3, 1.5, 1.5], color: 0x78909c },
      { pos: [0, 0.5, -8], size: [1.5, 1, 4], color: 0x7e57c2 },
      { pos: [-4, 1.5, 7], size: [1, 3, 1], color: 0x26a69a },
    ];

    for (const obs of obstacles) {
      const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(...obs.pos);
      const body = this.world.createRigidBody(desc);
      const collider = RAPIER.ColliderDesc.cuboid(obs.size[0] / 2, obs.size[1] / 2, obs.size[2] / 2);
      this.world.createCollider(collider, body);
      this.staticBodies.push({
        id: `obs_${obs.pos.join('_')}`,
        position: { x: obs.pos[0], y: obs.pos[1], z: obs.pos[2] },
        size: { x: obs.size[0], y: obs.size[1], z: obs.size[2] },
        color: obs.color,
      });
    }
  }

  addPlayer(id: string, ws: WebSocket) {
    const color = COLORS[this.colorIndex % COLORS.length];
    this.colorIndex++;

    const spawnX = (Math.random() - 0.5) * 10;
    const spawnZ = (Math.random() - 0.5) * 10;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnX, PLAYER_SIZE / 2 + 0.1, spawnZ)
      .setLinearDamping(5.0)
      .lockRotations();
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      PLAYER_SIZE / 2,
      PLAYER_SIZE / 2,
      PLAYER_SIZE / 2
    ).setFriction(0.5);
    this.world.createCollider(colliderDesc, body);

    const player: ServerPlayer = { id, color, ws, body, pendingInputs: [], lastProcessedInput: 0 };
    this.players.set(id, player);

    const initMsg = encodeMessage({
      type: MessageType.Init,
      yourId: id,
      players: this.getPlayerStates(),
      staticBodies: this.staticBodies,
      tick: this.tick,
    });
    ws.send(initMsg);

    this.broadcast({
      type: MessageType.Join,
      playerId: id,
      color,
    });

    if (!this.interval) this.startLoop();
    return player;
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (!player) return;

    this.world.removeRigidBody(player.body);
    this.players.delete(id);

    this.broadcast({ type: MessageType.Leave, playerId: id });

    if (this.players.size === 0 && this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  handleInput(playerId: string, input: PlayerInput) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.pendingInputs.push(input);
  }

  private startLoop() {
    this.interval = setInterval(() => this.update(), TICK_MS);
  }

  private update() {
    this.tick++;

    for (const player of this.players.values()) {
      for (const input of player.pendingInputs) {
        this.applyInput(player, input);
        player.lastProcessedInput = input.seq;
      }
      player.pendingInputs = [];
    }

    this.world.step();

    if (this.tick % NETWORK_SEND_INTERVAL === 0) {
      this.broadcastState();
    }
  }

  private applyInput(player: ServerPlayer, input: PlayerInput) {
    const { dx, dz } = input;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      const nx = dx / len;
      const nz = dz / len;
      const body = player.body;
      const vel = body.linvel();
      body.setLinvel(
        { x: nx * PLAYER_SPEED, y: vel.y, z: nz * PLAYER_SPEED },
        true
      );
    }

    if (input.jump) {
      const pos = player.body.translation();
      if (pos.y < PLAYER_SIZE / 2 + 0.2) {
        const vel = player.body.linvel();
        player.body.setLinvel({ x: vel.x, y: 6.0, z: vel.z }, true);
      }
    }
  }

  private getPlayerStates(): PlayerState[] {
    const states: PlayerState[] = [];
    for (const p of this.players.values()) {
      const pos = p.body.translation();
      const rot = p.body.rotation();
      const vel = p.body.linvel();
      states.push({
        id: p.id,
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
        velocity: { x: vel.x, y: vel.y, z: vel.z },
        color: p.color,
        lastProcessedInput: p.lastProcessedInput,
      });
    }
    return states;
  }

  private broadcastState() {
    const msg = encodeMessage({
      type: MessageType.State,
      players: this.getPlayerStates(),
      tick: this.tick,
      timestamp: Date.now(),
    });
    for (const p of this.players.values()) {
      if (p.ws.readyState === p.ws.OPEN) {
        p.ws.send(msg);
      }
    }
  }

  private broadcast(msg: Parameters<typeof encodeMessage>[0]) {
    const data = encodeMessage(msg);
    for (const p of this.players.values()) {
      if (p.ws.readyState === p.ws.OPEN) {
        p.ws.send(data);
      }
    }
  }
}
