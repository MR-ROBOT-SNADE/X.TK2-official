import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Graphics, useTick } from '@pixi/react';

/* =============================================================================
 * HỆ THỐNG POP-UP THÔNG TIN HẠNG MỤC
 * -----------------------------------------------------------------------------
 * Rê chuột (hoặc chạm trên di động) vào một hạng mục trên sơ đồ -> hiện bảng
 * thông tin gồm: VIDEO chạy máy, ẢNH cụm thiết bị, MÔ TẢ và THÔNG SỐ CÔNG NGHỆ.
 *
 * ---------------------------------------------------------------------------
 * CÁCH NẠP TÀI NGUYÊN (không phải sửa code, chỉ việc bỏ file vào đúng chỗ)
 * ---------------------------------------------------------------------------
 * Mỗi hạng mục có một mã `id` (xem danh sách HOTSPOT_DEFS bên dưới). Đặt file
 * theo đúng tên là sơ đồ TỰ NHẶT, không cần khai báo gì thêm:
 *
 *   VIDEO :  videos/so-do/<id>.mp4            (ví dụ videos/so-do/nghien-than.mp4)
 *   ẢNH   :  images/so-do/<id>-1.jpg
 *            images/so-do/<id>-2.jpg
 *            images/so-do/<id>-3.jpg
 *   ẢNH BÌA video: lấy luôn <id>-1.jpg
 *
 * Thiếu file nào thì ô đó tự thay bằng khung "chưa có tài nguyên", KHÔNG vỡ
 * giao diện và KHÔNG hiện ảnh lỗi.
 *
 * Muốn dùng video YouTube thay cho file mp4: thêm `youtube: 'MÃ_VIDEO'` vào
 * hạng mục tương ứng trong HOTSPOT_DEFS.
 *
 * THÔNG SỐ CÔNG NGHỆ: sửa trực tiếp mảng `specs` của từng hạng mục bên dưới.
 * Giá trị đang để '—' nghĩa là CHỜ ĐIỀN.
 * ===========================================================================*/

export const MEDIA_BASE = 'images/so-do';
export const VIDEO_BASE = 'images/videos/so-do';

/* Số ảnh MẶC ĐỊNH thử nạp cho mỗi hạng mục: <id>-1.jpg .. <id>-3.jpg
   Hạng mục nào cần NHIỀU ảnh hơn thì khai `imageCount: N` ngay trong hạng mục
   đó ở HOTSPOT_DEFS — ví dụ dãy silo phối liệu để 21 (mỗi silo một ảnh).
   Thiếu ảnh nào thì ô đó tự ẩn, không vỡ giao diện. */
const IMAGE_SLOTS = 3;

const mediaFor = (id, extra = {}) => ({
    video: extra.video ?? `${VIDEO_BASE}/${id}.mp4`,
    youtube: extra.youtube ?? '',
    poster: extra.poster ?? `${MEDIA_BASE}/${id}-1.jpg`,
    images: extra.images
        ?? Array.from({ length: extra.imageCount ?? IMAGE_SLOTS },
                      (_, i) => `${MEDIA_BASE}/${id}-${i + 1}.jpg`),
});

/* Bộ thông số mặc định — hạng mục nào chưa khai riêng thì dùng bộ này. */
const DEFAULT_SPECS = [
    { label: 'Số lượng thiết bị', value: '—' },
    { label: 'Công suất thiết kế', value: '—' },
    { label: 'Công suất động cơ', value: '—' },
    { label: 'Năm đưa vào vận hành', value: '—' },
];

/* =============================================================================
 * 1) DANH MỤC HẠNG MỤC
 * `area(CFG, LAYOUT)` trả về 1 hoặc nhiều hình chữ nhật (hệ toạ độ FEED-LOCAL,
 * y hệt mọi toạ độ trong CFG của pixiStage.jsx) làm VÙNG BẮT CHUỘT.
 * `mirror: true` = hạng mục có ở CẢ HAI dây chuyền -> tự sinh thêm bản dây 2
 * bằng cách lấy gương qua tâm Trạm S1, không phải khai lại.
 * THỨ TỰ trong mảng = thứ tự chồng lớp: khai TRƯỚC thì nằm DƯỚI, nên các vùng
 * to (dải xe ghi, vành làm mát...) phải đứng trước các vùng nhỏ nằm đè lên nó.
 * ===========================================================================*/
