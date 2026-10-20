/* =============================================================================
 * js/nap/nap_lieu.js — ĐIỀU KHIỂN TRANG NẠP SỐ LIỆU EXCEL (nap-lieu.html)
 * =============================================================================
 * LUỒNG
 *   mở trang  -> tải danh mục khối/cột từ /api/v2 (taiDanhMuc)
 *   bước 1    khoá nạp + tên người nạp (nhớ trong trình duyệt nếu muốn)
 *   bước 2    chọn dây chuyền + khối -> "Tải file mẫu" (taiMau, js/nap/ghi_xlsx.js)
 *   bước 3    chọn file -> đọc (js/nap/doc_xlsx.js) -> nhận dạng + đổi thành các
 *             phần (js/nap/mau_nap.js; phiếu BK ra cả 7 khối một lần) -> so với số
 *             đang có trên dashboard (boSungSoDangCo): CHỈ GỬI ngày chưa nạp hoặc
 *             khác số đang có (locNgayDaCo) -> xem trước -> "Nạp lên" (napLen)
 *   bước 4    danh sách các lần nạp + nút Huỷ (taiDanhSach, huy)
 *
 * MÁY CHỦ: /api/nap (functions/api/[[route]].js -> db/nap-excel.mjs). Mọi lượt gửi
 * kèm header x-nap-key. File lớn hơn GIOI_HAN_O ô được chia thành nhiều lần nạp,
 * mỗi lần trọn một số NGÀY (một khối-ngày không bao giờ bị cắt đôi).
 *
 * AN TOÀN KHI HIỆN DỮ LIỆU: tên file, tên trang, ô chữ đều do người khác soạn —
 * luôn đi qua esc() trước khi chèn vào HTML.
 * ===========================================================================*/

import { docXlsx } from './doc_xlsx.js';
import { taoXlsx, tenTrangHopLe } from './ghi_xlsx.js';
import { CAC_MAU, laCotKip, ngayVN } from './mau_nap.js';

/* Phải bằng GIOI_HAN.o trong db/nap-excel.mjs (máy chủ từ chối lượt lớn hơn) */
const GIOI_HAN_O = 10000;
const KHOA_LUU = 'xtk2-nap-khoa', NGUOI_LUU = 'xtk2-nap-nguoi';

const $ = function (id) { return document.getElementById(id); };
const tt = {
    danhMuc: new Map(),          /* khối -> [tên cột] (không gồm Ca/kíp) */
    moc: { TK3: {}, TK4: {} },   /* khối -> ngày cuối có số (muc_luc.khoi của /api/v2) */
    ketQua: [],                  /* kết quả đọc từng trang tính: { trang, mau, phan, canhBao, loi } */
    tenFile: '',
    file: null,                  /* file đang chọn (cả khi kéo thả) — để đọc lại khi đổi bước 2 */
    lanDoc: 0,                   /* số lượt đọc file; lượt cũ xong muộn thì bỏ kết quả */
    chuaLoc: '',                 /* khác '' = chưa biết ngày nào đã nạp (lý do) -> chưa cho nạp */
};

/* ---------------------------------------------------------------------------
 * TIỆN ÍCH
 * ------------------------------------------------------------------------- */

/** Thoát ký tự HTML — mọi chữ lấy từ file / máy chủ đều phải qua đây. */
function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/** Ghi dòng trạng thái cạnh nút. loai: 'ok' | 'loi' | 'cho' | '' */
function baoTT(id, chu, loai) { const el = $(id); el.textContent = chu || ''; el.className = 'tt' + (loai ? ' ' + loai : ''); }

/** Số kiểu Việt Nam: 12345 -> '12.345'. */
function soVN(n) { return Number(n).toLocaleString('vi-VN'); }

/** Hôm nay theo giờ Việt Nam -> 'YYYY-MM-DD'. */
function homNayVN() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }

/* localStorage / sessionStorage có thể bị chặn (chế độ riêng tư...) -> bọc try */
function docLuu(kho, k) { try { return window[kho].getItem(k) || ''; } catch (e) { return ''; } }
function ghiLuu(kho, k, v) { try { if (v) window[kho].setItem(k, v); else window[kho].removeItem(k); } catch (e) { /* bỏ qua */ } }

/** Gọi /api/nap... kèm khoá. Ra { ok, status, j } — không ném lỗi mạng ra ngoài. */
async function goiApi(duong, phuongThuc, body) {
    const khoa = $('khoa').value.trim();
    if (!khoa) return { ok: false, status: 0, j: { message: 'Chưa nhập khoá nạp (bước 1)' } };
    try {
        const r = await fetch(duong, {
            method: phuongThuc,
            headers: Object.assign({ 'x-nap-key': khoa }, body ? { 'content-type': 'application/json' } : {}),
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
        });
        let j = null;
        try { j = await r.json(); } catch (e) { j = { message: 'Máy chủ trả HTTP ' + r.status }; }
        if (r.status === 401) j.message = 'Sai khoá nạp';
        return { ok: r.ok, status: r.status, j: j || {} };
    } catch (e) {
        return { ok: false, status: 0, j: { message: 'Không gửi được (mất mạng?): ' + (e && e.message) } };
    }
}

/* ---------------------------------------------------------------------------
 * BƯỚC 1 — KHOÁ
 * ------------------------------------------------------------------------- */

