import React, { useReducer, useEffect, useMemo } from 'react';
import {
  Check,
  ChevronLeft,
  Heart,
  Plus,
  Minus,
  Home as HomeIcon,
  PlusCircle,
  Stethoscope,
  User,
} from 'lucide-react';

// ---------- Static data ----------

const MOOD_OPTIONS = [
  { key: 'awful', label: 'Awful' },
  { key: 'low',   label: 'Low' },
  { key: 'ok',    label: 'OK' },
  { key: 'good',  label: 'Good' },
  { key: 'great', label: 'Great' },
];

const ENERGY_OPTIONS = [
  { key: 'low',    label: 'Low' },
  { key: 'steady', label: 'Steady' },
  { key: 'strong', label: 'Strong' },
];

const SYMPTOMS = [
  'Headache',
  'Dizziness',
  'Nausea',
  'Cough',
  'Fatigue',
  'Pain',
  'Swelling',
  'Shortness of breath',
  'None',
];

const VITAL_SEGMENTS = [
  { key: 'bp',      label: 'BP' },
  { key: 'glucose', label: 'Glucose' },
  { key: 'weight',  label: 'Weight' },
];

// ---------- State ----------

const initialLog = {
  mood: null,
  energy: null,
  symptoms: [],
  bp: null,
  glucose: null,
  weight: null,
};

const initialUi = {
  screen: 'home',
  emptyTab: null,
  vitalsActive: 'bp',
  bpStage: 'systolic',
  bpSystolicBuffer: '',
  pendingDigits: '',
  streak: 6,
  loggedToday: false,
  bumpKey: 0,
  returnTo: null,
};

function logReducer(state, action) {
  switch (action.type) {
    case 'SET_MOOD':    return { ...state, mood: action.value };
    case 'SET_ENERGY':  return { ...state, energy: action.value };
    case 'TOGGLE_SYMPTOM': {
      const s = action.value;
      if (s === 'None') {
        return {
          ...state,
          symptoms: state.symptoms.includes('None') ? [] : ['None'],
        };
      }
      const without = state.symptoms.filter(x => x !== 'None');
      return {
        ...state,
        symptoms: without.includes(s)
          ? without.filter(x => x !== s)
          : [...without, s],
      };
    }
    case 'SET_BP':      return { ...state, bp: action.value };
    case 'SET_GLUCOSE': return { ...state, glucose: action.value };
    case 'SET_WEIGHT':  return { ...state, weight: action.value };
    case 'RESET':       return initialLog;
    default:            return state;
  }
}

function uiReducer(state, action) {
  switch (action.type) {
    case 'GO':
      return {
        ...state,
        screen: action.screen,
        emptyTab: action.emptyTab ?? null,
        pendingDigits: '',
        bpStage: 'systolic',
        bpSystolicBuffer: '',
        vitalsActive: action.vitalsActive ?? state.vitalsActive,
        returnTo:
          action.returnTo !== undefined ? action.returnTo : state.returnTo,
      };
    case 'SET_VITAL_TAB':
      return {
        ...state,
        vitalsActive: action.tab,
        pendingDigits: '',
        bpStage: 'systolic',
        bpSystolicBuffer: '',
      };
    case 'PUSH_DIGIT':
      return { ...state, pendingDigits: state.pendingDigits + action.digit };
    case 'POP_DIGIT':
      return { ...state, pendingDigits: state.pendingDigits.slice(0, -1) };
    case 'SET_BP_STAGE':
      return {
        ...state,
        bpStage: action.stage,
        bpSystolicBuffer:
          action.buffer !== undefined ? action.buffer : state.bpSystolicBuffer,
        pendingDigits: '',
      };
    case 'CLEAR_RETURN':
      return { ...state, returnTo: null };
    case 'MARK_LOGGED':
      return {
        ...state,
        loggedToday: true,
        streak: state.streak + 1,
        bumpKey: state.bumpKey + 1,
      };
    default:
      return state;
  }
}

