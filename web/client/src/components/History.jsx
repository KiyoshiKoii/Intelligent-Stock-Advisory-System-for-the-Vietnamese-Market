import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
} from "recharts";
import { stockAPI } from "../services/api";

const ChartCard = ({ symbol, data, formatCurrency, formatDate }) => {
  return (
    <div className='bg-white border border-gray-200 rounded-lg p-4 shadow-sm'>
      <div className='flex justify-between items-center mb-4 pb-2 border-b border-dashed border-gray-200'>
        <h3 className='text-sm font-medium text-gray-700'>
          Mã: <span className='text-indigo-600 font-semibold'>{symbol}</span>
        </h3>
        {data && data.length > 0 && (
          <p className='text-sm text-gray-600'>
            Giá mới nhất:{" "}
            <strong>{formatCurrency(data[data.length - 1].close)}</strong>
          </p>
        )}
      </div>

      <div className='h-80'>
        <ResponsiveContainer width='100%' height='100%'>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`colorClose-${symbol}`}
                x1='0'
                y1='0'
                x2='0'
                y2='1'
              >
                <stop offset='5%' stopColor='#6366f1' stopOpacity={0.8} />
                <stop offset='95%' stopColor='#6366f1' stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' vertical={false} />
            <XAxis
              dataKey='time'
              tickFormatter={formatDate}
              tick={{ fontSize: 11 }}
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
              stroke='#4f46e5'
              fillOpacity={1}
              fill={`url(#colorClose-${symbol})`}
              name='Giá đóng cửa'
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const History = () => {
  const [symbols, setSymbols] = useState([]);
  const [history, setHistory] = useState({});
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const formatCurrency = (v) =>
    new Intl.NumberFormat("vi-VN").format(Math.round((v ?? 0) * 1000)) + " ₫";
  const formatDate = (iso) => new Date(iso).toLocaleDateString("vi-VN");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const listResp = await stockAPI.getTop100List();
        const syms = Array.isArray(listResp?.symbols) ? listResp.symbols : [];
        if (mounted) setSymbols(syms);

        const histResp = await stockAPI.getTop100History(days);
        const dataObj = histResp?.data || {};
        if (mounted) setHistory(dataObj);
      } catch (e) {
        console.error("Top100History load error", e);
        if (mounted) setError("Không thể tải dữ liệu Top 100.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [days]);

  const totalPages = useMemo(() => {
    if (!symbols || symbols.length === 0) return 1;
    return Math.ceil(symbols.length / pageSize);
  }, [symbols]);

  const visibleSymbols = useMemo(() => {
    const start = (page - 1) * pageSize;
    return symbols.slice(start, start + pageSize);
  }, [symbols, page]);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <section className='mt-10'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-xl font-semibold text-slate-800'>
          Lịch sử giá Top 100 (30 ngày)
        </h2>
        <div className='flex items-center gap-2'>
          <label className='text-sm text-slate-600'>Ngày:</label>
          <select
            className='border rounded px-2 py-1 text-sm'
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={90}>90</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className='bg-white p-6 rounded-lg border border-gray-200 shadow-sm'>
          <p className='text-sm text-slate-600'>Đang tải dữ liệu...</p>
        </div>
      )}

      {error && (
        <div className='bg-red-50 p-4 rounded-lg border border-red-200 mb-4'>
          <p className='text-sm text-red-700'>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {visibleSymbols.map((sym) => (
              <ChartCard
                key={sym}
                symbol={sym}
                data={(history[sym] || []).map((d) => ({ ...d }))}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            ))}
          </div>

          <div className='flex items-center justify-between mt-6'>
            <div className='text-sm text-slate-600'>
              Tổng mã: <strong>{symbols.length}</strong> • Trang {page}/
              {totalPages}
            </div>
            <div className='flex gap-2'>
              <button
                className='px-3 py-1 rounded border bg-white hover:bg-slate-50 disabled:opacity-50'
                onClick={goPrev}
                disabled={page === 1}
              >
                ← Trước
              </button>
              <button
                className='px-3 py-1 rounded border bg-white hover:bg-slate-50 disabled:opacity-50'
                onClick={goNext}
                disabled={page === totalPages}
              >
                Sau →
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default History;
