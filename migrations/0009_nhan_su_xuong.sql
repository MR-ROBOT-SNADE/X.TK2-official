-- =============================================================================
-- migrations/0009_nhan_su_xuong.sql — DANH SÁCH NHÂN SỰ CỦA XƯỞNG (tách khỏi TK3)
-- =============================================================================
-- CHẠY:  npm run db:schema   (chạy lại được, không nhân đôi gì)
--
-- Từ 20/10/2026 sơ đồ tổ chức 3 kíp lấy từ sheet "Danh sách định biên nhân sự"
-- của xưởng: apps-script/nhan-su.gs (dự án Apps Script RIÊNG) -> POST /api/nhan-su
-- (db/nhan-su.mjs) -> bảng này -> GET /api/v2/nhan-su -> js/components/personnel.js.
-- Không còn dính gì tới TK3: bảng nhan_su cũ (0001, theo dây chuyền, lấy từ tab
-- DATABASE của sheet TK3) không còn ai ghi hay đọc — giữ lại chỉ để tra cứu.
--
-- Mỗi người chỉ lưu họ tên, vị trí, trạng thái. Sheet của xưởng còn ngày sinh,
-- số điện thoại, lương, kỷ luật... — những thứ đó không bao giờ tới đây.
-- =============================================================================

CREATE TABLE IF NOT EXISTS nhan_su_xuong (
    xuong       TEXT    NOT NULL,       -- 'XTK2' = Xưởng Thiêu kết 2 (chừa chỗ cho xưởng khác)
    kip         TEXT    NOT NULL CHECK (kip IN ('A', 'B', 'C')),
    stt         INTEGER NOT NULL,       -- thứ tự trong kíp theo đúng thứ tự trên sheet, từ 1
    nhan_vien   TEXT    NOT NULL,       -- họ tên
    vi_tri      TEXT,                   -- vị trí đã gọt gọn, vd 'NVVH Phối liệu'
    trang_thai  TEXT,                   -- 'Đang làm việc'
    PRIMARY KEY (xuong, kip, stt)
) WITHOUT ROWID;

-- LẦN ĐẦU: chép danh sách đang hiện trên web sang, để sơ đồ không trống trong lúc
-- chờ Apps Script đẩy lượt đầu. Bảng mới đã có người thì không chép gì.
INSERT INTO nhan_su_xuong (xuong, kip, stt, nhan_vien, vi_tri, trang_thai)
    SELECT 'XTK2', kip, stt, nhan_vien, vi_tri, trang_thai FROM nhan_su
    WHERE day_chuyen = 'TK3' AND nhan_vien IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM nhan_su_xuong);
