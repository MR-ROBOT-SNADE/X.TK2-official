/* =============================================================================
 * db/goi-v2.mjs — CHUẨN BỊ DỮ LIỆU CHO /api/v2 (đọc từ D1)
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Cung cấp mọi thứ để /api/v2/tk3, /api/v2/tk4, /api/v2/vattu trả số liệu từ
 *   D1 thay cho bản KV nguyên văn mà Apps Script đẩy lên:
 *     - Dựng "GÓI THÁNG": số liệu của một tháng, đóng sẵn thành chuỗi JSON, cất
 *       trong bảng goi_thang (migrations/0003). Dựng lúc đồng bộ
 *       (db/dong-bo-d1.mjs) và lúc nạp lịch sử (scripts/nap-lich-su.mjs).
 *     - ĐỌC gói khi trình duyệt hỏi: chỉ nối chuỗi các gói lại, không parse.
 *     - Vật tư nhỏ (~150 dòng) nên đọc thẳng bảng, không cần gói.
 *
 * VÌ SAO PHẢI DỰNG SẴN THEO THÁNG
 *   Dựng câu trả lời từ bảng so_lieu mỗi lần có người mở trang = đọc ~15.000
 *   dòng mỗi lượt; vài trăm lượt là cạn hạn mức 5 triệu dòng đọc/ngày của gói
 *   Free. Dựng sẵn thì mỗi lượt mở trang chỉ đọc vài dòng goi_thang.
 *
 * SO VỚI BẢN KV, CÂU TRẢ LỜI /api/v2:
 *   - không gửi các cột dashboard không dùng (COT_KHONG_GUI) — D1 vẫn giữ đủ;
 *   - số đã đọc chuẩn một lần ('5,854.00' -> 5854), trình duyệt khỏi đoán dấu;
 *   - nhỏ hơn nhiều: chỉ ô có giá trị, không phải 1.084 hàng x 104 cột.
 *   Trình duyệt dựng lại đúng bảng ngang cũ (js/api/api_v2.js), nên toàn bộ mã
 *   vẽ biểu đồ không phải sửa.
 *
 * DẠNG CÂU TRẢ LỜI /api/v2/tk3?tu=2026-09
 *   {
 *     "status": "success", "nguon": "d1",
 *     "van_tay": "1x-abc",                         <- vân tay danh mục cột
 *     "cot": [["Điện","Điện năng"], ["QTK","TFe"], ...],   <- cột số 0, 1, 2...
 *     "muc_luc": { "cac_thang": ["2026-04", ..., "2026-12"],
 *                  "khoi": { "QTK": "2026-08-25", "Điện": "2026-10-01", ... } },
 *     "pham_vi": { "tu": "2026-09", "den": "9999-12" },
 *     "thang": {
 *       "2026-09": [[0, 1, 1, "A", 1234], [1, 1, 1, "A", 56.2], ...],
 *       "2026-10": [...],
 *       "nhan-su": [["A", 1, <họ tên>, <vị trí>, <trạng thái>], ...]
 *     }
 *   }
 *   Mỗi ô trong gói tháng = [số thứ tự cột, ngày trong tháng, stt, kíp, giá trị].
 *
 * TẢI THEO THÁNG (?tu=YYYY-MM&den=YYYY-MM)
 *   Trình duyệt mặc định chỉ xin từ tháng này (10 ngày đầu tháng thì từ tháng
 *   trước). Tháng cũ hơn xin thêm khi người xem lọc lùi ngày, hoặc mở một khối
 *   có số liệu đã ngừng từ lâu (js/api/api_thang.js). "muc_luc" trong câu trả
 *   lời cho trình duyệt biết đang có những tháng nào và ngày cuối có số của
 *   từng khối — đủ để biết phải xin thêm gì.
 * ===========================================================================*/

/* Cột bảng tính mà dashboard KHÔNG dùng (dò bằng cách tìm tên cột trong js/,
   ngày 30/09/2026). Vẫn lưu trong D1 để truy vấn, chỉ không gửi ra trình duyệt.
   Dashboard cần thêm cột nào trong số này: xoá khỏi đây rồi deploy — lần đồng
   bộ kế tiếp tự dựng lại gói có cột đó (vân tay danh mục đổi). */
