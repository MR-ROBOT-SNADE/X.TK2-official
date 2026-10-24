/* =============================================================================
 * js/components/SinteringDiagram/equipment/conveyor.jsx — BĂNG TẢI
 * =============================================================================
 * MainConveyorPlaceHolder: nền băng + dòng hạt liệu chạy, cắt mặt nạ ở góc rẽ
 * (MASK_BUILDERS). Thông số chung của băng ở BELT.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS, randomItem } from './colors.js';

/* =============================================================================
 * CONTAINER 3: BĂNG TẢI (nền + dòng hạt liệu chạy, hỗ trợ cắt mặt nạ ở góc rẽ)
 * ===========================================================================*/
export const BELT = {
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
