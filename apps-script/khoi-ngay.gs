/* =============================================================================
 * APPS SCRIPT — ĐẨY "KHỐI-NGÀY" LÊN CLOUDFLARE (file THÊM, dùng chung TK3/TK4)
 * =============================================================================
 * Thêm file này vào CÙNG dự án Apps Script đang có (TK3, TK4), KHÔNG sửa file cũ.
 * File dùng lại của file cũ: doGet(), PUSH_URL, PUSH_KEY. (TK1, TK2: dự án riêng,
 * file này đi cùng apps-script/tk12-nguon.gs — tệp đó cung cấp doGet, PUSH_URL.)
 * Không chứa khoá nào: PUSH_KEY lấy từ Thuộc tính tập lệnh (nếu có) hoặc từ dòng
 * "var PUSH_KEY" trong file cũ.
 *
 * VÌ SAO
 *   Đường cũ (dayLenCloudflare) gửi CẢ sheet 2–3 MB mỗi 30 phút; Cloudflare phải
 *   đọc lại cả 3 MB mỗi lần, tốn 60–72 ms CPU trong khi gói Free cho 10 ms.
 *   File này chỉ gửi những KHỐI-NGÀY đã đổi (vd "QTK ngày 03/10") — vài KB.
 *
 * CÁCH BIẾT CÁI GÌ ĐỔI — so DẤU VÂN TAY, không đoán theo giờ:
 *   1) Đọc cả sheet qua doGet (y như đường cũ: cùng cách lọc dòng, sửa ngày, bỏ ô
 *      lỗi công thức), chia theo khối ("Thời gian (X)" | "Ca/kíp (X)" | các cột
 *      của X) và theo ngày — đúng quy tắc máy chủ dùng (db/chuan-hoa.mjs).
 *   2) Tính dấu MD5 cho từng khối-ngày, và cho từng (khối, tháng).
 *   3) Gửi ~130 dấu (khối, tháng) — máy chủ trả về tháng nào lệch, kèm dấu từng
 *      ngày nó đang giữ.
 *   4) Gửi các hàng của những khối-ngày có dấu khác. Sửa lùi ngày cũ cũng được
 *      gửi (dấu ngày đó đổi). Khối-ngày không còn trên sheet thì báo xoá.
 *   Máy chủ chỉ ghi nhận dấu SAU KHI đã ghi số (cùng một giao dịch) -> lượt nào
 *   lỗi thì lượt sau tự gửi lại, không mất ca nào.
 *
 * CÀI ĐẶT (làm một lần cho MỖI dự án TK3, TK4)
 *   1) Mở dự án Apps Script -> dấu + cạnh "Tệp" -> Tập lệnh -> đặt tên khoi-ngay
 *      -> dán toàn bộ file này -> Lưu.
 *   2) Chọn hàm kiemTraKhoiNgay -> Chạy -> xem Nhật ký: đọc được sheet, nối được
 *      máy chủ, lần đầu sẽ báo "lệch" toàn bộ (máy chủ chưa có dấu nào) — bình thường.
 *   3) Chọn hàm dayKhoiNgay -> Chạy một lần. Lần ĐẦU gửi toàn bộ (chia nhiều lượt,
 *      có thể mất 1–2 phút). Các lần sau chỉ gửi phần đổi.
 *   4) Chọn hàm caiLichKhoiNgay -> Chạy: lịch dayKhoiNgay mỗi 30 phút; lịch
 *      dayLenCloudflare (cả sheet) đổi thành 4 giờ một lần — vẫn giữ để bản KV
 *      (đường lui của dashboard) không quá cũ.
 *   Muốn quay về như cũ: chạy goLichKhoiNgay.
 * ===========================================================================*/

var KN_CHU_KY_PHUT = 30;          /* lịch dayKhoiNgay: Google nhận 1, 5, 10, 15, 30 */
var KN_CA_SHEET_GIO = 4;          /* lịch dayLenCloudflare (cả sheet): 1, 2, 4, 6, 8, 12 */
var KN_O_MOI_LUOT = 1000;         /* ô tối đa mỗi lượt ghi — lượt nhỏ thì Cloudflare tốn vài ms, dưới 10 ms */
var KN_KHOI_NHAN_SU = '(nhân sự)';

