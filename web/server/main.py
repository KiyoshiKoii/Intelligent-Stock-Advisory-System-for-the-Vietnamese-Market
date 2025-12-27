import sys
import os

# Fix encoding issue on Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    # Redirect stdout to use utf-8
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from vnstock import Listing, Quote
from datetime import datetime, timedelta
import pandas as pd

app = FastAPI(title="VNStock API - VN30 History")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
],
    allow_credentials=True,
    allow_methods=["*"],
)

# --- Helper Functions ---

# Simple in-memory caches to reduce provider calls and avoid rate limits
CACHE = {
    "vn30_list": {"ts": None, "data": []},
    "vn30_history": {},  # keyed by days: { days: {"ts": datetime, "data": {...}, "metadata": {...}} }
}

CACHE_TTL_SYMBOLS_SECONDS = 600  # 10 minutes
CACHE_TTL_HISTORY_SECONDS = 300   # 5 minutes

def _now():
    return datetime.now()

def _is_fresh(ts, ttl_seconds):
    return ts is not None and (_now() - ts).total_seconds() < ttl_seconds

def get_vn30_symbols():
    """Lấy danh sách mã chứng khoán thuộc rổ VN30"""
    # Return cached list if still fresh
    cached = CACHE.get("vn30_list", {})
    if _is_fresh(cached.get("ts"), CACHE_TTL_SYMBOLS_SECONDS):
        return cached.get("data", [])

    try:
        listing = Listing(source='VCI')
        # Theo tài liệu: Liệt kê mã theo nhóm phân loại VN30
        try:
            vn30_data = listing.symbols_by_group('VN30')
        except SystemExit as se:
            # Rate limited by provider; fall back to stale cache if available
            print(f"Rate limit while fetching VN30 list: {se}")
            if cached.get("data"):
                return cached.get("data")
            return []

        # Kiểm tra kiểu dữ liệu trả về
        if isinstance(vn30_data, pd.Series):
            symbols = vn30_data.tolist()
        elif isinstance(vn30_data, pd.DataFrame):
            if 'symbol' in vn30_data.columns:
                symbols = vn30_data['symbol'].tolist()
            elif 'ticker' in vn30_data.columns:
                symbols = vn30_data['ticker'].tolist()
            elif len(vn30_data.columns) > 0:
                symbols = vn30_data.iloc[:, 0].tolist()
            else:
                symbols = []
        else:
            symbols = []

        # Update cache
        CACHE["vn30_list"] = {"ts": _now(), "data": symbols}
        return symbols
    except Exception as e:
        print(f"Lỗi khi lấy danh sách VN30: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to stale cache if present
        if cached.get("data"):
            return cached.get("data")
        return []

def get_stock_history(symbol: str, start_date: str, end_date: str):
    """Lấy dữ liệu lịch sử của một mã cụ thể"""
    try:
        # Khởi tạo đối tượng Quote như trong tài liệu
        quote = Quote(symbol=symbol, source='VCI') 
        # Hàm history thường dùng định dạng YYYY-MM-DD
        try:
            df = quote.history(start=start_date, end=end_date, interval='1D')
        except SystemExit as se:
            # Provider rate limit; surface as empty to trigger fallback
            print(f"Rate limit while fetching history for {symbol}: {se}")
            return pd.DataFrame()
        return df
    except Exception as e:
        print(f"Lỗi khi lấy dữ liệu {symbol}: {e}")
        return pd.DataFrame()

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"message": "Welcome to VNStock API. Use /vn30-history to get data."}

@app.get("/vn30-list")
def get_vn30_list():
    """Trả về danh sách các mã trong VN30"""
    symbols = get_vn30_symbols()
    return {"count": len(symbols), "symbols": symbols}

@app.get("/vn30-history")
def get_vn30_history_data(days: int = 30):
    """
    Lấy dữ liệu lịch sử của toàn bộ VN30.
    - days: Số ngày quá khứ muốn lấy (mặc định 30 ngày).
    """
    # Tính toán ngày bắt đầu và kết thúc
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    # Serve cached history if fresh
    cached_days = CACHE["vn30_history"].get(days)
    if cached_days and _is_fresh(cached_days.get("ts"), CACHE_TTL_HISTORY_SECONDS):
        return {
            "metadata": cached_days.get("metadata"),
            "data": cached_days.get("data"),
        }

    symbols = get_vn30_symbols()
    if not symbols:
        # Try serving stale cached history if available
        if cached_days:
            return {
                "metadata": cached_days.get("metadata"),
                "data": cached_days.get("data"),
            }
        raise HTTPException(status_code=500, detail="Không thể lấy danh sách VN30")

    result_data = {}
    for sym in symbols:
        df = get_stock_history(sym, start_date, end_date)
        if not df.empty:
            result_data[sym] = df.to_dict(orient='records')
        else:
            # On rate limit or no data, keep previous cached symbol data if present
            if cached_days and cached_days.get("data", {}).get(sym):
                result_data[sym] = cached_days["data"][sym]
            else:
                result_data[sym] = "No data found"

    payload = {
        "metadata": {
            "source": "VCI/VNStock",
            "start_date": start_date,
            "end_date": end_date,
            "group": "VN30",
        },
        "data": result_data,
    }

    # Update cache
    CACHE["vn30_history"][days] = {"ts": _now(), "data": result_data, "metadata": payload["metadata"]}
    return payload

@app.get("/stock/{symbol}")
def get_single_stock(symbol: str, days: int = 30):
    """Lấy lịch sử của 1 mã bất kỳ"""
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    df = get_stock_history(symbol.upper(), start_date, end_date)
    if df.empty:
        raise HTTPException(status_code=404, detail="Symbol not found or no data")
        
    return {
        "symbol": symbol.upper(),
        "data": df.to_dict(orient='records')
    }