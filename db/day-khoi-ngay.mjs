/* =============================================================================
 * db/day-khoi-ngay.mjs — ĐƯỜNG ĐẨY "KHỐI-NGÀY" CỦA APPS SCRIPT (POST /api/day/<tuyến>)
 * =============================================================================
 * VÌ SAO CÓ ĐƯỜNG NÀY
 *   Đường đẩy cũ (POST /api/tk3) gửi CẢ sheet 2–3 MB mỗi lần; máy chủ parse rồi
 *   chuẩn hoá tốn 60–72 ms CPU (đo thật 04/10/2026), trong khi gói Free cho 10 ms.
 *   Đường này chỉ nhận những KHỐI-NGÀY đã đổi (vd "QTK ngày 03/10"): vài KB mỗi
 *   lần, vài ms CPU. Việc nặng (đọc cả sheet, so sánh) dời sang Apps Script, nơi
 *   không bị giới hạn 10 ms.
 *
 * HAI BÊN BIẾT CÁI GÌ ĐỔI BẰNG CÁCH NÀO (apps-script/khoi-ngay.gs)
 *   Apps Script đọc cả sheet qua chính doGet đang dùng, chia theo khối-ngày, tính
 *   dấu vân tay MD5 cho từng khối-ngày và cho từng (khối, tháng). Mỗi lượt:
 *     1) buoc 'so-sanh' (soSanhKhoiNgay): gửi ~130 dấu (khối, tháng). Máy chủ so
 *        với bảng van_tay_thang (migrations/0006), trả các tháng LỆCH kèm dấu từng
 *        ngày mà máy chủ đang giữ cho các tháng đó.
 *     2) buoc 'ghi' (ghiKhoiNgay): Apps Script gửi các hàng của những khối-ngày có
 *        dấu khác — kể cả ngày cũ bị sửa lùi; khối-ngày không còn trên sheet thì
 *        gửi dấu '' = xoá. Máy chủ chuẩn hoá bằng ĐÚNG hàm chuanHoaDayChuyen của
 *        đường cũ, thay TRỌN từng khối-ngày, ghi dấu mới — cùng một giao dịch.
 *   Lượt không có gì đổi chỉ có bước 1.
 *
 * GIỮ TOÀN VẸN DỮ LIỆU
 *   - Mỗi phần ghi chỉ chứa MỘT khối, với đúng các cột của khối đó. Ô chuẩn hoá ra
 *     mà rơi vào ngày không khai báo -> từ chối cả lượt (hai bên hiểu sheet khác
 *     nhau thì dừng lại, không ghi bừa). Lỗi -> mã lỗi -> Apps Script không coi là
 *     xong, lượt sau gửi lại.
 *   - Số và dấu ghi chung một giao dịch: dấu trong D1 luôn ứng với số đang có.
 *   - Khối-ngày đã nạp Excel (ngay_nap): bỏ số sheet như đồng bộ cũ, nhưng vẫn ghi
 *     dấu để lượt sau khỏi gửi lại. Huỷ lần nạp Excel thì xoá dấu (huyNap) -> lượt
 *     đẩy sau sheet gửi lại ngay các ngày đó.
 *   - Khối vắng hẳn khỏi sheet (đổi tên, xoá cột) KHÔNG bị xoá lịch sử — y như
 *     đồng bộ cũ (chỉ xoá ô của những cột đang có trong sheet).
 *   - Đường nào khác ghi số sheet vào so_lieu (đồng bộ dự phòng của đường cũ —
 *     quenVanTay ở db/dong-bo-d1.mjs; db:nap) thì xoá hết dấu của dây chuyền đó ->
 *     lượt sau Apps Script thấy lệch hết và gửi lại hết. Huỷ lần nạp Excel thì
 *     quên dấu các khối-ngày trả về cho sheet (huyNap ở db/nap-excel.mjs).
 * ===========================================================================*/

import { chuanHoaDayChuyen, tachKhoi, DAY_CHUYEN } from './chuan-hoa.mjs';
import { SQL_NAP, dungLaiGoi, LoiNap } from './nap-excel.mjs';
import { SQL_DONG_BO } from './dong-bo-d1.mjs';

