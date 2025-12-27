import React from "react";
import "./TopRecommendations.css";

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
    <div className='top-recommendations'>
      <h2 className='section-title'>🏆 Top 5 Recommended Stocks</h2>
      <div className='recommendations-grid'>
        {recommendations.map((stock, index) => (
          <div key={stock.symbol} className='recommendation-card'>
            <div className='card-header'>
              <span className='rank'>#{index + 1}</span>
              <span className='trend-icon'>{getTrendIcon(stock.trend)}</span>
            </div>
            <div className='card-body'>
              <h3 className='stock-symbol'>{stock.symbol}</h3>
              <p className='stock-name'>{stock.name}</p>
              <div className='score-bar'>
                <div
                  className='score-fill'
                  style={{ width: `${stock.score}%` }}
                ></div>
              </div>
              <p className='score-text'>Score: {stock.score}/100</p>
            </div>
            <div className='card-footer'>
              <span className='placeholder-badge'>Coming Soon</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopRecommendations;
