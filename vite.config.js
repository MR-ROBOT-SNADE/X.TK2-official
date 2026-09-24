import { defineConfig, minify } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/* =============================================================================
 * GỘP + THU NHỎ CÁC SCRIPT THƯỜNG KHI BUILD
 * -----------------------------------------------------------------------------
 * index.html nạp ~10 file js/... dạng <script src> thường (không phải module),
 * Vite không tự xử lý loại này. Trước đây cả thư mục js/ được chép NGUYÊN VẸN ra
 * dist: ai mở F12 -> Sources cũng đọc được mã kèm toàn bộ chú thích, và tải
 * được cả mã nguồn JSX của sơ đồ (vốn đã được Vite gói riêng, không cần tới).
 *
 * Plugin này, chỉ khi build (npm run dev vẫn chạy file gốc để sửa cho dễ):
 *   1) Gom các thẻ <script src="js/..."> ĐỨNG LIỀN NHAU thành MỘT file, giữ đúng
 *      thứ tự và đúng VỊ TRÍ (nhóm ở <head> vẫn ở <head> để gọi API sớm; nhóm
 *      sau thanh menu vẫn ở đó).
 *   2) Thu nhỏ: bỏ chú thích, khoảng trắng, đổi tên biến CỤC BỘ. Tên hàm/biến
 *      cấp ngoài cùng GIỮ NGUYÊN vì các file gọi chéo nhau và HTML gọi thẳng
 *      (onclick="showSubContent(...)").
 *   3) Đặt tên theo mã băm nội dung vào assets/ -> trình duyệt nhớ 1 năm
 *      (public/_headers), sửa code là tên đổi, không kẹt bản cũ.
 *   4) Bỏ chú thích <!-- --> trong index.html.
 *
 * LƯU Ý: mã chạy trên trình duyệt thì người xem LUÔN lấy được — thu nhỏ chỉ làm
 * nó khó đọc, không phải khoá. Mọi bí mật (PUSH_KEY...) phải nằm phía máy chủ
 * (functions/), tuyệt đối không đặt trong js/.
 * ===========================================================================*/
function goiScriptThuong() {
    const THE = /<script src="(js\/[^"?]+)(?:\?[^"]*)?"><\/script>/g;
    /* Giữa hai thẻ chỉ có khoảng trắng / chú thích thì mới tính là LIỀN NHAU.
       Thân chú thích cấm chứa "-->": viết lỏng kiểu <!--[\s\S]*?--> thì regex
       nuốt một mạch từ chú thích đầu tới chú thích cuối, coi luôn cả HTML ở giữa
       là "chú thích" -> gộp nhầm nav_fit.js lên <head>, trước cả thanh menu. */
    const GIUA = /^(?:\s|<!--(?:(?!-->)[\s\S])*-->)*$/;
    let nhom = [];                               /* [{ tags: [chuỗi thẻ], fileName }] */
    let goc = '';

    return {
        name: 'xtk2-goi-script-thuong',
        apply: 'build',

        configResolved(cfg) { goc = cfg.root; },

        async buildStart() {
            nhom = [];
            const html = fs.readFileSync(path.join(goc, 'index.html'), 'utf8');
            let hienTai = null, cuoi = -1, m;
            THE.lastIndex = 0;
            while ((m = THE.exec(html))) {
                if (!hienTai || !GIUA.test(html.slice(cuoi, m.index))) {
                    hienTai = { tags: [], files: [] };
                    nhom.push(hienTai);
                }
                hienTai.tags.push(m[0]);
                hienTai.files.push(m[1]);
                cuoi = m.index + m[0].length;
            }

            for (const n of nhom) {
                /* ;\n giữa các file: file trước thiếu dấu ; cuối cũng không dính dòng */
                const code = n.files.map(function (f) {
                    const p = path.join(goc, f);
                    if (!fs.existsSync(p)) this.error('index.html gọi ' + f + ' nhưng không có file này');
                    return '/* ' + f + ' */\n' + fs.readFileSync(p, 'utf8');
                }, this).join('\n;\n');

                const kq = await minify('goi.js', code, {
                    module: false,                    /* script thường, KHÔNG phải module */
                    mangle: { toplevel: false },      /* giữ tên cấp ngoài cùng */
                    compress: true,
                    codegen: { removeWhitespace: true },
                    sourcemap: false,                 /* không xuất bản đồ về mã gốc */
                });
                if (kq.errors && kq.errors.length) {
                    this.error('Thu nhỏ ' + n.files.join(', ') + ' lỗi: ' + kq.errors.map(e => e.message).join('; '));
                }
                const bam = createHash('sha256').update(kq.code).digest('hex').slice(0, 10);
                n.fileName = 'assets/app-' + bam + '.js';
                this.emitFile({ type: 'asset', fileName: n.fileName, source: kq.code });
            }
        },

        transformIndexHtml: {
            order: 'post',
            handler(html) {
                for (const n of nhom) {
                    /* Thẻ đầu nhóm -> thẻ gói mới; các thẻ còn lại trong nhóm -> xoá */
                    n.tags.forEach(function (tag, i) {
                        if (html.indexOf(tag) < 0) throw new Error('Không tìm thấy thẻ ' + tag + ' trong index.html đã build');
                        html = html.replace(tag, i === 0 ? '<script src="/' + n.fileName + '"></script>' : '');
                    });
                }
                return html.replace(/<!--[\s\S]*?-->/g, '');
            },
        },
    };
}

export default defineConfig({
  plugins: [react(), goiScriptThuong(), viteStaticCopy({
    targets: [
        /* Chép NGUYÊN CẢ thư mục ảnh, GIỮ ĐÚNG cấu trúc thư mục con:
             images/icons/x.webp                -> dist/images/icons/x.webp
             images/so-do/x.jpg                 -> dist/images/so-do/x.jpg
           index.html gọi ảnh theo đúng các đường dẫn 'images/...' đó.

           Thư mục js/ KHÔNG chép nữa: các script đã được goiScriptThuong() gộp
           và thu nhỏ vào assets/, sơ đồ JSX thì Vite tự gói. Chép thêm là lộ mã
           nguồn gốc kèm chú thích ra ngoài.

           LƯU Ý — đừng thêm lại các dòng glob dạng { src: 'images/*' }. Chúng
           chép PHẲNG nội dung ra gốc dist, tạo bản sao thứ hai của mọi file (gói
           deploy phình gấp đôi) mà không đường dẫn nào trong mã nguồn dùng tới.
           Trên Cloudflare Pages, đường dẫn sai không trả 404 rỗng mà trả nguyên
           trang index.html (~99 KB), nên lỗi kiểu này rất khó thấy: ảnh không
           hiện, còn trình duyệt thì báo "Refused to execute script ... MIME type
           ('text/html')". */
        { src: 'images', dest: '.' },
    ],
  }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', '@pixi/react', 'pixi.js'],
  },
  server: {
    port: 3000,
    open: true
  }
});
