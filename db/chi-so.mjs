/* =============================================================================
 * db/chi-so.mjs — /api/v2/chi-so: CÁC CON SỐ CỦA TRANG CHỦ, MÁY CHỦ TÍNH SẴN
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Trang chủ có: dải chỉ số chạy ngang, 4 thẻ mục Sản lượng, biểu đồ sản lượng
 *   tháng và 3 bảng cảnh báo. Trước đây các số này chỉ có SAU KHI trình duyệt
 *   tải xong số liệu TK3 + TK4 rồi tự tính. Nay máy chủ tính sẵn và trả một gói
 *   ~4 KB -> trang chủ có số ngay khi mở.
 *
 * TÍNH BẰNG CHÍNH MÃ CỦA TRÌNH DUYỆT
 *   File này import thẳng hai file mà trình duyệt cũng chạy:
 *     js/chung/chi_so.js  công thức + ngưỡng cảnh báo  -> globalThis.XTK2_CHI_SO
 *     js/api/api_v2.js    dựng bảng ngang từ gói tháng -> globalThis.XTK2_API_V2
 *   Cùng một đoạn mã chạy ở cả hai nơi, nên số máy chủ tính và số trình duyệt tự
 *   tính không thể lệch nhau. Sửa ngưỡng / công thức: chỉ sửa chi_so.js rồi deploy.
 *
 * ĐỌC ÍT, TÍNH ÍT
 *   Mọi chỉ số trên đều là của THÁNG HIỆN TẠI -> chỉ đọc gói tháng này của TK3 và
 *   TK4 (gói tháng trước chỉ dùng khi tháng này chưa có gói) + danh mục cột.
 *   Chỉ dựng lại những khối mà phép tính đọc tới, và dựng bảng "thưa" (xem
 *   apiV2BangNgang trong api_v2.js) -> chỉ tốn vài ms CPU.
 *
 *   Bổ sung thêm vài ý trong file, file này là dạng cache database trước khi nạp
 *   để tránh việc tải nguyên gói dữ liệu quá nặng xuống, gây delay dữu liệu lần đầu
 *   cho người sử dụng
 * ===========================================================================*/

import '../js/api/api_v2.js';          /* -> globalThis.XTK2_API_V2 */
import '../js/chung/chi_so.js';        /* -> globalThis.XTK2_CHI_SO */
import { lapDanhMuc } from './goi-v2.mjs';

const LECH_GIO_VN_MS = 7 * 3600 * 1000;    /* giờ Việt Nam = UTC + 7 */
const hai = n => (n < 10 ? '0' : '') + n;   /* 5 -> '05' */

/** "Bây giờ" theo giờ Việt Nam, giả dạng một đối tượng Date — chỉ có 3 hàm mà
 *  chi_so.js dùng: getFullYear(), getMonth(), getDate().
 *  Cần vì máy chủ Cloudflare chạy giờ UTC: 6 giờ sáng ở VN vẫn là "hôm qua" theo
 *  UTC, tính "luỹ kế đến hôm nay" sẽ hụt một ngày. */
export function gioVN(ms) {
    const d = new Date(ms + LECH_GIO_VN_MS);
    return { getFullYear: () => d.getUTCFullYear(), getMonth: () => d.getUTCMonth(), getDate: () => d.getUTCDate() };
}

/** 'YYYY-MM' của một ngày. */
function thangCua(now) { return now.getFullYear() + '-' + hai(now.getMonth() + 1); }
/** Tháng liền trước: '2026-01' -> '2025-12'. */
function thangTruoc(t) {
    let [y, m] = t.split('-').map(Number);
    if (--m < 1) { m = 12; y--; }
    return y + '-' + hai(m);
}

