/* =============================================================================
 * js/components/Charts/render/setup.js — "BỘ ĐỒ NGHỀ" VẼ BIỂU ĐỒ (Chart.js): ĐỌC FILE NÀY TRƯỚC
 * =============================================================================
 * THƯ MỤC render/ LÀM GÌ
 *   Chứa các hàm DÙNG CHUNG để biến số liệu bảng tính thành biểu đồ. Trước
 *   24/10/2026 cả thư mục là MỘT file chart_core.js; nay tách theo việc, nạp
 *   ĐÚNG THỨ TỰ NÀY (index.html — bản build gộp lại thành một gói):
 *     setup.js               bật plugin nhãn số, chartInstances    (file này)
 *     overlimit_flash.js     nhấp nháy cột vượt định mức           updateTickingList, chinhNhipNhay
 *     utils.js               màu, thứ tự dây TK1 -> TK4, tuỳ chọn chung của biểu đồ
 *                                                                  getCommonChartOptions, getCoHatChartOptions
 *     extract_filter.js      rút số liệu khỏi bảng tính, lọc theo ngày / ca
 *                                                                  extractChartData, smartFilter
 *     consumption_charts.js  vẽ biểu đồ tiêu hao                   drawCoalConsumeChart ... drawReturnFinesRate
 *     quality_charts.js      vẽ biểu đồ chất lượng                 drawQTHChart ... drawQTKQualityChart
 *     combo_chart.js         biểu đồ kết hợp "đa năng"             drawUniversalComboChart
 *   Thư mục này KHÔNG tự vẽ gì khi nạp. Thư mục controller/ mới là nơi quyết định vẽ
 *   biểu đồ nào, lúc nào, bằng số liệu nào — rồi gọi các hàm ở đây.
 *   Mọi file ở đây là SCRIPT THƯỜNG (không phải module): hàm / biến cấp ngoài
 *   cùng của file này gọi thẳng được từ file khác. Vì vậy:
 *     - không đặt hai tên cấp ngoài cùng trùng nhau, dù ở hai file khác nhau;
 *     - câu lệnh chạy NGAY khi nạp file (không nằm trong hàm) chỉ được dùng tên
 *       của file nạp TRƯỚC nó. Gọi hàm của file nạp sau thì npm run dev báo lỗi
 *       "... is not defined" (bản build gộp một gói nên vẫn chạy — dễ lọt).
 *
 * ĐƯỜNG ĐI CỦA MỘT BIỂU ĐỒ
 *   bảng tính (window.masterSheetDataTK3 / TK4)
 *     -> extractChartData()  rút các cột cần: { labels: ['01/10/2026 - A', ...], 'tên cột': [số...] }
 *     -> smartFilter()       giữ 7 ngày gần nhất có số, hoặc theo ô Từ ngày / Đến ngày + ca
 *     -> draw...Chart()      dựng biểu đồ Chart.js trên thẻ <canvas id="...">
 *
 * QUY ƯỚC CHUNG CỦA CÁC HÀM draw...
 *   - canvasId: id thẻ <canvas> trong index.html. Không thấy canvas thì thôi.
 *   - Biểu đồ cũ trên cùng canvas bị huỷ (destroy) trước khi vẽ mới — Chart.js
 *     không cho hai biểu đồ dùng chung một canvas.
 *   - chartInstances[canvasId] giữ biểu đồ đang vẽ (để huỷ / cập nhật về sau).
 *   - lineFilter 'all' | 'TK3' | 'TK4': ẩn dây không chọn. Dây bị ẩn vẫn còn
 *     trong chú giải (gạch ngang) — bấm vào chú giải để hiện lại.
 *   - Biểu đồ kết hợp: CỘT (bar) = số theo ngày / ca, trục PHẢI (y_secondary);
 *     ĐƯỜNG (line) = luỹ kế / định mức / trung bình, trục TRÁI (y_primary).
 *
 * NẠP SAU: Chart.js + chartjs-plugin-datalabels (CDN) và js/chung/chi_so.js.
 * ===========================================================================*/

/* Bật plugin hiện nhãn số ngay trên cột / điểm cho MỌI biểu đồ */
Chart.register(ChartDataLabels);
/* chartInstances: canvasId -> biểu đồ Chart.js đang vẽ.
   isFlashing: nhịp nhấp nháy hiện tại (đổi mỗi 500 ms) — xem getFlashColor. */
let chartInstances = {}, isFlashing = false;
