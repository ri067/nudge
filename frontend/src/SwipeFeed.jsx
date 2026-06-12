import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ── Palette tokens ────────────────────────────────────────────────────────────
const C = {
  bgDeep:   '#131921',   // amazon dark navy
  bgCard:   '#1F2D3D',   // card surface
  bgPanel:  '#232F3E',   // amazon secondary nav color
  green:    '#FF9900',   // amazon orange (primary accent)
  coral:    '#FF4444',   // skip/remove red
  violet:   '#00A8CC',   // amazon teal (info/trust)
  white:    '#FFFFFF',
  muted:    'rgba(255,255,255,0.55)',
  glassBg:  'rgba(255,255,255,0.06)',
  glassBdr: 'rgba(255,153,0,0.25)',   // orange-tinted border
};

// ── Confetti shapes (match / add-to-cart celebration) ─────────────────────────
const ConfettiShape = ({ style, shape, color }) => {
  const base = {
    position: 'absolute',
    opacity: 0.85,
    pointerEvents: 'none',
    ...style,
  };
  if (shape === 'circle')
    return <div style={{ ...base, width: 36, height: 36, borderRadius: '50%', background: color }} />;
  if (shape === 'triangle')
    return (
      <div style={{ ...base, width: 0, height: 0,
        borderLeft: '18px solid transparent', borderRight: '18px solid transparent',
        borderBottom: `32px solid ${color}` }} />
    );
  if (shape === 'blob')
    return <div style={{ ...base, width: 48, height: 40, borderRadius: '60% 40% 70% 30% / 50% 60% 40% 50%', background: color }} />;
  // square
  return <div style={{ ...base, width: 28, height: 28, borderRadius: 6, background: color }} />;
};

const Confetti = () => (
  <>
    <ConfettiShape shape="blob"     color={C.violet}  style={{ top: 60,  left: -14 }} />
    <ConfettiShape shape="circle"   color={C.green}   style={{ top: 100, left: 40 }} />
    <ConfettiShape shape="triangle" color={C.coral}   style={{ top: 30,  right: 10 }} />
    <ConfettiShape shape="blob"     color="#FEBD69"   style={{ top: 55,  right: -8 }} />
    <ConfettiShape shape="square"   color={C.coral}   style={{ bottom: 80, left: 20 }} />
    <ConfettiShape shape="circle"   color={C.green}   style={{ bottom: 60, left: 80 }} />
    <ConfettiShape shape="triangle" color="#FEBD69"   style={{ bottom: 90, right: 30 }} />
    <ConfettiShape shape="blob"     color={C.violet}  style={{ bottom: 50, right: -10 }} />
    <ConfettiShape shape="square"   color={C.green}   style={{ bottom: 20, left: 120 }} />
  </>
);

