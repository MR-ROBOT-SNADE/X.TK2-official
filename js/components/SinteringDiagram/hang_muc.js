/* =============================================================================
 * js/components/SinteringDiagram/hang_muc.js — DANH MỤC HẠNG MỤC CỦA SƠ ĐỒ CÔNG NGHỆ
 * =============================================================================
 * CHỖ SOẠN NỘI DUNG pop-up: tên, mô tả, thông số, ảnh / video của từng hạng mục.
 * Sửa chữ / thông số ở đây, không cần đụng phần giao diện (diagramHotspots.jsx).
 * Trước 24/10/2026 phần này nằm ở đầu diagramHotspots.jsx.
 *   1)  HOTSPOT_DEFS       danh mục hạng mục: tên, mô tả, thông số, vùng trên sơ đồ
 *   1b) FLOW_ORDER         thứ tự hạng mục theo chiều đi của vật liệu (đánh số 1..24)
 *   1c) FLOW_NOTE, PROCESS_VIDEO  khung mô tả luồng + video lưu trình
 *   2)  buildHotspots      dựng danh sách vùng bắt chuột (kể cả bản dây chuyền 2) —
 *                          lap_rap/vung_bat_chuot.js gọi
 * ===========================================================================*/

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
 *   VIDEO :  images/videos/so-do/<id>.mp4     (ví dụ images/videos/so-do/nghien-than.mp4)
 *            (phải nằm trong images/: khi build chỉ thư mục images/ được chép ra)
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

/* Thư mục gốc của ảnh và video hạng mục (đường dẫn tương đối từ trang) */
export const MEDIA_BASE = 'images/so-do';
export const VIDEO_BASE = 'images/videos/so-do';

/* Số ảnh MẶC ĐỊNH thử nạp cho mỗi hạng mục: <id>-1.jpg .. <id>-3.jpg
   Hạng mục nào cần NHIỀU ảnh hơn thì khai `imageCount: N` ngay trong hạng mục
   đó ở HOTSPOT_DEFS — ví dụ dãy silo phối liệu để 21 (mỗi silo một ảnh).
   Thiếu ảnh nào thì ô đó tự ẩn, không vỡ giao diện. */
const IMAGE_SLOTS = 3;

/* Đường dẫn tài nguyên của một hạng mục theo quy ước tên file ở đầu file:
   { video, youtube, poster, images: [...] }. Hạng mục có khai riêng (video,
   youtube, poster, images, imageCount) thì lấy theo khai riêng. */
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
 * y hệt mọi toạ độ trong CFG của cau_hinh.js) làm VÙNG BẮT CHUỘT.
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
 * VIDEO LƯU TRÌNH CÔNG NGHỆ
 * -----------------------------------------------------------------------------
 * Đây CHỈ LÀ CÁI KHUNG PHÁT. Bỏ file video vào đúng đường dẫn dưới đây là tự
 * phát, không phải sửa dòng code nào:
 *     images/videos/so-do/quy-trinh-3d.mp4   <- video
 *     images/so-do/quy-trinh-3d.jpg          <- ảnh bìa (không bắt buộc)
 * Đổi tên file thì sửa `file`; đổi tiêu đề thì sửa `title`.
 * ===========================================================================*/
export const PROCESS_VIDEO = {
    title: 'Lưu trình công nghệ',
    sub: 'Video mô tả toàn bộ quy trình sản xuất',
    file: 'quy-trinh-3d',
};

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
