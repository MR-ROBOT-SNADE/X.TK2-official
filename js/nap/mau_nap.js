/* =============================================================================
 * js/nap/mau_nap.js — CÁC DẠNG FILE EXCEL MÀ TRANG NẠP HIỂU ĐƯỢC
 * =============================================================================
 * Mỗi "mẫu" biết cách đọc MỘT dạng file thành các "phần" gửi lên /api/nap
 * (dạng phần: xem đầu db/nap-excel.mjs). Trang nạp (js/nap/nap_lieu.js) thử lần
 * lượt CAC_MAU với từng trang tính: mẫu đầu tiên nhanDien() nhận thì mẫu đó đọc.
 *
 * HIỆN CÓ
 *   kcs-bk  phiếu kết quả kiểm tra đầu vào + sản phẩm xuất NGUYÊN từ phần mềm BK
 *           (P.QLCL): một trang ra 7 khối chất lượng (QTK, QTH, HLC, vôi nung,
 *           đo nung, than nghiền, than cốc). Xem MAU_KCS.
 *   chuan   file mẫu của chính trang nạp (nút "Tải file mẫu"): hàng tiêu đề
 *           Ngày | Kíp | các cột của MỘT khối; tên trang tính 'TK3 QTK' cho biết
 *           dây chuyền + khối.
 *
 * THÊM MỘT DẠNG MỚI — khi đã có file mẫu:
 *   1) viết một đối tượng { id, ten, nhanDien(trang), doc(trang, ctx) } như MAU_CHUAN
 *      — id chỉ gồm a-z 0-9 _ - (máy chủ ghi vào lan_nap.mau);
 *   2) thêm vào đầu CAC_MAU (trước 'chuan', để không bị nhận nhầm);
 *   3) doc() trả { phan, canhBao, loi, ghiChu? } — hoặc MẢNG các kết quả đó khi một
 *      trang ra nhiều khối (như MAU_KCS). Dùng sẵn docNgayO, docKip, docGiaTri.
 *      phan.keThua (tuỳ chọn): các cột file không có mà trang nạp tự điền từ số
 *      đang có trên dashboard (js/nap/nap_lieu.js, boSungSoDangCo).
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

/* =============================================================================
 * MẪU "kcs-bk" — PHIẾU KẾT QUẢ KIỂM TRA ĐẦU VÀO VÀ SẢN PHẨM, XUẤT TỪ PHẦN MỀM BK
 * =============================================================================
 * File P.QLCL xuất nguyên từ BK-MIS (báo cáo rptKCS0002): MỘT trang tính, MỘT
 * dây chuyền, thường trọn một tháng. Nạp thẳng, không phải chép sang file mẫu.
 *   đầu file  "PX TK3 DQ2- Từ ngày 01/08/2026 đến ngày 31/08/2026" -> dây chuyền TK3
 *   phần 1    KẾT QUẢ KIỂM TRA ĐẦU VÀO: hàng tiêu đề "Kíp - ngày | Mã mẫu | Tên NNPL |
 *             Vị trí lấy mẫu | Thời gian | Các chỉ tiêu kiểm tra(%)", hàng ngay dưới
 *             là tên chỉ tiêu (W, TFe, SiO2, CaO, MgO, Ak, V, Cỡ hạt...)
 *   phần 2    KẾT QUẢ KIỂM TRA THÀNH PHẨM: như trên nhưng "Tên Mẫu", chỉ tiêu Fe, FeO,
 *             R2, T, A, Cỡ hạt...; ô Cỡ hạt ghi NHÃN "<5;5-10;...;>40", các con số
 *             nằm ở hàng NGAY DƯỚI.
 *   Mỗi hàng là một mẫu. "1A - 01/08/2026" = ca 1, kíp A, ngày sản xuất 01/08/2026
 *   (mẫu 02h30 của ca 2 vẫn thuộc ngày ghi ở đây). Các ô gộp nhiều cột, nên vị trí
 *   cột luôn dò theo hàng tiêu đề, không cố định.
 *
 * ĐỔI SANG KHỐI DASHBOARD: bảng QUY_TAC_KCS. Đã so từng ô với Google Sheet TK3
 * ngày 01–25/08/2026: QTK, HLC, vôi nung, đo nung, than khớp hết.
 *   - Chỉ lấy mẫu ở đúng điểm lấy mẫu (P.QLCL xác nhận 05/10/2026): QTH ở TLM
 *     D201C, QTK ở TLM thành phẩm, mọi vật liệu khác ở SILO của dây chuyền (xem
 *     RE_SILO_DAY_CHUYEN). Vật liệu không có biểu đồ (bột đá, quặng sau trộn...),
 *     mẫu ở nhà máy nguyên liệu (Silo 3 NMNL), silo ngầm, silo lạ (Silo HG61)...
 *     bị bỏ qua, có ghi rõ trong phần xem trước.
 *   - MỖI CA MỘT HÀNG: mọi lần kiểm tra cùng ngày + ca + kíp được gộp lại, mỗi chỉ
 *     tiêu lấy TRUNG BÌNH CỘNG (trungBinh). Hàng của khối nào cũng là "dd/mm - kíp"
 *     như sheet, nên biểu đồ ghép TK3 + TK4 theo ngày + kíp khớp từng ca
 *     (js/components/Charts/chart_cook.js, ghepTheoNgayKip).
 *   - Vôi nung: hai silo của cùng ca thành hai cột của một hàng. Cỡ hạt than: xem
 *     coHatThan (4 số -> có thêm cột 0,5-1mm).
 * Phiếu là số chuẩn cho CẢ khoảng ngày của nó: ngày nào khối không có mẫu thì nạp
 * xong để trống (phan.ngay_trong, db/nap-excel.mjs).
 * ===========================================================================*/

