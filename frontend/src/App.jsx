import React from 'react';
import SwipeFeed from './SwipeFeed';

function App() {
  return (
    <div className="flex justify-center items-center h-screen w-screen overflow-hidden bg-gray-100">
      <div className="w-full max-w-md h-full bg-white shadow-2xl relative overflow-hidden">
        {/* We are constraining the app to a mobile-sized container for that authentic Quick-Commerce feel */}
        <SwipeFeed />
      </div>
    </div>
  );
}

export default App;