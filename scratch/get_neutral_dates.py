import urllib.request
import re
import time

video_ids = [
    "yyXvMtWSN9I", "jR6iLjU2wi0", "XveXyq4gEz8", "A2p4Hw0X-1o",
    "GcpbOMRWAE8", "reZm4AutbbA", "9ctpxn-gZX0", "IQuNZtS3Nig",
    "6Rj8X_gNz_M", "O0MMYBcam-Q", "wOLgFdlg0qE", "3_8sWvUJ0zI",
    "siOVsCwY-vY", "a_c4edU0Ly8", "X8r2fg3240I"
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

print("Fetching publish dates for playlist videos...")
for vid in video_ids:
    url = f"https://www.youtube.com/watch?v={vid}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
        
        # Search for uploadDate or publishDate in HTML
        match = re.search(r'"uploadDate":"([^"]+)"', html)
        if match:
            date_str = match.group(1).split('T')[0]
            print(f"ID={vid} | Date={date_str}")
        else:
            # Try alternate publishDate
            match2 = re.search(r'"publishDate":"([^"]+)"', html)
            if match2:
                date_str = match2.group(1).split('T')[0]
                print(f"ID={vid} | Date={date_str}")
            else:
                # Try finding in raw text
                match3 = re.search(r'itemprop="datePublished" content="([^"]+)"', html)
                if match3:
                    print(f"ID={vid} | Date={match3.group(1)}")
                else:
                    print(f"ID={vid} | Date=Not Found")
        
        # Sleep to be polite to YouTube
        time.sleep(0.5)
    except Exception as e:
        print(f"ID={vid} | Error={e}")
