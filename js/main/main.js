/* =========================================================
                    HỆ THỐNG GIẢ TẢI TRANG
   ========================================================= */


document.addEventListener("DOMContentLoaded", () => {
    // 1. CHỈ LẤY CÁC LINK CỦA THANH NAV TRÊN CÙNG
    const allNavLinks = document.querySelectorAll('.nav-bar a[href^="#"], .logo a[href^="#"]'); 
    
    const allSections = document.querySelectorAll('#trang-chu, .panel-section');
    const loadingScreen = document.getElementById('loading-screen'); 

    function initPage() {
        const currentHash = window.location.hash || '#trang-chu';
        allSections.forEach(sec => sec.style.display = 'none');
        const targetSection = document.querySelector(currentHash);
        if (targetSection) {
            targetSection.style.display = 'block';
            if (typeof updateSidebar === 'function') {
                updateSidebarVisibility(currentHash);
            }
        }
    }
    initPage();
    
    /*  allSections.forEach(sec => sec.style.display = 'none');
    const homeSection = document.getElementById('trang-chu');
    if(homeSection) homeSection.style.display = 'block'; */

    // ===== LUỒNG 1: XỬ LÝ THANH ĐIỀU HƯỚNG TRÊN CÙNG (NAVBAR) =====
    allNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const targetSection = document.querySelector(targetId);

            if (targetSection){
                e.preventDefault();
                if (loadingScreen) loadingScreen.style.display = 'block';

                setTimeout(() => {
                    if (loadingScreen) loadingScreen.style.display = 'none';
                    allSections.forEach(sec => sec.style.display = 'none');
                    targetSection.style.display = 'block';
                    window.scrollTo({top: targetSection.offsetTop - 120, behavior: 'smooth'});
                    
                    if (typeof updateSidebarVisibility === 'function') {
                        updateSidebarVisibility(targetId);
                    }
                }, 500);
            }
        });
    });

    // ===== LUỒNG 2: XỬ LÝ RIÊNG CHO SIDEBAR (KIỂM TRA CHỦ ĐỘNG) =====
    const sidebarItems = document.querySelectorAll('.side-nav-content a[onclick^="showSubContent"]');
    
    const isDataFullyLoaded = () => {
        return (window.masterSheetDataTK3 && window.masterSheetDataTK3.length > 0) &&
               (window.masterSheetDataTK4 && window.masterSheetDataTK4.length > 0);
    };

    // Hàm tạo và chèn màn hình Loading Hiện đại vào đúng khung biểu đồ
    const showLocalLoader = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return null;
        
        container.style.position = 'relative'; // Bắt buộc để lớp phủ nằm gọn bên trong

        // Xoá loader cũ nếu có
        const oldLoader = container.querySelector('.sidebar-local-loader');
        if (oldLoader) oldLoader.remove();

        // Tạo mảng loading mới
        const loaderDiv = document.createElement('div');
        loaderDiv.className = 'sidebar-local-loader';
        loaderDiv.innerHTML = `
            <div class="modern-spinner"></div>
            <div class="loader-text">ĐANG TẢI DỮ LIỆU...</div>
        `;
        container.appendChild(loaderDiv);
        return loaderDiv;
    };

    sidebarItems.forEach(item => {
        const match = item.getAttribute('onclick').match(/'([^']+)'/);
        if (!match) return;
        const targetId = match[1];

        // Vô hiệu hoá onclick gốc trên HTML
        item.removeAttribute('onclick');

        item.addEventListener('click', function(e) {
            e.preventDefault();

            // 1. Luôn gọi lệnh mở khung giao diện của biểu đồ ra trước
            if (typeof window.showSubContent === 'function') {
                window.showSubContent(targetId); 
            }

            // 2. KIỂM TRA DỮ LIỆU: CÓ RỒI THÌ BỎ QUA LOADING
            if (isDataFullyLoaded()) {
                // Nếu data đã tải xong, không làm gì cả, xem biểu đồ ngay lập tức
                return; 
            } 
            // 3. NẾU CHƯA CÓ DATA: MỚI BẬT LOADING VÀ CHỜ
            else {
                // Chỉ bật Local Loader khi thực sự thiếu data
                const loader = showLocalLoader(targetId);

                // Quét liên tục 200ms để đợi API nạp xong thì tắt
                const checkInterval = setInterval(() => {
                    if (isDataFullyLoaded()) {
                        clearInterval(checkInterval);
                        if(loader) loader.remove(); // Có dữ liệu -> Xoá lớp mờ, biểu đồ hiện ra
                    }
                }, 200);

                // Lưới bảo vệ 10s tránh treo web
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (loader) loader.remove(); 
                }, 10000);
            }
        });
    });
});


document.addEventListener("DOMContentLoaded", function() {
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');

    if(slides.length > 0) {
        setInterval(function() {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide+1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 4000);
    }
});



/* ===================================================================================
                    HỆ THỐNG TỰ ĐỘNG LẤY DỮ LIỆU CẬP NHẬT                               
   =================================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    loadGoogleSheetData();

    const TIME_INTERVAL = 28800000;

    setInterval(() => {
        console.log("Đã qua 8 tiếng. Đang tự động lấy dữ liệu mới từ dữ liệu nguồn");
        loadGoogleSheetData();
    }, TIME_INTERVAL);
});