/* Y HỆT db/chuan-hoa.mjs — đổi bên đó thì đổi cả ở đây */
var KN_RE_NGAY = /^Thời gian \((.+)\)(_\d+)?$/;
var KN_RE_CA = /^Ca\/kíp \((.+)\)(_\d+)?$/;
var KN_RE_NHAN_SU = /^(STT|Mã nhân viên|Vị trí công việc|Status)(?: \(([ABC])\))?$/;
var KN_COT_BO_QUA = { 'STT (CTCT)': 1, 'Nội dung (CTCT)': 1, 'Giá trị làm lợi': 1, 'Quy mô': 1, 'Chủ đề tài': 1 };

/** Lượt chạy theo lịch: so dấu rồi gửi phần đổi. Ghi kết quả vào Nhật ký. */
function dayKhoiNgay() {
  var kq = knChay_(false);
  Logger.log(kq.chu);
}

/** Chạy tay để kiểm tra: làm bước so sánh, KHÔNG gửi số liệu. */
function kiemTraKhoiNgay() {
  var kq = knChay_(true);
  Logger.log(kq.chu);
}

/* ---------------------------------------------------------------------------
 * PHẦN CHÍNH
 * ------------------------------------------------------------------------- */

function knChay_(chiSoSanh) {
  var t0 = new Date().getTime();
  var cauHinh = knCauHinh_();
  if (cauHinh.loi) return { ok: false, chu: 'KHÔNG đẩy khối-ngày: ' + cauHinh.loi };

  /* 1) Đọc sheet qua đúng doGet của file cũ (dạng gọn: cols + rows) */
  var ket = doGet({ parameter: { nocache: '1', format: 'compact' } });
  var j;
  try { j = JSON.parse(ket.getContent()); } catch (e) { j = null; }
  if (!j || j.status !== 'success' || !j.data || !j.data.cols || !j.data.rows || !j.data.rows.length) {
    return { ok: false, chu: 'KHÔNG đẩy khối-ngày — doGet báo: ' + (j && j.message ? j.message : 'không đọc được dữ liệu') };
  }
  var tDoc = new Date().getTime();

  /* 2) Chia khối-ngày, tính dấu */
  var bang = knLapBang_(j.data.cols, j.data.rows);
  var tBam = new Date().getTime();

  /* 3) So sánh với máy chủ */
  /* "khoi" = các khối đang có trên sheet: máy chủ coi tháng nào của các khối này
     mà sheet không còn là bị XOÁ. Nguồn chỉ giữ tháng hiện tại (TK1/TK2) thì gửi
     rỗng -> máy chủ chỉ so các tháng được gửi, tháng cũ giữ nguyên. */
  var khoiCoMat = knGiuThangVang_() ? [] : Object.keys(bang.khoi);
  var ss = knGoi_(cauHinh, { buoc: 'so-sanh', khoi: khoiCoMat, thang: bang.dauThang, nhan_su: bang.nhanSu ? bang.nhanSu.dau : null });
  if (!ss.ok) return { ok: false, chu: 'So sánh hỏng: ' + ss.loi };
  var lech = Object.keys(ss.j.khac || {});
  var tom = 'Khối-ngày ' + cauHinh.tuyen.toUpperCase() + ': ' + Object.keys(bang.dauThang).length + ' khối-tháng, lệch '
    + lech.length + (ss.j.nhan_su_khac ? ' + nhân sự' : '') + ' | đọc sheet ' + (tDoc - t0) + ' ms, tính dấu ' + (tBam - tDoc) + ' ms';
  if (chiSoSanh) return { ok: true, chu: tom + ' | (chỉ so sánh, không gửi)' };
  if (!lech.length && !ss.j.nhan_su_khac) return { ok: true, chu: tom + ' | không có gì đổi' };

  /* 4) Gửi phần đổi, chia lượt ~KN_O_MOI_LUOT ô; khối-tháng không bao giờ bị cắt đôi */
  var cacPhan = [];
  for (var i = 0; i < lech.length; i++) {
    var p = knPhanCuaThang_(bang, lech[i], ss.j.khac[lech[i]]);
    if (p) cacPhan.push(p);
  }
  var luot = [], hienTai = [], dem = 0;
  for (var k = 0; k < cacPhan.length; k++) {
    var n = cacPhan[k].soO;
    if (hienTai.length && dem + n > KN_O_MOI_LUOT) { luot.push(hienTai); hienTai = []; dem = 0; }
    hienTai.push(cacPhan[k].phan);
    dem += n;
  }
  if (hienTai.length) luot.push(hienTai);
  if (!luot.length) luot.push([]);
  var nhanSu = ss.j.nhan_su_khac && bang.nhanSu ? { cot: bang.nhanSu.cot, hang: bang.nhanSu.hang, van_tay: bang.nhanSu.dau } : null;

  var tongKN = 0, tongO = 0, tongGhi = 0, daGui = 0;
  for (var l = 0; l < luot.length; l++) {
    var goi = { buoc: 'ghi', phan: luot[l] };
    if (l === 0 && nhanSu) goi.nhan_su = nhanSu;
    if (!goi.phan.length && !goi.nhan_su) continue;
    var r = knGoi_(cauHinh, goi);
    if (!r.ok) {
      return { ok: false, chu: tom + ' | GỬI HỎNG ở lượt ' + (l + 1) + '/' + luot.length + ': ' + r.loi
        + ' (đã ghi xong ' + daGui + ' lượt; lượt sau tự gửi lại phần còn thiếu)' };
    }
    daGui++;
    tongKN += r.j.so_khoi_ngay || 0; tongO += r.j.so_o || 0; tongGhi += r.j.so_ghi || 0;
  }
  return { ok: true, chu: tom + ' | đã gửi ' + daGui + ' lượt: ' + tongKN + ' khối-ngày, ' + tongO + ' ô, máy chủ đổi '
    + tongGhi + ' dòng | tổng ' + (new Date().getTime() - t0) + ' ms' };
}

