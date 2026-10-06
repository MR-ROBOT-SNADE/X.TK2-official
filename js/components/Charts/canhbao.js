/* XTK2-CANHBAO v3 — canhbao.js
 * Đi CẶP với css/cb.css (giao diện bảng) và chart_cook.js.
 * =============================================================================
 * BẢNG CẢNH BÁO ("BẢNG NHẬN XÉT") Ở ĐẦU HAI MỤC TIÊU HAO VÀ CHẤT LƯỢNG
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Vào mục "Tiêu hao sản xuất" hoặc "Chất lượng" là thấy ngay một bảng tóm tắt:
 *   chỉ tiêu nào đang VƯỢT NGƯỠNG (đỏ, xếp lên đầu), chỉ tiêu nào trong ngưỡng
 *   (xanh). Bấm vào một dòng là nhảy tới biểu đồ chi tiết của chỉ tiêu đó.
 *     - Bảng Tiêu hao  (#cb-tieu-hao)   : than, điện, khí than, quặng hồi
 *                                         + bảng phụ trợ dung (chỉ xem, không chấm)
 *     - Bảng Chất lượng (#cb-chat-luong): vôi, dolomite, quặng trung hoà, quặng
 *                                         hồi, than, quặng thiêu kết
 *   Mỗi ô ghi rõ NGÀY của số liệu — bảng nhận xét cho ngày GẦN NHẤT CÓ SỐ, không
 *   phải lúc nào cũng là hôm nay (bảng tính có thể nhập chậm vài ngày).
 *
 * FILE NÀY CHỈ VẼ. Ngưỡng cảnh báo và phép chấm nằm ở js/chung/chi_so.js
 * (NGUONG, CB_CHI_TIEU, CL_CHI_TIEU...) — dùng chung với máy chủ. Muốn đổi
 * ngưỡng thì sửa ở đó.
 *
 * KHÔNG dùng Chart.js — chỉ chữ và màu, nên gần như không tốn tài nguyên.
 *
 * KHI NÀO VẼ (cuối file): khi máy chủ gửi kết quả chấm sẵn (sự kiện ChiSoReady,
 * thường về TRƯỚC số liệu), hoặc khi đã có số liệu cả TK3 lẫn TK4 để tự chấm.
 * ===========================================================================*/

/** Kết quả chấm của 3 bảng: { tieuHao: [...], troDung: [...], chatLuong: [...] }.
 *  Ưu tiên bản máy chủ đã chấm sẵn cho hôm nay (/api/v2/chi-so — có ngay khi mở
 *  trang); không có thì tự chấm trên số liệu đang có. Cùng một mã chấm nên hai
 *  đường ra y hệt. */
function cbKetQua() {
    var may = (typeof chiSoMayChu === 'function') ? chiSoMayChu() : null;
    if (may) return may.canhBao;
    var r3 = window.masterSheetDataTK3, r4 = window.masterSheetDataTK4, now = new Date();
    return {
        tieuHao: CB_CHI_TIEU.map(function (ct) { return cbChamChiTieu(ct, r3, r4, now); }),
        troDung: tinhTroDung(r3, r4, now),
        chatLuong: CL_CHI_TIEU.map(function (ct) { return clChamChiTieu(ct, r3, r4, now); }),
    };
}

/* =============================================================================
 * DỰNG GIAO DIỆN BẢNG
 * ===========================================================================*/

/** Tạo nhanh một thẻ HTML: cbEl('span', 'lop-css', 'chữ'). */
var cbEl = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};


/** Nhảy tới khối biểu đồ id (vd 'tieu-hao-than'): mở khối bằng showSubContent
 *  (khối đang bị ẩn) rồi cuộn tới. */
function cbNhayToi(id) {
    if (typeof showSubContent === 'function') showSubContent(id);
    var el = document.getElementById(id);
    if (el && el.scrollIntoView) {
        setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }
}

/** Một dòng của bảng TIÊU HAO (kq = kết quả cbChamChiTieu):
 *    [🔺/✅]  🔥 Tiêu hao than
 *            [TK3 (Ccd) 5/10: 48,20 kg/Tsp | luỹ kế 44,10 kg/Tsp] [TK4 ...]
 *            lý do vượt, hoặc "Trong ngưỡng (ngày ≤ 50, luỹ kế ≤ 45 kg/Tsp)"   [›] */
