# Tài liệu kỹ thuật: Dashboard Xưởng Thiêu Kết 2

Oct 5, 2026 · @Tùng

## Bối cảnh và ràng buộc

Dashboard Xưởng Thiêu kết 2 (dây chuyền TK3, TK4) là một trang web công khai hiển thị sản lượng, chất lượng, cảnh báo, vật tư, nhân sự và sơ đồ công nghệ. Nó do một người xây và vận hành, không có quyền vào SCADA hay máy chủ của công ty. Mọi lựa chọn kỹ thuật trong tài liệu này xuất phát từ sáu ràng buộc dưới đây.

| Ràng buộc | Thực tế | Hệ quả thiết kế |
| --- | --- | --- |
| Không có quyền lấy dữ liệu SCADA | Số liệu vận hành thật nằm trong SCADA; IT không cấp API, OPC hay tài khoản đọc cơ sở dữ liệu | Nguồn là bảng tính do người nhập (Google Sheet) và file Excel xuất tay; dashboard chấp nhận độ trễ theo ca, không thời gian thực |
| Máy tính công ty bị khoá | Không cài phần mềm, không chạy dịch vụ nền; chỉ có Node bản portable ở `d:\node-v24.15.0-win-x64` | Không có máy chủ riêng; xử lý chạy trên trình duyệt hoặc trên cloud; deploy bằng wrangler từ Node portable |
| Phần mềm phòng thí nghiệm BK chỉ xuất Excel | Không có API, không tự động hoá được | Trang `/nap-lieu` đọc .xlsx ngay trên trình duyệt, không cần cài gì |
| Không có thẻ thanh toán | Chỉ dùng được gói Cloudflare Free | 10 ms CPU mỗi request, 100.000 request/ngày, D1 100.000 dòng ghi/ngày, 50 truy vấn D1 mỗi lần gọi; không có Access, Workers Paid, R2 |
| Dashboard phải công khai | Ai có link cũng xem được; link chỉ lưu hành nội bộ | Không bắt người xem đăng nhập; thứ được bảo vệ là NGUỒN (Sheet, link Apps Script), quyền GHI (`PUSH_KEY`, `NAP_KEY`) và API chỉ trả đúng cột màn hình cần |
| Một người làm toàn bộ | Không có đội backend, không có người trực | Dùng dịch vụ được quản lý thay vì tự vận hành máy chủ; hệ thống tự đồng bộ, tự lùi về bản dự phòng khi một nhánh lỗi |

Nguồn dữ liệu hiện có: ba Google Sheet (TK3, TK4, vật tư), mỗi sheet có một dự án Apps Script đẩy dữ liệu lên Cloudflare, cộng phiếu kết quả kiểm tra (KCS) xuất từ BK. Riêng sheet TK3 có 1.084 hàng × 104 cột, 77% ô trống, gồm khoảng 14 khối cột nằm cạnh nhau. Ngày 04/10/2026, D1 giữ 44.481 giá trị (4,19 MB) cho hai dây chuyền.

Mục tiêu của hệ thống: mở link là có số ngay; số trên trang khớp từng ô với nguồn; người nhập liệu không phải đổi thói quen; chi phí hạ tầng bằng 0.

## 1. Kiến trúc tổng quan

Hệ thống là một ứng dụng serverless chạy trọn trên Cloudflare gói Free: trang tĩnh trên Pages, một Function duy nhất làm cổng API, D1 (SQLite) là kho chính và KV là bản dự phòng. Dữ liệu không được kéo từ nguồn; nguồn tự đẩy lên (Apps Script) hoặc người dùng tự nạp (Excel). Không có máy chủ nào cần bật, vá, sao lưu hay trực.

&#91;embedded content: Sơ đồ hạ tầng · 3 nguồn, 2 đường thu thập, 1 cổng API\]

Mũi tên chỉ chiều dữ liệu đi. Không thành phần nào trên Cloudflare gọi ngược vào mạng công ty; SCADA hiện không có đường nối nào vào hệ thống.

### Tech stack

| Tầng | Công nghệ | Vai trò |
| --- | --- | --- |
| Nguồn dữ liệu | Google Sheets (TK3, TK4, vật tư); phiếu KCS xuất từ BK (.xlsx) | Nơi người vận hành nhập số theo ca; nơi phòng QLCL xuất kết quả mẫu |
| Thu thập | Google Apps Script (trigger theo giờ) | Đọc sheet, tính MD5 từng khối-ngày, đẩy phần đã đổi lên `/api/day/<tuyến>`; đẩy cả sheet lên `/api/<tuyến>` mỗi 4 giờ |
| Thu thập | Trang `/nap-lieu` (JS thuần, trình đọc .xlsx tự viết dùng `DecompressionStream`) | Đọc phiếu BK ngay trên trình duyệt, xem trước, gửi các ô lên `/api/nap` |
| API | Cloudflare Pages Functions — một file `functions/api/[[route]].js` bắt mọi `/api/*` | Kiểm khoá, chuẩn hoá, ghi D1/KV, trả gói tháng, tính sẵn chỉ số, báo tình trạng |
| Lưu trữ chính | Cloudflare D1 `xtk2-db`, vùng apac | Bảng dọc `so_lieu`, danh mục `chi_tieu`, gói tháng `goi_thang`, sổ đồng bộ và vân tay |
| Lưu trữ dự phòng | Cloudflare KV `SHEET_KV` | Nguyên văn lần đẩy cả sheet gần nhất, lỗi gần nhất, nhịp đẩy khối-ngày |
| Giao diện | HTML + JS thuần (script toàn cục, giao tiếp bằng `CustomEvent`) | Trang chủ, khối biểu đồ, cảnh báo, nhân sự, vật tư |
| Biểu đồ | Chart.js 4.5.1 + chartjs-plugin-datalabels (CDN jsDelivr) | Vẽ biểu đồ đường, cột, phân bố |
| Sơ đồ công nghệ | React 18 + Pixi.js 7 + pixi-viewport | Sơ đồ dây chuyền thiêu kết có phóng to, kéo, pop-up thiết bị |
| Build | Vite 8 + plugin tự viết `goiScriptThuong` | Gộp, thu nhỏ, gắn mã băm tên file; build hai trang `index.html`, `nap-lieu.html` |
| Deploy | Wrangler CLI từ Node portable | `vite build` rồi `wrangler pages deploy dist --branch production`; lệnh `db:*` chạy migration và nạp lịch sử vào D1 |

D1 và KV không có đường vào công khai: chỉ Function của chính dự án đọc được qua binding `DB` và `SHEET_KV`. Bí mật (`PUSH_KEY`, `NAP_KEY`) nằm trong Variables and Secrets của Cloudflare và Script Properties của Apps Script, không bao giờ trong repo.

## 2. Architecture Decision Records

Tám quyết định dưới đây định hình hệ thống; mỗi quyết định đổi một giới hạn cụ thể (CPU, hạn mức, quyền truy cập) lấy một độ phức tạp có kiểm soát. Thứ tự theo lịch sử dự án: trình duyệt gọi thẳng Apps Script → Apps Script đẩy vào KV → D1 (giai đoạn 1–3) → nạp Excel (giai đoạn 4) → đẩy theo khối-ngày.