/* Hai tuỳ chọn cho nguồn KHÔNG giữ đủ lịch sử — file TK1/TK2 chỉ chứa tháng
   đang chạy (apps-script/tk12-nguon.gs khai và đặt hai biến này). Dự án TK3/TK4
   không khai -> chạy y như cũ.
     KN_GIU_THANG_VANG  tháng máy chủ có mà sheet không còn: GIỮ, không xoá
     KN_KHONG_XOA_NGAY  ngày máy chủ có mà sheet không còn: GIỮ, không xoá */
function knGiuThangVang_() { return typeof KN_GIU_THANG_VANG !== 'undefined' && KN_GIU_THANG_VANG === true; }
function knKhongXoaNgay_() { return typeof KN_KHONG_XOA_NGAY !== 'undefined' && KN_KHONG_XOA_NGAY === true; }

/** Địa chỉ + khoá. PUSH_URL của file cũ: .../api/tk3 -> đường mới .../api/day/tk3 */
function knCauHinh_() {
  if (typeof PUSH_URL !== 'string') return { loi: 'không thấy PUSH_URL (file này phải nằm CHUNG dự án với script TK cũ)' };
  var m = PUSH_URL.match(/^(https:\/\/[^\/]+)\/api\/([a-z0-9]+)$/);
  if (!m) return { loi: 'PUSH_URL không đúng dạng https://.../api/tk3: ' + PUSH_URL };
  var khoa = '';
  try { khoa = PropertiesService.getScriptProperties().getProperty('PUSH_KEY') || ''; } catch (e) { khoa = ''; }
  if (!khoa && typeof PUSH_KEY === 'string' && PUSH_KEY.indexOf('DAN_CHUOI') !== 0) khoa = PUSH_KEY;
  if (!khoa) return { loi: 'chưa có PUSH_KEY (Thuộc tính tập lệnh, hoặc dòng var PUSH_KEY của file cũ)' };
  return { url: m[1] + '/api/day/' + m[2], tuyen: m[2], khoa: khoa };
}

