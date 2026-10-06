/* =============================================================================
 * scripts/nap-lich-su.mjs — NẠP (LẠI) TOÀN BỘ SỐ LIỆU HIỆN CÓ VÀO D1
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Chạy trên MÁY BẠN (Node), không chạy trên Cloudflare. Dùng khi:
 *     - nạp D1 lần đầu;
 *     - nghi D1 lệch với Google Sheet (vd sửa lùi ngày quá xa cửa sổ đồng bộ);
 *     - sau khi thêm bảng mới (file SQL sinh ra tự kèm mọi migration).
 *
 * CÁCH DÙNG
 *   npm run db:chuan-bi
 *       1) tải /api/tk3, /api/tk4, /api/vattu đang chạy trên web;
 *       2) chuẩn hoá bằng db/chuan-hoa.mjs (CHÍNH code Cloudflare dùng);
 *       3) ghi ra .db-tam/nap-lich-su.sql;
 *       4) CHẠY THỬ file đó trên SQLite trong máy và ĐỐI CHIẾU: số liệu đọc từ
 *          DB phải ra đúng như trình duyệt đang vẽ. In "SẴN SÀNG" nếu mọi thứ khớp.
 *   npm run db:nap
 *       đẩy .db-tam/nap-lich-su.sql lên D1 (wrangler d1 execute --remote).
 *   npm run db:kiem-tra
 *       đếm lại trên D1 — phải ra đúng bảng mà db:chuan-bi in ở cuối.
 *
 *   node scripts/nap-lich-su.mjs --tu-thu-muc <thư mục có tk3.json tk4.json vattu.json>
 *       đọc từ file thay vì gọi API (để thử nghiệm).
 *   Thêm --khong-hoi-d1 để bỏ bước hỏi D1 danh sách khối-ngày Excel (máy chưa
 *   đăng nhập wrangler). Biến môi trường XTK2_API=<địa chỉ .../api/> để lấy dữ
 *   liệu từ nơi khác (vd wrangler pages dev chạy ở máy).
 *
 * CHẠY LẠI BAO NHIÊU LẦN CŨNG ĐƯỢC
 *   Số liệu ghi kiểu "upsert chỉ khi khác": ô không đổi thì D1 không ghi gì, không
 *   tốn hạn mức 100.000 dòng ghi/ngày. Nhân sự và vật tư (vài trăm dòng) thì xoá
 *   đi ghi lại. Gói tháng (/api/v2) và mốc khối dựng lại toàn bộ.
 *
 * SỐ LIỆU NẠP TỪ EXCEL (trang /nap-lieu, migrations/0005_nap_excel.sql) ĐƯỢC GIỮ
 *   - File SQL không ghi ô sheet vào khối-ngày đã nạp Excel (câu so_lieu có điều
 *     kiện NOT EXISTS ngay_nap) — và không xoá gì của Excel.
 *   - Cột chỉ có trong Excel: lấy danh mục cột ĐANG có trên D1 qua /api/v2 và gộp
 *     vào, để gói tháng dựng ra khớp danh mục D1 (không thì /api/v2 trả 503 tới
 *     lần đồng bộ sau).
 *   - Gói tháng của tháng chỉ có số Excel (nằm ngoài khoảng ngày của sheet) và
 *     "ngày cuối có số" của khối nạp Excel cũng được dựng lại.
 *   - Bảng đối chiếu cuối: hỏi D1 (qua wrangler) danh sách khối-ngày Excel để trừ
 *     ra ở cả hai bên — db:kiem-tra cũng trừ y như vậy, hai bảng mới so được.
 *
 * BẢO MẬT: .db-tam/ nằm trong .gitignore — file SQL chứa toàn bộ số liệu và tên
 * nhân sự, KHÔNG BAO GIỜ đưa lên GitHub.
 *
 * BỐ CỤC FILE
 *   lấy dữ liệu -> sinh SQL -> đối chiếu (3 phép) -> phần chạy chính ở cuối file
 * ===========================================================================*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { chuanHoaDayChuyen, chuanHoaVatTu, docSo, docNgay, dauThapPhanCot, taoMa, doanLoai } from '../db/chuan-hoa.mjs';
import { lapDanhMuc, noiGoi, cacThang, SQL_GOI_THANG, SQL_GOI_NHAN_SU, thamSoGoiThang, thamSoGoiNhanSu }
    from '../db/goi-v2.mjs';
import { mocKhoi } from '../db/dong-bo-d1.mjs';
import { docPhienChiSo, docChiSo, gioVN } from '../db/chi-so.mjs';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   /* thư mục dự án */
const API = process.env.XTK2_API || 'https://xtk2-profile.pages.dev/api/';
const FILE_RA = path.join(GOC, '.db-tam', 'nap-lich-su.sql');
const DONG_MOI_LENH = 200;             /* mỗi câu INSERT ~20 KB, dưới trần 100 KB/câu của D1 */
const HAN_MUC_GHI_NGAY = 100000;       /* gói Free */

/* =============================================================================
 * 1. LẤY DỮ LIỆU
 * ===========================================================================*/

/** Tải bản KV của một tuyến từ web đang chạy. */
async function layTuApi(tuyen) {
    /* /api/* chỉ trả cho trang dashboard (rào goiTuTrangNha trong functions/api).
       Script của chính chủ tự khai là same-origin để lấy dữ liệu của mình. */
    const r = await fetch(API + tuyen + (tuyen === 'vattu' ? '' : '?limit=10'),
        { headers: { 'sec-fetch-site': 'same-origin', 'accept-encoding': 'br, gzip' } });
    if (!r.ok) throw new Error('/api/' + tuyen + ' trả HTTP ' + r.status);
    return r.json();
}

/** Lấy dữ liệu cả 3 tuyến (từ API, hoặc từ file nếu có --tu-thu-muc).
 *  Ra: { tk3: [hàng...], tk4: [hàng...], vattu: { TK3, TK4 } } */
