/* =============================================================================
 * APPS SCRIPT — ĐẨY DANH SÁCH NHÂN SỰ 3 KÍP TỪ SHEET CỦA XƯỞNG LÊN CLOUDFLARE
 * =============================================================================
 * DỰ ÁN APPS SCRIPT RIÊNG — không dính gì tới dự án / sheet TK3, TK4. File này tự
 * đủ, không cần file nào khác.
 *
 * LÀM GÌ
 *   Đọc "Danh sách định biên nhân sự" của xưởng — các tab có tên kết thúc bằng
 *   "KIP A", "KIP B", "KIP C" — lấy đúng 3 thứ mỗi người: HỌ TÊN, VỊ TRÍ, TRẠNG
 *   THÁI, rồi gửi lên POST /api/nhan-su (db/nhan-su.mjs). Máy chủ cất vào bảng
 *   riêng nhan_su_xuong; trang web tải ở /api/v2/nhan-su và vẽ sơ đồ 3 kíp, giao
 *   diện y như cũ. Thay hẳn cho việc chép tay vào các cột 'STT (A)', 'Mã nhân
 *   viên (A)'... của tab DATABASE trong sheet TK3 (các cột đó xoá được).
 *   KHÔNG đọc, KHÔNG gửi: mã NV, ngày sinh, quê quán, SĐT, lương, kỷ luật...
 *
 * ĐỌC SHEET THẾ NÀO
 *   - Tìm hàng tiêu đề có ô "STT" và "HỌ TÊN"; cột tìm THEO TÊN tiêu đề, nên xưởng
 *     chèn / xoá / đổi chỗ các cột khác không ảnh hưởng.
 *   - Một người = hàng có STT là số VÀ có họ tên. Bỏ qua: hàng tên nhóm ("TỔ
 *     THIÊU KẾT"), hàng trống, bảng tổng cuối tab, vị trí còn trống (có STT mà
 *     chưa có tên).
 *   - Cột KÍP ghi "HC" (Quản đốc, Phó quản đốc — hành chính) -> bỏ: trang chỉ
 *     có 3 kíp A / B / C.
 *   - Người có GHI CHÚ NGHỈ VIỆC -> bỏ. Xét mọi cột tiêu đề bắt đầu bằng "Ghi chú"
 *     (tab nào cũng có vài cột như vậy) và cột "Làm việc": ô nào chứa "nghỉ việc"
 *     hay "thôi việc" (viết hoa/thường, có dấu hay không đều nhận) là loại, vd
 *     "Nghỉ việc", "Đã nghỉ việc từ 15/10". TRỪ "nghỉ việc riêng" (nghỉ phép vài
 *     ngày, vẫn là người của kíp). Chỉ đọc để xét, không gửi nội dung ghi chú đi.
 *     Đổi từ khoá: NHAN_SU_RE_NGHI.
 *   - Ô GỘP (merge, vd 2 người chung một ô vị trí) được trải ra mọi hàng của nó.
 *   - Vị trí = cột "ĐỊNH BIÊN NHÂN SỰ", gọt phần đuôi "- Kíp A - Xưởng Thiêu kết 2"
 *     và thống nhất cách viết (KTV -> Kỹ thuật viên, "sàn phân" -> "sàng phân"...)
 *     để người cùng vị trí ở 3 kíp vào chung một hộp trên sơ đồ (nhanSuViTri_).
 *     Riêng Kíp trưởng / Kíp phó: theo cột "ĐỊNH BIÊN VỊ TRÍ" nếu ô đó ghi vậy
 *     (người đang ngồi ghế kíp phó dù chức danh là kỹ sư).
 *   - Thứ tự người = thứ tự trên sheet (máy chủ đánh STT 1, 2, 3... theo đó).
 *
 * CÀI ĐẶT (làm một lần)
 *   1) Mở script.google.com -> Dự án mới -> đặt tên, vd "Nhân sự XTK2".
 *      Cài đặt dự án (bánh răng bên trái) -> Múi giờ: (GMT+07:00) Asia/Ho_Chi_Minh.
 *   2) Tệp Code.gs: xoá hết, dán toàn bộ file này -> Lưu.
 *   3) Cài đặt dự án -> Thuộc tính tập lệnh -> Thêm 2 dòng:
 *        NHAN_SU_SHEET = link sheet nhân sự của xưởng (dán nguyên link được)
 *        PUSH_KEY      = đúng khoá đẩy đang dùng (giống PUSH_KEY ở dự án TK1/TK2
 *                        hay TK3 — cùng một chuỗi bí mật đã đặt trên Cloudflare)
 *      KHÔNG ghi link hay khoá vào file này: file nằm trong mã nguồn của dashboard.
 *   4) Chọn hàm kiemTraNhanSu -> Chạy -> cấp quyền (Google hỏi quyền xem bảng
 *      tính và kết nối ra ngoài) -> xem Nhật ký: sĩ số từng kíp, các vị trí,
 *      người bị bỏ (nghỉ việc, HC...). Bước này KHÔNG gửi gì.
 *   5) Khi máy chủ đã có bản mới (đã npm run db:schema + npm run deploy): chạy
 *      dayNhanSu -> Nhật ký phải ghi "đã gửi: ... người".
 *   6) Chạy caiLichNhanSu: từ nay tự gửi mỗi giờ. Gỡ lịch: goLichNhanSu.
 *   (Muốn gắn thẳng vào sheet nhân sự thay vì dự án riêng: mở sheet -> Tiện ích
 *   mở rộng -> Apps Script, dán file này, chỉ cần PUSH_KEY — bỏ trống
 *   NHAN_SU_SHEET thì script đọc chính sheet nó gắn vào. Nhưng ai có quyền sửa
 *   sheet cũng xem được dự án đó, nên dự án riêng an toàn hơn.)
 *
 * NẾU LỖI
 *   - "không có quyền" khi mở sheet: tài khoản Google chạy script chưa được xem
 *     sheet của xưởng -> xin quyền Xem cho tài khoản đó.
 *   - Mã 404 "máy chủ chưa có /api/nhan-su": chưa deploy bản mới.
 *   - Mã 401: PUSH_KEY sai.
 *   - Mã 503 "chưa có bảng nhan_su_xuong": chưa chạy npm run db:schema.
 *   - Mã 409 "nghi đọc sai sheet": một kíp tụt còn dưới nửa số người đang có
 *     trên web. Chạy kiemTraNhanSu xem lại; đúng là vậy thì chạy dayNhanSuBatChap.
 *   - Xem lần gửi gần nhất: mở <địa chỉ web>/api/trang-thai, mục "nhanSu".
 * ===========================================================================*/

