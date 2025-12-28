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
from typing import Dict, Any, List
import os
import joblib
def _find_repo_root(start_path: str) -> str:
    cur = os.path.abspath(start_path)
    for _ in range(6):
        candidate = cur
        if os.path.isdir(os.path.join(candidate, 'data')):
            return candidate
        parent = os.path.dirname(candidate)
        if parent == candidate:
            break
        cur = parent
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

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

def _normalize_history_df(df: pd.DataFrame, symbol: str) -> pd.DataFrame:
    """
    Chuẩn hóa schema dữ liệu lịch sử về các cột bắt buộc:
    time, open, high, low, close, volume, symbol
    """
    if df is None or df.empty:
        return pd.DataFrame()

    # Rename time-like column to 'time'
    time_candidates = ['time', 'date', 'datetime', 'tradingDate']
    if 'time' not in df.columns:
        for c in time_candidates:
            if c in df.columns:
                df = df.rename(columns={c: 'time'})
                break

    # Normalize price/volume columns if alternative names exist
    rename_map: Dict[str, str] = {}
    if 'open' not in df.columns:
        for c in ['Open', 'o', 'open_price']:
            if c in df.columns:
                rename_map[c] = 'open'
                break
    if 'high' not in df.columns:
        for c in ['High', 'h', 'high_price']:
            if c in df.columns:
                rename_map[c] = 'high'
                break
    if 'low' not in df.columns:
        for c in ['Low', 'l', 'low_price']:
            if c in df.columns:
                rename_map[c] = 'low'
                break
    if 'close' not in df.columns:
        for c in ['Close', 'c', 'close_price', 'adj_close', 'price']:
            if c in df.columns:
                rename_map[c] = 'close'
                break
    if 'volume' not in df.columns:
        for c in ['Volume', 'vol', 'volume_match', 'total_volume']:
            if c in df.columns:
                rename_map[c] = 'volume'
                break

    if rename_map:
        df = df.rename(columns=rename_map)

    required = ['time', 'open', 'high', 'low', 'close', 'volume']
    # If any required missing, try to fill minimally
    for col in required:
        if col not in df.columns:
            df[col] = None

    # Keep only required columns
    df = df[required].copy()

    # Ensure time is string ISO-like
    try:
        df['time'] = pd.to_datetime(df['time']).dt.strftime('%Y-%m-%d')
    except Exception:
        # leave as-is if cannot parse
        pass

    # Add symbol column
    df['symbol'] = str(symbol).upper()

    # Sort ascending by time
    try:
        df = df.sort_values('time')
    except Exception:
        pass

    return df

def _slice_last_n(df: pd.DataFrame, n: int) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    if len(df) <= n:
        return df.tail(n)
    return df.iloc[-n:]

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

@app.get("/model-input/{symbol}")
def get_model_input(symbol: str, days: int = 50, source: str = 'VNStock'):
    """
    Trả về input gồm đúng 50 dòng cho một mã cổ phiếu,
    với các cột: time, open, high, low, close, volume, symbol.

    - source: 'VNStock' để lấy từ provider, 'local' để dùng CSV fallback.
    - days: số ngày quá khứ cần lấy tối thiểu để đảm bảo 50 dòng.
    """
    symbol = symbol.upper()

    # Tính khoảng thời gian lấy dữ liệu (lấy dư để đảm bảo đủ 50 bản ghi)
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=max(days, 60))).strftime('%Y-%m-%d')

    df: pd.DataFrame = pd.DataFrame()

    if source.lower() == 'vnstock':
        df = get_stock_history(symbol, start_date, end_date)
        df = _normalize_history_df(df, symbol)

    # Fallback to local CSV if insufficient rows or explicitly requested
    if df.empty or len(df) < 50 or source.lower() == 'local':
        try:
            # Build path to local CSV within repo
            repo_root = _find_repo_root(os.path.dirname(__file__))
            local_csv = os.path.join(repo_root, 'data', 'raw', 'ta', 'vietnam_stock_price_history_2022-10-31_2025-10-31.csv')
            if os.path.exists(local_csv):
                df_local = pd.read_csv(local_csv)
                # Try common column names
                # Ensure symbol filter
                sym_col = 'symbol' if 'symbol' in df_local.columns else ('ticker' if 'ticker' in df_local.columns else None)
                if sym_col is None:
                    raise Exception('symbol column not found in local CSV')
                df_local = df_local[df_local[sym_col].astype(str).str.upper() == symbol]

                # Map columns to required
                # time
                time_col = None
                for c in ['time', 'date', 'datetime', 'tradingDate']:
                    if c in df_local.columns:
                        time_col = c
                        break
                if time_col is None:
                    # If no time column, cannot proceed
                    raise Exception('time-like column not found in local CSV')

                rename_map = {time_col: 'time'}
                # price columns
                for src, dst, alts in [
                    ('open', 'open', ['Open','o','open_price']),
                    ('high', 'high', ['High','h','high_price']),
                    ('low', 'low', ['Low','l','low_price']),
                    ('close', 'close', ['Close','c','close_price','adj_close','price']),
                    ('volume', 'volume', ['Volume','vol','volume_match','total_volume']),
                ]:
                    if src in df_local.columns:
                        rename_map[src] = dst
                    else:
                        for alt in alts:
                            if alt in df_local.columns:
                                rename_map[alt] = dst
                                break

                df_local = df_local.rename(columns=rename_map)
                # Keep required columns; create missing if needed
                required = ['time', 'open', 'high', 'low', 'close', 'volume']
                for col in required:
                    if col not in df_local.columns:
                        df_local[col] = None
                df_local = df_local[required].copy()
                df_local['symbol'] = symbol
                try:
                    df_local['time'] = pd.to_datetime(df_local['time']).dt.strftime('%Y-%m-%d')
                except Exception:
                    pass
                df_local = df_local.sort_values('time')
                df = df_local
        except Exception as e:
            print(f"Local CSV fallback failed: {e}")

    # Slice last 50
    df_50 = _slice_last_n(df, 50)
    if df_50.empty or len(df_50) < 50:
        raise HTTPException(status_code=404, detail="Không đủ dữ liệu 50 dòng cho mã này")

    return {
        "symbol": symbol,
        "count": len(df_50),
        "data": df_50.to_dict(orient='records')
    }

