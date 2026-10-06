-- =============================================================================
-- migrations/0001_khoi_tao.sql — CÁC BẢNG CHÍNH CỦA CƠ SỞ DỮ LIỆU D1 (xtk2-db)
-- =============================================================================
-- CHẠY:  npm run db:schema   (= wrangler d1 execute xtk2-db --remote --file=...)
--        Chạy lại bao nhiêu lần cũng được: mọi lệnh đều IF NOT EXISTS.
--
-- SƠ ĐỒ
--   chi_tieu    danh mục: mỗi CỘT số liệu của bảng tính là một dòng
--   so_lieu     số liệu:  mỗi Ô có giá trị của bảng tính là một dòng
--   nhan_su     danh sách nhân sự theo kíp A / B / C
--   vat_tu_ton  tồn kho vật tư hiện tại
--   vat_tu_phieu phiếu nhập / xuất vật tư
--   nhat_ky_nap nhật ký mỗi lần nạp
--   (bảng dong_bo, goi_thang, moc_khoi ở các file 0002..0004)
--
-- NGUYÊN TẮC THIẾT KẾ
--   - Bảng DỌC: bảng tính gốc là ~14 khối ghép ngang, 104-115 cột, 77% ô trống.
--     Lưu dọc (mỗi ô một dòng) thì chỉ tốn chỗ cho ô có số. Sheet thêm/đổi cột
--     chỉ sinh thêm một dòng chi_tieu — không phải sửa cấu trúc bảng.
--   - D1 giữ ĐỦ mọi cột; API (db/goi-v2.mjs) mới là nơi quyết định trả gì ra
--     ngoài. Không bảng nào có đường vào công khai — chỉ Function của trang đọc
--     được, qua binding DB.
--   - Gói Free: 100.000 dòng ghi/ngày, và MỖI chỉ mục phụ tính thêm một dòng ghi.
--     Vì vậy so_lieu KHÔNG có chỉ mục phụ: mọi truy vấn đều đi theo khoá chính
--     (chi_tieu, day_chuyen, ngay, stt), vốn đã lọc được theo chỉ tiêu + khoảng
--     ngày mà không cần thêm gì.
--   - Không viết BEGIN/COMMIT trong file: D1 không nhận giao dịch tự mở trong SQL.
-- =============================================================================

-- DANH MỤC CHỈ TIÊU — một cột số liệu của bảng tính = một dòng.
-- ma do db/chuan-hoa.mjs (taoMa) sinh từ tên khối + tên cột, bỏ dấu, vd
--   khối 'THthan', cột 'Tiêu hao theo nhiệt trị' -> 'ththan.tieu_hao_theo_nhiet_tri'
CREATE TABLE IF NOT EXISTS chi_tieu (
    ma          TEXT PRIMARY KEY,
    khoi        TEXT NOT NULL,          -- tên trong 'Thời gian (...)' của khối, vd 'Điện'
    cot_sheet   TEXT NOT NULL,          -- tên cột y nguyên trong bảng tính
    loai        TEXT NOT NULL CHECK (loai IN ('ca', 'luy_ke', 'muc_tieu', 'thong_ke', 'chu')),
                                        -- ca = số theo ca; luy_ke = cộng dồn; muc_tieu =
                                        -- định mức/kế hoạch; thong_ke = trung bình, độ
                                        -- lệch...; chu = cột chữ (kíp, cảnh báo)
    UNIQUE (khoi, cot_sheet)
);

