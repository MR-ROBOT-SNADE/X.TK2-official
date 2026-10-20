/* =============================================================================
 * APPS SCRIPT — ĐẨY SỐ LIỆU TK1, TK2 (XƯỞNG THIÊU KẾT 1) LÊN CLOUDFLARE
 * =============================================================================
 * NGUỒN
 *   Mỗi dây chuyền một file Excel (.xlsx) trên Drive ("BÁO CÁO SẢN XUẤT TK1/TK2").
 *   Mỗi file chỉ chứa THÁNG ĐANG CHẠY: sang tháng mới bên xưởng xoá số cũ, nhập
 *   tiếp từ ca 1. Chỉ đọc hai sheet:
 *     - sheet thứ 3 "Tiêu hao từng ca": số gốc từng ca (sản lượng, điện, NNL...)
 *     - sheet "TH": suất tiêu hao từng ca (kg/tsp...) tính từ sheet 3
 *   Mỗi sheet 62 hàng = 31 ngày × 2 ca. Cột ngày chỉ ghi số 1..31, không có tháng.
 *
 * CÁCH LÀM
 *   File .xlsx không gắn Apps Script vào được như Google Sheet TK3/TK4, nên dự án
 *   này đứng RIÊNG (script.google.com -> Dự án mới; file .xlsx KHÔNG có menu
 *   "Tiện ích mở rộng -> Apps Script"). Mỗi lượt, với từng dây:
 *     1) hỏi Drive file có đổi không (không đổi -> nghỉ, 3 giờ mới so lại một lần);
 *     2) chép tạm file thành Google Sheet, đọc 2 sheet THEO TÊN CỘT (TK1 và TK2
 *        khác thứ tự cột, khác cách viết), rồi xoá bản tạm;
 *     3) dựng lại thành các khối GIỐNG HỆT sheet TK3/TK4 (Sản lượng, THthan, THTD,
 *        Điện, QCS, khí than, QH) với ĐÚNG tên cột của TK3/TK4 -> D1 ghi cùng mã
 *        chỉ tiêu, biểu đồ đọc được mà không cần thêm chỉ tiêu mới;
 *     4) giao cho khoi-ngay.gs (tệp thứ hai của dự án) so dấu vân tay và gửi phần
 *        đổi lên /api/day/tk1 | tk2 — đúng đường TK3/TK4 đang chạy -> vào D1;
 *     5) gửi bản cả bảng lên /api/tk1 | tk2 -> máy chủ cất vào KV 'sheet:tk1'
 *        (bản nhớ tạm, như TK3/TK4), chỉ khi bảng đổi (tk12GuiKV_).
 *
 * THÁNG NÀO? Cột ngày chỉ có số ngày, mà số liệu không thể nằm ở tương lai, nên:
 *   ngày cuối có sản lượng <= ngày hôm nay -> số của THÁNG NÀY;
 *   ngày cuối có sản lượng >  ngày hôm nay -> file còn số THÁNG TRƯỚC (chưa xoá
 *     sang tháng mới). Vẫn đẩy, để kịp ca cuối tháng nhập muộn, nhưng:
 *       - chỉ tới hết ngày TK12_NGAY_GIA_HAN của tháng mới;
 *       - không xoá ngày nào trên máy chủ;
 *       - từ chối nếu số ô ít đi so với lần đẩy trước (file đang bị xoá dở).
 *   Tiêu đề sheet "Báo cáo" (THÁNG mm/yyyy) chỉ ghi vào nhật ký để đối chiếu.
 *   Các tháng cũ đã lên máy chủ được GIỮ (KN_GIU_THANG_VANG): file không còn
 *   tháng 10 không có nghĩa là tháng 10 bị xoá.
 *
 * CÀI ĐẶT (một lần)
 *   1) script.google.com -> Dự án mới, đặt tên "TK1-TK2 -> Cloudflare".
 *      Cài đặt dự án (bánh răng) -> Múi giờ: (GMT+07:00) Asia/Ho_Chi_Minh.
 *   2) Tệp Code.gs: xoá hết, dán file này. Thêm tệp (dấu + cạnh "Tệp" -> Tập
 *      lệnh) tên khoi-ngay, dán apps-script/khoi-ngay.gs.
 *   3) Dịch vụ (dấu + cạnh "Dịch vụ") -> Drive API -> Phiên bản v3 -> Thêm.
 *   4) Cài đặt dự án -> Thuộc tính tập lệnh -> thêm 3 dòng:
 *        PUSH_KEY      = đúng khoá đang dùng cho TK3/TK4
 *        TK12_FILE_TK1 = link (hoặc mã) file .xlsx TK1 trên Drive
 *        TK12_FILE_TK2 = link (hoặc mã) file .xlsx TK2 trên Drive
 *      KHÔNG ghi mã file vào đây: file này nằm trong repo GitHub công khai, mà
 *      2 file .xlsx để "ai có link cũng xem được" (từ 20/10/2026 mã file chuyển
 *      sang Thuộc tính tập lệnh — bản dán trước đó, mã nằm trong code, vẫn chạy).
 *   5) Chọn hàm xemThuTK12 -> Chạy -> cấp quyền -> xem Nhật ký: tháng, số ca, cột
 *      nào lấy từ đâu, vài hàng mẫu. Bước này KHÔNG gửi gì lên máy chủ.
 *   6) Khi máy chủ đã nhận tk1/tk2 (đã deploy + chạy npm run db:mo-tk12): chạy
 *      kiemTraTK12 (chỉ so sánh), rồi dayTK12 (gửi lần đầu: D1 + KV), rồi
 *      caiLichTK12 (lịch mỗi 30 phút). Xem kết quả: /api/trang-thai mục tk1, tk2.
 *   7) (tuỳ chọn) Luỹ kế các ca trước khi cài bản đọc hàng Tổng: xemBanCuTK12 rồi
 *      dungLaiLuyKeTK12 — xem mục "DỰNG LẠI LUỸ KẾ" bên dưới.
 *   Dán bản script mới: chạy dayLaiTK12 (đẩy lại ngay, khỏi chờ file đổi).
 *   KHÔNG chạy dayKhoiNgay / caiLichKhoiNgay của khoi-ngay.gs trong dự án này.
 * ===========================================================================*/

var TK12_MAY_CHU = 'https://xtk2-profile.pages.dev';
/* Hai file nguồn. "id" đọc từ Thuộc tính tập lệnh lúc dùng tới (tk12MaTep_) —
   mọi chỗ khác vẫn gọi tep.id như cũ. */
var TK12_TEP = [
  { tuyen: 'tk1', thuocTinh: 'TK12_FILE_TK1', get id() { return tk12MaTep_(this.thuocTinh); } },
  { tuyen: 'tk2', thuocTinh: 'TK12_FILE_TK2', get id() { return tk12MaTep_(this.thuocTinh); } }
];

/** Mã file Drive trong Thuộc tính tập lệnh `ten` — dán link hay dán mã đều được.
 *  Chưa đặt / sai dạng -> ném lỗi nói rõ thiếu thuộc tính nào. */
function tk12MaTep_(ten) {
  var v = String(PropertiesService.getScriptProperties().getProperty(ten) || '').trim();
  var m = v.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || v.match(/[?&]id=([a-zA-Z0-9_-]{20,})/) || v.match(/^([a-zA-Z0-9_-]{20,})$/);
  if (!m) throw new Error('Chưa đặt Thuộc tính tập lệnh ' + ten + ' (link hoặc mã file .xlsx trên Drive)');
  return m[1];
}
var TK12_CHU_KY_PHUT = 30;        /* lịch dayTK12: Google nhận 1, 5, 10, 15, 30 */
var TK12_DOC_LAI_GIO = 3;         /* file không đổi vẫn so dấu + gửi lại KV mỗi chừng này giờ
                                     (máy chủ báo "CŨ" khi quá 6 giờ không có lần đẩy) */
var TK12_NGAY_GIA_HAN = 5;        /* file còn số tháng trước: còn đẩy tới hết ngày này của tháng mới */
var TK12_CA_MOI_NGAY = 2;         /* số hàng (ca) mỗi ngày trong 2 sheet */
var TK12_SO_HANG_DOC = 100;       /* chỉ đọc chừng này hàng đầu (bảng ca + tiêu đề ~65 hàng) */

/* Biến dùng chung với khoi-ngay.gs (khoi-ngay.gs đọc, tệp này đặt) */
var PUSH_URL = '';                /* đặt lại cho từng dây trước mỗi lượt: .../api/tk1 */
var KN_GIU_THANG_VANG = true;     /* file chỉ có 1 tháng: tháng vắng trên file KHÔNG phải bị xoá */
var KN_KHONG_XOA_NGAY = false;    /* true trong lượt đẩy số tháng trước */
var TK12_DANG_DOC = null;         /* bảng đã dựng của dây đang đẩy — doGet trả bảng này */