/* "1A - 01/08/2026" -> ca, kíp, ngày, tháng, năm */
const RE_KIP_NGAY = /^(\d)\s*([A-Z])\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
/* ĐIỂM LẤY MẪU dùng cho biểu đồ (vị trí đã qua gon()):
   QTH        chỉ băng TLM D201C (cả TK3 lẫn TK4; D101C, D102C, silo QTH thì không)
   QTK        TLM thành phẩm thiêu kết (mẫu sản phẩm của dây chuyền)
   còn lại    SILO của dây chuyền, ghi đúng dạng "Silo 12" / "Silo 15+16". Không
              khớp: "Silo 3 NMNL" (nhà máy nguyên liệu), "Silo ngầm Q2 - NL2",
              "Silo HG61" (silo lạ), băng tải... */
const RE_QTH_D201C = /\bD201C\b/i;
const RE_TLM_THANH_PHAM = /^TLM thành phẩm/i;
const RE_SILO_DAY_CHUYEN = /^Silo \d+( ?\+ ?\d+)*$/i;

/** Hàng tiêu đề một phần của phiếu BK: có ô "Kíp - ngày" và ô "Tên NNPL" / "Tên Mẫu". */
function laTieuDeKcs(h) {
    let kip = false, ten = false;
    for (const v of h || []) {
        if (typeof v !== 'string') continue;
        const k = khoaSo(v);
        if (/^kíp ?- ?ngày$/.test(k)) kip = true;
        else if (/^tên (nnpl|mẫu)$/.test(k)) ten = true;
    }
    return kip && ten;
}

/** Số dây chuyền ghi ở đầu phiếu ("PX TK3 DQ2- Từ ngày...", "...TKVV 3 DQ2") -> { so, chu } | null. */
function timDayChuyenKcs(o) {
    for (let i = 0; i < Math.min(40, o.length); i++) {
        for (const v of o[i] || []) {
            if (typeof v !== 'string') continue;
            const s = gon(v), m = s.match(/\bPX ?TK ?(\d+)/i) || s.match(/\bTKVV ?(\d+)/i);
            if (m) return { so: m[1], chu: s };
        }
    }
    return null;
}

/** Giờ lấy mẫu -> số phút tính từ đầu ca, chỉ để xếp thứ tự. Ca 1 = 8h-20h,
 *  ca 2 = 20h-8h sáng hôm sau (02h30 của ca 2 đứng SAU 21h00). */
function phutTrongCa(gio, ca) {
    const m = typeof gio === 'string' && gon(gio).match(/^(\d{1,2}) ?[h:] ?(\d{0,2})/i);
    if (!m) return 9999;                                    /* không rõ giờ: giữ thứ tự trong file */
    let p = Number(m[1]) * 60 + (Number(m[2]) || 0);
    if (ca >= 2 && p < 12 * 60) p += 24 * 60;
    return p;
}

