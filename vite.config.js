import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for the HCI HiFi prototype. The three feature components
// (CaregiverView.jsx, MedAdherence.jsx, HealthLog.jsx) live at the repo
// root; the Vite entry and the shell App live under /src.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
