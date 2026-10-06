/* =============================================================================
 * functions/api/[[route]].js — CỔNG API CỦA DASHBOARD (chạy trên Cloudflare)
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Đây là phần "máy chủ" duy nhất của dự án. Cloudflare Pages chạy file này mỗi
 *   khi có ai gọi một địa chỉ bắt đầu bằng /api/ — tên file [[route]] nghĩa là
 *   "bắt MỌI đường dẫn con của /api". File làm 3 việc:
 *     1) NHẬN số liệu: Apps Script của Google Sheet định kỳ ĐẨY (POST) cả bảng
 *        tính lên đây. File kiểm khoá, kiểm dữ liệu, cất vào KV, rồi chép phần
 *        mới sang cơ sở dữ liệu D1 (db/dong-bo-d1.mjs).
 *     2) TRẢ số liệu cho trang dashboard (GET): từ D1 (bản chính) hoặc từ KV
 *        (bản cũ, giữ làm đường lui khi D1 lỗi).
 *     3) Báo TÌNH TRẠNG: /api/trang-thai cho biết lần đẩy gần nhất, có lỗi không.
 *
 * CÁC ĐƯỜNG DẪN
 *   POST /api/tk3 | tk4 | vattu   Apps Script đẩy dữ liệu (phải có header x-push-key)
 *   GET  /api/tk3 | tk4 | vattu   bản KV: nguyên văn lần đẩy gần nhất (đường lui)
 *   GET  /api/v2/tk3 | tk4        số liệu từ D1, theo khoảng tháng ?tu=YYYY-MM&den=YYYY-MM
 *   GET  /api/v2/vattu            vật tư từ D1
 *   GET  /api/v2/chi-so           số liệu trang chủ đã tính sẵn (dải chỉ số, sản lượng,
 *                                 3 bảng cảnh báo)
 *   GET  /api/trang-thai          tình trạng đẩy + đồng bộ; mở thẳng trên trình duyệt được
 *   GET  /api/nap, POST /api/nap, POST /api/nap/huy
 *                                 trang nạp Excel (nap-lieu.html): danh sách / nạp / huỷ
 *                                 — cần header x-nap-key (xem apiNap)
 *
 * "TUYẾN" LÀ GÌ
 *   Một luồng dữ liệu riêng: 'tk3' (dây chuyền Thiêu kết 3), 'tk4' (Thiêu kết 4),
 *   'vattu' (kho vật tư). Mỗi tuyến có Apps Script đẩy riêng, ô KV riêng.
 *
 * CÀI ĐẶT LẦN ĐẦU (Cloudflare > Workers & Pages > xtk2-profile > Settings)
 *   1) Bindings -> KV namespace XTK2_SHEET, tên biến SHEET_KV.
 *   2) Variables and Secrets -> PUSH_KEY = một chuỗi ngẫu nhiên dài.
 *      Tạo nhanh: mở F12 -> Console -> gõ crypto.randomUUID()
 *      CHUỖI NÀY LÀ MẬT KHẨU GHI DỮ LIỆU — đừng để lộ, đừng đưa vào GitHub.
 *      Dán đúng chuỗi đó vào PUSH_KEY trong Apps Script.
 *   3) Bindings -> D1 database xtk2-db, tên biến DB. Chạy npm run db:schema để
 *      tạo bảng, rồi db:chuan-bi -> db:nap để nạp lịch sử (xem README.txt).
 *      Gỡ binding DB là tắt hẳn phần D1: KV và dashboard vẫn chạy như cũ.
 *   4) Variables and Secrets -> NAP_KEY = chuỗi ngẫu nhiên KHÁC PUSH_KEY, tối
 *      thiểu 16 ký tự: khoá của trang nạp Excel. Không đặt = tắt việc nạp Excel.
 *
 * BẢO VỆ (dashboard CÔNG KHAI — ai có link cũng xem được)
 *   - Quyền GHI: mọi POST phải đúng PUSH_KEY (nạp Excel: NAP_KEY), sai là từ
 *     chối (khoaDung).
 *   - API không thành nguồn dữ liệu mở: GET dữ liệu chỉ trả cho chính trang
 *     dashboard gọi (goiTuTrangNha). Đây là RÀO chắn người tò mò, không phải khoá.
 *
 * GIỚI HẠN GÓI FREE (không thẻ) — lý do nhiều chỗ bên dưới viết "vòng vèo":
 *   10 ms CPU mỗi lượt gọi; KV 1.000 lần ghi/ngày; D1 100.000 dòng ghi/ngày.
 * ===========================================================================*/

