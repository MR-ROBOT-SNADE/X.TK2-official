/* =============================================================================
 * db/nhan-su.mjs — DANH SÁCH NHÂN SỰ 3 KÍP CỦA XƯỞNG (POST /api/nhan-su, GET /api/v2/nhan-su)
 * =============================================================================
 * VÌ SAO CÓ FILE NÀY
 *   Trước 20/10/2026 danh sách nằm trong các cột 'STT (A)', 'Mã nhân viên (A)'...
 *   của tab DATABASE (sheet TK3) — xưởng đổi người là phải chép tay sang, và danh
 *   sách đi nhờ gói số liệu /api/v2/tk3. Nay nhân sự là một nguồn RIÊNG, không dính
 *   gì tới TK3:
 *     sheet "Danh sách định biên nhân sự" của xưởng (tab NHÂN SỰ KIP A / B / C)
 *       -> apps-script/nhan-su.gs (dự án Apps Script riêng, mỗi giờ)
 *       -> POST /api/nhan-su  -> ghiNhanSu  -> bảng nhan_su_xuong (migrations/0009)
 *       -> GET /api/v2/nhan-su -> docNhanSu -> js/components/personnel.js
 *   Cột nhân sự trong tab DATABASE không còn được đọc (NHAN_SU_TU_SHEET trong
 *   db/chuan-hoa.mjs); bảng nhan_su cũ không còn ai ghi hay đọc.
 *
 * MỖI NGƯỜI CHỈ NHẬN ĐÚNG 3 Ô: họ tên, vị trí, trạng thái.
 *   Sheet của xưởng còn có ngày sinh, số điện thoại, lương, kỷ luật... Apps
 *   Script không gửi những thứ đó, và máy chủ cũng không có chỗ nhận: gói có
 *   trường lạ, hay hàng không đúng 3 ô, là bị từ chối.
 *
 * DẠNG GÓI ĐẨY LÊN
 *   { kip: { A: [[họ tên, vị trí, trạng thái], ...], B: [...], C: [...] }, ep?: true }
 *   - Thứ tự trong mảng = thứ tự trên sheet -> stt = 1, 2, 3... (trang web xếp
 *     theo stt, nên sơ đồ giữ đúng thứ tự xưởng sắp).
 *   - Kíp nào KHÔNG có trong gói thì giữ nguyên trong D1.
 *
 * BẢO VỆ KHỎI ĐỌC NHẦM SHEET
 *   - Mỗi kíp gửi lên phải có ít nhất GIOI_HAN_NS.toiThieu người.
 *   - Kíp đang có từ 10 người trở lên mà gói mới còn chưa tới một nửa -> từ chối
 *     (409): nhiều khả năng sheet bị đổi cột, lọc nhầm, chứ không phải nửa kíp
 *     nghỉ việc. Đúng là vậy thật thì Apps Script chạy dayNhanSuBatChap (gửi ep).
 *   - Gửi lại y nguyên danh sách: không dòng nào bị ghi -> ETag của /api/v2/nhan-su
 *     không đổi, trình duyệt không tải lại gì. Nên Apps Script đẩy mỗi giờ cũng rẻ.
 * ===========================================================================*/

import { LoiNap } from './nap-excel.mjs';
import { SQL_DONG_BO } from './dong-bo-d1.mjs';

/* Mã xưởng trong bảng nhan_su_xuong. Sau này thêm xưởng khác thì thêm mã. */
export const XUONG = 'XTK2';
/* Dòng sổ dong_bo của đường này — /api/trang-thai đọc để báo mục "nhanSu" */
export const DONG_BO_NHAN_SU = 'nhan-su';

export const GIOI_HAN_NS = {
    toiThieu: 5,        /* người tối thiểu mỗi kíp gửi lên */
    toiDa: 200,         /* người tối đa mỗi kíp */
    ten: 80,            /* ký tự tối đa của họ tên */
    viTri: 160,         /* ... của vị trí */
    trangThai: 40,      /* ... của trạng thái */
    tutGiam: 0.5,       /* còn dưới tỉ lệ này so với D1 -> nghi đọc sai, từ chối */
    coSoTutGiam: 10,    /* chỉ xét tụt giảm khi kíp đang có từ chừng này người */
};
const KIP = ['A', 'B', 'C'];

