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
    if (direction === 'right') {
      setCartItems((prev) => [...prev, product]);
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setDragOffset({ x: 0, y: 0 });
  };

  // --- Cart Total Calculation ---
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  // ==========================================
  // VIEW: CART
  // ==========================================
  if (currentView === 'cart') {
    return (
      <div className="relative w-full h-full p-6 flex flex-col bg-gray-50 overflow-y-auto">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-8 mt-4">
          <button 
            onClick={() => setCurrentView('feed')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold transition-colors"
          >
            <span className="text-xl">←</span> Back to Feed
          </button>
          <h1 className="text-2xl font-black text-gray-900 tracking-tighter">YOUR CART</h1>
        </div>

        {/* Cart Contents */}
        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <span className="text-6xl mb-4 opacity-50">🛒</span>
            <p className="font-bold text-lg">Your cart is empty.</p>
            <p className="text-sm">Swipe right on some items!</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {cartItems.map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center text-3xl">
                  🔥
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase">{item.brand}</p>
                  <h3 className="font-bold text-gray-900 leading-tight">{item.name}</h3>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg text-gray-900">₹{item.price}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Checkout Footer */}
        {cartItems.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-end mb-6">
              <p className="text-gray-500 font-bold">Total</p>
              <p className="text-3xl font-black text-gray-900">₹{cartTotal}</p>
            </div>
            <button 
              onClick={() => alert("Hackathon Demo: Checkout flow complete!")}
              className="w-full bg-green-500 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-green-600 transition-colors uppercase tracking-widest"
            >
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
    <div className="relative w-full h-full p-4 flex flex-col pt-8 select-none touch-none bg-gray-50 overflow-hidden">
      
      {/* Clickable Cart Badge */}
      <div 
        onClick={() => setCurrentView('cart')}
        className="absolute top-6 right-6 bg-white shadow-md rounded-full px-4 py-2 flex items-center gap-2 z-50 border border-gray-100 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
      >
        <span className="text-xl">🛒</span>
        <span className="font-black text-gray-800 text-lg">{cartItems.length}</span>
        {cartItems.length > 0 && (
          <span className="absolute top-1 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </div>

      <h1 className="text-3xl font-black text-gray-900 text-center mb-4 tracking-tighter mt-4">NUDGE</h1>
      
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-6 px-2 w-full z-20">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What's on your mind?"
          className="flex-1 bg-white border border-gray-200 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
        />
        <button 
          type="submit" 
          className="bg-gray-900 text-white rounded-full px-5 py-3 text-sm font-bold shadow-md active:scale-95 transition-transform"
        >
          Go
        </button>
      </form>

      <div className="relative flex-1 w-full flex justify-center items-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center font-bold text-gray-400 animate-pulse">
            <span className="text-3xl mb-2">🧠</span>
            Analyzing request...
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center p-6 text-center">
            <span className="text-5xl mb-4">🎉</span>
            <h3 className="text-xl font-bold text-gray-800">All caught up!</h3>
            <p className="text-sm text-gray-500 mt-1">Type a new thought above to get fresh recommendations.</p>
          </div>
        ) : (
          <>
            {products.length > 1 && (
              <div className="absolute w-80 h-[28rem] bg-white rounded-3xl border border-gray-200 scale-95 translate-y-4 opacity-50 pointer-events-none" />
            )}

            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, activeProduct)}
              style={cardStyle}
              className="absolute w-80 h-[28rem] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden cursor-grab active:cursor-grabbing z-10"
            >
              <div className="h-3/5 bg-white relative pointer-events-none border-b border-gray-100">
  <img
    src={`/api/images/product_${activeProduct.id}.jpg`}
    className="h-full w-full object-cover"
    alt={activeProduct.name}
    onError={(e) =>
      (e.target.src = 'https://via.placeholder.com/300')
    }
  />

  {dragOffset.x > 40 && (
    <div className="absolute top-6 left-6 bg-green-500 text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[-12deg] uppercase tracking-widest shadow-lg">
      Add to Cart
    </div>
  )}

  {dragOffset.x < -40 && (
    <div className="absolute top-6 right-6 bg-red-500 text-white text-sm font-black px-4 py-1.5 rounded-lg rotate-[12deg] uppercase tracking-widest shadow-lg">
      Skip
    </div>
  )}
</div>

              <div className="p-5 flex-1 flex flex-col justify-between bg-white pointer-events-none">
                <div>
                  <div className="text-[10px] font-black text-blue-600 mb-1.5 tracking-widest uppercase">
                    {activeProduct.badge || '🎯 CONTEXT MATCH'}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight line-clamp-1">{activeProduct.name}</h2>
                  <p className="text-2xl font-black text-gray-900 mt-1">₹{activeProduct.price}</p>
                </div>
                
                <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100 mt-2">
                  <p className="text-sm font-semibold text-blue-800 italic leading-snug">
                    "{activeProduct.why_reason || 'Highly relevant matching item.'}"
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SwipeFeed;