import { dongBoD1, ghiLoiDongBo, docTrangThaiDongBo } from '../../db/dong-bo-d1.mjs';
import { docPhienV2, docGoiV2, docPhienVatTu, docVatTuV2, phamViThang } from '../../db/goi-v2.mjs';
import { docPhienChiSo, docChiSo } from '../../db/chi-so.mjs';
import { napExcel, huyNap, dsLanNap, LoiNap } from '../../db/nap-excel.mjs';

/** /api/nap — NẠP SỐ LIỆU TỪ FILE EXCEL (trang nap-lieu.html, db/nap-excel.mjs)
 *    GET  /api/nap        30 lần nạp gần nhất (trang dùng luôn để kiểm khoá)
 *    POST /api/nap        nạp một file (gói JSON: xem đầu db/nap-excel.mjs)
 *    POST /api/nap/huy    { "id": <mã lần nạp> } — huỷ một lần nạp
 *  Mọi lượt phải có header x-nap-key = NAP_KEY (Cloudflare > Settings > Variables
 *  and Secrets). Khoá RIÊNG, khác PUSH_KEY: đưa cho người nạp Excel mà không lộ
 *  quyền đẩy của Apps Script. NAP_KEY chưa đặt hoặc ngắn hơn 16 ký tự -> tắt hẳn. */
async function apiNap(request, env, doan) {
    if (!env.DB) return traJson({ status: 'error', message: 'Chưa gắn binding DB' }, 503);
    if (!env.NAP_KEY || env.NAP_KEY.length < 16) {
        return traJson({ status: 'error', message: 'Máy chủ chưa đặt NAP_KEY (tối thiểu 16 ký tự)' }, 503);
    }
    /* Sai khoá: chỉ ghi log, không ghi gì vào D1 (giống POST của Apps Script) */
    if (!khoaDung(request.headers.get('x-nap-key') || '', env.NAP_KEY)) {
        console.warn('[Nạp] sai khoá nạp');
        return traJson({ status: 'error', message: 'Sai khoá nạp' }, 401);
    }
    const viec = doan[2] || '';
    try {
        if (request.method === 'GET' && !viec) {
            const r = traJson({ status: 'success', lan_nap: await dsLanNap(env.DB) });
            r.headers.set('cache-control', 'no-store');
            return r;
        }
        if (request.method === 'POST' && (!viec || viec === 'huy')) {
            const body = await request.text();
            if (body.length > 2000000) return traJson({ status: 'error', message: 'Gói quá 2 MB — chia file theo tháng' }, 413);
            let j;
            try { j = JSON.parse(body); } catch (e) { return traJson({ status: 'error', message: 'Không đọc được JSON' }, 400); }
            const kq = viec === 'huy' ? await huyNap(env.DB, j && j.id, Date.now()) : await napExcel(env.DB, j, Date.now());
            return traJson(Object.assign({ status: 'success' }, kq));
        }
        return traJson({ status: 'error', message: 'Không có đường ' + request.method + ' /api/nap/' + viec }, 404);
    } catch (e) {
        if (e instanceof LoiNap) return traJson({ status: 'error', message: e.message }, e.ma);
        console.error('[Nạp] lỗi:', e && e.message);
        return traJson({ status: 'error', message: 'Lỗi máy chủ khi ghi D1: ' + String(e && e.message).slice(0, 200) }, 500);
    }
}

/* Danh sách tuyến được phép. Thêm luồng dữ liệu mới thì thêm tên vào đây.
   Tên lạ bị từ chối, để người ngoài không ghi rác vào KV được. */
const TUYEN = ['tk3', 'tk4', 'vattu'];

/* Quá 6 giờ không có lần đẩy mới thì /api/trang-thai báo tuyến đó là "CŨ".
   Phải giữ bằng API_CANH_BAO_CU_GIAY trong js/api/api_config.js (trình duyệt
   dùng con số đó để hiện cảnh báo "dữ liệu cũ"). */
