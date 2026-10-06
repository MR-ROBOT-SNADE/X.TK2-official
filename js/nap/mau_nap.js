/* =============================================================================
 * js/nap/mau_nap.js — CÁC DẠNG FILE EXCEL MÀ TRANG NẠP HIỂU ĐƯỢC
 * =============================================================================
 * Mỗi "mẫu" biết cách đọc MỘT dạng file thành các "phần" gửi lên /api/nap
 * (dạng phần: xem đầu db/nap-excel.mjs). Trang nạp (js/nap/nap_lieu.js) thử lần
 * lượt CAC_MAU với từng trang tính: mẫu đầu tiên nhanDien() nhận thì mẫu đó đọc.
 *
 * HIỆN CÓ
 *   chuan   file mẫu của chính trang nạp (nút "Tải file mẫu"): hàng tiêu đề
 *           Ngày | Kíp | các cột của MỘT khối; tên trang tính 'TK3 QTK' cho biết
 *           dây chuyền + khối.
 *
 * THÊM MỘT DẠNG MỚI (vd báo cáo KCS xuất từ phần mềm BK) — khi đã có file mẫu:
 *   1) viết một đối tượng { id, ten, nhanDien(trang), doc(trang, ctx) } như MAU_CHUAN
 *      — id chỉ gồm a-z 0-9 _ - (máy chủ ghi vào lan_nap.mau);
 *   2) thêm vào đầu CAC_MAU (trước 'chuan', để không bị nhận nhầm);
 *   3) doc() trả { phan, canhBao, loi } — dùng sẵn docNgayO, docKip, docGiaTri.
 *   Tên cột trong phần gửi lên phải ĐÚNG tên cột trên dashboard (ctx.danhMuc)
 *   thì số mới nối tiếp được biểu đồ đang có.
 *
 * ctx truyền vào doc():
 *   danhMuc  Map<khối, [tên cột...]> (không gồm cột Ca/kíp) — lấy từ /api/v2
 *   chon     { dc, khoi } đang chọn ở bước 2 của trang (dùng khi file không tự nói)
 *   homNay   'YYYY-MM-DD' theo giờ Việt Nam
 * ===========================================================================*/

import { docSo, docNgay, dauThapPhanCot } from '../../db/chuan-hoa.mjs';
import { tenTrangHopLe } from './ghi_xlsx.js';

/** Làm gọn chữ: chuẩn Unicode NFC, gộp khoảng trắng, bỏ khoảng trắng hai đầu. */
export function gon(s) { return String(s).normalize('NFC').replace(/\s+/g, ' ').trim(); }

/** Khoá để so tên không phân biệt hoa thường: 'TFe ' và 'tfe' là một. */
function khoaSo(s) { return gon(s).toLowerCase(); }

/** Tên cột này có phải cột Ca/kíp của sheet không ('Ca/kíp (QTK)'). */
export function laCotKip(cot) { return /^Ca\/kíp \(/.test(cot); }

/* Chuỗi TRÔNG như số (giống db/chuan-hoa.mjs): chỉ chữ số, dấu . , khoảng trắng, % */
const RE_TRONG_NHU_SO = /^[+-]?[\d.,\s]+%?$/;

/** Ô ngày -> 'YYYY-MM-DD' hoặc null. Nhận:
 *    '2026-09-01' / '2026-09-01 08:30'  (ô định dạng ngày, js/nap/doc_xlsx.js)
 *    46266                              (số ngày kiểu Excel của ô không định dạng ngày)
 *    '01/09/2026', '1-9-2026'           (ô chữ, kiểu Việt Nam: ngày trước tháng) */
export function docNgayO(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') {
        if (v < 20000 || v > 80000) return null;      /* ngoài khoảng 1954..2119 = không phải ngày */
        return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
    }
    const s = gon(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return docNgay(s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4));
    return docNgay(s.split(' ')[0]);
}

