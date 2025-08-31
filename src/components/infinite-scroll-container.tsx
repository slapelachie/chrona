'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Spinner } from 'react-bootstrap';

interface InfiniteScrollContainerProps {
  children: React.ReactNode;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  className?: string;
}

export default function InfiniteScrollContainer({
  children,
  loading,
  hasMore,
  onLoadMore,
  threshold = 200,
  className = ''
}: InfiniteScrollContainerProps) {
  const loadingRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !loading) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  useEffect(() => {
    const loadingElement = loadingRef.current;
    
    if (!loadingElement) return;

    // Disconnect existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      handleIntersection,
      {
        root: null, // Use viewport as root
        rootMargin: `${threshold}px`, // Trigger when within threshold pixels
        threshold: 0.1 // Trigger when 10% visible
      }
    );

    observerRef.current.observe(loadingElement);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, threshold]);

  return (
    <div className={className}>
      {children}
      
      {/* Loading trigger element */}
      <div 
        ref={loadingRef}
        className="d-flex justify-content-center align-items-center py-4"
      >
        {loading && (
          <div className="d-flex align-items-center text-muted">
            <Spinner 
              animation="border" 
              size="sm" 
              className="me-2" 
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <span className="small">Loading more shifts...</span>
          </div>
        )}
        
        {!hasMore && !loading && (
          <div className="text-muted small">
            No more shifts to load
          </div>
        )}
      </div>
    </div>
  );
}