-- SỐ LIỆU — một ô có giá trị = một dòng.
-- Khoá là (ngay, stt) chứ không phải (ngay, kip): khối QTK lấy mẫu 8-12 lần/ngày,
-- cùng một kíp lặp lại nhiều hàng liền nhau.
-- Ví dụ ô 'Điện năng' kíp A ngày 01/10 của TK3:
--   ('dien.dien_nang', 'TK3', '2026-10-01', 1, 1, 'A', 1234, NULL, 1759300000000)
CREATE TABLE IF NOT EXISTS so_lieu (
    chi_tieu    TEXT    NOT NULL REFERENCES chi_tieu(ma),
    day_chuyen  TEXT    NOT NULL CHECK (day_chuyen IN ('TK3', 'TK4')),
    ngay        TEXT    NOT NULL,       -- 'YYYY-MM-DD' (ô ngày gộp đã được điền xuôi)
    stt         INTEGER NOT NULL,       -- thứ tự hàng trong NGÀY của khối, từ 1;
                                        -- 0 = hàng mở đầu ngày CHƯA có kíp, chỉ giữ ô
                                        -- định mức / kế hoạch (kế hoạch tháng ở ngày 01)
    ca          INTEGER NOT NULL,       -- 1, 2...: tăng mỗi khi kíp đổi trong ngày; 0 khi stt = 0
    kip         TEXT    NOT NULL,       -- giá trị cột Ca/kíp: 'A' / 'B' / 'C'; '' khi stt = 0
    gia_tri     REAL,                   -- số; NULL nếu ô là chữ hoặc lỗi công thức
    chu         TEXT,                   -- nguyên văn ô khi KHÔNG đọc được thành số
                                        -- ('Ổn định', '#DIV/0!'...), còn lại NULL
    cap_nhat    INTEGER NOT NULL,       -- mốc ghi (ms), chỉ đổi khi giá trị đổi
    PRIMARY KEY (chi_tieu, day_chuyen, ngay, stt)
) WITHOUT ROWID;                        -- lưu thẳng theo khoá chính: gọn và nhanh hơn

-- NHÂN SỰ THEO KÍP (các cột 'STT (A)', 'Mã nhân viên (A)'... của tab DATABASE).
-- Cột 'Mã nhân viên' trong sheet thực tế đang ghi HỌ TÊN, nên đặt tên chung nhan_vien.
CREATE TABLE IF NOT EXISTS nhan_su (
    day_chuyen  TEXT    NOT NULL CHECK (day_chuyen IN ('TK3', 'TK4')),
    kip         TEXT    NOT NULL CHECK (kip IN ('A', 'B', 'C')),
    stt         INTEGER NOT NULL,
    nhan_vien   TEXT,
    vi_tri      TEXT,
    trang_thai  TEXT,
    PRIMARY KEY (day_chuyen, kip, stt)
);

-- TỒN KHO VẬT TƯ HIỆN TẠI (khối tongHop của Apps Script vật tư).
CREATE TABLE IF NOT EXISTS vat_tu_ton (
    day_chuyen  TEXT NOT NULL CHECK (day_chuyen IN ('TK3', 'TK4')),
    ten         TEXT NOT NULL,
    don_vi      TEXT,
    ton_dau     REAL,
    nhap        REAL,
    xuat        REAL,
    ton_cuoi    REAL,
    ton_an_toan REAL,
    PRIMARY KEY (day_chuyen, ten)
);

-- PHIẾU NHẬP / XUẤT VẬT TƯ.
-- Ngày và ca được tách MỘT LẦN lúc nạp, từ mô tả kiểu '1B 28/10/2025 - Thắng Lợi'
-- (ca 1, kíp B, ngày 28/10/2025). Mô tả thiếu năm ('1B ngày 23/1') thì ngay = NULL
-- và giữ phần ngày-tháng ở ngay_thieu_nam — không đoán năm (trình duyệt đang đoán
-- theo năm HIỆN TẠI của máy người xem, sang năm mới là xếp nhầm).
CREATE TABLE IF NOT EXISTS vat_tu_phieu (
    id              INTEGER PRIMARY KEY,   -- tự tăng; thứ tự = thứ tự dòng trong sheet
    day_chuyen      TEXT NOT NULL CHECK (day_chuyen IN ('TK3', 'TK4')),
    loai            TEXT NOT NULL CHECK (loai IN ('nhap', 'xuat')),
    ten             TEXT NOT NULL,
    so_luong        REAL,
    mo_ta           TEXT,
    ngay            TEXT,               -- 'YYYY-MM-DD' hoặc NULL
    ngay_thieu_nam  TEXT,               -- 'MM-DD' khi mô tả không ghi năm
    ca              INTEGER,
    kip             TEXT
);

-- NHẬT KÝ NẠP: mỗi lần nạp một dòng — nạp từ đâu, lúc nào, bao nhiêu ô.
CREATE TABLE IF NOT EXISTS nhat_ky_nap (
    id          INTEGER PRIMARY KEY,
    luc         INTEGER NOT NULL,       -- ms
    nguon       TEXT    NOT NULL,       -- 'lich-su' (scripts/nap-lich-su.mjs) | 'apps-script'
    tuyen       TEXT    NOT NULL,       -- 'tk3' | 'tk4' | 'vattu'
    so_gia_tri  INTEGER NOT NULL,
    ghi_chu     TEXT
);