var NHAN_SU_MAY_CHU = 'https://xtk2-profile.pages.dev';   /* địa chỉ dashboard (gửi tới /api/nhan-su) */
var NHAN_SU_CHU_KY_GIO = 1;           /* lịch dayNhanSu: Google nhận 1, 2, 4, 6, 8, 12 */
var NHAN_SU_TRANG_THAI = 'Đang làm việc';   /* sheet chỉ liệt kê người đang làm */

/* Tên tab (đã bỏ dấu, chữ thường) phải KẾT THÚC bằng "kip a|b|c" */
var NHAN_SU_RE_TAB = /kip\s*([abc])\s*$/;
/* Tiêu đề cột cần đọc (đã bỏ dấu, chữ thường). Xưởng đổi tên cột thì sửa ở đây. */
var NHAN_SU_COT = {
  stt: ['stt'],
  ten: ['ho ten', 'ho va ten'],
  chucDanh: ['dinh bien nhan su'],
  viTri: ['dinh bien vi tri'],
  kip: ['kip']
};
/* Cột được xét ghi chú nghỉ việc: tiêu đề (đã bỏ dấu) bắt đầu bằng "ghi chu", hoặc là "lam viec" */
var NHAN_SU_RE_COT_GHI_CHU = /^(ghi chu\b|lam viec$)/;
/* Ô ghi chú (đã bỏ dấu, chữ thường) khớp mẫu này = đã nghỉ -> loại khỏi danh sách.
   "(?! rieng)": "nghỉ việc riêng" là nghỉ phép, KHÔNG loại. */
