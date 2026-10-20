-- =============================================================================
-- migrations/0008_chi_so_nho.sql — NHỚ KẾT QUẢ /api/v2/chi-so THEO ETAG
-- =============================================================================
-- CHẠY:  npm run db:schema   (chạy lại được — IF NOT EXISTS)
--
-- /api/v2/chi-so (db/chi-so.mjs) tính số trang chủ mất ~36 ms CPU, gói Free cho
-- 10 ms/lượt. Kết quả chỉ đổi khi số liệu đổi hoặc sang ngày mới (ETag đổi),
-- nên mỗi ETag chỉ cần tính MỘT lần: isolate tính xong ghi chuỗi kết quả vào
-- đây, mọi isolate khác đọc lại thay vì tính. Chỉ giữ MỘT dòng (khoa luôn = 1),
-- ETag mới đè lên ETag cũ -> mỗi ETag tốn 1 dòng ghi.
-- Xoá cả bảng cũng vô hại: lần sau tính lại và ghi lại.
-- =============================================================================

CREATE TABLE IF NOT EXISTS chi_so_nho (
    khoa  INTEGER PRIMARY KEY CHECK (khoa = 1),   -- luôn 1: bảng chỉ có một dòng
    etag  TEXT    NOT NULL,                       -- ETag của kết quả đang nhớ
    luc   INTEGER NOT NULL,                       -- ms, lúc tính xong
    body  TEXT    NOT NULL                        -- nguyên văn chuỗi JSON trả cho trình duyệt
);
