'use client';

import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

/**
 * BrandLogo - Circular silver metallic globe logo
 *
 * Reusable across all pages for consistent branding.
 * Uses SVG gradients to create a 3D metallic sphere effect.
 */
export default function BrandLogo({ size = 32, className = '' }: BrandLogoProps) {
  // Generate unique IDs to prevent conflicts when multiple logos are rendered
  const id = React.useId();

  return (
    <div
      className={`flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        filter: 'drop-shadow(0 0 3px rgba(200,225,255,0.4))'
      }}
    >
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          {/* Main metallic gradient - silver/steel look */}
          <radialGradient id={`globeGrad-${id}`} cx="32%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="20%" stopColor="#eef4fa" />
            <stop offset="50%" stopColor="#b8cfe0" />
            <stop offset="80%" stopColor="#6e8fa6" />
            <stop offset="100%" stopColor="#3a5568" />
          </radialGradient>

          {/* Highlight shine */}
          <radialGradient id={`shineGrad-${id}`} cx="30%" cy="24%" r="22%">
            <stop offset="0%" stopColor="rgba(255,255,255,1)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Edge shadow for depth */}
          <radialGradient id={`rimGrad-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
          </radialGradient>

          {/* Outer glow */}
          <radialGradient id={`glowRing-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="rgba(180,215,255,0)" />
            <stop offset="85%" stopColor="rgba(180,215,255,0.15)" />
            <stop offset="100%" stopColor="rgba(180,215,255,0.35)" />
          </radialGradient>
        </defs>

        {/* Base metallic sphere */}
        <circle cx="50" cy="50" r="49" fill={`url(#globeGrad-${id})`} />

        {/* Rim shadow */}
        <circle cx="50" cy="50" r="49" fill={`url(#rimGrad-${id})`} />

        {/* Outer glow ring */}
        <circle cx="50" cy="50" r="49" fill={`url(#glowRing-${id})`} />

        {/* Top highlight shine */}
        <circle cx="50" cy="50" r="49" fill={`url(#shineGrad-${id})`} />

        {/* Secondary highlight ellipse */}
        <ellipse
          cx="38"
          cy="32"
          rx="10"
          ry="7"
          fill="rgba(255,255,255,0.25)"
          transform="rotate(-20 38 32)"
        />
      </svg>
    </div>
  );
}
