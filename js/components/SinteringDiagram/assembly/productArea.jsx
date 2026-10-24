/* =============================================================================
 * js/components/SinteringDiagram/assembly/productArea.jsx — KHU THÀNH PHẨM
 * =============================================================================
 * Nhà sàng 3 tầng + 4 tuyến băng, trạm S3 / S4, bãi liệu (đống quặng), khu xe
 * tải + silo xe tải, máng, nhà lấy mẫu; ProductBelt (băng thành phẩm).
 *
 * Một phần LẮP RÁP sơ đồ (thư mục assembly/, trước 24/10/2026 nằm chung trong
 * pixiStage.jsx — đọc đầu pixiStage.jsx để biết cả sơ đồ). Toạ độ lấy từ CFG
 * (stageConfig.js) và LAYOUT (layout.js); thiết bị lấy từ diagramContainer.jsx.
 * ===========================================================================*/

import React from 'react';
import { BLACK_SINTER_COLORS, COLORS, MainConveyorPlaceHolder } from '../diagramContainer.jsx';

import { CFG } from '../stageConfig.js';
import { drawBuildingTopDown } from './stations.jsx';

/* =============================================================================
 * KHU THÀNH PHẨM — NHÀ SÀNG 3 TẦNG + 4 TUYẾN BĂNG
 * Vẽ SỚM NHẤT trong TopFeedingSection để toàn bộ sơ đồ cũ nằm đè lên trên:
 *   - hộp Trạm S1 che đầu phải băng vàng
 *   - nhà trạm khử sắt che đầu phải băng đỏ
 *   - hộp Trạm S2 che đầu trên băng xanh đi lên
 * Riêng NHÀ SÀNG vẽ NGAY SAU 4 băng nên nó che chỗ 2 băng xanh xuyên qua và che
 * đầu trái của băng đỏ/vàng -> nhìn như các băng cắm thẳng vào nhà sàng.
 * ===========================================================================*/
export const drawScreenHouseBox = (g) =>
    drawBuildingTopDown(
        g, CFG.SCREEN_HOUSE.width, CFG.SCREEN_HOUSE.height,
        CFG.SCREEN_HOUSE.floors, COLORS.siloBody,
    );

export const drawS3Box = (g) =>
    drawBuildingTopDown(g, CFG.S3.width, CFG.S3.height, CFG.S3.floors, COLORS.industrialOrange);

/* TRẠM TRUNG CHUYỂN S4 — chặng cuối trước khi quặng sang máng gang. */
export const drawS4Box = (g) =>
    drawBuildingTopDown(g, CFG.S4.width, CFG.S4.height, CFG.S4.floors, COLORS.industrialOrange);

/* Sinh cục liệu cho 1 đống trong bãi chứa — bộ số giả ngẫu nhiên HẠT CỐ ĐỊNH
   nên đống không nhảy chỗ mỗi lần vẽ lại. */
const makePile = (seed0, R, deg, n = 130) => {
    let seed = seed0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const a0 = ((deg - 62) * Math.PI) / 180;
    const a1 = ((deg + 62) * Math.PI) / 180;
    return Array.from({ length: n }, () => {
        const a = a0 + rnd() * (a1 - a0);
        const t = 0.25 + Math.sqrt(rnd()) * 0.72;
        return {
            x: Math.cos(a) * t * R,
            y: Math.sin(a) * t * R,
            r: 2.4 + rnd() * 4.6,
            c: BLACK_SINTER_COLORS[Math.floor(rnd() * BLACK_SINTER_COLORS.length)],
        };
    });
};
/* Mỗi máy đánh đống một đống liệu, sinh MỘT lần khi nạp (hạt khác nhau theo i) */
const YARD_PILES = CFG.STOCK_YARD.booms.map((b, i) =>
    makePile(20260728 + i * 7919, CFG.STOCK_YARD.sweepR, b.deg));

/* BÃI CHỨA THÀNH PHẨM + 2 MÁY ĐÁNH ĐỐNG - RÚT LIỆU.
   Dựng theo bản vẽ mặt bằng: băng gallery chạy dọc giữa bãi, mỗi máy đặt trên
   gallery, cần quay quét một vòng tròn và vun ra một đống hình quạt.
   Không gắn nhãn. */
export const drawStockYard = (g) => {
    const Y = CFG.STOCK_YARD;
    const { width: w, height: h, galleryY: gy, sweepR: R } = Y;
    g.clear();

    // sân bê tông + hàng rào bãi.
    // LỚP LÓT ĐỤC vẽ trước: nền bãi vốn chỉ đục 22% nên đầu 2 băng tải cắm từ
    // trên xuống vẫn lộ xuyên qua, nhìn như băng nổi trên mái nhà vòm.
    g.lineStyle(0);
    g.beginFill(COLORS.white, 1);
    g.drawRoundedRect(-12, -12, w + 24, h + 24, 14);
    g.endFill();
    g.lineStyle(2.5, COLORS.machineDark, 0.5);
    g.beginFill(COLORS.dustLight, 0.22);
    g.drawRoundedRect(-12, -12, w + 24, h + 24, 14);
    g.endFill();
    g.lineStyle(1.5, COLORS.machineDark, 0.30);
    g.drawRect(8, 8, w - 16, h - 16);

    Y.booms.forEach((b, i) => {
        g.lineStyle(1.4, COLORS.machineDark, 0.35);      // vòng quét của cần
        g.drawCircle(b.cx, gy, R);
        g.lineStyle(0);                                   // đống liệu hình quạt
        YARD_PILES[i].forEach((p) => {
            g.beginFill(p.c, 0.9);
            g.drawRect(b.cx + p.x - p.r, gy + p.y - p.r, p.r * 2, p.r * 2);
            g.endFill();
        });
    });

    // BĂNG GALLERY chạy NGANG giữa bãi (trước đây chạy dọc)
    g.lineStyle(2, COLORS.machineDark, 0.9);
    g.beginFill(COLORS.dustGray, 0.9);
    g.drawRect(22, gy - 11, w - 44, 22);
    g.endFill();

    // Thân cần + trụ quay + gàu rót nay do <StackerReclaimer> vẽ và làm hoạt
    // ảnh riêng, xem phần render bên dưới.

};

