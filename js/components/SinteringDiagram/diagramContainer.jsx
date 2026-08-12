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

    /* --- Khu nhà thiêu kết (đồng bộ tông với bảng màu chung ở trên) --- */
    machineBody: 0x566573,      // Thân máy nặng: trục nghiền, motor, trục quay
    machineDark: 0x34495e,      // Chi tiết đậm trên thân máy (khe, răng, mấu nối)
    ductBody: 0xd5dbdb,         // Vỏ ống gió (tổng + cuống phễu)
    dustGray: 0x95a5a6,         // Bụi/gió trong ống - tông chính
    dustLight: 0xbdc3c7,        // Bụi/gió - tông nhạt
    palletBody: 0xf7dc6f,       // Toa xe ghi khi chưa mang liệu
    linerBlack: 0x1c2833,       // Lớp liệu lót trên toa
    mixedOre: 0x795548,         // Liệu hỗn hợp (nâu) trên toa
    sinterHot: 0xe67e22,        // Liệu đang thiêu kết - cam
    sinterFire: 0xe74c3c,       // Liệu đang thiêu kết - đỏ
    sinterCool: 0x4e342e,       // Liệu nguội cuối máy
    sinterOre: 0x1c2833,        // Tảng quặng thiêu kết ở trục nghiền
    coolAir: 0x85c1e9,          // Gió LẠNH quạt hút từ ngoài vào máy làm mát vòng
    oreBed: 0x2b3d4f,           // Nền lớp liệu phủ kín lòng máng máy làm mát vòng
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
    // Số hạt trên mỗi px chiều dài. HẠ 5 -> 3.2: sơ đồ nay có ~50 tuyến băng,
    // tổng hạt ở mức 5 lên tới nửa triệu -> tụt FPS thấy rõ. 3.2 vẫn kín mặt băng.
    // Sau khi bật cacheAsBitmap (xem MainConveyorPlaceHolder), số hạt CHỈ còn
    // ảnh hưởng tới lúc "nung" ảnh một lần đầu, KHÔNG còn ảnh hưởng FPS nữa.
    // Nên nâng lại 1.9 -> 2.8 cho mặt băng dày dặn như cũ.
    particleDensity: 2.8,
    particleColors: [0x2c3e50, 0x1a252f, 0x7f8c8d, 0x3e2723], // Các sắc độ than/liệu
};
BELT.cornerRadius = BELT.height / 2;

/* =============================================================================
 * GIẢM NHỊP DỰNG LẠI HÌNH HỌC
 * Các lớp hạt trang trí (cục liệu quay trên vành làm mát, dòng liệu rơi, bụi
 * trong ống, vệt hút dưới xe ghi) đang gọi g.clear() rồi vẽ lại TOÀN BỘ ở MỖI
 * khung hình. Mỗi lần như vậy Pixi phải dựng lại bộ đệm hình học và cấp phát
 * bộ nhớ mới -> bộ dọn rác chạy liên tục, đó là lý do càng để lâu càng giật.
 * Vị trí hạt vẫn cập nhật đủ 60 lần/giây (nên tốc độ chạy KHÔNG đổi), chỉ có
 * việc DỰNG LẠI HÌNH là giãn ra 2 khung một lần — mắt thường không nhận ra.
 * ===========================================================================*/
export const HEAVY_REDRAW_EVERY = 2;

/** Trả về true nếu khung hình này ĐƯỢC PHÉP dựng lại hình học.
 *  CHỈ dùng được cho component nào CẬP NHẬT VỊ TRÍ Ở NGOÀI khối vẽ (ví dụ vành
 *  làm mát: góc quay `rot` vẫn cộng đủ mỗi khung, chỉ có việc vẽ lại cục liệu là
 *  giãn nhịp). Nếu component cập nhật vị trí NGAY TRONG khối vẽ thì chặn khối
 *  đó sẽ làm chuyển động chậm đi một nửa — đừng dùng cổng này ở đó. */
export const useRedrawGate = () => {
    const n = useRef(0);
    return () => (++n.current % HEAVY_REDRAW_EVERY) === 0;
};

/** Sinh danh sách hạt liệu ngẫu nhiên cho một băng tải dài `length`.
 *  @param {number[]} colors     Bảng màu hạt (mặc định: sắc độ than).
 *  @param {number|number[]} sizeScale
 *         - số      : hệ số phóng cỡ hạt (2 = hạt to gấp đôi)
 *         - [a, b]  : DẢI cỡ hạt, mỗi hạt bốc ngẫu nhiên trong khoảng a..b.
 *           Dùng cho liệu thành phẩm "đủ cỡ từ to đến nhỏ" — trước đây phải
 *           chồng 2 lớp băng mới ra hiệu ứng này, nay 1 lớp là đủ (giảm nửa số
 *           hạt phải vẽ). */
const createBeltParticles = (length, colors = BELT.particleColors, sizeScale = 1, beltH = BELT.height) => {
    const count = Math.round(length * BELT.particleDensity);
    const [sMin, sMax] = Array.isArray(sizeScale) ? sizeScale : [sizeScale, sizeScale];
    const pts = [];
    for (let i = 0; i < count; i++) {
        const scale = sMin + Math.random() * (sMax - sMin);
        pts.push({
            rx: Math.random() * length,
            ry: 3 + Math.random() * (beltH - 6),
            size: (0.5 + Math.random() * 1.5) * scale,
            color: randomItem(colors),
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
 * @param {number[]} particleColors Bảng màu hạt liệu (mặc định: sắc độ than đen).
 * @param {number}  particleScale  Hệ số cỡ hạt (1 = chuẩn, 2 = to gấp đôi — dùng cho quặng lót).
 */
export const MainConveyorPlaceHolder = ({
    x, y, length,
    hasMaterial = true,
    angle = 0,
    reverseFlow = false,
    children,
    clipMask = 'none',
    showBackground = true,
    particleColors = BELT.particleColors,
    particleScale = 1,
    beltHeight = BELT.height,
}) => {
    const beltRef = useRef(null);
    const [maskGraphics, setMaskGraphics] = useState(null);

    // Hạt liệu chỉ sinh lại khi đổi chiều dài / bảng màu / cỡ hạt
    const particles = useMemo(
        () => createBeltParticles(length, particleColors, particleScale, beltHeight),
        [length, particleColors, particleScale, beltHeight]
    );

    const drawBackground = useCallback((g) => {
        g.clear();
        g.lineStyle(2, COLORS.borderGray);
        g.beginFill(COLORS.surfaceLight);
        g.drawRoundedRect(0, 0, length, beltHeight, beltHeight / 2);
        g.endFill();
    }, [length, beltHeight]);

    const drawMask = useCallback((g) => {
        g.clear();
        g.beginFill(COLORS.white);

        const buildMask = MASK_BUILDERS[clipMask];
        if (buildMask) {
            buildMask(g, length);
        } else {
            if (clipMask !== 'none') warnUnknownMask(clipMask);
            // Mặt nạ mặc định: phủ toàn bộ băng (theo bề cao tuỳ chỉnh)
            g.drawRoundedRect(0, 0, length, beltHeight, beltHeight / 2);
        }
        g.endFill();
    }, [length, clipMask, beltHeight]);

    /* Vẽ hạt bằng ô VUÔNG chứ không phải hình tròn.
       Hạt chỉ to 0.5..3px nên mắt thường không phân biệt được tròn/vuông, nhưng
       Pixi triangulate 1 hình tròn thành ~32 tam giác còn 1 ô vuông chỉ 2 tam
       giác => giảm ~16 lần khối lượng hình học. */
    const drawParticles = useCallback((g) => {
        g.clear();
        g.lineStyle(0);
        particles.forEach((p) => {
            g.beginFill(p.color, 0.9);
            g.drawRect(p.rx - p.size, p.ry - p.size, p.size * 2, p.size * 2);
            g.endFill();
        });
    }, [particles]);

    /* ------------------------------------------------------------------------
     * NUNG DẢI HẠT THÀNH MỘT ẢNH (cacheAsBitmap) — ĐÒN BẨY FPS LỚN NHẤT
     * Dải hạt của một băng KHÔNG BAO GIỜ đổi hình (chỉ trượt ngang), nhưng mỗi
     * khung hình GPU vẫn phải nuốt lại toàn bộ hàng nghìn ô vuông của nó. Toàn
     * sơ đồ có ~45 tuyến x 2 bản sao => gần 200.000 ô vuông mỗi khung.
     * Bật cacheAsBitmap: Pixi "chụp" dải hạt thành MỘT tấm ảnh rồi từ đó chỉ vẽ
     * đúng 1 hình chữ nhật có dán ảnh (2 tam giác). Số hình phải vẽ tụt từ hàng
     * trăm nghìn xuống còn vài chục, mà nhìn y hệt.
     * Đặt trong requestAnimationFrame để chắc chắn `draw` đã chạy xong.
     * ---------------------------------------------------------------------- */
    const bakeToBitmap = useCallback((g) => {
        if (!g) return;
        requestAnimationFrame(() => {
            if (g && !g.destroyed && !g.cacheAsBitmap) g.cacheAsBitmap = true;
        });
    }, []);

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
                    <Graphics draw={drawParticles} ref={bakeToBitmap} x={0} y={0} />
                    <Graphics draw={drawParticles} ref={bakeToBitmap}
                              x={reverseFlow ? -length : length} y={0} />
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

/* =============================================================================
 * CONTAINER 5: NHÀ XƯỞNG THIÊU KẾT
 * Gồm: khung nhà xưởng, silo liệu (quặng lót / quặng trộn), bố liệu + con lăn
 * xoay, lò điểm hoả 35 mỏ đốt, dãy xe ghi điểm hoả chạy vòng.
 * Toàn bộ toạ độ nhận qua props (tính sẵn trong pixiStage/buildLayout).
 * ===========================================================================*/

/* Bảng màu hạt QUẶNG TRỘN (nâu) — dùng cho các băng sau máy trộn & băng lên bố liệu */
export const MIXED_ORE_COLORS = [0x5d4037, 0x795548, 0x8d6e63, 0x4e342e];

/* Bảng màu hạt QUẶNG TRẮNG — dùng cho các đoạn băng dưới nhóm silo khoanh vàng */
export const WHITE_ORE_COLORS = [0xffffff, 0xf4f6f7, 0xd5dbdb, 0xfdfefe];

const PLANT_TEXT = new PIXI.TextStyle({ fontSize: 17, fill: '#c0392b', fontWeight: 'bold' });
const SMALL_LABEL = new PIXI.TextStyle({ fontSize: 14, fill: '#2c3e50', fontWeight: 'bold' });

/** Khung nhà xưởng Thiêu Kết (viền đỏ + nền nhạt + nhãn). Vẽ ở lớp DƯỚI CÙNG. */
export const PlantFrame = ({ x, y, width, height, label = 'NHÀ XƯỞNG THIÊU KẾT' }) => {
    const draw = useCallback((g) => {
        g.clear();
        g.lineStyle(3, 0xc0392b, 0.9);
        g.beginFill(0xfdf2f0, 0.35);
        g.drawRoundedRect(0, 0, width, height, 10);
        g.endFill();
    }, [width, height]);

    return (
        <Container x={x} y={y}>
            <Graphics draw={draw} />
            <Text text={label} x={14} y={10} style={PLANT_TEXT} />
        </Container>
    );
};

/** Silo liệu hình tròn (top-down) có nhãn — dùng cho Silo quặng lót / quặng trộn. */
export const MaterialSilo = ({ x, y, radius = 26, bodyColor, label, labelBelow = true, labelOffset }) => {
    const draw = useCallback((g) => {
        g.clear();
        g.lineStyle(3, COLORS.drumOutline);
        g.beginFill(bodyColor);
        g.drawCircle(0, 0, radius);
        g.endFill();
        // Lỗ xả liệu ở tâm
        g.beginFill(COLORS.ink);
        g.drawCircle(0, 0, radius * 0.33);
        g.endFill();
    }, [radius, bodyColor]);

    return (
        <Container x={x} y={y}>
            <Graphics draw={draw} />
            {label && (
                <Text
                    text={label}
                    x={0}
                    y={labelBelow ? (labelOffset ?? radius + 16) : -(labelOffset ?? radius + 16)}
                    anchor={0.5}
                    style={SMALL_LABEL}
                />
            )}
        </Container>
    );
};

/* --- Vẽ 1 TRỤ ĐỨNG đang quay quanh trục dọc (model bản vẽ tay): thân chữ nhật
   đứng + nắp elip trên/dưới + các vạch dọc chạy ngang theo phase (chỉ vẽ nửa
   mặt trước) tạo cảm giác trụ đang xoay. --- */
const drawSpinningCylinder = (g, cx, cy, radius, height, phase, fillColor, seams = 6) => {
    const half = height / 2;
    const capRy = Math.max(4, radius * 0.32);   // độ dẹt của nắp elip

    // Thân trụ
    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(fillColor);
    g.drawRect(cx - radius, cy - half, radius * 2, height);
    g.endFill();

    // Vạch quay: đường dọc tại x = R*sin(angle), chỉ hiện khi ở mặt trước (cos > 0)
    g.lineStyle(2, COLORS.drumOutline, 0.75);
    for (let i = 0; i < seams; i++) {
        const a = phase + (i * Math.PI * 2) / seams;
        if (Math.cos(a) <= 0) continue;
        const sx = cx + radius * Math.sin(a);
        g.moveTo(sx, cy - half + 2);
        g.lineTo(sx, cy + half - 2);
    }

    // Nắp elip trên + đáy elip dưới (vẽ sau để đè lên vạch)
    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(fillColor);
    g.drawEllipse(cx, cy - half, radius, capRy);
    g.endFill();
    g.beginFill(fillColor);
    g.drawEllipse(cx, cy + half, radius, capRy);
    g.endFill();
};

/* --- Vẽ 1 TRỤ NẰM NGANG đang quay quanh trục ngang: thân chữ nhật ngang +
   nắp elip trái/phải + các vạch ngang chạy dọc theo phase (nửa mặt trước). --- */
const drawSpinningCylinderH = (g, cx, cy, radius, length, phase, fillColor, seams = 4) => {
    const half = length / 2;
    const capRx = Math.max(3, radius * 0.4);

    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(fillColor);
    g.drawRect(cx - half, cy - radius, length, radius * 2);
    g.endFill();

    g.lineStyle(1.5, COLORS.drumOutline, 0.75);
    for (let i = 0; i < seams; i++) {
        const a = phase + (i * Math.PI * 2) / seams;
        if (Math.cos(a) <= 0) continue;
        const sy = cy + radius * Math.sin(a);
        g.moveTo(cx - half + 2, sy);
        g.lineTo(cx + half - 2, sy);
    }

    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(fillColor);
    g.drawEllipse(cx - half, cy, capRx, radius);
    g.endFill();
    g.beginFill(fillColor);
    g.drawEllipse(cx + half, cy, capRx, radius);
    g.endFill();
};

/**
 * BỐ LIỆU: trống trụ đứng DÀY, dài vắt ngang suốt bề xe ghi; silo liệu hỗn hợp
 * ngồi trên đầu trống. 9 CON LĂN trụ ĐỨNG (cùng phương trống) chia 2 HÀNG
 * (trên 5 / dưới 4) đặt sát giữa lò điểm hoả và trống.
 * @param {object} drum           {x, y, radius, height}
 * @param {array}  rollerClusters [{cx, cy, count}] 2 cụm hàng ngang.
 * @param {object} rollerSize     {radius, height} kích thước mỗi con lăn đứng.
 */
export const FeederWithRollers = ({ drum, rollerClusters, rollerSize, rollersLabel }) => {
    const gRef = useRef(null);
    const phase = useRef(0);

    useTick((delta) => {
        phase.current += 0.05 * delta;
        const g = gRef.current;
        if (!g) return;
        g.clear();

        // 2 HÀNG con lăn TRỤ ĐỨNG (cùng phương với trống bố liệu), xếp ngang
        // trong từng cụm, quay ngược chiều trống để cuốn liệu rải xuống xe
        rollerClusters.forEach((cl, ci) => {
            const stepX = rollerSize.radius * 2 + 2;
            const startX = cl.cx - ((cl.count - 1) * stepX) / 2;
            for (let i = 0; i < cl.count; i++) {
                drawSpinningCylinder(
                    g, startX + i * stepX, cl.cy,
                    rollerSize.radius, rollerSize.height,
                    -phase.current * 1.6 + ci * 0.9 + i * 0.5,
                    COLORS.steelLight, 4
                );
            }
        });

        // Trống bố liệu dài vắt ngang track (đổi dấu phase nếu muốn đảo chiều quay)
        drawSpinningCylinder(g, drum.x, drum.y, drum.radius, drum.height, phase.current, COLORS.drumShell, 8);
    });

    return (
        <Container>
            <Graphics ref={gRef} />
        </Container>
    );
};

/**
 * Dòng liệu nâu ĐỔ XUỐNG XE GHI: đám hạt chảy sang trái trong một vùng hẹp
 * giữa bố liệu và mép phải track, nhạt dần rồi tái sinh — mô phỏng liệu tràn
 * từ bố liệu phủ lên toa xe.
 * @param {object} area {x, yTop, width, height} vùng dòng liệu.
 */
export const MaterialFall = ({ area, colors = MIXED_ORE_COLORS, count = 110 }) => {
    const gRef = useRef(null);
    const particles = useMemo(() => Array.from({ length: count }, () => ({
        px: Math.random() * area.width,
        py: Math.random() * area.height,
        vx: 0.7 + Math.random() * 1.4,
        size: 1 + Math.random() * 2.2,
        color: colors[Math.floor(Math.random() * colors.length)],
    })), [area.width, area.height, colors, count]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();
        g.lineStyle(0);
        particles.forEach((pt) => {
            pt.px += pt.vx * delta;   // Chảy từ TRÁI sang PHẢI (bố liệu -> con lăn)
            if (pt.px > area.width) { pt.px = 0; pt.py = Math.random() * area.height; }
            const fade = Math.min(1, (area.width - pt.px) / (area.width * 0.35)); // nhạt dần về cuối
            g.beginFill(pt.color, 0.35 + 0.6 * fade);
            g.drawCircle(area.x + pt.px, area.yTop + pt.py, pt.size);
            g.endFill();
        });
    });

    return <Graphics ref={gRef} />;
};

/**
 * KHUNG KÍNH MỜ (frosted glass): rectangle bo tròn, KHÔNG có màu nền, phần view
 * bên trong (xe ghi/liệu chạy dưới) bị LÀM MỜ như nhìn qua kính mờ. Dùng chồng
 * lên vùng cần "che mờ" — nội dung bên dưới do component này tự bọc & làm mờ.
 * @param {object}  frame {x,y,width,height}
 * @param {node}    children  nội dung được đặt DƯỚI lớp kính (sẽ bị làm mờ)
 * @param {number}  blur  độ mờ (px)
 */
export const FrostedFrame = ({ frame, children, blur = 4 }) => {
    const [clip, setClip] = useState(null);
    const { x, y, width, height } = frame;

    const drawClip = useCallback((g) => {
        g.clear();
        g.beginFill(COLORS.white);
        g.drawRoundedRect(x, y, width, height, 12);
        g.endFill();
    }, [x, y, width, height]);

    const drawGlass = useCallback((g) => {
        g.clear();
        // Lớp kính mờ: phủ trắng rất nhạt (sương) + viền bo tròn, KHÔNG che hẳn.
        g.lineStyle(3, COLORS.borderGray, 0.9);
        g.beginFill(COLORS.white, 0.28);                    // màng sương -> giảm "độ phân giải"
        g.drawRoundedRect(x, y, width, height, 12);
        g.endFill();
        // vệt loé kính chéo cho giống mặt kính
        g.lineStyle(0);
        g.beginFill(COLORS.white, 0.12);
        g.moveTo(x + width * 0.12, y);
        g.lineTo(x + width * 0.30, y);
        g.lineTo(x + width * 0.12, y + height);
        g.lineTo(x, y + height);
        g.lineTo(x, y + height * 0.5);
        g.closePath();
        g.endFill();
    }, [x, y, width, height]);

    // Filter blur (nếu môi trường Pixi hỗ trợ) -> làm mờ thật phần bên dưới.
    const blurFilter = useMemo(() => {
        try { return [new PIXI.BlurFilter(blur, 2)]; } catch { return null; }
    }, [blur]);

    return (
        <Container>
            {clip && (
                <Container mask={clip} filters={blurFilter}>
                    {children}
                </Container>
            )}
            <Graphics draw={drawClip} ref={setClip} />
            <Graphics draw={drawGlass} />
        </Container>
    );
};

/**
 * TẤM KÍNH MỜ phủ lên 1 vùng (chỉ lớp kính, không bọc nội dung): rectangle bo
 * tròn, KHÔNG màu nền, phủ màng sương trắng nhạt làm "mờ độ phân giải" phần nhìn
 * thấy bên dưới (xe ghi/con lăn vẫn chạy, chỉ mờ đi) + viền + vệt loé kính chéo.
 * Dùng cho vùng khoanh cam (xe ghi) và khoanh tím (con lăn/nghiền cuối máy).
 * @param {object} frame {x,y,width,height}
 */
export const GlassPane = ({ frame }) => {
    const { x, y, width, height } = frame;
    const draw = useCallback((g) => {
        g.clear();
        g.lineStyle(3, COLORS.borderGray, 0.9);
        g.beginFill(COLORS.white, 0.30);                    // màng sương -> mờ view bên dưới
        g.drawRoundedRect(x, y, width, height, 12);
        g.endFill();
        g.lineStyle(0);                                      // vệt loé kính chéo
        g.beginFill(COLORS.white, 0.13);
        g.moveTo(x + width * 0.14, y);
        g.lineTo(x + width * 0.32, y);
        g.lineTo(x + width * 0.14, y + height);
        g.lineTo(x, y + height);
        g.lineTo(x, y + height * 0.5);
        g.closePath();
        g.endFill();
        g.beginFill(COLORS.white, 0.10);
        g.moveTo(x + width * 0.55, y);
        g.lineTo(x + width * 0.66, y);
        g.lineTo(x + width * 0.50, y + height);
        g.lineTo(x + width * 0.39, y + height);
        g.closePath();
        g.endFill();
    }, [x, y, width, height]);
    return <Graphics draw={draw} />;
};

/**
 * Lò điểm hoả: khung lò (nền mờ để thấy xe ghi chạy bên dưới) + các cột mỏ đốt
 * phun NGỌN LỬA XUỐNG (rèm lửa). columns = [{x, count}] — cột đầu là "hàng 1" gần bố liệu.
 * @param {object} frame   {x, y, width, height}
 * @param {array}  columns [{x, count}] toạ độ x tuyệt đối từng cột + số mỏ.
 * @param {number} yTop, yBottom  Dải Y trải đều mỏ đốt.
 */
export const IgnitionFurnace = ({ frame, columns, yTop, yBottom }) => {
    const gRef = useRef(null);
    const [flameMask, setFlameMask] = useState(null);

    /* Mặt nạ = đúng lòng khung lò: ngọn lửa dài tới đâu cũng bị cắt gọn tại
       thành lò, không lòi ra ngoài khung. */
    const drawFlameMask = useCallback((g) => {
        g.clear();
        g.beginFill(COLORS.white);
        g.drawRoundedRect(frame.x, frame.y, frame.width, frame.height, 8);
        g.endFill();
    }, [frame.x, frame.y, frame.width, frame.height]);

    useTick(() => {
        const g = gRef.current;
        if (!g) return;
        const now = Date.now() / 1000;
        g.clear();

        /* Mỗi mỏ đốt PHUN NGỌN LỬA XUỐNG (3 lớp: quầng cam ngoài - thân đỏ -
           lõi vàng sáng), chiều dài ngọn nhấp nhô + đuôi lửa lắc nhẹ theo pha
           riêng từng mỏ -> các ngọn nối nhau thành rèm lửa như lò thật. */
        const drawFlame = (x, y, len, w, sway) => {
            const layers = [
                [w,        len,        0xe67e22, 0.40],  // quầng ngoài
                [w * 0.62, len * 0.74, 0xe74c3c, 0.78],  // thân lửa
                [w * 0.36, len * 0.46, 0xf9e79f, 0.95],  // lõi sáng
            ];
            for (const [lw, ll, color, alpha] of layers) {
                g.lineStyle(0);
                g.beginFill(color, alpha);
                g.moveTo(x - lw, y);
                g.quadraticCurveTo(x - lw, y + ll * 0.55, x + sway, y + ll);
                g.quadraticCurveTo(x + lw, y + ll * 0.55, x + lw, y);
                g.closePath();
                g.endFill();
            }
        };

        columns.forEach((col, ci) => {
            const gap = (yBottom - yTop) / (col.count - 1);
            for (let i = 0; i < col.count; i++) {
                const y = yTop + i * gap;
                const phase = ci * 1.7 + i * 0.6;
                const len = 45 + 15 * Math.sin(now * 6 + phase);         // ngọn nhấp nhô (to 5x)
                const sway = 5 * Math.sin(now * 9 + phase * 1.3);        // đuôi lắc
                drawFlame(col.x, y - 2, len, 24, sway);
                // Đầu mỏ đốt (chấm thép nhỏ phía trên ngọn lửa)
                g.lineStyle(0);
                g.beginFill(COLORS.drumOutline, 0.9);
                g.drawCircle(col.x, y - 3, 2.4);
                g.endFill();
            }
        });
    });

    const drawFrame = useCallback((g) => {
        g.clear();
        // Khung lò gốc (ĐÃ BỎ lớp kính mờ theo yêu cầu): nền mờ nhạt vừa đủ để
        // vẫn thấy xe ghi chạy phía dưới.
        g.lineStyle(3, COLORS.drumOutline);
        g.beginFill(0x34495e, 0.18);
        g.drawRoundedRect(frame.x, frame.y, frame.width, frame.height, 8);
        g.endFill();
    }, [frame.x, frame.y, frame.width, frame.height]);

    return (
        <Container>
            <Graphics draw={drawFrame} />
            <Graphics draw={drawFlameMask} ref={setFlameMask} />
            {flameMask && (
                <Container mask={flameMask}>
                    <Graphics ref={gRef} />
                </Container>
            )}
        </Container>
    );
};

/**
 * Dãy xe ghi điểm hoả thiêu kết chạy sang TRÁI liên tục (vòng lặp vô tận).
 * Model theo bản vẽ tay: mỗi toa là khung chữ nhật ĐỨNG cao vừa lòng khung lò
 * điểm hoả, bên trong là các THANH GHI xếp chéo dày, 2 đầu toa có mấu nối.
 * Màu nền liệu trên thanh ghi đổi theo hành trình: trống (chưa rải) -> nâu
 * (sau bố liệu) -> rực lửa (trong lò, nhấp nháy) -> nguội sẫm dần về cuối máy.
 * Toàn dãy được cắt (mask) gọn tại 2 mép track: toa vào/ra biên mượt, không lòi.
 * @param {object} track {xLeft, xRight, yTop, height, carWidth, gap, speed}
 * @param {object} zones {feederX, furnaceLeft, furnaceRight} mốc đổi màu liệu.
 */
export const PalletCarTrack = ({ track, zones, labelDy = 14 }) => {
    const gRef = useRef(null);
    const [maskG, setMaskG] = useState(null);
    const offset = useRef(0);

    const { xLeft, xRight, yTop, height, carWidth, gap, speed } = track;
    const step = carWidth + gap;
    const trackLen = xRight - xLeft;

    /* 2 TRỤC QUAY tại đầu và cuối đường xe (nơi toa vòng 180° xuống đường hồi) */
    const drawTurnAxles = useCallback((g) => {
        g.clear();
        [xRight].forEach((ax) => {  // trục trái đã thay bằng máy nghiền trục đơn
            g.lineStyle(2, COLORS.drumOutline);
            g.beginFill(COLORS.machineBody);
            g.drawRoundedRect(ax - 5, yTop - 9, 10, height + 18, 5);
            g.endFill();
            g.beginFill(COLORS.steelLight);
            g.drawCircle(ax, yTop - 3, 3);
            g.drawCircle(ax, yTop + height + 3, 3);
            g.endFill();
        });
    }, [xLeft, xRight, yTop, height]);

    /* Mặt nạ vùng track: toa bị cắt gọn tại 2 mép thay vì lòi ra rồi biến mất */
    const drawTrackMask = useCallback((g) => {
        g.clear();
        g.beginFill(COLORS.white);
        g.drawRect(xLeft, yTop - 6, trackLen, height + 12); // +6 mỗi phía cho mấu nối
        g.endFill();
    }, [xLeft, yTop, trackLen, height]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;

        // Cuộn sang trái, lặp theo chu kỳ 1 bước toa
        offset.current = (offset.current + speed * delta) % step;
        const now = Date.now() / 1000;

        g.clear();
        const carCount = Math.ceil(trackLen / step) + 2;

        for (let i = 0; i < carCount; i++) {
            const x = xRight + step - offset.current - i * step; // dư 1 toa mỗi đầu, mask sẽ cắt
            if (x + carWidth < xLeft - step || x > xRight + step) continue;
            const cx = x + carWidth / 2;

            /* --- HIỆU ỨNG VÒNG 180° TẠI 2 MÉP BIÊN: xe chạy hết đường thì cuốn
               quanh trục quay xuống đường hồi bên dưới -> toa NÉN BỀ NGANG dần
               (hình chiếu khi lật qua mép cong) và MỜ DẦN rồi biến mất. --- */
            const TURN = 26;
            let squeeze = 1, fade = 1;
            if (cx > xRight - TURN) {
                const t = Math.min(1, (cx - (xRight - TURN)) / TURN);
                squeeze = Math.cos((t * Math.PI) / 2);
                fade = 1 - t * 0.65;
            } else if (cx < xLeft + TURN) {
                const t = Math.min(1, ((xLeft + TURN) - cx) / TURN);
                squeeze = Math.cos((t * Math.PI) / 2);
                fade = 1 - t * 0.65;
            }
            const w2 = Math.max(3, carWidth * squeeze);
            const x2 = cx - w2 / 2;

            // --- Màu nền liệu theo vị trí tâm toa (đúng trình tự yêu cầu):
            //     vàng (trước silo lót) -> ĐEN (qua silo lót) -> NÂU (tới con lăn
            //     nhận liệu từ bố liệu) -> CAM/ĐỎ rực (trong lò) -> nguội sẫm. ---
            let fill = COLORS.palletBody; // Toa trống: vàng
            const band = zones.linerBand ?? 45;
            if (zones.linerX !== undefined && cx <= zones.linerX && cx > zones.linerX - band) {
                fill = COLORS.linerBlack;                                   // Dải NGẮN qua silo lót: màu ĐEN
            } else if (cx <= (zones.linerX !== undefined ? zones.linerX - band : zones.feederX) && cx > zones.furnaceRight) {
                fill = COLORS.mixedOre;                                   // Từ sau dải đen tới lò: NÂU
            } else if (cx <= zones.furnaceRight && cx > zones.furnaceLeft) {
                const t = (Math.sin(now * 7 + cx * 0.08) + 1) / 2; // Trong lò: cam/đỏ rực
                fill = lerpColor(COLORS.sinterHot, COLORS.sinterFire, t);
            } else if (cx <= zones.furnaceLeft) {
                const t = Math.min(1, (zones.furnaceLeft - cx) / (zones.furnaceLeft - xLeft));
                fill = lerpColor(COLORS.sinterFire, COLORS.sinterCool, t);           // Nguội sẫm dần
            }

            // --- Mấu nối 2 đầu toa (trên + dưới) ---
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, fade);
            g.drawRect(x2 + 2, yTop - 6, Math.min(7, w2 * 0.25), 6);
            g.drawRect(x2 + w2 - 9, yTop - 6, Math.min(7, w2 * 0.25), 6);
            g.drawRect(x2 + 2, yTop + height, Math.min(7, w2 * 0.25), 6);
            g.drawRect(x2 + w2 - 9, yTop + height, Math.min(7, w2 * 0.25), 6);
            g.endFill();

            // --- Khung toa + nền liệu (nén ngang + mờ theo mép biên) ---
            g.lineStyle(2, COLORS.machineDark, fade);
            g.beginFill(fill, 0.95 * fade);
            g.drawRect(x2, yTop, w2, height);
            g.endFill();

            // --- Các THANH GHI xếp chéo dày bên trong toa ---
            g.lineStyle(1.5, COLORS.machineDark, 0.55 * fade);
            const barGap = 9;
            for (let by = yTop + 4; by < yTop + height - 4; by += barGap) {
                g.moveTo(x2 + 3, by + 5);
                g.lineTo(x2 + w2 - 3, by);
            }
        }
    });

    return (
        <Container>
            <Graphics draw={drawTrackMask} ref={setMaskG} />
            {maskG && (
                <Container mask={maskG}>
                    <Graphics ref={gRef} />
                </Container>
            )}
            <Graphics draw={drawTurnAxles} />
        </Container>
    );
};


/**
 * Dãy PHỄU ỐNG GIÓ (wind box) dọc một bên hông đường xe ghi — theo bản vẽ mặt
 * bằng: mỗi vị trí là ống cuống nối từ mép track ra một bầu tròn (khuỷu ống
 * gió) có mặt bích. Vẽ tĩnh, xếp cách đều trong đoạn [xStart, xEnd].
 * @param {number} y       Tâm Y của hàng bầu tròn.
 * @param {number} stemY   Mép track phía hàng này (điểm ống cuống nối vào).
 * @param {number} xStart, xEnd, count, radius
 * @param {string} label   Nhãn (chỉ truyền cho MỘT hàng để tránh lặp chữ).
 */
export const WindBoxRow = ({ y, stemY, xStart, xEnd, count, radius = 13, label, ductY }) => {
    const flowRef = useRef(null);

    /* Dòng KHÔNG KHÍ HÚT: mỗi phễu 3 vệt bụi mảnh chạy trong ống cuống từ tâm
       bầu về phía ỐNG GIÓ CHÍNH (hàng trên đi lên, hàng dưới đi xuống), đậm
       dần khi gần ống chính -- cùng phong cách vệt bụi trong ống tổng. */
    const suction = useMemo(() => {
        if (ductY === undefined) return [];
        const step = (xEnd - xStart) / (count - 1);
        const arr = [];
        for (let i = 0; i < count; i++) {
            for (let k = 0; k < 3; k++) {
                arr.push({
                    x: xStart + i * step + (Math.random() - 0.5) * 4,
                    t: Math.random(),
                    v: 0.013 + Math.random() * 0.012,
                    streak: 3 + Math.random() * 3.5,
                    color: k % 2 === 0 ? COLORS.dustGray : COLORS.dustLight,
                });
            }
        }
        return arr;
    }, [xStart, xEnd, count, ductY]);

    /* Bụi bị HÚT XOÁY vào tâm mỗi bầu phễu: men theo vòng, bán kính co dần về
       tâm rồi tái sinh ở rìa — cùng ngôn ngữ với bụi trong ống gió chính. */
    const swirl = useMemo(() => {
        const step = (xEnd - xStart) / (count - 1);
        const arr = [];
        for (let i = 0; i < count; i++) {
            for (let k = 0; k < 2; k++) {
                arr.push({
                    cx: xStart + i * step,
                    a: Math.random() * Math.PI * 2,
                    r: 0.35 + Math.random() * 0.6,
                    va: 0.055 + Math.random() * 0.05,
                    vr: 0.004 + Math.random() * 0.004,
                });
            }
        }
        return arr;
    }, [xStart, xEnd, count]);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g || suction.length === 0) return;
        g.clear();

        // Bụi xoáy hút vào tâm bầu phễu
        swirl.forEach((w) => {
            w.a += w.va * delta;
            w.r -= w.vr * delta;
            if (w.r < 0.18) { w.r = 0.95; w.a = Math.random() * Math.PI * 2; }
            g.lineStyle(0);
            g.beginFill(COLORS.dustLight, 0.15 + 0.35 * (1 - w.r));
            g.drawCircle(w.cx + Math.cos(w.a) * radius * w.r, y + Math.sin(w.a) * radius * w.r, 1.5);
            g.endFill();
        });

        const dir = Math.sign(ductY - y);                  // hàng trên: -1 (lên), hàng dưới: +1 (xuống)
        suction.forEach((p) => {
            p.t += p.v * delta;
            if (p.t > 1) p.t = 0;
            const py = y + (ductY - y) * p.t;
            g.lineStyle(1.2, p.color, 0.2 + 0.2 * p.t);    // đậm dần khi gần ống chính
            g.moveTo(p.x, py - dir * p.streak);
            g.lineTo(p.x, py);
        });
    });

    const draw = useCallback((g) => {
        g.clear();
        const step = (xEnd - xStart) / (count - 1);
        for (let i = 0; i < count; i++) {
            const x = xStart + i * step;
            // Ống cuống nối từ mép track ra bầu
            g.lineStyle(0);
            g.beginFill(COLORS.ductBody);
            const top = Math.min(y, stemY);
            g.drawRect(x - 4, top, 8, Math.abs(stemY - y));
            g.endFill();
            // Ống cuống thứ 2: nối từ bầu ra ỐNG GIÓ TỔNG (nếu có)
            if (ductY !== undefined) {
                const dTop = Math.min(y, ductY);
                g.beginFill(COLORS.ductBody);
                g.drawRect(x - 3, dTop, 6, Math.abs(ductY - y));
                g.endFill();
                g.lineStyle(1.5, COLORS.drumOutline, 0.8);
                g.drawRect(x - 3, dTop, 6, Math.abs(ductY - y));
                g.lineStyle(0);
            }
            g.lineStyle(1.5, COLORS.drumOutline, 0.8);
            g.drawRect(x - 4, top, 8, Math.abs(stemY - y));
            // Bầu tròn 2 lớp (khuỷu ống gió)
            g.lineStyle(2, COLORS.drumOutline);
            g.beginFill(COLORS.ductBody);
            g.drawCircle(x, y, radius);
            g.endFill();
            g.beginFill(COLORS.drumShell);
            g.drawCircle(x, y, radius * 0.45);
            g.endFill();
            // 2 tai mặt bích
            g.lineStyle(0);
            g.beginFill(COLORS.drumOutline, 0.85);
            g.drawRect(x - radius - 4, y - 2.5, 5, 5);
            g.drawRect(x + radius - 1, y - 2.5, 5, 5);
            g.endFill();
        }
    }, [y, stemY, xStart, xEnd, count, radius, ductY]);

    return (
        <Container>
            <Graphics draw={draw} />
            <Graphics ref={flowRef} />
            {label && (
                <Text text={label} x={xEnd + 18} y={y - 7} style={SMALL_LABEL} />
            )}
        </Container>
    );
};


