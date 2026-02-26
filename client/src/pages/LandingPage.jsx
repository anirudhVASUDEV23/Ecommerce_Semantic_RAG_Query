import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHealth } from '../lib/api'

// ─── Scroll-reveal hook ───────────────────────────────────────────────────────
function useScrollReveal(options = {}) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('in-view'); obs.unobserve(el) } },
      { threshold: 0.15, ...options }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

// ─── Star field ───────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  delay: Math.random() * 4,
  duration: 2 + Math.random() * 3,
}))

function StarField() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {STARS.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: '#fff',
            opacity: 0.15,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

const FEATURES = [
  {
    emoji: '❓',
    title: 'FAQ Semantic Search',
    desc: 'Ask about returns, shipping, payments or any support question — ChromaDB vector search finds the best answer instantly.',
    accent: '#6366f1',
    tag: 'ChromaDB · Embeddings',
  },
  {
    emoji: '👟',
    title: 'Shoes Product Search',
    desc: 'Find shoes by brand, price, discount, or rating using plain English. LLM converts your question into a live SQL query.',
    accent: '#06b6d4',
    tag: 'Text-to-SQL · SQLite',
  },
  {
    emoji: '💬',
    title: 'Contextual Follow-ups',
    desc: 'Ask follow-up questions like "which one is cheaper?" or "is that good for running?" — the AI remembers the context.',
    accent: '#f59e0b',
    tag: 'Session Memory · LLM',
  },
]

const TECH_STACK = ['FastAPI', 'ChromaDB', 'LiteLLM', 'SQLite', 'Voyage AI', 'Semantic Router', 'React', 'Vite']

const STATS = [
  { value: '5K+', label: 'Products' },
  { value: '3',    label: 'AI Routes' },
  { value: '<200ms', label: 'Latency' },
  { value: '∞', label: 'Queries' },
]

// ─── Sample Q&A data ───────────────────────────────────────────────────────────────
const QA_TABS = [
  {
    id: 'sql',
    label: '👟 Shoe Search',
    accent: '#06b6d4',
    route: 'SQL → SQLite',
    q: 'Show me Nike shoes under ₹5,000 with at least 4-star rating',
    a: [
      { title: 'Nike Men Air Max', price: '₹4,299', discount: '15% off', rating: '★ 4.3', link: '#' },
      { title: 'Nike Revolution 6', price: '₹3,799', discount: '20% off', rating: '★ 4.5', link: '#' },
      { title: 'Nike Court Vision', price: '₹4,899', discount: '10% off', rating: '★ 4.1', link: '#' },
    ],
    isProduct: true,
  },
  {
    id: 'faq',
    label: '❓ Support',
    accent: '#6366f1',
    route: 'FAQ → ChromaDB',
    q: 'What is your return policy?',
    a: 'You can return most items within **10 days** of delivery for a full refund. Products must be unused, unworn, and in original packaging with all tags attached. To initiate a return, go to **My Orders** in the Flipkart app and select the item you wish to return.',
    isProduct: false,
  },
  {
    id: 'contextual',
    label: '💬 Follow-up',
    accent: '#f59e0b',
    route: 'Contextual → LLM',
    q: 'Which one is best for running on a daily basis?',
    a: 'Based on the shoes I showed you, the **Nike Revolution 6** is best for daily running. It has a lightweight foam midsole designed for cushioning over long distances, a breathable mesh upper, and a durable rubber outsole — all ideal for everyday jogging.',
    isProduct: false,
  },
]

// ─── FAQ accordion data ───────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'What kind of shoes are in the database?',
    a: 'The SQLite database contains 5,000+ shoe products from brands like Nike, Puma, Campus, Adidas, Skechers, Bata, and more. Products include running shoes, formal shoes, casual sneakers, sandals, and sports shoes for men, women, and kids — all with prices, discounts, ratings, and links.',
  },
  {
    q: 'How does the semantic routing work?',
    a: 'Every message is embedded using a SentenceTransformer model and scored against three route definitions (FAQ, SQL, contextual) using cosine similarity. If the score exceeds a threshold (0.35–0.4), the query is dispatched to the matching pipeline. If no route matches, the system returns a graceful “out of scope” reply.',
  },
  {
    q: 'Are my conversations stored anywhere?',
    a: 'Conversation history is held in-memory on the server for up to 30 minutes of inactivity, then automatically purged. Nothing is written to disk. Each browser tab gets its own session ID, so sessions are isolated between tabs.',
  },
  {
    q: 'What happens when I ask something out of scope?',
    a: 'If no route matches and there is no session history to reference, FlipAssist returns a canned reply explaining what it can help with (shoes, support questions, follow-ups). It will never hallucinate or ask you for more context.',
  },
  {
    q: 'Can I ask follow-up questions about search results?',
    a: 'Yes — this is what the contextual route is for. After seeing product results, ask things like “which one is best for running?”, “is the second one waterproof?”, or “which has the highest rating?” and the LLM will answer using the previous results as context.',
  },
]
// ─── Sample Q&A component ───────────────────────────────────────────────────────────────
function SampleQA() {
  const [active, setActive] = useState('sql')
  const tab = QA_TABS.find(t => t.id === active)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex', gap: 8, marginBottom: 20,
          justifyContent: 'center', flexWrap: 'wrap',
        }}
      >
        {QA_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: '8px 20px', borderRadius: 100, border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: "'Instrument Sans', sans-serif",
              transition: 'all 0.2s',
              background: active === t.id ? `${t.accent}25` : 'rgba(15,23,42,0.6)',
              color: active === t.id ? t.accent : '#475569',
              boxShadow: active === t.id ? `0 0 0 1px ${t.accent}50` : '0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Chat window */}
      <div
        style={{
          borderRadius: 20,
          background: 'rgba(10,15,30,0.8)',
          border: `1px solid ${tab.accent}30`,
          overflow: 'hidden',
          boxShadow: `0 0 40px ${tab.accent}12, 0 24px 60px rgba(0,0,0,0.4)`,
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
      >
        {/* Window chrome */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(2,8,23,0.7)',
          borderBottom: `1px solid ${tab.accent}15`,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#ff5f57','#febc2e','#28c840'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <span style={{
            fontSize: 11, color: tab.accent, fontFamily: "'Instrument Sans', monospace",
            background: `${tab.accent}15`, padding: '2px 10px', borderRadius: 100,
            border: `1px solid ${tab.accent}30`,
          }}>
            route: {tab.route}
          </span>
        </div>

        {/* Messages */}
        <div style={{ padding: '20px 20px 8px' }}>
          {/* User bubble */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <div style={{
              maxWidth: '78%', padding: '10px 16px',
              borderRadius: '16px 16px 4px 16px',
              background: `linear-gradient(135deg, ${tab.accent}cc, ${tab.accent}88)`,
              color: '#fff', fontSize: 13.5, lineHeight: 1.5,
            }}>
              {tab.q}
            </div>
          </div>

          {/* Assistant response */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: `${tab.accent}20`, border: `1px solid ${tab.accent}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>✦</div>
            <div style={{ flex: 1 }}>
              {tab.isProduct ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tab.a.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(30,41,59,0.7)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12.5,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        gap: 8, flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.title}</span>
                      <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#64748b' }}>
                        <span style={{ color: '#06b6d4', fontWeight: 700 }}>{p.price}</span>
                        <span style={{ color: '#22c55e' }}>{p.discount}</span>
                        <span style={{ color: '#f59e0b' }}>{p.rating}</span>
                        <a href={p.link} style={{ color: '#6366f1' }}>🔗</a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: '12px 16px', borderRadius: '4px 16px 16px 16px',
                    background: 'rgba(30,41,59,0.7)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#94a3b8', fontSize: 13.5, lineHeight: 1.65,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: tab.a
                      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2e8f0">$1</strong>')
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FAQ accordion component ───────────────────────────────────────────────────────────────
function FaqAccordion() {
  const [open, setOpen] = useState(null)
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i
        return (
          <div
            key={i}
            style={{
              borderRadius: 14,
              background: isOpen ? 'rgba(99,102,241,0.06)' : 'rgba(15,23,42,0.6)',
              border: `1px solid ${isOpen ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}`,
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 12,
                padding: '16px 20px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 14, fontWeight: 600, color: isOpen ? '#a5b4fc' : '#e2e8f0',
                fontFamily: "'Instrument Sans', sans-serif",
                transition: 'color 0.2s',
              }}>
                {item.q}
              </span>
              <span style={{
                fontSize: 18, color: '#334155', flexShrink: 0,
                transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                lineHeight: 1,
              }}>+</span>
            </button>
            {isOpen && (
              <div style={{
                padding: '0 20px 18px',
                color: '#64748b', fontSize: 13.5, lineHeight: 1.75,
                fontFamily: "'Instrument Sans', sans-serif",
              }}>
                {item.a}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Typing ticker queries ────────────────────────────────────────────────────
const TYPING_QUERIES = [
  'Show me Nike shoes under ₹5,000',
  'Puma running shoes with 40% discount',
  'What is your return policy?',
  'Ladies sandals under ₹2,000 with rating above 4',
  'How do I track my order?',
  'Best rated campus shoes for men',
  'Formal shoes under ₹3,000 with free shipping',
]

// ─── Typing ticker component ──────────────────────────────────────────────────
function TypingTicker() {
  const [displayText, setDisplayText] = useState('')
  const [queryIndex, setQueryIndex] = useState(0)
  const [phase, setPhase] = useState('typing') // 'typing' | 'pause' | 'erasing'
  const charRef = useRef(0)
  const timerRef = useRef(null)

  const tick = useCallback(() => {
    const current = TYPING_QUERIES[queryIndex]
    if (phase === 'typing') {
      charRef.current += 1
      setDisplayText(current.slice(0, charRef.current))
      if (charRef.current >= current.length) {
        setPhase('pause')
        timerRef.current = setTimeout(() => setPhase('erasing'), 1800)
        return
      }
      timerRef.current = setTimeout(tick, 48)
    } else if (phase === 'erasing') {
      charRef.current -= 1
      setDisplayText(current.slice(0, charRef.current))
      if (charRef.current <= 0) {
        setQueryIndex(i => (i + 1) % TYPING_QUERIES.length)
        setPhase('typing')
        return
      }
      timerRef.current = setTimeout(tick, 24)
    }
  }, [phase, queryIndex])

  useEffect(() => {
    timerRef.current = setTimeout(tick, phase === 'typing' ? 80 : 24)
    return () => clearTimeout(timerRef.current)
  }, [tick, phase, queryIndex])

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        borderRadius: 14,
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(99,102,241,0.2)',
        backdropFilter: 'blur(12px)',
        marginBottom: 40,
        maxWidth: 540,
        width: '100%',
        animation: 'fadeInUp 0.5s ease 0.2s forwards',
        opacity: 0,
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>🔍</span>
      <span
        style={{
          fontSize: 14,
          color: '#94a3b8',
          flex: 1,
          textAlign: 'left',
          minHeight: '1.4em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {displayText}
        <span
          style={{
            display: 'inline-block',
            width: 2,
            height: '1em',
            background: '#6366f1',
            marginLeft: 2,
            verticalAlign: 'middle',
            animation: 'blink 1s step-end infinite',
          }}
        />
      </span>
    </div>
  )
}

// ─── How it works steps ───────────────────────────────────────────────────────
const HOW_STEPS = [
  {
    num: '01',
    icon: '✍️',
    title: 'Type your question',
    desc: 'Ask anything in plain English — a shoe query, a support question, or a follow-up on products already shown.',
    accent: '#6366f1',
  },
  {
    num: '02',
    icon: '🧭',
    title: 'Semantic router classifies intent',
    desc: 'The semantic router embeds your query and scores it against FAQ, SQL, and contextual route utterances in real time.',
    accent: '#f59e0b',
  },
  {
    num: '03',
    icon: '⚡',
    title: 'Right pipeline answers instantly',
    desc: 'The best-matched chain runs — ChromaDB retrieval, Text-to-SQL, or contextual LLM — and streams back the answer word-by-word.',
    accent: '#06b6d4',
  },
]

// ─── Orb decoration ───────────────────────────────────────────────────────────
function Orb({ style }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}

// ─── Animated sub-components for scroll-reveal ─────────────────────────────────
function AnimatedStep({ step, i, total }) {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className="reveal-up"
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', position: 'relative', padding: '0 12px',
        animationDelay: `${i * 0.15}s`,
      }}
    >
      {/* Connecting line */}
      {i < total - 1 && (
        <div style={{
          position: 'absolute', top: 36,
          left: 'calc(50% + 36px)', right: 'calc(-50% + 36px)',
          height: 1,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.4), rgba(99,102,241,0.1))',
          borderTop: '1px dashed rgba(99,102,241,0.3)',
        }} />
      )}
      {/* Icon circle */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `${step.accent}15`, border: `1px solid ${step.accent}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, marginBottom: 20, position: 'relative', zIndex: 1,
        boxShadow: `0 0 24px ${step.accent}20`, flexShrink: 0,
      }}>
        {step.icon}
        <div style={{
          position: 'absolute', top: -4, right: -4,
          width: 22, height: 22, borderRadius: '50%',
          background: step.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#020817',
        }}>{i + 1}</div>
      </div>
      <h3 style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 16, fontWeight: 400, color: '#f1f5f9',
        textAlign: 'center', marginBottom: 10, letterSpacing: '-0.2px',
      }}>{step.title}</h3>
      <p style={{ fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 1.7 }}>
        {step.desc}
      </p>
    </div>
  )
}

