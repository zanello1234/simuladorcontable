import { useGame } from '../store/game';
import { Toasts } from './components';
import { GameScreen } from './GameScreen';
import { TitleScreen } from './TitleScreen';

export function App() {
  const hasGame = useGame((s) => !!s.game);
  return hasGame ? (
    <GameScreen />
  ) : (
    <>
      <TitleScreen />
      <Toasts />
    </>
  );
}
