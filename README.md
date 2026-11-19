# Cinema

Pipeline dựng phim tài liệu tiếng Việt từ chủ đề hoặc storyboard JSON. Codex CLI viết kịch bản và chỉ đạo hình ảnh. VieNeu tổng hợp giọng đọc bằng ONNX trên CPU. Remotion dựng hình, sau đó FFmpeg và FFprobe kiểm tra MP4.

## Cài trên macOS

Cần Node.js 20+, Python 3.11, FFmpeg có FFprobe và Codex CLI đăng nhập qua ChatGPT để tạo chủ đề mới. Trên máy dùng Homebrew, có thể cài FFmpeg với `brew install ffmpeg`. VieNeu Nano dùng CPU và phù hợp cho lần chạy đầu trên Apple Silicon. Lần đầu cần mạng để tải dependencies, Chrome Headless Shell và trọng số VieNeu. Xem cấu hình được hỗ trợ ở [tài liệu VieNeu](https://github.com/pnnbao97/VieNeu-TTS) và [tài liệu Remotion](https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell).

```bash
npm ci
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-tts.txt
chmod +x scripts/create-video.sh
```

## Dựng video

```bash
# Dựng lại tập phim mẫu với giọng đọc bắt buộc
./scripts/create-video.sh --storyboard storyboards/ocean.json --require-voice --output output/ocean.mp4

# Tạo storyboard và video từ chủ đề mới
./scripts/create-video.sh "Vì sao có thủy triều?" --output output/thuy-trieu.mp4

# Chỉ làm storyboard, kịch bản, phụ đề và đồng bộ WAV
./scripts/create-video.sh "Vì sao có thủy triều?" --prepare-only

# Kiểm tra hình ảnh trong Remotion Studio
npm run studio
```

Trong PowerShell, dùng `node scripts/create-video.mjs` với cùng đối số. Khi Node 22 gặp lỗi chứng chỉ do Windows dùng CA hệ thống, đặt `$env:NODE_USE_SYSTEM_CA='1'` trước khi tải trình duyệt lần đầu.

- `--silent` tạo bản không có âm thanh và dùng thời lượng đọc ước tính theo câu. `--previews-only` xuất frame kiểm tra.
- `--require-voice` dừng nếu VieNeu lỗi. Lệnh mặc định tiếp tục với hình ảnh, phụ đề ước tính và nhạc nền nếu storyboard có nhạc.
- `--duration` nhận thời lượng nguyên từ 60 đến 600 giây. Pipeline kiểm tra tổng thời lượng storyboard và giữ đúng số khung hình sau khi đo lời dẫn. `--brief FILE` truyền ghi chú biên tập và thông tin tài sản cho Codex khi tạo chủ đề mới.
- `--output` chọn đích MP4. Mặc định là `output/documentary.mp4`. `--force` cho phép thay thế video sau khi bản mới vượt qua kiểm tra.
- `CODEX_BIN` chọn tệp thực thi CLI. `CODEX_MODEL` chọn mô hình mà tài khoản ChatGPT hỗ trợ. `VIENEU_PYTHON` chọn Python khác nếu cần.
- Mặc định dùng `VIENEU_MODE=v3nano` và giọng `Minh Quân`. Đặt `VIENEU_MODE=v3turbo` để dùng Turbo CPU với giọng mặc định `Phạm Tuyên`. `VIENEU_VOICE` chọn giọng có sẵn tương thích với mô hình.
- `FFMPEG` và `FFPROBE` chỉ định đường dẫn thực thi. `--concurrency` điều chỉnh số worker Remotion.

Tiến trình ghi log theo bước. Mỗi chủ đề lưu lại storyboard trong `output/work/<id>/`. Có thể chỉnh JSON ở đó và chạy lại lệnh, hoặc truyền tệp qua `--storyboard`. VieNeu dùng lại đoạn WAV theo giọng đọc, chế độ và nội dung câu. Khi render thất bại, chạy lại cùng lệnh sẽ dùng các mốc này.

Thư mục làm việc gồm `script.vi.md`, `subtitles.vi.srt`, `props.json`, `previews/` và `review.json`. Nếu có voiceover, `public/runs/<id>/` chứa một WAV trên mỗi cảnh. Có thể mở Studio với props từ một lần chạy qua `npm run studio -- --props=output/work/<id>/props.json`.

## Storyboard và nguồn

Tập mẫu dùng `storyboards/ocean.json` và `storyboards/storyboard.schema.json`. Storyboard theo chủ đề mới chọn preset minh họa; có thể bổ sung ảnh và nhạc có quyền sử dụng bằng đường dẫn tương đối với `public/`. `factChecks` ghi dữ kiện đã kiểm chứng, điểm cần kiểm chứng và câu hỏi nghiên cứu còn mở. Phụ đề dùng thời gian của từng câu tiếng Việt. Xem nguồn tư liệu tại [CREDITS.md](storyboards/CREDITS.md).