/** Băm nhanh (djb2) -> chuỗi ngắn, dùng ghép ETag. */
function bam(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

/* Vân tay MÃ TÍNH = băm toàn bộ mã nguồn các hàm tính + bảng ngưỡng trong
   chi_so.js (XTK2_CHI_SO.maNguon). Sửa ngưỡng / công thức rồi deploy thì ETag
   đổi theo, trình duyệt không giữ mãi kết quả tính bằng ngưỡng cũ.
   Tính một lần rồi nhớ (mã không đổi trong suốt một bản deploy). */
let vanTayMa = null;
function vanTayMaTinh() {
    if (vanTayMa === null) vanTayMa = bam(globalThis.XTK2_CHI_SO.maNguon());
    return vanTayMa;
}

/** Bước 1 của /api/v2/chi-so: tính ETag, chưa tính chỉ số.
 *  Chỉ đọc cột khoá + phien của tối đa 4 gói tháng (TK3/TK4 x tháng này/trước).
 *  ETag = ngày hôm nay + vân tay các gói + vân tay mã tính:
 *    - NGÀY phải có mặt vì kết quả đổi theo ngày dù số liệu không đổi (vd hệ
 *      số lợi dụng chia cho số ngày đã qua trong tháng);
 *    - gói được dựng lại (có số mới) -> ETag đổi;
 *    - deploy công thức mới -> ETag đổi.
 *  Ra: { now, thang, truoc, etag } — truyền nguyên cho docChiSo(). */
export async function docPhienChiSo(db, luc) {
    const now = gioVN(luc);
    const thang = thangCua(now), truoc = thangTruoc(thang);
    const { results } = await db.prepare(`SELECT tuyen, thang, phien, ds_cot FROM goi_thang
        WHERE tuyen IN ('tk3', 'tk4') AND thang IN (?1, ?2) ORDER BY tuyen, thang`).bind(thang, truoc).all();
    const ngay = thang + '-' + hai(now.getDate());
    const vt = (results || []).map(x => x.tuyen + x.thang + ':' + x.phien + ':' + x.ds_cot).join('|');
    return { now: now, thang: thang, truoc: truoc,
             etag: '"cs-' + ngay + '-' + bam(vt) + '-' + vanTayMaTinh() + '"' };
}

/** Bước 2: đọc gói, dựng lại bảng ngang (chỉ các khối cần), chạy tinhChiSo().
 *  Ra: chuỗi JSON { status, nguon, ngay, ribbon, sanLuongNgay, canhBao }.
 *  Ra null khi có gói tháng lệch danh mục cột (đang dựng lại) -> nơi gọi trả
 *  503, trình duyệt tự tính như trước. */
export async function docChiSo(db, p) {
    const [goi, ct] = await db.batch([
        db.prepare(`SELECT tuyen, thang, ds_cot, json FROM goi_thang
            WHERE tuyen IN ('tk3', 'tk4') AND thang IN (?1, ?2) ORDER BY tuyen, thang`).bind(p.thang, p.truoc),
        db.prepare('SELECT ma, khoi, cot_sheet FROM chi_tieu ORDER BY ma'),
    ]);
    const dm = lapDanhMuc(ct.results || []);
    const cacGoi = goi.results || [];
    if (cacGoi.some(g => g.ds_cot !== dm.vanTay)) return null;

    /* Chọn KHỐI cần dựng: khối có ít nhất một cột mà phép tính đọc tới
       (cotChiSoCanDoc). Dựng ĐỦ mọi cột của khối đó — không chỉ cột cần — để ô
       trùng tên giữa các khối vẫn đè nhau y như bảng đầy đủ ở trình duyệt. */
    const V2 = globalThis.XTK2_API_V2, CS = globalThis.XTK2_CHI_SO;
    const can = new Set(CS.cotChiSoCanDoc());
    const cotDu = dm.maGui.map(ma => dm.cot[ma]);      /* [[khối, tên cột], ...] theo số thứ tự cột */
    const khoiCan = new Set();
    for (const [k, c] of cotDu) {
        if (can.has(c) || can.has(V2.tenCot('Thời gian', k)) || can.has(V2.tenCot('Ca/kíp', k))) khoiCan.add(k);
    }
    /* Đánh số lại cột: chỉ giữ cột của khối cần. doi: số thứ tự cũ -> số mới */
    const doi = new Map(), cotGon = [];
    cotDu.forEach((c, i) => { if (khoiCan.has(c[0])) { doi.set(i, cotGon.length); cotGon.push(c); } });

    /* Dựng bảng ngang của một tuyến từ gói tháng (đã lọc cột) */
    const bang = tuyen => {
        const cua = cacGoi.filter(g => g.tuyen === tuyen);
        /* Tháng này chưa có gói thì lấy tháng trước — chỉ để bảng có đủ cột; các
           phép tính vẫn lọc đúng tháng này (ra 0 / "chưa có số" như trình duyệt) */
        const dung = cua.some(g => g.thang === p.thang) ? cua.filter(g => g.thang === p.thang) : cua;
        const thang = {};
        for (const g of dung) {
            const o = [];
            for (const x of JSON.parse(g.json)) {
                const j = doi.get(x[0]);
                if (j !== undefined) { x[0] = j; o.push(x); }
            }
            thang[g.thang] = o;
        }
        return V2.bangNgang({ cot: cotGon, thang: thang }, { thua: true });
    };
    const kq = CS.tinhChiSo(bang('tk3'), bang('tk4'), p.now);
    return JSON.stringify(Object.assign({ status: 'success', nguon: 'd1' }, kq));
}
