/* =============================================================================
 * db/chuan-hoa.mjs — BIẾN BẢNG TÍNH "NGANG" THÀNH CÁC DÒNG "DỌC" CHO D1
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Nhận đúng dữ liệu Apps Script đang đẩy lên (/api/tk3, /api/tk4, /api/vattu)
 *   và trả về các dòng sẵn sàng ghi vào bảng D1 (migrations/0001_khoi_tao.sql).
 *
 * AI DÙNG FILE NÀY
 *   - db/dong-bo-d1.mjs        trên Cloudflare, mỗi lần Apps Script đẩy.
 *   - scripts/nap-lich-su.mjs  trên máy bạn, khi nạp lại toàn bộ lịch sử.
 *   File cố ý KHÔNG dùng gì riêng của Node, để hai nơi chuẩn hoá Y HỆT nhau.
 *
 * BẢNG TÍNH TRÔNG THẾ NÀO (đọc từ dữ liệu thật 26/09/2026)
 *   Tab DATABASE gồm ~14 "khối" đặt cạnh nhau theo chiều ngang. Mỗi khối mở đầu
 *   bằng cặp cột "Thời gian (tên khối)" | "Ca/kíp (tên khối)", sau đó là các cột
 *   số liệu của khối:
 *
 *     Thời gian (Điện) | Ca/kíp (Điện) | Điện năng | ... | Thời gian (QTK) | Ca/kíp (QTK) | TFe | ...
 *     01/10/2026       | A             | 1.234     | ... | 01/10/2026      | A            | 56,2
 *                      | B             | 1.198     | ... |                 | A            | 56,4
 *
 *   Apps Script gửi mỗi hàng thành một đối tượng { 'tên cột': ô, ... }; thứ tự
 *   khoá = thứ tự cột trong sheet, nên cột nào thuộc khối nào suy ra được từ vị
 *   trí, không phải khai tay.
 *
 *   Sau khi chuẩn hoá, MỖI Ô CÓ GIÁ TRỊ thành MỘT dòng "dọc":
 *     { chi_tieu: 'dien.dien_nang', day_chuyen: 'TK3', ngay: '2026-10-01',
 *       stt: 1, ca: 1, kip: 'A', gia_tri: 1234, chu: null }
 *
 * CÁC QUY TẮC ĐỌC (giữ y như extractChartData() ở js/components/Charts/chart_core.js,
 * để D1 và trình duyệt hiểu bảng tính giống nhau)
 *   - Ô ngày GỘP: chỉ hàng đầu của một ngày ghi ngày, các hàng sau để trống ->
 *     ngày được "điền xuôi" xuống các hàng sau.
 *   - Hàng không có Ca/kíp thì không lưu số liệu (trừ ô định mức, xem dưới).
 *   - Mẫu sheet điền sẵn ngày + kíp tới cuối tháng: hàng tương lai chưa có số
 *     thì chỉ lưu đúng ô kíp, các ô trống tự rơi ra.
 *
 * TỪ NGỮ
 *   khối      nhóm cột chung một cặp "Thời gian/Ca/kíp" (Điện, QTK, THthan...).
 *   chỉ tiêu  MỘT cột số liệu. Mã chỉ tiêu = tên khối + tên cột bỏ dấu, vd
 *             'ththan.tieu_hao_theo_nhiet_tri' (xem taoMa).
 *   kíp       nhóm người trực: 'A', 'B', 'C' — đúng chữ ghi trong cột Ca/kíp.
 *   stt       thứ tự hàng TRONG NGÀY của khối, đếm từ 1. Khối QTK lấy mẫu 8-12
 *             lần/ngày nên một kíp lặp nhiều hàng -> khoá phải là (ngày, stt).
 *   ca        số thứ tự ca trong ngày: tăng 1 mỗi khi kíp đổi (A,A,B -> 1,1,2).
 *   stt = 0   hàng mở đầu ngày CHƯA có kíp, chỉ giữ ô định mức / kế hoạch.
 *   loai      kiểu chỉ tiêu: 'ca' (số theo ca), 'luy_ke', 'muc_tieu' (định mức,
 *             kế hoạch), 'thong_ke' (trung bình, độ lệch...), 'chu' (chữ).
 * ===========================================================================*/

export const DAY_CHUYEN = ['TK3', 'TK4'];

/* Nhận ra cột mở đầu khối. '_1' ở cuối: Google Sheet tự thêm khi hai cột trùng
   tên, vd 'Thời gian (chất lượng than)_1' là khối than thứ hai. */