async function layDuLieu() {
    const i = process.argv.indexOf('--tu-thu-muc');
    const ra = {};
    for (const tuyen of ['tk3', 'tk4', 'vattu']) {
        const j = i > 0
            ? JSON.parse(fs.readFileSync(path.join(process.argv[i + 1], tuyen + '.json'), 'utf8'))
            : await layTuApi(tuyen);
        if (!j || j.status !== 'success' || !j.data) throw new Error(tuyen + ': dữ liệu không đúng dạng');
        ra[tuyen] = j.data;
        console.log('  ' + tuyen.padEnd(6) + (i > 0 ? 'đọc file' : 'tải API') + ' — '
            + (Array.isArray(j.data) ? j.data.length + ' dòng' : Object.keys(j.data).join(' + ')));
    }
    return ra;
}

/** Danh mục cột ĐANG có trên D1 (các cột được gửi ra trình duyệt), lấy qua
 *  /api/v2/tk3 với khoảng tháng rỗng (?tu=9999-12&den=9999-12: không kèm số liệu).
 *  Cần vì trang nạp Excel có thể đã tạo cột mà sheet không có.
 *  Ra: [[khối, tên cột], ...] hoặc null nếu không lấy được (D1 chưa có gói...). */
async function layDanhMucD1() {
    try {
        const r = await fetch(API + 'v2/tk3?tu=9999-12&den=9999-12',
            { headers: { 'sec-fetch-site': 'same-origin' }, signal: AbortSignal.timeout(20000) });
        if (!r.ok) return null;
        const j = await r.json();
        return Array.isArray(j.cot) ? j.cot : null;
    } catch (e) { return null; }
}

/** Hỏi D1 (qua wrangler, cần đã đăng nhập) các khối-ngày đang lấy số từ Excel.
 *  Chỉ dùng cho bảng đối chiếu cuối. Ra: [{ day_chuyen, khoi, ngay }], hoặc
 *  chuỗi lý do nếu không hỏi được. */