/* ---------------------------------------------------------------------------
 * CỘT RA <- CỘT NGUỒN
 *   ten     tên cột ĐÚNG như sheet TK3/TK4 (đổi một chữ là thành chỉ tiêu khác)
 *   nguon   'ca' = sheet 3 "Tiêu hao từng ca", 'th' = sheet "TH"
 *   mau     mẫu tên cột nguồn, so trên tên ĐÃ bỏ dấu, viết thường (tk12Chuan_)
 *   bo0     số 0 = CHƯA NHẬP, bỏ trống: công thức của file ra 0,00 khi số gốc
 *           (kWh, m3 khí than...) chưa nhập — vd TK2 07/10 ca 1 khí than, ca mới
 *           nhất chưa có số điện. Chỉ đặt cho suất tiêu hao không thể bằng 0 khi
 *           có sản lượng; vật liệu từng loại, tỉ lệ HLC thì 0 là số thật.
 *   tong    cột LUỸ KẾ: lấy ở hàng TỔNG của sheet ('th' hoặc 'ca'), cột khớp mau.
 *           Hàng Tổng (dưới bảng tổng theo kíp A, B, C) là luỹ kế từ đầu tháng
 *           tới ca mới nhất; nhập ca sau là nó đổi, số cũ mất. Nên mỗi lượt đọc
 *           số Tổng được GHI LẠI cho ca mới nhất (tk12LuyKe_) và các ca trước giữ
 *           số đã ghi -> đường luỹ kế từng ca như TK3/TK4. Ca nào lúc là ca mới
 *           nhất mà script chưa đọc được (trước khi cài bản này) thì luỹ kế trống
 *           — dựng lại được từ lịch sử phiên bản file (dungLaiLuyKeTK12).
 * Chưa lấy (khoan nạp): "Tiêu hao hơi nước nóng" (QH) — TK1 và TK2 ghi chung một
 * số tấn hơi mỗi ca, chờ xưởng xác nhận.
 * Luỹ kế tỉ lệ HLC DQ1: nối 10/10/2026, lúc đó hàng Tổng của TH ghi 0,00 (công
 * thức sai); tối 10/10 file đã ghi số (TK1 12,92). bo0 vẫn giữ: công thức hỏng lại
 * ra 0 thì bỏ, không vẽ đường giả sát đáy.
 * ------------------------------------------------------------------------- */
var TK12_KHOI = [
  { khoi: 'Sản lượng', cot: [
    { ten: 'Sản lượng (sản lượng)', nguon: 'ca', mau: /^san luong qtp/ }
  ] },
  { khoi: 'THthan', cot: [
    { ten: 'Tiêu hao theo nhiệt trị', nguon: 'th', mau: /^tieu hao quy doi theo than tieu chuan sau dieu chinh/, bo0: true },
    { ten: 'Tiêu hao than tích luỹ (tính theo nhiệt trị)', tong: 'th', mau: /^tieu hao quy doi theo than tieu chuan sau dieu chinh/, bo0: true },
    { ten: 'Tiêu hao theo Ccd', nguon: 'th', mau: /^tieu hao quy doi theo than pci/, bo0: true },
    { ten: 'Tiêu hao than tích luỹ (tính theo Ccd)', tong: 'th', mau: /^tieu hao quy doi theo than pci/, bo0: true }
  ] },
  { khoi: 'THTD', cot: [
    { ten: 'Tiêu hao quy đổi vôi nung', nguon: 'th', mau: /^tieu hao quy doi theo voi nung/, bo0: true },
    { ten: 'Tiêu hao quy đổi vôi nung (tích luỹ)', tong: 'th', mau: /^tieu hao quy doi theo voi nung/, bo0: true },
    { ten: 'Tiêu hao quy đổi đá dolomite', nguon: 'th', mau: /^tieu hao quy doi theo da dolomit/, bo0: true },
    { ten: 'Tiêu hao quy đổi đá dolomite (tích luỹ)', tong: 'th', mau: /^tieu hao quy doi theo da dolomit/, bo0: true },
    { ten: 'Tiêu hao vôi nung', nguon: 'th', mau: /^tieu hao voi nung/ },
    { ten: 'Tiêu hao bột đá vôi', nguon: 'th', mau: /^tieu hao da voi/ },
    { ten: 'Tiêu hao dolomite nung', nguon: 'th', mau: /^tieu hao dolomit nung/ },
    { ten: 'Tiêu hao bột đá dolomite', nguon: 'th', mau: /^tieu hao da dolomit/ }
  ] },
  { khoi: 'Điện', cot: [
    { ten: 'Tiêu hao điện (ca)', nguon: 'ca', mau: /^tieu hao dien/, bo0: true },
    /* TH không có cột điện -> Tổng của sheet 3 (= tổng kWh / tổng sản lượng) */
    { ten: 'Tiêu hao điện tích luỹ tháng', tong: 'ca', mau: /^tieu hao dien/, bo0: true }
  ] },
  { khoi: 'QCS', cot: [
    { ten: 'Tiêu hao quặng chứa sắt', nguon: 'th', mau: /^tieu hao nl chua sat/, bo0: true }
  ] },
  { khoi: 'khí than', cot: [
    { ten: 'Tiêu hao khí than (khí than)', nguon: 'th', mau: /^tieu hao khi than/, bo0: true },
    /* Luỹ kế lấy hàng TỔNG của sheet 3 (TK2 cột BO = BN/D = Σ m3 / Σ sản lượng), KHÔNG
       lấy TH: từ 10/10/2026 hàng Tổng khí than của TH TK2 là #DIV/0!. TK1: hai hàng Tổng
       bằng nhau (42,07 ngày 15/10). Cột m3: TK2 "KHÍ THAN m3", TK1 "Khí than (CO) Nm3
       Thiêu Kết" (KHÔNG lấy cột "... Thiêu kết và phụ trợ") */
    { ten: 'Tiêu hao khí than tích luỹ (khí than)', tong: 'ca', mau: /^tieu hao khi than/, bo0: true,
      tinh: { tuSo: /^khi than( \(co\))? n?m3( thieu ket)?$/, mauSo: /^san luong qtp/, heSo: 1 } }
  ] },
  { khoi: 'QH', cot: [
    { ten: 'Tỉ lệ quặng HLC (QH)', nguon: 'th', mau: /^ti le su dung hlc dq1/ },
    { ten: 'Tỉ lệ quặng HLC tích lũy (QH)', tong: 'th', mau: /^ti le su dung hlc dq1/, bo0: true,
      tinh: { tuSo: /^hlc 1,2,3,4/, mauSo: /^tong kl nnl/ } },
    { ten: 'Tỉ lệ quặng hồi nguội (QH)', nguon: 'th', mau: /^ti le su dung hoi nguoi/ },
    { ten: 'Tỉ lệ quặng hồi nguội tích lũy (QH)', tong: 'th', mau: /^ti le su dung hoi nguoi/, bo0: true,
      tinh: { tuSo: /^hoi nguoi( \(tan\))?$/, mauSo: /^tong kl nnl/ } }
  ] }
];
/* tinh (cột luỹ kế có công thức đơn giản): luỹ kế ca k = heSo x Σ tuSo / Σ mauSo của
   sheet 3 từ ca đầu tháng tới ca k (heSo bỏ trống = 100, ra phần trăm; khí than heSo 1:
   Σ m3 / Σ tấn — 15/10/2026 khớp hàng Tổng sheet 3 cả TK1 42,07 và TK2 45,60).
   Đã đối chiếu 10/10/2026: hàng Tổng của TH (đã sửa
   công thức) = Σ tấn HLC 1,2,3,4 / Σ TỔNG KL NNL, khớp cả 4 ô A, B, C, Tổng của TK1 và
   TK2 (vd TK1 15725 / 121716 = 12,92%); hồi nguội cũng vậy (= cả 3 số Tổng đã chụp
   của TK1 09–10/10). Nên điền được luỹ kế các ca CHƯA có số — kể cả các ca hàng Tổng
   từng ghi sai 0,00 — mà không cần lịch sử phiên bản; ca đã có số giữ nguyên
   (tk12LuyKe_). Mỗi lượt vẫn so số tính của ca mới nhất với hàng Tổng: lệch (công
   thức của file đổi, hàng Tổng lỗi) thì lượt đó KHÔNG điền, giữ số đã ghi. */
/* Cột sản lượng của từng sheet: tìm ca cuối có số (sheet 3) và kiểm hàng Tổng
   (Tổng = A + B + C = cộng mọi ca của bảng — sai thì không ghi luỹ kế lượt đó) */
var TK12_COT_SL = { ca: /^san luong qtp/, th: /^san luong/ };
var TK12_RE_KIP = /^kip$/;
var TK12_RE_NGAY = /^ngay( thang)?$/;
var TK12_RE_SHEET_CA = /^tieu hao tung ca$/;
var TK12_RE_DAU = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

/* ---------------------------------------------------------------------------
 * HÀM CHẠY
 * ------------------------------------------------------------------------- */

/** Chạy tay: đọc 2 file, in tháng / số ca / cột lấy từ đâu / vài hàng mẫu.
 *  KHÔNG gửi gì lên máy chủ. */
function xemThuTK12() { tk12Chay_('xem'); }

/** Chạy tay: đọc file + bước so sánh với máy chủ, KHÔNG gửi số liệu. */
function kiemTraTK12() { tk12Chay_('so-sanh'); }

/** Lượt theo lịch: đọc file đã đổi, gửi phần đổi. Có dây hỏng -> ném lỗi để
 *  "Lượt thực thi" báo Không thành công (Google gửi thư báo lỗi cho chủ dự án).
 *  Khoá tập lệnh: lượt này và dungLaiLuyKeTK12 cùng ghi kho luỹ kế — không cho
 *  hai lượt chạy chồng (lượt đến sau nghỉ, 30 phút sau chạy lại). */
