# Game Template

Multiplayer game template with Three.js rendering, Rapier physics, and WebSocket networking.

## Architecture

- **`shared/`** — Types, constants, and protocol shared by client and server
- **`server/`** — Authoritative game server with Rapier physics and WebSocket broadcast
- **`client/`** — Three.js renderer with Vite, client-side prediction, and server reconciliation

## Networking Model

Server-authoritative with client-side prediction:

1. Client captures input and immediately simulates it locally (prediction)
2. Input is sent to the server with a sequence number
3. Server processes input, runs physics, broadcasts state at 20Hz
4. Client receives server state, snaps to authoritative position, re-applies unacknowledged inputs (reconciliation)
5. Remote players are rendered with interpolation for smooth movement

## Setup

```bash
npm install
```

## Development

Start both server and client:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:server   # WebSocket server on port 3001
npm run dev:client   # Vite dev server on port 5173
```

Open `http://localhost:5173` in multiple browser tabs to test multiplayer.

## Controls

| Key | Action |
|-----|--------|
| W / Arrow Up | Move forward |
| S / Arrow Down | Move backward |
| A / Arrow Left | Move left |
| D / Arrow Right | Move right |
| Space | Jump |

## Build

```bash
npm run build
```
