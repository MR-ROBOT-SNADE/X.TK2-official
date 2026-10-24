/* =============================================================================
 * js/components/SinteringDiagram/equipment/fans.js — QUẠT HƯỚNG TRỤC CÔNG NGHIỆP (HÀM VẼ)
 * =============================================================================
 * drawIndustrialFan, drawFanAirflow: hàm vẽ quạt + luồng gió, dùng trong máy
 * làm mát vòng và các trạm có quạt.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import { COLORS } from './colors.js';

/* =============================================================================
 * QUẠT HƯỚNG TRỤC CÔNG NGHIỆP (industrial axial fan) — nhìn từ trên xuống.
 * Cấu tạo vẽ đúng theo thiết bị thật: mặt bích vuông + 4 bu-lông chân đế →
 * ống thổi loe nối vào vỏ máy làm mát → vỏ ống tròn (housing) → 6 cánh AEROFOIL
 * cong bản rộng → chân nhện đỡ động cơ → moay-ơ + chụp trục → hộp đấu điện.
 * (ux, uy) = vector đơn vị HƯỚNG VÀO tâm máy làm mát: dùng để xoay mặt bích và
 * ống thổi luôn quay đúng về phía vành, dù quạt đứng ở góc nào.
 * ===========================================================================*/
export const drawIndustrialFan = (g, cx, cy, r, phase, blades = 6, ux = -1, uy = 0, ductLen = 20) => {
    const TAU = Math.PI * 2;
    const hub = r * 0.30;
    const px = -uy, py = ux;                    // vector vuông góc với trục quạt

    /* Toạ độ theo hệ trục cục bộ: fwd = dọc trục (dương = về phía vành),
       side = ngang trục. Nhờ vậy quạt tự xoay theo vị trí quanh vành. */
    const P = (fwd, side) => [cx + ux * fwd + px * side, cy + uy * fwd + py * side];
    const poly = (pts) => {
        pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
        g.closePath();
    };

    /* 1) ỐNG THỔI: loe dần từ miệng quạt sang vỏ máy làm mát (đường gió vào) */
    g.lineStyle(1.5, COLORS.drumOutline, 0.9);
    g.beginFill(COLORS.ductBody, 0.95);
    poly([P(r * 0.55, -r * 0.55), P(r * 0.55 + ductLen, -r * 0.80),
          P(r * 0.55 + ductLen, r * 0.80), P(r * 0.55, r * 0.55)]);
    g.endFill();

    /* 2) MẶT BÍCH VUÔNG + 4 bu-lông (chân đế bắt vào bệ máy) */
    const s = r * 1.08;
    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(COLORS.steelFrame, 0.95);
    poly([P(-s, -s), P(s, -s), P(s, s), P(-s, s)]);
    g.endFill();
    g.lineStyle(0);
    g.beginFill(COLORS.machineDark, 0.85);
    [[-s * 0.78, -s * 0.78], [s * 0.78, -s * 0.78], [s * 0.78, s * 0.78], [-s * 0.78, s * 0.78]]
        .forEach(([f, sd]) => { const [bx, by] = P(f, sd); g.drawCircle(bx, by, r * 0.11); });
    g.endFill();

    /* 3) VỎ ỐNG TRÒN + họng gió tối phía trong (thấy chiều sâu ống) */
    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(COLORS.ductBody, 1);
    g.drawCircle(cx, cy, r);
    g.endFill();
    g.lineStyle(0);
    g.beginFill(COLORS.machineDark, 0.45);
    g.drawCircle(cx, cy, r * 0.92);
    g.endFill();

    /* 4) CÁNH AEROFOIL: gốc hẹp ở moay-ơ, bản loe rộng dần ra đầu cánh, mép
       thoát cong ngược chiều quay (dáng cánh quạt hướng trục thật) */
    g.lineStyle(1, COLORS.drumOutline, 0.55);
    g.beginFill(COLORS.steelFrame, 0.98);
    const tip = r * 0.9;
    for (let b = 0; b < blades; b++) {
        const a = phase + (b * TAU) / blades;
        const pt = (rad, ang) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
        const [x0, y0] = pt(hub, a - 0.16);
        const [c1x, c1y] = pt(tip * 0.70, a - 0.50);     // mép dẫn
        const [x1, y1] = pt(tip, a - 0.02);              // đầu cánh
        const [c2x, c2y] = pt(tip * 0.62, a + 0.62);     // mép thoát (cong ngược)
        const [x2, y2] = pt(hub, a + 0.30);
        g.moveTo(x0, y0);
        g.quadraticCurveTo(c1x, c1y, x1, y1);
        g.quadraticCurveTo(c2x, c2y, x2, y2);
        g.closePath();
    }
    g.endFill();

    /* 5) CHÂN NHỆN đỡ động cơ (cố định, KHÔNG quay) + moay-ơ + chụp trục */
    g.lineStyle(2.2, COLORS.machineBody, 0.95);
    for (let i = 0; i < 3; i++) {
        const a = (i * TAU) / 3 + 0.5;
        g.moveTo(cx + Math.cos(a) * hub, cy + Math.sin(a) * hub);
        g.lineTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97);
    }
    g.lineStyle(1.5, COLORS.drumOutline);
    g.beginFill(COLORS.machineDark);
    g.drawCircle(cx, cy, hub);
    g.endFill();
    g.lineStyle(0);
    g.beginFill(COLORS.steelLight, 0.9);
    g.drawCircle(cx, cy, hub * 0.40);
    g.endFill();

    /* 6) HỘP ĐẤU ĐIỆN gắn hông vỏ quạt */
    g.lineStyle(1.2, COLORS.drumOutline, 0.9);
    g.beginFill(COLORS.machineBody, 0.95);
    poly([P(-r * 0.30, -r * 1.02), P(r * 0.30, -r * 1.02),
          P(r * 0.30, -r * 1.34), P(-r * 0.30, -r * 1.34)]);
    g.endFill();
};

