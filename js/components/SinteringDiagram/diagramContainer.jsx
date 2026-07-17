import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Graphics, useTick, Container, Sprite, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';

/* =============================================================================
 BẢNG MÀU DÙNG CHUNG CHO TOÀN BỘ CÁC NƠI QUY ĐỊNH MÀU CỦA HỆ THỐNG
 * ===========================================================================*/
export const COLORS = {
    ink: 0x2c3e50,              // Chữ, chi tiết đậm
    borderGray: 0x7f8c8d,       // Viền băng tải / hộp
    surfaceLight: 0xecf0f1,     // Mặt băng tải, mặt kính
    steelFrame: 0x95a5a6,       // Khung thép, vành đai
    steelLight: 0xf5f6fa,       // Thép trắng xám (bệ đỡ)
    drumShell: 0xbdc3c7,        // Vỏ lồng trộn
    drumOutline: 0x34495e,      // Viền lồng trộn, đường may
    industrialOrange: 0xf39c12, // Motor, hộp trạm
    siloBorder: 0x1f618d,
    siloBody: 0x3498db,
    statusGood: 0x2ecc71,       // Xanh - bình thường
    statusWarn: 0xf1c40f,       // Vàng - cảnh báo
    statusBad: 0xe74c3c,        // Đỏ - sự cố
    white: 0xffffff,
};

/* Style chữ tạo 1 lần ở module-level (tránh new PIXI.TextStyle mỗi lần render) */
const TEXT_STYLE_LABEL = new PIXI.TextStyle({ fontSize: 16, fill: '#2c3e50', fontWeight: 'bold' });
const TEXT_STYLE_SILO_INDEX = new PIXI.TextStyle({ fontSize: 15, fill: '#2c3e50', fontWeight: 'bold' });

/* =============================================================================
 * HELPER THUẦN (không phụ thuộc React / Pixi lifecycle -> dễ test riêng)
 * ===========================================================================*/

/** Nội suy tuyến tính giữa 2 màu hex 0xRRGGBB. t thuộc [0..1]. */
export const lerpColor = (from, to, t) => {
    const r1 = (from >> 16) & 0xff, g1 = (from >> 8) & 0xff, b1 = from & 0xff;
    const r2 = (to >> 16) & 0xff, g2 = (to >> 8) & 0xff, b2 = to & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
};

/** Lấy ngẫu nhiên 1 phần tử trong mảng. */
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* =============================================================================
 * CONTAINER 1: NHÀ NGHIỀN THAN
 * ===========================================================================*/
const CRUSHER = {
    iconPath: 'images/icons/Nha_Nghien_Than.png',
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
 * CONTAINER 3: BĂNG TẢI (nền + dòng hạt liệu chạy, hỗ trợ cắt mặt nạ ở góc rẽ)
 * ===========================================================================*/
const BELT = {
    height: 35,
    speed: 1.5,             // px mỗi tick
    particleDensity: 5,     // Số hạt trên mỗi px chiều dài (giảm số này nếu cần tối ưu FPS)
    particleColors: [0x2c3e50, 0x1a252f, 0x7f8c8d, 0x3e2723], // Các sắc độ than/liệu
};
BELT.cornerRadius = BELT.height / 2;

/** Sinh danh sách hạt liệu ngẫu nhiên cho một băng tải dài `length`. */
const createBeltParticles = (length) => {
    const count = length * BELT.particleDensity;
    const pts = [];
    for (let i = 0; i < count; i++) {
        pts.push({
            rx: Math.random() * length,
            ry: 5 + Math.random() * 25,
            size: 0.5 + Math.random() * 1.5,
            color: randomItem(BELT.particleColors),
        });
    }
    return pts;
};

/**
 * Các kiểu mặt nạ cắt hạt liệu tại góc rẽ. Mỗi hàm nhận (g, length) và vẽ
 * hình mặt nạ; phần NGOÀI mặt nạ sẽ bị ẩn hạt.
 * Muốn thêm kiểu cắt mới: thêm 1 entry vào đây là đủ.
 */
const MASK_BUILDERS = {
    // Cắt chéo cho băng ngang (hạt khuất dần từ dưới lên ở đầu trái)
    'diagonal-horz': (g, length) => {
        g.moveTo(BELT.height, BELT.height);
        g.lineTo(0, 0);
        g.lineTo(length, 0);
        g.lineTo(length, BELT.height);
    },
    // Cắt chéo cho băng dọc (hạt xuất hiện dần từ trên xuống)
    'diagonal-vert': (g, length) => {
        g.moveTo(0, BELT.height);
        g.lineTo(BELT.height, 0);
        g.lineTo(length, 0);
        g.lineTo(length, BELT.height);
    },
    // Cắt chéo góc dưới-trái cho băng ngang
    'bottom-left-horz': (g, length) => {
        g.moveTo(BELT.height, 0);
        g.lineTo(0, BELT.height);
        g.lineTo(length, BELT.height);
        g.lineTo(length, 0);
    },
    // Cắt chéo cả 2 đầu cho băng dọc
    'diagonal-both-vert': (g, length) => {
        g.moveTo(0, BELT.height);
        g.lineTo(BELT.height, 0);
        g.lineTo(length - BELT.height, 0);
        g.lineTo(length, BELT.height);
    },
    // Cắt chéo đầu TRÁI cho băng ngang chạy về phải, khớp với đáy băng dọc rẽ xuống.
    // Đầu trái vát chéo từ mép dưới lên mép trên để ăn khớp mạch với băng dọc,
    // xoá khe hở tam giác ở góc rẽ dưới (cho giống góc rẽ trên/khoanh xanh).
    'diagonal-left-horz': (g, length) => {
        g.moveTo(0, BELT.height);
        g.lineTo(BELT.height, 0);
        g.lineTo(length, 0);
        g.lineTo(length, BELT.height);
    },
};

/* Cảnh báo 1 lần (chỉ ở chế độ dev) khi truyền clipMask không tồn tại,
   giúp phát hiện lỗi gõ nhầm tên mặt nạ thay vì âm thầm dùng mặt nạ mặc định. */
const warnedMaskKeys = new Set();
const warnUnknownMask = (key) => {
    if (warnedMaskKeys.has(key)) return;
    warnedMaskKeys.add(key);
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        console.warn(
            `[MainConveyorPlaceHolder] clipMask "${key}" không tồn tại, dùng mặt nạ mặc định. ` +
            `Các giá trị hợp lệ: ${Object.keys(MASK_BUILDERS).join(', ')}, none.`
        );
    }
};