/**
 * NỒI HƠI NHIỆT DƯ 20 MW — tận dụng khí nóng thoát ra ở 3 ĐOẠN (sector) ĐẦU
 * của máy làm mát vòng, ngay sau khi liệu nóng vừa xả xuống (cung còn đỏ lửa).
 *   • 3 chụp hút úp trên cung nóng của vành -> ống góp ngang -> thân nồi hơi.
 *   • Thân nồi: dàn ống trao đổi nhiệt + 2 góp + bao hơi (steam drum) nằm trên,
 *     quy mô vẽ tương xứng công suất 20 MW.
 *   • Khí NÓNG (đỏ/cam) chảy từ chụp về nồi; hơi nước trắng bốc lên bao hơi.
 * Vẽ SAU cùng (đè lên vành + ống gió) theo yêu cầu "đường ống nằm trên".
 * @param {array}  hoods       [{x,y}] tâm 3 chụp hút trên cung nóng của vành.
 * @param {number} collectorY  cao độ ống góp ngang gom khí về nồi.
 * @param {object} boiler      {x,y,w,h} khung thân nồi hơi.
 */
export const WasteHeatBoiler = ({ hoods, collectorY, boiler, lowerCollectorY, riserX, arcDuct }) => {
    const flowRef = useRef(null);
    const steamRef = useRef(null);

    const cLeftX = useMemo(() => Math.min(...hoods.map((h) => h.x)), [hoods]);
    const midInX = boiler.x + boiler.w / 2;

    /* TUYẾN KHÍ NÓNG của 1 chụp, mô tả bằng ĐƯỜNG GẤP KHÚC. Cả phần VẼ ống lẫn
       phần CHẠY vệt khí đều đọc từ đây nên không bao giờ lệch nhau.

       - Nếu có lowerCollectorY (3 chụp nằm ở CUNG DƯỚI vành làm mát):
           chụp -> cuống ĐI XUỐNG ống góp dưới -> chạy NGANG sang ống đứng ở
           riserX -> LEO LÊN ống góp trên (collectorY) -> chạy NGANG vào giữa
           nồi -> cắm xuống thân nồi.
       - Nếu không (bố trí cũ, chụp ở cung trên): chụp -> lên thẳng ống góp trên
         -> ngang vào nồi. */
    /* --- Kiểu ỐNG GÓP CUNG (arcDuct) ---------------------------------------
       Thay ống góp thẳng + ống đứng bằng MỘT ỐNG CONG chạy vòng theo dải vành
       làm mát, xâu qua đúng 3 chụp hút (cùng bán kính r), rồi từ đầu trên của
       cung leo thẳng lên ống góp trên và vào nồi. Đây chính là kiểu hood cong
       ôm cung nóng của máy làm mát vòng ngoài thực tế. */
    const arcPt = (deg) => {
        const a = (deg * Math.PI) / 180;
        return [arcDuct.cx + arcDuct.r * Math.cos(a), arcDuct.cy + arcDuct.r * Math.sin(a)];
    };
    const hoodDeg = (h) => (Math.atan2(h.y - arcDuct.cy, h.x - arcDuct.cx) * 180) / Math.PI;

    const hoodPath = (h) => {
        if (arcDuct) {
            /* chụp -> chạy DỌC CUNG ngược về đầu trên -> leo ống đứng -> vào nồi */
            const d0 = hoodDeg(h);
            const pts = [];
            const step = (arcDuct.from - d0) / 12;
            for (let i = 0; i <= 12; i++) pts.push(arcPt(d0 + step * i));
            const [sx] = arcPt(arcDuct.from);
            pts.push([sx, collectorY], [midInX, collectorY], [midInX, boiler.y]);
            return pts;
        }
        return lowerCollectorY != null && riserX != null
            ? [[h.x, h.y], [h.x, lowerCollectorY], [riserX, lowerCollectorY],
               [riserX, collectorY], [midInX, collectorY], [midInX, boiler.y]]
            : [[h.x, h.y], [h.x, collectorY], [midInX, collectorY], [midInX, boiler.y]];
    };

    /* Nội suy điểm ở tỉ lệ t (0..1) dọc chiều dài thật của đường gấp khúc. */
    const pathPoint = (h, t) => {
        const pts = hoodPath(h);
        const segLen = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            segLen.push(l); total += l;
        }
        if (total <= 0) return pts[0];
        let d = t * total;
        for (let i = 0; i < segLen.length; i++) {
            if (d <= segLen[i] || i === segLen.length - 1) {
                const k = segLen[i] > 0 ? d / segLen[i] : 0;
                return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k,
                        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
            }
            d -= segLen[i];
        }
        return pts[pts.length - 1];
    };

    const streaks = useMemo(() => {
        const arr = [];
        hoods.forEach((_, hi) => {
            for (let k = 0; k < 6; k++)
                arr.push({ hi, t: (k / 6 + Math.random() * 0.12) % 1,
                           v: 0.006 + Math.random() * 0.006, warm: Math.random() });
        });
        return arr;
    }, [hoods]);

    const steam = useMemo(() => Array.from({ length: 18 }, () => ({
        x: Math.random(), y: Math.random(), vy: 0.4 + Math.random() * 0.5, r: 3 + Math.random() * 4,
    })), []);

    const drawStruct = useCallback((g) => {
        g.clear();
        const { x, y, w, h } = boiler;

        /* --- ỐNG GÓP NGANG (gom khí nóng từ 3 chụp) -> vào GIỮA thân nồi (điểm 2) ---
           Chạy dưới quạt làm mát 296° (quạt lộ hẳn), băng ngang qua sườn trái tới
           GIỮA nồi rồi cắm vào (đầu vào nằm chính giữa hệ nồi, không còn ở mép). */
        g.lineStyle(2.5, COLORS.machineDark);

        /* ỐNG GÓP TRÊN: nếu 3 chụp nằm ở cung DƯỚI thì ống góp trên chỉ chạy từ
           ống đứng (riserX) vào giữa nồi; nếu bố trí cũ thì chạy từ chụp trái nhất. */
        const arcStartX = arcDuct ? arcPt(arcDuct.from)[0] : null;
        const upFromX = arcDuct ? arcStartX
            : (lowerCollectorY != null && riserX != null) ? riserX : cLeftX;
        g.beginFill(COLORS.ductBody, 0.96);
        g.drawRoundedRect(upFromX - 10, collectorY - 10, (midInX + 10) - (upFromX - 10), 20, 10);
        g.endFill();

        /* --- ỐNG GÓP CUNG: ống cong ôm dải vành, xâu qua 3 chụp hút --- */
        if (arcDuct) {
            const { cx, cy, r, from, to } = arcDuct;
            const W = arcDuct.width ?? 20;
            const rad = (d) => (d * Math.PI) / 180;
            const [sx, sy] = arcPt(from);
            const [ex, ey] = arcPt(to);

            // đoạn ĐỨNG nối đầu trên của cung lên ống góp trên
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.ductBody, 0.96);
            g.drawRoundedRect(sx - W / 2, collectorY - 10, W, (sy + W / 2) - (collectorY - 10), W / 2);
            g.endFill();

            // thân ống cong: vẽ viền đậm trước rồi lồng ruột sáng lên trên
            g.lineStyle(W + 5, COLORS.machineDark, 1);
            g.moveTo(sx, sy); g.arc(cx, cy, r, rad(from), rad(to));
            g.lineStyle(W, COLORS.ductBody, 0.96);
            g.moveTo(sx, sy); g.arc(cx, cy, r, rad(from), rad(to));

            // nắp bịt đầu dưới của cung
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.ductBody, 0.96);
            g.drawCircle(ex, ey, W / 2 + 1);
            g.endFill();
            g.lineStyle(2.5, COLORS.machineDark);
        }

        /* --- BỐ TRÍ MỚI: ống góp DƯỚI + ống ĐỨNG men sườn phải vành làm mát --- */
        if (lowerCollectorY != null && riserX != null) {
            const lowFromX = Math.min(cLeftX, riserX) - 10;
            const lowToX = Math.max(...hoods.map((h) => h.x), riserX) + 10;
            g.beginFill(COLORS.ductBody, 0.96);
            g.drawRoundedRect(lowFromX, lowerCollectorY - 10, lowToX - lowFromX, 20, 10);   // ống góp dưới
            g.endFill();
            g.beginFill(COLORS.ductBody, 0.96);
            g.drawRoundedRect(riserX - 10, collectorY - 10,                                  // ống đứng nối 2 ống góp
                              20, (lowerCollectorY + 10) - (collectorY - 10), 10);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.8);                                            // 2 mặt bích ở 2 đầu ống đứng
            g.drawRect(riserX - 13, collectorY - 3, 26, 5);
            g.drawRect(riserX - 13, lowerCollectorY - 2, 26, 5);
            g.endFill();
            g.lineStyle(2.5, COLORS.machineDark);
        }
        // cổ nối vào giữa nồi (chạm mặt trên thân nồi tại tâm)
        g.beginFill(COLORS.ductBody, 0.96);
        g.drawRoundedRect(midInX - 10, collectorY - 10, 20, (y + 6) - (collectorY - 10), 6);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.85);                        // mặt bích tại điểm cắm giữa nồi
        g.drawRect(midInX - 13, y - 3, 26, 5);
        g.endFill();

        /* --- 3 CHỤP HÚT trên cung nóng: cuống nối lên ống góp + NẮP TRÒN vẽ SAU
           để nắp luôn nổi trên ống góp, không bị ống trùm mất. --- */
        hoods.forEach((hd) => {
            const capR = 13;
            /* Cuống nối chụp lên ống góp: bố trí MỚI thì chụp nằm ở cung DƯỚI
               nên cuống chạy XUỐNG ống góp dưới (mốc lowerCollectorY), bố trí cũ
               thì chạy LÊN ống góp trên. */
            g.lineStyle(2, COLORS.machineDark);
            /* Kiểu ống góp CUNG thì 3 chụp nằm NGAY TRÊN thân ống cong -> không
               cần cuống nối; các kiểu khác mới vẽ cuống chạy về ống góp. */
            if (!arcDuct) {
                const stemTo = (lowerCollectorY != null && riserX != null) ? lowerCollectorY : collectorY;
                const s0 = Math.min(stemTo, hd.y - capR);
                const s1 = Math.max(stemTo, hd.y + capR);
                g.beginFill(COLORS.ductBody, 0.96);
                if (s1 - s0 > 1) g.drawRect(hd.x - 6, s0, 12, s1 - s0);        // cuống
                g.endFill();
            }
            g.beginFill(COLORS.dustLight, 0.96);                                // NẮP CHỤP TRÒN
            g.drawCircle(hd.x, hd.y, capR);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.sinterFire, 0.3);                               // tâm nắp ám đỏ (khí nóng)
            g.drawCircle(hd.x, hd.y, capR * 0.5);
            g.endFill();
        });

        /* --- THÂN NỒI HƠI --- */
        g.lineStyle(3, COLORS.machineDark);
        g.beginFill(COLORS.steelLight, 0.98);
        g.drawRoundedRect(x, y, w, h, 8);                              // bao nước / casing
        g.endFill();
        g.beginFill(COLORS.machineBody);                              // 2 góp ống trên/dưới
        g.drawRoundedRect(x + 12, y + 10, w - 24, 9, 4);
        g.drawRoundedRect(x + 12, y + h - 19, w - 24, 9, 4);
        g.endFill();
        g.lineStyle(3, COLORS.borderGray, 0.9);                       // dàn ống trao đổi nhiệt
        const tubeN = Math.max(7, Math.round(w / 26));
        for (let i = 0; i < tubeN; i++) {
            const tx = x + 18 + (w - 36) * (i / (tubeN - 1));
            g.moveTo(tx, y + 17);
            g.lineTo(tx, y + h - 17);
        }
        // BAO HƠI (steam drum) nằm NGAY GIỮA TRONG thân nồi (điểm 3)
        const dr = 15, dcx = x + w / 2, dcy = y + h / 2;
        g.lineStyle(3, COLORS.machineDark);
        g.beginFill(COLORS.drumShell);
        g.drawRoundedRect(dcx - w * 0.33, dcy - dr, w * 0.66, dr * 2, dr);
        g.endFill();
        g.lineStyle(0);                                               // 2 cửa hơi 2 đầu bao hơi
        g.beginFill(COLORS.machineBody);
        g.drawRoundedRect(dcx - w * 0.33 - 7, dcy - 5, 8, 10, 2);
        g.drawRoundedRect(dcx + w * 0.33 - 1, dcy - 5, 8, 10, 2);
        g.endFill();

        /* --- MŨI TÊN hướng khí nóng chảy về nồi (trên ống góp + đoạn rẽ xuống) --- */
        g.beginFill(COLORS.statusBad, 0.85);
        for (let ax = cLeftX + 40; ax < midInX - 16; ax += 74) {
            g.moveTo(ax, collectorY - 6);
            g.lineTo(ax + 12, collectorY);
            g.lineTo(ax, collectorY + 6);
            g.closePath();
        }
        g.endFill();
    }, [hoods, collectorY, boiler, cLeftX, midInX, lowerCollectorY, riserX, arcDuct]);

    useTick((delta) => {
        const g = flowRef.current;
        if (g) {
            g.clear();
            streaks.forEach((s) => {
                s.t += s.v * delta;
                if (s.t > 1) s.t -= 1;
                const [px, py] = pathPoint(hoods[s.hi], s.t);
                const [qx, qy] = pathPoint(hoods[s.hi], Math.max(0, s.t - 0.03));
                g.lineStyle(1.8, s.warm > 0.5 ? COLORS.sinterFire : COLORS.sinterHot, 0.6);
                g.moveTo(qx, qy);
                g.lineTo(px, py);
            });
        }
        const sg = steamRef.current;
        if (sg) {
            sg.clear();
            const { x, y, w } = boiler;
            const topcx = x + w / 2, topY = y - 36;
            steam.forEach((p) => {
                p.y -= p.vy * delta * 0.4;
                if (p.y < -1.2) { p.y = 0; p.x = Math.random(); }
                sg.lineStyle(0);
                sg.beginFill(COLORS.white, 0.18 * Math.max(0, 1 - Math.abs(p.y)));
                sg.drawCircle(topcx + (p.x - 0.5) * 30, topY + p.y * 34, p.r);
                sg.endFill();
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={flowRef} />
            <Graphics ref={steamRef} />
        </Container>
    );
};


/**
 * HỆ TUẦN HOÀN KHÍ THẢI — hút gió + bụi từ phễu ống gió ĐẦU/CUỐI dãy (20,21 ở
 * đầu; 1,2,3 ở cuối) cùng NHIỆT đoạn giữa máy làm mát vòng, gom vào ống góp đáy.
 * Khí từ 2 nhánh ĐẨY NGƯỢC CHIỀU NHAU DỒN VÀO GIỮA -> ống lên TÂM -> ống góp
 * SPINE chạy dọc trên thân xe ghi -> nhiều ống rẽ THỔI GIÓ LÊN thẳng mặt xe ghi
 * (đè khuất mặt xe ghi). Vẽ SAU cùng, nằm trên mọi chi tiết.
 * @param {array}  leftHoods   [x] tâm phễu 20,21 (đầu dãy, gần vành).
 * @param {array}  rightHoods  [x] tâm phễu 1,2,3 (cuối dãy, gần lò).
 * @param {object} midTap      {x,y} chụp lấy nhiệt đoạn giữa vành (nối vào góp đáy).
 * @param {number} windBottomY mép dưới dãy phễu (điểm bắt đầu hút xuống).
 * @param {object} manifold    {y,x0,x1} ống góp đáy.
 * @param {number} centerX     trục ống lên ở GIỮA (nơi 2 nhánh khí gặp nhau).
 * @param {number} spineY      cao độ ống góp spine chạy dọc trên xe ghi.
 * @param {object} spine       {x0,x1} phạm vi ống spine.
 * @param {array}  blowX       [x] vị trí các ống rẽ thổi gió LÊN mặt xe ghi.
 * @param {number} trackTopY   mặt trên xe ghi (đích khí thổi tới).
 */
export const FlueGasRecirculation = ({
    leftHoods, rightHoods, midTap, windBottomY, manifold, centerX, spineY, spine, blowX, trackTopY,
    blowTopY, riserFootY, fans,
}) => {
    const convRef = useRef(null);
    const spineRef = useRef(null);
    const intakeRef = useRef(null);
    const blowRef = useRef(null);
    const fanRef = useRef(null);
    const fanPhase = useRef(0);

    const DUCT = 0x5dade2, DUCT_LINE = 0x1f618d, GAS = 0xaed6f1;
    const windTaps = useMemo(() => [...leftHoods, ...rightHoods], [leftHoods, rightHoods]);

    /* Hạt khí trong ống góp đáy: 2 nhánh chạy NGƯỢC CHIỀU dồn về centerX.
       side=-1: từ x0 -> centerX (đi phải);  side=+1: từ x1 -> centerX (đi trái). */
    const conv = useMemo(() => {
        const arr = [];
        for (let k = 0; k < 34; k++) arr.push({ side: -1, u: Math.random(), v: 0.004 + Math.random() * 0.004 });
        for (let k = 0; k < 34; k++) arr.push({ side: 1, u: Math.random(), v: 0.004 + Math.random() * 0.004 });
        return arr;
    }, []);
    /* Hạt khí trên spine: từ TÂM toả ra 2 phía (mô phỏng phân bổ đều dọc dãy). */
    const spineDust = useMemo(() => Array.from({ length: 40 }, () => ({
        side: Math.random() < 0.5 ? -1 : 1, u: Math.random(), v: 0.006 + Math.random() * 0.005,
    })), []);
    /* Hạt bụi bị hút xuống tại 5 phễu. */
    const intake = useMemo(() => {
        const arr = [];
        windTaps.forEach((x) => { for (let k = 0; k < 3; k++)
            arr.push({ x, t: Math.random(), v: 0.02 + Math.random() * 0.015, streak: 5 + Math.random() * 4 }); });
        return arr;
    }, [windTaps]);
    /* Tia gió TOẢ RA tại mỗi điểm xả (hiệu ứng thổi gió lên mặt liệu). */
    const puff = useMemo(() => {
        const arr = [];
        blowX.forEach((x) => {
            for (let k = 0; k < 9; k++)
                arr.push({ x, a: (k * Math.PI * 2) / 9 + Math.random() * 0.3,
                           t: Math.random(), v: 0.016 + Math.random() * 0.014 });
        });
        return arr;
    }, [blowX]);
    /* Hạt khí THỔI LÊN mặt xe ghi tại mỗi ống rẽ. */
    const blow = useMemo(() => {
        const arr = [];
        blowX.forEach((x) => { for (let k = 0; k < 4; k++)
            arr.push({ x: x + (Math.random() - 0.5) * 12, t: Math.random(),
                       v: 0.02 + Math.random() * 0.02, streak: 6 + Math.random() * 6, warm: Math.random() }); });
        return arr;
    }, [blowX]);

    const drawStruct = useCallback((g) => {
        g.clear();
        const H = 15;

        /* ============ 5 CHỤP HÚT phễu 20,21 / 1,2,3 (điểm 2) ============
           Cuống chạy từ ngay dưới bầu phễu XUỐNG ống góp; NẮP CHỤP loe GẮN VÀO
           ỐNG GÓP ở đáy (không còn trùm lên bầu phễu bên trên). */
        windTaps.forEach((x) => {
            g.lineStyle(2, DUCT_LINE);
            g.beginFill(DUCT, 0.95);
            g.drawRect(x - 6, windBottomY, 12, manifold.y - windBottomY - 6);   // cuống dọc
            g.endFill();
            // nắp chụp loe úp GẮN VÀO ống góp đáy (đỉnh hẹp nối cuống, đáy loe ôm ống góp)
            g.beginFill(DUCT, 0.95);
            g.moveTo(x - 6, manifold.y - 6);
            g.lineTo(x + 6, manifold.y - 6);
            g.lineTo(x + 16, manifold.y - H / 2);
            g.lineTo(x - 16, manifold.y - H / 2);
            g.closePath();
            g.endFill();
            // mũi tên HÚT xuống
            g.lineStyle(0);
            g.beginFill(DUCT_LINE, 0.8);
            g.moveTo(x - 5, windBottomY + 6);
            g.lineTo(x + 5, windBottomY + 6);
            g.lineTo(x, windBottomY + 14);
            g.closePath();
            g.endFill();
        });

        /* ============ MID-TAP: ĐIỂM HÚT KÍN bên máy làm mát vòng (điểm 4) ============
           Thay chụp tròn hở bằng CHỤP HÚT KÍN: buồng hút ôm sát mặt vành + viền
           gioăng làm kín + cổ côn thu + mặt bích bắt bulông, rồi mới xuống ống. */
        const midW = H + 2;
        const hoodW = 54, hoodH = 30;                       // buồng hút (plenum) ôm mặt vành
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.96);
        g.drawRect(midTap.x - midW / 2, midTap.y, midW, manifold.y - midTap.y);          // tụt xuống
        g.drawRoundedRect(midTap.x - midW / 2, manifold.y - midW / 2,
                          (manifold.x0 + 40 - midTap.x) + midW / 2, midW, midW / 2);      // ngang cắm sâu vào góp
        g.endFill();
        // mặt bích tại điểm đấu nối vào ống góp
        g.lineStyle(0);
        g.beginFill(DUCT_LINE, 0.9);
        g.drawRect(manifold.x0 - 3, manifold.y - midW / 2 - 3, 6, midW + 6);
        g.endFill();
        // GIOĂNG LÀM KÍN quanh mép buồng hút (viền tối ôm sát mặt vành)
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.85);
        g.drawRoundedRect(midTap.x - hoodW / 2 - 3, midTap.y - hoodH / 2 - 3, hoodW + 6, hoodH + 6, 9);
        g.endFill();
        // BUỒNG HÚT KÍN
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.97);
        g.drawRoundedRect(midTap.x - hoodW / 2, midTap.y - hoodH / 2, hoodW, hoodH, 7);
        g.endFill();
        // CỔ CÔN THU từ buồng hút vào ống đứng (kín, không hở mép)
        g.beginFill(DUCT, 0.97);
        g.moveTo(midTap.x - hoodW / 2 + 6, midTap.y + hoodH / 2 - 2);
        g.lineTo(midTap.x + hoodW / 2 - 6, midTap.y + hoodH / 2 - 2);
        g.lineTo(midTap.x + midW / 2, midTap.y + hoodH / 2 + 12);
        g.lineTo(midTap.x - midW / 2, midTap.y + hoodH / 2 + 12);
        g.closePath();
        g.endFill();
        // BULÔNG trên mặt bích buồng hút + khe hút ám nóng bên trong
        g.lineStyle(0);
        g.beginFill(DUCT_LINE, 0.85);
        for (let bx = midTap.x - hoodW / 2 + 6; bx <= midTap.x + hoodW / 2 - 6; bx += 10) {
            g.drawCircle(bx, midTap.y - hoodH / 2 + 4, 1.8);
            g.drawCircle(bx, midTap.y + hoodH / 2 - 4, 1.8);
        }
        g.endFill();
        g.beginFill(COLORS.sinterHot, 0.42);
        g.drawRoundedRect(midTap.x - hoodW / 2 + 8, midTap.y - 6, hoodW - 16, 12, 5);
        g.endFill();
        // mũi tên dòng khí từ vành CHẢY VÀO ống góp (→)
        g.beginFill(DUCT_LINE, 0.8);
        for (let ax = midTap.x + 40; ax < manifold.x0 - 10; ax += 90) {
            g.moveTo(ax, manifold.y - 5); g.lineTo(ax + 11, manifold.y); g.lineTo(ax, manifold.y + 5); g.closePath();
        }
        g.endFill();

        /* ============ ỐNG GÓP ĐÁY ============ */
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.96);
        g.drawRoundedRect(manifold.x0, manifold.y - H / 2, manifold.x1 - manifold.x0, H, H / 2);
        g.endFill();

        /* ============ 2 QUẠT ĐẨY trên ống góp (điểm 3) — VỎ tĩnh ============
           Cánh quạt QUAY được vẽ ở lớp fanRef trong useTick. */
        fans.forEach((fx) => {
            const dir = fx < centerX ? 1 : -1;              // hướng đẩy về tâm
            g.lineStyle(2.5, DUCT_LINE);
            g.beginFill(COLORS.machineBody, 0.98);          // vỏ quạt
            g.drawRoundedRect(fx - 21, manifold.y - 19, 42, 38, 9);
            g.endFill();
            g.beginFill(COLORS.steelLight, 0.98);           // buồng cánh
            g.drawCircle(fx, manifold.y, 13);
            g.endFill();
            g.beginFill(COLORS.industrialOrange, 0.95);      // motor kéo
            g.drawRoundedRect(fx - 8, manifold.y - 32, 16, 13, 3);
            g.endFill();
            g.beginFill(COLORS.statusBad, 0.9);              // mũi tên hướng đẩy về tâm
            const ax0 = fx + dir * 27;
            g.moveTo(ax0, manifold.y - 6);
            g.lineTo(ax0 + dir * 12, manifold.y);
            g.lineTo(ax0, manifold.y + 6);
            g.closePath();
            g.endFill();
        });

        /* ============ ĐOẠN ỐNG GIÓ ĐỨNG đẩy gió TỪ DƯỚI LÊN (điểm 2) ============
           Chân ống nằm DƯỚI ống góp (có đế + mặt bích), xuyên qua ống góp rồi
           chạy thẳng lên spine -> thấy rõ gió được đẩy từ dưới lên. */
        const rW = H + 6;
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.97);
        g.drawRoundedRect(centerX - rW / 2, spineY, rW, riserFootY - spineY, rW / 2);   // thân ống đứng
        g.endFill();
        g.beginFill(COLORS.machineBody, 0.98);              // ĐẾ chân ống
        g.drawRoundedRect(centerX - 26, riserFootY - 10, 52, 18, 5);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(DUCT_LINE, 0.9);                        // 2 mặt bích kẹp ống góp
        g.drawRect(centerX - rW / 2 - 5, manifold.y - H / 2 - 4, rW + 10, 5);
        g.drawRect(centerX - rW / 2 - 5, manifold.y + H / 2 - 1, rW + 10, 5);
        g.endFill();
        g.beginFill(COLORS.sinterHot, 0.9);                 // mũi tên gió ĐI LÊN trong ống đứng
        for (let ay = riserFootY - 22; ay > spineY + 10; ay -= 30) {
            g.moveTo(centerX - 7, ay);
            g.lineTo(centerX + 7, ay);
            g.lineTo(centerX, ay - 12);
            g.closePath();
        }
        g.endFill();

        /* ============ SPINE dọc trên xe ghi ============ */
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.96);
        g.drawRoundedRect(spine.x0, spineY - H / 2, spine.x1 - spine.x0, H, H / 2);
        g.endFill();

        /* ============ ỐNG RẼ XẢ GIÓ LÊN mặt xe ghi (điểm 1) ============
           Điểm xả (nắp chụp TRÒN) nằm ĐÚNG GIỮA bề rộng xe ghi: blowTopY = 240. */
        blowX.forEach((x) => {
            g.lineStyle(2.5, DUCT_LINE);
            g.beginFill(DUCT, 0.96);
            g.drawRect(x - 7, blowTopY, 14, spineY - blowTopY);                        // ống đứng
            g.endFill();
            g.beginFill(DUCT, 0.94);                                                   // NẮP CHỤP TRÒN (điểm xả)
            g.drawCircle(x, blowTopY, 12);
            g.endFill();
            g.lineStyle(0);                                                            // mũi tên XẢ LÊN trong nắp
            g.beginFill(COLORS.sinterHot, 0.9);
            g.moveTo(x - 6, blowTopY + 4);
            g.lineTo(x + 6, blowTopY + 4);
            g.lineTo(x, blowTopY - 6);
            g.closePath();
            g.endFill();
        });

        /* ============ Mũi tên hướng dòng ============ */
        g.lineStyle(0);
        g.beginFill(DUCT_LINE, 0.8);
        // góp đáy: nhánh trái -> phải (dồn vào tâm)
        for (let ax = manifold.x0 + 70; ax < centerX - 30; ax += 150) {
            g.moveTo(ax, manifold.y - 5); g.lineTo(ax + 12, manifold.y); g.lineTo(ax, manifold.y + 5); g.closePath();
        }
        // góp đáy: nhánh phải -> trái (dồn vào tâm)
        for (let ax = manifold.x1 - 70; ax > centerX + 30; ax -= 150) {
            g.moveTo(ax, manifold.y - 5); g.lineTo(ax - 12, manifold.y); g.lineTo(ax, manifold.y + 5); g.closePath();
        }
        // spine: toả 2 phía từ tâm
        for (let ax = centerX + 60; ax < spine.x1 - 20; ax += 150) {
            g.moveTo(ax, spineY - 5); g.lineTo(ax + 11, spineY); g.lineTo(ax, spineY + 5); g.closePath();
        }
        for (let ax = centerX - 60; ax > spine.x0 + 20; ax -= 150) {
            g.moveTo(ax, spineY - 5); g.lineTo(ax - 11, spineY); g.lineTo(ax, spineY + 5); g.closePath();
        }
        g.endFill();

    }, [windTaps, midTap, windBottomY, manifold, centerX, spineY, spine, blowX, trackTopY,
        blowTopY, riserFootY, fans]);

    useTick((delta) => {
        // Khí dồn vào tâm trong ống góp đáy
        const cg = convRef.current;
        if (cg) {
            cg.clear();
            conv.forEach((p) => {
                p.u += p.v * delta;
                if (p.u > 1) p.u = 0;
                const x = p.side < 0
                    ? manifold.x0 + (centerX - manifold.x0) * p.u
                    : manifold.x1 + (centerX - manifold.x1) * p.u;
                cg.lineStyle(1.5, GAS, 0.5);
                cg.moveTo(x - p.side * 6, manifold.y);
                cg.lineTo(x, manifold.y);
            });
        }
        // Khí lên riser + toả trên spine
        const sg = spineRef.current;
        if (sg) {
            sg.clear();
            spineDust.forEach((p) => {
                p.u += p.v * delta;
                if (p.u > 1) p.u = 0;
                const end = p.side < 0 ? spine.x0 : spine.x1;
                const x = centerX + (end - centerX) * p.u;
                sg.lineStyle(1.5, GAS, 0.5);
                sg.moveTo(x - Math.sign(end - centerX) * 6, spineY);
                sg.lineTo(x, spineY);
            });
        }
        // Bụi bị HÚT xuống tại 5 phễu
        const ig = intakeRef.current;
        if (ig) {
            ig.clear();
            intake.forEach((p) => {
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                const py = (windBottomY - 4) + (manifold.y - (windBottomY - 4)) * p.t;
                ig.lineStyle(1.4, COLORS.dustGray, 0.25 + 0.4 * p.t);
                ig.moveTo(p.x, py - p.streak);
                ig.lineTo(p.x, py);
            });
        }
        // Khí THỔI LÊN mặt xe ghi tại các ống rẽ
        const bg = blowRef.current;
        if (bg) {
            bg.clear();
            blow.forEach((p) => {
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                const py = spineY - (spineY - (blowTopY - 6)) * p.t;   // đi LÊN (py giảm)
                bg.lineStyle(1.8, p.warm > 0.5 ? COLORS.sinterHot : GAS, 0.3 + 0.5 * p.t);
                bg.moveTo(p.x, py + p.streak);
                bg.lineTo(p.x, py);
            });
            /* Gió TOẢ RA khỏi nắp chụp: tia ngắn bung đều quanh điểm xả. */
            puff.forEach((q) => {
                q.t += q.v * delta;
                if (q.t > 1) q.t = 0;
                const r0 = 11 + 16 * q.t, r1 = r0 + 7;
                const ca = Math.cos(q.a), sa = Math.sin(q.a);
                bg.lineStyle(2, q.t < 0.5 ? COLORS.coolAir : GAS, 0.75 * (1 - q.t));
                bg.moveTo(q.x + ca * r0, blowTopY + sa * r0);
                bg.lineTo(q.x + ca * r1, blowTopY + sa * r1);
            });
        }
        // 2 QUẠT ĐẨY: cánh QUAY liên tục (điểm 3)
        const fg2 = fanRef.current;
        if (fg2) {
            fg2.clear();
            fanPhase.current += 0.16 * delta;
            fans.forEach((fx, fi) => {
                const spin = fanPhase.current * (fi === 0 ? 1 : -1);   // 2 quạt quay ngược nhau
                fg2.lineStyle(0);
                fg2.beginFill(COLORS.machineDark, 0.92);
                for (let k = 0; k < 5; k++) {
                    const a = spin + (k * Math.PI * 2) / 5;
                    fg2.moveTo(fx, manifold.y);
                    fg2.lineTo(fx + Math.cos(a) * 12, manifold.y + Math.sin(a) * 12);
                    fg2.lineTo(fx + Math.cos(a + 0.6) * 12, manifold.y + Math.sin(a + 0.6) * 12);
                    fg2.closePath();
                }
                fg2.endFill();
                fg2.beginFill(COLORS.machineBody);                     // trục
                fg2.drawCircle(fx, manifold.y, 3.5);
                fg2.endFill();
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={fanRef} />
            <Graphics ref={convRef} />
            <Graphics ref={spineRef} />
            <Graphics ref={intakeRef} />
            <Graphics ref={blowRef} />
        </Container>
    );
};


/* =============================================================================
 * NHÀ NGHIỀN THAN — hệ nghiền 2 cấp:
 *   Cấp 1: 2 MÁY NGHIỀN 2 TRỤC dạng rulo (đặt trên) đập thô than cục.
 *   Cấp 2: liệu đổ xuống 2 MÁY NGHIỀN 4 TRỤC nghiền mịn.
 *   Than sau nghiền rơi xuống BĂNG THAN (chạy ngay dưới hàng silo dưới) -> 3 ỐNG
 *   TẢI ĐỨNG tại cột silo 17/16/15 đưa than lên, nhả vào cả 2 hàng silo.
 * @param {object[]} twinRolls  tâm 2 máy nghiền 2 trục
 * @param {object[]} quadRolls  tâm 2 máy nghiền 4 trục
 * @param {object}   twinBox/quadBox  {w,h} vỏ máy
 * @param {object}   belt  {y,h,x0,x1} băng tải than về dãy silo
 * @param {object}   belt  {y,h,x0,x1} băng than chạy ngay DƯỚI hàng silo dưới
 * @param {number[]} risers  toạ độ x 3 ống tải đứng (silo 17/16/15)
 * @param {number}   riserW, riserTopY  bề rộng ống + cao độ đỉnh (hết hàng silo trên)
 * @param {number[]} dropYs  cao độ 2 cửa nhả liệu (đáy hàng silo dưới / trên)
 * ===========================================================================*/
/* =============================================================================
 * TRẠM KHỬ SẮT (magnetic separator) — đặt ở cuối băng xả quặng từ máy làm mát
 * vòng. Nhìn từ trên xuống: nhà trạm bao ngoài, băng quặng chạy XUYÊN QUA giữa
 * trạm, phía trên băng treo NAM CHÂM ĐIỆN hút mạt sắt; sắt bị hút lên mặt nam
 * châm rồi gạt sang MÁNG XẢ SẮT bên cạnh và rơi vào THÙNG CHỨA.
 * @param {object} frame  {x, y, width, height} khung nhà trạm
 * @param {number} beltX  toạ độ x của băng quặng chạy xuyên qua trạm
 * @param {number} beltW  bề rộng băng
 * ===========================================================================*/
export const IronRemovalStation = ({ frame, beltX, beltW = 26 }) => {
    const flowRef = useRef(null);
    const coilRef = useRef(null);
    const phase = useRef(0);

    const { x, y, width: w, height: h } = frame;
    const magX0 = beltX - 36, magX1 = beltX + 30;          // nam châm điện trùm lên băng
    const magY0 = y + 16, magY1 = y + h - 16;
    const binX = x + 12, binW = 34;                        // thùng chứa mạt sắt (bên trái)
    const chuteY = (magY0 + magY1) / 2;

    /* Quặng chạy XUỐNG trên băng xuyên qua trạm. */
    const ore = useMemo(() => Array.from({ length: 34 }, () => ({
        t: Math.random(), v: 0.010 + Math.random() * 0.009,
        off: (Math.random() - 0.5) * (beltW - 9), r: 1.5 + Math.random() * 2.2,
    })), [beltW]);

    /* Mạt sắt: bị hút LÊN mặt nam châm -> trượt sang trái -> rơi vào thùng. */
    const iron = useMemo(() => Array.from({ length: 16 }, () => ({
        t: Math.random(), v: 0.009 + Math.random() * 0.008,
        off: (Math.random() - 0.5) * (beltW - 12), r: 1.4 + Math.random() * 1.5,
    })), [beltW]);

    const drawStruct = useCallback((g) => {
        g.clear();

        /* --- bóng đổ + nền nhà trạm --- */
        g.lineStyle(0);
        g.beginFill(COLORS.ink, 0.13);
        g.drawRoundedRect(x + 6, y + 7, w, h, 10);
        g.endFill();
        g.lineStyle(2.5, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.surfaceLight, 0.99);
        g.drawRoundedRect(x, y, w, h, 10);
        g.endFill();
        g.lineStyle(1.2, COLORS.borderGray, 0.55);           // gờ mép sàn
        g.drawRoundedRect(x + 5, y + 5, w - 10, h - 10, 7);

        /* --- BĂNG QUẶNG chạy xuyên qua trạm --- */
        g.lineStyle(2, COLORS.borderGray, 0.9);
        g.beginFill(COLORS.dustLight, 0.98);
        g.drawRect(beltX - beltW / 2, y - 2, beltW, h + 4);
        g.endFill();
        g.lineStyle(1, COLORS.borderGray, 0.55);             // con lăn băng
        for (let ry = y + 8; ry < y + h - 4; ry += 12) {
            g.moveTo(beltX - beltW / 2, ry); g.lineTo(beltX + beltW / 2, ry);
        }

        /* --- MÁNG XẢ SẮT: từ nam châm gạt sang trái --- */
        g.lineStyle(2, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.ductBody, 0.98);
        g.drawRoundedRect(binX + binW - 4, chuteY - 8, (magX0 + 6) - (binX + binW - 4), 16, 5);
        g.endFill();

        /* --- THÙNG CHỨA MẠT SẮT --- */
        g.lineStyle(2.5, COLORS.machineDark);
        g.beginFill(COLORS.machineBody, 0.98);
        g.drawRoundedRect(binX, chuteY - 17, binW, 34, 5);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(COLORS.dustGray, 0.9);                   // mạt sắt đã thu
        g.drawRoundedRect(binX + 5, chuteY - 6, binW - 10, 18, 3);
        g.endFill();

        /* --- NAM CHÂM ĐIỆN treo trên băng --- */
        g.lineStyle(2.5, COLORS.machineDark);
        g.beginFill(COLORS.machineBody, 0.98);               // vỏ nam châm
        g.drawRoundedRect(magX0, magY0, magX1 - magX0, magY1 - magY0, 7);
        g.endFill();
        g.beginFill(COLORS.steelLight, 0.97);                // mặt cực
        g.drawRoundedRect(magX0 + 6, magY0 + 6, (magX1 - magX0) - 12, (magY1 - magY0) - 12, 5);
        g.endFill();
        g.lineStyle(0);                                       // cực + / −
        g.beginFill(COLORS.statusBad, 0.95);
        g.drawRect(magX0 + 12, magY0 + 12, 11, 3);
        g.drawRect(magX0 + 16, magY0 + 8, 3, 11);
        g.endFill();
        g.beginFill(COLORS.siloBorder, 0.95);
        g.drawRect(magX1 - 23, magY0 + 12, 11, 3);
        g.endFill();
    }, [x, y, w, h, beltX, beltW, magX0, magX1, magY0, magY1, binX, chuteY]);

    useTick((delta) => {
        phase.current += 0.09 * delta;

        const cg = coilRef.current;                           // cuộn dây nam châm chạy sáng
        if (cg) {
            cg.clear();
            const n = 5, span = (magY1 - magY0) - 16;
            for (let i = 0; i < n; i++) {
                const t = (i / n + (phase.current % 1)) % 1;
                cg.lineStyle(2, COLORS.coolAir, 0.35 + 0.5 * Math.sin(t * Math.PI));
                const cy2 = magY0 + 8 + span * t;
                cg.moveTo(magX0 + 9, cy2); cg.lineTo(magX1 - 9, cy2);
            }
        }

        const fg = flowRef.current;
        if (fg) {
            fg.clear();
            ore.forEach((p) => {                              // quặng chạy XUỐNG qua trạm
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                fg.beginFill(p.r > 2.6 ? 0x1c2833 : 0x4d5656, 0.95);
                fg.drawCircle(beltX + p.off, (y - 2) + (h + 4) * p.t, p.r);
                fg.endFill();
            });
            iron.forEach((p) => {                             // mạt sắt: hút lên -> sang thùng
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                const yEnter = y + h, yPick = y + h - h * 0.55;
                let px2, py2, al;
                if (p.t < 0.45) {                             // còn trên băng, tiến vào vùng nam châm
                    px2 = beltX + p.off;
                    py2 = yEnter + (yPick - yEnter) * (p.t / 0.45);
                    al = 0.9;
                } else if (p.t < 0.62) {                      // bị HÚT lên mặt nam châm
                    const k = (p.t - 0.45) / 0.17;
                    px2 = beltX + p.off * (1 - k);
                    py2 = yPick + (chuteY - yPick) * k;
                    al = 0.9;
                } else {                                      // gạt sang trái, rơi vào thùng
                    const k = (p.t - 0.62) / 0.38;
                    px2 = beltX - (beltX - (binX + binW / 2)) * k;
                    py2 = chuteY;
                    al = 0.9 * (1 - k * 0.5);
                }
                fg.beginFill(COLORS.dustGray, al);
                fg.drawCircle(px2, py2, p.r);
                fg.endFill();
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={coilRef} />
            <Graphics ref={flowRef} />
        </Container>
    );
};

/* =============================================================================
 * HỆ XỬ LÝ KHÍ THẢI — 2 CỤM SONG SONG, mỗi cụm nối vào 1 đầu ống gió tổng:
 *   (1) LỌC BỤI TĨNH ĐIỆN: buồng lọc + các bản cực song song, bụi bị hút bám
 *       vào bản cực (hạt thưa dần khi đi qua).
 *   (2) QUẠT GIÓ CHÍNH: quạt ly tâm vỏ xoắn ốc + cánh quay nhanh + motor lớn
 *       (đã bỏ ống khói/họng thổi để không thừa chi tiết nhô ra).
 * Kích thước lấy từ tham số -> dễ thu nhỏ cho vừa khung hình.
 * @param {object[]} trains [{ductFromX, ductY, espX, fanX}]
 * @param {number}   espW, espH, fanR
 * ===========================================================================*/
export const ExhaustTreatment = ({ trains, espW, espH, fanR }) => {
    const dustRef = useRef(null);
    const fanRef = useRef(null);
    const spin = useRef(0);

    const DUCT = 0xd5dbdb, DUCT_LINE = 0x7f8c8d;

    /* Bụi bị hút vào ESP rồi thưa dần (bám bản cực) — cho từng cụm. */
    const dust = useMemo(() => {
        const arr = [];
        trains.forEach((t, ti) => {
            for (let k = 0; k < 34; k++)
                arr.push({ ti, u: Math.random(), v: 0.006 + Math.random() * 0.006,
                           oy: (Math.random() - 0.5) * (espH - 22), r: 1 + Math.random() * 1.6 });
        });
        return arr;
    }, [trains, espH]);

    const drawStruct = useCallback((g) => {
        g.clear();
        const H = 16;

        trains.forEach((t) => {
            const { ductFromX, ductY, espX, fanX } = t;
            const ex = espX - espW / 2, ey = ductY - espH / 2;

            /* --- ống gió tổng NỐI DÀI tới ESP --- */
            g.lineStyle(2.5, DUCT_LINE);
            g.beginFill(DUCT, 0.97);
            g.drawRoundedRect(ductFromX, ductY - H / 2, (ex + 4) - ductFromX, H, H / 2);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(DUCT_LINE, 0.8);
            for (let ax = ductFromX + 14; ax < ex - 10; ax += 34) {
                g.moveTo(ax, ductY - 5); g.lineTo(ax + 10, ductY); g.lineTo(ax, ductY + 5); g.closePath();
            }
            g.endFill();

            /* --- (1) LỌC BỤI TĨNH ĐIỆN --- */
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.steelLight, 0.98);                 // vỏ buồng lọc
            g.drawRoundedRect(ex, ey, espW, espH, 8);
            g.endFill();
            g.beginFill(COLORS.machineBody, 0.98);                // phễu thu bụi đáy
            g.drawRoundedRect(ex + 8, ductY + espH / 2 - 6, espW - 16, 12, 4);
            g.endFill();
            g.lineStyle(1.6, COLORS.siloBorder, 0.85);            // BẢN CỰC song song
            for (let i = 1; i <= 5; i++) {
                const px = ex + (espW * i) / 6;
                g.moveTo(px, ey + 11); g.lineTo(px, ductY + espH / 2 - 9);
            }
            g.lineStyle(0);                                        // ký hiệu tĩnh điện + / −
            g.beginFill(COLORS.statusBad, 0.9);
            g.drawRect(espX - 15, ey - 8, 10, 3); g.drawRect(espX - 11.5, ey - 11.5, 3, 10);
            g.endFill();
            g.beginFill(COLORS.siloBorder, 0.95);
            g.drawRect(espX + 5, ey - 8, 10, 3);
            g.endFill();

            /* --- ống nối ESP -> quạt --- */
            g.lineStyle(2.5, DUCT_LINE);
            g.beginFill(DUCT, 0.97);
            g.drawRoundedRect(ex + espW - 4, ductY - H / 2, (fanX - fanR) - (ex + espW) + 8, H, H / 2);
            g.endFill();

            /* --- (2) QUẠT GIÓ CHÍNH (ly tâm, vỏ xoắn ốc) --- */
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.machineBody, 0.98);                // vỏ xoắn ốc
            g.drawCircle(fanX, ductY, fanR);
            g.endFill();
            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.steelLight, 0.98);                 // đĩa buồng cánh
            g.drawCircle(fanX, ductY, fanR - 7);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.95);                // bệ máy
            g.drawRoundedRect(fanX - fanR - 4, ductY + fanR - 3, 2 * fanR + 8, 11, 3);
            g.endFill();
            g.beginFill(COLORS.industrialOrange, 0.97);           // motor lớn
            g.drawRoundedRect(fanX - 15, ductY + fanR + 7, 30, 15, 4);
            g.endFill();
        });
    }, [trains, espW, espH, fanR]);

    useTick((delta) => {
        spin.current += 0.26 * delta;

        const dg = dustRef.current;
        if (dg) {
            dg.clear();
            dust.forEach((p) => {
                const t = trains[p.ti];
                if (!t) return;
                p.u += p.v * delta;
                if (p.u > 1) p.u = 0;
                const ex0 = t.espX - espW / 2 + 5, ex1 = t.espX + espW / 2 - 5;
                const x = ex0 + (ex1 - ex0) * p.u;
                const fade = 1 - p.u;                              // bụi thưa dần khi qua bản cực
                if (Math.random() < 0.55) {
                    dg.beginFill(COLORS.machineDark, 0.26 + 0.55 * fade);
                    dg.drawCircle(x, t.ductY + p.oy * (0.4 + 0.6 * fade), p.r);
                    dg.endFill();
                }
            });
        }

        const fgc = fanRef.current;                                // cánh quạt chính quay
        if (fgc) {
            fgc.clear();
            fgc.lineStyle(0);
            trains.forEach((t, ti) => {
                const rr = fanR - 9;
                const sgn = ti % 2 === 0 ? 1 : -1;
                fgc.beginFill(COLORS.machineDark, 0.92);
                for (let k = 0; k < 9; k++) {
                    const a = spin.current * sgn + (k * Math.PI * 2) / 9;
                    fgc.moveTo(t.fanX, t.ductY);
                    fgc.lineTo(t.fanX + Math.cos(a) * rr, t.ductY + Math.sin(a) * rr);
                    fgc.lineTo(t.fanX + Math.cos(a + 0.42) * rr, t.ductY + Math.sin(a + 0.42) * rr);
                    fgc.closePath();
                }
                fgc.endFill();
                fgc.beginFill(COLORS.borderGray);
                fgc.drawCircle(t.fanX, t.ductY, 4.5);
                fgc.endFill();
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={fanRef} />
            <Graphics ref={dustRef} />
        </Container>
    );
};

export const CoalCrushingPlant = ({
    twinRolls, quadRolls, twinBox, quadBox, belt, risers, riserW, riserTopY, dropYs,
}) => {
    const flowRef = useRef(null);
    const rollRef = useRef(null);
    const phase = useRef(0);

    const COAL_DARK = 0x1c2833, COAL_MID = 0x4d5656;
    const bTop = belt.y - belt.h / 2;
    const bBot = belt.y + belt.h / 2;

    /* Hạt than chạy DÀY trên băng: từ nhà nghiền (phải) về dãy silo (trái). */
    const grains = useMemo(() => Array.from({ length: 230 }, () => ({
        u: Math.random(), v: 0.0016 + Math.random() * 0.0015,
        off: (Math.random() - 0.5) * (belt.h - 6), r: 1.6 + Math.random() * 2.6,
    })), [belt.h]);

    /* Hạt rơi trong ống: nghiền 2 trục -> nghiền 4 trục -> băng tải. */
    const drops = useMemo(() => {
        const arr = [];
        twinRolls.forEach((m, i) => {
            const q = quadRolls[i];
            for (let k = 0; k < 6; k++)
                arr.push({ x: m.x, y0: m.y + twinBox.h / 2, y1: q.y - quadBox.h / 2,
                           t: Math.random(), v: 0.026 + Math.random() * 0.02 });
        });
        quadRolls.forEach((m) => {
            for (let k = 0; k < 6; k++)
                arr.push({ x: m.x, y0: m.y + quadBox.h / 2, y1: bTop,
                           t: Math.random(), v: 0.026 + Math.random() * 0.02 });
        });
        return arr;
    }, [twinRolls, quadRolls, twinBox.h, quadBox.h, bTop]);

    /* Than đi LÊN trong 3 ống tải đứng (băng -> hết hàng silo trên). */
    const ups = useMemo(() => {
        const arr = [];
        risers.forEach((x) => {
            for (let k = 0; k < 7; k++)
                arr.push({ x, t: Math.random(), v: 0.013 + Math.random() * 0.011 });
        });
        return arr;
    }, [risers]);

    const drawStruct = useCallback((g) => {
        g.clear();

        /* ---------- BĂNG THAN chạy NGAY DƯỚI hàng silo dưới ---------- */
        g.lineStyle(2, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.machineBody, 0.98);                       // khung đỡ băng
        g.drawRoundedRect(belt.x0 - 5, bTop - 5, (belt.x1 - belt.x0) + 10, belt.h + 10, 4);
        g.endFill();
        g.beginFill(COLORS.industrialOrange, 0.99);                  // mặt băng (màu cam)
        g.drawRect(belt.x0, bTop, belt.x1 - belt.x0, belt.h);
        g.endFill();
        g.lineStyle(1.1, COLORS.machineDark, 0.35);                  // con lăn đỡ
        for (let x = belt.x0 + 20; x < belt.x1; x += 34) { g.moveTo(x, bTop); g.lineTo(x, bBot); }
        g.lineStyle(0);                                              // chiều chạy: sang TRÁI
        g.beginFill(COLORS.white, 0.9);
        for (let x = belt.x1 - 90; x > belt.x0 + 50; x -= 160) {
            g.moveTo(x, belt.y - 5); g.lineTo(x - 13, belt.y); g.lineTo(x, belt.y + 5); g.closePath();
        }
        g.endFill();
        g.lineStyle(2, COLORS.machineDark);                          // 2 tang dẫn động 2 đầu băng
        g.beginFill(COLORS.machineBody, 0.98);
        g.drawRoundedRect(belt.x0 - 11, bTop - 4, 12, belt.h + 8, 4);
        g.drawRoundedRect(belt.x1 - 1, bTop - 4, 12, belt.h + 8, 4);
        g.endFill();

        /* ---------- 3 ỐNG TẢI ĐỨNG tại cột silo 17/16/15 ----------
           Đi thẳng từ băng LÊN hết hàng silo trên; có cửa nhả vào cả 2 hàng silo. */
        risers.forEach((x) => {
            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.ductBody, 0.97);
            g.drawRoundedRect(x - riserW / 2, riserTopY, riserW, bTop - riserTopY, 4);   // thân ống đứng
            g.endFill();
            g.lineStyle(0);                                                              // mũi tên than ĐI LÊN
            g.beginFill(COLORS.statusWarn, 0.9);
            for (let ly = bTop - 16; ly > riserTopY + 12; ly -= 34) {
                g.moveTo(x - 5, ly); g.lineTo(x + 5, ly); g.lineTo(x, ly - 11); g.closePath();
            }
            g.endFill();
            // 2 CỬA NHẢ liệu vào đáy mỗi hàng silo
            dropYs.forEach((dy) => {
                g.lineStyle(2, COLORS.machineDark);
                g.beginFill(COLORS.ductBody, 0.97);
                g.moveTo(x - riserW / 2, dy + 12);
                g.lineTo(x + riserW / 2, dy + 12);
                g.lineTo(x + 16, dy - 2);
                g.lineTo(x - 16, dy - 2);
                g.closePath();
                g.endFill();
                g.lineStyle(0);
                g.beginFill(COLORS.statusWarn, 0.95);
                g.moveTo(x - 5, dy + 10); g.lineTo(x + 5, dy + 10); g.lineTo(x, dy); g.closePath();
                g.endFill();
            });
        });

        /* ---------- ỐNG ĐỔ LIỆU: nghiền 2 trục -> nghiền 4 trục -> băng ---------- */
        const chute = (cx, y0, y1) => {
            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.ductBody, 0.97);
            g.drawRect(cx - 9, y0 - 2, 18, (y1 - y0) + 4);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.55);
            g.moveTo(cx - 5, y1 - 13); g.lineTo(cx + 5, y1 - 13); g.lineTo(cx, y1 - 3); g.closePath();
            g.endFill();
        };
        twinRolls.forEach((m, i) => chute(m.x, m.y + twinBox.h / 2, quadRolls[i].y - quadBox.h / 2));
        quadRolls.forEach((m) => chute(m.x, m.y + quadBox.h / 2, bTop));

        /* ---------- VỎ MÁY + RULO NGHIỀN ---------- */
        const machine = (cx, cy, w, h, nRolls) => {
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 0.98);
            g.drawRoundedRect(cx - w / 2, cy - h / 2, w, h, 7);            // vỏ máy
            g.endFill();
            g.beginFill(COLORS.industrialOrange, 0.97);                    // motor kéo
            g.drawRoundedRect(cx + w / 2 - 5, cy - 11, 17, 22, 4);
            g.endFill();
            g.beginFill(COLORS.machineBody, 0.98);                         // phễu nạp trên nóc
            g.drawRoundedRect(cx - 16, cy - h / 2 - 7, 32, 9, 3);
            g.endFill();
            const rl = w - 28, th = nRolls === 2 ? 15 : 11, gap = h / (nRolls + 1);
            for (let i = 0; i < nRolls; i++) {
                const ry = cy - h / 2 + gap * (i + 1);
                g.lineStyle(1.6, COLORS.drumOutline);
                g.beginFill(COLORS.drumShell, 0.99);                       // rulo nằm ngang
                g.drawRoundedRect(cx - rl / 2, ry - th / 2, rl, th, th / 2);
                g.endFill();
                g.lineStyle(0);
                g.beginFill(COLORS.machineBody);                           // cổ trục 2 đầu
                g.drawCircle(cx - rl / 2 - 4, ry, 3.4);
                g.drawCircle(cx + rl / 2 + 4, ry, 3.4);
                g.endFill();
            }
        };
        twinRolls.forEach((m) => machine(m.x, m.y, twinBox.w, twinBox.h, 2));
        quadRolls.forEach((m) => machine(m.x, m.y, quadBox.w, quadBox.h, 4));
    }, [twinRolls, quadRolls, twinBox, quadBox, belt, risers, riserW, riserTopY, dropYs, bTop, bBot]);

    useTick((delta) => {
        phase.current += 0.06 * delta;

        const fg = flowRef.current;
        if (fg) {
            fg.clear();
            grains.forEach((p) => {                                        // than trên băng -> chạy sang TRÁI
                p.u += p.v * delta;
                if (p.u > 1) p.u = 0;
                const x = belt.x1 - (belt.x1 - belt.x0) * p.u;
                fg.beginFill(p.r > 2.7 ? COAL_DARK : COAL_MID, 0.96);
                fg.drawCircle(x, belt.y + p.off, p.r);
                fg.endFill();
            });
            drops.forEach((p) => {                                         // rơi trong ống đổ liệu
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                fg.beginFill(COAL_DARK, 0.9);
                fg.drawCircle(p.x + ((p.t * 11) % 5) - 2.5, p.y0 + (p.y1 - p.y0) * p.t, 2.2);
                fg.endFill();
            });
            ups.forEach((p) => {                                           // than ĐI LÊN trong ống tải đứng
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                fg.beginFill(COAL_DARK, 0.92);
                fg.drawCircle(p.x + ((p.t * 11) % 5) - 2.5, bTop - (bTop - riserTopY) * p.t, 2.1);
                fg.endFill();
            });
        }

        const rg = rollRef.current;                                        // răng rulo chạy theo chiều quay
        if (rg) {
            rg.clear();
            const flutes = (cx, cy, w, h, nRolls) => {
                const rl = w - 28, gap = h / (nRolls + 1), half = nRolls === 2 ? 6 : 4;
                for (let i = 0; i < nRolls; i++) {
                    const ry = cy - h / 2 + gap * (i + 1);
                    const dir = i % 2 === 0 ? 1 : -1;
                    rg.lineStyle(1.6, COLORS.machineDark, 0.7);
                    for (let k = 0; k < 7; k++) {
                        const raw = k * (rl / 7) + dir * phase.current * 9;
                        const fx = cx - rl / 2 + (((raw % rl) + rl) % rl);
                        rg.moveTo(fx, ry - half);
                        rg.lineTo(fx, ry + half);
                    }
                }
            };
            twinRolls.forEach((m) => flutes(m.x, m.y, twinBox.w, twinBox.h, 2));
            quadRolls.forEach((m) => flutes(m.x, m.y, quadBox.w, quadBox.h, 4));
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={rollRef} />
            <Graphics ref={flowRef} />
        </Container>
    );
};


/**
 * NGHIỀN TRỤC ĐƠN (single roll crusher) — đặt ở cuối đường xe ghi, đánh vỡ
 * bánh quặng thiêu kết nóng. Dạng trụ đứng dài như bố liệu nhưng có các
 * BÁNH RĂNG NGHIỀN CỠ TO: răng tam giác nhô ra 2 mép thân + các hàng răng
 * mặt trước chạy ngang theo chiều quay. Quay NGƯỢC chiều với bố liệu.
 * @param {object} cfg {x, y, radius, height}
 */
export const SingleRollCrusher = ({ x, y, radius, height }) => {
    const gRef = useRef(null);
    const phase = useRef(0);

    useTick((delta) => {
        phase.current += 0.05 * delta;
        const g = gRef.current;
        if (!g) return;
        g.clear();

        // Thân trụ quay NGƯỢC chiều bố liệu (phase âm)
        drawSpinningCylinder(g, x, y, radius, height, -phase.current, COLORS.drumShell, 6);

        const half = height / 2;

        // Răng nghiền TO nhô ra 2 mép thân (silhouette răng luôn nhìn thấy)
        g.lineStyle(1.5, COLORS.drumOutline);
        g.beginFill(0x808b96);
        const toothH = 13, toothW = 7;
        for (let ty = y - half + 10; ty <= y + half - 10; ty += toothH + 6) {
            // Mép trái
            g.moveTo(x - radius, ty);
            g.lineTo(x - radius - toothW, ty + toothH / 2);
            g.lineTo(x - radius, ty + toothH);
            g.closePath();
            // Mép phải (so le nửa bước)
            const ty2 = ty + (toothH + 6) / 2;
            if (ty2 + toothH <= y + half - 6) {
                g.moveTo(x + radius, ty2);
                g.lineTo(x + radius + toothW, ty2 + toothH / 2);
                g.lineTo(x + radius, ty2 + toothH);
                g.closePath();
            }
        }
        g.endFill();

        // Các hàng răng MẶT TRƯỚC chạy ngang theo chiều quay (ngược bố liệu)
        g.lineStyle(0);
        g.beginFill(0x566573, 0.9);
        const seams = 6;
        for (let i = 0; i < seams; i++) {
            const a = -phase.current + (i * Math.PI * 2) / seams;
            if (Math.cos(a) <= 0.15) continue;
            const sx = x + radius * Math.sin(a);
            for (let ty = y - half + 14; ty <= y + half - 14; ty += 18) {
                g.drawRect(sx - 2.5, ty - 4, 5, 8);   // mấu răng vuông to trên mặt trụ
            }
        }
        g.endFill();
    });

    return <Graphics ref={gRef} />;
};

/**
 * ỐNG GIÓ TỔNG chạy dọc phía ngoài dãy phễu ống gió, kèm hiệu ứng HÚT GIÓ + BỤI:
 * các vệt bụi mảnh chảy liên tục TỪ TRÁI SANG PHẢI bên trong ống (chiều hút),
 * cùng các mũi tên chỉ hướng gió cố định trên thân ống.
 * @param {object} duct {y, xStart, xEnd, height}
 */
export const WindMainDuct = ({ y, xStart, xEnd, height = 16, dustCount = 55 }) => {
    const gRef = useRef(null);
    const len = xEnd - xStart;

    /* Vệt bụi: vị trí + vận tốc + độ dài vệt + màu, tái sinh bên trái khi ra khỏi ống */
    const dust = useMemo(() => Array.from({ length: dustCount }, () => ({
        px: Math.random() * len,
        py: 3 - height / 2 + Math.random() * (height - 6),
        vx: 1.1 + Math.random() * 1.9,
        streak: 4 + Math.random() * 7,
        color: [COLORS.dustGray, COLORS.borderGray, COLORS.mixedOre][Math.floor(Math.random() * 3)],
    })), [len, height, dustCount]);

    const drawDuct = useCallback((g) => {
        g.clear();
        // Thân ống tổng
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.ductBody, 0.92);
        g.drawRoundedRect(xStart, y - height / 2, len, height, height / 2);
        g.endFill();
        // Mặt bích định kỳ
        g.lineStyle(1.5, COLORS.drumOutline, 0.7);
        for (let fx = xStart + 130; fx < xEnd - 20; fx += 150) {
            g.moveTo(fx, y - height / 2 - 2);
            g.lineTo(fx, y + height / 2 + 2);
        }
        // Mũi tên chỉ HƯỚNG GIÓ (trái -> phải) trên thân ống
        g.lineStyle(0);
        g.beginFill(COLORS.drumOutline, 0.55);
        for (let ax = xStart + 90; ax < xEnd - 40; ax += 280) {
            g.moveTo(ax, y - 4);
            g.lineTo(ax + 9, y);
            g.lineTo(ax, y + 4);
            g.closePath();
        }
        g.endFill();
    }, [y, xStart, xEnd, height, len]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();
        dust.forEach((d) => {
            d.px += d.vx * delta;
            if (d.px > len - 4) { d.px = 4; d.py = 3 - height / 2 + Math.random() * (height - 6); }
            g.lineStyle(1.3, d.color, 0.4);
            g.moveTo(xStart + d.px - d.streak, y + d.py);
            g.lineTo(xStart + d.px, y + d.py);
        });
    });

    return (
        <Container>
            <Graphics draw={drawDuct} />
            <Graphics ref={gRef} />
        </Container>
    );
};

/* --- Vẽ 1 cục quặng dạng ĐA GIÁC (góc cạnh như cục vỡ thật) ---
   shape: mảng hệ số bán kính cho từng đỉnh, sinh 1 lần rồi tái dùng. */
const makeChunkShape = (verts = 7) =>
    Array.from({ length: verts }, () => 0.68 + Math.random() * 0.42);

const drawChunk = (g, x, y, size, shape, spin = 0) => {
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

/**
 * LIỆU TẠI TRỤ NGHIỀN (trục do SingleRollCrusher vẽ): tảng quặng đen to trôi
 * từ phía toa về, phủ trên trục, qua trục thì bị ĐÁNH BỂ thành mảnh nhỏ văng
 * sang trái trong phạm vi HẸP rồi mờ nhanh.
 * @param {object} roll {x, yTop, height} — x tâm trụ, dải y thân trụ.
 */
export const SinterCrusher = ({ roll }) => {
    const gRef = useRef(null);
    const SINTER_COLORS = [COLORS.sinterOre, 0x17202a, 0x212f3d, 0x0e1418];   // quặng thiêu kết ĐEN
    const OVERRUN = 40;                                               // đoạn mờ dần dưới chân trụ

    /* --- Dòng NGANG: tảng chia "làn" y phủ đều, trôi qua trục rồi bể --- */
    const horiz = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
        bx: -6 + Math.random() * 44,
        lane: roll.yTop + 12 + (i / 13) * (roll.height - 24),
        jitter: (Math.random() - 0.5) * 8,
        size: 9 + Math.random() * 6,
        vx: 0.35 + Math.random() * 0.45,
        color: SINTER_COLORS[Math.floor(Math.random() * 4)],
        shape: makeChunkShape(7),
        spin: Math.random() * Math.PI,
    })), [roll.yTop, roll.height]);
    const frags = useMemo(() => Array.from({ length: 30 }, () => ({ life: 0, shape: makeChunkShape(6), spin: 0 })), []);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();

        // Dòng ngang + đánh bể
        horiz.forEach((b) => {
            b.bx -= b.vx * delta;
            const by = b.lane + b.jitter;
            if (b.bx <= -12) {
                let spawned = 0;
                for (const f of frags) {
                    if (f.life <= 0 && spawned < 4) {
                        f.fx = roll.x - 14;
                        f.fy = by + (Math.random() - 0.5) * 8;
                        f.vx = -(0.5 + Math.random() * 0.5);
                        f.vy = (Math.random() - 0.5) * 0.5;
                        f.size = 3 + Math.random() * 2.6;
                        f.color = b.color;
                        f.shape = makeChunkShape(6);
                        f.spin = Math.random() * Math.PI;
                        f.life = 1;
                        spawned++;
                    }
                }
                b.bx = 28 + Math.random() * 20;
                b.jitter = (Math.random() - 0.5) * 8;
                b.size = 9 + Math.random() * 6;
                b.color = SINTER_COLORS[Math.floor(Math.random() * 4)];
                b.shape = makeChunkShape(7);
            }
            b.spin += 0.012 * delta;                       // cục quặng lăn chậm khi bị cuốn
            g.lineStyle(1.5, 0x000000, 0.65);
            g.beginFill(b.color);
            drawChunk(g, roll.x + b.bx, by, b.size, b.shape, b.spin);
            g.endFill();
        });
        frags.forEach((f) => {
            if (f.life <= 0) return;
            f.fx += f.vx * delta;
            f.fy += f.vy * delta;
            f.life = Math.max(0, 1 - (roll.x - 14 - f.fx) / 32);
            if (f.life > 0) {
                f.spin += 0.06 * delta;                    // mảnh vỡ xoay nhanh khi văng
                g.lineStyle(0);
                g.beginFill(f.color, 0.25 + 0.7 * f.life);
                drawChunk(g, f.fx, f.fy, f.size, f.shape, f.spin);
                g.endFill();
            }
        });

    });

    return <Graphics ref={gRef} />;
};