| Mã | Quyết định | Thay cho |
| --- | --- | --- |
| ADR-01 | Serverless trên Cloudflare Pages + Functions, gói Free | Máy chủ nội bộ, VPS, Apps Script web app làm backend |
| ADR-02 | Nguồn tự đẩy (push) bằng Apps Script + `PUSH_KEY` | Trình duyệt hoặc máy chủ kéo (pull) từ link `/exec` |
| ADR-03 | D1 là kho chính, bảng dọc; KV chỉ còn là bản dự phòng | Lưu nguyên cả sheet 2–3 MB trong KV |
| ADR-04 | Gói tháng dựng sẵn + chỉ số trang chủ tính sẵn | Truy vấn `so_lieu` mỗi lượt xem; trình duyệt tự tính hết |
| ADR-05 | Đẩy theo khối-ngày có vân tay MD5 | Đẩy cả sheet mỗi 30 phút rồi chuẩn hoá trên Function |
| ADR-06 | Nạp Excel ngay trên trình duyệt, quy tắc “khối-ngày thuộc về Excel” | Chép tay Excel vào Google Sheet; script chạy trên máy |
| ADR-07 | Giao diện JS thuần + biến toàn cục + `CustomEvent`; React chỉ cho sơ đồ | Viết lại toàn bộ bằng React/Vue |
| ADR-08 | Dashboard công khai; bảo vệ nguồn và quyền ghi, không chặn người xem | Đăng nhập / Cloudflare Access cho người xem |

### ADR-01 — Serverless trên Cloudflare gói Free

**Bối cảnh.** Không có máy chủ trong nhà máy dành cho dự án, máy công ty không chạy được dịch vụ nền, không có thẻ để thuê VPS hay gói trả phí. Bản đầu tiên cho trình duyệt gọi thẳng link `/exec` của Apps Script: TK3 có lúc mất 114 giây mới về, và link đó trả toàn bộ 2,1 MB dữ liệu cho bất kỳ ai không cần đăng nhập.

**Quyết định.** Trang tĩnh trên Cloudflare Pages; một Pages Function `functions/api/[[route]].js` là backend duy nhất; D1 + KV qua binding. Deploy bằng `npm run deploy`.

**Điểm mạnh**

- Chi phí 0 đồng, không cần thẻ; không có hệ điều hành nào để vá, không có tiến trình nào để trực.
- Chạy tại điểm biên gần người xem (PoP Singapore): đo 01/10/2026, API trả byte đầu tiên sau 0,3–0,45 giây, trang tĩnh 0,2 giây.
- Bí mật nằm phía máy chủ; trình duyệt chỉ biết `/api/...` cùng tên miền.
- File tĩnh gắn mã băm, cache 1 năm (`public/_headers`); request tĩnh không tính vào hạn mức Function.
- Một lệnh deploy từ Node portable, hợp với máy bị khoá.

**Hạn chế**

- 10 ms CPU mỗi request. Lần đẩy cả sheet có đồng bộ đo được 60–72 ms (04/10/2026): Cloudflare đang châm chước vì thưa, nhưng không có cam kết.
- 100.000 request Function/ngày; D1 tối đa 50 truy vấn mỗi lần gọi, 500 MB mỗi cơ sở dữ liệu; KV 1.000 lần ghi/ngày.
- Pages Functions không có Cron Trigger, nên chưa có cảnh báo tự động khi nguồn ngừng đẩy.
- Không có Access, WAF trên `*.pages.dev`; gắn chặt vào Cloudflare (D1 là SQLite nên dữ liệu vẫn xuất ra được bằng `wrangler d1 export`).

### ADR-02 — Nguồn tự đẩy dữ liệu lên

**Bối cảnh.** Google Sheet phải ở chế độ Restricted. Muốn Cloudflare kéo dữ liệu thì hoặc lộ link `/exec`, hoặc đặt thông tin đăng nhập Google lên Cloudflare.

**Quyết định.** Apps Script chạy theo trigger, tự POST lên `/api/<tuyến>` (và `/api/day/<tuyến>`) kèm header `x-push-key`. Các bản triển khai web app `/exec` được lưu trữ hoặc bắt đăng nhập.

**Điểm mạnh**

- Nguồn không bao giờ lộ ra ngoài; Cloudflare không giữ quyền Google nào.
- Việc nặng (đọc cả sheet, so sánh, băm MD5) chạy trên hạn mức của Google, không phải trên 10 ms của Function.
- Sai khoá → 401, dữ liệu sai dạng → từ chối và ghi lý do vào KV `loi:<tuyến>`, hiện ở `/api/trang-thai`.

**Hạn chế**

- Độ tươi phụ thuộc trigger: tuyến vật tư đã đứng từ 27/08 đến 30/09/2026 mà dashboard không báo gì cho người xem.
- Trễ bằng chu kỳ trigger (30 phút với đường khối-ngày), không phải thời gian thực.
- Apps Script bị giới hạn thời gian chạy mỗi lần và mỗi ngày theo loại tài khoản Google.
- Mã Apps Script sống trong dự án Google; repo chỉ biết khi chép vào `apps-script/`.

### ADR-03 — D1 là kho chính, lưu dạng bảng dọc

**Bối cảnh.** KV chỉ giữ nguyên văn một chuỗi JSON 2–3 MB mỗi tuyến: không truy vấn được, trình duyệt phải tải và parse 3,2 MB, 77% ô trống, sheet thêm cột là mọi thứ lệch theo.

**Quyết định.** Bảng `so_lieu` mỗi ô có số là một dòng, khoá chính `(chi_tieu, day_chuyen, ngay, stt)`, `WITHOUT ROWID`, không có chỉ mục phụ. Danh mục `chi_tieu` sinh mã từ tên khối + tên cột (`dien.dien_nang`). KV vẫn được ghi để làm đường lui; `?nguon=kv` ép trang dùng KV để so hai nguồn.

**Điểm mạnh**

- Chỉ tốn chỗ cho ô có số: 44.481 giá trị = 4,19 MB cho hai dây chuyền (04/10/2026).
- Sheet thêm cột chỉ sinh thêm một dòng `chi_tieu`, không sửa cấu trúc bảng.
- Không có chỉ mục phụ nên mỗi ô ghi chỉ tốn một dòng hạn mức; khoá chính đã lọc được theo chỉ tiêu + khoảng ngày.
- Ô không đổi thì không ghi lại (`cap_nhat` chỉ đổi khi giá trị đổi); D1 Time Travel giữ 7 ngày để khôi phục.
- Trình duyệt chỉ còn parse khoảng 400 KB thay vì 3,2 MB.

**Hạn chế**

