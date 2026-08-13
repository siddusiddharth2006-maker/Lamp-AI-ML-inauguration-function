import os
import sys

file_path = "bg_music.mp3"
if not os.path.exists(file_path):
    print("File does not exist")
    sys.exit(1)

size = os.path.getsize(file_path)
print(f"File size: {size} bytes")

# Read first 100 bytes and look for ID3 or frame sync
with open(file_path, "rb") as f:
    header = f.read(100)
    print("Header bytes:", header[:20])
    # Standard MP3 files usually start with ID3 (49 44 33 / 'ID3') or frame sync (0xFF 0xFB)
    if header.startswith(b"ID3"):
        print("Starts with ID3 header. Looks valid.")
    elif header.startswith(b"\xff\xfb") or header.startswith(b"\xff\xf3") or header.startswith(b"\xff\xfa"):
        print("Starts with MPEG audio frame sync. Looks valid.")
    else:
        print("Warning: Unknown header bytes.")