function dayTK12() {
  var khoa = LockService.getScriptLock();
  if (!khoa.tryLock(30000)) { Logger.log('Đang có lượt TK1/TK2 khác chạy — lượt này nghỉ.'); return; }
  var kq;
  try { kq = tk12Chay_('day'); } finally { khoa.releaseLock(); }
  var hong = kq.filter(function (x) { return x.hong; });
  if (hong.length) throw new Error('Đẩy TK1/TK2 hỏng: ' + hong.map(function (x) { return x.chu; }).join(' || '));
}

/** Chạy tay: đẩy lại NGAY cả khi file không đổi — vd vừa dán bản script mới (lượt
 *  theo lịch thấy file không đổi thì nghỉ tới TK12_DOC_LAI_GIO giờ). */
function dayLaiTK12() {
  var kho = PropertiesService.getScriptProperties();
  TK12_TEP.forEach(function (tep) { tk12EpDocLai_(kho, tep.tuyen); });
  dayTK12();
}

/** Lượt đẩy sau của dây tuyen đọc lại file dù file không đổi */
function tk12EpDocLai_(kho, tuyen) {
  var tt = tk12DocJson_(kho, 'tk12:' + tuyen) || {};
  delete tt.phien;
  kho.setProperty('tk12:' + tuyen, JSON.stringify(tt));
}

/** Chạy tay MỘT LẦN: lịch dayTK12 mỗi TK12_CHU_KY_PHUT phút. Chạy lại không bị nhân đôi. */
function caiLichTK12() {
  tk12XoaLich_('dayTK12');
  ScriptApp.newTrigger('dayTK12').timeBased().everyMinutes(TK12_CHU_KY_PHUT).create();
  Logger.log('Đã cài: dayTK12 mỗi ' + TK12_CHU_KY_PHUT + ' phút.');
}

/** Gỡ lịch dayTK12. */
function goLichTK12() {
  tk12XoaLich_('dayTK12');
  Logger.log('Đã gỡ lịch dayTK12.');
}

/* ---------------------------------------------------------------------------
 * DỰNG LẠI LUỸ KẾ CÁC CA ĐÃ QUA — TỪ LỊCH SỬ PHIÊN BẢN CỦA FILE (chạy tay)
 *   Luỹ kế của ca k = số ở hàng Tổng LÚC ca k còn là ca mới nhất. Lượt đẩy chỉ ghi
 *   được số đó từ khi cài bản đọc hàng Tổng, nên các ca trước đó trống. Nhưng Drive
 *   còn giữ các phiên bản cũ của file .xlsx (Tệp -> Lịch sử phiên bản; Drive tự
 *   xoá bớt bản cũ, thường còn ~100 bản gần nhất / 30 ngày): mở lại bản CUỐI CÙNG
 *   lúc ca k còn là ca mới nhất, đọc hàng Tổng của bản đó = đúng số ngày hôm đó.
 *   KHÔNG ước lượng: hàng Tổng của file KHÔNG bằng bình quân gia quyền các ca (vd
 *   vôi nung TK1 10/10: Tổng 91,37, tính lại 93,48 — có cột "sau điều chỉnh"),
 *   nên ca không còn bản nào thì để trống.
 *   Mỗi bản phải tải về + chuyển thành Google Sheet (~10 giây), nên không mở hết:
 *   "ca mới nhất" chỉ tăng theo thời gian -> chia đôi danh sách bản để tìm chỗ nó
 *   đổi, chỉ mở vài chục bản. Mỗi lượt mở tới ~TK12_DUNG_GIAY giây rồi tự hẹn
 *   chạy tiếp sau 1 phút (đã mở bản nào thì nhớ, không mở lại). Xong cả hai dây:
 *   ghi vào kho luỹ kế (tk12lk:...) rồi đẩy lại lên máy chủ ngay.
 *   Cách chạy: xemBanCuTK12 (xem còn bao nhiêu bản, không ghi gì) -> dungLaiLuyKeTK12
 *   (chạy một lần, xem Nhật ký / "Lượt thực thi" tới khi báo XONG).
 * ------------------------------------------------------------------------- */
var TK12_DUNG_GIAY = 240;         /* mỗi lượt dựng lại: quá chừng này giây thì thôi mở bản mới */

/** Chạy tay: mỗi dây còn bao nhiêu phiên bản từ đầu tháng, cũ nhất / mới nhất lúc nào. Không ghi gì. */
function xemBanCuTK12() {
  var thang = tk12HomNay_().substring(0, 7);
  TK12_TEP.forEach(function (tep) {
    var ten = tep.tuyen.toUpperCase(), ds;
    try { ds = tk12DsBan_(tep.id, thang); }
    catch (e) { Logger.log(ten + ': không xem được lịch sử phiên bản — ' + e + ' (tài khoản chạy script cần quyền SỬA file)'); return; }
    Logger.log(ten + ': ' + ds.length + ' phiên bản từ đầu tháng ' + thang
      + (ds.length ? ' — cũ nhất ' + tk12Gio_(ds[0].t) + ', mới nhất ' + tk12Gio_(ds[ds.length - 1].t) : ''));
  });
}

/** Chạy tay MỘT LẦN (tự chạy tiếp tới khi xong) — xem đầu mục. */
function dungLaiLuyKeTK12() {
  tk12XoaLich_('dungLaiLuyKeTK12');
  var batDau = new Date().getTime(), thang = tk12HomNay_().substring(0, 7);
  var kho = PropertiesService.getScriptProperties();
  for (var i = 0; i < TK12_TEP.length; i++) {
    var kq = tk12DungMotDay_(TK12_TEP[i], thang, kho, batDau);
    Logger.log(kq.chu);
    if (!kq.xong) {
      ScriptApp.newTrigger('dungLaiLuyKeTK12').timeBased().after(60 * 1000).create();
      Logger.log('CHƯA XONG — tự chạy tiếp sau 1 phút (xem "Lượt thực thi").');
      return;
    }
  }

  /* Đủ cả hai dây: chép số vào kho luỹ kế. Bỏ ca mới nhất của bản mới nhất —
     ca đó lượt đẩy thường đang ghi theo file hiện tại, mới hơn. Số đọc từ phiên
     bản là số CUỐI của ca đó nên ghi đè số lượt đẩy từng ghi (cột trống thì giữ). */
  var khoa = LockService.getScriptLock();
  khoa.waitLock(120000);
  try {
    TK12_TEP.forEach(function (tep) {
      var V = tk12DocJson_(kho, 'tk12dungv:' + tep.tuyen);
      if (!V || V.thang !== thang || !V.ten || V.ghi) return;
      var khoaLk = 'tk12lk:' + tep.tuyen + ':' + thang;
      var luu = tk12DocJson_(kho, khoaLk);
      if (!luu || !luu.ca || !luu.cot) luu = { cot: V.ten.slice(), ca: {} };
      var soCa = 0;
      for (var k in V.ca) {
        if (k === V.cuoi) continue;
        var moi = V.ca[k].v, cu = luu.ca[k] || [];
        luu.ca[k] = luu.cot.map(function (t, c) {
          var j = V.ten.indexOf(t), x = j >= 0 ? moi[j] : '';
          return x !== '' && x !== null && x !== undefined ? x : (cu[c] !== undefined ? cu[c] : '');
        });
        soCa++;
      }
      kho.setProperty(khoaLk, JSON.stringify(luu));
      V.ghi = true;
      kho.setProperty('tk12dungv:' + tep.tuyen, JSON.stringify(V));
      tk12EpDocLai_(kho, tep.tuyen);       /* khỏi "file không đổi — nghỉ" */
      Logger.log(tep.tuyen.toUpperCase() + ': đã ghi luỹ kế dựng lại cho ' + soCa + ' ca vào ' + khoaLk);
    });
  } finally { khoa.releaseLock(); }
  Logger.log('XONG dựng lại — đẩy lên máy chủ ngay:');
  dayTK12();
}

/** Bỏ dở / làm lại từ đầu việc dựng lại: gỡ lịch tự chạy tiếp + xoá phần đã nhớ
 *  (KHÔNG đụng kho luỹ kế tk12lk:...). */
function huyDungLaiTK12() {
  tk12XoaLich_('dungLaiLuyKeTK12');
  var kho = PropertiesService.getScriptProperties();
  TK12_TEP.forEach(function (tep) { kho.deleteProperty('tk12dungf:' + tep.tuyen); kho.deleteProperty('tk12dungv:' + tep.tuyen); });
  Logger.log('Đã huỷ việc dựng lại luỹ kế.');
}

/** Một dây: tìm + đọc các phiên bản cần (xem đầu mục). Nhớ ở Thuộc tính tập lệnh:
 *    tk12dungf:<tuyến> { thang, f: { mốc giờ bản: số ca mới nhất (ngày*10 + thứ tự ca),
 *                        0 = chưa có ca nào của tháng, -1 = bản không đọc được }, xong }
 *    tk12dungv:<tuyến> { thang, ten: [cột luỹ kế], ca: { 'ngày|ca': { t, v: [số Tổng] } },
 *                        cuoi: ca mới nhất của bản mới nhất, ghi }
 *  Ra { xong, chu }. */