function cbDungDong(kq) {
    var vp = kq.viPham > 0;
    var dong = cbEl('button', 'cb-row' + (vp ? ' is-vuot' : ' is-ok'));
    dong.type = 'button';
    dong.addEventListener('click', function () { cbNhayToi(kq.nhay); });

    dong.appendChild(cbEl('span', 'cb-row__ico', vp ? '🔺' : '✅'));

    var giua = cbEl('div', 'cb-row__mid');
    giua.appendChild(cbEl('span', 'cb-row__ten', kq.bieuTuong + ' ' + kq.ten));

    if (kq.thieuCot && !kq.day.length) {
        giua.appendChild(cbEl('span', 'cb-row__phu', 'Chưa lấy được số liệu tháng này'));
    } else {
        /* Mỗi dây (và mỗi cách tính) một "chip" số liệu */
        var chiTiet = cbEl('div', 'cb-row__chitiet');
        kq.day.forEach(function (d) {
            var o = cbEl('span', 'cb-chip' + (d.loi.length ? ' is-vuot' : ''));
            /* GHI RÕ NGÀY: bảng nhận xét cho NGÀY GẦN NHẤT CÓ SỐ LIỆU, không phải
               hôm nay. Hai dây có thể lệch ngày nhau nên phải ghi từng ô. */
            var mo = d.ten + (d.nhan ? ' (' + d.nhan + ')' : '')
                + ' ' + d.ngay.d + '/' + d.ngay.m + ': '
                + cbLamTron(d.giaTriNgay) + ' ' + kq.nguong.donVi;
            if (d.giaTriLuyKe !== null) {
                mo += '  |  luỹ kế ' + cbLamTron(d.giaTriLuyKe) + ' ' + kq.nguong.donVi;
            }
            o.textContent = mo;
            chiTiet.appendChild(o);
        });
        giua.appendChild(chiTiet);

        if (vp) {
            /* Dòng lý do: liệt kê từng lần vượt */
            var ly = [];
            kq.day.forEach(function (d) {
                d.loi.forEach(function (l) {
                    /* l.loai = 'ngày' hoặc 'luỹ kế'. Ghi "ngày 22/8 — ngày 52" thì
                       chữ "ngày" lặp hai lần, đọc rối -> đổi thành "tiêu hao ngày". */
                    ly.push(d.ten + (d.nhan ? ' ' + d.nhan : '')
                        + ' ' + d.ngay.d + '/' + d.ngay.m + ' — '
                        + (l.loai === 'ngày' ? 'tiêu hao ngày' : 'luỹ kế')
                        + ' ' + cbLamTron(l.giaTri) + ' > ngưỡng ' + l.nguong);
                });
            });
            giua.appendChild(cbEl('span', 'cb-row__phu', ly.join(' · ')));
        } else {
            giua.appendChild(cbEl('span', 'cb-row__phu',
                'Trong ngưỡng (ngày ≤ ' + kq.nguong.ngay
                + ', luỹ kế ≤ ' + kq.nguong.luyKe + ' ' + kq.nguong.donVi + ')'));
        }
    }

    dong.appendChild(giua);
    dong.appendChild(cbEl('span', 'cb-row__mui', '›'));
    return dong;
}

/** Bảng phụ TRỢ DUNG (vôi nung, dolomite) — chỉ hiện số ngày gần nhất + luỹ kế,
 *  KHÔNG chấm ngưỡng. dsTD: kết quả tinhTroDung() — mỗi phần tử { nhan, day, d }. */
