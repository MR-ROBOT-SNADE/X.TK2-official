/* =============================================================================
 * db/nap-excel.mjs — GHI SỐ LIỆU NẠP TỪ FILE EXCEL VÀO D1 (POST /api/nap)
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Trang nap-lieu.html đọc file Excel NGAY TRÊN TRÌNH DUYỆT, đổi thành các
 *   "phần" (mỗi phần = một khối của một dây chuyền) rồi gửi lên. File này:
 *     1) kiểm gói gửi lên (đúng dạng, trong giới hạn)             kiemGoi
 *     2) tìm mã chỉ tiêu của từng cột (cột chưa có thì tạo)        timMa
 *     3) đổi thành các ô so_lieu, đánh stt / ca như sheet          dungO
 *     4) ghi D1 theo quy tắc KHỐI-NGÀY (xem dưới) + tính lại ngày
 *        cuối có số của khối (moc_khoi)                           napExcel
 *     5) dựng lại các gói tháng /api/v2 bị ảnh hưởng               dungLaiGoi
 *   Kèm: huỷ một lần nạp (huyNap), liệt kê các lần nạp gần đây (dsLanNap).
 *   functions/api/[[route]].js gọi các hàm này SAU KHI đã kiểm khoá NAP_KEY.
 *
 * QUY TẮC KHỐI-NGÀY (chi tiết: migrations/0005_nap_excel.sql)
 *   Nạp khối X cho ngày D = THAY TOÀN BỘ số liệu của X trong ngày D, rồi ghi
 *   (X, D) vào bảng ngay_nap. Từ đó lần đồng bộ Google Sheet (db/dong-bo-d1.mjs)
 *   và db:nap bỏ qua khối-ngày đó — số Excel không bị sheet ghi đè hay xoá.
 *   Số Excel được ghi CÙNG mã chỉ tiêu với cột sheet (vd 'qtk.r2') nên biểu đồ,
 *   cảnh báo, dải chỉ số đọc ra y như số sheet, không phải sửa gì thêm.
 *
 * DẠNG GÓI GỬI LÊN (JSON)
 *   {
 *     "mau": "chuan",                 dạng file (js/nap/mau_nap.js)
 *     "ten_file": "KCS 09-2026.xlsx",
 *     "nguoi": "Nguyễn Văn A",        tự khai, để biết ai nạp
 *     "phan": [{
 *       "day_chuyen": "TK3", "khoi": "QTK",
 *       "cot":  ["R2", "TFe", "FeO"],                   tên cột y như trên dashboard
 *       "hang": [["2026-09-01", "A", [1.92, 56.1, 8.4]],     [ngày, kíp, giá trị theo cot]
 *                ["2026-09-01", "A", [1.95, null, 8.2]],     null = ô trống
 *                ["2026-09-01", "B", [2.01, 56.3, "Hỏng"]]]  chữ = ô chữ
 *     }, ...]
 *   }
 *   Thứ tự hàng trong một ngày = thứ tự mẫu: hàng thứ n của ngày D có stt = n,
 *   như trong sheet. Hàng không có ô nào có giá trị bị bỏ.
 *
 * GIỚI HẠN (gói Free: 10 ms CPU/lượt, 100.000 dòng ghi D1/ngày)
 *   Tối đa 10.000 ô mỗi lượt gửi (~ 1,5 tháng chất lượng QTK của cả hai dây
 *   chuyền): đo được ~6 ms CPU cho 10.000 ô, 20.000 ô đã ~11 ms. File lớn hơn thì
 *   trang nạp tự chia theo tháng, mỗi phần một lần nạp. Nạp lại y nguyên một file
 *   gần như không tốn dòng ghi: ô không đổi thì D1 không ghi.
 * ===========================================================================*/

import { taoMa, doanLoai } from './chuan-hoa.mjs';
import { docDanhMuc, SQL_GOI_THANG, SQL_GOI_NHAN_SU, thamSoGoiThang, thamSoGoiNhanSu } from './goi-v2.mjs';

