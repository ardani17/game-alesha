"use client";

import { useState } from "react";
import { CountingGame } from "@/components/counting-game";
import { DrawingApp } from "@/components/drawing-app";
import { GameMenu, type MenuPick } from "@/components/game-menu";
import { LettersGame } from "@/components/letters-game";
import { ReadingGame } from "@/components/reading-game";

type GameView = "menu" | MenuPick;

/** Top-level game switcher: main menu ⇄ each game. */
export function GameApp() {
  const [view, setView] = useState<GameView>("menu");

  if (view === "draw") {
    return <DrawingApp onExit={() => setView("menu")} />;
  }
  if (view === "count") {
    return <CountingGame onExit={() => setView("menu")} />;
  }
  if (view === "letters") {
    return <LettersGame onExit={() => setView("menu")} />;
  }
  if (view === "read") {
    return <ReadingGame onExit={() => setView("menu")} />;
  }
  return <GameMenu onPick={setView} />;
}
