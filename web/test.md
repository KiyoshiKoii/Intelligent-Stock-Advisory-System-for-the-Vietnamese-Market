Đã dùng 94% bộ nhớ … Nếu hết bộ nhớ, thì bạn không thể lưu tệp vào Drive, sao lưu vào Google Photos hoặc sử dụng Gmail. Tiết kiệm 50% khi mua các gói hằng năm cho 1 năm với ưu đãi trong thời gian có hạn.

# Hướng dẫn sử dụng pipeline dự báo cổ phiếu (best_pipeline.pkl)

## 1. Yêu cầu input

- DataFrame đầu vào phải có **đúng 50 dòng** (50 ngày gần nhất của 1 mã cổ phiếu).
- Các cột bắt buộc: `time`, `open`, `high`, `low`, `close`, `volume`, `symbol`.
- Dữ liệu phải được **sắp xếp tăng dần theo thời gian** (dòng cuối là ngày mới nhất).
- Chỉ 1 mã cổ phiếu trong mỗi lần dự báo (tất cả các dòng có cùng giá trị `symbol`).

## 2. Ví dụ tạo input

```python
import pandas as pd
# Giả sử bạn đã có DataFrame gốc df_full chứa nhiều ngày/mã
symbol = 'VNM'  # Thay bằng mã bạn muốn dự báo
# Lấy 50 ngày gần nhất của mã này
input_df = df_full[df_full['symbol'] == symbol].sort_values('time').iloc[-50:][['time','open','high','low','close','volume','symbol']]
```

## 3. Dự báo với pipeline

```python
import joblib
pipeline = joblib.load('best_model.pkl')

# Dự báo xác suất
y_prob = pipeline.predict_proba(input_df)  # Kết quả: mảng 1 hàng, 2 cột
print('Dự báo:', y_pred[0])
print('Xác suất mua:', y_prob[0,1])
```

## 4. Lưu ý

- Nếu input không đủ 50 dòng, pipeline sẽ báo lỗi.
- Nếu input có nhiều hơn 1 mã cổ phiếu, pipeline sẽ chỉ xử lý đúng nếu tất cả các dòng cùng 1 mã.
- Không cần tự tạo feature, pipeline sẽ tự động xử lý toàn bộ feature engineering.

---

**Tóm tắt:**

- Input: DataFrame 50 dòng, 7 cột chuẩn, 1 mã cổ phiếu, sắp xếp theo thời gian.
- Output: Dự báo cho ngày mới nhất (dòng cuối cùng).
