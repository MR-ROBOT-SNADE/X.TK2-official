/* =============================================================================
 * js/components/SinteringDiagram/equipment/blendingSilos.jsx — SILO PHỐI LIỆU + BĂNG CẤP LIỆU VÀO SILO
 * =============================================================================
 * SiloPlaceHolder (silo + đèn trạng thái), SiloFeedLine (băng cấp liệu vào dãy
 * silo). CoalCrusherPlaceholder: biểu tượng nhà nghiền than BẢN CŨ, không còn
 * dùng (thay bằng CoalCrushingPlant ở coalCrushing.jsx).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container, Sprite, Text } from '@pixi/react';

import {
    COLORS, TEXT_STYLE_LABEL, TEXT_STYLE_SILO_INDEX, lerpColor, randomItem
} from './colors.js';
import { BELT } from './conveyor.jsx';

/* =============================================================================
 * CONTAINER 1: NHÀ NGHIỀN THAN
 * ===========================================================================*/
const CRUSHER = {
    iconPath: 'images/icons/Nha_Nghien_Than.webp',
    size: 120,          // Icon vuông 120x120
    labelGap: 10,       // Khoảng cách từ đáy icon xuống nhãn
};

/**
 * Nhà nghiền than (icon tĩnh + nhãn).
 * @param {number} x, y  Toạ độ góc trên-trái của icon.
 */
export const CoalCrusherPlaceholder = ({ x, y }) => (
    <Container x={x} y={y}>
        <Sprite image={CRUSHER.iconPath} width={CRUSHER.size} height={CRUSHER.size} />
        <Text
            text="Nhà Nghiền"
            x={CRUSHER.size / 2}
            y={CRUSHER.size + CRUSHER.labelGap}
            anchor={0.5}
            style={TEXT_STYLE_LABEL}
        />
    </Container>
);

/* =============================================================================
 * CONTAINER 2: SILO PHỐI LIỆU (đèn trạng thái chuyển màu liên tục + chớp nháy)
 * ===========================================================================*/
const SILO = {
    radius: 24,
    outletRadius: 8,        // Lỗ xả liệu ở tâm
    overlayRadius: 23,      // Lớp phủ trạng thái (nhỏ hơn nền 1px để lộ viền)
    pulsePeriodMs: 160,     // Chu kỳ nhấp nháy alpha (sin)
    alphaMin: 0.3,
    alphaRange: 0.5,        // alpha dao động trong [0.3 .. 0.8]
    colorCycleMs: 3000,     // Tổng thời gian 1 vòng màu
    // Vòng lặp màu trạng thái: good -> warn -> bad -> quay lại good
    colorStops: [COLORS.statusGood, COLORS.statusWarn, COLORS.statusBad],
};

/** Tính màu trạng thái tại thời điểm timeMs (nội suy tuần hoàn qua colorStops). */
const getSiloStatusColor = (timeMs) => {
    const stops = SILO.colorStops;
    const segMs = SILO.colorCycleMs / stops.length;    // 1000ms mỗi chặng
    const cycle = timeMs % SILO.colorCycleMs;
    const seg = Math.floor(cycle / segMs);
    const t = (cycle - seg * segMs) / segMs;
    return lerpColor(stops[seg], stops[(seg + 1) % stops.length], t);
};

/**
 * Silo phối liệu. Màu/độ mờ được đột biến trực tiếp qua ref trong useTick
 * (KHÔNG setState) để tránh re-render React 60fps.
 * @param {number} x, y          Toạ độ tâm silo.
 * @param {number|string} index  Số hiệu hiển thị cạnh silo.
 * @param {number} textYOffset   Độ lệch Y của nhãn số (âm: phía trên, dương: phía dưới).
 */
export const SiloPlaceHolder = ({ x, y, index, textYOffset }) => {
    const overlayRef = useRef(null);

    useTick(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;

        const now = Date.now();

        // Nhấp nháy: đột biến alpha trực tiếp
        const pulse = (Math.sin(now / SILO.pulsePeriodMs) + 1) / 2;
        overlay.alpha = SILO.alphaMin + pulse * SILO.alphaRange;

        // Đổi màu: nhuộm tint lên lớp phủ trắng, không cần vẽ lại geometry
        overlay.tint = getSiloStatusColor(now);
    });

    // Nền silo: chỉ vẽ 1 lần khi mount
    const drawBaseSilo = useCallback((g) => {
        g.clear();
        g.lineStyle(2, COLORS.siloBorder);
        g.beginFill(COLORS.siloBody);
        g.drawCircle(0, 0, SILO.radius);
        g.endFill();

        // Lỗ xả liệu
        g.beginFill(COLORS.ink);
        g.drawCircle(0, 0, SILO.outletRadius);
        g.endFill();
    }, []);

    // Lớp phủ PHẢI là màu trắng thì khi nhuộm tint màu mới chuẩn
    const drawOverlay = useCallback((g) => {
        g.clear();
        g.lineStyle(0);
        g.beginFill(COLORS.white);
        g.drawCircle(0, 0, SILO.overlayRadius);
        g.endFill();
    }, []);

    return (
        <Container x={x} y={y}>
            {/* Lớp nền vẽ 1 lần */}
            <Graphics draw={drawBaseSilo} />

            {/* Lớp overlay gắn ref, điều khiển bằng useTick, tách khỏi React lifecycle */}
            <Graphics ref={overlayRef} draw={drawOverlay} />

            <Text text={`${index}`} x={0} y={textYOffset} anchor={0.5} style={TEXT_STYLE_SILO_INDEX} />
        </Container>
    );
};


