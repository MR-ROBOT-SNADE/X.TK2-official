/* =============================================================================
 * js/components/Charts/bep/kip_co_hat_than.js — Ô "CA/KÍP" CỦA BIỂU ĐỒ CỠ HẠT THAN
 * =============================================================================
 * Phần 6/8 của "bếp" biểu đồ (thư mục bep/, trước 24/10/2026 là
 * chart_cook.js) — đọc bep/cot_bieu_do.js trước để biết cả thư mục.
 * -----------------------------------------------------------------------------
 *   syncShiftDropdown: chỉ liệt kê những kíp có số trong ngày đang xem. Gọi từ
 *   ganMotLan (dieu_phoi.js) và từ applyUniversalFilter / clearUniversalFilter
 *   (bo_loc.js) mỗi lần lọc / xoá lọc biểu đồ cỡ hạt than.
 * ===========================================================================*/
/** Cập nhật danh sách kíp trong ô "Ca/kíp" của biểu đồ cỡ hạt than
 *  (#shift-CoHatThan): chỉ liệt kê những kíp THẬT SỰ có số trong ngày đang xem
 *  (ngày được chọn, hoặc ngày mới nhất có số). Một kíp được coi là "có số" nếu
 *  BẤT KỲ dây nào (TK3/TK4, than nghiền/coke) có giá trị <1mm (khoá '<0.5mm...') > 0.
 *  Kíp đang chọn vẫn còn trong danh sách mới thì giữ; không thì chọn kíp đầu. */
function syncShiftDropdown(chartType) {

    /* Than nghiền và than coke chung một bộ số liệu (chung trục ca) */
    const dataTN = window.AppChartData.CoHatThan;
    const dataTC = dataTN;

    const shiftSelect = document.getElementById('shift-CoHatThan');
    const startInput = document.getElementById('start-CoHatThan');

    // Dùng nhãn thời gian của than nghiền làm trục gốc
    if (!dataTN || !dataTN.labels || !shiftSelect) return;

    const startTs = (startInput && startInput.value) ? new Date(startInput.value).getTime() : 0;
    const hasDateFilter = !!(startInput && startInput.value);

    let availableShifts = [];

    /* Ca thứ i có số không — xét cả TK3, TK4, than nghiền và than coke */
    const checkHasData = (i) => {
        let hasTN3 = dataTN['<0.5mmTNTK3'] && dataTN['<0.5mmTNTK3'][i] > 0;
        let hasTN4 = dataTN['<0.5mmTNTK4'] && dataTN['<0.5mmTNTK4'][i] > 0;
        let hasTC3 = dataTC && dataTC['<0.5mmTCTK3'] && dataTC['<0.5mmTCTK3'][i] > 0;
        let hasTC4 = dataTC && dataTC['<0.5mmTCTK4'] && dataTC['<0.5mmTCTK4'][i] > 0;

        return hasTN3 || hasTN4 || hasTC3 || hasTC4;
    };

    if (hasDateFilter) {
        /* Có chọn ngày: lấy các kíp có số của đúng ngày đó */
        for (let i = 0; i < dataTN.labels.length; i++) {
            const label = dataTN.labels[i];
            const [dPart, sPart] = String(label).split(' - ').map(s => s.trim());
            const ts = new Date(dPart.split('/').reverse().join('-')).getTime();

            if (ts === startTs && checkHasData(i)) {
                if (!availableShifts.includes(sPart)) {
                    availableShifts.push(sPart);
                }
            }
        }
    } else {
        /* Không chọn ngày: tìm ngày MỚI NHẤT có số, rồi lấy các kíp của ngày đó */
        let targetDate = "";
        for (let i = dataTN.labels.length - 1; i >= 0; i--) {
            if (checkHasData(i)) {
                targetDate = dataTN.labels[i].split(' - ')[0].trim();
                break;
            }
        }
        for (let i = 0; i < dataTN.labels.length; i++) {
            if (dataTN.labels[i].includes(targetDate) && checkHasData(i)) {
                let shift = dataTN.labels[i].split(' - ')[1].trim();
                if (!availableShifts.includes(shift)) {
                    availableShifts.push(shift);
                }
            }
        }
    }

    availableShifts.sort();

    // Xoá danh sách cũ (tránh còn kíp không còn số liệu)
    const currentVal = shiftSelect.value;
    shiftSelect.innerHTML = '';

    // Nạp lại các kíp có thật
    if (availableShifts.length === 0) {
        shiftSelect.innerHTML = '<option value="all">Trống dữ liệu</option>';
    } else {
        availableShifts.forEach(shift => {
            const opt = document.createElement('option');
            opt.value = shift;
            opt.text = `Kíp ${shift}`;
            shiftSelect.appendChild(opt);
        });
    }

    // Giữ kíp đang chọn nếu còn; không thì chọn kíp đầu tiên
    if (availableShifts.includes(currentVal)) {
        shiftSelect.value = currentVal;
    } else if (availableShifts.length > 0) {
        shiftSelect.value = availableShifts[0];
    } else {
        shiftSelect.value = 'all';
    }
}
