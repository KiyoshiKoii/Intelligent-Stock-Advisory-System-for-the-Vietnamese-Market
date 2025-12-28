import os
from typing import List, Optional
import pandas as pd
import requests
import joblib
from datetime import datetime

def _find_repo_root(start_path: Optional[str] = None) -> str:
    """Ascend directories to locate repo root containing 'data' folder."""
    if start_path is None:
        start_path = os.path.dirname(__file__)
    cur = os.path.abspath(start_path)
    for _ in range(6):
        candidate = cur
        if os.path.isdir(os.path.join(candidate, 'data')):
            return candidate
        parent = os.path.dirname(candidate)
        if parent == candidate:
            break
        cur = parent
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

def get_top100_symbols(csv_path: Optional[str] = None) -> List[str]:
    """Đọc danh sách Top 100 mã cổ phiếu từ CSV và trả về list symbol."""
    if csv_path is None:
        repo_root = _find_repo_root()
        csv_path = os.path.join(repo_root, 'data', 'raw', 'top_100_stocks.csv')

    df = pd.read_csv(csv_path)
    if 'symbol' in df.columns:
        return df['symbol'].dropna().astype(str).str.upper().tolist()
    # fallback if column name differs
    for alt in ['ticker', 'Symbol']:
        if alt in df.columns:
            return df[alt].dropna().astype(str).str.upper().tolist()
    return []

def build_model_input(symbol: str, server_url: str = 'http://127.0.0.1:8000', days: int = 50, source: str = 'VNStock') -> pd.DataFrame:
    """
    Gọi API `/model-input/{symbol}` để lấy DataFrame 50 dòng với các cột
    time, open, high, low, close, volume, symbol. Nếu API không khả dụng,
    dùng CSV local để fallback.
    """
    symbol = symbol.upper()
    try:
        resp = requests.get(f"{server_url}/model-input/{symbol}", params={'days': days, 'source': source}, timeout=30)
        resp.raise_for_status()
        payload = resp.json()
        data = payload.get('data', [])
        df = pd.DataFrame(data)
        # Safety: ensure required columns order
        required = ['time', 'open', 'high', 'low', 'close', 'volume', 'symbol']
        for col in required:
            if col not in df.columns:
                df[col] = None
        return df[required]
    except Exception:
        # Fallback to local CSV
        repo_root = _find_repo_root()
        local_csv = os.path.join(repo_root, 'data', 'raw', 'ta', 'vietnam_stock_price_history_2022-10-31_2025-10-31.csv')
        df_local = pd.read_csv(local_csv)
        # Filter by symbol (support alternative column names)
        sym_col = 'symbol' if 'symbol' in df_local.columns else ('ticker' if 'ticker' in df_local.columns else None)
        if sym_col is None:
            raise RuntimeError('Cannot find symbol column in local CSV for fallback')
        df_local = df_local[df_local[sym_col].astype(str).str.upper() == symbol]

        # Determine time column
        time_col = None
        for c in ['time', 'date', 'datetime', 'tradingDate']:
            if c in df_local.columns:
                time_col = c
                break
        if time_col is None:
            raise RuntimeError('Cannot find time-like column in local CSV for fallback')

        rename_map = {time_col: 'time'}
        # Map price/volume columns
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
        df_local['symbol'] = symbol
        try:
            df_local['time'] = pd.to_datetime(df_local['time']).dt.strftime('%Y-%m-%d')
        except Exception:
            pass
        df_local = df_local.sort_values('time')
        df_local = df_local.iloc[-50:]
        return df_local[['time', 'open', 'high', 'low', 'close', 'volume', 'symbol']]

