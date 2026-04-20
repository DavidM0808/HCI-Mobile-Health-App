import React, { useReducer, useEffect, useState, useRef } from 'react';
import {
  Check,
  Clock,
  Bell,
  Pill,
  RefreshCw,
  ChevronLeft,
  AlertTriangle,
  Home as HomeIcon,
  ClipboardList,
  Stethoscope,
  User,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------- Constants ----------

const FONT_STACK =
  'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const TODAY_LABEL = 'Tue Apr 21';
const NOW_24 = '21:01'; // simulated "now" for this prototype

// ---------- Seed state ----------

const initialState = {
  screen: 'schedule',
  takeLogMedId: null,
  meds: [
    {
      id: 'm_metformin',
      name: 'Metformin',
      dose: '500mg',
      instructions: '1 tablet with food',
      schedule: ['07:00', '13:00', '19:00'],
      daysRemaining: 22,
      adherence30d: 0.94,
    },
    {
      id: 'm_lisinopril',
      name: 'Lisinopril',
      dose: '10mg',
      instructions: '1 tablet, evening',
      schedule: ['21:00'],
      daysRemaining: 5,
      adherence30d: 0.71,
    },
    {
      id: 'm_atorvastatin',
      name: 'Atorvastatin',
      dose: '20mg',
      instructions: '1 tablet, evening',
      schedule: ['21:00'],
      daysRemaining: 14,
      adherence30d: 0.82,
    },
  ],
  doses: [
    { id: 'd1', medId: 'm_metformin',    scheduledAt: '07:00', status: 'taken',   takenAt: '07:08', snoozedUntil: null },
    { id: 'd2', medId: 'm_metformin',    scheduledAt: '13:00', status: 'taken',   takenAt: '13:02', snoozedUntil: null },
    { id: 'd3', medId: 'm_metformin',    scheduledAt: '19:00', status: 'taken',   takenAt: '19:14', snoozedUntil: null },
    { id: 'd4', medId: 'm_lisinopril',   scheduledAt: '21:00', status: 'dueSoon', takenAt: null,    snoozedUntil: null },
    { id: 'd5', medId: 'm_atorvastatin', scheduledAt: '21:00', status: 'pending', takenAt: null,    snoozedUntil: null },
  ],
  weeklyAdherence: [
    { day: 'Mon', total: 5, takenOnTime: 4, takenLate: 1, missed: 0, skipped: 0, isFuture: false },
    { day: 'Tue', total: 5, takenOnTime: 3, takenLate: 0, missed: 0, skipped: 0, isFuture: false },
    { day: 'Wed', total: 0, takenOnTime: 0, takenLate: 0, missed: 0, skipped: 0, isFuture: true },
    { day: 'Thu', total: 0, takenOnTime: 0, takenLate: 0, missed: 0, skipped: 0, isFuture: true },
    { day: 'Fri', total: 0, takenOnTime: 0, takenLate: 0, missed: 0, skipped: 0, isFuture: true },
    { day: 'Sat', total: 0, takenOnTime: 0, takenLate: 0, missed: 0, skipped: 0, isFuture: true },
    { day: 'Sun', total: 0, takenOnTime: 0, takenLate: 0, missed: 0, skipped: 0, isFuture: true },
  ],
  refillRequested: { m_lisinopril: false },
  toast: null,
  lockNotifMedId: 'm_lisinopril',
  modal: null,
  emptyMessage: null,
};

// ---------- Helpers ----------

function formatTime12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function subMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  let total = h * 60 + m - mins;
  if (total < 0) total += 24 * 60;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h * 60 + m + mins) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// ---------- Reducer ----------

