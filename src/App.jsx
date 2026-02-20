import { useState } from 'react'
import OpenAI from 'openai'
import './App.css'

const client = new OpenAI({
  apiKey: import.meta.env.VITE_GROK_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  dangerouslyAllowBrowser: true,
})

const SYSTEM_PROMPT = `You are an expert emotional intelligence analyst specializing in longitudinal emotional pattern detection from personal journal entries.

Your job is to analyze a sequence of journal entries and detect:
- The emotional tone and score of each entry
- Long-term emotional drift trends (how emotions evolve over time)
- Significant pattern shifts (sudden changes, turning points, cycles)
- Recurring emotional themes and triggers

Scoring scale: -10 (deeply negative/distressed) to +10 (deeply positive/joyful). 0 is neutral.

Return ONLY a valid JSON object — no markdown, no explanation, just raw JSON — with this exact structure:
{
  "overall_trajectory": "A short descriptive arc title (e.g. 'Gradual Decline', 'Recovery Arc', 'Emotional Volatility', 'Stable Growth', 'Burnout then Rebound')",
  "drift_type": "exactly one of: Stable | Gradual Positive | Gradual Negative | Volatile | V-Shape Recovery | Inverted V-Shape | Cyclical",
  "entries": [
    {
      "entry_number": 1,
      "score": 4,
      "dominant_emotion": "hopeful",
      "emotion_tags": ["optimistic", "anxious", "motivated"],
      "summary": "1-2 sentence emotional summary of what this specific entry reveals emotionally."
    }
  ],
  "pattern_shifts": [
    {
      "between_entries": "2 → 3",
      "direction": "negative",
      "magnitude": 7,
      "description": "Sharp emotional decline — likely triggered by the stress referenced around work deadlines."
    }
  ],
  "key_themes": ["loneliness", "self-doubt", "growth", "work stress", "hope"],
  "drift_summary": "Write 3-4 sentences analyzing the emotional journey as a whole — what patterns emerged, what the drift reveals about the person's mental state, and what the trajectory suggests going forward.",
  "wellbeing_indicator": "exactly one of: Improving | Stable | Declining | Concerning | Mixed"
}`

// ── Helpers ────────────────────────────────────────────────────────────────────

const SCORE_COLOR = (score) => {
  if (score >= 7)  return '#22c55e'
  if (score >= 4)  return '#86efac'
  if (score >= 1)  return '#fde68a'
  if (score >= -2) return '#fb923c'
  if (score >= -6) return '#f87171'
  return '#dc2626'
}

const WELLBEING_META = {
  Improving:  { color: '#22c55e', icon: '↑' },
  Stable:     { color: '#60a5fa', icon: '→' },
  Declining:  { color: '#f87171', icon: '↓' },
  Concerning: { color: '#dc2626', icon: '⚠' },
  Mixed:      { color: '#fb923c', icon: '~' },
}

const DRIFT_META = {
  'Stable':           '#60a5fa',
  'Gradual Positive': '#22c55e',
  'Gradual Negative': '#f87171',
  'Volatile':         '#fb923c',
  'V-Shape Recovery': '#a78bfa',
  'Inverted V-Shape': '#f472b6',
  'Cyclical':         '#22d3ee',
}

// ── SVG Emotion Chart ──────────────────────────────────────────────────────────