export const GIOI_HAN_KN = {
    o: 12000,           /* ô mỗi lượt ghi (Apps Script tự chia ~4.000 ô/lượt) */
    phan: 300,          /* khối-tháng mỗi lượt ghi */
    hang: 5000,         /* hàng mỗi phần */
    cot: 80,            /* cột mỗi khối */
    thang: 5000,        /* dấu (khối, tháng) mỗi lượt so sánh */
    ngayToi: 400,       /* ngày tương lai xa nhất nhận (sheet điền sẵn ngày tới cuối năm) */
};
const NGAY_SOM_NHAT = '2020-01-01';
const KHOI_NHAN_SU = '(nhân sự)';           /* "khối" giả cho danh sách nhân sự trong van_tay_thang */
const LECH_GIO_VN_MS = 7 * 3600 * 1000;
const RE_THANG = /^\d{4}-(0[1-9]|1[0-2])$/;

function ngayVN(ms) { return new Date(ms + LECH_GIO_VN_MS).toISOString().slice(0, 10); }
function congNgay(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function ngayHopLe(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function laDoiTuong(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function soDoi(kq) { return (kq && kq.meta && kq.meta.changes) || 0; }
/** 'tk3' -> 'TK3', rỗng nếu không phải dây chuyền đang có */
export function dayChuyenCuaTuyen(tuyen) {
    const dc = String(tuyen || '').toUpperCase();
    return DAY_CHUYEN.indexOf(dc) >= 0 ? dc : '';
}
/** Dòng sổ dong_bo của đường này: 'tk3/khoi-ngay' (đường cũ dùng 'tk3') */
export function tuyenKhoiNgay(tuyen) { return tuyen + '/khoi-ngay'; }

const SQL = {
    docThang: 'SELECT khoi, thang, van_tay FROM van_tay_thang WHERE day_chuyen = ?1',
    /* Dấu từng ngày của các (khối, tháng) cần. ?2 = [[khối, 'YYYY-MM'], ...] —
       mỗi cặp một khoảng theo khoá chính, không quét cả bảng */
    docNgayCuaThang: `SELECT v.khoi, v.ngay, v.van_tay FROM json_each(?2) AS p
        JOIN van_tay_ngay AS v ON v.day_chuyen = ?1 AND v.khoi = json_extract(p.value, '$[0]')
         AND v.ngay BETWEEN json_extract(p.value, '$[1]') || '-01' AND json_extract(p.value, '$[1]') || '-31'`,
    /* Khối-ngày đã nạp Excel trong số khối-ngày của lượt này. ?2 = ['QTK|2026-10-01', ...] */
    docNgayNap: `SELECT khoi, ngay FROM ngay_nap WHERE day_chuyen = ?1
        AND (khoi || '|' || ngay) IN (SELECT value FROM json_each(?2))`,
    /* ?2 = [[khối, ngày, dấu], ...] */
    ghiNgay: `INSERT INTO van_tay_ngay (day_chuyen, khoi, ngay, van_tay)
        SELECT ?1, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]')
        FROM json_each(?2) WHERE true
        ON CONFLICT (day_chuyen, khoi, ngay) DO UPDATE SET van_tay = excluded.van_tay
        WHERE van_tay_ngay.van_tay IS NOT excluded.van_tay`,
    /* ?2 = ['QTK|2026-10-01', ...] */
    xoaNgay: `DELETE FROM van_tay_ngay WHERE day_chuyen = ?1
        AND (khoi || '|' || ngay) IN (SELECT value FROM json_each(?2))`,
    /* ?2 = [[khối, tháng, dấu], ...]  ?3 = lúc */
    ghiThang: `INSERT INTO van_tay_thang (day_chuyen, khoi, thang, van_tay, luc)
        SELECT ?1, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?3
        FROM json_each(?2) WHERE true
        ON CONFLICT (day_chuyen, khoi, thang) DO UPDATE SET van_tay = excluded.van_tay, luc = excluded.luc`,
    /* ?2 = ['QTK|2026-10', ...] */
    xoaThang: `DELETE FROM van_tay_thang WHERE day_chuyen = ?1
        AND (khoi || '|' || thang) IN (SELECT value FROM json_each(?2))`,
    nhatKy: `INSERT INTO nhat_ky_nap (luc, nguon, tuyen, so_gia_tri, ghi_chu) VALUES (?1, 'khoi-ngay', ?2, ?3, ?4)`,
};

/* =============================================================================
 * BƯỚC 1 — SO SÁNH
 * ===========================================================================*/

/** j = { buoc: 'so-sanh', khoi: [tên khối có trong sheet], thang: { 'QTK|2026-10': dấu, ... },
 *        nhan_su: dấu | null }
 *  Ra: { khac: { 'QTK|2026-10': { '2026-10-01': dấu máy chủ, ... }, ... },
 *        nhan_su_khac: true/false, so_thang: số dấu đã so } */
export async function soSanhKhoiNgay(db, dc, j) {
    if (!laDoiTuong(j.thang)) throw new LoiNap('Thiếu "thang" (dấu từng khối-tháng)');
    const khoaGui = Object.keys(j.thang);
    if (khoaGui.length > GIOI_HAN_KN.thang) throw new LoiNap('Quá ' + GIOI_HAN_KN.thang + ' dấu khối-tháng');
    for (const k of khoaGui) {
        const i = k.lastIndexOf('|');
        if (i <= 0 || !RE_THANG.test(k.slice(i + 1)) || typeof j.thang[k] !== 'string') {
            throw new LoiNap('Dấu khối-tháng sai dạng: "' + String(k).slice(0, 80) + '"');
        }
    }
    const khoiCoMat = new Set(Array.isArray(j.khoi) ? j.khoi.filter(k => typeof k === 'string') : []);

    const { results } = await db.prepare(SQL.docThang).bind(dc).all();
    const mayChu = new Map();
    let dauNhanSu = null;
    for (const x of results || []) {
        if (x.khoi === KHOI_NHAN_SU) dauNhanSu = x.van_tay;
        else mayChu.set(x.khoi + '|' + x.thang, x.van_tay);
    }
    const lech = [];
    for (const k of khoaGui) if (mayChu.get(k) !== j.thang[k]) lech.push(k);
    /* Tháng máy chủ có mà sheet không còn — chỉ xét khối VẪN có trong sheet (khối
       vắng hẳn thì giữ lịch sử, xem đầu file) */
    for (const k of mayChu.keys()) {
        if (j.thang[k] === undefined && khoiCoMat.has(k.slice(0, k.lastIndexOf('|')))) lech.push(k);
    }

    const khac = {};
    for (const k of lech) khac[k] = {};
    if (lech.length) {
        const cap = lech.map(k => { const i = k.lastIndexOf('|'); return [k.slice(0, i), k.slice(i + 1)]; });
        const { results: ngay } = await db.prepare(SQL.docNgayCuaThang).bind(dc, JSON.stringify(cap)).all();
        for (const x of ngay || []) {
            const k = x.khoi + '|' + x.ngay.slice(0, 7);
            if (khac[k]) khac[k][x.ngay] = x.van_tay;
        }
    }
    return { khac: khac, nhan_su_khac: (j.nhan_su || null) !== dauNhanSu, so_thang: khoaGui.length };
}

/* =============================================================================
 * BƯỚC 2 — GHI
 * ===========================================================================*/

/** Kiểm gói ghi. Sai ở đâu -> LoiNap nói rõ. Ra danh sách phần đã làm gọn:
 *  [{ khoi, cot, goiY, ngay: Map<ngày, dấu|''>, thang: Map<tháng, dấu|''>, hang }] */
function kiemGhi(j, homNay) {
    const phan = Array.isArray(j.phan) ? j.phan : [];
    if (phan.length > GIOI_HAN_KN.phan) throw new LoiNap('Quá ' + GIOI_HAN_KN.phan + ' phần mỗi lượt');
    const ngayToiDa = congNgay(homNay, GIOI_HAN_KN.ngayToi);
    let soO = 0;
    const daGap = new Set();
    const ra = phan.map(function (p, i) {
        const ten = 'Phần ' + (i + 1) + (p && typeof p.khoi === 'string' ? ' (' + p.khoi + ')' : '');
        if (!p || typeof p.khoi !== 'string' || !p.khoi || p.khoi.length > 60) throw new LoiNap(ten + ': thiếu tên khối');
        if (!Array.isArray(p.cot) || p.cot.length < 2 || p.cot.length > GIOI_HAN_KN.cot || p.cot.some(c => typeof c !== 'string')) {
            throw new LoiNap(ten + ': "cot" phải là 2..' + GIOI_HAN_KN.cot + ' tên cột');
        }
        /* Các cột phải là ĐÚNG một khối, tên khối = p.khoi, không lẫn cột khác */
        const tk = tachKhoi(p.cot);
        if (tk.khoi.length !== 1 || tk.khoi[0].ten !== p.khoi || tk.nhanSu.length || tk.boQua.length
            || tk.khoi[0].cot.length !== p.cot.length - 2) {
            throw new LoiNap(ten + ': các cột gửi lên không phải đúng một khối "' + p.khoi + '"');
        }
        if (p.goi_y !== undefined && !laDoiTuong(p.goi_y)) throw new LoiNap(ten + ': "goi_y" sai dạng');
        const goiY = {};
        for (const [c, g] of Object.entries(p.goi_y || {})) {
            if (g !== ',' && g !== '.' && g !== null) throw new LoiNap(ten + ': gợi ý dấu thập phân của "' + c + '" sai');
            goiY[c] = g;
        }
        if (!laDoiTuong(p.ngay) || !laDoiTuong(p.thang)) throw new LoiNap(ten + ': thiếu "ngay" / "thang"');
        const ngay = new Map(), thang = new Map();
        for (const [t, v] of Object.entries(p.thang)) {
            if (!RE_THANG.test(t) || typeof v !== 'string') throw new LoiNap(ten + ': tháng "' + t + '" sai dạng');
            thang.set(t, v);
        }
        for (const [d, v] of Object.entries(p.ngay)) {
            if (!ngayHopLe(d) || d < NGAY_SOM_NHAT || d > ngayToiDa || typeof v !== 'string' || v.length > 64) {
                throw new LoiNap(ten + ': ngày "' + d + '" sai dạng hoặc ngoài khoảng ' + NGAY_SOM_NHAT + ' → ' + ngayToiDa);
            }
            if (!thang.has(d.slice(0, 7))) throw new LoiNap(ten + ': ngày ' + d + ' không có dấu tháng ' + d.slice(0, 7));
            if (daGap.has(p.khoi + '|' + d)) throw new LoiNap(ten + ': khối-ngày ' + p.khoi + ' ' + d + ' có ở hai phần');
            daGap.add(p.khoi + '|' + d);
            ngay.set(d, v);
        }
        if (!ngay.size && !thang.size) throw new LoiNap(ten + ': không có khối-ngày nào');
        if (!Array.isArray(p.hang) || p.hang.length > GIOI_HAN_KN.hang) throw new LoiNap(ten + ': "hang" sai dạng');
        for (const h of p.hang) {
            if (!Array.isArray(h) || h.length !== p.cot.length) throw new LoiNap(ten + ': mỗi hàng phải có đúng ' + p.cot.length + ' ô');
            for (const v of h) {
                if (v === null || v === '') continue;
                if (typeof v !== 'string' && typeof v !== 'number') throw new LoiNap(ten + ': ô phải là chữ hoặc số');
                soO++;
            }
        }
        if (soO > GIOI_HAN_KN.o) throw new LoiNap('Quá ' + GIOI_HAN_KN.o + ' ô mỗi lượt — chia nhỏ hơn');
        return { khoi: p.khoi, cot: p.cot, goiY: goiY, ngay: ngay, thang: thang, hang: p.hang };
    });
    let nhanSu = null;
    if (j.nhan_su !== undefined && j.nhan_su !== null) {
        const n = j.nhan_su;
        if (!laDoiTuong(n) || !Array.isArray(n.cot) || !Array.isArray(n.hang) || typeof n.van_tay !== 'string' || n.hang.length > GIOI_HAN_KN.hang) {
            throw new LoiNap('"nhan_su" sai dạng');
        }
        const tk = tachKhoi(n.cot);
        if (tk.khoi.length || tk.nhanSu.length !== n.cot.length) throw new LoiNap('"nhan_su": chỉ được gồm cột nhân sự');
        for (const h of n.hang) if (!Array.isArray(h) || h.length !== n.cot.length) throw new LoiNap('"nhan_su": hàng sai số ô');
        nhanSu = n;
    }
    if (!ra.length && !nhanSu) throw new LoiNap('Gói ghi rỗng');
    return { phan: ra, nhanSu: nhanSu };
}

/** Mảng ô của một hàng -> đối tượng { tên cột: ô } như Apps Script vẫn gửi ở đường cũ */
function thanhDoiTuong(cot, h) {
    const o = {};
    for (let i = 0; i < cot.length; i++) o[cot[i]] = h[i] === null || h[i] === undefined ? '' : h[i];
    return o;
}

/** j = { buoc: 'ghi', phan: [{ khoi, cot, goi_y, ngay: {ngày: dấu|''}, thang: {tháng: dấu|''},
 *        hang: [[ô...]] }], nhan_su: { cot, hang, van_tay } | undefined }
 *  Ra: { so_o, so_ghi, so_goi, so_khoi_ngay, bo_excel } */
export async function ghiKhoiNgay(db, dc, tuyen, j, luc) {
    const homNay = ngayVN(luc);
    const { phan, nhanSu } = kiemGhi(j, homNay);

    /* Khối-ngày đã nạp Excel: số sheet bị bỏ (Excel giữ), dấu vẫn ghi */
    const tatCaKN = [];
    for (const p of phan) for (const d of p.ngay.keys()) tatCaKN.push(p.khoi + '|' + d);
    const daNap = new Set();
    if (tatCaKN.length) {
        const { results } = await db.prepare(SQL.docNgayNap).bind(dc, JSON.stringify(tatCaKN)).all();
        for (const x of results || []) daNap.add(x.khoi + '|' + x.ngay);
    }

    const o = [], khoiNgay = [], vtNgay = [], vtNgayXoa = [], vtThang = [], vtThangXoa = [];
    const chiTieu = new Map(), thangCham = new Set(), khoiCham = new Set();
    for (const p of phan) {
        let soLieu = [];
        if (p.hang.length) {
            const r = chuanHoaDayChuyen(dc, p.hang.map(h => thanhDoiTuong(p.cot, h)), luc, { goiYCot: p.goiY });
            for (const c of r.chiTieu.values()) {
                if (c.khoi !== p.khoi) throw new LoiNap(p.khoi + ': chuẩn hoá ra khối lạ "' + c.khoi + '"');
                chiTieu.set(c.ma, c);
            }
            soLieu = r.soLieu;
        }
        /* Ô phải rơi đúng vào ngày đã khai (không phải ngày bị xoá) */
        for (const s of soLieu) {
            const v = p.ngay.get(s.ngay);
            if (v === undefined || v === '') {
                throw new LoiNap(p.khoi + ': có hàng thuộc ngày ' + s.ngay + ' nhưng ngày này không khai trong "ngay"'
                    + ' — Apps Script và máy chủ chia ngày khác nhau, dừng để kiểm tra');
            }
        }
        for (const [d, v] of p.ngay) {
            const k = p.khoi + '|' + d;
            if (v) vtNgay.push([p.khoi, d, v]); else vtNgayXoa.push(k);
            if (daNap.has(k)) continue;                    /* Excel giữ khối-ngày này */
            khoiNgay.push([dc, p.khoi, d]);
            thangCham.add(d.slice(0, 7));
            khoiCham.add(p.khoi);
        }
        for (const s of soLieu) {
            if (daNap.has(p.khoi + '|' + s.ngay)) continue;
            o.push([s.chi_tieu, dc, s.ngay, s.stt, s.ca, s.kip, s.gia_tri, s.chu]);
        }
        for (const [t, v] of p.thang) {
            if (v) vtThang.push([p.khoi, t, v]); else vtThangXoa.push(p.khoi + '|' + t);
        }
    }

    const oJson = JSON.stringify(o), knJson = JSON.stringify(khoiNgay);
    const cau = [];
    if (chiTieu.size) {
        cau.push(db.prepare(SQL_DONG_BO.chiTieu).bind(JSON.stringify([...chiTieu.values()].map(c => [c.ma, c.khoi, c.cot_sheet, c.loai]))));
    }
    const iGhi = cau.length;
    cau.push(db.prepare(SQL_NAP.soLieu).bind(oJson, luc));
    cau.push(db.prepare(SQL_NAP.xoaThua).bind(knJson, oJson));

    /* Nhân sự: danh sách rỗng thì KHÔNG xoá (giống đồng bộ cũ: nhiều khả năng cột
       bị đổi tên chứ không phải cả kíp nghỉ hết) */
    let soNhanSu = 0;
    if (nhanSu) {
        const r = chuanHoaDayChuyen(dc, nhanSu.hang.map(h => thanhDoiTuong(nhanSu.cot, h)), luc);
        soNhanSu = r.nhanSu.length;
        if (soNhanSu) {
            const ns = JSON.stringify(r.nhanSu.map(x => [x.kip, x.stt, x.nhan_vien, x.vi_tri, x.trang_thai]));
            cau.push(db.prepare(SQL_DONG_BO.nhanSu).bind(ns, dc), db.prepare(SQL_DONG_BO.xoaNhanSuThua).bind(ns, dc));
            thangCham.add('nhan-su');
        }
        vtThang.push([KHOI_NHAN_SU, '-', nhanSu.van_tay]);
    }
    const iDau = cau.length;
    if (vtNgay.length) cau.push(db.prepare(SQL.ghiNgay).bind(dc, JSON.stringify(vtNgay)));
    if (vtNgayXoa.length) cau.push(db.prepare(SQL.xoaNgay).bind(dc, JSON.stringify(vtNgayXoa)));
    if (vtThang.length) cau.push(db.prepare(SQL.ghiThang).bind(dc, JSON.stringify(vtThang), luc));
    if (vtThangXoa.length) cau.push(db.prepare(SQL.xoaThang).bind(dc, JSON.stringify(vtThangXoa)));
    if (khoiCham.size) {
        const kJson = JSON.stringify([...khoiCham].map(k => [dc, k]));
        cau.push(db.prepare(SQL_NAP.xoaMoc).bind(kJson), db.prepare(SQL_NAP.mocLai).bind(kJson, homNay));
    }
    const ghiChu = khoiNgay.length + ' khối-ngày' + (daNap.size ? ', bỏ ' + daNap.size + ' khối-ngày đã nạp Excel' : '')
        + (nhanSu ? ', ' + soNhanSu + ' nhân sự' : '');
    cau.push(db.prepare(SQL_DONG_BO.ghiDongBo).bind(tuyenKhoiNgay(tuyen), null, luc, o.length, 0),
             db.prepare(SQL.nhatKy).bind(luc, tuyen, o.length, ghiChu));
    const kq = await db.batch(cau);
    let soGhi = soDoi(kq[iGhi]) + soDoi(kq[iGhi + 1]);
    for (let i = iGhi + 2; i < iDau; i++) soGhi += soDoi(kq[i]);            /* nhân sự */
    await db.prepare(SQL_DONG_BO.ghiSoGhi).bind(tuyenKhoiNgay(tuyen), soGhi).run();

    const soGoi = thangCham.size ? await dungLaiGoi(db, new Map([[tuyen, thangCham]]), luc) : 0;
    return { so_o: o.length, so_ghi: soGhi, so_goi: soGoi, so_khoi_ngay: khoiNgay.length, bo_excel: daNap.size };
}
