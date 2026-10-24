/* =============================================================================
 * js/components/SinteringDiagram/lap_rap/nha_tram.jsx — VÁ GÓC BĂNG TẢI + NHÀ TRẠM S1, S2
 * =============================================================================
 * CornerPatch (mảng vá chỗ băng rẽ góc), drawBuildingTopDown (vẽ nhà trạm nhìn
 * từ trên xuống), StationS1, StationS2.
 *
 * Một phần LẮP RÁP sơ đồ (thư mục lap_rap/, trước 24/10/2026 nằm chung trong
 * pixiStage.jsx — đọc đầu pixiStage.jsx để biết cả sơ đồ). Toạ độ lấy từ CFG
 * (cau_hinh.js) và LAYOUT (bo_cuc.js); thiết bị lấy từ diagramContainer.jsx.
 * ===========================================================================*/

import React from 'react';
import { Container, Graphics } from '@pixi/react';
import { COLORS, lerpColor } from '../diagramContainer.jsx';

import { CFG } from '../cau_hinh.js';
import { LAYOUT } from '../bo_cuc.js';

/* =============================================================================
 * CÁC HÀM VẼ TĨNH & COMPONENT PHỤ
 * ===========================================================================*/

const PATCH_SIZE = CFG.BELT_HEIGHT;     // 35
const PATCH_HALF = PATCH_SIZE / 2;      // 17.5

/* Vá góc trên-trái: nối băng ngang (đi sang phải) với băng dọc (đi xuống) */
const drawTopLeftPatch = (g) => {
    g.clear();
    g.lineStyle(0);
    g.beginFill(COLORS.surfaceLight);
    g.drawRect(0, 0, PATCH_SIZE, PATCH_SIZE);

    g.lineStyle(2, COLORS.borderGray);
    g.moveTo(PATCH_HALF, 0); g.lineTo(PATCH_SIZE, 0);
    g.moveTo(0, PATCH_HALF); g.lineTo(0, PATCH_SIZE);
    g.moveTo(0, PATCH_HALF); g.arc(PATCH_HALF, PATCH_HALF, PATCH_HALF, Math.PI, Math.PI * 1.5);
};

/* Vá góc dưới-trái: nối băng dọc (đi xuống) rẽ sang băng ngang (đi phải) */
const drawBottomLeftPatch = (g) => {
    g.clear();
    g.lineStyle(0);
    g.beginFill(COLORS.surfaceLight);
    g.drawRect(0, 0, PATCH_SIZE, PATCH_SIZE);

    // Viền lề trái và lề dưới
    g.lineStyle(2, COLORS.borderGray);
    g.moveTo(0, 0); g.lineTo(0, PATCH_HALF);
    g.moveTo(PATCH_HALF, PATCH_SIZE); g.lineTo(PATCH_SIZE, PATCH_SIZE);

    g.moveTo(PATCH_HALF, PATCH_SIZE);
    g.arc(PATCH_HALF, PATCH_HALF, PATCH_HALF, Math.PI / 2, Math.PI);

    g.moveTo(PATCH_SIZE, PATCH_HALF);
    g.lineTo(PATCH_SIZE, 0);
    g.lineTo(PATCH_HALF, 0);
};

/* Kiểu mảng vá -> hàm vẽ tương ứng (CornerPatch chọn theo variant) */
const PATCH_DRAWERS = {
    'top-left': drawTopLeftPatch,
    'bottom-left': drawBottomLeftPatch,
};

/** Mảng vá góc chữ L, đè lên để che mí nối giữa 2 băng tải vuông góc. */
export const CornerPatch = ({ x, y, variant }) => (
    <Container x={x} y={y}>
        <Graphics draw={PATCH_DRAWERS[variant]} />
    </Container>
);

/* --- Trạm S2 — TOÀ NHÀ 2 TẦNG nhìn từ trên xuống --- */

/* Toà nhà nhìn TỪ TRÊN XUỐNG (mái bằng công nghiệp):
   - Bệ/sân bao quanh + bóng đổ mềm
   - Các tầng GIẬT CẤP (mỗi bậc mái = 1 tầng), sáng dần lên cao
   - Mái tầng trên cùng: lõi thang bộ + buồng thang máy + 2 cụm điều hoà + bồn nước
   - Ô cửa mái (skylight) chạy dọc mái, rãnh thoát nước, mái đua lối vào
   -> nhìn ra được số tầng và không còn "thô" như khối hộp đặc. */
