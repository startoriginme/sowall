import React, { useState, useRef, useEffect } from "react";

interface SlidingCaptchaProps {
  onSuccess: () => void;
  resetKey?: any;
}

export default function SlidingCaptcha({ onSuccess, resetKey }: SlidingCaptchaProps) {
  const [progress, setProgress] = useState(0);
  const [verified, setVerified] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    setProgress(0);
    setVerified(false);
  }, [resetKey]);

  const handleStart = (clientX: number) => {
    if (verified) return;
    isDragging.current = true;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current || verified || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const handleWidth = 44; // width of the dragging thumb
    const maxDistance = rect.width - handleWidth - 8; // account for container padding
    const currentX = clientX - rect.left - handleWidth / 2;
    let percent = Math.min(Math.max((currentX / maxDistance) * 100, 0), 100);

    setProgress(percent);

    if (percent >= 98) {
      setVerified(true);
      isDragging.current = false;
      setProgress(100);
      onSuccess();
    }
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!verified) {
      // Smooth reset back to 0
      let current = progress;
      const interval = setInterval(() => {
        current -= 15;
        if (current <= 0) {
          current = 0;
          clearInterval(interval);
        }
        setProgress(current);
      }, 16);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };
    const handleGlobalMouseUp = () => {
      handleEnd();
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };
    const handleGlobalTouchEnd = () => {
      handleEnd();
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchmove", handleGlobalTouchMove);
    window.addEventListener("touchend", handleGlobalTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
    };
  }, [progress, verified]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-12 bg-zinc-950/70 border border-zinc-800/80 rounded-xl flex items-center overflow-hidden p-1 select-none shadow-inner"
    >
      {/* Light filled background trail */}
      <div
        className="absolute left-1 top-1 bottom-1 bg-purple-500/10 rounded-lg transition-all duration-75"
        style={{ width: `calc(${progress}% + ${Math.max(0, 44 - progress * 0.44)}px)` }}
      />

      {/* Guide text - swipe to verify */}
      <div
        className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-extrabold uppercase tracking-widest pointer-events-none transition-opacity"
        style={{ opacity: verified ? 0 : 1 - progress / 100 }}
      >
        <span className="text-purple-400/90 animate-pulse">Drag slider to confirm &gt;&gt;</span>
      </div>

      {/* Success verified text */}
      <div
        className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-black uppercase tracking-widest pointer-events-none transition-opacity"
        style={{ opacity: verified ? 1 : progress / 100 }}
      >
        <span className="text-green-400">✓ Security Captcha Passed</span>
      </div>

      {/* Draggable thumb/button */}
      <div
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => {
          if (e.touches && e.touches[0]) {
            handleStart(e.touches[0].clientX);
          }
        }}
        className={`absolute h-10 w-11 top-1 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg transition-all ${
          verified
            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
            : "bg-purple-600 hover:bg-purple-500 text-white"
        }`}
        style={{
          left: `calc(${progress}% - ${progress * 0.44}px + 4px)`,
          touchAction: "none"
        }}
      >
        {verified ? (
          <span className="text-sm font-bold">✓</span>
        ) : (
          <span className="text-sm font-bold font-mono">»</span>
        )}
      </div>
    </div>
  );
}
