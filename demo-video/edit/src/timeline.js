/**
 * 「拾历」Demo 视频时间线（唯一的数据源）。
 *
 * 实操片段 clips：从真实录屏 footage/segNN.mp4 里截取 [a, b] 秒，按 speed 倍速播放。
 *   - 坐标单位都是录屏的 CSS 像素（页面 1440×810）。
 *   - cams：推近目标。at = 片段内开始时间（秒），dur = 过渡时长；
 *       { full: true } 整页 / { c: [x, y], z } 中心与倍率 / { rect: [x, y, w, h] } 框住区域
 *   - fx：画面标注。box 描边框（color: blue 新写的表达 / orange 待补充 / ink 普通依据）、veil 弱化其余区域、arrow 箭头
 *   - trans: 'dissolve' 与上一段淡入衔接（tdur 秒），用于裁掉 AI 等待时间等跳切
 *   - sub：顶部步骤里当前的小步骤序号
 * 改这里的数字，重新渲染即可。
 */

export const FPS = 30
export const DURATION = 90
export const OPS_START = 14.0

export const STEPS = [
  {
    num: '01',
    title: '把经历整理成事实',
    short: '整理事实',
    subs: ['拖入简历', 'AI 拆分归类', '核对原文', '存入事实库'],
    captions: [{ text: '导入一次，之后按岗位复用。', from: 'a3', to: 'a10:end' }],
    clips: [
      { id: 'a1', seg: 'seg01', a: 1.6, b: 4.55, speed: 1.15, sub: 0, cams: [{ at: 0, dur: 0.01, full: true }] },
      { id: 'a2', seg: 'seg01', a: 7.35, b: 8.65, speed: 1.3, sub: 1 },
      { id: 'a3', seg: 'seg01', a: 14.92, b: 15.9, speed: 1, sub: 1, trans: 'dissolve', tdur: 0.3 },
      { id: 'a4', seg: 'seg01', a: 18.75, b: 21.4, speed: 3, sub: 2 },
      { id: 'a5', seg: 'seg01', a: 21.7, b: 24.55, speed: 3, sub: 2 },
      {
        id: 'a6', seg: 'seg01', a: 24.85, b: 27.3, speed: 1, sub: 2,
        cams: [{ at: 0.25, dur: 0.75, c: [576, 360], z: 1.25 }],
        fx: [
          { type: 'box', rect: [24, 249, 498, 56], color: 'blue', at: 1.0 },
          { type: 'box', rect: [664, 268, 662, 98], color: 'blue', at: 1.25 },
          { type: 'arrow', from: [522, 277], to: [662, 300], at: 1.35 },
        ],
      },
      { id: 'a7', seg: 'seg01', a: 33.3, b: 34.9, speed: 1.4, sub: 3, trans: 'dissolve', tdur: 0.25, cams: [{ at: 0, dur: 0.5, full: true }] },
      { id: 'a8', seg: 'seg01', a: 34.9, b: 36.2, speed: 1, sub: 3, cams: [{ at: 0.15, dur: 0.6, c: [720, 300], z: 1.35 }] },
      { id: 'a9', seg: 'seg01', a: 37.35, b: 38.95, speed: 2, sub: 3, cams: [{ at: 0, dur: 0.45, full: true }] },
      {
        id: 'a10', seg: 'seg01', a: 38.95, b: 40.95, speed: 1, sub: 3,
        cams: [{ at: 0.45, dur: 0.8, c: [870, 420], z: 1.3 }],
        fx: [{ type: 'box', rect: [518, 124, 700, 152], color: 'ink', at: 1.1 }],
      },
    ],
  },
  {
    num: '02',
    title: '补充依据，再重写',
    short: '补依据',
    subs: ['AI 重写', '标出待补充', '补充依据', '再写一版', '采纳'],
    captions: [
      { text: '缺少的数字，先补依据。', from: 'b6', to: 'b10:end' },
      { text: '补充的数字，记入事实库。', from: 'b14', to: 'b15:end' },
    ],
    clips: [
      { id: 'b1', seg: 'seg02', a: 2.1, b: 5.5, speed: 4, sub: 0, cams: [{ at: 0, dur: 0.5, full: true }] },
      {
        id: 'b2', seg: 'seg02', a: 6.9, b: 8.4, speed: 1, sub: 0,
        cams: [{ at: 0, dur: 0.6, c: [870, 390], z: 1.45 }],
        fx: [{ type: 'box', rect: [536, 448, 670, 58], color: 'ink', at: 0.35, until: 1.15 }],
      },
      { id: 'b3', seg: 'seg02', a: 11.55, b: 14.45, speed: 2, sub: 0, trans: 'dissolve', tdur: 0.25, cams: [{ at: 0, dur: 0.7, c: [880, 300], z: 1.55 }] },
      { id: 'b4', seg: 'seg02', a: 14.45, b: 17.6, speed: 6, sub: 0 },
      { id: 'b5', seg: 'seg02', a: 17.6, b: 19.0, speed: 1, sub: 0 },
      { id: 'b6', seg: 'seg02', a: 19.0, b: 24.0, speed: 4, sub: 1, cams: [{ at: 0.2, dur: 0.9, c: [886, 440], z: 1.3 }] },
      {
        id: 'b7', seg: 'seg02', a: 24.0, b: 26.2, speed: 1, sub: 1,
        fx: [
          { type: 'veil', rect: [568, 250, 626, 377], at: 0.15, until: 'b9:end' },
          { type: 'box', rect: [568, 250, 626, 377], color: 'orange', at: 0.15, until: 'b9:end' },
        ],
      },
      { id: 'b8', seg: 'seg02', a: 26.2, b: 29.2, speed: 1.36, sub: 2 },
      { id: 'b9', seg: 'seg02', a: 29.2, b: 36.1, speed: 2.4, sub: 2 },
      { id: 'b10', seg: 'seg02', a: 37.25, b: 38.4, speed: 1, sub: 3 },
      { id: 'b11', seg: 'seg02', a: 41.25, b: 43.5, speed: 1.4, sub: 3, trans: 'dissolve', tdur: 0.3, cams: [{ at: 0, dur: 0.7, c: [880, 400], z: 1.5 }] },
      {
        id: 'b12', seg: 'seg02', a: 43.5, b: 46.3, speed: 1, sub: 3,
        fx: [
          { type: 'box', rect: [560, 278, 640, 120], color: 'blue', at: 0.15 },
          { type: 'box', rect: [560, 497, 396, 32], color: 'ink', at: 1.0 },
        ],
      },
      { id: 'b13', seg: 'seg02', a: 54.45, b: 56.25, speed: 1.5, sub: 4, trans: 'dissolve', tdur: 0.2, cams: [{ at: 0, dur: 0.3, c: [880, 370], z: 1.5 }] },
      { id: 'b14', seg: 'seg02', a: 56.25, b: 59.65, speed: 3, sub: 4, cams: [{ at: 0.15, dur: 0.6, c: [870, 380], z: 1.2 }] },
      {
        id: 'b15', seg: 'seg02', a: 59.65, b: 62.95, speed: 1, sub: 4,
        cams: [{ at: 0.9, dur: 0.8, c: [868, 420], z: 1.55 }],
        fx: [
          { type: 'box', rect: [576, 302, 522, 34], color: 'ink', at: 1.5 },
          { type: 'box', rect: [536, 442, 670, 92], color: 'blue', at: 2.0 },
        ],
      },
    ],
  },
  {
    num: '03',
    title: '同一份经历，对准目标岗位',
    short: '对岗位',
    subs: ['粘贴岗位', '拆出要求', '对应经历', '确认选材', '选版式生成'],
    captions: [{ text: '按岗位要求，选择有依据的内容。', from: 'e3', to: 'e8:end' }],
    clips: [
      { id: 'e0', seg: 'seg03', a: 2.25, b: 2.95, speed: 1, sub: 0, trans: 'dissolve', tdur: 0.3, cams: [{ at: 0, dur: 0.3, full: true }] },
      { id: 'e1', seg: 'seg03', a: 4.15, b: 7.2, speed: 1.8, sub: 0, cams: [{ at: 0.55, dur: 0.6, c: [850, 410], z: 1.3 }] },
      { id: 'e2', seg: 'seg03', a: 8.6, b: 9.85, speed: 1.3, sub: 0 },
      {
        id: 'e3', seg: 'seg03', a: 12.35, b: 13.8, speed: 1, sub: 1, trans: 'dissolve', tdur: 0.3,
        cams: [{ at: 0, dur: 0.6, full: true }],
        fx: [{ type: 'box', rect: [308, 292, 370, 34], color: 'ink', at: 0.5 }],
      },
      { id: 'e4', seg: 'seg03', a: 17.3, b: 21.0, speed: 4, sub: 2 },
      {
        id: 'e5', seg: 'seg03', a: 21.0, b: 23.3, speed: 1, sub: 2,
        cams: [{ at: 0, dur: 0.7, c: [690, 300], z: 1.6 }],
        fx: [
          { type: 'box', rect: [306, 278, 300, 34], color: 'ink', at: 0.75 },
          { type: 'box', rect: [722, 280, 312, 50], color: 'ink', at: 1.0 },
          { type: 'arrow', from: [608, 295], to: [718, 298], at: 1.1 },
        ],
      },
      {
        id: 'e6', seg: 'seg03', a: 24.3, b: 28.6, speed: 3, sub: 3,
        cams: [{ at: 0, dur: 0.6, c: [926, 400], z: 1.4 }],
        fx: [{ type: 'box', rect: [1146, 246, 140, 252], color: 'ink', at: 0.9 }],
      },
      { id: 'e7', seg: 'seg03', a: 30.4, b: 36.9, speed: 4, sub: 3, cams: [{ at: 0, dur: 0.5, full: true }] },
      {
        id: 'e8', seg: 'seg03', a: 36.9, b: 37.9, speed: 1, sub: 3,
        cams: [{ at: 0, dur: 0.5, c: [690, 270], z: 1.5 }],
        fx: [{ type: 'box', rect: [308, 212, 764, 84], color: 'blue', at: 0.3 }],
      },
      { id: 'e9', seg: 'seg03', a: 39.35, b: 41.1, speed: 2, sub: 4, cams: [{ at: 0, dur: 0.5, full: true }] },
      { id: 'e10', seg: 'seg03', a: 42.8, b: 44.4, speed: 2, sub: 4 },
      { id: 'e11', seg: 'seg03', a: 45.9, b: 47.2, speed: 1.6, sub: 4 },
      { id: 'e12', seg: 'seg03', a: 49.1, b: 51.6, speed: 1.8, sub: 4 },
    ],
  },
  {
    num: '04',
    title: '好表达，留下来复用',
    short: '存回库',
    subs: ['改一句', '预览同步', '存回事实库', '导出'],
    captions: [
      { text: '存为新表达，下次写简历继续用。', from: 'f4', to: 'f5:end' },
      { text: '原事实不变，其他简历不会自动改。', from: 'f6', to: 'f7:end' },
    ],
    clips: [
      { id: 'f1', seg: 'seg04', a: 2.6, b: 6.6, speed: 3, sub: 0, cams: [{ at: 0, dur: 0.01, full: true }] },
      { id: 'f2', seg: 'seg04', a: 6.7, b: 10.2, speed: 1.5, sub: 0, cams: [{ at: 0, dur: 0.6, c: [640, 420], z: 1.15 }] },
      {
        id: 'f3', seg: 'seg04', a: 10.2, b: 12.1, speed: 1, sub: 1,
        fx: [
          { type: 'box', rect: [40, 256, 392, 126], color: 'blue', at: 0.05 },
          { type: 'box', rect: [648, 520, 610, 62], color: 'blue', at: 0.35 },
          { type: 'arrow', from: [434, 320], to: [644, 540], at: 0.45 },
        ],
      },
      { id: 'f4', seg: 'seg04', a: 14.2, b: 15.75, speed: 1.3, sub: 2 },
      {
        id: 'f5', seg: 'seg04', a: 15.75, b: 18.65, speed: 1, sub: 2,
        cams: [{ at: 0.1, dur: 0.7, c: [720, 405], z: 1.15 }],
        fx: [{ type: 'box', rect: [448, 182, 404, 30], color: 'ink', at: 0.7 }],
      },
      {
        id: 'f6', seg: 'seg04', a: 19.8, b: 21.6, speed: 1.2, sub: 2,
        cams: [{ at: 0.65, dur: 0.6, c: [480, 330], z: 1.5 }],
        fx: [{ type: 'box', rect: [256, 396, 76, 26], color: 'ink', at: 1.05 }],
      },
      {
        id: 'f7', seg: 'seg04', a: 34.3, b: 35.9, speed: 1.2, sub: 3, trans: 'dissolve', tdur: 0.25,
        cams: [{ at: 0, dur: 0.55, full: true }],
        fx: [{ type: 'box', rect: [1104, 84, 112, 28], color: 'ink', at: 0.85 }],
      },
    ],
  },
]