function reducer(state, action) {
  switch (action.type) {
    case 'GO': {
      const next = { ...state, screen: action.screen };
      if ('emptyMessage' in action) next.emptyMessage = action.emptyMessage;
      else if (action.screen !== 'empty') next.emptyMessage = null;
      return next;
    }
    case 'OPEN_TAKE_LOG':
      return { ...state, screen: 'takeLog', takeLogMedId: action.medId };
    case 'LOG_DOSE': {
      const doses = state.doses.map(d =>
        d.id === action.doseId
          ? { ...d, status: 'taken', takenAt: action.takenAt, snoozedUntil: null }
          : d
      );
      return { ...state, doses, toast: action.toast ?? state.toast };
    }
    case 'SNOOZE_DOSE': {
      const doses = state.doses.map(d =>
        d.id === action.doseId
          ? { ...d, status: 'snoozed', snoozedUntil: action.snoozedUntil }
          : d
      );
      return { ...state, doses };
    }
    case 'SKIP_DOSE': {
      const doses = state.doses.map(d =>
        d.id === action.doseId ? { ...d, status: 'skipped' } : d
      );
      return { ...state, doses, modal: null };
    }
    case 'REQUEST_REFILL':
      return {
        ...state,
        refillRequested: { ...state.refillRequested, [action.medId]: true },
        toast: { text: 'Refill requested from CVS Shadyside', type: 'success' },
      };
    case 'SHOW_TOAST':
      return { ...state, toast: action.toast };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'OPEN_MODAL':
      return { ...state, modal: action.modal };
    case 'CLOSE_MODAL':
      return { ...state, modal: null };
    default:
      return state;
  }
}

// ---------- Status circle ----------

function StatusCircle({ status }) {
  if (status === 'taken') {
    return (
      <div className="w-7 h-7 rounded-full bg-[#5a8c4a] flex items-center justify-center">
        <Check size={16} strokeWidth={3} color="white" />
      </div>
    );
  }
  if (status === 'dueSoon') {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-[#d99a2b] flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-[#d99a2b]" />
      </div>
    );
  }
  if (status === 'snoozed') {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-[#d99a2b] flex items-center justify-center">
        <Clock size={14} color="#d99a2b" />
      </div>
    );
  }
  if (status === 'missed') {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-[#c54a4a] flex items-center justify-center">
        <span className="text-[#c54a4a] text-[14px] font-bold leading-none">!</span>
      </div>
    );
  }
  if (status === 'skipped') {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-[#888] flex items-center justify-center">
        <span className="text-[#888] text-[14px] leading-none">–</span>
      </div>
    );
  }
  return <div className="w-7 h-7 rounded-full border-2 border-[#d1ccbe]" />;
}

// ---------- Dose row ----------