/** Chuỗi cỡ hạt "41.8;52.66;5.54" -> [41.8, 52.66, 5.54] (phần hỏng -> null). */
function tachCoHat(s) {
    return String(s).split(';').map(function (x) {
        const t = gon(x).replace(',', '.');
        const n = t === '' ? NaN : Number(t);
        return Number.isFinite(n) ? n : null;
    });
}

/** Đọc mọi mẫu trong trang phiếu BK. Mỗi mẫu:
 *    { so (số hàng Excel), ngay, ca, kip, ten, viTri, phut, gt: Map<chỉ tiêu, giá trị>,
 *      coHat: [số] | null, nhanCoHat: [nhãn] | null }
 *  Hàng có tên vật liệu mà "Kíp - ngày" không đọc được -> thêm vào loi. */
function docMauKcs(o, homNay, loi) {
    const ds = [];
    let cot = null;                           /* vị trí cột của phần đang đọc */
    for (let i = 0; i < o.length; i++) {
        const h = o[i] || [];
        if (laTieuDeKcs(h)) {
            const tim = function (re) { return h.findIndex(function (v) { return typeof v === 'string' && re.test(khoaSo(v)); }); };
            cot = { kip: tim(/^kíp ?- ?ngày$/), ten: tim(/^tên (nnpl|mẫu)$/), viTri: tim(/^vị trí/), gio: tim(/^thời gian$/), chiTieu: [] };
            (o[i + 1] || []).forEach(function (v, j) { if (typeof v === 'string' && gon(v)) cot.chiTieu.push([j, gon(v)]); });
            i++;                              /* hàng tên chỉ tiêu */
            continue;
        }
        if (!cot) continue;
        const vKip = h[cot.kip], ten = typeof h[cot.ten] === 'string' ? gon(h[cot.ten]) : '';
        if (vKip === null || vKip === undefined || vKip === '') continue;   /* hàng số cỡ hạt, chữ ký... */
        const so = i + 1;
        const m = gon(vKip).match(RE_KIP_NGAY);
        if (!m) {
            if (ten) loi.push('Hàng ' + so + ': không đọc được "Kíp - ngày" = "' + gon(vKip) + '" (cần dạng 1A - 01/08/2026)');
            continue;
        }
        if (!ten) continue;
        const ngay = docNgayO(m[3] + '/' + m[4] + '/' + m[5]);
        if (!ngay) { loi.push('Hàng ' + so + ': ngày "' + gon(vKip) + '" không có thật'); continue; }
        if (ngay > homNay) { loi.push('Hàng ' + so + ': ngày ' + ngayVN(ngay) + ' ở tương lai'); continue; }
        if (ngay < '2020-01-01') { loi.push('Hàng ' + so + ': ngày ' + ngayVN(ngay) + ' quá cũ'); continue; }
        const kip = docKip(m[2]);
        if (!kip) { loi.push('Hàng ' + so + ': kíp "' + m[2] + '" phải là A, B hoặc C'); continue; }

        const mau = { so: so, ngay: ngay, ca: Number(m[1]), kip: kip, ten: ten,
            viTri: typeof h[cot.viTri] === 'string' ? gon(h[cot.viTri]) : '',
            phut: phutTrongCa(h[cot.gio], Number(m[1])), gt: new Map(), coHat: null, nhanCoHat: null };
        for (const [j, tenCT] of cot.chiTieu) {
            const v = h[j];
            if (v === null || v === undefined || v === '') continue;
            if (khoaSo(tenCT) === 'cỡ hạt') {
                const s = gon(v);
                if (/[<>]/.test(s)) {             /* ô ghi nhãn, số ở hàng dưới */
                    mau.nhanCoHat = s.split(';').map(function (x) { return gon(x).replace(/ /g, ''); });
                    const duoi = (o[i + 1] || [])[j];
                    if (duoi !== null && duoi !== undefined && duoi !== '') mau.coHat = tachCoHat(duoi);
                } else mau.coHat = tachCoHat(s);
                continue;
            }
            mau.gt.set(tenCT, docGiaTri(v));
        }
        ds.push(mau);
    }
    return ds;
}

/** Giá trị đầu tiên có của các chỉ tiêu (theo tên ở hàng tiêu đề phiếu BK). */
function lay(mau, ...ten) {
    for (const t of ten) { const v = mau.gt.get(t); if (v !== null && v !== undefined) return v; }
    return null;
}

/** Số thứ k trong chuỗi cỡ hạt (k âm = đếm từ cuối). */
function coHatThu(mau, k) {
    const a = mau.coHat;
    if (!a || !a.length) return null;
    const v = a[k < 0 ? a.length + k : k];
    return v === undefined ? null : v;
}