export const COT_KHONG_GUI = [
    'Silo số (vôi nung)',
    'Hệ số biến thiên SiO2 (QTH)', 'Hệ số biến thiên CaO (QTH)',
    'Trung bình SiO2 (QTH)', 'Trung bình CaO (QTH)',
    'Độ lệch chuẩn (HLC)', 'Mức độ lẫn quặng ngoại lai (%) (HLC)',
    'Cảnh báo (QTH)', 'Cảnh báo SiO2 (QTH)', 'Cảnh báo CaO (QTH)',
    /* Khối sự vụ của TK4 (AN / AT / VP) — hiện trống, nội dung nội bộ */
    'Nội dung vi phạm', 'Trạng thái xử lý', 'Hạng mục cải thiện',
    'Nội dung vụ việc', 'Xử lý', 'Nhận xét',
];
const BO = new Set(COT_KHONG_GUI.map(c => c.normalize('NFC')));

/** Cột này có được gửi ra trình duyệt không? (false nếu nằm trong COT_KHONG_GUI) */
export function duocGui(cotSheet) { return !BO.has(String(cotSheet).normalize('NFC')); }

/** Băm nhanh một chuỗi (thuật toán djb2) -> 'độ dài-mã băm', vd '4f2-1k9x7a'.
 *  Không dùng cho bảo mật — chỉ để biết danh mục cột có đổi hay không. */
function vanTay(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return s.length.toString(36) + '-' + h.toString(36);
}

/** Đọc danh mục cột được gửi từ bảng chi_tieu. Xem lapDanhMuc. */
export async function docDanhMuc(db) {
    const { results } = await db.prepare('SELECT ma, khoi, cot_sheet FROM chi_tieu ORDER BY ma').all();
    return lapDanhMuc(results || []);
}

/** Từ danh sách [{ ma, khoi, cot_sheet }] lập DANH MỤC CỘT ĐƯỢC GỬI:
 *    cot     { mã: [khối, tên cột] }
 *    maGui   [mã...] xếp theo mã — vị trí trong mảng này CHÍNH LÀ "số thứ tự cột"
 *            dùng trong gói tháng
 *    vanTay  vân tay của maGui. Thêm cột mới hay sửa COT_KHONG_GUI là vân tay
 *            đổi -> số thứ tự cột cũ hết đúng -> mọi gói phải dựng lại.
 *  Dùng chung với scripts/nap-lich-su.mjs và db/chi-so.mjs. */
export function lapDanhMuc(ds) {
    const cot = {}, maGui = [];
    for (const x of [...ds].sort((a, b) => a.ma < b.ma ? -1 : a.ma > b.ma ? 1 : 0)) {
        if (!duocGui(x.cot_sheet)) continue;
        cot[x.ma] = [x.khoi, x.cot_sheet];
        maGui.push(x.ma);
    }
    return { cot: cot, maGui: maGui, vanTay: vanTay(maGui.join('|')) };
}

/** Ghép thân câu trả lời /api/v2/tk3 từ các dòng goi_thang (dạng: xem đầu file).
 *
 *  dm      danh mục cột hiện tại (lapDanhMuc)
 *  cacGoi  [{ thang, ds_cot, json }] — json là chuỗi SQLite đã dựng, chỉ NỐI
 *          vào, không parse (tiết kiệm CPU)
 *  them    các trường thêm vào câu trả lời (muc_luc, pham_vi)
 *
 *  Có gói dựng với danh mục KHÁC (ds_cot khác vân tay hiện tại) -> trả null:
 *  số thứ tự cột trong gói đó không còn đúng. Nơi gọi trả 503 để trình duyệt
 *  tạm dùng bản KV, tới khi lần đồng bộ sau dựng lại xong.
 *  Dùng chung cho Function và phép đối chiếu của scripts/nap-lich-su.mjs. */
