import * as THREE from 'three';
import { MessageType, TICK_MS, type PlayerState } from 'shared';
import { Renderer } from './renderer.js';
import { Network } from './network.js';
import { PredictionEngine } from './prediction.js';
import { InterpolationBuffer } from './interpolation.js';
import { initInput, getInputDirection } from './input.js';

interface RemotePlayer {
  id: string;
  color: number;
  buffer: InterpolationBuffer;
}

let myId: string | null = null;
const remotePlayers = new Map<string, RemotePlayer>();
const playerColors = new Map<string, number>();

const renderer = new Renderer();
const network = new Network();
const prediction = new PredictionEngine();

const playerCountEl = document.getElementById('player-count')!;

function updatePlayerCount() {
  const count = remotePlayers.size + (myId ? 1 : 0);
  playerCountEl.textContent = `Players: ${count}`;
}

network.onMessage(async (msg) => {
  switch (msg.type) {
    case MessageType.Init: {
      myId = msg.yourId;
      await prediction.init(msg.staticBodies);
      renderer.addStaticBodies(msg.staticBodies);

      const me = msg.players.find((p) => p.id === myId);
      if (me) {
        prediction.spawnLocalBody(me.position);
        playerColors.set(me.id, me.color);
      }

      for (const p of msg.players) {
        playerColors.set(p.id, p.color);
        if (p.id !== myId) {
          const rp: RemotePlayer = { id: p.id, color: p.color, buffer: new InterpolationBuffer() };
          rp.buffer.push(p.position, p.rotation, performance.now());
          remotePlayers.set(p.id, rp);
        }
      }
      updatePlayerCount();
      break;
    }

    case MessageType.Join: {
      playerColors.set(msg.playerId, msg.color);
      if (msg.playerId !== myId) {
        const rp: RemotePlayer = {
          id: msg.playerId,
          color: msg.color,
          buffer: new InterpolationBuffer(),
        };
        remotePlayers.set(msg.playerId, rp);
      }
      updatePlayerCount();
      break;
    }

    case MessageType.Leave: {
      renderer.removePlayerMesh(msg.playerId);
      remotePlayers.delete(msg.playerId);
      playerColors.delete(msg.playerId);
      updatePlayerCount();
      break;
    }

    case MessageType.State: {
      const now = performance.now();
      for (const ps of msg.players) {
        if (ps.id === myId) {
          prediction.reconcile(ps);
        } else {
          const rp = remotePlayers.get(ps.id);
          if (rp) {
            rp.buffer.push(ps.position, ps.rotation, now);
          }
          playerColors.set(ps.id, ps.color);
        }
      }
      break;
    }
  }
});

initInput();
network.connect();

let lastTime = performance.now();
let inputAccumulator = 0;

function gameLoop() {
  requestAnimationFrame(gameLoop);

  const now = performance.now();
  const dt = Math.min(now - lastTime, 100);
  lastTime = now;
  inputAccumulator += dt;

  while (inputAccumulator >= TICK_MS) {
    inputAccumulator -= TICK_MS;

    if (myId) {
      const { dx, dz, jump } = getInputDirection();
      if (dx !== 0 || dz !== 0 || jump) {
        const input = { seq: prediction.nextSeq(), dx, dz, jump, dt: TICK_MS / 1000 };
        prediction.applyInputLocally(input);
        network.sendInput(input);
      }
    }
  }

  if (myId) {
    const predictedPos = prediction.getPosition();
    if (predictedPos) {
      const color = playerColors.get(myId) ?? 0xffffff;
      const mesh = renderer.getOrCreatePlayerMesh(myId, color);
      mesh.position.set(predictedPos.x, predictedPos.y, predictedPos.z);
      renderer.updateCamera(mesh.position);
    }
  }

  const renderNow = performance.now();
  for (const [id, rp] of remotePlayers) {
    const interp = rp.buffer.getInterpolated(renderNow);
    if (interp) {
      const mesh = renderer.getOrCreatePlayerMesh(id, rp.color);
      mesh.position.set(interp.position.x, interp.position.y, interp.position.z);
      mesh.quaternion.set(interp.rotation.x, interp.rotation.y, interp.rotation.z, interp.rotation.w);
    }
  }

  renderer.render();
}

gameLoop();