export const HOTSPOT_DEFS = [
    /* ---------- Các dải LỚN: khai trước để nằm dưới ---------- */
    {
        id: 'silo-phoi-lieu',
        name: 'Dãy silo phối liệu',
        group: 'Phối liệu',
        /* 21 ô ảnh, mỗi silo một ảnh: silo-phoi-lieu-1.jpg .. -21.jpg
           Bỏ được bao nhiêu ảnh thì hiện bấy nhiêu, thiếu thì ô đó tự ẩn. */
        imageCount: 21,
        summary: 'Hai dãy 21 silo chứa quặng, trợ dung và nhiên liệu. Mỗi silo có cân '
            + 'định lượng riêng, rót theo tỉ lệ phối xuống băng tải chính chạy dưới đáy dãy.',
        area: () => [{ x: 286, y: -170, w: 1458, h: 128 }],
        specs: [
            { label: 'Số silo', value: '21 silo × 2 dãy' },
            { label: 'Dung tích mỗi silo', value: '—' },
            { label: 'Kiểu cân định lượng', value: '—' },
            { label: 'Sai số phối liệu', value: '—' },
        ],
    },
    {
        id: 'xe-ghi-thieu-ket',
        name: 'Máy thiêu kết (xe ghi)',
        group: 'Thiêu kết',
        summary: 'Dải xe ghi chở lớp liệu chạy liên tục qua lò điểm hoả rồi qua vùng '
            + 'hút gió; liệu cháy dần từ mặt xuống đáy tạo thành bánh thiêu kết.',
        area: (CFG) => [{ x: 340, y: CFG.TRACK.yTop, w: 900, h: CFG.TRACK.height }],
        mirror: true,
        specs: [
            { label: 'Diện tích thiêu kết', value: '—' },
            { label: 'Tốc độ xe ghi', value: '—' },
            { label: 'Chiều dày lớp liệu', value: '—' },
            { label: 'Năng suất', value: '—' },
        ],
    },
    {
        id: 'may-lam-mat-vong',
        name: 'Máy làm mát vòng',
        group: 'Làm nguội',
        summary: 'Vành quay mang quặng thiêu kết nóng đi hết một vòng; quạt thổi gió '
            + 'nguội từ dưới lên, gió nóng thu hồi đưa sang nồi hơi nhiệt dư.',
        area: (CFG) => [{
            x: CFG.COOLER.cx - CFG.COOLER.rOuter - 8, y: CFG.COOLER.cy - CFG.COOLER.rOuter - 8,
            w: CFG.COOLER.rOuter * 2 + 16, h: CFG.COOLER.rOuter * 2 + 16,
        }],
        mirror: true,
        specs: [
            { label: 'Đường kính vành', value: '—' },
            { label: 'Số quạt làm mát', value: '9 quạt' },
            { label: 'Nhiệt độ liệu vào / ra', value: '—' },
            { label: 'Tốc độ quay vành', value: '—' },
        ],
    },
    {
        id: 'hop-gio-ong-gio',
        name: 'Hộp gió và ống gió tổng',
        group: 'Hệ khí',
        summary: '42 hộp gió hai bên hông đường xe hút khí cháy xuyên qua lớp liệu, '
            + 'gom về hai ống gió tổng chạy dọc dây chuyền.',
        area: () => [
            { x: 315, y: 100, w: 1305, h: 46 },
            { x: 315, y: 342, w: 1305, h: 46 },
        ],
        mirror: true,
        specs: [
            { label: 'Số hộp gió', value: '21 hộp × 2 bên' },
            { label: 'Áp suất âm', value: '—' },
            { label: 'Lưu lượng gió', value: '—' },
            { label: 'Nhiệt độ khí thải', value: '—' },
        ],
    },
    {
        id: 'tuan-hoan-khi-thai',
        name: 'Hệ tuần hoàn khí thải',
        group: 'Hệ khí',
        summary: 'Thu khí thải còn nhiệt ở hai đầu dây chuyền, hai quạt đẩy dồn về ống '
            + 'góp rồi thổi ngược lên mặt xe ghi — giảm tiêu hao than và giảm phát thải.',
        area: () => [{ x: 280, y: 388, w: 975, h: 62 }],
        mirror: 'shift',      // hệ khí dây 2 là TỊNH TIẾN, không lấy gương
        specs: [
            { label: 'Số quạt tuần hoàn', value: '2 quạt' },
            { label: 'Tỉ lệ khí tuần hoàn', value: '—' },
            { label: 'Số ống xả trên mặt xe', value: '9 ống' },
            { label: 'Công suất động cơ quạt', value: '—' },
        ],
    },

    /* ---------- Các cụm thiết bị cụ thể ---------- */
    {
        id: 'noi-hoi-nhiet-du',
        name: 'Nồi hơi nhiệt dư',
        group: 'Thu hồi nhiệt',
        summary: 'Ba chụp hút trên cung nóng của máy làm mát vòng gom khí nóng về nồi '
            + 'hơi, sinh hơi phát điện — tận dụng nhiệt thải của dây chuyền.',
        area: (CFG) => [{
            x: CFG.BOILER.boiler.x - 8, y: CFG.BOILER.boiler.y - 9,
            w: CFG.BOILER.boiler.w + 16, h: CFG.BOILER.boiler.h + 18,
        }],
        mirror: 'shift',      // hệ khí dây 2 là TỊNH TIẾN, không lấy gương
        specs: [
            { label: 'Công suất', value: '20 MW' },
            { label: 'Số chụp thu nhiệt', value: '3 chụp' },
            { label: 'Áp suất hơi', value: '—' },
            { label: 'Sản lượng hơi', value: '—' },
        ],
    },
    {
        id: 'lo-diem-hoa',
        name: 'Lò điểm hoả',
        group: 'Thiêu kết',
        summary: '35 mỏ đốt chia ba hàng, đốt bằng khí than để mồi cháy lớp mặt liệu '
            + 'trên xe ghi trước khi vào vùng hút gió.',
        area: (CFG) => [CFG.FURNACE.frame].map((f) => ({ x: f.x, y: f.y, w: f.width, h: f.height })),
        mirror: true,
        specs: [
            { label: 'Số mỏ đốt', value: '35 mỏ (11 + 12 + 12)' },
            { label: 'Nhiên liệu', value: 'Khí than' },
            { label: 'Nhiệt độ điểm hoả', value: '—' },
            { label: 'Tiêu hao khí than', value: '—' },
        ],
    },
    {
        id: 'bo-lieu-con-lan',
        name: 'Cụm bố liệu và con lăn',
        group: 'Thiêu kết',
        summary: 'Silo liệu lót rải lớp đáy bảo vệ xe ghi, sau đó trống bố liệu và máy '
            + 'rải con thoi trải đều liệu hỗn hợp; 12 con lăn gạt phẳng mặt liệu.',
        area: () => [{ x: 1400, y: 152, w: 200, h: 176 }],
        mirror: true,
        specs: [
            { label: 'Số con lăn', value: '12 con lăn (3 hàng × 4)' },
            { label: 'Chiều dày lớp lót', value: '—' },
            { label: 'Chiều dày lớp liệu', value: '—' },
            { label: 'Kiểu rải liệu', value: 'Trống bố liệu + máy rải con thoi' },
        ],
    },
    {
        id: 'nghien-truc-don',
        name: 'Máy nghiền trục đơn',
        group: 'Làm nguội',
        summary: 'Đập vỡ bánh thiêu kết vừa ra khỏi cuối đường xe ghi thành cục nhỏ '
            + 'trước khi rót vào máy làm mát vòng.',
        area: (CFG) => [{
            x: CFG.ROLL_CRUSHER.x - CFG.ROLL_CRUSHER.radius - 6,
            y: CFG.ROLL_CRUSHER.y - CFG.ROLL_CRUSHER.height / 2 - 6,
            w: CFG.ROLL_CRUSHER.radius * 2 + 12, h: CFG.ROLL_CRUSHER.height + 12,
        }],
        mirror: true,
        specs: [
            { label: 'Kiểu máy', value: 'Nghiền trục đơn (single-roll)' },
            { label: 'Cỡ hạt sau nghiền', value: '—' },
            { label: 'Công suất động cơ', value: '—' },
            { label: 'Năng suất', value: '—' },
        ],
    },
    {
        id: 'xu-ly-khi-thai',
        name: 'Lọc bụi tĩnh điện và quạt gió chính',
        group: 'Môi trường',
        summary: 'Khí thải cuối đường qua lọc bụi tĩnh điện rồi tới quạt gió chính — '
            + 'nguồn tạo áp suất âm cho toàn bộ hệ hút của dây chuyền.',
        area: (CFG) => CFG.EXHAUST.trains.map((t) => ({
            x: t.espX - CFG.EXHAUST.espW / 2 - 24, y: t.ductY - CFG.EXHAUST.fanR - 12,
            w: (t.fanX + CFG.EXHAUST.fanR) - (t.espX - CFG.EXHAUST.espW / 2) + 44,
            h: CFG.EXHAUST.fanR * 2 + 24,
        })),
        mirror: true,
        specs: [
            { label: 'Số cụm xử lý', value: '2 cụm / dây chuyền' },
            { label: 'Hiệu suất lọc bụi', value: '—' },
            { label: 'Nồng độ bụi sau lọc', value: '—' },
            { label: 'Công suất quạt gió chính', value: '—' },
        ],
    },
    {
        id: 'nghien-than',
        name: 'Nhà nghiền than',
        group: 'Chuẩn bị nhiên liệu',
        summary: 'Hai máy nghiền hai trục nghiền thô, đổ xuống hai máy nghiền bốn trục '
            + 'nghiền tinh; than thành phẩm theo băng tải và ba ống tải đứng rót vào '
            + 'silo phối liệu số 15, 16, 17.',
        area: () => [{ x: 1745, y: -182, w: 150, h: 160 }],
        specs: [
            { label: 'Số máy nghiền', value: '2 máy 2 trục + 2 máy 4 trục' },
            { label: 'Cỡ hạt sau nghiền', value: '—' },
            { label: 'Năng suất', value: '—' },
            { label: 'Công suất động cơ', value: '—' },
        ],
    },
    {
        id: 'may-tron-ngang',
        name: 'Máy trộn số 1 (trộn sơ bộ)',
        group: 'Phối liệu',
        summary: 'Hai lồng trộn nằm ngang ở đầu hai tuyến băng chính, trộn đều hỗn hợp '
            + 'quặng — trợ dung — nhiên liệu vừa được cân định lượng.',
        area: () => [{ x: -506, y: -180, w: 250, h: 152 }],
        specs: [
            { label: 'Số máy', value: '2 máy' },
            { label: 'Kiểu trộn', value: 'Lồng trộn nằm ngang' },
            { label: 'Thời gian trộn', value: '—' },
            { label: 'Công suất động cơ', value: '—' },
        ],
    },
    {
        id: 'may-tron-doc',
        name: 'Máy trộn số 2 (trộn tạo hạt)',
        group: 'Phối liệu',
        summary: 'Hai lồng trộn đặt dọc, vừa trộn vừa phun ẩm tạo hạt để lớp liệu trên '
            + 'xe ghi thoáng khí, cháy đều hơn.',
        area: () => [{ x: -556, y: 390, w: 156, h: 252 }],
        specs: [
            { label: 'Số máy', value: '2 máy' },
            { label: 'Kiểu trộn', value: 'Lồng trộn tạo hạt' },
            { label: 'Độ ẩm liệu sau trộn', value: '—' },
            { label: 'Công suất động cơ', value: '—' },
        ],
    },
    {
        id: 'tram-khu-sat',
        name: 'Trạm khử sắt',
        group: 'Thành phẩm',
        summary: 'Trạm dùng chung cho cả hai dây chuyền: tách mạt sắt và vật lẫn kim '
            + 'loại ra khỏi dòng quặng thiêu kết trước khi vào nhà sàng.',
        area: (CFG) => [CFG.IRON_STATION.frame].map((f) => ({ x: f.x, y: f.y, w: f.width, h: f.height })),
        specs: [
            { label: 'Kiểu thiết bị', value: 'Nam châm điện treo băng' },
            { label: 'Từ lực', value: '—' },
            { label: 'Bề rộng băng', value: '—' },
            { label: 'Công suất động cơ', value: '—' },
        ],
    },
    {
        id: 'nha-sang-thanh-pham',
        name: 'Nhà sàng thành phẩm',
        group: 'Thành phẩm',
        summary: 'Phân cấp quặng thiêu kết theo cỡ hạt: phần dưới 5 mm hồi lưu về Trạm '
            + 'S2 phối lại, phần đạt cỡ đi tiếp ra khu thành phẩm.',
        area: (CFG) => [{ x: CFG.SCREEN_HOUSE.x, y: CFG.SCREEN_HOUSE.y, w: CFG.SCREEN_HOUSE.width, h: CFG.SCREEN_HOUSE.height }],
        specs: [
            { label: 'Số tầng', value: '3 tầng' },
            { label: 'Cỡ lưới sàng', value: '—' },
            { label: 'Tỉ lệ quặng hồi', value: '—' },
            { label: 'Năng suất sàng', value: '—' },
        ],
    },
    {
        id: 'nha-lay-mau',
        name: 'Trạm lấy mẫu thành phẩm',
        group: 'Chất lượng',
        summary: 'Lấy mẫu tự động trên dòng quặng thành phẩm để kiểm tra thành phần hoá '
            + 'học, cỡ hạt và độ kiềm.',
        area: (CFG) => [{ x: CFG.SAMPLE_HOUSE.x, y: CFG.SAMPLE_HOUSE.y, w: CFG.SAMPLE_HOUSE.width, h: CFG.SAMPLE_HOUSE.height }],
        specs: [
            { label: 'Tần suất lấy mẫu', value: '—' },
            { label: 'Chỉ tiêu kiểm tra', value: 'TFe, FeO, độ kiềm, cỡ hạt' },
            { label: 'Khối lượng mẫu', value: '—' },
            { label: 'Kiểu lấy mẫu', value: 'Tự động trên băng' },
        ],
    },
    {
        id: 'mang-quang-thanh-pham',
        name: 'Khu máng quặng thành phẩm',
        group: 'Thành phẩm',
        summary: 'Hai dãy 5 silo máng chứa quặng thiêu kết đạt cỡ, có băng hồi gom '
            + 'quặng ngược về trạm lấy mẫu trước khi đưa sang lò cao.',
        area: (CFG) => [{ x: CFG.TROUGH_AREA.x, y: CFG.TROUGH_AREA.y, w: CFG.TROUGH_AREA.width, h: CFG.TROUGH_AREA.height }],
        specs: [
            { label: 'Số silo máng', value: '10 silo (2 dãy × 5)' },
            { label: 'Dung tích mỗi máng', value: '—' },
            { label: 'Số băng cấp', value: '2 băng + 1 băng hồi' },
            { label: 'Cỡ hạt thành phẩm', value: '—' },
        ],
    },
    {
        id: 'khu-xa-xe-ben',
        name: 'Khu xả xe ben',
        group: 'Vận chuyển',
        summary: 'Hai silo nhận quặng từ cụm máng, ống xả rót thẳng xuống thùng xe ben '
            + 'đang chờ ở làn dưới để chở sang lò cao.',
        area: (CFG) => [
            { x: CFG.TRUCK_AREA.x, y: CFG.TRUCK_AREA.y, w: CFG.TRUCK_AREA.width, h: CFG.TRUCK_AREA.height },
            { x: CFG.TRUCK_LANE.x, y: CFG.TRUCK_LANE.y, w: CFG.TRUCK_LANE.width, h: CFG.TRUCK_LANE.height },
        ],
        specs: [
            { label: 'Số silo xả', value: '2 silo' },
            { label: 'Tải trọng xe ben', value: '—' },
            { label: 'Thời gian nhận đầy tải', value: '—' },
            { label: 'Số xe vận hành', value: '—' },
        ],
    },
    {
        id: 'bai-chua-thanh-pham',
        name: 'Nhà vòm thành phẩm (bãi chứa)',
        group: 'Thành phẩm',
        summary: 'Bãi chứa quặng thiêu kết có hai máy đánh đống — rút liệu quét trên '
            + 'băng gallery, làm kho đệm giữa xưởng thiêu kết và lò cao.',
        area: (CFG) => [{ x: CFG.STOCK_YARD.x - 12, y: CFG.STOCK_YARD.y - 12, w: CFG.STOCK_YARD.width + 24, h: CFG.STOCK_YARD.height + 24 }],
        specs: [
            { label: 'Số máy đánh đống', value: '2 máy' },
            { label: 'Sức chứa bãi', value: '—' },
            { label: 'Năng suất đánh đống', value: '—' },
            { label: 'Năng suất rút liệu', value: '—' },
        ],
    },
    {
        id: 'lo-cao',
        name: 'Lò cao (lò nấu gang)',
        group: 'Hộ tiêu thụ',
        summary: 'Hộ tiêu thụ cuối cùng của quặng thiêu kết. Quặng vào lò theo hai '
            + 'đường: băng tải ngang từ Trạm trung chuyển S4 và băng tải dọc từ nhà vòm '
            + 'thành phẩm; ngoài ra còn nhận thêm bằng xe ben qua hố đổ.',
        area: (CFG) => [{ x: CFG.BLAST_FURNACE.x, y: CFG.BLAST_FURNACE.y, w: CFG.BLAST_FURNACE.width, h: CFG.BLAST_FURNACE.height }],
        specs: [
            { label: 'Dung tích lò', value: '—' },
            { label: 'Số lò gió nóng', value: '3 lò' },
            { label: 'Số mắt gió', value: '—' },
            { label: 'Sản lượng gang', value: '—' },
        ],
    },
    {
        id: 'phat-dien-nhiet-du',
        name: 'Trạm phát điện nhiệt dư',
        group: 'Thu hồi nhiệt',
        summary: 'Hai tổ tuabin — máy phát chạy bằng hơi thu hồi từ nồi hơi nhiệt dư của cả '
            + 'hai dây chuyền. Hơi theo hai đường ống màu xanh lấy nhiệt từ máy làm mát vòng '
            + 'dẫn về ống góp hơi của trạm, qua tuabin rồi phát điện lên tủ hoà lưới.',
        area: (CFG) => [{ x: CFG.POWER_STATION.x, y: CFG.POWER_STATION.y,
                          w: CFG.POWER_STATION.width, h: CFG.POWER_STATION.height }],
        specs: [
            { label: 'Số tổ máy', value: '2 tổ tuabin — máy phát' },
            { label: 'Công suất phát', value: '—' },
            { label: 'Thông số hơi vào', value: '—' },
            { label: 'Sản lượng điện', value: '—' },
        ],
    },
    {
        id: 'nuoc-tuan-hoan-nhiet-du',
        name: 'Trạm nước tuần hoàn nhiệt dư',
        group: 'Thu hồi nhiệt',
        summary: 'Nhà bơm nước tuần hoàn cho hệ thu hồi nhiệt dư. Một dãy bơm đấu SONG SONG '
            + 'giữa hai ống góp — ống trên nhận nước nóng từ nồi hơi về, ống dưới cấp nước '
            + 'nguội trở lại, hỏng một bơm vẫn chạy được. Bể tuần hoàn đặt cuối nhà.',
        area: (CFG) => [{ x: CFG.WATER_STATION.x, y: CFG.WATER_STATION.y,
                          w: CFG.WATER_STATION.width, h: CFG.WATER_STATION.height }],
        specs: [
            { label: 'Số bơm', value: '6 bơm đấu song song' },
            { label: 'Lưu lượng mỗi bơm', value: '—' },
            { label: 'Cột áp', value: '—' },
            { label: 'Công suất động cơ', value: '—' },
        ],
    },
    {
        id: 'tram-s1',
        name: 'Trạm trung chuyển S1',
        group: 'Trung chuyển',
        summary: 'Nhận liệu hỗn hợp từ hai máy trộn dọc và quặng lót từ nhà sàng, rồi '
            + 'phân phối lên silo bố liệu của cả hai dây chuyền thiêu kết.',
        area: (CFG, LAYOUT) => [{ x: LAYOUT.s1Box.x, y: LAYOUT.s1Box.y, w: LAYOUT.s1Box.width, h: LAYOUT.s1Box.height }],
        specs: [
            { label: 'Số tầng', value: '5 tầng' },
            { label: 'Số tuyến băng vào', value: '3 tuyến' },
            { label: 'Số tuyến băng ra', value: '4 tuyến' },
            { label: 'Năng suất trung chuyển', value: '—' },
        ],
    },
    {
        id: 'tram-s2',
        name: 'Trạm trung chuyển S2',
        group: 'Trung chuyển',
        summary: 'Nhận quặng hồi cỡ nhỏ dưới 5 mm từ nhà sàng đưa trở lại đầu tuyến '
            + 'phối liệu.',
        area: (CFG) => [{ x: CFG.S2.x - 850, y: CFG.S2.y + 110, w: CFG.S2.w, h: CFG.S2.h }],
        specs: [
            { label: 'Số tầng', value: '2 tầng' },
            { label: 'Vật liệu trung chuyển', value: 'Quặng hồi < 5 mm' },
            { label: 'Năng suất', value: '—' },
            { label: 'Số tuyến băng', value: '—' },
        ],
    },
    {
        id: 'tram-s3',
        name: 'Trạm trung chuyển S3',
        group: 'Trung chuyển',
        summary: 'Nhận quặng thành phẩm từ trạm lấy mẫu, chia hai hướng: đưa lên Trạm '
            + 'S4 để đi lò cao và đổ ra nhà vòm thành phẩm để dự trữ.',
        area: (CFG) => [{ x: CFG.S3.x, y: CFG.S3.y, w: CFG.S3.width, h: CFG.S3.height }],
        specs: [
            { label: 'Số tầng', value: '2 tầng' },
            { label: 'Số tuyến băng ra', value: '3 tuyến' },
            { label: 'Năng suất', value: '—' },
            { label: 'Kiểu chia dòng', value: '—' },
        ],
    },
    {
        id: 'tram-s4',
        name: 'Trạm trung chuyển S4',
        group: 'Trung chuyển',
        summary: 'Chặng trung chuyển cuối trước lò cao. Nhận hai băng dọc từ Trạm S3 và '
            + 'đẩy quặng ra hai băng ngang chạy thẳng sang phễu nhận của lò cao.',
        area: (CFG) => [{ x: CFG.S4.x, y: CFG.S4.y, w: CFG.S4.width, h: CFG.S4.height }],
        specs: [
            { label: 'Số tầng', value: '3 tầng' },
            { label: 'Số băng vào', value: '2 băng (từ Trạm S3)' },
            { label: 'Số băng ra', value: '2 băng (sang lò cao)' },
            { label: 'Năng suất', value: '—' },
        ],
    },
];

