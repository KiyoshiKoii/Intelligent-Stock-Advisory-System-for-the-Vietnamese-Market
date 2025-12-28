import React, { useEffect, useMemo, useState } from "react";
import { stockAPI } from "../services/api";

const PAGE_SIZE = 10; // items per page per group

const Pager = ({ page, total, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-center gap-2 mt-3">
      <button
        className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Prev
      </button>
      <span className="text-slate-300 text-sm">
        Page {page} / {totalPages}
      </span>
      <button
        className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
};

const GroupList = ({ title, items, page, onPageChange }) => {
  const start = (page - 1) * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);
  return (
    <div className="mb-8 p-4 rounded-xl bg-slate-800 text-slate-200 shadow">
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      {slice.length === 0 ? (
        <p className="text-slate-400 text-sm">Không có dữ liệu.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slice.map((row, idx) => (
            <div key={`${row.symbol}-${idx}`} className="bg-slate-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold">{row.symbol}</span>
                <span className="text-sm text-slate-300">{row.date || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <div>
                    Pred: <span className="font-semibold">{row.prediction ?? "—"}</span>
                  </div>
                  <div>
                    Prob: <span className="font-semibold">{row.prob_buy != null ? (row.prob_buy * 100).toFixed(2) + "%" : "—"}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${row.prediction === 1 ? "bg-green-600" : "bg-slate-600"} text-white`}>
                  {row.prediction === 1 ? "Buy" : "Hold"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pager page={page} total={items.length} onChange={onPageChange} />
    </div>
  );
};

const TopRecommendations = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [g1Page, setG1Page] = useState(1);
  const [g2Page, setG2Page] = useState(1);
  const [g3Page, setG3Page] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await stockAPI.getTopRecommendationsCsv(50, true);
        const rows = Array.isArray(res?.data) ? res.data : [];
        // Filter valid rows (status ok and numeric prob)
        const cleaned = rows
          .filter((r) => r && r.status === "ok")
          .map((r) => ({
            symbol: String(r.symbol || "").toUpperCase(),
            date: r.date || null,
            prediction: r.prediction,
            prob_buy: typeof r.prob_buy === "number" ? r.prob_buy : (r.prob_buy != null ? Number(r.prob_buy) : null),
            status: r.status,
          }));
        setData(cleaned);
      } catch (e) {
        console.error(e);
        setError("Không thể lấy dữ liệu đề xuất");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const groups = useMemo(() => {
    const g1 = [];
    const g2 = [];
    const g3 = [];
    for (const row of data) {
      const p = row.prob_buy;
      if (p != null && p >= 0.7) g1.push(row);
      else if (p != null && p >= 0.6) g2.push(row);
      else g3.push(row);
    }
    return { g1, g2, g3 };
  }, [data]);

  if (loading) {
    return (
      <div className="mb-10 p-5 rounded-2xl shadow-2xl bg-slate-800 text-slate-200">
        <h2 className="text-white text-2xl md:text-[28px] font-bold text-center mb-6">🔄 Đang tải khuyến nghị…</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-10 p-5 rounded-2xl shadow-2xl bg-slate-800 text-slate-200">
        <h2 className="text-white text-2xl md:text-[28px] font-bold text-center mb-6">⚠️ {error}</h2>
      </div>
    );
  }

  return (
    <div className="mb-10 p-5 rounded-2xl shadow-2xl bg-slate-900 text-slate-200">
      <h2 className="text-white text-2xl md:text-[28px] font-bold text-center mb-6">🏆 Khuyến nghị theo nhóm xác suất</h2>

      <GroupList
        title="Nhóm 1 (prob ≥ 0.70)"
        items={groups.g1}
        page={g1Page}
        onPageChange={setG1Page}
      />

      <GroupList
        title="Nhóm 2 (0.60 ≤ prob < 0.70)"
        items={groups.g2}
        page={g2Page}
        onPageChange={setG2Page}
      />

      <GroupList
        title="Nhóm 3 (còn lại)"
        items={groups.g3}
        page={g3Page}
        onPageChange={setG3Page}
      />
    </div>
  );
};

export default TopRecommendations;