- Hai kho phải giữ khớp; cần bộ chuẩn hoá 546 dòng (`db/chuan-hoa.mjs`) để hiểu sheet ngang 14 khối, số kiểu `"85,48"`, `"5,854.00"`.
- Mã chỉ tiêu sinh từ tên cột: đổi tên cột trong sheet là ra chỉ tiêu mới; thêm xưởng khác có thể trùng mã.
- `CHECK (day_chuyen IN ('TK3','TK4'))` ở các bảng 0001/0005 phải nới khi thêm dây chuyền.

### ADR-04 — Gói tháng dựng sẵn và chỉ số tính sẵn

**Bối cảnh.** Nếu mỗi lượt mở trang đọc thẳng `so_lieu` (\~15.000 dòng), vài trăm lượt xem là cạn 5 triệu dòng đọc/ngày; dựng JSON trong Function thì vượt 10 ms.

**Quyết định.** Lúc đồng bộ, SQLite tự dựng JSON từng tháng (`json_group_array`) vào bảng `goi_thang`, ô gọn dạng `[cột, ngày, stt, kíp, giá trị]`. `/api/v2/tk3?tu=&den=` chỉ nối chuỗi, kèm ETag để trả 304. Trang tải tháng của (hôm nay − 10 ngày); tháng cũ tải khi lọc lùi hoặc mở khối đã ngừng (bảng `moc_khoi`). `/api/v2/chi-so` trả \~4 KB số trang chủ, tính bằng chính file `js/chung/chi_so.js` mà trình duyệt dùng.

**Điểm mạnh**

- Mỗi lượt xem chỉ đọc vài dòng; `/api/v2/tk3` đo 10–13 ms CPU, Brotli còn 73 KB (KV: 91 KB).
- Công thức và ngưỡng cảnh báo nằm một chỗ, dùng chung cho máy chủ và trình duyệt; đã đối chiếu khớp trên 188 ngày.
- Trình duyệt dựng lại đúng “bảng ngang” cũ (`api_v2.js`), nên code biểu đồ không phải sửa.

**Hạn chế**

- Ghi khuếch đại: một ô đổi là dựng lại cả gói tháng đó.
- Danh mục cột đổi thì mọi gói thành cũ (API trả 503 cho đến khi dựng lại xong); sau khoảng 3 năm, dựng lại toàn bộ có thể vượt 50 truy vấn/lần gọi.
- `/api/v2/chi-so` là request nặng nhất của người xem: 23–39 ms CPU.

### ADR-05 — Đẩy theo khối-ngày có vân tay

**Bối cảnh.** Đường cũ gửi cả sheet 2–3 MB mỗi 30–60 phút; trong khoảng 200–250 lần đẩy mỗi ngày (tính cả tuyến vật tư), chỉ 6–15 lần thật sự có số đổi. Mỗi lần có đổi tốn 60–72 ms CPU để parse và chuẩn hoá.

**Quyết định.** Tệp `apps-script/khoi-ngay.gs` (thêm vào dự án Apps Script, không sửa tệp cũ) tính MD5 cho từng (khối, ngày) và (khối, tháng). Bước `so-sanh` gửi \~130 dấu tháng; máy chủ trả các tháng lệch. Bước `ghi` gửi trọn các khối-ngày lệch; máy chủ chuẩn hoá bằng đúng `chuanHoaDayChuyen`, thay trọn khối-ngày và ghi dấu trong cùng một `db.batch`. Đường cũ còn chạy 4 giờ/lần, chỉ ghi KV; nếu đường mới im quá 6 giờ, đường cũ tự đồng bộ D1 lại và xoá hết dấu.

**Điểm mạnh**

- CPU mỗi lượt: so sánh \~1 ms, ghi trung vị 2,8 ms (đo trên máy) — nằm trong 10 ms.
- Bắt được cả sửa lùi ngày cũ, xoá hàng, dời ngày — điều mà cách “chỉ gửi ca trước” bỏ sót.
- Số và dấu ghi chung giao dịch nên không bao giờ lệch nhau; lỗi thì Apps Script gửi lại lượt sau.
- Tự chữa: bất kỳ đường nào khác ghi số sheet thì quên dấu, lượt sau gửi lại hết cho khớp.

**Hạn chế**

- Hai đường ghi cùng tồn tại với luật chuyển giao theo thời gian: khó hiểu với người mới.
- Apps Script phải chia khối giống hệt máy chủ; lệch nhau thì cả lượt bị từ chối.
- Vẫn phụ thuộc doGet cũ đọc cả sheet mỗi 30 phút, tốn thời gian chạy của Apps Script.

### ADR-06 — Nạp Excel ngay trên trình duyệt

**Bối cảnh.** BK chỉ xuất Excel; các khối chất lượng trên sheet TK3 ngừng từ 25/08, TK4 từ tháng 6–7; máy công ty không cài được công cụ. Chép tay sang sheet từng gây lỗi thật (cột “%CaO (QTH)” chứa giá trị Al2O3 từ tháng 5).

**Quyết định.** Trang `/nap-lieu` đọc .xlsx bằng trình đọc tự viết (không dùng SheetJS), đổi phiếu BK sang ô theo `QUY_TAC_KCS`, mỗi ca một hàng (trung bình các lần thử cùng ngày + kíp), gửi lên `/api/nap` với `NAP_KEY`. Quy tắc khối-ngày: nạp khối X ngày D là thay toàn bộ X ngày D, và từ đó sheet không ghi đè (bảng `ngay_nap`).

**Điểm mạnh**

- Không cài gì, chỉ cần trình duyệt; file không rời máy người nạp cho đến lúc gửi các ô đã lọc.
- Ghi cùng mã chỉ tiêu với sheet: biểu đồ, cảnh báo, dải chỉ số dùng ngay, không sửa gì.
- Huỷ được từng lần nạp; chỉ gửi ngày mới hoặc ngày khác với D1 (`GET /api/nap/da-nap`).
- Thêm dạng file mới = thêm một mục trong `CAC_MAU` (`js/nap/mau_nap.js`).

**Hạn chế**

- Vẫn còn một bước tay: ai đó phải xuất phiếu từ BK và kéo vào trang.
- BK đổi mẫu phiếu là bộ chuyển đổi hỏng.
- `NAP_KEY` dùng chung; tên người nạp tự khai, không xác thực.
- Tối đa 10.000 ô mỗi request (giới hạn CPU); trang tự chia file lớn theo ngày.

### ADR-07 — Giao diện JS thuần, giao tiếp bằng sự kiện

**Bối cảnh.** Giao diện có trước khi có D1, viết bằng script thường đọc “bảng ngang” giống Google Sheet. Viết lại bằng framework là rủi ro lớn cho một người.

**Quyết định.** Giữ JS thuần: dữ liệu nằm ở `window.masterSheetDataTK3/TK4/VATTU`, các mô-đun nghe `TK3DataReady`, `TK4DataReady`, `VATTUDataReady`, `ChiSoReady`. Chỉ sơ đồ công nghệ dùng React + Pixi (cần canvas WebGL). Vite gộp và thu nhỏ lúc build; `npm run dev` chạy nguyên file gốc.

**Điểm mạnh**