function cbDungTroDung(dsTD) {
    var C = CB_TRO_DUNG;
    var box = cbEl('div', 'cb-trodung');

    /* Dòng tiêu đề bấm được -> nhảy tới biểu đồ trợ dung */
    var dau = cbEl('button', 'cb-trodung__dau');
    dau.type = 'button';
    dau.appendChild(cbEl('span', null, C.bieuTuong + ' ' + C.ten));
    dau.appendChild(cbEl('span', 'cb-row__mui', '›'));
    dau.addEventListener('click', function () { cbNhayToi(C.nhay); });
    box.appendChild(dau);

    var bang = cbEl('table', 'cb-bang');
    var thead = cbEl('thead');
    var hr = cbEl('tr');
    ['Loại', 'Dây chuyền', 'Ngày gần nhất', 'Luỹ kế tháng'].forEach(function (t) {
        hr.appendChild(cbEl('th', null, t));
    });
    thead.appendChild(hr);
    bang.appendChild(thead);

    var tbody = cbEl('tbody');
    var coDL = false;
    dsTD.forEach(function (x) {
        var d = x.d;
        var tr = cbEl('tr');
        tr.appendChild(cbEl('td', null, x.nhan));
        tr.appendChild(cbEl('td', null, x.day));
        if (d) {
            coDL = true;
            tr.appendChild(cbEl('td', 'cb-so',
                cbLamTron(d.giaTriNgay) + '  (' + d.ngay.d + '/' + d.ngay.m + ')'));
            tr.appendChild(cbEl('td', 'cb-so', cbLamTron(d.giaTriLuyKe)));
        } else {
            tr.appendChild(cbEl('td', 'cb-so', '--'));
            tr.appendChild(cbEl('td', 'cb-so', '--'));
        }
        tbody.appendChild(tr);
    });
    bang.appendChild(tbody);

    if (!coDL) {
        box.appendChild(cbEl('p', 'cb-trong', 'Chưa lấy được số liệu trợ dung tháng này'));
    } else {
        box.appendChild(bang);
    }
    return box;
}

/** Một dòng của bảng CHẤT LƯỢNG (kq = kết quả clChamChiTieu). Giống bảng tiêu
 *  hao, nhưng mỗi chip là một PHÉP ĐO của một dây; phép đo kiểu dao động ghi
 *  độ lệch thay cho giá trị. */
function clDungDong(kq) {
    var vp = kq.viPham > 0;
    var dong = cbEl('button', 'cb-row' + (vp ? ' is-vuot' : ' is-ok'));
    dong.type = 'button';
    dong.addEventListener('click', function () { cbNhayToi(kq.nhay); });

    dong.appendChild(cbEl('span', 'cb-row__ico', vp ? '🔺' : '✅'));

    var giua = cbEl('div', 'cb-row__mid');
    giua.appendChild(cbEl('span', 'cb-row__ten', kq.bieuTuong + ' ' + kq.ten));

    if (!kq.day.length) {
        giua.appendChild(cbEl('span', 'cb-row__phu', 'Chưa lấy được số liệu tháng này'));
    } else {
        var chiTiet = cbEl('div', 'cb-row__chitiet');
        kq.day.forEach(function (d) {
            var o = cbEl('span', 'cb-chip' + (d.loi ? ' is-vuot' : ''));
            var mo = d.day + ' ' + d.nhan + ' ' + d.ngay.d + '/' + d.ngay.m + ': ';
            if (d.huong === 'daoDong' && d.chenh !== undefined) {
                mo += 'lệch ' + cbLamTron(d.chenh) + d.donVi;
            } else {
                mo += cbLamTron(d.giaTri) + d.donVi;
            }
            if (d.nguong === null || d.nguong === undefined) mo += '  (chưa đặt ngưỡng)';
            o.textContent = mo;
            chiTiet.appendChild(o);
        });
        giua.appendChild(chiTiet);

        if (vp) {
            var ly = kq.day.filter(function (d) { return d.loi; })
                .map(function (d) { return d.day + ' ' + d.nhan + ' ' + d.loi; });
            giua.appendChild(cbEl('span', 'cb-row__phu', ly.join(' · ')));
        } else {
            giua.appendChild(cbEl('span', 'cb-row__phu', 'Trong ngưỡng'));
        }
    }

    if (kq.thieuCot.length) {
        giua.appendChild(cbEl('span', 'cb-row__phu',
            'Chưa có cột trong bảng tính: ' + kq.thieuCot.join(', ')));
    }

    dong.appendChild(giua);
    dong.appendChild(cbEl('span', 'cb-row__mui', '›'));
    return dong;
}

/** Dựng (lại) bảng cảnh báo CHẤT LƯỢNG trong mục #chat-luong.
 *  kqs: cbKetQua().chatLuong. Bảng cũ (nếu có) bị xoá rồi dựng mới. */
