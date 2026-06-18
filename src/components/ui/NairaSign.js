import React from 'react';

export default function NairaSign({ size = 24, className = '', color = 'currentColor' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Draw a stylized Naira symbol (N with two horizontal strokes) */}
      <path d="M6 19V5l12 14V5" />
      <path d="M5 10h14" />
      <path d="M5 14h14" />
    </svg>
  );
}