/** Số cỡ hạt có nhãn khớp re (nhãn đã bỏ dấu cách: '<5', '>40'). */
function coHatNhan(mau, re) {
    if (!mau.coHat || !mau.nhanCoHat) return null;
    const k = mau.nhanCoHat.findIndex(function (n) { return re.test(n); });
    return k >= 0 && k < mau.coHat.length ? mau.coHat[k] : null;
}

/** Cỡ hạt than -> bốn số [0,5-1mm, <1mm, 1-3mm, >3mm] (số đầu null nếu phiếu
 *  không có). Theo P.QLCL (xác nhận 04/10/2026), BK ghi:
 *    3 số   <1 ; 1-3 ; >3
 *    4 số   0,5-1 ; <1 ; 1-3 ; >3     (từ ca 2 ngày 11/08/2026). Số 0,5-1 nằm TRONG
 *           số <1 (ba số sau cộng lại đủ 100%).
 *  CHÚ Ý: tên cột trên dashboard (theo tiêu đề Google Sheet) là "< 0,5mm",
 *  "0,5-3mm", ">3mm", nhưng số sheet vẫn nhập vào đó là <1 / 1-3 / >3 (dạng 3 số)
 *  — ghi đúng như vậy để đường biểu đồ liền mạch giữa số cũ và số mới. Số 0,5-1
 *  vào cột "Cỡ hạt 0,5-1mm (...)" (cột mới — sheet không có, nạp lần đầu thì máy
 *  chủ tạo). Biểu đồ đọc đủ 4 cột: js/components/Charts/chart_core.js, drawCoalSizeChart.
 *  Dạng khác: để trống và báo. */
function coHatThan(mau, nhac) {
    if (mau.than) return mau.than;            /* bốn cột cùng gọi: tính (và nhắc) một lần */
    const a = mau.coHat, vd = '(vd ' + ngayVN(mau.ngay) + ' ' + mau.ca + mau.kip + ': ' + (a ? a.join(';') : '') + ')';
    if (!a) mau.than = [null, null, null, null];
    else if (a.length === 3) mau.than = [null].concat(a);
    else if (a.length === 4) {
        nhac('Cỡ hạt than ghi 4 số 0,5-1 ; <1 ; 1-3 ; >3 ' + vd + ': số 0,5-1 vào cột "Cỡ hạt 0,5-1mm", ba số sau vào ba cột cỡ hạt như dạng 3 số', 'tin');
        mau.than = a;
    } else {
        nhac('Cỡ hạt than không đúng dạng 3 hoặc 4 số ' + vd + ' — để trống');
        mau.than = [null, null, null, null];
    }
    return mau.than;
}

/** Trung bình cộng các lần kiểm tra của một ca: bỏ ô trống, làm tròn 4 chữ số lẻ
 *  (một số thì giữ nguyên). Không có số nào mà có ô chữ ("Hỏng"...) -> ô chữ đầu
 *  tiên; trống hết -> null. */
function trungBinh(cacGiaTri) {
    let tong = 0, n = 0, chu = null;
    for (const v of cacGiaTri) {
        if (typeof v === 'number') { tong += v; n++; }
        else if (v !== null && v !== undefined && chu === null) chu = v;
    }
    if (n === 1) return tong;
    return n ? Math.round(tong / n * 1e4) / 1e4 : chu;
}

/** Các mẫu -> nhóm theo ca: Map 'ngày|ca|kíp' -> [mẫu], xếp theo ngày rồi ca
 *  (trong một nhóm giữ thứ tự giờ lấy mẫu). */
function nhomTheoCa(dsMau) {
    const ds = dsMau.slice().sort(function (x, y) {
        return x.ngay < y.ngay ? -1 : x.ngay > y.ngay ? 1 : (x.ca - y.ca) || (x.phut - y.phut) || (x.so - y.so);
    });
    const nhom = new Map();
    for (const m of ds) {
        const k = m.ngay + '|' + m.ca + '|' + m.kip;
        if (!nhom.has(k)) nhom.set(k, []);
        nhom.get(k).push(m);
    }
    return nhom;
}

/** Vôi nung: các mẫu của MỘT ca -> một hàng. silo[0] -> cột "(12)", silo[1] ->
 *  cột "(13)" (trung bình các mẫu của silo đó); cỡ hạt 0-3mm lấy theo silo[0],
 *  silo[0] không đo cỡ hạt thì theo silo[1] — xem QUY_TAC_KCS. */
