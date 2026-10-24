/* =============================================================================
 * diagramHotspots.jsx — BẮT CHUỘT + BẢNG THÔNG TIN CỦA SƠ ĐỒ CÔNG NGHỆ
 * =============================================================================
 * Phần GIAO DIỆN của các hạng mục; NỘI DUNG (tên, mô tả, thông số, ảnh) ở
 * hotspotData.js. pixiStage.jsx chỉ việc gọi các hàm / component xuất ra ở đây:
 *   3)  HotspotLayer, useHotspotPointer   tô sáng + bắt chuột trên canvas
 *   4)  HotspotPopup                      bảng thông tin (HTML)
 *   5)  DiagramSidePanel, ProcessVideo,   bảng danh mục bên cạnh sơ đồ + video
 *       buildFlowRows                     lưu trình
 * ===========================================================================*/

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Graphics, useTick } from '@pixi/react';

import { FLOW_NOTE, FLOW_ORDER, MEDIA_BASE, PROCESS_VIDEO, VIDEO_BASE } from './hotspotData.js';

/* =============================================================================
 * 3) TÔ SÁNG HẠNG MỤC + BẮT CHUỘT
 * Vùng đang trỏ tới được tô sáng bằng một khung vàng nhấp nháy nhẹ (vẽ bằng
 * Pixi), còn việc BẮT CHUỘT làm thẳng trên thẻ canvas của trình duyệt — lý do
 * xem lời giải thích ngay dưới phần vẽ.
 * ===========================================================================*/
const HL_COLOR = 0xf39c12;

/* Khung vàng nhấp nháy nhẹ bao quanh các vùng (rects) của hạng mục đang trỏ tới. */
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

/* Phần video + ảnh của bảng thông tin. File nào nạp lỗi (chưa có) thì tự ẩn;
   không có gì cả thì hiện khung "chưa có tài nguyên" kèm đường dẫn cần đặt file. */
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

/* BẢNG THÔNG TIN một hạng mục (item), đặt cạnh vùng rect trên canvas.
   pinned: đã bấm ghim (có nút × đóng). onHold / onRelease: chuột vào / rời bảng
   (để bảng không biến mất khi người xem đưa chuột từ sơ đồ vào trong bảng). */
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

/* Khung mô tả luồng công nghệ — nội dung lấy từ FLOW_NOTE (hotspotData.js, mục 1c). */
const FlowNote = () => {
    const { title, lead, paragraphs, bullets } = FLOW_NOTE;
    const empty = !lead && !(paragraphs && paragraphs.length) && !(bullets && bullets.length);
    return (
        <section className="sd-card">
            <h3 className="sd-card__title">{title}</h3>
            {empty ? (
                <div className="sd-card__empty">
                    <span>Chưa có nội dung</span>
                    <code>soạn tại FLOW_NOTE trong hotspotData.js</code>
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

/* BẢNG BÊN CẠNH sơ đồ: danh mục hạng mục đánh số theo chiều đi của liệu (rê /
   bấm một dòng = rê / bấm hạng mục trên sơ đồ) + khung mô tả luồng công nghệ. */
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
