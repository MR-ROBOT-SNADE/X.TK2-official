-- =============================================================================
-- migrations/0002_dong_bo.sql — SỔ THEO DÕI VIỆC CHÉP KV -> D1
-- =============================================================================
-- CHẠY:  npm run db:schema   (chạy cả 0001..0004; chạy lại được)
--
-- Mỗi lần Apps Script đẩy dữ liệu, functions/api/[[route]].js ghi KV như cũ rồi
-- gọi db/dong-bo-d1.mjs để chép sang D1. Bảng này là "sổ tay" của bước chép,
-- mỗi tuyến một dòng, cho nó biết:
--   - lần trước đã chép bản dữ liệu nào (etag) -> bản mới y nguyên thì bỏ qua;
--   - chép lúc nào (luc)                      -> chưa đủ 20 phút thì bỏ qua, để
--     phần tốn CPU chỉ xảy ra THỈNH THOẢNG (gói Free: 10 ms CPU/lượt);
--   - lần tới kiểm đoạn lịch sử cũ nào (doan_cu) -> xoay vòng hết lịch sử.
-- /api/trang-thai cũng đọc bảng này để báo lần chép gần nhất và lỗi nếu có.
-- =============================================================================

CREATE TABLE IF NOT EXISTS dong_bo (
    tuyen       TEXT PRIMARY KEY,       -- 'tk3' | 'tk4' | 'vattu'
    etag        TEXT,                   -- vân tay bản KV đã chép
    luc         INTEGER,                -- ms, lần chép thành công gần nhất
    so_o        INTEGER,                -- số ô đã đưa vào so sánh ở lần đó
    so_ghi      INTEGER,                -- số dòng D1 thực sự đổi ở lần đó
    doan_cu     INTEGER NOT NULL DEFAULT 0,  -- đoạn 14 ngày cũ sẽ kiểm lần tới
                                             -- (0 = đoạn liền trước cửa sổ 14 ngày gần nhất)
    loi         TEXT,                   -- lỗi gần nhất (NULL nếu lần gần nhất ổn)
    loi_luc     INTEGER                 -- lúc xảy ra lỗi đó (ms)
);