/**
 * HIỆU ỨNG HÚT GIÓ TRÊN MẶT XE GHI: các vệt gió/bụi dọc mờ (style giống bụi
 * trong 2 ống gió tổng) chảy từ TÂM dãy xe ra 2 BÊN HÔNG — thể hiện gió bị hút
 * qua lớp liệu xuống các phễu ống gió 2 bên.
 * @param {object} area {xStart, xEnd, yTop, height} vùng dãy xe có phễu hút.
 */
export const TrackSuction = ({ area, count = 72 }) => {
    const gRef = useRef(null);
    const mid = area.yTop + area.height / 2;

    const flows = useMemo(() => Array.from({ length: count }, () => ({
        px: area.xStart + Math.random() * (area.xEnd - area.xStart),
        py: mid + (Math.random() - 0.5) * 30,
        dir: Math.random() < 0.5 ? -1 : 1,                 // lên mép trên / xuống mép dưới
        vy: 0.5 + Math.random() * 0.7,
        streak: 4 + Math.random() * 4,
        color: [COLORS.dustLight, COLORS.dustGray][Math.floor(Math.random() * 2)],
    })), [area.xStart, area.xEnd, mid, count]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();
        flows.forEach((w) => {
            w.py += w.dir * w.vy * delta;
            const outTop = w.py < area.yTop + 5;
            const outBot = w.py > area.yTop + area.height - 5;
            if (outTop || outBot) {
                w.px = area.xStart + Math.random() * (area.xEnd - area.xStart);
                w.py = mid + (Math.random() - 0.5) * 30;
                w.dir = Math.random() < 0.5 ? -1 : 1;
            }
            // Vệt dọc mờ theo chiều bị hút (đậm dần nhẹ khi gần mép — gió mạnh gần phễu)
            const t = Math.abs(w.py - mid) / (area.height / 2);
            g.lineStyle(1.3, w.color, 0.14 + 0.16 * t);
            g.moveTo(w.px, w.py - w.dir * w.streak);
            g.lineTo(w.px, w.py);
        });
    });

    return <Graphics ref={gRef} />;
};