function DoseRow({ dose, state, dispatch }) {
  const med = state.meds.find(m => m.id === dose.medId);
  const time12 = formatTime12(dose.scheduledAt);
  const rowBg = dose.status === 'dueSoon' ? 'bg-[#fdf6e7]' : 'bg-white';

  let caption = null;
  let captionTone = 'text-[#555]';
  if (dose.status === 'taken') caption = `taken ${formatTime12(dose.takenAt)}`;
  else if (dose.status === 'dueSoon') caption = 'due in 12 min';
  else if (dose.status === 'snoozed') caption = `snoozed — due ${formatTime12(dose.snoozedUntil)}`;
  else if (dose.status === 'skipped') { caption = 'skipped'; captionTone = 'text-[#888]'; }
  else if (dose.status === 'missed') { caption = `missed ${formatTime12(dose.scheduledAt)}`; captionTone = 'text-[#c54a4a]'; }

  const openTakeLog = () => dispatch({ type: 'OPEN_TAKE_LOG', medId: dose.medId });

  const toggleTaken = (e) => {
    if (e) e.stopPropagation();
    if (dose.status === 'taken') return;
    dispatch({
      type: 'LOG_DOSE',
      doseId: dose.id,
      takenAt: NOW_24,
      toast: { text: `${med.name} logged just now`, type: 'success' },
    });
  };

  const onKeyDown = (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      toggleTaken();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openTakeLog();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openTakeLog}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-3 p-3 rounded-[12px] border border-[#e5e1d6] ${rowBg} focus:outline-none focus:ring-2 focus:ring-[#5a8c4a] cursor-pointer`}
      aria-label={`${med.name} ${med.dose} — ${dose.status}, due at ${time12}`}
    >
      <div className="w-[56px] shrink-0 text-[14px] leading-[20px] font-semibold text-[#111]">
        {time12}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[16px] leading-[24px] font-semibold text-[#111]">
          {med.name} {med.dose}
        </div>
        <div className="text-[13px] leading-[18px] text-[#555]">
          {med.instructions}
        </div>
        {caption && (
          <div className={`text-[13px] leading-[18px] ${captionTone}`}>
            {caption}
          </div>
        )}
      </div>
      <button
        onClick={toggleTaken}
        aria-label={`Mark ${med.name} as ${dose.status === 'taken' ? 'not taken' : 'taken'}`}
        className="shrink-0 focus:outline-none focus:ring-2 focus:ring-[#5a8c4a] rounded-full"
      >
        <StatusCircle status={dose.status} />
      </button>
    </div>
  );
}

// ---------- Schedule screen ----------

function Schedule({ state, dispatch }) {
  const totalToday = state.doses.length;
  const doneToday = state.doses.filter(d =>
    ['taken', 'dueSoon', 'snoozed', 'skipped'].includes(d.status)
  ).length;
  const pct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

  const [progressWidth, setProgressWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setProgressWidth(pct), 50);
    return () => clearTimeout(t);
  }, [pct]);

  const refillMed = state.meds.find(m => m.daysRemaining <= 7);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto relative">
      <div className="relative">
        <div className="h-[56px] px-5 flex flex-col justify-center items-center text-center">
          <div className="text-[22px] leading-[28px] font-semibold text-[#111]">
            Today
          </div>
          <div className="text-[13px] leading-[18px] text-[#555]">
            {totalToday} doses · {TODAY_LABEL}
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'GO', screen: 'lockNotif' })}
          className="absolute top-3 right-5 h-[24px] px-2 rounded-full border border-[#e5e1d6] bg-white text-[11px] text-[#555] hover:bg-[#fbf8f1] focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
          aria-label="Show lock-screen reminder demo"
        >
          Demo notif
        </button>
      </div>

      <div className="px-5 pt-2 pb-4">
        <div className="flex justify-end text-[13px] leading-[18px] text-[#555] mb-1">
          {doneToday} of {totalToday} done
        </div>
        <div className="h-3 rounded-full bg-[#e5e1d6] overflow-hidden">
          <div
            className="h-full bg-[#5a8c4a] rounded-full transition-[width] duration-[600ms] ease-out"
            style={{ width: `${progressWidth}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${doneToday} of ${totalToday} doses done`}
          />
        </div>
      </div>

      {refillMed && (
        <div className="mx-5 mb-3 p-3 rounded-[12px] bg-[#fbeceb] border-l-4 border-[#c54a4a] flex items-center gap-3">
          <AlertTriangle size={16} color="#c54a4a" className="shrink-0" />
          <div className="flex-1 text-[14px] leading-[20px] text-[#111]">
            <span className="font-semibold">{refillMed.name}</span> — {refillMed.daysRemaining} days left
          </div>
          <button
            onClick={() => dispatch({ type: 'GO', screen: 'dashboard' })}
            className="px-3 h-[28px] rounded-full bg-[#5a8c4a] text-white text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#5a8c4a] focus:ring-offset-1"
          >
            Request refill
          </button>
        </div>
      )}

      <div className="px-5 pb-6 flex flex-col gap-2">
        {state.doses.map(d => (
          <DoseRow key={d.id} dose={d} state={state} dispatch={dispatch} />
        ))}
      </div>
    </div>
  );
}

// ---------- Lock screen notification ----------