var NHAN_SU_RE_NGHI = /(nghi|thoi) viec(?! rieng)/;
/* Dấu thanh / dấu mũ dạng tổ hợp (U+0300..U+036F) — dựng bằng mã số cho khỏi lẫn */
var NHAN_SU_RE_DAU = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

/** Lượt chạy theo lịch (và chạy tay): đọc sheet xưởng, gửi lên web. Lỗi -> ném
 *  lỗi để Google gửi thư báo lịch chạy hỏng. */
function dayNhanSu() {
  var kq = nhanSuChay_(false, false);
  Logger.log(kq.chu);
  if (!kq.ok) throw new Error(kq.chu);
}

/** Chạy tay để kiểm tra: đọc sheet, in sĩ số + các vị trí. KHÔNG gửi. */
function kiemTraNhanSu() {
  Logger.log(nhanSuChay_(true, false).chu);
}

/** Như dayNhanSu nhưng bảo máy chủ bỏ qua kiểm "tụt giảm bất thường" — chỉ dùng
 *  khi máy chủ trả 409 mà sĩ số mới đúng là thật (vd cả tổ chuyển đi). */
function dayNhanSuBatChap() {
  var kq = nhanSuChay_(false, true);
  Logger.log(kq.chu);
  if (!kq.ok) throw new Error(kq.chu);
}

/* ---------------------------------------------------------------------------
 * PHẦN CHÍNH
 * ------------------------------------------------------------------------- */

function nhanSuChay_(chiDoc, ep) {
  var t0 = new Date().getTime();
  var cauHinh = nhanSuCauHinh_(chiDoc);
  if (cauHinh.loi) return { ok: false, chu: 'KHÔNG đẩy nhân sự: ' + cauHinh.loi };

  var doc;
  try { doc = nhanSuDocSheet_(cauHinh.sheetId); } catch (e) {
    return { ok: false, chu: 'Không đọc được sheet nhân sự: ' + (e && e.message ? e.message : e) };
  }
  var cacKip = Object.keys(doc.kip).sort();
  var tom = 'Nhân sự: ' + cacKip.map(function (k) { return 'kíp ' + k + ' ' + doc.kip[k].length; }).join(', ')
    + ' người | đọc sheet ' + (new Date().getTime() - t0) + ' ms'
    + (doc.ghiChu.length ? '\n  Ghi chú: ' + doc.ghiChu.join('\n           ') : '');
  if (!cacKip.length) return { ok: false, chu: tom + '\nKhông thấy tab nào tên "... KIP A/B/C" có người' };
  if (chiDoc) return { ok: true, chu: tom + '\n' + nhanSuTomTatViTri_(doc.kip) + '\n(chỉ đọc, không gửi)' };

  var goi = { kip: doc.kip };
  if (ep) goi.ep = true;
  var r = nhanSuGoi_(cauHinh, goi);
  if (!r.ok) return { ok: false, chu: tom + ' | GỬI HỎNG: ' + r.loi };
  return { ok: true, chu: tom + ' | đã gửi: ' + r.j.so_nguoi + ' người, máy chủ đổi ' + r.j.so_ghi + ' dòng'
    + (r.j.so_ghi ? '' : ' (y như trên web)') + ' | tổng ' + (new Date().getTime() - t0) + ' ms' };
}

