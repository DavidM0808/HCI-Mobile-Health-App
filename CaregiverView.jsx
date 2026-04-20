import React, { useReducer, useEffect, useRef } from 'react';
import {
  Check,
  ChevronLeft,
  Phone,
  MessageSquare,
  Shield,
  UserPlus,
  Clock,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

// ---------- Static data ----------

const PERMISSION_META = {
  checkIn: {
    label: 'Daily check-in',
    caption: 'Mood, energy, and logged symptoms',
    pill: 'Check-in',
  },
  vitals: {
    label: 'Vitals',
    caption: 'BP, glucose, and weight readings',
    pill: 'Vitals',
  },
  meds: {
    label: 'Medication schedule',
    caption: "Today's doses and upcoming times",
    pill: 'Meds',
  },
  adherence: {
    label: 'Adherence history',
    caption: 'Which doses were taken or missed',
    pill: 'Adherence',
  },
  appointments: {
    label: 'Appointments',
    caption: 'Upcoming visits and reminders',
    pill: 'Appointments',
  },
  messages: {
    label: 'Prep notes & secure messages',
    caption: 'Pre-visit notes shared with care team',
    pill: 'Notes',
  },
};

const PERMISSION_ORDER = [
  'checkIn',
  'vitals',
  'meds',
  'adherence',
  'appointments',
  'messages',
];

const RELATIONSHIPS = [
  'Adult child',
  'Spouse',
  'Parent',
  'Sibling',
  'Friend',
  'Other',
];

const DEFAULT_PERMISSIONS = {
  checkIn: true,
  vitals: true,
  meds: true,
  adherence: true,
  appointments: false,
  messages: false,
};

const DEFAULT_MESSAGE =
  "Hi Dad — just a gentle nudge, looks like you haven't logged tonight's Lisinopril yet. All good?";

// 7-day adherence strip: matches ~86% (6/7) shown as "87% this week".
const ADHERENCE_WEEK = ['taken', 'taken', 'taken', 'taken', 'taken', 'missed', 'taken'];

// Stable "now" so relative times don't jitter between re-renders during a session.
const NOW_MS = Date.now();

const seedAccessLog = () => {
  const at = m => new Date(NOW_MS - m * 60_000).toISOString();
  return [
    { id: 'a1',  ts: at(2),                 personId: 'p_sara', what: "today's check-in" },
    { id: 'a2',  ts: at(15),                personId: 'p_sara', what: 'vitals (BP, glucose)' },
    { id: 'a3',  ts: at(2 * 60),            personId: 'p_sara', what: 'medication schedule' },
    { id: 'a4',  ts: at(14 * 60),           personId: 'p_sara', what: 'adherence history' },
    { id: 'a5',  ts: at(2 * 24 * 60),       personId: 'p_sara', what: "today's check-in" },
    { id: 'a6',  ts: at(4 * 24 * 60),       personId: 'p_sara', what: 'vitals (weight)' },
    { id: 'a7',  ts: at(7 * 24 * 60),       personId: 'p_sara', what: 'adherence history' },
    { id: 'a8',  ts: at(12 * 24 * 60),      personId: 'p_sara', what: 'medication schedule' },
    { id: 'a9',  ts: at(18 * 24 * 60),      personId: 'p_sara', what: "today's check-in" },
    { id: 'a10', ts: at(26 * 24 * 60),      personId: 'p_sara', what: 'vitals (BP)' },
  ];
};

// ---------- State ----------

const initialState = {
  persona: 'patient',            // 'patient' | 'caregiver'
  screen: 'sharing',             // see screen map in renderScreen()
  emptyTab: null,                // 'home' | 'log' | 'care' | 'you'
  people: [
    {
      id: 'p_sara',
      name: 'Sara Kim',
      relationship: 'Adult child',
      status: 'active',
      permissions: { ...DEFAULT_PERMISSIONS },
      alertMode: 'actionable',
      invitedAt: '2026-03-02T10:20:00Z',
      acceptedAt: '2026-03-02T11:05:00Z',
    },
  ],
  draftInvite: {
    email: '',
    relationship: 'Adult child',
    permissions: { ...DEFAULT_PERMISSIONS },
    alertMode: 'actionable',
  },
  emailErrorShown: false,
  inviteSuccessEmail: null,
  messageDraft: DEFAULT_MESSAGE,
  alertActive: true,
  reminderSentAt: null,
  escalation: { caregiverAfter: 1, careTeamAfter: 3 },
  accessLog: seedAccessLog(),
  toast: null,
  modal: null,                   // 'callDavid' | `revokeConfirm:${id}` | null
  editingPersonId: null,
  editDraft: null,
  showOlderAccess: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PERSONA': {
      if (action.persona === state.persona) return state;
      const screen = action.persona === 'patient' ? 'sharing' : 'home';
      return {
        ...state,
        persona: action.persona,
        screen,
        emptyTab: null,
        modal: null,
        editingPersonId: null,
        editDraft: null,
      };
    }
    case 'GO':
      return {
        ...state,
        screen: action.screen,
        emptyTab: action.emptyTab ?? null,
      };
    case 'UPDATE_DRAFT':
      return {
        ...state,
        draftInvite: { ...state.draftInvite, ...action.patch },
        emailErrorShown: false,
      };
    case 'UPDATE_DRAFT_PERMISSION':
      return {
        ...state,
        draftInvite: {
          ...state.draftInvite,
          permissions: {
            ...state.draftInvite.permissions,
            [action.key]: action.value,
          },
        },
      };
    case 'SHOW_EMAIL_ERROR':
      return { ...state, emailErrorShown: true };
    case 'SEND_INVITE': {
      const newPerson = {
        id: 'p_' + Math.random().toString(36).slice(2, 8),
        name: action.displayName,
        relationship: state.draftInvite.relationship,
        status: 'pending',
        permissions: { ...state.draftInvite.permissions },
        alertMode: state.draftInvite.alertMode,
        invitedAt: new Date().toISOString(),
        acceptedAt: null,
      };
      return {
        ...state,
        people: [...state.people, newPerson],
        inviteSuccessEmail: state.draftInvite.email,
        screen: 'inviteSuccess',
        draftInvite: {
          email: '',
          relationship: 'Adult child',
          permissions: { ...DEFAULT_PERMISSIONS },
          alertMode: 'actionable',
        },
        emailErrorShown: false,
      };
    }
    case 'OPEN_EDIT': {
      const p = state.people.find(x => x.id === action.personId);
      return {
        ...state,
        editingPersonId: action.personId,
        editDraft: p ? { ...p.permissions } : null,
      };
    }
    case 'UPDATE_EDIT_PERMISSION':
      return {
        ...state,
        editDraft: state.editDraft
          ? { ...state.editDraft, [action.key]: action.value }
          : null,
      };
    case 'CLOSE_EDIT':
      return { ...state, editingPersonId: null, editDraft: null };
    case 'COMMIT_EDIT':
      return {
        ...state,
        people: state.people.map(p =>
          p.id === state.editingPersonId
            ? { ...p, permissions: { ...state.editDraft } }
            : p,
        ),
        editingPersonId: null,
        editDraft: null,
        toast: { text: 'Permissions updated', type: 'info' },
      };
    case 'REVOKE_PERSON':
      return {
        ...state,
        people: state.people.map(p =>
          p.id === action.personId ? { ...p, status: 'revoked' } : p,
        ),
        modal: null,
      };
    case 'RESTORE_PERSON':
      return {
        ...state,
        people: state.people.map(p =>
          p.id === action.personId
            ? { ...p, status: p.acceptedAt ? 'active' : 'pending' }
            : p,
        ),
      };
    case 'SET_MESSAGE_DRAFT':
      return { ...state, messageDraft: action.value };
    case 'SEND_REMINDER':
      return {
        ...state,
        reminderSentAt: new Date().toISOString(),
        alertActive: false,
        toast: { text: action.toastText, type: 'success' },
        screen: 'home',
        messageDraft: DEFAULT_MESSAGE,
      };
    case 'SET_ESCALATION':
      return {
        ...state,
        escalation: { ...state.escalation, [action.key]: action.value },
      };
    case 'OPEN_MODAL':
      return { ...state, modal: action.modal };
    case 'CLOSE_MODAL':
      return { ...state, modal: null };
    case 'SHOW_TOAST':
      return { ...state, toast: action.toast };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'TOGGLE_SHOW_OLDER':
      return { ...state, showOlderAccess: !state.showOlderAccess };
    default:
      return state;
  }
}

