/* =============================================================================
 * sidebar.js — MENU BÊN (ngăn kéo trượt từ trái) VÀ CHUYỂN MỤC
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Trang có một ngăn kéo menu bên (#my-sidebar, lớp .side-nav-drawer) mở bằng
 *   nút ☰ đặt cạnh tiêu đề các mục Tiêu hao / Chất lượng / Vật tư. Trong ngăn
 *   kéo có 5 khối menu, mỗi mục trên thanh trên dùng MỘT khối (SIDEBAR_MENU_MAP).
 *   File này lo:
 *     updateSidebarVisibility(#mục)  hiện đúng khối menu của mục đang xem
 *     toggleSidebar()                mở / đóng ngăn kéo (nút ☰ và nút ×)
 *     showSubContent(id)             mở MỘT khối biểu đồ (.chart-group), ẩn các
 *                                    khối khác, cuộn tới, đóng ngăn kéo
 *     closeSidebar()                 đóng ngăn kéo
 *
 *   showSubContent được "bọc" thêm ở hai nơi (mỗi lớp gọi lại lớp bên trong):
 *     - main.js     báo cho DieuPhoi (chart_cook.js) vẽ khối vừa mở;
 *     - canhbao.js  ẩn bảng nhận xét khi đã chọn một khối.
 * ===========================================================================*/

/* Mục nào trên thanh trên (#id của mục) đi với khối menu bên nào (id khối).
   Phải liệt kê ĐỦ cả năm khối: trước đây chỉ khai Tiêu hao và Chất lượng, ba khối
   của Vật tư không ai quản -> xem Vật tư xong quay lại Tiêu hao thì dòng "Vật tư
   xuất trong tháng" vẫn nằm lại trong menu. Liệt kê đủ thì mỗi lần chuyển mục chỉ
   còn đúng một khối được hiện. */
const SIDEBAR_MENU_MAP = {
    '#tieu-hao-san-xuat': 'sidebar-menu-tieu-hao',
    '#chat-luong'       : 'sidebar-menu-chat-luong',
    '#vat-tu-thanh-ghi' : 'sidebar-menu-vat-tu',
    '#vat-tu-tam-op'    : 'sidebar-menu-vat-tu-op',
    '#vat-tu-tong-hop'  : 'sidebar-menu-vat-tu-thang',
};

/** Hiện đúng khối menu bên của mục targetId (vd '#chat-luong'), ẩn các khối khác.
 *  Mục không có menu bên (Trang chủ, Nhân sự, Sản lượng...) -> ẩn sạch.
 *  main.js gọi mỗi khi chuyển mục. */
function updateSidebarVisibility(targetId) {
    const menuDangDung = SIDEBAR_MENU_MAP[targetId] || null;

    /* Duyệt hết mọi khối menu: đúng khối của mục đang xem thì hiện, còn lại ẩn */
    Object.keys(SIDEBAR_MENU_MAP).forEach(function (muc) {
        const id = SIDEBAR_MENU_MAP[muc];
        const khoi = document.getElementById(id);
        if (khoi) khoi.style.display = (id === menuDangDung) ? 'block' : 'none';
    });

    /* Ẩn nút mở menu khi mục không có menu bên.
       Ghi chú: index.html hiện KHÔNG có phần tử id="sidebar-toggle" (các nút ☰
       nằm sẵn trong từng mục) nên dòng này không có tác dụng — giữ lại vô hại. */
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) sidebarToggle.style.display = menuDangDung ? 'block' : 'none';
}

/** Mở / đóng ngăn kéo menu bên (ĐẢO trạng thái). index.html gọi qua onclick của
 *  nút ☰ và nút × trong ngăn kéo.
 *    #my-sidebar   thêm/bỏ lớp .open    -> ngăn kéo trượt ra / vào (navigation.css)
 *    #main-wrapper thêm/bỏ lớp .shifted -> nội dung đẩy sang phải, không bị che
 *                                          (layout.css) */
function toggleSidebar() {
    const sidebar = document.getElementById("my-sidebar");
    const Mainwrapper = document.getElementById("main-wrapper");
    if (sidebar) sidebar.classList.toggle("open");
    if (Mainwrapper) Mainwrapper.classList.toggle("shifted");

    /* ĐÃ XOÁ hai khối if (menuTH...) và if (menuCL...) từng nằm ở đây.
       Lý do: hai hằng menuTH / menuCL bị xoá trước đó nhưng hai khối DÙNG chúng
       thì còn -> đọc biến không tồn tại -> ReferenceError, làm chết
       toggleSidebar(), kéo theo chết showSubContent() và biểu đồ không vẽ.
       Không khôi phục: việc chúng làm (ẩn/hiện đúng khối menu theo mục đang mở)
       đã do updateSidebarVisibility() + SIDEBAR_MENU_MAP lo trọn. Hai nơi cùng
       quyết định một chuyện thì sớm muộn sẽ lệch nhau. */
}