function hangVoiNung(dsMau, silo) {
    const theoSilo = function (s) { return dsMau.filter(function (x) { return x.silo === s; }); };
    const a = theoSilo(silo[0]), b = theoSilo(silo[1]);
    const coHat = function (ms) { return trungBinh(ms.map(function (x) { return coHatThu(x, 0); })); };
    return {
        'Cỡ hạt 0 - 3mm (VN) (%)': coHat(a) ?? coHat(b),
        '% CaO (vôi) (12)': trungBinh(a.map(function (x) { return lay(x, 'CaO'); })),
        '% CaO (vôi) (13)': trungBinh(b.map(function (x) { return lay(x, 'CaO'); })),
    };
}

/* Mỗi quy tắc: vật liệu nào, lấy ở đâu (loc) -> khối nào, cột dashboard nào lấy
 * chỉ tiêu nào. Mọi khối đều MỖI CA MỘT HÀNG (trung bình các lần kiểm tra).
 *   cot      { tên cột trên dashboard: hàm(mẫu, nhac) -> giá trị của MỘT mẫu }
 *   cotMoi   cột dashboard chưa có nhưng được phép tạo (máy chủ tạo khi nạp lần đầu,
 *            db/nap-excel.mjs timMa). Cột mới mà cả phần không có số nào thì không gửi.
 *   keThua   cột phiếu BK không có (khoảng R2 cho phép): trang nạp lấy giá trị đang
 *            có trên dashboard của ngày đó, không có thì của ngày gần nhất trước đó
 *            (js/nap/nap_lieu.js, boSungSoDangCo) — để nạp không làm mất dải R2.
 *   theoSilo vôi nung: mỗi silo một cột (hangVoiNung), không trung bình chung.
 *   loc(mẫu) -> có lấy mẫu này không. */
const QUY_TAC_KCS = [
    {
        khoi: 'QTK',
        loc: function (m) { return /^quặng thiêu kết$/.test(khoaSo(m.ten)) && RE_TLM_THANH_PHAM.test(m.viTri); },
        cot: {
            'R2': function (m) { return lay(m, 'R2'); },
            'T': function (m) { return lay(m, 'T'); },
            'A': function (m) { return lay(m, 'A'); },
            'TFe': function (m) { return lay(m, 'TFe', 'Fe'); },
            'FeO': function (m) { return lay(m, 'FeO'); },
            '< 5mm': function (m) { return coHatNhan(m, /^<5$/); },
            '> 40mm': function (m) { return coHatNhan(m, /^>40$/); },
        },
        keThua: ['Khoảng dưới R2', 'Khoảng trên R2'],
    },
    {
        khoi: 'QTH',
        /* Chỉ TLM D201C. Mẫu W ở silo QTH, mẫu D101C / D102C -> vào danh sách
           "bỏ qua" của phần Cả file */
        loc: function (m) { return /^quặng trung h(òa|oà)/.test(khoaSo(m.ten)) && RE_QTH_D201C.test(m.viTri); },
        cot: {
            '%SiO2 (QTH)': function (m) { return lay(m, 'SiO2'); },
            '%CaO (QTH)': function (m) { return lay(m, 'CaO'); },
        },
    },
    {
        khoi: 'HLC',
        loc: function (m) { return /^quặng hồi lò cao/.test(khoaSo(m.ten)) && RE_SILO_DAY_CHUYEN.test(m.viTri); },
        cot: { '%SiO2 (HLC)': function (m) { return lay(m, 'SiO2'); } },
    },
    {
        khoi: 'vôi nung',
        loc: function (m) { return /vôi nung/.test(khoaSo(m.ten)) && RE_SILO_DAY_CHUYEN.test(m.viTri); },
        theoSilo: true,
        cot: { 'Cỡ hạt 0 - 3mm (VN) (%)': null, '% CaO (vôi) (12)': null, '% CaO (vôi) (13)': null },
    },
    {
        khoi: 'đo nung',
        loc: function (m) { return /dolomit nung/.test(khoaSo(m.ten)) && RE_SILO_DAY_CHUYEN.test(m.viTri); },
        cot: {
            'Cỡ hạt 0 - 3mm (ĐN) (%)': function (m) { return coHatThu(m, 0); },
            '%MgO': function (m) { return lay(m, 'MgO'); },
        },
    },
    {
        khoi: 'chất lượng than',                           /* than nghiền (than UHG AS...) */
        loc: function (m) { const t = khoaSo(m.ten); return /^than/.test(t) && !/cốc|coke/.test(t) && RE_SILO_DAY_CHUYEN.test(m.viTri); },
        cot: {
            'AK (than nghiền)': function (m) { return lay(m, 'Ak', 'AK'); },
            'V (Than nghiền)': function (m) { return lay(m, 'V'); },
            'Cỡ hạt 0,5-1mm (than nghiền)': function (m, nhac) { return coHatThan(m, nhac)[0]; },
            'Cỡ hạt < 0,5mm (than nghiền)': function (m, nhac) { return coHatThan(m, nhac)[1]; },
            'Cỡ hạt 0,5-3mm (than nghiền)': function (m, nhac) { return coHatThan(m, nhac)[2]; },
            'Cỡ hạt >3mm (than nghiền)': function (m, nhac) { return coHatThan(m, nhac)[3]; },
        },
        cotMoi: ['Cỡ hạt 0,5-1mm (than nghiền)'],
    },
    {
        khoi: 'chất lượng than_1',                         /* than cốc */
        loc: function (m) { return /^than (cốc|coke)/.test(khoaSo(m.ten)) && RE_SILO_DAY_CHUYEN.test(m.viTri); },
        cot: {
            'Ak (than coke)': function (m) { return lay(m, 'Ak', 'AK'); },
            'V (than coke)': function (m) { return lay(m, 'V'); },
            'Cỡ hạt 0,5-1mm (than coke)': function (m, nhac) { return coHatThan(m, nhac)[0]; },
            'Cỡ hạt < 0,5mm (than coke)': function (m, nhac) { return coHatThan(m, nhac)[1]; },
            'Cỡ hạt 0,5-3mm (than coke)': function (m, nhac) { return coHatThan(m, nhac)[2]; },
            'Cỡ hạt >3mm (than coke)': function (m, nhac) { return coHatThan(m, nhac)[3]; },
        },
        cotMoi: ['Cỡ hạt 0,5-1mm (than coke)'],
    },
];