function tk12DungMotDay_(tep, thang, kho, batDau) {
  var ten = tep.tuyen.toUpperCase();
  var khoaF = 'tk12dungf:' + tep.tuyen, khoaV = 'tk12dungv:' + tep.tuyen;
  var F = tk12DocJson_(kho, khoaF), V = tk12DocJson_(kho, khoaV);
  if (!F || F.thang !== thang) F = { thang: thang, f: {} };
  if (!V || V.thang !== thang) V = { thang: thang, ten: null, ca: {}, cuoi: '' };
  if (F.xong) return { xong: true, chu: ten + ': đã dựng xong ở lượt trước' };
  var ds;
  try { ds = tk12DsBan_(tep.id, thang); }
  catch (e) { return { xong: true, chu: ten + ': BỎ QUA — không xem được lịch sử phiên bản: ' + e + ' (tài khoản chạy script cần quyền SỬA file)' }; }
  var thongTin = tk12ThongTinTep_(tep.id);
  if (thongTin.loi) return { xong: true, chu: ten + ': BỎ QUA — ' + thongTin.loi };

  var HET_GIO = {}, BAN_HONG = {}, moMoi = 0;
  var luu = function () { kho.setProperty(khoaF, JSON.stringify(F)); kho.setProperty(khoaV, JSON.stringify(V)); };
  /* Số ca mới nhất của bản i (đọc bản nếu chưa nhớ) */
  var soCaBan = function (i) {
    var k = String(ds[i].t);
    if (F.f.hasOwnProperty(k)) return F.f[k];
    /* mỗi lượt mở ít nhất một bản, kẻo lượt nào cũng hết giờ trước khi mở được gì */
    if (moMoi > 0 && (new Date().getTime() - batDau) / 1000 > TK12_DUNG_GIAY) throw HET_GIO;
    var doc;
    try { doc = tk12DocBan_(tep, ds[i], thongTin.ten); } catch (e) { doc = { loi: String(e) }; }
    moMoi++;
    var so;
    if (doc.loi) so = -1;
    else if (doc.nghi || doc.thang !== thang) so = 0;
    else {
      var p = doc.lk.khoaCuoi.split('|');
      so = (+p[0]) * 10 + (+p[1]);
      if (!V.ten) V.ten = doc.lk.ten.slice();
      if (doc.lk.coTong && JSON.stringify(V.ten) === JSON.stringify(doc.lk.ten)) {
        /* Từng cột: bản MỚI hơn thắng nếu có số; trống thì giữ số bản cũ hơn */
        var cu = V.ca[doc.lk.khoaCuoi], moi = doc.lk.tongNay, t = ds[i].t;
        if (cu) {
          var moiHon = t > cu.t, a = moiHon ? moi : cu.v, b = moiHon ? cu.v : moi;
          moi = a.map(function (x, c) { return x !== '' ? x : b[c]; });
          t = Math.max(t, cu.t);
        }
        V.ca[doc.lk.khoaCuoi] = { t: t, v: moi };
      }
    }
    F.f[k] = so;
    luu();
    return so;
  };

  /* Chia đôi: giai(lo, hi) với số ca của lo, hi đã biết — bằng nhau thì mọi bản
     ở giữa cùng ca đó, khỏi mở; khác thì mở bản giữa. Cuối cùng mỗi chỗ "ca mới
     nhất" đổi là một cặp bản kề nhau đã mở -> bản trước là bản cuối của ca cũ. */
  var chay = function () {
    var L = [];
    for (var i = 0; i < ds.length; i++) if (F.f[String(ds[i].t)] !== -1) L.push(i);
    if (!L.length) return;
    var so = function (j) { var x = soCaBan(L[j]); if (x === -1) throw BAN_HONG; return x; };
    var giai = function (lo, hi) {
      if (hi - lo < 2 || so(lo) === so(hi)) return;
      var giua = (lo + hi) >> 1;
      so(giua);
      giai(lo, giua);
      giai(giua, hi);
    };
    so(L.length - 1);
    so(0);
    giai(0, L.length - 1);
  };
  for (;;) {
    try { chay(); break; }
    catch (e) {
      if (e === BAN_HONG) continue;          /* bỏ bản hỏng khỏi danh sách, chia lại */
      if (e === HET_GIO) return { xong: false, chu: ten + ': đã mở thêm ' + moMoi + ' bản (tổng ' + Object.keys(F.f).length + '/' + ds.length + ' bản tháng ' + thang + ')' };
      throw e;
    }
  }
  /* Ca mới nhất của bản mới nhất đọc được — lượt đẩy thường lo ca này */
  for (var n = ds.length - 1; n >= 0; n--) {
    var x = F.f[String(ds[n].t)];
    if (x === undefined || x === -1) continue;
    V.cuoi = x > 0 ? Math.floor(x / 10) + '|' + (x % 10) : '';
    break;
  }
  F.xong = true;
  luu();
  var hong = 0;
  for (var k2 in F.f) if (F.f[k2] === -1) hong++;
  var cacCa = Object.keys(V.ca).filter(function (x) { return x !== V.cuoi; })
    .sort(function (a, b) { var p = a.split('|'), q = b.split('|'); return (p[0] - q[0]) || (p[1] - q[1]); });
  return { xong: true, chu: ten + ': ' + ds.length + ' phiên bản từ ' + (ds.length ? tk12Gio_(ds[0].t) : '—')
    + ', đã mở ' + Object.keys(F.f).length + (hong ? ' (' + hong + ' bản không đọc được)' : '')
    + ' -> dựng được luỹ kế ' + cacCa.length + ' ca: ' + cacCa.map(function (x) { return x.replace('|', '/ca '); }).join(', ') };
}

/** Các phiên bản của file từ 0 giờ ngày 1 tháng thang (giờ VN), cũ -> mới: [{ id, t }] */
function tk12DsBan_(id, thang) {
  var tu = new Date(thang + '-01T00:00:00+07:00').getTime(), ds = [], trang = '';
  do {
    var thamSo = { fields: 'nextPageToken,revisions(id,modifiedTime)', pageSize: 1000 };
    if (trang) thamSo.pageToken = trang;
    var kq = Drive.Revisions.list(id, thamSo);
    (kq.revisions || []).forEach(function (r) {
      var t = new Date(r.modifiedTime).getTime();
      if (t >= tu) ds.push({ id: r.id, t: t });
    });
    trang = kq.nextPageToken || '';
  } while (trang);
  ds.sort(function (a, b) { return a.t - b.t; });
  return ds;
}

/** Tải một phiên bản (.xlsx), chuyển tạm thành Google Sheet, đọc như tk12DocFile_
 *  (hôm nay = ngày của bản đó -> đoán tháng đúng như lúc ấy), xoá bản tạm. */