/** Mở MỘT khối biểu đồ contentId (vd 'tieu-hao-than'): ẩn mọi .chart-group và
 *  dòng hướng dẫn .intro-msgs, hiện khối đó (display:flex), cuộn tới, đóng menu.
 *  Gọi từ: các mục trong menu bên, các dòng của bảng nhận xét (canhbao.js). */
function showSubContent(contentId) {
    /* Ẩn mọi khối biểu đồ */
    const allCharts = document.querySelectorAll('.chart-group');
    allCharts.forEach(chart => {chart.style.display = 'none'});

    /* Ẩn các dòng hướng dẫn "Mở menu và chọn để xem dữ liệu" */
    const introMsgs = document.querySelectorAll('.intro-msgs');
    introMsgs.forEach(msg => {msg.style.display = 'none'});

    /* Hiện khối được chọn, cuộn tới mục chứa nó (chừa 100px cho thanh trên) */
    const target = document.getElementById(contentId);
    if (target) {
        target.style.display = 'flex';
        window.scrollTo({ top: target.parentElement.offsetTop - 100, behavior: 'smooth'});
    }
    /* Đã chọn xong -> ĐÓNG menu bên (không dùng toggleSidebar).
       toggleSidebar là ĐẢO trạng thái: bấm từ menu bên (đang mở) thì đóng, đúng;
       nhưng bấm từ bảng nhận xét (menu đang đóng) thì lại MỞ menu ra, che mất
       biểu đồ vừa nhảy tới. */
    closeSidebar();
}

/** Đóng ngăn kéo menu bên (luôn đóng, không đảo).
 *  (.sidebar-backdrop hiện không có trong index.html — dòng đó vô hại.) */
function closeSidebar() {
    const drawer = document.querySelector('.side-nav-drawer');
    const wrapper = document.getElementById('main-wrapper');
    const backdrop = document.querySelector('.sidebar-backdrop');

    if (drawer) drawer.classList.remove('open');
    if (wrapper) wrapper.classList.remove('shifted');
    if (backdrop) backdrop.classList.remove('open');
}

/* -----------------------------------------------------------------------------
 * BẤM LIÊN KẾT TRÊN THANH ĐIỀU HƯỚNG (.nav-links a, .dropdown-content a)
 * Với liên kết dạng #mục có thật: chặn nhảy mặc định, đóng menu bên, đánh dấu
 * mục đích là .active-view. (Việc ẩn/hiện mục và đổi khối menu bên do main.js
 * làm — cùng một cú bấm, cả hai trình nghe đều chạy.)
 * --------------------------------------------------------------------------- */
document.querySelectorAll('.dropdown-content a, .nav-links a').forEach(link => {
    link.addEventListener('click', function(e) {
        let targetId = this.getAttribute('href');
        if(!targetId || !targetId.startsWith('#')) return;

        /* getElementById chứ không querySelector: querySelector('#5s-vscn') ném
           lỗi với id bắt đầu bằng chữ số */
        let targetSection = document.getElementById(targetId.slice(1));
        if(targetSection) {
            e.preventDefault();

            // 1. Tự động đóng menu bên
            closeSidebar();

            // 2. Ẩn/hiện nút menu bên theo mục.
            //    Ghi chú: index.html hiện KHÔNG có phần tử .sidebar-toggle-btn (các
            //    nút ☰ dùng lớp 'siderbar-toggle-btn', và các id trong allowedTabs
            //    cũng không khớp mục thật nào) nên khối này không có tác dụng.
            const sidebarBtn = document.querySelector('.sidebar-toggle-btn');

            const allowedTabs = ['#san-luong', '#tieu-hao-sx', '#tab-chat-luong'];

            if (sidebarBtn) {
                if (allowedTabs.includes(targetId)) {
                    sidebarBtn.style.display = 'block'; // Hiện nút nếu đúng tab cho phép
                } else {
                    sidebarBtn.style.display = 'none';  // Ẩn nút đi nếu qua tab khác
                }
            }

            // 3. Đánh dấu mục đang xem: bỏ .active-view ở các .page-view (hiện chỉ
            //    có #trang-chu mang lớp này — CSS ẩn nó khi mất lớp), gắn cho mục đích
            document.querySelectorAll('.page-view').forEach(page => {
                page.classList.remove('active-view');
            });
            targetSection.classList.add('active-view');
        }
    });
});
