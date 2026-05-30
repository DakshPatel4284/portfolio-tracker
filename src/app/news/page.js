'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY

export default function NewsPage() {

  const router = useRouter()
  const [search, setSearch] = useState('')
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [currentStock, setCurrentStock] = useState('')
  const [marketNews, setMarketNews] = useState([])
  const [marketLoading, setMarketLoading] = useState(true)

  useEffect(() => { fetchMarketNews() }, [])

  const fetchMarketNews = async () => {
    setMarketLoading(true)
    try {
      const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`)
      const data = await res.json()
      setMarketNews(Array.isArray(data) ? data.slice(0, 12) : [])
    } catch (err) {}
    setMarketLoading(false)
  }

  const fetchStockNews = async (symbol) => {
    if (!symbol.trim()) return
    setLoading(true)
    setSearched(true)
    setCurrentStock(symbol.toUpperCase())
    const today = new Date()
    const from = new Date(); from.setMonth(today.getMonth() - 1)
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol.toUpperCase()}&from=${from.toISOString().slice(0,10)}&to=${today.toISOString().slice(0,10)}&token=${FINNHUB_KEY}`
      )
      const data = await res.json()
      setNews(Array.isArray(data) ? data.slice(0, 20) : [])
    } catch (err) {}
    setLoading(false)
  }

  const formatDate = (ts) => new Date(ts * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const popularStocks = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'META', 'NFLX']

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #e8e8f0; font-family: 'Syne', sans-serif; min-height: 100vh; }

        .page-bg {
          min-height: 100vh; background: #0a0a0f;
          background-image: radial-gradient(ellipse at 10% 20%, rgba(99,102,241,0.07) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 70%, rgba(16,185,129,0.05) 0%, transparent 50%);
        }

        .navbar {
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 0 20px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(10,10,15,0.95); backdrop-filter: blur(12px);
          position: sticky; top: 0; z-index: 100;
        }
        .logo { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 800; cursor: pointer; }
        .logo-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; }
        .back-btn {
          background: rgba(255,255,255,0.06); color: #9ca3af;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 8px 14px; border-radius: 8px;
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer;
        }

        .main { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }

        .page-title { font-size: 26px; font-weight: 800; letter-spacing: -1px; }
        .page-subtitle { color: #6b7280; font-size: 13px; margin-top: 4px; }
        .page-header { margin-bottom: 24px; }

        /* SEARCH */
        .search-card {
          background: #111118; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 20px; margin-bottom: 24px;
        }
        .search-label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .search-row { display: flex; gap: 8px; }
        .search-input {
          flex: 1; background: #0a0a0f; border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px; padding: 12px 14px; color: #e8e8f0;
          font-family: 'Space Mono', monospace; font-size: 14px; font-weight: 700;
          outline: none; text-transform: uppercase; letter-spacing: 1px;
          -webkit-appearance: none;
        }
        @media (max-width: 480px) { .search-input { font-size: 16px; } }
        .search-input::placeholder { color: #374151; font-weight: 400; text-transform: none; letter-spacing: 0; }
        .search-btn {
          background: #6366f1; color: white; border: none;
          padding: 12px 18px; border-radius: 10px;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px;
          cursor: pointer; white-space: nowrap;
        }
        .search-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* POPULAR CHIPS - scrollable */
        .popular-row {
          display: flex; align-items: center; gap: 6px;
          margin-top: 12px; overflow-x: auto;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
          padding-bottom: 2px;
        }
        .popular-row::-webkit-scrollbar { display: none; }
        .popular-label { font-size: 10px; color: #4b5563; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
        .popular-chip {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 5px 12px; font-size: 11px; font-weight: 700;
          color: #6b7280; font-family: 'Space Mono', monospace; cursor: pointer;
          white-space: nowrap; flex-shrink: 0; transition: all 0.2s;
        }
        .popular-chip:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); color: #a5b4fc; }

        /* SECTION */
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .section-badge { font-size: 10px; font-weight: 700; background: rgba(99,102,241,0.15); color: #818cf8; padding: 2px 8px; border-radius: 20px; }
        .section-badge.green { background: rgba(16,185,129,0.12); color: #10b981; }

        .result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
        .stock-tag { display: inline-flex; align-items: center; gap: 6px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); border-radius: 8px; padding: 5px 12px; font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 700; color: #a5b4fc; }
        .clear-btn { background: transparent; border: none; color: #4b5563; font-family: 'Syne', sans-serif; font-size: 13px; cursor: pointer; }

        /* NEWS GRID - responsive */
        .news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 32px; }
        @media (max-width: 900px) { .news-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .news-grid { grid-template-columns: 1fr; } }

        .news-card {
          background: #111118; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; overflow: hidden; transition: all 0.2s;
          cursor: pointer; text-decoration: none; display: flex; flex-direction: column;
        }
        .news-card:hover { border-color: rgba(99,102,241,0.25); transform: translateY(-2px); }

        .news-image { width: 100%; height: 140px; object-fit: cover; background: #1a1a2e; }
        @media (max-width: 560px) { .news-image { height: 180px; } }

        .news-placeholder {
          width: 100%; height: 140px;
          background: linear-gradient(135deg, #1a1a2e, #0f0f1a);
          display: flex; align-items: center; justify-content: center; font-size: 32px;
        }
        @media (max-width: 560px) { .news-placeholder { height: 180px; } }

        .news-body { padding: 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .news-source { font-size: 10px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 1px; }
        .news-headline { font-size: 13px; font-weight: 700; color: #e8e8f0; line-height: 1.5; flex: 1; }
        .news-summary { font-size: 11px; color: #6b7280; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .news-date { font-size: 10px; color: #4b5563; font-family: 'Space Mono', monospace; margin-top: 2px; }

        /* SKELETON */
        .skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 900px) { .skeleton-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .skeleton-grid { grid-template-columns: 1fr; } }
        .skeleton-card { background: #111118; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; }
        .skeleton-img { width: 100%; height: 140px; background: linear-gradient(90deg, #1a1a2e 25%, #222235 50%, #1a1a2e 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        .skeleton-body { padding: 14px; }
        .skeleton-line { height: 10px; border-radius: 5px; background: linear-gradient(90deg, #1a1a2e 25%, #222235 50%, #1a1a2e 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; margin-bottom: 8px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .empty-state { text-align: center; padding: 48px 16px; color: #4b5563; background: #111118; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
        .empty-icon { font-size: 36px; margin-bottom: 10px; }
        .empty-text { font-size: 15px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
        .empty-sub { font-size: 12px; }
      `}</style>

      <div className="page-bg">
        <nav className="navbar">
          <div className="logo" onClick={() => router.push('/dashboard')}>
            <div className="logo-dot"></div>
            <span>TradeTrack</span>
          </div>
          <button className="back-btn" onClick={() => router.push('/dashboard')}>← Back</button>
        </nav>

        <div className="main">
          <div className="page-header">
            <h1 className="page-title">📰 Market News</h1>
            <p className="page-subtitle">Search live news for any US stock symbol</p>
          </div>

          {/* SEARCH */}
          <div className="search-card">
            <div className="search-label">Search by Stock Symbol</div>
            <div className="search-row">
              <input
                type="text" className="search-input"
                placeholder="e.g. AAPL, TSLA..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchStockNews(search)}
              />
              <button className="search-btn" onClick={() => fetchStockNews(search)} disabled={loading || !search.trim()}>
                {loading ? '...' : '🔍'}
              </button>
            </div>
            <div className="popular-row">
              <span className="popular-label">Quick:</span>
              {popularStocks.map(s => (
                <button key={s} className="popular-chip" onClick={() => { setSearch(s); fetchStockNews(s) }}>{s}</button>
              ))}
            </div>
          </div>

          {/* STOCK NEWS */}
          {searched && (
            <div style={{ marginBottom: '32px' }}>
              <div className="result-header">
                <div className="section-title">
                  News for <span className="stock-tag">📈 {currentStock}</span>
                  <span className="section-badge">{news.length} articles</span>
                </div>
                <button className="clear-btn" onClick={() => { setSearched(false); setNews([]) }}>✕ Clear</button>
              </div>
              {loading ? (
                <div className="skeleton-grid">
                  {[...Array(6)].map((_, i) => (
                    <div className="skeleton-card" key={i}>
                      <div className="skeleton-img"></div>
                      <div className="skeleton-body">
                        <div className="skeleton-line" style={{ width: '40%' }}></div>
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line" style={{ width: '70%' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : news.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-text">No news found for {currentStock}</div>
                  <div className="empty-sub">Try AAPL, TSLA, or GOOGL</div>
                </div>
              ) : (
                <div className="news-grid">
                  {news.map((item, i) => (
                    <a key={i} className="news-card" href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.image
                        ? <img src={item.image} alt={item.headline} className="news-image" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                        : null}
                      <div className="news-placeholder" style={{ display: item.image ? 'none' : 'flex' }}>📰</div>
                      <div className="news-body">
                        <div className="news-source">{item.source}</div>
                        <div className="news-headline">{item.headline}</div>
                        <div className="news-summary">{item.summary}</div>
                        <div className="news-date">{formatDate(item.datetime)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MARKET NEWS */}
          {!searched && (
            <div>
              <div className="section-title">🌍 General Market News <span className="section-badge green">Live</span></div>
              {marketLoading ? (
                <div className="skeleton-grid">
                  {[...Array(6)].map((_, i) => (
                    <div className="skeleton-card" key={i}>
                      <div className="skeleton-img"></div>
                      <div className="skeleton-body">
                        <div className="skeleton-line" style={{ width: '40%' }}></div>
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line" style={{ width: '70%' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : marketNews.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📡</div>
                  <div className="empty-text">Could not load market news</div>
                  <div className="empty-sub">Check your Finnhub API key in .env.local</div>
                </div>
              ) : (
                <div className="news-grid">
                  {marketNews.map((item, i) => (
                    <a key={i} className="news-card" href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.image
                        ? <img src={item.image} alt={item.headline} className="news-image" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                        : null}
                      <div className="news-placeholder" style={{ display: item.image ? 'none' : 'flex' }}>📰</div>
                      <div className="news-body">
                        <div className="news-source">{item.source}</div>
                        <div className="news-headline">{item.headline}</div>
                        <div className="news-summary">{item.summary}</div>
                        <div className="news-date">{formatDate(item.datetime)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}