/** Khoá chỉ nhớ lâu (localStorage) khi người dùng tích "Nhớ khoá trên máy này";
 *  không thì chỉ nhớ tới khi đóng tab (sessionStorage). */
function luuKhoa() {
    const khoa = $('khoa').value.trim(), nho = $('nho').checked;
    ghiLuu('localStorage', KHOA_LUU, nho ? khoa : '');
    ghiLuu('sessionStorage', KHOA_LUU, khoa);
    ghiLuu('localStorage', NGUOI_LUU, $('nguoi').value.trim());
}

async function kiemKhoa() {
    luuKhoa();
    baoTT('tt-khoa', 'Đang kiểm…', 'cho');
    const r = await goiApi('/api/nap', 'GET');
    if (r.ok) {
        baoTT('tt-khoa', 'Khoá đúng', 'ok'); veDanhSach(r.j.lan_nap || []); baoTT('tt-ds', '');
        /* Đã chọn file mà chưa lọc được ngày đã nạp (lúc đó chưa có khoá) -> đọc lại */
        if (tt.file && tt.chuaLoc) chonFile(tt.file);
    }
    else baoTT('tt-khoa', r.j.message || 'Lỗi', 'loi');
}

/* ---------------------------------------------------------------------------
 * BƯỚC 2 — DANH MỤC KHỐI + FILE MẪU
 * ------------------------------------------------------------------------- */

/** Danh mục khối/cột và ngày cuối có số của từng khối, lấy từ /api/v2 với khoảng
 *  tháng rỗng (không kèm số liệu — chỉ ~10 KB). */
async function taiDanhMuc() {
    try {
        const [a, b] = await Promise.all(['tk3', 'tk4'].map(async function (t) {
            const r = await fetch('/api/v2/' + t + '?tu=9999-12&den=9999-12');
            if (!r.ok) throw new Error('/api/v2/' + t + ' trả HTTP ' + r.status);
            return r.json();
        }));
        tt.danhMuc.clear();
        for (const [khoi, cot] of a.cot || []) {
            if (laCotKip(cot)) continue;
            if (!tt.danhMuc.has(khoi)) tt.danhMuc.set(khoi, []);
            tt.danhMuc.get(khoi).push(cot);
        }
        tt.moc.TK3 = (a.muc_luc && a.muc_luc.khoi) || {};
        tt.moc.TK4 = (b.muc_luc && b.muc_luc.khoi) || {};
        veChonKhoi();
        baoTT('tt-danh-muc', '');
    } catch (e) {
        baoTT('tt-danh-muc', 'Không tải được danh mục khối: ' + e.message + ' — tải lại trang sau ít phút', 'loi');
        $('khoi').innerHTML = '<option>(không có danh mục)</option>';
    }
}

function veChonKhoi() {
    const dc = $('dc').value, giu = $('khoi').value;
    const cacKhoi = [...tt.danhMuc.keys()].sort(function (x, y) { return x.localeCompare(y, 'vi'); });
    $('khoi').innerHTML = cacKhoi.map(function (k) {
        const moc = tt.moc[dc][k];
        return '<option value="' + esc(k) + '">' + esc(k) + (moc ? ' — có số tới ' + ngayVN(moc) : ' — chưa có số') + '</option>';
    }).join('');
    if (cacKhoi.indexOf(giu) >= 0) $('khoi').value = giu;
    $('khoi').disabled = !cacKhoi.length;
    $('tai-mau').disabled = !cacKhoi.length;
    veMoTaKhoi();
}

function veMoTaKhoi() {
    const cot = tt.danhMuc.get($('khoi').value) || [];
    $('mo-ta-khoi').textContent = cot.length ? 'Các cột của khối: ' + cot.join(' · ') : '';
}

/* Nội dung trang "Hướng dẫn" trong file mẫu */
const HUONG_DAN = [
    'CÁCH ĐIỀN FILE MẪU NẠP SỐ LIỆU — X.TK2',
    '1. Mỗi hàng là MỘT mẫu (một lần lấy mẫu / một ca). Thứ tự hàng trong một ngày = thứ tự điểm trên biểu đồ.',
    '2. Cột Ngày: ngày lấy mẫu, dạng ngày/tháng/năm. Nhiều mẫu cùng ngày: ghi ngày ở hàng đầu, các hàng sau để trống ngày cũng được.',
    '3. Cột Kíp: A, B hoặc C.',
    '4. Các cột còn lại: GIỮ NGUYÊN tên cột như mẫu (trang nạp dò theo tên). Ô không có số thì để trống. Dấu thập phân phẩy hay chấm đều được.',
    '5. Tên trang tính (vd "TK3 QTK") cho biết dây chuyền và khối — đừng đổi. Muốn nạp nhiều khối một lần: thêm trang, đặt tên đúng kiểu đó, tiêu đề lấy từ file mẫu của khối đó.',
    '6. Nạp một khối cho một ngày = THAY TOÀN BỘ số liệu của khối đó trong ngày đó (cột nào trống thì ngày đó trống). Từ đó Google Sheet không ghi đè khối-ngày này nữa.',
    '7. Nạp nhầm: vào trang nạp, mục "Các lần nạp gần đây", bấm Huỷ ở lần nạp đó.',
    'Trang Hướng dẫn này được bỏ qua khi nạp.',
];

