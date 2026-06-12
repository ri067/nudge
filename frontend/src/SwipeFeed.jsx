import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SwipeFeed = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // New States for dynamic user input
  const [inputValue, setInputValue] = useState('');
  const [activeQuery, setActiveQuery] = useState('Going on a summer trek next week');
  
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // The engine now listens to whatever the activeQuery string is
  useEffect(() => {
    const fetchCards = async () => {
      if (!activeQuery) return;
      
      setLoading(true);
      try {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/search`, {
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

  // Handle user submitting the search form
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setActiveQuery(inputValue);
      setInputValue(''); // Clear the input field after search
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
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setDragOffset({ x: 0, y: 0 });
  };

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
    <div className="relative w-full h-full p-4 flex flex-col pt-8 select-none touch-none bg-gray-50">
      <h1 className="text-3xl font-black text-gray-900 text-center mb-4 tracking-tighter">NUDGE</h1>
      
      {/* --- NEW: Dynamic Search Bar --- */}
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
              <div className="h-3/5 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center p-6 relative pointer-events-none border-b border-gray-100">
                <span className="text-8xl drop-shadow-sm transition-transform duration-300 hover:scale-110">📦</span>
                
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