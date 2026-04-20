import React, { useState } from 'react';
import CaregiverView from '../CaregiverView.jsx';
import MedAdherence from '../MedAdherence.jsx';
import HealthLog from '../HealthLog.jsx';

// Each feature component renders its own full-viewport wrapper with the
// centered 360x780 phone frame, so App's job is just to pick which one is
// mounted and expose a small floating switcher so the demo audience can
// bounce between David / Edward / Jean without reloading.

const FEATURES = [
  { id: 'david',  label: 'David — Health Log',       Component: HealthLog },
  { id: 'edward', label: 'Edward — Med Adherence',   Component: MedAdherence },
  { id: 'jean',   label: 'Jean — Caregiver View',    Component: CaregiverView },
];

export default function App() {
  const [active, setActive] = useState('david');
  const { Component } = FEATURES.find((f) => f.id === active);

  return (
    <>
      <Component />

      {/* Floating feature switcher. Fixed to the viewport so it sits above
          the phone frame regardless of which component is mounted. */}
      <div
        role="tablist"
        aria-label="Prototype feature selector"
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          gap: 6,
          padding: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {FEATURES.map((f) => {
          const isActive = f.id === active;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(f.id)}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.2,
                color: isActive ? '#ffffff' : '#234c78',
                background: isActive ? '#5a8c4a' : 'transparent',
                transition: 'background 120ms ease, color 120ms ease',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