/** Sheet + địa chỉ + khoá, đều từ Thuộc tính tập lệnh của CHÍNH dự án này.
 *    NHAN_SU_SHEET  link (hoặc mã) sheet nhân sự. Bỏ trống: dùng sheet mà script
 *                   đang gắn vào (khi dán qua Tiện ích mở rộng -> Apps Script).
 *    PUSH_KEY       khoá đẩy (bắt buộc khi gửi).
 *  Ra { sheetId ('' = sheet đang gắn), url, khoa } hoặc { loi }. */
function nhanSuCauHinh_(chiDoc) {
  var tt = PropertiesService.getScriptProperties();
  var nguon = String(tt.getProperty('NHAN_SU_SHEET') || '').trim();
  var m = nguon.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || nguon.match(/^([a-zA-Z0-9_-]{20,})$/);
  var sheetId = m ? m[1] : '';
  if (!sheetId && !nhanSuSheetDangGan_()) {
    return { loi: 'chưa đặt Thuộc tính tập lệnh NHAN_SU_SHEET (link sheet nhân sự của xưởng)' };
  }
  if (chiDoc) return { sheetId: sheetId };

  var khoa = String(tt.getProperty('PUSH_KEY') || '').trim();
  if (!khoa) return { loi: 'chưa đặt Thuộc tính tập lệnh PUSH_KEY (khoá đẩy, giống dự án TK1/TK2)' };
  return { sheetId: sheetId, url: NHAN_SU_MAY_CHU + '/api/nhan-su', khoa: khoa };
}

/** Sheet mà script đang gắn vào (dán qua Tiện ích mở rộng), hoặc null với dự án riêng. */
function nhanSuSheetDangGan_() {
  try { return SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { return null; }
}

/** POST gói JSON. Ra { ok, j } hoặc { ok: false, loi } — không ném lỗi. */
function nhanSuGoi_(cauHinh, goi) {
  try {
    var res = UrlFetchApp.fetch(cauHinh.url, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(goi),
      headers: { 'x-push-key': cauHinh.khoa }, muteHttpExceptions: true
    });
    var ma = res.getResponseCode(), chu = String(res.getContentText());
    var j = null;
    try { j = JSON.parse(chu); } catch (e) { j = null; }
    if (ma === 200 && j && j.status === 'success') return { ok: true, j: j };
    var goiY = ma === 401 ? ' (sai PUSH_KEY)' : ma === 404 ? ' (máy chủ chưa có /api/nhan-su — chưa deploy bản mới?)' : '';
    return { ok: false, loi: 'mã ' + ma + goiY + ' — ' + (j && j.message ? j.message : chu.substring(0, 200)) };
  } catch (e) {
    return { ok: false, loi: 'không gửi được: ' + e };
  }
}

/* ---------------------------------------------------------------------------
 * ĐỌC SHEET CỦA XƯỞNG
 * ------------------------------------------------------------------------- */

/** Ra { kip: { A: [[họ tên, vị trí, trạng thái], ...], ... }, ghiChu: [chuỗi] } */
function nhanSuDocSheet_(sheetId) {
  var ss = sheetId ? SpreadsheetApp.openById(sheetId) : nhanSuSheetDangGan_();
  if (!ss) throw new Error('không mở được sheet nhân sự');
  var tabs = ss.getSheets(), kip = {}, ghiChu = [];
  for (var i = 0; i < tabs.length; i++) {
    var ten = tabs[i].getName();
    var mk = nhanSuKhoa_(ten).match(NHAN_SU_RE_TAB);
    if (!mk) continue;
    var k = mk[1].toUpperCase();
    if (kip[k]) throw new Error('hai tab cùng là kíp ' + k + ' ("' + ten + '") — đổi tên một tab');
    var r = nhanSuDocTab_(ten, nhanSuTraiGop_(tabs[i]));
    kip[k] = r.ds;
    for (var g = 0; g < r.ghiChu.length; g++) ghiChu.push('Tab "' + ten + '": ' + r.ghiChu[g]);
  }
  ['A', 'B', 'C'].forEach(function (k) { if (!kip[k]) ghiChu.push('Không thấy tab kíp ' + k + ' — kíp này giữ nguyên trên web'); });
  return { kip: kip, ghiChu: ghiChu };
}

