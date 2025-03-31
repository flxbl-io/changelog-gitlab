'use client'
import { useState, useEffect } from 'react';

export default function Page() {
  const [iframeHeight, setIframeHeight] = useState('100%');

  useEffect(() => {
    const updateIframeHeight = () => {
      const windowHeight = window.innerHeight;
      const navHeight = 64; // Adjust this value based on your actual navigation height
      setIframeHeight(`${windowHeight - navHeight}px`);
    };

    updateIframeHeight();
    window.addEventListener('resize', updateIframeHeight);

    return () => window.removeEventListener('resize', updateIframeHeight);
  }, []);

  return (
    <main className="w-full h-full">
      <iframe 
        src="/static.html" 
        title="Static Content"
        className="w-full border-none"
        style={{ height: iframeHeight }}
      />
    </main>
  );
}