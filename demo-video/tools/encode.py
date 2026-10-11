# 把一段录制（JPEG 帧 + 时间戳）编码成恒定 30fps 的 MP4，并导出以视频秒数计的标记和鼠标轨迹
import json, subprocess, sys, os
take = sys.argv[1]
out_dir = sys.argv[2]
name = os.path.basename(take.rstrip('/'))
d = json.load(open(os.path.join(take, 'take.json')))
t0 = d['t0']
end = next(m['t'] for m in d['markers'] if m['name'] == 'end')
from PIL import Image
W = d['width'] * d['dsf']
frames = [f for f in sorted(d['frames'], key=lambda f: f['t']) if Image.open(os.path.join(take, 'frames', f['file'])).size[0] == W]
items = []
for f in frames:
    s = (f['t'] - t0) / 1000
    if s <= 0:
        items = [(0.0, f['file'])]
        continue
    if items and s - items[-1][0] < 0.001:
        items[-1] = (items[-1][0], f['file'])
        continue
    items.append((s, f['file']))
if items[0][0] > 0:
    items[0] = (0.0, items[0][1])
dur_end = (end - t0) / 1000
lst = os.path.join(take, 'concat.txt')
with open(lst, 'w') as fh:
    for i, (s, file) in enumerate(items):
        nxt = items[i + 1][0] if i + 1 < len(items) else dur_end
        fh.write(f"file 'frames/{file}'\nduration {max(nxt - s, 0.001):.4f}\n")
    fh.write(f"file 'frames/{items[-1][1]}'\n")
os.makedirs(out_dir, exist_ok=True)
mp4 = os.path.join(out_dir, f'{name}.mp4')
subprocess.run(['/Users/lyris/Downloads/shili-demo/tools/ffmpeg.sh', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                '-fps_mode', 'cfr', '-r', '30', '-t', f'{dur_end:.3f}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], check=True)
meta = {
    'video': f'{name}.mp4', 'fps': 30, 'duration': round(dur_end, 3),
    'viewport_css': [d['width'], d['height']], 'device_scale_factor': d['dsf'], 'video_px': [d['width'] * d['dsf'], d['height'] * d['dsf']],
    'note': '时间单位为视频秒；坐标单位为 CSS 像素（乘以 device_scale_factor 得到视频像素）',
    'markers': [{k: (round((v - t0) / 1000, 3) if k == 't' else v) for k, v in m.items()} for m in d['markers']],
    'mouse': [{'t': round((m['t'] - t0) / 1000, 3), 'x': round(m['x'], 1), 'y': round(m['y'], 1), 'k': m['k']} for m in d['mouse']],
}
json.dump(meta, open(os.path.join(out_dir, f'{name}.json'), 'w'), ensure_ascii=False, indent=1)
print(name, 'ok', round(dur_end, 1), 's', os.path.getsize(mp4) // 1024 // 1024, 'MB')