function tk12DocBan_(tep, ban, tenTep) {
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + tep.id + '/revisions/' + ban.id + '?alt=media',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { loi: 'tải bản ' + tk12Gio_(ban.t) + ' hỏng: mã ' + res.getResponseCode() };
  var blob = res.getBlob().setContentType(MimeType.MICROSOFT_EXCEL);
  var tam = Drive.Files.create({ name: 'tam-ban-' + tenTep + '-' + ban.t, mimeType: MimeType.GOOGLE_SHEETS }, blob);
  try {
    return tk12DocFile_(SpreadsheetApp.openById(tam.id), Utilities.formatDate(new Date(ban.t), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'));
  } finally {
    try { Drive.Files.remove(tam.id); }
    catch (e) { try { DriveApp.getFileById(tam.id).setTrashed(true); } catch (e2) { Logger.log('Không xoá được bản tạm ' + tam.id + ': ' + e2); } }
  }
}

/** khoi-ngay.gs đọc bảng qua doGet (y như dự án TK3/TK4). Ở đây doGet chỉ trả
 *  bảng mà tk12ChayMotDay_ vừa dựng; gọi từ ngoài (hay dayKhoiNgay) -> báo lỗi. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var doc = TK12_DANG_DOC;
  var kq = doc && p.format === 'compact'
    ? { status: 'success', data: { cols: doc.cols, rows: doc.rows } }
    : { status: 'error', message: 'Dự án TK1/TK2: chạy dayTK12 / kiemTraTK12, không chạy dayKhoiNgay' };
  return ContentService.createTextOutput(JSON.stringify(kq)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------------------
 * PHẦN CHÍNH
 * ------------------------------------------------------------------------- */

/** cheDo: 'xem' | 'so-sanh' | 'day'. Ra [{ hong, chu }] mỗi dây một phần tử. */
function tk12Chay_(cheDo) {
  var homNay = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  var kq = [];
  for (var i = 0; i < TK12_TEP.length; i++) {
    var x;
    try { x = tk12ChayMotDay_(TK12_TEP[i], homNay, cheDo); }
    catch (e) { x = { hong: true, chu: TK12_TEP[i].tuyen.toUpperCase() + ': lỗi — ' + (e && e.stack ? e.stack : e) }; }
    kq.push(x);
    Logger.log(x.chu);
  }
  return kq;
}

function tk12ChayMotDay_(tep, homNay, cheDo) {
  var ten = tep.tuyen.toUpperCase();
  var kho = PropertiesService.getScriptProperties();
  var khoaTT = 'tk12:' + tep.tuyen;
  var tt = {};
  try { tt = JSON.parse(kho.getProperty(khoaTT) || '{}') || {}; } catch (e) { tt = {}; }

  var thongTin = tk12ThongTinTep_(tep.id);
  if (thongTin.loi) return { hong: true, chu: ten + ': ' + thongTin.loi };
  var bayGio = new Date().getTime();
  if (cheDo === 'day' && tt.phien === thongTin.phien && bayGio - (tt.luc || 0) < TK12_DOC_LAI_GIO * 3600000) {
    return { hong: false, chu: ten + ': file không đổi từ lần đẩy trước — nghỉ' };
  }

  var doc = tk12MoTep_(tep.id, thongTin, function (ss) { return tk12DocFile_(ss, homNay); });
  if (doc.nghi) return { hong: false, chu: ten + ' (' + thongTin.ten + '): KHÔNG đẩy — ' + doc.nghi };
  if (doc.loi) return { hong: true, chu: ten + ' (' + thongTin.ten + '): KHÔNG đẩy — ' + doc.loi };

  /* Luỹ kế: số Tổng lượt này cho ca mới nhất + số đã ghi của các ca trước */
  var lk = tk12LuyKe_(doc, tep.tuyen, kho);

  var tom = ten + ' (' + thongTin.ten + '): tháng ' + doc.thang
    + (doc.thangTruoc ? ' (file còn số THÁNG TRƯỚC, chưa sang tháng mới)' : '')
    + ', ' + doc.rows.length + ' ca tới ngày ' + doc.ngayCuoi + ', ' + doc.soO + ' ô'
    + ', luỹ kế đã ghi cho ' + lk.soCa + ' ca' + (doc.lk.coTong ? '' : ' (lượt này không đọc được hàng Tổng)')
    + (doc.ghiChu.length ? ' | ' + doc.ghiChu.join('; ') : '');
  if (cheDo === 'xem') return { hong: false, chu: tom + '\n' + tk12MoTa_(doc) };

  /* Đang đẩy số tháng trước mà số ô ít đi: rất có thể file đang bị xoá dở để
     sang tháng — dừng, không ghi đè số đã có trên máy chủ (kể cả số luỹ kế) */
  if (doc.thangTruoc && tt.thang === doc.thang && doc.soO < (tt.soO || 0)) {
    return { hong: false, chu: tom + ' | KHÔNG đẩy: số ô ít hơn lần trước (' + tt.soO + ') — có thể file đang được xoá để sang tháng mới' };
  }
  /* Lưu số Tổng của ca mới nhất NGAY (kể cả khi gửi hỏng): sang ca sau là mất */
  if (cheDo === 'day') tk12LuuLuyKe_(kho, tep.tuyen, lk);

  /* 1) D1: các khối-ngày đã đổi (khoi-ngay.gs) */
  TK12_DANG_DOC = doc;
  PUSH_URL = TK12_MAY_CHU + '/api/' + tep.tuyen;
  KN_KHONG_XOA_NGAY = doc.thangTruoc;
  var kq;
  try { kq = knChay_(cheDo === 'so-sanh'); }
  finally { TK12_DANG_DOC = null; KN_KHONG_XOA_NGAY = false; }
  if (cheDo !== 'day') return { hong: !kq.ok, chu: tom + '\n  ' + kq.chu };

  /* 2) KV: bản cả bảng (bản nhớ tạm) — gửi kể cả khi bước 1 hỏng */
  var kv = tk12GuiKV_(doc, tt, bayGio);

  /* Chỉ ghi "đã xong phiên bản file này" khi CẢ HAI bước được: hỏng bước nào thì
     lượt sau đọc lại file và làm lại (khỏi chờ file đổi) */
  var ttMoi = { thang: doc.thang, soO: doc.soO, kvDau: kv.dau || tt.kvDau, kvLuc: kv.dau ? bayGio : tt.kvLuc };
  if (kq.ok && kv.ok) { ttMoi.phien = thongTin.phien; ttMoi.luc = bayGio; }
  if (kq.ok) kho.setProperty(khoaTT, JSON.stringify(ttMoi));
  return { hong: !kq.ok || !kv.ok, chu: tom + '\n  ' + kq.chu + '\n  ' + kv.chu };
}

/** Bản cả bảng -> POST /api/<tuyến> -> máy chủ cất nguyên văn vào KV 'sheet:<tuyến>':
 *  bản nhớ tạm / đường lui của dashboard, như TK3/TK4. Máy chủ KHÔNG chép bản này
 *  sang D1 (TUYEN_CHI_KHOI_NGAY) — D1 chỉ nhận qua khối-ngày. Dạng giống doGet cũ
 *  của TK3/TK4: { status, data: [{ tên cột: ô }] } (+ nguon, thang để dễ đọc).
 *  Gói Free chỉ có 1.000 lần ghi KV/ngày cho cả tài khoản, nên chỉ gửi khi bảng
 *  KHÁC lần gửi trước, hoặc đã quá TK12_DOC_LAI_GIO giờ (giữ mốc trên /api/trang-thai).
 *  Ra { ok, chu, dau } — dau chỉ có khi vừa gửi xong. */
function tk12GuiKV_(doc, tt, bayGio) {
  var data = [];
  for (var r = 0; r < doc.rows.length; r++) {
    var o = {};
    for (var c = 0; c < doc.cols.length; c++) o[doc.cols[c]] = doc.rows[r][c];
    data.push(o);
  }
  var than = JSON.stringify({ status: 'success', nguon: 'tk12-nguon.gs', thang: doc.thang, data: data });
  var dau = knMd5_(than);
  if (tt.kvDau === dau && bayGio - (tt.kvLuc || 0) < TK12_DOC_LAI_GIO * 3600000) {
    return { ok: true, chu: 'KV: bảng y nguyên lần gửi trước — khỏi gửi' };
  }
  var cauHinh = knCauHinh_();
  if (cauHinh.loi) return { ok: false, chu: 'KV: ' + cauHinh.loi };
  try {
    var res = UrlFetchApp.fetch(PUSH_URL, {
      method: 'post', contentType: 'application/json', payload: than,
      headers: { 'x-push-key': cauHinh.khoa }, muteHttpExceptions: true
    });
    var ma = res.getResponseCode(), chu = String(res.getContentText()), j = null;
    try { j = JSON.parse(chu); } catch (e) { j = null; }
    if (ma === 200 && j && j.status === 'success') return { ok: true, dau: dau, chu: 'KV: ' + j.message };
    return { ok: false, chu: 'KV hỏng: mã ' + ma + ' — ' + (j && j.message ? j.message : chu.substring(0, 200)) };
  } catch (e) {
    return { ok: false, chu: 'KV: không gửi được — ' + e };
  }
}

/** Đọc 2 sheet của file (đã mở dạng Google Sheet) -> bảng dạng gọn của doGet:
 *  { cols, rows, thang 'YYYY-MM', thangTruoc, ngayCuoi, soO, ghiChu: [], nguonCot,
 *    lk: { ten, viTri, khoaHang, khoaCuoi, tongNay, coTong } }
 *  hoặc { loi } (sai cấu trúc -> báo hỏng) / { nghi } (chưa có gì để đẩy).
 *  Ô luỹ kế để TRỐNG trong rows — tk12LuyKe_ điền từ các số Tổng đã ghi. */
function tk12DocFile_(ss, homNay) {
  var ghiChu = [];
  var cacSheet = ss.getSheets(), shCa = null, shTh = null, shBc = null;
  for (var i = 0; i < cacSheet.length; i++) {
    var tenSh = tk12Chuan_(cacSheet[i].getName());
    if (!shCa && TK12_RE_SHEET_CA.test(tenSh)) shCa = cacSheet[i];
    if (!shTh && tenSh === 'th') shTh = cacSheet[i];
    if (!shBc && tenSh === 'bao cao') shBc = cacSheet[i];
  }
  if (!shCa && cacSheet.length >= 3) {
    shCa = cacSheet[2];
    ghiChu.push('không thấy sheet tên "Tiêu hao từng ca", dùng sheet thứ 3 "' + shCa.getName() + '"');
  }
  if (!shCa) return { loi: 'không thấy sheet "Tiêu hao từng ca"' };
  if (!shTh) return { loi: 'không thấy sheet "TH"' };

  var bCa = tk12DocBang_(shCa), bTh = tk12DocBang_(shTh);
  if (bCa.loi) return { loi: bCa.loi };
  if (bTh.loi) return { loi: bTh.loi };
  var bang = { ca: bCa, th: bTh };

  /* Tìm cột nguồn. Thiếu cột nào thì DỪNG: đẩy với cột trống là xoá số cũ của
     chỉ tiêu đó (máy chủ thay trọn khối-ngày) */
  var thieu = [], nguonCot = [];
  var tim = function (nguon, mau, tenRa) {
    var b = bang[nguon], thay = [];
    for (var c = 0; c < b.tieuDe.length; c++) if (mau.test(b.tieuDe[c])) thay.push(c);
    if (!thay.length) { thieu.push(tenRa + ' (sheet ' + b.ten + ', mẫu ' + mau + ')'); return -1; }
    if (thay.length > 1) ghiChu.push(tenRa + ': ' + thay.length + ' cột khớp ở sheet ' + b.ten + ', lấy cột đầu');
    nguonCot.push(tenRa + ' <- ' + b.ten + ': "' + b.tieuDeGoc[thay[0]] + '"');
    return thay[0];
  };
  var iSL = { ca: tim('ca', TK12_COT_SL.ca, 'sản lượng sheet 3'), th: tim('th', TK12_COT_SL.th, 'sản lượng sheet TH') };
  /* Cột của luỹ kế tính (tinh): thiếu thì chỉ thôi tính, không chặn cả lượt đẩy */
  var timNhe = function (mau, tenRa) {
    for (var c = 0; c < bCa.tieuDe.length; c++) if (mau.test(bCa.tieuDe[c])) return c;
    ghiChu.push(tenRa + ': không thấy cột ' + mau + ' ở sheet 3 — lượt này không tính, giữ số đã ghi');
    return -1;
  };
  var khoi = [];
  for (var k = 0; k < TK12_KHOI.length; k++) {
    var cot = [];
    for (var j = 0; j < TK12_KHOI[k].cot.length; j++) {
      var x = TK12_KHOI[k].cot[j];
      cot.push({ ten: x.ten, nguon: x.nguon, tong: x.tong, bo0: x.bo0 === true,
                 i: tim(x.nguon || x.tong, x.mau, x.ten + (x.tong ? ' (hàng Tổng)' : '')),
                 tinh: x.tinh ? { tu: timNhe(x.tinh.tuSo, x.ten), mau: timNhe(x.tinh.mauSo, x.ten),
                                  heSo: x.tinh.heSo === undefined ? 100 : x.tinh.heSo } : null });
    }
    khoi.push({ khoi: TK12_KHOI[k].khoi, cot: cot });
  }
  if (thieu.length) return { loi: 'không thấy cột: ' + thieu.join('; ') };

  /* Hàng Tổng của sheet nào khớp bảng ca thì mới lấy luỹ kế từ sheet đó */
  var tongLoi = {};
  for (var n in bang) {
    tongLoi[n] = tk12KiemTong_(bang[n], iSL[n]);
    if (tongLoi[n]) ghiChu.push('hàng Tổng sheet ' + bang[n].ten + ': ' + tongLoi[n] + ' — lượt này không ghi luỹ kế từ sheet đó');
  }

  /* Hàng TH theo (ngày, thứ tự ca trong ngày) — ghép với sheet 3 theo vị trí,
     vì cột kíp của TH có thể bỏ trống (TK2 ngày 31) */
  var thTheo = {};
  for (var t = 0; t < bTh.ca.length; t++) thTheo[bTh.ca[t].ngay + '|' + bTh.ca[t].thu] = bTh.ca[t];

  /* Ca cuối có sản lượng */
  var iCuoi = -1;
  for (var a = 0; a < bCa.ca.length; a++) if (tk12OSo_(bCa, bCa.ca[a].r, iSL.ca) !== null) iCuoi = a;
  if (iCuoi < 0) return { nghi: 'chưa có ca nào có sản lượng (file đang trống hoặc vừa xoá để sang tháng mới)' };
  var ngayCuoi = bCa.ca[iCuoi].ngay;

  /* Tháng của số liệu (xem đầu file) */
  var nam = +homNay.substring(0, 4), thang = +homNay.substring(5, 7), ngayNay = +homNay.substring(8, 10);
  var thangTruoc = ngayCuoi > ngayNay;
  if (thangTruoc) {
    if (ngayNay > TK12_NGAY_GIA_HAN) {
      return { nghi: 'file vẫn còn số tới ngày ' + ngayCuoi + ' của tháng trước mà hôm nay đã ngày ' + ngayNay
        + ' — chờ bên xưởng sang tháng mới' };
    }
    thang--;
    if (!thang) { thang = 12; nam--; }
  }
  if (ngayCuoi > new Date(Date.UTC(nam, thang, 0)).getUTCDate()) {
    return { loi: 'có số tới ngày ' + ngayCuoi + ' nhưng tháng ' + thang + '/' + nam + ' không có ngày đó' };
  }
  var thangIso = nam + '-' + tk12Hai_(thang);
  var tieuDe = shBc ? tk12ThangTieuDe_(shBc) : null;
  if (tieuDe && tieuDe !== thangIso) ghiChu.push('tiêu đề sheet Báo cáo ghi tháng ' + tieuDe + ' (chỉ để đối chiếu)');

  /* Dựng bảng: mỗi ca từ đầu tháng tới ca cuối có sản lượng là một hàng; mỗi
     khối mở bằng cặp "Thời gian (khối)" | "Ca/kíp (khối)" như sheet TK3/TK4.
     Cột luỹ kế: ghi vị trí + số Tổng lượt này, ô trong hàng để trống. */
  var cols = [], lk = { ten: [], viTri: [], khoaHang: [], tongNay: [], tinh: [] };
  for (var b = 0; b < khoi.length; b++) {
    cols.push('Thời gian (' + khoi[b].khoi + ')', 'Ca/kíp (' + khoi[b].khoi + ')');
    for (var c2 = 0; c2 < khoi[b].cot.length; c2++) {
      var y = khoi[b].cot[c2];
      if (y.tong) {
        var bt = bang[y.tong], vt = '';
        if (!tongLoi[y.tong]) {
          vt = tk12OHien_(bt, bt.iTong, y.i);
          if (y.bo0 && tk12OSo_(bt, bt.iTong, y.i) === 0) vt = '';
        }
        lk.ten.push(y.ten); lk.viTri.push(cols.length); lk.tongNay.push(vt);
        lk.tinh.push(y.tinh ? tk12TinhLuyKe_(bCa, iCuoi, y, vt, ghiChu) : null);
      }
      cols.push(y.ten);
    }
  }
  var rows = [], soO = 0, lechKip = [], boKip = [], bo0 = 0;
  for (var h = 0; h <= iCuoi; h++) {
    var ca = bCa.ca[h], th = thTheo[ca.ngay + '|' + ca.thu] || null;
    if (th && th.kip && ca.kip && th.kip !== ca.kip) lechKip.push(ca.ngay + ' ca ' + ca.thu + ' (' + ca.kip + '/' + th.kip + ')');
    if (!/^[A-D]$/.test(ca.kip)) { boKip.push(ca.ngay + ' ca ' + ca.thu); continue; }
    var ngayChu = tk12Hai_(ca.ngay) + '/' + tk12Hai_(thang) + '/' + nam;
    var row = [];
    for (var b2 = 0; b2 < khoi.length; b2++) {
      row.push(ngayChu, ca.kip);
      for (var c3 = 0; c3 < khoi[b2].cot.length; c3++) {
        var x2 = khoi[b2].cot[c3], o = '';
        if (x2.nguon) {
          var bb = bang[x2.nguon], hh = x2.nguon === 'ca' ? ca : th;
          if (hh) {
            o = tk12OHien_(bb, hh.r, x2.i);
            if (x2.bo0 && tk12OSo_(bb, hh.r, x2.i) === 0) { o = ''; bo0++; }
          }
        }
        if (o !== '') soO++;
        row.push(o);
      }
    }
    rows.push(row);
    lk.khoaHang.push(ca.ngay + '|' + ca.thu);
  }
  if (lechKip.length) return { loi: 'kíp sheet TH lệch sheet 3 ở ' + lechKip.slice(0, 5).join(', ') + ' — hai sheet không cùng thứ tự ca' };
  if (boKip.length) ghiChu.push('bỏ ' + boKip.length + ' ca trống kíp: ' + boKip.slice(0, 5).join(', '));
  if (bo0) ghiChu.push(bo0 + ' ô suất tiêu hao = 0 (số gốc chưa nhập) để trống');
  if (!rows.length) return { nghi: 'không có ca nào có kíp' };
  lk.khoaCuoi = bCa.ca[iCuoi].ngay + '|' + bCa.ca[iCuoi].thu;
  lk.coTong = lk.tongNay.some(function (v) { return v !== ''; });
  return { cols: cols, rows: rows, thang: thangIso, thangTruoc: thangTruoc, ngayCuoi: ngayCuoi, soO: soO,
           ghiChu: ghiChu, nguonCot: nguonCot, lk: lk };
}

/** Luỹ kế TÍNH của một cột (xem "tinh" dưới TK12_KHOI): heSo x Σ tử / Σ mẫu của sheet 3
 *  từ ca đầu tháng tới từng ca (ô trống = 0, như công thức của file). y.tinh = { tu,
 *  mau, heSo } (tu, mau là vị trí cột); tongHien = ô hàng Tổng lượt này ('' = trống / lỗi / 0).
 *  Ra { ok, theoCa: { 'ngày|ca': chữ số 2 lẻ } } — ok chỉ khi số tính của ca mới nhất
 *  khớp hàng Tổng (làm tròn 2 lẻ); không khớp thì ghi lý do vào ghiChu. */
function tk12TinhLuyKe_(bCa, iCuoi, y, tongHien, ghiChu) {
  var ra = { ok: false, theoCa: {} };
  if (y.tinh.tu < 0 || y.tinh.mau < 0) return ra;
  var phay = /,\d+$/.test(tongHien) && tongHien.indexOf('.') < 0;   /* viết số cùng kiểu với ô Tổng */
  var tu = 0, mau = 0, cuoi = null;
  for (var h = 0; h <= iCuoi; h++) {
    var ca = bCa.ca[h];
    tu += tk12OSo_(bCa, ca.r, y.tinh.tu) || 0;
    mau += tk12OSo_(bCa, ca.r, y.tinh.mau) || 0;
    if (mau <= 0) continue;
    cuoi = Math.round(100 * y.tinh.heSo * tu / mau) / 100;
    var chu = cuoi.toFixed(2);
    ra.theoCa[ca.ngay + '|' + ca.thu] = phay ? chu.replace('.', ',') : chu;
  }
  var tong = tongHien === '' ? null : tk12DocSo_(tongHien);
  if (tong === null) {
    ghiChu.push(y.ten + ': hàng Tổng trống / lỗi — lượt này không ghi luỹ kế tính, giữ số đã ghi');
  } else if (cuoi === null || Math.abs(cuoi - tong) > 0.006) {
    ghiChu.push(y.ten + ': tính ' + (cuoi === null ? '(không có)' : cuoi.toFixed(2)) + ' khác hàng Tổng ' + tongHien
      + ' — công thức của file đã đổi? lượt này không ghi luỹ kế tính, giữ số đã ghi');
  } else {
    ra.ok = true;
  }
  return ra;
}

/** Hàng Tổng của sheet b có đúng là luỹ kế của bảng ca hiện tại không:
 *  sản lượng Tổng > 0, = A + B + C, = cộng sản lượng mọi ca trong bảng.
 *  Ra '' nếu khớp, không thì lý do (vd file đang được sửa dở, công thức Tổng
 *  không phủ hết các hàng). */
function tk12KiemTong_(b, iSL) {
  if (b.iTong < 0) return 'không thấy (dưới bảng kíp A, B, C)';
  var tong = tk12OSo_(b, b.iTong, iSL);
  if (!tong || tong <= 0) return 'sản lượng Tổng trống hoặc 0';
  var abc = 0, cong = 0;
  for (var i = 1; i <= 3; i++) abc += tk12OSo_(b, b.iTong - i, iSL) || 0;
  for (var j = 0; j < b.ca.length; j++) cong += tk12OSo_(b, b.ca[j].r, iSL) || 0;
  var lech = function (x) { return Math.abs(x - tong) > Math.max(1, tong * 0.001); };
  if (lech(abc)) return 'sản lượng Tổng ' + tong + ' khác A + B + C = ' + abc;
  if (lech(cong)) return 'sản lượng Tổng ' + tong + ' khác cộng các ca = ' + cong;
  return '';
}

/** LUỸ KẾ THEO CA (xem "tong" ở đầu file): ghi số Tổng lượt này cho ca mới nhất
 *  (doc.lk.khoaCuoi), rồi điền ô luỹ kế của mọi hàng từ các số đã ghi; cộng các
 *  ô đó vào doc.soO. Chưa LƯU — gọi tk12LuuLuyKe_ với kết quả khi muốn lưu.
 *  Lưu ở Thuộc tính tập lệnh 'tk12lk:<tuyến>:<YYYY-MM>':
 *    { cot: [tên cột luỹ kế], ca: { 'ngày|thứ tự ca': [số theo cot] } }
 *  ĐỪNG XOÁ các thuộc tính này: mất là lượt đẩy sau gửi luỹ kế các ca cũ trống
 *  -> máy chủ xoá theo. Ra { khoa, luu, doi, soCa }. */
function tk12LuyKe_(doc, tuyen, kho) {
  var lk = doc.lk, khoa = 'tk12lk:' + tuyen + ':' + doc.thang, luu = null;
  try { luu = JSON.parse(kho.getProperty(khoa) || 'null'); } catch (e) { luu = null; }
  if (!luu || !luu.ca || !luu.cot) luu = { cot: lk.ten.slice(), ca: {} };
  /* Danh sách cột luỹ kế đổi (thêm / bớt cột): sắp lại số đã ghi theo tên cột */
  if (JSON.stringify(luu.cot) !== JSON.stringify(lk.ten)) {
    var sap = {};
    for (var k in luu.ca) {
      sap[k] = lk.ten.map(function (t) { var i = luu.cot.indexOf(t); return i >= 0 ? luu.ca[k][i] : ''; });
    }
    luu = { cot: lk.ten.slice(), ca: sap };
  }
  /* Ghi đè TỪNG CỘT đọc được lượt này; cột không đọc được (hàng Tổng của sheet
     đó không khớp, ô trống) giữ số đã ghi trước — không xoá luỹ kế vì một lượt lỗi */
  var doi = false;
  if (lk.coTong) {
    var cu = luu.ca[lk.khoaCuoi] || null;
    var moi = lk.tongNay.map(function (v, c) { return v !== '' ? v : (cu && cu[c] !== undefined ? cu[c] : ''); });
    if (JSON.stringify(moi) !== JSON.stringify(cu)) { luu.ca[lk.khoaCuoi] = moi; doi = true; }
  }
  /* Cột luỹ kế tính (tk12TinhLuyKe_) đã khớp hàng Tổng: điền số tính cho các ca CHƯA
     có số (vd HLC các ca hàng Tổng từng ghi 0,00). Ca đã có số giữ nguyên — luỹ kế
     ngày nào là số của ngày đó, như mọi cột luỹ kế (số gốc ca cũ sửa về sau thì số
     tính lại sẽ khác: 08/10 hàng Tổng hồi nguội TK1 ghi 18,76, tính bằng số 10/10
     ra 18,88). Ca mới nhất đã có số Tổng ở trên. Không khớp thì không đụng. */
  for (var c0 = 0; c0 < lk.ten.length; c0++) {
    var t = lk.tinh && lk.tinh[c0];
    if (!t || !t.ok) continue;
    for (var k0 in t.theoCa) {
      var h0 = luu.ca[k0] || lk.ten.map(function () { return ''; });
      if (h0[c0] !== '' && h0[c0] !== null && h0[c0] !== undefined) continue;
      h0[c0] = t.theoCa[k0];
      luu.ca[k0] = h0;
      doi = true;
    }
  }
  for (var r = 0; r < doc.rows.length; r++) {
    var v = luu.ca[lk.khoaHang[r]];
    if (!v) continue;
    for (var c = 0; c < lk.viTri.length; c++) {
      if (v[c] === '' || v[c] === null || v[c] === undefined) continue;
      doc.rows[r][lk.viTri[c]] = v[c];
      doc.soO++;
    }
  }
  return { khoa: khoa, luu: luu, doi: doi, soCa: Object.keys(luu.ca).length };
}

/** Lưu số luỹ kế vừa ghi (tk12LuyKe_), chỉ giữ tháng này và tháng trước. */
function tk12LuuLuyKe_(kho, tuyen, kq) {
  if (!kq.doi) return;
  kho.setProperty(kq.khoa, JSON.stringify(kq.luu));
  var thang = kq.khoa.substring(kq.khoa.length - 7);
  var y = +thang.substring(0, 4), m = +thang.substring(5, 7) - 1;
  if (!m) { m = 12; y--; }
  var giu = [kq.khoa, 'tk12lk:' + tuyen + ':' + y + '-' + tk12Hai_(m)];
  var dau = 'tk12lk:' + tuyen + ':';
  kho.getKeys().forEach(function (k) { if (k.indexOf(dau) === 0 && giu.indexOf(k) < 0) kho.deleteProperty(k); });
}

/** Một sheet -> { ten, tieuDe: [tên cột đã chuẩn], tieuDeGoc, gt, hien,
 *  ca: [{ ngay, thu, kip, r }] } hoặc { loi }.
 *  Hàng tiêu đề = hàng đầu có ô "Kíp". Bảng ca bắt đầu ở hàng có ngày 1..31,
 *  mỗi ngày tối đa TK12_CA_MOI_NGAY hàng (ô ngày gộp -> hàng sau trống ngày);
 *  hết bảng khi ngày quay lui hoặc đủ ca mà hàng sau không ghi ngày mới (bên
 *  dưới là bảng tổng theo kíp, bảng nhiệt trị... — không đọc). */
function tk12DocBang_(sh) {
  var ten = sh.getName();
  var nR = Math.min(sh.getLastRow(), TK12_SO_HANG_DOC), nC = sh.getLastColumn();
  if (nR < 3 || nC < 3) return { loi: 'sheet "' + ten + '" trống' };
  var vung = sh.getRange(1, 1, nR, nC);
  var gt = vung.getValues(), hien = vung.getDisplayValues();
  var iTD = -1, iKip = -1, iNgay = -1;
  for (var r = 0; r < Math.min(nR, 10) && iTD < 0; r++) {
    for (var c = 0; c < nC; c++) if (TK12_RE_KIP.test(tk12Chuan_(hien[r][c]))) { iTD = r; iKip = c; break; }
  }
  if (iTD < 0) return { loi: 'sheet "' + ten + '": không thấy hàng tiêu đề (ô "Kíp")' };
  var tieuDe = [], tieuDeGoc = [];
  for (var c2 = 0; c2 < nC; c2++) {
    var goc = String(hien[iTD][c2]).replace(/\s+/g, ' ').trim();
    tieuDeGoc.push(goc);
    tieuDe.push(tk12Chuan_(goc));
    if (iNgay < 0 && TK12_RE_NGAY.test(tieuDe[c2])) iNgay = c2;
  }
  if (iNgay < 0) return { loi: 'sheet "' + ten + '": không thấy cột "Ngày"' };

  var ca = [], ngay = 0, thu = 0;
  for (var r2 = iTD + 1; r2 < nR; r2++) {
    var d = tk12SoNgay_(gt[r2][iNgay]);
    if (d) {
      if (d <= ngay) break;
      ngay = d; thu = 0;
    } else if (!ngay) continue;
    else if (thu >= TK12_CA_MOI_NGAY) break;
    thu++;
    ca.push({ ngay: ngay, thu: thu, kip: String(hien[r2][iKip]).trim().toUpperCase(), r: r2 });
  }
  if (!ca.length) return { loi: 'sheet "' + ten + '": không thấy hàng ngày 1..31 nào' };

  /* Hàng TỔNG: ngay dưới bảng tổng theo kíp — ba hàng liền nhau ghi A, B, C (ở cột
     STT / Kíp / Ngày tuỳ sheet), hàng kế tiếp là Tổng (TK1 ghi chữ "Tổng", TK2 để
     trống). Tìm trong 15 hàng sau bảng ca; tk12KiemTong_ kiểm lại bằng sản lượng. */
  var cotNhan = Math.max(iKip, iNgay);
  var nhan = function (r) {
    for (var c = 0; c <= cotNhan; c++) { var v = tk12Chuan_(hien[r][c]); if (/^[abc]$/.test(v)) return v; }
    return '';
  };
  var iTong = -1, sau = ca[ca.length - 1].r + 1;
  for (var r3 = sau; r3 + 3 < nR && r3 < sau + 15 && iTong < 0; r3++) {
    if (nhan(r3) === 'a' && nhan(r3 + 1) === 'b' && nhan(r3 + 2) === 'c') iTong = r3 + 3;
  }
  return { ten: ten, tieuDe: tieuDe, tieuDeGoc: tieuDeGoc, gt: gt, hien: hien, ca: ca, iTong: iTong };
}

/* ---------------------------------------------------------------------------
 * DRIVE: thông tin file, chép tạm thành Google Sheet
 * ------------------------------------------------------------------------- */

function tk12ThongTinTep_(id) {
  var f;
  try {
    f = Drive.Files.get(id, { fields: 'id,name,mimeType,modifiedTime,md5Checksum', supportsAllDrives: true });
  } catch (e) {
    return { loi: 'không mở được file trên Drive (' + id + ') — tài khoản này có quyền xem file không? ' + e };
  }
  if (!f.modifiedTime) return { loi: 'Drive API phải là phiên bản v3 (Dịch vụ -> Drive API -> v3)' };
  return { ten: f.name, laSheet: f.mimeType === MimeType.GOOGLE_SHEETS,
           phien: f.modifiedTime + '|' + (f.md5Checksum || '') };
}

/** Mở file dạng Google Sheet rồi gọi viec(ss). File .xlsx: chép tạm một bản
 *  chuyển sang Google Sheet, đọc xong xoá bản tạm (kể cả khi lỗi). */
function tk12MoTep_(id, thongTin, viec) {
  if (thongTin.laSheet) return viec(SpreadsheetApp.openById(id));
  var tam = Drive.Files.copy({ name: 'tam-' + thongTin.ten + '-' + new Date().getTime(), mimeType: MimeType.GOOGLE_SHEETS },
                             id, { supportsAllDrives: true });
  try {
    return viec(SpreadsheetApp.openById(tam.id));
  } finally {
    try { Drive.Files.remove(tam.id); }
    catch (e) { try { DriveApp.getFileById(tam.id).setTrashed(true); } catch (e2) { Logger.log('Không xoá được bản tạm ' + tam.id + ': ' + e2); } }
  }
}

/* ---------------------------------------------------------------------------
 * HÀM NHỎ
 * ------------------------------------------------------------------------- */

/** Bỏ dấu tiếng Việt, viết thường, gộp khoảng trắng: 'Tiêu hao đá vôi(kg/tsp)' -> 'tieu hao da voi(kg/tsp)' */
function tk12Chuan_(s) {
  return String(s === null || s === undefined ? '' : s).normalize('NFD').replace(TK12_RE_DAU, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Ô ngày -> 1..31, không phải -> 0. Ô là ngày thật (kiểu Date) thì lấy ngày trong tháng. */
function tk12SoNgay_(v) {
  if (v instanceof Date) return v.getDate();
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!/^\d{1,2}$/.test(s)) return 0;
  var d = +s;
  return d >= 1 && d <= 31 ? d : 0;
}

/** Ô gửi lên: chữ đúng như sheet hiện (máy chủ tự đọc số, như đường TK3/TK4);
 *  ô trống và ô lỗi công thức (#DIV/0!...) -> '' */
function tk12OHien_(b, r, c) {
  var s = String(b.hien[r][c] === null || b.hien[r][c] === undefined ? '' : b.hien[r][c]).trim();
  return !s || s.charAt(0) === '#' ? '' : s;
}

/** Ô -> số (để tính luỹ kế, tìm ca cuối), không phải số -> null. Ô định dạng %
 *  lưu 0,118 nhưng hiện 11,8% -> lấy theo số đang hiện. */
function tk12OSo_(b, r, c) {
  if (c < 0) return null;
  var v = b.gt[r][c], hien = String(b.hien[r][c] || '').trim();
  if (hien === '' || hien.charAt(0) === '#') return null;
  if (typeof v === 'number' && isFinite(v)) return /%$/.test(hien) ? v * 100 : v;
  return tk12DocSo_(hien);
}

/** Chuỗi số kiểu '6,205.00' / '59,47' / '1.234,5' -> số; không đọc được -> null */
function tk12DocSo_(s) {
  var t = String(s).replace(/\s|%/g, '');
  if (!/^-?[\d.,]+$/.test(t)) return null;
  var cham = t.lastIndexOf('.'), phay = t.lastIndexOf(',');
  if (cham >= 0 && phay >= 0) {
    var tp = cham > phay ? '.' : ',';
    t = t.split(tp === '.' ? ',' : '.').join('').replace(tp, '.');
  } else if (cham >= 0 || phay >= 0) {
    var dau = cham >= 0 ? '.' : ',', phan = t.replace(/^-/, '').split(dau);
    var thapPhan = phan.length === 2 && (phan[1].length !== 3 || /^0*$/.test(phan[0]));
    t = thapPhan ? t.replace(dau, '.') : t.split(dau).join('');
  }
  var n = Number(t);
  return isFinite(n) ? n : null;
}

/** Tháng ghi trong tiêu đề sheet Báo cáo ("... THÁNG 10/2026") -> '2026-10' hoặc null */
function tk12ThangTieuDe_(sh) {
  var nR = Math.min(sh.getLastRow(), 5), nC = Math.min(sh.getLastColumn(), 20);
  if (nR < 1 || nC < 1) return null;
  var v = sh.getRange(1, 1, nR, nC).getDisplayValues();
  for (var r = 0; r < v.length; r++) for (var c = 0; c < v[r].length; c++) {
    var m = tk12Chuan_(v[r][c]).match(/thang\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/);
    if (m && +m[1] >= 1 && +m[1] <= 12) return m[2] + '-' + tk12Hai_(+m[1]);
  }
  return null;
}

function tk12Hai_(n) { return (n < 10 ? '0' : '') + n; }

/** Mô tả bảng cho xemThuTK12: cột lấy từ đâu + 2 ca đầu, 2 ca cuối */
function tk12MoTa_(doc) {
  var dong = ['  Cột lấy từ đâu:'];
  for (var i = 0; i < doc.nguonCot.length; i++) dong.push('    ' + doc.nguonCot[i]);
  var tong = [];
  for (var t = 0; t < doc.lk.ten.length; t++) tong.push(doc.lk.ten[t] + '=' + (doc.lk.tongNay[t] === '' ? '(trống)' : doc.lk.tongNay[t]));
  dong.push('  Hàng Tổng lượt này (ghi làm luỹ kế cho ca ' + doc.lk.khoaCuoi.replace('|', ' thứ ') + '): ' + tong.join(' | '));
  var chon = doc.rows.length <= 4 ? doc.rows : doc.rows.slice(0, 2).concat(doc.rows.slice(-2));
  dong.push('  Hàng mẫu (2 ca đầu, 2 ca cuối):');
  for (var r = 0; r < chon.length; r++) {
    var o = [];
    for (var c = 0; c < doc.cols.length; c++) {
      if (/^(Thời gian|Ca\/kíp) \(/.test(doc.cols[c]) || chon[r][c] === '') continue;
      o.push(doc.cols[c] + '=' + chon[r][c]);
    }
    dong.push('    ' + chon[r][0] + ' kíp ' + chon[r][1] + ': ' + o.join(' | '));
  }
  return dong.join('\n');
}

/** Gỡ mọi lịch chạy hàm tenHam của dự án */
function tk12XoaLich_(tenHam) {
  var cu = ScriptApp.getProjectTriggers();
  for (var i = 0; i < cu.length; i++) if (cu[i].getHandlerFunction() === tenHam) ScriptApp.deleteTrigger(cu[i]);
}

function tk12HomNay_() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'); }

/** Mốc giờ (ms) -> 'dd/MM HH:mm' giờ VN, cho nhật ký */
function tk12Gio_(t) { return Utilities.formatDate(new Date(t), 'Asia/Ho_Chi_Minh', 'dd/MM HH:mm'); }

function tk12DocJson_(kho, khoa) {
  try { return JSON.parse(kho.getProperty(khoa) || 'null'); } catch (e) { return null; }
}
