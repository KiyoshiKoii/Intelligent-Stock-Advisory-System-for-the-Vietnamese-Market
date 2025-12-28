import React from "react";
import { stockAPI } from "../services/api";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Bar,
  Brush,
} from "recharts";

const numberFormat = (value) => new Intl.NumberFormat("vi-VN").format(value);

const priceClass = (delta) => {
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-red-400";
  return "text-yellow-300";
};

const Board = () => {
  const sampleRows = [
    {
      symbol: "ACB",
      tran: 25.65,
      san: 22.35,
      tc: 24.0,
      buy: {
        g3: 23.8,
        kl3: 139200,
        g2: 23.85,
        kl2: 225500,
        g1: 23.9,
        kl1: 62100,
      },
      match: { price: 23.9, vol: 200, delta: -0.1, deltaPct: -0.42 },
      sell: {
        g1: 23.95,
        kl1: 39200,
        g2: 24.0,
        kl2: 201200,
        g3: 24.05,
        kl3: 31200,
      },
      totalVol: 7831900,
      high: 24.05,
      low: 23.65,
      foreign: { buy: 473500, sell: 871600, room: 71417681 },
    },
    {
      symbol: "BCM",
      tran: 64.7,
      san: 56.3,
      tc: 60.5,
      buy: { g3: 59.3, kl3: 8900, g2: 59.4, kl2: 1700, g1: 59.5, kl1: 5100 },
      match: { price: 59.6, vol: 200, delta: -0.9, deltaPct: -1.49 },
      sell: { g1: 59.6, kl1: 3800, g2: 59.7, kl2: 4100, g3: 59.8, kl3: 10100 },
      totalVol: 215900,
      high: 60.8,
      low: 58.5,
      foreign: { buy: 5520, sell: 108400, room: 329074955 },
    },
  ];

  const [data, setData] = React.useState([]);
  const [historyMap, setHistoryMap] = React.useState({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [selectedSymbol, setSelectedSymbol] = React.useState(null);
  const pageSize = 10;

  const normalizeHistoryToRows = (historyObj) => {
    const rows = [];
    const makeEmptyRow = (sym) => ({
      symbol: sym,
      tran: 0,
      san: 0,
      tc: 0,
      buy: { g3: 0, kl3: 0, g2: 0, kl2: 0, g1: 0, kl1: 0 },
      match: { price: 0, vol: 0, delta: 0, deltaPct: 0 },
      sell: { g1: 0, kl1: 0, g2: 0, kl2: 0, g3: 0, kl3: 0 },
      totalVol: 0,
      high: 0,
      low: 0,
      foreign: { buy: 0, sell: 0, room: 0 },
    });

    if (!historyObj || typeof historyObj !== "object") return rows;

    for (const [sym, series] of Object.entries(historyObj)) {
      if (!Array.isArray(series) || series.length === 0) {
        rows.push(makeEmptyRow(sym));
        continue;
      }

      const last = series[series.length - 1] || {};
      const prev = series.length >= 2 ? series[series.length - 2] : last;
      const totalVol = series.reduce((sum, d) => sum + (d.volume || 0), 0);
      const highs = series.map((d) => d.high ?? d.close ?? 0);
      const lows = series.map((d) => d.low ?? d.close ?? 0);
      const high = highs.length
        ? Math.max(...highs)
        : last.high ?? last.close ?? 0;
      const low = lows.length ? Math.min(...lows) : last.low ?? last.close ?? 0;
      const lastClose = last.close ?? 0;
      const prevClose = prev.close ?? last.open ?? lastClose;
      const delta = lastClose - (prevClose || 0);
      const deltaPct = prevClose ? (delta / prevClose) * 100 : 0;
      rows.push({
        symbol: sym,
        tran: high,
        san: low,
        tc: prevClose || lastClose,
        buy: {
          g3: lastClose,
          kl3: 0,
          g2: lastClose,
          kl2: 0,
          g1: lastClose,
          kl1: last.volume || 0,
        },
        match: { price: lastClose, vol: last.volume || 0, delta, deltaPct },
        sell: {
          g1: lastClose,
          kl1: 0,
          g2: lastClose,
          kl2: 0,
          g3: lastClose,
          kl3: 0,
        },
        totalVol: totalVol,
        high,
        low,
        foreign: { buy: 0, sell: 0, room: 0 },
      });
    }
    return rows;
  };

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await stockAPI.getTop100History(30);
        const dataObj = result?.data || {};
        const rows = normalizeHistoryToRows(dataObj);
        setData(rows);
        setHistoryMap(dataObj);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const rows = Array.isArray(data) && data.length ? data : sampleRows;
  const totalPages = Math.ceil(rows.length / pageSize);
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className='mt-6 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900'>
      <table className='min-w-max w-full text-xs'>
        <thead className='bg-slate-800 text-slate-200'>
          <tr>
            <th className='sticky left-0 bg-slate-800 px-3 py-2 text-left font-semibold'>
              CK
            </th>
            <th className='px-3 py-2 font-semibold'>Trần</th>
            <th className='px-3 py-2 font-semibold'>Sàn</th>
            <th className='px-3 py-2 font-semibold'>TC</th>
            <th className='px-3 py-2 font-semibold' colSpan={6}>
              Bên mua
            </th>
            <th className='px-3 py-2 font-semibold' colSpan={4}>
              Khớp lệnh
            </th>
            <th className='px-3 py-2 font-semibold' colSpan={6}>
              Bên bán
            </th>
            <th className='px-3 py-2 font-semibold'>Tổng KL</th>
            <th className='px-3 py-2 font-semibold'>Cao</th>
            <th className='px-3 py-2 font-semibold'>Thấp</th>
            <th className='px-3 py-2 font-semibold' colSpan={3}>
              ĐTNN
            </th>
          </tr>
          <tr className='bg-slate-800 text-slate-400'>
            <th className='sticky left-0 bg-slate-800 px-3 py-2'></th>
            <th className='px-3 py-2'></th>
            <th className='px-3 py-2'></th>
            <th className='px-3 py-2'></th>
            {/* Bên mua */}
            <th className='px-3 py-2'>Giá 3</th>
            <th className='px-3 py-2'>KL 3</th>
            <th className='px-3 py-2'>Giá 2</th>
            <th className='px-3 py-2'>KL 2</th>
            <th className='px-3 py-2'>Giá 1</th>
            <th className='px-3 py-2'>KL 1</th>
            {/* Khớp lệnh */}
            <th className='px-3 py-2'>Giá</th>
            <th className='px-3 py-2'>KL</th>
            <th className='px-3 py-2'>+/−</th>
            <th className='px-3 py-2'>+/− (%)</th>
            {/* Bên bán */}
            <th className='px-3 py-2'>Giá 1</th>
            <th className='px-3 py-2'>KL 1</th>
            <th className='px-3 py-2'>Giá 2</th>
            <th className='px-3 py-2'>KL 2</th>
            <th className='px-3 py-2'>Giá 3</th>
            <th className='px-3 py-2'>KL 3</th>
            {/* Others */}
            <th className='px-3 py-2'>Tổng KL</th>
            <th className='px-3 py-2'>Cao</th>
            <th className='px-3 py-2'>Thấp</th>
            {/* ĐTNN */}
            <th className='px-3 py-2'>NN mua</th>
            <th className='px-3 py-2'>NN bán</th>
            <th className='px-3 py-2'>Room</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => (
            <tr
              key={r.symbol}
              className={`border-t border-slate-800 bg-slate-900 hover:bg-slate-800 cursor-pointer ${
                selectedSymbol === r.symbol ? "ring-1 ring-indigo-500" : ""
              }`}
              onClick={() => setSelectedSymbol(r.symbol)}
            >
              <td className='sticky left-0 bg-slate-900 px-3 py-2 text-left font-bold text-red-400'>
                {r.symbol}
              </td>
              <td className='px-3 py-2 text-purple-300'>{r.tran.toFixed(2)}</td>
              <td className='px-3 py-2 text-cyan-300'>{r.san.toFixed(2)}</td>
              <td className='px-3 py-2 text-yellow-300'>{r.tc.toFixed(2)}</td>
              {/* Bên mua */}
              <td className='px-3 py-2 text-slate-200'>
                {r.buy.g3.toFixed(2)}
              </td>
              <td className='px-3 py-2 text-red-400'>
                {numberFormat(r.buy.kl3)}
              </td>
              <td className='px-3 py-2 text-slate-200'>
                {r.buy.g2.toFixed(2)}
              </td>
              <td className='px-3 py-2 text-red-400'>
                {numberFormat(r.buy.kl2)}
              </td>
              <td className='px-3 py-2 text-slate-200'>
                {r.buy.g1.toFixed(2)}
              </td>
              <td className='px-3 py-2 text-red-400'>
                {numberFormat(r.buy.kl1)}
              </td>
              {/* Khớp lệnh */}
              <td className={`px-3 py-2 ${priceClass(r.match.delta)}`}>
                {r.match.price.toFixed(2)}
              </td>
              <td className='px-3 py-2 text-slate-200'>
                {numberFormat(r.match.vol)}
              </td>
              <td
                className={
                  r.match.delta >= 0
                    ? "px-3 py-2 text-emerald-400"
                    : "px-3 py-2 text-red-400"
                }
              >
                {r.match.delta > 0 ? "+" : ""}
                {r.match.delta.toFixed(2)}
              </td>
              <td
                className={
                  r.match.deltaPct >= 0
                    ? "px-3 py-2 text-emerald-400"
                    : "px-3 py-2 text-red-400"
                }
              >
                {r.match.deltaPct > 0 ? "+" : ""}
                {r.match.deltaPct.toFixed(2)}%
              </td>
              {/* Bên bán */}
              <td className='px-3 py-2 text-slate-200'>
                {r.sell.g1.toFixed(2)}
              </td>
              <td className='px-3 py-2 text-green-400'>
                {numberFormat(r.sell.kl1)}
              </td>
              <td className='px-3 py-2 text-yellow-300'>
                {r.sell.g2.toFixed(2)}
              </td>
              <td className='px-3 py-2 text-green-400'>
                {numberFormat(r.sell.kl2)}
              </td>
              <td className='px-3 py-2 text-slate-200'>
                {r.sell.g3.toFixed(2)}
              </td>
              <td className='px-3 py-2 text-green-400'>
                {numberFormat(r.sell.kl3)}
              </td>
              {/* Others */}
              <td className='px-3 py-2 text-slate-200'>
                {numberFormat(r.totalVol)}
              </td>
              <td className='px-3 py-2 text-emerald-400'>
                {r.high.toFixed(2)}
              </td>
              <td className='px-3 py-2 text-red-400'>{r.low.toFixed(2)}</td>
              {/* ĐTNN */}
              <td className='px-3 py-2 text-slate-200'>
                {numberFormat(r.foreign.buy)}
              </td>
              <td className='px-3 py-2 text-slate-200'>
                {numberFormat(r.foreign.sell)}
              </td>
              <td className='px-3 py-2 text-slate-200'>
                {numberFormat(r.foreign.room)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination Controls */}
      <div className='bg-[#161B26] border-t border-slate-700 px-4 py-3 flex items-center justify-between'>
        <div className='text-sm text-slate-300'>
          Trang {page} / {totalPages} • Tổng: {rows.length} mã
        </div>
        <div className='flex gap-2'>
          <button
            className='px-3 py-1 rounded border border-slate-600 bg-[#1e293b] hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm'
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Trước
          </button>
          <button
            className='px-3 py-1 rounded border border-slate-600 bg-[#1e293b] hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm'
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Sau →
          </button>
        </div>
      </div>

      {selectedSymbol && Array.isArray(historyMap[selectedSymbol]) && (
        <div className='bg-white border-t border-slate-200 p-4'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-sm font-semibold text-slate-700'>
              Lịch sử: <span className='text-indigo-600'>{selectedSymbol}</span>
            </h3>
            <button
              className='text-xs px-2 py-1 border rounded hover:bg-slate-50'
              onClick={() => setSelectedSymbol(null)}
            >
              Đóng
            </button>
          </div>

          <div className='h-96'>
            <ResponsiveContainer width='100%' height='100%'>
              <ComposedChart
                data={historyMap[selectedSymbol] || []}
                margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} />
                <XAxis
                  dataKey='time'
                  tickFormatter={(iso) =>
                    new Date(iso).toLocaleDateString("vi-VN")
                  }
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId='price'
                  domain={["auto", "auto"]}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                />
                <YAxis
                  yAxisId='vol'
                  orientation='right'
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => numberFormat(v)}
                />
                <Tooltip
                  formatter={(value, name) => {
                    return [Number(value).toFixed(2), name];
                  }}
                  labelFormatter={(label) =>
                    `Ngày: ${new Date(label).toLocaleDateString("vi-VN")}`
                  }
                  contentStyle={{
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                  }}
                />
                <Legend />

                <Line
                  yAxisId='price'
                  type='linear'
                  dataKey='open'
                  stroke='#4f46e5'
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                  name='Mở'
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Board;
