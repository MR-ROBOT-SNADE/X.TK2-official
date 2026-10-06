/* =============================================================================
 * db/dong-bo-d1.mjs — CHÉP BẢN APPS SCRIPT VỪA ĐẨY SANG CƠ SỞ DỮ LIỆU D1
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Mỗi lần Apps Script đẩy bảng tính lên, functions/api/[[route]].js ghi nguyên
 *   văn vào KV, trả lời Apps Script, RỒI MỚI gọi dongBoD1() ở chế độ nền. Hàm
 *   này so bản mới với D1 và chỉ ghi phần khác. Sau đó dựng lại các "gói tháng"
 *   mà /api/v2 trả cho trình duyệt (bảng goi_thang, xem db/goi-v2.mjs).
 *   D1 có lỗi hay bị ngắt giữa chừng thì KV vẫn đã ghi xong — dashboard không mất gì.
 *
 * VÌ SAO KHÔNG CHÉP CẢ BẢNG MỖI LẦN
 *   Gói Free cho 10 ms CPU mỗi lượt gọi (thỉnh thoảng vượt thì được châm chước).
 *   Riêng JSON.parse gói 3 MB của TK3 đã ~8 ms; chuẩn hoá cả lịch sử thêm ~22 ms.
 *   Nên mỗi lần chỉ làm một phần nhỏ, và không phải lần đẩy nào cũng làm:
 *     - dữ liệu y nguyên lần trước (cùng etag)   -> bỏ qua;
 *     - chưa đủ NHIP_PHUT (20) phút từ lần trước  -> bỏ qua (lần sau lấy lại cả
 *       cửa sổ nên không lỡ gì, chỉ chậm vài phút);
 *     - còn lại: chuẩn hoá CỬA SỔ 14 ngày gần nhất + MỘT ĐOẠN CŨ dài 14 ngày.
 *       Đoạn cũ lùi dần mỗi lần, tới ngày đầu tiên có số liệu thì quay lại.
 *
 *   Ví dụ hôm nay 02/10:
 *       cửa sổ              19/09 -> mọi ngày sau (kể cả ngày tương lai)
 *       đoạn cũ lần này     05/09 -> 18/09   (doan_cu = 0)
 *       đoạn cũ lần sau     22/08 -> 04/09   (doan_cu = 1)  ... lùi tiếp
 *   Nhờ vậy sửa lùi ngày trong sheet (vd điền bù kíp tháng 5) sau vài vòng cũng
 *   vào được D1.
 *
 * CÁCH GHI VÀO D1 (tiết kiệm CPU + hạn mức)
 *   - Mỗi bảng MỘT câu SQL. Dữ liệu truyền vào là MỘT chuỗi JSON, SQLite tự tách
 *     bằng json_each(): không vướng trần 100 tham số/câu, và việc tách chạy bên
 *     D1, không tính vào CPU của Function.
 *   - "Upsert có điều kiện": chỉ ghi khi giá trị KHÁC — hạn mức 100.000 dòng
 *     ghi/ngày chỉ bị trừ cho ô thật sự đổi.
 *   - Ô bị xoá trong sheet thì xoá trong D1 — nhưng CHỈ trong khoảng ngày vừa
 *     kiểm, để một lần đẩy hỏng không thể xoá cả lịch sử.
 *   - Cả loạt câu chạy trong db.batch() = một giao dịch: hỏng một câu thì không
 *     câu nào được ghi.
 *
 * KHỐI-NGÀY ĐÃ NẠP TỪ EXCEL (trang /nap-lieu, migrations/0005_nap_excel.sql)
 *   Khối X ngày D đã nạp bằng file Excel thì thuộc về Excel: ô sheet của (X, D)
 *   bị BỎ QUA — không ghi đè số Excel, cũng không xoá số Excel vì "sheet không
 *   có". Danh sách đọc từ bảng ngay_nap mỗi lần đồng bộ (docKhoiNgayNap).
 * ===========================================================================*/