export function noiGoi(dm, cacGoi, them) {
    if (cacGoi.some(g => g.ds_cot !== dm.vanTay)) return null;
    const phan = cacGoi.map(g => JSON.stringify(g.thang) + ':' + g.json);
    let s = '{"status":"success","nguon":"d1","van_tay":' + JSON.stringify(dm.vanTay)
        + ',"cot":' + JSON.stringify(dm.maGui.map(ma => dm.cot[ma]));
    for (const k of Object.keys(them || {})) s += ',' + JSON.stringify(k) + ':' + JSON.stringify(them[k]);
    return s + ',"thang":{' + phan.join(',') + '}}';
}

/** Đọc khoảng tháng trong URL ?tu=YYYY-MM&den=YYYY-MM -> { tu, den, dau }.
 *    Thiếu tu  -> '0000-00' = từ đầu (trình duyệt còn chạy bản cũ vẫn nhận đủ).
 *    Thiếu den -> '9999-12' = tới hết, và dau = true: đây là lượt tải MẶC ĐỊNH
 *                 khi mở trang, gửi kèm gói nhân sự. Lượt xin thêm tháng cũ
 *                 luôn có den, không cần nhân sự nữa.
 *  Giá trị sai dạng bị coi như thiếu. */
export function phamViThang(url) {
    const hop = /^\d{4}-(0[1-9]|1[0-2])$/;
    const tu = url.searchParams.get('tu'), den = url.searchParams.get('den');
    return { tu: hop.test(tu) ? tu : '0000-00', den: hop.test(den) ? den : '9999-12', dau: !hop.test(den) };
}

