'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to track if a file is being dragged anywhere on the window.
 */
function useGlobalDrag() {
  const [isDragging, setIsDragging] = useState(false);
  // Use a counter to track nested dragenter/dragleave events.
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // Only set drag state if files are being dragged.
      if (
        e.dataTransfer?.types &&
        Array.from(e.dataTransfer.types).includes('Files')
      ) {
        dragCounter.current += 1;
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      // Decrement counter and update state when it reaches 0.
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    // Prevent default behavior to allow drops
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  return isDragging;
}

/**
 * Component that renders a full‑screen blur overlay when a file is being dragged.
 */
export function GlobalDragBlurOverlay() {
  const isDragging = useGlobalDrag();

  if (!isDragging) return null;

  return (
    // z-20 for overlay; ensure your dropzone has a higher z-index (e.g. z-30)
    <div className="fixed inset-0 z-10 pointer-events-none bg-transparent backdrop-blur-md" />
  );
}