/**
 * ĐỘNG CƠ ĐẨY XE GHI: hộp motor có khe tản nhiệt + puly quay + dây đai truyền
 * xuống cổ trục quay đầu máy.
 * @param {object} motor {x, y} tâm thân motor.
 * @param {object} axle  {x, y} cổ trục quay nhận truyền động.
 */
export const DriveMotor = ({ motor, axle }) => {
    const gRef = useRef(null);
    const phase = useRef(0);
    const pulley = { x: motor.x + 33, y: motor.y };

    const drawBody = useCallback((g) => {
        g.clear();
        // Chân đế
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark);
        g.drawRect(motor.x - 22, motor.y + 14, 12, 5);
        g.drawRect(motor.x + 10, motor.y + 14, 12, 5);
        g.endFill();
        // Thân motor + khe tản nhiệt
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.machineBody);
        g.drawRoundedRect(motor.x - 26, motor.y - 15, 52, 30, 6);
        g.endFill();
        g.lineStyle(1.5, COLORS.machineDark, 0.9);
        for (let fx = motor.x - 18; fx <= motor.x + 18; fx += 7) {
            g.moveTo(fx, motor.y - 10);
            g.lineTo(fx, motor.y + 10);
        }
        // Dây đai truyền xuống cổ trục quay
        g.lineStyle(2.5, COLORS.machineDark, 0.85);
        g.moveTo(pulley.x - 8, pulley.y + 3);
        g.lineTo(axle.x - 4, axle.y);
        g.moveTo(pulley.x + 8, pulley.y + 3);
        g.lineTo(axle.x + 4, axle.y);
    }, [motor.x, motor.y, axle.x, axle.y]);

    useTick((delta) => {
        phase.current += 0.11 * delta;
        const g = gRef.current;
        if (!g) return;
        g.clear();
        // Puly quay (vòng + 2 vạch đường kính xoay)
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.steelLight);
        g.drawCircle(pulley.x, pulley.y, 9);
        g.endFill();
        g.lineStyle(2, COLORS.drumOutline, 0.85);
        for (let k = 0; k < 2; k++) {
            const a = phase.current + (k * Math.PI) / 2;
            g.moveTo(pulley.x - Math.cos(a) * 9, pulley.y - Math.sin(a) * 9);
            g.lineTo(pulley.x + Math.cos(a) * 9, pulley.y + Math.sin(a) * 9);
        }
    });

    return (
        <Container>
            <Graphics draw={drawBody} />
            <Graphics ref={gRef} />
        </Container>
    );
};

