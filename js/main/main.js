/* =============================================================================
 * main.js — KHỞI ĐỘNG TRANG: ĐIỀU HƯỚNG, CHỜ DỮ LIỆU, LÀM MỚI ĐỊNH KỲ
 * =============================================================================
 * FILE NÀY LÀM GÌ (nạp CUỐI CÙNG trong các script thường, chạy lúc DOMContentLoaded)
 *   0) Bọc showSubContent để mọi lần mở khối biểu đồ đều báo cho DieuPhoi.
 *   1) Hàm chờ dữ liệu TK3 + TK4 (khiCoDuLieu) và lớp "ĐANG TẢI DỮ LIỆU...".
 *   2) Gắn sự kiện cho các mục trong menu bên.
 *   3) Mở đúng mục theo địa chỉ #... lúc vào trang (initPage).
 *   4) Chuyển mục khi bấm thanh điều hướng trên cùng.
 *   5) Trình chiếu ảnh trang chủ.
 *   6) Gọi loadGoogleSheetData() (api_loaded.js) và làm mới định kỳ 15 phút.
 *
 * "MỤC" và "KHỐI"
 *   Mục  = một <section class="panel-section"> (hoặc #trang-chu) — mỗi lúc chỉ hiện
 *          MỘT mục, chọn bằng thanh điều hướng trên cùng.
 *   Khối = một .chart-group trong mục Tiêu hao / Chất lượng — chọn bằng menu bên.
 *
 * NHỮNG ĐIỀU ĐÃ SỬA SO VỚI BẢN CŨ (để hiểu vì sao code trông như vậy)
 *   - Bỏ setTimeout 500 ms giả tải trang: đổi mục chỉ là bật/tắt display, mất
 *     chưa tới 1 ms — nửa giây kia là chờ suông mỗi lần bấm.
 *   - Bỏ vòng dò setInterval 200 ms: nghe sự kiện TK3DataReady / TK4DataReady
 *     vừa đúng lúc hơn vừa không đánh thức máy 5 lần mỗi giây.
 *   - Gộp ba DOMContentLoaded thành một, để thứ tự chạy nhìn được bằng mắt.
 *   - Trình chiếu ảnh dừng khi trang chủ bị ẩn hoặc tab bị ẩn.
 * ===========================================================================*/

