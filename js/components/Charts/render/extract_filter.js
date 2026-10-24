/* =============================================================================
 * js/components/Charts/render/extract_filter.js — RÚT SỐ LIỆU KHỎI BẢNG TÍNH + LỌC THEO NGÀY / CA
 * =============================================================================
 * Phần 4/7 của bộ đồ nghề vẽ biểu đồ (thư mục render/, trước 24/10/2026 là
 * chart_core.js) — đọc render/setup.js trước để biết cả thư mục.
 * ===========================================================================*/

/** Rút các cột cần vẽ của MỘT khối khỏi bảng tính.
 *
 *  dataSource  mảng hàng (window.masterSheetDataTK3...)
 *  timeCol     cột ngày của khối, vd 'Thời gian (Điện)'
 *  shiftCol    cột ca/kíp của khối, vd 'Ca/kíp (Điện)'
 *  dataCols    các cột số liệu cần lấy
 *
 *  Ra: { labels: ['01/10/2026 - A', '01/10/2026 - B', ...],
 *        'tên cột 1': [số | null, ...], ... }   — mỗi phần tử ứng với một ca.
 *  Hàng không có Ca/kíp thì bỏ. Ô trống / không phải số -> null (biểu đồ để
 *  trống chỗ đó thay vì vẽ số 0 giả).
 *
 *  Ô ngày trong sheet là ô GỘP: chỉ hàng đầu của mỗi ngày có ngày, các hàng sau
 *  để trống -> nhớ ngày gần nhất (curDate) rồi dùng tiếp.
 *  Cách đọc số ở đây đơn giản: chỉ đổi dấu phẩy ĐẦU TIÊN thành chấm (đủ cho các
 *  cột biểu đồ). Dải chỉ số và cảnh báo dùng sheetNumber() chặt chẽ hơn. */
function extractChartData(dataSource, timeCol, shiftCol, dataCols) {
    if (!dataSource?.length) return null;
    let res = { labels: [] };
    dataCols.forEach(c => res[c] = []);

    let curDate = "";
    dataSource.forEach(row => {
        /* Đọc ngày TRƯỚC, bỏ hàng thiếu ca SAU. Làm ngược lại thì hàng mở đầu
           một ngày mà quên điền Ca/kíp làm mất luôn ngày đó: TK3 khối QTK hàng
           361 ghi 16/05/2026 nhưng trống Ca/kíp, nên 4 mẫu kíp A của 16/05 từng
           bị vẽ thành 15/05. db/chuan-hoa.mjs đọc theo đúng thứ tự này. */
        if (row[timeCol]?.trim()) curDate = row[timeCol];
        if (!row[shiftCol]) return;
        res.labels.push(`${curDate} - ${row[shiftCol]}`);

        // Đọc số; trống hoặc không phải số -> null để biểu đồ không bị vỡ
        dataCols.forEach(c => {
            if (row[c] === undefined || row[c] === null || row[c].toString().trim() === '') {
                res[c].push(null);
            } else {
                let parsed = Number(row[c].toString().replace(',', '.'));
                res[c].push(isNaN(parsed) ? null : parsed);
            }
        });
    });
    return res;
}

/* =============================================================================
 * LỌC THEO NGÀY / CA
 * ===========================================================================*/

/** Lọc kết quả extractChartData theo ô lọc trên giao diện.
 *
 *  data          { labels, cột... } (từ extractChartData, có thể đã gộp TK3+TK4)
 *  primaryKey    (không dùng — giữ cho khớp chỗ gọi cũ)
 *  startId/endId id ô "Từ ngày" / "Đến ngày"
 *  shiftId       id ô chọn ca/kíp ('all' = mọi ca)
 *  defaultDays   số ngày lấy khi KHÔNG lọc ngày (mặc định 7)
 *
 *  Hai chế độ:
 *    - CÓ lọc ngày: giữ các ca nằm trong khoảng [Từ ngày, Đến ngày].
 *    - KHÔNG lọc ngày: tìm ca CUỐI CÙNG có số liệu thật (> 0, bỏ qua các cột
 *      luỹ kế / trung bình / định mức / DSX vì chúng có số sẵn cả tháng), rồi
 *      lấy 7 ngày tính ngược từ đó. Nhờ vậy khối có số liệu đã ngừng từ lâu vẫn
 *      hiện 7 ngày cuối có số, không phải 7 ngày trống.
 *  Sau đó lọc thêm theo ca nếu có chọn.
 *  Ra: { labels, cột..., isDateFiltered } hoặc null nếu không có dữ liệu. */
function smartFilter(data, primaryKey, startId, endId, shiftId, defaultDays = 7) {
    if (!data?.labels.length) return null;

    // Lấy giá trị từ các ô lọc
    const start = getUI(startId), end = getUI(endId), shift = getUI(shiftId) || "all";

    // Người xem CÓ lọc theo ngày hay không
    const hasDateFilter = start !== "" || end !== "";

    // Không lọc ngày: tìm ca cuối cùng có số liệu thật làm mốc
    let lastActiveIndex = data.labels.length - 1;
    if (!hasDateFilter) {
        for (let i = data.labels.length - 1; i >= 0; i--) {
            // Chỉ xét các cột số liệu THEO NGÀY (bỏ luỹ kế, trung bình, định mức, DSX)
            const hasAnyDailyData = Object.keys(data).some(k => {
                const isDailyDataColumn = !k.toLowerCase().includes('tichluy') &&
                                          !k.toLowerCase().includes('trungbinh') &&
                                          !k.toLowerCase().includes('dinhmuc') &&
                                          !k.toLowerCase().includes('dsx') &&
                                          k !== 'labels' && k !== 'isDateFiltered';

                return isDailyDataColumn && data[k] && data[k][i] > 0;
            });

            // Gặp ca có dữ liệu đầu tiên (đi từ dưới lên) thì cắm mốc và dừng
            if (hasAnyDailyData) {
                lastActiveIndex = i;
                break;
            }
        }
    }

    /* 7 ngày khác nhau cuối cùng tính tới mốc, vd ['24/09/2026', ..., '30/09/2026'] */
    const latest7Days = !hasDateFilter
        ? [...new Set(data.labels.slice(0, lastActiveIndex + 1).map(l => String(l).split(' - ')[0].trim()))].slice(-defaultDays)
        : [];

    const startTs = start ? new Date(start).getTime() : 0;
    const endTs = end ? new Date(end).getTime() : Infinity;

    let res = { labels: [], isDateFiltered: hasDateFilter };
    Object.keys(data).filter(k => k !== 'labels').forEach(k => res[k] = []);

    const limitIndex = hasDateFilter ? data.labels.length - 1 : lastActiveIndex;

    for (let i = 0; i <= limitIndex; i++) {
        const label = data.labels[i];
        const [dPart, sPart] = String(label).split(' - ').map(s => s.trim());
        /* 'dd/mm/yyyy' -> 'yyyy-mm-dd' -> mốc thời gian để so với ô lọc */
        const ts = new Date(dPart.split('/').reverse().join('-')).getTime();

        const passDate = hasDateFilter
            ? (ts >= startTs && ts <= endTs)
            : latest7Days.includes(dPart);

        const passShift = (shift === 'all' || sPart === shift);

        if (passDate && passShift) {
            res.labels.push(label);
            Object.keys(res).filter(k => k !== 'labels' && k !== 'isDateFiltered').forEach(k => {res[k].push(data[k] ? data[k][i] : 0);});

        }
    }

    return res;
}