/** Băm nhanh (djb2) -> chuỗi ngắn. Dùng đưa mục lục vào ETag. */
function bam(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

/** Liệt kê các tháng nằm giữa hai ngày (tính cả hai đầu):
 *    cacThang('2026-08-25', '2026-10-02') -> ['2026-08', '2026-09', '2026-10'] */
export function cacThang(tu, den) {
    if (!tu || !den || tu > den) return [];
    let [y, m] = tu.slice(0, 7).split('-').map(Number);
    const [y2, m2] = den.slice(0, 7).split('-').map(Number);
    const ra = [];
    while (y < y2 || (y === y2 && m <= m2)) {
        ra.push(y + '-' + String(m).padStart(2, '0'));
        if (++m > 12) { m = 1; y++; }
    }
    return ra;
}

/* ---------------------------------------------------------------------------
 * DỰNG GÓI (chạy bên trong D1 — SQLite tự dựng JSON bằng json_group_array)
 * ---------------------------------------------------------------------------
 * SQL_GOI_THANG — gói số liệu của MỘT tháng. Tham số:
 *   ?1 tuyen   ?2 thang   ?3 phien (mốc dựng, ms)   ?4 ds_cot (vân tay danh mục)
 *   ?5 [mã được gửi]  — json_each cho m.key = số thứ tự cột, m.value = mã
 *   ?6 day_chuyen     ?7 ngày đầu tháng   ?8 ngày cuối tháng ('YYYY-MM-31': so
 *                     chuỗi nên tháng 30 ngày vẫn đúng)
 * Mỗi ô: [số thứ tự cột, ngày trong tháng, stt, kip, giá trị]. Giá trị là số,
 * hoặc chữ nếu ô không đọc được thành số (coalesce(gia_tri, chu)).
 * Dùng số thứ tự thay cho mã cột (~30 ký tự) và chỉ ghi ngày trong tháng thay
 * cho cả ngày: gói nhỏ đi hơn một nửa.
 * ------------------------------------------------------------------------- */
export const SQL_GOI_THANG = `INSERT INTO goi_thang (tuyen, thang, phien, ds_cot, so_o, json)
    SELECT ?1, ?2, ?3, ?4, COUNT(*),
           coalesce(json_group_array(json_array(m.key, CAST(substr(s.ngay, 9, 2) AS INTEGER), s.stt, s.kip,
                                                coalesce(s.gia_tri, s.chu))), '[]')
    FROM json_each(?5) AS m JOIN so_lieu AS s ON s.chi_tieu = m.value
    WHERE s.day_chuyen = ?6 AND s.ngay BETWEEN ?7 AND ?8
    ON CONFLICT (tuyen, thang) DO UPDATE SET phien = excluded.phien, ds_cot = excluded.ds_cot,
        so_o = excluded.so_o, json = excluded.json`;

/* SQL_GOI_NHAN_SU — gói danh sách nhân sự (thang = 'nhan-su').
   ?1 tuyen  ?2 phien  ?3 ds_cot  ?4 day_chuyen.
   Mỗi người: [kip, stt, nhan_vien, vi_tri, trang_thai] */
export const SQL_GOI_NHAN_SU = `INSERT INTO goi_thang (tuyen, thang, phien, ds_cot, so_o, json)
    SELECT ?1, 'nhan-su', ?2, ?3, COUNT(*),
           coalesce(json_group_array(json_array(kip, stt, nhan_vien, vi_tri, trang_thai)), '[]')
    FROM nhan_su WHERE day_chuyen = ?4
    ON CONFLICT (tuyen, thang) DO UPDATE SET phien = excluded.phien, ds_cot = excluded.ds_cot,
        so_o = excluded.so_o, json = excluded.json`;

/** Bộ tham số cho SQL_GOI_THANG, đúng thứ tự ?1..?8. */
export function thamSoGoiThang(tuyen, thang, phien, dm) {
    return [tuyen, thang, phien, dm.vanTay, JSON.stringify(dm.maGui), tuyen.toUpperCase(), thang + '-01', thang + '-31'];
}
/** Bộ tham số cho SQL_GOI_NHAN_SU, đúng thứ tự ?1..?4. */
export function thamSoGoiNhanSu(tuyen, phien, dm) {
    return [tuyen, phien, dm.vanTay, tuyen.toUpperCase()];
}

/* ---------------------------------------------------------------------------
 * ĐỌC GÓI CHO /api/v2 — hai bước: phiên (rẻ, để trả 304) rồi mới đến thân
 * ------------------------------------------------------------------------- */

/** Bước 1 của /api/v2/tk3: tính ETag cho khoảng tháng pv, KHÔNG đọc số liệu.
 *
 *  Rẻ: chỉ đọc cột thang + phien của goi_thang (không đụng cột json nặng) và
 *  ~15 dòng moc_khoi. Trình duyệt đã có đúng bản này thì trả 304 luôn.
 *  Ra: { mucLuc: { cac_thang, khoi }, etag }, hoặc null nếu chưa có gói nào.
 *
 *  ETag dùng TỔNG các mốc dựng chứ không phải mốc LỚN NHẤT. Lý do: gói dựng ở máy
 *  khác (db:nap) mà đồng hồ máy đó chạy nhanh thì mốc lớn nhất nằm ở "tương lai";
 *  các lần Function dựng lại sau đó không làm đổi mốc lớn nhất -> ETag không đổi
 *  -> trình duyệt kẹt dữ liệu cũ. Tổng thì luôn đổi khi có gói được dựng lại.
 *  Mục lục cũng được băm vào ETag (mốc khối tiến lên là trình duyệt biết). */
export async function docPhienV2(db, tuyen, pv) {
    const [goi, moc] = await db.batch([
        db.prepare('SELECT thang, phien FROM goi_thang WHERE tuyen = ?1').bind(tuyen),
        db.prepare('SELECT khoi, ngay_cuoi FROM moc_khoi WHERE tuyen = ?1 ORDER BY khoi').bind(tuyen),
    ]);
    const ds = goi.results || [];
    if (!ds.length) return null;
    let tong = 0, so = 0;
    const cacThang = [];
    for (const x of ds) {
        if (x.thang === 'nhan-su') { if (pv.dau) { tong += x.phien; so++; } continue; }
        cacThang.push(x.thang);
        if (x.thang >= pv.tu && x.thang <= pv.den) { tong += x.phien; so++; }
    }
    cacThang.sort();
    const khoi = {};
    for (const m of moc.results || []) khoi[m.khoi] = m.ngay_cuoi;
    const mucLuc = { cac_thang: cacThang, khoi: khoi };
    return { mucLuc: mucLuc,
             etag: '"v2-' + tuyen + '-' + pv.tu + '-' + pv.den + '-' + tong + '-' + so + '-' + bam(JSON.stringify(mucLuc)) + '"' };
}

/** Bước 2 của /api/v2/tk3|tk4: đọc các gói trong khoảng pv (kèm gói nhân sự nếu
 *  là lượt tải mặc định) và NỐI CHUỖI thành câu trả lời — không parse lại.
 *  Ra: { body (chuỗi JSON, hoặc null nếu gói lệch danh mục), luc (lần đồng bộ
 *  D1 gần nhất, ms) }. */
export async function docGoiV2(db, tuyen, pv, mucLuc) {
    const [goi, dong, ct] = await db.batch([
        db.prepare(`SELECT thang, ds_cot, json FROM goi_thang WHERE tuyen = ?1
            AND ((thang BETWEEN ?2 AND ?3) OR (?4 = 1 AND thang = 'nhan-su')) ORDER BY thang`)
            .bind(tuyen, pv.tu, pv.den, pv.dau ? 1 : 0),
        db.prepare('SELECT luc FROM dong_bo WHERE tuyen = ?1').bind(tuyen),
        db.prepare('SELECT ma, khoi, cot_sheet FROM chi_tieu ORDER BY ma'),
    ]);
    const dm = lapDanhMuc(ct.results || []);
    const luc = (dong.results && dong.results[0] && dong.results[0].luc) || 0;
    return { luc: luc, body: noiGoi(dm, goi.results || [],
        { muc_luc: mucLuc, pham_vi: { tu: pv.tu, den: pv.den } }) };
}

/** Vật tư, bước 1: ETag = mốc lần đồng bộ vật tư gần nhất. Chưa đồng bộ -> null. */
export async function docPhienVatTu(db) {
    const x = await db.prepare("SELECT luc FROM dong_bo WHERE tuyen = 'vattu'").first();
    if (!x || !x.luc) return null;
    return { etag: '"v2-vattu-' + x.luc + '"', luc: x.luc };
}

/** Vật tư, bước 2: dựng lại đúng DẠNG CŨ mà Apps Script vật tư gửi
 *    { TK3: { tongHop, nhap, xuat }, TK4: {...} }
 *  để vattu.js ở trình duyệt đọc y như trước. Thứ tự dòng: rowid / id = thứ tự
 *  dòng trong sheet. */
export async function docVatTuV2(db) {
    const [ton, phieu] = await db.batch([
        db.prepare('SELECT day_chuyen, ten, don_vi, ton_dau, nhap, xuat, ton_cuoi, ton_an_toan FROM vat_tu_ton ORDER BY rowid'),
        db.prepare('SELECT day_chuyen, loai, ten, mo_ta, so_luong FROM vat_tu_phieu ORDER BY id'),
    ]);
    const data = { TK3: { tongHop: [], nhap: [], xuat: [] }, TK4: { tongHop: [], nhap: [], xuat: [] } };
    for (const x of ton.results || []) {
        const d = data[x.day_chuyen];
        if (d) d.tongHop.push({ ten: x.ten, donVi: x.don_vi || '', tonDau: x.ton_dau, nhap: x.nhap,
            xuat: x.xuat, tonCuoi: x.ton_cuoi, tonAnToan: x.ton_an_toan });
    }
    for (const x of phieu.results || []) {
        const d = data[x.day_chuyen];
        if (d && d[x.loai]) d[x.loai].push({ ten: x.ten, moTa: x.mo_ta || '', soLuong: x.so_luong });
    }
    const soDong = (ton.results || []).length + (phieu.results || []).length;
    return { status: 'success', loai: 'vattu', nguon: 'd1', total_rows: soDong, data: data };
}