/** POST một gói JSON. Ra { ok, j } hoặc { ok: false, loi } — không ném lỗi. */
function knGoi_(cauHinh, goi) {
  try {
    var res = UrlFetchApp.fetch(cauHinh.url, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(goi),
      headers: { 'x-push-key': cauHinh.khoa }, muteHttpExceptions: true
    });
    var ma = res.getResponseCode(), chu = String(res.getContentText());
    var j = null;
    try { j = JSON.parse(chu); } catch (e) { j = null; }
    if (ma === 200 && j && j.status === 'success') return { ok: true, j: j };
    var goiY = ma === 401 ? ' (sai PUSH_KEY)' : ma === 404 ? ' (máy chủ chưa có /api/day — chưa deploy bản mới?)' : '';
    return { ok: false, loi: 'mã ' + ma + goiY + ' — ' + (j && j.message ? j.message : chu.substring(0, 200)) };
  } catch (e) {
    return { ok: false, loi: 'không gửi được: ' + e };
  }
}

/* ---------------------------------------------------------------------------
 * CHIA KHỐI-NGÀY + DẤU VÂN TAY
 * ------------------------------------------------------------------------- */

/** cols, rows: dạng gọn của doGet. Ra:
 *    khoi:     { tên khối: { cot: [chỉ số cột], ten: [tên cột], goiY: {tên: ','|'.'|null},
 *                ngay: { 'YYYY-MM-DD': { hang: [chỉ số hàng], dau } }, thang: { 'YYYY-MM': dấu } } }
 *    dauThang: { 'khối|YYYY-MM': dấu }
 *    nhanSu:   { cot: [tên], hang: [[ô]], dau } | null
 *    rows:     chính rows (để lấy lại hàng khi gửi) */
function knLapBang_(cols, rows) {
  var tk = knTachKhoi_(cols);
  var khoi = {}, dauThang = {};
  for (var b = 0; b < tk.khoi.length; b++) {
    var kb = tk.khoi[b];
    var chiSo = [kb.iNgay, kb.iCa].concat(kb.iCot);
    var ten = [], goiY = {};
    for (var c = 0; c < chiSo.length; c++) ten.push(cols[chiSo[c]]);
    for (var d = 0; d < kb.iCot.length; d++) goiY[cols[kb.iCot[d]]] = knDauThapPhanCot_(rows, kb.iCot[d]);
    var kyTen = JSON.stringify([ten, goiY]);       /* đổi tên cột / gợi ý số -> mọi ngày của khối gửi lại */

    /* Gom hàng theo ngày — đúng quy tắc chuanHoaDayChuyen: ngày "điền xuôi" xuống;
       hàng có kíp thuộc ngày đang mang; hàng KHÔNG kíp chỉ tính khi chính nó ghi
       ngày (ô định mức đầu ngày); hàng có kíp mà chưa có ngày nào phía trên -> bỏ */
    var theoNgay = {}, ngay = null;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], ngayDong = null;
      if (!knTrong_(row[kb.iNgay])) {
        var iso = knDocNgay_(row[kb.iNgay]);
        if (iso) { ngay = iso; ngayDong = iso; }
      }
      var nhom = knTrong_(row[kb.iCa]) ? ngayDong : ngay;
      if (!nhom) continue;
      (theoNgay[nhom] || (theoNgay[nhom] = { hang: [] })).hang.push(r);
    }
    var cacNgay = Object.keys(theoNgay).sort(), theoThang = {};
    for (var n = 0; n < cacNgay.length; n++) {
      var g = theoNgay[cacNgay[n]], o = [];
      for (var h = 0; h < g.hang.length; h++) o.push(knLayO_(rows[g.hang[h]], chiSo));
      g.dau = knMd5_(kyTen + '\n' + cacNgay[n] + '\n' + JSON.stringify(o));
      var th = cacNgay[n].substring(0, 7);
      (theoThang[th] || (theoThang[th] = [])).push([cacNgay[n], g.dau]);
    }
    var dauCuaThang = {};
    for (var t in theoThang) {
      dauCuaThang[t] = knMd5_(JSON.stringify(theoThang[t]));
      dauThang[kb.ten + '|' + t] = dauCuaThang[t];
    }
    khoi[kb.ten] = { cot: chiSo, ten: ten, goiY: goiY, ngay: theoNgay, thang: dauCuaThang };
  }

  /* Nhân sự: danh sách dọc, không theo ngày — một dấu cho cả danh sách */
  var nhanSu = null;
  if (tk.nhanSu.length) {
    var tenNS = [], hangNS = [];
    for (var s = 0; s < tk.nhanSu.length; s++) tenNS.push(cols[tk.nhanSu[s]]);
    for (var rr = 0; rr < rows.length; rr++) {
      var oNS = knLayO_(rows[rr], tk.nhanSu), coSo = false;
      for (var x = 0; x < oNS.length; x++) if (!knTrong_(oNS[x])) { coSo = true; break; }
      if (coSo) hangNS.push(oNS);
    }
    nhanSu = { cot: tenNS, hang: hangNS, dau: knMd5_(JSON.stringify([tenNS, hangNS])) };
  }
  return { khoi: khoi, dauThang: dauThang, nhanSu: nhanSu, rows: rows };
}

