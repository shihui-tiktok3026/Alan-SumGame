export type GameMode = 'classic' | 'time';
export type Language = 'zh' | 'en';

export interface Block {
  id: string;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
}

export interface GameState {
  blocks: Block[];
  targetSum: number;
  score: number;
  selectedIds: string[];
  gameOver: boolean;
  mode: GameMode;
  timeLeft: number;
  level: number;
}

export const GRID_ROWS = 10;
export const GRID_COLS = 6;
export const INITIAL_ROWS = 4;
export const TIME_LIMIT = 15; // Increased from 10 to 15 for lower difficulty
