import { z } from 'zod';
import type { GameNotification } from '../service/ports';

const factionSchema = z.enum(['havre', 'necropole', 'inferno']);
const playerIndexSchema = z.union([z.literal(0), z.literal(1)]);
const slotSchema = z.object({ row: z.number().int().min(0).max(1), lane: z.number().int().min(0).max(3) });
const unitTargetSchema = z.object({ kind: z.literal('unit'), uid: z.number().int() });
const heroTargetSchema = z.object({ kind: z.literal('hero'), player: playerIndexSchema });
const targetSchema = z.discriminatedUnion('kind', [unitTargetSchema, heroTargetSchema]);
const choiceSchema = z.discriminatedUnion('kind', [
  slotSchema.extend({ kind: z.literal('slot') }), unitTargetSchema, heroTargetSchema,
  z.object({ kind: z.literal('line'), player: playerIndexSchema, row: z.number().int().min(0).max(1) }),
  z.object({ kind: z.literal('hand'), index: z.number().int().min(0) }),
  z.object({ kind: z.literal('card'), zone: z.enum(['library', 'grave']), cardId: z.string() }),
  z.object({ kind: z.literal('mode'), index: z.number().int().min(0) }),
]);
const choicesSchema = z.array(choiceSchema).max(4);

export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('develop'), choice: z.enum(['m', 'g', 'd', 'draw']) }),
  z.object({ type: z.literal('play'), handIndex: z.number().int().min(0), choices: choicesSchema }),
  z.object({ type: z.literal('power'), choices: choicesSchema }),
  z.object({ type: z.literal('event'), slot: z.number().int().min(0).max(1), choices: choicesSchema }),
  z.object({ type: z.literal('attack'), uid: z.number().int(), target: targetSchema }),
  z.object({ type: z.literal('move'), uid: z.number().int(), to: slotSchema }),
  z.object({ type: z.literal('endTurn') }),
]);

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startAi'), faction: factionSchema }),
  z.object({ type: z.literal('findMatch'), faction: factionSchema }),
  z.object({ type: z.literal('action'), action: gameActionSchema }),
  z.object({ type: z.literal('leave') }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage = GameNotification | { type: 'error'; message: string };
