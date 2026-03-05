export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface EntityState {
  id: string;
  position: Vec3;
  rotation: Quat;
  velocity: Vec3;
}

export interface PlayerInput {
  seq: number;
  dx: number;
  dz: number;
  jump: boolean;
  dt: number;
}

export interface PlayerState extends EntityState {
  color: number;
  lastProcessedInput: number;
}

export interface StaticBody {
  id: string;
  position: Vec3;
  size: Vec3;
  color: number;
}
