import { useState, useEffect, useRef } from 'react';
import type { Habit, HabitLog } from '../types';
import { localDate } from '../utils/date';

function datePad(d: Date): string {
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  );
}

function friendlyDate(ds: string): string {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function getISODayNum(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon...7=Sun
}

function parseActiveDays(activeDays: string): Set<number> {
  return new Set(activeDays.split(',').map(Number));
}

function formatActiveDays(activeDays: string): string {
  const nums = activeDays.split(',').map(Number).sort((a, b) => a - b);
  if (nums.length === 7) return 'Daily';
  const labels = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (nums.length <= 3) return nums.map(n => labels[n]).join('/');
  return `${nums.length} days/wk`;
}

function computeLongestStreak(habit: Habit): number {
  const activeDayNums = parseActiveDays(habit.activeDays);
  const completed = new Set(habit.logs.filter(l => l.status === 'completed').map(l => l.date));
  const dates = [...completed].sort();
  if (dates.length === 0) return 0;
  let max = 0, cur = 0, prev: Date | null = null;
  for (const ds of dates) {
    const d = new Date(ds + 'T12:00:00');
    if (prev) {
      // Check if any active days between prev and d were missed
      const between = new Date(prev);
      between.setDate(between.getDate() + 1);
      let hasGap = false;
      while (between < d) {
        const bs = datePad(between);
        if (activeDayNums.has(getISODayNum(between)) && !completed.has(bs)) {
          hasGap = true;
          break;
        }
        between.setDate(between.getDate() + 1);
      }
      cur = hasGap ? 1 : cur + 1;
    } else {
      cur = 1;
    }
    max = Math.max(max, cur);
    prev = d;
  }
  return max;
}

function computeCurrentStreak(habit: Habit): number {
  const activeDayNums = parseActiveDays(habit.activeDays);
  const todayStr = localDate();
  const todayIsActive = activeDayNums.has(getISODayNum(new Date()));
  const todayDone = habit.logs.find(l => l.date === todayStr)?.status === 'completed';

  let streak = 0;
  const d = new Date();
  if (!todayIsActive || (todayIsActive && !todayDone)) d.setDate(d.getDate() - 1);

  for (let i = 0; i < 730; i++) {
    const dayNum = getISODayNum(d);
    if (!activeDayNums.has(dayNum)) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    const ds = datePad(d);
    if (habit.logs.find(l => l.date === ds)?.status === 'completed') {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function buildYearGrid(year: number): string[][] {
  const weeks: string[][] = [];
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const daysBack = (jan1.getDay() + 6) % 7;
  const cur = new Date(jan1);
  cur.setDate(cur.getDate() - daysBack);
  while (cur <= dec31) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cur.getFullYear() === year ? datePad(cur) : '');
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['M','T','W','T','F','S','S'];

const DIFF_COLOR: Record<string, string> = {
  easy:   'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard:   'bg-rose-100 text-rose-700',
};

interface TooltipState {
  date: string;
  x: number;
  y: number;
  closing: boolean;
}

interface Props { habits: Habit[]; onClose: () => void; }

export default function HabitRecordModal({ habits, onClose }: Props) {
  const [selected, setSelected] = useState<Habit | null>(null);
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full flex flex-col"
        style={{ maxWidth: '820px', maxHeight: '92vh' }}>
        {selected
          ? <HabitDetail habit={selected} onBack={() => setSelected(null)} onClose={onClose} />
          : <HabitList   habits={habits}  onSelect={setSelected}           onClose={onClose} />}
      </div>
    </div>
  );
}

function HabitList({ habits, onSelect, onClose }: {
  habits: Habit[]; onSelect: (h: Habit) => void; onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between px-7 pt-7 pb-5 border-b border-stone-100 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-stone-800">Full Habit Record</h2>
          <p className="text-sm text-stone-400 mt-0.5">Complete history of every habit you track</p>
        </div>
        <button onClick={onClose} className="text-stone-300 hover:text-stone-500 text-2xl leading-none ml-4">×</button>
      </div>
      <div className="px-7 py-5 space-y-2.5 overflow-y-auto">
        {habits.length === 0
          ? <p className="text-sm text-stone-400 text-center py-12">No habits tracked yet.</p>
          : habits.map(habit => {
              const streak  = computeCurrentStreak(habit);
              const total   = habit.logs.filter(l => l.status === 'completed').length;
              const longest = computeLongestStreak(habit);
              return (
                <button key={habit.id} onClick={() => onSelect(habit)}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-100 hover:border-stone-200 transition-all text-left group">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-stone-800">{habit.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${DIFF_COLOR[habit.difficulty] ?? 'bg-stone-100 text-stone-500'}`}>
                        {habit.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {total} completed · best streak {longest}d · {formatActiveDays(habit.activeDays)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {streak > 0 && <span className="text-xs text-amber-500 font-medium">🔥 {streak}d</span>}
                    <span className="text-stone-300 group-hover:text-stone-500 transition-colors">→</span>
                  </div>
                </button>
              );
            })}
      </div>
    </>
  );
}

function HabitDetail({ habit, onBack, onClose }: {
  habit: Habit; onBack: () => void; onClose: () => void;
}) {
  const currentYear    = new Date().getFullYear();
  const createdDateStr = datePad(new Date(habit.createdAt));
  const createdYear    = new Date(habit.createdAt).getFullYear();
  const logYears       = habit.logs.map(l => parseInt(l.date.slice(0, 4)));
  const minYear        = Math.min(createdYear, logYears.length > 0 ? Math.min(...logYears) : currentYear);

  const [year, setYear]       = useState(currentYear);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDayNums = parseActiveDays(habit.activeDays);

  useEffect(() => {
    if (!tooltip) return;
    function handleOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-square]')) closeTooltip();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [tooltip]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const logMap: Record<string, string> = {};
  for (const l of habit.logs) logMap[l.date] = l.status;

  const weeks  = buildYearGrid(year);
  const today  = localDate();

  const monthLabels: (string | null)[] = weeks.map((week, i) => {
    const first = week.find(d => d !== '');
    if (!first) return null;
    const m = parseInt(first.slice(5, 7)) - 1;
    if (i === 0) return MONTH_LABELS[m];
    const prev = weeks[i - 1].find(d => d !== '');
    if (!prev) return MONTH_LABELS[m];
    return parseInt(prev.slice(5, 7)) - 1 !== m ? MONTH_LABELS[m] : null;
  });

  const longestStreak  = computeLongestStreak(habit);
  const currentStreak  = computeCurrentStreak(habit);
  const totalCompleted = habit.logs.filter(l => l.status === 'completed').length;
  const yearCompleted  = habit.logs.filter(l => l.date.startsWith(`${year}-`) && l.status === 'completed').length;
  const createdLabel   = new Date(habit.createdAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  function squareColor(date: string): string {
    const isBefore = date < createdDateStr;
    const isFuture = date > today;
    if (isBefore || isFuture) return 'bg-stone-200';
    const d = new Date(date + 'T00:00:00');
    if (!activeDayNums.has(getISODayNum(d))) return 'bg-stone-100';
    const status = logMap[date];
    if (status === 'completed') return 'bg-emerald-500 hover:bg-emerald-600';
    if (status === 'skipped')   return 'bg-red-400 hover:bg-red-500';
    return 'bg-stone-200 hover:bg-stone-300';
  }

  function handleSquareClick(e: React.MouseEvent<HTMLButtonElement>, date: string) {
    if (tooltip?.date === date && !tooltip.closing) {
      closeTooltip();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ date, x: rect.left + rect.width / 2, y: rect.top - 8, closing: false });
  }

  function closeTooltip() {
    setTooltip(prev => prev ? { ...prev, closing: true } : null);
    closeTimer.current = setTimeout(() => setTooltip(null), 160);
  }

  return (
    <>
      <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-stone-100 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="text-sm text-stone-400 hover:text-stone-600 transition-colors shrink-0">←</button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-stone-800 truncate">{habit.name}</h2>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize shrink-0 ${DIFF_COLOR[habit.difficulty] ?? 'bg-stone-100 text-stone-500'}`}>
                {habit.difficulty}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">Started {createdLabel} · {formatActiveDays(habit.activeDays)}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-stone-300 hover:text-stone-500 text-2xl leading-none ml-4 shrink-0">×</button>
      </div>

      <div className="px-7 pt-6 pb-7 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Current streak"      value={currentStreak  > 0 ? `🔥 ${currentStreak}d`  : '—'} />
          <StatCard label="Longest streak ever" value={longestStreak  > 0 ? `${longestStreak}d`       : '—'} />
          <StatCard label="Total completed"     value={`${totalCompleted} days`} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-stone-700">{year}</span>
            <span className="text-xs text-stone-400 ml-2">{yearCompleted} completed days</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setTooltip(null); setYear(y => y - 1); }}
              disabled={year <= minYear}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">←</button>
            <button onClick={() => { setTooltip(null); setYear(y => y + 1); }}
              disabled={year >= currentYear}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">→</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="flex gap-[3px] mb-1.5 ml-5">
              {weeks.map((_, i) => (
                <div key={i} className="w-3.5 text-[9px] text-stone-400 leading-none">{monthLabels[i] ?? ''}</div>
              ))}
            </div>

            <div className="flex gap-[3px]">
              <div className="flex flex-col gap-[3px] mr-1">
                {DAY_LABELS.map((d, i) => (
                  <div key={i} className="w-3.5 h-3.5 flex items-center justify-center text-[9px] text-stone-300 leading-none">
                    {i % 2 === 0 ? d : ''}
                  </div>
                ))}
              </div>

              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((date, di) => {
                    if (!date) return <div key={di} className="w-3.5 h-3.5" />;
                    const isActive = tooltip?.date === date && !tooltip.closing;
                    return (
                      <button
                        key={di}
                        data-square="true"
                        onClick={e => handleSquareClick(e, date)}
                        className={`w-3.5 h-3.5 rounded-[2px] transition-colors cursor-pointer
                          ${squareColor(date)}
                          ${isActive ? 'ring-2 ring-stone-500 ring-offset-0' : ''}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-3 ml-5 flex-wrap">
              <div className="w-3 h-3 rounded-[2px] bg-stone-100" />
              <span className="text-[10px] text-stone-400">Off day</span>
              <div className="w-px h-3 bg-stone-200 mx-0.5" />
              <div className="w-3 h-3 rounded-[2px] bg-stone-200" />
              <span className="text-[10px] text-stone-400">No entry</span>
              <div className="w-px h-3 bg-stone-200 mx-0.5" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-500" />
              <span className="text-[10px] text-stone-400">Completed</span>
              <div className="w-px h-3 bg-stone-200 mx-0.5" />
              <div className="w-3 h-3 rounded-[2px] bg-red-400" />
              <span className="text-[10px] text-stone-400">Skipped</span>
            </div>
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className={`fixed z-[200] pointer-events-none select-none ${tooltip.closing ? 'bubble-out' : 'bubble-in'}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="bg-stone-800 text-white rounded-xl px-3 py-2 shadow-xl text-center"
            style={{ transform: 'translateX(-50%) translateY(-100%)', whiteSpace: 'nowrap' }}>
            <p className="text-xs font-medium leading-snug">{friendlyDate(tooltip.date)}</p>
            {(() => {
              const d = new Date(tooltip.date + 'T00:00:00');
              const isOffDay = !activeDayNums.has(getISODayNum(d));
              if (isOffDay) return <p className="text-[10px] mt-0.5 text-stone-400 font-semibold">off day</p>;
              if (logMap[tooltip.date]) return (
                <p className={`text-[10px] mt-0.5 font-semibold ${logMap[tooltip.date] === 'completed' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {logMap[tooltip.date] === 'completed' ? '✓ completed' : '× skipped'}
                </p>
              );
              return null;
            })()}
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: '50%',
            transform: 'translateX(-50%) translateY(100%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #292524',
          }} />
        </div>
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
      <p className="text-xs text-stone-400 mb-1.5 leading-tight">{label}</p>
      <p className="text-sm font-semibold text-stone-800">{value}</p>
    </div>
  );
}

// Keep backward compat – HabitLog still used via Habit.logs
export type { HabitLog };
