Muốn đọc hiểu code: xem mục BẢN ĐỒ MÃ NGUỒN ở cuối file này.

Link Apps Script (dữ liệu nguồn thiêu kết 3, thiêu kết 4): KHÔNG ghi vào đây.
    Ai có link /exec là tải được toàn bộ dữ liệu, không cần đăng nhập. Xem trong
    Apps Script > Triển khai > Quản lý bản triển khai. Web không dùng link này —
    dữ liệu do Apps Script tự đẩy lên Cloudflare (/api/tk3, /api/tk4, /api/vattu).

Link deploy dự án lên GitHub: https://mr-robot-snade.github.io/X.TK2-official/

- Giao thức cập nhật dự án sau deploy lên terminal (dùng ở máy cá nhân):
    + Cài npm install -g wrangler trên terminal
    + Chạy lệnh npm run deploy để cập nhật dự án
      (= vite build rồi wrangler pages deploy dist --project-name xtk2-profile --branch production)

- Giao thức cập nhật dự án sau deploy trên terminal (dùng ở ổ cứng công ty thôi nhé):
    d:\node-v24.15.0-win-x64\npx.cmd vite build
    d:\node-v24.15.0-win-x64\npx.cmd wrangler pages deploy dist --project-name xtk2-profile --branch production

  LUÔN deploy thư mục dist, KHÔNG deploy dấu chấm (.): deploy . là đưa cả thư mục
  gốc lên mạng — README này, mã nguồn js/ chưa thu nhỏ kèm chú thích...

  LUÔN có --branch production: nhánh production của dự án Pages tên là
  "production". Thiếu cờ này, wrangler lấy tên nhánh git đang đứng (master) và
  deploy thành bản PREVIEW ở master.xtk2-profile.pages.dev — trang chính không
  đổi gì, còn bản preview thì lỗi 500 vì môi trường Preview không có KV binding.

Link deploy dự án lên CloudFlare thông qua node.js: https://xtk2-profile.pages.dev

- Dashboard CÔNG KHAI: ai có link cũng xem được. Thứ được bảo vệ là NGUỒN (Google
  Sheet, link Apps Script), quyền GHI (PUSH_KEY) và việc dùng API ngoài trang.
  Mọi số liệu API trả về đều xem được bằng F12, nên API chỉ được trả đúng thứ
  màn hình cần hiện — cột nào không hiện thì bỏ từ Apps Script.

- Bí mật nằm ở đâu (không bao giờ đưa vào repo):
    + PUSH_KEY: Cloudflare > Workers & Pages > xtk2-profile > Settings >
      Variables and Secrets (đổi xong phải deploy lại mới có hiệu lực)
    + PUSH_KEY phía Google: Apps Script > Cài đặt dự án > Thuộc tính tập lệnh
      (KHÔNG viết thẳng trong code — code Apps Script lưu trong apps-script/ và
      hay bị dán đi nơi khác)
    + NAP_KEY: khoá của trang nạp Excel (/nap-lieu), đặt cùng chỗ với PUSH_KEY.
      KHÁC PUSH_KEY, dài tối thiểu 16 ký tự (tạo nhanh: F12 -> Console ->
      crypto.randomUUID()). Đưa cho người được phép nạp; đổi khoá = đặt giá trị
      mới rồi deploy lại. Chưa đặt thì trang nạp báo "chưa đặt NAP_KEY".

- Code Apps Script: thư mục apps-script/ (vat-tu.gs...). Sửa ở đó rồi chép đè vào
  Apps Script, để repo luôn biết code nào đang chạy bên Google.
    + Chạy thử Functions ở máy: file .dev.vars (đã có trong .gitignore)

