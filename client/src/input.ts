export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}

const state: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
};

function handleKey(e: KeyboardEvent, down: boolean) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp':    state.forward = down; break;
    case 'KeyS': case 'ArrowDown':  state.backward = down; break;
    case 'KeyA': case 'ArrowLeft':  state.left = down; break;
    case 'KeyD': case 'ArrowRight': state.right = down; break;
    case 'Space':                    state.jump = down; break;
  }
}

export function initInput() {
  window.addEventListener('keydown', (e) => handleKey(e, true));
  window.addEventListener('keyup', (e) => handleKey(e, false));
}

export function getInputDirection(): { dx: number; dz: number; jump: boolean } {
  let dx = 0;
  let dz = 0;
  if (state.forward)  dz -= 1;
  if (state.backward) dz += 1;
  if (state.left)     dx -= 1;
  if (state.right)    dx += 1;
  return { dx, dz, jump: state.jump };
}