// ---------- Helpers ----------

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function relativeTime(iso) {
  const diff = NOW_MS - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatTime(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function firstName(full) {
  return (full || '').split(' ')[0];
}

function prettyFromEmail(email) {
  const local = (email || '').split('@')[0] || 'New caregiver';
  const parts = local.split(/[._-]/).filter(Boolean);
  return parts
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ') || 'New caregiver';
}

function scopeSummary(permissions) {
  const keys = PERMISSION_ORDER.filter(k => permissions[k]);
  if (keys.length <= 3) return keys.map(k => ({ key: k, label: PERMISSION_META[k].pill }));
  return [
    { key: keys[0], label: PERMISSION_META[keys[0]].pill },
    { key: keys[1], label: PERMISSION_META[keys[1]].pill },
    { key: '_more', label: `+${keys.length - 2}` },
  ];
}

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5a8c4a]/60';

// ---------- Stateless presentational pieces ----------

function ToggleRow({ permissionKey, value, onChange }) {
  const meta = PERMISSION_META[permissionKey];
  const on = !!value;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div
          className={`text-[16px] leading-6 ${on ? 'text-[#111]' : 'text-[#888]'}`}
        >
          {meta.label}
        </div>
        <div className="text-[13px] leading-[18px] text-[#555] mt-0.5">
          {meta.caption}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${meta.label} — ${on ? 'allowed' : 'not allowed'}`}
        onClick={() => onChange(!on)}
        className={`relative shrink-0 w-[52px] h-[32px] rounded-full ${FOCUS_RING} ${
          on ? 'bg-[#5a8c4a]' : 'bg-[#e5e1d6]'
        }`}
        style={{ transition: 'background-color 180ms ease-out' }}
      >
        <span
          aria-hidden="true"
          className="absolute rounded-full bg-white shadow"
          style={{
            width: 24,
            height: 24,
            top: 4,
            left: on ? 24 : 4,
            transition: 'left 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </button>
    </div>
  );
}

function RadioRow({ checked, onChange, title, titleClass, caption }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onChange}
      className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 ${FOCUS_RING} ${
        checked ? 'border-[#5a8c4a] bg-[#fff7e6]' : 'border-[#e5e1d6] bg-white'
      }`}
      style={{ transition: 'background-color 180ms ease-out, border-color 180ms ease-out' }}
    >
      <div
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          checked ? 'border-[#5a8c4a]' : 'border-[#e5e1d6]'
        }`}
        aria-hidden="true"
      >
        {checked && <div className="w-2.5 h-2.5 rounded-full bg-[#5a8c4a]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[16px] leading-6 ${titleClass}`}>{title}</div>
        <div className="text-[13px] leading-[18px] text-[#555] mt-0.5">
          {caption}
        </div>
      </div>
    </button>
  );
}