- Không có bước biên dịch khi phát triển; sửa một file là thấy ngay.
- Đổi nguồn KV → D1 không phải sửa biểu đồ nào, vì API v2 dựng lại đúng định dạng cũ.
- Hai dây chuyền độc lập: dây nào về trước vẽ trước.

**Hạn chế**

- Biến toàn cục và thứ tự thẻ `<script>` là ràng buộc ngầm; tên hàm cấp ngoài cùng không được thu nhỏ.
- File lớn khó kiểm thử: `chart_cook.js` 1.617 dòng, `diagramContainer.jsx` 4.773 dòng. (Đã tách thành nhiều file nhỏ ngày 24/10/2026 — xem mục 4.)
- “Bảng ngang” kiểu sheet bị giữ lại ở trình duyệt chỉ để tương thích, tốn thêm một bước dựng lại.

### ADR-08 — Công khai cho người xem, khoá nguồn và quyền ghi

**Bối cảnh.** Link dashboard được chia trong nội bộ xưởng; bắt đăng nhập thì phải quản lý tài khoản và cần gói trả phí. Một cổng đăng nhập đã được làm thử rồi gỡ bỏ.

**Quyết định.** Không đăng nhập cho người xem. Ghi cần `PUSH_KEY` / `NAP_KEY`, so sánh thời gian hằng (`khoaDung`). GET dữ liệu chỉ trả khi `Sec-Fetch-Site` là same-origin (`goiTuTrangNha`). API chỉ trả cột màn hình dùng (`COT_KHONG_GUI`). Mã nguồn được thu nhỏ khi build.

**Điểm mạnh**

- Người vận hành mở link là xem, không có tài khoản nào phải cấp hay thu hồi.
- Hai khoá tách biệt: người nạp Excel không có quyền đẩy của Apps Script.
- Nguồn (Sheet, link Apps Script, D1) không có đường vào trực tiếp.

**Hạn chế**

- Mọi số hiện trên màn hình đều lấy được bằng F12; kiểm tra same-origin là rào chắn người tò mò, không phải khoá.
- Link bị chuyển ra ngoài là người ngoài xem được, kể cả mã nhân viên trên sơ đồ tổ chức.
- Không biết ai đã xem; không phân quyền theo vai trò.

## 3. Luồng hệ thống

Hệ thống có ba luồng nghiệp vụ chính: hai luồng ghi (Apps Script đẩy khối-ngày, người dùng nạp Excel) và một luồng đọc (mở trang, tải dữ liệu, vẽ biểu đồ). Hai luồng ghi gặp nhau ở quy tắc khối-ngày: khối-ngày đã nạp Excel thì số từ sheet bị bỏ qua.

### 3.1 Thu thập: Apps Script đẩy khối-ngày

&#91;embedded content: Sequence diagram · đẩy khối-ngày, 2 bước so-sanh / ghi\]

Lượt không có gì đổi chỉ có bước so sánh (\~1 ms CPU). Mỗi lượt ghi tối đa 1.000 ô để Function nằm trong 10 ms. Đường đẩy cả sheet vẫn chạy 4 giờ/lần nhưng chỉ ghi KV; nếu đường khối-ngày im quá 6 giờ, nó tự đồng bộ D1 thay.

### 3.2 Nạp phiếu BK từ Excel

&#91;embedded content: Sequence diagram · nạp phiếu BK, xác thực bằng NAP\_KEY\]

Batch 1 thay toàn bộ số của khối-ngày và ghi nó vào `ngay_nap`, `lan_nap`, `moc_khoi` trong một giao dịch. Từ đó, cả hai đường đẩy từ sheet đều bỏ qua khối-ngày đó cho tới khi lần nạp bị huỷ.

### 3.3 Mở trang: tải dữ liệu và vẽ biểu đồ

&#91;embedded content: Sequence diagram · mở trang và làm mới; TK4, vật tư, chỉ số chạy song song cùng cách\]

Khi người xem lọc lùi ngày hoặc mở một khối có số liệu đã ngừng từ lâu, `api_thang.js` xin thêm `/api/v2/<dây>?tu=&den=` cho cả hai dây, gộp vào kho tháng, rồi bắn lại `TK3DataReady` / `TK4DataReady`; biểu đồ đang mở vẽ lại và giữ nguyên bộ lọc.

### 3.4 Về luồng đăng nhập

Người xem không đăng nhập: đây là quyết định ADR-08, không phải thiếu sót. Thay cho đăng nhập, mọi luồng ghi xác thực bằng khoá trong header: Apps Script gửi `x-push-key`, trang nạp gửi `x-nap-key`; Function so khoá bằng `khoaDung` (thời gian so không phụ thuộc vị trí ký tự sai), sai thì trả 401 và không ghi gì. Các GET dữ liệu chỉ trả khi trình duyệt gửi `Sec-Fetch-Site: same-origin` (hoặc Referer cùng tên miền); `/api/trang-thai` mở thẳng được để kiểm tra tình trạng.

## 4. Cấu trúc mã nguồn

Mã nguồn chia hai nửa chạy ở hai nơi: `functions/` + `db/` + `migrations/` chạy trên Cloudflare, `js/` + `css/` + hai trang HTML chạy trên trình duyệt. Một file dùng chung cả hai phía: `js/chung/chi_so.js` (công thức và ngưỡng cảnh báo). Tổng khoảng 27.000 dòng, mỗi file mở đầu bằng khung chú thích “FILE NÀY LÀM GÌ / AI GỌI / LUỒNG XỬ LÝ”.

