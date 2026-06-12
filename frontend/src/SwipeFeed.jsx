import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SwipeFeed = () => {
  const [currentView, setCurrentView] = useState('feed');
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
    if (dragOffset.x > 120) handleSwipeAction('right', product);
    else if (dragOffset.x < -120) handleSwipeAction('left', product);
    else setDragOffset({ x: 0, y: 0 });
  };

  const handleSwipeAction = (direction, product) => {
    if (direction === 'right') setCartItems((prev) => [...prev, product]);
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setDragOffset({ x: 0, y: 0 });
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  // --- CART VIEW ---
  if (currentView === 'cart') {
    return (
      <div className="relative w-full h-full p-6 flex flex-col bg-gray-50 overflow-y-auto">
        <div className="flex items-center justify-between mb-8 mt-4">
          <button onClick={() => setCurrentView('feed')} className="text-gray-500 font-bold">← Back</button>
          <h1 className="text-2xl font-black tracking-tighter">YOUR CART</h1>
        </div>
        {cartItems.map((item, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl mb-4 border flex items-center gap-4">
            <img src={`/api/images/product_${item.id}.jpg`} className="w-16 h-16 rounded-xl object-cover" />
            <div className="flex-1"><h3 className="font-bold">{item.name}</h3></div>
            <p className="font-black">₹{item.price}</p>
          </div>
        ))}
        {cartItems.length > 0 && (
          <div className="mt-8 pt-6 border-t">
            <p className="text-3xl font-black mb-6">Total: ₹{cartTotal}</p>
            <button className="w-full bg-green-500 text-white font-black py-4 rounded-2xl">CHECKOUT</button>
          </div>
        )}
      </div>
    );
  }

  // --- SWIPE FEED VIEW ---
  const activeProduct = products[0];
  const cardStyle = isDragging
    ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y * 0.2}px) rotate(${dragOffset.x * 0.05}deg)`, transition: 'none' }
    : { transform: 'translate(0px, 0px) rotate(0deg)', transition: 'transform 0.3s ease-out' };

  return (
    <div className="relative w-full h-full p-4 flex flex-col pt-8 bg-gray-50 overflow-hidden">
      <div onClick={() => setCurrentView('cart')} className="absolute top-6 right-6 z-50 bg-white p-3 rounded-full shadow-md cursor-pointer">🛒 {cartItems.length}</div>
      <h1 className="text-3xl font-black text-center mb-4">NUDGE</h1>
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-6 px-2">
        <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="flex-1 rounded-full px-5 py-3 shadow-sm" placeholder="What's on your mind?" />
        <button type="submit" className="bg-gray-900 text-white rounded-full px-5 py-3 font-bold">Go</button>
      </form>

      <div className="relative flex-1 w-full flex justify-center items-center">
        {loading ? <div className="font-bold text-gray-400">Analyzing...</div> : products.length === 0 ? <div className="text-center">🎉 All caught up!</div> : (
          <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={(e) => handlePointerUp(e, activeProduct)} style={cardStyle} className="absolute w-80 h-[28rem] bg-white rounded-3xl shadow-2xl overflow-hidden cursor-grab z-10">
            <img src={`/api/images/product_${activeProduct.id}.jpg`} className="h-3/5 w-full object-cover" onError={(e) => e.target.src = 'https://via.placeholder.com/300'} />
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold leading-tight">{activeProduct.name}</h2>
                <p className="text-2xl font-black mt-1">₹{activeProduct.price}</p>
              </div>
              <div className="bg-blue-50 p-3.5 rounded-2xl italic text-sm text-blue-800">
                "{activeProduct.why_reason || 'Highly relevant match'}"
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SwipeFeed;