function Stepper({ label, value, min, max, onChange }) {
  const parts = label.split('___');
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className="flex-1 text-[13px] leading-[18px] text-[#555] flex items-center gap-1 flex-wrap">
        <span>{parts[0].trim()}</span>
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center min-w-[18px] text-[#111] font-semibold"
        >
          {value}
        </span>
        <span>{parts[1].trim()}</span>
      </div>
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label={label.replace('___', value)}
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label="Decrease"
          className={`w-8 h-8 rounded-full border border-[#e5e1d6] text-[#111] text-[16px] leading-6 bg-white ${FOCUS_RING} ${
            value <= min ? 'opacity-40' : ''
          }`}
        >
          −
        </button>
        <div
          aria-live="polite"
          className="w-6 text-center text-[16px] leading-6 font-semibold text-[#111]"
        >
          {value}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="Increase"
          className={`w-8 h-8 rounded-full border border-[#e5e1d6] text-[#111] text-[16px] leading-6 bg-white ${FOCUS_RING} ${
            value >= max ? 'opacity-40' : ''
          }`}
        >
          +
        </button>
      </div>
    </div>
  );
}

// Simple inline-SVG tab icons. Only the icons listed in Section 2 are used from
// lucide-react; tab-bar glyphs are drawn as local SVG to stay within HTML/CSS/SVG.
function HomeGlyph({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function LogGlyph({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}
function CareGlyph({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-7-4.5-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-7 10-7 10z" />
    </svg>
  );
}
function YouGlyph({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

// ---------- Component ----------

export default function CaregiverView() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const CAREGIVER_FIRST_NAME = 'Sara';
  const messageRef = useRef(null);

  const go = (screen, emptyTab) =>
    dispatch({ type: 'GO', screen, emptyTab });

  const setPersona = persona => dispatch({ type: 'SET_PERSONA', persona });

  // Auto-clear toasts after 2.4s.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2400);
    return () => clearTimeout(t);
  }, [state.toast]);

  // ---------- Screens ----------

  const InviteScreen = () => {
    const d = state.draftInvite;
    const emailInvalid =
      state.emailErrorShown && !EMAIL_RE.test(d.email);

    const submit = () => {
      if (!EMAIL_RE.test(d.email)) {
        dispatch({ type: 'SHOW_EMAIL_ERROR' });
        return;
      }
      dispatch({
        type: 'SEND_INVITE',
        displayName: prettyFromEmail(d.email),
      });
    };

    return (
      <div className="flex-1 overflow-auto bg-white">
        <div className="h-[48px] flex items-center px-5 border-b border-[#e5e1d6] bg-white">
          <button
            type="button"
            onClick={() => go('sharing')}
            aria-label="Back to Sharing & access"
            className={`w-8 h-8 -ml-2 rounded-full flex items-center justify-center text-[#111] hover:bg-[#efece6] ${FOCUS_RING}`}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="flex-1 text-center text-[16px] leading-6 font-semibold text-[#111]">
            Invite a caregiver
          </div>
          <div className="w-8 h-8" aria-hidden="true" />
        </div>

        <div className="px-5 py-5 pb-8">
          <label
            htmlFor="cv-email"
            className="block text-[14px] leading-5 font-semibold text-[#111] mb-2"
          >
            Email
          </label>
          <input
            id="cv-email"
            type="email"
            value={d.email}
            onChange={e =>
              dispatch({
                type: 'UPDATE_DRAFT',
                patch: { email: e.target.value },
              })
            }
            placeholder="Email address"
            aria-label="Caregiver email address"
            aria-invalid={emailInvalid || undefined}
            className={`w-full h-12 rounded-xl px-3 text-[16px] leading-6 text-[#111] bg-white border ${
              emailInvalid ? 'border-[#c54a4a]' : 'border-[#e5e1d6]'
            } focus:outline-none focus:border-[#5a8c4a] ${FOCUS_RING}`}
            style={{ transition: 'border-color 180ms ease-out' }}
          />
          {emailInvalid && (
            <div
              role="alert"
              className="mt-1 text-[13px] leading-[18px] text-[#c54a4a]"
            >
              Enter a valid email address.
            </div>
          )}

          <label
            htmlFor="cv-rel"
            className="block text-[14px] leading-5 font-semibold text-[#111] mt-5 mb-2"
          >
            How you know them
          </label>
          <select
            id="cv-rel"
            value={d.relationship}
            onChange={e =>
              dispatch({
                type: 'UPDATE_DRAFT',
                patch: { relationship: e.target.value },
              })
            }
            aria-label="Relationship to caregiver"
            className={`w-full h-12 rounded-xl px-3 text-[16px] leading-6 text-[#111] bg-white border border-[#e5e1d6] focus:outline-none focus:border-[#5a8c4a] ${FOCUS_RING}`}
          >
            {RELATIONSHIPS.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <div className="mt-6">
            <div className="text-[14px] leading-5 font-semibold text-[#111]">
              What they can see
            </div>
            <div className="mt-1 divide-y divide-[#e5e1d6]">
              {PERMISSION_ORDER.map(k => (
                <ToggleRow
                  key={k}
                  permissionKey={k}
                  value={d.permissions[k]}
                  onChange={v =>
                    dispatch({
                      type: 'UPDATE_DRAFT_PERMISSION',
                      key: k,
                      value: v,
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div
            className="mt-5 rounded-xl border border-[#2f6fb8] bg-[#e8f1fb] p-3"
            role="note"
          >
            <div
              className="text-[13px] leading-[18px]"
              style={{ color: '#234c78' }}
            >
              Your caregiver will only see what you allow. You can change or
              revoke at any time.
            </div>
          </div>

          <div className="mt-6">
            <div
              className="text-[14px] leading-5 font-semibold text-[#111]"
              id="cv-alert-group"
            >
              When to alert them
            </div>
            <div
              className="mt-2 space-y-2"
              role="radiogroup"
              aria-labelledby="cv-alert-group"
            >
              <RadioRow
                checked={d.alertMode === 'actionable'}
                onChange={() =>
                  dispatch({
                    type: 'UPDATE_DRAFT',
                    patch: { alertMode: 'actionable' },
                  })
                }
                title="Only on missed doses and out-of-range vitals"
                titleClass="text-[#111]"
                caption="Recommended"
              />
              <RadioRow
                checked={d.alertMode === 'all'}
                onChange={() =>
                  dispatch({
                    type: 'UPDATE_DRAFT',
                    patch: { alertMode: 'all' },
                  })
                }
                title="Every log entry"
                titleClass="text-[#555]"
                caption="Most caregivers stop reading these within a week."
              />
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            aria-label="Send invite"
            className={`mt-6 w-full h-12 rounded-2xl bg-[#5a8c4a] text-white text-[16px] leading-6 font-semibold ${FOCUS_RING}`}
          >
            Send invite
          </button>
        </div>
      </div>
    );
  };

  const InviteSuccessScreen = () => (
    <div className="flex-1 overflow-auto bg-white">
      <div className="h-[48px] flex items-center px-5 border-b border-[#e5e1d6]">
        <div className="flex-1 text-center text-[16px] leading-6 font-semibold text-[#111]">
          Invite sent
        </div>
      </div>
      <div className="px-5 pt-10 flex flex-col items-center text-center">
        <div
          className="w-16 h-16 rounded-full bg-[#5a8c4a] flex items-center justify-center"
          aria-hidden="true"
        >
          <Check size={32} color="#fff" aria-hidden="true" />
        </div>
        <div className="mt-5 text-[18px] leading-6 font-semibold text-[#111]">
          Invite sent to {state.inviteSuccessEmail}
        </div>
        <div className="mt-2 text-[13px] leading-[18px] text-[#555]">
          We'll let you know when they accept.
        </div>
        <button
          type="button"
          onClick={() => go('sharing')}
          aria-label="Done"
          className={`mt-8 w-full h-12 rounded-2xl border border-[#5a8c4a] text-[#5a8c4a] text-[16px] leading-6 font-semibold bg-white ${FOCUS_RING}`}
        >
          Done
        </button>
      </div>
    </div>
  );

  const CaregiverHomeScreen = () => {
    const sara = state.people.find(p => p.id === 'p_sara');
    const saraPermissions = sara?.permissions || DEFAULT_PERMISSIONS;
    const checkinLogged = true;
    const reminderSent = !!state.reminderSentAt;
    const showAlert = state.alertActive && !reminderSent;

    return (
      <div className="flex-1 overflow-auto bg-white">
        <div className="px-5 pt-5 pb-6">
          <div className="text-[22px] leading-7 font-semibold text-[#111]">
            Hi {CAREGIVER_FIRST_NAME}
          </div>
          <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
            You're connected to David
          </div>

          <div className="mt-5 rounded-xl border border-[#e5e1d6] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-[20px] leading-7 font-semibold text-[#111]">
                David (Dad)
              </div>
              <span
                aria-label={
                  checkinLogged
                    ? "Today's check-in logged"
                    : 'Check-in not yet logged today'
                }
                className={`w-2.5 h-2.5 rounded-full ${
                  checkinLogged ? 'bg-[#5a8c4a]' : 'bg-[#888]'
                }`}
              />
            </div>

            <div className="mt-3 text-[13px] leading-[18px] text-[#555]">
              Last check-in — 9:12 AM today
            </div>
            <div className="text-[16px] leading-6 text-[#111]">
              Feeling steady · mild headache
            </div>

            <div className="mt-4">
              <div className="text-[13px] leading-[18px] text-[#555]">
                Adherence — 87% this week
              </div>
              <div
                className="mt-2 flex gap-1.5"
                role="img"
                aria-label="7-day adherence: 6 days taken, 1 day missed"
              >
                {ADHERENCE_WEEK.map((s, i) => {
                  const color =
                    s === 'taken'
                      ? 'bg-[#5a8c4a]'
                      : s === 'missed'
                      ? 'bg-[#c54a4a]'
                      : 'bg-[#e5e1d6]';
                  const label =
                    s === 'taken'
                      ? 'Taken'
                      : s === 'missed'
                      ? 'Missed'
                      : 'Skipped';
                  return (
                    <span
                      key={i}
                      className={`w-6 h-6 rounded-full ${color}`}
                      title={label}
                      aria-hidden="true"
                    />
                  );
                })}
              </div>
            </div>

            {saraPermissions.appointments && (
              <div className="mt-4 text-[13px] leading-[18px] text-[#555]">
                Next appointment — Thu 2:30 PM
              </div>
            )}
          </div>

          {showAlert && (
            <button
              type="button"
              onClick={() => go('alert')}
              aria-label="Open missed dose alert"
              className={`mt-4 w-full text-left rounded-xl border border-[#e5e1d6] border-l-4 border-l-[#c54a4a] bg-[#fbeceb] p-4 ${FOCUS_RING}`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={20}
                  color="#c54a4a"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] leading-6 font-semibold text-[#111]">
                    1 dose missed tonight
                  </div>
                  <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
                    Lisinopril 10mg was due at 9:00 PM. First miss this week.
                  </div>
                </div>
                <ChevronLeft
                  size={18}
                  className="rotate-180 text-[#888] shrink-0"
                  aria-hidden="true"
                />
              </div>
            </button>
          )}

          {reminderSent && !state.alertActive && (
            <div
              className="mt-4 rounded-xl border border-[#5a8c4a] bg-white p-4"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full bg-[#5a8c4a] flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <Check size={16} color="#fff" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] leading-6 font-semibold text-[#111]">
                    Reminder sent
                  </div>
                  <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
                    We'll ping you if he still hasn't logged in 30 minutes.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => go('alert')}
              aria-label="Send reminder"
              className={`h-12 rounded-2xl bg-[#5a8c4a] text-white text-[15px] leading-6 font-semibold flex items-center justify-center gap-2 ${FOCUS_RING}`}
            >
              <MessageSquare size={16} aria-hidden="true" />
              Send reminder
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'OPEN_MODAL', modal: 'callDavid' })
              }
              aria-label="Call David"
              className={`h-12 rounded-2xl bg-white border border-[#5a8c4a] text-[#5a8c4a] text-[15px] leading-6 font-semibold flex items-center justify-center gap-2 ${FOCUS_RING}`}
            >
              <Phone size={16} aria-hidden="true" />
              Call David
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2 text-[13px] leading-[18px] text-[#555]">
            <Shield size={14} aria-hidden="true" />
            You see only what David allows you to see.
          </div>
        </div>
      </div>
    );
  };

  const AlertScreen = () => {
    const draft = state.messageDraft;
    const trimmed = draft.trim();
    const nSend = state.escalation.caregiverAfter + 1;
    const nTeam = state.escalation.careTeamAfter;

    const send = () => {
      if (!trimmed) return;
      const time = formatTime(new Date());
      dispatch({
        type: 'SEND_REMINDER',
        toastText: `Reminder sent at ${time}`,
      });
    };

    return (
      <div className="flex-1 overflow-auto bg-white">
        <div className="h-[48px] flex items-center px-5 border-b border-[#e5e1d6] bg-white">
          <button
            type="button"
            onClick={() => go('home')}
            aria-label="Back to Home"
            className={`w-8 h-8 -ml-2 rounded-full flex items-center justify-center text-[#111] hover:bg-[#efece6] ${FOCUS_RING}`}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="flex-1 text-center text-[16px] leading-6 font-semibold text-[#111]">
            Missed dose
          </div>
          <div className="w-8 h-8" aria-hidden="true" />
        </div>

        <div className="px-5 py-5 pb-8">
          <div className="rounded-xl border border-[#e5e1d6] border-l-4 border-l-[#c54a4a] bg-[#fbeceb] p-4">
            <div className="text-[18px] leading-6 font-semibold text-[#111]">
              David missed evening Lisinopril
            </div>
            <div className="mt-2 text-[13px] leading-[18px] text-[#555]">
              Was due at 9:00 PM. No action yet.
            </div>
            <div className="text-[13px] leading-[18px] text-[#555]">
              This was the 1st missed dose this week.
            </div>
            <div className="text-[13px] leading-[18px] text-[#555]">
              He has logged 6 of 7 days on time this week.
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="cv-message"
              className="block text-[13px] leading-[18px] text-[#555] mb-2"
            >
              Suggested message to send David
            </label>
            <textarea
              id="cv-message"
              ref={messageRef}
              value={draft}
              onChange={e =>
                dispatch({ type: 'SET_MESSAGE_DRAFT', value: e.target.value })
              }
              aria-label="Message to David"
              className={`w-full h-24 rounded-lg border border-[#e5e1d6] bg-white p-2 text-[16px] leading-6 text-[#111] resize-none focus:outline-none focus:border-[#5a8c4a] ${FOCUS_RING}`}
              style={{ transition: 'border-color 180ms ease-out' }}
            />
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'SET_MESSAGE_DRAFT', value: '' });
                setTimeout(() => messageRef.current?.focus(), 0);
              }}
              aria-label="Use my own words"
              className={`mt-2 text-[13px] leading-[18px] text-[#5a8c4a] font-semibold ${FOCUS_RING}`}
            >
              Use my own words
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'OPEN_MODAL', modal: 'callDavid' })
              }
              aria-label="Call instead"
              className={`h-12 rounded-2xl bg-white border border-[#5a8c4a] text-[#5a8c4a] text-[15px] leading-6 font-semibold flex items-center justify-center gap-2 ${FOCUS_RING}`}
            >
              <Phone size={16} aria-hidden="true" />
              Call instead
            </button>
            <button
              type="button"
              onClick={send}
              disabled={!trimmed}
              aria-label="Send reminder"
              className={`h-12 rounded-2xl bg-[#5a8c4a] text-white text-[15px] leading-6 font-semibold flex items-center justify-center gap-2 ${FOCUS_RING} ${
                !trimmed ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              <MessageSquare size={16} aria-hidden="true" />
              Send reminder
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-[#2f6fb8] bg-[#e8f1fb] p-3">
            <div
              className="text-[16px] leading-6"
              style={{ color: '#234c78' }}
            >
              If David misses {nSend}+ doses in a row, David's care team will
              also be alerted automatically after {nTeam} missed doses (per his
              settings).
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-[13px] leading-[18px] text-[#555]">
            <Shield size={14} aria-hidden="true" />
            You see only what David allows you to see.
          </div>
        </div>
      </div>
    );
  };

  const PersonCard = ({ person }) => {
    const isRevoked = person.status === 'revoked';
    const isPending = person.status === 'pending';
    const initials = person.name
      .split(' ')
      .map(s => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const pills = scopeSummary(person.permissions);
    const avatarBorder = isPending
      ? 'border-[#888]'
      : isRevoked
      ? 'border-[#888]'
      : 'border-[#5a8c4a]';
    const dim = isRevoked ? 'opacity-60' : '';

    return (
      <div className={`rounded-xl border border-[#e5e1d6] bg-white p-3 ${dim}`}>
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full border-2 ${avatarBorder} bg-white flex items-center justify-center text-[14px] leading-5 font-semibold ${
              isRevoked ? 'text-[#888]' : 'text-[#111]'
            }`}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className={`text-[16px] leading-6 font-semibold ${
                  isRevoked ? 'text-[#888]' : 'text-[#111]'
                }`}
              >
                {person.name}
              </div>
              {person.status === 'active' && (
                <span
                  className="px-2 py-0.5 rounded-full bg-[#5a8c4a] text-white text-[11px] leading-4 font-semibold"
                  aria-label="Active"
                >
                  Active
                </span>
              )}
              {person.status === 'pending' && (
                <span
                  className="px-2 py-0.5 rounded-full border border-[#888] text-[#888] text-[11px] leading-4 font-semibold"
                  aria-label="Pending"
                >
                  Pending
                </span>
              )}
              {person.status === 'revoked' && (
                <span
                  className="px-2 py-0.5 rounded-full border border-[#888] text-[#888] text-[11px] leading-4 font-semibold"
                  aria-label="Revoked"
                >
                  Revoked
                </span>
              )}
            </div>
            <div
              className={`text-[13px] leading-[18px] ${
                isRevoked ? 'text-[#888]' : 'text-[#555]'
              }`}
            >
              {person.relationship}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {pills.length === 0 ? (
                <span className="text-[11px] leading-4 text-[#888]">
                  No access
                </span>
              ) : (
                pills.map(p => {
                  if (p.key === '_more') {
                    return (
                      <span
                        key="_more"
                        className={`px-2 py-0.5 rounded-full border text-[11px] leading-4 ${
                          isRevoked
                            ? 'border-[#888] text-[#888]'
                            : 'border-[#2f6fb8]'
                        }`}
                        style={
                          isRevoked ? undefined : { color: '#234c78' }
                        }
                        aria-label={`${p.label} more permissions`}
                      >
                        {p.label}
                      </span>
                    );
                  }
                  const meta = PERMISSION_META[p.key];
                  return (
                    <span
                      key={p.key}
                      title={`${meta.label} — ${meta.caption}`}
                      aria-label={`${meta.label} — visible to ${person.name}`}
                      className={`px-2 py-0.5 rounded-full border text-[11px] leading-4 ${
                        isRevoked
                          ? 'border-[#888] text-[#888]'
                          : 'border-[#2f6fb8]'
                      }`}
                      style={isRevoked ? undefined : { color: '#234c78' }}
                    >
                      {p.label}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {!isRevoked && (
          <div className="mt-3 flex items-center justify-end gap-4 pt-2 border-t border-[#e5e1d6]">
            {isPending && (
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SHOW_TOAST',
                    toast: {
                      text: `Re-sent invite to ${person.name}`,
                      type: 'info',
                    },
                  })
                }
                aria-label={`Resend invite to ${person.name}`}
                className={`text-[13px] leading-[18px] font-semibold text-[#5a8c4a] ${FOCUS_RING}`}
              >
                Resend
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'OPEN_EDIT', personId: person.id })
              }
              aria-label={`Edit ${person.name}'s permissions`}
              className={`text-[13px] leading-[18px] font-semibold text-[#111] ${FOCUS_RING}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: 'OPEN_MODAL',
                  modal: `revokeConfirm:${person.id}`,
                })
              }
              aria-label={`Revoke ${person.name}'s access`}
              className={`text-[13px] leading-[18px] font-semibold text-[#c54a4a] flex items-center gap-1 ${FOCUS_RING}`}
            >
              <Trash2 size={14} aria-hidden="true" />
              Revoke
            </button>
          </div>
        )}

        {isRevoked && (
          <div className="mt-3 flex items-center justify-end pt-2 border-t border-[#e5e1d6]">
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'RESTORE_PERSON', personId: person.id })
              }
              aria-label={`Restore ${person.name}'s access`}
              className={`text-[13px] leading-[18px] font-semibold text-[#5a8c4a] ${FOCUS_RING}`}
            >
              Restore
            </button>
          </div>
        )}
      </div>
    );
  };

  const SharingScreen = () => {
    const active = state.people.filter(p => p.status === 'active');
    const pending = state.people.filter(p => p.status === 'pending');
    const revoked = state.people.filter(p => p.status === 'revoked');

    const recent = state.accessLog.slice(0, 10);
    const cutoff = NOW_MS - 30 * 24 * 60 * 60 * 1000;
    const displayedLog = state.showOlderAccess
      ? recent
      : recent.filter(e => new Date(e.ts).getTime() >= cutoff);
    const hiddenCount = recent.length - displayedLog.length;

    return (
      <div className="flex-1 overflow-auto bg-white">
        <div className="px-5 pt-5 pb-8">
          <div className="text-[22px] leading-7 font-semibold text-[#111]">
            Sharing & access
          </div>
          <div className="mt-1 text-[13px] leading-[18px] text-[#555]">
            You decide what each person sees. Changes are instant.
          </div>

          {active.length > 0 && (
            <div className="mt-5 space-y-3">
              {active.map(p => (
                <PersonCard key={p.id} person={p} />
              ))}
            </div>
          )}

          {pending.length > 0 && (
            <>
              <div className="mt-5 text-[14px] leading-5 font-semibold text-[#111]">
                Pending invites
              </div>
              <div className="mt-2 space-y-3">
                {pending.map(p => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => go('invite')}
            aria-label="Add a person"
            className={`mt-5 w-full h-12 rounded-2xl border border-[#5a8c4a] text-[#5a8c4a] text-[16px] leading-6 font-semibold bg-white flex items-center justify-center gap-2 ${FOCUS_RING}`}
          >
            <UserPlus size={16} aria-hidden="true" />
            + Add a person
          </button>

          <div className="mt-6 rounded-xl border border-[#5a8c4a]/40 p-4 bg-white">
            <div className="text-[14px] leading-5 font-semibold text-[#111]">
              When your care team gets looped in
            </div>
            <Stepper
              label="Alert caregivers after ___ missed doses"
              value={state.escalation.caregiverAfter}
              min={1}
              max={9}
              onChange={v =>
                dispatch({
                  type: 'SET_ESCALATION',
                  key: 'caregiverAfter',
                  value: v,
                })
              }
            />
            <Stepper
              label="Alert care team after ___ missed doses"
              value={state.escalation.careTeamAfter}
              min={1}
              max={9}
              onChange={v =>
                dispatch({
                  type: 'SET_ESCALATION',
                  key: 'careTeamAfter',
                  value: v,
                })
              }
            />
            <div
              className="mt-3 rounded-lg border border-[#2f6fb8] bg-[#e8f1fb] p-2 text-[13px] leading-[18px]"
              style={{ color: '#234c78' }}
            >
              If David misses {state.escalation.caregiverAfter + 1}+ doses in a
              row, David's care team will also be alerted automatically after{' '}
              {state.escalation.careTeamAfter} missed doses (per his settings).
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#e5e1d6] p-4 bg-white">
            <div className="flex items-center justify-between">
              <div className="text-[14px] leading-5 font-semibold text-[#111]">
                Recent access
              </div>
              <Clock size={16} className="text-[#888]" aria-hidden="true" />
            </div>
            <ul className="mt-3 space-y-2">
              {displayedLog.map(e => {
                const person = state.people.find(p => p.id === e.personId);
                const revokedEntry = person?.status === 'revoked';
                return (
                  <li
                    key={e.id}
                    className={`text-[13px] leading-[18px] ${
                      revokedEntry ? 'text-[#888]' : 'text-[#111]'
                    }`}
                  >
                    <span
                      className={
                        revokedEntry ? 'text-[#888]' : 'text-[#555]'
                      }
                    >
                      {relativeTime(e.ts)}
                    </span>
                    {' — '}
                    <span>
                      {firstName(person?.name || 'Someone')} viewed {e.what}
                    </span>
                  </li>
                );
              })}
              {hiddenCount > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'TOGGLE_SHOW_OLDER' })}
                    aria-label={
                      state.showOlderAccess
                        ? 'Hide older access entries'
                        : 'Show older access entries'
                    }
                    className={`mt-1 text-[13px] leading-[18px] text-[#5a8c4a] font-semibold ${FOCUS_RING}`}
                  >
                    {state.showOlderAccess
                      ? 'Hide older'
                      : `Show older (${hiddenCount})`}
                  </button>
                </li>
              )}
            </ul>
          </div>

          {revoked.length > 0 && (
            <>
              <div className="mt-6 text-[14px] leading-5 font-semibold text-[#888]">
                Revoked
              </div>
              <div className="mt-2 space-y-3">
                {revoked.map(p => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const EmptyTabScreen = () => (
    <div className="flex-1 flex flex-col bg-white items-center justify-center px-8 text-center">
      <div
        className="w-24 h-24 rounded-full border border-[#e5e1d6] flex items-center justify-center text-[#888]"
        aria-hidden="true"
      >
        <Shield size={36} aria-hidden="true" />
      </div>
      <div className="mt-5 text-[16px] leading-6 font-semibold text-[#111]">
        This tab is owned by another teammate.
      </div>
      <div className="mt-2 text-[13px] leading-[18px] text-[#555]">
        Out of scope for the Caregiver Shared View prototype.
      </div>
    </div>
  );

  // ---------- Modals / overlays ----------

  const CallModal = () => {
    if (state.modal !== 'callDavid') return null;
    return (
      <div
        className="absolute inset-0 bg-black/30 z-30 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Call David"
        onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
      >
        <div
          className="w-[260px] h-[140px] rounded-2xl bg-white p-4 flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <Phone
              size={18}
              className="text-[#5a8c4a] mt-0.5"
              aria-hidden="true"
            />
            <div className="text-[13px] leading-[18px] text-[#111] flex-1">
              [Prototype] In the real app, this opens your phone's call screen.
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
            aria-label="OK"
            className={`mt-auto self-end h-9 px-5 rounded-full bg-[#5a8c4a] text-white text-[13px] leading-[18px] font-semibold ${FOCUS_RING}`}
          >
            OK
          </button>
        </div>
      </div>
    );
  };

  const RevokeSheet = () => {
    if (!state.modal || !state.modal.startsWith('revokeConfirm:')) return null;
    const personId = state.modal.split(':')[1];
    const person = state.people.find(p => p.id === personId);
    if (!person) return null;
    return (
      <div
        className="absolute inset-0 z-30"
        role="dialog"
        aria-modal="true"
        aria-label={`Revoke ${person.name}'s access?`}
      >
        <div
          className="absolute inset-0 bg-black/30"
          onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
          aria-hidden="true"
        />
        <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-white rounded-t-2xl p-5 flex flex-col">
          <div className="text-[16px] leading-6 font-semibold text-[#111]">
            Revoke {person.name}'s access?
          </div>
          <div className="mt-2 text-[13px] leading-[18px] text-[#555]">
            They will no longer see any of your data. You can re-invite them
            later.
          </div>
          <div className="mt-auto grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
              aria-label="Keep access"
              className={`h-12 rounded-2xl bg-white border border-[#5a8c4a] text-[#5a8c4a] text-[15px] leading-6 font-semibold ${FOCUS_RING}`}
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'REVOKE_PERSON', personId });
                dispatch({
                  type: 'SHOW_TOAST',
                  toast: {
                    text: `${person.name}'s access revoked`,
                    type: 'info',
                  },
                });
              }}
              aria-label={`Yes, revoke ${person.name}'s access`}
              className={`h-12 rounded-2xl bg-[#c54a4a] text-white text-[15px] leading-6 font-semibold ${FOCUS_RING}`}
            >
              Yes, revoke
            </button>
          </div>
        </div>
      </div>
    );
  };

  const EditModal = () => {
    if (!state.editingPersonId || !state.editDraft) return null;
    const person = state.people.find(p => p.id === state.editingPersonId);
    if (!person) return null;
    return (
      <div
        className="absolute inset-0 z-30"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${person.name}'s permissions`}
      >
        <div
          className="absolute inset-0 bg-black/30"
          onClick={() => dispatch({ type: 'CLOSE_EDIT' })}
          aria-hidden="true"
        />
        <div className="absolute bottom-0 left-0 right-0 max-h-[80%] bg-white rounded-t-2xl p-5 overflow-auto">
          <div className="text-[16px] leading-6 font-semibold text-[#111]">
            What {firstName(person.name)} can see
          </div>
          <div className="mt-1 divide-y divide-[#e5e1d6]">
            {PERMISSION_ORDER.map(k => (
              <ToggleRow
                key={k}
                permissionKey={k}
                value={state.editDraft[k]}
                onChange={v =>
                  dispatch({
                    type: 'UPDATE_EDIT_PERMISSION',
                    key: k,
                    value: v,
                  })
                }
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => dispatch({ type: 'CLOSE_EDIT' })}
              aria-label="Cancel edits"
              className={`h-12 rounded-2xl bg-white border border-[#5a8c4a] text-[#5a8c4a] text-[15px] leading-6 font-semibold ${FOCUS_RING}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'COMMIT_EDIT' })}
              aria-label="Save permissions"
              className={`h-12 rounded-2xl bg-[#5a8c4a] text-white text-[15px] leading-6 font-semibold ${FOCUS_RING}`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---------- Persona switcher & tab bar ----------

  const PersonaSwitcher = () => (
    <div
      role="group"
      aria-label="Prototype persona switcher"
      className="flex items-center rounded-full border border-[#e5e1d6] bg-white overflow-hidden"
    >
      {['patient', 'caregiver'].map(p => {
        const active = state.persona === p;
        const label = p === 'patient' ? 'Patient' : 'Caregiver';
        return (
          <button
            key={p}
            type="button"
            onClick={() => setPersona(p)}
            aria-pressed={active}
            aria-label={`View as ${label}`}
            className={`px-2 h-5 text-[10px] leading-4 font-semibold ${FOCUS_RING} ${
              active ? 'bg-[#5a8c4a] text-white' : 'bg-transparent text-[#888]'
            }`}
            style={{ transition: 'background-color 180ms ease-out' }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const activeTab = (() => {
    if (state.screen === 'empty') return state.emptyTab;
    if (state.persona === 'caregiver') {
      if (state.screen === 'home' || state.screen === 'alert') return 'home';
      return null;
    }
    // patient
    if (['sharing', 'invite', 'inviteSuccess'].includes(state.screen))
      return 'you';
    return null;
  })();

  const onTapTab = tabKey => {
    if (tabKey === 'home') {
      if (state.persona === 'caregiver') go('home');
      else go('empty', 'home');
      return;
    }
    if (tabKey === 'log') {
      go('empty', 'log');
      return;
    }
    if (tabKey === 'care') {
      go('empty', 'care');
      return;
    }
    if (tabKey === 'you') {
      if (state.persona === 'patient') go('sharing');
      else go('empty', 'you');
    }
  };

  const TabButton = ({ tabKey, label, Icon }) => {
    const isActive = activeTab === tabKey;
    return (
      <button
        type="button"
        onClick={() => onTapTab(tabKey)}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 ${FOCUS_RING} ${
          isActive ? 'text-[#5a8c4a]' : 'text-[#888]'
        }`}
      >
        <Icon size={18} />
        <span className="text-[11px] leading-[14px]">{label}</span>
      </button>
    );
  };

  // ---------- Toast ----------

  const Toast = () =>
    state.toast ? (
      <div
        role="status"
        aria-live="polite"
        className="absolute left-5 right-5 bottom-[76px] z-40 rounded-xl bg-[#111] text-white text-[13px] leading-[18px] px-4 py-2.5"
      >
        {state.toast.text}
      </div>
    ) : null;

  // ---------- Screen router ----------

  const renderScreen = () => {
    if (state.screen === 'empty') return <EmptyTabScreen />;
    if (state.persona === 'patient') {
      switch (state.screen) {
        case 'sharing':
          return <SharingScreen />;
        case 'invite':
          return <InviteScreen />;
        case 'inviteSuccess':
          return <InviteSuccessScreen />;
        default:
          return <SharingScreen />;
      }
    }
    // caregiver
    switch (state.screen) {
      case 'home':
        return <CaregiverHomeScreen />;
      case 'alert':
        return <AlertScreen />;
      default:
        return <CaregiverHomeScreen />;
    }
  };

  // ---------- Layout shell ----------

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#efece6] p-6"
      style={{
        fontFamily:
          'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes cv_fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div className="w-[360px] h-[780px] rounded-[44px] bg-[#fbf8f1] border border-[#1f1f1f]/15 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.35)] overflow-hidden relative">
        {/* Notch */}
        <div
          className="w-[100px] h-[24px] rounded-b-2xl bg-black absolute top-0 left-1/2 -translate-x-1/2 z-20"
          aria-hidden="true"
        />

        {/* Status bar with persona switcher */}
        <div className="h-[28px] flex items-center justify-between px-5 text-[#444] text-xs bg-[#fbf8f1] relative z-10">
          <span aria-hidden="true">9:41</span>
          <PersonaSwitcher />
        </div>

        {/* Screen content with fade transition */}
        <div
          key={state.persona + ':' + state.screen + ':' + (state.emptyTab || '')}
          className="flex flex-col"
          style={{ height: '688px', animation: 'cv_fade 180ms ease-out' }}
        >
          {renderScreen()}
        </div>

        {/* Bottom tab bar */}
        <div className="h-[64px] border-t border-[#e5e1d6] bg-white flex items-center">
          <TabButton tabKey="home" label="Home" Icon={HomeGlyph} />
          <TabButton tabKey="log" label="Log" Icon={LogGlyph} />
          <TabButton tabKey="care" label="Care" Icon={CareGlyph} />
          <TabButton tabKey="you" label="You" Icon={YouGlyph} />
        </div>

        {/* Overlays */}
        <Toast />
        <CallModal />
        <RevokeSheet />
        <EditModal />
      </div>
    </div>
  );
}