function docKhoiNgayNapD1() {
    try {
        const ra = execSync('npx wrangler d1 execute xtk2-db --remote --json --command '
            + '"SELECT day_chuyen, khoi, ngay FROM ngay_nap"',
            { cwd: GOC, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
        const j = JSON.parse(ra.slice(ra.indexOf('[')));
        return (j[0] && j[0].results) || [];
    } catch (e) {
        const loi = String((e && (e.stderr || e.message)) || e);
        /* D1 chưa chạy migrations/0005 -> chưa có ai nạp Excel */
        if (/no such table/i.test(loi)) return [];
        return loi.split('\n').filter(Boolean).slice(-1)[0] || 'lỗi không rõ';
    }
}

/* =============================================================================
 * 2. SINH FILE SQL
 * ===========================================================================*/

/** Một giá trị JS -> chữ SQL: null -> NULL, số -> số, chuỗi -> 'chuỗi' (nhân đôi dấu '). */
function sql(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    return "'" + String(v).replace(/'/g, "''") + "'";
}

/** INSERT nhiều dòng, chia khúc DONG_MOI_LENH dòng/câu.
 *  bang: tên bảng; cot: danh sách cột; dong: [{cột: giá trị}]; duoi: phần ON CONFLICT (nếu có).
 *  loc (tuỳ chọn): điều kiện lọc dòng. Khi có, câu thành
 *    INSERT INTO bang (...) SELECT * FROM (VALUES (...), (...)) AS v WHERE <loc> ...
 *  — các cột của VALUES tên là column1, column2... theo đúng thứ tự cot. */
function chenNhieu(bang, cot, dong, duoi, loc) {
    const ra = [];
    for (let i = 0; i < dong.length; i += DONG_MOI_LENH) {
        const khuc = dong.slice(i, i + DONG_MOI_LENH)
            .map(d => '(' + cot.map(c => sql(d[c])).join(',') + ')').join(',\n  ');
        const than = loc ? 'SELECT * FROM (VALUES\n  ' + khuc + ') AS v\nWHERE ' + loc : 'VALUES\n  ' + khuc;
        ra.push('INSERT INTO ' + bang + ' (' + cot.join(', ') + ') ' + than + (duoi ? '\n' + duoi : '') + ';');
    }
    return ra;
}

/** INSERT ... ON CONFLICT DO UPDATE ... WHERE <có cột khác>.
 *  WHERE sai (mọi cột y nguyên) thì SQLite không đụng tới dòng -> D1 không tính
 *  dòng ghi. Nhờ vậy chạy lại script với dữ liệu y nguyên gần như miễn phí.
 *  Cột cap_nhat được ghi khi có đổi, nhưng không dùng để XÉT có đổi hay không.
 *  loc: xem chenNhieu. */
function upsert(bang, cot, khoa, dong, loc) {
    const doi = cot.filter(c => khoa.indexOf(c) < 0 && c !== 'cap_nhat');
    const set = cot.filter(c => khoa.indexOf(c) < 0).map(c => c + ' = excluded.' + c).join(', ');
    const khac = doi.map(c => bang + '.' + c + ' IS NOT excluded.' + c).join(' OR ');
    return chenNhieu(bang, cot, dong,
        'ON CONFLICT (' + khoa.join(', ') + ') DO UPDATE SET ' + set + '\nWHERE ' + khac, loc);
}

/* Ô sheet KHÔNG được ghi nếu khối-ngày của nó đã nạp Excel (ngay_nap,
   migrations/0005). Dùng với upsert so_lieu: column1 = chi_tieu, column2 =
   day_chuyen, column3 = ngay. Chạy ở máy (SQLite trống bảng ngay_nap) thì điều
   kiện luôn đúng; chạy trên D1 thì che đúng các khối-ngày Excel đang giữ. */
const LOC_KHOI_NGAY_EXCEL = 'NOT EXISTS (SELECT 1 FROM ngay_nap AS n WHERE n.day_chuyen = v.column2 '
    + 'AND n.ngay = v.column3 AND n.khoi = (SELECT c.khoi FROM chi_tieu AS c WHERE c.ma = v.column1))';

/* Gói tháng cho các tháng CHỈ có số Excel — nằm ngoài khoảng tháng của sheet
   (?6..?7), nên không có trong loạt câu SQL_GOI_THANG từng tháng. Một câu cho
   mọi tháng như vậy của một dây chuyền (GROUP BY tháng). Ô gói y như
   SQL_GOI_THANG (db/goi-v2.mjs).
   ?1 tuyen ?2 phien ?3 ds_cot ?4 [mã được gửi] ?5 day_chuyen ?6 tháng đầu ?7 tháng cuối */
const SQL_GOI_THANG_EXCEL = `INSERT INTO goi_thang (tuyen, thang, phien, ds_cot, so_o, json)
    SELECT ?1, substr(s.ngay, 1, 7), ?2, ?3, COUNT(*),
           json_group_array(json_array(m.key, CAST(substr(s.ngay, 9, 2) AS INTEGER), s.stt, s.kip,
                                       coalesce(s.gia_tri, s.chu)))
    FROM json_each(?4) AS m JOIN so_lieu AS s ON s.chi_tieu = m.value
    WHERE s.day_chuyen = ?5 AND (substr(s.ngay, 1, 7) < ?6 OR substr(s.ngay, 1, 7) > ?7)
      AND substr(s.ngay, 1, 7) IN (SELECT substr(ngay, 1, 7) FROM ngay_nap WHERE day_chuyen = ?5)
    GROUP BY substr(s.ngay, 1, 7)
    ON CONFLICT (tuyen, thang) DO UPDATE SET phien = excluded.phien, ds_cot = excluded.ds_cot,
        so_o = excluded.so_o, json = excluded.json`;

/* Đẩy "ngày cuối có số" tiến lên theo số Excel (moc_khoi chỉ tính từ sheet ở
   trên, nên khối đang lấy số từ Excel sẽ bị lùi nếu thiếu câu này). Điều kiện
   y như mocKhoi() ở db/dong-bo-d1.mjs. ?1 = hôm nay */
const SQL_MOC_EXCEL = `INSERT INTO moc_khoi (tuyen, khoi, ngay_cuoi)
    SELECT lower(n.day_chuyen), n.khoi, MAX(s.ngay)
    FROM ngay_nap AS n JOIN chi_tieu AS c ON c.khoi = n.khoi
         JOIN so_lieu AS s ON s.chi_tieu = c.ma AND s.day_chuyen = n.day_chuyen AND s.ngay = n.ngay
    WHERE c.loai = 'ca' AND s.stt > 0 AND s.gia_tri > 0 AND s.ngay <= ?1
    GROUP BY n.day_chuyen, n.khoi
    ON CONFLICT (tuyen, khoi) DO UPDATE SET ngay_cuoi = excluded.ngay_cuoi
    WHERE excluded.ngay_cuoi > moc_khoi.ngay_cuoi`;

/** Câu SQL có tham số ?1, ?2... (dùng chung với Function) -> câu SQL chữ để ghi ra
 *  file: thay từng ?N bằng giá trị thứ N. */
function dienThamSo(cau, thamSo) {
    return cau.replace(/\?(\d+)/g, (m, n) => sql(thamSo[+n - 1])) + ';';
}

/** Ngày giờ Việt Nam (UTC+7) -> 'YYYY-MM-DD'. */
function ngayVN(ms) { return new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10); }

/** Ghép nội dung file .db-tam/nap-lich-su.sql, theo thứ tự:
 *    mọi migration -> chi_tieu -> so_lieu -> nhân sự -> vật tư -> gói tháng
 *    -> mốc khối -> nhật ký. */
function taoSql(kq, luc) {
    const chiTieu = [...kq.chiTieu.values()].sort((a, b) => a.ma < b.ma ? -1 : 1);
    const dongNhanSu = kq.nhanSu;
    const dcNhanSu = [...new Set(dongNhanSu.map(d => d.day_chuyen))];
    /* Kèm mọi migration (đều chạy lại được) -> file tự đủ: chạy trên D1 chưa có
       bảng mới vẫn không hỏng */
    const migration = fs.readdirSync(path.join(GOC, 'migrations'))
        .filter(f => /^\d+_.*\.sql$/.test(f)).sort()
        .map(f => '-- ===== ' + f + '\n' + fs.readFileSync(path.join(GOC, 'migrations', f), 'utf8'));
    const cau = [
        '-- Sinh bởi scripts/nap-lich-su.mjs lúc ' + new Date(luc).toISOString(),
        '-- KHÔNG sửa tay, KHÔNG đưa lên git (chứa toàn bộ số liệu + tên nhân sự).',
        '',
        ...migration,
        ...upsert('chi_tieu', ['ma', 'khoi', 'cot_sheet', 'loai'], ['ma'], chiTieu),
        ...upsert('so_lieu', ['chi_tieu', 'day_chuyen', 'ngay', 'stt', 'ca', 'kip', 'gia_tri', 'chu', 'cap_nhat'],
            ['chi_tieu', 'day_chuyen', 'ngay', 'stt'], kq.soLieu, LOC_KHOI_NGAY_EXCEL),
    ];
    if (dcNhanSu.length) {
        cau.push('DELETE FROM nhan_su WHERE day_chuyen IN (' + dcNhanSu.map(sql).join(', ') + ');');
        cau.push(...chenNhieu('nhan_su', ['day_chuyen', 'kip', 'stt', 'nhan_vien', 'vi_tri', 'trang_thai'], dongNhanSu));
    }
    if (kq.vatTu) {
        cau.push('DELETE FROM vat_tu_ton;', 'DELETE FROM vat_tu_phieu;');
        cau.push(...chenNhieu('vat_tu_ton', ['day_chuyen', 'ten', 'don_vi', 'ton_dau', 'nhap', 'xuat', 'ton_cuoi', 'ton_an_toan'], kq.vatTu.ton));
        cau.push(...chenNhieu('vat_tu_phieu', ['day_chuyen', 'loai', 'ten', 'so_luong', 'mo_ta', 'ngay', 'ngay_thieu_nam', 'ca', 'kip'], kq.vatTu.phieu));
    }
    /* Gói /api/v2: dựng lại TOÀN BỘ — bằng đúng câu SQL Function dùng khi đồng bộ */
    const dm = lapDanhMuc(chiTieu);
    for (const tuyen of ['tk3', 'tk4']) {
        const pv = kq.phamVi[tuyen];
        cau.push('DELETE FROM goi_thang WHERE tuyen = ' + sql(tuyen) + ';');
        for (const t of cacThang(pv.tu, pv.den)) cau.push(dienThamSo(SQL_GOI_THANG, thamSoGoiThang(tuyen, t, luc, dm)));
        cau.push(dienThamSo(SQL_GOI_THANG_EXCEL, [tuyen, luc, dm.vanTay, JSON.stringify(dm.maGui),
            tuyen.toUpperCase(), pv.tu.slice(0, 7), pv.den.slice(0, 7)]));
        cau.push(dienThamSo(SQL_GOI_NHAN_SU, thamSoGoiNhanSu(tuyen, luc, dm)));
    }
    /* Ngày cuối có số của từng khối — tính trọn từ cả lịch sử (lúc đồng bộ,
       Function chỉ đẩy mốc này tiến lên chứ không tính lại) */
    for (const tuyen of ['tk3', 'tk4']) {
        cau.push('DELETE FROM moc_khoi WHERE tuyen = ' + sql(tuyen) + ';');
        const dong = Object.entries(kq.moc[tuyen]).map(([khoi, ngay]) => ({ tuyen: tuyen, khoi: khoi, ngay_cuoi: ngay }));
        if (dong.length) cau.push(...chenNhieu('moc_khoi', ['tuyen', 'khoi', 'ngay_cuoi'], dong));
    }
    cau.push(dienThamSo(SQL_MOC_EXCEL, [ngayVN(luc)]));
    cau.push(...chenNhieu('nhat_ky_nap', ['luc', 'nguon', 'tuyen', 'so_gia_tri', 'ghi_chu'], kq.nhatKy));
    return cau.join('\n') + '\n';
}

/* =============================================================================
 * 3. ĐỐI CHIẾU — chạy file SQL trên SQLite trong máy rồi so với bảng gốc
 * -----------------------------------------------------------------------------
 *   a) chạy file 2 lần: lần 2 không được ghi lại dòng nào (upsert đúng);
 *   b) từng khối, từng cột: DB phải ra đúng ngày / kíp / thứ tự như biểu đồ vẽ;
 *   c) doiChieuV2: bảng dựng từ gói /api/v2 phải khớp bảng gốc Apps Script gửi;
 *   d) doiChieuChiSo: /api/v2/chi-so phải ra đúng như trình duyệt tự tính.
 * ===========================================================================*/

/** Dựng lại chuỗi (nhãn, giá trị) của một cột Y NHƯ extractChartData() trong
 *  js/components/Charts/chart_core.js làm — kể cả cách đọc số "ngây thơ" của
 *  nó: chỉ thay dấu phẩy ĐẦU TIÊN bằng dấu chấm. */
function thamChieuTrinhDuyet(rows, cotNgay, cotCa, cot) {
    const ra = [];
    let cur = '';
    for (const r of rows) {
        if (r[cotNgay] && String(r[cotNgay]).trim()) cur = r[cotNgay];
        if (!r[cotCa]) continue;
        const v = r[cot];
        const naive = (v === undefined || v === null || String(v).trim() === '') ? null
            : (n => isNaN(n) ? null : n)(Number(String(v).replace(',', '.')));
        ra.push({ nhan: cur + ' - ' + r[cotCa], goc: v, naive: naive });
    }
    return ra;
}

/** Chạy mọi phép đối chiếu. Ra true nếu tất cả khớp. */
async function doiChieu(fileSql, duLieu, kq) {
    let DatabaseSync;
    try { ({ DatabaseSync } = await import('node:sqlite')); }
    catch (e) { console.log('\n(Bỏ qua chạy thử: Node này chưa có node:sqlite — cần Node 22.13+)'); return true; }

    const db = new DatabaseSync(':memory:');              /* DB tạm trong RAM */
    db.exec('PRAGMA foreign_keys = ON;');                 /* D1 luôn bật khoá ngoại */
    db.exec(fs.readFileSync(fileSql, 'utf8'));            /* file đã kèm migration */
    /* a) Chạy LẦN HAI với mốc cap_nhat khác: ô y nguyên thì không được ghi lại —
       chứng minh upsert chỉ-khi-khác đúng (chạy lại không tốn dòng ghi) */
    const truoc = db.prepare('SELECT COUNT(*) n FROM so_lieu').get().n;
    const lan2 = kq.nhatKy[0].luc + 1;
    db.exec(fs.readFileSync(fileSql, 'utf8').replace(new RegExp('\\b' + kq.nhatKy[0].luc + '\\b', 'g'), String(lan2)));
    const sau = db.prepare('SELECT COUNT(*) n, SUM(cap_nhat = ?) doi FROM so_lieu').get(lan2);

    let loi = 0;
    const bao = (ok, s) => { if (!ok) loi++; console.log((ok ? '  OK   ' : '  SAI  ') + s); };
    console.log('\nCHẠY THỬ TRÊN SQLITE TRONG MÁY');
    bao(sau.n === truoc && sau.doi === 0, 'Chạy file lần 2: ' + sau.n.toLocaleString('vi-VN') + ' dòng, ' + sau.doi + ' dòng bị ghi lại (phải là 0)');

    /* b) Từng khối, từng cột: chuỗi giá trị lấy từ DB phải khớp chuỗi trình duyệt dựng */
    let soO = 0, khacNaive = [], lechCauTruc = 0;
    /* stt = 0 (ô kế hoạch / định mức ở hàng chưa có kíp) không có trên biểu đồ */
    const cauSoLieu = db.prepare('SELECT ngay, stt, kip, gia_tri, chu FROM so_lieu WHERE chi_tieu = ? AND day_chuyen = ? AND stt > 0 ORDER BY ngay, stt');
    for (const [dc, tuyen] of [['TK3', 'tk3'], ['TK4', 'tk4']]) {
        const rows = duLieu[tuyen];
        for (const ct of kq.chiTieu.values()) {
            /* Tên khối 'X_1' -> cột 'Thời gian (X)_1'; tên 'X' -> 'Thời gian (X)' */
            const cotNgay = 'Thời gian (' + ct.khoi.replace(/_(\d+)$/, ')_$1') + (/_\d+$/.test(ct.khoi) ? '' : ')');
            const cotCa = cotNgay.replace(/^Thời gian/, 'Ca/kíp');
            if (!(ct.cot_sheet in rows[0])) continue;
            const ref = thamChieuTrinhDuyet(rows, cotNgay, cotCa, ct.cot_sheet).filter(x => x.goc !== undefined && x.goc !== null && String(x.goc).trim() !== '');
            const tuDb = cauSoLieu.all(ct.ma, dc);
            if (ref.length !== tuDb.length) { lechCauTruc++; bao(false, dc + ' ' + ct.ma + ': trình duyệt ' + ref.length + ' ô, DB ' + tuDb.length + ' ô'); continue; }
            for (let i = 0; i < ref.length; i++) {
                const a = ref[i], b = tuDb[i];
                const [dd, mm, yy] = String(a.nhan).split(' - ')[0].trim().split('/');
                const nhanDb = b.ngay.split('-').reverse().join('/') + ' - ' + b.kip;
                if (docNgay(dd + '/' + mm + '/' + yy) !== b.ngay || nhanDb.slice(-1) !== String(a.nhan).slice(-1).toUpperCase()) {
                    lechCauTruc++;
                    if (lechCauTruc <= 5) bao(false, dc + ' ' + ct.ma + ' ô ' + (i + 1) + ': nhãn "' + a.nhan + '" ≠ DB "' + nhanDb + '"');
                    break;
                }
                soO++;
                const dbSo = b.gia_tri;
                /* Khác cách đọc số "ngây thơ" của biểu đồ: chỉ báo để biết, không
                   tính là lỗi (DB đọc đúng chuẩn sheetNumber) */
                if (a.naive !== dbSo && !(a.naive === null && b.chu !== null)) {
                    khacNaive.push(dc + ' ' + ct.cot_sheet + ' ' + a.nhan + ': ô "' + a.goc + '" -> trình duyệt ' + a.naive + ', DB ' + dbSo);
                }
            }
        }
    }
    bao(lechCauTruc === 0, soO.toLocaleString('vi-VN') + ' ô số liệu: đúng ngày, đúng kíp, đúng thứ tự như biểu đồ đang vẽ');
    if (khacNaive.length) {
        console.log('  CHÚ Ý ' + khacNaive.length + ' ô DB đọc KHÁC extractChartData() — bên trình duyệt chỉ thay dấu phẩy đầu tiên,');
        console.log('         DB dùng cách đọc chuẩn sheetNumber() (như mục Sản lượng). Vài ví dụ:');
        for (const s of khacNaive.slice(0, 6)) console.log('         - ' + s);
    }

    const nsDb = db.prepare('SELECT COUNT(*) n FROM nhan_su').get().n;
    bao(nsDb === kq.nhanSu.length, 'nhan_su: ' + nsDb + ' người');
    const vt = db.prepare("SELECT (SELECT COUNT(*) FROM vat_tu_ton) t, (SELECT COUNT(*) FROM vat_tu_phieu) p, (SELECT COUNT(*) FROM vat_tu_phieu WHERE ngay IS NULL AND ngay_thieu_nam IS NULL) k").get();
    bao(kq.vatTu && vt.t === kq.vatTu.ton.length && vt.p === kq.vatTu.phieu.length,
        'vật tư: ' + vt.t + ' dòng tồn kho, ' + vt.p + ' phiếu (' + vt.k + ' phiếu không tách được ngày)');

    loi += doiChieuV2(db, duLieu, bao);                                    /* c) */
    loi += await doiChieuChiSo(db, duLieu, bao, kq.nhatKy[0].luc);        /* d) */

    /* Bảng đếm cuối TRỪ các khối-ngày đang lấy số từ Excel ở cả hai bên: D1 có
       số Excel ở đó (và đã bỏ ô sheet), còn DB trong máy chỉ có ô sheet. Nạp
       danh sách D1 vừa hỏi vào bảng ngay_nap trong máy để câu đếm trừ y hệt. */
    if (Array.isArray(kq.khoiNgayExcel) && kq.khoiNgayExcel.length) {
        const chen = db.prepare('INSERT OR IGNORE INTO ngay_nap (day_chuyen, khoi, ngay, lan_nap) VALUES (?, ?, ?, 0)');
        for (const x of kq.khoiNgayExcel) chen.run(x.day_chuyen, x.khoi, x.ngay);
    }
    console.log('\nSO VỚI D1 SAU KHI NẠP — chạy `npm run db:kiem-tra`, phải ra ĐÚNG bảng này:');
    if (Array.isArray(kq.khoiNgayExcel)) {
        if (kq.khoiNgayExcel.length) console.log('  (đã trừ ' + kq.khoiNgayExcel.length + ' khối-ngày đang lấy số từ Excel)');
    } else {
        console.log('  (KHÔNG hỏi được D1 danh sách khối-ngày Excel: ' + kq.khoiNgayExcel + ')');
        console.log('  -> nếu đã từng nạp Excel, bảng dưới có thể lệch db:kiem-tra ở đúng các khối-ngày đó.');
    }
    console.table(db.prepare(CAU_KIEM_TRA).all());
    return loi === 0;
}

/** c) Kiểm /api/v2: dựng bảng ngang từ gói trong DB bằng CHÍNH js/api/api_v2.js
 *  của trình duyệt (chạy trong vm), rồi so với bảng gốc Apps Script gửi — từng
 *  khối, từng cột: cùng ngày, cùng kíp, cùng số (đọc bằng docSo = sheetNumber).
 *  Khớp ở đây nghĩa là mọi biểu đồ / dải chỉ số / bảng cảnh báo đọc ra y như từ
 *  bản KV. Kiểm thêm: tải mặc định + xin thêm tháng cũ, gộp lại phải ra đúng
 *  bảng trọn lịch sử; danh sách nhân sự khớp. */
function doiChieuV2(db, duLieu, bao) {
    const ctx = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(GOC, 'js', 'api', 'api_v2.js'), 'utf8'), ctx);
    const dm = lapDanhMuc(db.prepare('SELECT ma, khoi, cot_sheet FROM chi_tieu').all());
    let loi = 0;

    for (const tuyen of ['tk3', 'tk4']) {
        const goc = duLieu[tuyen];
        const body = noiGoi(dm, db.prepare('SELECT thang, ds_cot, json FROM goi_thang WHERE tuyen = ? ORDER BY thang').all(tuyen));
        const v2 = ctx.apiV2BangNgang(JSON.parse(body));
        const kb = Buffer.byteLength(body) / 1024;

        /* Rút một cột của một khối thành chuỗi để so:
             coKip   'ngày|kíp|giá trị' cho từng hàng có kíp
             chuaKip 'ngày|giá trị' cho hàng chưa có kíp (chỉ cột định mức / kế hoạch) */
        const quet = (rows, cotNgay, cotCa, cot, laMucTieu) => {
            const tp = dauThapPhanCot(rows.map(r => r[cot]));
            const coKip = [], chuaKip = [];
            let ngay = null;
            for (const r of rows) {
                const coNgayDongNay = r[cotNgay] && String(r[cotNgay]).trim();
                if (coNgayDongNay) ngay = docNgay(r[cotNgay]) || ngay;
                const v = r[cot];
                if (v === undefined || v === null || String(v).trim() === '') continue;
                const so = /^[+-]?[\d.,\s]+%?$/.test(String(v).trim()) ? docSo(v, tp) : String(v).trim().normalize('NFC');
                if (r[cotCa]) coKip.push(ngay + '|' + String(r[cotCa]).trim().toUpperCase() + '|' + so);
                else if (laMucTieu && coNgayDongNay) chuaKip.push(ngay + '|' + so);
            }
            return { coKip: coKip.join('\n'), chuaKip: chuaKip.join('\n'), n: coKip.length + chuaKip.length };
        };

        let soO = 0, lech = [];
        for (const ma of dm.maGui) {
            const [khoi, cot] = dm.cot[ma];
            if (!(cot in goc[0])) continue;
            const m = khoi.match(/^(.*?)(_\d+)?$/);
            const cotNgay = 'Thời gian (' + m[1] + ')' + (m[2] || ''), cotCa = 'Ca/kíp (' + m[1] + ')' + (m[2] || '');
            const laMucTieu = /^(Định mức|Mức trung bình)|kế hoạch|^Khoảng (dưới|trên)/i.test(cot);
            const a = quet(goc, cotNgay, cotCa, cot, laMucTieu), b = quet(v2, cotNgay, cotCa, cot, laMucTieu);
            soO += b.n;
            if (a.coKip !== b.coKip || a.chuaKip !== b.chuaKip) lech.push(tuyen + ' ' + cot);
        }
        /* Tải theo tháng: giả lập trình duyệt tải mặc định từ tháng T (3 tháng
           cuối) rồi xin thêm phần còn lại, gộp trong kho API_V2_KHO -> phải ra
           ĐÚNG bảng dựng từ trọn lịch sử */
        const cacGoi = db.prepare('SELECT thang, ds_cot, json FROM goi_thang WHERE tuyen = ? ORDER BY thang').all(tuyen);
        const cacThangCo = cacGoi.map(g => g.thang).filter(t => t !== 'nhan-su');
        if (cacThangCo.length > 2) {
            const T = cacThangCo[cacThangCo.length - 3], dau = cacThangCo[0];
            const truocT = cacThangCo.filter(t => t < T).pop();
            const macDinh = JSON.parse(noiGoi(dm, cacGoi.filter(g => g.thang >= T),
                { muc_luc: { cac_thang: cacThangCo, khoi: {} }, pham_vi: { tu: T, den: '9999-12' } }));
            const them = JSON.parse(noiGoi(dm, cacGoi.filter(g => g.thang < T && g.thang !== 'nhan-su'),
                { pham_vi: { tu: dau, den: truocT } }));
            const ten = tuyen.toUpperCase();
            ctx.apiV2NhanGoi(ten, macDinh, true, 'x');
            const gop = ctx.apiV2NhanGoi(ten, them, false);
            const giong = JSON.stringify(gop) === JSON.stringify(v2);
            bao(giong, ten + ' tải từ ' + T + ' rồi xin thêm ' + dau + '..' + truocT + ': bảng gộp y hệt bảng trọn lịch sử');
            if (!giong) loi++;
        }
        bao(!lech.length, tuyen.toUpperCase() + ' /api/v2: ' + soO.toLocaleString('vi-VN') + ' ô dựng lại khớp bảng gốc ('
            + Math.round(kb) + ' KB so với ' + Math.round(Buffer.byteLength(JSON.stringify(goc)) / 1024) + ' KB bản KV)'
            + (lech.length ? ' — LỆCH: ' + lech.slice(0, 5).join('; ') : ''));
        if (lech.length) loi++;

        /* Nhân sự (chỉ TK3 có) */
        if (tuyen === 'tk3') {
            const ns = rows => ['A', 'B', 'C'].map(k => rows.filter(r => r['Mã nhân viên (' + k + ')'])
                .map(r => [r['STT (' + k + ')'], r['Mã nhân viên (' + k + ')'], r['Vị trí công việc (' + k + ')'], r['Status (' + k + ')']]
                    .map(x => String(x || '').trim().normalize('NFC')).join('|')).join('\n')).join('\n#\n');
            const giong = ns(goc) === ns(v2);
            bao(giong, 'TK3 /api/v2: danh sách nhân sự 3 kíp khớp bảng gốc');
            if (!giong) loi++;
        }
        /* In các cột bản KV có mà /api/v2 không gửi — phải đúng là các cột cố ý bỏ */
        const thieu = Object.keys(goc[0]).filter(c => !(c in v2[0]));
        console.log('         ' + tuyen.toUpperCase() + ' không gửi ' + thieu.length + ' cột: ' + thieu.join(' | '));
    }
    return loi;
}