/**
 * Băng tải nằm ngang/dọc.
 * @param {number}  x, y           Toạ độ góc trên-trái (trước khi xoay).
 * @param {number}  length         Chiều dài băng (px).
 * @param {boolean} hasMaterial    Có hiển thị dòng hạt liệu chạy hay không.
 * @param {number}  angle          Góc xoay (độ). 90 = băng dọc.
 * @param {boolean} reverseFlow    Đảo chiều chạy của hạt liệu.
 * @param {string}  clipMask       Kiểu cắt mặt nạ hạt ở góc rẽ (xem MASK_BUILDERS) hoặc 'none'.
 * @param {boolean} showBackground Có vẽ nền xám hay không (tắt khi chỉ muốn lớp hạt đè lên nền có sẵn).
 */
export const MainConveyorPlaceHolder = ({
    x, y, length,
    hasMaterial = true,
    angle = 0,
    reverseFlow = false,
    children,
    clipMask = 'none',
    showBackground = true,
}) => {
    const beltRef = useRef(null);
    const [maskGraphics, setMaskGraphics] = useState(null);

    // Hạt liệu chỉ sinh lại khi đổi chiều dài băng
    const particles = useMemo(() => createBeltParticles(length), [length]);

    const drawBackground = useCallback((g) => {
        g.clear();
        g.lineStyle(2, COLORS.borderGray);
        g.beginFill(COLORS.surfaceLight);
        g.drawRoundedRect(0, 0, length, BELT.height, BELT.cornerRadius);
        g.endFill();
    }, [length]);

    const drawMask = useCallback((g) => {
        g.clear();
        g.beginFill(COLORS.white);

        const buildMask = MASK_BUILDERS[clipMask];
        if (buildMask) {
            buildMask(g, length);
        } else {
            if (clipMask !== 'none') warnUnknownMask(clipMask);
            // Mặt nạ mặc định: phủ toàn bộ băng
            g.drawRoundedRect(0, 0, length, BELT.height, BELT.cornerRadius);
        }
        g.endFill();
    }, [length, clipMask]);

    const drawParticles = useCallback((g) => {
        g.clear();
        g.lineStyle(0);
        particles.forEach((p) => {
            g.beginFill(p.color, 0.9);
            g.drawCircle(p.rx, p.ry, p.size);
            g.endFill();
        });
    }, [particles]);

    // Cuộn 2 dải hạt nối đuôi nhau để tạo vòng lặp vô tận
    useTick((delta) => {
        const belt = beltRef.current;
        if (!belt) return;

        if (reverseFlow) {
            belt.x += BELT.speed * delta;
            if (belt.x >= length) belt.x -= length;
        } else {
            belt.x -= BELT.speed * delta;
            if (belt.x <= -length) belt.x += length;
        }
    });

    return (
        <Container x={x} y={y} angle={angle}>
            {/* Cho phép bật/tắt nền xám độc lập với lớp hạt */}
            {showBackground && <Graphics draw={drawBackground} />}

            {children}

            {/* Lưu ý: khi hasMaterial=false, Graphics mặt nạ này không được gán làm mask
                nên sẽ hiển thị như một lớp phủ trắng trên nền — hành vi này được giữ
                nguyên như bản gốc để không làm thay đổi màu sắc hiện có. */}
            <Graphics draw={drawMask} ref={setMaskGraphics} />

            {hasMaterial && maskGraphics && (
                <Container ref={beltRef} mask={maskGraphics}>
                    <Graphics draw={drawParticles} x={0} y={0} />
                    <Graphics draw={drawParticles} x={reverseFlow ? -length : length} y={0} />
                </Container>
            )}
        </Container>
    );
};

/* =============================================================================
 * CONTAINER 4: MÁY TRỘN LỒNG QUAY (nhìn từ trên xuống)
 * ===========================================================================*/
const MIXER = {
    defaultScale: 0.65,
    seamCount: 12,          // Số đường may trên vỏ lồng
    seamSpeed: 0.03,        // Tốc độ quay (rad/tick)
    particleCount: 300,
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
