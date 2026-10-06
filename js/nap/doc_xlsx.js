/* =============================================================================
 * js/nap/doc_xlsx.js — ĐỌC FILE EXCEL (.xlsx) NGAY TRÊN TRÌNH DUYỆT
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   docXlsx(arrayBuffer) -> các trang tính, mỗi trang là một bảng 2 chiều giá
 *   trị ô. File KHÔNG rời máy người nạp ở bước này — chỉ các con số đã đọc mới
 *   được gửi lên (js/nap/nap_lieu.js).
 *   Không dùng thư viện ngoài: thư viện đọc Excel phổ biến (SheetJS) bản trên
 *   npm đã cũ, có lỗ hổng đã biết; tự đọc chỉ cần ~250 dòng vì ta chỉ cần GIÁ TRỊ ô.
 *
 * FILE .xlsx LÀ GÌ
 *   Một file ZIP chứa các file XML:
 *     xl/workbook.xml              tên + thứ tự các trang tính
 *     xl/_rels/workbook.xml.rels   trang tính nào nằm ở file XML nào
 *     xl/worksheets/sheet1.xml     các ô của một trang: <c r="B2" t="s"><v>3</v></c>
 *     xl/sharedStrings.xml         mọi chuỗi chữ; ô chữ chỉ ghi SỐ THỨ TỰ chuỗi
 *     xl/styles.xml                định dạng ô — cần để biết ô số nào là NGÀY
 *   Excel lưu ngày là SỐ NGÀY kể từ 30/12/1899 (vd 46266 = 01/09/2026); chỉ nhờ
 *   định dạng ô mới phân biệt được với số thường.
 *
 * KẾT QUẢ
 *   [{ ten: 'TK3 QTK', an: false, o: [[ô A1, ô B1...], [ô A2...], ...], gop: ['A2:A9'] }]
 *   Giá trị ô:
 *     số                     56.2 (làm tròn 15 chữ số như Excel hiển thị)
 *     chữ                    'Hỏng' — ô lỗi công thức cũng là chữ: '#DIV/0!'
 *     ô định dạng ngày       '2026-09-01', '2026-09-01 08:30', giờ trơn '08:30'
 *     đúng / sai             'TRUE' / 'FALSE'
 *     trống                  null
 *   o[i] là hàng i + 1 của Excel, o[i][j] là cột j + 1 (A = 0). gop = các vùng
 *   GỘP Ô (merge) — chỉ ô góc trên-trái có giá trị, các ô còn lại là null.
 *
 * GIỚI HẠN: chỉ .xlsx (Excel 2007 trở đi). File .xls đời cũ: mở bằng Excel rồi
 * "Lưu thành" .xlsx. Cần trình duyệt có DecompressionStream (Chrome/Edge 103+,
 * Firefox 113+, Safari 16.4+).
 * ===========================================================================*/

/* ---------------------------------------------------------------------------
 * ZIP
 * ------------------------------------------------------------------------- */

/** Đọc số nguyên 2 / 4 byte (little-endian) ở vị trí i. */
function u16(b, i) { return b[i] | (b[i + 1] << 8); }
function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }

const LOI_KHONG_PHAI_XLSX = 'Không phải file .xlsx. File .xls đời cũ: mở bằng Excel rồi chọn Lưu thành (Save As) .xlsx';

/** Mục lục của file ZIP (nằm ở CUỐI file) -> Map<tên file, { pt, nen, vt }>:
 *  pt = kiểu nén (0 = không nén, 8 = deflate), nen = số byte đã nén,
 *  vt = vị trí phần đầu của file đó trong ZIP. */