export const GIOI_HAN = {
    o: 10000,           /* ô mỗi lần nạp (kể cả ô kíp) — xem GIỚI HẠN ở đầu file */
    phan: 20,           /* khối mỗi lần nạp */
    hang: 5000,         /* hàng mỗi khối */
    cot: 60,            /* cột mỗi khối */
    doDaiChu: 200,      /* ký tự mỗi ô chữ */
    doDaiTen: 100,      /* ký tự tên cột / tên file / tên người nạp */
};
const NGAY_SOM_NHAT = '2020-01-01';         /* ngày sớm hơn = gõ nhầm năm */
const LECH_GIO_VN_MS = 7 * 3600 * 1000;     /* giờ Việt Nam = UTC + 7 */

/** Lỗi do NGƯỜI NẠP (gói sai dạng, cột trùng, lần nạp không có...).
 *  functions/api trả nguyên câu báo cho trang hiện ra, kèm mã HTTP ma
 *  (400 / 404 / 409). Mọi lỗi khác bị coi là lỗi máy chủ (500). */
export class LoiNap extends Error {
    constructor(thongBao, ma) { super(thongBao); this.ma = ma || 400; }
}

/** Ngày theo giờ Việt Nam của một mốc ms -> 'YYYY-MM-DD'. */
function ngayVN(ms) { return new Date(ms + LECH_GIO_VN_MS).toISOString().slice(0, 10); }