/* =============================================================================
 * 1b) THỨ TỰ THEO CHIỀU ĐI CỦA VẬT LIỆU
 * -----------------------------------------------------------------------------
 * HOTSPOT_DEFS ở trên xếp theo thứ tự CHỒNG LỚP (vùng to trước, vùng nhỏ sau) —
 * đó là yêu cầu kỹ thuật của việc bắt chuột, không phải trình tự công nghệ.
 * Mảng dưới đây xếp lại đúng ĐƯỜNG ĐI CỦA LIỆU, dùng để đánh số 1..24 trong
 * bảng danh mục bên cạnh sơ đồ. Muốn đổi thứ tự thì đảo dòng ở đây là xong.
 *   note : ghi chú nhánh rẽ (quặng hồi, dự trữ, chở bằng xe...) — để trống nếu
 *          nằm trên dòng chính.
 * ===========================================================================*/
export const FLOW_ORDER = [
    { id: 'nghien-than' },
    { id: 'silo-phoi-lieu' },
    { id: 'may-tron-ngang' },
    { id: 'may-tron-doc' },
    { id: 'tram-s1' },
    { id: 'bo-lieu-con-lan' },
    { id: 'lo-diem-hoa' },
    { id: 'xe-ghi-thieu-ket' },
    { id: 'hop-gio-ong-gio', note: 'nhánh khí' },
    { id: 'tuan-hoan-khi-thai', note: 'nhánh khí' },
    { id: 'noi-hoi-nhiet-du', note: 'nhánh khí' },
    { id: 'nuoc-tuan-hoan-nhiet-du', note: 'nhánh nhiệt dư' },
    { id: 'phat-dien-nhiet-du', note: 'nhánh nhiệt dư' },
    { id: 'xu-ly-khi-thai', note: 'nhánh khí' },
    { id: 'nghien-truc-don' },
    { id: 'may-lam-mat-vong' },
    { id: 'tram-khu-sat' },
    { id: 'nha-sang-thanh-pham' },
    { id: 'tram-s2', note: 'nhánh quặng hồi' },
    { id: 'mang-quang-thanh-pham' },
    { id: 'khu-xa-xe-ben', note: 'nhánh xe ben' },
    { id: 'nha-lay-mau' },
    { id: 'tram-s3' },
    { id: 'bai-chua-thanh-pham', note: 'nhánh dự trữ' },
    { id: 'tram-s4' },
    { id: 'lo-cao' },
];