/** Phần gửi cho một khối-tháng lệch. mayChu = { ngày: dấu } máy chủ đang giữ.
 *  Ra { phan, soO } hoặc null (khối không còn trong sheet). */
function knPhanCuaThang_(bang, khoa, mayChu) {
  var i = khoa.lastIndexOf('|'), tenKhoi = khoa.substring(0, i), thang = khoa.substring(i + 1);
  var kb = bang.khoi[tenKhoi];
  if (!kb) return null;
  var ngay = {}, hangChon = [];
  for (var d in kb.ngay) {
    if (d.substring(0, 7) !== thang) continue;
    if (mayChu[d] === kb.ngay[d].dau) continue;          /* ngày này máy chủ đã đúng */
    ngay[d] = kb.ngay[d].dau;
    hangChon = hangChon.concat(kb.ngay[d].hang);
  }
  if (!knKhongXoaNgay_()) {
    for (var dm in mayChu) if (!kb.ngay[dm]) ngay[dm] = '';  /* máy chủ có, sheet không còn -> xoá */
  }
  hangChon.sort(function (a, b) { return a - b; });       /* giữ đúng thứ tự hàng trong sheet */
  var hang = [], soO = 0;
  for (var h = 0; h < hangChon.length; h++) {
    var o = knLayO_(bang.rows[hangChon[h]], kb.cot);
    for (var c = 0; c < o.length; c++) if (o[c] !== '' && o[c] !== null) soO++;
    hang.push(o);
  }
  var thangGui = {};
  thangGui[thang] = kb.thang[thang] || '';                 /* tháng không còn ngày nào -> xoá dấu tháng */
  var goiY = {};
  for (var t in kb.goiY) goiY[t] = kb.goiY[t];
  return { soO: soO + hang.length, phan: { khoi: tenKhoi, cot: kb.ten, goi_y: goiY, ngay: ngay, thang: thangGui, hang: hang } };
}

/* ---------------------------------------------------------------------------
 * HÀM NHỎ — chép thuật toán của db/chuan-hoa.mjs
 * ------------------------------------------------------------------------- */

/** Chia cột thành khối, y như tachKhoi() của máy chủ. Ra { khoi: [{ ten, iNgay, iCa, iCot }], nhanSu: [chỉ số] } */
function knTachKhoi_(cols) {
  var khoi = [], nhanSu = [], hienTai = null;
  for (var i = 0; i < cols.length; i++) {
    var cot = cols[i];
    var mN = cot.match(KN_RE_NGAY);
    if (mN) { hienTai = { ten: mN[1] + (mN[2] || ''), iNgay: i, iCa: -1, iCot: [] }; khoi.push(hienTai); continue; }
    var mC = cot.match(KN_RE_CA);
    if (mC) {
      if (hienTai && hienTai.iCa < 0 && mC[1] + (mC[2] || '') === hienTai.ten) hienTai.iCa = i;
      continue;
    }
    if (KN_RE_NHAN_SU.test(cot)) { nhanSu.push(i); continue; }
    if (KN_COT_BO_QUA[cot]) continue;
    if (!hienTai) continue;
    hienTai.iCot.push(i);
  }
  var coCa = [];
  for (var k = 0; k < khoi.length; k++) if (khoi[k].iCa >= 0) coCa.push(khoi[k]);
  return { khoi: coCa, nhanSu: nhanSu };
}

/** Ô trống: '', null, undefined hoặc toàn khoảng trắng (số 0 không trống). */
function knTrong_(v) {
  if (v === '' || v === undefined || v === null) return true;
  return typeof v !== 'number' && String(v).trim() === '';
}

