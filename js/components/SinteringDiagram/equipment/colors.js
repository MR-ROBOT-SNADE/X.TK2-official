/* =============================================================================
 * js/components/SinteringDiagram/equipment/colors.js — BẢNG MÀU + HÀM PHỤ DÙNG CHUNG
 * =============================================================================
 * COLORS (màu dùng chung, dạng số hex 0xRRGGBB), kiểu chữ nhãn, lerpColor
 * (pha màu), randomItem. Hầu hết các file khác trong thư mục import từ đây.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

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
export const TEXT_STYLE_LABEL = new PIXI.TextStyle({ fontSize: 16, fill: '#2c3e50', fontWeight: 'bold' });
export const TEXT_STYLE_SILO_INDEX = new PIXI.TextStyle({ fontSize: 15, fill: '#2c3e50', fontWeight: 'bold' });

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
export const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
