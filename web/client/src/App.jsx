import React from "react";
import TopRecommendations from "./components/TopRecommendations";
import VN30History from "./components/VN30History";
import "./App.css";

function App() {
  return (
    <div className='app'>
      <header className='app-header'>
        <div className='header-content'>
          <h1>🇻🇳 Intelligent Stock Advisory System</h1>
          <p className='subtitle'>
            Vietnamese Market Analysis & Recommendations
          </p>
        </div>
      </header>

      <main className='app-main'>
        <div className='container'>
          <TopRecommendations />
          <VN30History />
        </div>
      </main>

      <footer className='app-footer'>
        <p>© 2025 Intelligent Stock Advisory System. Data from VNStock API.</p>
      </footer>
    </div>
  );
}

export default App;
