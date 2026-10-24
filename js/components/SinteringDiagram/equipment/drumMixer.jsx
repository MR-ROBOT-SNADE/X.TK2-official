/* =============================================================================
 * js/components/SinteringDiagram/equipment/drumMixer.jsx — MÁY TRỘN LỒNG QUAY
 * =============================================================================
 * DrumMixerTopDown: máy trộn nhìn từ trên xuống, liệu lăn trong lồng.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS, randomItem } from './colors.js';

/* =============================================================================
 * CONTAINER 4: MÁY TRỘN LỒNG QUAY (nhìn từ trên xuống)
 * ===========================================================================*/
const MIXER = {
    defaultScale: 0.65,
    seamCount: 12,          // Số đường may trên vỏ lồng
    seamSpeed: 0.03,        // Tốc độ quay (rad/tick)
    particleCount: 170,        // hạ 300 -> 170 cho FPS; cửa kính vẫn kín hạt
    particleColors: [0x5d4037, 0x795548, 0x8d6e63, 0x2c3e50], // Sắc độ vật liệu trộn
    cylinderHalfLen: 90,    // Nửa chiều dài thân trụ
    coneHalfLen: 120,       // Nửa chiều dài tính cả chóp nón 2 đầu
    cylinderRadius: 45,     // Bán kính thân trụ
    coneRadius: 35,         // Bán kính miệng chóp nón
    // Cửa sổ kính quan sát ở giữa lồng
    window: { width: 170, height: 80, clipHalfW: 80, clipHalfH: 37 },
};

/** Sinh hạt vật liệu "nhào lộn" theo quỹ đạo elip trong cửa sổ kính. */
const createTumblingParticles = () => {
    const { width, height } = MIXER.window;
    const pts = [];
    for (let i = 0; i < MIXER.particleCount; i++) {
        pts.push({
            // Trải hạt dọc theo cửa sổ (-w/2 .. w/2)
            centerX: -width / 2 + Math.random() * width,
            centerY: -height / 2 + Math.random() * height,
            // Bán kính elip tạo hiệu ứng nhào lộn (elip bẹt)
            radiusX: 5 + Math.random() * 15,
            radiusY: 5 + Math.random() * 20,
            angle: Math.random() * Math.PI * 2,
            speed: 0.03 + Math.random() * 0.04, // Tốc độ góc (rad/frame)
            size: 1 + Math.random() * 2.5,
            color: randomItem(MIXER.particleColors),
        });
    }
    return pts;
};

/* --- Các hàm vẽ tĩnh (chỉ chạy 1 lần khi mount, module-level nên luôn ổn định) --- */

/** Khung cơ khí + vỏ lồng trộn (top-down). */
const drawMixerFrame = (g) => {
    g.clear();

    // --- A. KHUNG VÀ BỆ ĐỠ ---
    g.lineStyle(2, COLORS.steelFrame);
    g.beginFill(COLORS.steelLight);

    // Dầm thép dọc (chạy song song với lồng)
    g.drawRect(-110, -55, 10, 110);
    g.drawRect(100, -55, 10, 110);

    // Dầm thép ngang (chống giữa các chân)
    g.drawRect(-100, -55, 200, 10); // Dầm phía trên
    g.drawRect(-100, 45, 200, 10);  // Dầm phía dưới

    // Chân vịt bắt xuống sàn (4 góc)
    g.drawRect(-115, -60, 20, 10);
    g.drawRect(95, -60, 20, 10);
    g.drawRect(-115, 50, 20, 10);
    g.drawRect(95, 50, 20, 10);
    g.endFill();

    // Động cơ (motor) đặt một bên gầm
    g.lineStyle(1, COLORS.borderGray);
    g.beginFill(COLORS.industrialOrange);
    g.drawRoundedRect(-60, 60, 35, 20, 4);
    g.endFill();

    // --- B. VỎ LỒNG TRỘN NGANG ---
    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(COLORS.drumShell);

    // Thân giữa hình trụ ngang
    g.drawRect(
        -MIXER.cylinderHalfLen, -MIXER.cylinderRadius,
        MIXER.cylinderHalfLen * 2, MIXER.cylinderRadius * 2
    );

    // Chóp nón 2 đầu (nhìn từ trên xuống -> hình thang)
    g.drawPolygon([
        -MIXER.cylinderHalfLen, -MIXER.cylinderRadius,
        -MIXER.coneHalfLen, -MIXER.coneRadius,
        -MIXER.coneHalfLen, MIXER.coneRadius,
        -MIXER.cylinderHalfLen, MIXER.cylinderRadius,
    ]);
    g.drawPolygon([
        MIXER.cylinderHalfLen, -MIXER.cylinderRadius,
        MIXER.coneHalfLen, -MIXER.coneRadius,
        MIXER.coneHalfLen, MIXER.coneRadius,
        MIXER.cylinderHalfLen, MIXER.cylinderRadius,
    ]);
    g.endFill();
};