/** Ô kíp -> 'A' / 'B' / 'C' hoặc null. Nhận 'A', 'a', 'Kíp A', 'kip b'. */
export function docKip(v) {
    if (v === null || v === undefined) return null;
    const m = gon(v).toUpperCase().match(/^(?:K[IÍ]P\s*)?([ABC])$/);
    return m ? m[1] : null;
}

/** Ô số liệu -> số, chữ, hoặc null (trống).
 *    số Excel                     giữ nguyên
 *    '56,3' / '5.854,00' / '96.86 %'  đọc thành số như sheet (docSo, dấu thập phân
 *                                 đoán theo goiY = dấu đa số của cả cột)
 *    '-' / '—' / ''               trống
 *    chữ khác ('Hỏng', '#DIV/0!') giữ là chữ */
export function docGiaTri(v, goiY) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = gon(v);
    if (s === '' || /^[-–—]$/.test(s)) return null;
    if (RE_TRONG_NHU_SO.test(s)) { const n = docSo(s, goiY); if (n !== null) return n; }
    return s;
}

/** Ô tiêu đề này là cột ngày / cột kíp? */
function laTieuDeNgay(t) { const k = khoaSo(t); return k === 'ngày' || k === 'ngay' || /^thời gian( \(|$)/.test(k); }
function laTieuDeKip(t) { const k = khoaSo(t); return k === 'kíp' || k === 'kip' || /^ca\/kíp( \(|$)/.test(k); }

/** Hàng tiêu đề = hàng đầu tiên (trong 10 hàng đầu) có cả ô "Ngày" và ô "Kíp". -1 nếu không có. */
function timHangTieuDe(o) {
    for (let i = 0; i < Math.min(10, o.length); i++) {
        const h = (o[i] || []).filter(function (v) { return typeof v === 'string'; });
        if (h.some(laTieuDeNgay) && h.some(laTieuDeKip)) return i;
    }
    return -1;
}

/** 'YYYY-MM-DD' -> 'dd/mm/yyyy' để hiện cho người đọc. */
export function ngayVN(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }

/* =============================================================================
 * MẪU "chuan" — file mẫu của trang nạp
 * ===========================================================================*/
const MAU_CHUAN = {
    id: 'chuan',
    ten: 'File mẫu của trang (Ngày | Kíp | các cột của khối)',

    nhanDien: function (trang) { return timHangTieuDe(trang.o) >= 0; },

    /** Ra { phan: { day_chuyen, khoi, cot, hang } | null, canhBao: [chữ], loi: [chữ] }.
     *  Có loi thì KHÔNG được nạp (trang nạp khoá nút) — bỏ qua một hàng hỏng sẽ
     *  làm lệch thứ tự mẫu trong ngày. */
    doc: function (trang, ctx) {
        const canhBao = [], loi = [];
        const iTD = timHangTieuDe(trang.o);
        const td = (trang.o[iTD] || []).map(function (v) { return v === null || v === undefined ? '' : gon(v); });
        const iNgay = td.findIndex(laTieuDeNgay), iKip = td.findIndex(laTieuDeKip);

        /* Dây chuyền + khối: từ tên trang tính ('TK3 QTK'), không thì theo bước 2 */
        let dc = null, khoi = null;
        const m = gon(trang.ten).match(/^(TK3|TK4)\b/i);
        if (m) {
            dc = m[1].toUpperCase();
            for (const k of ctx.danhMuc.keys()) {
                if (khoaSo(tenTrangHopLe(dc + ' ' + k)) === khoaSo(trang.ten)) { khoi = k; break; }
            }
            if (!khoi) {
                loi.push('Tên trang "' + trang.ten + '" không khớp khối nào trên dashboard (cần dạng "' + dc + ' QTK")');
                return { phan: null, canhBao: canhBao, loi: loi };
            }
        } else {
            dc = ctx.chon.dc; khoi = ctx.chon.khoi;
            canhBao.push('Tên trang "' + trang.ten + '" không ghi dây chuyền + khối — dùng lựa chọn ở bước 2: '
                + dc + ' — ' + khoi + '. Kiểm lại cho đúng!');
        }
        const cotKhoi = ctx.danhMuc.get(khoi) || [];

        /* Ghép cột trong file với cột của khối theo TÊN (không phân biệt hoa thường) */
        const anh = [], la = [], daDung = new Set();
        td.forEach(function (t, j) {
            if (j === iNgay || j === iKip || !t) return;
            const ten = cotKhoi.find(function (c) { return khoaSo(c) === khoaSo(t); });
            if (!ten) { la.push(t); return; }
            if (daDung.has(ten)) { loi.push('Cột "' + t + '" có hai lần'); return; }
            daDung.add(ten);
            anh.push({ j: j, ten: ten });
        });
        if (la.length) canhBao.push('Bỏ qua ' + la.length + ' cột không thuộc khối ' + khoi + ': ' + la.join(', '));
        if (!anh.length) { loi.push('Không có cột nào trùng tên cột của khối ' + khoi); return { phan: null, canhBao: canhBao, loi: loi }; }
        const thieu = cotKhoi.filter(function (c) { return !daDung.has(c); });
        if (thieu.length) canhBao.push('File không có ' + thieu.length + ' cột của khối — ở những ngày nạp, các cột này sẽ TRỐNG: ' + thieu.join(', '));

        /* Dấu thập phân đa số của từng cột (cho ô chữ mơ hồ kiểu '1,500') */
        const than = trang.o.slice(iTD + 1);
        const goiY = anh.map(function (a) { return dauThapPhanCot(than.map(function (h) { return h && typeof h[a.j] === 'string' ? h[a.j] : null; })); });

        const hang = [];
        let ngayTruoc = null, soTrong = 0;
        for (let i = iTD + 1; i < trang.o.length; i++) {
            const h = trang.o[i] || [];
            const so = i + 1;                                     /* số hàng như Excel hiện */
            const gt = anh.map(function (a, k) { return docGiaTri(h[a.j], goiY[k]); });
            const vNgay = h[iNgay], vKip = h[iKip];
            const coNgay = vNgay !== null && vNgay !== undefined && vNgay !== '';
            const ngayO = coNgay ? docNgayO(vNgay) : null;
            if (gt.every(function (v) { return v === null; })) {
                /* Hàng không có số: bỏ, nhưng vẫn nhớ ngày (ô ngày gộp / ghi ở hàng đầu) */
                if (coNgay || (vKip !== null && vKip !== undefined)) soTrong++;
                if (ngayO) ngayTruoc = ngayO;
                continue;
            }
            if (coNgay && !ngayO) { loi.push('Hàng ' + so + ': không đọc được ngày "' + vNgay + '"'); continue; }
            const ngay = ngayO || ngayTruoc;
            if (!ngay) { loi.push('Hàng ' + so + ': thiếu ngày'); continue; }
            if (ngay > ctx.homNay) { loi.push('Hàng ' + so + ': ngày ' + ngayVN(ngay) + ' ở tương lai'); continue; }
            if (ngay < '2020-01-01') { loi.push('Hàng ' + so + ': ngày ' + ngayVN(ngay) + ' quá cũ — gõ nhầm năm?'); continue; }
            ngayTruoc = ngay;
            const kip = docKip(vKip);
            if (!kip) { loi.push('Hàng ' + so + ': kíp "' + (vKip === null || vKip === undefined ? '' : vKip) + '" phải là A, B hoặc C'); continue; }
            hang.push([ngay, kip, gt]);
        }
        if (soTrong) canhBao.push('Bỏ ' + soTrong + ' hàng không có số liệu');
        if (!hang.length && !loi.length) loi.push('Không có hàng nào có số liệu');
        if (loi.length > 20) loi.splice(20, loi.length - 20, '... và ' + (loi.length - 20) + ' lỗi nữa');
        return {
            phan: hang.length ? { day_chuyen: dc, khoi: khoi, cot: anh.map(function (a) { return a.ten; }), hang: hang } : null,
            canhBao: canhBao, loi: loi,
        };
    },
};

/** Các dạng file, thứ tự = thứ tự thử (xem đầu file). */
export const CAC_MAU = [MAU_CHUAN];
