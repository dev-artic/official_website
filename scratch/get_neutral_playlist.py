import urllib.request
import re
import json

url = "https://www.youtube.com/playlist?list=PL5pgihOzM4-QUtVSXe1k5EilGNAWifH_c"
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
    
    # Try to find ytInitialData
    pattern = re.compile(r'var ytInitialData = ({.*?});', re.DOTALL)
    match = pattern.search(html)
    if match:
        data = json.loads(match.group(1))
        
        # Navigate to playlist contents
        # Structure is deep, let's recursively find playlistVideoRenderer
        def find_videos(obj):
            if isinstance(obj, dict):
                if "playlistVideoRenderer" in obj:
                    yield obj["playlistVideoRenderer"]
                else:
                    for key, val in obj.items():
                        yield from find_videos(val)
            elif isinstance(obj, list):
                for item in obj:
                    yield from find_videos(item)
                    
        videos = list(find_videos(data))
        print(f"Found {len(videos)} videos in playlist:")
        for idx, video in enumerate(videos):
            title = video.get("title", {}).get("runs", [{}])[0].get("text", "Unknown Title")
            video_id = video.get("videoId")
            # Usually length text is there
            length = video.get("lengthText", {}).get("simpleText", "Unknown Length")
            print(f"{idx+1}: ID={video_id} | Title={title} | Length={length}")
            
    else:
        print("ytInitialData not found")
except Exception as e:
    print(f"Error: {e}")
