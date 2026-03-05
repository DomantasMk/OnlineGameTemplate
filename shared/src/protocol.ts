import type { PlayerInput, PlayerState, StaticBody } from './types.js';

export enum MessageType {
  Join = 'join',
  Leave = 'leave',
  Input = 'input',
  State = 'state',
  Init = 'init',
}

export interface JoinMessage {
  type: MessageType.Join;
  playerId: string;
  color: number;
}

export interface LeaveMessage {
  type: MessageType.Leave;
  playerId: string;
}

export interface InputMessage {
  type: MessageType.Input;
  input: PlayerInput;
}

export interface StateMessage {
  type: MessageType.State;
  players: PlayerState[];
  tick: number;
  timestamp: number;
}

export interface InitMessage {
  type: MessageType.Init;
  yourId: string;
  players: PlayerState[];
  staticBodies: StaticBody[];
  tick: number;
}

export type ClientMessage = InputMessage;

export type ServerMessage =
  | JoinMessage
  | LeaveMessage
  | StateMessage
  | InitMessage;

export function encodeMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

export function decodeMessage(data: string): ClientMessage | ServerMessage {
  return JSON.parse(data);
}
