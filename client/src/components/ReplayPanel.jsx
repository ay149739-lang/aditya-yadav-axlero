import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, History, FastForward, RotateCcw, Lock, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReplayPanel({
  snapshots = [],
  onSelectSnapshot,
  isReplayMode,
  setIsReplayMode,
  onExitReplay
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 0.5, 1, 2
  const [isExpanded, setIsExpanded] = useState(true);

  const playbackTimerRef = useRef(null);

  // Synchronize initial index when snapshots change
  useEffect(() => {
    if (snapshots.length > 0 && currentIndex >= snapshots.length) {
      setCurrentIndex(snapshots.length - 1);
    }
  }, [snapshots]);

  // Handle auto-playback loop
  useEffect(() => {
    if (isPlaying && snapshots.length > 0) {
      const intervalMs = 1500 / speed;
      playbackTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= snapshots.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          if (onSelectSnapshot && snapshots[next]) {
            onSelectSnapshot(snapshots[next]);
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, snapshots, speed, onSelectSnapshot]);

  const handleSliderChange = (e) => {
    const idx = parseInt(e.target.value, 10);
    setCurrentIndex(idx);
    if (!isReplayMode) setIsReplayMode(true);
    if (onSelectSnapshot && snapshots[idx]) {
      onSelectSnapshot(snapshots[idx]);
    }
  };

  const handlePlayPause = () => {
    if (!isReplayMode) {
      setIsReplayMode(true);
      if (onSelectSnapshot && snapshots[currentIndex]) {
        onSelectSnapshot(snapshots[currentIndex]);
      }
    }
    if (currentIndex >= snapshots.length - 1) {
      setCurrentIndex(0);
      if (onSelectSnapshot && snapshots[0]) onSelectSnapshot(snapshots[0]);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    if (onExitReplay) onExitReplay();
  };

  const handleReset = () => {
    setCurrentIndex(0);
    if (onSelectSnapshot && snapshots[0]) {
      onSelectSnapshot(snapshots[0]);
    }
  };

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '--:--:--';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  };

  const currentSnapshot = snapshots[currentIndex] || null;

  return (
    <div className="w-full bg-[#0D0D0D] border-t border-white/10 select-none z-40 relative">
      {/* Header bar / Banner */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-black/60 border-b border-white/5 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <History size={14} className="text-indigo-400" />
            <span>Workspace Replay Timeline</span>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          <span className="text-[11px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
            {snapshots.length} Snapshot{snapshots.length !== 1 ? 's' : ''}
          </span>

          {isReplayMode && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono flex items-center gap-1">
              <Lock size={10} /> REPLAY MODE ACTIVE (READ-ONLY)
            </span>
          )}
        </div>

        {isReplayMode && (
          <button
            onClick={handleStop}
            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
          >
            Exit Replay
          </button>
        )}
      </div>

      {/* Expanded Controls Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-3 px-4 flex flex-col md:flex-row items-center gap-4"
          >
            {/* Playback action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayPause}
                disabled={snapshots.length === 0}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-40"
                title={isPlaying ? 'Pause Replay' : 'Start Replay'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button
                onClick={handleStop}
                disabled={!isReplayMode}
                className="bg-white/5 hover:bg-white/10 text-gray-300 p-2 rounded-xl border border-white/10 transition-colors cursor-pointer disabled:opacity-40"
                title="Stop Replay"
              >
                <Square size={16} />
              </button>

              <button
                onClick={handleReset}
                disabled={snapshots.length === 0}
                className="bg-white/5 hover:bg-white/10 text-gray-300 p-2 rounded-xl border border-white/10 transition-colors cursor-pointer disabled:opacity-40"
                title="Reset to beginning"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <span className="text-[10px] text-gray-500 px-1 font-mono">SPEED:</span>
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                    speed === s ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Timeline Slider */}
            <div className="flex-1 w-full flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={snapshots.length > 0 ? snapshots.length - 1 : 0}
                value={currentIndex}
                onChange={handleSliderChange}
                disabled={snapshots.length === 0}
                className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg appearance-none disabled:opacity-40"
              />

              <div className="flex items-center gap-1 text-xs font-mono text-gray-400 min-w-[120px] justify-end">
                <Clock size={12} className="text-indigo-400" />
                <span>{currentSnapshot ? formatTimestamp(currentSnapshot.timestamp) : 'No Snapshots'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
