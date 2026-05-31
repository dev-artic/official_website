import urllib.request
import re
import json

video_ids = [
    "ZfD84TkNXGw",
    "CyLnWaJIEhw",
    "qBF9UpEug_c",
    "7_0BYN3TUus",
    "vhjjEAU6wRA",
    "OawNyCoAHpc",
    "3OyKOqX1tgU"
]

results = {}

for vid in video_ids:
    url = f"https://www.youtube.com/watch?v={vid}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
        
        # Look for upload date
        # Search for date in meta tags
        date_match = re.search(r'itemprop="datePublished"\s+content="([^"]+)"', html)
        if not date_match:
            date_match = re.search(r'"publishDate":"([^"]+)"', html)
        if not date_match:
            date_match = re.search(r'\\x22publishDate\\x22:\\x22([^"\\]+)\\x22', html)
        if not date_match:
            date_match = re.search(r'"uploadDate":"([^"]+)"', html)
            
        date_str = date_match.group(1) if date_match else "unknown"
        results[vid] = date_str
    except Exception as e:
        results[vid] = f"error: {str(e)}"

print(json.dumps(results, indent=2))
