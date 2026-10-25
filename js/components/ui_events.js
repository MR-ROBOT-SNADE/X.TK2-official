/* =============================================================================
 * js/components/ui_events.js — GẮN SỰ KIỆN BẤM CHO CÁC NÚT CỦA index.html
 * =============================================================================
 * Trước 25/10/2026 các nút trong index.html gọi hàm thẳng trong thẻ
 * (onclick="..."). Nay HTML chỉ ghi DỮ LIỆU (thuộc tính data-...), file này gắn
 * sự kiện cho từng nút:
 *   data-action="toggle-sidebar"           -> toggleSidebar()            sidebar.js
 *   data-filter="apply" data-chart="X"     -> applyUniversalFilter('X')  Charts/controller/chart_configs.js
 *   data-filter="clear" data-chart="X"     -> clearUniversalFilter('X')  Charts/controller/chart_configs.js
 *   data-page-step="-1|1" data-chart="X"   -> latTrangBieuDo('X', bước)  Charts/controller/pagination.js
 *   Mục trong menu bên (data-block="id-khối") do main.js gắn (kèm màn chờ tải).
 *
 * Hàm được tra theo TÊN đúng lúc bấm (window[tên]), không giữ sẵn: api_thang.js,
 * main.js, canhbao.js "bọc" lại các hàm này sau khi nạp, nên bấm phải gọi bản
 * đã bọc — y như onclick cũ.
 *
 * NẠP: cuối <body>, sau main.js (các nút đã có trong trang).
 * ===========================================================================*/
(function () {
    function goi(ten, thamSo) {
        const ham = window[ten];
        if (typeof ham === 'function') ham.apply(window, thamSo);
    }
    function gan(selector, xuLy) {
        document.querySelectorAll(selector).forEach(function (nut) {
            nut.addEventListener('click', function () { xuLy(nut); });
        });
    }

    gan('[data-action="toggle-sidebar"]', function () { goi('toggleSidebar', []); });
    gan('[data-filter="apply"]', function (nut) { goi('applyUniversalFilter', [nut.dataset.chart]); });
    gan('[data-filter="clear"]', function (nut) { goi('clearUniversalFilter', [nut.dataset.chart]); });
    /* chỉ nút có data-chart: nút lật trang của biểu đồ sản lượng do production.js tự gắn */
    gan('[data-chart][data-page-step]', function (nut) { goi('latTrangBieuDo', [nut.dataset.chart, Number(nut.dataset.pageStep)]); });
})();