/* --- Hiệu ứng HÚT GIÓ TỪ NGOÀI VÀO: vệt gió lạnh bay từ môi trường ngoài,
   chui qua quạt rồi thổi tiếp vào lòng máng liệu để làm nguội quặng. --- */
export const drawFanAirflow = (g, fan, r, phase, reach, ringDepth) => {
    const { x: cx, y: cy, ux, uy } = fan;
    const px = -uy, py = ux;

    /* Gió ngoài trời bị hút vào: 3 làn vệt chạy dần về phía quạt */
    for (let k = -1; k <= 1; k++) {
        const t = (phase + (k + 1) * 0.33) % 1;
        const d = r + reach - t * reach;                 // khoảng cách giảm dần = đang bị hút
        const side = k * r * 0.66 * (0.45 + 0.55 * t);   // các làn chụm dần vào miệng quạt
        const sx = cx - ux * d + px * side;
        const sy = cy - uy * d + py * side;
        g.lineStyle(2, COLORS.coolAir, 0.25 + 0.55 * t);
        g.moveTo(sx, sy);
        g.lineTo(sx + ux * 9, sy + uy * 9);
        // Mũi tên nhỏ chỉ chiều gió vào
        g.lineStyle(1.6, COLORS.coolAir, 0.20 + 0.5 * t);
        g.moveTo(sx + ux * 9, sy + uy * 9);
        g.lineTo(sx + ux * 4 + px * 3, sy + uy * 4 + py * 3);
        g.moveTo(sx + ux * 9, sy + uy * 9);
        g.lineTo(sx + ux * 4 - px * 3, sy + uy * 4 - py * 3);
    }

    /* Gió lạnh xuyên qua quạt, thổi xuyên lớp liệu trong máng */
    for (let k = -1; k <= 1; k++) {
        const t = (phase * 1.35 + (k + 1) * 0.3) % 1;
        const d = r * 0.6 + t * ringDepth;
        const side = k * r * 0.42;
        const sx = cx + ux * d + px * side;
        const sy = cy + uy * d + py * side;
        g.lineStyle(2, COLORS.coolAir, 0.45 * (1 - t));
        g.moveTo(sx, sy);
        g.lineTo(sx + ux * 8, sy + uy * 8);
    }
};
