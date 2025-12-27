import React from "react";

const TopRecommendations = () => {
  // Placeholder data for top 5 recommendations
  const recommendations = [
    { symbol: "VNM", name: "Vinamilk", score: 95, trend: "up" },
    { symbol: "VIC", name: "Vingroup", score: 92, trend: "up" },
    { symbol: "HPG", name: "Hòa Phát", score: 88, trend: "up" },
    { symbol: "VHM", name: "Vinhomes", score: 85, trend: "neutral" },
    { symbol: "MSN", name: "Masan", score: 82, trend: "down" },
  ];

  const getTrendIcon = (trend) => {
    switch (trend) {
      case "up":
        return "📈";
      case "down":
        return "📉";
      default:
        return "➡️";
    }
  };

  return (
    <div className='mb-10 p-5 rounded-2xl shadow-2xl bg-slate-800 text-slate-200'>
      <h2 className='text-white text-2xl md:text-[28px] font-bold text-center mb-6'>
        🏆 Top 5 Recommended Stocks
      </h2>
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5'>
        {recommendations.map((stock, index) => (
          <div
            key={stock.symbol}
            className='bg-gray-300 rounded-xl p-5 transition-transform duration-300 ease-in-out hover:-translate-y-1 hover:shadow-xl relative overflow-hidden'
          >
            <div className='flex justify-between items-center mb-4'>
              <span className='bg-green-500 text-white px-3 py-1 rounded-full font-bold text-sm'>
                #{index + 1}
              </span>
              <span className='text-2xl'>{getTrendIcon(stock.trend)}</span>
            </div>
            <div className='mb-4'>
              <h3 className='text-2xl font-bold text-gray-800 mb-1'>
                {stock.symbol}
              </h3>
              <p className='text-gray-600 text-sm mb-4'>{stock.name}</p>
              <div className='w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2'>
                <div
                  className='h-full bg-linear-to-r from-red-500 to-green-500 transition-all'
                  style={{ width: stock.score + "%" }}
                ></div>
              </div>
              <p className='text-xs text-gray-600 font-semibold'>
                Score: {stock.score}/100
              </p>
            </div>
            <div className='text-center pt-2 border-t border-gray-200'>
              <span className='inline-block bg-yellow-400 text-gray-800 px-4 py-1 rounded-full text-xs font-bold animate-pulse'>
                Coming Soon
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopRecommendations;
