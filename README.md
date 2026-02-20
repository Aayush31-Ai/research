# Emotional Tone Drift Analyzer

Analyze a sequence of journal entries to detect long-term emotional drift trends, pattern shifts, and recurring themes — powered by Grok AI.

## What It Does

Paste in 2 or more journal entries and the app will:

- Score each entry emotionally on a scale of **-10 to +10**
- Plot an **interactive SVG chart** of your emotional arc over time
- Classify your **drift type** (e.g. V-Shape Recovery, Gradual Decline, Cyclical)
- Detect **pattern shifts** between entries with direction and magnitude
- Surface **key emotional themes** across your entries
- Generate a **wellbeing indicator** (Improving / Stable / Declining / Concerning / Mixed)
- Produce a plain-language **drift analysis summary**

## Features

- Multi-entry journal input with optional date per entry
- Real-time emotional score chart (custom SVG, no chart library needed)
- Entry-by-entry breakdown with dominant emotion and emotion tags
- Pattern shift detection with magnitude scoring
- Key themes extracted as pills
- Full drift summary paragraph from the AI
- Dark theme UI with purple/violet accents
- Responsive layout — works on desktop and mobile
- No backend required — runs entirely in the browser

## Tech Stack

- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- [OpenAI SDK](https://www.npmjs.com/package/openai) (pointed at xAI's Grok API)
- [Grok API](https://x.ai/) — model: `grok-2-latest`

## Getting Started

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd reasoning
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your API key

Create a `.env` file in the root directory:

```env
VITE_GROK_API_KEY=your_grok_api_key_here
```

Get your API key from the [xAI console](https://console.x.ai/).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for Production

```bash
npm run build
npm run preview
```

## How to Use

1. **Add journal entries** in the left panel (minimum 2)
2. Optionally set a **date** for each entry to track time context
3. Click **Analyze Emotional Drift**
4. Review results on the right:
   - Trajectory card and wellbeing indicator
   - Emotional score chart over time
   - Per-entry breakdown with scores and emotion tags
   - Pattern shifts with direction and magnitude
   - Key themes and full drift summary

## Project Structure

```
reasoning/
├── public/
├── src/
│   ├── App.jsx       # Main app — journal input, Grok API call, result rendering
│   ├── App.css       # Full UI styles (two-column layout, cards, chart, responsive)
│   ├── main.jsx      # React entry point
│   └── index.css     # Global base styles
├── .env              # API key (not committed)
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_GROK_API_KEY` | Your xAI Grok API key |

> **Note:** Never commit your `.env` file. It is already listed in `.gitignore`.

## Analysis Output Format

The AI returns a structured JSON object parsed directly into the UI:

| Field | Description |
|---|---|
| `overall_trajectory` | Short arc title (e.g. "Burnout then Rebound") |
| `drift_type` | One of 7 pattern types (Stable, Volatile, Cyclical, etc.) |
| `entries[].score` | Emotional score from -10 to +10 |
| `entries[].dominant_emotion` | Single-word emotion label |
| `entries[].emotion_tags` | Supporting emotion tags |
| `pattern_shifts` | Detected turning points with direction and magnitude |
| `key_themes` | Recurring topics across all entries |
| `wellbeing_indicator` | Overall mental state read |
| `drift_summary` | 3-4 sentence plain-language analysis |