/** 「虚构示例数据」角标与压测记录卡（视频包装，不是产品界面） */
export const RECORD = {
  cardFrom: 'b8', // 居中展示
  dockAt: 'b9', // 停靠到右侧，输入时对照
  cardTo: 'b10:end',
  badgeFrom: 'b8',
  badgeTo: 'f7:end',
  title: '报名接口压测记录（优化后）',
  rows: [
    ['吞吐量', '约 1500 QPS'],
    ['P95 延迟', '约 60 ms'],
    ['异常率', '低于 0.1%'],
  ],
  note: '演示用户手动填入，非 AI 生成',
}

/** 结尾三个节点用到的真实画面截帧（源视频秒数 + CSS 裁切区域） */
export const OUTRO_THUMBS = {
  library: { seg: 'seg04', t: 58.5, crop: [500, 60, 720, 450] },
  job: { seg: 'seg03', t: 22.6, crop: [296, 150, 760, 475] },
}

/** 把相对片段的时间（如 'b9:end'、'b7'）换成全片时间，并为每个片段排好起止 */
export function build() {
  let t = OPS_START
  const clips = []
  for (const [si, step] of STEPS.entries()) {
    step.index = si
    step.start = t
    for (const c of step.clips) {
      c.step = si
      c.dur = (c.b - c.a) / c.speed
      c.start = t
      t += c.dur
      c.end = t
      clips.push(c)
    }
    step.end = t
  }
  const byId = Object.fromEntries(clips.map((c) => [c.id, c]))
  const ref = (r, base) => {
    if (typeof r === 'number') return base + r
    const [id, which] = String(r).split(':')
    const c = byId[id]
    if (!c) throw new Error(`unknown clip ref ${r}`)
    return which === 'end' ? c.end : c.start
  }
  for (const step of STEPS) for (const cap of step.captions) {
    cap.t0 = ref(cap.from)
    cap.t1 = ref(cap.to)
  }
  for (const c of clips) for (const f of c.fx ?? []) {
    f.t0 = c.start + (f.at ?? 0)
    f.t1 = f.until === undefined ? c.end : typeof f.until === 'number' ? c.start + f.until : ref(f.until)
  }
  const rec = { ...RECORD, t0: ref(RECORD.cardFrom), tDock: ref(RECORD.dockAt), t1: ref(RECORD.cardTo), b0: ref(RECORD.badgeFrom), b1: ref(RECORD.badgeTo) }
  return { clips, byId, opsEnd: t, record: rec }
}
