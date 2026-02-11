import React, { useMemo, useState } from 'react';
import { WritingEvent, EventName } from '../types';

interface AnalyticsPanelProps {
  logs: WritingEvent[];
  sessionId: string;
}

const toWords = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(Boolean);

type TokenSpan = { token: string; start: number; end: number };
type MatchBlock = { aStart: number; bStart: number; size: number };
type TextSpan = { start: number; end: number };

const tokenizeWithSpans = (text: string): TokenSpan[] => {
  const regex = /[a-z0-9']+/gi;
  const spans: TokenSpan[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    spans.push({
      token: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return spans;
};

const findLongestCommonBlock = (
  a: string[],
  b: string[],
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number
): MatchBlock => {
  const bLen = bHi - bLo;
  if (aLo >= aHi || bLo >= bHi || bLen <= 0) return { aStart: aLo, bStart: bLo, size: 0 };

  const prev = new Array<number>(bLen + 1).fill(0);
  let bestSize = 0;
  let bestAEnd = aLo;
  let bestBEnd = bLo;

  for (let i = aLo; i < aHi; i++) {
    const curr = new Array<number>(bLen + 1).fill(0);
    for (let j = bLo; j < bHi; j++) {
      if (a[i] === b[j]) {
        const val = prev[j - bLo] + 1;
        curr[j - bLo + 1] = val;
        if (val > bestSize) {
          bestSize = val;
          bestAEnd = i + 1;
          bestBEnd = j + 1;
        }
      }
    }
    for (let k = 0; k < curr.length; k++) prev[k] = curr[k];
  }

  return {
    aStart: bestAEnd - bestSize,
    bStart: bestBEnd - bestSize,
    size: bestSize,
  };
};

// Difflib-style matching blocks: recursively split around the best common contiguous block.
const findMatchingBlocks = (a: string[], b: string[], minMatchWords = 3): MatchBlock[] => {
  const pending: Array<{ aLo: number; aHi: number; bLo: number; bHi: number }> = [
    { aLo: 0, aHi: a.length, bLo: 0, bHi: b.length },
  ];
  const blocks: MatchBlock[] = [];

  while (pending.length) {
    const range = pending.pop()!;
    const best = findLongestCommonBlock(a, b, range.aLo, range.aHi, range.bLo, range.bHi);
    if (best.size < minMatchWords) continue;

    blocks.push(best);

    pending.push({ aLo: range.aLo, aHi: best.aStart, bLo: range.bLo, bHi: best.bStart });
    pending.push({
      aLo: best.aStart + best.size,
      aHi: range.aHi,
      bLo: best.bStart + best.size,
      bHi: range.bHi,
    });
  }

  return blocks.sort((x, y) => x.aStart - y.aStart);
};

const mergeRanges = (ranges: TextSpan[]): TextSpan[] => {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TextSpan[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
};

const blocksToCharRanges = (
  blocks: MatchBlock[],
  spans: TokenSpan[],
  side: 'a' | 'b'
): TextSpan[] => {
  const ranges: TextSpan[] = [];
  for (const block of blocks) {
    const tokenStart = side === 'a' ? block.aStart : block.bStart;
    const tokenEnd = tokenStart + block.size - 1;
    if (tokenStart < 0 || tokenEnd >= spans.length) continue;
    ranges.push({ start: spans[tokenStart].start, end: spans[tokenEnd].end });
  }
  return mergeRanges(ranges);
};

const highlightByRanges = (text: string, ranges: TextSpan[]): React.ReactNode => {
  if (!ranges.length) return text;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, idx) => {
    if (range.start > cursor) {
      nodes.push(<React.Fragment key={`t-${idx}`}>{text.slice(cursor, range.start)}</React.Fragment>);
    }
    nodes.push(
      <mark key={`m-${idx}`} className="bg-yellow-200 text-slate-900 px-1 rounded">
        {text.slice(range.start, range.end)}
      </mark>
    );
    cursor = range.end;
  });

  if (cursor < text.length) {
    nodes.push(<React.Fragment key="tail">{text.slice(cursor)}</React.Fragment>);
  }

  return nodes;
};

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ logs, sessionId }) => {
  const [highlightOverlaps, setHighlightOverlaps] = useState(false);
  const sessionLogs = useMemo(() => logs.filter(l => l.session_id === sessionId), [logs, sessionId]);

  const sessionStartTime = useMemo(() => {
    const explicitStart = sessionLogs
      .filter((l) => l.event_name === EventName.SYSTEM && l.event_result === 'SESSION_STARTED')
      .sort((a, b) => a.event_start_time - b.event_start_time)[0];
    if (explicitStart) return explicitStart.event_start_time;

    const earliest = [...sessionLogs].sort((a, b) => a.event_start_time - b.event_start_time)[0];
    return earliest?.event_start_time || 0;
  }, [sessionLogs]);

  const cumulativeSeries = useMemo(() => {
    let total = 0;
    return sessionLogs
      .filter(l => l.event_name === EventName.ESSAY_WRITING)
      .sort((a, b) => a.event_start_time - b.event_start_time)
      .map(l => {
        const words = l.event_result?.split(/\s+/).filter(Boolean).length || 0;
        total = Math.max(total, words);
        const elapsedSec = Math.max(0, Math.round((l.event_start_time - sessionStartTime) / 1000));
        return { time: l.event_start_time, elapsedSec, words: total };
      });
  }, [sessionLogs, sessionStartTime]);

  const chartMeta = useMemo(() => {
    if (cumulativeSeries.length === 0) {
      return {
        maxWords: 0,
        midWords: 0,
        endSeconds: 0,
        midSeconds: 0,
      };
    }
    const maxWords = Math.max(...cumulativeSeries.map((c) => c.words), 1);
    const midWords = Math.round(maxWords / 2);
    const endSeconds = Math.max(...cumulativeSeries.map((c) => c.elapsedSec), 1);
    const midSeconds = Math.round(endSeconds / 2);
    return {
      maxWords,
      midWords,
      endSeconds,
      midSeconds,
    };
  }, [cumulativeSeries]);

  const aiOutputs = useMemo(
    () => sessionLogs.filter(l => l.event_name === EventName.CHAT && l.event_by === 'AI').map(l => l.event_result).filter(Boolean),
    [sessionLogs]
  );

  const finalHumanSubmission = useMemo(() => {
    const submissionEvent = sessionLogs
      .filter((l) => l.event_name === EventName.SYSTEM && l.event_by === 'user')
      .sort((a, b) => b.event_start_time - a.event_start_time)
      .find((l) => /^USER_SUBMITTED:|^TIME_LIMIT_EXPIRED:/.test(l.event_result || ''));

    if (submissionEvent?.event_result) {
      return submissionEvent.event_result.replace(/^(USER_SUBMITTED|TIME_LIMIT_EXPIRED):\s*/i, '');
    }

    const lastEssay = sessionLogs
      .filter((l) => l.event_name === EventName.ESSAY_WRITING)
      .sort((a, b) => b.event_start_time - a.event_start_time)[0];

    return lastEssay?.event_result || '';
  }, [sessionLogs]);

  const totalAiOutput = useMemo(() => aiOutputs.join('\n\n'), [aiOutputs]);

  const overlapRanges = useMemo(() => {
    const humanSpans = tokenizeWithSpans(finalHumanSubmission);
    const aiSpans = tokenizeWithSpans(totalAiOutput);
    const humanTokens = humanSpans.map((s) => s.token);
    const aiTokens = aiSpans.map((s) => s.token);

    const blocks = findMatchingBlocks(humanTokens, aiTokens, 3);
    return {
      human: blocksToCharRanges(blocks, humanSpans, 'a'),
      ai: blocksToCharRanges(blocks, aiSpans, 'b'),
    };
  }, [finalHumanSubmission, totalAiOutput]);

  if (!sessionId) {
    return <div className="text-slate-400 font-medium">Select a session to view analytics.</div>;
  }

  return (
    <div className="space-y-10">
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 shadow-inner">
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Cumulative Words Over Time</h4>
        <div className="relative h-72 bg-white rounded-xl border border-slate-200 overflow-hidden p-4">
          {cumulativeSeries.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-medium">No data</div>
          ) : (
            <div className="h-full w-full">
              <div className="text-xs font-black text-slate-500 mb-2">Y: Cumulative Number of Words</div>
              <div className="relative h-[calc(100%-2.5rem)] border-l-2 border-b-2 border-slate-300">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  <line x1="0" y1="50" x2="100" y2="50" stroke="#e2e8f0" strokeWidth="0.8" />
                  <line x1="0" y1="0" x2="100" y2="0" stroke="#e2e8f0" strokeWidth="0.8" />
                  <polyline
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="1.4"
                    points={cumulativeSeries.map((p, i) => {
                      const x = (p.elapsedSec / Math.max(chartMeta.endSeconds, 1)) * 100;
                      const y = 100 - (p.words / Math.max(chartMeta.maxWords, 1)) * 100;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                </svg>
                <div className="absolute -left-12 top-0 text-[11px] font-bold text-slate-500">{chartMeta.maxWords}</div>
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">{chartMeta.midWords}</div>
                <div className="absolute -left-7 bottom-0 text-[11px] font-bold text-slate-400">0</div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] font-bold text-slate-500">0s</div>
                <div className="text-[11px] font-bold text-slate-400">{chartMeta.midSeconds}s</div>
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">X: Time (seconds from start)</div>
                <div className="text-[11px] font-bold text-slate-500">{chartMeta.endSeconds}s</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Final Submission vs Total AI Output</h4>
          <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-500 select-none">
            <input
              type="checkbox"
              checked={highlightOverlaps}
              onChange={(e) => setHighlightOverlaps(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
            />
            Highlight overlaps
          </label>
        </div>
        {(!finalHumanSubmission && !totalAiOutput) ? (
          <p className="text-slate-400 font-medium">No submission or AI output found for this session.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Final Human Submission</div>
                <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-[26rem] overflow-y-auto whitespace-pre-wrap">
                  {finalHumanSubmission
                    ? (highlightOverlaps ? highlightByRanges(finalHumanSubmission, overlapRanges.human) : finalHumanSubmission)
                    : <span className="text-slate-400 italic">No final submission found.</span>}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Total AI Output</div>
                <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-[26rem] overflow-y-auto whitespace-pre-wrap">
                  {totalAiOutput
                    ? (highlightOverlaps ? highlightByRanges(totalAiOutput, overlapRanges.ai) : totalAiOutput)
                    : <span className="text-slate-400 italic">No AI responses found.</span>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPanel;