```text
Portfolio_Xuongthieuket2/
├── index.html                  trang dashboard duy nhất (~1.500 dòng)
├── nap-lieu.html               trang nạp Excel, gói JS/CSS riêng
├── apps-script/                code chạy bên Google (chép dán tay vào Apps Script)
│   ├── khoi-ngay.gs            tệp thêm vào dự án Apps Script TK3/TK4: đẩy khối-ngày
│   ├── tk12-nguon.gs           dự án riêng TK1/TK2: đọc 2 file .xlsx -> khoi-ngay.gs
│   └── nhan-su.gs              dự án riêng: danh sách nhân sự 3 kíp
├── functions/api/
│   └── [[route]].js            cổng API: định tuyến, kiểm khoá, KV, gọi db/*
├── db/                         logic máy chủ (ES module, Function import)
│   ├── chuan-hoa.mjs           sheet ngang 14 khối -> dòng dọc so_lieu
│   ├── dong-bo-d1.mjs          đồng bộ lần đẩy cả sheet -> D1 (đường cũ / dự phòng)
│   ├── day-khoi-ngay.mjs       /api/day: so sánh vân tay, ghi khối-ngày
│   ├── goi-v2.mjs              dựng và đọc gói tháng cho /api/v2
│   ├── chi-so.mjs              /api/v2/chi-so: số trang chủ tính sẵn
│   ├── nap-excel.mjs           /api/nap: ghi, huỷ, liệt kê lần nạp Excel
│   └── nhan-su.mjs             /api/nhan-su (ghi), /api/v2/nhan-su (đọc)
├── migrations/                 0001_khoi_tao ... 0009_nhan_su_xuong (SQL D1)
├── js/
│   ├── api/                    tầng dữ liệu phía trình duyệt
│   │   ├── api_config.js       đường dẫn, bắn 4 cuộc gọi ngay khi nạp trang
│   │   ├── api_v2.js           dựng lại bảng ngang từ gói tháng; kho API_V2_KHO
│   │   ├── api_loaded.js       đổ vào window.masterSheetData*, localStorage, sự kiện
│   │   └── api_thang.js        tải thêm tháng cũ khi lọc lùi / mở khối cũ
│   ├── chung/chi_so.js         công thức, ngưỡng cảnh báo (dùng chung với máy chủ)
│   ├── components/
│   │   ├── Charts/
│   │   │   ├── ve/             HÀM VẼ Chart.js, 7 file (trước là chart_core.js):
│   │   │   │                   chung, nhap_nhay, tien_ich, rut_loc, tieu_hao,
│   │   │   │                   chat_luong, da_nang — đọc ve/chung.js trước
│   │   │   ├── bep/            CHỌN SỐ LIỆU + ĐIỀU PHỐI, 8 file (trước là chart_cook.js):
│   │   │   │                   cot_bieu_do (moduleConfigs), ghep_so_lieu (ghép
│   │   │   │                   TK1..TK4), dieu_phoi (DieuPhoi), bo_loc (chartConfigs),
│   │   │   │                   lat_trang, kip_co_hat_than, trang_chu, san_luong
│   │   │   ├── canhbao.js      bảng nhận xét / cảnh báo
│   │   │   └── vattu.js        ba mục vật tư
│   │   ├── SinteringDiagram/   sơ đồ công nghệ React + Pixi (ES module)
│   │   │   ├── DiagramApp.jsx  điểm vào: chỉ tải sơ đồ khi người xem mở tới
│   │   │   ├── pixiStage.jsx   sân khấu Pixi + camera + pop-up + nút điều khiển
│   │   │   ├── cau_hinh.js     CFG: toạ độ, kích thước mọi thiết bị
│   │   │   ├── bo_cuc.js       buildLayout() -> LAYOUT
│   │   │   ├── lap_rap/        8 file: ghép thiết bị thành từng khu
│   │   │   ├── diagramContainer.jsx  mục lục thiết bị
│   │   │   ├── thiet_bi/       25 file: mỗi file một nhóm thiết bị
│   │   │   ├── hang_muc.js     nội dung pop-up (HOTSPOT_DEFS)
│   │   │   └── diagramHotspots.jsx   giao diện pop-up, bắt chuột, bảng danh mục
│   │   ├── personnel.js        sơ đồ tổ chức 3 kíp
│   │   ├── sidebar.js          menu bên, mở khối biểu đồ
│   │   └── nav_fit.js          thanh menu tự co giãn
│   ├── main/main.js            khởi động, điều hướng, làm mới 15 phút
│   └── nap/                    trang nạp Excel
│       ├── nap_lieu.js         điều khiển các bước trên trang
│       ├── doc_xlsx.js         đọc .xlsx bằng DecompressionStream
│       ├── mau_nap.js          dạng file -> ô gửi lên (CAC_MAU, QUY_TAC_KCS)
│       └── ghi_xlsx.js         tạo file mẫu
├── css/                        8 file, mỗi file ghi rõ dùng cho phần nào
├── images/                     ảnh thiết bị, sơ đồ (jpg/png + webp)
├── public/                     _headers (cache 1 năm cho /assets), 404.html
├── scripts/nap-lich-su.mjs     nạp lại toàn bộ lịch sử vào D1 (db:chuan-bi)
├── vite.config.js              build 2 trang, gộp + thu nhỏ script thường
└── package.json                lệnh dev, build, deploy, db:*
```

### Phân lớp trách nhiệm

| Lớp | Phía trình duyệt | Phía máy chủ / nguồn | Trách nhiệm |
| --- | --- | --- | --- |
| Presentation | `index.html`, `nap-lieu.html`, `css/`, `Charts/ve/`, `personnel.js`, `sidebar.js`, `nav_fit.js`, `SinteringDiagram/`, `main.js` | — | Vẽ biểu đồ, bảng, sơ đồ; điều hướng; màn hình “đang tải” |
| Business Logic | `chi_so.js`, `Charts/bep/`, `canhbao.js`, `vattu.js`, `mau_nap.js` | `chuan-hoa.mjs`, `chi-so.mjs`, `khoi-ngay.gs` | Công thức, ngưỡng cảnh báo, chọn cột cho từng biểu đồ, ghép TK3+TK4 theo ngày + kíp, chuẩn hoá sheet, đổi phiếu BK sang ô |
| Data Access | `api_config.js`, `api_loaded.js`, `api_v2.js`, `api_thang.js`, `doc_xlsx.js` | `[[route]].js`, `dong-bo-d1.mjs`, `day-khoi-ngay.mjs`, `goi-v2.mjs`, `nap-excel.mjs`, `migrations/` | Gọi API, cache localStorage, ETag; định tuyến, xác thực khoá, đọc ghi D1/KV, dựng gói tháng |
| Công cụ | — | `scripts/nap-lich-su.mjs`, `vite.config.js`, `package.json` | Build, deploy, nạp lại lịch sử, kiểm đối chiếu D1 |

Ranh giới lớp chưa tuyệt đối: thư mục `Charts/bep/` vừa chọn số liệu vừa điều phối vẽ, `canhbao.js` vừa tính vừa dựng HTML.

**Tách file nhỏ (24/10/2026).** Bốn file lớn nhất được chia theo việc để người nhận bàn giao đọc theo tên file: `chart_core.js` (1.581 dòng) thành `Charts/ve/` 7 file, `chart_cook.js` (1.984 dòng) thành `Charts/bep/` 8 file, `diagramContainer.jsx` (4.773 dòng) thành mục lục + `thiet_bi/` 25 file, `pixiStage.jsx` (2.390 dòng) thành `cau_hinh.js`, `bo_cuc.js`, `lap_rap/` 8 file + phần sân khấu; nội dung pop-up tách khỏi `diagramHotspots.jsx` thành `hang_muc.js`. Ba file không còn dùng đã xoá. Chỉ dời mã, không đổi logic: gói build của các script biểu đồ giống từng byte bản trước, gói sơ đồ có đúng cùng tập dòng mã (chỉ khác thứ tự module). Hai loại file khác nhau: `Charts/ve/`, `Charts/bep/` là script thường dùng chung biến toàn cục, thứ tự thẻ `<script>` trong `index.html` là bắt buộc; `SinteringDiagram/` là ES module, mỗi file tự `import` thứ nó cần. Cố ý KHÔNG tách: `js/chung/chi_so.js` (máy chủ import nguyên file và băm mã nguồn các hàm làm ETag), `apps-script/*.gs` (dán tay sang Google, thêm file là thêm bước dán), `index.html`.