def build_model_features_input(symbol: str) -> pd.DataFrame:
    """
    Build input feature DataFrame using precomputed technical indicators from
    data/processed/ta/ta_data_technical_indicators.csv. Returns last 50 rows
    for the symbol, with feature columns only (excluding raw columns).
    """
    repo_root = _find_repo_root()
    feat_csv = os.path.join(repo_root, 'data', 'processed', 'ta', 'ta_data_technical_indicators.csv')
    df = pd.read_csv(feat_csv)
    df = df[df['symbol'].astype(str).str.upper() == symbol.upper()].copy()
    # Sort ascending by time (if available) and slice last 50
    time_col = None
    for c in ['time','date','datetime','tradingDate']:
        if c in df.columns:
            time_col = c
            break
    if time_col is not None:
        try:
            df[time_col] = pd.to_datetime(df[time_col])
        except Exception:
            pass
        try:
            df = df.sort_values(time_col)
        except Exception:
            pass
    df = df.iloc[-50:]
    # Select feature columns (exclude raw cols)
    exclude = {'time','symbol'}
    # Include raw OHLCV plus technical indicator features
    raw_cols = ['open','high','low','close','volume']
    feature_cols = [c for c in df.columns if c not in exclude and c not in raw_cols]
    cols = raw_cols + feature_cols
    return df[cols]
    
def _model_path_default() -> str:
    here = os.path.dirname(__file__)
    server_dir = os.path.dirname(here)
    return os.path.join(server_dir, 'model', 'best_model.pkl')

def predict_for_symbol(symbol: str, model_path: Optional[str] = None, server_url: str = 'http://127.0.0.1:8000', days: int = 60, source: str = 'local') -> dict:
    """
    Build input for a symbol and run prediction using saved pipeline.
    Returns a dict with symbol, date, prediction, prob_buy, status.
    """
    if model_path is None:
        model_path = _model_path_default()
    try:
        if source == 'local':
            df_input = build_model_features_input(symbol)
        else:
            df_input = build_model_input(symbol, server_url=server_url, days=days, source=source)
        if df_input is None or len(df_input) < 50:
            return {"symbol": symbol.upper(), "status": "insufficient_input"}

        pipeline = joblib.load(model_path)
        y_pred = pipeline.predict(df_input)
        try:
            y_prob = pipeline.predict_proba(df_input)
            prob_buy = float(y_prob[0,1])
        except Exception:
            prob_buy = None

        try:
            last_time = df_input.iloc[-1]['time']
        except Exception:
            last_time = None
        return {
            "symbol": symbol.upper(),
            "date": last_time,
            "prediction": y_pred[0] if len(y_pred) > 0 else None,
            "prob_buy": prob_buy,
            "status": "ok",
        }
    except Exception as e:
        return {"symbol": symbol.upper(), "status": f"error: {e}"}

def run_model_on_top100(model_path: Optional[str] = None, server_url: str = 'http://127.0.0.1:8000', days: int = 60, source: str = 'local', limit: Optional[int] = None) -> pd.DataFrame:
    """
    Run predictions for Top 100 symbols and return a DataFrame of results.
    """
    symbols = get_top100_symbols()
    if limit is not None:
        symbols = symbols[:limit]
    rows = []
    for sym in symbols:
        res = predict_for_symbol(sym, model_path=model_path, server_url=server_url, days=days, source=source)
        rows.append(res)
    df_res = pd.DataFrame(rows)
    # Order columns
    cols = ['symbol', 'date', 'prediction', 'prob_buy', 'status']
    for c in cols:
        if c not in df_res.columns:
            df_res[c] = None
    df_res = df_res[cols]
    # Sort by prob_buy descending where available
    try:
        df_res = df_res.sort_values(['status','prob_buy'], ascending=[True, False])
    except Exception:
        pass
    return df_res

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Run model for Top 100 symbols')
    parser.add_argument('--server_url', type=str, default='http://127.0.0.1:8000')
    parser.add_argument('--days', type=int, default=60)
    parser.add_argument('--source', type=str, default='local', choices=['local','VNStock'])
    parser.add_argument('--limit', type=int, default=None)
    parser.add_argument('--out', type=str, default='top100_predictions.csv')
    args = parser.parse_args()

    df_out = run_model_on_top100(server_url=args.server_url, days=args.days, source=args.source, limit=args.limit)
    print('=== Top Predictions (head) ===')
    try:
        print(df_out.head(10).to_string(index=False))
    except Exception:
        print(df_out.head(10))
    try:
        df_out.to_csv(args.out, index=False)
        print(f'Saved results to {args.out}')
    except Exception as e:
        print(f'Could not save CSV: {e}')
    