function mucLucZip(b) {
    let e = -1;
    /* Bản ghi kết thúc (chữ ký 0x06054b50) nằm trong 22 + 65.535 byte cuối */
    for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
        if (u32(b, i) === 0x06054b50) { e = i; break; }
    }
    if (e < 0) throw new Error(LOI_KHONG_PHAI_XLSX);
    const so = u16(b, e + 10);
    let p = u32(b, e + 16);
    const td = new TextDecoder();
    const ra = new Map();
    for (let k = 0; k < so; k++) {
        if (u32(b, p) !== 0x02014b50) throw new Error('File .xlsx bị hỏng (mục lục ZIP sai)');
        const dn = u16(b, p + 28), dx = u16(b, p + 30), dc = u16(b, p + 32);
        const nen = u32(b, p + 20);
        if (nen === 0xFFFFFFFF) throw new Error('File quá lớn (ZIP64) — chia nhỏ file');
        ra.set(td.decode(b.subarray(p + 46, p + 46 + dn)), { pt: u16(b, p + 10), nen: nen, vt: u32(b, p + 42) });
        p += 46 + dn + dx + dc;
    }
    return ra;
}

/** Lấy nội dung (chữ UTF-8) của một file trong ZIP; không có -> null. */
async function docTrongZip(b, muc, ten) {
    const m = muc.get(ten);
    if (!m) return null;
    const dau = m.vt + 30 + u16(b, m.vt + 26) + u16(b, m.vt + 28);
    let du = b.subarray(dau, dau + m.nen);
    if (m.pt === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt này quá cũ, không giải nén được — dùng Chrome hoặc Edge bản mới');
        const luong = new Blob([du]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        du = new Uint8Array(await new Response(luong).arrayBuffer());
    } else if (m.pt !== 0) {
        throw new Error('File nén theo kiểu lạ (' + m.pt + ')');
    }
    return new TextDecoder().decode(du);
}

/* ---------------------------------------------------------------------------
 * XML — chỉ cần vài thẻ quen thuộc nên dò bằng biểu thức chính quy, không
 * dựng cây DOM (chạy được cả trong Node để thử nghiệm)
 * ------------------------------------------------------------------------- */

const THUC_THE = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Giải mã chữ trong XML: &amp; &lt; &#225; &#xE1;... và kiểu _x000D_ mà
 *  Excel dùng cho ký tự điều khiển. */
function giaiMa(s) {
    return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, function (m, e) {
        if (e[0] !== '#') return THUC_THE[e];
        return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    }).replace(/_x([0-9A-Fa-f]{4})_/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); });
}

/** Giá trị thuộc tính ten trong phần mở thẻ, vd thuocTinh(' r="B2" t="s"', 't') -> 's'. */
function thuocTinh(the, ten) {
    const m = the.match(new RegExp('(?:^|\\s)' + ten.replace(':', '\\:') + '="([^"]*)"'));
    return m ? giaiMa(m[1]) : null;
}

/** Ghép chữ của mọi thẻ <t> trong một đoạn (bỏ phần phiên âm <rPh> của tiếng Nhật). */
function chuTrong(doan) {
    let ra = '';
    const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    const s = doan.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let m;
    while ((m = re.exec(s))) ra += giaiMa(m[1]);
    return ra;
}

/** 'B12' -> số thứ tự cột 2 (A = 1, Z = 26, AA = 27). */
function soCot(ref) {
    let n = 0;
    for (let i = 0; i < ref.length; i++) {
        const c = ref.charCodeAt(i);
        if (c < 65 || c > 90) break;
        n = n * 26 + (c - 64);
    }
    return n;
}

/* ---------------------------------------------------------------------------
 * NGÀY GIỜ
 * ------------------------------------------------------------------------- */

/* Mã định dạng có sẵn của Excel là ngày / giờ (danh sách theo chuẩn ECMA-376) */
const DD_NGAY_CO_SAN = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 57, 58]);
const DD_GIO_CO_SAN = new Set([18, 19, 20, 21, 32, 33, 45, 46, 47, 55, 56]);

/** Mã định dạng tự đặt (vd 'dd/mm/yyyy', 'h:mm', '0.00') thuộc loại nào:
 *  'ngay' (có ngày, có thể kèm giờ), 'gio' (chỉ giờ) hoặc null (số thường).
 *  Bỏ phần trong ngoặc kép, ký tự thoát \x, và [màu] / [$-409] trước khi dò
 *  các chữ d m y h s. */
