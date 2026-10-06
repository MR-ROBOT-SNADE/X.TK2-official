/* =============================================================================
 * js/nap/ghi_xlsx.js — TẠO FILE EXCEL (.xlsx) ĐƠN GIẢN NGAY TRÊN TRÌNH DUYỆT
 * =============================================================================
 * Dùng cho nút "Tải file mẫu" của trang nạp: hàng tiêu đề Ngày | Kíp | các cột
 * của khối, cột ngày định dạng dd/mm/yyyy, cột kíp chỉ cho chọn A/B/C, kèm một
 * trang "Hướng dẫn". Không cần thư viện ngoài.
 *
 * File .xlsx là một file ZIP gồm vài file XML (xem js/nap/doc_xlsx.js). Ở đây
 * ZIP được ghi ở chế độ KHÔNG NÉN (Excel mở bình thường; file mẫu chỉ vài KB).
 *
 * taoXlsx([{ ten: 'TK3 QTK', hang: [['Ngày', 'Kíp', 'R2'], ...], rong: [12, 6, 10],
 *            tieuDe: true, cotNgay: 0, cotKip: 1, gopChu: false }, ...]) -> Uint8Array
 *   hang    các hàng; ô là chữ, số, hoặc null
 *   rong    độ rộng từng cột (số ký tự)
 *   tieuDe  hàng đầu là tiêu đề: chữ đậm nền xanh, cố định khi cuộn
 *   cotNgay cột (0 = A) định dạng ngày + chỉ nhận ngày từ 2020; cotKip: chỉ nhận A/B/C
 *   gopChu  ô chữ tự xuống dòng (trang hướng dẫn)
 * ===========================================================================*/

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const DAU_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Thoát ký tự đặc biệt của XML. */
function x(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Số thứ tự cột (0 = A) -> chữ cột Excel: 0 -> 'A', 26 -> 'AA'. */
function chuCot(i) {
    let s = '';
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
    return s;
}

/* Kiểu ô (styles.xml, cellXfs): 0 thường, 1 tiêu đề, 2 ngày dd/mm/yyyy, 3 chữ xuống dòng */
const STYLES = DAU_XML + '<styleSheet xmlns="' + NS + '">'
    + '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FF0033A1"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="4">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>'
    + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/** XML của một trang tính. */
function xmlTrang(t) {
    const hang = t.hang || [];
    let s = DAU_XML + '<worksheet xmlns="' + NS + '" xmlns:r="' + NS_R + '">';
    if (t.tieuDe) {
        s += '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    }
    if (t.rong && t.rong.length) {
        s += '<cols>' + t.rong.map(function (w, i) {
            return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"'
                + (i === t.cotNgay ? ' style="2"' : '') + '/>';
        }).join('') + '</cols>';
    }
    s += '<sheetData>';
    hang.forEach(function (h, r) {
        s += '<row r="' + (r + 1) + '">';
        h.forEach(function (v, c) {
            if (v === null || v === undefined || v === '') return;
            const ref = chuCot(c) + (r + 1);
            const kieu = t.tieuDe && r === 0 ? 1 : c === t.cotNgay && typeof v === 'number' ? 2 : t.gopChu ? 3 : 0;
            const sAttr = kieu ? ' s="' + kieu + '"' : '';
            if (typeof v === 'number') s += '<c r="' + ref + '"' + sAttr + '><v>' + v + '</v></c>';
            else s += '<c r="' + ref + '"' + sAttr + ' t="inlineStr"><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
        });
        s += '</row>';
    });
    s += '</sheetData>';
    const kiem = [];
    /* 43831 = 01/01/2020 theo cách Excel đếm ngày */
    if (t.cotNgay !== undefined) {
        kiem.push('<dataValidation type="date" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1"'
            + ' errorTitle="Ngày" error="Nhập ngày dạng dd/mm/yyyy, từ năm 2020" sqref="' + chuCot(t.cotNgay) + '2:' + chuCot(t.cotNgay) + '5000">'
            + '<formula1>43831</formula1></dataValidation>');
    }
    if (t.cotKip !== undefined) {
        kiem.push('<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Kíp" error="Chỉ nhập A, B hoặc C"'
            + ' sqref="' + chuCot(t.cotKip) + '2:' + chuCot(t.cotKip) + '5000"><formula1>"A,B,C"</formula1></dataValidation>');
    }
    if (kiem.length) s += '<dataValidations count="' + kiem.length + '">' + kiem.join('') + '</dataValidations>';
    return s + '</worksheet>';
}

/* ---------------------------------------------------------------------------
 * ZIP không nén
 * ------------------------------------------------------------------------- */

/* Bảng tra CRC-32 (mã kiểm lỗi bắt buộc của mỗi file trong ZIP) */
const BANG_CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = BANG_CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

/** [{ ten, du: Uint8Array }] -> các byte của file ZIP (không nén, tên file UTF-8). */
function dongZip(cacFile) {
    const te = new TextEncoder();
    const phan = [], mucLuc = [];
    let viTri = 0;
    const so16 = function (v) { return [v & 255, (v >>> 8) & 255]; };
    const so32 = function (v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; };
    for (const f of cacFile) {
        const ten = te.encode(f.ten), crc = crc32(f.du), n = f.du.length;
        /* phiên bản 20, cờ 0x0800 = tên UTF-8, không nén, ngày 01/01/1980 (0x21) */
        const chung = [].concat(so16(20), so16(0x0800), so16(0), so16(0), so16(0x21), so32(crc), so32(n), so32(n), so16(ten.length));
        const dau = new Uint8Array([].concat(so32(0x04034b50), chung, so16(0)));
        phan.push(dau, ten, f.du);
        mucLuc.push(new Uint8Array([].concat(so32(0x02014b50), so16(20), chung, so16(0), so16(0), so16(0), so16(0), so32(0), so32(viTri))), ten);
        viTri += dau.length + ten.length + n;
    }
    const coML = mucLuc.reduce(function (a, b) { return a + b.length; }, 0);
    const ket = new Uint8Array([].concat(so32(0x06054b50), so16(0), so16(0), so16(cacFile.length), so16(cacFile.length),
        so32(coML), so32(viTri), so16(0)));
    const tat = phan.concat(mucLuc, [ket]);
    const ra = new Uint8Array(tat.reduce(function (a, b) { return a + b.length; }, 0));
    let p = 0;
    for (const b of tat) { ra.set(b, p); p += b.length; }
    return ra;
}

/** Tên trang tính hợp lệ cho Excel: bỏ ký tự cấm [ ] : * ? / \, tối đa 31 ký tự. */
export function tenTrangHopLe(s) {
    return String(s).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Trang';
}

/** ĐIỂM VÀO — xem dạng tham số ở đầu file. Ra: Uint8Array nội dung file .xlsx. */
export function taoXlsx(cacTrang) {
    const te = new TextEncoder();
    const n = cacTrang.length;
    const files = [
        { ten: '[Content_Types].xml', xml: DAU_XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            + cacTrang.map(function (t, i) {
                return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
            }).join('') + '</Types>' },
        { ten: '_rels/.rels', xml: DAU_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            + '</Relationships>' },
        { ten: 'xl/workbook.xml', xml: DAU_XML + '<workbook xmlns="' + NS + '" xmlns:r="' + NS_R + '"><sheets>'
            + cacTrang.map(function (t, i) {
                return '<sheet name="' + x(tenTrangHopLe(t.ten)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
            }).join('') + '</sheets></workbook>' },
        { ten: 'xl/_rels/workbook.xml.rels', xml: DAU_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + cacTrang.map(function (t, i) {
                return '<Relationship Id="rId' + (i + 1) + '" Type="' + NS_R + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
            }).join('')
            + '<Relationship Id="rId' + (n + 1) + '" Type="' + NS_R + '/styles" Target="styles.xml"/></Relationships>' },
        { ten: 'xl/styles.xml', xml: STYLES },
    ].concat(cacTrang.map(function (t, i) { return { ten: 'xl/worksheets/sheet' + (i + 1) + '.xml', xml: xmlTrang(t) }; }));
    return dongZip(files.map(function (f) { return { ten: f.ten, du: te.encode(f.xml) }; }));
}