/* =============================================================================
 * CONTAINER 6: CON THOI RẢI LIỆU • MÁY LÀM MÁT VÒNG • QUẠT HÚT GIÓ
 * ===========================================================================*/

/* Quặng thiêu kết đã qua làm mát (đổ ra băng sau máy làm mát vòng) */
export const COOLED_SINTER_COLORS = [0x4e342e, 0x5d4037, 0x3e2723, 0x2c1e1a];

/* Quặng thiêu kết ĐEN — liệu trên vành làm mát và trên băng xả */
export const BLACK_SINTER_COLORS = [0x1c2833, 0x17202a, 0x212f3d, 0x0e1418];

/**
 * MÁY RẢI LIỆU CON THOI: xe rải chạy qua-lại dọc theo mặt trống bố liệu.
 * Component chỉ vẽ con thoi; việc "chạy sang nửa bên kia thì khuất" được xử lý
 * bằng THỨ TỰ LỚP — render component này TRƯỚC silo/băng liệu hỗn hợp.
 * @param {object} rail {x, yTop, yBottom} đường chạy (dọc theo trống bố liệu).
 * @param {object} size {width, height} kích thước thân con thoi.
 */
export const ShuttleDistributor = ({ rail, size = { width: 50, height: 26 }, speed = 0.55 }) => {
    const gRef = useRef(null);
    const pos = useRef(rail.yTop);
    const dir = useRef(1);

    const drawRail = useCallback((g) => {
        g.clear();
        // Ray dẫn hướng con thoi (2 thanh mảnh dọc)
        g.lineStyle(1.5, COLORS.machineDark, 0.55);
        g.moveTo(rail.x - size.width / 2 + 4, rail.yTop);
        g.lineTo(rail.x - size.width / 2 + 4, rail.yBottom);
        g.moveTo(rail.x + size.width / 2 - 4, rail.yTop);
        g.lineTo(rail.x + size.width / 2 - 4, rail.yBottom);
    }, [rail.x, rail.yTop, rail.yBottom, size.width]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;

        // Chạy qua-lại giữa 2 đầu ray
        pos.current += dir.current * speed * delta;
        if (pos.current >= rail.yBottom) { pos.current = rail.yBottom; dir.current = -1; }
        if (pos.current <= rail.yTop) { pos.current = rail.yTop; dir.current = 1; }

        const y = pos.current;
        const hw = size.width / 2;
        const hh = size.height / 2;
        g.clear();

        // Thân con thoi
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.machineBody);
        g.drawRoundedRect(rail.x - hw, y - hh, size.width, size.height, 4);
        g.endFill();
        // Băng rải bên trong (vạch chéo chạy theo chiều di chuyển)
        g.lineStyle(1.5, COLORS.steelLight, 0.75);
        for (let i = 0; i < 4; i++) {
            const bx = rail.x - hw + 8 + i * 11;
            g.moveTo(bx, y - hh + 4);
            g.lineTo(bx + 5, y + hh - 4);
        }
        // 2 bánh xe 2 đầu
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark);
        g.drawCircle(rail.x - hw + 5, y - hh - 2, 3);
        g.drawCircle(rail.x + hw - 5, y - hh - 2, 3);
        g.drawCircle(rail.x - hw + 5, y + hh + 2, 3);
        g.drawCircle(rail.x + hw - 5, y + hh + 2, 3);
        g.endFill();
        // Liệu đang rải xuống dưới con thoi
        g.beginFill(COLORS.mixedOre, 0.6);
        for (let i = 0; i < 5; i++) {
            g.drawCircle(rail.x - hw + 9 + Math.random() * (size.width - 18), y + hh + 3 + Math.random() * 5, 1.6);
        }
        g.endFill();
    });

    return (
        <Container>
            <Graphics draw={drawRail} />
            <Graphics ref={gRef} />
        </Container>
    );
};

/* =============================================================================
 * QUẠT HƯỚNG TRỤC CÔNG NGHIỆP (industrial axial fan) — nhìn từ trên xuống.
 * Cấu tạo vẽ đúng theo thiết bị thật: mặt bích vuông + 4 bu-lông chân đế →
 * ống thổi loe nối vào vỏ máy làm mát → vỏ ống tròn (housing) → 6 cánh AEROFOIL
 * cong bản rộng → chân nhện đỡ động cơ → moay-ơ + chụp trục → hộp đấu điện.
 * (ux, uy) = vector đơn vị HƯỚNG VÀO tâm máy làm mát: dùng để xoay mặt bích và
 * ống thổi luôn quay đúng về phía vành, dù quạt đứng ở góc nào.
 * ===========================================================================*/