function taiMau() {
    const dc = $('dc').value, khoi = $('khoi').value, cot = tt.danhMuc.get(khoi) || [];
    const b = taoXlsx([
        { ten: tenTrangHopLe(dc + ' ' + khoi), hang: [['Ngày', 'Kíp'].concat(cot)], tieuDe: true, cotNgay: 0, cotKip: 1,
          rong: [12, 6].concat(cot.map(function (c) { return Math.max(9, Math.min(32, c.length + 3)); })) },
        { ten: 'Hướng dẫn', hang: HUONG_DAN.map(function (s) { return [s]; }), rong: [110], gopChu: true },
    ]);
    const url = URL.createObjectURL(new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau-nap ' + tenTrangHopLe(dc + ' ' + khoi) + '.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

/* ---------------------------------------------------------------------------
 * BƯỚC 3 — ĐỌC FILE, XEM TRƯỚC, NẠP
 * ------------------------------------------------------------------------- */

/** Số ô một phần sẽ gửi: mỗi hàng 1 ô kíp + các ô có giá trị (đếm như máy chủ). */
function demO(phan) {
    let n = 0;
    for (const h of phan.hang) { n++; for (const v of h[2]) if (v !== null) n++; }
    return n;
}

async function chonFile(f) {
    /* Hai lượt đọc có thể chạy chồng nhau (chọn file mới trong khi đổi khối ở
       bước 2 làm đọc lại file cũ): chỉ lượt MỚI NHẤT được ghi kết quả */
    const lan = ++tt.lanDoc;
    tt.ketQua = [];
    $('nap').disabled = true;
    $('xem-truoc').innerHTML = '';
    baoTT('tt-nap', '');
    if (!f) return;
    tt.file = f;
    tt.tenFile = f.name;
    $('ten-file').textContent = f.name + ' (' + Math.round(f.size / 1024) + ' KB)';
    if (!/\.xlsx$/i.test(f.name)) { baoTT('tt-nap', 'Chỉ nhận file .xlsx. File .xls: mở bằng Excel rồi Lưu thành .xlsx', 'loi'); return; }
    if (f.size > 20 * 1024 * 1024) { baoTT('tt-nap', 'File quá 20 MB', 'loi'); return; }
    if (!tt.danhMuc.size) { baoTT('tt-nap', 'Chưa có danh mục khối (bước 2) — tải lại trang', 'loi'); return; }
    baoTT('tt-nap', 'Đang đọc file…', 'cho');
    let cacTrang;
    try { cacTrang = await docXlsx(await f.arrayBuffer()); }
    catch (e) { if (lan === tt.lanDoc) baoTT('tt-nap', 'Không đọc được file: ' + e.message, 'loi'); return; }
    if (lan !== tt.lanDoc) return;

    const ctx = { danhMuc: tt.danhMuc, chon: { dc: $('dc').value, khoi: $('khoi').value }, homNay: homNayVN() };
    const boQua = [];
    for (const trang of cacTrang) {
        if (trang.an) { boQua.push(trang.ten + ' (trang ẩn)'); continue; }
        const mau = CAC_MAU.find(function (m) { return m.nhanDien(trang); });
        if (!mau) { boQua.push(trang.ten); continue; }
        const kq = mau.doc(trang, ctx);
        /* Một trang có thể ra nhiều khối (phiếu BK ra cả 7 khối chất lượng) */
        for (const k of Array.isArray(kq) ? kq : [kq]) {
            k.trang = trang.ten; k.mau = mau.id;
            if (!k.ghiChu) k.ghiChu = [];
            tt.ketQua.push(k);
        }
    }
    /* Cùng dây chuyền + khối ở hai trang -> lỗi (máy chủ cũng từ chối) */
    const daGap = new Map();
    for (const k of tt.ketQua) {
        if (!k.phan) continue;
        const khoa = k.phan.day_chuyen + ' — ' + k.phan.khoi;
        if (daGap.has(khoa)) k.loi.push(khoa + ' đã có ở trang "' + daGap.get(khoa) + '" — gộp hai trang lại');
        else daGap.set(khoa, k.trang);
    }
    tt.chuaLoc = '';
    if (tt.ketQua.some(function (k) { return k.phan; })) {
        baoTT('tt-nap', 'Đang so với số đang có trên dashboard…', 'cho');
        await boSungSoDangCo();
        if (lan !== tt.lanDoc) return;
    }
    /* Ngày SẮP GỬI trùng với số đang có -> nói rõ số đó sẽ bị THAY */
    for (const k of tt.ketQua) {
        if (!k.phan || !k.phan.hang.length) continue;
        const moc = tt.moc[k.phan.day_chuyen][k.phan.khoi];
        const dau = k.phan.hang.reduce(function (a, h) { return h[0] < a ? h[0] : a; }, '9999');
        if (moc && dau <= moc) {
            k.canhBao.unshift('Khối này đã có số tới ' + ngayVN(moc) + ' — các ngày gửi lên từ ' + ngayVN(dau)
                + ' trở đi mà đã có số sẽ bị THAY bằng số trong file');
        }
    }
    veXemTruoc(boQua);
}

/** 'YYYY-MM' lùi n tháng. */
function luiThang(thang, n) {
    let y = Number(thang.slice(0, 4)), m = Number(thang.slice(5, 7)) - n;
    while (m < 1) { m += 12; y--; }
    return y + '-' + String(m).padStart(2, '0');
}

/** Số đang có trên dashboard của một dây chuyền, các tháng tu..den (cùng /api/v2
 *  mà dashboard đọc, dạng gói: xem đầu db/goi-v2.mjs). Ra:
 *    soCu      Map 'khối|cột' -> Map(ngày -> { stt, v }): giá trị ở hàng đầu tiên có
 *              số của ngày đó (điền cột keThua, báo cột sắp bị xoá)
 *    khoiNgay  Map 'khối|ngày' -> Map(stt -> { kip, gt: Map(cột -> giá trị) }): TRỌN
 *              nội dung từng khối-ngày, để so với file (locNgayDaCo) */
async function taiSoDangCo(dc, tu, den) {
    const r = await fetch('/api/v2/' + dc.toLowerCase() + '?tu=' + tu + '&den=' + den);
    if (!r.ok) throw new Error('/api/v2 trả HTTP ' + r.status);
    const j = await r.json();
    const soCu = new Map(), khoiNgay = new Map();
    for (const thang of Object.keys(j.thang || {})) {
        if (!/^\d{4}-\d{2}$/.test(thang)) continue;                  /* gói "nhan-su" */
        for (const o of j.thang[thang]) {                            /* [cột, ngày, stt, kíp, giá trị] */
            const c = (j.cot || [])[o[0]], v = o[4];
            if (!c) continue;
            const ngay = thang + '-' + String(o[1]).padStart(2, '0');
            const kn = c[0] + '|' + ngay;
            if (!khoiNgay.has(kn)) khoiNgay.set(kn, new Map());
            const hang = khoiNgay.get(kn);
            if (!hang.has(o[2])) hang.set(o[2], { kip: o[3], gt: new Map() });
            if (v === null || v === undefined || v === '') continue;
            if (!laCotKip(c[1])) hang.get(o[2]).gt.set(c[1], v);
            const khoa = c[0] + '|' + c[1];
            if (!soCu.has(khoa)) soCu.set(khoa, new Map());
            const m = soCu.get(khoa), cu = m.get(ngay);
            if (!cu || o[2] < cu.stt) m.set(ngay, { stt: o[2], v: v });
        }
    }
    return { soCu: soCu, khoiNgay: khoiNgay };
}

/** Hai giá trị ô có như nhau không. Số so có dung sai: D1 trả số qua JSON với 15
 *  chữ số có nghĩa, số trung bình tính ở trình duyệt có thể dài hơn. */
function cungGiaTri(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    return String(a) === String(b);
}

/** Các hàng của MỘT khối-ngày trong file (đúng thứ tự sẽ gửi) có y hệt số đang có
 *  trên dashboard không: cùng số hàng; hàng thứ i có stt = i (như máy chủ đánh),
 *  cùng kíp; cùng giá trị ở từng cột gửi lên; và dashboard không có ô nào ở cột
 *  file không gửi (nạp sẽ xoá ô đó -> phải gửi). hangD1: Map(stt -> {kip, gt}) | undefined. */
function giongTrenDashboard(hangFile, hangD1, cot) {
    const d1 = hangD1 ? [...hangD1.entries()].sort(function (x, y) { return x[0] - y[0]; }) : [];
    if (d1.length !== hangFile.length) return false;
    for (let i = 0; i < d1.length; i++) {
        const stt = d1[i][0], h = d1[i][1], f = hangFile[i];
        if (stt !== i + 1 || h.kip !== f[1]) return false;
        let soO = 0;
        for (let j = 0; j < cot.length; j++) {
            const b = h.gt.has(cot[j]) ? h.gt.get(cot[j]) : null;
            if (!cungGiaTri(f[2][j], b)) return false;
            if (b !== null) soO++;
        }
        if (h.gt.size !== soO) return false;
    }
    return true;
}

/** BỎ, không gửi lại, những khối-ngày của phần p đã nạp từ trước (daNap có
 *  'khối|ngày') mà số trên dashboard y hệt file — phiếu BK của ngày cũ không bao
 *  giờ đổi, gửi lại chỉ phí dòng ghi D1. Ngày chưa nạp (kể cả ngày đang là số
 *  Google Sheet), ngày đã nạp mà khác (vd lần trước xuất phiếu giữa ca, nay đủ ca)
 *  thì vẫn gửi. Sửa p.hang / p.ngay_trong tại chỗ. Ra: các ngày đã bỏ (tăng dần). */
function locNgayDaCo(p, khoiNgay, daNap) {
    const theoNgay = new Map();
    for (const h of p.hang) {
        if (h[2].every(function (v) { return v === null; })) continue;   /* máy chủ cũng bỏ hàng trống */
        if (!theoNgay.has(h[0])) theoNgay.set(h[0], []);
        theoNgay.get(h[0]).push(h);
    }
    const bo = new Set();
    for (const d of new Set([...theoNgay.keys()].concat(p.ngay_trong || []))) {
        const khoa = p.khoi + '|' + d;
        if (daNap.has(khoa) && giongTrenDashboard(theoNgay.get(d) || [], khoiNgay.get(khoa), p.cot)) bo.add(d);
    }
    if (bo.size) {
        p.hang = p.hang.filter(function (h) { return !bo.has(h[0]); });
        if (p.ngay_trong) p.ngay_trong = p.ngay_trong.filter(function (d) { return !bo.has(d); });
    }
    return [...bo].sort();
}

/** Các khối-ngày ĐÃ NẠP của dây chuyền dc trong khoảng [tu, den] (cần khoá nạp).
 *  Ra Set 'khối|ngày', hoặc ném Error kèm câu báo. */
async function taiDaNap(dc, tu, den) {
    const r = await goiApi('/api/nap/da-nap?dc=' + encodeURIComponent(dc) + '&tu=' + tu + '&den=' + den, 'GET');
    if (!r.ok) throw new Error(r.j.message || 'HTTP ' + r.status);
    return new Set((r.j.khoi_ngay || []).map(function (x) { return x[0] + '|' + x[1]; }));
}

/** So các phần sắp nạp với số ĐANG CÓ trên dashboard (mỗi dây chuyền tải một lần):
 *   1) cột phan.keThua (vd khoảng R2 cho phép — phiếu BK không có): điền giá trị
 *      đang có của chính ngày đó, ngày chưa có thì lấy của ngày gần nhất TRƯỚC đó.
 *      Không điền thì nạp xong dải R2 của các ngày đó biến mất (nạp = thay cả khối-ngày);
 *   2) bỏ những ngày đã nạp mà số y nguyên (locNgayDaCo) — chỉ gửi ngày mới / ngày
 *      thiếu. Không biết ngày nào đã nạp (chưa có khoá, lỗi mạng) thì tt.chuaLoc
 *      ghi lý do và trang KHÔNG cho nạp (tránh gửi lại cả file);
 *   3) cột của khối mà file không có nhưng đang có số ở các ngày sẽ gửi -> cảnh báo sẽ bị xoá. */
async function boSungSoDangCo() {
    const theoDc = new Map();
    for (const k of tt.ketQua) {
        if (!k.phan) continue;
        if (!theoDc.has(k.phan.day_chuyen)) theoDc.set(k.phan.day_chuyen, []);
        theoDc.get(k.phan.day_chuyen).push(k);
    }
    for (const [dc, ds] of theoDc) {
        let dau = '9999-12-31', cuoi = '0000-00-00';
        for (const k of ds) {
            for (const d of k.phan.hang.map(function (h) { return h[0]; }).concat(k.phan.ngay_trong || [])) {
                if (d < dau) dau = d;
                if (d > cuoi) cuoi = d;
            }
        }
        let soCu, khoiNgay;
        try { ({ soCu, khoiNgay } = await taiSoDangCo(dc, luiThang(dau.slice(0, 7), 3), cuoi.slice(0, 7))); }
        catch (e) {
            for (const k of ds) {
                if (k.phan.keThua) k.loi.push('Không tải được số đang có trên dashboard (' + e.message + ') để điền cột '
                    + k.phan.keThua.join(', ') + ' — chọn lại file để thử lại');
                else k.canhBao.push('Không tải được số đang có trên dashboard để so (' + e.message + ')');
            }
            tt.chuaLoc = 'Không tải được số đang có trên dashboard nên chưa biết ngày nào đã nạp — chọn lại file để thử lại';
            continue;
        }
        let daNap = null;
        if (!$('khoa').value.trim()) {
            tt.chuaLoc = 'Nhập khoá nạp ở bước 1 rồi bấm "Kiểm tra" — cần khoá để biết ngày nào đã nạp (trang tự đọc lại file)';
        } else {
            try { daNap = await taiDaNap(dc, dau, cuoi); }
            catch (e) { tt.chuaLoc = 'Không hỏi được máy chủ ngày nào đã nạp (' + e.message + ') — chọn lại file để thử lại'; }
        }
        for (const k of ds) {
            const p = k.phan;
            /* 1) keThua: điền số, nhớ ngày nào giữ / mượn / thiếu để ghi chú SAU khi lọc */
            const keThua = [];
            for (const c of p.keThua || []) {
                const j = p.cot.indexOf(c), m = soCu.get(p.khoi + '|' + c);
                const cacNgay = m ? [...m.keys()].sort() : [];
                const nguon = new Map();                        /* ngày -> ngày lấy số (null = thiếu) */
                for (const h of p.hang) {
                    if (h[2][j] !== null) continue;
                    let tu = null;
                    for (const d of cacNgay) { if (d <= h[0]) tu = d; else break; }
                    nguon.set(h[0], tu);
                    if (tu !== null) h[2][j] = m.get(tu).v;
                }
                keThua.push([c, nguon]);
            }
            /* 2) bỏ ngày đã nạp mà y nguyên */
            if (daNap) {
                const bo = locNgayDaCo(p, khoiNgay, daNap);
                if (bo.length) {
                    k.ghiChu.unshift('Không gửi lại ' + bo.length + ' ngày đã nạp trước đây (số trên dashboard y hệt file): '
                        + bo.map(function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7); }).join(', '));
                }
                p.daLoc = true;
            }
            const ngayNap = new Set(p.hang.map(function (h) { return h[0]; }));
            for (const [c, nguon] of keThua) {
                let giu = 0, soMuon = 0, thieu = 0;
                const muon = new Set();                         /* các ngày được mượn số */
                for (const [d, tu] of nguon) {
                    if (!ngayNap.has(d)) continue;
                    if (tu === null) thieu++;
                    else if (tu === d) giu++;
                    else { soMuon++; muon.add(tu); }
                }
                if (giu || soMuon) {
                    k.ghiChu.push(c + ' (file không có): ' + giu + ' ngày giữ số đang có trên dashboard'
                        + (soMuon ? ', ' + soMuon + ' ngày chưa có số lấy theo ngày ' + [...muon].sort().map(ngayVN).join(', ') : ''));
                }
                if (thieu) k.canhBao.push(c + ': ' + thieu + ' ngày không tìm được số nào trước đó — để trống');
            }
            const mat = [];
            for (const c of tt.danhMuc.get(p.khoi) || []) {
                const m = p.cot.indexOf(c) < 0 && soCu.get(p.khoi + '|' + c);
                if (!m) continue;
                let n = 0;
                for (const d of ngayNap) if (m.has(d)) n++;
                if (n) mat.push(c + ' (' + n + ' ngày)');
            }
            if (mat.length) k.canhBao.push('Ở các ngày nạp, số đang có của cột file không có sẽ bị XOÁ: ' + mat.join(', '));
            /* Ngày để trống (phan.ngay_trong) mà đang có số -> số đó sẽ mất hết */
            const xoaNgay = (p.ngay_trong || []).filter(function (d) {
                return (tt.danhMuc.get(p.khoi) || []).some(function (c) { const m = soCu.get(p.khoi + '|' + c); return m && m.has(d); });
            });
            if (xoaNgay.length) {
                k.canhBao.push(xoaNgay.length + ' ngày file không có mẫu nhưng dashboard đang có số (thường là số Google Sheet) — '
                    + 'nạp xong các ngày này TRỐNG: ' + xoaNgay.map(ngayVN).join(', '));
            }
        }
    }
}