Những chỗ hay sửa nhất: ngưỡng cảnh báo ở `js/chung/chi_so.js`; cột của một biểu đồ ở `moduleConfigs` trong `Charts/bep/cot_bieu_do.js`; cấu hình vẽ, lật trang của từng biểu đồ ở `chartConfigs` trong `Charts/bep/bo_loc.js`; toạ độ sơ đồ ở `CFG` trong `SinteringDiagram/cau_hinh.js`; nội dung pop-up ở `HOTSPOT_DEFS` trong `SinteringDiagram/hang_muc.js`; cột không gửi ra trình duyệt ở `COT_KHONG_GUI` trong `db/goi-v2.mjs`; dạng file Excel mới ở `CAC_MAU` trong `js/nap/mau_nap.js`.

## 5. Quản lý state và luồng dữ liệu

State chảy một chiều: D1 → gói tháng → kho tháng của trình duyệt → biến toàn cục `masterSheetData*` → `AppChartData` → biểu đồ đang mở. Giao diện không bao giờ ghi ngược vào dữ liệu; bộ lọc chỉ đổi cách vẽ. Mỗi bậc so “vân tay” trước khi làm việc, nên dữ liệu không đổi thì không tải, không dựng, không vẽ lại. Không dùng thư viện state (Redux, Zustand): state là vài đối tượng có chủ rõ ràng, cập nhật qua `CustomEvent`.

### Các tầng state

| Tầng | Nơi giữ | Ai ghi | Ai đọc | Vòng đời |
| --- | --- | --- | --- | --- |
| Nguồn sự thật | D1 `so_lieu`, `chi_tieu` | Đồng bộ sheet, đường khối-ngày, nạp Excel, `db:nap` | `goi-v2.mjs`, `chi-so.mjs` | Vĩnh viễn; Time Travel 7 ngày |
| Dữ liệu dẫn xuất (máy chủ) | D1 `goi_thang`, `moc_khoi` | Dựng lại trong cùng lượt ghi `so_lieu` | `/api/v2/*` | Dựng lại khi tháng có ô đổi hoặc danh mục cột đổi |
| State điều khiển đồng bộ | D1 `dong_bo`, `van_tay_ngay`, `van_tay_thang`, `ngay_nap`, `lan_nap`; KV `sheet:`, `loi:`, `nhip:` | Function | Function, `/api/trang-thai` | Theo từng lượt đẩy / nạp |
| Bộ nhớ đệm HTTP | ETag + `Cache-Control` | Function | Trình duyệt (304 khi không đổi) | Mỗi request |
| Bản nhớ trong máy | `localStorage` `xtk2.sheet.v2.<tuyến>`, nén theo cột | `api_loaded.js`, lúc trình duyệt rảnh | `api_loaded.js` lúc mở trang | Tới lần tải sau; hết chỗ (\~5 MB) thì xoá bản cũ |
| Kho tháng | `API_V2_KHO.TK3/TK4` (`vanTay`, `cot`, `thang`, `mucLuc`, `etag`) | `apiV2NhanGoi` | `apiV2BangNgang`, `api_thang.js` | Một phiên trang; thay hẳn khi danh mục cột đổi |
| Dữ liệu trang | `window.masterSheetDataTK3/TK4/VATTU`, `XTK2_CHI_SO_MAY` | `apiApDung`, `apiNhanChiSo` | `Charts/bep/`, `canhbao`, `personnel`, `vattu` | Thay khi vân tay đổi; chỉ số máy chủ chỉ dùng cho đúng ngày hôm nay |
| Dữ liệu biểu đồ | `window.AppChartData[namespaceKey]` (TK3 + TK4 đã ghép theo ngày + kíp) | `processAllModulesData` | Hàm vẽ trong `Charts/ve/` | Tính lại mỗi lần `*DataReady` |
| State giao diện | `DieuPhoi.khoiDangMo`, `daVe`, `khoiCu`; ô lọc ngày / kíp trong DOM; mục đang mở theo `#hash` | Người xem | `DieuPhoi`, `applyUniversalFilter` | Giữ nguyên qua các lần dữ liệu mới về |

### Một chu kỳ cập nhật

1. `api_config.js` (trong `<head>`) bắn ngay bốn cuộc gọi TK3, TK4, vật tư, chỉ số, cất Promise vào `API_PREWARM`, chưa chờ Chart.js hay DOM.
2. `api_loaded.js` đọc bản nhớ `localStorage`, nếu có thì đổ vào `masterSheetData*` và bắn `TK3DataReady` ngay: biểu đồ hiện trước khi mạng trả lời (stale-while-revalidate).
3. Gói `/api/v2` về → `apiV2NhanGoi` gộp vào kho tháng → dựng bảng ngang → `apiApDung` so vân tay với `apiDaBan[tuyến]`; khác thì thay dữ liệu, bắn sự kiện, ghi lại bản nhớ lúc rảnh.
4. `processAllModulesData` rút mỗi (dây, khối) một lần, ghép TK3 + TK4 bằng `ghepTheoNgayKip`, ghi `AppChartData`, rồi gọi `DieuPhoi.duLieuMoi()`.
5. `DieuPhoi` đánh dấu mọi khối đã vẽ là cũ nhưng chỉ vẽ lại khối đang mở, giữ nguyên bộ lọc người xem đang chọn; khối ẩn được vẽ khi mở tới.
6. `main.js` kiểm mỗi phút, đủ 15 phút thì lặp lại từ bước 3; tab ẩn thì bỏ lượt, quay lại tab quá hạn thì tải ngay. Dữ liệu không đổi thì máy chủ đáp 304 rỗng.

### Quy tắc giữ state nhất quán

- **Hai dây luôn cùng dải tháng.** `api_thang.js` chỉ gộp tháng cũ khi cả TK3 và TK4 cùng tải được và cùng danh mục cột; mỗi lúc một lượt tải (`API_THANG.dangTai`), lượt sau xếp hàng.
- **Danh mục cột là khoá của kho.** Gói mặc định có vân tay danh mục khác thì thay hẳn kho; gói tháng cũ lệch danh mục thì bỏ, vì số thứ tự cột không khớp.
- **Chỉ số máy chủ có hạn dùng.** `chiSoMayChu()` chỉ trả kết quả nếu nó được tính cho đúng ngày hôm nay theo đồng hồ người xem; lỗi hoặc qua đêm thì trình duyệt tự tính bằng cùng công thức.
- **D1 lỗi thì lùi về KV.** Một dây rơi về KV thì dây kia cũng tải đủ, để hai dây cùng dải ngày.
- **Mốc cập nhật hiện mốc cũ hơn trong hai dây.** Một dây ngừng đẩy thì ô “Cập nhật” đứng lại, không bị dây kia che.

Phía máy chủ dùng cùng nguyên tắc: số liệu và vân tay khối-ngày ghi trong cùng một `db.batch`, nên dấu luôn khớp với số. Gói tháng của các tháng bị đổi được dựng lại ngay sau đó trong cùng lượt gọi, bằng một `db.batch` thứ hai (`dungLaiGoi`); mọi gói dựng theo danh mục cột cũ cũng được dựng lại ở bước này.