const drawIndustrialFan = (g, cx, cy, r, phase, blades = 6, ux = -1, uy = 0, ductLen = 20) => {
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
const drawFanAirflow = (g, fan, r, phase, reach, ringDepth) => {
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

/**
 * MÁY LÀM MÁT VÒNG (annular cooler) — view từ trên xuống.
 * Lòng máng ĐẦY LIỆU: nền lớp liệu phủ kín trọn vành (trừ đúng cung cửa nạp/xả)
 * + hàng trăm cục quặng đen chạy vòng trên nền, tạo cảm giác máng chất đầy ắp.
 * Vành quay NGƯỢC CHIỀU KIM ĐỒNG HỒ: quặng nóng từ nghiền trục đơn nạp ở NỬA
 * TRÊN hộp cửa (còn đỏ lửa), nguội dần suốt cung quay, tới NỬA DƯỚI thì xả
 * xuống băng tải xích.
 * Quanh vành là dãy QUẠT HƯỚNG TRỤC công nghiệp áp SÁT vỏ máy, trải đều trên
 * cung trống (né vùng nghiền trục đơn, hộp cửa và băng xả), liên tục hút gió
 * mát từ ngoài thổi xuyên lớp liệu.
 * @param {number} cx, cy, rOuter, rInner   Hình học vành.
 * @param {number} chunkCount, cellCount    Mật độ cục liệu / số khoang chia.
 * @param {number} fanCount, fanGap, fanRadius, fanBlades   Thông số dãy quạt.
 * @param {object} fanArc  {start, end} cung (độ) được phép đặt quạt.
 * @param {object} gate    {x0,x1,y0,y1} hộp cửa: nửa trên NẠP, nửa dưới XẢ.
 * @param {number} hotArc  Cung (độ) sau cửa nạp mà liệu còn nóng đỏ.
 */
/* =============================================================================
 * MÁY ĐÁNH ĐỐNG - RÚT LIỆU (có hoạt ảnh)
 * Cần quật qua quật lại quanh trụ trên băng gallery, đầu cần rót quặng xuống
 * đống. Toàn bộ thân cần được VẼ ĐÚNG MỘT LẦN ở tư thế nằm ngang (chĩa theo
 * +x); mỗi khung hình chỉ đổi `rotation` của Container -> KHÔNG dựng lại hình
 * học, gần như không tốn gì. Chỉ nhúm quặng rót ở đầu cần mới vẽ lại mỗi khung,
 * mà cũng chỉ 14 hạt.
 * ===========================================================================*/
export const StackerReclaimer = ({
    cx, cy, r, deg = 0, sweep = 55, speed = 1, phase = 0,
}) => {
    const boomRef = useRef(null);
    const oreRef = useRef(null);
    const t = useRef(phase);

    /* Thân cần: vẽ ở tư thế chĩa theo +x, trụ quay ở gốc toạ độ. */
    const drawBoom = useCallback((g) => {
        const tail = -r * 0.34;
        g.clear();
        g.lineStyle(9, COLORS.machineDark, 1);              // dầm cần
        g.moveTo(tail, 0); g.lineTo(r, 0);
        g.lineStyle(5, COLORS.ductBody, 1);
        g.moveTo(tail, 0); g.lineTo(r, 0);
        g.lineStyle(2, COLORS.machineDark);
        g.beginFill(COLORS.machineDark, 0.9);               // đối trọng ở đuôi
        g.drawRect(tail - 13, -9, 26, 18);
        g.endFill();
        g.beginFill(COLORS.industrialOrange, 0.95);         // gàu rót ở đầu cần
        g.drawCircle(r, 0, 11);
        g.endFill();
        g.beginFill(COLORS.dustLight, 0.98);                // trụ quay
        g.drawCircle(0, 0, 15);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.8);
        g.drawCircle(0, 0, 5);
        g.endFill();
    }, [r]);

    /* Nhúm quặng đang rót khỏi gàu — toạ độ cục bộ so với đầu cần. */
    const ore = useMemo(() => Array.from({ length: 14 }, () => ({
        t: Math.random(),
        vx: (Math.random() - 0.5) * 0.5,
        sp: 0.020 + Math.random() * 0.030,
        sz: 1.6 + Math.random() * 2.6,
        c: BLACK_SINTER_COLORS[Math.floor(Math.random() * BLACK_SINTER_COLORS.length)],
    })), []);

    useTick((delta) => {
        t.current += 0.011 * speed * delta;
        const ang = deg + Math.sin(t.current) * sweep;      // quật qua quật lại
        if (boomRef.current) boomRef.current.rotation = (ang * Math.PI) / 180;

        const g = oreRef.current;
        if (!g) return;
        g.clear();
        g.lineStyle(0);
        ore.forEach((o) => {
            o.t += o.sp * delta;
            if (o.t > 1) o.t -= 1;
            const d = o.t * 26;                             // rơi khỏi gàu ~26 đơn vị
            g.beginFill(o.c, 0.92 - o.t * 0.35);
            g.drawRect(r + o.vx * d - o.sz, d - o.sz, o.sz * 2, o.sz * 2);
            g.endFill();
        });
    });

    return (
        <Container x={cx} y={cy}>
            <Container ref={boomRef}>
                <Graphics draw={drawBoom} />
                <Graphics ref={oreRef} />
            </Container>
        </Container>
    );
};

export const AnnularCooler = ({
    cx, cy, rOuter, rInner,
    chunkCount = 360, cellCount = 40,
    fanCount = 9, fanGap = 20, fanRadius = 16, fanBlades = 6,
    fanArc = { start: 56, end: 330 },
    gate = null,              // { x1 } mép ngoài PHỄU NẠP (giáp nghiền trục đơn);
                              //   miệng phễu tự ôm theo đúng cung vành bị cắt
    gateHalfSpan = 21.5,      // nửa góc (độ) vành bị cắt = nửa chiều dài phễu nạp
    chute = null,             // {x0,x1,y0,y1} MÁNG XẢ NẰM NGANG -> đầu băng tải xích
    hotArc = 55,              // cung (độ) ngay sau cửa nạp: liệu còn nóng đỏ
}) => {
    const canRedraw = useRedrawGate();          // giãn nhịp dựng lại hình học
    const chunksRef = useRef(null);
    const fansRef = useRef(null);
    const airRef = useRef(null);
    const rot = useRef(0);
    const fanPhase = useRef(0);
    const airPhase = useRef(0);
    const TAU = Math.PI * 2;

    const halfSpan = (gateHalfSpan * Math.PI) / 180;
    const hotSpan = (hotArc * Math.PI) / 180;

    /* Liệu thiêu kết: cục đen đa giác rải KÍN toàn bộ bề rộng máng (từ mép
       trong tới mép ngoài), quay cùng vành. Mỗi cục ghim sẵn chỉ số bảng màu
       (ci) để mỗi khung hình gom cục theo màu -> chỉ vài lệnh tô, giữ FPS. */
    const chunks = useMemo(() => {
        const band = Math.max(4, rOuter - rInner - 14);
        return Array.from({ length: chunkCount }, () => {
            const ci = Math.floor(Math.random() * BLACK_SINTER_COLORS.length);
            return {
                a: Math.random() * TAU,
                r: rInner + 7 + Math.random() * band,
                size: 4 + Math.random() * 4.4,
                shape: makeChunkShape(7),
                spin: Math.random() * Math.PI,
                ci,
                px: 0, py: 0, pa: 0,
            };
        });
    }, [chunkCount, rInner, rOuter]);

    /* Rổ gom cục theo màu (cấp phát 1 lần, mỗi khung chỉ reset độ dài) */
    const buckets = useMemo(() => BLACK_SINTER_COLORS.map(() => []), []);
    const hotBucket = useMemo(() => [], []);

    /* Vị trí dãy quạt: trải ĐỀU trên cung trống fanArc (né hẳn nghiền trục đơn,
       hộp cửa nạp/xả và tuyến băng xả) — không còn quạt nào bị che khuất. */
    const fans = useMemo(() => {
        const rFan = rOuter + fanGap;
        const span = fanArc.end - fanArc.start;
        return Array.from({ length: fanCount }, (_, i) => {
            const deg = fanArc.start + (fanCount > 1 ? (span * i) / (fanCount - 1) : span / 2);
            const a = (deg * Math.PI) / 180;
            const c = Math.cos(a), s = Math.sin(a);
            return { x: cx + c * rFan, y: cy + s * rFan, ux: -c, uy: -s };
        });
    }, [cx, cy, rOuter, fanGap, fanCount, fanArc.start, fanArc.end]);

    /* Vành cố định: 2 đường tròn + NỀN LỚP LIỆU phủ kín + nan chia khoang + trục */
    const drawShell = useCallback((g) => {
        g.clear();
        g.lineStyle(2.5, COLORS.drumOutline);
        g.beginFill(COLORS.steelLight, 0.45);
        g.drawCircle(cx, cy, rOuter);
        g.endFill();
        g.beginFill(COLORS.white, 1);
        g.drawCircle(cx, cy, rInner);
        g.endFill();

        /* Cung liệu: vẽ 1 dải khép kín giữa 2 bán kính, từ mép dưới cửa xả chạy
           hết vòng về mép trên cửa nạp -> máng lúc nào cũng ĐẦY LIỆU. */
        const band = (a0, a1, color, alpha) => {
            g.beginFill(color, alpha);
            g.moveTo(cx + Math.cos(a0) * rInner, cy + Math.sin(a0) * rInner);
            g.lineTo(cx + Math.cos(a0) * rOuter, cy + Math.sin(a0) * rOuter);
            g.arc(cx, cy, rOuter, a0, a1);
            g.lineTo(cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner);
            g.arc(cx, cy, rInner, a1, a0, true);
            g.closePath();
            g.endFill();
        };

        const loadStart = gate ? halfSpan : 0;                 // ngay sau cửa xả
        const loadEnd = gate ? TAU - halfSpan : TAU;           // tới sát cửa nạp
        g.lineStyle(0);
        band(loadStart, loadEnd, COLORS.oreBed, 1);

        /* Vùng liệu CÒN NÓNG ngay sau cửa nạp: 6 nấc đỏ nhạt dần theo chiều
           quay -> đọc được ngay quá trình nguội dần dọc cung máng. */
        const STEPS = 6;
        for (let s = 0; s < STEPS; s++) {
            const t0 = s / STEPS, t1 = (s + 1) / STEPS;
            band(loadEnd - t1 * hotSpan, loadEnd - t0 * hotSpan,
                s < 2 ? COLORS.sinterFire : COLORS.sinterHot, 0.5 * (1 - t0) ** 1.5);
        }

        /* LÒNG MÁNG ĐÃ XẢ TRỐNG: từ lưỡi gạt của máng xả chạy ngược lên tới phễu
           nạp. Liệu bị gạt khỏi máng dọc ĐÚNG thành dưới của máng xả, nên vệt
           cắt là một ĐƯỜNG NẰM NGANG (y = chute.y1) chứ không phải nan quạt —
           khớp với máng xả đặt vuông góc với băng tải xích. */
        if (chute) {
            const yc = chute.y1 - cy;
            const aOut = Math.asin(Math.max(-1, Math.min(1, yc / rOuter)));
            const aIn = Math.asin(Math.max(-1, Math.min(1, yc / rInner)));
            const emptyPath = () => {
                g.moveTo(cx + Math.cos(halfSpan) * rInner, cy + Math.sin(halfSpan) * rInner);
                g.lineTo(cx + Math.cos(halfSpan) * rOuter, cy + Math.sin(halfSpan) * rOuter);
                g.arc(cx, cy, rOuter, halfSpan, aOut);
                g.lineTo(cx + Math.cos(aIn) * rInner, cy + Math.sin(aIn) * rInner);
                g.arc(cx, cy, rInner, aIn, halfSpan, true);
                g.closePath();
            };
            // Tô lại đúng 2 lớp nền của vỏ máng -> xoá sạch lớp liệu ở khúc này
            g.beginFill(COLORS.white, 1); emptyPath(); g.endFill();
            g.beginFill(COLORS.steelLight, 0.45); emptyPath(); g.endFill();
        }

        /* Nan chia khoang vẽ ĐÈ lên nền liệu (vẫn thấy vách ngăn từng khoang) */
        g.lineStyle(1, COLORS.borderGray, 0.4);
        for (let i = 0; i < cellCount; i++) {
            const a = (i / cellCount) * TAU;
            g.moveTo(cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner);
            g.lineTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
        }
        // Nan chống + trục tâm
        g.lineStyle(2, COLORS.borderGray, 0.5);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner);
        }
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.machineBody);
        g.drawCircle(cx, cy, 15);
        g.endFill();

        /* PHỄU NẠP: miệng phễu ÔM ĐÚNG cung vành bị cắt (±gateHalfSpan) — lưng
           phễu chạy theo cung mép trong, miệng loe theo cung mép ngoài, rồi nối
           thẳng sang thân nghiền trục đơn bằng một cổ phễu. Nhờ ăn khớp đúng
           cung cắt nên KHÔNG còn mẩu hộp thừa thò ra ngoài lòng máng. */
        if (gate) {
            const a0 = -halfSpan, a1 = halfSpan;
            const PI = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
            const [ox0, oy0] = PI(rOuter, a0);
            const [ox1, oy1] = PI(rOuter, a1);
            const [ix0, iy0] = PI(rInner, a0);
            /* Cổ phễu cắm vào ĐÚNG mặt nhả liệu của nghiền trục đơn (yTop..yBot).
               Nhờ vậy 2 mép cổ không còn thò lên/thò xuống lệch so với thân trục
               nghiền — miệng phễu vẫn loe rộng theo cung vành, cổ thì thu về khít
               mặt máy nghiền. */
            const yTop = gate.yTop ?? oy0;
            const yBot = gate.yBot ?? oy1;
            const outline = () => {
                g.moveTo(gate.x1, yTop);          // mép cổ TRÊN, khít mặt nghiền
                g.lineTo(ox0, oy0);               // loe ra mép ngoài máng (trên)
                g.lineTo(ix0, iy0);               // vào mép trong máng (trên)
                g.arc(cx, cy, rInner, a0, a1);    // lưng phễu ôm mép trong máng
                g.lineTo(ox1, oy1);               // ra mép ngoài máng (dưới)
                g.lineTo(gate.x1, yBot);          // mép cổ DƯỚI, khít mặt nghiền
                g.closePath();
            };
            g.lineStyle(2.5, COLORS.drumOutline);
            g.beginFill(COLORS.steelLight, 0.95);
            outline();
            g.endFill();
            /* Lòng phễu ám đỏ: quặng vừa ra khỏi trục nghiền vẫn còn nóng */
            g.lineStyle(0);
            g.beginFill(COLORS.sinterFire, 0.26);
            outline();
            g.endFill();
            /* Các LÀN đổ toả đều suốt chiều dài phễu, mũi tên chỉ vào tâm vành
               -> đọc ngay được "quặng trút xuống trên cả đoạn này". */
            const LANES = 6;
            g.lineStyle(1.4, COLORS.machineDark, 0.4);
            for (let i = 1; i < LANES; i++) {
                const a = a0 + ((a1 - a0) * i) / LANES;
                const [sx, sy] = PI(rInner + 4, a);
                const [ex, ey] = PI(rOuter + 6, a);
                g.moveTo(sx, sy);
                g.lineTo(ex, ey);
            }
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.65);
            for (let i = 0; i < LANES; i++) {
                const a = a0 + ((a1 - a0) * (i + 0.5)) / LANES;
                const ca = Math.cos(a), sa = Math.sin(a);
                const [hx, hy] = PI(rInner + 12, a);      // đầu mũi tên: mép trong
                const nx = -sa, ny = ca;
                g.moveTo(hx, hy);
                g.lineTo(hx + ca * 13 + nx * 5.5, hy + sa * 13 + ny * 5.5);
                g.lineTo(hx + ca * 13 - nx * 5.5, hy + sa * 13 - ny * 5.5);
                g.closePath();
            }
            g.endFill();
        }

        /* MÁNG XẢ: nằm NGANG, VUÔNG GÓC với băng tải xích. Thành dưới máng
           (y1) chính là LƯỠI GẠT hớt liệu nguội ra khỏi lòng máng vòng, liệu
           trượt dọc máng sang thẳng đầu băng tải xích bên phải. */
        if (chute) {
            const chh = chute.y1 - chute.y0;
            const chw = chute.x1 - chute.x0;
            g.lineStyle(2.5, COLORS.drumOutline);
            g.beginFill(COLORS.machineBody, 0.95);
            g.drawRect(chute.x0, chute.y0, chw, chh);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.55);
            g.drawRect(chute.x0 + 3, chute.y0 + 3, chw - 6, chh - 6);
            g.endFill();
            /* Mũi tên chỉ chiều liệu chạy RA phía băng tải xích */
            g.beginFill(COLORS.steelLight, 0.8);
            const ym = chute.y0 + chh / 2;
            for (let i = 0; i < 3; i++) {
                const x = chute.x0 + 14 + ((chw - 34) * i) / 3;
                g.moveTo(x, ym - 6);
                g.lineTo(x + 13, ym);
                g.lineTo(x, ym + 6);
                g.closePath();
            }
            g.endFill();
            /* LƯỠI GẠT: vạch đậm dọc thành dưới — đúng đường liệu bị hớt đi */
            g.lineStyle(3, COLORS.machineDark, 0.9);
            g.moveTo(chute.x0, chute.y1);
            g.lineTo(chute.x1, chute.y1);
        }
    }, [cx, cy, rOuter, rInner, cellCount, gate, chute, halfSpan, hotSpan, TAU]);

    useTick((delta) => {
        rot.current += 0.0026 * delta;        // rad/khung — quay NGƯỢC chiều kim đồng hồ
        fanPhase.current += 0.16 * delta;
        airPhase.current = (airPhase.current + 0.012 * delta) % 1;

        // --- Cục liệu đen quay theo vành (gom theo màu rồi tô 1 lượt) ---
        // Góc quay `rot` đã cộng đủ ở trên nên chỉ giãn nhịp VẼ LẠI, tốc độ quay
        // của vành KHÔNG đổi. Đây là lớp nặng nhất: 300 cục x 2 vành.
        const g = chunksRef.current;
        if (g && canRedraw()) {
            g.clear();
            buckets.forEach((b) => { b.length = 0; });
            hotBucket.length = 0;

            chunks.forEach((c) => {
                const a = c.a - rot.current;               // góc giảm dần = ngược kim đồng hồ
                const da = Math.atan2(Math.sin(a), Math.cos(a));
                // Bỏ liệu ngay dưới phễu nạp -> nhìn rõ hộp phễu & dòng quặng đổ
                if (gate && Math.abs(da) < halfSpan) return;
                c.px = cx + Math.cos(a) * c.r;
                c.py = cy + Math.sin(a) * c.r;
                // Đã bị LƯỠI GẠT của máng xả hớt đi -> máng trống tới tận phễu nạp
                if (chute && da > 0 && da < Math.PI / 2 && c.py < chute.y1) return;
                c.pa = c.spin + a;
                // Quãng đã đi kể từ cửa nạp -> cục vừa vào máng thì còn nóng đỏ
                let trav = (-halfSpan - da) % TAU;
                if (trav < 0) trav += TAU;
                if (trav < hotSpan) {
                    c.tint = lerpColor(COLORS.sinterFire, BLACK_SINTER_COLORS[c.ci], trav / hotSpan);
                    hotBucket.push(c);
                } else {
                    buckets[c.ci].push(c);
                }
            });

            g.lineStyle(1.1, 0x000000, 0.5);
            buckets.forEach((arr, i) => {
                if (!arr.length) return;
                g.beginFill(BLACK_SINTER_COLORS[i]);
                arr.forEach((c) => drawChunk(g, c.px, c.py, c.size, c.shape, c.pa));
                g.endFill();
            });
            hotBucket.forEach((c) => {
                g.beginFill(c.tint);
                drawChunk(g, c.px, c.py, c.size, c.shape, c.pa);
                g.endFill();
            });
        }

        // --- Gió mát hút từ ngoài vào, xuyên qua quạt rồi thổi vào lớp liệu ---
        const ga = airRef.current;
        if (ga) {
            ga.clear();
            const depth = fanGap + (rOuter - rInner) * 0.7;
            fans.forEach((f, i) => {
                drawFanAirflow(ga, f, fanRadius, (airPhase.current + i * 0.11) % 1, 34, depth);
            });
        }

        // --- Dãy quạt hướng trục áp sát vỏ máy làm mát ---
        const gf = fansRef.current;
        if (gf) {
            gf.clear();
            fans.forEach((f, i) => {
                drawIndustrialFan(
                    gf, f.x, f.y, fanRadius,
                    fanPhase.current + i * 0.7,        // lệch pha để 9 quạt không quay trùng nhau
                    fanBlades, f.ux, f.uy,
                    fanGap + 4                          // ống thổi vừa chạm vỏ máy
                );
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawShell} />
            <Graphics ref={chunksRef} />
            <Graphics ref={airRef} />
            <Graphics ref={fansRef} />
        </Container>
    );
};

/**
 * BĂNG TẢI XÍCH (chain conveyor) — kết cấu vững hơn băng cao su, dùng cho đoạn
 * đầu nhận liệu thiêu kết nóng từ máy làm mát vòng: khung thép + 2 dây xích 2
 * bên + các THANH GẠT ngang chạy liên tục, mang cục liệu đen.
 * @param {number} x, y, length, angle  Như MainConveyorPlaceHolder.
 * @param {number} beltWidth  Bề rộng băng (mặc định 35 = BELT.height).
 * @param {boolean} reverse   Đảo chiều chạy. false = chạy theo chiều +x cục bộ
 *                            (băng dựng angle=90 -> chạy XUỐNG, tức ĐI RA khỏi
 *                            máy làm mát vòng). true = chạy ngược lại.
 */
export const ChainConveyorSegment = ({ x, y, length, angle = 0, beltWidth = 35, speed = 0.45, reverse = false }) => {
    const barsRef = useRef(null);
    const offset = useRef(0);
    const BAR_GAP = 16;

    const chunks = useMemo(() => Array.from({ length: Math.round(length / 9) }, () => ({
        px: Math.random() * length,
        py: 6 + Math.random() * (beltWidth - 12),
        size: 2.2 + Math.random() * 2,
        shape: makeChunkShape(6),
        color: BLACK_SINTER_COLORS[Math.floor(Math.random() * BLACK_SINTER_COLORS.length)],
    })), [length, beltWidth]);

    const drawFrame = useCallback((g) => {
        g.clear();
        // Khung thép nặng
        g.lineStyle(2.5, COLORS.drumOutline);
        g.beginFill(COLORS.machineBody, 0.95);
        g.drawRect(0, 0, length, beltWidth);
        g.endFill();
        // 2 ray dẫn xích 2 bên
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.9);
        g.drawRect(0, 0, length, 4);
        g.drawRect(0, beltWidth - 4, length, 4);
        g.endFill();
    }, [length, beltWidth]);

    useTick((delta) => {
        const g = barsRef.current;
        if (!g) return;
        const dir = reverse ? -1 : 1;                       // chiều chạy của xích + cục liệu
        offset.current = (offset.current + dir * speed * delta + BAR_GAP) % BAR_GAP;
        g.clear();

        // Thanh gạt ngang + mắt xích 2 bên chạy liên tục
        for (let bx = -BAR_GAP + offset.current; bx < length; bx += BAR_GAP) {
            if (bx < 0 || bx > length - 2) continue;
            g.lineStyle(0);
            g.beginFill(COLORS.steelLight, 0.9);
            g.drawRect(bx, 4, 3, beltWidth - 8);
            g.endFill();
            g.beginFill(COLORS.ductBody, 0.95);
            g.drawCircle(bx + 1.5, 2, 1.8);
            g.drawCircle(bx + 1.5, beltWidth - 2, 1.8);
            g.endFill();
        }

        // Cục liệu thiêu kết đen chạy theo băng
        chunks.forEach((c) => {
            c.px += dir * speed * delta;
            if (c.px > length) c.px -= length;
            if (c.px < 0) c.px += length;
            g.lineStyle(0);
            g.beginFill(c.color, 0.95);
            drawChunk(g, c.px, c.py, c.size, c.shape, 0);
            g.endFill();
        });
    });

    return (
        <Container x={x} y={y} angle={angle}>
            <Graphics draw={drawFrame} />
            <Graphics ref={barsRef} />
        </Container>
    );
};

/**
 * DÒNG QUẶNG ĐỔ (máng chuyển tiếp giữa 2 thiết bị).
 * Các cục quặng liên tục rời điểm `from`, rơi/trượt theo máng sang điểm `to`,
 * xoè nhẹ giữa dòng rồi CHỤM lại đúng miệng nhận, kèm bụi bay và cụm mảnh vụn
 * nảy lên tại điểm va đập. Dùng cho 2 điểm chuyển tiếp:
 *   - Nghiền trục đơn  -> máng máy làm mát vòng (quặng còn NÓNG).
 *   - Máy làm mát vòng -> băng tải xích (quặng đã nguội).
 * @param {object} from  {x, y} miệng xả của thiết bị nguồn.
 * @param {object} to    {x, y} điểm rơi trên thiết bị nhận.
 * @param {number} width Bề rộng máng (độ xoè ngang của dòng).
 * @param {number} count Số cục trong dòng (mật độ).
 * @param {boolean} hot  true = quặng còn đỏ lửa (đổ từ nghiền trục sang làm mát).
 */
export const OrePourStream = ({
    from, to,
    width = 26,
    count = 22,
    colors = BLACK_SINTER_COLORS,
    sizeRange = [3, 7],
    speed = 0.016,
    hot = false,
}) => {
    const gRef = useRef(null);

    /* Trục dòng chảy: u = dọc dòng, p = ngang dòng */
    const axis = useMemo(() => {
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        return { len, ux: dx / len, uy: dy / len, px: -dy / len, py: dx / len };
    }, [from.x, from.y, to.x, to.y]);

    const grains = useMemo(() => Array.from({ length: count }, () => ({
        t: Math.random(),
        off: (Math.random() - 0.5) * width,
        size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
        vt: speed * (0.7 + Math.random() * 0.7),
        spin: Math.random() * Math.PI,
        vs: (Math.random() - 0.5) * 0.12,
        ci: Math.floor(Math.random() * colors.length),
        shape: makeChunkShape(6),
    })), [count, width, speed, colors, sizeRange[0], sizeRange[1]]);

    /* Mảnh vụn + bụi bật lên tại miệng nhận */
    const splash = useMemo(() => Array.from({ length: 14 }, () => ({
        life: 0, x: 0, y: 0, vx: 0, vy: 0, size: 2, shape: makeChunkShape(5),
    })), []);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();
        const { len, ux, uy, px, py } = axis;

        g.lineStyle(1.1, 0x000000, 0.45);
        grains.forEach((p) => {
            p.t += p.vt * delta;
            if (p.t >= 1) {
                // Chạm miệng nhận -> bắn mảnh vụn rồi quay về đầu máng
                let spawned = 0;
                for (const s of splash) {
                    if (s.life <= 0 && spawned < 2) {
                        s.x = to.x + px * p.off * 0.3;
                        s.y = to.y + py * p.off * 0.3;
                        s.vx = (Math.random() - 0.5) * 1.6 - ux * 0.3;
                        s.vy = (Math.random() - 0.5) * 1.6 - uy * 0.9;
                        s.size = 1.6 + Math.random() * 1.8;
                        s.life = 1;
                        spawned++;
                    }
                }
                p.t -= 1;
                p.off = (Math.random() - 0.5) * width;
                p.size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
                p.ci = Math.floor(Math.random() * colors.length);
            }
            p.spin += p.vs * delta;

            // Rơi nhanh dần + dòng chụm lại về phía miệng nhận
            const e = p.t * p.t * 0.45 + p.t * 0.55;
            const spread = 1 - 0.55 * p.t;
            const x = from.x + ux * len * e + px * p.off * spread;
            const y = from.y + uy * len * e + py * p.off * spread;

            const fade = Math.min(1, p.t / 0.12) * Math.min(1, (1 - p.t) / 0.1);
            const color = hot
                ? lerpColor(COLORS.sinterFire, colors[p.ci], Math.min(1, p.t * 1.6))
                : colors[p.ci];
            g.beginFill(color, 0.35 + 0.6 * fade);
            drawChunk(g, x, y, p.size, p.shape, p.spin);
            g.endFill();
        });

        // Mảnh vụn bật lên tại điểm va đập
        g.lineStyle(0);
        splash.forEach((s) => {
            if (s.life <= 0) return;
            s.life -= 0.045 * delta;
            s.x += s.vx * delta;
            s.y += s.vy * delta;
            s.vy += 0.06 * delta;                       // trọng lực kéo mảnh rơi lại
            if (s.life > 0) {
                g.beginFill(hot ? COLORS.sinterHot : COLORS.dustGray, 0.55 * s.life);
                drawChunk(g, s.x, s.y, s.size, s.shape, 0);
                g.endFill();
            }
        });
    });

    return <Graphics ref={gRef} />;
};