/** Một ô trong bảng xem trước. */
function oBang(v) {
    if (v === null) return '<td class="trong">·</td>';
    if (typeof v === 'number') return '<td>' + esc(String(v).replace('.', ',')) + '</td>';
    return '<td class="chu">' + esc(v) + '</td>';
}

function veXemTruoc(boQua) {
    let html = '';
    if (!tt.ketQua.length) {
        html = '<div class="phan"><ul class="ds-bao loi"><li>Không nhận ra file: cần phiếu kết quả kiểm tra xuất từ BK, '
            + 'hoặc file mẫu ở bước 2 (hàng tiêu đề "Ngày" + "Kíp")' + (boQua.length ? ' — đã xem: ' + esc(boQua.join(', ')) : '') + '.</li></ul></div>';
    }
    let tongO = 0, coLoi = false;
    for (const k of tt.ketQua) {
        coLoi = coLoi || k.loi.length > 0;
        const p = k.phan;
        html += '<div class="phan"><div class="phan-dau"><h3>'
            + (p ? esc(p.day_chuyen + ' — ' + p.khoi) : k.chung ? 'Cả file' : 'Không nạp được') + ' <span class="nhan">trang "' + esc(k.trang) + '"</span></h3>';
        if (p) {
            const ngay = [...new Set(p.hang.map(function (h) { return h[0]; }))].sort();
            const soO = demO(p);
            tongO += soO;
            const soTrong = p.ngay_trong ? p.ngay_trong.length : 0;
            html += !ngay.length && !soTrong
                ? '<p>Không có gì mới để gửi — mọi ngày của khối này trong file đã có đủ trên dashboard</p>'
                : '<p>Sẽ gửi ' + (ngay.length ? ngay.length + ' ngày có số (' + ngayVN(ngay[0]) + ' → ' + ngayVN(ngay[ngay.length - 1]) + ')' : '')
                    + (soTrong ? (ngay.length ? ' + ' : '') + soTrong + ' ngày để trống' : '') + ' · '
                    + soVN(p.hang.length) + ' hàng · ' + soVN(soO) + ' ô · cột: ' + esc(p.cot.join(', ')) + '</p>';
        }
        html += '</div>';
        if (k.loi.length) html += '<ul class="ds-bao loi">' + k.loi.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
        if (k.canhBao.length) html += '<ul class="ds-bao canh">' + k.canhBao.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
        if (k.ghiChu.length) html += '<ul class="ds-bao tin">' + k.ghiChu.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
        if (p && p.hang.length) {
            const hien = p.hang.length > 300 ? p.hang.slice(0, 300) : p.hang;
            html += '<div class="bang-cuon"><table><thead><tr><th>Ngày</th><th>Kíp</th>'
                + p.cot.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
                + hien.map(function (h) {
                    return '<tr><td>' + ngayVN(h[0]) + '</td><td>' + h[1] + '</td>' + h[2].map(oBang).join('') + '</tr>';
                }).join('')
                + (p.hang.length > hien.length ? '<tr><td colspan="' + (p.cot.length + 2) + '">… và ' + (p.hang.length - hien.length) + ' hàng nữa</td></tr>' : '')
                + '</tbody></table></div>';
        }
        html += '</div>';
    }
    if (boQua.length && tt.ketQua.length) html += '<p class="phu">Bỏ qua trang: ' + esc(boQua.join(', ')) + '</p>';
    $('xem-truoc').innerHTML = html;

    const coPhan = tt.ketQua.some(function (k) { return k.phan; });
    const coGui = cacPhanGui().length > 0;
    $('nap').disabled = coLoi || !coGui || !!tt.chuaLoc;
    if (coLoi) baoTT('tt-nap', 'Sửa các lỗi màu đỏ trong file rồi chọn lại file', 'loi');
    else if (coPhan && tt.chuaLoc) baoTT('tt-nap', tt.chuaLoc, 'loi');
    else if (coPhan && !coGui) baoTT('tt-nap', 'Không có gì mới để nạp — mọi ngày trong file đã có đủ trên dashboard', 'ok');
    else if (coGui) baoTT('tt-nap', 'Sẵn sàng nạp ' + soVN(tongO) + ' ô' + (tongO > GIOI_HAN_O ? ' (sẽ chia thành nhiều lần nạp)' : ''), 'cho');
    else baoTT('tt-nap', '');
}