document.addEventListener('DOMContentLoaded', function () {

    /* =========================================================================
     * 0. BỌC showSubContent — phải làm TRƯỚC mọi thứ khác
     * ---------------------------------------------------------------------
     * DieuPhoi (chart_cook.js) cần biết khối nào đang mở để quyết định vẽ gì và
     * nhấp nháy cái nào. Bọc ở ĐÂY chứ không sửa sidebar.js vì: main.js nạp sau
     * cùng nên chắc chắn showSubContent đã tồn tại; và bọc thì phủ được MỌI
     * đường gọi — bấm menu bên, onclick còn sót trong HTML, bảng nhận xét.
     * =======================================================================*/
    (function bocShowSubContent() {
        const goc = window.showSubContent;
        if (typeof goc !== 'function') {
            console.warn('[Điều hướng] Chưa thấy showSubContent — sidebar.js nạp sau main.js?');
            return;
        }
        window.showSubContent = function (contentId) {
            /* try/catch KHÔNG phải để giấu lỗi — lỗi vẫn in đỏ ra Console. Nó để một
               sự cố ở tầng giao diện không kéo theo chết tầng dữ liệu.
               Đã gặp thật: "menuTH is not defined" trong toggleSidebar() làm
               showSubContent() ném lỗi giữa chừng, dòng moKhoi() bên dưới không
               chạy, khối biểu đồ hiện ra rỗng mà chẳng ai hiểu vì sao. Lúc đó khối
               đã được hiện (display = 'flex') rồi, nên vẫn phải vẽ. */
            try {
                goc.apply(this, arguments);
            } catch (e) {
                console.error('[Điều hướng] showSubContent lỗi, vẫn tiếp tục vẽ biểu đồ:', e);
            }
            if (window.DieuPhoi) window.DieuPhoi.moKhoi(contentId);
        };
    })();

    const allNavLinks = document.querySelectorAll('.nav-bar a[href^="#"], .logo a[href^="#"]');
    const allSections = document.querySelectorAll('#trang-chu, .panel-section');
    const loadingScreen = document.getElementById('loading-screen');

    /** Đã có số liệu CẢ HAI dây chưa. */
    const isDataFullyLoaded = function () {
        return (window.masterSheetDataTK3 && window.masterSheetDataTK3.length > 0) &&
               (window.masterSheetDataTK4 && window.masterSheetDataTK4.length > 0);
    };

    /* =========================================================================
     * 1. CHỜ DỮ LIỆU — nghe sự kiện thay vì dò
     * =======================================================================*/

    /** Gọi xong() khi đã có số liệu cả hai dây (gọi ngay nếu đã có). Lưới bảo vệ:
     *  quá 10 giây vẫn gọi, để lớp chờ không treo mãi khi API lỗi. */
    function khiCoDuLieu(xong) {
        if (isDataFullyLoaded()) { xong(); return; }

        let daXong = false;
        let idLuoi = null;

        const ketThuc = function () {
            if (daXong) return;
            daXong = true;
            document.removeEventListener('TK3DataReady', nghe);
            document.removeEventListener('TK4DataReady', nghe);
            if (idLuoi) clearTimeout(idLuoi);
            xong();
        };
        function nghe() { if (isDataFullyLoaded()) ketThuc(); }

        document.addEventListener('TK3DataReady', nghe);
        document.addEventListener('TK4DataReady', nghe);
        idLuoi = setTimeout(ketThuc, 10000);   /* lưới bảo vệ, tránh treo web */
    }

    /** Hiện lớp chờ "ĐANG TẢI DỮ LIỆU..." phủ gọn bên trong khung containerId
     *  (chứ không phủ cả trang). Trả về phần tử lớp chờ để gỡ sau. */
    function showLocalLoader(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        container.style.position = 'relative';
        const oldLoader = container.querySelector('.sidebar-local-loader');
        if (oldLoader) oldLoader.remove();

        const loaderDiv = document.createElement('div');
        loaderDiv.className = 'sidebar-local-loader';
        loaderDiv.innerHTML =
            '<div class="modern-spinner"></div>' +
            '<div class="loader-text">ĐANG TẢI DỮ LIỆU...</div>';
        container.appendChild(loaderDiv);
        return loaderDiv;
    }

    /* =========================================================================
     * 2. MENU BÊN — các mục <a onclick="showSubContent('id-khối')">
     * ---------------------------------------------------------------------
     * Thay onclick gốc bằng trình nghe riêng: vẫn mở khối như cũ, nhưng nếu số
     * liệu chưa về thì phủ lớp chờ lên khối cho tới khi có.
     * Gắn TRƯỚC initPage() để cú mở khối tự động (nếu có) cũng đi qua trình
     * nghe này.
     * =======================================================================*/
    const sidebarItems = document.querySelectorAll('.side-nav-content a[onclick^="showSubContent"]');

    sidebarItems.forEach(function (item) {
        /* Lấy id khối từ chuỗi onclick: showSubContent('tieu-hao-than') -> tieu-hao-than */
        const match = item.getAttribute('onclick').match(/'([^']+)'/);
        if (!match) return;
        const targetId = match[1];

        item.removeAttribute('onclick');   /* vô hiệu hoá onclick gốc trong HTML */

        item.addEventListener('click', function (e) {
            e.preventDefault();

            /* Mở khối trước — bản bọc ở mục 0 sẽ báo cho DieuPhoi vẽ. */
            if (typeof window.showSubContent === 'function') {
                window.showSubContent(targetId);
            }

            if (isDataFullyLoaded()) return;   /* có dữ liệu rồi thì xem ngay */

            const loader = showLocalLoader(targetId);
            khiCoDuLieu(function () {
                if (loader) loader.remove();
            });
        });
    });

    /* =========================================================================
     * 3. VÀO TRANG: MỞ ĐÚNG MỤC THEO ĐỊA CHỈ (#...)
     * =======================================================================*/

    /** '#abc' -> phần tử id="abc", không có thì null. Không bao giờ ném lỗi. */
    function timMucTheoHash(hash) {
        if (!hash || hash.charAt(0) !== '#' || hash.length < 2) return null;
        let id = hash.slice(1);
        try { id = decodeURIComponent(id); } catch (e) { /* giữ nguyên */ }
        return document.getElementById(id);
    }

    /** Ẩn mọi mục, hiện mục theo địa chỉ (mặc định / không khớp -> trang chủ). */
    function initPage() {
        let currentHash = window.location.hash || '#trang-chu';
        allSections.forEach(function (sec) { sec.style.display = 'none'; });

        /* Tìm bằng id chứ không dùng querySelector(hash): hash gõ tay hoặc id bắt
           đầu bằng chữ số (#5s-vscn) làm querySelector NÉM LỖI, mà lỗi ở đây xảy
           ra TRƯỚC loadGoogleSheetData() bên dưới -> cả trang không có số liệu.
           Hash không khớp mục nào thì về trang chủ thay vì để trang trắng. */
        let targetSection = timMucTheoHash(currentHash);
        if (!targetSection) {
            currentHash = '#trang-chu';
            targetSection = timMucTheoHash(currentHash);
        }
        if (targetSection) {
            targetSection.style.display = 'block';
            if (typeof updateSidebarVisibility === 'function') {
                updateSidebarVisibility(currentHash);
            }
        }
    }
    initPage();

    /* =========================================================================
     * 4. THANH ĐIỀU HƯỚNG TRÊN CÙNG — chuyển mục ngay, không chờ
     * ---------------------------------------------------------------------
     * Ẩn mọi mục, hiện mục được bấm, cuộn lên đầu mục (chừa 120px cho các thanh
     * cố định), đổi khối menu bên cho khớp. (sidebar.js cũng nghe cú bấm này để
     * đóng menu bên.)
     * =======================================================================*/
    allNavLinks.forEach(function (link) {
        link.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetSection = timMucTheoHash(targetId);
            if (!targetSection) return;

            e.preventDefault();
            if (loadingScreen) loadingScreen.style.display = 'none';

            allSections.forEach(function (sec) { sec.style.display = 'none'; });
            targetSection.style.display = 'block';
            window.scrollTo({ top: targetSection.offsetTop - 120, behavior: 'smooth' });

            if (typeof updateSidebarVisibility === 'function') {
                updateSidebarVisibility(targetId);
            }
        });
    });

    /* =========================================================================
     * 5. TRÌNH CHIẾU ẢNH TRANG CHỦ — đổi ảnh mỗi 4 giây, dừng khi không ai xem
     * =======================================================================*/
    const slides = document.querySelectorAll('.slide');
    const trangChu = document.getElementById('trang-chu');
    if (slides.length > 0) {
        let currentSlide = 0;
        setInterval(function () {
            if (document.hidden) return;
            if (trangChu && trangChu.style.display === 'none') return;
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 4000);
    }

    /* =========================================================================
     * 6. NẠP DỮ LIỆU VÀ LÀM MỚI ĐỊNH KỲ
     * ---------------------------------------------------------------------
     * Apps Script đẩy số liệu lên máy chủ liên tục trong ngày; màn hình treo ở
     * xưởng phải tự cập nhật. Làm mới 15 phút một lần là rẻ: mỗi câu trả lời có
     * ETag, dữ liệu không đổi thì máy chủ chỉ đáp 304 rỗng — không tải lại,
     * không vẽ lại.
     *   - Tab đang ẩn thì bỏ lượt, không tốn mạng cho màn hình không ai xem.
     *   - Quay lại tab mà đã quá hạn thì lấy ngay, khỏi đợi hết chu kỳ.
     * (Kiểm tra mỗi phút xem đã đến hạn chưa.)
     * =======================================================================*/
    const CHU_KY_LAM_MOI = 15 * 60 * 1000;
    let lanTaiCuoi = Date.now();

    function lamMoiNeuDenHan() {
        if (document.hidden) return;
        if (Date.now() - lanTaiCuoi < CHU_KY_LAM_MOI) return;
        lanTaiCuoi = Date.now();
        console.info('[Dữ liệu] Đến hạn làm mới — đang lấy dữ liệu mới từ Cloudflare KV.');
        loadGoogleSheetData();
    }

    loadGoogleSheetData();
    setInterval(lamMoiNeuDenHan, 60 * 1000);
    document.addEventListener('visibilitychange', lamMoiNeuDenHan);
});