- Cơ sở dữ liệu D1 (xtk2-db, gói Free, không cần thẻ):
    + Schema: migrations/0001_khoi_tao.sql — chuẩn hoá: db/chuan-hoa.mjs
    + Lần đầu:  npm run db:tao        tạo DB ở vùng châu Á (apac)
                npm run db:schema     tạo bảng (chạy migrations/0001..0006 + 0008 + 0009, chạy lại được)
    + Tự cập nhật (giai đoạn 2): mỗi lần Apps Script đẩy, functions/api ghi KV
      như cũ rồi ghi thêm vào D1 — 14 ngày gần nhất + 1 đoạn cũ xoay vòng, tối
      đa 20 phút/lần mỗi dây chuyền (db/dong-bo-d1.mjs). Tình trạng: mục "d1"
      trong /api/trang-thai. Cần binding D1 tên DB trên Pages.
      Lần đẩy Y NGUYÊN lần trước (đa số — bảng tính chỉ đổi vài lần/ngày) đi lối
      tắt: chỉ băm thân, ghi lại KV, không parse, không đồng bộ. CPU đo 04/10/2026:
      lần đẩy có đồng bộ 60–72 ms trên Cloudflare (vượt 10 ms, được châm chước vì
      thưa); lần đẩy y nguyên từ ~45 ms xuống ~6 ms (đo trên máy). Xem CPU thật:
        npx wrangler pages deployment list --project-name xtk2-profile --environment production
        npx wrangler pages deployment tail <mã deployment> --project-name xtk2-profile --format json
      (mỗi request có cpuTime / wallTime).
    + ĐẨY THEO KHỐI-NGÀY (04/10/2026) — thay cho đẩy cả sheet 30 phút/lần:
      file apps-script/khoi-ngay.gs (THÊM vào dự án Apps Script TK3, TK4 — không sửa
      file cũ) đọc sheet qua doGet cũ, tính dấu vân tay MD5 từng khối-ngày, chỉ gửi
      khối-ngày ĐÃ ĐỔI (kể cả ngày cũ bị sửa lùi) tới POST /api/day/<tuyến>
      (db/day-khoi-ngay.mjs). Máy chủ chuẩn hoá bằng đúng chuanHoaDayChuyen, thay
      trọn khối-ngày, ghi dấu cùng giao dịch (migrations/0006). CPU mỗi lượt vài ms.
      Khi đường này chạy: POST /api/tk3 (cả sheet, giờ 4 giờ/lần) chỉ giữ bản KV,
      KHÔNG đồng bộ D1; đường mới ngừng > 6 giờ thì đường cũ tự đồng bộ lại và
      quên hết dấu -> đường mới chạy lại sẽ gửi lại hết cho khớp. db:nap cũng quên
      dấu. Huỷ lần nạp Excel quên dấu các khối-ngày đó -> sheet gửi lại ngay.
      Cài: npm run db:schema -> npm run deploy -> trong MỖI dự án Apps Script thêm
      tệp khoi-ngay (dán apps-script/khoi-ngay.gs) -> chạy kiemTraKhoiNgay ->
      dayKhoiNgay (lần đầu gửi toàn bộ, ~25–35 lượt) -> caiLichKhoiNgay.
      Quay về như cũ: chạy goLichKhoiNgay. Tình trạng: /api/trang-thai, mục khoiNgay
      và d1KhoiNgay.
      Thêm TK1/TK2 sau này: thêm vào TUYEN + TUYEN_DAY_CHUYEN (functions/api),
      DAY_CHUYEN (db/chuan-hoa.mjs), migration nới CHECK day_chuyen của các bảng
      0001/0005.
    + TK1/TK2 TRÊN BIỂU ĐỒ (09/10/2026): 9 biểu đồ tiêu hao (than nhiệt trị, Ccd,
      vôi, dolomite cả 2 trang, điện, quặng chứa sắt, khí than, HLC, hồi nguội) vẽ
      CHUNG 4 dây — cột TK1 xanh ngọc, TK2 hồng (Charts/render/utils.js
      datasetDayThem; Charts/controller/module_configs.js DAY_THEM_VAI_TRO, dayThem). Ô "Dây chuyền":
      cả 4 / 3+4 / 1+2 / từng dây (hienDay). Nhãn số chỉ hiện khi <= 7 ngày (trước
      15). Biểu đồ sản lượng: 2 trang ‹ › — Xưởng TK2 (TK3+TK4) / Xưởng TK1
      (TK1+TK2). KHOAN: hơi nước, biểu đồ chất lượng.
      21/10/2026: trang Xưởng TK1 có đường mục tiêu; các thẻ Kế hoạch / Sản lượng
      đã đạt / Tỉ lệ đạt / Hệ số lợi dụng đổi theo trang ‹ › (nhãn mờ X.TK2 /
      X.TK1 góc phải dưới — Charts/controller/production.js slChiSoTrang, kpiVe). Kế hoạch tháng (ô
      "Kế hoạch tháng" hàng "Sản lượng": TK1 H7, TK2 H8) và giờ dừng (bảng đình
      trệ sự cố + dừng theo kế hoạch, ~hàng 41–62) đọc từ sheet "Báo cáo" của 2
      file (tk12DocBaoCao_), gửi thành cột "Sản lượng kế hoạch" / "Thời gian dừng"
      của khối Sản lượng như TK3 -> công thức hệ số lợi dụng y hệt TK3/TK4 (360 m²).
      10/10/2026: điện có định mức riêng TK1 55, TK2 44 kWh/tsp (Charts/controller/module_configs.js
      DINH_MUC_DAY_THEM; cột vượt nhấp nháy) và tách tầng cột / đường
      (Charts/render/consumption_charts.js tachCotVaDuong); quặng chứa sắt TK1/TK2 vẽ vùng; luỹ kế HLC
      DQ1 nối từ hàng Tổng (file có số từ tối 10/10; trước đó công thức ra 0,00).
      10/10/2026 tối: cột xếp TK1 -> TK4 từ trái qua (xepCotTheoDay), chú giải gom
      theo dây TK1 -> TK4 (chuGiaiTheoDay), bỏ mọi nét đứt — luỹ kế TK1/TK2 nét liền,
      màu khác hẳn đường TK3/TK4 của từng biểu đồ (cfg.mauAcc); trang 2 trợ dung:
      vật liệu phân biệt bằng điểm tròn / tam giác. ĐIỆN tách 2 trang ‹ › theo xưởng
      (chartConfigs.dien.cacTrang; drawElectricTK12Chart), chọn dây tự lật trang
      (trangTheoDay), ô "Loại điện luỹ kế" ẩn ở trang TK1/TK2.
      Luỹ kế TK1/TK2 = hàng TỔNG của file, Apps Script ghi lại cho ca mới nhất mỗi
      lượt (Thuộc tính tập lệnh tk12lk:*). Ca trước khi cài bản đó: dựng lại từ LỊCH
      SỬ PHIÊN BẢN file trên Drive bằng dungLaiLuyKeTK12 (chạy tay một lần, tự chạy
      tiếp tới khi xong; Drive chỉ giữ ~100 bản / 30 ngày — ca không còn bản nào để
      trống, không ước lượng: hàng Tổng KHÁC bình quân gia quyền các ca).
      Riêng luỹ kế HLC DQ1 và hồi nguội: hàng Tổng (đã sửa) = Σ tấn HLC 1,2,3,4 (hồi
      nguội) / Σ TỔNG KL NNL của sheet 3 (khớp cả A/B/C/Tổng hai dây) -> Apps Script
      TÍNH luỹ kế đó, điền cho các ca chưa có số (TK12_KHOI "tinh"; ca đã có số giữ
      nguyên; số tính của ca mới nhất lệch hàng Tổng thì không điền). Dán bản script
      mới: chạy dayLaiTK12 (đẩy lại ngay dù file không đổi).
      15/10/2026: luỹ kế KHÍ THAN chuyển sang hàng TỔNG của sheet 3 (TK2 ô BO = BN/D)
      + tính Σ m3 / Σ sản lượng QTP từng ca (tinh heSo 1). Lý do: từ 10/10 hàng Tổng
      khí than của sheet TH TK2 là #DIV/0! -> đường luỹ kế TK2 chỉ còn 2 điểm 09/10.
    + TK1/TK2 (08–09/10/2026, Apps Script + máy chủ xong): nguồn
      là 2 file .xlsx trên Drive, mỗi file chỉ chứa tháng đang chạy. Dự án Apps
      Script RIÊNG (script.google.com -> Dự án mới; file .xlsx không có menu Tiện ích
      mở rộng) gồm apps-script/tk12-nguon.gs + khoi-ngay.gs: chép tạm file thành
      Google Sheet, đọc sheet 3 "Tiêu hao từng ca" + "TH" theo tên cột, dựng lại các
      khối Sản lượng/THthan/THTD/Điện/QCS/khí than/QH với ĐÚNG tên cột TK3 (cùng mã
      chỉ tiêu, luỹ kế = hàng Tổng của file, ghi theo ca), rồi:
        - D1: gửi khối-ngày đã đổi qua /api/day/tk1|tk2;
        - KV: gửi bản cả bảng qua POST /api/tk1|tk2 -> 'sheet:tk1' (bản nhớ tạm).
          Máy chủ KHÔNG chép bản này sang D1 (TUYEN_CHI_KHOI_NGAY): đồng bộ cũ (cửa
          sổ 14 ngày, xoá ô vắng) chạy đầu tháng sẽ xoá cuối tháng trước.
      Tháng suy từ ngày cuối có sản lượng so với hôm nay; tháng cũ trên máy chủ
      được giữ (KN_GIU_THANG_VANG). Xem: /api/trang-thai mục tk1, tk2; /api/v2/tk1.
      Cài (đúng thứ tự):
        1) npm run db:mo-tk12  — MỘT LẦN: dựng lại so_lieu không CHECK TK3/TK4
           (~55.700 dòng ghi; xoá dấu vân tay -> TK3/TK4 tự gửi lại hết lượt sau)
        2) npm run deploy
        3) Apps Script: xem đầu tk12-nguon.gs (xemThuTK12 -> kiemTraTK12 ->
           dayTK12 -> caiLichTK12).
    + NHÂN SỰ 3 KÍP — NGUỒN RIÊNG, TÁCH HẲN KHỎI TK3 (20/10/2026). Thôi chép tay vào
      các cột 'STT (A)', 'Mã nhân viên (A)'... của tab DATABASE (xoá các cột đó được):
        sheet "Danh sách định biên nhân sự" của xưởng (tab NHÂN SỰ KIP A/B/C)
        -> apps-script/nhan-su.gs — DỰ ÁN APPS SCRIPT RIÊNG (script.google.com),
           mỗi giờ, chỉ lấy HỌ TÊN + VỊ TRÍ (+ "Đang làm việc")
        -> POST /api/nhan-su (db/nhan-su.mjs) -> bảng nhan_su_xuong (migrations/0009)
        -> GET /api/v2/nhan-su -> js/components/personnel.js tự tải, vẽ như cũ.
      Không còn dính TK3: /api/v2/tk3 thôi kèm gói 'nhan-su', bảng nhan_su cũ không
      ai ghi/đọc (NHAN_SU_TU_SHEET = false trong db/chuan-hoa.mjs — đồng bộ cũ,
      khối-ngày, db:nap đều bỏ qua cột nhân sự của tab DATABASE).
      Mã NV, ngày sinh, SĐT, lương, kỷ luật... KHÔNG gửi; máy chủ từ chối gói có
      trường lạ. Bỏ qua: kíp HC (Quản đốc / PQĐ), vị trí chưa có người, người có
      ghi chú NGHỈ VIỆC / THÔI VIỆC ở cột "Ghi chú..." hoặc "Làm việc" (trừ "nghỉ
      việc riêng"; cột "Kỉ luật vi phạm" không xét) — NHAN_SU_RE_NGHI trong nhan-su.gs.
      Chặn đọc nhầm: mỗi kíp >= 5 người; kíp tụt dưới nửa số đang có -> 409 (đúng
      thật thì chạy dayNhanSuBatChap). Gửi lại y nguyên = 0 dòng ghi, ETag không đổi.
      Cài (đúng thứ tự):
        1) npm run db:schema  (thêm bảng nhan_su_xuong; lần đầu chép sẵn danh sách
           đang hiện để trang không trống trong lúc chờ)
        2) npm run deploy
        3) script.google.com -> Dự án mới -> dán apps-script/nhan-su.gs -> Thuộc
           tính tập lệnh NHAN_SU_SHEET = link sheet nhân sự, PUSH_KEY = khoá đẩy
           (KHÔNG ghi link/khoá vào code) -> kiemTraNhanSu -> dayNhanSu -> caiLichNhanSu.
      Tình trạng: /api/trang-thai mục "nhanSu".
    + Dashboard đọc từ D1 (giai đoạn 3.1): /api/v2/tk3, /api/v2/tk4, /api/v2/vattu
      (db/goi-v2.mjs). Gói dựng sẵn theo tháng trong bảng goi_thang, không gửi các
      cột dashboard không dùng (COT_KHONG_GUI). Trình duyệt dựng lại bảng ngang
      (js/api/api_v2.js) nên code biểu đồ không đổi. /api/v2 lỗi thì tự dùng bản KV.
      So hai nguồn: mở trang với ?nguon=kv để ép dùng bản KV cũ.
    + Tải theo tháng (giai đoạn 3.2): trang chỉ xin /api/v2/tk3?tu=<tháng này>
      (10 ngày đầu tháng thì từ tháng trước). Tháng cũ hơn tự xin thêm khi lọc
      lùi ngày, hoặc khi mở khối có số liệu đã ngừng từ lâu — ngày cuối có số
      của từng khối nằm ở bảng moc_khoi (migrations/0004). js/api/api_thang.js.
    + Chỉ số tính sẵn (giai đoạn 3.3): /api/v2/chi-so trả dải chỉ số, 4 thẻ
      Sản lượng, biểu đồ sản lượng tháng, 3 bảng cảnh báo — trang chủ có số ngay.
      Công thức + NGƯỠNG CẢNH BÁO nằm ở js/chung/chi_so.js, dùng chung cho trình
      duyệt và máy chủ (db/chi-so.mjs import chính file đó): sửa một chỗ, deploy.
      Phép tính tốn ~36 ms CPU nên mỗi ETag chỉ TÍNH MỘT LẦN: kết quả được nhớ
      trong isolate + bảng chi_so_nho của D1 (migrations/0008, một dòng), người
      xem sau chỉ đọc lại (~2 ms đo trên máy, 16/10/2026). Chưa có bảng thì vẫn
      chạy đúng, chỉ tính nhiều lần hơn.
      Lượt đẩy cả sheet khi đường khối-ngày đang chạy (chỉ cất KV) không còn
      JSON.parse cả 3 MB: kiểm nhanh đầu/cuối thân + đếm dòng trên byte
      (kiemNhanhMang trong functions/api) — TK3 ~19 -> ~10 ms đo trên máy.
    + Chạy lại db:chuan-bi -> db:nap bất cứ khi nào nghi D1 lệch sheet: file SQL
      tự kèm mọi migration, dựng lại toàn bộ gói /api/v2 và bảng moc_khoi.
    + Nạp số liệu từ file Excel (giai đoạn 4): trang /nap-lieu (menu Chất lượng
      -> "Nạp số liệu từ Excel"). File đọc ngay trên trình duyệt, xem trước rồi
      gửi lên POST /api/nap (db/nap-excel.mjs) — không qua Google Sheet. Số được
      ghi CÙNG mã cột với sheet nên biểu đồ / cảnh báo hiện như số sheet.
        QUY TẮC KHỐI-NGÀY: nạp khối X cho ngày D = thay TOÀN BỘ số của X ngày D;
        từ đó đồng bộ Google Sheet và db:nap bỏ qua (X, D) — bảng ngay_nap,
        migrations/0005. Huỷ một lần nạp (mục 4 trên trang) = xoá số đó, trả
        khối-ngày về cho sheet (số sheet về lại dần, hoặc ngay sau db:nap).
        File nhận được: (1) PHIẾU KẾT QUẢ KIỂM TRA ĐẦU VÀO VÀ SẢN PHẨM xuất
        nguyên từ BK (P.QLCL, "PX TK3 ..."/"PX TK4 ...") — một file ra cả 7 khối
        QTK, QTH, HLC, vôi nung, đo nung, than nghiền, than cốc; khoảng R2 cho
        phép (BK không có) tự lấy theo số đang có trên dashboard. MỖI CA MỘT
        HÀNG: các lần kiểm tra cùng ngày + kíp lấy trung bình cộng. Điểm lấy mẫu:
        QTH chỉ TLM D201C, QTK TLM thành phẩm, vật liệu khác chỉ SILO của dây
        chuyền ("Silo 12", "Silo 15+16" — không lấy Silo NMNL, silo ngầm...).
        Cỡ hạt than: 3 số <1 / 1-3 / >3 vào 3 cột cũ; BK ghi 4 số thì số đầu
        (0,5-1) vào cột "Cỡ hạt 0,5-1mm (than nghiền / than coke)" (máy chủ tự
        tạo cột ở lần nạp đầu). Phiếu là số chuẩn cho cả khoảng ngày của nó:
        ngày khối không có mẫu -> để trống, không giữ số sheet (ngay_trong).
        Cách đổi từng vật liệu sang cột: QUY_TAC_KCS trong js/nap/mau_nap.js.
        (2) "Tải file mẫu" của trang (Ngày | Kíp | các cột của một khối).
        Dạng file mới thêm ở js/nap/mau_nap.js.
        CHỈ GỬI NGÀY MỚI: trước khi nạp, trang hỏi máy chủ các khối-ngày đã nạp
        (GET /api/nap/da-nap) và so với số đang có trên dashboard; ngày đã nạp mà
        y hệt file thì KHÔNG gửi lại (phiếu BK ngày cũ không đổi). Ngày chưa nạp,
        ngày lần trước còn thiếu ca thì vẫn gửi. Cần nhập khoá ở bước 1 trước.
        Mỗi lượt tối đa 10.000 ô (giới hạn 10 ms CPU) — file lớn tự chia theo ngày.
      Biểu đồ ghép TK3 + TK4 theo NGÀY + KÍP (Charts/controller/data_merge.js, ghepTheoNgayKip),
      không theo thứ tự hàng: hai dây khác số hàng mỗi ngày vẫn đúng ngày.
      Cỡ hạt than: biểu đồ CỘT, 3 mốc (<1 / 1-3 / >3mm) hoặc 4 mốc khi phiếu ghi
      thêm 0,5-1. Cảnh báo "Cỡ hạt <0,5mm > 20%" tính <0,5 = <1 − (0,5-1) — chỉ
      ca có phiếu 4 số (js/chung/chi_so.js, CL_CHI_TIEU).
      Lần đầu: đặt NAP_KEY (xem trên) -> npm run db:schema -> npm run deploy.
    + Nạp dữ liệu hiện có từ /api/* vào D1:
                npm run db:chuan-bi   sinh .db-tam/nap-lich-su.sql + chạy thử, đối chiếu
                npm run db:nap        đẩy lên D1
                npm run db:kiem-tra   phải ra đúng bảng mà db:chuan-bi in ở cuối
                                      (cả hai bảng TRỪ các khối-ngày đã nạp Excel)
      Chạy lại được bất cứ lúc nào: ô không đổi thì D1 không ghi lại, không tốn
      hạn mức 100.000 dòng ghi/ngày.
    + Máy công ty: thay "npm run ..." bằng d:\node-v24.15.0-win-x64\npm.cmd run ...

================================================================================
BẢN ĐỒ MÃ NGUỒN — MUỐN HIỂU CODE, ĐỌC THEO THỨ TỰ NÀY
================================================================================
Đầu mỗi file đều có khung chú thích: FILE NÀY LÀM GÌ, AI GỌI, LUỒNG XỬ LÝ, KHI SỬA
CẦN NHỚ GÌ. Bảng dưới chỉ để biết nên mở file nào.

1) DỮ LIỆU ĐI QUA NHỮNG ĐÂU
   Google Sheet --(Apps Script đẩy lên, POST)--> functions/api/[[route]].js
       |- ghi nguyên văn vào KV ............................. (bản dự phòng)
       '- db/dong-bo-d1.mjs + db/chuan-hoa.mjs -> D1 ......... (bản chính)
          rồi dựng sẵn "gói tháng" cho trình duyệt (db/goi-v2.mjs)
   File Excel --(trang nap-lieu.html, POST /api/nap)--> db/nap-excel.mjs -> D1
          (khối-ngày đã nạp Excel thì luồng Google Sheet ở trên bỏ qua)
   Trình duyệt --(GET /api/v2/...)--> nhận gói tháng từ D1
       js/api/api_config.js   bắn cuộc gọi ngay khi mở trang
       js/api/api_v2.js       dựng lại "bảng ngang" y như Google Sheet
       js/api/api_loaded.js   đổ vào window.masterSheetDataTK3 / TK4, bắn sự kiện
                              TK3DataReady / TK4DataReady
       các file vẽ (biểu đồ, cảnh báo, nhân sự...) nghe sự kiện rồi vẽ

2) PHÍA MÁY CHỦ (chạy trên Cloudflare)
   functions/api/[[route]].js  cổng API: nhận dữ liệu, trả dữ liệu, /api/trang-thai
   db/chuan-hoa.mjs            bảng tính ngang -> các dòng dọc cho D1
   db/dong-bo-d1.mjs           chép phần mới của mỗi lần đẩy sang D1
   db/goi-v2.mjs               gói tháng: dựng (lúc đồng bộ) và đọc (cho /api/v2)
   db/chi-so.mjs               /api/v2/chi-so: số liệu trang chủ tính sẵn
   db/nap-excel.mjs            /api/nap: ghi số nạp từ Excel, huỷ, danh sách
   db/day-khoi-ngay.mjs        /api/day/<tuyến>: Apps Script đẩy các khối-ngày đã đổi
   db/nhan-su.mjs              /api/nhan-su (ghi) + /api/v2/nhan-su (đọc): nhân sự 3 kíp
   apps-script/nhan-su.gs      dự án Apps Script RIÊNG: đọc sheet nhân sự của xưởng -> /api/nhan-su
   apps-script/khoi-ngay.gs    phía Apps Script của đường đó (thêm vào dự án TK3/TK4)
   apps-script/tk12-nguon.gs   dự án Apps Script riêng TK1/TK2: đọc 2 file .xlsx -> khoi-ngay.gs
   migrations/0001..0006       cấu trúc các bảng D1 (đọc 0001 trước) — npm run db:schema
   migrations/0007_tk12.sql    chạy MỘT lần (npm run db:mo-tk12): so_lieu nhận TK1/TK2
   migrations/0008_chi_so_nho.sql  bảng nhớ kết quả /api/v2/chi-so (trong db:schema)
   migrations/0009_nhan_su_xuong.sql  bảng nhân sự riêng của xưởng (trong db:schema)

3) PHÍA TRÌNH DUYỆT
   index.html                  trang duy nhất — đầu file có bản đồ các mục
   js/api/                     tải dữ liệu (4 file — đọc đầu api_config.js trước)
   js/chung/chi_so.js          CÔNG THỨC + NGƯỠNG CẢNH BÁO (dùng chung với máy chủ)
   js/components/Charts/
       render/                 các hàm VẼ biểu đồ — 7 file, mở render/setup.js trước
                               (trước 24/10/2026 là một file chart_core.js)
       controller/             chọn số liệu, điều phối, bộ lọc, lật trang, dải chỉ
                               số, mục Sản lượng — 8 file, mở
                               controller/module_configs.js trước: có cách THÊM
                               MỘT BIỂU ĐỒ MỚI
                               (trước 24/10/2026 là một file chart_cook.js)
       canhbao.js              bảng nhận xét / cảnh báo
       vattu.js                ba mục vật tư
       Các file trong render/ và controller/ là SCRIPT THƯỜNG (không import /
       export): hàm của file này gọi thẳng được ở file khác, nên THỨ TỰ thẻ
       <script> trong index.html là thứ tự bắt buộc. Thêm / bớt file thì sửa
       danh sách thẻ đó.
   js/components/personnel.js  sơ đồ tổ chức 3 kíp
   js/components/nav_fit.js    thanh menu tự co giãn
   js/components/sidebar.js    menu bên, mở khối biểu đồ
   js/api/api_thang.js         tải thêm tháng cũ khi lọc lùi ngày / mở khối cũ
   js/main/main.js             khởi động trang, làm mới mỗi 15 phút
   nap-lieu.html + js/nap/     trang nạp Excel (trang riêng, gói riêng):
       nap_lieu.js (điều khiển) -> doc_xlsx.js (đọc .xlsx, không thư viện ngoài)
       -> mau_nap.js (dạng file -> các ô gửi lên); ghi_xlsx.js tạo file mẫu
   js/components/SinteringDiagram/   sơ đồ công nghệ (React + Pixi, MODULE có
                               import / export) — đầu pixiStage.jsx có bản đồ đủ file
       DiagramApp.jsx          điểm vào: chỉ tải sơ đồ khi người xem mở tới
       pixiStage.jsx           sân khấu Pixi + camera + pop-up + nút điều khiển
       stageConfig.js          CFG: toạ độ, kích thước mọi thiết bị
       layout.js               buildLayout(): từ CFG tính toạ độ chi tiết
       assembly/               ghép thiết bị thành từng khu (8 file)
       diagramContainer.jsx    MỤC LỤC thiết bị -> mã ở equipment/ (25 file,
                               mỗi file một nhóm: băng tải, máy trộn, lò cao...)
       hotspotData.js          NỘI DUNG pop-up: tên, mô tả, thông số, ảnh / video
       diagramHotspots.jsx     giao diện pop-up, bắt chuột, bảng danh mục
       (trước 24/10/2026 chỉ có pixiStage / diagramContainer / diagramHotspots,
       mỗi file vài nghìn dòng)
   css/                        giao diện — đầu mỗi file ghi rõ dùng cho phần nào

4) CÔNG CỤ
   scripts/nap-lich-su.mjs     nạp lại toàn bộ lịch sử vào D1 (npm run db:chuan-bi)
   vite.config.js              build hai trang: gộp + thu nhỏ script, chép thư mục ảnh

5) FILE KHÔNG CÒN DÙNG
   Đã xoá 24/10/2026 (xem lại được trong lịch sử git): js/components/stats_ribbon.js,
   js/sections/FlowDiagram.jsx, js/components/SinteringDiagram/diagramStore.jsx.
   Còn lại một component cũ không dùng: CoalCrusherPlaceholder
   (SinteringDiagram/equipment/blendingSilos.jsx).

6) MUỐN SỬA NHANH
   Ngưỡng cảnh báo, công thức hệ số lợi dụng ....... js/chung/chi_so.js
   Tên cột bảng tính của một biểu đồ ................ Charts/controller/module_configs.js (col..., moduleConfigs)
   Biểu đồ nhiều trang (mũi tên ‹ › vôi, dolomite) .. Charts/controller/chart_configs.js (chartConfigs[...].cacTrang)
   Màu, chú giải, tuỳ chọn chung của biểu đồ ........ Charts/render/utils.js
   Quy tắc xếp nhân sự vào nhóm ..................... personnel.js (NHOM_RULES)
   Cách gọt / thống nhất tên vị trí nhân sự ......... apps-script/nhan-su.gs (nhanSuViTri_)
   Cột không gửi ra trình duyệt ..................... db/goi-v2.mjs (COT_KHONG_GUI)
   Vị trí / kích thước trong sơ đồ công nghệ ........ SinteringDiagram/stageConfig.js (CFG)
   Hình dáng / hoạt ảnh một thiết bị trong sơ đồ .... SinteringDiagram/diagramContainer.jsx
                                                      (mục lục) -> file trong equipment/
   Ảnh / video / thông số pop-up của sơ đồ .......... SinteringDiagram/hotspotData.js (HOTSPOT_DEFS)
   Thêm một dạng file Excel để nạp ................. js/nap/mau_nap.js (CAC_MAU)
   Phiếu BK: vật liệu nào vào khối / cột nào ........ js/nap/mau_nap.js (QUY_TAC_KCS)

7) TỪ NGỮ HAY GẶP TRONG CODE
   tuyến       một luồng dữ liệu: tk3, tk4 (hai dây chuyền thiêu kết), vattu (vật tư)
   khối        trong sheet: nhóm cột chung cặp "Thời gian (X)" | "Ca/kíp (X)";
               trên trang: "khối biểu đồ" = nhóm biểu đồ mở từ menu bên
   chỉ tiêu    một cột số liệu, mã kiểu 'dien.dien_nang'
   kíp / ca / stt   nhóm trực A-B-C / số thứ tự ca trong ngày / thứ tự hàng trong ngày
   gói tháng   số liệu một tháng đóng sẵn thành JSON trong D1 (bảng goi_thang)
   vân tay, ETag    chuỗi ngắn đại diện cho dữ liệu — dữ liệu đổi thì chuỗi đổi
   bản nhớ     bản sao số liệu trong localStorage của máy người xem
   KV, D1      hai kho của Cloudflare: KV = ô nhớ nguyên văn, D1 = cơ sở dữ liệu SQL
   khối-ngày   (khối, ngày) đã nạp từ Excel — sheet không ghi đè (bảng ngay_nap)
