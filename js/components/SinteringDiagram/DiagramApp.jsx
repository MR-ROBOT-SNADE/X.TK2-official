/* =============================================================================
 * DiagramApp.jsx — ĐIỂM VÀO CỦA SƠ ĐỒ CÔNG NGHỆ: CHỈ TẢI KHI ĐƯỢC MỞ
 * =============================================================================
 * index.html nạp file này bằng <script type="module"> (Vite gói riêng). Nhiệm
 * vụ duy nhất: dựng component sơ đồ (pixiStage.jsx) vào khung #react-sodo-boot
 * trong mục #so-do-cong-nghe — nhưng CHỈ khi cần.
 *
 * VÌ SAO: React + Pixi + sơ đồ nặng ~1,1 MB JS (275 KB sau nén). Bản cũ tải,
 * dịch và dựng toàn bộ ngay lúc mở trang — kể cả khung WebGL — trong khi mục sơ
 * đồ đang ẩn và phần lớn người xem chỉ vào xem biểu đồ.
 *
 * CÁCH LÀM: dùng import() động để Vite tách sơ đồ thành gói riêng, chỉ tải gói
 * đó khi:
 *   - khung #react-sodo-boot hiện ra (bấm menu, hoặc mở thẳng link #so-do-cong-nghe);
 *   - hoặc TẢI TRƯỚC khi rê chuột / chạm vào menu sơ đồ, để lúc bấm là có sẵn.
 *
 * Không dùng cú pháp JSX trong file này (dù đuôi .jsx): JSX kéo react/jsx-runtime
 * vào gói chính, mất một phần cái lợi của việc tách.
 * ===========================================================================*/
const domNode = document.getElementById('react-sodo-boot');

/** Tải (một lần) 3 gói: react, react-dom, và sơ đồ. Gọi nhiều lần vẫn chỉ tải
 *  một lần — các lần sau dùng lại cùng lời hứa. */
let loiHuaGoi = null;
function taiGoiSoDo() {
    if (!loiHuaGoi) {
        loiHuaGoi = Promise.all([
            import('react'),
            import('react-dom/client'),
            import('./pixiStage.jsx'),
        ]);
    }
    return loiHuaGoi;
}

/** Tải gói rồi dựng sơ đồ vào khung (một lần). Tải lỗi thì cho phép thử lại. */
let daDung = false;
function dungSoDo() {
    if (daDung) return;
    daDung = true;
    taiGoiSoDo().then(function ([nsReact, nsReactDOM, goiSoDo]) {
        /* react / react-dom là gói CommonJS: tuỳ bản Vite, hàm nằm ở namespace
           hoặc ở .default — lấy chỗ nào có. */
        const React = nsReact.createElement ? nsReact : nsReact.default;
        const ReactDOM = nsReactDOM.createRoot ? nsReactDOM : nsReactDOM.default;
        ReactDOM.createRoot(domNode).render(React.createElement(goiSoDo.default));
    }).catch(function (e) {
        daDung = false;
        loiHuaGoi = null;
        console.error('[Sơ đồ công nghệ] Không tải được gói sơ đồ:', e);
    });
}

if (domNode) {
    if (typeof IntersectionObserver === 'function') {
        /* Mục đang display:none thì không bao giờ "giao" với màn hình; vừa được
           hiện ra là quan sát viên báo ngay. */
        const io = new IntersectionObserver(function (cacMuc) {
            if (cacMuc.some(function (m) { return m.isIntersecting; })) {
                io.disconnect();
                dungSoDo();
            }
        }, { rootMargin: '200px' });
        io.observe(domNode);
    } else {
        dungSoDo();
    }

    /* Tải trước khi người xem có ý định mở (rê chuột / chạm / focus vào liên kết) */
    document.querySelectorAll('a[href="#so-do-cong-nghe"]').forEach(function (a) {
        a.addEventListener('pointerenter', taiGoiSoDo, { once: true });
        a.addEventListener('touchstart', taiGoiSoDo, { once: true, passive: true });
        a.addEventListener('focus', taiGoiSoDo, { once: true });
    });
} else {
    console.error("Cannot find div card name id = 'react-sodo-boot'");
}
