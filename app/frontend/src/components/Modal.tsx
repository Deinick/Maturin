import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';

export default function Modal({ open, className, style, backdropClassName, onBackdropClick, children }: {
  open: boolean;
  className?: string;
  style?: CSSProperties;
  backdropClassName?: string;
  onBackdropClick?: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={backdropClassName ?? 'fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onBackdropClick}
        >
          <motion.div
            className={className}
            style={style}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