function loaiDinhDang(ma) {
    const s = String(ma).replace(/"[^"]*"/g, '').replace(/\\./g, '')
        .replace(/\[(?![hms]+\])[^\]]*\]/gi, '').toLowerCase();
    if (/[dy]/.test(s)) return 'ngay';
    if (/[hs]/.test(s)) return 'gio';
    if (/m/.test(s) && !/general/.test(s)) return 'ngay';
    return null;
}

/** Số ngày kiểu Excel -> chữ: 'ngay' -> '2026-09-01' (kèm ' 08:30' nếu có giờ
 *  lẻ), 'gio' -> '08:30'. he1904: file đặt hệ ngày 1904 (Excel Mac đời cũ). */
function soSangNgay(v, loai, he1904) {
    const giay = Math.round((v + (he1904 ? 1462 : 0)) * 86400);
    const iso = new Date(Date.UTC(1899, 11, 30) + giay * 1000).toISOString();
    const gio = iso.slice(11, 16);
    if (loai === 'gio') return gio;
    return iso.slice(0, 10) + (gio !== '00:00' ? ' ' + gio : '');
}

/* ---------------------------------------------------------------------------
 * ĐỌC TỪNG PHẦN CỦA FILE
 * ------------------------------------------------------------------------- */

/** sharedStrings.xml -> mảng chuỗi (ô chữ t="s" trỏ tới đây theo số thứ tự). */
function docChuoiChung(xml) {
    const ra = [];
    if (!xml) return ra;
    const re = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g;
    let m;
    while ((m = re.exec(xml))) ra.push(m[1] ? chuTrong(m[1]) : '');
    return ra;
}

/** styles.xml -> mảng: kiểu ô thứ i (thuộc tính s="i" của ô) là 'ngay' / 'gio' / null. */
function docKieuO(xml) {
    if (!xml) return [];
    const tuDat = {};
    const reF = /<numFmt\b([^>]*?)\/?>/g;
    let m;
    while ((m = reF.exec(xml))) tuDat[thuocTinh(m[1], 'numFmtId')] = thuocTinh(m[1], 'formatCode');
    const khoi = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
    const ra = [];
    if (!khoi) return ra;
    const reX = /<xf\b([^>]*?)(?:\/>|>)/g;
    while ((m = reX.exec(khoi[1]))) {
        const id = +thuocTinh(m[1], 'numFmtId') || 0;
        ra.push(DD_NGAY_CO_SAN.has(id) ? 'ngay' : DD_GIO_CO_SAN.has(id) ? 'gio'
            : tuDat[id] != null ? loaiDinhDang(tuDat[id]) : null);
    }
    return ra;
}

/** Giá trị một ô từ phần mở thẻ <c ...> và phần thân của nó. */
function giaTriO(the, than, chuoi, kieu, he1904) {
    const t = thuocTinh(the, 't') || 'n';
    if (t === 'inlineStr') { const s = chuTrong(than); return s === '' ? null : s; }
    const mv = than.match(/<v>([\s\S]*?)<\/v>/);
    if (!mv) return null;
    const v = giaiMa(mv[1]);
    if (t === 's') { const s = chuoi[+v]; return s === undefined || s === '' ? null : s; }
    if (t === 'str' || t === 'e') return v === '' ? null : v;
    if (t === 'b') return v === '1' ? 'TRUE' : 'FALSE';
    if (t === 'd') return v.slice(0, 16).replace('T', ' ');
    const so = Number(v);
    if (!Number.isFinite(so)) return v;
    const loai = kieu[+thuocTinh(the, 's') || 0];
    if (loai) return soSangNgay(so, loai, he1904);
    return +so.toPrecision(15);              /* 56.199999999999996 -> 56.2 */
}

