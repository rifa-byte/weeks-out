/** Hand a Template from one screen to the start screen without stuffing it into route params. */
import type { Template } from './programs';

let pending: Template | null = null;
export function setPendingTemplate(t: Template | null) { pending = t; }
/** Read without clearing (safe under React strict-mode double renders); the next set overwrites it. */
export function takePendingTemplate(): Template | null { return pending; }
