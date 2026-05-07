/* =========================================================
        HỆ THỐNG XỬ LÝ SIDEBAR (MENU PHỤ)
   ========================================================= */
function updateSidebarVisibility(targetId) {
    /* Khai báo các hằng số để làm sidebar bằng cách lấy id bên phía khung html */
    const menuTH = document.getElementById('sidebar-menu-tieu-hao');
    const menuCL = document.getElementById('sidebar-menu-chat-luong');
    /* Khai báo hằng phục vụ cho việc bật tắt toogle*/
    const sidebarToggle = document.getElementById('sidebar-toggle');

    // Hiện menu tương ứng, ẩn các menu còn lại
    const isTieuHao = (targetId === '#tieu-hao-san-xuat');
    const isChatLuong = (targetId === '#chat-luong');
    /* Dùng để ẩn hiện các giao diện của thanh sidebar
       Nguyên lý: Nếu hằng isTieuHao hoặc isChatLuong trả về bằng với đúng id đang chọn
       , CSS trả về giao diện, nếu không CSS trả về không (condition ? true : false là rút gọn của if else)  */
    if(menuTH) menuTH.style.display = isTieuHao ? 'block' : 'none';
    if(menuCL) menuCL.style.display = isChatLuong ? 'block' : 'none';

    /* Nếu chuyển đi nav khác đi ẩn nút sidebar đi */
    if(sidebarToggle) sidebarToggle.style.display = (isTieuHao || isChatLuong) ? 'block' : 'none';
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

    /* Khai báo 2 hằng biểu thị cho 2 nội dung trên nav bar là tiêu hao sản xuất và chất lượng đầu vào đầu ra */
    const tieuHaoSection = document.getElementById('tieu-hao-san-xuat');
    const chatLuongSection = document.getElementById('chat-luong');
    /* Khai báo 2 hằng biểu 2 sidebar menu tiêu hao chất lượng và menu tiêu hao */
    const menuTH = document.getElementById('#sidebar-menu-tieu-hao');
    const menuCL = document.getElementById('#sidebar-menu-chat-luong');
    
    /* Hàm kiểm tra nếu menu tiêu hao và sidebar tiêu hao cùng tồn tại */
    if (menuTH && tieuHaoSection) {
        /* Nếu 2 menu này cùng mở thì gọi CSS trả về giao diện của thanh mục tiêu hao sản xuất ban đầu */
        const isTHOpen = (tieuHaoSection.style.display === 'block');
        // Nếu isThOpen trả về true khi 2 biến trên trả về true, thì hãy mở menuTH (thanh sidebar) và đưa dòng lệnh 
        menuTH.style.setProperty('display', isTHOpen ? 'block' : 'none', 'important');
    }
    
    /* Tương tự cho cái trên nhưng sử dụng cho bên chất lượng */
    if (menuCL && chatLuongSection) {
        const isCLOpen = (chatLuongSection.style.display === 'block');
        menuCL.style.setProperty('display', isCLOpen ? 'block' : 'none', 'important');
    }
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
    /* Gọi hàm đẩy sidebar ra */
    toggleSidebar();
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

        let targetSection = document.querySelector(targetId);
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