/** Đọc cả tab dạng chữ (đúng như mắt thấy), trải ô GỘP ra mọi hàng của nó.
 *  Ra { v: [[ô]], trai: { 'hàng|cột': true } } — trai đánh dấu ô được điền từ
 *  ô gộp (không phải ô gốc của nó). */
function nhanSuTraiGop_(sh) {
  var vung = sh.getDataRange();
  var v = vung.getDisplayValues(), trai = {};
  var gop = vung.getMergedRanges();
  for (var g = 0; g < gop.length; g++) {
    var r0 = gop[g].getRow() - 1, c0 = gop[g].getColumn() - 1;
    var gt = v[r0] ? v[r0][c0] : '';
    for (var r = r0; r < r0 + gop[g].getNumRows() && r < v.length; r++) {
      for (var c = c0; c < c0 + gop[g].getNumColumns(); c++) {
        if (r === r0 && c === c0) continue;
        v[r][c] = gt;
        trai[r + '|' + c] = true;
      }
    }
  }
  return { v: v, trai: trai };
}

/** Lấy danh sách người của một tab. Ra { ds: [[họ tên, vị trí, trạng thái]], ghiChu } */
function nhanSuDocTab_(ten, bang) {
  var v = bang.v, hTieuDe = -1, cot = null, cotGhiChu = [];
  for (var r = 0; r < v.length && r < 15 && hTieuDe < 0; r++) {
    var khoa = v[r].map(nhanSuKhoa_);
    var c = nhanSuTimCot_(khoa);
    if (c.stt >= 0 && c.ten >= 0) {
      hTieuDe = r; cot = c;
      for (var g = 0; g < khoa.length; g++) if (NHAN_SU_RE_COT_GHI_CHU.test(khoa[g])) cotGhiChu.push(g);
    }
  }
  if (hTieuDe < 0) throw new Error('tab "' + ten + '": không thấy hàng tiêu đề có STT và HỌ TÊN');
  if (cot.chucDanh < 0 && cot.viTri < 0) throw new Error('tab "' + ten + '": không thấy cột ĐỊNH BIÊN NHÂN SỰ / ĐỊNH BIÊN VỊ TRÍ');

  var ds = [], soTrong = 0, boKip = {}, nghi = [];
  for (var h = hTieuDe + 1; h < v.length; h++) {
    var hang = v[h];
    if (!/^\d+$/.test(String(hang[cot.stt]).trim())) continue;      /* hàng tên nhóm, tổng... */
    var hoTen = nhanSuGon_(hang[cot.ten]);
    if (!hoTen) { soTrong++; continue; }                             /* vị trí còn trống */
    var oKip = cot.kip >= 0 ? nhanSuGon_(hang[cot.kip]) : '';
    if (oKip && !/^[abc]$/i.test(oKip)) { boKip[oKip] = (boKip[oKip] || 0) + 1; continue; }   /* HC */
    if (nhanSuDaNghi_(hang, cotGhiChu)) { nghi.push(hoTen); continue; }   /* ghi chú nghỉ việc */
    var oViTri = cot.viTri >= 0 ? hang[cot.viTri] : '';
    var viTriRieng = cot.viTri >= 0 && !bang.trai[h + '|' + cot.viTri] ? oViTri : '';
    ds.push([hoTen, nhanSuViTri_(cot.chucDanh >= 0 ? hang[cot.chucDanh] : '', oViTri, viTriRieng), NHAN_SU_TRANG_THAI]);
  }
  var ghiChu = [];
  if (soTrong) ghiChu.push(soTrong + ' vị trí chưa có người (không hiện)');
  for (var b in boKip) ghiChu.push('bỏ ' + boKip[b] + ' người cột KÍP = "' + b + '" (trang chỉ có kíp A/B/C)');
  if (nghi.length) ghiChu.push('bỏ ' + nghi.length + ' người có ghi chú nghỉ việc: ' + nghi.join(', '));
  return { ds: ds, ghiChu: ghiChu };
}