/** Các phần CÓ thứ để gửi, chỉ gồm đúng các trường máy chủ nhận (bỏ keThua,
 *  daLoc...). Phần mà mọi ngày đều đã có đủ trên dashboard thì không gửi. */
function cacPhanGui() {
    return tt.ketQua.filter(function (k) {
        return k.phan && (k.phan.hang.length || (k.phan.ngay_trong && k.phan.ngay_trong.length));
    }).map(function (k) {
        const p = { day_chuyen: k.phan.day_chuyen, khoi: k.phan.khoi, cot: k.phan.cot, hang: k.phan.hang };
        if (k.phan.ngay_trong && k.phan.ngay_trong.length) p.ngay_trong = k.phan.ngay_trong;
        return p;
    });
}

/** Chia các phần thành các lượt gửi, mỗi lượt <= GIOI_HAN_O ô. Cắt theo NGÀY
 *  (gom các ngày liền nhau cho tới khi đầy), không bao giờ cắt đôi một ngày. */
function chiaLuot(cacPhan) {
    const tong = cacPhan.reduce(function (a, p) { return a + demO(p); }, 0);
    if (tong <= GIOI_HAN_O) return [cacPhan];
    const oNgay = new Map();                   /* ngày -> số ô của ngày đó (mọi phần) */
    for (const p of cacPhan) {
        for (const h of p.hang) {
            let n = 1;
            for (const v of h[2]) if (v !== null) n++;
            oNgay.set(h[0], (oNgay.get(h[0]) || 0) + n);
        }
        for (const d of p.ngay_trong || []) if (!oNgay.has(d)) oNgay.set(d, 0);   /* ngày để trống: 0 ô */
    }
    const nhom = [];
    let hienTai = null, dem = 0;
    for (const d of [...oNgay.keys()].sort()) {
        if (!hienTai || dem + oNgay.get(d) > GIOI_HAN_O) { hienTai = new Set(); nhom.push(hienTai); dem = 0; }
        hienTai.add(d);
        dem += oNgay.get(d);
    }
    return nhom.map(function (ds) {
        return cacPhan.map(function (p) {
            const q = { day_chuyen: p.day_chuyen, khoi: p.khoi, cot: p.cot, hang: p.hang.filter(function (h) { return ds.has(h[0]); }) };
            if (p.ngay_trong) q.ngay_trong = p.ngay_trong.filter(function (d) { return ds.has(d); });
            return q;
        }).filter(function (p) { return p.hang.length || (p.ngay_trong && p.ngay_trong.length); });
    });
}

