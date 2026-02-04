import React, { useMemo } from 'react';
import { WritingEvent, EventName } from '../types';

interface AnalyticsPanelProps {
  logs: WritingEvent[];
  sessionId: string;
}

// Quick cosine similarity on simple token counts for tagging user text vs AI outputs
const similarity = (a: string, b: string): number => {
  const tokensA = a.toLowerCase().split(/\s+/);
  const tokensB = b.toLowerCase().split(/\s+/);
  const countsA: Record<string, number> = {};
  const countsB: Record<string, number> = {};
  tokensA.forEach(t => countsA[t] = (countsA[t] || 0) + 1);
  tokensB.forEach(t => countsB[t] = (countsB[t] || 0) + 1);
  const vocab = new Set([...Object.keys(countsA), ...Object.keys(countsB)]);
  let dot = 0, magA = 0, magB = 0;
  vocab.forEach(word => {
    const x = countsA[word] || 0;
    const y = countsB[word] || 0;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  });
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
};

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ logs, sessionId }) => {
  const sessionLogs = useMemo(() => logs.filter(l => l.session_id === sessionId), [logs, sessionId]);

  const cumulativeSeries = useMemo(() => {
    let total = 0;
    return sessionLogs
      .filter(l => l.event_name === EventName.ESSAY_WRITING)
      .sort((a, b) => a.event_start_time - b.event_start_time)
      .map(l => {
        const words = l.event_result?.split(/\s+/).filter(Boolean).length || 0;
        total = Math.max(total, words);
        return { time: l.event_start_time, words: total };
      });
  }, [sessionLogs]);

  const aiOutputs = useMemo(
    () => sessionLogs.filter(l => l.event_name === EventName.CHAT && l.event_by === 'AI').map(l => l.event_result).filter(Boolean),
    [sessionLogs]
  );

  const similarSnippets = useMemo(() => {
    const essays = sessionLogs.filter(l => l.event_name === EventName.ESSAY_WRITING);
    const flagged: { snippet: string; aiText: string; score: number; time: number }[] = [];
    essays.forEach(l => {
      const candidate = l.event_result || '';
      let best = 0;
      let bestAi = '';
      aiOutputs.forEach(ai => {
        const score = similarity(candidate, ai);
        if (score > best) {
          best = score;
          bestAi = ai;
        }
      });
      if (best > 0.75) {
        flagged.push({ snippet: candidate, aiText: bestAi, score: best, time: l.event_start_time });
      }
    });
    return flagged.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [sessionLogs, aiOutputs]);

  if (!sessionId) {
    return <div className="text-slate-400 font-medium">Select a session to view analytics.</div>;
  }

  return (
    <div className="space-y-10">
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 shadow-inner">
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Cumulative Words Over Time</h4>
        <div className="relative h-64 bg-white rounded-xl border border-slate-100 overflow-hidden">
          {cumulativeSeries.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-medium">No data</div>
          ) : (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <polyline
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2"
                points={cumulativeSeries.map((p, i) => {
                  const x = (i / Math.max(cumulativeSeries.length - 1, 1)) * 100;
                  const maxY = Math.max(...cumulativeSeries.map(c => c.words), 1);
                  const y = 100 - (p.words / maxY) * 95 - 2;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Possible AI-like Snippets</h4>
          <span className="text-[11px] font-bold text-slate-400">Top 5 by similarity</span>
        </div>
        {similarSnippets.length === 0 ? (
          <p className="text-slate-400 font-medium">No similar text detected.</p>
        ) : (
          <div className="space-y-4">
            {similarSnippets.map((s, idx) => (
              <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>{new Date(s.time).toLocaleTimeString()}</span>
                  <span className="font-black text-indigo-600">Similarity {(s.score * 100).toFixed(1)}%</span>
                </div>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Human Entry</div>
                <div className="text-sm text-slate-700 line-clamp-3 mb-3">{s.snippet}</div>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Most Similar AI Response</div>
                <div className="text-sm text-slate-700 line-clamp-3">{s.aiText}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPanel;
