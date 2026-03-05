import type { Vec3, Quat } from 'shared';
import { INTERPOLATION_BUFFER_MS } from 'shared';

interface Snapshot {
  position: Vec3;
  rotation: Quat;
  timestamp: number;
}

/**
 * Buffers server snapshots for a remote entity and interpolates
 * between them with a fixed delay, producing smooth movement.
 */
export class InterpolationBuffer {
  private snapshots: Snapshot[] = [];

  push(position: Vec3, rotation: Quat, timestamp: number) {
    this.snapshots.push({ position, rotation, timestamp });
    if (this.snapshots.length > 30) {
      this.snapshots.shift();
    }
  }

  getInterpolated(now: number): { position: Vec3; rotation: Quat } | null {
    const renderTime = now - INTERPOLATION_BUFFER_MS;

    while (this.snapshots.length > 2 && this.snapshots[1].timestamp <= renderTime) {
      this.snapshots.shift();
    }

    if (this.snapshots.length < 2) {
      return this.snapshots.length === 1
        ? { position: this.snapshots[0].position, rotation: this.snapshots[0].rotation }
        : null;
    }

    const a = this.snapshots[0];
    const b = this.snapshots[1];
    const range = b.timestamp - a.timestamp;
    const t = range > 0 ? Math.min(1, Math.max(0, (renderTime - a.timestamp) / range)) : 0;

    return {
      position: {
        x: a.position.x + (b.position.x - a.position.x) * t,
        y: a.position.y + (b.position.y - a.position.y) * t,
        z: a.position.z + (b.position.z - a.position.z) * t,
      },
      rotation: slerpQuat(a.rotation, b.rotation, t),
    };
  }
}

function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const bSign = dot < 0 ? -1 : 1;
  dot = Math.abs(dot);

  let s0: number, s1: number;
  if (dot > 0.9995) {
    s0 = 1 - t;
    s1 = t * bSign;
  } else {
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega);
    s0 = Math.sin((1 - t) * omega) / sinOmega;
    s1 = (Math.sin(t * omega) / sinOmega) * bSign;
  }

  return {
    x: s0 * a.x + s1 * b.x,
    y: s0 * a.y + s1 * b.y,
    z: s0 * a.z + s1 * b.z,
    w: s0 * a.w + s1 * b.w,
  };
}