/** Một trang tính (sheetN.xml) -> { o: bảng 2 chiều, gop: ['A1:B2', ...] }. */
function docTrang(xml, chuoi, kieu, he1904) {
    const o = [];
    const reHang = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    const reO = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let mh, hangTruoc = 0;
    while ((mh = reHang.exec(xml))) {
        const r = +thuocTinh(mh[1], 'r') || hangTruoc + 1;
        hangTruoc = r;
        if (!mh[2]) continue;
        const hang = [];
        let mo, cotTruoc = 0;
        reO.lastIndex = 0;
        while ((mo = reO.exec(mh[2]))) {
            const ref = thuocTinh(mo[1], 'r');
            const c = ref ? soCot(ref) : cotTruoc + 1;
            cotTruoc = c;
            const v = giaTriO(mo[1], mo[2] || '', chuoi, kieu, he1904);
            if (v !== null) hang[c - 1] = v;
        }
        if (hang.length) o[r - 1] = hang;
    }
    /* Lấp chỗ trống: hàng thiếu -> [], ô thiếu -> null */
    for (let i = 0; i < o.length; i++) {
        if (!o[i]) o[i] = [];
        for (let j = 0; j < o[i].length; j++) if (o[i][j] === undefined) o[i][j] = null;
    }
    const gop = [];
    const reG = /<mergeCell\b([^>]*?)\/?>/g;
    let mg;
    while ((mg = reG.exec(xml))) { const ref = thuocTinh(mg[1], 'ref'); if (ref) gop.push(ref); }
    return { o: o, gop: gop };
}

/** Đường dẫn trong ZIP của một trang, từ Target trong workbook.xml.rels:
 *  'worksheets/sheet1.xml' (tính từ thư mục xl/) hoặc '/xl/worksheets/sheet1.xml'. */
function duongDan(target) {
    if (target[0] === '/') return target.slice(1);
    const phan = ('xl/' + target).split('/'), ra = [];
    for (const p of phan) { if (p === '..') ra.pop(); else if (p && p !== '.') ra.push(p); }
    return ra.join('/');
}

/**
 * ĐIỂM VÀO — đọc cả file.
 *   buf  ArrayBuffer (File.arrayBuffer()) hoặc Uint8Array
 * Ra: [{ ten, an (trang bị ẩn), o, gop }] theo đúng thứ tự trang trong file.
 */
export async function docXlsx(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const muc = mucLucZip(b);
    const wb = await docTrongZip(b, muc, 'xl/workbook.xml');
    if (!wb) throw new Error(LOI_KHONG_PHAI_XLSX);
    const [rels, ss, st] = await Promise.all([
        docTrongZip(b, muc, 'xl/_rels/workbook.xml.rels'),
        docTrongZip(b, muc, 'xl/sharedStrings.xml'),
        docTrongZip(b, muc, 'xl/styles.xml'),
    ]);
    const chuoi = docChuoiChung(ss), kieu = docKieuO(st);
    const he1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(wb);

    const dich = {};
    const reR = /<Relationship\b([^>]*?)\/?>/g;
    let m;
    while ((m = reR.exec(rels || ''))) dich[thuocTinh(m[1], 'Id')] = thuocTinh(m[1], 'Target');

    const ra = [];
    const reS = /<sheet\b([^>]*?)\/?>/g;
    while ((m = reS.exec(wb))) {
        const target = dich[thuocTinh(m[1], 'r:id')];
        if (!target) continue;
        const xml = await docTrongZip(b, muc, duongDan(target));
        if (xml === null) continue;              /* trang biểu đồ (chartsheet)... */
        const trang = docTrang(xml, chuoi, kieu, he1904);
        ra.push({ ten: thuocTinh(m[1], 'name') || '', an: !!thuocTinh(m[1], 'state') && thuocTinh(m[1], 'state') !== 'visible',
                  o: trang.o, gop: trang.gop });
    }
    if (!ra.length) throw new Error('File không có trang tính nào');
    return ra;
}
