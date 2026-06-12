import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SwipeFeed = () => {
  // --- View State ---
  const [currentView, setCurrentView] = useState('feed'); // 'feed' or 'cart'

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);
  
  const [inputValue, setInputValue] = useState('');
  const [activeQuery, setActiveQuery] = useState('Going on a summer trek next week');
  
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const fetchCards = async () => {
      if (!activeQuery) return;
      
      setLoading(true);
      try {
        const response = await axios.post(`/api/search`, {
          query: activeQuery,
          top_k: 5
        });
        setProducts(response.data.results);
      } catch (error) {
        console.error("Error fetching from AWS:", error);
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
      setCurrentView('feed'); // Ensure we jump back to feed if searching from cart
    }
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const offsetX = e.clientX - dragStart.x;
    const offsetY = e.clientY - dragStart.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handlePointerUp = (e, product) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    const sweepThreshold = 120;
    if (dragOffset.x > sweepThreshold) {
      handleSwipeAction('right', product);
    } else if (dragOffset.x < -sweepThreshold) {
      handleSwipeAction('left', product);
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleSwipeAction = (direction, product) => {
    if (!product) return;
    if (direction === 'right') {
      setCartItems((prev) => [...prev, product]);
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setDragOffset({ x: 0, y: 0 });
  };

  // --- Cart Total Calculation ---
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  // ==========================================
  // VIEW: CART (Styled to match the dark theme)
  // ==========================================
  if (currentView === 'cart') {
    return (
      <div className="relative w-full h-screen p-6 flex flex-col bg-[#1e133d] font-sans text-white overflow-y-auto">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-8 mt-4">
          <button 
            onClick={() => setCurrentView('feed')}
            className="flex items-center gap-2 text-gray-400 hover:text-white font-bold transition-colors"
          >
            <span className="text-xl">←</span> Back to Feed
          </button>
          <h1 className="text-2xl font-black text-white tracking-tighter">YOUR CART</h1>
        </div>

        {/* Cart Contents */}
        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <span className="text-6xl mb-4 opacity-50">🛒</span>
            <p className="font-bold text-lg text-white">Your cart is empty.</p>
            <p className="text-sm">Swipe right on some items!</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {cartItems.map((item, index) => (
              <div key={index} className="bg-[#332267] p-4 rounded-2xl shadow-sm border border-[#4d3a8a] flex items-center gap-4">
                <div className="w-16 h-16 bg-[#1e133d] rounded-xl flex items-center justify-center text-3xl">
                  📦
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#d0ff52] uppercase">{item.brand}</p>
                  <h3 className="font-bold text-white leading-tight">{item.name}</h3>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg text-white">₹{item.price}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Checkout Footer */}
        {cartItems.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#4d3a8a]">
            <div className="flex justify-between items-end mb-6">
              <p className="text-gray-400 font-bold">Total</p>
              <p className="text-3xl font-black text-[#d0ff52]">₹{cartTotal}</p>
            </div>
            <button 
              onClick={() => alert("Hackathon Demo: Checkout flow complete!")}
              className="w-full bg-[#d0ff52] text-[#1e133d] font-black py-4 rounded-2xl shadow-lg hover:bg-[#bbf033] transition-colors uppercase tracking-widest"
            >
              Secure Checkout
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: SWIPE FEED (Styled exactly like reference)
  // ==========================================
  const activeProduct = products[0];
  const cardStyle = isDragging
    ? {
        transform: `translate(${dragOffset.x}px, ${dragOffset.y * 0.2}px) rotate(${dragOffset.x * 0.05}deg)`,
        transition: 'none',
      }
    : {
        transform: 'translate(0px, 0px) rotate(0deg)',
        transition: 'transform 0.3s ease-out',
      };

  return (
    <div className="relative w-full h-screen p-5 flex flex-col pt-10 select-none touch-none bg-[#2a1b5c] overflow-hidden font-sans text-white">
      
      {/* Header matching the reference */}
      <div className="flex justify-between items-center mb-6 w-full z-20">
        <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
          <span className="text-[#d0ff52] text-3xl">✦</span> Nudge
        </h1>
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full bg-[#3d277d] flex items-center justify-center border border-[#55409e] text-lg">
            <span className="opacity-80">⚙️</span>
          </button>
          <button 
            onClick={() => setCurrentView('cart')}
            className="relative w-10 h-10 rounded-full bg-[#3d277d] border border-[#55409e] flex items-center justify-center overflow-hidden cursor-pointer shadow-md"
          >
            <span className="text-lg">🛒</span>
            {cartItems.length > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-[#ff4a7d] rounded-full border-2 border-[#2a1b5c]"></span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar - Integrated smoothly into dark theme */}
      <form onSubmit={handleSearchSubmit} className="flex gap-3 mb-4 w-full z-20">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What's on your mind?"
          className="flex-1 bg-[#3d277d] border border-[#55409e] text-white rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#d0ff52] placeholder-gray-400 shadow-inner"
        />
        <button 
          type="submit" 
          className="bg-[#d0ff52] text-[#2a1b5c] rounded-full px-6 py-3 text-sm font-black shadow-lg active:scale-95 transition-transform"
        >
          Go
        </button>
      </form>

      {/* Swipe Area */}
      <div className="relative flex-1 w-full flex flex-col justify-center items-center mt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center font-bold text-gray-400 animate-pulse">
            <span className="text-4xl mb-3">🧠</span>
            Analyzing request...
          </div>
        ) : !activeProduct ? (
          <div className="flex flex-col h-full items-center justify-center p-6 text-center text-white">
            <span className="text-5xl mb-4">🎉</span>
            <h3 className="text-2xl font-bold">All caught up!</h3>
            <p className="text-sm text-gray-400 mt-2">Type a new thought above to get fresh recommendations.</p>
          </div>
        ) : (
          <>
            {/* Background Stack Effect */}
            {products.length > 1 && (
              <div className="absolute w-full max-w-sm h-[55vh] bg-[#3d277d] rounded-[2.5rem] border border-[#55409e] scale-95 translate-y-6 opacity-60 pointer-events-none" />
            )}

            {/* Draggable Card */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, activeProduct)}
              style={cardStyle}
              className="absolute w-full max-w-sm h-[55vh] bg-gradient-to-br from-[#4a348b] to-[#2a1b5c] rounded-[2.5rem] shadow-2xl border border-[#6b55b5] flex flex-col overflow-hidden cursor-grab active:cursor-grabbing z-10"
            >
              {/* Product Visual Area */}
              <div className="h-2/3 flex items-center justify-center relative pointer-events-none border-b border-[#3d277d]/50 bg-[#1e133d]/20">
                {/* Visual Glow Effect */}
                <div className="absolute w-40 h-40 bg-orange-500 rounded-full blur-3xl opacity-20 top-10 left-10"></div>
                <div className="absolute w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-20 bottom-10 right-10"></div>
                
                <span className="text-9xl drop-shadow-lg z-10">📦</span>
                
                {/* Match Badge matching reference */}
                <div className="absolute top-5 right-5 bg-[#d0ff52] text-[#2a1b5c] text-sm font-black px-4 py-1.5 rounded-full shadow-lg z-20 flex items-center gap-1">
                  <span className="text-xs">♡</span> {activeProduct.badge || '94%'}
                </div>

                {/* Swipe Indicators */}
                {dragOffset.x > 40 && (
                  <div className="absolute top-8 left-8 border-4 border-[#d0ff52] text-[#d0ff52] text-xl font-black px-4 py-1 rounded-xl rotate-[-15deg] uppercase tracking-widest shadow-lg z-20">
                    CART
                  </div>
                )}
                {dragOffset.x < -40 && (
                  <div className="absolute top-8 right-8 border-4 border-[#ff4a7d] text-[#ff4a7d] text-xl font-black px-4 py-1 rounded-xl rotate-[15deg] uppercase tracking-widest shadow-lg z-20">
                    PASS
                  </div>
                )}
              </div>

              {/* Product Info Area */}
              <div className="p-6 flex-1 flex flex-col justify-end bg-gradient-to-t from-[#1e133d] to-transparent pointer-events-none relative z-10">
                <h2 className="text-3xl font-bold text-white leading-tight drop-shadow-md">
                  {activeProduct.name}
                </h2>
                <div className="flex justify-between items-end mt-2">
                  <p className="flex items-center gap-1 opacity-80 text-sm">
                    📍 {activeProduct.brand || 'Location Context'}
                  </p>
                  <p className="text-2xl font-black text-[#d0ff52] drop-shadow-md">
                    ₹{activeProduct.price}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons (Below Card) */}
      {activeProduct && (
        <div className="flex items-center justify-center gap-6 mt-6 mb-2 z-20">
          <button 
            onClick={() => handleSwipeAction('left', activeProduct)}
            className="w-14 h-14 bg-[#3d277d] rounded-full flex items-center justify-center text-2xl text-white shadow-lg border border-[#55409e] hover:bg-[#4a348b] transition-colors"
          >
            ✕
          </button>
          <button className="w-16 h-16 bg-[#d0ff52] rounded-full flex items-center justify-center text-3xl text-[#2a1b5c] font-black shadow-[0_0_20px_rgba(208,255,82,0.3)]">
            ||
          </button>
          <button 
            onClick={() => handleSwipeAction('right', activeProduct)}
            className="w-14 h-14 bg-[#ff4a7d] rounded-full flex items-center justify-center text-2xl text-white shadow-lg border border-[#ff6b95] hover:bg-[#ff6b95] transition-colors"
          >
            ♥
          </button>
        </div>
      )}

      {/* Bottom Navigation Pill */}
      <div className="mt-4 bg-[#3d277d] px-8 py-4 rounded-[2rem] flex justify-between items-center text-2xl z-20 w-full border border-[#55409e]">
        <span className="text-[#d0ff52] cursor-pointer drop-shadow-[0_0_8px_rgba(208,255,82,0.6)]">✦</span>
        <span className="text-[#6b55b5] cursor-pointer hover:text-white transition-colors">🌀</span>
        <span className="text-[#6b55b5] cursor-pointer hover:text-white transition-colors">💬</span>
        <span className="text-[#6b55b5] cursor-pointer hover:text-white transition-colors">♡</span>
      </div>
    </div>
  );
};

export default SwipeFeed;