const RE_NGAY = /^Thời gian \((.+)\)(_\d+)?$/;
const RE_CA = /^Ca\/kíp \((.+)\)(_\d+)?$/;
/* Cột nhân sự: 'STT (A)', 'Mã nhân viên (B)'... — là danh sách người, không theo ngày */
const RE_NHAN_SU = /^(STT|Mã nhân viên|Vị trí công việc|Status)(?: \(([ABC])\))?$/;
const TRUONG_NHAN_SU = { 'STT': 'stt', 'Mã nhân viên': 'nhan_vien', 'Vị trí công việc': 'vi_tri', 'Status': 'trang_thai' };
/* Khối Công tác cải tiến (CTCT): danh sách đề tài, không theo ngày, dashboard
   không dùng -> chưa lưu. Cần thì thêm bảng riêng. */
const COT_BO_QUA = new Set(['STT (CTCT)', 'Nội dung (CTCT)', 'Giá trị làm lợi', 'Quy mô', 'Chủ đề tài']);
/* Ô báo lỗi công thức của Google Sheets: #DIV/0!, #REF!... -> lưu dạng chữ */
const RE_LOI = /^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|NULL!|ERROR!)/;
/* Chuỗi TRÔNG như số: chỉ gồm chữ số, dấu . , khoảng trắng, dấu trừ, % ở cuối.
   Không có bước lọc này thì ô 'Ca 1' bị docSo() đọc thành số 1. */
const RE_TRONG_NHU_SO = /^[+-]?[\d.,\s]+%?$/;

/* ---------------------------------------------------------------------------
 * ĐỌC SỐ TỪ Ô BẢNG TÍNH
 * ---------------------------------------------------------------------------
 * Bảng tính trộn hai kiểu viết số: kiểu Việt ('85,48' = 85,48) và kiểu Anh
 * ('5,854.00' = 5854). Các hàm dưới đoán dấu nào là dấu thập phân:
 *     '96.86'    -> 96.86        '85,48' -> 85.48
 *     '5,854.00' -> 5854         '0,047' -> 0.047
 *     '1,500'    -> MƠ HỒ (1,5 hay 1500?) -> theo dấu thập phân mà ĐA SỐ ô cùng
 *                  cột đang dùng; không có gợi ý thì coi là 1500.
 *
 * CHÉP NGUYÊN THUẬT TOÁN sheetNumber / sheetLaDauThapPhan / sheetDauThapPhanCot
 * của js/chung/chi_so.js. Sửa bên này thì sửa cả bên kia, không là D1 và trình
 * duyệt đọc cùng một ô ra hai số khác nhau.
 * ------------------------------------------------------------------------- */

/** Trong chuỗi số t chỉ có MỘT loại dấu (dau = '.' hoặc ','). Dấu đó có phải
 *  dấu thập phân không?
 *    - Xuất hiện >= 2 lần ('1.234.567')            -> không (là dấu nghìn)
 *    - Sau dấu KHÔNG phải đúng 3 chữ số ('85,48')  -> có
 *    - Phần nguyên là 0 hoặc dài hơn 3 ('0,047')   -> có
 *    - Còn lại (đúng 3 số sau dấu, vd '1,500') là MƠ HỒ -> hỏi goiY.
 *  goiY: '.' / ',' / null, hoặc một HÀM trả về các giá trị đó — dùng hàm để chỉ
 *  phải dò cả cột khi thật sự gặp ô mơ hồ (rất hiếm). */
function laDauThapPhan(t, dau, goiY) {
    const phan = t.replace(/^-/, '').split(dau);
    if (phan.length > 2) return false;
    const nguyen = phan[0], le = phan[1];
    if (le.length !== 3) return true;
    if (/^0*$/.test(nguyen) || nguyen.length > 3) return true;
    if (typeof goiY === 'function') goiY = goiY();
    if (goiY) return goiY === dau;
    return false;
}

/** Đọc một ô thành số (number) hoặc null nếu không phải số.
 *  v: giá trị ô (số sẵn, hoặc chuỗi như '1.234,5', '85,48 %').
 *  goiY: gợi ý dấu thập phân của cột — xem laDauThapPhan. */