/** "Than UHG AS @ Silo 15+16 (62)" — đếm mẫu theo vật liệu + vị trí, để ghi chú. */
function demNguon(dsMau) {
    const dem = new Map();
    for (const m of dsMau) { const k = m.ten + ' @ ' + (m.viTri || '?'); dem.set(k, (dem.get(k) || 0) + 1); }
    return [...dem].map(function (x) { return x[0] + ' (' + x[1] + ')'; }).join(', ');
}

/** Các ngày từ tu tới den (tính cả hai đầu), 'YYYY-MM-DD'. */
function cacNgayTu(tu, den) {
    const ra = [];
    for (let t = Date.parse(tu + 'T00:00:00Z'), het = Date.parse(den + 'T00:00:00Z'); t <= het; t += 86400000) {
        ra.push(new Date(t).toISOString().slice(0, 10));
    }
    return ra;
}

/** Một quy tắc + các mẫu của nó -> { phan, canhBao, loi, ghiChu }.
 *  khoang = [ngày đầu, ngày cuối] có mẫu của CẢ phiếu: ngày trong khoảng mà khối
 *  không có mẫu nào -> phan.ngay_trong (nạp xong ngày đó TRỐNG, không giữ số sheet). */
function dungPhanKcs(qt, dsMau, dc, ctx, khoang) {
    const canhBao = [], ghiChu = [], loi = [];
    const cotKhoi = ctx.danhMuc.get(qt.khoi);
    if (!cotKhoi) {
        return { phan: null, loi: loi, ghiChu: ghiChu,
            canhBao: ['Dashboard chưa có khối "' + qt.khoi + '" — bỏ ' + dsMau.length + ' mẫu: ' + demNguon(dsMau)] };
    }
    /* Nhắc cùng loại (khác nhau mỗi phần ví dụ trong ngoặc) chỉ hiện một lần, kèm
       số lần gặp. muc 'tin' -> ghi chú (xanh), không thì cảnh báo (vàng). */
    const nhacDem = new Map();
    const nhac = function (s, muc) {
        const loai = s.replace(/\(.*?\)/g, '');
        const x = nhacDem.get(loai);
        if (x) x.n++; else nhacDem.set(loai, { chu: s, n: 1, tin: muc === 'tin' });
    };

    /* Cột của quy tắc mà dashboard có (so tên không phân biệt hoa thường); cột
       nằm trong qt.cotMoi thì dù dashboard chưa có vẫn gửi (máy chủ tạo) */
    const tenThat = function (c) { return cotKhoi.find(function (x) { return khoaSo(x) === khoaSo(c); }); };
    const cot = [], khoaQt = [], ham = [], moi = [];
    for (const c of Object.keys(qt.cot)) {
        const t = tenThat(c);
        if (t || (qt.cotMoi && qt.cotMoi.indexOf(c) >= 0)) {
            if (!t) moi.push(cot.length);
            cot.push(t || c); khoaQt.push(c); ham.push(qt.cot[c]);
        } else canhBao.push('Khối ' + qt.khoi + ' trên dashboard không có cột "' + c + '" — bỏ cột này');
    }
    const keThua = (qt.keThua || []).map(tenThat).filter(Boolean);

    let cacSilo = [];
    if (qt.theoSilo) {
        /* vôi nung: số silo nhỏ -> cột "(12)", lớn -> "(13)" (đúng tên silo của TK3, TK4) */
        cacSilo = [...new Set(dsMau.map(function (m) {
            const s = m.viTri.match(/silo ?(\d+)/i);
            m.silo = s ? Number(s[1]) : null;
            return m.silo;
        }).filter(function (s) { return s !== null; }))].sort(function (x, y) { return x - y; });
        if (cacSilo.length > 2) canhBao.push('Vôi nung có ' + cacSilo.length + ' silo (' + cacSilo.join(', ') + ') — chỉ lấy hai silo đầu');
        if (cacSilo.length && (cacSilo[0] !== 12 || (cacSilo[1] !== undefined && cacSilo[1] !== 13))) {
            canhBao.push('Vôi nung: silo ' + cacSilo[0] + ' -> cột "% CaO (vôi) (12)"'
                + (cacSilo[1] !== undefined ? ', silo ' + cacSilo[1] + ' -> cột "% CaO (vôi) (13)"' : '') + ' — kiểm lại cho đúng');
        }
    }

    /* MỖI CA MỘT HÀNG: mọi lần kiểm tra cùng ngày + ca + kíp -> trung bình cộng
       từng chỉ tiêu. h[3] = số mẫu của ca (chỉ để ghi chú, không gửi) */
    const hang = [];
    for (const ms of nhomTheoCa(dsMau).values()) {
        let gt;
        if (qt.theoSilo) {
            const g = hangVoiNung(ms, cacSilo);
            gt = khoaQt.map(function (k) { return g[k] === undefined ? null : g[k]; });
        } else {
            gt = ham.map(function (f) { return trungBinh(ms.map(function (m) { return f(m, nhac); })); });
        }
        hang.push([ms[0].ngay, ms[0].kip, gt, ms.length]);
    }

    /* Bỏ ca không có số nào (vd ca chỉ đo độ ẩm) */
    const coSo = hang.filter(function (h) { return h[2].some(function (v) { return v !== null; }); });
    for (const x of nhacDem.values()) (x.tin ? ghiChu : canhBao).push(x.chu + (x.n > 1 ? ' — gặp ' + x.n + ' mẫu' : ''));
    if (!coSo.length) return { phan: null, canhBao: canhBao, loi: loi, ghiChu: ['Không có mẫu nào có số: ' + demNguon(dsMau)] };
    const soMau = coSo.reduce(function (a, h) { return a + h[3]; }, 0);
    ghiChu.push('Lấy từ: ' + demNguon(dsMau) + ' — ' + soMau + ' mẫu thành ' + coSo.length
        + ' hàng, mỗi ca một hàng (trung bình cộng các lần kiểm tra trong ca)'
        + (coSo.length < hang.length ? '; bỏ ' + (hang.length - coSo.length) + ' ca không có chỉ tiêu nào của khối' : ''));

    /* Cột mới mà cả phần không có số nào (vd phiếu toàn cỡ hạt than 3 số): không gửi */
    const boCot = new Set(moi.filter(function (j) { return coSo.every(function (h) { return h[2][j] === null; }); }));
    for (const j of moi) {
        if (!boCot.has(j)) ghiChu.push('Cột "' + cot[j] + '" chưa có trên dashboard — nạp lần đầu máy chủ tạo cột này');
    }
    const giuCot = function (v, j) { return !boCot.has(j); };

    const phan = { day_chuyen: dc, khoi: qt.khoi, cot: cot.filter(giuCot).concat(keThua), hang: coSo.map(function (h) {
        return [h[0], h[1], h[2].filter(giuCot).concat(keThua.map(function () { return null; }))];
    }) };
    if (keThua.length) phan.keThua = keThua;
    const coNgay = new Set(phan.hang.map(function (h) { return h[0]; }));
    const trong = cacNgayTu(khoang[0], khoang[1]).filter(function (d) { return !coNgay.has(d); });
    if (trong.length) {
        phan.ngay_trong = trong;
        ghiChu.push(trong.length + ' ngày trong phiếu không có mẫu của khối này ('
            + trong.map(function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7); }).join(', ')
            + ') — nạp xong các ngày đó để TRỐNG, không giữ số Google Sheet cũ');
    }
    return { phan: phan, canhBao: canhBao, loi: loi, ghiChu: ghiChu };
}