function LockNotif({ state, dispatch }) {
  const med = state.meds.find(m => m.id === state.lockNotifMedId);
  const dose = state.doses.find(
    d => d.medId === state.lockNotifMedId && d.status !== 'taken' && d.status !== 'skipped'
  );
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const take = () => {
    if (!dose) return;
    dispatch({
      type: 'LOG_DOSE',
      doseId: dose.id,
      takenAt: NOW_24,
      toast: { text: `${med.name} logged at ${formatTime12(NOW_24)}`, type: 'success' },
    });
    dispatch({ type: 'GO', screen: 'schedule' });
  };

  const snooze = () => {
    if (!dose) return;
    dispatch({
      type: 'SNOOZE_DOSE',
      doseId: dose.id,
      snoozedUntil: addMinutes(NOW_24, 15),
    });
    dispatch({ type: 'GO', screen: 'schedule' });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center bg-[#1a2330] px-4">
      <div className="mt-8 text-center">
        <div
          className="text-white"
          style={{ fontSize: 56, lineHeight: '60px', fontWeight: 300 }}
        >
          9:01
        </div>
        <div className="text-[16px] leading-[24px] text-[#cbd5e1] mt-1">
          Tuesday, April 21
        </div>
      </div>

      <div
        className={`mt-10 w-[320px] bg-white rounded-[20px] p-4 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)] transition-all duration-[220ms] ease-out ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Pill size={14} color="#5a8c4a" />
          <span className="text-[13px] leading-[18px] text-[#555] font-medium">
            Health
          </span>
          <span className="ml-auto text-[13px] leading-[18px] text-[#888]">
            now
          </span>
        </div>
        <div className="text-[16px] leading-[24px] font-semibold text-[#111]">
          Time for {med.name} {med.dose}
        </div>
        <div className="text-[13px] leading-[18px] text-[#555]">
          Take 1 tablet · due 9:00 PM
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={take}
            className="flex-1 h-9 rounded-[12px] bg-[#5a8c4a] text-white text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#5a8c4a] focus:ring-offset-1"
          >
            Take now
          </button>
          <button
            onClick={snooze}
            className="flex-1 h-9 rounded-[12px] border-2 border-[#d99a2b] text-[#d99a2b] text-[14px] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#d99a2b] focus:ring-offset-1"
          >
            Snooze 15 min
          </button>
        </div>
      </div>

      <div className="mt-auto mb-8 text-[13px] text-[#94a3b8]">
        swipe up to open
      </div>
    </div>
  );
}

// ---------- Take + Log screen ----------

function TakeLog({ state, dispatch }) {
  const med = state.meds.find(m => m.id === state.takeLogMedId);
  const dose = state.doses.find(
    d => d.medId === state.takeLogMedId && d.status !== 'taken' && d.status !== 'skipped'
  );
  const [showEarlier, setShowEarlier] = useState(false);
  const [customTime, setCustomTime] = useState('');

  if (!med) return null;

  const lowRefill = med.daysRemaining <= 7;

  const logAt = (takenAt) => {
    if (!dose) return;
    dispatch({
      type: 'LOG_DOSE',
      doseId: dose.id,
      takenAt,
      toast: { text: `${med.name} logged at ${formatTime12(takenAt)}`, type: 'success' },
    });
    dispatch({ type: 'GO', screen: 'schedule' });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="h-[56px] flex items-center px-5 relative">
        <button
          onClick={() => dispatch({ type: 'GO', screen: 'schedule' })}
          className="absolute left-3 h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#f1ede2] focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
          aria-label="Back to schedule"
        >
          <ChevronLeft size={22} color="#111" />
        </button>
        <div className="flex-1 text-center text-[22px] leading-[28px] font-semibold text-[#111]">
          {med.name} {med.dose}
        </div>
      </div>

      <div className="flex justify-center py-5" aria-hidden="true">
        <svg width="120" height="50" viewBox="0 0 120 50">
          <defs>
            <clipPath id="pillLeft">
              <rect x="0" y="0" width="60" height="50" />
            </clipPath>
            <clipPath id="pillRight">
              <rect x="60" y="0" width="60" height="50" />
            </clipPath>
          </defs>
          <ellipse cx="60" cy="25" rx="58" ry="23" fill="#e8eef4" stroke="#1f1f1f" strokeWidth="1" clipPath="url(#pillLeft)" />
          <ellipse cx="60" cy="25" rx="58" ry="23" fill="#5a8c4a" stroke="#1f1f1f" strokeWidth="1" clipPath="url(#pillRight)" />
          <line x1="60" y1="3" x2="60" y2="47" stroke="#1f1f1f" strokeWidth="1" />
        </svg>
      </div>

      <div className="mx-5 mb-4 p-4 rounded-[12px] border border-[#e5e1d6] bg-white">
        <div className="text-[16px] leading-[24px] text-[#111]">Take 1 tablet</div>
        <div className="text-[13px] leading-[18px] text-[#555]">With or without food</div>
        <div className="text-[13px] leading-[18px] text-[#555]">Last taken: yesterday 9:04 PM</div>
        <div className="text-[13px] leading-[18px] text-[#555] flex items-center gap-2">
          {lowRefill && <span className="w-2 h-2 rounded-full bg-[#c54a4a]" aria-hidden="true" />}
          Refills remaining: {med.daysRemaining} days of pills left
        </div>
      </div>

      <div className="mx-5 mb-3 rounded-[16px] bg-[#fff7e6] p-1">
        <button
          onClick={() => logAt(NOW_24)}
          className="w-full h-14 rounded-[16px] bg-[#5a8c4a] text-white text-[18px] leading-[24px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#5a8c4a] focus:ring-offset-2"
        >
          Take now
        </button>
      </div>

      <div className="mx-5 mb-3 flex flex-col gap-2">
        <button
          onClick={() => setShowEarlier(v => !v)}
          aria-expanded={showEarlier}
          className="w-full h-12 rounded-[12px] border border-[#5a8c4a] text-[#5a8c4a] text-[14px] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
        >
          Took it earlier
        </button>
        {showEarlier && (
          <div className="p-3 rounded-[12px] bg-white border border-[#e5e1d6] flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {[15, 30, 60, 120].map(m => (
                <button
                  key={m}
                  onClick={() => logAt(subMinutes(NOW_24, m))}
                  className="px-3 h-8 rounded-full border border-[#e5e1d6] text-[13px] text-[#111] hover:bg-[#fbf8f1] focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
                >
                  {m < 60 ? `${m} min ago` : `${m / 60} hr ago`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="customTime" className="text-[13px] text-[#555]">
                Custom:
              </label>
              <input
                id="customTime"
                type="time"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
                className="px-2 h-8 rounded-md border border-[#e5e1d6] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
              />
              <button
                onClick={() => customTime && logAt(customTime)}
                disabled={!customTime}
                className="ml-auto px-3 h-8 rounded-full bg-[#5a8c4a] text-white text-[12px] font-semibold disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
              >
                Log
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'OPEN_MODAL', modal: 'skipConfirm' })}
          className="w-full h-12 rounded-[12px] border border-[#5a8c4a] text-[#5a8c4a] text-[14px] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
        >
          Skip / log late
        </button>
      </div>

      <div className="mx-5 mb-6 text-[13px] leading-[18px] text-[#555]">
        Skipping is honest — it is logged as intentionally skipped, not missed.
      </div>
    </div>
  );
}

// ---------- Dashboard ----------

function DashboardTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] text-white text-[12px] px-2 py-1 rounded">
      {payload[0].payload.tooltip}
    </div>
  );
}

function Dashboard({ state, dispatch }) {
  const target = 87;
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let start = null;
    let raf = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / 600, 1);
      setPct(Math.round(p * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => raf && cancelAnimationFrame(raf);
  }, []);

  const refillMed = state.meds.find(m => m.daysRemaining <= 7);
  const requested = refillMed ? state.refillRequested[refillMed.id] : false;

  const chartData = state.weeklyAdherence.map(d => {
    let color;
    if (d.isFuture) color = '#fbf8f1';
    else if (d.missed > 0) color = '#c54a4a';
    else if (d.takenLate > 0) color = '#d99a2b';
    else color = '#5a8c4a';

    const value = d.isFuture
      ? 50
      : d.total
        ? ((d.takenOnTime + d.takenLate) / d.total) * 100
        : 0;

    return {
      day: d.day[0],
      value,
      color,
      isFuture: d.isFuture,
      tooltip: d.isFuture
        ? `${d.day}: upcoming`
        : `${d.day}: ${d.takenOnTime + d.takenLate} of ${d.total} ${d.takenLate > 0 ? 'taken (some late)' : 'on time'}`,
    };
  });

  const chartSummary = state.weeklyAdherence
    .filter(d => !d.isFuture)
    .map(d => `${d.day} ${d.takenOnTime + d.takenLate} of ${d.total}`)
    .join(', ');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="h-[56px] flex items-center px-5 relative">
        <button
          onClick={() => dispatch({ type: 'GO', screen: 'schedule' })}
          className="absolute left-3 h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#f1ede2] focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
          aria-label="Back to schedule"
        >
          <ChevronLeft size={22} color="#111" />
        </button>
        <div className="flex-1 text-center text-[22px] leading-[28px] font-semibold text-[#111]">
          Adherence
        </div>
      </div>

      <div className="px-5 pt-2 pb-4">
        <div className="text-[13px] leading-[18px] text-[#555]">Last 30 days</div>
        <div
          style={{ fontSize: 44, lineHeight: '48px', fontWeight: 600 }}
          className="text-[#111]"
          aria-label={`${target} percent adherence over the last 30 days`}
        >
          {pct}%
        </div>
        <div className="text-[13px] leading-[18px] text-[#5a8c4a] flex items-center gap-1">
          <span aria-hidden="true">↑</span>
          <span>+6% vs last month</span>
        </div>
      </div>

      <div
        className="mx-5 mb-4"
        aria-label={`Daily adherence this week: ${chartSummary}`}
        role="img"
      >
        <div className="text-[14px] leading-[20px] font-semibold text-[#111] mb-2">
          This week
        </div>
        <div style={{ width: '100%', height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap={8} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#555', fontSize: 12 }}
              />
              <Tooltip content={<DashboardTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    stroke={entry.isFuture ? '#e5e1d6' : 'none'}
                    strokeWidth={entry.isFuture ? 1 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {refillMed && (
        <div className="mx-5 mb-4 p-4 rounded-[12px] bg-[#fbeceb] border-l-4 border-[#c54a4a]">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} color="#c54a4a" />
            <span className="text-[16px] leading-[24px] font-semibold text-[#111]">
              Refill needed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-[14px] leading-[20px] text-[#555]">
              {refillMed.name} {refillMed.dose} · {refillMed.daysRemaining} days left
            </div>
            <button
              onClick={() => !requested && dispatch({ type: 'REQUEST_REFILL', medId: refillMed.id })}
              disabled={requested}
              className={
                requested
                  ? 'px-3 h-8 rounded-full border border-[#5a8c4a] text-[#5a8c4a] bg-white text-[12px] font-semibold'
                  : 'px-3 h-8 rounded-full bg-[#5a8c4a] text-white text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#5a8c4a] focus:ring-offset-1'
              }
              aria-label={requested ? 'Refill requested' : 'Request refill'}
            >
              {requested ? 'Requested ✓' : 'Request refill'}
            </button>
          </div>
        </div>
      )}

      <div className="mx-5 mb-4 p-4 rounded-[12px] border border-[#e5e1d6] bg-white">
        <div className="text-[14px] leading-[20px] font-semibold text-[#111] mb-3">
          By medication
        </div>
        <div className="flex flex-col gap-3">
          {state.meds.map(m => (
            <button
              key={m.id}
              onClick={() =>
                dispatch({
                  type: 'GO',
                  screen: 'empty',
                  emptyMessage: 'Per-medication detail: out of scope for this prototype.',
                })
              }
              className="text-left focus:outline-none focus:ring-2 focus:ring-[#5a8c4a] rounded"
              aria-label={`${m.name} ${m.dose}, ${Math.round(m.adherence30d * 100)} percent on time over 30 days`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-[14px] leading-[20px] text-[#111]">
                  {m.name} {m.dose}
                </div>
                <div className="text-[13px] leading-[18px] text-[#555]">
                  {Math.round(m.adherence30d * 100)}%
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-[#e5e1d6] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#5a8c4a]"
                  style={{ width: `${m.adherence30d * 100}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-5 mb-6 p-3 rounded-[12px] border border-[#5a8c4a] bg-white text-[14px] text-[#111] text-center">
        7-day streak — keep it up
      </div>
    </div>
  );
}

// ---------- Empty state ----------

function EmptyState({ state }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-24 h-24 rounded-full border border-[#e5e1d6] flex items-center justify-center mb-4">
        <Bell size={32} color="#888" />
      </div>
      <div className="text-[16px] leading-[24px] font-semibold text-[#111]">
        This tab is owned by another teammate.
      </div>
      <div className="text-[13px] leading-[18px] text-[#555] mt-2">
        {state.emptyMessage ?? 'Out of scope for the Medication Adherence prototype.'}
      </div>
    </div>
  );
}

// ---------- Skip confirm modal ----------

function SkipConfirm({ state, dispatch }) {
  const dose = state.doses.find(
    d => d.medId === state.takeLogMedId && d.status !== 'taken' && d.status !== 'skipped'
  );
  const med = state.meds.find(m => m.id === state.takeLogMedId);

  const confirm = () => {
    if (dose) dispatch({ type: 'SKIP_DOSE', doseId: dose.id });
    dispatch({ type: 'GO', screen: 'schedule' });
    dispatch({
      type: 'SHOW_TOAST',
      toast: { text: `${med?.name ?? 'Dose'} skipped`, type: 'info' },
    });
  };

  return (
    <div className="absolute inset-0 bg-black/40 z-30 flex items-end" role="dialog" aria-modal="true" aria-labelledby="skipTitle">
      <div className="w-full bg-white rounded-t-[20px] p-5">
        <div id="skipTitle" className="text-[18px] leading-[24px] font-semibold text-[#111] mb-2">
          Skip this dose?
        </div>
        <div className="text-[14px] leading-[20px] text-[#555] mb-4">
          This is logged as intentionally skipped, not missed. Your adherence
          percentage adjusts accordingly.
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={confirm}
            className="w-full h-12 rounded-[12px] bg-[#c54a4a] text-white text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#c54a4a] focus:ring-offset-1"
          >
            Yes, skip
          </button>
          <button
            onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
            className="w-full h-12 rounded-[12px] border border-[#5a8c4a] text-[#5a8c4a] text-[14px] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#5a8c4a]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Tab bar ----------

function TabBar({ state, dispatch }) {
  const tabs = [
    { key: 'home', label: 'Home', icon: HomeIcon },
    { key: 'log',  label: 'Log',  icon: ClipboardList },
    { key: 'care', label: 'Care', icon: Stethoscope },
    { key: 'you',  label: 'You',  icon: User },
  ];

  const careActive = ['schedule', 'takeLog', 'dashboard'].includes(state.screen);

  const onTab = (k) => {
    if (k === 'care') {
      dispatch({ type: 'GO', screen: 'schedule' });
    } else {
      dispatch({ type: 'GO', screen: 'empty', emptyMessage: null });
    }
  };

  return (
    <div className="h-[64px] border-t border-[#e5e1d6] flex items-stretch bg-[#fbf8f1] shrink-0">
      {tabs.map(t => {
        const Icon = t.icon;
        const active = t.key === 'care' ? careActive : false;
        return (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#5a8c4a]"
            aria-label={t.label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={18} color={active ? '#5a8c4a' : '#888'} />
            <span className={`text-[11px] ${active ? 'text-[#5a8c4a] font-semibold' : 'text-[#888]'}`}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Toast ----------

function Toast({ toast }) {
  return (
    <div
      className="absolute top-[40px] left-1/2 -translate-x-1/2 bg-[#111] text-white text-[13px] px-3 py-2 rounded-full z-40 shadow-lg"
      role="status"
      aria-live="polite"
    >
      {toast.text}
    </div>
  );
}

// ---------- Root ----------

export default function MedAdherence() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2400);
    return () => clearTimeout(t);
  }, [state.toast]);

  const isLock = state.screen === 'lockNotif';

  const [fadeKey, setFadeKey] = useState(0);
  const prevScreen = useRef(state.screen);
  useEffect(() => {
    if (prevScreen.current !== state.screen) {
      prevScreen.current = state.screen;
      setFadeKey(k => k + 1);
    }
  }, [state.screen]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#efece6] p-6"
      style={{ fontFamily: FONT_STACK }}
    >
      <div
        className={`w-[360px] h-[780px] rounded-[44px] border border-[#1f1f1f]/15 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.35)] overflow-hidden relative flex flex-col ${
          isLock ? 'bg-[#1a2330]' : 'bg-[#fbf8f1]'
        }`}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] h-[24px] bg-black rounded-b-2xl z-20" />

        <div
          className={`h-[28px] px-6 flex items-center justify-between text-[12px] font-semibold shrink-0 ${
            isLock ? 'text-white' : 'text-[#111]'
          }`}
        >
          <span>{isLock ? '9:01' : '9:41'}</span>
          <span>100%</span>
        </div>

        <div
          key={fadeKey}
          className="flex-1 min-h-0 flex flex-col relative"
          style={{ animation: 'medAdhFade 180ms ease-out' }}
        >
          {state.screen === 'schedule'  && <Schedule  state={state} dispatch={dispatch} />}
          {state.screen === 'lockNotif' && <LockNotif state={state} dispatch={dispatch} />}
          {state.screen === 'takeLog'   && <TakeLog   state={state} dispatch={dispatch} />}
          {state.screen === 'dashboard' && <Dashboard state={state} dispatch={dispatch} />}
          {state.screen === 'empty'     && <EmptyState state={state} />}
        </div>

        {!isLock && <TabBar state={state} dispatch={dispatch} />}
        {state.modal === 'skipConfirm' && <SkipConfirm state={state} dispatch={dispatch} />}
        {state.toast && <Toast toast={state.toast} />}

        <style>{`
          @keyframes medAdhFade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
