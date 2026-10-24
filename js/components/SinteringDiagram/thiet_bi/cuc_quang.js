/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/cuc_quang.js — VẼ CỤC QUẶNG ĐA GIÁC (HÀM DÙNG CHUNG)
 * =============================================================================
 * makeChunkShape, drawChunk: cục quặng góc cạnh như cục vỡ thật — dùng ở máy
 * làm mát vòng, băng xích / dòng quặng đổ, liệu bị đánh bể sau trụ nghiền.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

/* --- Vẽ 1 cục quặng dạng ĐA GIÁC (góc cạnh như cục vỡ thật) ---
   shape: mảng hệ số bán kính cho từng đỉnh, sinh 1 lần rồi tái dùng. */
export const makeChunkShape = (verts = 7) =>
    Array.from({ length: verts }, () => 0.68 + Math.random() * 0.42);

/* Vẽ đường viền MỘT cục quặng đa giác tại (x, y), cỡ size, xoay spin (radian).
   Chỉ vạch đường — nơi gọi tự beginFill / endFill để gom nhiều cục một lần tô. */
export const drawChunk = (g, x, y, size, shape, spin = 0) => {
    const n = shape.length;
    for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2;
        const r = size * shape[i];
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
};
