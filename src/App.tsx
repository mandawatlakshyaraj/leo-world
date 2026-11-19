import { useEffect, useState } from 'react';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { PrivateWorld } from './components/private/PrivateWorld';
import { TransitionOverlay } from './components/private/TransitionOverlay';
import { PublicWorld } from './components/public/PublicWorld';
import type { LeoUser, PublicGameId } from './types/leo';
import { fetchCurrentUser } from './utils/apiClient';

export default function App() {
  const [world, setWorld] = useState<'public' | 'transition' | 'private'>('public');
  const [activeGame, setActiveGame] = useState<PublicGameId | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'match';
      }
    }
    return null;
  });
  const [user, setUser] = useState<LeoUser | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser().then((loaded) => {
      if (mounted && loaded) {
        setUser(loaded);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  function handleSecretCodeEntered() {
    setWorld('transition');
  }

  function handleTransitionComplete() {
    setWorld('private');
  }

  return (
    <>
      {world === 'transition' && (
        <TransitionOverlay onComplete={handleTransitionComplete} />
      )}
      {world === 'private' && (
        <PrivateWorld
          user={user}
          onUserChange={setUser}
          onReturnPublic={() => {
            setActiveGame(null);
            setWorld('public');
          }}
        />
      )}
      {world === 'public' && (
        <PublicWorld
          activeGame={activeGame}
          onSelectGame={setActiveGame}
          onSecretCodeEntered={handleSecretCodeEntered}
        />
      )}
      <OfflineIndicator />
    </>
  );
}
