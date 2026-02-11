
import React, { useEffect } from 'react';

interface TimerProps {
  seconds: number;
  onTick: () => void;
  isActive: boolean;
}

const Timer: React.FC<TimerProps> = ({ seconds, onTick, isActive }) => {
  useEffect(() => {
    let interval: any;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        onTick();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds, onTick]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = seconds < 60;

  return (
    <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-mono text-xl font-bold border-2 transition-colors ${
      isLowTime ? 'bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]' : 'bg-[#ecfdf5] text-[#0F766E] border-[#34d399]'
    }`}>
      <i className={`fas fa-clock ${isLowTime ? 'animate-pulse' : ''}`}></i>
      <span>{formatTime(seconds)}</span>
    </div>
  );
};

export default Timer;
