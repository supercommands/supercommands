import type * as React from 'react';
import { useState } from 'react';
import { BsStar, BsStarFill } from 'react-icons/bs';
import { useUIStore } from '../../uiStateManager';
import { StorageManager } from '../../../storage/localStorage/storageManager';

const FavoritesToggleButton: React.FC = () => {
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const showFavorites = useUIStore(state => state.showFavorites);
  const setShowFavorites = useUIStore(state => state.setShowFavorites);

  const handleClick = (): void => {
    setIsAnimating(true);
    // Toggle the favorites state after a small delay to let animation play
    setTimeout(() => {
      const nextValue = !showFavorites;
      setShowFavorites(nextValue);

      // Persist to storage
      StorageManager.setItem('showFavorites', nextValue);

      // Reset animation state after toggle is complete
      setTimeout(() => setIsAnimating(false), 300);
    }, 150);
  };

  return (
    <div
      onClick={handleClick}
      className={`border border-[var(--color-borderDefault)] rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-all duration-200 ${
        isAnimating ? 'scale-95 bg-[var(--color-containerBg)]' : ''
      }`}>
      <div className="py-1 flex flex-row items-center justify-center gap-2 rounded-md px-2 transition-all duration-300">
        <div className={`transition-all duration-300 ${isAnimating ? 'rotate-180 scale-110' : ''}`}>
          {showFavorites ? (
            <BsStarFill className="text-yellow-400" size={18} />
          ) : (
            <BsStar className="text-[var(--color-iconDefault)]" size={18} />
          )}
        </div>
        <p className="text-neutral-700 dark:text-neutral-300 font-medium">
          {showFavorites ? 'Hide Favorites' : 'Show Favorites'}
        </p>
      </div>
    </div>
  );
};

export default FavoritesToggleButton;