@app.get("/predict/{symbol}")
def predict_symbol(symbol: str, days: int = 60, source: str = 'VNStock'):
    """
    Dự báo cho ngày mới nhất sử dụng mô hình lưu tại server/model/best_model.pkl.
    Trả về nhãn dự báo và xác suất mua (nếu có).
    """
    # Build input using same logic as /model-input
    symbol_u = symbol.upper()
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=max(days, 60))).strftime('%Y-%m-%d')

    df: pd.DataFrame = pd.DataFrame()
    if source.lower() == 'vnstock':
        df = get_stock_history(symbol_u, start_date, end_date)
        df = _normalize_history_df(df, symbol_u)

    if df.empty or len(df) < 50 or source.lower() == 'local':
        try:
            repo_root = _find_repo_root(os.path.dirname(__file__))
            local_csv = os.path.join(repo_root, 'data', 'raw', 'ta', 'vietnam_stock_price_history_2022-10-31_2025-10-31.csv')
            if os.path.exists(local_csv):
                df_local = pd.read_csv(local_csv)
                sym_col = 'symbol' if 'symbol' in df_local.columns else ('ticker' if 'ticker' in df_local.columns else None)
                if sym_col is None:
                    raise Exception('symbol column not found in local CSV')
                df_local = df_local[df_local[sym_col].astype(str).str.upper() == symbol_u]
                time_col = None
                for c in ['time', 'date', 'datetime', 'tradingDate']:
                    if c in df_local.columns:
                        time_col = c
                        break
                if time_col is None:
                    raise Exception('time-like column not found in local CSV')
                rename_map = {time_col: 'time'}
                for src, dst, alts in [
                    ('open', 'open', ['Open','o','open_price']),
                    ('high', 'high', ['High','h','high_price']),
                    ('low', 'low', ['Low','l','low_price']),
                    ('close', 'close', ['Close','c','close_price','adj_close','price']),
                    ('volume', 'volume', ['Volume','vol','volume_match','total_volume']),
                ]:
                    if src in df_local.columns:
                        rename_map[src] = dst
                    else:
                        for alt in alts:
                            if alt in df_local.columns:
                                rename_map[alt] = dst
                                break
                df_local = df_local.rename(columns=rename_map)
                required = ['time', 'open', 'high', 'low', 'close', 'volume']
                for col in required:
                    if col not in df_local.columns:
                        df_local[col] = None
                df_local = df_local[required].copy()
                df_local['symbol'] = symbol_u
                try:
                    df_local['time'] = pd.to_datetime(df_local['time']).dt.strftime('%Y-%m-%d')
                except Exception:
                    pass
                df_local = df_local.sort_values('time')
                df = df_local
        except Exception as e:
            print(f"Local CSV fallback failed (predict): {e}")

    df_50 = _slice_last_n(df, 50)
    if df_50.empty or len(df_50) < 50:
        raise HTTPException(status_code=404, detail="Không đủ dữ liệu 50 dòng cho mã này")

    # Load model and predict
    model_path = os.path.join(os.path.dirname(__file__), 'model', 'best_model.pkl')
    if not os.path.exists(model_path):
        raise HTTPException(status_code=500, detail="Model file not found")
    pipeline = joblib.load(model_path)

    y_pred = pipeline.predict(df_50)
    try:
        y_prob = pipeline.predict_proba(df_50)
        prob_buy = float(y_prob[0,1])
    except Exception:
        prob_buy = None

    return {
        "symbol": symbol_u,
        "date": df_50.iloc[-1]['time'],
        "prediction": y_pred[0] if len(y_pred) > 0 else None,
        "prob_buy": prob_buy,
        "rows": len(df_50),
    }