export function docSo(v, goiY) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let t = String(v).trim().replace(/\s/g, '');
    if (t === '') return null;
    t = t.replace(/[^\d.,-]/g, '');          /* bỏ mọi thứ không phải số/dấu: %, đơn vị... */
    if (t === '' || t === '-') return null;

    /* Xác định dấu thập phân (tp) */
    const cham = t.lastIndexOf('.');
    const phay = t.lastIndexOf(',');
    let tp = '';
    if (cham >= 0 && phay >= 0) {
        tp = cham > phay ? '.' : ',';        /* có cả hai: dấu đứng SAU là thập phân */
    } else if (cham >= 0 || phay >= 0) {
        const dau = cham >= 0 ? '.' : ',';
        if (laDauThapPhan(t, dau, goiY)) tp = dau;
    }
    /* Bỏ dấu nghìn, đổi dấu thập phân thành '.' để Number() hiểu */
    const nghin = tp === '.' ? ',' : tp === ',' ? '.' : null;
    if (nghin) t = t.split(nghin).join('');
    else t = t.split('.').join('').split(',').join('');
    if (tp) t = t.replace(tp, '.');
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

/** Dấu thập phân mà ĐA SỐ ô của một cột đang dùng: '.', ',' hoặc null (hoà).
 *  Mỗi ô không mơ hồ "bỏ phiếu" một lần. Dùng làm gợi ý cho ô mơ hồ '1,500'. */
export function dauThapPhanCot(giaTri) {
    const phieu = { ',': 0, '.': 0 };
    for (const v of giaTri) {
        if (v === undefined || v === null || typeof v === 'number') continue;
        const t = String(v).replace(/[^\d.,-]/g, '');
        const cham = t.lastIndexOf('.'), phay = t.lastIndexOf(',');
        if (cham < 0 && phay < 0) continue;
        if (cham >= 0 && phay >= 0) { phieu[cham > phay ? '.' : ',']++; continue; }
        const dau = cham >= 0 ? '.' : ',';
        const khac = dau === '.' ? ',' : '.';
        const phan = t.replace(/^-/, '').split(dau);
        if (phan.length > 2) phieu[khac]++;      /* '1.234.567': dấu kia mới là thập phân */
        else if (laDauThapPhan(t, dau, null)) phieu[dau]++;
    }
    if (phieu[','] === phieu['.']) return null;
    return phieu[','] > phieu['.'] ? ',' : '.';
}

/** 'dd/mm/yyyy' (hoặc dd-mm-yyyy, dd.mm.yyyy) -> 'yyyy-mm-dd'.
 *  Sai dạng, hoặc ngày không có thật như 31/02/2026 -> null. */
