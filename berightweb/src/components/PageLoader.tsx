'use client';

import { useState, useEffect } from 'react';
import BrandLogo from './BrandLogo';

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
        <BrandLogo size={48} className="loader-sphere" />
        <span className="loader-text">beright AI</span>
      </div>
    </div>
  );
}