async function napLen() {
    if (tt.chuaLoc) { baoTT('tt-nap', tt.chuaLoc, 'loi'); return; }
    const cacPhan = cacPhanGui();
    if (!cacPhan.length) return;
    luuKhoa();
    $('nap').disabled = true;
    const luot = chiaLuot(cacPhan);
    const mau = [...new Set(tt.ketQua.map(function (k) { return k.mau; }))];
    let tongO = 0, tongGhi = 0, tongGoi = 0;
    for (let i = 0; i < luot.length; i++) {
        baoTT('tt-nap', 'Đang gửi' + (luot.length > 1 ? ' lần ' + (i + 1) + '/' + luot.length : '') + '…', 'cho');
        const r = await goiApi('/api/nap', 'POST', {
            mau: mau.length === 1 ? mau[0] : 'nhieu',
            ten_file: tt.tenFile + (luot.length > 1 ? ' (phần ' + (i + 1) + '/' + luot.length + ')' : ''),
            nguoi: $('nguoi').value.trim() || null,
            phan: luot[i],
        });
        if (!r.ok) {
            baoTT('tt-nap', (i ? 'Đã nạp ' + i + '/' + luot.length + ' phần, phần ' + (i + 1) + ' lỗi: ' : 'Lỗi: ')
                + (r.j.message || 'HTTP ' + r.status) + (i ? ' — xem bước 4 để huỷ phần đã nạp nếu cần' : ''), 'loi');
            $('nap').disabled = false;
            if (i) taiDanhSach();
            return;
        }
        tongO += r.j.so_o; tongGhi += r.j.so_ghi; tongGoi += r.j.so_goi;
        if (r.j.cot_moi && r.j.cot_moi.length) console.info('[Nạp] cột mới:', r.j.cot_moi);
    }
    baoTT('tt-nap', 'Đã nạp ' + soVN(tongO) + ' ô (' + soVN(tongGhi) + ' ô mới hoặc đổi giá trị), dựng lại '
        + tongGoi + ' gói tháng. Mở lại dashboard để xem.', 'ok');
    taiDanhSach();
}

