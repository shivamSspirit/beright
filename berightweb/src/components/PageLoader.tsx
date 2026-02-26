'use client';

import { useState, useEffect } from 'react';

export default function PageLoader() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hide loader after component mounts (hydration complete)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`page-loader ${!isLoading ? 'hidden' : ''}`}>
      <div className="loader-logo">
        <span className="loader-icon">◉</span>
        <span className="loader-text">BeRight</span>
      </div>
      <div className="loader-spinner" />
    </div>
  );
}
