import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SwipeFeed = () => {
  const [currentView, setCurrentView] = useState('feed');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const [aiContext, setAiContext] = useState(null);
  const [showAiChip, setShowAiChip] = useState(false);

  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // X-Ray State
  const [showBreakdown, setShowBreakdown] = useState(false);
  const pressTimer = React.useRef(null);

  const [leftSwipeMemory, setLeftSwipeMemory] = useState({});
  const [bannedTerms, setBannedTerms] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const visibleProducts = products.filter(p => {
    if (p.type === 'bundle') {
      return !p.items?.some(subItem =>
        subItem.category && bannedTerms.includes(subItem.category.toLowerCase())
      );
    }
    const pCat = p.category ? p.category.toLowerCase() : '';
    return !bannedTerms.includes(pCat);
  });

  useEffect(() => {
    let timer;
    if (showAiChip) {
      timer = setTimeout(() => {
        setShowAiChip(false);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [showAiChip]);

  useEffect(() => {
    const fetchRefill = async () => {
      if (visibleProducts.length < 2 && !loading) {
        setLoading(true);
        try {
          const response = await axios.post(`/api/search`, {
            query: "feed",
            top_k: 5
          });
          setProducts((prev) => [...prev, ...response.data.results]);

          if (!aiContext || aiContext.is_feed) {
             setAiContext(response.data.ai_context);
          }
        } catch (error) {
          console.error("Error fetching feed:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchRefill();
  }, [visibleProducts.length, products.length]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setLoading(true);
      setCurrentView('feed');
      setShowAiChip(false);

      try {
        const response = await axios.post(`/api/search`, {
          query: inputValue,
          top_k: 5
        });

        setProducts((prev) => [...response.data.results, ...prev]);
        setAiContext(response.data.ai_context);
        setShowAiChip(true);

      } catch (error) {
        console.error("Error with specific search:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePointerDown = (e, product) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);

    // If it's a bundle, start the "Hold to Reveal" timer (400ms)
    pressTimer.current = setTimeout(() => {
      setShowBreakdown(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 400);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setDragOffset({ x: newX, y: newY });

    // If they start swiping, cancel the long-press timer!
    if (Math.abs(newX) > 10 || Math.abs(newY) > 10) {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    }
  };

  const handlePointerUp = (e, product) => {
    // Always clear the timer when they let go
    if (pressTimer.current) clearTimeout(pressTimer.current);

    // If they were viewing the breakdown, close it and cancel the swipe
    if (showBreakdown) {
      setShowBreakdown(false);
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (dragOffset.x > 120) handleSwipeAction('right', product);
    else if (dragOffset.x < -120) handleSwipeAction('left', product);
    else setDragOffset({ x: 0, y: 0 });
  };

  const handleSwipeAction = (direction, product) => {
    if (direction === 'right') {setCartItems((prev) => [...prev, product]);}
    else if (direction === 'left') {
      // --- FAKE AI PREFERENCE LEARNING ---
      const category = product.category
        ? product.category.toLowerCase()
        : (product.type === 'bundle' ? 'kit' : 'item');

      // 2. Ignore generic fallbacks so we don't accidentally ban everything
      if (category !== 'item' && category !== 'kit') {
        setLeftSwipeMemory(prev => {
          const count = (prev[category] || 0) + 1;
          if (count === 2 && !bannedTerms.includes(category)) {
            setBannedTerms(banned => [...banned, category]);
            setToastMessage(`Got it. Showing fewer "${category}" suggestions.`);
            setTimeout(() => setToastMessage(null), 4000);
          }
          return { ...prev, [category]: count };
        });
      }
    }
    setProducts((prev) => prev.filter((p) => p.id !== (product.id || product.tier_name)));
    setDragOffset({ x: 0, y: 0 });
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.type === 'bundle' ? item.total_price : item.price), 0);

  // ==========================================
  // VIEW: CART
  // ==========================================
  if (currentView === 'cart') {
    return (
      <div className="relative w-full h-full flex flex-col bg-[#FFF8F0] overflow-hidden">
        <div className="px-6 pt-10 pb-4 flex items-center justify-between shrink-0 border-b border-[#F0E4D8]">
          <button onClick={() => setCurrentView('feed')} className="text-[#9B9189] hover:text-[#1A1625] font-bold transition-colors flex items-center gap-1">
            <span className="text-lg">←</span> Back
          </button>
          <h1 className="text-2xl font-black tracking-tight text-[#1A1625]">Your cart</h1>
          <div className="w-12" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-5">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#C9BFB6] pb-20">
              <span className="text-6xl mb-4">🛒</span>
              <p className="font-bold text-lg text-[#9B9189]">Nothing here yet</p>
              <p className="text-sm text-[#C9BFB6] mt-1">Swipe right on things you like</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-8">
              {cartItems.map((item, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-[#F0E4D8] flex items-center gap-4 shrink-0">
                  {item.type === 'bundle' ? (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#FFE8D6] to-[#FFD8C2] flex items-center justify-center text-2xl border border-[#FFD8C2] shrink-0">🎁</div>
                  ) : (
                    <img src={`/api/images/product_${item.id}.jpg`} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-[#F5EFE7]" onError={(e) => e.target.src = 'https://via.placeholder.com/150'} />
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[#1A1625] leading-tight truncate">
                      {item.type === 'bundle' ? item.tier_name : item.name}
                    </h3>
                    {item.type === 'bundle' && (
                      <p className="text-xs text-[#FF6B4A] font-bold mt-0.5 uppercase tracking-wide">{item.items?.length} items bundled</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-lg text-[#1A1625]">₹{item.type === 'bundle' ? item.total_price : item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="bg-white px-6 py-6 border-t border-[#F0E4D8] shrink-0 shadow-[0_-10px_40px_rgba(26,22,37,0.05)] z-20 pb-safe">
            <div className="flex justify-between items-end mb-4">
              <p className="text-[#9B9189] font-bold">Total</p>
              <p className="text-3xl font-black text-[#1A1625] tracking-tight">₹{cartTotal}</p>
            </div>
            <button
              onClick={() => {
                alert(`Redirecting to Secure Payment Gateway to pay ₹${cartTotal}... \n\n(Demo Checkout Success!)`);
                setCartItems([]);
                setCurrentView('feed');
              }}
              className="w-full bg-[#1A1625] text-white font-black py-4 rounded-2xl shadow-lg uppercase tracking-wide active:scale-[0.98] transition-transform"
            >
              Checkout securely
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: SWIPE FEED
  // ==========================================
  const activeProduct = visibleProducts[0];
  const nextProduct = visibleProducts[1];

  const cardStyle = isDragging
    ? { transform: `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.2}px, 0) rotate(${dragOffset.x * 0.05}deg)`, transition: 'none', willChange: 'transform' }
    : { transform: 'translate3d(0px, 0px, 0) rotate(0deg)', transition: 'transform 0.3s ease-out', willChange: 'transform' };

  return (
    <div className="relative w-full h-full p-4 flex flex-col pt-8 bg-[#FFF8F0] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-4 mt-2 shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#1A1625] leading-none">Nudge</h1>
          <p className="text-xs font-bold text-[#C9BFB6] tracking-widest uppercase mt-1">Swipe to shop</p>
        </div>
        <div onClick={() => setCurrentView('cart')} className="bg-white p-3 rounded-2xl shadow-sm border border-[#F0E4D8] cursor-pointer flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 relative">
          <span className="text-lg">🛒</span>
          {cartItems.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#FF6B4A] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#FFF8F0]">
              {cartItems.length}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-2 px-2 z-20 shrink-0">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What's on your mind?"
          className="flex-1 rounded-full px-5 py-3 bg-white shadow-sm border border-[#F0E4D8] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/40 focus:border-[#FF6B4A] placeholder:text-[#C9BFB6] text-[#1A1625] font-medium transition-all"
        />
        <button type="submit" className="bg-[#1A1625] text-white rounded-full px-6 py-3 font-black shadow-md active:scale-95 transition-transform">
          Go
        </button>
      </form>

      {/* --- REAL-TIME ADAPTATION TOAST --- */}
      <div className={`absolute top-28 left-0 right-0 mx-auto w-max z-50 transition-all duration-500 transform ${toastMessage ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="bg-[#1A1625] text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
          <span className="text-xl">🤫</span>
          <p className="text-sm font-bold tracking-wide">{toastMessage}</p>
        </div>
      </div>
      {/* ---------------------------------- */}

      {/* AI Intelligence Chip */}
      <div className={`w-full max-w-sm mx-auto absolute top-40 left-0 right-0 z-20 px-6 transition-all duration-700 ease-in-out ${showAiChip && aiContext && !aiContext.is_feed && !loading ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="bg-white border border-[#FFD8C2] rounded-2xl p-3 shadow-md shadow-[#FF6B4A]/5">
          <div className="flex items-start gap-3">
            <div className="bg-gradient-to-br from-[#FFE8D6] to-[#FFD8C2] p-2 rounded-full shadow-sm text-lg shrink-0">✨</div>
            <div className="flex-1 pt-0.5 min-w-0">
              <p className="text-xs font-black text-[#FF6B4A] uppercase tracking-wider mb-0.5">AI understood</p>

              <p className="text-sm text-[#1A1625]/80 leading-snug">
                Finding items for <span className="font-bold text-[#1A1625]">"{aiContext?.query}"</span>
                {aiContext && aiContext.budget !== 99999 && (
                  <span className="bg-[#E0F7F1] text-[#0F9D85] px-1.5 py-0.5 rounded ml-1 font-semibold text-xs whitespace-nowrap">
                    ≤ ₹{aiContext.budget}
                  </span>
                )}
                {aiContext && aiContext.delivery !== 30 && (
                  <span className="bg-[#FFF1DC] text-[#B8730A] px-1.5 py-0.5 rounded ml-1 font-semibold text-xs whitespace-nowrap">
                    Fast (≤ {aiContext.delivery} days)
                  </span>
                )}
              </p>

              {/* --- NEW: DETERMINISTIC FILTER COUNT --- */}
              {aiContext && aiContext.dropped_count > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#9B9189] bg-[#FFF8F0] w-fit px-2 py-1 rounded-md border border-[#F0E4D8]">
                  <span className="text-[#FF6B4A] text-[10px]">⛔</span>
                  Removed {aiContext.dropped_count} items outside your limits
                </div>
              )}
              {/* --------------------------------------- */}

            </div>
          </div>
        </div>
      </div>

      {/* Card Deck */}
      <div className="relative flex-1 w-full flex justify-center items-center mt-2">
        {loading && visibleProducts.length === 0 ? (
          <div className="font-bold text-[#C9BFB6] text-center">
            <span className="text-4xl block mb-3 animate-bounce">🧠</span>
            <span className="tracking-wide">Finding good stuff...</span>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="text-center font-bold text-[#C9BFB6] flex flex-col items-center gap-2">
            <span className="text-4xl">🎉</span>
            <span>All caught up!</span>
          </div>
        ) : (
          <>
            {/* Ambient glow behind the active card */}
            <div className="absolute w-72 h-[26rem] bg-[#FF6B4A]/10 rounded-[2.5rem] blur-2xl -z-10" />

            {/* NEXT CARD (BACKGROUND) */}
            {nextProduct && (
              <div className="absolute w-80 h-[28rem] bg-white rounded-[2rem] border border-[#F0E4D8] scale-95 translate-y-5 opacity-80 z-0 flex flex-col overflow-hidden shadow-sm">
                <div className="h-3/5 relative border-b border-[#F0E4D8] bg-[#F5EFE7] flex items-center justify-center">
                  {nextProduct.type === 'bundle' ? (
                    <div className="text-6xl opacity-40">🎁</div>
                  ) : (
                    <img src={`/api/images/product_${nextProduct.id}.jpg`} className="w-full h-full object-cover grayscale-[20%] blur-[1px] pointer-events-none opacity-90" onError={(e) => e.target.src = 'https://via.placeholder.com/300?text=No+Image'} />
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h2 className="text-xl font-bold leading-tight text-[#C9BFB6] line-clamp-1">
                    {nextProduct.type === 'bundle' ? nextProduct.tier_name : nextProduct.name}
                  </h2>
                  <p className="text-2xl font-black mt-1 text-[#E2D8CC] tracking-tight">
                    ₹{nextProduct.type === 'bundle' ? nextProduct.total_price : nextProduct.price}
                  </p>
                </div>
              </div>
            )}

            {/* ACTIVE TOP CARD (FOREGROUND) */}
            <div
              onPointerDown={(e) => handlePointerDown(e, activeProduct)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, activeProduct)}
              style={cardStyle}
              className="absolute w-80 h-[28rem] bg-white rounded-[2rem] shadow-2xl shadow-[#1A1625]/10 overflow-hidden cursor-grab active:cursor-grabbing z-10 border border-[#F0E4D8] flex flex-col touch-none"
            >

              {/* --- UNIFIED HOLD-TO-REVEAL OVERLAY (WORKS FOR BOTH) --- */}
              {showBreakdown && (
                <div className="absolute inset-0 z-50 bg-[#1A1625]/97 backdrop-blur-md p-6 flex flex-col justify-center text-white transition-opacity duration-200">
                  <h3 className="text-sm font-black text-[#FFB84D] mb-6 tracking-widest uppercase flex items-center gap-2">
                    <span>🧠</span> Signal X-ray
                  </h3>
                  <div className="space-y-5 overflow-y-auto max-h-[80%] pb-4">
                    {/* Dynamically map bundle items OR the single individual item */}
                    {(activeProduct.type === 'bundle' ? activeProduct.items : [activeProduct])?.map((subItem, idx) => {

                      // 1. Grab Groq's custom reason (from the item itself, or fallback to the bundle's reason)
                      const groqReason = `AI Reason: "${subItem.why_reason || activeProduct.why_reason}"`;

                      // 2. Combine the backend Ghost signals with the Groq reason
                      const rawContext = subItem.user_context
                        ? `${subItem.user_context} | ${groqReason}`
                        : groqReason;

                      // 3. Split them up for the UI
                      const signals = rawContext.split('|').map(s => s.trim()).filter(Boolean);
                      const isConvergence = signals.length > 1;

                      return (
                        <div key={idx} className={`pb-3 border-b ${isConvergence ? 'border-[#FFB84D]/40' : 'border-white/10'}`}>
                          <div className="flex justify-between items-start mb-1">
                            <p className={`font-bold text-lg leading-tight ${isConvergence ? 'text-[#FFB84D]' : 'text-white'}`}>
                              {subItem.name}
                            </p>
                            {isConvergence && (
                              <span className="bg-gradient-to-r from-[#FFB84D] to-[#FF6B4A] text-white text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest shadow-[0_0_10px_rgba(255,184,77,0.4)] whitespace-nowrap ml-2 mt-0.5 h-fit">
                                Dual signal match
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col gap-1.5 mt-2">
                            {signals.map((sig, i) => (
                              <p key={i} className={`text-sm italic flex items-start gap-2 ${isConvergence ? 'text-[#FFD9A0]' : 'text-white/60'}`}>
                                <span className={isConvergence ? 'text-[#FFB84D]' : 'text-[#FF8B6F]'}>↳</span>
                                {sig}
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* ------------------------------------------------------- */}

              {activeProduct.type === 'bundle' ? (
                // --- BUNDLE LAYOUT ---
                <>
                  <div className="h-3/5 relative border-b border-[#FFE8D6] bg-gradient-to-br from-[#FFF1E5] to-[#FFE8D6] flex items-center justify-center p-4">
                    <div className="grid grid-cols-2 gap-2 w-full max-w-[220px] pointer-events-none">
                      {activeProduct.items?.slice(0, 4).map((subItem, idx) => (
                        <div key={idx} className="relative w-full pt-[100%] rounded-xl overflow-hidden shadow-sm border border-white/60">
                          <img src={`/api/images/product_${subItem.id}.jpg`} className="absolute inset-0 w-full h-full object-cover" onError={(e) => e.target.src = 'https://via.placeholder.com/150'} />
                        </div>
                      ))}
                    </div>
                    {dragOffset.x > 40 && <div className="absolute top-6 left-6 bg-[#2DD4BF] text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[-12deg] uppercase shadow-lg z-10">Add bundle</div>}
                    {dragOffset.x < -40 && <div className="absolute top-6 right-6 bg-[#FF6B4A] text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[12deg] uppercase shadow-lg z-10">Skip</div>}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between pointer-events-none bg-white relative z-0">
                    <div>
                      <div className="text-[10px] font-black text-[#FF6B4A] mb-1 tracking-widest uppercase flex items-center gap-1">
                        <span>🎁</span> Curated kit
                      </div>
                      <h2 className="text-xl font-bold leading-tight text-[#1A1625] line-clamp-1">{activeProduct.tier_name}</h2>
                      <p className="text-2xl font-black mt-1 text-[#1A1625] tracking-tight">₹{activeProduct.total_price}</p>
                    </div>
                    <div className="bg-[#FFF1E5] p-3.5 rounded-2xl italic text-sm text-[#A85A2E] font-semibold border border-[#FFE8D6] leading-snug">
                      "{activeProduct.why_reason}"
                    </div>
                  </div>
                </>
              ) : (
                // --- INDIVIDUAL CARD LAYOUT ---
                <>
                  <div className="h-3/5 relative border-b border-[#F0E4D8] bg-[#F5EFE7]">
                    <img src={`/api/images/product_${activeProduct.id}.jpg`} className="w-full h-full object-cover pointer-events-none" onError={(e) => e.target.src = 'https://via.placeholder.com/300?text=No+Image'} />
                    {dragOffset.x > 40 && <div className="absolute top-6 left-6 bg-[#2DD4BF] text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[-12deg] uppercase shadow-lg">Add to cart</div>}
                    {dragOffset.x < -40 && <div className="absolute top-6 right-6 bg-[#FF6B4A] text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[12deg] uppercase shadow-lg">Skip</div>}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between pointer-events-none bg-white relative z-0">
                    <div>
                      <h2 className="text-xl font-bold leading-tight text-[#1A1625] line-clamp-1">{activeProduct.name}</h2>
                      <p className="text-2xl font-black mt-1 text-[#1A1625] tracking-tight">₹{activeProduct.price}</p>
                    </div>
                    <div className="bg-[#FFF1E5] p-3.5 rounded-2xl italic text-sm text-[#A85A2E] font-semibold border border-[#FFE8D6] leading-snug">
                      "{activeProduct.why_reason || 'Highly relevant matching item.'}"
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom action buttons — thumb-friendly alternative to drag */}
      {!loading && visibleProducts.length > 0 && (
        <div className="flex items-center justify-center gap-6 pb-4 pt-2 shrink-0 z-20">
          <button
            onClick={() => handleSwipeAction('left', activeProduct)}
            className="w-16 h-16 rounded-full bg-white border border-[#F0E4D8] shadow-md flex items-center justify-center text-2xl text-[#FF6B4A] active:scale-90 transition-transform"
            aria-label="Skip"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipeAction('right', activeProduct)}
            className="w-16 h-16 rounded-full bg-[#2DD4BF] shadow-lg shadow-[#2DD4BF]/30 flex items-center justify-center text-2xl text-white active:scale-90 transition-transform"
            aria-label="Add to cart"
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
};

export default SwipeFeed;