/* KHU XẢ XE BEN: 2 silo xanh + ống xả + đường xe ben chạy dưới. */
export const drawTruckArea = (g) => {
    const A = CFG.TRUCK_AREA;
    g.clear();
    g.lineStyle(2.5, COLORS.siloBorder, 0.85);
    g.beginFill(COLORS.dustLight, 0.28);
    g.drawRoundedRect(0, 0, A.width, A.height, 16);
    g.endFill();
};

/* 2 silo xả quặng xuống xe ben (CFG.TRUCK_SILOS) + làn xe dưới đáy
   (CFG.TRUCK_LANE), vẽ trong khung khu xe (CFG.TRUCK_AREA) */
export const drawTruckSilos = (g) => {
    const S = CFG.TRUCK_SILOS, A = CFG.TRUCK_AREA, L = CFG.TRUCK_LANE;
    const lx = S.x - A.x;
    g.clear();
    // ỐNG XẢ chạy từ silo trên, luồn sau silo dưới, xuống tới đường xe ben
    g.lineStyle(2, COLORS.machineDark, 0.9);
    g.beginFill(COLORS.dustGray, 0.95);
    g.drawRect(lx - 9, S.ys[0] - A.y, 18, (L.y - A.y) - (S.ys[0] - A.y));
    g.endFill();
    // 2 SILO
    S.ys.forEach((sy) => {
        const cy = sy - A.y;
        g.lineStyle(3, COLORS.siloBorder);
        g.beginFill(COLORS.siloBody, 0.95);
        g.drawCircle(lx, cy, S.radius);
        g.endFill();
        g.lineStyle(1.5, COLORS.siloBorder, 0.6);
        g.drawCircle(lx, cy, S.radius * 0.62);
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.35);
        g.drawCircle(lx, cy, S.radius * 0.24);
        g.endFill();
    });
};

/* BẾN XẢ XE BEN: chỉ còn LÀN ĐƯỜNG + vạch kẻ.
   2 xe ben vẽ cứng trước đây ĐÃ BỎ — nay là đoàn xe CHẠY THẬT do <HaulTrucks>
   điều khiển: đứng nhận quặng ngay tại bến này rồi chở sang lò cao. */
export const drawTruckLane = (g) => {
    const L = CFG.TRUCK_LANE;
    g.clear();
    g.lineStyle(2, COLORS.machineDark, 0.75);
    g.beginFill(COLORS.machineDark, 0.16);
    g.drawRoundedRect(0, 0, L.width, L.height, 6);
    g.endFill();
    g.lineStyle(2, COLORS.dustLight, 0.9);                       // vạch tim đường
    for (let x = 8; x < L.width - 8; x += 22) {
        g.moveTo(x, L.height / 2);
        g.lineTo(x + 12, L.height / 2);
    }
};

/* Nền khu vực máng quặng thành phẩm: chỉ là sân bê tông bo góc + viền mảnh,
   KHÔNG có nhãn, để silo và băng nổi rõ lên trên. */
export const drawTroughArea = (g) => {
    const { width: w, height: h } = CFG.TROUGH_AREA;
    g.clear();
    g.lineStyle(2.5, COLORS.siloBorder, 0.85);
    g.beginFill(COLORS.dustLight, 0.28);
    g.drawRoundedRect(0, 0, w, h, 16);
    g.endFill();
    g.lineStyle(1.5, COLORS.siloBorder, 0.45);
    g.drawRoundedRect(9, 9, w - 18, h - 18, 10);
};

/* Nhà trạm lấy mẫu — toà nhà nhìn từ trên xuống (CFG.SAMPLE_HOUSE) */
export const drawSampleHouseBox = (g) =>
    drawBuildingTopDown(g, CFG.SAMPLE_HOUSE.width, CFG.SAMPLE_HOUSE.height,
                        CFG.SAMPLE_HOUSE.floors, COLORS.siloBorder);

/* Băng "liệu thành phẩm ĐỦ CỠ HẠT": mỗi hạt bốc cỡ ngẫu nhiên trong dải
   1.0 .. 2.6 nên trên cùng một băng có cả cục to lẫn hạt mịn.
   Trước đây phải CHỒNG 2 BĂNG (lớp 2.6 + lớp 1.0) mới ra hiệu ứng này -> tốn
   gấp đôi số hạt; nay MainConveyorPlaceHolder nhận particleScale dạng dải nên
   1 lớp là đủ, nhìn y hệt mà nhẹ đi một nửa.
   PRODUCT_GRAIN để ở cấp module (không tạo mảng mới mỗi lần render) để useMemo
   sinh hạt bên trong băng không bị chạy lại liên tục. */
const PRODUCT_GRAIN = [1.0, 2.6];

/* Băng tải chở quặng thành phẩm (hạt đen, đủ cỡ) — dùng cho mọi tuyến khu thành phẩm */
export const ProductBelt = ({ x, y, length, angle = 0, reverseFlow = false }) => (
    <MainConveyorPlaceHolder
        x={x} y={y} length={length} angle={angle} reverseFlow={reverseFlow}
        particleColors={BLACK_SINTER_COLORS} particleScale={PRODUCT_GRAIN}
    />
);