/* =============================================================================
 * 1c) KHUNG MÔ TẢ LUỒNG CÔNG NGHỆ — CHỖ ĐỂ SOẠN NỘI DUNG
 * -----------------------------------------------------------------------------
 * Sửa NGAY TRONG KHỐI NÀY, không phải đụng vào chỗ nào khác. Ba phần đều không
 * bắt buộc, để trống thì phần đó tự ẩn; trống cả ba thì hiện khung chờ soạn.
 *   lead       : một câu mở đầu, in đậm hơn.
 *   paragraphs : các đoạn văn, mỗi phần tử là một đoạn.
 *   bullets    : các gạch đầu dòng.
 * Ví dụ:
 *   lead: 'Liệu đi từ dãy silo phối liệu tới lò cao qua 24 hạng mục.',
 *   paragraphs: ['Đoạn thứ nhất...', 'Đoạn thứ hai...'],
 *   bullets: ['Ý thứ nhất', 'Ý thứ hai'],
 * ===========================================================================*/
/* =============================================================================
 * VIDEO LƯU TRÌNH CÔNG NGHỆ
 * -----------------------------------------------------------------------------
 * Đây CHỈ LÀ CÁI KHUNG PHÁT. Bỏ file video vào đúng đường dẫn dưới đây là tự
 * phát, không phải sửa dòng code nào:
 *     videos/so-do/quy-trinh-3d.mp4      <- video
 *     images/so-do/quy-trinh-3d.jpg      <- ảnh bìa (không bắt buộc)
 * Đổi tên file thì sửa `file`; đổi tiêu đề thì sửa `title`.
 * ===========================================================================*/
