/* =============================================================================
 * diagramContainer.jsx — MỤC LỤC "KHO LINH KIỆN" CỦA SƠ ĐỒ CÔNG NGHỆ
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Gom lại các THIẾT BỊ của sơ đồ dây chuyền thiêu kết để pixiStage.jsx import
 *   từ một chỗ. Mỗi thiết bị là một component React vẽ bằng Pixi (WebGL): silo,
 *   băng tải, máy trộn, xe ghi, máy làm mát vòng, quạt, nồi hơi, lò cao... kèm
 *   hoạt ảnh (liệu chạy, quạt quay, bụi, khói).
 *   Mã thật nằm trong thư mục equipment/, mỗi file một nhóm thiết bị (trước
 *   24/10/2026 cả kho là một file 4.773 dòng — chính file này). Bảng dưới cho
 *   biết thiết bị nào ở file nào.
 *   Các linh kiện KHÔNG quyết định vị trí: mọi toạ độ / kích thước truyền vào
 *   qua props. Bố cục tính ở stageConfig.js (CFG) + layout.js (buildLayout); các
 *   file trong assembly/ lắp linh kiện thành sơ đồ hoàn chỉnh (xem đầu pixiStage.jsx).
 *
 * KIẾN THỨC NỀN ĐỂ ĐỌC CÁC FILE TRONG equipment/
 *   - <Graphics draw={hàm}>: Pixi gọi hàm vẽ phần TĨNH (vỏ máy, khung...).
 *   - useTick(cb): gọi cb mỗi khung hình (~60 lần/giây) để làm hoạt ảnh. Phần
 *     ĐỘNG được vẽ lại trực tiếp qua ref (ref.current.clear() rồi vẽ), KHÔNG qua
 *     state của React — đổi state 60 lần/giây thì React dựng lại cả cây, rất chậm.
 *   - useRedrawGate / HEAVY_REDRAW_EVERY (redrawGate.js): các lớp hạt trang trí nặng
 *     chỉ dựng lại hình học mỗi 2 khung hình (vị trí vẫn tính đủ) — giữ máy yếu
 *     chạy mượt.
 *   - Màu dùng chung khai ở COLORS (colors.js), dạng số hex 0xRRGGBB.
 *   - "feed-local": hệ toạ độ bên trong cụm sơ đồ (trước khi camera dời và thu
 *     phóng), là đơn vị của mọi con số toạ độ trong CFG.
 *   - Mỗi file tự import thứ nó cần từ file khác trong thư mục (vd COLORS từ
 *     colors.js). Hàm phụ chỉ dùng nội bộ thì không đưa ra mục lục này.
 *
 * MUỐN SỬA MỘT THIẾT BỊ: tìm tên component ở bảng dưới, mở file tương ứng, đọc
 * khung chú thích ngay trên component (mô tả + @param). Muốn DỜI vị trí / đổi
 * kích thước: sửa khối CFG trong stageConfig.js, không sửa trong equipment/.
 * THÊM MỘT THIẾT BỊ: viết component trong file hợp nhóm (hoặc file mới trong
 * equipment/), "export" nó, thêm tên vào đúng dòng bên dưới, rồi import ở file
 * assembly/ cần dùng (thường là assembly/feedingSection.jsx) như các thiết bị khác.
 * ===========================================================================*/

/* Bảng màu + hàm phụ dùng chung */
export { COLORS, lerpColor } from './equipment/colors.js';
/* Các lớp hạt trang trí: giãn nhịp dựng lại hình học */
export { HEAVY_REDRAW_EVERY, useRedrawGate } from './equipment/redrawGate.js';

/* --- Dây chuyền, theo đường đi của liệu ------------------------------------ */
/* Silo phối liệu + băng cấp liệu vào silo (CoalCrusherPlaceholder: bản cũ, không dùng) */
export { CoalCrusherPlaceholder, SiloPlaceHolder, SiloFeedLine } from './equipment/blendingSilos.jsx';
/* Băng tải */
export { MainConveyorPlaceHolder } from './equipment/conveyor.jsx';
/* Máy trộn lồng quay */
export { DrumMixerTopDown } from './equipment/drumMixer.jsx';
/* Nhà xưởng thiêu kết: khung, silo liệu, bố liệu + con lăn, liệu rơi, khung kính */
export {
    MIXED_ORE_COLORS, WHITE_ORE_COLORS, PlantFrame, MaterialSilo, FeederWithRollers,
    MaterialFall, FrostedFrame, GlassPane,
} from './equipment/plantFrame.jsx';
/* Lò điểm hoả, xe ghi, gió hút trên mặt xe ghi, động cơ đẩy xe ghi */
export { IgnitionFurnace, PalletCarTrack, TrackSuction, DriveMotor } from './equipment/ignitionPalletTrack.jsx';
/* Phễu ống gió, ống gió tổng */
export { WindBoxRow, WindMainDuct } from './equipment/windBoxes.jsx';
/* Nghiền trục đơn cuối đường xe ghi + liệu bị đánh bể */
export { SingleRollCrusher, SinterCrusher } from './equipment/sinterCrusher.jsx';
/* Nồi hơi nhiệt dư */
export { WasteHeatBoiler } from './equipment/wasteHeatBoiler.jsx';
/* Hệ tuần hoàn khí thải */
export { FlueGasRecirculation } from './equipment/flueGasRecirculation.jsx';
/* Hệ xử lý khí thải */
export { ExhaustTreatment } from './equipment/exhaustTreatment.jsx';
/* Con thoi rải liệu + màu quặng thiêu kết */
export { COOLED_SINTER_COLORS, BLACK_SINTER_COLORS, ShuttleDistributor } from './equipment/shuttleDistributor.jsx';
/* Máy làm mát vòng (quạt vẽ bằng equipment/fans.js) */
export { AnnularCooler } from './equipment/annularCooler.jsx';
/* Băng tải xích + dòng quặng đổ qua máng */
export { ChainConveyorSegment, OrePourStream } from './equipment/chainConveyor.jsx';
/* Trạm khử sắt */
export { IronRemovalStation } from './equipment/ironRemoval.jsx';
/* Máy đánh đống - rút liệu */
export { StackerReclaimer } from './equipment/stackerReclaimer.jsx';
/* Nhà nghiền than */
export { CoalCrushingPlant } from './equipment/coalCrushing.jsx';

/* --- Các khu bên ngoài dây chuyền ------------------------------------------ */
/* Lò cao */
export { BlastFurnacePlant } from './equipment/blastFurnace.jsx';
/* Đường + xe ben chở quặng sang lò cao */
export { HaulRoad, HaulTrucks } from './equipment/haulTrucks.jsx';
/* Trạm nước tuần hoàn + ống nước làm mát */
export { WaterRecircStation, CoolingWaterLines } from './equipment/waterSystem.jsx';
/* Trạm phát điện nhiệt dư + đường hơi */
export { SteamLines, PowerPlant } from './equipment/powerPlant.jsx';
/* Khung logo */
export { LogoPlate } from './equipment/logoPlate.jsx';