/** Hàng này có ô ghi chú / "Làm việc" nói đã nghỉ việc không (NHAN_SU_RE_NGHI). */
function nhanSuDaNghi_(hang, cotGhiChu) {
  for (var i = 0; i < cotGhiChu.length; i++) {
    if (NHAN_SU_RE_NGHI.test(nhanSuKhoa_(hang[cotGhiChu[i]]))) return true;
  }
  return false;
}

/** Vị trí từng cột tiêu đề cần đọc (-1 = không có). khoa: các ô tiêu đề đã bỏ dấu. */
function nhanSuTimCot_(khoa) {
  var ra = {};
  for (var t in NHAN_SU_COT) {
    ra[t] = -1;
    for (var i = 0; i < khoa.length && ra[t] < 0; i++) if (NHAN_SU_COT[t].indexOf(khoa[i]) >= 0) ra[t] = i;
  }
  return ra;
}

/* ---------------------------------------------------------------------------
 * LÀM SẠCH VỊ TRÍ
 * ------------------------------------------------------------------------- */

/** chucDanh: ô "ĐỊNH BIÊN NHÂN SỰ" (đã trải gộp); oViTri: ô "ĐỊNH BIÊN VỊ TRÍ" (đã
 *  trải gộp); viTriRieng: ô đó nhưng CHỈ khi là ô gốc (không phải điền từ gộp).
 *    "NVVH Phối liệu - Tổ Phối trộn liệu - Kíp A - Xưởng Thiêu kết 2" -> "NVVH Phối liệu"
 *    "Tổ Trưởng -Tổ Thiêu Kết -Kíp B- Xưởng Thiêu Kết 2"            -> "Tổ trưởng - Tổ thiêu kết"
 *    "NVVH Băng tải Sau sàn phân - Tổ thiêu kết - kíp C - X. ..."     -> "NVVH Băng tải - Sau sàng phân"
 *    "KTV Vận hành - Kíp A - Xưởng Thiêu Kết 2"                      -> "Kỹ thuật viên vận hành" */
function nhanSuViTri_(chucDanh, oViTri, viTriRieng) {
  var rieng = nhanSuGon_(viTriRieng);
  if (rieng && /^kip (truong|pho)$/.test(nhanSuKhoa_(rieng))) return nhanSuCauChu_(rieng);
  var goc = nhanSuGon_(chucDanh) || nhanSuGon_(oViTri);
  if (!goc) return '';
  var doan = goc.split(/\s*[-–—]\s*/), giu = [], daCo = {};
  var laToTruong = /^to (truong|pho)\b/.test(nhanSuKhoa_(doan[0]));
  for (var i = 0; i < doan.length; i++) {
    var d = nhanSuMoRong_(nhanSuGon_(doan[i])), k = nhanSuKhoa_(d);
    if (!d || daCo[k]) continue;
    if (/^kip [abc]$/.test(k)) continue;                       /* "Kíp A" */
    if (/^(x\.|x |xuong\b)/.test(k)) continue;                 /* "Xưởng Thiêu kết 2", "X. Thiêu kết 2" */
    if (i > 0 && /^to /.test(k) && !laToTruong) continue;      /* tên tổ: chỉ giữ cho tổ trưởng / tổ phó */
    daCo[k] = true;
    giu.push(nhanSuCauChu_(d));
  }
  return nhanSuThongNhat_(giu.join(' - '));
}

/** Viết hoa chữ đầu, còn lại chữ thường — trừ từ viết tắt (NVVH, KTV) và từ có số
 *  (S201): giữ nguyên. "NVVH Máy Làm mát vòng" -> "NVVH Máy làm mát vòng". */