export const PROCESS_VIDEO = {
    title: 'Lưu trình công nghệ',
    sub: 'Video mô tả toàn bộ quy trình sản xuất',
    file: 'quy-trinh-3d',
};

export const FLOW_NOTE = {
    title: 'Luồng công nghệ',
    lead: '',
    paragraphs: [],
    bullets: [],
};

/* =============================================================================
 * 2) DỰNG DANH SÁCH VÙNG BẮT CHUỘT
 * Trả về mảng phẳng, mỗi phần tử là MỘT vùng đã có sẵn toạ độ feed-local.
 * Hạng mục `mirror` sinh thêm bản dây chuyền 2 (lấy gương qua tâm Trạm S1).
 * ===========================================================================*/
export const buildHotspots = (CFG, LAYOUT, pivotY, gasShift = 0) => {
    const out = [];
    HOTSPOT_DEFS.forEach((def) => {
        const rects = def.area(CFG, LAYOUT);
        const base = {
            id: def.id,
            name: def.name,
            group: def.group,
            summary: def.summary,
            specs: def.specs ?? DEFAULT_SPECS,
            media: mediaFor(def.id, def),
        };
        if (!def.mirror) {
            out.push({ ...base, key: def.id, line: '', rects });
            return;
        }
        out.push({ ...base, key: `${def.id}--l1`, line: 'Dây chuyền 1', rects });
        /* mirror: true    -> lấy gương qua tâm Trạm S1 (phần lớn thiết bị)
           mirror:'shift'  -> chỉ TỊNH TIẾN xuống (hệ khí: nồi hơi, tuần hoàn khí
                              thải — bị lật hai lần nên rốt cuộc không lật) */
        const l2 = def.mirror === 'shift'
            ? rects.map((r) => ({ ...r, y: r.y + gasShift }))
            : rects.map((r) => ({ ...r, y: pivotY * 2 - (r.y + r.h) }));
        out.push({ ...base, key: `${def.id}--l2`, line: 'Dây chuyền 2', rects: l2 });
    });
    return out;
};

