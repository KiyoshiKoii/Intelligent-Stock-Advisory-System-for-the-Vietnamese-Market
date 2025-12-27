import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import "./VN30History.css";

const VN30History = () => {
  const [vn30Data, setVn30Data] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [symbols, setSymbols] = useState([]);

  // --- STATE CHO PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Mỗi trang 10 công ty

  // Gọi API lấy dữ liệu
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          "http://127.0.0.1:5000/vn30-history?days=30"
        );
        const data = response.data.data;

        setVn30Data(data);
        const symbolList = Object.keys(data);
        setSymbols(symbolList);

        if (symbolList.length > 0) {
          setSelectedSymbol(symbolList[0]);
        }
        setLoading(false);
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- LOGIC PHÂN TRANG ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSymbols = symbols.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(symbols.length / itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // Các hàm format (giữ nguyên)
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  if (loading)
    return <div className='loading'>Đang tải dữ liệu thị trường...</div>;

  const currentData = vn30Data[selectedSymbol] || [];

  return (
    <div className='vn30-history-container'>
      <h2>📈 Biểu đồ Lịch sử VN30 (30 Ngày)</h2>

      {/* --- KHU VỰC CHỌN MÃ CỔ PHIẾU (PHÂN TRANG) --- */}
      <div className='pagination-container'>
        {/* Nút lùi trang */}
        <button
          className='nav-btn'
          onClick={handlePrevPage}
          disabled={currentPage === 1}
        >
          &lt; Trước
        </button>

        {/* Danh sách 10 mã cổ phiếu hiện tại - Hàng Ngang */}
        <div className='stock-selector'>
          {currentSymbols.map((symbol) => (
            <button
              key={symbol}
              className={`stock-btn ${
                selectedSymbol === symbol ? "active" : ""
              }`}
              onClick={() => setSelectedSymbol(symbol)}
            >
              {symbol}
            </button>
          ))}
        </div>

        {/* Nút tới trang */}
        <button
          className='nav-btn'
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
        >
          Sau &gt;
        </button>
      </div>

      {/* Hiển thị số trang hiện tại */}
      <div className='page-indicator'>
        Trang {currentPage} / {totalPages}
      </div>

      {/* --- BIỂU ĐỒ (Giữ nguyên logic cũ) --- */}
      <div className='chart-wrapper'>
        <div className='chart-header'>
          <h3>
            Mã: <span className='highlight'>{selectedSymbol}</span>
          </h3>
          {currentData.length > 0 && (
            <p>
              Giá mới nhất:{" "}
              <strong>
                {formatCurrency(currentData[currentData.length - 1].close)}
              </strong>
            </p>
          )}
        </div>

        <div className='chart-container'>
          <ResponsiveContainer width='100%' height={400}>
            <AreaChart data={currentData}>
              <defs>
                <linearGradient id='colorClose' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#2ecc71' stopOpacity={0.8} />
                  <stop offset='95%' stopColor='#2ecc71' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray='3 3' vertical={false} />
              <XAxis
                dataKey='time'
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(value) => value / 1000 + "k"}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value), "Giá đóng cửa"]}
                labelFormatter={(label) =>
                  `Ngày: ${new Date(label).toLocaleDateString("vi-VN")}`
                }
                contentStyle={{ backgroundColor: "#fff", borderRadius: "8px" }}
              />
              <Legend />
              <Area
                type='monotone'
                dataKey='close'
                stroke='#27ae60'
                fillOpacity={1}
                fill='url(#colorClose)'
                name='Giá đóng cửa'
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default VN30History;