## 6. Đánh giá: đã tối ưu chưa?

Ở tầng hạ tầng, kiến trúc này gần như là lựa chọn tốt nhất có thể có cho người không có quyền SCADA, không có máy chủ, không có thẻ: 0 đồng, không phải vận hành máy, nhanh, khoá đúng thứ cần khoá. Chỗ chưa tối ưu nằm ở ba nơi khác: dữ liệu nguồn nhập tay, vận hành (giám sát, sao lưu, kiểm thử, commit) và độ phức tạp so với sức một người.

| Tiêu chí | Mức | Bằng chứng |
| --- | --- | --- |
| Chi phí hạ tầng | Tốt | 0 đồng; mọi thành phần nằm trong gói Free |
| Tốc độ với người xem | Tốt | API trả byte đầu sau 0,3–0,45 s; gói TK3 73 KB sau nén; bản nhớ localStorage cho biểu đồ hiện trước khi mạng trả lời |
| Độ đúng của số trên trang so với nguồn | Tốt | KV và D1 cho cùng kết quả; công thức cũ = mới trên 188 ngày; 21 biểu đồ mặc định khớp bản tải toàn bộ lịch sử |
| Độ tươi dữ liệu | Đạt | Trễ ≈ chu kỳ trigger 30 phút + làm mới 15 phút phía trang; không thời gian thực vì không có SCADA |
| Nằm trong 10 ms CPU | Đạt | Đường khối-ngày 1–3 ms; `/api/v2/tk3` 10–13 ms; `/api/v2/chi-so` 23–39 ms và lần đẩy cả sheet 60–72 ms vẫn vượt |
| Bảo mật theo mục tiêu đề ra | Đạt | Nguồn và quyền ghi được khoá; số hiển thị vẫn lấy được bằng F12, đúng chủ ý công khai |
| Một người duy trì được | Đạt | Chú thích đầy đủ, README có bản đồ mã nguồn; nhưng hai đường ghi, hai kho, 6 migration là nhiều khái niệm, chỉ một người hiểu hết |
| Chất lượng dữ liệu nguồn | Cần cải thiện | “%CaO (QTH)” chứa Al2O3 từ tháng 5; cỡ hạt QTK lệch một hàng từ 03/08; 161 hàng than coke TK4 bị bỏ vì thiếu kíp |
| Giám sát và cảnh báo | Cần cải thiện | Chỉ có `/api/trang-thai` và cảnh báo “dữ liệu cũ” trên trang; tuyến vật tư đứng 33 ngày không ai biết |
| Sao lưu dài hạn | Cần cải thiện | D1 Time Travel 7 ngày; KV giữ bản sheet gần nhất; chưa có bản xuất định kỳ |
| Quản lý mã nguồn và kiểm thử | Cần cải thiện | Đường khối-ngày chạy production từ 04/10/2026 nhưng chưa commit (18 file sửa, 3 file mới); bộ kiểm thử toàn vẹn nằm ngoài repo, repo không có thư mục `tests/` |

### So với các phương án khác

| Phương án | Chi phí | Cần IT hoặc cài đặt | Giới hạn chính | Kết luận |
| --- | --- | --- | --- | --- |
| Cloudflare Pages + D1 (hiện tại) | 0 đồng | Không | 10 ms CPU; nhiều lớp hơn các phương án không-code | Chọn |
| Looker Studio đọc thẳng Google Sheet | 0 đồng | Không | Khó làm ghép TK3 + TK4 theo ngày + kíp, cảnh báo theo ngưỡng tuỳ ý, sơ đồ công nghệ; không nhận phiếu BK trực tiếp | Hợp làm báo cáo phụ, không thay được |
| Power BI | Giấy phép Pro để chia sẻ nội bộ | Cần cài Power BI Desktop | Máy bị khoá; “Publish to web” thì công khai cả dữ liệu nguồn của báo cáo | Loại |
| Apps Script web app làm backend | 0 đồng | Không | Đã dùng: TK3 có lúc 114 giây, link `/exec` lộ toàn bộ dữ liệu | Đã bỏ |
| Máy chủ nội bộ / VPS + PostgreSQL + Grafana | Thuê VPS cần thẻ | IT cấp máy hoặc mở mạng | Một người phải vá, sao lưu, trực | Không khả thi lúc này |

### Việc nên làm tiếp, theo thứ tự

1. **Commit và push đường khối-ngày.** Production đang chạy `db/day-khoi-ngay.mjs`, `migrations/0006_khoi_ngay.sql`, `apps-script/khoi-ngay.gs` mà git chưa có; mất ổ đĩa là mất mã đang chạy.
2. **Cảnh báo khi nguồn ngừng đẩy.** Một dự án Apps Script riêng (không chung với script đẩy) chạy mỗi giờ, đọc `/api/trang-thai`, gửi email bằng MailApp khi một tuyến cũ quá 6 giờ. Không cần dịch vụ mới, không tốn hạn mức Cloudflare đáng kể.
3. **Đưa bộ kiểm thử toàn vẹn vào `tests/`** và chạy trước mỗi lần deploy.
4. **Tính sẵn chỉ số trang chủ lúc ghi** (lưu vào một bảng) thay vì mỗi request, để `/api/v2/chi-so` xuống dưới 10 ms.
5. **Tắt đường đẩy cả sheet** sau vài tuần đường khối-ngày chạy ổn, bỏ hẳn khoản 60–72 ms CPU; KV chỉ còn là bản lưu.
6. **Sao lưu hằng tháng** bằng `wrangler d1 export` từ Node portable, cất ngoài Cloudflare.
7. **Chặn lỗi ngay tại ô nhập:** Data validation trong Google Sheet (kíp chỉ A/B/C, khoảng giá trị hợp lý cho từng cột), vì phần lớn sai số đã gặp sinh ra ở bước nhập tay.

## 7. Kế hoạch mở rộng cho TK1, TK2 và khi dữ liệu tăng

Dung lượng và hạn mức D1 không phải nút thắt khi lên 4 dây chuyền: khoảng 26 MB mỗi năm so với giới hạn 500 MB. Nút thắt thật là mã đang viết cứng cho hai dây (khoảng 670 dòng có nhắc TK3/TK4 trong 29 file, 434 dòng nằm ở `chart_cook.js` và `chart_core.js` — nay là `Charts/bep/` và `Charts/ve/`), danh mục cột dùng chung một vân tay, và các request còn vượt 10 ms CPU. Kế hoạch vì vậy đi theo thứ tự: tổng quát hoá trước, nối nguồn TK1/TK2 sau, giao diện đa xưởng cuối cùng.

&#91;embedded content: Lộ trình mở rộng · 4 giai đoạn, 3 cổng; chưa gắn ngày\]

Mỗi cổng là điều kiện phải đạt trước khi sang giai đoạn sau; giai đoạn 8 độc lập, làm được ngay khi IT đồng ý. Lộ trình chưa có ngày vì còn chờ câu trả lời về nguồn dữ liệu TK1/TK2 (cuối phần này).

