import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FeaturePresentationCard } from './featurePresentationCard';

interface TutorialOverlayProps {
  onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose }) => {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'rgba(5, 5, 10, 0.65)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
      className="fixed inset-0 z-[99999] h-screen w-screen max-h-screen max-w-screen flex flex-col items-center justify-between text-neutral-300 font-sans select-none overflow-hidden"
    >
      <div 
        className="absolute inset-0 z-[100000] h-screen w-screen flex flex-col items-center justify-start overflow-hidden bg-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <FeaturePresentationCard onClose={onClose} />
      </div>
    </motion.div>,
    document.body
  );
};