// ---------- Helpers ----------

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function formatSymptoms(arr) {
  if (!arr || arr.length === 0) return null;
  if (arr.includes('None')) return 'None';
  return arr.join(', ');
}

// TODO: clinical advisor review
function bpSystolicOOR(v) {
  return v != null && (v > 180 || v < 90);
}
function bpDiastolicOOR(v) {
  return v != null && v > 120;
}
function glucoseOOR(v) {
  return v != null && (v > 300 || v < 50);
}

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5a8c4a]/60';

// ---------- Component ----------

export default function HealthLog() {
  const [log, dispatchLog] = useReducer(logReducer, initialLog);
  const [ui, dispatchUi] = useReducer(uiReducer, initialUi);

  const now = useMemo(() => new Date(), []);
  const dateLine = useMemo(() => {
    const weekdays = [
      'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday',
    ];
    const months = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December',
    ];
    return `${weekdays[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  }, [now]);
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, [now]);
  const shortDate = useMemo(() => {
    const months = [
      'Jan','Feb','Mar','Apr','May','Jun',
      'Jul','Aug','Sep','Oct','Nov','Dec',
    ];
    return `${months[now.getMonth()]} ${now.getDate()}`;
  }, [now]);

  // Physical keyboard support for the number pad
  useEffect(() => {
    if (ui.screen !== 'vitals') return;
    const handler = (e) => {
      const max = ui.vitalsActive === 'weight' ? 6 : 3;
      if (/^[0-9]$/.test(e.key)) {
        if (ui.pendingDigits.length < max) {
          dispatchUi({ type: 'PUSH_DIGIT', digit: e.key });
        }
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        dispatchUi({ type: 'POP_DIGIT' });
        e.preventDefault();
      } else if (
        e.key === '.' &&
        ui.vitalsActive === 'weight' &&
        !ui.pendingDigits.includes('.')
      ) {
        dispatchUi({ type: 'PUSH_DIGIT', digit: '.' });
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ui.screen, ui.vitalsActive, ui.pendingDigits]);

  // ---------- Flow helpers ----------

  const go = (screen, opts = {}) =>
    dispatchUi({ type: 'GO', screen, ...opts });

  const advanceAfter = (nextDefault) => {
    if (ui.returnTo === 'confirm') {
      dispatchUi({ type: 'CLEAR_RETURN' });
      go('confirm');
    } else {
      go(nextDefault);
    }
  };

  const pickMood = (key) => {
    dispatchLog({ type: 'SET_MOOD', value: key });
    setTimeout(() => advanceAfter('energy'), 250);
  };
  const skipMood = () => {
    dispatchLog({ type: 'SET_MOOD', value: null });
    advanceAfter('energy');
  };
  const pickEnergy = (key) => {
    dispatchLog({ type: 'SET_ENERGY', value: key });
    setTimeout(() => advanceAfter('symptoms'), 250);
  };
  const skipEnergy = () => {
    dispatchLog({ type: 'SET_ENERGY', value: null });
    advanceAfter('symptoms');
  };
  const continueSymptoms = () => {
    advanceAfter('vitals');
  };

  const commitVitalAndAdvance = (nextSegment) => {
    if (nextSegment) {
      dispatchUi({ type: 'SET_VITAL_TAB', tab: nextSegment });
    } else {
      if (ui.returnTo === 'confirm') {
        dispatchUi({ type: 'CLEAR_RETURN' });
      }
      go('confirm');
    }
  };

  const saveCurrentVital = () => {
    const digits = ui.pendingDigits;
    if (ui.vitalsActive === 'bp') {
      if (!digits) return;
      if (ui.bpStage === 'systolic') {
        dispatchUi({
          type: 'SET_BP_STAGE',
          stage: 'diastolic',
          buffer: digits,
        });
      } else {
        const sys = parseInt(ui.bpSystolicBuffer, 10);
        const dia = parseInt(digits, 10);
        dispatchLog({
          type: 'SET_BP',
          value: { systolic: sys, diastolic: dia },
        });
        commitVitalAndAdvance(ui.returnTo === 'confirm' ? null : 'glucose');
      }
      return;
    }
    if (ui.vitalsActive === 'glucose') {
      if (!digits) return;
      dispatchLog({ type: 'SET_GLUCOSE', value: parseInt(digits, 10) });
      commitVitalAndAdvance(ui.returnTo === 'confirm' ? null : 'weight');
      return;
    }
    if (ui.vitalsActive === 'weight') {
      if (!digits) return;
      dispatchLog({ type: 'SET_WEIGHT', value: parseFloat(digits) });
      commitVitalAndAdvance(null);
    }
  };

  const skipCurrentVital = () => {
    if (ui.vitalsActive === 'bp') {
      dispatchLog({ type: 'SET_BP', value: null });
      commitVitalAndAdvance(ui.returnTo === 'confirm' ? null : 'glucose');
    } else if (ui.vitalsActive === 'glucose') {
      dispatchLog({ type: 'SET_GLUCOSE', value: null });
      commitVitalAndAdvance(ui.returnTo === 'confirm' ? null : 'weight');
    } else {
      dispatchLog({ type: 'SET_WEIGHT', value: null });
      commitVitalAndAdvance(null);
    }
  };

  const saveAll = () => {
    dispatchUi({ type: 'MARK_LOGGED' });
    go('confirm'); // stay briefly
    setTimeout(() => go('home'), 600);
  };

  const editFromConfirm = (target) => {
    if (target === 'mood')     go('mood', { returnTo: 'confirm' });
    if (target === 'energy')   go('energy', { returnTo: 'confirm' });
    if (target === 'symptoms') go('symptoms', { returnTo: 'confirm' });
    if (target === 'bp')       go('vitals', { returnTo: 'confirm', vitalsActive: 'bp' });
    if (target === 'glucose')  go('vitals', { returnTo: 'confirm', vitalsActive: 'glucose' });
    if (target === 'weight')   go('vitals', { returnTo: 'confirm', vitalsActive: 'weight' });
  };

  // ---------- Render helpers ----------

  const PhoneHeader = ({ title, onBack }) => (
    <div className="h-[48px] flex items-center px-5 border-b border-[#e5e1d6] bg-white">
      {onBack ? (
        <button
          onClick={onBack}
          aria-label="Back"
          className={`w-8 h-8 -ml-2 rounded-full flex items-center justify-center text-[#111] hover:bg-[#efece6] ${FOCUS_RING}`}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      ) : (
        <div className="w-8 h-8" aria-hidden="true" />
      )}
      <div className="flex-1 text-center text-[16px] leading-6 font-semibold text-[#111]">
        {title}
      </div>
      <div className="w-8 h-8" aria-hidden="true" />
    </div>
  );

  const StepProgress = ({ step }) => (
    <div className="px-5 pt-3 pb-4 bg-white">
      <div className="text-[13px] leading-[18px] text-[#555] mb-2">
        Step {step} of 3
      </div>
      <div
        className="h-1 w-full bg-[#e5e1d6] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-label="Quick log progress"
      >
        <div
          className="h-full bg-[#5a8c4a] transition-all duration-[180ms] ease-out"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
    </div>
  );

  // ---------- Screens ----------

  const HomeScreen = () => (
    <div className="flex-1 overflow-auto bg-white">
      <div className="px-5 pt-5 pb-6">
        <div className="text-[13px] leading-[18px] text-[#555]">{dateLine}</div>
        <div className="mt-1 text-[22px] leading-7 font-semibold text-[#111]">
          {greeting}, David
        </div>

        {/* Primary CTA / Logged-today card */}
        {ui.loggedToday ? (
          <div
            className="mt-5 rounded-2xl border border-[#5a8c4a] bg-white p-5"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#5a8c4a] flex items-center justify-center">
                <Check size={16} color="#fff" aria-hidden="true" />
              </div>
              <div className="text-[18px] leading-6 font-semibold text-[#111]">
                Logged for today
              </div>
            </div>
            <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
              Edit anytime in Log → Today
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-[#1f1f1f] bg-[#fff7e6] p-5">
            <div className="text-[18px] leading-6 font-semibold text-[#111]">
              Log today's check-in
            </div>
            <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
              Takes about 25 sec
            </div>
            <button
              onClick={() => go('mood')}
              aria-label="Start today's health check-in"
              className={`mt-4 w-full h-12 rounded-full bg-[#5a8c4a] text-white text-[16px] leading-6 font-semibold ${FOCUS_RING}`}
            >
              Start
            </button>
          </div>
        )}

        {/* Streak strip */}
        <div
          key={ui.bumpKey}
          className="mt-4 rounded-xl border border-[#e5e1d6] bg-white p-3 flex items-center justify-between"
          style={{ animation: ui.bumpKey ? 'hl_bump 320ms ease-out' : undefined }}
        >
          <div className="text-[16px] leading-6 text-[#111]">
            {ui.streak}-day streak
          </div>
          <div className="flex items-center gap-[6px]" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#5a8c4a]" />
            ))}
            <div
              className={`w-2 h-2 rounded-full ${
                ui.loggedToday
                  ? 'bg-[#5a8c4a]'
                  : 'border border-[#5a8c4a]'
              }`}
            />
          </div>
        </div>

        {/* Recent trends */}
        <div className="mt-5">
          <div className="text-[14px] leading-5 font-semibold text-[#111] mb-2">
            Recent trends
          </div>
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl border border-[#e5e1d6] bg-white p-3">
              <div className="text-[13px] leading-[18px] text-[#555]">BP</div>
              <div className="mt-1 text-[36px] leading-[40px] font-semibold text-[#111]">
                128/82
              </div>
              <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
                7d avg
              </div>
            </div>
            <div className="flex-1 rounded-xl border border-[#e5e1d6] bg-white p-3">
              <div className="text-[13px] leading-[18px] text-[#555]">
                Glucose
              </div>
              <div className="mt-1 text-[36px] leading-[40px] font-semibold text-[#111]">
                112
              </div>
              <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
                mg/dL
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const MoodScreen = () => (
    <div className="flex-1 flex flex-col bg-white">
      <PhoneHeader title="How are you feeling?" onBack={() => go('home')} />
      <StepProgress step={1} />
      <div className="flex-1 px-5 pt-4 flex flex-col">
        <div className="flex justify-between gap-2">
          {MOOD_OPTIONS.map(opt => {
            const selected = log.mood === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => pickMood(opt.key)}
                aria-pressed={selected}
                aria-label={`Mood: ${opt.label}`}
                className={`flex-1 h-14 rounded-xl border text-[13px] leading-[18px] transition-colors duration-[180ms] ease-out ${FOCUS_RING} ${
                  selected
                    ? 'bg-[#5a8c4a] text-white border-[#5a8c4a] font-semibold'
                    : 'bg-white text-[#111] border-[#e5e1d6]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[13px] leading-[18px] text-[#555]">
          Tap once. You can change it on the summary.
        </div>
        <div className="mt-auto pb-5 flex justify-end">
          <button
            onClick={skipMood}
            className={`text-[13px] leading-[18px] text-[#555] underline underline-offset-2 px-2 py-1 rounded ${FOCUS_RING}`}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );

  const EnergyScreen = () => (
    <div className="flex-1 flex flex-col bg-white">
      <PhoneHeader title="Energy today?" onBack={() => go('mood')} />
      <StepProgress step={2} />
      <div className="flex-1 px-5 pt-4 flex flex-col">
        <div className="flex flex-col gap-3">
          {ENERGY_OPTIONS.map(opt => {
            const selected = log.energy === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => pickEnergy(opt.key)}
                aria-pressed={selected}
                aria-label={`Energy: ${opt.label}`}
                className={`w-full h-14 rounded-xl border text-[16px] leading-6 transition-colors duration-[180ms] ease-out ${FOCUS_RING} ${
                  selected
                    ? 'bg-[#5a8c4a] text-white border-[#5a8c4a] font-semibold'
                    : 'bg-white text-[#111] border-[#e5e1d6]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[13px] leading-[18px] text-[#555]">
          Tap once. You can change it on the summary.
        </div>
        <div className="mt-auto pb-5 flex justify-end">
          <button
            onClick={skipEnergy}
            className={`text-[13px] leading-[18px] text-[#555] underline underline-offset-2 px-2 py-1 rounded ${FOCUS_RING}`}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );

  const SymptomsScreen = () => (
    <div className="flex-1 flex flex-col bg-white">
      <PhoneHeader title="Anything else today?" onBack={() => go('energy')} />
      <StepProgress step={3} />
      <div className="flex-1 px-5 pt-4 pb-4 flex flex-col">
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map(s => {
            const selected = log.symptoms.includes(s);
            return (
              <button
                key={s}
                onClick={() =>
                  dispatchLog({ type: 'TOGGLE_SYMPTOM', value: s })
                }
                aria-pressed={selected}
                className={`h-9 px-4 rounded-full border text-[13px] leading-[18px] transition-colors duration-[180ms] ease-out ${FOCUS_RING} ${
                  selected
                    ? 'bg-[#5a8c4a] text-white border-[#5a8c4a] font-semibold'
                    : 'bg-white text-[#111] border-[#e5e1d6]'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[13px] leading-[18px] text-[#555]">
          Tap any that apply, or "None".
        </div>
        <div className="mt-auto">
          <button
            onClick={continueSymptoms}
            className={`w-full h-12 rounded-full bg-[#5a8c4a] text-white text-[16px] leading-6 font-semibold ${FOCUS_RING}`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  const VitalsScreen = () => {
    const active = ui.vitalsActive;
    const digits = ui.pendingDigits;

    // Readout + out-of-range copy
    let readoutNode = null;
    let oorMessage = null;

    if (active === 'bp') {
      const sysDisplay =
        ui.bpStage === 'systolic'
          ? digits || '___'
          : ui.bpSystolicBuffer || '___';
      const diaDisplay =
        ui.bpStage === 'diastolic' ? digits || '___' : '___';
      const sysNum =
        ui.bpStage === 'systolic'
          ? parseInt(digits || '0', 10)
          : parseInt(ui.bpSystolicBuffer || '0', 10);
      const diaNum =
        ui.bpStage === 'diastolic' ? parseInt(digits || '0', 10) : null;
      if (
        (ui.bpStage === 'systolic' && digits.length >= 2 && bpSystolicOOR(sysNum)) ||
        (ui.bpStage === 'diastolic' &&
          ((digits.length >= 2 && bpDiastolicOOR(diaNum)) ||
            bpSystolicOOR(parseInt(ui.bpSystolicBuffer || '0', 10))))
      ) {
        oorMessage = 'Out of range — double check before saving.';
      }
      readoutNode = (
        <div className="text-[36px] leading-[40px] font-semibold text-[#111] tabular-nums">
          <span
            className={
              ui.bpStage === 'systolic'
                ? 'relative'
                : ''
            }
          >
            {sysDisplay}
            {ui.bpStage === 'systolic' && (
              <span
                aria-hidden="true"
                className="inline-block ml-[2px] w-[2px] h-[28px] align-middle bg-[#5a8c4a]"
                style={{ animation: 'hl_caret 900ms steps(1) infinite' }}
              />
            )}
          </span>
          <span className="mx-2 text-[#888]">/</span>
          <span>
            {diaDisplay}
            {ui.bpStage === 'diastolic' && (
              <span
                aria-hidden="true"
                className="inline-block ml-[2px] w-[2px] h-[28px] align-middle bg-[#5a8c4a]"
                style={{ animation: 'hl_caret 900ms steps(1) infinite' }}
              />
            )}
          </span>
        </div>
      );
    } else if (active === 'glucose') {
      const n = parseInt(digits || '0', 10);
      if (digits.length >= 2 && glucoseOOR(n)) {
        oorMessage = 'Out of range — double check before saving.';
      }
      readoutNode = (
        <div className="text-[36px] leading-[40px] font-semibold text-[#111] tabular-nums">
          <span>{digits || '___'}</span>
          <span
            aria-hidden="true"
            className="inline-block ml-[2px] w-[2px] h-[28px] align-middle bg-[#5a8c4a]"
            style={{ animation: 'hl_caret 900ms steps(1) infinite' }}
          />
          <span className="ml-2 text-[16px] leading-6 text-[#555] font-normal align-middle">
            mg/dL
          </span>
        </div>
      );
    } else {
      readoutNode = (
        <div className="text-[36px] leading-[40px] font-semibold text-[#111] tabular-nums">
          <span>{digits || '___'}</span>
          <span
            aria-hidden="true"
            className="inline-block ml-[2px] w-[2px] h-[28px] align-middle bg-[#5a8c4a]"
            style={{ animation: 'hl_caret 900ms steps(1) infinite' }}
          />
          <span className="ml-2 text-[16px] leading-6 text-[#555] font-normal align-middle">
            lb
          </span>
        </div>
      );
    }

    const canSave = digits.length > 0;
    const dotEnabled = active === 'weight' && !digits.includes('.');

    const pushDigit = (d) => {
      const max = active === 'weight' ? 6 : 3;
      if (d === '.') {
        if (dotEnabled) dispatchUi({ type: 'PUSH_DIGIT', digit: '.' });
        return;
      }
      if (digits.length >= max) return;
      dispatchUi({ type: 'PUSH_DIGIT', digit: d });
    };

    const padKeys = ['1','2','3','4','5','6','7','8','9','.','0','BACK'];

    return (
      <div className="flex-1 flex flex-col bg-white">
        <PhoneHeader title="Vitals" onBack={() => go('symptoms')} />

        {/* Segmented control */}
        <div className="px-5 pt-3">
          <div className="flex">
            {VITAL_SEGMENTS.map(seg => {
              const isActive = ui.vitalsActive === seg.key;
              return (
                <button
                  key={seg.key}
                  onClick={() => dispatchUi({ type: 'SET_VITAL_TAB', tab: seg.key })}
                  aria-pressed={isActive}
                  className={`flex-1 h-10 text-[14px] leading-5 relative ${FOCUS_RING} ${
                    isActive
                      ? 'text-[#111] font-semibold'
                      : 'text-[#888]'
                  }`}
                >
                  {seg.label}
                  <span
                    aria-hidden="true"
                    className={`absolute left-3 right-3 bottom-0 h-[2px] ${
                      isActive ? 'bg-[#5a8c4a]' : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <div className="h-px bg-[#e5e1d6]" aria-hidden="true" />
        </div>

        {/* Readout */}
        <div className="h-24 flex items-center justify-center px-5">
          {readoutNode}
        </div>
        <div className="px-5 -mt-2 mb-2 min-h-[18px] text-center">
          {oorMessage && (
            <span className="text-[13px] leading-[18px] text-[#c54a4a]">
              {oorMessage}
            </span>
          )}
        </div>

        {/* Number pad */}
        <div className="px-5">
          <div className="grid grid-cols-3 gap-2">
            {padKeys.map((k) => {
              if (k === 'BACK') {
                return (
                  <button
                    key={k}
                    onClick={() => dispatchUi({ type: 'POP_DIGIT' })}
                    aria-label="Backspace"
                    className={`h-14 rounded-xl border border-[#e5e1d6] bg-white text-[#111] flex items-center justify-center text-[22px] leading-6 ${FOCUS_RING}`}
                  >
                    ⌫
                  </button>
                );
              }
              const isDot = k === '.';
              const disabled = isDot && !dotEnabled;
              return (
                <button
                  key={k}
                  onClick={() => !disabled && pushDigit(k)}
                  aria-label={isDot ? 'Decimal point' : `Digit ${k}`}
                  disabled={disabled}
                  className={`h-14 rounded-xl border border-[#e5e1d6] text-[28px] leading-8 font-medium ${FOCUS_RING} ${
                    disabled
                      ? 'bg-white text-[#e5e1d6]'
                      : 'bg-white text-[#111]'
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-auto px-5 pb-4 pt-4 flex items-center gap-3">
          <button
            onClick={skipCurrentVital}
            className={`flex-1 h-12 rounded-full border border-[#e5e1d6] bg-white text-[#555] text-[16px] leading-6 ${FOCUS_RING}`}
          >
            Skip this
          </button>
          <button
            onClick={saveCurrentVital}
            disabled={!canSave}
            aria-label="Save this vital"
            className={`flex-1 h-12 rounded-full text-white text-[16px] leading-6 font-semibold ${FOCUS_RING} ${
              canSave ? 'bg-[#5a8c4a]' : 'bg-[#5a8c4a]/40'
            }`}
          >
            Save
          </button>
        </div>
      </div>
    );
  };

  const ConfirmScreen = () => {
    const rows = [
      {
        key: 'mood',
        label: 'Mood',
        value: log.mood ? cap(log.mood) : null,
      },
      {
        key: 'energy',
        label: 'Energy',
        value: log.energy ? cap(log.energy) : null,
      },
      {
        key: 'symptoms',
        label: 'Symptoms',
        value: formatSymptoms(log.symptoms),
      },
      {
        key: 'bp',
        label: 'Blood pressure',
        value: log.bp ? `${log.bp.systolic}/${log.bp.diastolic}` : null,
      },
      {
        key: 'glucose',
        label: 'Glucose',
        value: log.glucose != null ? `${log.glucose} mg/dL` : null,
      },
      {
        key: 'weight',
        label: 'Weight',
        value: log.weight != null ? `${log.weight} lb` : null,
      },
    ];

    return (
      <div className="flex-1 flex flex-col bg-white overflow-auto">
        <div className="px-5 pt-5 pb-4">
          <div className="text-[22px] leading-7 font-semibold text-[#111]">
            Today, {shortDate}
          </div>
          <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
            Review and save your check-in.
          </div>
        </div>

        <div className="px-5">
          <div className="rounded-xl border border-[#e5e1d6] bg-white divide-y divide-[#e5e1d6]">
            {rows.map(r => (
              <div
                key={r.key}
                className="flex items-center justify-between px-4 py-3 gap-3"
              >
                <div className="text-[13px] leading-[18px] text-[#555] w-[110px] shrink-0">
                  {r.label}
                </div>
                <div className="flex-1 text-[16px] leading-6 text-[#111] truncate">
                  {r.value != null ? (
                    r.value
                  ) : (
                    <span className="italic text-[#888]">Skipped</span>
                  )}
                </div>
                <button
                  onClick={() => editFromConfirm(r.key)}
                  aria-label={`Edit ${r.label}`}
                  className={`text-[13px] leading-[18px] text-[#5a8c4a] underline underline-offset-2 px-2 py-1 rounded ${FOCUS_RING}`}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto px-5 pb-5 pt-5">
          <button
            onClick={saveAll}
            aria-label="Looks right, save today's check-in"
            className={`w-full h-12 rounded-full bg-[#5a8c4a] text-white text-[16px] leading-6 font-semibold ${FOCUS_RING}`}
          >
            Looks right — save
          </button>
        </div>
      </div>
    );
  };

  const EmptyTabScreen = ({ tab }) => {
    const Icon = tab === 'care' ? Stethoscope : User;
    return (
      <div className="flex-1 flex flex-col bg-white items-center justify-center px-8 text-center">
        <div className="w-24 h-24 rounded-full border border-[#e5e1d6] flex items-center justify-center text-[#888]">
          <Icon size={40} aria-hidden="true" />
        </div>
        <div className="mt-5 text-[16px] leading-6 font-semibold text-[#111]">
          This tab is owned by another teammate.
        </div>
        <div className="mt-2 text-[13px] leading-[18px] text-[#555]">
          Out of scope for the Daily Health Log prototype.
        </div>
      </div>
    );
  };

  // ---------- Tab bar ----------

  const activeTab = (() => {
    if (ui.screen === 'home') return 'home';
    if (ui.screen === 'empty') return ui.emptyTab;
    return 'log';
  })();

  const TabButton = ({ tabKey, Icon, label, onClick }) => {
    const isActive = activeTab === tabKey;
    return (
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 ${FOCUS_RING} ${
          isActive ? 'text-[#5a8c4a]' : 'text-[#888]'
        }`}
      >
        <Icon size={20} aria-hidden="true" />
        <span className="text-[11px] leading-[14px]">{label}</span>
      </button>
    );
  };

  const goLogTab = () => {
    if (ui.loggedToday) {
      go('home');
    } else {
      go('mood');
    }
  };

  // ---------- Top-level layout ----------

  const renderScreen = () => {
    switch (ui.screen) {
      case 'home':     return <HomeScreen />;
      case 'mood':     return <MoodScreen />;
      case 'energy':   return <EnergyScreen />;
      case 'symptoms': return <SymptomsScreen />;
      case 'vitals':   return <VitalsScreen />;
      case 'confirm':  return <ConfirmScreen />;
      case 'empty':    return <EmptyTabScreen tab={ui.emptyTab} />;
      default:         return <HomeScreen />;
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#efece6] p-6"
      style={{
        fontFamily:
          'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes hl_bump {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes hl_caret {
          0%, 50%   { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes hl_fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Phone bezel */}
      <div className="w-[360px] h-[780px] rounded-[44px] bg-[#fbf8f1] border border-[#1f1f1f]/15 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.35)] overflow-hidden relative">
        {/* Notch */}
        <div
          className="w-[100px] h-[24px] rounded-b-2xl bg-black absolute top-0 left-1/2 -translate-x-1/2 z-20"
          aria-hidden="true"
        />

        {/* Status bar */}
        <div
          className="h-[28px] flex items-center justify-between px-5 text-[#444] text-xs bg-[#fbf8f1] relative z-10"
          aria-hidden="true"
        >
          <span>9:41</span>
          <div className="flex items-center gap-2">
            <span>100%</span>
            <span>•••</span>
          </div>
        </div>

        {/* Screen content */}
        <div
          key={ui.screen + (ui.emptyTab || '') + ui.vitalsActive}
          className="flex flex-col"
          style={{
            height: '688px',
            animation: 'hl_fade 180ms ease-out',
          }}
        >
          {renderScreen()}
        </div>

        {/* Bottom tab bar */}
        <div className="h-[64px] border-t border-[#e5e1d6] bg-white flex items-center">
          <TabButton
            tabKey="home"
            Icon={HomeIcon}
            label="Home"
            onClick={() => go('home')}
          />
          <TabButton
            tabKey="log"
            Icon={PlusCircle}
            label="Log"
            onClick={goLogTab}
          />
          <TabButton
            tabKey="care"
            Icon={Stethoscope}
            label="Care"
            onClick={() => go('empty', { emptyTab: 'care' })}
          />
          <TabButton
            tabKey="you"
            Icon={User}
            label="You"
            onClick={() => go('empty', { emptyTab: 'you' })}
          />
        </div>
      </div>
    </div>
  );
}