/** 'YYYY-MM-DD' có phải ngày có thật không (loại '2026-02-31'). */
function ngayHopLe(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

/** Làm gọn chuỗi: chuẩn Unicode NFC (gõ tiếng Việt có thể ra hai dạng mã khác
 *  nhau cho cùng một chữ), gộp khoảng trắng liền nhau, bỏ khoảng trắng hai đầu. */
function gon(s) { return String(s).normalize('NFC').replace(/\s+/g, ' ').trim(); }

/** Tên cột Ca/kíp của một khối, đặt y như sheet (xem apiV2TenCot, js/api/api_v2.js):
 *    'QTK' -> 'Ca/kíp (QTK)';   'chất lượng than_1' -> 'Ca/kíp (chất lượng than)_1' */
function tenCotKip(khoi) {
    const m = khoi.match(/^(.*?)(_\d+)?$/);
    return 'Ca/kíp (' + m[1] + ')' + (m[2] || '');
}

/** kq.meta.changes của một câu trong batch (0 nếu không có). */
function soDoi(kq) { return (kq && kq.meta && kq.meta.changes) || 0; }

/* ---------------------------------------------------------------------------
 * CÁC CÂU SQL. Quy ước giống db/dong-bo-d1.mjs: dữ liệu truyền vào là MỘT chuỗi
 * JSON, SQLite tự tách bằng json_each() (không vướng trần 100 tham số/câu).
 * Mỗi ô gửi cho SQL: [ma, day_chuyen, ngay, stt, ca, kip, gia_tri, chu].
 * Mỗi khối-ngày:     [day_chuyen, khoi, ngay].
 * ------------------------------------------------------------------------- */
const SQL = {
    docChiTieu: 'SELECT ma, khoi, cot_sheet, loai FROM chi_tieu',

    /* Cột mới (chưa có trong danh mục). ?1 = [[ma, khoi, cot_sheet, loai], ...] */
    chiTieu: `INSERT INTO chi_tieu (ma, khoi, cot_sheet, loai)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'),
               json_extract(value, '$[2]'), json_extract(value, '$[3]')
        FROM json_each(?1) WHERE true
        ON CONFLICT DO NOTHING`,

    /* Ghi ô — chỉ khi KHÁC giá trị đang có (nạp lại y nguyên = không tốn dòng ghi).
       ?1 = các ô  ?2 = lúc ghi (ms) */
    soLieu: `INSERT INTO so_lieu (chi_tieu, day_chuyen, ngay, stt, ca, kip, gia_tri, chu, cap_nhat)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
               json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'),
               json_extract(value, '$[6]'), json_extract(value, '$[7]'), ?2
        FROM json_each(?1) WHERE true
        ON CONFLICT (chi_tieu, day_chuyen, ngay, stt) DO UPDATE SET
            ca = excluded.ca, kip = excluded.kip, gia_tri = excluded.gia_tri,
            chu = excluded.chu, cap_nhat = excluded.cap_nhat
        WHERE so_lieu.ca IS NOT excluded.ca OR so_lieu.kip IS NOT excluded.kip
           OR so_lieu.gia_tri IS NOT excluded.gia_tri OR so_lieu.chu IS NOT excluded.chu`,

    /* "Thay toàn bộ khối trong ngày": xoá mọi ô của khối-ngày đang nạp (của MỌI
       cột trong khối — kể cả ô do sheet ghi trước đây) mà lần nạp này không có.
       ?1 = các khối-ngày  ?2 = các ô (như câu trên).
       Câu con đầu dựng danh sách (mã, dây chuyền, ngày) từ khối-ngày x các cột
       của khối, để SQLite xoá thẳng theo khoá chính. */
    xoaThua: `DELETE FROM so_lieu
        WHERE (chi_tieu, day_chuyen, ngay) IN (
              SELECT c.ma, json_extract(p.value, '$[0]'), json_extract(p.value, '$[2]')
              FROM json_each(?1) AS p JOIN chi_tieu AS c ON c.khoi = json_extract(p.value, '$[1]'))
          AND (chi_tieu || '|' || day_chuyen || '|' || ngay || '|' || stt) NOT IN (
              SELECT json_extract(value, '$[0]') || '|' || json_extract(value, '$[1]') || '|'
                  || json_extract(value, '$[2]') || '|' || json_extract(value, '$[3]')
              FROM json_each(?2))`,

    /* Đánh dấu khối-ngày thuộc Excel (lần nạp sau phủ lên thì đổi sang lần đó).
       ?1 = các khối-ngày  ?2 = mã lần nạp */
    ngayNap: `INSERT INTO ngay_nap (day_chuyen, khoi, ngay, lan_nap)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?2
        FROM json_each(?1) WHERE true
        ON CONFLICT (day_chuyen, khoi, ngay) DO UPDATE SET lan_nap = excluded.lan_nap`,

    lanNap: 'INSERT INTO lan_nap (id, nguoi, ten_file, mau, so_o, tom_tat) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
    ghiSoGhi: 'UPDATE lan_nap SET so_ghi = ?2 WHERE id = ?1',

    /* Ngày cuối có số của khối (moc_khoi, migrations/0004): TÍNH LẠI TRỌN từ
       so_lieu — đúng cả khi nạp (mốc tiến) lẫn khi huỷ (mốc lùi về số sheet).
       Cùng điều kiện với mocKhoi() ở db/dong-bo-d1.mjs: cột theo ca, có kíp,
       số > 0, không quá hôm nay. Xoá trước rồi ghi lại: khối không còn số thì
       mất dòng. ?1 = [[day_chuyen, khoi], ...]  ?2 = hôm nay */
    xoaMoc: `DELETE FROM moc_khoi WHERE (tuyen, khoi) IN (
        SELECT lower(json_extract(value, '$[0]')), json_extract(value, '$[1]') FROM json_each(?1))`,
    mocLai: `INSERT INTO moc_khoi (tuyen, khoi, ngay_cuoi)
        SELECT tuyen, khoi, ngay FROM (
            SELECT lower(json_extract(p.value, '$[0]')) AS tuyen, json_extract(p.value, '$[1]') AS khoi,
                   (SELECT MAX(s.ngay) FROM chi_tieu AS c JOIN so_lieu AS s ON s.chi_tieu = c.ma
                    WHERE c.khoi = json_extract(p.value, '$[1]') AND c.loai = 'ca'
                      AND s.day_chuyen = json_extract(p.value, '$[0]')
                      AND s.stt > 0 AND s.gia_tri > 0 AND s.ngay <= ?2) AS ngay
            FROM json_each(?1) AS p)
        WHERE ngay IS NOT NULL`,

    /* Nhật ký chung, mỗi dây chuyền một dòng. ?4 = [[tuyen, số ô], ...] */
    nhatKy: `INSERT INTO nhat_ky_nap (luc, nguon, tuyen, so_gia_tri, ghi_chu)
        SELECT ?1, ?2, json_extract(value, '$[0]'), json_extract(value, '$[1]'), ?3 FROM json_each(?4)`,

    /* --- huỷ --- */
    docLan: 'SELECT id, huy_luc FROM lan_nap WHERE id = ?1',
    docKhoiNgayCuaLan: 'SELECT day_chuyen, khoi, ngay FROM ngay_nap WHERE lan_nap = ?1',
    /* Xoá số liệu của mọi khối-ngày mà lần nạp ?1 còn giữ (mọi cột của khối) */
    xoaSoLieuCuaLan: `DELETE FROM so_lieu WHERE (chi_tieu, day_chuyen, ngay) IN (
        SELECT c.ma, n.day_chuyen, n.ngay FROM ngay_nap AS n JOIN chi_tieu AS c ON c.khoi = n.khoi
        WHERE n.lan_nap = ?1)`,
    xoaKhoiNgayCuaLan: 'DELETE FROM ngay_nap WHERE lan_nap = ?1',
    danhDauHuy: 'UPDATE lan_nap SET huy_luc = ?2 WHERE id = ?1',
    /* Quên etag đã đồng bộ -> lần Apps Script đẩy kế tiếp, đồng bộ chạy lại dù
       sheet không đổi, trả số sheet về cho các ngày gần đây. ?1 = ['tk3', ...] */
    dongBoLai: 'UPDATE dong_bo SET etag = NULL WHERE tuyen IN (SELECT value FROM json_each(?1))',

    /* --- liệt kê --- */
    dsLan: 'SELECT id, nguoi, ten_file, mau, so_o, so_ghi, tom_tat, huy_luc FROM lan_nap ORDER BY id DESC LIMIT 30',
    demKhoiNgay: 'SELECT lan_nap, COUNT(*) AS n FROM ngay_nap GROUP BY lan_nap',
    dsGoi: 'SELECT tuyen, thang, ds_cot FROM goi_thang',
};

/* =============================================================================
 * 1) KIỂM GÓI GỬI LÊN
 * ===========================================================================*/

/** Kiểm từng phần, từng hàng, từng ô. Sai ở đâu -> ném LoiNap nói rõ chỗ sai.
 *  Ra: [{ dc, khoi, cot: [tên cột], hang: [[ngày, kíp, [giá trị]]] }] đã làm gọn
 *  (chữ chuẩn NFC, kíp viết hoa, ô chữ rỗng -> null). */
export function kiemGoi(j, homNay) {
    if (!j || typeof j !== 'object') throw new LoiNap('Gói gửi lên không phải đối tượng JSON');
    if (!Array.isArray(j.phan) || !j.phan.length) throw new LoiNap('Thiếu "phan" (danh sách khối cần nạp)');
    if (j.phan.length > GIOI_HAN.phan) throw new LoiNap('Tối đa ' + GIOI_HAN.phan + ' khối mỗi lần nạp');
    const daGap = new Set();
    let soO = 0;
    const phan = j.phan.map(function (p, i) {
        if (!p || (p.day_chuyen !== 'TK3' && p.day_chuyen !== 'TK4')) {
            throw new LoiNap('Phần ' + (i + 1) + ': day_chuyen phải là "TK3" hoặc "TK4"');
        }
        const khoi = typeof p.khoi === 'string' ? gon(p.khoi) : '';
        if (!khoi || khoi.length > 60) throw new LoiNap('Phần ' + (i + 1) + ': tên khối trống hoặc dài quá 60 ký tự');
        const ten = p.day_chuyen + ' — ' + khoi;
        if (daGap.has(ten)) throw new LoiNap(ten + ' có ở hai phần — gộp lại thành một');
        daGap.add(ten);

        if (!Array.isArray(p.cot) || !p.cot.length || p.cot.length > GIOI_HAN.cot) {
            throw new LoiNap(ten + ': cần từ 1 đến ' + GIOI_HAN.cot + ' cột');
        }
        const cot = p.cot.map(function (c) {
            const s = typeof c === 'string' ? gon(c) : '';
            if (!s || s.length > GIOI_HAN.doDaiTen) throw new LoiNap(ten + ': tên cột trống hoặc quá dài');
            /* Ngày và kíp đi ở đầu mỗi hàng, không phải một cột số liệu */
            if (/^(Thời gian|Ca\/kíp) \(/.test(s)) throw new LoiNap(ten + ': "' + s + '" là cột ngày/kíp, không nạp như cột số liệu');
            return s;
        });
        if (new Set(cot).size !== cot.length) throw new LoiNap(ten + ': có hai cột trùng tên');

        if (!Array.isArray(p.hang) || !p.hang.length || p.hang.length > GIOI_HAN.hang) {
            throw new LoiNap(ten + ': cần từ 1 đến ' + GIOI_HAN.hang + ' hàng');
        }
        const hang = p.hang.map(function (h, k) {
            const cho = ten + ', hàng ' + (k + 1);
            if (!Array.isArray(h) || h.length !== 3 || !Array.isArray(h[2]) || h[2].length !== cot.length) {
                throw new LoiNap(cho + ': phải có dạng [ngày, kíp, [' + cot.length + ' giá trị]]');
            }
            if (!ngayHopLe(h[0])) throw new LoiNap(cho + ': ngày "' + h[0] + '" không hợp lệ');
            if (h[0] < NGAY_SOM_NHAT || h[0] > homNay) {
                throw new LoiNap(cho + ': ngày ' + h[0] + ' nằm ngoài khoảng ' + NGAY_SOM_NHAT + ' → hôm nay (' + homNay + ')');
            }
            const kip = typeof h[1] === 'string' ? h[1].trim().toUpperCase() : '';
            if (kip !== 'A' && kip !== 'B' && kip !== 'C') throw new LoiNap(cho + ': kíp phải là A, B hoặc C');
            const gt = h[2].map(function (v) {
                if (v === null || v === undefined) return null;
                if (typeof v === 'number') {
                    if (!Number.isFinite(v)) throw new LoiNap(cho + ': có số không hợp lệ');
                    soO++;
                    return v;
                }
                if (typeof v === 'string') {
                    const s = gon(v);
                    if (s.length > GIOI_HAN.doDaiChu) throw new LoiNap(cho + ': ô chữ dài quá ' + GIOI_HAN.doDaiChu + ' ký tự');
                    if (s) soO++;
                    return s || null;
                }
                throw new LoiNap(cho + ': giá trị phải là số, chữ hoặc null');
            });
            soO++;                                  /* ô kíp của hàng */
            return [h[0], kip, gt];
        });
        return { dc: p.day_chuyen, khoi: khoi, cot: cot, hang: hang };
    });
    if (soO > GIOI_HAN.o) {
        throw new LoiNap('File có ' + soO + ' ô, quá giới hạn ' + GIOI_HAN.o + ' ô mỗi lần nạp — chia file theo tháng');
    }
    return phan;
}

/* =============================================================================
 * 2) TÌM MÃ CHỈ TIÊU CHO TỪNG CỘT
 * ===========================================================================*/

/** ds = toàn bộ bảng chi_tieu [{ ma, khoi, cot_sheet, loai }].
 *  Gắn vào mỗi phần: maKip (mã cột Ca/kíp của khối), maCot (mã theo từng cột).
 *    - Cột đã có (cùng khối, cùng tên) -> dùng mã đó: số Excel nối tiếp số sheet.
 *    - Chưa có -> tạo mới bằng ĐÚNG cách sheet đặt mã (taoMa), loại đoán theo
 *      tên cột (doanLoai). Khối chưa có cũng được (khối mới chỉ có trong Excel).
 *  Từ chối khi:
 *    - tên cột đã thuộc KHỐI KHÁC: trình duyệt dựng bảng ngang theo TÊN cột
 *      (js/api/api_v2.js), hai khối chung tên cột là số đè lên nhau;
 *    - mã sinh ra trùng mã của một cột khác.
 *  Ra: danh sách chỉ tiêu cần tạo [{ ma, khoi, cot_sheet, loai }]. */
export function timMa(phan, ds) {
    const theoTen = new Map(), theoMa = new Map(), khoiCuaCot = new Map(), kipCuaKhoi = new Map();
    for (const c of ds) {
        theoTen.set(c.khoi + '|' + c.cot_sheet, c);
        theoMa.set(c.ma, c);
        if (/^Ca\/kíp \(/.test(c.cot_sheet)) kipCuaKhoi.set(c.khoi, c);
        else if (!khoiCuaCot.has(c.cot_sheet)) khoiCuaCot.set(c.cot_sheet, c.khoi);
    }
    const moi = [];
    const tao = function (khoi, cot, loai) {
        const ma = taoMa(khoi, cot);
        const trung = theoMa.get(ma);
        if (trung) {
            throw new LoiNap('Cột "' + cot + '" (khối ' + khoi + ') sinh ra mã "' + ma + '" trùng với cột "'
                + trung.cot_sheet + '" (khối ' + trung.khoi + ') — đổi tên cột');
        }
        const c = { ma: ma, khoi: khoi, cot_sheet: cot, loai: loai };
        theoMa.set(ma, c);
        theoTen.set(khoi + '|' + cot, c);
        moi.push(c);
        return c;
    };
    for (const p of phan) {
        let kip = kipCuaKhoi.get(p.khoi);
        if (!kip) { kip = tao(p.khoi, tenCotKip(p.khoi), 'chu'); kipCuaKhoi.set(p.khoi, kip); }
        p.maKip = kip.ma;
        p.maCot = p.cot.map(function (cot) {
            const co = theoTen.get(p.khoi + '|' + cot);
            if (co) return co.ma;
            const khac = khoiCuaCot.get(cot);
            if (khac && khac !== p.khoi) {
                throw new LoiNap('Cột "' + cot + '" đã thuộc khối ' + khac + ', không thêm vào khối ' + p.khoi
                    + ' được (trên dashboard, tên cột không được trùng giữa các khối)');
            }
            khoiCuaCot.set(cot, p.khoi);
            return tao(p.khoi, cot, doanLoai(cot)).ma;
        });
    }
    return moi;
}

/* =============================================================================
 * 3) ĐỔI THÀNH CÁC Ô so_lieu
 * ===========================================================================*/

/** Đánh stt / ca y như sheet (db/chuan-hoa.mjs):
 *    stt = thứ tự hàng trong ngày (1, 2, 3...), theo đúng thứ tự trong file;
 *    ca  = tăng 1 mỗi khi kíp đổi trong ngày (A, A, B -> 1, 1, 2).
 *  Mỗi hàng ra một ô kíp (cột Ca/kíp, chữ 'A') + một ô cho mỗi giá trị khác null.
 *  Ô kíp giữ cho hàng tồn tại kể cả khi chỉ có vài cột có số (trình duyệt dựng
 *  hàng từ các ô — xem js/api/api_v2.js).
 *  Ra: { o         [[ma, dc, ngay, stt, ca, kip, gia_tri, chu]]
 *        khoiNgay  [[dc, khoi, ngay]]
 *        tomTat    [[dc, khoi, từ ngày, đến ngày, số ngày]]
 *        thang     Map<'tk3', Set<'YYYY-MM'>> — các tháng bị đụng, để dựng lại gói
 *        soHangBo  số hàng bị bỏ vì không có ô nào có giá trị } */
export function dungO(phan) {
    const o = [], khoiNgay = [], tomTat = [], thang = new Map();
    let soHangBo = 0;
    for (const p of phan) {
        /* Gom hàng theo ngày, GIỮ thứ tự trong file */
        const theoNgay = new Map();
        for (const h of p.hang) {
            if (h[2].every(function (v) { return v === null; })) { soHangBo++; continue; }
            if (!theoNgay.has(h[0])) theoNgay.set(h[0], []);
            theoNgay.get(h[0]).push(h);
        }
        if (!theoNgay.size) throw new LoiNap(p.dc + ' — ' + p.khoi + ': không có hàng nào có số liệu');
        const cacNgay = [...theoNgay.keys()].sort();
        const tuyen = p.dc.toLowerCase();
        if (!thang.has(tuyen)) thang.set(tuyen, new Set());
        for (const d of cacNgay) {
            khoiNgay.push([p.dc, p.khoi, d]);
            thang.get(tuyen).add(d.slice(0, 7));
            let ca = 0, kipTruoc = null;
            theoNgay.get(d).forEach(function (h, i) {
                const stt = i + 1, kip = h[1];
                if (kip !== kipTruoc) { ca++; kipTruoc = kip; }
                o.push([p.maKip, p.dc, d, stt, ca, kip, null, kip]);
                h[2].forEach(function (v, c) {
                    if (v === null) return;
                    o.push(typeof v === 'number' ? [p.maCot[c], p.dc, d, stt, ca, kip, v, null]
                                                 : [p.maCot[c], p.dc, d, stt, ca, kip, null, v]);
                });
            });
        }
        tomTat.push([p.dc, p.khoi, cacNgay[0], cacNgay[cacNgay.length - 1], cacNgay.length]);
    }
    return { o: o, khoiNgay: khoiNgay, tomTat: tomTat, thang: thang, soHangBo: soHangBo };
}

/* =============================================================================
 * 4) GHI D1
 * ===========================================================================*/

/** Dựng lại gói tháng /api/v2 (bảng goi_thang):
 *    - mọi gói dựng theo danh mục cột CŨ (vừa thêm cột -> vân tay đổi -> /api/v2
 *      sẽ trả 503 cho tới khi dựng lại hết) — kể cả gói nhân sự;
 *    - các tháng vừa bị đụng (thangCham: Map<'tk3', Set<'YYYY-MM'>>), kể cả tháng
 *      chưa từng có gói (vd nạp bù tháng cũ hơn cả sheet).
 *  Ra: số gói đã dựng. */
async function dungLaiGoi(db, thangCham, luc) {
    const [dm, goi] = await Promise.all([docDanhMuc(db), db.prepare(SQL.dsGoi).all()]);
    const can = new Map();
    const them = function (t, th) { if (!can.has(t)) can.set(t, new Set()); can.get(t).add(th); };
    for (const g of goi.results || []) if (g.ds_cot !== dm.vanTay) them(g.tuyen, g.thang);
    for (const [t, ds] of thangCham) for (const th of ds) them(t, th);
    const cau = [];
    for (const [t, ds] of can) {
        for (const th of [...ds].sort()) {
            cau.push(th === 'nhan-su'
                ? db.prepare(SQL_GOI_NHAN_SU).bind(...thamSoGoiNhanSu(t, luc, dm))
                : db.prepare(SQL_GOI_THANG).bind(...thamSoGoiThang(t, th, luc, dm)));
        }
    }
    if (cau.length) await db.batch(cau);
    return cau.length;
}

/**
 * HÀM CHÍNH — nạp một file.
 *   db  binding D1   j  gói đã JSON.parse (dạng: đầu file)   luc  Date.now()
 * Ra: { lan_nap (mã lần nạp), so_o, so_ghi (dòng D1 đổi), so_goi (gói dựng lại),
 *       so_hang_bo, cot_moi (cột vừa tạo), tom_tat }
 *
 * Các bước:
 *   1-3) kiểm gói, tìm mã, đổi thành ô (không đụng D1 trừ một lần đọc danh mục)
 *   4)   MỘT batch = một giao dịch: hỏng câu nào thì không câu nào được ghi
 *          thêm cột mới -> ghi ô -> xoá ô thừa của khối-ngày -> đánh dấu khối-ngày
 *          -> ghi lần nạp -> tính lại moc_khoi -> nhật ký
 *   5)   dựng lại gói tháng
 */
export async function napExcel(db, j, luc) {
    const homNay = ngayVN(luc);
    const phan = kiemGoi(j, homNay);
    const { results: ds } = await db.prepare(SQL.docChiTieu).all();
    const moi = timMa(phan, ds || []);
    const x = dungO(phan);

    const id = luc;                                   /* mã lần nạp = mốc ms */
    const tenGon = function (v, mac) { return typeof v === 'string' && gon(v) ? gon(v).slice(0, GIOI_HAN.doDaiTen) : mac; };
    const mau = typeof j.mau === 'string' && /^[a-z0-9_-]{1,30}$/.test(j.mau) ? j.mau : 'khac';
    const khoiNap = [];                               /* [[dc, khoi]] không trùng */
    for (const p of phan) khoiNap.push([p.dc, p.khoi]);
    const soOTheoTuyen = {};
    for (const c of x.o) soOTheoTuyen[c[1].toLowerCase()] = (soOTheoTuyen[c[1].toLowerCase()] || 0) + 1;

    const oJson = JSON.stringify(x.o), knJson = JSON.stringify(x.khoiNgay), kJson = JSON.stringify(khoiNap);
    const cau = [];
    if (moi.length) cau.push(db.prepare(SQL.chiTieu).bind(JSON.stringify(moi.map(function (c) { return [c.ma, c.khoi, c.cot_sheet, c.loai]; }))));
    const iGhi = cau.length;
    cau.push(
        db.prepare(SQL.soLieu).bind(oJson, luc),
        db.prepare(SQL.xoaThua).bind(knJson, oJson),
        db.prepare(SQL.ngayNap).bind(knJson, id),
        db.prepare(SQL.lanNap).bind(id, tenGon(j.nguoi, null), tenGon(j.ten_file, null), mau, x.o.length, JSON.stringify(x.tomTat)),
        db.prepare(SQL.xoaMoc).bind(kJson),
        db.prepare(SQL.mocLai).bind(kJson, homNay),
        db.prepare(SQL.nhatKy).bind(luc, 'excel', 'lần nạp ' + id + (j.ten_file ? ' — ' + tenGon(j.ten_file, '') : ''),
            JSON.stringify(Object.entries(soOTheoTuyen))),
    );
    const kq = await db.batch(cau);
    const soGhi = soDoi(kq[iGhi]) + soDoi(kq[iGhi + 1]);
    await db.prepare(SQL.ghiSoGhi).bind(id, soGhi).run();

    const soGoi = await dungLaiGoi(db, x.thang, luc);
    return {
        lan_nap: id, so_o: x.o.length, so_ghi: soGhi, so_goi: soGoi, so_hang_bo: x.soHangBo,
        cot_moi: moi.map(function (c) { return c.khoi + ' / ' + c.cot_sheet; }), tom_tat: x.tomTat,
    };
}

/** HUỶ một lần nạp: xoá số liệu của các khối-ngày lần đó CÒN giữ (khối-ngày đã
 *  bị lần nạp sau phủ lên thì thuộc lần sau, không đụng), trả khối-ngày về cho
 *  sheet, tính lại moc_khoi, dựng lại gói.
 *  Số sheet của các ngày đó quay lại dần: lần đồng bộ kế tiếp lấy lại 14 ngày gần
 *  nhất (etag được quên để đồng bộ chạy dù sheet không đổi), ngày cũ hơn về theo
 *  đoạn cũ xoay vòng — muốn về ngay hết thì chạy db:chuan-bi -> db:nap.
 *  Ra: { lan_nap, so_xoa (ô đã xoá), so_khoi_ngay, so_goi } */
export async function huyNap(db, id, luc) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new LoiNap('Mã lần nạp không hợp lệ');
    const lan = await db.prepare(SQL.docLan).bind(id).first();
    if (!lan) throw new LoiNap('Không có lần nạp ' + id, 404);
    if (lan.huy_luc) throw new LoiNap('Lần nạp này đã huỷ trước đó', 409);

    const { results: kn } = await db.prepare(SQL.docKhoiNgayCuaLan).bind(id).all();
    const khoiNap = new Map(), thang = new Map();
    for (const x of kn || []) {
        khoiNap.set(x.day_chuyen + '|' + x.khoi, [x.day_chuyen, x.khoi]);
        const t = x.day_chuyen.toLowerCase();
        if (!thang.has(t)) thang.set(t, new Set());
        thang.get(t).add(x.ngay.slice(0, 7));
    }
    const kJson = JSON.stringify([...khoiNap.values()]);
    const kq = await db.batch([
        db.prepare(SQL.xoaSoLieuCuaLan).bind(id),
        db.prepare(SQL.xoaKhoiNgayCuaLan).bind(id),
        db.prepare(SQL.danhDauHuy).bind(id, luc),
        db.prepare(SQL.xoaMoc).bind(kJson),
        db.prepare(SQL.mocLai).bind(kJson, ngayVN(luc)),
        db.prepare(SQL.dongBoLai).bind(JSON.stringify([...thang.keys()])),
        db.prepare(SQL.nhatKy).bind(luc, 'huy-excel', 'huỷ lần nạp ' + id,
            JSON.stringify([...thang.keys()].map(function (t) { return [t, 0]; }))),
    ]);
    const soGoi = await dungLaiGoi(db, thang, luc);
    return { lan_nap: id, so_xoa: soDoi(kq[0]), so_khoi_ngay: (kn || []).length, so_goi: soGoi };
}

/** 30 lần nạp gần nhất, mới nhất trước. so_khoi_ngay_con = số khối-ngày lần đó
 *  còn giữ (0 khi đã huỷ, hoặc khi các lần nạp sau đã phủ hết). */
export async function dsLanNap(db) {
    const [lan, dem] = await db.batch([db.prepare(SQL.dsLan), db.prepare(SQL.demKhoiNgay)]);
    const con = new Map((dem.results || []).map(function (x) { return [x.lan_nap, x.n]; }));
    return (lan.results || []).map(function (x) {
        let tomTat = [];
        try { tomTat = JSON.parse(x.tom_tat || '[]'); } catch (e) { /* để trống */ }
        return { id: x.id, nguoi: x.nguoi, ten_file: x.ten_file, mau: x.mau, so_o: x.so_o, so_ghi: x.so_ghi,
            tom_tat: tomTat, huy_luc: x.huy_luc, so_khoi_ngay_con: con.get(x.id) || 0 };
    });
}