function EmotionChart({ entries }) {
  if (!entries || entries.length < 2) return null

  const W = 560, H = 160
  const PAD = { top: 16, right: 20, bottom: 28, left: 38 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom
  const n = entries.length

  const toX = (i) => PAD.left + (i / (n - 1)) * cW
  const toY = (s) => PAD.top + ((10 - s) / 20) * cH
  const zeroY = toY(0)

  const linePts = entries.map((e, i) => `${toX(i)},${toY(e.score)}`).join(' ')
  const areaPts = `${toX(0)},${zeroY} ${linePts} ${toX(n - 1)},${zeroY}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="emotion-chart">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {[-10, -5, 0, 5, 10].map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
            stroke={v === 0 ? '#4b5563' : '#1f2937'}
            strokeWidth={v === 0 ? 1.5 : 1}
            strokeDasharray={v === 0 ? '' : '4 4'}
          />
          <text x={PAD.left - 6} y={toY(v) + 4} fill="#6b7280" fontSize="9" textAnchor="end">
            {v > 0 ? `+${v}` : v}
          </text>
        </g>
      ))}

      <polygon points={areaPts} fill="url(#areaFill)" />
      <polyline
        points={linePts} fill="none"
        stroke="#a78bfa" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round"
      />

      {entries.map((e, i) => (
        <g key={i}>
          <circle
            cx={toX(i)} cy={toY(e.score)} r="5"
            fill={SCORE_COLOR(e.score)} stroke="#111827" strokeWidth="2"
          />
          <text x={toX(i)} y={H - 7} fill="#9ca3af" fontSize="10" textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────

function App() {
  const [entries, setEntries] = useState([
    { id: 1, date: '', text: '' },
    { id: 2, date: '', text: '' },
  ])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const addEntry = () =>
    setEntries((p) => [...p, { id: Date.now(), date: '', text: '' }])

  const updateEntry = (id, field, value) =>
    setEntries((p) => p.map((e) => (e.id === id ? { ...e, [field]: value } : e)))

  const removeEntry = (id) => {
    if (entries.length <= 1) return
    setEntries((p) => p.filter((e) => e.id !== id))
  }

  const analyze = async () => {
    const valid = entries.filter((e) => e.text.trim())
    if (valid.length < 2) {
      setError('Please add at least 2 journal entries with content to detect patterns.')
      return
    }

    setLoading(true)
    setError(null)
    setAnalysis(null)

    const payload = valid
      .map((e, i) => `Entry ${i + 1}${e.date ? ` [${e.date}]` : ''}:\n${e.text.trim()}`)
      .join('\n\n---\n\n')

    try {
      const res = await client.chat.completions.create({
        model: 'grok-2-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze these journal entries for emotional drift and pattern shifts:\n\n${payload}`,
          },
        ],
      })

      const raw   = res.choices[0].message.content
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse analysis. Please try again.')
      setAnalysis(JSON.parse(match[0]))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const driftColor = DRIFT_META[analysis?.drift_type] ?? '#a78bfa'
  const wbMeta     = WELLBEING_META[analysis?.wellbeing_indicator] ?? { color: '#9ca3af', icon: '?' }

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <span className="header-icon">📓</span>
        <div className="header-text">
          <h1>Emotional Tone Drift Analyzer</h1>
          <p>Detect long-term emotional patterns &amp; shifts across your journal entries</p>
        </div>
      </header>

      <div className="layout">

        {/* ── LEFT: Journal Entries ── */}
        <aside className="entries-panel">
          <div className="panel-header">
            <h2>Journal Entries</h2>
            <button className="btn-add" onClick={addEntry}>+ Add Entry</button>
          </div>
          <p className="panel-hint">Add 2+ entries in chronological order to detect drift.</p>

          <div className="entries-list">
            {entries.map((entry, idx) => (
              <div key={entry.id} className="entry-card">
                <div className="entry-card-header">
                  <span className="entry-label">Entry {idx + 1}</span>
                  <div className="entry-card-actions">
                    <input
                      type="date"
                      value={entry.date}
                      onChange={(e) => updateEntry(entry.id, 'date', e.target.value)}
                      className="date-input"
                    />
                    {entries.length > 1 && (
                      <button
                        className="btn-remove"
                        onClick={() => removeEntry(entry.id)}
                        title="Remove entry"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={entry.text}
                  onChange={(e) => updateEntry(entry.id, 'text', e.target.value)}
                  placeholder="Write your journal entry here..."
                  className="entry-textarea"
                  rows={4}
                />
              </div>
            ))}
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn-analyze" onClick={analyze} disabled={loading}>
            {loading ? <><span className="spin" /> Analyzing...</> : 'Analyze Emotional Drift'}
          </button>
        </aside>

        {/* ── RIGHT: Results ── */}
        <main className="results-panel">

          {/* Empty State */}
          {!analysis && !loading && (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No Analysis Yet</h3>
              <p>
                Add your journal entries on the left and click{' '}
                <strong>Analyze Emotional Drift</strong> to uncover patterns.
              </p>
              <div className="feature-hints">
                <div className="hint"><span>📈</span><span>Track emotional trends over time</span></div>
                <div className="hint"><span>🔍</span><span>Detect sudden pattern shifts</span></div>
                <div className="hint"><span>💡</span><span>Uncover recurring themes</span></div>
                <div className="hint"><span>🧭</span><span>Get a wellbeing trajectory read</span></div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="loading-state">
              <div className="loading-ring" />
              <p className="loading-title">Analyzing your emotional journey...</p>
              <p className="loading-sub">Detecting patterns, shifts &amp; themes</p>
            </div>
          )}

          {/* Results */}
          {analysis && (
            <div className="results">

              {/* Row 1: Trajectory + Wellbeing */}
              <div className="cards-row">
                <div className="card trajectory-card">
                  <div className="card-label">Overall Trajectory</div>
                  <div className="card-value">{analysis.overall_trajectory}</div>
                  <span
                    className="drift-badge"
                    style={{
                      background:   `${driftColor}18`,
                      color:         driftColor,
                      borderColor:  `${driftColor}44`,
                    }}
                  >
                    {analysis.drift_type}
                  </span>
                </div>

                <div className="card wellbeing-card">
                  <div className="card-label">Wellbeing Indicator</div>
                  <div className="wellbeing-value" style={{ color: wbMeta.color }}>
                    <span className="wellbeing-icon">{wbMeta.icon}</span>
                    {analysis.wellbeing_indicator}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="card chart-card">
                <div className="card-label">Emotional Score Over Time</div>
                <div className="chart-legend">
                  <span style={{ color: '#22c55e' }}>● Positive</span>
                  <span style={{ color: '#fde68a' }}>● Neutral</span>
                  <span style={{ color: '#f87171' }}>● Negative</span>
                </div>
                <EmotionChart entries={analysis.entries} />
              </div>

              {/* Entry Breakdown */}
              <div className="card">
                <div className="card-label">Entry-by-Entry Breakdown</div>
                <div className="breakdown-list">
                  {analysis.entries?.map((e) => (
                    <div key={e.entry_number} className="breakdown-row">
                      <div className="breakdown-left">
                        <span className="entry-num">#{e.entry_number}</span>
                        <div
                          className="score-circle"
                          style={{
                            background:  `${SCORE_COLOR(e.score)}18`,
                            color:        SCORE_COLOR(e.score),
                            borderColor: `${SCORE_COLOR(e.score)}55`,
                          }}
                        >
                          {e.score > 0 ? `+${e.score}` : e.score}
                        </div>
                      </div>
                      <div className="breakdown-right">
                        <div className="breakdown-meta">
                          <strong className="dominant-emotion">{e.dominant_emotion}</strong>
                          <div className="tags">
                            {e.emotion_tags?.map((t) => (
                              <span key={t} className="tag">{t}</span>
                            ))}
                          </div>
                        </div>
                        <p className="breakdown-summary">{e.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pattern Shifts */}
              {analysis.pattern_shifts?.length > 0 && (
                <div className="card">
                  <div className="card-label">Pattern Shifts Detected</div>
                  <div className="shifts">
                    {analysis.pattern_shifts.map((s, i) => (
                      <div key={i} className={`shift-item shift-${s.direction}`}>
                        <div className="shift-header">
                          <span className="shift-arrow">
                            {s.direction === 'positive' ? '↑' : '↓'}
                          </span>
                          <span className="shift-between">Entries {s.between_entries}</span>
                          <span className="shift-mag">Magnitude: {s.magnitude}/10</span>
                        </div>
                        <p className="shift-desc">{s.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Themes */}
              <div className="card">
                <div className="card-label">Key Themes</div>
                <div className="themes">
                  {analysis.key_themes?.map((t) => (
                    <span key={t} className="theme-pill">{t}</span>
                  ))}
                </div>
              </div>

              {/* Drift Summary */}
              <div className="card summary-card">
                <div className="card-label">Drift Analysis Summary</div>
                <p className="summary-text">{analysis.drift_summary}</p>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
