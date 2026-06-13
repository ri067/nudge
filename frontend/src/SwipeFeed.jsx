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
      if (products.length < 2 && !loading) {
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
  }, [products.length]); 

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
    if (dragOffset.x > 120) handleSwipeAction('right', product);
    else if (dragOffset.x < -120) handleSwipeAction('left', product);
    else setDragOffset({ x: 0, y: 0 });
  };

  const handleSwipeAction = (direction, product) => {
    if (direction === 'right') setCartItems((prev) => [...prev, product]);
    setProducts((prev) => prev.filter((p) => p.id !== (product.id || product.tier_name)));
    setDragOffset({ x: 0, y: 0 });
  };

  // CALCULATE TOTAL: Dynamically checks for total_price (bundles) vs price (individual)
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.type === 'bundle' ? item.total_price : item.price), 0);

  // ==========================================
  // VIEW: CART
  // ==========================================
  if (currentView === 'cart') {
    return (
      <div className="relative w-full h-full flex flex-col bg-gray-50 overflow-hidden">
        <div className="px-6 pt-10 pb-4 flex items-center justify-between shrink-0">
          <button onClick={() => setCurrentView('feed')} className="text-gray-500 hover:text-gray-900 font-bold">← Back</button>
          <h1 className="text-2xl font-black tracking-tighter">YOUR CART</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 pb-20">
              <span className="text-6xl mb-4 opacity-50">🛒</span>
              <p className="font-bold text-lg">Your cart is empty.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pb-8">
              {cartItems.map((item, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-4 shrink-0">
                  {item.type === 'bundle' ? (
                    <div className="w-16 h-16 rounded-xl bg-purple-50 flex items-center justify-center text-2xl border border-purple-100">🎁</div>
                  ) : (
                    <img src={`/api/images/product_${item.id}.jpg`} className="w-16 h-16 rounded-xl object-cover" onError={(e) => e.target.src = 'https://via.placeholder.com/150'} />
                  )}
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 leading-tight">
                      {item.type === 'bundle' ? item.tier_name : item.name}
                    </h3>
                    {item.type === 'bundle' && (
                      <p className="text-xs text-purple-600 font-bold mt-0.5">{item.items?.length} Items Bundled</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-gray-900">₹{item.type === 'bundle' ? item.total_price : item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="bg-white px-6 py-6 border-t border-gray-200 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20 pb-safe">
            <div className="flex justify-between items-end mb-4">
              <p className="text-gray-500 font-bold">Total</p>
              <p className="text-3xl font-black text-gray-900">₹{cartTotal}</p>
            </div>
            <button className="w-full bg-green-500 text-white font-black py-4 rounded-2xl shadow-lg uppercase active:scale-95 transition-transform">
              Secure Checkout
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: SWIPE FEED
  // ==========================================
  const activeProduct = products[0];
  const nextProduct = products[1]; 

  const cardStyle = isDragging
    ? { transform: `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.2}px, 0) rotate(${dragOffset.x * 0.05}deg)`, transition: 'none', willChange: 'transform' }
    : { transform: 'translate3d(0px, 0px, 0) rotate(0deg)', transition: 'transform 0.3s ease-out', willChange: 'transform' };

  return (
    <div className="relative w-full h-full p-4 flex flex-col pt-8 bg-gray-50 overflow-hidden">
      
      <div onClick={() => setCurrentView('cart')} className="absolute top-6 right-6 z-50 bg-white p-3 rounded-full shadow-md cursor-pointer flex items-center gap-2 transition-transform hover:scale-105 active:scale-95">
        <span>🛒</span> <span className="font-black">{cartItems.length}</span>
      </div>

      <h1 className="text-3xl font-black text-center mb-4 tracking-tighter mt-4">NUDGE</h1>
      
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4 px-2 z-20">
        <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="What's on your mind?" className="flex-1 rounded-full px-5 py-3 shadow-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-gray-900 text-white rounded-full px-5 py-3 font-bold shadow-md active:scale-95 transition-transform">Go</button>
      </form>

      {/* AI Intelligence Chip */}
      <div className={`w-full max-w-sm mx-auto absolute top-40 left-0 right-0 z-20 px-6 transition-all duration-700 ease-in-out ${showAiChip && aiContext && !aiContext.is_feed && !loading ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3 shadow-md">
          <div className="flex items-start gap-3">
            <div className="bg-white p-2 rounded-full shadow-sm text-lg">✨</div>
            <div className="flex-1 pt-0.5">
              <p className="text-xs font-black text-blue-600 uppercase tracking-wider mb-0.5">AI Understood</p>
              <p className="text-sm text-gray-700 leading-snug">
                Finding items for <span className="font-bold">"{aiContext?.query}"</span>
                {aiContext && aiContext.budget !== 99999 && (
                  <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded ml-1 font-semibold text-xs whitespace-nowrap">
                    ≤ ₹{aiContext.budget}
                  </span>
                )}
                {aiContext && aiContext.delivery !== 30 && (
                  <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded ml-1 font-semibold text-xs whitespace-nowrap">
                    Fast (≤ {aiContext.delivery} days)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Card Deck */}
      <div className="relative flex-1 w-full flex justify-center items-center mt-2">
        {loading && products.length === 0 ? (
          <div className="font-bold text-gray-400 animate-pulse text-center">
            <span className="text-3xl block mb-2">🧠</span> Analyzing...
          </div>
        ) : products.length === 0 ? (
          <div className="text-center font-bold text-gray-400">🎉 All caught up!</div>
        ) : (
          <>
            {/* NEXT CARD (BACKGROUND) */}
            {nextProduct && (
              <div className="absolute w-80 h-[28rem] bg-white rounded-3xl border border-gray-200 scale-95 translate-y-5 opacity-70 z-0 flex flex-col overflow-hidden shadow-sm">
                <div className="h-3/5 relative border-b border-gray-100 bg-gray-100 flex items-center justify-center">
                  {nextProduct.type === 'bundle' ? (
                    <div className="text-6xl opacity-50">🎁</div>
                  ) : (
                    <img src={`/api/images/product_${nextProduct.id}.jpg`} className="w-full h-full object-cover grayscale-[30%] blur-[1px] pointer-events-none" onError={(e) => e.target.src = 'https://via.placeholder.com/300?text=No+Image'} />
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h2 className="text-xl font-bold leading-tight text-gray-500 line-clamp-1">
                    {nextProduct.type === 'bundle' ? nextProduct.tier_name : nextProduct.name}
                  </h2>
                  <p className="text-2xl font-black mt-1 text-gray-400">
                    ₹{nextProduct.type === 'bundle' ? nextProduct.total_price : nextProduct.price}
                  </p>
                </div>
              </div>
            )}

            {/* ACTIVE TOP CARD (FOREGROUND) */}
            <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={(e) => handlePointerUp(e, activeProduct)} style={cardStyle} className="absolute w-80 h-[28rem] bg-white rounded-3xl shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing z-10 border border-gray-100 flex flex-col transition-shadow hover:shadow-blue-900/10 touch-none">
              
              {activeProduct.type === 'bundle' ? (
                // --- BUNDLE LAYOUT ---
                <>
                  <div className="h-3/5 relative border-b border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4">
                    <div className="grid grid-cols-2 gap-2 w-full max-w-[220px] pointer-events-none">
                      {activeProduct.items?.slice(0, 4).map((subItem, idx) => (
                        <div key={idx} className="relative w-full pt-[100%] rounded-xl overflow-hidden shadow-sm border border-white/60">
                          <img src={`/api/images/product_${subItem.id}.jpg`} className="absolute inset-0 w-full h-full object-cover" onError={(e) => e.target.src = 'https://via.placeholder.com/150'} />
                        </div>
                      ))}
                    </div>
                    {dragOffset.x > 40 && <div className="absolute top-6 left-6 bg-green-500 text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[-12deg] uppercase shadow-lg">Add Bundle</div>}
                    {dragOffset.x < -40 && <div className="absolute top-6 right-6 bg-red-500 text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[12deg] uppercase shadow-lg">Skip</div>}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between pointer-events-none bg-white">
                    <div>
                      <div className="text-[10px] font-black text-purple-600 mb-1 tracking-widest uppercase flex items-center gap-1">
                        <span>🎁</span> CURATED KIT
                      </div>
                      <h2 className="text-xl font-bold leading-tight text-gray-900 line-clamp-1">{activeProduct.tier_name}</h2>
                      <p className="text-2xl font-black mt-1 text-gray-900">₹{activeProduct.total_price}</p>
                    </div>
                    <div className="bg-purple-50 p-3.5 rounded-2xl italic text-sm text-purple-900 font-semibold border border-purple-100 leading-snug">
                      "{activeProduct.why_reason}"
                    </div>
                  </div>
                </>
              ) : (
                // --- INDIVIDUAL CARD LAYOUT ---
                <>
                  <div className="h-3/5 relative border-b border-gray-100 bg-gray-100">
                    <img src={`/api/images/product_${activeProduct.id}.jpg`} className="w-full h-full object-cover pointer-events-none" onError={(e) => e.target.src = 'https://via.placeholder.com/300?text=No+Image'} />
                    {dragOffset.x > 40 && <div className="absolute top-6 left-6 bg-green-500 text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[-12deg] uppercase shadow-lg">Add to Cart</div>}
                    {dragOffset.x < -40 && <div className="absolute top-6 right-6 bg-red-500 text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[12deg] uppercase shadow-lg">Skip</div>}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between pointer-events-none bg-white">
                    <div>
                      <h2 className="text-xl font-bold leading-tight text-gray-900 line-clamp-1">{activeProduct.name}</h2>
                      <p className="text-2xl font-black mt-1 text-gray-900">₹{activeProduct.price}</p>
                    </div>
                    <div className="bg-blue-50 p-3.5 rounded-2xl italic text-sm text-blue-800 font-semibold border border-blue-100 leading-snug">
                      "{activeProduct.why_reason || 'Highly relevant matching item.'}"
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SwipeFeed;