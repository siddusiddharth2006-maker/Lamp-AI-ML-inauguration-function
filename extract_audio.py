"""
Extract audio from LAMP LIGHTING VIDEO HD.MOV → bg_music.mp3
Tries moviepy first, then falls back to imageio-ffmpeg bundled binary.
"""
import sys
import os

src = r"c:\Users\Admin\Desktop\lamp\LAMP LIGHTING VIDEO HD.MOV"
out = r"c:\Users\Admin\Desktop\lamp\bg_music.mp3"

if not os.path.exists(src):
    print(f"ERROR: Source file not found: {src}")
    sys.exit(1)

try:
    from moviepy import VideoFileClip
    print("Using moviepy...")
    with VideoFileClip(src) as clip:
        if clip.audio is None:
            print("ERROR: Video has no audio track.")
            sys.exit(1)
        clip.audio.write_audiofile(out, codec='mp3', bitrate='192k', logger=None)
    print(f"SUCCESS: Audio extracted to {out}")
except Exception as e:
    print(f"moviepy failed: {e}")
    # Try with imageio-ffmpeg binary path
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        import subprocess
        result = subprocess.run(
            [ffmpeg_exe, "-y", "-i", src, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", out],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print(f"SUCCESS via ffmpeg binary: {out}")
        else:
            print(f"ffmpeg stderr: {result.stderr[-2000:]}")
    except Exception as e2:
        print(f"Both methods failed: {e2}")
        sys.exit(1)
