/* =============================================================================
 * THANH ĐIỀU HƯỚNG TỰ CO GIÃN — nav_fit.js
 * =============================================================================
 * VẤN ĐỀ
 *   Thanh menu trên cùng có 6 mục tên dài, cần ~1.700px ở cỡ chữ 12px. Để cỡ chữ
 *   cố định thì màn hình hẹp bị cắt mất các mục cuối ở mép phải (trang đang
 *   overflow-x: hidden nên cũng không cuộn ngang ra được).
 *
 * CÁCH LÀM: ĐO THẬT rồi chọn cách hiển thị dễ đọc nhất mà vẫn vừa, theo thứ tự:
 *   1) MỘT DÒNG — co / giãn cỡ chữ trong 10,5–14px cho vừa bề ngang (màn rộng)
 *   2) HAI DÒNG — tên mục được xuống 2 dòng, cỡ chữ 9,5–12px (laptop)
 *   3) GỌN      — quá hẹp (điện thoại): nút ☰ MENU mở danh sách xổ xuống
 *   Cả 3 cách đều giữ thanh cao ĐÚNG 60px (xem css/navigation.css: các lớp
 *   nav-bar--hai-dong, nav-bar--gon, nav-bar--mo và biến --nav-fs).
 *
 * ĐO LẠI KHI: bề ngang thanh đổi (kéo cửa sổ, Ctrl +/-, xoay màn hình), logo tải
 * xong, phông Roboto tải xong (phông khác thì bề rộng chữ khác), quay lại tab.
 * Vì đo bằng số thật nên đổi tên mục, thêm / bớt mục cũng tự vừa — không phải
 * chỉnh con số nào.
 *
 * NẠP Ở ĐÂU: ngay SAU thanh menu trong index.html (không đợi cuối trang), để
 * thanh được co giãn trước lần vẽ đầu tiên — không thấy cảnh tràn rồi mới co.
 * ===========================================================================*/