/* =============================================================================
 * LÒ CAO (nhìn từ trên xuống) — hộ tiêu thụ cuối cùng của quặng thiêu kết.
 * Bố trí theo mặt bằng lò cao thật, ĐỌC TỪ TRÊN XUỐNG:
 *   - LÒ GIÓ NÓNG : 3 tháp xếp thành HÀNG NGANG ở mép trên sân, mỗi tháp có ống
 *                   gió nóng chạy xuống cắm vào ống gió bao.
 *   - THÂN LÒ     : vòng tròn nhiều lớp (vỏ thép -> lớp lót -> nồi lò), quanh
 *                   thân là ỐNG GIÓ BAO (bustle pipe) + vành MẮT GIÓ (tuyère).
 *   - MÁNG GANG   : rãnh ra gang bên trái, gang lỏng chảy ra thùng (hoạt ảnh).
 *   - PHỄU NHẬN QUẶNG có HAI HƯỚNG NẠP:
 *       binsSide : mép PHẢI sân — nhận 2 băng tải NGANG từ TRẠM TRUNG CHUYỂN S4
 *       binsDown : mép DƯỚI sân — nhận 2 băng tải DỌC từ NHÀ VÒM THÀNH PHẨM
 *   - HỐ ĐỔ QUẶNG : sân đổ cho xe ben chở quặng từ khu máng quặng thành phẩm.
 * Mọi toạ độ chi tiết đều CỤC BỘ trong khung (0..width, 0..height) nên muốn dời
 * cả cụm chỉ cần đổi x/y ở CFG.
 * ===========================================================================*/
export const BlastFurnacePlant = ({
    x, y, width, height,
    shell,                 // { cx, cy, r }
    stoves,                // { cy, cxs: [...], r }  — HÀNG NGANG ở mép trên
    binsSide,              // { cx, cys: [...], r }  — phễu nhận băng NGANG từ S4
    binsDown,              // { cxs: [...], cy, r }  — phễu nhận băng DỌC từ nhà vòm
    tipPit,                // { x, y, width, height }
    ladle,                 // { cx, cy, r }
}) => {
    const hotRef = useRef(null);
    const t = useRef(0);

    /* --- Phần TĨNH: nền sân, lò gió nóng, ống bao, thân lò, máng gang, phễu --- */
    const drawBase = useCallback((g) => {
        const { cx, cy, r } = shell;
        g.clear();

        /* 1) SÂN LÒ CAO — nền bê tông bo góc + viền, đồng bộ với các khu khác.
              LỚP LÓT ĐỤC vẽ trước: nền sân chỉ đục 28% nên đầu 4 băng tải cắm
              vào (2 ngang từ Trạm S4, 2 dọc từ nhà vòm) vẫn lộ xuyên qua. */
        g.lineStyle(0);
        g.beginFill(COLORS.white, 1);
        g.drawRoundedRect(0, 0, width, height, 16);
        g.endFill();
        g.lineStyle(2.5, COLORS.siloBorder, 0.85);
        g.beginFill(COLORS.dustLight, 0.28);
        g.drawRoundedRect(0, 0, width, height, 16);
        g.endFill();
        g.lineStyle(1.5, COLORS.siloBorder, 0.45);
        g.drawRoundedRect(9, 9, width - 18, height - 18, 10);

        /* 2) ỐNG GIÓ NÓNG: từ mỗi lò gió chạy XUỐNG cắm vào ống gió bao */
        stoves.cxs.forEach((sx) => {
            const dx = cx - sx, dy = cy - stoves.cy;
            const len = Math.hypot(dx, dy) || 1;
            const ex = sx + (dx / len) * (len - r - 12);
            const ey = stoves.cy + (dy / len) * (len - r - 12);
            g.lineStyle(11, COLORS.machineDark, 0.55);
            g.moveTo(sx, stoves.cy); g.lineTo(ex, ey);
            g.lineStyle(7, COLORS.ductBody, 1);
            g.moveTo(sx, stoves.cy); g.lineTo(ex, ey);
        });

        /* 3) ỐNG GIÓ BAO (bustle pipe) — vành ống lớn ôm quanh thân lò */
        g.lineStyle(12, COLORS.machineDark, 0.5);
        g.drawCircle(cx, cy, r + 13);
        g.lineStyle(8, COLORS.ductBody, 1);
        g.drawCircle(cx, cy, r + 13);

        /* 4) THÂN LÒ — các lớp từ ngoài vào trong */
        g.lineStyle(3, COLORS.machineDark);
        g.beginFill(COLORS.steelFrame, 1);            // vỏ thép
        g.drawCircle(cx, cy, r);
        g.endFill();
        g.lineStyle(1.5, COLORS.machineDark, 0.55);
        g.beginFill(COLORS.machineBody, 0.95);        // lớp lót chịu lửa
        g.drawCircle(cx, cy, r * 0.80);
        g.endFill();
        g.beginFill(COLORS.linerBlack, 0.92);         // nồi lò (nền cho vệt nóng)
        g.drawCircle(cx, cy, r * 0.52);
        g.endFill();

        /* Gân chịu lực toả tia trên vỏ lò */
        g.lineStyle(1.4, COLORS.machineDark, 0.45);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.2;
            g.moveTo(cx + Math.cos(a) * r * 0.54, cy + Math.sin(a) * r * 0.54);
            g.lineTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98);
        }

        /* MẮT GIÓ (tuyère) — vành vòi phun gió nóng vào nồi lò */
        g.lineStyle(1.2, COLORS.machineDark, 0.9);
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            g.beginFill(COLORS.industrialOrange, 0.95);
            g.drawCircle(cx + Math.cos(a) * r * 0.90, cy + Math.sin(a) * r * 0.90, 3.6);
            g.endFill();
        }

        /* 5) MÁNG GANG + THÙNG CHỨA GANG LỎNG (bên trái thân lò) */
        g.lineStyle(9, COLORS.machineDark, 0.6);
        g.moveTo(cx - r * 0.9, cy); g.lineTo(ladle.cx + ladle.r * 0.6, ladle.cy);
        g.lineStyle(5, COLORS.sinterCool, 1);
        g.moveTo(cx - r * 0.9, cy); g.lineTo(ladle.cx + ladle.r * 0.6, ladle.cy);
        g.lineStyle(2.5, COLORS.machineDark);
        g.beginFill(COLORS.machineBody, 1);
        g.drawCircle(ladle.cx, ladle.cy, ladle.r);
        g.endFill();

        /* 6) LÒ GIÓ NÓNG — 3 tháp tròn xếp HÀNG NGANG ở mép trên sân */
        stoves.cxs.forEach((sx) => {
            g.lineStyle(3, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 1);
            g.drawCircle(sx, stoves.cy, stoves.r);
            g.endFill();
            g.lineStyle(1.4, COLORS.machineDark, 0.6);
            g.drawCircle(sx, stoves.cy, stoves.r * 0.62);
            g.moveTo(sx - stoves.r * 0.62, stoves.cy); g.lineTo(sx + stoves.r * 0.62, stoves.cy);
            g.moveTo(sx, stoves.cy - stoves.r * 0.62); g.lineTo(sx, stoves.cy + stoves.r * 0.62);
        });

        /* 7) BĂNG NẠP LIỆU TRONG SÂN: từ mỗi phễu chạy vào chân thân lò.
              - phễu MÉP PHẢI  : nhận quặng NGANG từ Trạm trung chuyển S4
              - phễu MÉP DƯỚI  : nhận quặng DỌC từ Nhà vòm thành phẩm  */
        const feedLine = (bx, by, tx, ty) => {
            g.lineStyle(10, COLORS.machineDark, 0.45);
            g.moveTo(bx, by); g.lineTo(tx, ty);
            g.lineStyle(6, COLORS.dustGray, 1);
            g.moveTo(bx, by); g.lineTo(tx, ty);
        };
        binsSide.cys.forEach((by) => feedLine(binsSide.cx, by, cx + r * 0.86, cy));
        binsDown.cxs.forEach((bx) => feedLine(bx, binsDown.cy, cx, cy + r * 0.86));

        /* 8) PHỄU NHẬN QUẶNG (vẽ sau nên đè lên đầu băng nạp) */
        const drawBin = (bx, by, br) => {
            g.lineStyle(3, COLORS.siloBorder);
            g.beginFill(COLORS.siloBody, 0.95);
            g.drawCircle(bx, by, br);
            g.endFill();
            g.lineStyle(1.5, COLORS.siloBorder, 0.6);
            g.drawCircle(bx, by, br * 0.6);
        };
        binsSide.cys.forEach((by) => drawBin(binsSide.cx, by, binsSide.r));
        binsDown.cxs.forEach((bx) => drawBin(bx, binsDown.cy, binsDown.r));

        /* 9) HỐ ĐỔ QUẶNG cho xe ben — miệng hố có lưới chắn cục lớn */
        g.lineStyle(2.5, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.machineDark, 0.42);
        g.drawRoundedRect(tipPit.x, tipPit.y, tipPit.width, tipPit.height, 6);
        g.endFill();
        g.lineStyle(1.6, COLORS.dustLight, 0.75);
        for (let gx = tipPit.x + 7; gx < tipPit.x + tipPit.width - 4; gx += 9) {
            g.moveTo(gx, tipPit.y + 5);
            g.lineTo(gx, tipPit.y + tipPit.height - 5);
        }
        /* Ống rót từ hố đổ sang phễu nhận quặng dưới gần nhất */
        const nearest = binsDown.cxs[binsDown.cxs.length - 1];
        g.lineStyle(9, COLORS.machineDark, 0.45);
        g.moveTo(tipPit.x, tipPit.y + tipPit.height / 2);
        g.lineTo(nearest, binsDown.cy);
        g.lineStyle(5, COLORS.dustGray, 1);
        g.moveTo(tipPit.x, tipPit.y + tipPit.height / 2);
        g.lineTo(nearest, binsDown.cy);
    }, [width, height, shell, stoves, binsSide, binsDown, tipPit, ladle]);

    /* Giọt gang lỏng chảy dọc máng gang */
    const drops = useMemo(() => Array.from({ length: 16 }, () => ({
        t: Math.random(), sp: 0.010 + Math.random() * 0.014,
        off: (Math.random() - 0.5) * 5, sz: 1.7 + Math.random() * 2.2,
    })), []);

    /* --- Phần ĐỘNG: nồi lò rực nóng + gang lỏng chảy ra thùng --- */
    useTick((delta) => {
        const g = hotRef.current;
        if (!g) return;
        t.current += 0.045 * delta;

        const { cx, cy, r } = shell;
        const beat = 0.5 + 0.5 * Math.sin(t.current);
        g.clear();
        g.lineStyle(0);

        // Nồi lò: 3 lớp lửa lồng nhau, thở theo nhịp
        g.beginFill(lerpColor(COLORS.sinterFire, COLORS.sinterHot, beat), 0.55 + 0.25 * beat);
        g.drawCircle(cx, cy, r * 0.50);
        g.endFill();
        g.beginFill(lerpColor(COLORS.sinterHot, COLORS.statusWarn, beat), 0.60 + 0.25 * beat);
        g.drawCircle(cx, cy, r * 0.33);
        g.endFill();
        g.beginFill(COLORS.statusWarn, 0.55 + 0.35 * (1 - beat));
        g.drawCircle(cx, cy, r * 0.15);
        g.endFill();

        // 3 lò gió nóng sáng lệch pha nhau
        stoves.cxs.forEach((sx, i) => {
            const b = 0.5 + 0.5 * Math.sin(t.current * 0.7 + i * 2.1);
            g.beginFill(COLORS.sinterHot, 0.20 + 0.40 * b);
            g.drawCircle(sx, stoves.cy, stoves.r * 0.45);
            g.endFill();
        });

        // Gang lỏng chảy từ lỗ ra gang xuống thùng chứa
        const x1 = cx - r * 0.9, y1 = cy;
        const x2 = ladle.cx + ladle.r * 0.6, y2 = ladle.cy;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        drops.forEach((d) => {
            d.t += d.sp * delta;
            if (d.t > 1) { d.t -= 1; d.off = (Math.random() - 0.5) * 5; }
            const px = x1 + dx * d.t + nx * d.off;
            const py = y1 + dy * d.t + ny * d.off;
            g.beginFill(lerpColor(COLORS.statusWarn, COLORS.sinterFire, d.t), 0.9 - d.t * 0.25);
            g.drawCircle(px, py, d.sz);
            g.endFill();
        });
        // Mặt gang trong thùng sôi lăn tăn
        g.beginFill(lerpColor(COLORS.sinterFire, COLORS.statusWarn, beat), 0.85);
        g.drawCircle(ladle.cx, ladle.cy, ladle.r * 0.66);
        g.endFill();
    });

    return (
        <Container x={x} y={y}>
            <Graphics draw={drawBase} />
            <Graphics ref={hotRef} />
        </Container>
    );
};

/* =============================================================================
 * TUYẾN XE BEN CHỞ QUẶNG THIÊU KẾT SANG LÒ CAO
 * Tuyến đường là một ĐƯỜNG GẤP KHÚC (polyline) khai báo bằng danh sách đỉnh:
 *   [ [x0,y0], [x1,y1], ... ]  — điểm ĐẦU là chỗ nhận quặng dưới silo xả,
 *                                điểm CUỐI là hố đổ quặng ở sân lò cao.
 * Tách làm HAI thành phần để xếp lớp cho đúng:
 *   <HaulRoad>   — MẶT ĐƯỜNG, vẽ SỚM nên các băng tải bắc ngang qua vẫn nằm
 *                  trên (giống cầu băng vượt đường trong nhà máy thật).
 *   <HaulTrucks> — ĐOÀN XE, vẽ MUỘN nên luôn nổi trên mọi thứ.
 * Cả hai dùng CHUNG một mảng `points` khai báo trong CFG.
 * ===========================================================================*/

/** Dựng dữ liệu hình học của tuyến: từng đoạn thẳng + hàm tra toạ độ theo
 *  quãng đường s (0 .. tổng chiều dài). */
const buildHaulPath = (points) => {
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        segs.push({ x1, y1, ux: dx / len, uy: dy / len, len, ang: Math.atan2(dy, dx) });
        total += len;
    }
    /** Trả về { x, y, ang } tại quãng đường s. */
    const at = (s) => {
        let d = Math.max(0, Math.min(total, s));
        for (const g of segs) {
            if (d <= g.len) return { x: g.x1 + g.ux * d, y: g.y1 + g.uy * d, ang: g.ang };
            d -= g.len;
        }
        const last = segs[segs.length - 1];
        return { x: last.x1 + last.ux * last.len, y: last.y1 + last.uy * last.len, ang: last.ang };
    };
    return { segs, total, at };
};

/* MẶT ĐƯỜNG VẬN CHUYỂN — nền nhựa + lề + vạch tim đường nét đứt. */
export const HaulRoad = ({ points, width = 40 }) => {
    const path = useMemo(() => buildHaulPath(points), [points]);

    const draw = useCallback((g) => {
        g.clear();
        const trace = () => points.forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)));

        // Lề đường / bó vỉa
        g.lineStyle({ width: width + 7, color: COLORS.machineDark, alpha: 0.42, join: 'round', cap: 'round' });
        trace();
        // Mặt đường
        g.lineStyle({ width, color: COLORS.surfaceLight, alpha: 1, join: 'round', cap: 'round' });
        trace();

        // Vạch tim đường (nét đứt chạy dọc suốt tuyến)
        g.lineStyle(2.4, COLORS.machineDark, 0.42);
        const STEP = 34, DASH = 18;
        for (let s = 12; s < path.total - 12; s += STEP) {
            const a = path.at(s);
            const b = path.at(Math.min(path.total - 4, s + DASH));
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
        }
    }, [points, width, path]);

    return <Graphics draw={draw} />;
};

/* ĐOÀN XE BEN — mỗi xe chạy một chu trình khép kín:
     NHẬN QUẶNG (đứng dưới ống xả, thùng đầy dần + hạt quặng rơi vào thùng)
     -> CHỞ ĐẦY sang lò cao
     -> ĐỔ QUẶNG (thùng vơi dần + quặng trào ra sau đuôi xe, xe quay đầu)
     -> CHẠY RỖNG quay về máng quặng.
   Các xe được rải đều pha nên lúc nào trên tuyến cũng có xe đang chạy. */
export const HaulTrucks = ({
    points,
    count = 5,
    speed = 3.2,
    loadFrames = 200,
    dumpFrames = 160,
}) => {
    const path = useMemo(() => buildHaulPath(points), [points]);
    const nodeRefs = useRef([]);
    const oreRefs = useRef([]);

    /* Trạng thái từng xe — rải đều trên toàn chu trình để không xe nào trùng chỗ */
    const fleet = useMemo(() => {
        const run = path.total / speed;
        const cycle = loadFrames + run + dumpFrames + run;
        return Array.from({ length: count }, (_, i) => {
            let t = (i / count) * cycle;
            const st = { phase: 'load', timer: 0, s: 0, load: 0, rot: 0 };
            if (t < loadFrames) {
                st.phase = 'load'; st.timer = t; st.s = 0; st.load = t / loadFrames;
            } else if ((t -= loadFrames) < run) {
                st.phase = 'haul'; st.s = t * speed; st.load = 1;
            } else if ((t -= run) < dumpFrames) {
                st.phase = 'dump'; st.timer = t; st.s = path.total; st.load = 1 - t / dumpFrames;
            } else {
                t -= dumpFrames;
                st.phase = 'back'; st.s = Math.max(0, path.total - t * speed); st.load = 0;
            }
            const p = path.at(st.s);
            st.rot = (st.phase === 'back' || st.phase === 'dump') ? p.ang + Math.PI : p.ang;
            return st;
        });
    }, [path, count, speed, loadFrames, dumpFrames]);

    /* Hạt quặng dùng lại cho cả lúc nhận và lúc đổ (toạ độ CỤC BỘ của xe) */
    const grains = useMemo(() => Array.from({ length: 12 }, () => ({
        t: Math.random(), sp: 0.028 + Math.random() * 0.04,
        off: (Math.random() - 0.5) * 18, sz: 1.5 + Math.random() * 2.3,
        c: BLACK_SINTER_COLORS[Math.floor(Math.random() * BLACK_SINTER_COLORS.length)],
    })), []);

    /* THÂN XE vẽ MỘT LẦN ở hệ toạ độ cục bộ, mũi xe hướng theo trục +x:
       khung gầm -> thùng ben -> ca-bin -> 6 bánh. */
    const drawBody = useCallback((g) => {
        g.clear();
        g.lineStyle(2, COLORS.machineDark);
        g.beginFill(COLORS.machineBody, 1);                 // khung gầm
        g.drawRoundedRect(-30, -13, 56, 26, 4);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.95);              // 6 bánh
        [-22, -8, 18].forEach((wx) => {
            g.drawCircle(wx, -14, 4.6);
            g.drawCircle(wx, 14, 4.6);
        });
        g.endFill();
        g.lineStyle(2, COLORS.machineDark);
        g.beginFill(COLORS.industrialOrange, 0.98);         // thùng ben
        g.drawRect(-28, -12, 34, 24);
        g.endFill();
        g.beginFill(COLORS.steelLight, 1);                  // ca-bin
        g.drawRect(10, -11, 16, 22);
        g.endFill();
        g.lineStyle(1.2, COLORS.machineDark, 0.7);
        g.moveTo(12, -7); g.lineTo(24, -7);
        g.moveTo(12, 7); g.lineTo(24, 7);
    }, []);

    useTick((delta) => {
        fleet.forEach((st, i) => {
            switch (st.phase) {
                case 'load':
                    st.timer += delta;
                    st.load = Math.min(1, st.timer / loadFrames);
                    if (st.timer >= loadFrames) { st.phase = 'haul'; st.timer = 0; st.load = 1; }
                    break;
                case 'haul':
                    st.s += speed * delta;
                    if (st.s >= path.total) { st.s = path.total; st.phase = 'dump'; st.timer = 0; }
                    break;
                case 'dump':
                    st.timer += delta;
                    st.load = Math.max(0, 1 - st.timer / dumpFrames);
                    if (st.timer >= dumpFrames) { st.phase = 'back'; st.timer = 0; st.load = 0; }
                    break;
                default:
                    st.s -= speed * delta;
                    if (st.s <= 0) { st.s = 0; st.phase = 'load'; st.timer = 0; }
            }

            const p = path.at(st.s);
            const node = nodeRefs.current[i];
            if (node) {
                node.x = p.x;
                node.y = p.y;
                // Quay đầu MƯỢT: bám dần về hướng cần đi thay vì lật tức thì
                const target = (st.phase === 'back' || st.phase === 'dump') ? p.ang + Math.PI : p.ang;
                let d = target - st.rot;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                const step = 0.07 * delta;
                st.rot += Math.max(-step, Math.min(step, d));
                node.rotation = st.rot;
            }

            const g = oreRefs.current[i];
            if (!g) return;
            g.clear();
            g.lineStyle(0);

            // Khối quặng trong thùng: cao dần khi nhận, vơi dần khi đổ
            if (st.load > 0.02) {
                const h = 20 * st.load;
                g.beginFill(COLORS.sinterOre, 0.95);
                g.drawRect(-26, -h / 2, 30, h);
                g.endFill();
                g.beginFill(BLACK_SINTER_COLORS[1], 0.85);
                for (let k = 0; k < 5; k++) {
                    g.drawCircle(-24 + k * 6.5, (k % 2 ? -1 : 1) * h * 0.22, 1.6 + (k % 3) * 0.7);
                }
                g.endFill();
            }

            // Hạt quặng rơi vào thùng (nhận) hoặc trào ra sau đuôi (đổ)
            if (st.phase === 'load' || st.phase === 'dump') {
                const pour = st.phase === 'load';
                grains.forEach((q) => {
                    q.t += q.sp * delta;
                    if (q.t > 1) { q.t -= 1; q.off = (Math.random() - 0.5) * 18; }
                    const gx = pour ? -8 + q.off * 0.5 : -30 - q.t * 20;
                    const gy = pour ? -14 + q.t * 22 : q.off * (0.4 + q.t);
                    g.beginFill(q.c, pour ? 0.95 - q.t * 0.25 : 0.9 - q.t * 0.7);
                    g.drawRect(gx - q.sz, gy - q.sz, q.sz * 2, q.sz * 2);
                    g.endFill();
                });
            }
        });
    });

    return (
        <Container>
            {fleet.map((_, i) => (
                <Container
                    key={`haul-truck-${i}`}
                    ref={(el) => { nodeRefs.current[i] = el; }}
                >
                    <Graphics draw={drawBody} />
                    <Graphics ref={(el) => { oreRefs.current[i] = el; }} />
                </Container>
            ))}
        </Container>
    );
};

/* =============================================================================
 * TRẠM NƯỚC TUẦN HOÀN NHIỆT DƯ (nhìn từ trên xuống)
 * Nhà bơm nước tuần hoàn cho hệ thu hồi nhiệt dư. Bố trí kiểu nhà bơm thật:
 *   - HAI ỐNG GÓP chạy dọc suốt nhà: ống trên = nước NÓNG từ nồi hơi về,
 *     ống dưới = nước NGUỘI cấp trở lại.
 *   - MỘT DÃY BƠM xếp SONG SONG nối hai ống góp; nước qua bơm nào cũng được,
 *     hỏng một bơm vẫn chạy — đúng nguyên tắc đấu song song.
 *   - Bể chứa / bình giãn nở ở cuối nhà.
 * Toạ độ chi tiết đều CỤC BỘ trong khung (0..width, 0..height).
 * ===========================================================================*/