/* =============================================================================
 * 3) TÔ SÁNG HẠNG MỤC + BẮT CHUỘT
 * Vùng đang trỏ tới được tô sáng bằng một khung vàng nhấp nháy nhẹ (vẽ bằng
 * Pixi), còn việc BẮT CHUỘT làm thẳng trên thẻ canvas của trình duyệt — lý do
 * xem lời giải thích ngay dưới phần vẽ.
 * ===========================================================================*/
const HL_COLOR = 0xf39c12;

const HotspotHighlight = ({ rects }) => {
    const gRef = useRef(null);
    const t = useRef(0);

    const draw = useCallback((g) => {
        g.clear();
        if (!rects || !rects.length) return;
        rects.forEach((r) => {
            const x = r.x - 7, y = r.y - 7, w = r.w + 14, h = r.h + 14;
            g.lineStyle(3, HL_COLOR, 0.95);
            g.beginFill(HL_COLOR, 0.10);
            g.drawRoundedRect(x, y, w, h, 12);
            g.endFill();
            // 4 ke góc cho ra dáng khung ngắm bản vẽ kỹ thuật
            const k = Math.min(26, w / 3, h / 3);
            g.lineStyle(6, HL_COLOR, 1);
            [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]
                .forEach(([cx, cy, sx, sy]) => {
                    g.moveTo(cx + sx * k, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * k);
                });
        });
    }, [rects]);

    useTick((delta) => {
        t.current += 0.11 * delta;
        const g = gRef.current;
        if (g) g.alpha = 0.72 + 0.28 * Math.sin(t.current);
    });

    return <Graphics ref={gRef} draw={draw} />;
};

/* -----------------------------------------------------------------------------
 * BẮT CHUỘT: LÀM THẲNG TRÊN THẺ CANVAS, KHÔNG DÙNG HỆ SỰ KIỆN CỦA PIXI
 * -----------------------------------------------------------------------------
 * Vì sao không dùng eventMode/hitArea của Pixi?
 *   Dự án có HAI bản PixiJS song song: @pixi/react tạo đối tượng từ
 *   @pixi/display 7.4.3 (bản hoisted), còn pixi.js là 7.3.3 với @pixi/display
 *   lồng bên trong. Mixin FederatedEventTarget (thứ gắn eventMode, hitArea,
 *   isInteractive...) chỉ được áp vào bản 7.3.3. Kết quả: mọi Container do
 *   @pixi/react dựng ra KHÔNG có hệ sự kiện — đặt eventMode/hitArea lên chúng
 *   là vô nghĩa, và EventBoundary gọi isInteractive() sẽ nổ lỗi.
 *
 * Cách làm ở đây: nghe pointermove/click ngay trên thẻ <canvas> của trình duyệt,
 * rồi tự đổi toạ độ chuột về hệ FEED-LOCAL bằng đúng phép biến đổi của camera.
 * Toàn bộ là phép nhân chia đơn giản, không phụ thuộc phiên bản Pixi nào cả.
 *
 *   chuột (CSS px)  --(tỉ lệ khung/canvas)-->  toạ độ canvas
 *   toạ độ canvas   --(trừ camera, chia zoom)-->  toạ độ camera
 *   toạ độ camera   --(trừ gốc cụm nạp liệu)-->  FEED-LOCAL  = hệ của CFG
 * --------------------------------------------------------------------------- */

/** Tìm hạng mục nằm dưới một điểm FEED-LOCAL.
 *  Duyệt NGƯỢC danh sách: hạng mục khai SAU nằm TRÊN, đúng quy ước đã ghi ở
 *  HOTSPOT_DEFS (vùng to khai trước, vùng nhỏ khai sau). */
export const findHotspotAt = (items, fx, fy) => {
    for (let i = items.length - 1; i >= 0; i--) {
        const rects = items[i].rects;
        for (let k = 0; k < rects.length; k++) {
            const r = rects[k];
            if (fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h) return items[i];
        }
    }
    return null;
};

/** Đổi toạ độ chuột của trình duyệt sang FEED-LOCAL. */
export const clientToFeed = (clientX, clientY, canvasRect, stage, camera, feed) => {
    if (!canvasRect.width || !canvasRect.height) return null;
    const cx = (clientX - canvasRect.left) * (stage.width / canvasRect.width);
    const cy = (clientY - canvasRect.top) * (stage.height / canvasRect.height);
    return {
        x: (cx - camera.x) / camera.zoom - feed.x,
        y: (cy - camera.y) / camera.zoom - feed.y,
    };
};