/** Vành đai thép + khung kính quan sát (vẽ đè lên vỏ lồng). */
const drawMixerOverlay = (g) => {
    g.clear();

    // Vành đai thép gia cố dọc theo lồng
    g.lineStyle(4, COLORS.steelFrame);
    g.moveTo(-70, -45); g.lineTo(-70, 45);
    g.moveTo(-25, -45); g.lineTo(-25, 45);
    g.moveTo(20, -45); g.lineTo(20, 45);
    g.moveTo(65, -45); g.lineTo(65, 45);

    // Khung kính quan sát vật liệu (trung tâm lồng)
    g.lineStyle(2, COLORS.ink);
    g.beginFill(COLORS.surfaceLight, 0.3); // Nền kính hơi mờ
    g.drawRoundedRect(
        -MIXER.window.width / 2, -MIXER.window.height / 2,
        MIXER.window.width, MIXER.window.height, 5
    ); // Cửa sổ lớn (-85, -40, 170, 80) để nhìn từ trên xuống
    g.endFill();
};

/** Vệt phản quang giả lập độ bóng của mặt kính. */
const drawGlassGlare = (g) => {
    g.clear();
    g.lineStyle(0);
    g.beginFill(COLORS.white, 0.15);
    g.drawRect(-85, -40, 170, 20); // Vệt sáng phía trên cửa kính
    g.endFill();
};

/* --- Các hàm vẽ động (gọi mỗi tick, thao tác trực tiếp trên Graphics qua ref) --- */

/** Vẽ các đường may trên vỏ lồng, quay theo phase (chỉ vẽ nửa nhìn thấy). */
const drawDrumSeams = (g, phase) => {
    g.clear();
    g.lineStyle(3, COLORS.drumOutline, 0.85);

    for (let i = 0; i < MIXER.seamCount; i++) {
        const angle = phase + (i * Math.PI * 2) / MIXER.seamCount;

        // cos(angle) <= 0: đường may nằm mặt dưới, bị vỏ lồng che
        if (Math.cos(angle) <= 0) continue;

        const yCylinder = MIXER.cylinderRadius * Math.sin(angle);
        const yCone = MIXER.coneRadius * Math.sin(angle);

        g.moveTo(-MIXER.coneHalfLen, yCone);
        g.lineTo(-MIXER.cylinderHalfLen, yCylinder);
        g.lineTo(MIXER.cylinderHalfLen, yCylinder);
        g.lineTo(MIXER.coneHalfLen, yCone);
    }
};

/** Cập nhật vị trí và vẽ lại các hạt nhào lộn (chỉ hiện hạt trong cửa kính). */
const updateTumblingParticles = (g, particles, delta) => {
    const { clipHalfW, clipHalfH } = MIXER.window;

    g.clear();
    g.lineStyle(0);

    particles.forEach((p) => {
        p.angle += p.speed * delta;
        const px = p.centerX + Math.cos(p.angle) * p.radiusX;
        const py = p.centerY + Math.sin(p.angle) * p.radiusY;

        if (px > -clipHalfW && px < clipHalfW && py > -clipHalfH && py < clipHalfH) {
            g.beginFill(p.color, 0.9);
            g.drawCircle(px, py, p.size);
            g.endFill();
        }
    });
};

/**
 * Máy trộn lồng quay nhìn từ trên xuống.
 * Cấu trúc lớp (từ dưới lên): khung cơ khí -> đường may quay -> vành đai + kính
 * -> hạt vật liệu -> vệt phản quang.
 * @param {number} x, y   Toạ độ tâm máy trộn.
 * @param {number} scale  Tỉ lệ thu phóng (mặc định 0.65).
 * @param {number} angle  Góc xoay (độ). 90 = đặt dọc.
 */
export const DrumMixerTopDown = ({ x, y, scale = MIXER.defaultScale, angle = 0 }) => {
    const seamsRef = useRef(null);
    const particlesRef = useRef(null);
    const drumPhase = useRef(0);

    const particles = useMemo(createTumblingParticles, []);

    // Hoạt ảnh 60fps: đột biến trực tiếp Graphics, không đi qua React state
    useTick((delta) => {
        drumPhase.current += MIXER.seamSpeed * delta;

        if (seamsRef.current) drawDrumSeams(seamsRef.current, drumPhase.current);
        if (particlesRef.current) updateTumblingParticles(particlesRef.current, particles, delta);
    });

    return (
        <Container x={x} y={y} scale={{ x: scale, y: scale }} angle={angle}>
            {/* Lớp nền cơ khí (tĩnh, vẽ 1 lần) */}
            <Graphics draw={drawMixerFrame} />

            {/* Đường may vỏ lồng (quay liên tục qua useTick) */}
            <Graphics ref={seamsRef} />

            {/* Vành đai + khung kính (tĩnh) */}
            <Graphics draw={drawMixerOverlay} />

            {/* Hạt vật liệu chuyển động trong cửa kính */}
            <Graphics ref={particlesRef} />

            {/* Vệt phản quang mặt kính (tĩnh) */}
            <Graphics draw={drawGlassGlare} />
        </Container>
    );
};
