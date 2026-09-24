/* =============================================================================
 * main.js — ĐIỀU HƯỚNG TRANG
 * -----------------------------------------------------------------------------
 * Thay đổi so với bản trước:
 *   1) Bọc showSubContent -> mọi đường mở khối biểu đồ đều báo cho DieuPhoi biết.
 *      Bọc ở ĐÂY chứ không sửa sidebar.js, vì main.js nạp sau cùng nên chắc chắn
 *      showSubContent đã tồn tại; và bọc thì phủ được CẢ ba đường gọi: bấm menu,
 *      onclick còn sót trong HTML, và moMucDauTien() tự bấm hộ.
 *   2) Bỏ setTimeout 500 ms giả tải trang. Việc đổi mục chỉ là bật/tắt display,
 *      mất chưa tới 1 ms — nửa giây kia là chờ suông, mỗi lần bấm nav.
 *   3) Bỏ vòng dò setInterval 200 ms. api_loaded.js đã bắn sẵn TK3DataReady /
 *      TK4DataReady; nghe sự kiện vừa đúng lúc hơn vừa không đánh thức luồng
 *      chính 5 lần mỗi giây.
 *   4) Gộp ba DOMContentLoaded thành một, để thứ tự chạy nhìn được bằng mắt.
 *   5) Trình chiếu ảnh trang chủ dừng khi trang chủ bị ẩn hoặc tab bị ẩn.
 *   6) Gắn trình nghe cho menu bên TRƯỚC initPage(), để khối tự mở đầu tiên cũng
 *      có lớp chờ "ĐANG TẢI DỮ LIỆU..." như khi bấm tay.
 * ===========================================================================*/

document.addEventListener('DOMContentLoaded', function () {

    /* =========================================================================
     * 0. BỌC showSubContent — phải làm TRƯỚC mọi thứ khác
     * ---------------------------------------------------------------------
     * DieuPhoi cần biết khối nào đang mở để quyết định vẽ gì và nhấp nháy cái
     * nào. Bọc thay vì sửa sidebar.js: không đụng file khác, và không bỏ sót
     * đường gọi nào.
     * =======================================================================*/
    (function bocShowSubContent() {
        const goc = window.showSubContent;
        if (typeof goc !== 'function') {
            console.warn('[Điều hướng] Chưa thấy showSubContent — sidebar.js nạp sau main.js?');
            return;
        }
        window.showSubContent = function (contentId) {
            /* try/catch KHÔNG phải để giấu lỗi — lỗi vẫn in đỏ ra Console.
               Nó để một sự cố ở tầng giao diện không kéo theo chết tầng dữ liệu.
               Đã gặp thật: menuTH is not defined trong toggleSidebar() làm
               showSubContent() ném lỗi giữa chừng, nên dòng moKhoi() bên dưới
               không chạy, khối biểu đồ hiện ra rỗng mà chẳng ai hiểu vì sao.
               Lúc đó target.style.display = 'flex' đã chạy xong rồi, nên vẫn
               phải vẽ — bỏ qua là hỏng đúng thứ quan trọng nhất. */
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

    const isDataFullyLoaded = function () {
        return (window.masterSheetDataTK3 && window.masterSheetDataTK3.length > 0) &&
               (window.masterSheetDataTK4 && window.masterSheetDataTK4.length > 0);
    };

    /* =========================================================================
     * 1. CHỜ DỮ LIỆU — nghe sự kiện thay vì dò
     * ---------------------------------------------------------------------
     * Bản cũ dò isDataFullyLoaded() mỗi 200 ms, nên vừa tốn nhịp vừa trễ tới
     * 200 ms sau khi dữ liệu đã sẵn sàng. Lưới bảo vệ 10 giây giữ nguyên.
     * =======================================================================*/
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

    /* Lớp chờ đặt gọn bên trong khung biểu đồ */
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
     * 2. MENU BÊN — gắn TRƯỚC initPage()
     * ---------------------------------------------------------------------
     * moMucDauTien() trong sidebar.js tự bấm hộ link đầu tiên, và nó được gọi
     * từ updateSidebarVisibility() bên trong initPage(). Gắn sau initPage như
     * bản cũ thì cú bấm hộ đó rơi vào onclick gốc, mất lớp chờ.
     * =======================================================================*/
    const sidebarItems = document.querySelectorAll('.side-nav-content a[onclick^="showSubContent"]');

    sidebarItems.forEach(function (item) {
        const match = item.getAttribute('onclick').match(/'([^']+)'/);
        if (!match) return;
        const targetId = match[1];

        item.removeAttribute('onclick');   /* vô hiệu hoá onclick gốc trong HTML */

        item.addEventListener('click', function (e) {
            e.preventDefault();

            /* Mở khung trước — bản bọc ở mục 0 sẽ báo cho DieuPhoi vẽ. */
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
     * 3. KHỞI TẠO TRANG THEO HASH
     * =======================================================================*/
    /** '#abc' -> phần tử id="abc", không có thì null. Không bao giờ ném lỗi. */
    function timMucTheoHash(hash) {
        if (!hash || hash.charAt(0) !== '#' || hash.length < 2) return null;
        let id = hash.slice(1);
        try { id = decodeURIComponent(id); } catch (e) { /* giữ nguyên */ }
        return document.getElementById(id);
    }

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
     * 4. THANH ĐIỀU HƯỚNG TRÊN CÙNG — bỏ nửa giây chờ suông
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
     * 5. TRÌNH CHIẾU ẢNH TRANG CHỦ — dừng khi không nhìn thấy
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
     * Dữ liệu nằm sẵn trên Cloudflare KV và được Apps Script đẩy lên liên tục,
     * nên chờ 8 tiếng mới lấy lại là quá lâu với màn hình treo ở xưởng. Làm mới
     * 15 phút một lần là rẻ: KV trả ETag, bảng tính không đổi thì máy chủ chỉ đáp
     * 304 rỗng, không tải lại, không vẽ lại.
     *   - Tab đang ẩn thì bỏ lượt, không tốn mạng cho màn hình không ai xem.
     *   - Quay lại tab mà đã quá hạn thì lấy ngay, khỏi đợi hết chu kỳ.
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