function veCanhBaoChatLuong(kqs) {
    var sec = document.getElementById('chat-luong');
    if (!sec) return;

    var cu = document.getElementById('cb-chat-luong');
    if (cu) cu.remove();

    var box = cbEl('section', 'cb-box');
    box.id = 'cb-chat-luong';

    var soVuot = kqs.filter(function (k) { return k.viPham > 0; }).length;

    /* Tiêu đề: tháng + có mấy chỉ tiêu vượt */
    var h = cbEl('h3', 'cb-box__title');
    var now = new Date();
    h.appendChild(cbEl('span', null,
        'CẦN CHÚ Ý — THÁNG ' + (now.getMonth() + 1) + '/' + now.getFullYear()));
    h.appendChild(cbEl('span', 'cb-box__dem' + (soVuot ? ' is-vuot' : ''),
        soVuot ? soVuot + ' chỉ tiêu vượt ngưỡng' : 'Tất cả trong ngưỡng'));
    box.appendChild(h);

    var ngayXet = cbNgayXet(kqs);
    box.appendChild(cbEl('p', 'cb-ngay',
        ngayXet ? 'Số liệu ngày gần nhất: ' + ngayXet
                : 'Chưa có số liệu trong tháng'));

    /* Vượt ngưỡng lên trước, trong ngưỡng xuống sau */
    var ds = cbEl('div', 'cb-list');
    kqs.filter(function (k) { return k.viPham > 0; })
       .forEach(function (k) { ds.appendChild(clDungDong(k)); });
    kqs.filter(function (k) { return k.viPham === 0; })
       .forEach(function (k) { ds.appendChild(clDungDong(k)); });
    box.appendChild(ds);

    box.appendChild(cbEl('p', 'cb-ghichu',
        'Bấm một dòng để mở biểu đồ chi tiết. Ngưỡng đặt tại CL_CHI_TIEU trong js/chung/chi_so.js.'));

    /* Chèn ngay sau tiêu đề mục */
    var header = sec.querySelector('.section-header');
    if (header && header.nextSibling) sec.insertBefore(box, header.nextSibling);
    else sec.appendChild(box);

    /* Nhắc những cột chưa tìm thấy, để biết mà bổ sung vào bảng tính */
    var thieu = [];
    kqs.forEach(function (k) {
        k.thieuCot.forEach(function (t) { thieu.push(k.ten + ' → ' + t); });
    });
    if (thieu.length) {
        console.warn('[Cảnh báo chất lượng] Chưa tìm thấy cột cho: ' + thieu.join(' | ')
            + '. Xem tên cột thật bằng: Object.keys(window.masterSheetDataTK3[0])');
    }
    cbSauKhiDung(CB_MUC[1]);

    console.info('[Cảnh báo chất lượng] ' + soVuot + ' vượt ngưỡng, '
        + (kqs.length - soVuot) + ' trong ngưỡng.');
}

/** Dựng (lại) bảng cảnh báo TIÊU HAO (kèm bảng phụ trợ dung) trong mục
 *  #tieu-hao-san-xuat. kq: toàn bộ cbKetQua(). */
function veCanhBaoTieuHao(kq) {
    var sec = document.getElementById('tieu-hao-san-xuat');
    if (!sec) return;

    var cu = document.getElementById('cb-tieu-hao');
    if (cu) cu.remove();

    var box = cbEl('section', 'cb-box');
    box.id = 'cb-tieu-hao';

    var kqs = kq.tieuHao;
    var soVuot = kqs.filter(function (k) { return k.viPham > 0; }).length;
    var soOk = kqs.length - soVuot;

    /* Tiêu đề: nói ngay có mấy chỉ tiêu vượt */
    var h = cbEl('h3', 'cb-box__title');
    var now = new Date();
    h.appendChild(cbEl('span', null,
        'CẦN CHÚ Ý — THÁNG ' + (now.getMonth() + 1) + '/' + now.getFullYear()));
    h.appendChild(cbEl('span', 'cb-box__dem' + (soVuot ? ' is-vuot' : ''),
        soVuot ? soVuot + ' chỉ tiêu vượt ngưỡng' : 'Tất cả trong ngưỡng'));
    box.appendChild(h);

    /* Nói rõ đang nhận xét cho NGÀY NÀO — không phải lúc nào cũng là hôm nay,
       vì bảng tính có thể nhập chậm vài ngày. */
    var ngayXet = cbNgayXet(kqs);
    box.appendChild(cbEl('p', 'cb-ngay',
        ngayXet ? 'Số liệu ngày gần nhất: ' + ngayXet
                : 'Chưa có số liệu trong tháng'));

    /* Vượt ngưỡng lên trước, trong ngưỡng xuống sau */
    var ds = cbEl('div', 'cb-list');
    kqs.filter(function (k) { return k.viPham > 0; })
       .forEach(function (k) { ds.appendChild(cbDungDong(k)); });
    kqs.filter(function (k) { return k.viPham === 0; })
       .forEach(function (k) { ds.appendChild(cbDungDong(k)); });
    box.appendChild(ds);

    box.appendChild(cbDungTroDung(kq.troDung));
    box.appendChild(cbEl('p', 'cb-ghichu',
        'Bấm một dòng để mở biểu đồ chi tiết. Ngưỡng đặt tại NGUONG trong js/chung/chi_so.js.'));

    /* Chèn NGAY SAU tiêu đề mục, trước dòng "Mở menu và chọn..." */
    var header = sec.querySelector('.section-header');
    if (header && header.nextSibling) sec.insertBefore(box, header.nextSibling);
    else sec.appendChild(box);

    cbSauKhiDung(CB_MUC[0]);

    console.info('[Cảnh báo tiêu hao] ' + soVuot + ' vượt ngưỡng, ' + soOk + ' trong ngưỡng.');
}

