/* =============================================================================
 * diagramContainer.jsx — MỤC LỤC "KHO LINH KIỆN" CỦA SƠ ĐỒ CÔNG NGHỆ
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Gom lại các THIẾT BỊ của sơ đồ dây chuyền thiêu kết để pixiStage.jsx import
 *   từ một chỗ. Mỗi thiết bị là một component React vẽ bằng Pixi (WebGL): silo,
 *   băng tải, máy trộn, xe ghi, máy làm mát vòng, quạt, nồi hơi, lò cao... kèm
 *   hoạt ảnh (liệu chạy, quạt quay, bụi, khói).
 *   Mã thật nằm trong thư mục thiet_bi/, mỗi file một nhóm thiết bị (trước
 *   24/10/2026 cả kho là một file 4.773 dòng — chính file này). Bảng dưới cho
 *   biết thiết bị nào ở file nào.
 *   Các linh kiện KHÔNG quyết định vị trí: mọi toạ độ / kích thước truyền vào
 *   qua props. Bố cục tính ở cau_hinh.js (CFG) + bo_cuc.js (buildLayout); các
 *   file trong lap_rap/ lắp linh kiện thành sơ đồ hoàn chỉnh (xem đầu pixiStage.jsx).
 *
 * KIẾN THỨC NỀN ĐỂ ĐỌC CÁC FILE TRONG thiet_bi/
 *   - <Graphics draw={hàm}>: Pixi gọi hàm vẽ phần TĨNH (vỏ máy, khung...).
 *   - useTick(cb): gọi cb mỗi khung hình (~60 lần/giây) để làm hoạt ảnh. Phần
 *     ĐỘNG được vẽ lại trực tiếp qua ref (ref.current.clear() rồi vẽ), KHÔNG qua
 *     state của React — đổi state 60 lần/giây thì React dựng lại cả cây, rất chậm.
 *   - useRedrawGate / HEAVY_REDRAW_EVERY (nhip_ve.js): các lớp hạt trang trí nặng
 *     chỉ dựng lại hình học mỗi 2 khung hình (vị trí vẫn tính đủ) — giữ máy yếu
 *     chạy mượt.
 *   - Màu dùng chung khai ở COLORS (mau_sac.js), dạng số hex 0xRRGGBB.
 *   - "feed-local": hệ toạ độ bên trong cụm sơ đồ (trước khi camera dời và thu
 *     phóng), là đơn vị của mọi con số toạ độ trong CFG.
 *   - Mỗi file tự import thứ nó cần từ file khác trong thư mục (vd COLORS từ
 *     mau_sac.js). Hàm phụ chỉ dùng nội bộ thì không đưa ra mục lục này.
 *
 * MUỐN SỬA MỘT THIẾT BỊ: tìm tên component ở bảng dưới, mở file tương ứng, đọc
 * khung chú thích ngay trên component (mô tả + @param). Muốn DỜI vị trí / đổi
 * kích thước: sửa khối CFG trong cau_hinh.js, không sửa trong thiet_bi/.
 * THÊM MỘT THIẾT BỊ: viết component trong file hợp nhóm (hoặc file mới trong
 * thiet_bi/), "export" nó, thêm tên vào đúng dòng bên dưới, rồi import ở file
 * lap_rap/ cần dùng (thường là lap_rap/cum_nap_lieu.jsx) như các thiết bị khác.
 * ===========================================================================*/

/* Bảng màu + hàm phụ dùng chung */
export { COLORS, lerpColor } from './thiet_bi/mau_sac.js';
/* Các lớp hạt trang trí: giãn nhịp dựng lại hình học */
export { HEAVY_REDRAW_EVERY, useRedrawGate } from './thiet_bi/nhip_ve.js';

/* --- Dây chuyền, theo đường đi của liệu ------------------------------------ */
/* Silo phối liệu + băng cấp liệu vào silo (CoalCrusherPlaceholder: bản cũ, không dùng) */
export { CoalCrusherPlaceholder, SiloPlaceHolder, SiloFeedLine } from './thiet_bi/silo_phoi_lieu.jsx';
/* Băng tải */
export { MainConveyorPlaceHolder } from './thiet_bi/bang_tai.jsx';
/* Máy trộn lồng quay */
export { DrumMixerTopDown } from './thiet_bi/may_tron.jsx';
/* Nhà xưởng thiêu kết: khung, silo liệu, bố liệu + con lăn, liệu rơi, khung kính */
export {
    MIXED_ORE_COLORS, WHITE_ORE_COLORS, PlantFrame, MaterialSilo, FeederWithRollers,
    MaterialFall, FrostedFrame, GlassPane,
} from './thiet_bi/nha_xuong.jsx';
/* Lò điểm hoả, xe ghi, gió hút trên mặt xe ghi, động cơ đẩy xe ghi */
export { IgnitionFurnace, PalletCarTrack, TrackSuction, DriveMotor } from './thiet_bi/lo_diem_hoa_xe_ghi.jsx';
/* Phễu ống gió, ống gió tổng */
export { WindBoxRow, WindMainDuct } from './thiet_bi/ong_gio.jsx';
/* Nghiền trục đơn cuối đường xe ghi + liệu bị đánh bể */
export { SingleRollCrusher, SinterCrusher } from './thiet_bi/dap_thieu_ket.jsx';
/* Nồi hơi nhiệt dư */
export { WasteHeatBoiler } from './thiet_bi/noi_hoi.jsx';
/* Hệ tuần hoàn khí thải */
export { FlueGasRecirculation } from './thiet_bi/tuan_hoan_khi.jsx';
/* Hệ xử lý khí thải */
export { ExhaustTreatment } from './thiet_bi/xu_ly_khi_thai.jsx';
/* Con thoi rải liệu + màu quặng thiêu kết */
export { COOLED_SINTER_COLORS, BLACK_SINTER_COLORS, ShuttleDistributor } from './thiet_bi/con_thoi.jsx';
/* Máy làm mát vòng (quạt vẽ bằng thiet_bi/quat.js) */
export { AnnularCooler } from './thiet_bi/lam_mat_vong.jsx';
/* Băng tải xích + dòng quặng đổ qua máng */
export { ChainConveyorSegment, OrePourStream } from './thiet_bi/chuyen_lieu.jsx';
/* Trạm khử sắt */
export { IronRemovalStation } from './thiet_bi/khu_sat.jsx';
/* Máy đánh đống - rút liệu */
export { StackerReclaimer } from './thiet_bi/may_danh_dong.jsx';
/* Nhà nghiền than */
export { CoalCrushingPlant } from './thiet_bi/nghien_than.jsx';

/* --- Các khu bên ngoài dây chuyền ------------------------------------------ */
/* Lò cao */
export { BlastFurnacePlant } from './thiet_bi/lo_cao.jsx';
/* Đường + xe ben chở quặng sang lò cao */
export { HaulRoad, HaulTrucks } from './thiet_bi/xe_ben.jsx';
/* Trạm nước tuần hoàn + ống nước làm mát */
export { WaterRecircStation, CoolingWaterLines } from './thiet_bi/nuoc.jsx';
/* Trạm phát điện nhiệt dư + đường hơi */
export { SteamLines, PowerPlant } from './thiet_bi/phat_dien.jsx';
/* Khung logo */
export { LogoPlate } from './thiet_bi/logo.jsx';
