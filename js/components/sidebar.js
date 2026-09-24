/* =========================================================
        HỆ THỐNG XỬ LÝ SIDEBAR (MENU PHỤ)
   ========================================================= */
/* Mục nào trên thanh trên đi với khối menu bên nào.
   Trước đây chỉ khai báo hai mục Tiêu hao và Chất lượng, còn ba khối menu bên
   của Vật tư không ai quản. Xem mục Vật tư xong quay lại Tiêu hao hay Chất
   lượng thì dòng "Vật tư xuất trong tháng" vẫn nằm lại trong menu, trùng với
   mục đã có sẵn bên Vật tư. Liệt kê đủ cả năm khối thì mỗi lần chuyển mục
   chỉ còn đúng một khối được hiện. */
const SIDEBAR_MENU_MAP = {
    '#tieu-hao-san-xuat': 'sidebar-menu-tieu-hao',
    '#chat-luong'       : 'sidebar-menu-chat-luong',
    '#vat-tu-thanh-ghi' : 'sidebar-menu-vat-tu',
    '#vat-tu-tam-op'    : 'sidebar-menu-vat-tu-op',
    '#vat-tu-tong-hop'  : 'sidebar-menu-vat-tu-thang',
};

function updateSidebarVisibility(targetId) {
    /* Khối menu ứng với mục đang mở. Mục nào không có menu bên (Trang chủ,
       Nhân sự, Sản lượng...) thì trả về null, khi đó ẩn sạch. */
    const menuDangDung = SIDEBAR_MENU_MAP[targetId] || null;

    /* Duyệt hết mọi khối menu: đúng khối của mục đang xem thì hiện, còn lại ẩn */
    Object.keys(SIDEBAR_MENU_MAP).forEach(function (muc) {
        const id = SIDEBAR_MENU_MAP[muc];
        const khoi = document.getElementById(id);
        if (khoi) khoi.style.display = (id === menuDangDung) ? 'block' : 'none';
    });

    /* Nếu chuyển đi nav khác đi ẩn nút sidebar đi */
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) sidebarToggle.style.display = menuDangDung ? 'block' : 'none';
}

/* Hàm để xử lý việc đẩy và giấu sidebar đi */
function toggleSidebar() {
    /* Khai báo 2 hằng để xử lý sidebar và đẩy giao diện sang phải tránh che nội dung */
    const sidebar = document.getElementById("my-sidebar");
    const Mainwrapper = document.getElementById("main-wrapper");
    /* Nếu phần tử sidebar có tồn tại, hãy chuyển sang CSS và bật class .open (bên CSS là sidebar-backdrop.open) 
       tương tự với Mainwrapper, bên phía layout CSS và mainwrapper-backdrop.open*/
    if (sidebar) sidebar.classList.toggle("open");
    if (Mainwrapper) Mainwrapper.classList.toggle("shifted");

    /* ĐÃ XOÁ hai khối if (menuTH...) và if (menuCL...).
       Lý do: hai hằng menuTH / menuCL đã bị xoá khỏi hàm này, nhưng hai khối
       DÙNG chúng thì còn lại -> đọc biến không tồn tại -> ReferenceError, làm
       chết toggleSidebar(), kéo theo chết showSubContent() và biểu đồ không vẽ.

       Không khôi phục lại hai hằng đó, vì việc chúng làm (ẩn/hiện đúng khối
       menu bên theo mục đang mở) đã do updateSidebarVisibility() +
       SIDEBAR_MENU_MAP lo trọn. Khôi phục là tạo ra hai nguồn quyết định cho
       cùng một chuyện, lần sau lại lệch nhau. */
}

/* Hàm xử lý cho việc show các thành phần tiêu hao con trong thanh sidebar */
function showSubContent(contentId) {
    /* Lấy thông tin các thành phần (rất nhiều nên dùng querySelectorAll thay vì dùng ) */
    const allCharts = document.querySelectorAll('.chart-group');
    /* Đi qua từng biểu đồ trong danh sách allchart và ẩn chúng đi (cấu trúc forEach) hàm mũi tên => đóng vai trò biểu thị hành động sẽ được thực hiện cho mỗi phần tử */
    allCharts.forEach(chart => {chart.style.display = 'none'});

    /* Khai báo hằng lấy thông tin toàn bộ các messages chỉ dẫn để bấm vào sidebar menu */
    const introMsgs = document.querySelectorAll('.intro-msgs');
    /* Hàm xử lý ẩn đi tương tự khi chuyển sang sidebar  */
    introMsgs.forEach(msg => {msg.style.display = 'none'});

    /* Xử lý đẩy nội dung sang phải khi mở thanh sidebar */
    const target = document.getElementById(contentId);
    if (target) {
        target.style.display = 'flex';
        window.scrollTo({ top: target.parentElement.offsetTop - 100, behavior: 'smooth'});
    }
    /* Đã chọn xong biểu đồ -> ĐÓNG menu bên (không dùng toggleSidebar).
       toggleSidebar là ĐẢO trạng thái: bấm từ menu bên (đang mở) thì đóng, đúng;
       nhưng bấm từ thẻ trong bảng nhận xét (menu đang đóng) thì lại MỞ menu ra,
       che mất biểu đồ vừa nhảy tới. */
    closeSidebar();
}

function closeSidebar() {
    const drawer = document.querySelector('.side-nav-drawer');
    const wrapper = document.getElementById('main-wrapper');
    const backdrop = document.querySelector('.sidebar-backdrop');

    if (drawer) drawer.classList.remove('open');
    if (wrapper) wrapper.classList.remove('shifted');
    if (backdrop) backdrop.classList.remove('open');
}

document.querySelectorAll('.dropdown-content a, .nav-links a').forEach(link => {
    link.addEventListener('click', function(e) {
        let targetId = this.getAttribute('href');
        if(!targetId || !targetId.startsWith('#')) return;

        /* getElementById: querySelector('#5s-vscn') ném lỗi với id bắt đầu bằng số */
        let targetSection = document.getElementById(targetId.slice(1));
        if(targetSection) {
            e.preventDefault(); 

            // 1. TỰ ĐỘNG ĐÓNG SIDEBAR
            closeSidebar();

            // 2. KIỂM TRA VÀ ẨN/HIỆN NÚT SIDEBAR
            const sidebarBtn = document.querySelector('.sidebar-toggle-btn');
            
            // Khai báo danh sách các ID của nhóm "SẢN XUẤT - CHẤT LƯỢNG"
            // Vui lòng sửa lại mảng này cho khớp với các ID thực tế trong file HTML của bạn
            const allowedTabs = ['#san-luong', '#tieu-hao-sx', '#tab-chat-luong']; 

            if (sidebarBtn) {
                if (allowedTabs.includes(targetId)) {
                    sidebarBtn.style.display = 'block'; // Hiện nút nếu đúng tab cho phép
                } else {
                    sidebarBtn.style.display = 'none';  // Ẩn nút đi nếu qua tab khác
                }
            }

            // 3. Logic chuyển tab cũ của bạn
            document.querySelectorAll('.page-view').forEach(page => {
                page.classList.remove('active-view');
            });
            targetSection.classList.add('active-view');
        }
    });
});
