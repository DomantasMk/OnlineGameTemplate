import { WebSocketServer } from 'ws';
import { SERVER_PORT, MessageType, decodeMessage, type ClientMessage } from 'shared';
import { GameRoom } from './GameRoom.js';

async function main() {
  const room = new GameRoom();
  await room.init();
  console.log('Physics engine initialized');

  const wss = new WebSocketServer({ port: SERVER_PORT });
  console.log(`WebSocket server listening on ws://localhost:${SERVER_PORT}`);

  let nextId = 1;

  wss.on('connection', (ws) => {
    const playerId = `player_${nextId++}`;
    console.log(`${playerId} connected`);

    room.addPlayer(playerId, ws);

    ws.on('message', (raw) => {
      try {
        const msg = decodeMessage(raw.toString()) as ClientMessage;
        if (msg.type === MessageType.Input) {
          room.handleInput(playerId, msg.input);
        }
      } catch (e) {
        console.error(`Bad message from ${playerId}:`, e);
      }
    });

    ws.on('close', () => {
      console.log(`${playerId} disconnected`);
      room.removePlayer(playerId);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${playerId}:`, err);
    });
  });
}

main().catch(console.error);