import { chuanHoaDayChuyen, chuanHoaVatTu } from './chuan-hoa.mjs';
import { docDanhMuc, cacThang, SQL_GOI_THANG, SQL_GOI_NHAN_SU, thamSoGoiThang, thamSoGoiNhanSu } from './goi-v2.mjs';

export const CUA_SO_NGAY = 14;      /* độ dài cửa sổ gần nhất và mỗi đoạn cũ (ngày) */
export const NHIP_PHUT = 20;        /* tối thiểu bao nhiêu phút giữa hai lần đồng bộ một tuyến */
const LECH_GIO_VN_MS = 7 * 3600 * 1000;   /* giờ Việt Nam = UTC + 7 */

/** Ngày theo giờ Việt Nam của một mốc ms -> 'YYYY-MM-DD'.
 *  (Máy chủ Cloudflare chạy giờ UTC: 06:00 sáng VN vẫn là "hôm qua" theo UTC.) */
function ngayVN(ms) { return new Date(ms + LECH_GIO_VN_MS).toISOString().slice(0, 10); }

/** Cộng n ngày (n âm = lùi) vào ngày 'YYYY-MM-DD'. */
function congNgay(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/** Tính khoảng ngày cần chuẩn hoá lần này (xem ví dụ ở đầu file).
 *  Ra: { cuaSoTu: ngày đầu cửa sổ, cuTu/cuDen: đầu/cuối đoạn cũ thứ doanCu }. */
export function khoangNgay(luc, doanCu) {
    const cuaSoTu = congNgay(ngayVN(luc), -(CUA_SO_NGAY - 1));
    const cuDen = congNgay(cuaSoTu, -1 - CUA_SO_NGAY * doanCu);
    const cuTu = congNgay(cuDen, -(CUA_SO_NGAY - 1));
    return { cuaSoTu: cuaSoTu, cuTu: cuTu, cuDen: cuDen };
}

const HET = '9999-12-31';           /* "tới mãi mãi" — cận trên khi xoá trong cửa sổ */

/* ---------------------------------------------------------------------------
 * CÁC CÂU SQL. Quy ước tham số: ?1, ?2... theo thứ tự bind().
 * json_each(?1) biến chuỗi JSON '[[...],[...]]' thành từng dòng; value là một
 * phần tử, json_extract(value, '$[0]') lấy phần tử con thứ 0.
 * (WHERE true trước ON CONFLICT: cú pháp SQLite bắt buộc khi INSERT ... SELECT
 * đi kèm upsert.)
 * ------------------------------------------------------------------------- */
const SQL = {
    /* Đọc lần đồng bộ trước. so_goi = số gói /api/v2 đã dựng; bằng 0 (vừa nạp
       lịch sử, vừa thêm bảng) thì dù dữ liệu y nguyên vẫn phải chạy để dựng gói */
    docDongBo: `SELECT etag, luc, doan_cu,
        (SELECT COUNT(*) FROM goi_thang WHERE tuyen = ?1) AS so_goi
        FROM dong_bo WHERE tuyen = ?1`,

    /* Chỉ THÊM chỉ tiêu mới, không sửa loai của chỉ tiêu có sẵn: ở đây chỉ thấy
       vài tuần dữ liệu nên đoán loai kém hơn lần nạp cả lịch sử.
       ?1 = [[ma, khoi, cot_sheet, loai], ...] */
    chiTieu: `INSERT INTO chi_tieu (ma, khoi, cot_sheet, loai)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'),
               json_extract(value, '$[2]'), json_extract(value, '$[3]')
        FROM json_each(?1) WHERE true
        ON CONFLICT DO NOTHING`,

    /* Thêm ô mới / sửa ô đổi giá trị. Dòng WHERE cuối: ô y nguyên thì KHÔNG ghi
       (không tốn hạn mức ghi). IS NOT thay cho != để so đúng cả khi có NULL.
       ?1 = [[chi_tieu, ngay, stt, ca, kip, gia_tri, chu], ...]  ?2 = 'TK3'  ?3 = lúc ghi */
    soLieu: `INSERT INTO so_lieu (chi_tieu, day_chuyen, ngay, stt, ca, kip, gia_tri, chu, cap_nhat)
        SELECT json_extract(value, '$[0]'), ?2, json_extract(value, '$[1]'), json_extract(value, '$[2]'),
               json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'),
               json_extract(value, '$[6]'), ?3
        FROM json_each(?1) WHERE true
        ON CONFLICT (chi_tieu, day_chuyen, ngay, stt) DO UPDATE SET
            ca = excluded.ca, kip = excluded.kip, gia_tri = excluded.gia_tri,
            chu = excluded.chu, cap_nhat = excluded.cap_nhat
        WHERE so_lieu.ca IS NOT excluded.ca OR so_lieu.kip IS NOT excluded.kip
           OR so_lieu.gia_tri IS NOT excluded.gia_tri OR so_lieu.chu IS NOT excluded.chu`,

    /* Xoá ô có trong D1 mà bản mới không còn — chỉ trong khoảng ngày ?4..?5.
       ?1 = các ô của bản mới (như trên)  ?2 = 'TK3'  ?3 = [mã chỉ tiêu...]
       ?6 = ['mã|ngày', ...] KHÔNG được xoá: ô của khối-ngày đã nạp Excel
       Hiệu năng: "NOT IN (truy vấn con không phụ thuộc dòng ngoài)" -> SQLite
       dựng bảng tạm có chỉ mục MỘT lần, không quét lồng 2.000 x 2.000. Mỗi
       khoảng ngày một câu riêng để SQLite đi thẳng theo khoá chính. */
    xoaSoLieuThua: `DELETE FROM so_lieu
        WHERE chi_tieu IN (SELECT value FROM json_each(?3)) AND day_chuyen = ?2
          AND ngay BETWEEN ?4 AND ?5
          AND (chi_tieu || '|' || ngay || '|' || stt) NOT IN (
              SELECT json_extract(value, '$[0]') || '|' || json_extract(value, '$[1]') || '|' || json_extract(value, '$[2]')
              FROM json_each(?1))
          AND (chi_tieu || '|' || ngay) NOT IN (SELECT value FROM json_each(?6))`,

    /* Khối-ngày đã nạp Excel (ngay_nap, migrations/0005) trong cửa sổ hoặc đoạn
       cũ. ?1 = 'TK3'  ?2 = đầu cửa sổ  ?3..?4 = đoạn cũ */
    khoiNgayNap: `SELECT khoi, ngay FROM ngay_nap
        WHERE day_chuyen = ?1 AND (ngay >= ?2 OR ngay BETWEEN ?3 AND ?4)`,

    /* Danh sách nhân sự: upsert rồi xoá người không còn trong sheet.
       ?1 = [[kip, stt, nhan_vien, vi_tri, trang_thai], ...]  ?2 = 'TK3' */
    nhanSu: `INSERT INTO nhan_su (day_chuyen, kip, stt, nhan_vien, vi_tri, trang_thai)
        SELECT ?2, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
               json_extract(value, '$[3]'), json_extract(value, '$[4]')
        FROM json_each(?1) WHERE true
        ON CONFLICT (day_chuyen, kip, stt) DO UPDATE SET
            nhan_vien = excluded.nhan_vien, vi_tri = excluded.vi_tri, trang_thai = excluded.trang_thai
        WHERE nhan_su.nhan_vien IS NOT excluded.nhan_vien OR nhan_su.vi_tri IS NOT excluded.vi_tri
           OR nhan_su.trang_thai IS NOT excluded.trang_thai`,
    xoaNhanSuThua: `DELETE FROM nhan_su WHERE day_chuyen = ?2 AND (kip || '|' || stt) NOT IN (
        SELECT json_extract(value, '$[0]') || '|' || json_extract(value, '$[1]') FROM json_each(?1))`,

    /* Ngày cuối có số của từng khối (bảng moc_khoi, migrations/0004).
       Chỉ ghi khi MỚI HƠN ngày đang giữ — mốc chỉ tiến, không lùi.
       ?1 = 'tk3'  ?2 = { "QTK": "2026-08-25", ... } */
    mocKhoi: `INSERT INTO moc_khoi (tuyen, khoi, ngay_cuoi)
        SELECT ?1, key, value FROM json_each(?2) WHERE true
        ON CONFLICT (tuyen, khoi) DO UPDATE SET ngay_cuoi = excluded.ngay_cuoi
        WHERE excluded.ngay_cuoi > moc_khoi.ngay_cuoi`,

    /* Tồn kho vật tư: upsert có điều kiện + xoá vật tư không còn.
       ?1 = [[day_chuyen, ten, don_vi, ton_dau, nhap, xuat, ton_cuoi, ton_an_toan], ...] */
    vatTuTon: `INSERT INTO vat_tu_ton (day_chuyen, ten, don_vi, ton_dau, nhap, xuat, ton_cuoi, ton_an_toan)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
               json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'),
               json_extract(value, '$[6]'), json_extract(value, '$[7]')
        FROM json_each(?1) WHERE true
        ON CONFLICT (day_chuyen, ten) DO UPDATE SET
            don_vi = excluded.don_vi, ton_dau = excluded.ton_dau, nhap = excluded.nhap,
            xuat = excluded.xuat, ton_cuoi = excluded.ton_cuoi, ton_an_toan = excluded.ton_an_toan
        WHERE vat_tu_ton.don_vi IS NOT excluded.don_vi OR vat_tu_ton.ton_dau IS NOT excluded.ton_dau
           OR vat_tu_ton.nhap IS NOT excluded.nhap OR vat_tu_ton.xuat IS NOT excluded.xuat
           OR vat_tu_ton.ton_cuoi IS NOT excluded.ton_cuoi OR vat_tu_ton.ton_an_toan IS NOT excluded.ton_an_toan`,
    xoaVatTuTonThua: `DELETE FROM vat_tu_ton WHERE (day_chuyen || '|' || ten) NOT IN (
        SELECT json_extract(value, '$[0]') || '|' || json_extract(value, '$[1]') FROM json_each(?1))`,
    /* Phiếu nhập/xuất không có khoá tự nhiên (hai phiếu có thể giống hệt nhau)
       -> xoá hết rồi ghi lại. Chỉ chạy khi dữ liệu vật tư ĐỔI (etag khác), mà
       vật tư đổi rất ít, nên không tốn mấy dòng ghi. */
    xoaPhieu: 'DELETE FROM vat_tu_phieu',
    /* ?1 = [[day_chuyen, loai, ten, so_luong, mo_ta, ngay, ngay_thieu_nam, ca, kip], ...] */
    phieu: `INSERT INTO vat_tu_phieu (day_chuyen, loai, ten, so_luong, mo_ta, ngay, ngay_thieu_nam, ca, kip)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
               json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'),
               json_extract(value, '$[6]'), json_extract(value, '$[7]'), json_extract(value, '$[8]')
        FROM json_each(?1)`,

    /* Sổ theo dõi đồng bộ (bảng dong_bo, migrations/0002): ghi xong thì xoá lỗi cũ */
    ghiDongBo: `INSERT INTO dong_bo (tuyen, etag, luc, so_o, doan_cu, loi, loi_luc)
        VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL)
        ON CONFLICT (tuyen) DO UPDATE SET etag = excluded.etag, luc = excluded.luc,
            so_o = excluded.so_o, doan_cu = excluded.doan_cu, loi = NULL, loi_luc = NULL`,
    ghiSoGhi: 'UPDATE dong_bo SET so_ghi = ?2 WHERE tuyen = ?1',
    ghiLoi: `INSERT INTO dong_bo (tuyen, loi, loi_luc) VALUES (?1, ?2, ?3)
        ON CONFLICT (tuyen) DO UPDATE SET loi = excluded.loi, loi_luc = excluded.loi_luc`,
    nhatKy: `INSERT INTO nhat_ky_nap (luc, nguon, tuyen, so_gia_tri, ghi_chu)
        VALUES (?1, 'apps-script', ?2, ?3, ?4)`,
};

/** Ngày cuối có số của từng khối, từ kết quả chuanHoaDayChuyen().
 *  Ra: { 'QTK': '2026-08-25', 'Điện': '2026-10-01', ... }
 *
 *  Chỉ tính ô số liệu theo ca (loai 'ca'), có kíp (stt > 0), giá trị > 0, ngày
 *  không quá homNay — tức bỏ qua định mức điền sẵn và hàng tương lai. Giống cách
 *  biểu đồ tìm "7 ngày gần nhất có số liệu" (smartFilter ở trình duyệt).
 *  scripts/nap-lich-su.mjs cũng dùng hàm này. */
export function mocKhoi(r, homNay) {
    const moc = {};
    for (const o of r.soLieu) {
        if (!(o.stt > 0) || !(o.gia_tri > 0) || o.ngay > homNay) continue;
        const c = r.chiTieu.get(o.chi_tieu);
        if (!c || c.loai !== 'ca') continue;
        if (!moc[c.khoi] || o.ngay > moc[c.khoi]) moc[c.khoi] = o.ngay;
    }
    return moc;
}

/** Chuẩn bị các câu SQL cho một dây chuyền TK3 / TK4.
 *
 *  Câu được chia NHÓM để sau khi ghi biết nhóm nào thật sự có dòng đổi (và chỉ
 *  dựng lại gói tháng của nhóm đó):
 *    chung   danh mục chỉ tiêu
 *    cuaSo   ô của cửa sổ 14 ngày gần nhất
 *    doanCu  ô của đoạn cũ xoay vòng
 *    nhanSu  danh sách nhân sự
 *    moc     ngày cuối có số của từng khối
 *
 *  khoiNgayNap: Map<khối, [ngày...]> các khối-ngày đã nạp Excel (docKhoiNgayNap)
 *  — ô sheet của chúng bị bỏ, và được che khỏi câu xoá.
 *
 *  Ra: { nhom, soO, doanTiep (doan_cu cho lần sau), ghiChu,
 *        thang: { tatCa, cuaSo, doanCu } — các tháng mỗi phần đụng tới } */
function cauDayChuyen(db, tuyen, rows, luc, doanCu, khoiNgayNap) {
    const dc = tuyen.toUpperCase();
    const k = khoangNgay(luc, doanCu);
    const trongCuaSo = x => x >= k.cuaSoTu;
    const trongDoanCu = x => x >= k.cuTu && x <= k.cuDen;
    const r = chuanHoaDayChuyen(dc, rows, luc, { locNgay: x => trongCuaSo(x) || trongDoanCu(x) });

    /* Bỏ ô sheet của khối-ngày đã nạp Excel, và lập danh sách 'mã|ngày' để câu
       xoá không đụng vào số Excel ở đó */
    const giuNap = [];
    let soOBo = 0;
    if (khoiNgayNap.size) {
        const daNap = new Set();
        for (const c of r.chiTieu.values()) {
            for (const ngay of khoiNgayNap.get(c.khoi) || []) { daNap.add(c.khoi + '|' + ngay); giuNap.push(c.ma + '|' + ngay); }
        }
        const truoc = r.soLieu.length;
        r.soLieu = r.soLieu.filter(o => !daNap.has(r.chiTieu.get(o.chi_tieu).khoi + '|' + o.ngay));
        soOBo = truoc - r.soLieu.length;
    }
    const giuNapJson = JSON.stringify(giuNap);

    /* Đoạn cũ đã lùi tới (hoặc quá) ngày đầu tiên có số liệu -> lần sau quay lại
       đoạn liền trước cửa sổ */
    const doanTiep = !r.ngayNhoNhat || k.cuTu <= r.ngayNhoNhat ? 0 : doanCu + 1;
    const coDoanCu = !!(r.ngayNhoNhat && k.cuDen >= r.ngayNhoNhat);

    /* Đổi dữ liệu sang dạng mảng gọn để gửi cho json_each() */
    const chiTieu = [...r.chiTieu.values()];
    const maCacChiTieu = JSON.stringify(chiTieu.map(c => c.ma));
    const mang = ds => JSON.stringify(ds.map(o => [o.chi_tieu, o.ngay, o.stt, o.ca, o.kip, o.gia_tri, o.chu]));
    const oCuaSo = mang(r.soLieu.filter(o => trongCuaSo(o.ngay)));
    const oDoanCu = mang(r.soLieu.filter(o => !trongCuaSo(o.ngay)));

    const nhom = {
        chung: [db.prepare(SQL.chiTieu).bind(JSON.stringify(chiTieu.map(c => [c.ma, c.khoi, c.cot_sheet, c.loai])))],
        cuaSo: [db.prepare(SQL.soLieu).bind(oCuaSo, dc, luc),
                db.prepare(SQL.xoaSoLieuThua).bind(oCuaSo, dc, maCacChiTieu, k.cuaSoTu, HET, giuNapJson)],
        doanCu: coDoanCu ? [db.prepare(SQL.soLieu).bind(oDoanCu, dc, luc),
                            db.prepare(SQL.xoaSoLieuThua).bind(oDoanCu, dc, maCacChiTieu, k.cuTu, k.cuDen, giuNapJson)] : [],
        nhanSu: [],
    };
    /* Danh sách nhân sự rỗng thì KHÔNG xoá: nhiều khả năng cột bị đổi tên, chứ
       không phải cả kíp nghỉ hết */
    if (r.nhanSu.length) {
        const ns = JSON.stringify(r.nhanSu.map(o => [o.kip, o.stt, o.nhan_vien, o.vi_tri, o.trang_thai]));
        nhom.nhanSu.push(db.prepare(SQL.nhanSu).bind(ns, dc), db.prepare(SQL.xoaNhanSuThua).bind(ns, dc));
    }
    const homNay = ngayVN(luc);
    const moc = mocKhoi(r, homNay);
    nhom.moc = Object.keys(moc).length ? [db.prepare(SQL.mocKhoi).bind(tuyen, JSON.stringify(moc))] : [];
    /* Những tháng cần có gói /api/v2: từ ngày đầu tiên tới ngày muộn nhất có ô
       (kể cả ô kế hoạch / định mức điền sẵn cho tương lai) */
    const cuoi = r.ngayLonNhat && r.ngayLonNhat > homNay ? r.ngayLonNhat : homNay;
    return {
        nhom: nhom, soO: r.soLieu.length, doanTiep: doanTiep,
        thang: {
            tatCa: cacThang(r.ngayNhoNhat, cuoi),
            cuaSo: cacThang(k.cuaSoTu, cuoi),
            doanCu: coDoanCu ? cacThang(k.cuTu, k.cuDen) : [],
        },
        ghiChu: 'từ ' + k.cuaSoTu + (coDoanCu ? ' + đoạn cũ ' + k.cuTu + '..' + k.cuDen : '')
            + (r.nhanSu.length ? ', ' + r.nhanSu.length + ' nhân sự' : '')
            + (soOBo ? ', bỏ ' + soOBo + ' ô sheet ở khối-ngày đã nạp Excel' : ''),
    };
}

/** Đọc các khối-ngày đã nạp Excel mà lần đồng bộ này sẽ xử lý (cửa sổ + đoạn
 *  cũ). Ra: Map<khối, [ngày...]>, vd Map { 'QTK' => ['2026-09-20', ...] }.
 *  Bảng ngay_nap chưa có (chưa chạy db:schema cho migrations/0005) -> coi như
 *  rỗng: chưa ai nạp Excel được thì cũng chẳng có gì phải giữ. */
async function docKhoiNgayNap(db, tuyen, luc, doanCu) {
    const k = khoangNgay(luc, doanCu);
    let results;
    try {
        ({ results } = await db.prepare(SQL.khoiNgayNap).bind(tuyen.toUpperCase(), k.cuaSoTu, k.cuTu, k.cuDen).all());
    } catch (e) {
        if (/no such table/i.test(String(e && e.message))) return new Map();
        throw e;
    }
    const ra = new Map();
    for (const x of results || []) {
        if (!ra.has(x.khoi)) ra.set(x.khoi, []);
        ra.get(x.khoi).push(x.ngay);
    }
    return ra;
}

/** Dựng lại gói /api/v2 (bảng goi_thang) cho những tháng CẦN dựng:
 *    - tháng chưa có gói;
 *    - MỌI gói dựng theo danh mục cột CŨ (sheet vừa thêm/bớt cột, hay vừa nạp
 *      Excel có cột mới -> vân tay đổi), kể cả tháng nằm ngoài khoảng ngày của
 *      sheet (vd tháng chỉ có số nạp từ Excel) — sót một gói là /api/v2 trả 503;
 *    - tháng thuộc nhóm vừa có dòng đổi (doi.cuaSo, doi.doanCu).
 *  Gói nhân sự dựng lại khi danh mục đổi hoặc nhân sự có dòng đổi.
 *  Mỗi tháng một câu SQL; SQLite tự dựng JSON nên Function gần như không tốn CPU.
 *  Ra: số gói đã dựng. */
async function dungLaiGoi(db, tuyen, p, doi, luc) {
    const dm = await docDanhMuc(db);
    const { results } = await db.prepare('SELECT thang, ds_cot FROM goi_thang WHERE tuyen = ?1').bind(tuyen).all();
    const daCo = new Map((results || []).map(x => [x.thang, x.ds_cot]));

    const can = new Set();
    for (const t of p.thang.tatCa) if (!daCo.has(t)) can.add(t);
    for (const [t, ds] of daCo) if (t !== 'nhan-su' && ds !== dm.vanTay) can.add(t);
    if (doi.cuaSo) p.thang.cuaSo.forEach(t => can.add(t));
    if (doi.doanCu) p.thang.doanCu.forEach(t => can.add(t));
    const canNhanSu = daCo.get('nhan-su') !== dm.vanTay || doi.nhanSu > 0;

    const cau = [...can].sort().map(t => db.prepare(SQL_GOI_THANG).bind(...thamSoGoiThang(tuyen, t, luc, dm)));
    if (canNhanSu) cau.push(db.prepare(SQL_GOI_NHAN_SU).bind(...thamSoGoiNhanSu(tuyen, luc, dm)));
    if (cau.length) await db.batch(cau);
    return cau.length;
}

/** Chuẩn bị các câu SQL cho tuyến vật tư (luôn xử lý trọn — dữ liệu nhỏ).
 *  Chuẩn hoá ra 0 dòng tồn kho thì DỪNG: ghi tiếp sẽ xoá trắng bảng trong D1. */
function cauVatTu(db, data) {
    const v = chuanHoaVatTu(data);
    if (!v.ton.length) throw new Error('vật tư: chuẩn hoá ra 0 dòng tồn kho — không ghi, tránh xoá trắng D1');
    const ton = JSON.stringify(v.ton.map(o => [o.day_chuyen, o.ten, o.don_vi, o.ton_dau, o.nhap, o.xuat, o.ton_cuoi, o.ton_an_toan]));
    const phieu = JSON.stringify(v.phieu.map(o => [o.day_chuyen, o.loai, o.ten, o.so_luong, o.mo_ta, o.ngay, o.ngay_thieu_nam, o.ca, o.kip]));
    return {
        cau: [
            db.prepare(SQL.vatTuTon).bind(ton),
            db.prepare(SQL.xoaVatTuTonThua).bind(ton),
            db.prepare(SQL.xoaPhieu),
            db.prepare(SQL.phieu).bind(phieu),
        ],
        soO: v.ton.length + v.phieu.length, doanTiep: 0,
        ghiChu: v.ton.length + ' tồn kho, ' + v.phieu.length + ' phiếu',
    };
}

/**
 * HÀM CHÍNH — đồng bộ một lần đẩy của Apps Script vào D1.
 *
 * Vào:
 *   db     binding D1 (env.DB)
 *   tuyen  'tk3' | 'tk4' | 'vattu'
 *   j      gói JSON Apps Script vừa đẩy, ĐÃ parse sẵn (không parse lại lần hai)
 *   etag   dấu vân tay functions/api/[[route]].js vừa tính cho gói đó
 *   luc    Date.now()
 * Ra:
 *   { boQua: 'lý do' }                 nếu lần này không cần làm gì
 *   { soO, soGhi, soGoi, ghiChu }      số ô đã so, số dòng D1 đổi, số gói dựng lại
 *
 * Các bước:
 *   1) Đọc sổ dong_bo: y nguyên / chưa đủ 20 phút -> bỏ qua.
 *   2) Chuẩn hoá cửa sổ + đoạn cũ (bỏ ô của khối-ngày đã nạp Excel), chuẩn bị
 *      câu SQL theo nhóm.
 *   3) Chạy tất cả trong MỘT batch (một giao dịch), kèm ghi sổ + nhật ký.
 *   4) Đếm dòng đổi theo nhóm, ghi vào sổ.
 *   5) Dựng lại các gói tháng bị ảnh hưởng.
 */
export async function dongBoD1(db, tuyen, j, etag, luc) {
    const laVatTu = tuyen === 'vattu';
    /* 1) */
    const truoc = await db.prepare(SQL.docDongBo).bind(tuyen).first();
    if (truoc && truoc.etag === etag && (laVatTu || truoc.so_goi > 0)) {
        return { boQua: 'dữ liệu y nguyên lần đồng bộ trước' };
    }
    if (truoc && truoc.luc && luc - truoc.luc < NHIP_PHUT * 60000) {
        return { boQua: 'chưa đủ ' + NHIP_PHUT + ' phút từ lần đồng bộ trước' };
    }

    /* 2) */
    const doanCu = (truoc && truoc.doan_cu) || 0;
    const p = laVatTu ? cauVatTu(db, j.data)
        : cauDayChuyen(db, tuyen, j.data, luc, doanCu, await docKhoiNgayNap(db, tuyen, luc, doanCu));
    const nhom = laVatTu ? { chung: p.cau } : p.nhom;
    const tenNhom = Object.keys(nhom);
    const cau = [].concat(...tenNhom.map(t => nhom[t]));

    /* 3) batch = một giao dịch: hỏng câu nào thì không câu nào được ghi */
    const kq = await db.batch(cau.concat([
        db.prepare(SQL.ghiDongBo).bind(tuyen, etag, luc, p.soO, p.doanTiep),
        db.prepare(SQL.nhatKy).bind(luc, tuyen, p.soO, p.ghiChu),
    ]));
    /* 4) kq[i].meta.changes = số dòng câu thứ i đã đổi. Cộng theo nhóm, theo
       đúng thứ tự câu đã ghép ở bước 2. */
    const doi = {};
    let i = 0, soGhi = 0;
    for (const t of tenNhom) {
        doi[t] = 0;
        for (let n = 0; n < nhom[t].length; n++, i++) doi[t] += (kq[i] && kq[i].meta && kq[i].meta.changes) || 0;
        soGhi += doi[t];
    }
    await db.prepare(SQL.ghiSoGhi).bind(tuyen, soGhi).run();

    /* 5) */
    const soGoi = laVatTu ? 0 : await dungLaiGoi(db, tuyen, p, doi, luc);
    return { soO: p.soO, soGhi: soGhi, soGoi: soGoi, ghiChu: p.ghiChu };
}

/** Ghi lỗi đồng bộ vào sổ dong_bo để /api/trang-thai hiện ra.
 *  Lỗi của chính bước ghi này thì bỏ qua (D1 hỏng hẳn thì nơi gọi đã log rồi). */
export async function ghiLoiDongBo(db, tuyen, loi) {
    try {
        await db.prepare(SQL.ghiLoi).bind(tuyen, String(loi && loi.message || loi).slice(0, 300), Date.now()).run();
    } catch (e) { /* D1 hỏng hẳn thì console.error ở nơi gọi là đủ */ }
}

/** Đọc sổ dong_bo cho /api/trang-thai -> { tk3: { luc, so_o, so_ghi, loi, loi_luc }, ... } */
export async function docTrangThaiDongBo(db) {
    const { results } = await db.prepare('SELECT tuyen, luc, so_o, so_ghi, loi, loi_luc FROM dong_bo').all();
    const ra = {};
    for (const x of results || []) ra[x.tuyen] = x;
    return ra;
}