(function () {
    const nav = document.querySelector('.nav-bar');
    const links = nav && nav.querySelector('.nav-links');
    if (!nav || !links) return;

    const logo = nav.querySelector('.logo');
    const nut = nav.querySelector('.nav-toggle');      /* nút ☰ của chế độ GỌN */

    const CFG = {
        motDong: { min: 10.5, max: 14 },   /* khoảng cỡ chữ (px) của chế độ một dòng */
        haiDong: { min: 9.5, max: 12 },    /* ... của chế độ hai dòng */
        buoc: 0.25,                        /* bước dò cỡ chữ */
        rongMenuCon: 300,   /* bề ngang ước của menu xổ xuống (CSS min-width 280) */
    };

    /** Đặt cỡ chữ của thanh (CSS đọc biến --nav-fs). */
    function datCo(fs) {
        nav.style.setProperty('--nav-fs', fs + 'px');
    }

    /** Bề ngang dành cho nội dung thanh (trừ đệm hai bên).
     *  Dùng clientWidth/offsetWidth (không dùng getBoundingClientRect) vì
     *  base.css đặt zoom cho body ở màn hình <= 1080px: các số này cùng một hệ
     *  đơn vị, so với nhau không bị lệch theo zoom. */
    function choTrong() {
        const cs = getComputedStyle(nav);
        return nav.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }

    /** Có bị tràn không: logo + phần menu cần nhiều hơn chỗ trống. Chừa 1px cho sai
     *  số làm tròn: ở chế độ hai dòng, khối menu co vừa KHÍT chỗ còn lại nên hai
     *  vế bằng nhau. */
    function tran() {
        return (logo ? logo.offsetWidth : 0) + links.scrollWidth > choTrong() + 1;
    }

    /** Một mục menu đang chiếm mấy dòng chữ: đếm số "hàng" khác nhau mà các khung
     *  chữ của nó nằm trên. */
    function soDong(a) {
        const r = document.createRange();
        r.selectNodeContents(a);
        const tops = new Set();
        const rects = r.getClientRects();
        for (let i = 0; i < rects.length; i++) tops.add(Math.round(rects[i].top));
        return tops.size;
    }

    /** Có mục nào phải xuống quá 2 dòng không (khi đó chế độ hai dòng không đạt). */
    function quaHaiDong() {
        const cac = links.querySelectorAll(':scope > li > a');
        for (let i = 0; i < cac.length; i++) if (soDong(cac[i]) > 2) return true;
        return false;
    }

    /** Mở / đóng danh sách xổ xuống của chế độ GỌN. */
    function datMo(mo) {
        nav.classList.toggle('nav-bar--mo', mo);
        if (nut) nut.setAttribute('aria-expanded', mo ? 'true' : 'false');
    }

    /** Thử chế độ MỘT DÒNG. Được thì giữ, trả true. */
    function thuMotDong() {
        nav.classList.remove('nav-bar--hai-dong', 'nav-bar--gon');
        datCo(12);
        /* Chữ và đệm tính theo em nên bề ngang các mục tỉ lệ thuận với cỡ chữ;
           logo thì cố định. Đo ở 12px, tính thẳng ra cỡ vừa khít, rồi dò lùi
           từng bước phòng sai số làm tròn. */
        const logoW = logo ? logo.offsetWidth : 0;
        let fs = 12 * (choTrong() - logoW) / links.scrollWidth;
        fs = Math.min(CFG.motDong.max, Math.floor(fs / CFG.buoc) * CFG.buoc);
        if (fs < CFG.motDong.min) return false;
        datCo(fs);
        while (tran() && fs > CFG.motDong.min) { fs -= CFG.buoc; datCo(fs); }
        return !tran();
    }

    /** Thử chế độ HAI DÒNG: lùi cỡ chữ từ 12 xuống 9,5 tới khi vừa và không mục
     *  nào quá 2 dòng. Không được thì trả lại trạng thái cũ, trả false. */
    function thuHaiDong() {
        nav.classList.add('nav-bar--hai-dong');
        for (let fs = CFG.haiDong.max; fs >= CFG.haiDong.min; fs -= 0.5) {
            datCo(fs);
            if (!tran() && !quaHaiDong()) return true;
        }
        nav.classList.remove('nav-bar--hai-dong');
        return false;
    }

    /** Mục gần mép phải thì cho menu con mở sang TRÁI (khỏi tràn khỏi màn hình). */
    function canhMenuCon() {
        const rong = nav.clientWidth;
        links.querySelectorAll(':scope > li.dropdown').forEach(function (li) {
            li.classList.toggle('dropdown--mo-trai', li.offsetLeft + CFG.rongMenuCon > rong);
        });
    }

    /** Chọn chế độ hiển thị: một dòng -> hai dòng -> gọn.
     *  batBuoc = false: bề ngang không đổi so với lần đo trước thì thôi (tránh đo
     *  thừa). batBuoc = true: đo lại dù bề ngang không đổi (vd vừa đổi phông). */
    let rongDaDo = -1;
    function coGian(batBuoc) {
        const rong = nav.clientWidth;
        if (!rong) return;                       /* tab đang ẩn, chưa có bố cục để đo */
        if (!batBuoc && rong === rongDaDo) return;
        rongDaDo = rong;

        if (thuMotDong() || thuHaiDong()) {
            datMo(false);
            canhMenuCon();
        } else {
            nav.classList.remove('nav-bar--hai-dong');
            nav.classList.add('nav-bar--gon');
            datCo(12);
        }
    }

    coGian(true);

    /* Đo lại NGAY trong ResizeObserver, không hoãn sang requestAnimationFrame:
       ResizeObserver chạy sau khi trình duyệt tính bố cục và TRƯỚC khi vẽ, nên
       thanh không bao giờ kịp hiện ra ở trạng thái tràn. (Hoãn sang khung hình
       sau thì ở tab bị trình duyệt giảm nhịp, lần đo có thể trễ hẳn.)
       Theo dõi border-box: đổi chế độ làm đổi đệm (5% <-> 2%) — theo dõi
       content-box thì chính lần co giãn lại tự kích hoạt observer thêm lần nữa. */
    if (typeof ResizeObserver === 'function') {
        new ResizeObserver(function () { coGian(false); }).observe(nav, { box: 'border-box' });
        /* Logo cỡ cố định, chỉ đổi khi ảnh logo tải xong / đổi ảnh */
        if (logo) new ResizeObserver(function () { coGian(true); }).observe(logo);
    } else {
        window.addEventListener('resize', function () { coGian(false); });
    }
    /* Phông chữ tải xong thì bề rộng chữ đổi -> đo lại */
    if (document.fonts) {
        document.fonts.ready.then(function () { coGian(true); });
        document.fonts.addEventListener('loadingdone', function () { coGian(true); });
    }
    /* Tab bị ẩn thì trình duyệt không chạy ResizeObserver; đổi cỡ cửa sổ lúc đó
       xong mới quay lại tab thì đo lại cho chắc. */
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) coGian(false);
    });

    /* Gọi tay trong Console (F12) để ép đo lại: coGianThanhMenu() */
    window.coGianThanhMenu = function () { coGian(true); };

    /* ---- Chế độ GỌN: mở / đóng danh sách ---- */
    if (nut) {
        nut.addEventListener('click', function (e) {
            e.stopPropagation();               /* không để cú bấm lọt xuống document (đóng lại ngay) */
            datMo(!nav.classList.contains('nav-bar--mo'));
        });
    }
    /* Bấm một mục có đích (#...) thì đóng lại; bấm tên nhóm (mở menu con) thì không */
    links.addEventListener('click', function (e) {
        const a = e.target.closest('a');
        if (a && (a.getAttribute('href') || '').charAt(0) === '#') datMo(false);
    });
    /* Bấm ra ngoài thanh hoặc nhấn Esc thì đóng */
    document.addEventListener('click', function (e) {
        if (nav.classList.contains('nav-bar--mo') && !nav.contains(e.target)) datMo(false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') datMo(false);
    });
})();