const SQL = {
    demTheoKip: 'SELECT kip, COUNT(*) AS n FROM nhan_su_xuong WHERE xuong = ?1 GROUP BY kip',
    /* Thêm / sửa người. Chỉ ghi dòng thật sự đổi (WHERE ... IS NOT ...).
       ?1 = [[kip, stt, họ tên, vị trí, trạng thái], ...]  ?2 = 'XTK2' */
    ghi: `INSERT INTO nhan_su_xuong (xuong, kip, stt, nhan_vien, vi_tri, trang_thai)
        SELECT ?2, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
               json_extract(value, '$[3]'), json_extract(value, '$[4]')
        FROM json_each(?1) WHERE true
        ON CONFLICT (xuong, kip, stt) DO UPDATE SET
            nhan_vien = excluded.nhan_vien, vi_tri = excluded.vi_tri, trang_thai = excluded.trang_thai
        WHERE nhan_su_xuong.nhan_vien IS NOT excluded.nhan_vien OR nhan_su_xuong.vi_tri IS NOT excluded.vi_tri
           OR nhan_su_xuong.trang_thai IS NOT excluded.trang_thai`,
    /* Xoá người không còn trong gói — CHỈ trong các kíp có gửi.
       ?1 như trên  ?2 = 'XTK2'  ?3 = ['A', 'B', ...] */
    xoaThua: `DELETE FROM nhan_su_xuong WHERE xuong = ?2 AND kip IN (SELECT value FROM json_each(?3))
        AND (kip || '|' || stt) NOT IN (
            SELECT json_extract(value, '$[0]') || '|' || json_extract(value, '$[1]') FROM json_each(?1))`,
    /* Cả danh sách thành MỘT chuỗi JSON — SQLite tự dựng, Function gần như không tốn CPU */
    doc: `SELECT coalesce(json_group_array(json_array(kip, stt, nhan_vien, vi_tri, trang_thai)), '[]') AS ds,
               COUNT(*) AS n
        FROM (SELECT kip, stt, nhan_vien, vi_tri, trang_thai FROM nhan_su_xuong WHERE xuong = ?1 ORDER BY kip, stt)`,
    nhatKy: `INSERT INTO nhat_ky_nap (luc, nguon, tuyen, so_gia_tri, ghi_chu) VALUES (?1, 'nhan-su', ?2, ?3, ?4)`,
};

function soDoi(kq) { return (kq && kq.meta && kq.meta.changes) || 0; }

/** Băm nhanh (FNV-1a) -> chuỗi ngắn, cho ETag. */
function bam(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
}

/** D1 chưa có bảng nhan_su_xuong (chưa chạy migrations/0009) -> lỗi dễ hiểu. */
function loiBang(e) {
    if (/no such table: nhan_su_xuong/.test(String(e && e.message))) {
        return new LoiNap('D1 chưa có bảng nhan_su_xuong — chạy npm run db:schema (migrations/0009) rồi thử lại', 503);
    }
    return e;
}

/** Ô chữ -> chuỗi gọn (NFC, gộp khoảng trắng); rỗng -> ''. Không phải chữ / quá dài -> LoiNap. */
function lamGon(v, toiDa, noi) {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'string') throw new LoiNap(noi + ' phải là chữ');
    const s = v.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (s.length > toiDa) throw new LoiNap(noi + ' dài quá ' + toiDa + ' ký tự');
    return s;
}

/** Kiểm gói. Ra { kip: Map<'A', [[kip, stt, họ tên, vị trí|null, trạng thái|null]]>, ep }.
 *  Sai ở đâu -> LoiNap nói rõ. */
export function kiemNhanSu(j) {
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new LoiNap('Không đọc được JSON');
    for (const k of Object.keys(j)) {
        if (k !== 'kip' && k !== 'ep') throw new LoiNap('Trường lạ "' + String(k).slice(0, 30) + '" — gói chỉ có "kip" (và "ep")');
    }
    if (!j.kip || typeof j.kip !== 'object' || Array.isArray(j.kip)) throw new LoiNap('Thiếu "kip"');
    const ra = new Map();
    for (const kip of Object.keys(j.kip)) {
        if (KIP.indexOf(kip) < 0) throw new LoiNap('Kíp lạ "' + kip.slice(0, 10) + '" — chỉ nhận A, B, C');
        const ds = j.kip[kip];
        if (!Array.isArray(ds)) throw new LoiNap('Kíp ' + kip + ': phải là mảng người');
        if (ds.length < GIOI_HAN_NS.toiThieu) {
            throw new LoiNap('Kíp ' + kip + ': chỉ có ' + ds.length + ' người (tối thiểu ' + GIOI_HAN_NS.toiThieu + ') — nghi đọc sai sheet, không ghi');
        }
        if (ds.length > GIOI_HAN_NS.toiDa) throw new LoiNap('Kíp ' + kip + ': quá ' + GIOI_HAN_NS.toiDa + ' người');
        ra.set(kip, ds.map(function (h, i) {
            const noi = 'Kíp ' + kip + ', người thứ ' + (i + 1);
            if (!Array.isArray(h) || h.length !== 3) throw new LoiNap(noi + ': phải đúng 3 ô [họ tên, vị trí, trạng thái]');
            const ten = lamGon(h[0], GIOI_HAN_NS.ten, noi + ': họ tên');
            if (!ten) throw new LoiNap(noi + ': thiếu họ tên');
            return [kip, i + 1, ten,
                lamGon(h[1], GIOI_HAN_NS.viTri, noi + ': vị trí') || null,
                lamGon(h[2], GIOI_HAN_NS.trangThai, noi + ': trạng thái') || null];
        }));
    }
    if (!ra.size) throw new LoiNap('Gói không có kíp nào');
    return { kip: ra, ep: j.ep === true };
}