export const WaterRecircStation = ({
    x, y, width, height,
    headers,               // { hotY, coldY, x0, x1 }
    pumps,                 // { count, x0, spacing, cy, bodyR, motorW, motorH }
    tank,                  // { x, y, w, h }
}) => {
    const flowRef = useRef(null);
    const t = useRef(0);

    /* Tâm từng bơm — tính một lần, dùng cho cả vẽ tĩnh lẫn hoạt ảnh */
    const pumpXs = useMemo(
        () => Array.from({ length: pumps.count }, (_, i) => pumps.x0 + i * pumps.spacing),
        [pumps.count, pumps.x0, pumps.spacing]
    );

    const drawBase = useCallback((g) => {
        g.clear();

        /* 1) NHÀ BƠM — nền bo góc + viền trong, đồng bộ với các khu khác */
        g.lineStyle(2.5, COLORS.siloBorder, 0.85);
        g.beginFill(COLORS.dustLight, 0.28);
        g.drawRoundedRect(0, 0, width, height, 16);
        g.endFill();
        g.lineStyle(1.5, COLORS.siloBorder, 0.45);
        g.drawRoundedRect(9, 9, width - 18, height - 18, 10);

        /* 2) HAI ỐNG GÓP chạy suốt nhà (vỏ tối bọc ngoài, lòng ống sáng) */
        [headers.hotY, headers.coldY].forEach((hy) => {
            g.lineStyle(16, COLORS.machineDark, 0.5);
            g.moveTo(headers.x0, hy); g.lineTo(headers.x1, hy);
            g.lineStyle(11, COLORS.ductBody, 1);
            g.moveTo(headers.x0, hy); g.lineTo(headers.x1, hy);
        });

        /* 3) DÃY BƠM ĐẤU SONG SONG giữa hai ống góp */
        pumpXs.forEach((px) => {
            // ống nhánh nối lên/xuống hai ống góp
            g.lineStyle(11, COLORS.machineDark, 0.45);
            g.moveTo(px, headers.hotY); g.lineTo(px, headers.coldY);
            g.lineStyle(7, COLORS.ductBody, 1);
            g.moveTo(px, headers.hotY); g.lineTo(px, headers.coldY);

            // van chặn hai đầu nhánh
            g.lineStyle(1.4, COLORS.machineDark, 0.9);
            [headers.hotY + 16, headers.coldY - 16].forEach((vy) => {
                g.beginFill(COLORS.industrialOrange, 0.95);
                g.drawRect(px - 6, vy - 4, 12, 8);
                g.endFill();
            });

            // thân bơm + động cơ kéo
            g.lineStyle(2.2, COLORS.machineDark);
            g.beginFill(COLORS.machineBody, 1);
            g.drawCircle(px, pumps.cy, pumps.bodyR);
            g.endFill();
            g.lineStyle(1.6, COLORS.machineDark, 0.6);
            g.drawCircle(px, pumps.cy, pumps.bodyR * 0.45);

            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 1);
            g.drawRect(px + pumps.bodyR - 2, pumps.cy - pumps.motorH / 2, pumps.motorW, pumps.motorH);
            g.endFill();
            g.lineStyle(1.2, COLORS.machineDark, 0.5);
            for (let k = 1; k <= 3; k++) {
                const fx = px + pumps.bodyR - 2 + (pumps.motorW * k) / 4;
                g.moveTo(fx, pumps.cy - pumps.motorH / 2 + 3);
                g.lineTo(fx, pumps.cy + pumps.motorH / 2 - 3);
            }
        });

        /* 4) BỂ NƯỚC TUẦN HOÀN cuối nhà, nối vào cả hai ống góp */
        g.lineStyle(2.5, COLORS.siloBorder);
        g.beginFill(COLORS.steelLight, 1);
        g.drawRoundedRect(tank.x, tank.y, tank.w, tank.h, 8);
        g.endFill();
        g.lineStyle(1.4, COLORS.siloBorder, 0.5);
        g.drawRoundedRect(tank.x + 6, tank.y + 6, tank.w - 12, tank.h - 12, 5);
        [headers.hotY, headers.coldY].forEach((hy) => {
            g.lineStyle(9, COLORS.machineDark, 0.45);
            g.moveTo(headers.x1, hy); g.lineTo(tank.x + tank.w / 2, hy);
            g.lineStyle(5, COLORS.ductBody, 1);
            g.moveTo(headers.x1, hy); g.lineTo(tank.x + tank.w / 2, hy);
        });
    }, [width, height, headers, pumps, tank, pumpXs]);

    /* Hạt nước chạy trong hai ống góp — ống nóng chạy một chiều, ống nguội
       chạy NGƯỢC LẠI cho ra dáng vòng tuần hoàn khép kín. */
    const drops = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
        hot: i % 2 === 0,
        t: Math.random(),
        sp: 0.004 + Math.random() * 0.005,
        sz: 2.2 + Math.random() * 1.8,
    })), []);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g) return;
        t.current += 0.09 * delta;
        g.clear();
        g.lineStyle(0);

        // Nước chạy trong ống góp
        drops.forEach((d) => {
            d.t += d.sp * delta;
            if (d.t > 1) d.t -= 1;
            const p = d.hot ? d.t : 1 - d.t;
            const px = headers.x0 + (headers.x1 - headers.x0) * p;
            const py = d.hot ? headers.hotY : headers.coldY;
            g.beginFill(d.hot ? COLORS.sinterHot : COLORS.coolAir, d.hot ? 0.75 : 0.95);
            g.drawCircle(px, py, d.sz);
            g.endFill();
        });

        // Cánh bơm quay + đèn báo chạy
        pumpXs.forEach((px, i) => {
            const a = t.current * (0.8 + i * 0.05);
            g.lineStyle(2.4, COLORS.coolAir, 0.95);
            for (let k = 0; k < 4; k++) {
                const ang = a + (k * Math.PI) / 2;
                g.moveTo(px, pumps.cy);
                g.lineTo(px + Math.cos(ang) * pumps.bodyR * 0.72,
                         pumps.cy + Math.sin(ang) * pumps.bodyR * 0.72);
            }
            g.lineStyle(0);
            const blink = 0.5 + 0.5 * Math.sin(t.current * 1.6 + i);
            g.beginFill(COLORS.statusGood, 0.45 + 0.55 * blink);
            g.drawCircle(px + pumps.bodyR + pumps.motorW - 6, pumps.cy - pumps.motorH / 2 + 5, 2.6);
            g.endFill();
        });

        // Mặt nước trong bể gợn nhẹ
        const wave = 0.5 + 0.5 * Math.sin(t.current * 0.7);
        g.beginFill(COLORS.coolAir, 0.55 + 0.2 * wave);
        g.drawRoundedRect(tank.x + 10, tank.y + 10, tank.w - 20, tank.h - 20, 4);
        g.endFill();
        g.lineStyle(1.6, COLORS.siloBody, 0.5);
        for (let k = 0; k < 3; k++) {
            const wy = tank.y + 24 + k * ((tank.h - 48) / 2) + Math.sin(t.current + k) * 3;
            g.moveTo(tank.x + 16, wy);
            g.lineTo(tank.x + tank.w - 16, wy);
        }
    });

    return (
        <Container x={x} y={y}>
            <Graphics draw={drawBase} />
            <Graphics ref={flowRef} />
        </Container>
    );
};

/* =============================================================================
 * TRẠM PHÁT ĐIỆN NHIỆT DƯ + ĐƯỜNG HƠI (nhìn từ trên xuống)
 * Hơi sinh ra ở nồi hơi nhiệt dư (thu nhiệt từ máy làm mát vòng) theo hai ống
 * hơi MÀU XANH chạy về trạm, đẩy hai tổ tuabin - máy phát.
 * Tách làm hai thành phần để xếp lớp cho đúng:
 *   <SteamLines>   — ĐƯỜNG ỐNG HƠI, vẽ SỚM nên các thiết bị bắc ngang qua
 *                    (ống gió, đường xe ghi...) vẫn nằm trên, đúng kiểu ống hơi
 *                    luồn dưới giàn ống trong nhà máy.
 *   <PowerPlant>   — NHÀ TRẠM, vẽ như các nhà khác.
 * ===========================================================================*/

/* MÀU ĐƯỜNG HƠI — đổi từ xanh sang ĐỎ cho đúng nghĩa "hơi quá nhiệt". Khai một
   chỗ, dùng chung cho cả ống ngoài trời lẫn ống góp trong nhà trạm phát điện. */
const STEAM_CORE = COLORS.statusBad;     // 0xe74c3c — lòng ống
const STEAM_CASING = 0xc0392b;           // đỏ sẫm  — vỏ bảo ôn

/* Hai ống hơi: chạy NGANG từ nồi hơi mỗi dây chuyền ra rồi bẻ DỌC vào trạm. */
export const SteamLines = ({ lines, riserX, joinTopY, joinBottomY, pipeW = 12 }) => {
    const flowRef = useRef(null);
    const t = useRef(0);

    /* Mỗi đường hơi là một đường gấp khúc 3 điểm: (xFrom,y) -> (riserX,y) -> (riserX,yJoin) */
    const paths = useMemo(() => lines.map((ln, i) => {
        const yJoin = i === 0 ? joinTopY : joinBottomY;
        return [[ln.xFrom, ln.y], [riserX, ln.y], [riserX, yJoin]];
    }), [lines, riserX, joinTopY, joinBottomY]);

    const draw = useCallback((g) => {
        g.clear();
        paths.forEach((pts) => {
            const trace = () => pts.forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)));
            // vỏ bảo ôn
            g.lineStyle({ width: pipeW + 6, color: STEAM_CASING, alpha: 0.55, join: 'round', cap: 'round' });
            trace();
            // lòng ống hơi — MÀU ĐỎ (hơi quá nhiệt từ nồi hơi nhiệt dư)
            g.lineStyle({ width: pipeW, color: STEAM_CORE, alpha: 1, join: 'round', cap: 'round' });
            trace();
            // vạch bảo ôn
            g.lineStyle(1.4, STEAM_CASING, 0.5);
            for (let k = 0; k < pts.length - 1; k++) {
                const [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
                const len = Math.hypot(x2 - x1, y2 - y1);
                const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
                for (let s = 24; s < len - 10; s += 46) {
                    const cx = x1 + ux * s, cy = y1 + uy * s;
                    g.moveTo(cx - uy * (pipeW / 2), cy + ux * (pipeW / 2));
                    g.lineTo(cx + uy * (pipeW / 2), cy - ux * (pipeW / 2));
                }
            }
        });
    }, [paths, pipeW]);

    /* Nút hơi chạy dọc đường ống về trạm */
    const puffs = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
        line: i % 2, t: Math.random(), sp: 0.0035 + Math.random() * 0.004, sz: 2.4 + Math.random() * 2.2,
    })), []);

    const lens = useMemo(() => paths.map((pts) => {
        const segs = []; let total = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
            segs.push(l); total += l;
        }
        return { segs, total };
    }), [paths]);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g) return;
        t.current += 0.06 * delta;
        g.clear();
        g.lineStyle(0);
        puffs.forEach((p) => {
            p.t += p.sp * delta;
            if (p.t > 1) p.t -= 1;
            const pts = paths[p.line], { segs, total } = lens[p.line];
            let d = p.t * total;
            let px = pts[0][0], py = pts[0][1];
            for (let i = 0; i < segs.length; i++) {
                if (d <= segs[i]) {
                    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
                    const k = d / segs[i];
                    px = x1 + (x2 - x1) * k; py = y1 + (y2 - y1) * k;
                    break;
                }
                d -= segs[i];
            }
            g.beginFill(COLORS.white, 0.75);
            g.drawCircle(px, py, p.sz);
            g.endFill();
        });
    });

    return (
        <Container>
            <Graphics draw={draw} />
            <Graphics ref={flowRef} />
        </Container>
    );
};

/* NHÀ TRẠM PHÁT ĐIỆN: ống góp hơi dọc mép trái, hai tổ tuabin - máy phát nằm
   ngang, cuối cùng là tủ hoà lưới. */
export const PowerPlant = ({
    x, y, width, height,
    header,                // { x, y0, y1 }
    sets,                  // [{ cy }, ...]
    turbine,               // { x, w, h }
    generator,             // { x, w, h }
    panel,                 // { x, y, w, h }
}) => {
    const spinRef = useRef(null);
    const t = useRef(0);

    const drawBase = useCallback((g) => {
        g.clear();

        /* 1) NHÀ TRẠM */
        g.lineStyle(2.5, COLORS.siloBorder, 0.85);
        g.beginFill(COLORS.dustLight, 0.28);
        g.drawRoundedRect(0, 0, width, height, 16);
        g.endFill();
        g.lineStyle(1.5, COLORS.siloBorder, 0.45);
        g.drawRoundedRect(9, 9, width - 18, height - 18, 10);

        /* 2) ỐNG GÓP HƠI dọc mép trái — nơi hai ống hơi ngoài trời cắm vào */
        g.lineStyle(16, STEAM_CASING, 0.5);
        g.moveTo(header.x, header.y0); g.lineTo(header.x, header.y1);
        g.lineStyle(11, STEAM_CORE, 1);
        g.moveTo(header.x, header.y0); g.lineTo(header.x, header.y1);

        /* 3) HAI TỔ TUABIN - MÁY PHÁT */
        sets.forEach((s) => {
            // ống hơi vào tuabin
            g.lineStyle(9, STEAM_CASING, 0.5);
            g.moveTo(header.x, s.cy); g.lineTo(turbine.x, s.cy);
            g.lineStyle(5, STEAM_CORE, 1);
            g.moveTo(header.x, s.cy); g.lineTo(turbine.x, s.cy);

            // thân tuabin
            g.lineStyle(2.4, COLORS.machineDark);
            g.beginFill(COLORS.machineBody, 1);
            g.drawRoundedRect(turbine.x, s.cy - turbine.h / 2, turbine.w, turbine.h, 7);
            g.endFill();
            g.lineStyle(1.3, COLORS.machineDark, 0.55);
            for (let k = 1; k <= 4; k++) {
                const fx = turbine.x + (turbine.w * k) / 5;
                g.moveTo(fx, s.cy - turbine.h / 2 + 4);
                g.lineTo(fx, s.cy + turbine.h / 2 - 4);
            }

            // khớp nối trục
            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 1);
            g.drawRect(turbine.x + turbine.w, s.cy - 7, generator.x - (turbine.x + turbine.w), 14);
            g.endFill();

            // máy phát
            g.lineStyle(2.4, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 1);
            g.drawRoundedRect(generator.x, s.cy - generator.h / 2, generator.w, generator.h, 7);
            g.endFill();
            g.lineStyle(1.4, COLORS.machineDark, 0.5);
            g.drawCircle(generator.x + generator.w / 2, s.cy, generator.h * 0.32);

            // ống hơi thoát xuống bình ngưng
            g.lineStyle(7, COLORS.machineDark, 0.4);
            g.moveTo(turbine.x + turbine.w / 2, s.cy + turbine.h / 2);
            g.lineTo(turbine.x + turbine.w / 2, s.cy + turbine.h / 2 + 14);
            g.lineStyle(4, COLORS.ductBody, 1);
            g.moveTo(turbine.x + turbine.w / 2, s.cy + turbine.h / 2);
            g.lineTo(turbine.x + turbine.w / 2, s.cy + turbine.h / 2 + 14);
        });

        /* 4) TỦ HOÀ LƯỚI */
        g.lineStyle(2.2, COLORS.siloBorder);
        g.beginFill(COLORS.steelLight, 1);
        g.drawRoundedRect(panel.x, panel.y, panel.w, panel.h, 6);
        g.endFill();
        g.lineStyle(1.3, COLORS.siloBorder, 0.5);
        for (let k = 1; k <= 3; k++) {
            const py = panel.y + (panel.h * k) / 4;
            g.moveTo(panel.x + 5, py); g.lineTo(panel.x + panel.w - 5, py);
        }
        // cáp lực từ hai máy phát sang tủ
        sets.forEach((s) => {
            g.lineStyle(3, COLORS.machineDark, 0.6);
            g.moveTo(generator.x + generator.w, s.cy);
            g.lineTo(panel.x, panel.y + panel.h / 2);
        });
    }, [width, height, header, sets, turbine, generator, panel]);

    useTick((delta) => {
        const g = spinRef.current;
        if (!g) return;
        t.current += 0.12 * delta;
        g.clear();

        sets.forEach((s, i) => {
            // rotor tuabin quay
            const a = t.current * (1 + i * 0.12);
            g.lineStyle(2.2, COLORS.coolAir, 0.9);
            const rc = turbine.x + turbine.w / 2;
            for (let k = 0; k < 6; k++) {
                const ang = a + (k * Math.PI) / 3;
                g.moveTo(rc, s.cy);
                g.lineTo(rc + Math.cos(ang) * turbine.h * 0.38, s.cy + Math.sin(ang) * turbine.h * 0.38);
            }
            // rotor máy phát + quầng sáng phát điện
            const gc = generator.x + generator.w / 2;
            g.lineStyle(2, COLORS.statusWarn, 0.95);
            for (let k = 0; k < 4; k++) {
                const ang = -a * 1.3 + (k * Math.PI) / 2;
                g.moveTo(gc, s.cy);
                g.lineTo(gc + Math.cos(ang) * generator.h * 0.3, s.cy + Math.sin(ang) * generator.h * 0.3);
            }
            const beat = 0.5 + 0.5 * Math.sin(t.current * 0.8 + i * 1.7);
            g.lineStyle(0);
            g.beginFill(COLORS.statusWarn, 0.15 + 0.25 * beat);
            g.drawCircle(gc, s.cy, generator.h * 0.5);
            g.endFill();
        });

        // đèn tủ hoà lưới nhấp nháy
        g.lineStyle(0);
        for (let k = 0; k < 3; k++) {
            const on = 0.5 + 0.5 * Math.sin(t.current * 1.4 + k * 2);
            g.beginFill(k === 2 ? COLORS.statusWarn : COLORS.statusGood, 0.35 + 0.65 * on);
            g.drawCircle(panel.x + 9 + k * 9, panel.y + 8, 2.8);
            g.endFill();
        }
    });

    return (
        <Container x={x} y={y}>
            <Graphics draw={drawBase} />
            <Graphics ref={spinRef} />
        </Container>
    );
};

/* =============================================================================
 * BĂNG CẤP LIỆU VÀO DÃY SILO PHỐI LIỆU (nhìn từ trên xuống)
 * Một băng tải chạy dọc phía TRÊN cả dãy silo, mỗi nhóm vật liệu có ống rót
 * riêng thả xuống đúng cột silo của mình — cùng kiểu với 3 ống tải than sẵn có
 * rót vào silo 15, 16, 17.
 * Đầu trái băng cắm vào Trạm S2, tức chính là tuyến quặng hồi thiêu kết quay
 * lại dãy phối liệu.
 * Vẽ TRƯỚC dãy silo nên các ống rót bị silo che chân, nhìn như rót vào trong.
 * ===========================================================================*/
export const SiloFeedLine = ({
    y, height = 30, xStart, xEnd,
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
               cũng không tốn thêm khung hình nào; phần chạy động chỉ là mấy
               chục hạt ở lớp trên. */
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
        // 2 ray dẫn hướng
        g.lineStyle(1.6, COLORS.machineDark, 0.35);
        g.moveTo(xStart, y + 5); g.lineTo(xEnd, y + 5);
        g.moveTo(xStart, y + height - 5); g.lineTo(xEnd, y + height - 5);
        // con lăn đỡ
        g.lineStyle(1.2, COLORS.machineDark, 0.3);
        for (let rx = xStart + 24; rx < xEnd - 10; rx += 48) {
            g.moveTo(rx, y + 3); g.lineTo(rx, y + height - 3);
        }
    }, [y, height, xStart, xEnd, groups, chuteTopY, chuteBottomY, chuteW]);

    /* Liệu chạy trên băng: mỗi nhóm một dòng hạt, chạy TỪ TRÁI SANG PHẢI rồi
       biến mất ở đúng ống rót của nhóm mình. */
    const grains = useMemo(() => {
        const out = [];
        groups.forEach((grp, gi) => {
            const drop = Math.max(...grp.xs);
            for (let k = 0; k < 14; k++) {
                out.push({
                    gi, drop,
                    t: Math.random(),
                    sp: 0.0022 + Math.random() * 0.0016,
                    off: 3 + Math.random() * 0.0,   // gán lại theo `height` khi vẽ
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

/* =============================================================================
 * ĐƯỜNG ỐNG NƯỚC LÀM MÁT — nối TRẠM PHÁT ĐIỆN NHIỆT DƯ với TRẠM NƯỚC TUẦN HOÀN
 * Hơi sau khi qua tuabin ngưng lại thành nước nóng, chảy xuống trạm nước; bơm
 * ở đó đẩy nước đã làm nguội quay ngược lên. Hai ống chạy song song men theo
 * mép phải bản vẽ, tạo thành vòng tuần hoàn khép kín.
 * Mỗi đường là một ĐƯỜNG GẤP KHÚC khai bằng danh sách đỉnh [[x,y], ...].
 * ===========================================================================*/

/* MÀU ỐNG NƯỚC — XANH LÁ CÂY, đúng màu bút người dùng vẽ trên bản đồ tay.
   Trước đây em hiểu nhầm chữ "xanh" thành xanh dương.
   Ba loại ống giờ phân biệt rõ: gió XÁM, hơi ĐỎ, nước XANH LÁ.
   Khai một chỗ, dùng cho MỌI tuyến nước. */
const WATER_CORE = COLORS.statusGood;    // 0x2ecc71 — lòng ống, xanh lá
const WATER_CASING = 0x1e8449;           // xanh lá sẫm — vỏ ống

export const CoolingWaterLines = ({ paths, pipeW = 11 }) => {
    const flowRef = useRef(null);
    const t = useRef(0);

    const draw = useCallback((g) => {
        g.clear();
        paths.forEach((ln) => {
            const w = ln.pipeW || pipeW;     // mỗi tuyến có thể tự khai bề rộng
            const trace = () => ln.points.forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)));
            g.lineStyle({ width: w + 5, color: WATER_CASING, alpha: 0.55, join: 'round', cap: 'round' });
            trace();
            g.lineStyle({ width: w, color: WATER_CORE, alpha: 1, join: 'round', cap: 'round' });
            trace();
            // vòng đai kẹp ống
            g.lineStyle(1.4, WATER_CASING, 0.5);
            for (let k = 0; k < ln.points.length - 1; k++) {
                const [x1, y1] = ln.points[k], [x2, y2] = ln.points[k + 1];
                const len = Math.hypot(x2 - x1, y2 - y1) || 1;
                const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
                for (let s = 30; s < len - 12; s += 58) {
                    const cx = x1 + ux * s, cy = y1 + uy * s;
                    g.moveTo(cx - uy * (w / 2), cy + ux * (w / 2));
                    g.lineTo(cx + uy * (w / 2), cy - ux * (w / 2));
                }
            }
        });
    }, [paths, pipeW]);

    /* Dựng sẵn dữ liệu độ dài từng đoạn để chạy hạt nước cho mượt */
    const geo = useMemo(() => paths.map((ln) => {
        const segs = []; let total = 0;
        for (let i = 0; i < ln.points.length - 1; i++) {
            const l = Math.hypot(ln.points[i + 1][0] - ln.points[i][0], ln.points[i + 1][1] - ln.points[i][1]);
            segs.push(l); total += l;
        }
        return { segs, total };
    }), [paths]);

    const drops = useMemo(() => {
        const out = [];
        paths.forEach((ln, li) => {
            for (let k = 0; k < 10; k++) {
                out.push({ li, t: Math.random(), sp: 0.0028 + Math.random() * 0.0026, sz: 2.2 + Math.random() * 1.6 });
            }
        });
        return out;
    }, [paths]);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g) return;
        t.current += 0.05 * delta;
        g.clear();
        g.lineStyle(0);
        drops.forEach((d) => {
            d.t += d.sp * delta;
            if (d.t > 1) d.t -= 1;
            const ln = paths[d.li], { segs, total } = geo[d.li];
            // `back: true` -> chạy ngược chiều khai báo (nước nguội bơm trở lên)
            let dist = (ln.back ? 1 - d.t : d.t) * total;
            let px = ln.points[0][0], py = ln.points[0][1];
            for (let i = 0; i < segs.length; i++) {
                if (dist <= segs[i]) {
                    const [x1, y1] = ln.points[i], [x2, y2] = ln.points[i + 1];
                    const k = dist / segs[i];
                    px = x1 + (x2 - x1) * k; py = y1 + (y2 - y1) * k;
                    break;
                }
                dist -= segs[i];
            }
            g.beginFill(ln.hot ? COLORS.sinterHot : COLORS.white, ln.hot ? 0.85 : 0.85);
            g.drawCircle(px, py, d.sz);
            g.endFill();
        });
    });

    return (
        <Container>
            <Graphics draw={draw} />
            <Graphics ref={flowRef} />
        </Container>
    );
};
