import { GameCanvas } from '@/components/game/GameCanvas';

export default function GamePage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black">
      <GameCanvas />
    </main>
  );
}
