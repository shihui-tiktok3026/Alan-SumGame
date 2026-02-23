/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Timer, 
  Play, 
  Pause, 
  Settings2, 
  ChevronRight,
  AlertCircle,
  Zap,
  Globe,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import { 
  Block, 
  GameMode, 
  Language,
  GRID_ROWS, 
  GRID_COLS, 
  INITIAL_ROWS, 
  TIME_LIMIT 
} from './types/game';

// --- Helpers ---

const generateId = () => Math.random().toString(36).substring(2, 9);

const getRandomValue = () => {
  return Math.floor(Math.random() * 10) + 1;
};

const generateTarget = (level: number) => {
  // Lowered difficulty: smaller multiplier for level
  return Math.floor(Math.random() * (10 + Math.floor(level / 3))) + 5;
};

const getBlockColor = (value: number) => {
  const colors: Record<number, string> = {
    1: 'bg-blue-400 text-white border-blue-600',
    2: 'bg-emerald-400 text-white border-emerald-600',
    3: 'bg-amber-400 text-white border-amber-600',
    4: 'bg-orange-400 text-white border-orange-600',
    5: 'bg-rose-400 text-white border-rose-600',
    6: 'bg-purple-400 text-white border-purple-600',
    7: 'bg-pink-400 text-white border-pink-600',
    8: 'bg-indigo-400 text-white border-indigo-600',
    9: 'bg-cyan-400 text-white border-cyan-600',
    10: 'bg-violet-500 text-white border-violet-700',
  };
  return colors[value] || 'bg-zinc-400 text-white border-zinc-600';
};

const translations = {
  zh: {
    title: "Alan's疯狂加法大赛",
    subtitle: "凑出目标数字消除方块，防止触顶。",
    classicMode: "经典模式",
    timeMode: "计时模式",
    classicDesc: "无尽生存",
    timeDesc: "倒计时挑战",
    highScore: "最高分",
    target: "目标数值",
    score: "得分",
    time: "时间",
    paused: "游戏暂停",
    continue: "继续游戏",
    gameOver: "游戏结束",
    gameOverDesc: "方块堆叠到了顶部！",
    retry: "再试一次",
    menu: "返回主菜单",
    level: "等级",
    reset: "重置",
    startLevel: "起始等级",
    lang: "English",
    nextRow: "下行新增",
    levelUp: "等级提升！",
    blocksToNext: "距离下一级还需消除"
  },
  en: {
    title: "Alan's Crazy Addition",
    subtitle: "Sum numbers to clear blocks and stay alive.",
    classicMode: "Classic Mode",
    timeMode: "Time Mode",
    classicDesc: "Endless Survival",
    timeDesc: "Countdown Challenge",
    highScore: "High Score",
    target: "Target",
    score: "Score",
    time: "Time",
    paused: "Paused",
    continue: "Continue",
    gameOver: "Game Over",
    gameOverDesc: "Blocks reached the top!",
    retry: "Try Again",
    menu: "Main Menu",
    level: "Level",
    reset: "Reset",
    startLevel: "Start Level",
    lang: "中文",
    nextRow: "Next Row",
    levelUp: "Level Up!",
    blocksToNext: "Blocks to next level"
  }
};

const BLOCKS_PER_ROW = GRID_COLS;
const ROWS_PER_LEVEL = 5;
const BLOCKS_PER_LEVEL = BLOCKS_PER_ROW * ROWS_PER_LEVEL;

// --- Components ---