/* =============================================================================
 * BĂNG CẤP LIỆU VÀO DÃY SILO PHỐI LIỆU (nhìn từ trên xuống)
 * Tuyến quặng hồi nguội từ Trạm S2 chạy dọc phía TRÊN dãy silo, rót vào 4 CỘT
 * SILO CUỐI (21, 20, 19, 18) rồi hết — cùng kiểu với 3 ống tải than sẵn có rót
 * vào silo 15, 16, 17.
 * Vẽ TRƯỚC dãy silo nên chân các ống rót bị silo che, nhìn như rót vào trong.
 * ===========================================================================*/
export const SiloFeedLine = ({
    y, height = 20, xStart, xEnd,
    groups,                  // [{ color, xs: [...] }]
    chuteTopY, chuteBottomY, chuteW = 11,
}) => {
    const flowRef = useRef(null);
    const t = useRef(0);

    const drawBase = useCallback((g) => {
        g.clear();

        /* 1) ỐNG RÓT xuống từng cột silo — vẽ trước để băng đè lên gốc ống */
        groups.forEach((grp) => {
            grp.xs.forEach((cx) => {
                g.lineStyle(chuteW + 5, COLORS.machineDark, 0.42);
                g.moveTo(cx, chuteTopY); g.lineTo(cx, chuteBottomY);
                g.lineStyle(chuteW, COLORS.ductBody, 1);
                g.moveTo(cx, chuteTopY); g.lineTo(cx, chuteBottomY);
                // cổ rót có màu theo loại liệu
                g.lineStyle(1.4, COLORS.machineDark, 0.8);
                g.beginFill(grp.color, 0.95);
                g.drawRect(cx - chuteW / 2 - 2, chuteTopY + 4, chuteW + 4, 9);
                g.endFill();
            });
        });

        /* 2) THÂN BĂNG */
        g.lineStyle(2, COLORS.machineDark, 0.85);
        g.beginFill(COLORS.dustLight, 1);
        g.drawRect(xStart, y, xEnd - xStart, height);
        g.endFill();

        /* 2b) LỚP LIỆU TĨNH phủ kín mặt băng — dùng ĐÚNG mật độ hạt của các
               băng tải chính (BELT.particleDensity) nên nhìn dày dặn khớp với
               băng vào Trạm S2. Vẽ MỘT LẦN trong drawBase nên dù vài nghìn hạt
               cũng không tốn thêm khung hình nào. */
        const bedCount = Math.round((xEnd - xStart) * BELT.particleDensity);
        g.lineStyle(0);
        for (let i = 0; i < bedCount; i++) {
            const px = xStart + Math.random() * (xEnd - xStart);
            const py = y + 2.5 + Math.random() * (height - 5);
            const sz = 0.5 + Math.random() * 1.5;
            g.beginFill(randomItem(BELT.particleColors), 0.95);
            g.drawRect(px, py, sz * 1.6, sz * 1.6);
            g.endFill();
        }
        g.lineStyle(2, COLORS.machineDark, 0.85);
        g.drawRect(xStart, y, xEnd - xStart, height);

        // 2 ray dẫn hướng + con lăn đỡ
        g.lineStyle(1.6, COLORS.machineDark, 0.35);
        g.moveTo(xStart, y + 4); g.lineTo(xEnd, y + 4);
        g.moveTo(xStart, y + height - 4); g.lineTo(xEnd, y + height - 4);
    }, [y, height, xStart, xEnd, groups, chuteTopY, chuteBottomY, chuteW]);

    /* Liệu chạy trên băng: chạy TỪ TRÁI SANG PHẢI rồi biến mất ở ống rót cuối. */
    const grains = useMemo(() => {
        const out = [];
        groups.forEach((grp, gi) => {
            const drop = Math.max(...grp.xs);
            for (let k = 0; k < 14; k++) {
                out.push({
                    gi, drop,
                    t: Math.random(),
                    sp: 0.0022 + Math.random() * 0.0016,
                    ry: Math.random(),
                    sz: 1.4 + Math.random() * 1.2,
                });
            }
        });
        return out;
    }, [groups]);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g) return;
        t.current += 0.05 * delta;
        g.clear();
        g.lineStyle(0);

        grains.forEach((q) => {
            q.t += q.sp * delta;
            if (q.t > 1) q.t -= 1;
            const px = xStart + (q.drop - xStart) * q.t;
            g.beginFill(groups[q.gi].color, 0.95);
            g.drawRect(px - q.sz, y + 2.5 + q.ry * (height - 5) - q.sz, q.sz * 2, q.sz * 2);
            g.endFill();
        });

        // Hạt rơi trong ống rót
        groups.forEach((grp, gi) => {
            grp.xs.forEach((cx, k) => {
                const p = ((t.current * 0.5 + gi * 0.3 + k * 0.17) % 1);
                const py = chuteTopY + (chuteBottomY - chuteTopY) * p;
                g.beginFill(grp.color, 0.9 - p * 0.3);
                g.drawCircle(cx, py, 2.6);
                g.endFill();
            });
        });
    });

    return (
        <Container>
            <Graphics draw={drawBase} />
            <Graphics ref={flowRef} />
        </Container>
    );
};