const MAU_KCS = {
    id: 'kcs-bk',
    ten: 'Phiếu kết quả kiểm tra đầu vào và sản phẩm (xuất từ BK)',

    nhanDien: function (trang) {
        for (let i = 0; i < Math.min(40, trang.o.length); i++) if (laTieuDeKcs(trang.o[i])) return true;
        return false;
    },

    /** Một trang phiếu BK -> MẢNG kết quả, mỗi khối dashboard một phần
     *  ({ phan, canhBao, loi, ghiChu } như MAU_CHUAN.doc). Lỗi / ghi chú của cả
     *  file nằm ở một kết quả đầu riêng có chung: true (không có phan). */
    doc: function (trang, ctx) {
        const loiChung = [], ghiChung = [], canhChung = [];
        const tim = timDayChuyenKcs(trang.o);
        let dc;
        if (!tim) {
            dc = ctx.chon.dc;
            canhChung.push('Không thấy tên phân xưởng ("PX TK3...") ở đầu phiếu — dùng dây chuyền chọn ở bước 2: ' + dc + '. Kiểm lại cho đúng!');
        } else if (tim.so === '3' || tim.so === '4') {
            dc = 'TK' + tim.so;
            ghiChung.push('Phiếu BK của ' + dc + ' ("' + tim.chu + '")');
        } else {
            return [{ chung: true, phan: null, canhBao: [], ghiChu: [],
                loi: ['Phiếu của PX TK' + tim.so + ' ("' + tim.chu + '") — dashboard chỉ có dây chuyền TK3 và TK4'] }];
        }
        const chung = { chung: true, phan: null, canhBao: canhChung, ghiChu: ghiChung, loi: loiChung };

        const dsMau = docMauKcs(trang.o, ctx.homNay, loiChung);
        if (loiChung.length > 20) loiChung.splice(20, loiChung.length - 20, '... và ' + (loiChung.length - 20) + ' lỗi nữa');
        if (!dsMau.length) { loiChung.push('Không đọc được mẫu nào trong phiếu'); return [chung]; }

        const ngay = dsMau.map(function (m) { return m.ngay; }).sort();
        const khoang = [ngay[0], ngay[ngay.length - 1]];
        const ketQua = [chung], daDung = new Set();
        for (const qt of QUY_TAC_KCS) {
            const ms = dsMau.filter(function (m) { return !daDung.has(m) && qt.loc(m); });
            ms.forEach(function (m) { daDung.add(m); });
            if (ms.length) ketQua.push(dungPhanKcs(qt, ms, dc, ctx, khoang));
        }
        ghiChung.push('Đọc được ' + dsMau.length + ' mẫu, ngày ' + ngayVN(khoang[0]) + ' → ' + ngayVN(khoang[1]));
        const boQua = dsMau.filter(function (m) { return !daDung.has(m); });
        if (boQua.length) {
            ghiChung.push('Bỏ qua ' + boQua.length + ' mẫu không dùng cho biểu đồ (vật liệu không có biểu đồ; lấy ngoài silo của '
                + 'dây chuyền; QTH ngoài TLM D201C; QTK ngoài TLM thành phẩm): ' + demNguon(boQua));
        }
        if (ketQua.length === 1) loiChung.push('Phiếu không có vật liệu nào có biểu đồ trên dashboard');
        return ketQua;
    },
};

/** Các dạng file, thứ tự = thứ tự thử (xem đầu file). */
export const CAC_MAU = [MAU_KCS, MAU_CHUAN];