function nhanSuCauChu_(d) {
  var tu = d.split(' '), daHoa = false;
  for (var i = 0; i < tu.length; i++) {
    var w = tu[i];
    if (/\d/.test(w) || (w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase())) continue;
    tu[i] = daHoa ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    daHoa = true;
  }
  return tu.join(' ');
}

/** Viết tắt đầu đoạn -> viết đủ (làm TRƯỚC khi chỉnh hoa/thường, để "KTV Vận
 *  hành" và "Kỹ thuật viên vận hành" ra cùng một chữ). */
function nhanSuMoRong_(d) {
  return d.replace(/^KTV\s+/i, 'Kỹ thuật viên ').replace(/^NV\s+/, 'Nhân viên ');
}

/** Thống nhất cách viết giữa 3 kíp để cùng vị trí vào chung một hộp. */
function nhanSuThongNhat_(s) {
  return s
    .replace(/(s)àn phân/gi, function (x, s0) { return s0 + 'àng phân'; })
    .replace(/^(NVVH\s+)nghiền trục đơn/i, '$1Máy nghiền trục đơn')
    .replace(/băng tải\s+(trước|sau)\s+sàng phân/i, function (x, ts) {
      return 'Băng tải - ' + ts.charAt(0).toUpperCase() + ts.slice(1).toLowerCase() + ' sàng phân';
    });
}

/* ---------------------------------------------------------------------------
 * HÀM NHỎ
 * ------------------------------------------------------------------------- */

/** Ô -> chữ gọn: dạng dựng sẵn (NFC), gộp khoảng trắng, cắt hai đầu. */
function nhanSuGon_(v) {
  if (v === undefined || v === null) return '';
  return String(v).normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Chìa khoá so khớp: bỏ dấu, đ -> d, chữ thường, gộp khoảng trắng. */
function nhanSuKhoa_(v) {
  return nhanSuGon_(v).normalize('NFD').replace(NHAN_SU_RE_DAU, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

/** Dòng tóm tắt cho kiemTraNhanSu: mỗi kíp, mỗi vị trí bao nhiêu người. */
function nhanSuTomTatViTri_(kip) {
  var ra = [];
  Object.keys(kip).sort().forEach(function (k) {
    var dem = {}, thuTu = [];
    kip[k].forEach(function (p) {
      var vt = p[1] || '(trống)';
      if (!dem[vt]) { dem[vt] = 0; thuTu.push(vt); }
      dem[vt]++;
    });
    ra.push('  Kíp ' + k + ': ' + thuTu.map(function (vt) { return vt + ' ×' + dem[vt]; }).join('; '));
  });
  return ra.join('\n');
}

/* ---------------------------------------------------------------------------
 * LỊCH CHẠY
 * ------------------------------------------------------------------------- */

/** Chạy TAY MỘT LẦN: dayNhanSu mỗi NHAN_SU_CHU_KY_GIO giờ. Chạy lại không bị nhân đôi. */
function caiLichNhanSu() {
  nhanSuXoaLich_();
  ScriptApp.newTrigger('dayNhanSu').timeBased().everyHours(NHAN_SU_CHU_KY_GIO).create();
  Logger.log('Đã cài: dayNhanSu mỗi ' + NHAN_SU_CHU_KY_GIO + ' giờ.');
}

/** Bỏ lịch dayNhanSu. Danh sách trên web giữ nguyên lần gửi cuối. */
function goLichNhanSu() {
  nhanSuXoaLich_();
  Logger.log('Đã bỏ lịch dayNhanSu.');
}

function nhanSuXoaLich_() {
  var cu = ScriptApp.getProjectTriggers();
  for (var i = 0; i < cu.length; i++) {
    if (cu[i].getHandlerFunction() === 'dayNhanSu') ScriptApp.deleteTrigger(cu[i]);
  }
}