export default function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [targetSum, setTargetSum] = useState(10);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('sumstack_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [mode, setMode] = useState<GameMode>('classic');
  const [isPaused, setIsPaused] = useState(false);
  const [level, setLevel] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [language, setLanguage] = useState<Language>('zh');
  const [startLevel, setStartLevel] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 100
  const [blocksClearedInLevel, setBlocksClearedInLevel] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const t = translations[language];

  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('sumstack_highscore', score.toString());
    }
  }, [score, highScore]);

  // Initialize game
  const initGame = useCallback((selectedMode: GameMode) => {
    const initialBlocks: Block[] = [];
    for (let r = 0; r < INITIAL_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        initialBlocks.push({
          id: generateId(),
          value: getRandomValue(),
          row: GRID_ROWS - 1 - r,
          col: c,
        });
      }
    }
    setBlocks(initialBlocks);
    setTargetSum(generateTarget(startLevel));
    setScore(0);
    setSelectedIds([]);
    setGameOver(false);
    setMode(selectedMode);
    setLevel(startLevel);
    setIsPaused(false);
    setGameStarted(true);
    setScrollProgress(0);
    setBlocksClearedInLevel(0);
    setShowLevelUp(false);
  }, [startLevel]);

  // Add a new row at the bottom and push existing blocks up
  const addNewRow = useCallback(() => {
    let isGameOver = false;
    setBlocks(prev => {
      // Check if any block is at the top row (row 0)
      const willBeGameOver = prev.some(b => b.row <= 0);
      if (willBeGameOver) {
        isGameOver = true;
        return prev;
      }

      // Push existing blocks up
      const pushedBlocks = prev.map(b => ({ ...b, row: b.row - 1 }));
      
      // Add new row at the bottom (GRID_ROWS - 1)
      const newRow: Block[] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        newRow.push({
          id: generateId(),
          value: getRandomValue(),
          row: GRID_ROWS - 1,
          col: c,
          isNew: true,
        });
      }
      
      return [...pushedBlocks, ...newRow];
    });
    
    if (isGameOver) {
      setGameOver(true);
    }
    
    setScrollProgress(0);
  }, []);

  // Handle block selection
  const toggleBlock = (id: string) => {
    if (gameOver || isPaused) return;
    
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      return [...prev, id];
    });
  };

  // Check sum when selection changes
  useEffect(() => {
    if (selectedIds.length === 0) return;

    const currentSum = blocks
      .filter(b => selectedIds.includes(b.id))
      .reduce((sum, b) => sum + b.value, 0);

    if (currentSum === targetSum) {
      // Success!
      const points = selectedIds.length * 10 * level;
      setScore(s => s + points);
      
      // Remove blocks
      setBlocks(prev => {
        const remaining = prev.filter(b => !selectedIds.includes(b.id));
        
        // Gravity: blocks fall down within their columns
        const newBlocks: Block[] = [];
        for (let c = 0; c < GRID_COLS; c++) {
          const colBlocks = remaining
            .filter(b => b.col === c)
            .sort((a, b) => b.row - a.row); // Sort from bottom to top
          
          colBlocks.forEach((b, idx) => {
            newBlocks.push({
              ...b,
              row: GRID_ROWS - 1 - idx
            });
          });
        }
        return newBlocks;
      });

      setSelectedIds([]);
      setTargetSum(generateTarget(level));
      
      // Level progression logic
      const newClearedCount = blocksClearedInLevel + selectedIds.length;
      if (newClearedCount >= BLOCKS_PER_LEVEL) {
        setLevel(l => l + 1);
        setBlocksClearedInLevel(newClearedCount - BLOCKS_PER_LEVEL);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 2000);
      } else {
        setBlocksClearedInLevel(newClearedCount);
      }

      // Visual feedback
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#6ee7b7']
      });
    } else if (currentSum > targetSum) {
      // Failed - clear selection
      setSelectedIds([]);
    }
  }, [selectedIds, targetSum, blocks, mode, addNewRow, level, score]);

  // Continuous scrolling logic
  useEffect(() => {
    if (gameStarted && !gameOver && !isPaused) {
      const scrollInterval = 100; // ms
      // Speed calculation: base speed + level factor
      // Level 1: ~15 seconds per row
      // Level 10: ~5 seconds per row
      const speed = (0.5 + (level * 0.15)); 
      
      scrollTimerRef.current = setInterval(() => {
        setScrollProgress(prev => {
          if (prev + speed >= 100) {
            addNewRow();
            return 0;
          }
          return prev + speed;
        });
      }, scrollInterval);
    }
    return () => {
      if (scrollTimerRef.current) clearInterval(scrollTimerRef.current);
    };
  }, [gameStarted, gameOver, isPaused, level, addNewRow]);

  const currentSum = blocks
    .filter(b => selectedIds.includes(b.id))
    .reduce((sum, b) => sum + b.value, 0);

  const speed = (0.5 + (level * 0.15));
  const nextRowCountdown = Math.ceil(((100 - scrollProgress) / speed) * 0.1);

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-[430px] h-[95vh] max-h-[932px] bg-[#f0f4ff] rounded-[3rem] shadow-2xl overflow-hidden border-[8px] border-zinc-900 relative flex flex-col items-center p-4 sm:p-6">
          {/* Top Bar */}
          <div className="w-full flex justify-between items-center mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-black text-zinc-800 tracking-tight shrink-0">{t.title}</h2>
            <button 
              onClick={() => setLanguage(l => l === 'zh' ? 'en' : 'zh')}
              className="px-3 py-1 rounded-full border-2 border-zinc-800 text-[10px] sm:text-xs font-bold text-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-1 shrink-0"
            >
              <Globe className="w-3 h-3" />
              {t.lang}
            </button>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center space-y-4 sm:space-y-6 flex-1 flex flex-col justify-center overflow-y-auto no-scrollbar"
          >
            <div className="space-y-4 sm:space-y-6 shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#5d52fa] rounded-[1.5rem] sm:rounded-[2rem] mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/20">
                <span className="text-white text-xl sm:text-2xl font-black tracking-tighter">Alan</span>
              </div>
              
              <div className="space-y-1 sm:space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-800">{t.title}</h1>
                <p className="text-zinc-500 font-medium text-xs sm:text-sm px-4">{t.subtitle}</p>
              </div>
            </div>

            {/* Level Selector */}
            <div className="bg-white/50 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border-2 border-zinc-200 space-y-2 sm:space-y-3 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t.startLevel}</span>
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <button 
                  onClick={() => setStartLevel(l => Math.max(1, l - 1))}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white border-2 border-zinc-200 text-zinc-800 hover:bg-zinc-100 transition-colors"
                >
                  <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
                </button>
                <span className="text-3xl sm:text-4xl font-mono font-black text-zinc-800 w-10 sm:w-12">{startLevel}</span>
                <button 
                  onClick={() => setStartLevel(l => Math.min(10, l + 1))}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white border-2 border-zinc-200 text-zinc-800 hover:bg-zinc-100 transition-colors"
                >
                  <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:gap-3 w-full max-w-xs mx-auto shrink-0">
              <button 
                onClick={() => initGame('classic')}
                className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#5d52fa] p-4 sm:p-5 text-center transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/30"
              >
                <div className="space-y-0.5 sm:space-y-1">
                  <span className="text-lg sm:text-xl font-black text-white block">{t.classicMode}</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-indigo-100/70 uppercase tracking-widest">{t.classicDesc}</span>
                </div>
              </button>

              <button 
                onClick={() => initGame('time')}
                className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#ff7e21] p-4 sm:p-5 text-center transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/30"
              >
                <div className="space-y-0.5 sm:space-y-1">
                  <span className="text-lg sm:text-xl font-black text-white block">{t.timeMode}</span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-orange-100/70 uppercase tracking-widest">{t.timeDesc}</span>
                </div>
              </button>
            </div>

            <div className="pt-2 sm:pt-4 shrink-0">
              <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.highScore}</span>
                <span className="text-2xl sm:text-3xl font-black text-zinc-800">{highScore}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[430px] h-[95vh] max-h-[932px] bg-[#f0f4ff] rounded-[3rem] shadow-2xl overflow-hidden border-[8px] border-zinc-900 relative flex flex-col font-sans select-none">
        {/* Header */}
        <header className="p-3 sm:p-4 md:p-6 border-b-2 border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="w-full flex flex-col gap-2 sm:gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-zinc-400 mb-0.5 sm:mb-1">{t.target}</span>
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-3xl sm:text-4xl font-mono font-black text-[#5d52fa]">{targetSum}</span>
                  <span className="text-xs sm:text-sm text-zinc-400 font-mono font-bold">/ {currentSum}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <div className="text-right">
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-zinc-400 block mb-0.5 sm:mb-1">{t.score}</span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-zinc-800">{score.toLocaleString()}</span>
                </div>
                
                <button 
                  onClick={() => setIsPaused(!isPaused)}
                  className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-white border-2 border-zinc-200 text-zinc-400 hover:text-zinc-800 transition-colors shadow-sm"
                >
                  {isPaused ? <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />}
                </button>
              </div>
            </div>

            {/* Scroll Countdown Bar */}
            <div className="w-full space-y-1">
              <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <span>{t.nextRow}</span>
                <span className={cn(nextRowCountdown <= 3 ? "text-red-500 animate-pulse" : "")}>
                  {nextRowCountdown}s
                </span>
              </div>
              <div className="h-1.5 sm:h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                <motion.div 
                  className={cn(
                    "h-full transition-colors duration-300",
                    nextRowCountdown <= 3 ? "bg-red-500" : "bg-[#5d52fa]"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${scrollProgress}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Game Board */}
        <main className="flex-1 relative overflow-hidden p-3 sm:p-4 flex flex-col items-center justify-center min-h-0 bg-[#f0f4ff]">
          {/* Level Progress Indicator */}
          <div className="w-full max-w-[280px] mb-2 space-y-1">
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-400">
              <span>{t.level} {level}</span>
              <span>{BLOCKS_PER_LEVEL - blocksClearedInLevel} blocks left</span>
            </div>
            <div className="h-1.5 w-full bg-white rounded-full overflow-hidden border border-zinc-200">
              <motion.div 
                className="h-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${(blocksClearedInLevel / BLOCKS_PER_LEVEL) * 100}%` }}
              />
            </div>
          </div>

          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <div 
              className="relative grid gap-1 sm:gap-1.5 bg-white p-2 sm:p-3 rounded-[1.5rem] sm:rounded-[2rem] border-4 border-zinc-200 shadow-xl animate-pulse-border overflow-hidden"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
                aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
                height: '100%',
                maxHeight: '100%',
                width: 'auto',
              }}
            >
              {/* Background Grid */}
              {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => (
                <div key={`bg-${i}`} className="bg-[#f8faff] rounded-lg sm:rounded-xl border border-zinc-100" />
              ))}

              {/* Blocks */}
              <AnimatePresence mode="popLayout">
                {blocks.map((block) => (
                  <motion.button
                    key={block.id}
                    layout
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: 1, 
                      opacity: 1,
                      y: `-${scrollProgress}%`
                    }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 400, 
                      damping: 35,
                      layout: { duration: 0.3 },
                      y: { duration: 0.1, ease: "linear" }
                    }}
                    onClick={() => toggleBlock(block.id)}
                    className={cn(
                      "flex items-center justify-center rounded-lg sm:rounded-xl text-base sm:text-lg md:text-xl font-mono font-black transition-all w-full h-full border-b-2 sm:border-b-4",
                      selectedIds.includes(block.id)
                        ? "bg-zinc-800 text-white border-zinc-950 scale-105 z-10 shadow-lg -translate-y-1"
                        : getBlockColor(block.value)
                    )}
                    style={{
                      gridRow: block.row + 1,
                      gridColumn: block.col + 1,
                    }}
                  >
                    {block.value}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Level Up Toast */}
          <AnimatePresence>
            {showLevelUp && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#5d52fa] text-white px-8 py-4 rounded-3xl font-black text-2xl shadow-2xl border-4 border-white"
              >
                {t.levelUp}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Overlays */}
          <AnimatePresence>
            {isPaused && !gameOver && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-white/80 backdrop-blur-sm flex items-center justify-center"
              >
                <div className="text-center space-y-6">
                  <h2 className="text-4xl font-black tracking-tight text-zinc-800">{t.paused}</h2>
                  <button 
                    onClick={() => setIsPaused(false)}
                    className="px-8 py-4 bg-[#5d52fa] text-white rounded-3xl font-black text-lg hover:bg-[#4a41d4] transition-colors flex items-center gap-2 mx-auto shadow-lg shadow-indigo-500/30"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {t.continue}
                  </button>
                </div>
              </motion.div>
            )}

            {gameOver && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 z-40 bg-white/90 backdrop-blur-md flex items-center justify-center p-6"
              >
                <div className="max-w-[320px] w-full bg-white border-4 border-zinc-200 rounded-[3rem] p-8 text-center space-y-8 shadow-2xl">
                  <div className="space-y-2">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-800">{t.gameOver}</h2>
                    <p className="text-zinc-500 font-bold">{t.gameOverDesc}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#f8faff] p-4 rounded-3xl border-2 border-zinc-100">
                      <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400 block mb-1">{t.score}</span>
                      <span className="text-2xl font-mono font-black text-[#5d52fa]">{score}</span>
                    </div>
                    <div className="bg-[#f8faff] p-4 rounded-3xl border-2 border-zinc-100">
                      <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400 block mb-1">{t.level}</span>
                      <span className="text-2xl font-mono font-black text-zinc-800">{level}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={() => initGame(mode)}
                      className="w-full py-4 bg-[#5d52fa] text-white rounded-3xl font-black text-lg hover:bg-[#4a41d4] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
                    >
                      <RotateCcw className="w-5 h-5" />
                      {t.retry}
                    </button>
                    <button 
                      onClick={() => setGameStarted(false)}
                      className="w-full py-4 bg-zinc-100 text-zinc-500 rounded-3xl font-black text-lg hover:bg-zinc-200 transition-colors"
                    >
                      {t.menu}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="p-4 border-t-2 border-zinc-200 bg-white">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2",
                mode === 'classic' ? "bg-indigo-50 text-indigo-500 border-indigo-100" : "bg-orange-50 text-orange-500 border-orange-100"
              )}>
                {mode === 'classic' ? t.classicMode : t.timeMode}
              </div>
              <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-zinc-50 text-zinc-400 border-2 border-zinc-100">
                {t.level} {level}
              </div>
            </div>

            <button 
              onClick={() => setGameStarted(false)}
              className="text-xs font-black text-zinc-400 hover:text-zinc-800 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              {t.reset}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );}
