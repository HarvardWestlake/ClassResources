# Rhythm Reading Widget

A Vite-based rhythm practice widget for sight-reading rhythms.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Preview production build:
```bash
npm run preview
```

## Project Structure

```
widget/
├── index.html          # Entry HTML file
├── package.json        # Dependencies and scripts
├── vite.config.js     # Vite configuration
├── src/
│   ├── main.js        # Main JavaScript application
│   └── styles.css     # CSS styles
└── dist/              # Production build output (generated)
```

## Development

The widget uses:
- **Vite** for fast development and building
- **uPlot** for charting timing data
- Vanilla JavaScript (no framework)

The development server runs on `http://127.0.0.1:5173` by default.