/** d) Kiểm /api/v2/chi-so: chạy ĐÚNG mã của Function (db/chi-so.mjs) trên SQLite
 *  trong máy, so với trình duyệt tự tính trên bảng GỐC Apps Script gửi (cùng
 *  js/chung/chi_so.js) — thử với mọi ngày "hôm nay" từ đầu tháng trước tới nay. */
async function doiChieuChiSo(db, duLieu, bao, luc) {
    /* Vỏ giả binding D1 (prepare / bind / all / first / batch) bọc quanh node:sqlite */
    const d1 = {
        prepare(cau) {
            const st = { thamSo: [], bind(...a) { st.thamSo = a; return st; },
                all: async () => ({ results: db.prepare(cau).all(...st.thamSo) }),
                first: async () => db.prepare(cau).get(...st.thamSo) || null };
            return st;
        },
        batch: async (ds) => Promise.all(ds.map(st => st.all())),
    };
    const CS = globalThis.XTK2_CHI_SO;
    /* Ngày đầu = mùng 1 tháng này (12 giờ trưa VN) lùi 31 ngày */
    const ngayDau = Date.parse(new Date(luc + 7 * 3600e3).toISOString().slice(0, 8) + '01T05:00:00Z') - 31 * 86400e3;
    let soNgay = 0, lech = [];
    for (let t = ngayDau; t <= luc; t += 86400e3) {
        const p = await docPhienChiSo(d1, t);
        const may = JSON.parse(await docChiSo(d1, p));
        const tuTinh = CS.tinhChiSo(duLieu.tk3, duLieu.tk4, gioVN(t));
        delete may.status; delete may.nguon;
        if (JSON.stringify(may) !== JSON.stringify(tuTinh)) lech.push(may.ngay);
        soNgay++;
    }
    bao(!lech.length, '/api/v2/chi-so: ' + soNgay + ' ngày "hôm nay" khác nhau, máy chủ tính = trình duyệt tự tính trên bảng gốc'
        + (lech.length ? ' — LỆCH ngày: ' + lech.slice(0, 5).join(', ') : ''));
    return lech.length ? 1 : 0;
}