/** POST /api/nhan-su — ghi danh sách nhân sự từ gói j.
 *  Ra: { so_nguoi, theo_kip: { A: n, ... }, so_ghi (dòng D1 đổi) } */
export async function ghiNhanSu(db, j, luc) {
    const { kip, ep } = kiemNhanSu(j);

    /* Chặn tụt giảm bất thường (xem đầu file) */
    let dangCo;
    try {
        const { results } = await db.prepare(SQL.demTheoKip).bind(XUONG).all();
        dangCo = new Map((results || []).map(x => [x.kip, x.n]));
    } catch (e) { throw loiBang(e); }
    if (!ep) {
        for (const [k, ds] of kip) {
            const cu = dangCo.get(k) || 0;
            if (cu >= GIOI_HAN_NS.coSoTutGiam && ds.length < cu * GIOI_HAN_NS.tutGiam) {
                throw new LoiNap('Kíp ' + k + ': sheet chỉ còn ' + ds.length + ' người, web đang có ' + cu
                    + ' — nghi đọc sai sheet, KHÔNG ghi. Nếu đúng là vậy: chạy dayNhanSuBatChap trong Apps Script', 409);
            }
        }
    }

    const hang = [];
    const theoKip = {};
    for (const [k, ds] of kip) { hang.push(...ds); theoKip[k] = ds.length; }
    const hJson = JSON.stringify(hang);
    /* Ghi người + xoá người thừa + sổ dong_bo: MỘT giao dịch */
    const kq = await db.batch([
        db.prepare(SQL.ghi).bind(hJson, XUONG),
        db.prepare(SQL.xoaThua).bind(hJson, XUONG, JSON.stringify([...kip.keys()])),
        db.prepare(SQL_DONG_BO.ghiDongBo).bind(DONG_BO_NHAN_SU, null, luc, hang.length, 0),
    ]);
    const soGhi = soDoi(kq[0]) + soDoi(kq[1]);

    /* Sổ dong_bo: số dòng đổi lần này. Nhật ký chỉ ghi lần CÓ đổi (Apps Script
       đẩy mỗi giờ — ghi cả lần không đổi thì nhật ký đầy rác). */
    const sau = [db.prepare(SQL_DONG_BO.ghiSoGhi).bind(DONG_BO_NHAN_SU, soGhi)];
    if (soGhi) {
        const tom = Object.keys(theoKip).map(k => k + ' ' + theoKip[k]).join(', ');
        sau.push(db.prepare(SQL.nhatKy).bind(luc, DONG_BO_NHAN_SU, hang.length, 'kíp ' + tom + ' người, ' + soGhi + ' dòng đổi'));
    }
    await db.batch(sau);
    return { so_nguoi: hang.length, theo_kip: theoKip, so_ghi: soGhi };
}

/** GET /api/v2/nhan-su — cả danh sách, đã thành chuỗi JSON.
 *  Ra { body, etag } hoặc null khi bảng chưa có ai (trình duyệt giữ bản đang hiện).
 *  body: { status, nguon: 'd1', so_nguoi, nhan_su: [[kíp, stt, họ tên, vị trí, trạng thái], ...] }
 *  ETag = số người + băm danh sách: danh sách không đổi thì ETag không đổi -> 304. */
export async function docNhanSu(db) {
    let x;
    try { x = await db.prepare(SQL.doc).bind(XUONG).first(); } catch (e) { throw loiBang(e); }
    if (!x || !x.n) return null;
    return {
        body: '{"status":"success","nguon":"d1","so_nguoi":' + x.n + ',"nhan_su":' + x.ds + '}',
        etag: '"ns-' + x.n + '-' + bam(x.ds) + '"',
    };
}