export const drawBuildingTopDown = (g, w, h, floors, roof) => {
    g.clear();

    /* --- bóng đổ mềm (2 lớp) --- */
    g.lineStyle(0);
    g.beginFill(COLORS.ink, 0.10);
    g.drawRoundedRect(10, 12, w, h, 12);
    g.endFill();
    g.beginFill(COLORS.ink, 0.10);
    g.drawRoundedRect(5, 6, w, h, 12);
    g.endFill();

    /* --- sân/bệ bê tông bao quanh chân nhà --- */
    g.lineStyle(1.5, COLORS.borderGray, 0.85);
    g.beginFill(COLORS.surfaceLight, 0.95);
    g.drawRoundedRect(-7, -7, w + 14, h + 14, 12);
    g.endFill();

    /* --- các tầng giật cấp --- */
    const inset = Math.max(9, Math.min(18, (Math.min(w, h) * 0.42) / floors));
    let ix = 0, iy = 0, fw = w, fh = h;
    for (let f = 0; f < floors; f++) {
        ix = f * inset; iy = f * inset * 0.72;
        fw = w - ix * 2; fh = h - iy * 2;
        if (fw < 26 || fh < 26) break;
        const t = f / Math.max(1, floors - 1);
        const col = lerpColor(roof, COLORS.steelLight, 0.06 + 0.66 * t);
        // vệt bóng của bậc trên đổ xuống mái bậc dưới
        if (f > 0) {
            g.lineStyle(0);
            g.beginFill(COLORS.ink, 0.13);
            g.drawRoundedRect(ix - 4, iy - 4, fw + 8, fh + 8, 9);
            g.endFill();
        }
        g.lineStyle(2, COLORS.machineDark, 0.85);
        g.beginFill(col, 0.99);
        g.drawRoundedRect(ix, iy, fw, fh, 8);
        g.endFill();
        // gờ mái (parapet) chạy quanh mép mỗi bậc
        g.lineStyle(1.2, COLORS.white, 0.5);
        g.drawRoundedRect(ix + 4, iy + 4, fw - 8, fh - 8, 6);
    }

    /* --- chi tiết trên MÁI tầng trên cùng --- */
    const cx0 = ix, cy0 = iy, cw = fw, ch = fh;
    if (cw > 40 && ch > 40) {
        // lõi thang bộ + buồng thang máy
        g.lineStyle(1.8, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.machineBody, 0.98);
        g.drawRoundedRect(cx0 + 9, cy0 + 9, Math.min(30, cw * 0.34), Math.min(24, ch * 0.2), 4);
        g.endFill();
        g.beginFill(COLORS.steelFrame, 0.98);
        g.drawRoundedRect(cx0 + 9, cy0 + 9 + Math.min(24, ch * 0.2) + 5, Math.min(22, cw * 0.26), 14, 3);
        g.endFill();
        // 2 cụm điều hoà / quạt mái
        g.lineStyle(1.5, COLORS.machineDark, 0.85);
        for (let k = 0; k < 2; k++) {
            const ux = cx0 + cw - 34, uy = cy0 + 12 + k * 26;
            if (uy + 18 < cy0 + ch - 8) {
                g.beginFill(COLORS.steelLight, 0.98);
                g.drawRoundedRect(ux, uy, 24, 18, 3);
                g.endFill();
                g.lineStyle(1, COLORS.borderGray, 0.9);
                for (let i = 1; i <= 3; i++) { g.moveTo(ux + i * 6, uy + 3); g.lineTo(ux + i * 6, uy + 15); }
                g.lineStyle(1.5, COLORS.machineDark, 0.85);
            }
        }
        // bồn nước tròn
        g.lineStyle(1.6, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.dustLight, 0.98);
        g.drawCircle(cx0 + cw - 20, cy0 + ch - 20, 8);
        g.endFill();
        // ô cửa mái (skylight) chạy dọc giữa mái
        g.lineStyle(0);
        g.beginFill(COLORS.surfaceLight, 0.92);
        for (let sy = cy0 + 16; sy < cy0 + ch - 20; sy += 20) {
            g.drawRoundedRect(cx0 + cw * 0.42, sy, Math.min(16, cw * 0.16), 11, 2);
        }
        g.endFill();
        // rãnh thoát nước mái
        g.lineStyle(1, COLORS.borderGray, 0.75);
        g.moveTo(cx0 + 6, cy0 + ch / 2); g.lineTo(cx0 + cw - 6, cy0 + ch / 2);
    }

    /* --- mái đua lối vào (cạnh dưới) --- */
    g.lineStyle(1.8, COLORS.machineDark, 0.8);
    g.beginFill(COLORS.steelFrame, 0.95);
    g.drawRoundedRect(w * 0.30, h - 3, w * 0.30, 14, 4);
    g.endFill();
};

/* --- Trạm trung chuyển S2 — toà nhà nhìn từ trên xuống (vị trí, số tầng ở CFG.S2) --- */
const drawStationS2Box = (g) => drawBuildingTopDown(g, CFG.S2.w, CFG.S2.h, CFG.S2.floors, COLORS.industrialOrange);

export const StationS2 = () => (
    <Container x={CFG.S2.x} y={CFG.S2.y}>
        <Graphics draw={drawStationS2Box} />
    </Container>
);

/* --- Trạm S1 — TOÀ NHÀ 5 TẦNG nhìn từ trên xuống (giật cấp rõ 5 bậc mái) --- */
const drawStationS1Box = (g) =>
    drawBuildingTopDown(g, LAYOUT.s1Box.width, LAYOUT.s1Box.height, CFG.S1.floors, COLORS.industrialOrange);

export const StationS1 = () => (
    <Container x={LAYOUT.s1Box.x} y={LAYOUT.s1Box.y}>
        <Graphics draw={drawStationS1Box} />
    </Container>
);