/* =============================================================================
 * ẨN / HIỆN BẢNG TỔNG HỢP
 * -----------------------------------------------------------------------------
 * Hành vi mong muốn:
 *   - Bấm "Tiêu hao sản xuất" / "Chất lượng" trên thanh trên -> CHỈ hiện bảng
 *   - Chọn một mục trong menu bên                            -> ẨN bảng, chỉ còn
 *                                                               biểu đồ của mục đó
 *   - Mục "📋 Bảng nhận xét" ở đầu menu bên (JS tự thêm)     -> quay lại bảng
 *
 * showSubContent (sidebar.js) chỉ ẩn .chart-group và .intro-msgs, không biết
 * tới bảng này. Nên ở đây BỌC hàm đó: chạy y nguyên phần gốc, rồi ẩn bảng của
 * đúng mục vừa mở. (main.js cũng bọc showSubContent để báo DieuPhoi — các lớp
 * bọc chồng lên nhau, lớp nào cũng gọi lớp bên trong nên không mất việc gì.)
 * ===========================================================================*/

/* Mỗi mục có một bảng tổng hợp riêng: id mục, id bảng, id menu bên */
var CB_MUC = [
    { sec: 'tieu-hao-san-xuat', box: 'cb-tieu-hao', menu: 'sidebar-menu-tieu-hao' },
    { sec: 'chat-luong', box: 'cb-chat-luong', menu: 'sidebar-menu-chat-luong' },
];

/** Hiện (hien = true) hoặc ẩn bảng tổng hợp của mục m. Khi hiện bảng thì ẩn
 *  dòng hướng dẫn "Mở menu và chọn để xem dữ liệu" — bảng đã thay vai trò đó. */
function cbHien(m, hien) {
    var box = document.getElementById(m.box);
    if (box) box.style.display = hien ? '' : 'none';

    var sec = document.getElementById(m.sec);
    if (sec) {
        sec.querySelectorAll('.intro-msgs').forEach(function (t) {
            t.style.display = hien ? 'none' : t.style.display;
        });
    }
}

/** Về lại màn tổng hợp của mục m: ẩn hết biểu đồ, hiện lại bảng, đánh dấu mục
 *  "Bảng nhận xét" trong menu bên là đang xem, cuộn tới bảng. */