/** Gắn bộ nghe chuột lên thẻ canvas và bắn ra onEnter/onLeave/onPick. */
export const useHotspotPointer = ({ hostRef, items, stage, camera, feed, onEnter, onLeave, onPick }) => {
    /* Giữ các hàm callback trong ref để không phải gắn lại listener mỗi lần
       React vẽ lại — gắn/gỡ liên tục dễ làm rơi sự kiện. */
    const cb = useRef({ onEnter, onLeave, onPick });
    cb.current = { onEnter, onLeave, onPick };

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return undefined;

        let canvas = null;
        let hovering = null;
        let raf = 0;
        let stopped = false;

        const move = (e) => {
            const rect = canvas.getBoundingClientRect();
            const f = clientToFeed(e.clientX, e.clientY, rect, stage, camera, feed);
            const hit = f ? findHotspotAt(items, f.x, f.y) : null;
            canvas.style.cursor = hit ? 'pointer' : '';
            if (hit === hovering) return;
            if (hovering) cb.current.onLeave(hovering);
            hovering = hit;
            if (hit) cb.current.onEnter(hit);
        };

        const leave = () => {
            canvas.style.cursor = '';
            if (hovering) { cb.current.onLeave(hovering); hovering = null; }
        };

        const click = (e) => {
            const rect = canvas.getBoundingClientRect();
            const f = clientToFeed(e.clientX, e.clientY, rect, stage, camera, feed);
            const hit = f ? findHotspotAt(items, f.x, f.y) : null;
            if (hit) cb.current.onPick(hit);
        };

        /* Thẻ canvas do Pixi tạo ra sau khi React gắn xong, nên chờ nó xuất hiện. */
        const attach = () => {
            if (stopped) return;
            canvas = host.querySelector('canvas');
            if (!canvas) { raf = requestAnimationFrame(attach); return; }
            canvas.style.pointerEvents = 'auto';       // chắc chắn không bị CSS khoá
            canvas.addEventListener('pointermove', move);
            canvas.addEventListener('pointerleave', leave);
            canvas.addEventListener('click', click);
        };
        attach();

        return () => {
            stopped = true;
            cancelAnimationFrame(raf);
            if (!canvas) return;
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerleave', leave);
            canvas.removeEventListener('click', click);
        };
    }, [hostRef, items, stage, camera, feed]);
};

/* Lớp vẽ khung tô sáng (chỉ VẼ, không bắt sự kiện).
   Nhận THẲNG danh sách hình chữ nhật để một lần tô có thể sáng NHIỀU vùng —
   cần thiết khi rê chuột vào một dòng trong bảng danh mục: thiết bị có ở cả hai
   dây chuyền thì phải sáng cả hai chỗ. */
export const HotspotLayer = ({ rects }) => <HotspotHighlight rects={rects} />;

/* =============================================================================
 * 4) BẢNG THÔNG TIN (HTML thường, KHÔNG phải Pixi)
 * Đặt chồng lên canvas nên video/ảnh dùng thẳng thẻ <video>/<img> của trình
 * duyệt — mượt và nhẹ hơn nhiều so với vẽ vào canvas.
 * ===========================================================================*/

/* Ảnh tự ẩn nếu file chưa được nạp (404) -> không bao giờ lộ icon ảnh vỡ. */
const SafeImage = ({ src, alt, onFail }) => {
    const [dead, setDead] = useState(false);
    useEffect(() => setDead(false), [src]);
    if (dead) return null;
    return (
        <img
            className="sd-pop__thumb" src={src} alt={alt} loading="lazy"
            onError={() => { setDead(true); onFail?.(src); }}
        />
    );
};

const MediaBlock = ({ item }) => {
    const { media } = item;
    const [videoDead, setVideoDead] = useState(false);
    const [deadImages, setDeadImages] = useState([]);

    useEffect(() => { setVideoDead(false); setDeadImages([]); }, [item.key]);

    const liveImages = media.images.filter((s) => !deadImages.includes(s));
    const markDead = useCallback((src) => setDeadImages((d) => (d.includes(src) ? d : [...d, src])), []);

    if (media.youtube) {
        return (
            <div className="sd-pop__video">
                <iframe
                    src={`https://www.youtube.com/embed/${media.youtube}?rel=0`}
                    title={item.name} frameBorder="0" allowFullScreen
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                />
            </div>
        );
    }

    return (
        <>
            <div className="sd-pop__video">
                {videoDead ? (
                    <div className="sd-pop__empty">
                        <span className="sd-pop__empty-ico">▶</span>
                        <span>Chưa có video chạy máy</span>
                        <code>{media.video}</code>
                    </div>
                ) : (
                    <video
                        key={item.key}
                        src={media.video}
                        poster={media.poster}
                        controls autoPlay muted loop playsInline preload="metadata"
                        onError={() => setVideoDead(true)}
                    />
                )}
            </div>

            {liveImages.length > 0 ? (
                <>
                    <div className={`sd-pop__gallery${liveImages.length > 3 ? ' is-many' : ''}`}>
                        {liveImages.map((src) => (
                            <SafeImage key={src} src={src} alt={item.name} onFail={markDead} />
                        ))}
                    </div>
                    {liveImages.length > 3 && (
                        <p className="sd-pop__count">{liveImages.length} ảnh</p>
                    )}
                </>
            ) : (
                <div className="sd-pop__empty sd-pop__empty--thin">
                    <span>Chưa có ảnh cụm thiết bị</span>
                    <code>{`${MEDIA_BASE}/${item.id}-1.jpg`}</code>
                </div>
            )}
        </>
    );
};