/** 'dd/mm/yyyy' (hoặc - .) -> 'yyyy-mm-dd'; sai dạng / ngày không có thật -> null */
function knDocNgay_(v) {
  var m = String(v || '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!m) return null;
  var d = +m[1], th = +m[2], y = +m[3];
  var thu = new Date(Date.UTC(y, th - 1, d));
  if (thu.getUTCFullYear() !== y || thu.getUTCMonth() !== th - 1 || thu.getUTCDate() !== d) return null;
  return y + '-' + (th < 10 ? '0' : '') + th + '-' + (d < 10 ? '0' : '') + d;
}

/** Dấu thập phân đa số của một cột ('.', ',' hoặc null) — y như dauThapPhanCot */
function knDauThapPhanCot_(rows, iCot) {
  var phieu = { ',': 0, '.': 0 };
  for (var r = 0; r < rows.length; r++) {
    var v = rows[r][iCot];
    if (v === undefined || v === null || typeof v === 'number') continue;
    var t = String(v).replace(/[^\d.,-]/g, '');
    var cham = t.lastIndexOf('.'), phay = t.lastIndexOf(',');
    if (cham < 0 && phay < 0) continue;
    if (cham >= 0 && phay >= 0) { phieu[cham > phay ? '.' : ',']++; continue; }
    var dau = cham >= 0 ? '.' : ',', khac = dau === '.' ? ',' : '.';
    var phan = t.replace(/^-/, '').split(dau);
    if (phan.length > 2) phieu[khac]++;
    else if (knLaDauThapPhan_(t, dau)) phieu[dau]++;
  }
  if (phieu[','] === phieu['.']) return null;
  return phieu[','] > phieu['.'] ? ',' : '.';
}

/** laDauThapPhan(t, dau, null) của máy chủ */
function knLaDauThapPhan_(t, dau) {
  var phan = t.replace(/^-/, '').split(dau);
  if (phan.length > 2) return false;
  var nguyen = phan[0], le = phan[1];
  if (le.length !== 3) return true;
  if (/^0*$/.test(nguyen) || nguyen.length > 3) return true;
  return false;
}

function knLayO_(row, chiSo) {
  var o = [];
  for (var i = 0; i < chiSo.length; i++) { var v = row[chiSo[i]]; o.push(v === undefined || v === null ? '' : v); }
  return o;
}

function knMd5_(chu) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, chu, Utilities.Charset.UTF_8));
}

/* ---------------------------------------------------------------------------
 * LỊCH CHẠY
 * ------------------------------------------------------------------------- */

/** Chạy TAY MỘT LẦN: dayKhoiNgay mỗi KN_CHU_KY_PHUT phút; dayLenCloudflare (cả
 *  sheet) thưa lại còn KN_CA_SHEET_GIO giờ một lần. Chạy lại không bị nhân đôi. */
function caiLichKhoiNgay() {
  knXoaLich_(['dayKhoiNgay', 'dayLenCloudflare']);
  ScriptApp.newTrigger('dayKhoiNgay').timeBased().everyMinutes(KN_CHU_KY_PHUT).create();
  ScriptApp.newTrigger('dayLenCloudflare').timeBased().everyHours(KN_CA_SHEET_GIO).create();
  Logger.log('Đã cài: dayKhoiNgay mỗi ' + KN_CHU_KY_PHUT + ' phút, dayLenCloudflare mỗi ' + KN_CA_SHEET_GIO + ' giờ.');
}

/** Quay về như cũ: bỏ lịch dayKhoiNgay, dayLenCloudflare lại mỗi CHU_KY_PHUT phút. */
function goLichKhoiNgay() {
  knXoaLich_(['dayKhoiNgay', 'dayLenCloudflare']);
  var phut = typeof CHU_KY_PHUT === 'number' ? CHU_KY_PHUT : 30;
  ScriptApp.newTrigger('dayLenCloudflare').timeBased().everyMinutes(phut).create();
  Logger.log('Đã quay về: chỉ còn dayLenCloudflare mỗi ' + phut + ' phút. Sau 6 giờ máy chủ tự đồng bộ D1 theo đường cũ.');
}

function knXoaLich_(tenHam) {
  var cu = ScriptApp.getProjectTriggers();
  for (var i = 0; i < cu.length; i++) {
    if (tenHam.indexOf(cu[i].getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(cu[i]);
  }
}