function cbVeTongHop(m) {
    var sec = document.getElementById(m.sec);
    if (!sec) return;
    sec.querySelectorAll('.chart-group').forEach(function (g) { g.style.display = 'none'; });
    cbHien(m, true);
    var menu = document.getElementById(m.menu);
    if (menu) {
        menu.querySelectorAll('a').forEach(function (x) { x.classList.remove('is-dang-xem'); });
        var mi = menu.querySelector('.cb-menu-item');
        if (mi) mi.classList.add('is-dang-xem');
    }
    var box = document.getElementById(m.box);
    if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Bọc showSubContent — chạy MỘT LẦN, và chỉ khi hàm gốc đã tồn tại. */
var cbDaBoc = false;
function cbBocShowSub() {
    if (cbDaBoc || typeof window.showSubContent !== 'function') return;
    var goc = window.showSubContent;
    window.showSubContent = function (contentId) {
        goc.apply(this, arguments);              // giữ nguyên hành vi cũ
        var t = document.getElementById(contentId);
        if (!t) return;
        /* Chỉ ẩn bảng của ĐÚNG mục chứa khối vừa mở. Mở khối bên Chất lượng thì
           bảng Tiêu hao không liên quan, và ngược lại. */
        CB_MUC.forEach(function (m) {
            var sec = document.getElementById(m.sec);
            if (sec && sec.contains(t)) {
                cbHien(m, false);
                var menu = document.getElementById(m.menu);
                var mi = menu && menu.querySelector('.cb-menu-item');
                if (mi) mi.classList.remove('is-dang-xem');
            }
        });
    };
    cbDaBoc = true;
}

/** Bấm tên mục trên thanh điều hướng trên cùng (liên kết #tieu-hao-san-xuat,
 *  #chat-luong) -> về màn tổng hợp của mục đó. Mỗi liên kết chỉ gắn một lần
 *  (đánh dấu bằng data-cb-da-gan). */
function cbBatLinkThanhTren() {
    CB_MUC.forEach(function (m) {
        document.querySelectorAll('a[href="#' + m.sec + '"]').forEach(function (a) {
            if (a.dataset.cbDaGan) return;
            a.dataset.cbDaGan = '1';
            a.addEventListener('click', function () {
                setTimeout(function () { cbVeTongHop(m); }, 80);
            });
        });
    });
}

/** Thêm mục "📋 Bảng nhận xét" lên ĐẦU menu bên, để quay lại bảng tổng hợp mà
 *  không phải bấm lên thanh trên. Dựng bằng JS nên không phải sửa index.html. */
function cbThemMucMenu(m) {
    var menu = document.getElementById(m.menu);
    if (!menu || menu.querySelector('.cb-menu-item')) return;

    var a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.className = 'cb-menu-item';
    a.textContent = '📋 Bảng nhận xét';
    a.addEventListener('click', function () { cbVeTongHop(m); });
    menu.insertBefore(a, menu.firstChild);
}

/** Sau khi dựng xong một bảng: gắn các sự kiện trên (mỗi thứ chỉ gắn một lần)
 *  và quyết định hiện hay ẩn bảng: chưa mở khối biểu đồ nào thì hiện, đang mở
 *  một khối thì để nguyên (ẩn) — làm mới số liệu không được đá người xem khỏi
 *  biểu đồ đang xem. */
function cbSauKhiDung(m) {
    var sec = document.getElementById(m.sec);
    if (!sec) return;

    /* Dọn nút "Quay lại" của phiên bản cũ nếu trình duyệt còn giữ */
    sec.querySelectorAll('.cb-quaylai').forEach(function (n) { n.remove(); });

    cbBocShowSub();
    cbBatLinkThanhTren();
    cbThemMucMenu(m);

    var dangMo = null;
    sec.querySelectorAll('.chart-group').forEach(function (g) {
        if (g.style.display && g.style.display !== 'none') dangMo = g;
    });
    cbHien(m, !dangMo);
}

/* =============================================================================
 * KHI NÀO VẼ
 * -----------------------------------------------------------------------------
 * Vẽ khi: máy chủ đã chấm sẵn cho hôm nay (ChiSoReady — thường về TRƯỚC số
 * liệu), hoặc đã đủ số liệu cả 2 dây để tự chấm (mọi chỉ tiêu đều so cả TK3 lẫn
 * TK4). Mỗi lần dữ liệu mới về thì dựng lại cả hai bảng.
 * ===========================================================================*/
var cbSan = { tk3: false, tk4: false };     /* đã nhận số liệu dây nào */
function cbThu() {
    var may = (typeof chiSoMayChu === 'function') ? chiSoMayChu() : null;
    if (!may && (!cbSan.tk3 || !cbSan.tk4)) return;
    var kq;
    try { kq = cbKetQua(); } catch (e) { console.error('[Cảnh báo] chấm lỗi', e); return; }
    try { veCanhBaoTieuHao(kq); } catch (e) { console.error('[Cảnh báo tiêu hao]', e); }
    try { veCanhBaoChatLuong(kq.chatLuong); } catch (e) { console.error('[Cảnh báo chất lượng]', e); }
}
document.addEventListener('TK3DataReady', function () { cbSan.tk3 = true; cbThu(); });
document.addEventListener('TK4DataReady', function () { cbSan.tk4 = true; cbThu(); });
document.addEventListener('ChiSoReady', cbThu);