/* ---------------------------------------------------------------------------
 * BƯỚC 4 — DANH SÁCH + HUỶ
 * ------------------------------------------------------------------------- */

async function taiDanhSach() {
    baoTT('tt-ds', 'Đang tải…', 'cho');
    const r = await goiApi('/api/nap', 'GET');
    if (!r.ok) { baoTT('tt-ds', r.j.message || 'Lỗi', 'loi'); return; }
    baoTT('tt-ds', '');
    veDanhSach(r.j.lan_nap || []);
}

function gioVN(ms) {
    return new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function veDanhSach(ds) {
    if (!ds.length) { $('ds').innerHTML = '<p class="phu">Chưa có lần nạp nào.</p>'; return; }
    $('ds').innerHTML = '<div class="bang-cuon"><table class="bang-ds"><thead><tr><th>Lúc nạp</th><th>Người nạp</th><th>File</th>'
        + '<th>Khối · ngày</th><th class="so">Ô</th><th>Tình trạng</th><th></th></tr></thead><tbody>'
        + ds.map(function (x) {
            const khoi = (x.tom_tat || []).map(function (t) {
                return esc(t[0] + ' ' + t[1]) + ': ' + ngayVN(t[2]) + (t[3] !== t[2] ? ' → ' + ngayVN(t[3]) : '') + ' (' + t[4] + ' ngày)';
            }).join('<br>');
            const tinh = x.huy_luc ? 'Đã huỷ ' + gioVN(x.huy_luc)
                : x.so_khoi_ngay_con ? 'Đang dùng (' + x.so_khoi_ngay_con + ' khối-ngày)'
                : 'Đã bị các lần nạp sau thay hết';
            const nut = !x.huy_luc && x.so_khoi_ngay_con
                ? '<button type="button" class="nguy" data-huy="' + x.id + '">Huỷ</button>' : '';
            return '<tr' + (x.huy_luc ? ' class="da-huy"' : '') + '><td>' + gioVN(x.id) + '</td><td>' + esc(x.nguoi || '—') + '</td><td>'
                + esc(x.ten_file || '—') + '</td><td>' + khoi + '</td><td class="so">' + soVN(x.so_o) + '</td><td>' + tinh + '</td><td>' + nut + '</td></tr>';
        }).join('') + '</tbody></table></div>';
}

async function huy(id) {
    const x = $('ds').querySelector('[data-huy="' + id + '"]');
    if (!window.confirm('Huỷ lần nạp lúc ' + gioVN(id) + '?\n\nSố liệu của các khối-ngày lần đó đang giữ sẽ bị XOÁ khỏi dashboard; '
        + 'số Google Sheet (nếu có) sẽ quay lại dần ở các lần đồng bộ sau.')) return;
    if (x) x.disabled = true;
    baoTT('tt-ds', 'Đang huỷ…', 'cho');
    const r = await goiApi('/api/nap/huy', 'POST', { id: id });
    if (!r.ok) { baoTT('tt-ds', r.j.message || 'Lỗi', 'loi'); if (x) x.disabled = false; return; }
    await taiDanhSach();
    baoTT('tt-ds', 'Đã huỷ: xoá ' + soVN(r.j.so_xoa) + ' ô của ' + r.j.so_khoi_ngay + ' khối-ngày', 'ok');
    taiDanhMuc();                              /* ngày cuối có số của khối có thể đã lùi */
}

/* ---------------------------------------------------------------------------
 * GẮN SỰ KIỆN
 * ------------------------------------------------------------------------- */

$('khoa').value = docLuu('localStorage', KHOA_LUU) || docLuu('sessionStorage', KHOA_LUU);
$('nho').checked = !!docLuu('localStorage', KHOA_LUU);
$('nguoi').value = docLuu('localStorage', NGUOI_LUU);
$('nho').addEventListener('change', luuKhoa);
$('nguoi').addEventListener('change', luuKhoa);
$('kiem-khoa').addEventListener('click', kiemKhoa);
$('khoa').addEventListener('keydown', function (e) { if (e.key === 'Enter') kiemKhoa(); });
$('dc').addEventListener('change', veChonKhoi);
$('khoi').addEventListener('change', veMoTaKhoi);
$('tai-mau').addEventListener('click', taiMau);
$('file').addEventListener('change', function () { chonFile(this.files[0]); });
$('nap').addEventListener('click', napLen);
$('tai-ds').addEventListener('click', taiDanhSach);
$('ds').addEventListener('click', function (e) {
    const nut = e.target.closest('[data-huy]');
    if (nut) huy(Number(nut.getAttribute('data-huy')));
});

/* Kéo thả file vào ô */
const oTha = $('o-tha');
['dragenter', 'dragover'].forEach(function (t) {
    oTha.addEventListener(t, function (e) { e.preventDefault(); oTha.classList.add('dang-keo'); });
});
['dragleave', 'drop'].forEach(function (t) {
    oTha.addEventListener(t, function (e) { e.preventDefault(); oTha.classList.remove('dang-keo'); });
});
oTha.addEventListener('drop', function (e) {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) chonFile(f);
});
/* Đổi dây chuyền / khối sau khi đã chọn file: đọc lại (trang không ghi khối dùng lựa chọn này) */
['dc', 'khoi'].forEach(function (id) {
    $(id).addEventListener('change', function () { if (tt.file && tt.ketQua.length) chonFile(tt.file); });
});

taiDanhMuc();
