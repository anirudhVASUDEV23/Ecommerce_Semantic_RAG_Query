import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { sendChatStream } from '../lib/api'

const SESSION_ID = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

const ROUTE_STYLES = {
  faq:        { label: 'FAQ',             emoji: '❓', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  sql:        { label: 'Product Search',  emoji: '👟', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)'  },
  contextual: { label: 'Follow-up',       emoji: '💬', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  fallback:   { label: 'AI Fallback',     emoji: '✦',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  unknown:    { label: 'AI',              emoji: '✦',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
}

const SUGGESTIONS = [
  { text: 'Show me Nike shoes under ₹5,000', emoji: '👟' },
  { text: 'What is your return policy?',      emoji: '↩️' },
  { text: 'Puma running shoes with 40%+ discount', emoji: '🏃' },
  { text: 'Ladies shoes under ₹2,000',         emoji: '👠' },
  { text: 'Top rated shoes with rating above 4.5', emoji: '⭐' },
  { text: 'How do I track my order?',          emoji: '📦' },
]

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--primary)',
            animation: `blink 1.2s ${i * 0.22}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Message component ────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 20,
          animation: 'fadeInUp 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: '72%' }}>
          <div
            style={{
              padding: '12px 18px',
              borderRadius: '18px 18px 4px 18px',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff',
              fontSize: 14,
              lineHeight: 1.65,
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
            }}
          >
            {msg.content}
          </div>
          <div
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 14,
            }}
          >
            👤
          </div>
        </div>
      </div>
    )
  }

  // Bot message
  const rs = ROUTE_STYLES[msg.route] || ROUTE_STYLES.unknown
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: 20,
        animation: 'fadeInUp 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '80%' }}>
        {/* Avatar */}
        <div
          style={{
            width: 34, height: 34, borderRadius: 11,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 15, fontWeight: 700, color: '#fff',
            marginTop: 2,
            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
          }}
        >
          ✦
        </div>

        <div>
          {/* Route badge */}
          {msg.route && !msg.streaming && (
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, padding: '2px 10px', borderRadius: 100,
                background: rs.bg, color: rs.color,
                fontWeight: 600, marginBottom: 8,
                border: `1px solid ${rs.color}25`,
                letterSpacing: 0.3,
              }}
            >
              {rs.emoji} {rs.label}
            </div>
          )}

          {/* Bubble */}
          <div
            style={{
              padding: '13px 17px',
              borderRadius: msg.route ? '4px 18px 18px 18px' : '18px',
              background: 'var(--bubble-bg)',
              border: '1px solid var(--bubble-border)',
              color: 'var(--foreground)',
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            {msg.streaming && !msg.content ? (
              <TypingDots />
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p style={{ margin: '0 0 8px', lineHeight: 1.7 }}>{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{children}</strong>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ paddingLeft: '1.2rem', margin: '6px 0' }}>{children}</ul>
                  ),
                  li: ({ children }) => (
                    <li style={{ marginBottom: 4 }}>{children}</li>
                  ),
                }}
              >
                {msg.content || ''}
              </ReactMarkdown>
            )}
            {/* Streaming cursor */}
            {msg.streaming && msg.content && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2, height: 14,
                  background: 'var(--primary)',
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'blink 1s step-end infinite',
                }}
              />
            )}
          </div>

          {/* Timestamp */}
          {msg.timestamp && !msg.streaming && (
            <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 5, paddingLeft: 2, opacity: 0.5 }}>
              {msg.timestamp}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm **FlipAssist**, your AI shoe shopping companion 👟\n\nI can help you with:\n- 🔍 **Find shoes** — search by brand, price, rating, or discount\n- ❓ **Support FAQs** — returns, shipping, payments and more\n- 💬 **Follow-up questions** — ask about results I've shown you\n\nTry a suggestion below or type your own question!",
      route: null,
      timestamp: now(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('flip-theme') || 'dark' } catch { return 'dark' }
  })

  const endRef = useRef(null)
  const containerRef = useRef(null)
  const textareaRef = useRef(null)

  // Sync theme to <html> data-theme and localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('flip-theme', theme) } catch {}
  }, [theme])

  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const fn = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120)
    }
    el.addEventListener('scroll', fn)
    return () => el.removeEventListener('scroll', fn)
  }, [])

  const handleSend = useCallback(async () => {
    const query = input.trim()
    if (!query || isLoading) return

    setInput('')
    setIsLoading(true)

    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: query, timestamp: now() }
    const botId = `b_${Date.now()}`
    const botMsg = { id: botId, role: 'assistant', content: '', streaming: true, route: null, timestamp: null }

    setMessages(p => [...p, userMsg, botMsg])

    try {
      const res = await sendChatStream(query, SESSION_ID)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const snap = full
        setMessages(p => p.map(m => m.id === botId ? { ...m, content: snap } : m))
      }

      const ts = now()
      setMessages(p =>
        p.map(m =>
          m.id === botId
            ? { ...m, content: full || '*(empty response)*', streaming: false, timestamp: ts }
            : m
        )
      )
    } catch (err) {
      console.error(err)
      toast.error('Unable to reach the API. Is uvicorn running?')
      setMessages(p =>
        p.map(m =>
          m.id === botId
            ? { ...m, content: '⚠️ Could not connect to the server. Please ensure `uvicorn api:app --reload` is running on port 8000.', streaming: false, timestamp: now() }
            : m
        )
      )
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }, [input, isLoading])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const clearChat = () => {
    setMessages([{
      id: `w_${Date.now()}`,
      role: 'assistant',
      content: 'Chat cleared! Ask me anything.',
      route: null,
      timestamp: now(),
    }])
    toast.success('Chat cleared')
  }

  const showSuggestions = messages.length <= 1
  const isDark = theme === 'dark'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--background)', color: 'var(--foreground)',
      transition: 'background 0.3s, color 0.3s',
    }}>

      {/* ── Header ── */}
      <header
        style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px',
          height: 60,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
        }}
      >
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: 'var(--muted-foreground)', textDecoration: 'none',
              padding: '4px 8px', borderRadius: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(99,102,241,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.background = 'transparent' }}
          >
            ← Back
          </Link>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
                boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
              }}
            >
              🛍
            </div>
            <div>
              <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 15 }}>FlipAssist</div>
              <div style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 6px rgba(34,197,94,0.7)',
                  }}
                />
                Online · Streaming
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 100,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            ⚡ Streaming
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              width: 34, height: 34, borderRadius: 9,
              border: '1px solid rgba(99,102,241,0.25)',
              background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
              color: isDark ? '#a5b4fc' : '#f59e0b',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15,
              transition: 'all 0.25s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1) rotate(15deg)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) rotate(0deg)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)' }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          <button
            onClick={clearChat}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.18)',
              color: '#ef4444', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
          >
            🗑 Clear
          </button>
        </div>
      </header>

      {/* ── Messages ── */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 16px',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {messages.map(m => <Message key={m.id} msg={m} />)}

          {/* Suggestion chips */}
          {showSuggestions && (
            <div style={{ marginTop: 8, marginBottom: 24, animation: 'fadeInUp 0.4s ease' }}>
              <p style={{ fontSize: 11, color: 'var(--section-label)', textAlign: 'center', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Try asking
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                }}
              >
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.text}
                    onClick={() => { setInput(s.text); textareaRef.current?.focus() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', borderRadius: 12,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--muted-foreground)', fontSize: 12,
                      textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
                      e.currentTarget.style.color = 'var(--foreground)'
                      e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                      e.currentTarget.style.transform = 'scale(1.02)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--card-border)'
                      e.currentTarget.style.color = 'var(--muted-foreground)'
                      e.currentTarget.style.background = 'var(--card-bg)'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{s.emoji}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Scroll to bottom */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            style={{
              position: 'fixed', bottom: 90, right: 24,
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(99,102,241,0.85)',
              border: 'none',
              color: '#fff', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            ↓
          </button>
        )}
      </div>

      {/* ── Input ── */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px 16px',
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(99,102,241,0.1)',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            padding: '8px 8px 8px 16px',
            borderRadius: 18,
            background: 'var(--card-bg)',
            border: '1px solid var(--chat-border)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.15)',
            transition: 'border-color 0.2s',
          }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--chat-border)'}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={isLoading}
            placeholder="Ask about products, prices, support…"
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 14,
              color: 'var(--foreground)',
              lineHeight: 1.65,
              padding: '6px 0',
              maxHeight: 120,
              caretColor: 'var(--primary)',
              fontFamily: "'Instrument Sans', sans-serif",
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              width: 40, height: 40,
              borderRadius: 12,
              background:
                input.trim() && !isLoading
                  ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                  : 'var(--muted)',
              border: 'none',
              color: input.trim() && !isLoading ? '#fff' : 'var(--muted-foreground)',
              fontSize: 16,
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
              boxShadow:
                input.trim() && !isLoading
                  ? '0 4px 16px rgba(99,102,241,0.4)'
                  : 'none',
            }}
            onMouseEnter={e => {
              if (input.trim() && !isLoading) e.currentTarget.style.transform = 'scale(1.08)'
            }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {isLoading ? (
              <div
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
            ) : '↑'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted-foreground)', marginTop: 8, opacity: 0.5 }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