export const HotspotPopup = ({ item, rect, hostRef, stage, pinned, onHold, onRelease, onClose }) => {
    const popRef = useRef(null);
    const [pos, setPos] = useState(null);

    /* Đặt bảng cạnh hạng mục, tự lật sang bên còn trống và luôn nằm gọn trong
       khung sơ đồ (đo kích thước thật của bảng rồi mới chốt vị trí). */
    const place = useCallback(() => {
        const host = hostRef.current;
        const pop = popRef.current;
        if (!host || !pop || !rect) return;

        const hb = host.getBoundingClientRect();
        if (!hb.width || !hb.height) return;
        const sx = hb.width / stage.width;
        const sy = hb.height / stage.height;
        const pw = pop.offsetWidth;
        const ph = pop.offsetHeight;
        const M = 10;

        const rx = rect.x * sx, ry = rect.y * sy;
        const rw = rect.w * sx, rh = rect.h * sy;

        let left = (hb.width - (rx + rw)) >= pw + 2 * M ? rx + rw + M : rx - pw - M;
        if (left < M) left = M;
        if (left + pw > hb.width - M) left = Math.max(M, hb.width - pw - M);

        let top = ry + rh / 2 - ph / 2;
        if (top < M) top = M;
        if (top + ph > hb.height - M) top = Math.max(M, hb.height - ph - M);

        setPos({ left, top });
    }, [hostRef, rect, stage.width, stage.height]);

    useLayoutEffect(() => { setPos(null); }, [item.key]);
    useLayoutEffect(() => {
        place();
        const id = requestAnimationFrame(place);           // chốt lại sau khi ảnh/video chiếm chỗ
        window.addEventListener('resize', place);
        return () => { cancelAnimationFrame(id); window.removeEventListener('resize', place); };
    }, [place, item.key]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            ref={popRef}
            className={`sd-pop${pinned ? ' is-pinned' : ''}`}
            style={{
                /* 3 thuộc tính SỐNG CÒN đặt inline, không phụ thuộc diagram.css:
                   nếu file CSS chưa kịp cập nhật thì bảng vẫn nổi đúng chỗ và
                   vẫn bấm được (chỉ là chưa có màu mè). Phần thẩm mỹ do CSS lo. */
                position: 'absolute',
                zIndex: 30,
                pointerEvents: 'auto',
                ...(pos ? { left: `${pos.left}px`, top: `${pos.top}px`, visibility: 'visible' }
                        : { left: 0, top: 0, visibility: 'hidden' }),
            }}
            onMouseEnter={onHold}
            onMouseLeave={onRelease}
        >
            <div className="sd-pop__head">
                <div className="sd-pop__titles">
                    <span className="sd-pop__group">{item.group}</span>
                    <h4 className="sd-pop__name">{item.name}</h4>
                    {item.line && <span className="sd-pop__line">{item.line}</span>}
                </div>
                <button type="button" className="sd-pop__close" onClick={onClose} aria-label="Đóng">×</button>
            </div>

            <div className="sd-pop__body">
                <MediaBlock item={item} />

                <p className="sd-pop__desc">{item.summary}</p>

                <div className="sd-pop__specs">
                    <div className="sd-pop__specs-title">Thông số công nghệ</div>
                    <table>
                        <tbody>
                            {item.specs.map((s) => (
                                <tr key={s.label}>
                                    <th>{s.label}</th>
                                    <td>{s.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="sd-pop__foot">
                {pinned ? 'Đang ghim — bấm × hoặc phím Esc để đóng'
                        : 'Bấm vào hạng mục để ghim bảng lại'}
            </div>
        </div>
    );
};


/* =============================================================================
 * 5) BẢNG BÊN CẠNH SƠ ĐỒ
 * Gồm 2 phần: khung mô tả luồng công nghệ (nội dung do người dùng soạn) và bảng
 * danh mục hạng mục đánh số theo chiều đi của vật liệu.
 * ===========================================================================*/

/** Ghép FLOW_ORDER với dữ liệu hạng mục -> các dòng của bảng danh mục. */
export const buildFlowRows = (items) => FLOW_ORDER.map((f, i) => {
    const matched = items.filter((h) => h.id === f.id);
    const first = matched[0];
    return {
        no: i + 1,
        id: f.id,
        note: f.note || '',
        name: first ? first.name : f.id,
        group: first ? first.group : '',
        both: matched.length > 1,          // có ở cả 2 dây chuyền
        rects: matched.flatMap((h) => h.rects),
        key: first ? first.key : f.id,
    };
});

const FlowNote = () => {
    const { title, lead, paragraphs, bullets } = FLOW_NOTE;
    const empty = !lead && !(paragraphs && paragraphs.length) && !(bullets && bullets.length);
    return (
        <section className="sd-card">
            <h3 className="sd-card__title">{title}</h3>
            {empty ? (
                <div className="sd-card__empty">
                    <span>Chưa có nội dung</span>
                    <code>soạn tại FLOW_NOTE trong diagramHotspots.jsx</code>
                </div>
            ) : (
                <div className="sd-flow">
                    {lead && <p className="sd-flow__lead">{lead}</p>}
                    {(paragraphs || []).map((t, i) => <p key={`p${i}`} className="sd-flow__p">{t}</p>)}
                    {(bullets || []).length > 0 && (
                        <ul className="sd-flow__ul">
                            {bullets.map((t, i) => <li key={`b${i}`}>{t}</li>)}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
};

/* KHUNG PHÁT VIDEO LƯU TRÌNH CÔNG NGHỆ.
   Là một dải RIÊNG chạy hết bề ngang, đặt DƯỚI cả bảng danh mục lẫn sơ đồ
   (xem <div className="sd-root"> trong pixiStage.jsx).
   Chưa có file thì hiện khung chờ có nút play, kèm đúng đường dẫn cần bỏ vào. */
export const ProcessVideo = () => {
    const [dead, setDead] = useState(false);
    const src = `${VIDEO_BASE}/${PROCESS_VIDEO.file}.mp4`;
    const poster = `${MEDIA_BASE}/${PROCESS_VIDEO.file}.jpg`;

    return (
        <section className="sd-card sd-player">
            {/* Đầu thẻ dựng GIỐNG HỆT bảng danh mục hạng mục */}
            <h3 className="sd-card__title">
                {PROCESS_VIDEO.title}
                <span className="sd-card__sub">{PROCESS_VIDEO.sub}</span>
            </h3>

            <div className="sd-vid">
                {dead ? (
                    <div className="sd-vid__empty">
                        <span className="sd-vid__play" aria-hidden="true">▶</span>
                        <span className="sd-vid__msg">Chưa nạp video</span>
                        <code className="sd-vid__path">{src}</code>
                    </div>
                ) : (
                    <video
                        src={src} poster={poster}
                        controls muted loop playsInline preload="metadata"
                        onError={() => setDead(true)}
                    />
                )}
            </div>
        </section>
    );
};

export const DiagramSidePanel = ({ rows, activeId, onHoverRow, onLeaveRow, onPickRow }) => (
    <aside className="sd-side">
        {/* DANH MỤC lên TRÊN, khung mô tả luồng xuống DƯỚI — danh mục là thứ dùng
            nhiều nhất nên cho lên đầu; khung mô tả chỉ đọc một lần. */}
        <section className="sd-card sd-card--grow">
            <h3 className="sd-card__title">
                Danh mục hạng mục
                <span className="sd-card__sub">{rows.length} hạng mục — theo chiều đi của vật liệu</span>
            </h3>

            <ol className="sd-items">
                {rows.map((r) => (
                    <li
                        key={r.id}
                        className={`sd-items__row${activeId === r.id ? ' is-active' : ''}`}
                        onMouseEnter={() => onHoverRow(r)}
                        onMouseLeave={onLeaveRow}
                        onClick={() => onPickRow(r)}
                    >
                        <span className="sd-items__no">{r.no}</span>
                        <span className="sd-items__body">
                            <span className="sd-items__name">{r.name}</span>
                            <span className="sd-items__meta">
                                {r.group}
                                {r.both && <b className="sd-items__tag">2 dây chuyền</b>}
                                {r.note && <b className="sd-items__tag sd-items__tag--branch">{r.note}</b>}
                            </span>
                        </span>
                    </li>
                ))}
            </ol>

            <p className="sd-items__hint">Rê chuột để tô sáng trên sơ đồ — bấm để mở bảng thông tin.</p>
        </section>

        <FlowNote />
    </aside>
);
