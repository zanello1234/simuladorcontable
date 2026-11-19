import { useEffect } from 'react';
import { audio } from '../audio/audio';
import { useGame } from '../store/game';
import { Toasts } from './components';
import { GameScreen } from './GameScreen';
import { TitleScreen } from './TitleScreen';

export function App() {
  const hasGame = useGame((s) => !!s.game);
  useEffect(() => {
    // el audio arranca con el primer gesto del usuario (política de autoplay)
    const unlock = () => audio.unlock();
    const click = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.('button, .cal-d, .opt')) audio.sfx('click');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('click', click);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', click);
    };
  }, []);
  useEffect(() => {
    if (!hasGame) {
      audio.setMood('menu');
      audio.setPaused(false);
      audio.setDucked(false);
    }
  }, [hasGame]);
  return hasGame ? (
    <GameScreen />
  ) : (
    <>
      <TitleScreen />
      <Toasts />
    </>
  );
}
