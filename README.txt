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
                npm run db:schema     tạo bảng (chạy mọi migrations/0001..0005, chạy lại được)
    + Tự cập nhật (giai đoạn 2): mỗi lần Apps Script đẩy, functions/api ghi KV
      như cũ rồi ghi thêm vào D1 — 14 ngày gần nhất + 1 đoạn cũ xoay vòng, tối
      đa 20 phút/lần mỗi dây chuyền (db/dong-bo-d1.mjs). Tình trạng: mục "d1"
      trong /api/trang-thai. Cần binding D1 tên DB trên Pages.
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
        Chưa có file KCS thật: trang có "Tải file mẫu" (Ngày | Kíp | các cột của
        khối). Dạng file mới thêm ở js/nap/mau_nap.js.
        Mỗi lượt tối đa 10.000 ô (giới hạn 10 ms CPU) — file lớn tự chia theo ngày.
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
   migrations/0001..0005       cấu trúc các bảng D1 (đọc 0001 trước)

3) PHÍA TRÌNH DUYỆT
   index.html                  trang duy nhất — đầu file có bản đồ các mục
   js/api/                     tải dữ liệu (4 file — đọc đầu api_config.js trước)
   js/chung/chi_so.js          CÔNG THỨC + NGƯỠNG CẢNH BÁO (dùng chung với máy chủ)
   js/components/Charts/
       chart_core.js           các hàm vẽ biểu đồ
       chart_cook.js           chọn số liệu, điều phối, bộ lọc — kèm cách THÊM
                               MỘT BIỂU ĐỒ MỚI (đầu file)
       canhbao.js              bảng nhận xét / cảnh báo
       vattu.js                ba mục vật tư
   js/components/personnel.js  sơ đồ tổ chức 3 kíp
   js/components/nav_fit.js    thanh menu tự co giãn
   js/components/sidebar.js    menu bên, mở khối biểu đồ
   js/api/api_thang.js         tải thêm tháng cũ khi lọc lùi ngày / mở khối cũ
   js/main/main.js             khởi động trang, làm mới mỗi 15 phút
   nap-lieu.html + js/nap/     trang nạp Excel (trang riêng, gói riêng):
       nap_lieu.js (điều khiển) -> doc_xlsx.js (đọc .xlsx, không thư viện ngoài)
       -> mau_nap.js (dạng file -> các ô gửi lên); ghi_xlsx.js tạo file mẫu
   js/components/SinteringDiagram/   sơ đồ công nghệ (React + Pixi)
       DiagramApp.jsx (điểm vào) -> pixiStage.jsx (lắp ráp, toạ độ)
       -> diagramContainer.jsx (từng thiết bị) + diagramHotspots.jsx (pop-up)
   css/                        giao diện — đầu mỗi file ghi rõ dùng cho phần nào

4) CÔNG CỤ
   scripts/nap-lich-su.mjs     nạp lại toàn bộ lịch sử vào D1 (npm run db:chuan-bi)
   vite.config.js              build hai trang: gộp + thu nhỏ script, chép thư mục ảnh

5) FILE KHÔNG CÒN DÙNG (giữ để tham khảo, xoá được)
   js/components/stats_ribbon.js, js/sections/FlowDiagram.jsx,
   js/components/SinteringDiagram/diagramStore.jsx (rỗng)

6) MUỐN SỬA NHANH
   Ngưỡng cảnh báo, công thức hệ số lợi dụng ....... js/chung/chi_so.js
   Tên cột bảng tính của một biểu đồ ................ chart_cook.js (col..., moduleConfigs)
   Quy tắc xếp nhân sự vào nhóm ..................... personnel.js (NHOM_RULES)
   Cột không gửi ra trình duyệt ..................... db/goi-v2.mjs (COT_KHONG_GUI)
   Vị trí / kích thước trong sơ đồ công nghệ ........ pixiStage.jsx (CFG)
   Ảnh / video / thông số pop-up của sơ đồ .......... diagramHotspots.jsx (HOTSPOT_DEFS)
   Thêm một dạng file Excel để nạp (vd báo cáo KCS) .. js/nap/mau_nap.js (CAC_MAU)

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
