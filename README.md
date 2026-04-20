# HCI Mobile Health App — Hi-Fi Prototype

Three-feature HCI Week 6 Hi-Fi prototype — David, Edward, Jean.

Built with React 18 + Vite + Tailwind CSS.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- npm (ships with Node.js)

## Run locally

From the project root:

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal (default: [http://localhost:5173/](http://localhost:5173/)).

## Other scripts

- `npm run build` — produce a production build in `dist/`
- `npm run preview` — serve the production build locally

## Troubleshooting

### `Cannot find module @rollup/rollup-darwin-arm64`

This is a [known npm bug](https://github.com/npm/cli/issues/4828) with optional dependencies. Fix by installing the missing platform binary:

```bash
npm install @rollup/rollup-darwin-arm64 --no-save
```

On non-Apple-Silicon machines, swap the package for your platform (e.g. `@rollup/rollup-linux-x64-gnu`, `@rollup/rollup-win32-x64-msvc`).

If that doesn't resolve it, do a clean reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```