/* Câu đếm tổng kết — phải giữ GIỐNG HỆT script db:kiem-tra trong package.json
   để hai bảng in ra so được với nhau. Chỉ đếm ô KHÔNG thuộc khối-ngày Excel. */
const CAU_KIEM_TRA = 'SELECT day_chuyen, COUNT(*) AS so_gia_tri, COUNT(DISTINCT chi_tieu) AS so_chi_tieu, '
    + 'MIN(ngay) AS tu_ngay, MAX(ngay) AS den_ngay, ROUND(SUM(gia_tri), 2) AS tong FROM so_lieu AS s '
    + 'WHERE NOT EXISTS (SELECT 1 FROM ngay_nap AS n WHERE n.day_chuyen = s.day_chuyen AND n.ngay = s.ngay '
    + 'AND n.khoi = (SELECT khoi FROM chi_tieu WHERE ma = s.chi_tieu)) GROUP BY day_chuyen';

/* =============================================================================
 * 4. CHẠY CHÍNH
 * ===========================================================================*/

const luc = Date.now();
console.log('LẤY DỮ LIỆU');
const duLieu = await layDuLieu();

/* Gom kết quả chuẩn hoá của cả hai dây chuyền + vật tư */
const kq = { chiTieu: new Map(), soLieu: [], nhanSu: [], nhatKy: [], vatTu: null, phamVi: {}, moc: {} };
const canhBao = [], boQua = new Map();
for (const [dc, tuyen] of [['TK3', 'tk3'], ['TK4', 'tk4']]) {
    const r = chuanHoaDayChuyen(dc, duLieu[tuyen], luc);
    /* Những tháng cần gói /api/v2: từ ngày đầu tới ngày muộn nhất có ô (hoặc hôm nay) */
    const homNay = ngayVN(luc);
    kq.phamVi[tuyen] = { tu: r.ngayNhoNhat, den: r.ngayLonNhat && r.ngayLonNhat > homNay ? r.ngayLonNhat : homNay };
    kq.moc[tuyen] = mocKhoi(r, homNay);
    /* Danh mục chung cho hai dây chuyền: cùng mã thì giữ một; cột là chữ ở một
       dây chuyền thì coi là chữ */
    for (const [ma, ct] of r.chiTieu) {
        const cu = kq.chiTieu.get(ma);
        if (cu && cu.loai !== ct.loai && ct.loai === 'chu') kq.chiTieu.set(ma, ct);   /* chữ ở một dây là chữ */
        else if (!cu) kq.chiTieu.set(ma, ct);
    }
    kq.soLieu.push(...r.soLieu);
    kq.nhanSu.push(...r.nhanSu);
    canhBao.push(...r.canhBao);
    for (const b of r.boQua) boQua.set(b.cot, b.viSao);
    kq.nhatKy.push({ luc: luc, nguon: 'lich-su', tuyen: tuyen, so_gia_tri: r.soLieu.length,
        ghi_chu: duLieu[tuyen].length + ' dòng sheet' });
}
kq.vatTu = chuanHoaVatTu(duLieu.vattu);
canhBao.push(...kq.vatTu.canhBao);