// ── Sparkle logo icon ─────────────────────────────────────────────────────────
const Sparkle = ({ size = 18, color = C.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z"
      fill={color} />
  </svg>
);

// ── SwipeFeed main component ──────────────────────────────────────────────────
const SwipeFeed = () => {
  const [currentView, setCurrentView] = useState('feed');
  const [products, setProducts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [cartItems, setCartItems]     = useState([]);
  const [inputValue, setInputValue]   = useState('');
  const [activeQuery, setActiveQuery] = useState('Going on a summer trek next week');
  const [dragStart, setDragStart]     = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset]   = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging]   = useState(false);
  const [lastAdded, setLastAdded]     = useState(null); // for match-screen flash

  useEffect(() => {
    const fetchCards = async () => {
      if (!activeQuery) return;
      setLoading(true);
      try {
        const response = await axios.post(`/api/search`, { query: activeQuery, top_k: 5 });
        setProducts(response.data.results);
      } catch (error) {
        console.error('Error fetching from API:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, [activeQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setActiveQuery(inputValue);
      setInputValue('');
      setCurrentView('feed');
    }
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    setDragOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handlePointerUp = (e, product) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (dragOffset.x > 120)       handleSwipeAction('right', product);
    else if (dragOffset.x < -120) handleSwipeAction('left', product);
    else                          setDragOffset({ x: 0, y: 0 });
  };

  const handleSwipeAction = (direction, product) => {
    if (direction === 'right') {
      setCartItems((prev) => [...prev, product]);
      setLastAdded(product);
      setTimeout(() => setLastAdded(null), 1800);
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setDragOffset({ x: 0, y: 0 });
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  // ── Shared shell styles ─────────────────────────────────────────────────────
  const shell = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: C.bgDeep,
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    overflow: 'hidden',
    color: C.white,
  };

  // ══════════════════════════════════════════════════════════════════════
  // VIEW: CART
  // ══════════════════════════════════════════════════════════════════════
  if (currentView === 'cart') {
    return (
      <div style={{ ...shell, overflowY: 'auto', padding: '0 20px 32px' }}>
        {/* radial glow bg */}
        <div style={{
          position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,153,0,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 48, marginBottom: 28 }}>
          <button
            onClick={() => setCurrentView('feed')}
            style={{ background: C.glassBg, border: `1px solid ${C.glassBdr}`, borderRadius: 50, padding: '8px 16px', color: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkle size={16} />
            <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.5px' }}>YOUR CART</span>
          </div>
          <div style={{ width: 72 }} />
        </div>

        {/* Empty state */}
        {cartItems.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, opacity: 0.6 }}>
            <span style={{ fontSize: 56 }}>🛒</span>
            <p style={{ fontWeight: 700, fontSize: 16 }}>Cart is empty</p>
            <p style={{ fontSize: 13, color: C.muted }}>Swipe right to add items!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cartItems.map((item, i) => (
              <div key={i} style={{
                background: C.bgCard,
                borderRadius: 20,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                border: `1px solid ${C.glassBdr}`,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'linear-gradient(135deg, #1F2D3D, #00A8CC)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, flexShrink: 0,
                }}>📦</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: 1.5, marginBottom: 2, textTransform: 'uppercase' }}>{item.brand}</p>
                  <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h3>
                </div>
                <p style={{ fontWeight: 900, fontSize: 18, color: C.green, flexShrink: 0 }}>₹{item.price}</p>
              </div>
            ))}
          </div>
        )}

        {/* Checkout */}
        {cartItems.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
              <p style={{ color: C.muted, fontWeight: 600, fontSize: 14 }}>Total</p>
              <p style={{ fontWeight: 900, fontSize: 34, color: C.green, letterSpacing: '-1px' }}>₹{cartTotal}</p>
            </div>
            <button
              onClick={() => alert('Hackathon Demo: Checkout complete!')}
              style={{
                width: '100%',
                background: `linear-gradient(135deg, ${C.green}, #FEBD69)`,
                color: '#111',
                fontWeight: 900,
                fontSize: 15,
                letterSpacing: 2,
                textTransform: 'uppercase',
                border: 'none',
                borderRadius: 20,
                padding: '18px 0',
                cursor: 'pointer',
                boxShadow: `0 8px 32px rgba(255,153,0,0.4)`,
              }}
            >
              Secure Checkout
            </button>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // MATCH FLASH OVERLAY (shown briefly after swipe right)
  // ══════════════════════════════════════════════════════════════════════
  if (lastAdded) {
    return (
      <div style={{ ...shell, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Confetti />

        {/* Big circle headline */}
        <div style={{
          width: 160, height: 160, borderRadius: '50%',
          background: C.green,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 28,
          boxShadow: `0 0 60px rgba(255,153,0,0.5)`,
        }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: '#1a0a00', textAlign: 'center', lineHeight: 1.15 }}>
            Added!
          </span>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 900, color: C.white, textAlign: 'center', letterSpacing: '-1px', marginBottom: 8 }}>
          It's in your <span style={{ color: C.green }}>cart!</span>
        </h1>

        {/* Two overlapping product/bag icons */}
        <div style={{ display: 'flex', marginBottom: 20, position: 'relative', height: 90 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #1F2D3D, #00A8CC)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
            border: '3px solid white', position: 'absolute', left: 0, zIndex: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>🛒</div>
          <div style={{
            width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #232F3E, #FF9900)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
            border: '3px solid white', position: 'absolute', left: 50, zIndex: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>📦</div>
        </div>

        <p style={{ color: C.muted, fontSize: 15, marginBottom: 28, textAlign: 'center' }}>
          <strong style={{ color: C.white }}>{lastAdded.name}</strong> has been added.
        </p>

        {/* Say hi / message bar style input */}
        <div style={{
          background: C.glassBg,
          border: `1px solid ${C.glassBdr}`,
          borderRadius: 50,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          gap: 10,
        }}>
          <span style={{ flex: 1, color: C.muted, fontSize: 14 }}>Keep swiping for more!</span>
          <Sparkle size={20} color={C.green} />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIEW: SWIPE FEED
  // ══════════════════════════════════════════════════════════════════════
  const activeProduct = products[0];
  const swipeRatio    = Math.min(Math.abs(dragOffset.x) / 120, 1);
  const isRight       = dragOffset.x > 40;
  const isLeft        = dragOffset.x < -40;

  const cardStyle = isDragging
    ? {
        transform: `translate(${dragOffset.x}px, ${dragOffset.y * 0.15}px) rotate(${dragOffset.x * 0.04}deg)`,
        transition: 'none',
        cursor: 'grabbing',
      }
    : {
        transform: 'translate(0px, 0px) rotate(0deg)',
        transition: 'transform 0.3s cubic-bezier(.34,1.56,.64,1)',
        cursor: 'grab',
      };

  return (
    <div style={{ ...shell, display: 'flex', flexDirection: 'column', padding: '0 16px 16px', userSelect: 'none', touchAction: 'none' }}>

      {/* Background radial glow */}
      <div style={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,153,0,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, marginBottom: 16, position: 'relative', zIndex: 10 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkle size={22} />
          <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px' }}>NUDGE</span>
        </div>

        {/* Cart badge */}
        <div
          onClick={() => setCurrentView('cart')}
          style={{
            background: C.glassBg,
            border: `1px solid ${C.glassBdr}`,
            borderRadius: 50,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <span style={{ fontSize: 18 }}>🛒</span>
          <span style={{ fontWeight: 900, fontSize: 16 }}>{cartItems.length}</span>
          {cartItems.length > 0 && (
            <div style={{
              position: 'absolute', top: 4, right: 4,
              width: 10, height: 10, borderRadius: '50%',
              background: C.coral,
              border: `2px solid ${C.bgDeep}`,
            }} />
          )}
        </div>
      </div>

      {/* Search bar */}
      <form
        onSubmit={handleSearchSubmit}
        style={{ display: 'flex', gap: 8, marginBottom: 20, position: 'relative', zIndex: 10 }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What's on your mind?"
          style={{
            flex: 1,
            background: C.glassBg,
            border: `1px solid ${C.glassBdr}`,
            borderRadius: 50,
            padding: '12px 20px',
            fontSize: 14,
            color: C.white,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            background: C.green,
            color: '#1a0a00',
            border: 'none',
            borderRadius: 50,
            padding: '12px 22px',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Go
        </button>
      </form>

      {/* Card area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: 0.7 }}>
            <span style={{ fontSize: 40, animation: 'pulse 1.4s ease-in-out infinite' }}>🧠</span>
            <p style={{ fontWeight: 700, fontSize: 14, color: C.muted }}>Analyzing request…</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <span style={{ fontSize: 52 }}>🎉</span>
            <h3 style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>All caught up!</h3>
            <p style={{ color: C.muted, fontSize: 14 }}>Type a new thought above to get fresh picks.</p>
          </div>
        ) : (
          <>
            {/* Stack shadow card */}
            {products.length > 1 && (
              <div style={{
                position: 'absolute',
                width: 300,
                height: 420,
                background: C.bgCard,
                borderRadius: 32,
                transform: 'scale(0.94) translateY(20px)',
                opacity: 0.5,
                border: `1px solid ${C.glassBdr}`,
              }} />
            )}

            {/* Active card */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, activeProduct)}
              style={{
                position: 'absolute',
                width: 300,
                height: 420,
                borderRadius: 32,
                background: C.bgCard,
                border: `1px solid ${C.glassBdr}`,
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 10,
                ...cardStyle,
              }}
            >
              {/* Image area */}
              <div style={{
                flex: '0 0 55%',
                background: 'linear-gradient(135deg, #1F2D3D 0%, #00A8CC 50%, #131921 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Glow halo behind emoji */}
                <div style={{
                  position: 'absolute',
                  width: 140, height: 140, borderRadius: '50%',
                  background: `radial-gradient(circle, rgba(255,153,0,0.3) 0%, transparent 70%)`,
                }} />
                <span style={{ fontSize: 80, position: 'relative', zIndex: 2, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))' }}>📦</span>

                {/* Match % badge (top right) */}
                {activeProduct.match_score != null && (
                  <div style={{
                    position: 'absolute', top: 14, right: 14,
                    background: C.green,
                    color: '#1a0a00',
                    borderRadius: 50,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    🤍 {Math.round(activeProduct.match_score * 100)}%
                  </div>
                )}

                {/* Swipe labels */}
                {isRight && (
                  <div style={{
                    position: 'absolute', top: 20, left: 16,
                    background: C.green, color: '#1a0a00',
                    padding: '6px 14px', borderRadius: 10,
                    fontSize: 13, fontWeight: 900,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                    transform: 'rotate(-12deg)',
                    opacity: swipeRatio,
                    boxShadow: `0 4px 20px rgba(255,153,0,0.5)`,
                  }}>ADD ✓</div>
                )}
                {isLeft && (
                  <div style={{
                    position: 'absolute', top: 20, right: 16,
                    background: C.coral, color: C.white,
                    padding: '6px 14px', borderRadius: 10,
                    fontSize: 13, fontWeight: 900,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                    transform: 'rotate(12deg)',
                    opacity: swipeRatio,
                    boxShadow: `0 4px 20px rgba(255,77,106,0.5)`,
                  }}>SKIP ✕</div>
                )}
              </div>

              {/* Info area */}
              <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 4 }}>
                    {activeProduct.badge || '🎯 CONTEXT MATCH'}
                  </div>
                  <h2 style={{ fontWeight: 800, fontSize: 18, margin: '0 0 4px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeProduct.name}
                  </h2>
                  <p style={{ fontWeight: 900, fontSize: 24, color: C.green, margin: 0, letterSpacing: '-0.5px' }}>
                    ₹{activeProduct.price}
                  </p>
                </div>

                <div style={{
                  background: 'rgba(0,168,204,0.15)',
                  border: `1px solid rgba(0,168,204,0.35)`,
                  borderRadius: 14,
                  padding: '10px 14px',
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>
                    "{activeProduct.why_reason || 'Highly relevant for your query.'}"
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action buttons (Dateasy-style: X, pause/add, heart) */}
      {!loading && products.length > 0 && activeProduct && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, paddingBottom: 8, paddingTop: 16, position: 'relative', zIndex: 10 }}>
          <button
            onClick={() => handleSwipeAction('left', activeProduct)}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: C.bgPanel,
              border: `1px solid ${C.glassBdr}`,
              color: C.white,
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >✕</button>

          <button
            onClick={() => handleSwipeAction('right', activeProduct)}
            style={{
              width: 68, height: 68, borderRadius: '50%',
              background: C.green,
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 6px 28px rgba(255,153,0,0.5)`,
            }}
          >🛒</button>

          <button
            onClick={() => handleSwipeAction('right', activeProduct)}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: C.coral,
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px rgba(255,77,106,0.4)`,
            }}
          >❤️</button>
        </div>
      )}

      {/* Bottom nav pill */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.08)',
        border: `1px solid ${C.glassBdr}`,
        borderRadius: 50,
        padding: '10px 16px',
        marginTop: 10,
        position: 'relative',
        zIndex: 10,
      }}>
        {[
          { icon: <Sparkle size={20} color={C.green} />, active: true },
          { icon: <span style={{ fontSize: 18, opacity: 0.5 }}>⟳</span> },
          { icon: <span style={{ fontSize: 18, opacity: 0.5 }}>💬</span> },
          { icon: <span style={{ fontSize: 18, opacity: 0.5 }}>♡</span> },
        ].map((item, i) => (
          <button key={i} style={{
            background: item.active ? C.bgPanel : 'transparent',
            border: 'none',
            borderRadius: 50,
            width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SwipeFeed;