function AnimatedFeatureCard({ f, fi }) {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className="reveal-up"
      style={{
        padding: '28px 24px', borderRadius: 20,
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: 'default', transition: 'all 0.25s',
        animationDelay: `${fi * 0.12}s`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)'
        e.currentTarget.style.boxShadow = `0 24px 60px ${f.accent}35`
        e.currentTarget.style.borderColor = `${f.accent}50`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 14 }}>{f.emoji}</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center',
        fontSize: 10, padding: '2px 8px', borderRadius: 20,
        background: `${f.accent}18`, color: f.accent,
        fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5,
      }}>{f.tag}</div>
      <h3 style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#f1f5f9',
      }}>{f.title}</h3>
      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>{f.desc}</p>
    </div>
  )
}

function StatsStrip() {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className="reveal-scale"
      style={{
        maxWidth: 800, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        gap: 2,
        background: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 20, overflow: 'hidden',
      }}
    >
      {STATS.map((s, i) => (
        <div key={s.label} style={{
          padding: '28px 0', textAlign: 'center',
          borderRight: i < 3 ? '1px solid rgba(99,102,241,0.12)' : 'none',
        }}>
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 32, fontWeight: 800,
            background: 'linear-gradient(135deg,#6366f1,#a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', marginBottom: 4,
          }}>{s.value}</div>
          <div style={{ fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Chat preview ─────────────────────────────────────────────────────────────
function MinichatPreview() {
  return (
    <div
      style={{
        background: 'rgba(15,23,42,0.85)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        maxWidth: '480px',
        width: '100%',
      }}
    >
      {/* Chrome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '12px 16px',
          background: 'rgba(2,8,23,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ marginLeft: 8, fontSize: 12, color: '#475569' }}>FlipAssist — Chat</span>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* User bubble */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div
            style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff',
              borderRadius: '16px 16px 4px 16px',
              padding: '10px 14px',
              fontSize: 13,
              maxWidth: '85%',
            }}
          >
            Best Nike shoes under ₹5,000?
          </div>
        </div>

        {/* Bot bubble */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 14,
            }}
          >
            ✦
          </div>
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 20,
                background: 'rgba(6,182,212,0.12)',
                color: '#06b6d4',
                marginBottom: 6,
              }}
            >
              🗄 sql
            </span>
            <div
              style={{
                background: 'rgba(30,41,59,0.8)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '4px 16px 16px 16px',
                padding: '10px 14px',
                fontSize: 13,
                color: '#cbd5e1',
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: '#f1f5f9' }}>Puma Men Running Shoes</strong> · ₹2,399 · ★ 4.5 · 40% off
              <br />
              <strong style={{ color: '#f1f5f9' }}>Nike Air Max SC</strong> · ₹3,795 · ★ 4.3 · 25% off
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 13,
                  background: '#6366f1',
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'blink 1s step-end infinite',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Large footer component ──────────────────────────────────────────────────
function BigFooter() {
  const FOOTER_LINKS = [
    {
      heading: 'Product',
      links: [
        { label: 'Chat', href: '/chat' },
        { label: 'Features', href: '#features' },
        { label: 'How it works', href: '#how' },
        { label: 'API Docs', href: 'http://localhost:8000/docs', external: true },
      ],
    },
    {
      heading: 'Pipelines',
      links: [
        { label: 'FAQ Semantic Search', href: '/chat' },
        { label: 'SQL Product Search', href: '/chat' },
        { label: 'Contextual Follow-up', href: '/chat' },
        { label: 'LLM Fallback', href: '/chat' },
      ],
    },
    {
      heading: 'Tech Stack',
      links: [
        { label: 'FastAPI + LiteLLM', href: '#' },
        { label: 'ChromaDB + VoyageAI', href: '#' },
        { label: 'React + Vite', href: '#' },
        { label: 'Semantic Router', href: '#' },
      ],
    },
  ]

  return (
    <footer style={{
      borderTop: '1px solid var(--footer-divider)',
      background: 'var(--background)',
      color: 'var(--foreground)',
      transition: 'background 0.3s, color 0.3s',
    }}>
      {/* Top section — tagline + link columns */}
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '72px 24px 48px',
        display: 'grid',
        gridTemplateColumns: '1fr repeat(3, auto)',
        gap: '40px 64px',
        alignItems: 'start',
      }}>
        {/* Tagline */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>🛍</div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>FlipAssist</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--footer-text)', lineHeight: 1.8, maxWidth: 220 }}>
            E-commerce Semantic RAG — your products, questions, and follow-ups answered by the right AI pipeline.
          </p>
        </div>

        {/* Link columns */}
        {FOOTER_LINKS.map((col) => (
          <div key={col.heading}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase', color: 'var(--footer-link)',
              marginBottom: 18,
            }}>{col.heading}</p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {col.links.map((lnk) => (
                <li key={lnk.label}>
                  {lnk.external ? (
                    <a
                      href={lnk.href}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: 'var(--footer-text)', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--footer-text)'}
                    >{lnk.label} ↗</a>
                  ) : (
                    <Link
                      to={lnk.href}
                      style={{ fontSize: 13, color: 'var(--footer-text)', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--footer-text)'}
                    >{lnk.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Huge brand wordmark */}
      <div style={{
        overflow: 'hidden',
        padding: '0 24px',
        lineHeight: 0.85,
        userSelect: 'none',
      }}>
        <p
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 'clamp(72px, 14vw, 160px)',
            fontWeight: 400,
            letterSpacing: '-4px',
            color: 'var(--footer-brand)',
            transition: 'color 0.3s',
            margin: 0,
          }}
        >
          FlipAssist
        </p>
      </div>

      {/* Bottom meta bar */}
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '24px 24px 32px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        borderTop: '1px solid var(--footer-divider)',
        fontSize: 12, color: 'var(--footer-link)',
      }}>
        <span>© {new Date().getFullYear()} FlipAssist — E-commerce Semantic RAG</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { label: 'API Docs', href: 'http://localhost:8000/docs', external: true },
            { label: 'GitHub', href: '#', external: true },
          ].map(lnk => (
            <a
              key={lnk.label}
              href={lnk.href}
              target={lnk.external ? '_blank' : undefined}
              rel={lnk.external ? 'noreferrer' : undefined}
              style={{ color: 'var(--footer-link)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--footer-link)'}
            >{lnk.label}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  const [apiOnline, setApiOnline] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('flip-theme') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('flip-theme', theme) } catch {}
  }, [theme])

  useEffect(() => {
    getHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))
  }, [])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const isDark = theme === 'dark'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', overflowX: 'hidden', transition: 'background 0.3s, color 0.3s' }}>

      {/* ── Navbar ── */}
      <nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: scrolled ? 'var(--nav-bg)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(99,102,241,0.12)' : 'none',
          transition: 'all 0.3s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}
          >🛍</div>
          <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--foreground)' }}>FlipAssist</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* API status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>
            <div
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: apiOnline === null ? 'var(--muted-foreground)' : apiOnline ? '#22c55e' : '#ef4444',
                boxShadow: apiOnline ? '0 0 8px rgba(34,197,94,0.7)' : undefined,
              }}
            />
            <span>{apiOnline === null ? 'Connecting…' : apiOnline ? 'API Online' : 'API Offline'}</span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: '1px solid rgba(99,102,241,0.25)',
              background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
              color: isDark ? '#a5b4fc' : '#f59e0b',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
              transition: 'all 0.25s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1) rotate(15deg)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) rotate(0deg)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)' }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          <Link
            to="/chat"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 12,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            💬 Open Chat
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '100px 24px 60px',
        }}
      >
        {/* Background orbs + star field */}
        <StarField />
        <Orb style={{ top: '10%', left: '5%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)', animation: 'orbDrift1 18s ease-in-out infinite' }} />
        <Orb style={{ bottom: '10%', right: '5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)', animation: 'orbDrift2 14s ease-in-out infinite' }} />
        <Orb style={{ top: '40%', left: '40%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)', animation: 'orbDrift3 10s ease-in-out infinite' }} />

        <div
          style={{
            maxWidth: 1100,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 16px', borderRadius: 100,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#a5b4fc', fontSize: 12, fontWeight: 500,
              marginBottom: 28,
              animation: 'fadeInUp 0.5s ease forwards',
            }}
          >
            ✦ Semantic RAG · LiteLLM · Streaming
          </div>

          {/* Main headline */}
          <h1
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 'clamp(42px, 7vw, 82px)',
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: '-1.5px',
              textAlign: 'center',
              marginBottom: 24,
              animation: 'fadeInUp 0.5s ease 0.1s forwards',
              opacity: 0,
            }}
          >
            Shop smarter with{' '}
            <span className="animated-gradient-text" style={{ fontStyle: 'italic' }}>
              AI search
            </span>
          </h1>

          <TypingTicker />

          {/* CTAs */}
          <div
            style={{
              display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
              marginBottom: 72,
              animation: 'fadeInUp 0.5s ease 0.3s forwards',
              opacity: 0,
            }}
          >
            <Link
              to="/chat"
              className="cta-pulse"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 32px', borderRadius: 16,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              Start Chatting →
            </Link>
            <a
              href="#features"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 32px', borderRadius: 16,
                background: 'rgba(30,41,59,0.8)',
                border: '1px solid rgba(99,102,241,0.2)',
                color: '#94a3b8', fontSize: 15, fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.color = '#e2e8f0' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.color = '#94a3b8' }}
            >
              See Features ↓
            </a>
          </div>

          {/* Mini chat preview */}
          <div
            style={{
              animation: 'fadeInUp 0.6s ease 0.45s forwards',
              opacity: 0,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <MinichatPreview />
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section style={{ padding: '0 24px 80px' }}>
        <StatsStrip />
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 11, color: '#334155', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>
              How it works
            </p>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(26px,4vw,44px)',
                fontWeight: 400,
                letterSpacing: '-0.5px',
              }}
            >
              From question to answer{' '}
              <span style={{ fontStyle: 'italic', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                in milliseconds
              </span>
            </h2>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
            {HOW_STEPS.map((step, i) => (
              <AnimatedStep key={step.num} step={step} i={i} total={HOW_STEPS.length} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '0 24px 100px' }}>

        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(28px,4vw,48px)',
                fontWeight: 400,
                letterSpacing: '-0.5px',
                marginBottom: 12,
              }}
            >
              Three pipelines,{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg,#6366f1,#06b6d4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                one interface
              </span>
            </h2>
            <p style={{ color: '#64748b', fontSize: 15 }}>
              FlipAssist auto-routes every query to the most appropriate AI chain.
            </p>
          </div>

          <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}>
            {FEATURES.map((f, fi) => (
              <AnimatedFeatureCard key={f.title} f={f} fi={fi} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture Diagram ── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Section label */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, color: '#334155', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>
              Under the hood
            </p>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(26px,4vw,44px)',
                fontWeight: 400,
                letterSpacing: '-0.5px',
                marginBottom: 12,
              }}
            >
              How your query gets answered
            </h2>
            <p style={{ color: '#475569', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
              Every message is semantically routed to the best pipeline — FAQ retrieval, SQL search, contextual follow-up, or a graceful fallback.
            </p>
          </div>

          {/* Diagram card */}
          <div
            style={{
              position: 'relative',
              borderRadius: 24,
              overflow: 'hidden',
              border: '1px solid rgba(99,102,241,0.2)',
              boxShadow: '0 0 60px rgba(99,102,241,0.12), 0 32px 80px rgba(0,0,0,0.5)',
              background: 'rgba(10,15,30,0.6)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Decorative corner orbs */}
            <Orb style={{ top: -40, left: -40, width: 180, height: 180, background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)' }} />
            <Orb style={{ bottom: -40, right: -40, width: 180, height: 180, background: 'radial-gradient(circle, rgba(6,182,212,0.15), transparent 70%)' }} />

            {/* Chrome bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 20px',
                background: 'rgba(2,8,23,0.7)',
                borderBottom: '1px solid rgba(99,102,241,0.12)',
              }}
            >
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
              <span style={{ marginLeft: 10, fontSize: 11, color: '#334155', fontFamily: "'Instrument Sans', monospace" }}>
                architecture_diagram.png — Intent Based e-Commerce Chatbot
              </span>
            </div>

            {/* Image */}
            <div
              style={{
                padding: '32px',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <img
                src="/architecture_diagram.png"
                alt="System architecture diagram showing the semantic router directing queries to faq_chain, contextual_route, sql_chain, and general_llm_fallback pipelines"
                style={{
                  width: '100%',
                  maxWidth: 740,
                  borderRadius: 12,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Route legend */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 12,
                padding: '0 24px 28px',
              }}
            >
              {[
                { label: 'faq_chain',           color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
                { label: 'sql_chain',            color: '#06b6d4', bg: 'rgba(6,182,212,0.1)'  },
                { label: 'contextual_route',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                { label: 'general_llm_fallback', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 14px', borderRadius: 100,
                    background: r.bg,
                    border: `1px solid ${r.color}30`,
                    fontSize: 11, fontWeight: 500,
                    color: r.color,
                    fontFamily: "'Instrument Sans', monospace",
                    letterSpacing: 0.2,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color }} />
                  {r.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sample Conversations ── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, color: '#334155', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>
              See it in action
            </p>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(26px,4vw,44px)',
                fontWeight: 400,
                letterSpacing: '-0.5px',
                marginBottom: 12,
              }}
            >
              Ask anything,{' '}
              <span style={{ fontStyle: 'italic', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                get a smart answer
              </span>
            </h2>
            <p style={{ color: '#475569', fontSize: 14, maxWidth: 460, margin: '0 auto' }}>
              Click a tab to see realistic examples of each pipeline in action.
            </p>
          </div>
          <SampleQA />
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section style={{ padding: '0 24px 100px' }}>

        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#334155', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>
            Built with
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {TECH_STACK.map((t) => (
              <span
                key={t}
                style={{
                  padding: '7px 16px', borderRadius: 100,
                  background: 'rgba(30,41,59,0.8)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  color: '#94a3b8', fontSize: 13, fontWeight: 500,
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
                  e.currentTarget.style.color = '#a5b4fc'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'
                  e.currentTarget.style.color = '#94a3b8'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Accordion ── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, color: '#334155', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>
              Common questions
            </p>
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(26px,4vw,44px)',
                fontWeight: 400,
                letterSpacing: '-0.5px',
              }}
            >
              Everything you need to know
            </h2>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            borderRadius: 28,
            padding: '64px 40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 50%, rgba(6,182,212,0.12) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
          }}
        >
          <Orb style={{ top: -60, right: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent)' }} />
          <Orb style={{ bottom: -40, left: -40, width: 150, height: 150, background: 'radial-gradient(circle, rgba(6,182,212,0.2), transparent)' }} />

          <div style={{ fontSize: 48, marginBottom: 20, animation: 'float 3s ease-in-out infinite' }}>✦</div>
          <h2
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 'clamp(24px,4vw,44px)',
              fontWeight: 400,
              letterSpacing: '-0.5px',
              marginBottom: 12,
            }}
          >
            Ready to find anything?
          </h2>
          <p style={{ color: '#64748b', fontSize: 16, marginBottom: 36, maxWidth: 420, margin: '0 auto 36px' }}>
            Search products, compare prices, get support — all in a single chat.
          </p>
          <Link
            to="/chat"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '16px 40px', borderRadius: 16,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', fontSize: 16, fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 10px 40px rgba(99,102,241,0.5)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 16px 50px rgba(99,102,241,0.65)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 10px 40px rgba(99,102,241,0.5)' }}
          >
            Talk to FlipAssist →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <BigFooter />
    </div>
  )
}