/* Gộp các cột D1 có mà sheet không có (cột tạo từ trang nạp Excel) vào danh mục,
   để gói tháng dựng ra mang ĐÚNG vân tay danh mục của D1 */
const cotD1 = await layDanhMucD1();
const cotThem = [];
if (cotD1) {
    const daCo = new Set([...kq.chiTieu.values()].map(c => c.khoi + '|' + c.cot_sheet));
    for (const [khoi, cot] of cotD1) {
        if (daCo.has(khoi + '|' + cot)) continue;
        const ma = taoMa(khoi, cot), cu = kq.chiTieu.get(ma);
        if (cu) { canhBao.push('Danh mục D1: cột ' + khoi + ' / ' + cot + ' trùng mã ' + ma + ' với ' + cu.khoi + ' / ' + cu.cot_sheet + ' — bỏ'); continue; }
        kq.chiTieu.set(ma, { ma: ma, khoi: khoi, cot_sheet: cot, loai: /^Ca\/kíp \(/.test(cot) ? 'chu' : doanLoai(cot) });
        cotThem.push(khoi + ' / ' + cot);
    }
}
/* Danh sách khối-ngày Excel trên D1 — chỉ để bảng đối chiếu cuối trừ cho đúng */
kq.khoiNgayExcel = process.argv.includes('--tu-thu-muc') || process.argv.includes('--khong-hoi-d1')
    ? [] : docKhoiNgayNapD1();
kq.nhatKy.push({ luc: luc, nguon: 'lich-su', tuyen: 'vattu',
    so_gia_tri: kq.vatTu.ton.length + kq.vatTu.phieu.length, ghi_chu: null });

/* In tóm tắt cho người chạy đọc */
console.log('\nCHUẨN HOÁ');
for (const dc of ['TK3', 'TK4']) {
    const dong = kq.soLieu.filter(d => d.day_chuyen === dc);
    const ngay = dong.map(d => d.ngay).sort();
    console.log('  ' + dc + ': ' + dong.length.toLocaleString('vi-VN') + ' ô có giá trị, '
        + new Set(dong.map(d => d.chi_tieu)).size + ' chỉ tiêu, ' + ngay[0] + ' → ' + ngay[ngay.length - 1]
        + ', ' + dong.filter(d => d.chu !== null).length + ' ô chữ');
}
console.log('  Danh mục: ' + kq.chiTieu.size + ' chỉ tiêu — '
    + Object.entries([...kq.chiTieu.values()].reduce((a, c) => (a[c.loai] = (a[c.loai] || 0) + 1, a), {}))
        .map(([k, n]) => k + ' ' + n).join(', '));
console.log('  Nhân sự: ' + kq.nhanSu.length + ' người; vật tư: ' + kq.vatTu.ton.length + ' tồn kho + ' + kq.vatTu.phieu.length + ' phiếu');
for (const t of ['tk3', 'tk4']) {
    console.log('  Ngày cuối có số (' + t.toUpperCase() + '): ' + Object.entries(kq.moc[t]).sort((a, b) => a[1] < b[1] ? -1 : 1)
        .map(([k, n]) => k + ' ' + n.slice(5).split('-').reverse().join('/')).join(', '));
}
if (boQua.size) console.log('  Không lưu: ' + [...boQua].map(([c, v]) => c + ' (' + v + ')').join('; '));
console.log(cotD1 === null ? '  (Không lấy được danh mục cột trên D1 qua /api/v2 — dùng danh mục của sheet)'
    : '  Cột chỉ có trên D1 (nạp từ Excel): ' + (cotThem.length ? cotThem.join(', ') : 'không có'));
if (canhBao.length) {
    console.log('  CẢNH BÁO (' + canhBao.length + '):');
    for (const c of canhBao.slice(0, 10)) console.log('    - ' + c);
    if (canhBao.length > 10) console.log('    ... và ' + (canhBao.length - 10) + ' cảnh báo nữa');
}

/* Ước lượng số dòng ghi của lần nạp ĐẦU (D1 trống) so với hạn mức ngày */
const soGhi = kq.chiTieu.size + kq.soLieu.length + kq.nhanSu.length * 2
    + (kq.vatTu.ton.length + kq.vatTu.phieu.length) * 2 + kq.nhatKy.length;
console.log('\n  Lần nạp ĐẦU ghi tối đa ~' + soGhi.toLocaleString('vi-VN') + ' dòng / hạn mức Free '
    + HAN_MUC_GHI_NGAY.toLocaleString('vi-VN') + ' dòng/ngày'
    + (soGhi > HAN_MUC_GHI_NGAY * 0.9 ? ' — QUÁ SÁT HẠN MỨC, chia làm 2 ngày!' : '.'));

fs.mkdirSync(path.dirname(FILE_RA), { recursive: true });
fs.writeFileSync(FILE_RA, taoSql(kq, luc), 'utf8');
console.log('  Đã ghi ' + path.relative(GOC, FILE_RA) + ' (' + (fs.statSync(FILE_RA).size / 1024 / 1024).toFixed(2) + ' MB)');

const dat = await doiChieu(FILE_RA, duLieu, kq);
console.log(dat ? '\nSẴN SÀNG: chạy `npm run db:nap` để đẩy lên D1.' : '\nCÓ LỖI Ở TRÊN — chưa nên đẩy lên D1.');
process.exitCode = dat ? 0 : 1;