### Sức chứa so với gói Free

| Tài nguyên | Hiện tại, 2 dây (04/10/2026) | Ước tính 4 dây | Giới hạn Free | Nhận xét |
| --- | --- | --- | --- | --- |
| Dung lượng D1 | 4,19 MB; 44.481 giá trị | \~26 MB/năm (5–6 nghìn giá trị mỗi dây-tháng) | 500 MB mỗi DB | Không phải nút thắt trong nhiều năm |
| Dòng ghi D1/ngày | \~4.700 | \~9.400 | 100.000 | An toàn; riêng lần nạp lịch sử đầu tiên của dây mới phải chia nhiều ngày nếu quá 100.000 ô |
| Dòng đọc D1/ngày | \~323.000 | \~650.000 | 5.000.000 | Còn dư; theo dõi bằng `wrangler d1 insights` |
| Request Function/ngày | Chưa đo | Mỗi màn hình treo 24/24 ≈ 384 (4 gọi × 96 lần làm mới); 4 dây ≈ 576 | 100.000 (cả tài khoản) | Đủ cho hàng trăm màn hình |
| CPU mỗi request | `/api/v2/tk3` 10–13 ms; `chi-so` 23–39 ms | `chi-so` tăng theo số dây | 10 ms | Nút thắt thật: phải tính sẵn `chi-so` lúc ghi |
| Bộ nhớ trình duyệt | \~400 KB JSON mỗi dây; localStorage \~5 MB | Gấp đôi nếu tải hết | \~5 MB localStorage | Chỉ tải dây của xưởng đang xem; có thể chuyển sang IndexedDB |
| Danh mục cột | Một vân tay chung cho mọi tuyến | Cột mới của TK1 làm cũ cả gói TK3/TK4 | 50 truy vấn mỗi lần gọi | Tách vân tay danh mục theo tuyến |

Hạn mức Free tính theo tài khoản, nên tách mỗi xưởng một dự án Pages không làm tăng hạn mức; một dự án, một D1, thêm chiều “xưởng” là đơn giản hơn.

### Danh sách thay đổi để thêm TK1, TK2

**Cơ sở dữ liệu và máy chủ**

- [ ] Tạo một danh mục dây chuyền dùng chung (mã, tuyến, xưởng, tên hiển thị) cho cả máy chủ lẫn trình duyệt, thay `TUYEN`, `TUYEN_DAY_CHUYEN` (`functions/api`) và `DAY_CHUYEN` (`db/chuan-hoa.mjs`).
- [ ] Migration 0007 dựng lại `so_lieu`, `nhan_su`, `vat_tu_ton`, `vat_tu_phieu`, `ngay_nap` không còn `CHECK (day_chuyen IN ('TK3','TK4'))`. SQLite không sửa được CHECK: tạo bảng mới, chép, xoá, đổi tên (\~45.000 dòng ghi, trong hạn mức một ngày).
- [ ] Tách vân tay danh mục cột (`goi_thang.ds_cot`) theo tuyến, để cột mới của dây này không bắt dựng lại gói của dây khác.
- [ ] Chốt quy tắc mã chỉ tiêu: dùng chung `chi_tieu` khi cột cùng nghĩa, cùng đơn vị (biểu đồ dùng lại được); khác nghĩa thì thêm tiền tố xưởng vào tên khối.
- [ ] Tính sẵn chỉ số trang chủ theo xưởng lúc ghi, để `/api/v2/chi-so` chỉ còn đọc.

**Thu thập dữ liệu**

- [ ] Nếu TK1/TK2 có Google Sheet: chép script TK + `khoi-ngay.gs`, đi thẳng đường khối-ngày; không dùng KV và đường đẩy cả sheet cho dây mới.
- [ ] Nếu chỉ có phiếu BK: mở bộ chuyển đổi `kcs-bk` cho “PX TK1” (hiện đang từ chối), khai điểm lấy mẫu QTH, QTK, silo của từng dây.

**Trình duyệt**

- [ ] Thay `masterSheetDataTK3/TK4`, `API_V2_KHO.TK3/TK4` và các vòng `['TK3', 'TK4']` trong `api_thang.js`, `Charts/bep/` bằng danh sách dây của xưởng đang xem.
- [ ] Đổi khoá `mapping` dạng `...TK3` / `...TK4` và loại biểu đồ `QTHTK3` / `QTHTK4` trong `Charts/bep/` (cot_bieu_do.js, bo_loc.js) sang dạng tham số theo dây.
- [ ] Thêm bộ chọn xưởng; chỉ tải và lưu bản nhớ cho dây của xưởng đang chọn.
- [ ] Kiểm thử hồi quy: sau khi tổng quát hoá, 21 biểu đồ và dải chỉ số của TK3/TK4 phải ra y hệt trước.

### Nếu một ngày IT mở quyền đọc SCADA

Kiến trúc không phải đổi: nguồn mới chỉ là một “người đẩy” nữa, POST vào `/api/day/<tuyến>` với khoá riêng, đi qua cùng bộ chuẩn hoá. Kết nối luôn đi một chiều từ trong ra ngoài, không mở cổng nào vào mạng SCADA. Ràng buộc là 100.000 dòng ghi/ngày: 100 tag × mỗi 15 phút × 4 dây = 38.400 dòng/ngày (được), còn mỗi phút là 576.000 (vượt). Vì vậy đề xuất với IT nên là một bản xuất tổng hợp theo 15 phút hoặc theo ca (file hoặc view SQL chỉ đọc), do một máy IT quản lý đẩy lên.

### Câu hỏi cần trả lời trước khi làm

- TK1/TK2 có Google Sheet + Apps Script như TK3/TK4 không, hay chỉ có phiếu BK?
- Các khối và tên cột trong sheet TK1/TK2 có trùng TK3/TK4 không?
- Gộp một dashboard có bộ chọn xưởng, hay mỗi xưởng một link riêng?
- Điểm lấy mẫu BK của TK1/TK2 là những vị trí nào?

### Bảng tự nhận diện công dụng các file trong code và nội dung code trong đó đang nói về điều gì
- 1 file chi-so.mjs:
    + Nói nôm na, file này chính là L1+L2+L3 cache của dự án (tương tự như L1, L2, L3 của CPU), nó có tác dụng lưu sẵn 1 cache siêu nhẹ với 4KB dữ liệu khi người dùng mở dashboard lên là đẩy luôn bảng đó ra tránh việc chờ đợi gas bắn api mới có dữ liệu, file này import và dùng chung mã nguồn với trình duyệt ==> đồng bộ kết quả tính toán từ phía máy chủ và trình duyệt tránh sai lệch
    + 3 dòng import đầu file là để import thẳng 2 file đang chạy chung với trình duyệt là chi-so.js và api_v2.js và hàm lập danh mục thì
    + Dòng tiếp biến const LECH_GIO chính là điều chỉnh giờ cho chuẩn với giờ của việt nam, cấu trúc bằng cách cộng thêm 7 tiếng vào mốc thời gian cho khớp với UTC +7