const NGUONG_CU_GIAY = 6 * 3600;

/* Tên ô nhớ trong KV. 'sheet:tk3' chứa nguyên văn lần đẩy gần nhất của TK3. */
function khoaKV(ten) { return 'sheet:' + ten; }

/* 'loi:tk3' chứa lý do lần đẩy gần nhất bị TỪ CHỐI (dữ liệu sai dạng).
   Trước đây lý do chỉ trả về cho Apps Script rồi mất: tuyến vật tư từng đứng
   30 ngày mà phía web không có manh mối nào. Giờ /api/trang-thai hiện ra. */
function khoaLoiKV(ten) { return 'loi:' + ten; }

/** Băm SHA-1 một chuỗi -> 40 ký tự hex. Dùng làm ETag ("dấu vân tay" của dữ
 *  liệu): hai lần đẩy giống hệt nhau cho cùng một ETag. */
async function tinhEtag(chuoi) {
    const bytes = new TextEncoder().encode(chuoi);
    const digest = await crypto.subtle.digest('SHA-1', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Lấy phần của body dùng để tính ETag — tức là bỏ trường "timing" ở cuối.
 *
 *  Vì sao: Apps Script gửi kèm "timing" (số mili-giây nó chạy mỗi bước), lần đẩy
 *  nào cũng khác. Băm cả body thì ETag đổi sau MỖI lần đẩy dù bảng tính y
 *  nguyên -> trình duyệt tưởng có dữ liệu mới, tải lại hết, vẽ lại mọi biểu đồ.
 *
 *  An toàn: chỉ cắt khi CHẮC CHẮN timing là trường cuối cùng. Không đúng dạng đó
 *  thì băm cả body như cũ — vẫn đúng, chỉ kém hiệu quả, không bao giờ bỏ sót
 *  thay đổi của số liệu. */
function phanDeBam(body, j) {
    if (!j || !j.timing || typeof j.timing !== 'object') return body;
    const duoi = '"timing":' + JSON.stringify(j.timing) + '}';
    return body.endsWith(duoi) ? body.slice(0, body.length - duoi.length) : body;
}

/** Trả một đối tượng JS dưới dạng JSON, kèm mã trạng thái HTTP (mặc định 200). */
function traJson(obj, status) {
    return new Response(JSON.stringify(obj), {
        status: status || 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

/** So khoá bí mật a với b, mất CÙNG một khoảng thời gian dù sai ở ký tự nào.
 *
 *  Vì sao không dùng a === b: phép so thường dừng ngay ở ký tự đầu tiên khác
 *  nhau. Kẻ dò khoá có thể đo thời gian phản hồi để đoán dần từng ký tự. Cách
 *  này luôn duyệt hết chuỗi, gom mọi khác biệt vào biến "sai". */
function khoaDung(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let sai = 0;
    for (let i = 0; i < a.length; i++) sai |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return sai === 0;
}

/** Request này có phải do chính trang dashboard gọi không?
 *
 *  - Trang dashboard gọi fetch('/api/...') -> trình duyệt tự gắn header
 *    Sec-Fetch-Site: same-origin -> ĐƯỢC.
 *  - Dán thẳng /api/tk3 lên thanh địa chỉ ('none'), hay trang web khác gọi sang
 *    ('cross-site') -> KHÔNG.
 *
 *  ĐÂY LÀ RÀO, KHÔNG PHẢI KHOÁ. Ai tự viết script giả header vẫn qua được, và số
 *  liệu đã hiện trên dashboard công khai thì người xem vốn lấy được bằng F12.
 *  Rào chỉ để API không bị dùng như một nguồn dữ liệu mở. Muốn một cột THẬT SỰ
 *  không ai thấy thì đừng gửi cột đó lên — bỏ ngay từ Apps Script. */
function goiTuTrangNha(request, url) {
    const nguon = request.headers.get('sec-fetch-site');
    if (nguon) return nguon === 'same-origin';
    /* Trình duyệt cũ không gửi Sec-Fetch-*: dựa vào Referer (fetch cùng trang
       mặc định gửi kèm địa chỉ trang đang mở) */
    const ref = request.headers.get('referer');
    try { return !!ref && new URL(ref).host === url.host; } catch (e) { return false; }
}

/* =============================================================================
 * GET /api/v2/... — ĐỌC SỐ LIỆU TỪ D1
 * -----------------------------------------------------------------------------
 *   /api/v2/tk3?tu=2026-09          các tháng từ 09/2026 tới nay (+ nhân sự)
 *   /api/v2/tk3?tu=2026-05&den=2026-06   chỉ tháng 5 và 6 (trang xin thêm khi lọc lùi)
 *   /api/v2/vattu                   tồn kho + phiếu nhập/xuất
 *   /api/v2/chi-so                  xem apiChiSo() bên dưới
 *
 * Chỉ để ĐỌC: POST vào đây -> 405 (đường ghi vẫn là POST /api/tk3 của Apps Script).
 * D1 chưa sẵn sàng hay lỗi -> 503, trình duyệt tự quay về bản KV
 * (js/api/api_config.js), người xem không thấy gì khác.
 *
 * ETag / 304: mỗi câu trả lời kèm ETag. Lần sau trình duyệt gửi lại ETag đó
 * (If-None-Match); dữ liệu chưa đổi thì trả 304 rỗng — khỏi tải lại.
 *
 * Header riêng của dự án:
 *   x-xtk2-at     mốc Apps Script ĐẨY gần nhất (ms, đọc từ KV) — trình duyệt dùng
 *                 để cảnh báo "dữ liệu cũ", giữ nguyên ý nghĩa như bản KV.
 *   x-xtk2-age    số giây kể từ lần đẩy đó.
 *   x-xtk2-d1     mốc D1 đồng bộ gần nhất (ms).
 *   x-xtk2-source 'd1' hoặc 'kv' — biết câu trả lời lấy từ kho nào.
 * ===========================================================================*/
async function apiV2(request, env, url, ten) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return traJson({ status: 'error', message: '/api/v2 chỉ để đọc' }, 405);
    }
    if (TUYEN.indexOf(ten) < 0 && ten !== 'chi-so') {
        return traJson({ status: 'error', message: 'Tuyến không hợp lệ: ' + ten }, 404);
    }
    if (!goiTuTrangNha(request, url)) {
        const r = traJson({ status: 'error', message: 'API này chỉ phục vụ trang dashboard' }, 403);
        r.headers.set('cache-control', 'no-store');
        return r;
    }
    if (!env.DB) return traJson({ status: 'error', message: 'Chưa gắn binding DB' }, 503);
    if (ten === 'chi-so') return apiChiSo(request, env);

    try {
        const laVatTu = ten === 'vattu';
        const pv = phamViThang(url);              /* { tu, den, dau } từ ?tu=&den= */
        /* Bước 1 (rẻ): chỉ đọc "phiên" — đủ để tính ETag — song song với metadata
           KV (lấy mốc đẩy). Chưa đọc số liệu. */
        const [phien, kv] = await Promise.all([
            laVatTu ? docPhienVatTu(env.DB) : docPhienV2(env.DB, ten, pv),
            env.SHEET_KV.getWithMetadata(khoaKV(ten), { type: 'stream' }),
        ]);
        if (kv.value) await kv.value.cancel();    /* chỉ cần metadata, bỏ luồng dữ liệu */
        if (!phien) return traJson({ status: 'error', message: 'D1 chưa có gói dữ liệu cho ' + ten }, 503);

        const dayLuc = (kv.metadata && kv.metadata.at) || 0;
        const moc = {
            'cache-control': 'private, no-cache',
            'vary':          'Sec-Fetch-Site',
            'etag':          phien.etag,
            'x-xtk2-at':     String(dayLuc),
            'x-xtk2-age':    String(Math.round((Date.now() - dayLuc) / 1000)),
            'x-xtk2-source': 'd1',
        };
        /* Trình duyệt đã có đúng bản này -> 304, không đọc số liệu nữa.
           (Cloudflare nén brotli biến ETag thành W/"..." — bỏ W/ trước khi so.) */
        if ((request.headers.get('if-none-match') || '').replace(/^W\//, '') === phien.etag) {
            return new Response(null, { status: 304, headers: moc });
        }

        /* Bước 2: đọc số liệu thật */
        let body, lucD1;
        if (laVatTu) { body = JSON.stringify(await docVatTuV2(env.DB)); lucD1 = phien.luc; }
        else ({ body: body, luc: lucD1 } = await docGoiV2(env.DB, ten, pv, phien.mucLuc));
        /* Danh mục cột vừa đổi mà các gói tháng chưa dựng lại xong -> đừng gửi
           gói lệch cột; 503 để trình duyệt tạm dùng bản KV */
        if (!body) return traJson({ status: 'error', message: 'Gói ' + ten + ' đang dựng lại' }, 503);
        moc['x-xtk2-d1'] = String(lucD1 || 0);
        return new Response(body, {
            headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, moc),
        });
    } catch (e) {
        console.error('[v2] ' + ten + ' lỗi đọc D1:', e && e.message);
        return traJson({ status: 'error', message: 'Không đọc được D1' }, 503);
    }
}

/** GET /api/v2/chi-so — các con số của TRANG CHỦ, máy chủ tính sẵn.
 *
 *  Gồm: dải chỉ số chạy ngang, 4 thẻ Sản lượng, biểu đồ sản lượng tháng, 3 bảng
 *  cảnh báo. Máy chủ chạy CHÍNH đoạn mã tính của trình duyệt
 *  (js/chung/chi_so.js) nên kết quả giống hệt — chỉ là trang chủ có số ngay mà
 *  không phải đợi tải và tính cả bảng.
 *
 *  Kết quả phụ thuộc NGÀY HÔM NAY (giờ Việt Nam: "luỹ kế đến hôm nay", "7 ngày
 *  gần nhất"...) nên ngày nằm trong ETag. Lỗi -> 503, trình duyệt tự tính lấy. */
async function apiChiSo(request, env) {
    try {
        const p = await docPhienChiSo(env.DB, Date.now());
        const moc = {
            'cache-control': 'private, no-cache',
            'vary':          'Sec-Fetch-Site',
            'etag':          p.etag,
            'x-xtk2-source': 'd1',
        };
        if ((request.headers.get('if-none-match') || '').replace(/^W\//, '') === p.etag) {
            return new Response(null, { status: 304, headers: moc });
        }
        const body = await docChiSo(env.DB, p);
        if (!body) return traJson({ status: 'error', message: 'Gói tháng đang dựng lại' }, 503);
        return new Response(body, {
            headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, moc),
        });
    } catch (e) {
        console.error('[v2] chi-so lỗi:', e && e.message);
        return traJson({ status: 'error', message: 'Không tính được chỉ số' }, 503);
    }
}

/** GET /api/trang-thai — bảng tình trạng của cả 3 tuyến, cho NGƯỜI đọc.
 *
 *  Với mỗi tuyến cho biết:
 *    tinhTrang    'OK' / 'CŨ' (quá 6 giờ chưa đẩy) / 'LỖI' (lần đẩy mới nhất bị từ chối)
 *    lanDayCuoi   lần Apps Script đẩy thành công gần nhất (giờ VN)
 *    loiGanNhat   lý do bị từ chối, nếu có
 *    d1           lần chép sang D1 gần nhất, bao nhiêu ô đổi, lỗi D1 nếu có
 *
 *  Rất rẻ: chỉ đọc metadata của KV; phần dữ liệu thì huỷ luồng ngay. */
async function trangThai(env) {
    const bayGio = Date.now();
    const tuyen = {};
    const gio = function (ms) { return new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }); };
    /* Đọc tình trạng D1 trước. Lỗi D1 không được làm hỏng phần báo KV. */
    let d1 = null;
    if (env.DB) {
        try { d1 = await docTrangThaiDongBo(env.DB); }
        catch (e) { d1 = { loiDocD1: String(e && e.message).slice(0, 200) }; }
    }
    await Promise.all(TUYEN.map(async function (t) {
        const [{ value, metadata }, loi] = await Promise.all([
            env.SHEET_KV.getWithMetadata(khoaKV(t), { type: 'stream' }),
            env.SHEET_KV.getWithMetadata(khoaLoiKV(t)),
        ]);
        if (value) await value.cancel();
        /* Chỉ báo lỗi khi nó MỚI HƠN lần đẩy thành công gần nhất. Đẩy lại được
           rồi thì lỗi cũ tự thôi hiện — khỏi tốn một lần ghi KV để xoá nó. */
        const loiMoi = loi && loi.metadata && loi.metadata.at
            && (!metadata || !metadata.at || loi.metadata.at > metadata.at)
            ? { luc: gio(loi.metadata.at), viSao: loi.value } : null;
        if (!metadata || !metadata.at) {
            tuyen[t] = { tinhTrang: value ? 'CÓ DỮ LIỆU NHƯNG THIẾU METADATA' : 'CHƯA CÓ LẦN ĐẨY NÀO' };
            if (loiMoi) tuyen[t].loiGanNhat = loiMoi;
            return;
        }
        const tuoi = Math.round((bayGio - metadata.at) / 1000);
        tuyen[t] = {
            tinhTrang: loiMoi ? 'LỖI — Apps Script có đẩy nhưng dữ liệu bị từ chối, xem loiGanNhat'
                : tuoi > NGUONG_CU_GIAY ? 'CŨ — kiểm tra trigger Apps Script' : 'OK',
            lanDayCuoi: gio(metadata.at),
            cachDayGiay: tuoi,
            soDong: metadata.soDong || null,
        };
        if (loiMoi) tuyen[t].loiGanNhat = loiMoi;
    }));
    /* Gắn thêm mục "d1" cho từng tuyến */
    for (const t of TUYEN) {
        if (!d1) { tuyen[t].d1 = 'chưa gắn binding DB'; continue; }
        if (d1.loiDocD1) { tuyen[t].d1 = 'không đọc được D1: ' + d1.loiDocD1; continue; }
        const x = d1[t];
        if (!x || (!x.luc && !x.loi)) { tuyen[t].d1 = 'chưa đồng bộ lần nào'; continue; }
        tuyen[t].d1 = {
            lanDongBoCuoi: x.luc ? gio(x.luc) : null,
            soO: x.so_o, soDongDoi: x.so_ghi,
        };
        if (x.loi) tuyen[t].d1.loi = { luc: gio(x.loi_luc), viSao: x.loi };
    }
    return new Response(JSON.stringify({ status: 'success', nguongCuGiay: NGUONG_CU_GIAY, tuyen: tuyen }, null, 2), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
}

/* =============================================================================
 * ĐIỂM VÀO — Cloudflare gọi hàm này cho MỌI request tới /api/...
 * -----------------------------------------------------------------------------
 * Thứ tự xét (quan trọng — đổi thứ tự là đổi hành vi):
 *   0) /api/nap...        -> apiNap()  (khoá riêng, không cần KV)
 *   1) /api/v2/...        -> apiV2()   (xét TRƯỚC nhánh POST, xem chú thích dưới)
 *   2) /api/trang-thai    -> trangThai()
 *   3) tên tuyến lạ       -> 404
 *   4) POST /api/<tuyến>  -> Apps Script đẩy dữ liệu
 *   5) GET  /api/<tuyến>  -> trả bản KV
 * ===========================================================================*/
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    /* Tên tuyến = đoạn cuối của đường dẫn: /api/tk3 -> 'tk3', /api/v2/tk4 -> 'tk4' */
    const doan = url.pathname.split('/').filter(Boolean);
    const ten = doan[doan.length - 1];

    /* /api/nap...: nạp Excel — không cần KV, có khoá riêng */
    if (doan[1] === 'nap') return apiNap(request, env, doan);

    if (!env.SHEET_KV) {
        return traJson({ status: 'error', message: 'Chưa gắn KV binding SHEET_KV' }, 500);
    }

    /* /api/v2/<tuyến>: đọc từ D1. Phải xét TRƯỚC nhánh POST: một POST vào
       /api/v2/tk3 không được lọt xuống thành "Apps Script đẩy dữ liệu". */
    if (doan[1] === 'v2') return apiV2(request, env, url, doan.length === 3 ? ten : '');

    if (ten === 'trang-thai' && request.method === 'GET') return trangThai(env);

    if (TUYEN.indexOf(ten) < 0) {
        return traJson({ status: 'error', message: 'Tuyến không hợp lệ: ' + ten }, 404);
    }

    /* ---------------------------------------------------------------------
     * POST /api/<tuyến> — APPS SCRIPT ĐẨY DỮ LIỆU LÊN
     *   a) kiểm khoá PUSH_KEY       sai -> 401
     *   b) kiểm dữ liệu đúng dạng   sai -> ghi lý do vào 'loi:<tuyến>', trả 400
     *   c) ghi nguyên văn vào KV    (dashboard đọc được ngay qua bản KV)
     *   d) chép sang D1 ở chế độ nền (không bắt Apps Script chờ)
     * ------------------------------------------------------------------- */
    if (request.method === 'POST') {
        const khoa = request.headers.get('x-push-key') || '';
        if (!env.PUSH_KEY || !khoaDung(khoa, env.PUSH_KEY)) {
            /* Sai khoá: chỉ ghi log (xem bằng wrangler pages deployment tail),
               KHÔNG ghi KV. Ai cũng gửi được request sai khoá; nếu mỗi lần sai
               đều ghi KV thì người lạ đốt sạch 1.000 lần ghi/ngày của gói Free. */
            console.warn('[Đẩy] ' + ten + ': sai khoá' + (khoa ? '' : ' (không gửi x-push-key)'));
            return traJson({ status: 'error', message: 'Sai khoá' }, 401);
        }

        const body = await request.text();

        /* Chỉ nhận dữ liệu ĐÚNG DẠNG. Thiếu bước này thì một lần Apps Script lỗi
           (trả trang báo lỗi thay vì số liệu) là ghi đè mất bản tốt trong KV.
           Dạng đúng:
             tk3 / tk4 : { status: 'success', data: [ {cột: ô, ...}, ... ] }  (MẢNG dòng)
             vattu     : { status: 'success', data: { TK3: {...}, TK4: {...} } }  (ĐỐI TƯỢNG)
           Cả hai đều phải có nội dung thật (không rỗng). */
        let hopLe = false, soDong = 0, viSao = '', j = null;
        try {
            j = JSON.parse(body);
            if (!j) {
                viSao = 'JSON rỗng';
            } else if (j.status !== 'success') {
                viSao = 'status = "' + j.status + '" (phải là "success")'
                    + (j.message ? ' — ' + String(j.message).slice(0, 150) : '');
            } else if (!j.data) {
                viSao = 'thiếu trường data';
            } else if (Array.isArray(j.data)) {
                hopLe = j.data.length > 0;
                soDong = j.data.length;
                if (!hopLe) viSao = 'data là mảng RỖNG';
            } else if (typeof j.data === 'object') {
                const k = Object.keys(j.data);
                hopLe = k.length > 0;
                soDong = j.total_rows || k.length;
                if (!hopLe) viSao = 'data là đối tượng RỖNG';
            } else {
                viSao = 'data kiểu ' + (typeof j.data) + ', phải là mảng hoặc đối tượng';
            }
        } catch (e) {
            /* Hay gặp: Apps Script trả trang HTML báo lỗi thay vì JSON */
            viSao = 'không đọc được JSON. 120 ký tự đầu: ' + body.slice(0, 120);
        }

        if (!hopLe) {
            /* Nói RÕ trượt ở bước nào — câu "không hợp lệ" chung chung bắt người sửa
               đoán mò giữa hàng chục nguyên nhân. Khoá đã đúng nên chắc chắn đây là
               Apps Script của mình: ghi lý do lại để /api/trang-thai hiện ra. */
            console.warn('[Đẩy] ' + ten + ': từ chối — ' + viSao);
            try {
                await env.SHEET_KV.put(khoaLoiKV(ten), viSao.slice(0, 300),
                    { metadata: { at: Date.now(), bytes: body.length } });
            } catch (e) { console.error('[Đẩy] không ghi được lỗi vào KV:', e && e.message); }
            return traJson({ status: 'error',
                message: 'Dữ liệu gửi lên không hợp lệ — ' + viSao,
                nhan_duoc_bytes: body.length }, 400);
        }

        const etag = await tinhEtag(phanDeBam(body, j));

        /* Metadata đi kèm ô KV: at = lúc đẩy (ms), soDong, etag. Đọc metadata rẻ
           hơn nhiều so với đọc cả ô — /api/trang-thai và /api/v2 chỉ đọc phần này. */
        await env.SHEET_KV.put(khoaKV(ten), body, { metadata: { at: Date.now(), soDong: soDong, etag: etag } });

        /* Chép sang D1 — SAU khi KV đã ghi xong, chạy nền bằng waitUntil (Apps
           Script nhận "success" ngay, không phải chờ). D1 lỗi, hay lượt chạy bị
           ngắt vì quá CPU, thì KV vẫn có dữ liệu mới và dashboard vẫn đọc được.
           Lỗi được ghi vào bảng dong_bo để /api/trang-thai hiện ra. */
        if (env.DB) {
            context.waitUntil(dongBoD1(env.DB, ten, j, etag, Date.now()).then(function (kq) {
                console.info('[D1] ' + ten + ': ' + (kq.boQua ? 'bỏ qua — ' + kq.boQua
                    : kq.soO + ' ô, ' + kq.soGhi + ' dòng đổi (' + kq.ghiChu + ')'));
            }).catch(function (e) {
                console.error('[D1] ' + ten + ' lỗi:', e && e.message);
                return ghiLoiDongBo(env.DB, ten, e);
            }));
        }
        return traJson({ status: 'success', message: 'Đã nhận ' + soDong + ' dòng cho ' + ten });
    }

    /* ---------------------------------------------------------------------
     * GET /api/<tuyến> — TRẢ BẢN KV (nguyên văn lần đẩy gần nhất)
     * Trình duyệt chỉ dùng đường này khi /api/v2 lỗi, hoặc khi mở trang với
     * ?nguon=kv để so hai nguồn.
     * ------------------------------------------------------------------- */
    if (!goiTuTrangNha(request, url)) {
        const r = traJson({ status: 'error', message: 'API này chỉ phục vụ trang dashboard' }, 403);
        r.headers.set('cache-control', 'no-store');
        return r;
    }

    /* type:'stream' — dữ liệu chảy thẳng từ KV ra trình duyệt. Function KHÔNG
       dựng nó thành chuỗi JS, không parse, không mã hoá lại -> CPU gần như 0,
       dù ô KV nặng vài MB. cacheTtl 900: cho phép điểm mạng Cloudflare gần
       người xem giữ bản đọc tối đa 15 phút để đọc nhanh hơn. */
    const { value, metadata } = await env.SHEET_KV.getWithMetadata(
        khoaKV(ten), { type: 'stream', cacheTtl: 900 });

    if (!value || !metadata || !metadata.at) {
        if (value) await value.cancel();
        return traJson({ status: 'error', message: 'Chưa có dữ liệu cho tuyến ' + ten }, 503);
    }

    const etag = '"' + (metadata.etag || metadata.at) + '"';
    /* Ý nghĩa từng header:
       x-xtk2-at  mốc đẩy (ms). Gửi cả trong câu 304: trình duyệt chép header của
                  304 đè lên bản đã nhớ — thiếu thì trang đọc nhầm mốc lần trước.
       private    chỉ trình duyệt của người xem được nhớ bản sao. ('public' cho
                  phép cả proxy công ty, proxy nhà mạng giữ dữ liệu nội bộ xưởng.)
       no-cache   được nhớ, nhưng LẦN NÀO cũng phải hỏi lại máy chủ (gửi ETag;
                  chưa đổi thì nhận 304 rỗng). Trước đây để max-age=300: vừa mở
                  trang xong, dán link API sang tab mới là Chrome trả luôn bản đã
                  nhớ, lọt qua rào goiTuTrangNha().
       Vary       bản nhớ của lượt fetch từ trang không được đem trả cho lượt mở
                  thẳng link (hai lượt khác nhau ở header Sec-Fetch-Site). */
    const moc = {
        'cache-control': 'private, no-cache',
        'vary':          'Sec-Fetch-Site',
        'etag':          etag,
        'x-xtk2-at':     String(metadata.at),
        'x-xtk2-age':    String(Math.round((Date.now() - metadata.at) / 1000)),
    };
    /* Cloudflare nén brotli biến ETag thành W/"..." — bỏ W/ trước khi so */
    if ((request.headers.get('if-none-match') || '').replace(/^W\//, '') === etag) {
        await value.cancel();
        return new Response(null, { status: 304, headers: moc });
    }

    return new Response(value, {
        headers: Object.assign({
            'content-type':  'application/json; charset=utf-8',
            'x-xtk2-source': 'kv',
            'x-xtk2-dong':   String(metadata.soDong || ''),
        }, moc),
    });
}