export function docNgay(v) {
    const m = String(v || '').trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (!m) return null;
    const d = +m[1], th = +m[2], y = +m[3];
    /* Dựng thử ngày đó: 31/02 sẽ bị Date đẩy sang 03/03 -> không khớp -> null */
    const thu = new Date(Date.UTC(y, th - 1, d));
    if (thu.getUTCFullYear() !== y || thu.getUTCMonth() !== th - 1 || thu.getUTCDate() !== d) return null;
    return y + '-' + String(th).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/* ---------------------------------------------------------------------------
 * MÃ CHỈ TIÊU — tên máy đọc được cho mỗi cột, vd 'ththan.tieu_hao_theo_nhiet_tri'
 * ------------------------------------------------------------------------- */

/** Bỏ dấu tiếng Việt: 'Tiêu hao' -> 'Tieu hao', 'Đá' -> 'Da'.
 *  (Dải ký tự trong regex là các dấu thanh/dấu mũ tách ra bởi normalize('NFD').) */
function boDau(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Tên -> chữ thường không dấu, nối bằng '_': 'Tỉ lệ < 5mm' -> 'ti_le_duoi_5mm'. */
function slug(s) {
    return boDau(s).toLowerCase()
        .replace(/</g, ' duoi ').replace(/>/g, ' tren ')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Mã chỉ tiêu = slug(tên khối) + '.' + slug(tên cột).
 *    taoMa('THthan', 'Tiêu hao theo nhiệt trị') -> 'ththan.tieu_hao_theo_nhiet_tri'
 *  Đuôi ' (tên khối)' trong tên cột bị bỏ cho gọn:
 *    taoMa('QH', 'Tỉ lệ quặng HLC (QH)')         -> 'qh.ti_le_quang_hlc'
 *  CẢNH BÁO: đổi tên khối/cột trong sheet là đổi mã -> D1 coi như chỉ tiêu mới. */
export function taoMa(khoi, cot) {
    const goc = khoi.replace(/_\d+$/, '');
    let ten = cot;
    const duoi = ' (' + goc + ')';
    if (ten.endsWith(duoi) && ten.length > duoi.length) ten = ten.slice(0, -duoi.length);
    return slug(khoi) + '.' + (slug(ten) || 'cot');
}

/** Đoán LOẠI chỉ tiêu từ tên cột (xem "loai" ở đầu file).
 *    'Tích luỹ ...'                        -> 'luy_ke'
 *    'Định mức ...', '... kế hoạch'         -> 'muc_tieu'
 *    'Trung bình ...', 'Độ lệch chuẩn ...'  -> 'thong_ke'
 *    'Cảnh báo ...' hoặc cột toàn chữ       -> 'chu'
 *    còn lại                                -> 'ca' (số liệu từng ca)
 *  Dùng để tách "số liệu từng ca" khỏi luỹ kế / định mức — việc mà smartFilter()
 *  ở trình duyệt đang làm bằng cách dò tên khoá. */
export function doanLoai(cot, giaTriChu) {
    if (/t[íi]ch lu[ỹyũ]/i.test(cot)) return 'luy_ke';
    if (/^(Định mức|Mức trung bình)|kế hoạch|^Khoảng (dưới|trên)/i.test(cot)) return 'muc_tieu';
    if (/^(Hệ số biến thiên|Trung bình|Độ lệch chuẩn)/i.test(cot)) return 'thong_ke';
    if (/^Cảnh báo/i.test(cot) || giaTriChu) return 'chu';
    return 'ca';
}

/* ---------------------------------------------------------------------------
 * SỐ LIỆU THEO CA — TK3 / TK4
 * ------------------------------------------------------------------------- */

/** Chia danh sách cột (đúng thứ tự sheet) thành các khối.
 *  Ra: { khoi:   [{ ten, cotNgay, cotCa, cot: [cột số liệu...] }],
 *        nhanSu: [{ cot, truong, kip }]  — các cột danh sách nhân sự,
 *        boQua:  [{ cot, viSao }]        — cột không xếp được, kèm lý do }
 *  Khối thiếu cột Ca/kíp bị bỏ (không biết hàng nào thuộc kíp nào). */
export function tachKhoi(cacCot) {
    const khoi = [], nhanSu = [], boQua = [];
    let hienTai = null;
    for (const cot of cacCot) {
        const mN = cot.match(RE_NGAY);
        if (mN) {
            /* Gặp 'Thời gian (X)' -> mở khối mới tên X */
            hienTai = { ten: mN[1] + (mN[2] || ''), cotNgay: cot, cotCa: null, cot: [] };
            khoi.push(hienTai);
            continue;
        }
        const mC = cot.match(RE_CA);
        if (mC) {
            /* 'Ca/kíp (X)' phải đi liền sau 'Thời gian (X)' cùng tên */
            if (hienTai && !hienTai.cotCa && mC[1] + (mC[2] || '') === hienTai.ten) hienTai.cotCa = cot;
            else boQua.push({ cot: cot, viSao: 'cột Ca/kíp không đi liền cột Thời gian cùng tên' });
            continue;
        }
        const mS = cot.match(RE_NHAN_SU);
        if (mS) { nhanSu.push({ cot: cot, truong: TRUONG_NHAN_SU[mS[1]], kip: mS[2] || null }); continue; }
        if (COT_BO_QUA.has(cot)) { boQua.push({ cot: cot, viSao: 'khối CTCT, chưa lưu' }); continue; }
        if (!hienTai) { boQua.push({ cot: cot, viSao: 'đứng trước khối đầu tiên' }); continue; }
        hienTai.cot.push(cot);                   /* cột số liệu của khối đang mở */
    }
    for (const k of khoi) {
        if (!k.cotCa) boQua.push({ cot: k.cotNgay, viSao: 'khối không có cột Ca/kíp' });
    }
    return { khoi: khoi.filter(k => k.cotCa), nhanSu: nhanSu, boQua: boQua };
}

/** Ô trống: '', undefined, null hoặc chuỗi toàn khoảng trắng. Số 0 KHÔNG trống. */
function laTrong(v) {
    if (v === '' || v === undefined || v === null) return true;
    return typeof v !== 'number' && String(v).trim() === '';
}

/* Cùng một chuỗi ngày '01/10/2026' lặp lại ở ~14 khối -> đọc một lần rồi nhớ
   (tiết kiệm CPU trên Cloudflare). Giới hạn 20.000 mục để bộ nhớ không phình. */
const nhoNgay = new Map();
function docNgayNho(v) {
    const k = String(v);
    let iso = nhoNgay.get(k);
    if (iso === undefined) {
        iso = docNgay(k);
        if (nhoNgay.size < 20000) nhoNgay.set(k, iso);
    }
    return iso;
}

/**
 * Chuẩn hoá toàn bộ bảng tính của MỘT dây chuyền thành các dòng dọc.
 *
 * Vào:
 *   dayChuyen  'TK3' | 'TK4'
 *   rows       mảng hàng như /api/tk3 trả trong data: [{ 'tên cột': ô, ... }, ...]
 *   capNhat    mốc ghi (ms), điền vào cột cap_nhat
 *   tuyChon    { locNgay(iso) -> true/false }: chỉ lấy ô của những ngày được
 *              nhận. Bỏ trống = lấy hết (scripts/nap-lich-su.mjs). Cloudflare
 *              dùng để chỉ xử lý vài tuần mỗi lần đẩy — xử lý cả lịch sử thì
 *              vượt giới hạn 10 ms CPU của gói Free.
 *
 * Ra: {
 *   chiTieu     Map<mã, { ma, khoi, cot_sheet, loai }>   danh mục cột
 *   soLieu      [{ chi_tieu, day_chuyen, ngay, stt, ca, kip, gia_tri, chu, cap_nhat }]
 *   nhanSu      [{ day_chuyen, kip, stt, nhan_vien, vi_tri, trang_thai }]
 *   boQua       cột không xếp được vào khối nào (kèm lý do)
 *   canhBao     các điều bất thường trong sheet, viết cho người đọc
 *   ngayNhoNhat ngày sớm nhất có Ca/kíp (tính cả ngoài locNgay)
 *   ngayLonNhat ngày muộn nhất có ô được lưu (tính cả hàng stt = 0)
 * }
 *
 * Lưu ý: khi có locNgay, "loai" trong chiTieu chỉ dựa trên các ô ĐÃ lấy — nơi
 * gọi không nên ghi đè loai đã có trong D1 bằng giá trị đó.
 */
export function chuanHoaDayChuyen(dayChuyen, rows, capNhat, tuyChon) {
    if (DAY_CHUYEN.indexOf(dayChuyen) < 0) throw new Error('Dây chuyền lạ: ' + dayChuyen);
    const locNgay = tuyChon && tuyChon.locNgay;

    /* BƯỚC 1 — Lấy danh sách cột theo đúng thứ tự sheet. Apps Script dựng mọi
       hàng từ CÙNG một hàng tiêu đề nên chỉ cần hàng đầu; gộp thêm hàng cuối
       cho chắc. (Gộp khoá của cả 1.084 hàng tốn 1,4 ms — quá đắt khi chỉ có
       10 ms CPU.) */
    const thuTu = [], daCo = new Set();
    for (const r of [rows[0], rows[rows.length - 1]]) {
        if (r) for (const k of Object.keys(r)) if (!daCo.has(k)) { daCo.add(k); thuTu.push(k); }
    }

    /* BƯỚC 2 — Chia cột thành khối */
    const { khoi, nhanSu: cotNhanSu, boQua } = tachKhoi(thuTu);
    const chiTieu = new Map(), soLieu = [], canhBao = [];
    let ngayNhoNhat = null;             /* ngày sớm nhất có Ca/kíp, mọi khối */
    let ngayLonNhat = null;             /* ngày muộn nhất có ô được lưu (kể cả stt = 0) */

    /* BƯỚC 3 — Đi từng khối, từng hàng, từng ô */
    for (const k of khoi) {
        const n = k.cot.length;
        const maCot = k.cot.map(cot => taoMa(k.ten, cot));
        /* Cột Ca/kíp cũng được lưu thành một chỉ tiêu (giá trị chữ 'A'/'B'/'C').
           Nhờ vậy hàng có kíp mà mọi ô số trống (ngày chưa nhập, mẫu điền sẵn
           tới cuối tháng) vẫn còn trong D1. Trình duyệt cần các hàng đó: biểu
           đồ gộp TK3+TK4 ghép số TK4 vào NHÃN NGÀY của TK3 theo VỊ TRÍ hàng —
           thiếu một hàng là số TK4 bị vẽ lệch sang ngày khác. */
        const maKip = taoMa(k.ten, k.cotCa);
        /* Gợi ý dấu thập phân cho từng cột — chỉ thật sự dò cả cột khi gặp ô
           mơ hồ kiểu '1,500' (rất hiếm), và chỉ dò một lần */
        const goiY = k.cot.map(cot => {
            let da = false, kq = null;
            return () => { if (!da) { kq = dauThapPhanCot(rows.map(r => r[cot])); da = true; } return kq; };
        });
        const laMucTieu = k.cot.map(c => doanLoai(c) === 'muc_tieu');
        const cotSoLieuThat = k.cot.filter((c, i) => !laMucTieu[i]);
        const soO = new Array(n).fill(0), soChu = new Array(n).fill(0);  /* đếm để đoán loại cột */
        const trangThaiNgay = new Map();  /* ngày -> { stt, ca, kip } đang đếm dở */
        const thieuKip = [];              /* hàng CÓ số liệu mà trống Ca/kíp -> báo */
        const daCoDongNgay = new Set();   /* ngày đã lấy hàng stt = 0 */
        let ngay = null, ngayTruoc = null;

        /* Đọc một ô -> [gia_tri (số hoặc null), chu (chuỗi hoặc null)] */
        const docO = (c, v) => {
            soO[c]++;
            let giaTri = null, chu = null;
            if (typeof v === 'number') {
                giaTri = Number.isFinite(v) ? v : null;
            } else {
                const s = String(v).trim();
                if (RE_LOI.test(s)) chu = s;
                else if (RE_TRONG_NHU_SO.test(s)) giaTri = docSo(s, goiY[c]);
                /* Chuẩn hoá Unicode chỉ cho ô CHỮ — ô số không cần, mà đây là
                   bước tốn nhất nếu làm cho cả 30 nghìn ô */
                if (giaTri === null && chu === null) chu = s.normalize('NFC');
            }
            if (chu !== null) soChu[c]++;
            return [giaTri, chu];
        };

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            /* Đọc ô ngày TRƯỚC khi xét Ca/kíp (giống extractChartData()): hàng
               không có kíp vẫn có thể là hàng mở đầu một ngày mới */
            let ngayDongNay = null;
            if (!laTrong(r[k.cotNgay])) {
                const iso = docNgayNho(r[k.cotNgay]);
                if (iso) ngay = ngayDongNay = iso;
                else canhBao.push(dayChuyen + ' ' + k.cotNgay + ' dòng ' + (i + 1) + ': ngày không đọc được "' + r[k.cotNgay] + '"');
            }

            if (laTrong(r[k.cotCa])) {
                /* HÀNG KHÔNG CÓ KÍP.
                   Nếu là hàng MỞ ĐẦU một ngày (có ô ngày): vẫn giữ các ô định mức /
                   kế hoạch với stt = 0, kip = ''. Lý do: ribbonQuet() đọc KẾ HOẠCH
                   THÁNG đúng ở hàng này — ngày 01 của tháng chưa chạy thì chưa có
                   kíp. Các ô số liệu thật thì không có kíp là không lưu được. */
                if (ngayDongNay && (ngayLonNhat === null || ngayDongNay > ngayLonNhat)
                    && laMucTieu.some((m, c) => m && !laTrong(r[k.cot[c]]))) ngayLonNhat = ngayDongNay;
                if (ngayDongNay && !daCoDongNgay.has(ngayDongNay) && (!locNgay || locNgay(ngayDongNay))) {
                    daCoDongNgay.add(ngayDongNay);
                    for (let c = 0; c < n; c++) {
                        if (!laMucTieu[c] || laTrong(r[k.cot[c]])) continue;
                        const [giaTri, chu] = docO(c, r[k.cot[c]]);
                        soLieu.push({
                            chi_tieu: maCot[c], day_chuyen: dayChuyen, ngay: ngayDongNay,
                            stt: 0, ca: 0, kip: '', gia_tri: giaTri, chu: chu, cap_nhat: capNhat,
                        });
                    }
                }
                /* ...và phải BÁO nếu hàng có số liệu thật bị mất vì thiếu kíp. Cột
                   định mức / kế hoạch thì không tính: sheet điền sẵn hằng số
                   (45, 48, 51...) cho cả năm. */
                if ((!locNgay || (ngay && locNgay(ngay))) && cotSoLieuThat.some(c => !laTrong(r[c]))) {
                    thieuKip.push((i + 1) + (ngay ? ' (' + ngay + ')' : ''));
                }
                continue;
            }
            if (!ngay) {
                canhBao.push(dayChuyen + ' khối ' + k.ten + ' dòng ' + (i + 1) + ': có Ca/kíp nhưng chưa có ngày nào phía trên — bỏ');
                continue;
            }
            const kip = String(r[k.cotCa]).trim().toUpperCase();

            /* Đánh số stt / ca trong ngày */
            let tt = trangThaiNgay.get(ngay);
            if (!tt) { tt = { stt: 0, ca: 0, kip: null }; trangThaiNgay.set(ngay, tt); }
            else if (ngay !== ngayTruoc) {
                canhBao.push(dayChuyen + ' khối ' + k.ten + ': ngày ' + ngay + ' xuất hiện lại ở dòng ' + (i + 1) + ' (không liền nhau) — đánh số tiếp');
            }
            ngayTruoc = ngay;
            if (ngayNhoNhat === null || ngay < ngayNhoNhat) ngayNhoNhat = ngay;
            if (ngayLonNhat === null || ngay > ngayLonNhat) ngayLonNhat = ngay;
            tt.stt++;
            if (kip !== tt.kip) { tt.ca++; tt.kip = kip; }
            /* stt/ca vẫn được đếm cho MỌI hàng phía trên, kể cả ngày bị locNgay
               loại, để ngày nào được lấy cũng mang đúng số thứ tự như khi lấy cả
               lịch sử */
            if (locNgay && !locNgay(ngay)) continue;

            /* Một dòng cho ô kíp, rồi một dòng cho mỗi ô số liệu có giá trị */
            soLieu.push({
                chi_tieu: maKip, day_chuyen: dayChuyen, ngay: ngay,
                stt: tt.stt, ca: tt.ca, kip: kip, gia_tri: null, chu: kip, cap_nhat: capNhat,
            });
            for (let c = 0; c < n; c++) {
                const v = r[k.cot[c]];
                if (laTrong(v)) continue;
                const [giaTri, chu] = docO(c, v);
                soLieu.push({
                    chi_tieu: maCot[c], day_chuyen: dayChuyen, ngay: ngay,
                    stt: tt.stt, ca: tt.ca, kip: kip, gia_tri: giaTri, chu: chu, cap_nhat: capNhat,
                });
            }
        }

        if (thieuKip.length) {
            canhBao.push(dayChuyen + ' khối ' + k.ten + ': ' + thieuKip.length + ' dòng có số liệu nhưng TRỐNG '
                + k.cotCa + ' — không lưu, cần điền kíp trong sheet. Dòng: '
                + thieuKip.slice(0, 6).join(', ') + (thieuKip.length > 6 ? '...' : ''));
        }

        /* BƯỚC 4 — Ghi danh mục chỉ tiêu của khối */
        chiTieu.set(maKip, { ma: maKip, khoi: k.ten, cot_sheet: k.cotCa, loai: 'chu' });
        for (let c = 0; c < n; c++) {
            const ma = maCot[c], cot = k.cot[c];
            const cu = chiTieu.get(ma);
            /* Hai cột khác nhau ra cùng một mã -> dừng hẳn, không ghi chồng số liệu */
            if (cu && (cu.khoi !== k.ten || cu.cot_sheet !== cot)) {
                throw new Error('Trùng mã chỉ tiêu "' + ma + '": ' + cu.khoi + '/' + cu.cot_sheet + ' và ' + k.ten + '/' + cot);
            }
            /* Cột mà PHẦN LỚN ô (trong số ô được lưu) là chữ thì loại 'chu' */
            const phanLonChu = soO[c] > 0 && soChu[c] * 2 > soO[c];
            chiTieu.set(ma, { ma: ma, khoi: k.ten, cot_sheet: cot, loai: doanLoai(cot, phanLonChu) });
        }
    }

    /* BƯỚC 5 — Nhân sự. Các cột nhân sự là danh sách dọc: hàng i của 'STT (A)'
       đi với hàng i của 'Mã nhân viên (A)', 'Vị trí công việc (A)'... */
    const nhanSu = [];
    for (const kip of ['A', 'B', 'C']) {
        const cot = {};
        for (const c of cotNhanSu) if (c.kip === kip) cot[c.truong] = c.cot;
        if (!cot.stt && !cot.nhan_vien) continue;
        const sttDaGap = new Set();
        for (const r of rows) {
            const ten = cot.nhan_vien && !laTrong(r[cot.nhan_vien]) ? String(r[cot.nhan_vien]).trim().normalize('NFC') : null;
            const stt = cot.stt ? docSo(r[cot.stt]) : null;
            if (!ten && stt === null) continue;
            /* STT là khoá chính trong D1: thiếu hoặc trùng thì không lưu được */
            if (stt === null || !Number.isInteger(stt) || sttDaGap.has(stt)) {
                canhBao.push(dayChuyen + ' nhân sự kíp ' + kip + ': STT thiếu/trùng ("' + (r[cot.stt] ?? '') + '") cho ' + (ten || '?') + ' — bỏ');
                continue;
            }
            sttDaGap.add(stt);
            const lay = f => cot[f] && !laTrong(r[cot[f]]) ? String(r[cot[f]]).trim().normalize('NFC') : null;
            nhanSu.push({ day_chuyen: dayChuyen, kip: kip, stt: stt, nhan_vien: ten, vi_tri: lay('vi_tri'), trang_thai: lay('trang_thai') });
        }
    }

    return { chiTieu: chiTieu, soLieu: soLieu, nhanSu: nhanSu, boQua: boQua, canhBao: canhBao,
        ngayNhoNhat: ngayNhoNhat, ngayLonNhat: ngayLonNhat };
}

/* ---------------------------------------------------------------------------
 * VẬT TƯ
 * ---------------------------------------------------------------------------
 * Apps Script vật tư gửi data dạng:
 *   { TK3: { tongHop: [...tồn kho...], nhap: [...phiếu nhập...], xuat: [...] },
 *     TK4: { ... } }
 * ------------------------------------------------------------------------- */

/** Tách ngày và ca từ mô tả phiếu, vd '1B 28/10/2025 - Thắng Lợi':
 *    -> { ngay: '2025-10-28', ngay_thieu_nam: null, ca: 1, kip: 'B' }
 *  Mô tả thiếu năm ('1B ngày 23/1') -> ngay = null, ngay_thieu_nam = '01-23'.
 *  Chép theo vtTachNgayCa() của vattu.js, nhưng KHÔNG đoán năm: trình duyệt
 *  đoán theo năm hiện tại, sang năm mới là xếp nhầm phiếu cũ. */
export function tachNgayCa(moTa) {
    const s = String(moTa || '');
    const ra = { ngay: null, ngay_thieu_nam: null, ca: null, kip: null };
    const mCa = s.match(/^\s*([123])\s*([ABC])/i);           /* '1B' ở đầu = ca 1, kíp B */
    if (mCa) { ra.ca = +mCa[1]; ra.kip = mCa[2].toUpperCase(); }
    const mN = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);   /* d/m hoặc d/m/y */
    if (mN) {
        const d = +mN[1], th = +mN[2];
        if (mN[3]) {
            const y = +mN[3] < 100 ? 2000 + +mN[3] : +mN[3];  /* '25' -> 2025 */
            ra.ngay = docNgay(d + '/' + th + '/' + y);
        } else if (d >= 1 && d <= 31 && th >= 1 && th <= 12) {
            ra.ngay_thieu_nam = String(th).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        }
    }
    return ra;
}

/** Chuẩn hoá dữ liệu vật tư -> { ton: [dòng vat_tu_ton], phieu: [dòng vat_tu_phieu], canhBao }.
 *  Tên vật tư trùng trong tongHop: giữ dòng đầu, báo trong canhBao. */
export function chuanHoaVatTu(data) {
    const ton = [], phieu = [], canhBao = [];
    for (const dc of DAY_CHUYEN) {
        const d = data && data[dc];
        if (!d) continue;
        const daGap = new Set();
        for (const x of d.tongHop || []) {
            const ten = String(x.ten || '').trim().normalize('NFC');
            if (!ten) continue;
            if (daGap.has(ten)) { canhBao.push(dc + ' vật tư trùng tên trong tongHop: ' + ten + ' — giữ dòng đầu'); continue; }
            daGap.add(ten);
            ton.push({ day_chuyen: dc, ten: ten, don_vi: x.donVi ? String(x.donVi).trim() : null,
                ton_dau: docSo(x.tonDau), nhap: docSo(x.nhap), xuat: docSo(x.xuat),
                ton_cuoi: docSo(x.tonCuoi), ton_an_toan: docSo(x.tonAnToan) });
        }
        for (const loai of ['nhap', 'xuat']) {
            for (const x of d[loai] || []) {
                const ten = String(x.ten || '').trim().normalize('NFC');
                if (!ten) continue;
                const moTa = x.moTa == null ? null : String(x.moTa).trim().normalize('NFC');
                phieu.push(Object.assign({ day_chuyen: dc, loai: loai, ten: ten,
                    so_luong: docSo(x.soLuong), mo_ta: moTa }, tachNgayCa(moTa)));
            }
        }
    }
    return { ton: ton, phieu: phieu, canhBao: canhBao };
}
