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
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper Functions ---

def get_vn30_symbols():
    """Lấy danh sách mã chứng khoán thuộc rổ VN30"""
    try:
        listing = Listing(source='VCI')
        # Theo tài liệu: Liệt kê mã theo nhóm phân loại VN30
        vn30_data = listing.symbols_by_group('VN30')
        
        # Kiểm tra kiểu dữ liệu trả về
        if isinstance(vn30_data, pd.Series):
            # Nếu là Series, chuyển thành list trực tiếp
            symbols = vn30_data.tolist()
            print(f"VN30 symbols (Series): {symbols}")
            return symbols
        elif isinstance(vn30_data, pd.DataFrame):
            # Nếu là DataFrame
            print(f"VN30 DataFrame columns: {vn30_data.columns.tolist()}")
            if 'symbol' in vn30_data.columns:
                return vn30_data['symbol'].tolist()
            elif 'ticker' in vn30_data.columns:
                return vn30_data['ticker'].tolist()
            elif len(vn30_data.columns) > 0:
                return vn30_data.iloc[:, 0].tolist()
        
        return []
    except Exception as e:
        print(f"Lỗi khi lấy danh sách VN30: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_stock_history(symbol: str, start_date: str, end_date: str):
    """Lấy dữ liệu lịch sử của một mã cụ thể"""
    try:
        # Khởi tạo đối tượng Quote như trong tài liệu
        quote = Quote(symbol=symbol, source='VCI') 
        # Hàm history thường dùng định dạng YYYY-MM-DD
        df = quote.history(start=start_date, end=end_date, interval='1D')
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
    
    symbols = get_vn30_symbols()
    
    if not symbols:
        raise HTTPException(status_code=500, detail="Không thể lấy danh sách VN30")

    result_data = {}
    
    for sym in symbols:
        df = get_stock_history(sym, start_date, end_date)
        if not df.empty:
            # Chuyển DataFrame thành Dictionary để trả về JSON
            # orient='records' sẽ tạo list các object [{date:..., close:...}, ...]
            result_data[sym] = df.to_dict(orient='records')
        else:
            result_data[sym] = "No data found"
            
    return {
        "metadata": {
            "source": "VCI/VNStock",
            "start_date": start_date,
            "end_date": end_date,
            "group": "VN30"
        },
        "data": result_data
    }

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