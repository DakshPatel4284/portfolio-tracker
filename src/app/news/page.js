'use client'

import { useState } from 'react'
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
  const [marketLoaded, setMarketLoaded] = useState(false)

  // Fetch general market news on page load
  const fetchMarketNews = async () => {
    if (marketLoaded) return
    setLoading(true)
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`
      )
      const data = await res.json()
      setMarketNews(data.slice(0, 12))
      setMarketLoaded(true)
    } catch (err) {
      alert('Failed to load market news')
    }
    setLoading(false)
  }

  // Fetch news for specific stock
  const fetchStockNews = async (symbol) => {
    if (!symbol.trim()) return
    setLoading(true)
    setSearched(true)
    setCurrentStock(symbol.toUpperCase())

    const today = new Date()
    const from = new Date()
    from.setMonth(today.getMonth() - 1)

    const toStr = today.toISOString().slice(0, 10)
    const fromStr = from.toISOString().slice(0, 10)

    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol.toUpperCase()}&from=${fromStr}&to=${toStr}&token=${FINNHUB_KEY}`
      )
      const data = await res.json()
      setNews(data.slice(0, 20))
    } catch (err) {
      alert('Failed to fetch news')
    }
    setLoading(false)
  }

  const handleSearch = () => {
    fetchStockNews(search)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  // Popular stocks quick search
  const popularStocks = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'META', 'NFLX']

  // Load market news on first render
  useState(() => {
    fetchMarketNews()
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0a0a0f;
          color: #e8e8f0;
          font-family: 'Syne', sans-serif;
          min-height: 100vh;
        }

        .page-bg {
          min-height: 100vh;
          background: #0a0a0f;
          background-image:
            radial-gradient(ellipse at 10% 20%, rgba(99,102,241,0.07) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 70%, rgba(16,185,129,0.05) 0%, transparent 50%);
        }

        /* NAVBAR */
        .navbar {
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 0 32px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(10,10,15,0.9);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.5px;
          cursor: pointer;
        }

        .logo-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .back-btn {
          background: rgba(255,255,255,0.06);
          color: #9ca3af;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 8px 18px;
          border-radius: 8px;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #e8e8f0;
        }

        /* MAIN */
        .main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 24px;
        }

        /* PAGE HEADER */
        .page-header {
          margin-bottom: 36px;
        }

        .page-title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -1px;
          color: #f0f0f8;
        }

        .page-subtitle {
          color: #6b7280;
          font-size: 14px;
          margin-top: 6px;
        }

        /* SEARCH BOX */
        .search-card {
          background: #111118;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 28px;
        }

        .search-label {
          font-size: 12px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }

        .search-row {
          display: flex;
          gap: 10px;
        }

        .search-input {
          flex: 1;
          background: #0a0a0f;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          padding: 13px 18px;
          color: #e8e8f0;
          font-family: 'Space Mono', monospace;
          font-size: 16px;
          font-weight: 700;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .search-input:focus {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
        }

        .search-input::placeholder {
          color: #374151;
          font-weight: 400;
          letter-spacing: 0;
          text-transform: none;
        }

        .search-btn {
          background: #6366f1;
          color: white;
          border: none;
          padding: 13px 28px;
          border-radius: 10px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .search-btn:hover {
          background: #5254cc;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(99,102,241,0.3);
        }

        .search-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        /* POPULAR STOCKS */
        .popular-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        .popular-label {
          font-size: 11px;
          color: #4b5563;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .popular-chip {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #6b7280;
          font-family: 'Space Mono', monospace;
          cursor: pointer;
          transition: all 0.2s;
        }

        .popular-chip:hover {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.3);
          color: #a5b4fc;
        }

        /* SECTION TITLE */
        .section-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-badge {
          font-size: 11px;
          font-weight: 700;
          background: rgba(99,102,241,0.15);
          color: #818cf8;
          padding: 3px 10px;
          border-radius: 20px;
          letter-spacing: 0.5px;
        }

        .section-badge.green {
          background: rgba(16,185,129,0.12);
          color: #10b981;
        }

        /* NEWS GRID */
        .news-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 40px;
        }

        @media (max-width: 900px) {
          .news-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 580px) {
          .news-grid { grid-template-columns: 1fr; }
        }

        /* NEWS CARD */
        .news-card {
          background: #111118;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          overflow: hidden;
          transition: all 0.2s;
          cursor: pointer;
          text-decoration: none;
          display: flex;
          flex-direction: column;
        }

        .news-card:hover {
          border-color: rgba(99,102,241,0.25);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        }

        .news-image {
          width: 100%;
          height: 160px;
          object-fit: cover;
          background: #1a1a2e;
        }

        .news-image-placeholder {
          width: 100%;
          height: 160px;
          background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
        }

        .news-body {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .news-source {
          font-size: 10px;
          font-weight: 700;
          color: #6366f1;
          text-transform: uppercase;
          letter-spacing: 1.2px;
        }

        .news-headline {
          font-size: 14px;
          font-weight: 700;
          color: #e8e8f0;
          line-height: 1.5;
          flex: 1;
        }

        .news-summary {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .news-date {
          font-size: 11px;
          color: #4b5563;
          font-family: 'Space Mono', monospace;
          margin-top: 4px;
        }

        /* EMPTY STATE */
        .empty-state {
          text-align: center;
          padding: 60px 24px;
          color: #4b5563;
          background: #111118;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
        }

        .empty-icon { font-size: 40px; margin-bottom: 12px; }
        .empty-text { font-size: 16px; font-weight: 600; color: #6b7280; margin-bottom: 6px; }
        .empty-sub { font-size: 13px; }

        /* LOADING SKELETON */
        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 40px;
        }

        @media (max-width: 900px) {
          .skeleton-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .skeleton-card {
          background: #111118;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          overflow: hidden;
        }

        .skeleton-img {
          width: 100%;
          height: 160px;
          background: linear-gradient(90deg, #1a1a2e 25%, #222235 50%, #1a1a2e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        .skeleton-body { padding: 16px; }

        .skeleton-line {
          height: 10px;
          border-radius: 5px;
          background: linear-gradient(90deg, #1a1a2e 25%, #222235 50%, #1a1a2e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          margin-bottom: 10px;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* STOCK RESULT HEADER */
        .result-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .stock-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 8px;
          padding: 6px 14px;
          font-family: 'Space Mono', monospace;
          font-size: 14px;
          font-weight: 700;
          color: #a5b4fc;
        }

        .clear-btn {
          background: transparent;
          border: none;
          color: #4b5563;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          cursor: pointer;
          transition: color 0.2s;
        }

        .clear-btn:hover { color: #9ca3af; }
      `}</style>

      <div className="page-bg">

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="logo" onClick={() => router.push('/dashboard')}>
            <div className="logo-dot"></div>
            <span>TradeTrack</span>
          </div>
          <div className="nav-right">
            <button className="back-btn" onClick={() => router.push('/dashboard')}>
              ← Dashboard
            </button>
          </div>
        </nav>

        {/* MAIN */}
        <div className="main">

          {/* HEADER */}
          <div className="page-header">
            <h1 className="page-title">📰 Market News</h1>
            <p className="page-subtitle">Search live news for any US stock symbol</p>
          </div>

          {/* SEARCH */}
          <div className="search-card">
            <div className="search-label">Search by Stock Symbol</div>
            <div className="search-row">
              <input
                type="text"
                className="search-input"
                placeholder="e.g. AAPL, TSLA, GOOGL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="search-btn"
                onClick={handleSearch}
                disabled={loading || !search.trim()}
              >
                {loading ? 'Searching...' : '🔍 Search'}
              </button>
            </div>

            {/* POPULAR STOCKS */}
            <div className="popular-row">
              <span className="popular-label">Quick:</span>
              {popularStocks.map(stock => (
                <button
                  key={stock}
                  className="popular-chip"
                  onClick={() => {
                    setSearch(stock)
                    fetchStockNews(stock)
                  }}
                >
                  {stock}
                </button>
              ))}
            </div>
          </div>

          {/* STOCK SPECIFIC NEWS */}
          {searched && (
            <div style={{ marginBottom: '40px' }}>
              <div className="result-header">
                <div className="section-title">
                  News for
                  <span className="stock-tag">📈 {currentStock}</span>
                  <span className="section-badge">{news.length} articles</span>
                </div>
                <button className="clear-btn" onClick={() => { setSearched(false); setNews([]) }}>
                  ✕ Clear
                </button>
              </div>

              {loading ? (
                <div className="skeleton-grid">
                  {[...Array(6)].map((_, i) => (
                    <div className="skeleton-card" key={i}>
                      <div className="skeleton-img"></div>
                      <div className="skeleton-body">
                        <div className="skeleton-line" style={{ width: '40%' }}></div>
                        <div className="skeleton-line" style={{ width: '100%' }}></div>
                        <div className="skeleton-line" style={{ width: '80%' }}></div>
                        <div className="skeleton-line" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : news.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-text">No news found for {currentStock}</div>
                  <div className="empty-sub">Try a different stock symbol like AAPL or TSLA</div>
                </div>
              ) : (
                <div className="news-grid">
                  {news.map((item, i) => (
                    <a
                      key={i}
                      className="news-card"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.headline}
                          className="news-image"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="news-image-placeholder"
                        style={{ display: item.image ? 'none' : 'flex' }}
                      >
                        📰
                      </div>
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

          {/* GENERAL MARKET NEWS */}
          {!searched && (
            <div>
              <div className="section-title">
                🌍 General Market News
                <span className="section-badge green">Live</span>
              </div>

              {loading ? (
                <div className="skeleton-grid">
                  {[...Array(6)].map((_, i) => (
                    <div className="skeleton-card" key={i}>
                      <div className="skeleton-img"></div>
                      <div className="skeleton-body">
                        <div className="skeleton-line" style={{ width: '40%' }}></div>
                        <div className="skeleton-line" style={{ width: '100%' }}></div>
                        <div className="skeleton-line" style={{ width: '80%' }}></div>
                        <div className="skeleton-line" style={{ width: '60%' }}></div>
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
                    <a
                      key={i}
                      className="news-card"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.headline}
                          className="news-image"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="news-image-placeholder"
                        style={{ display: item.image ? 'none' : 'flex' }}
                      >
                        📰
                      </div>
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