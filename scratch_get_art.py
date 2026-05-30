import urllib.request
import re
import sys

url = "https://www.melon.com/album/detail.htm?albumId=11475004"
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
)

try:
    print("Fetching Melon album page...")
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
    
    # Melon cdn image pattern: usually cdnimg.melon.co.kr/music/album/images/...
    # Let's search for this pattern in the HTML source
    img_urls = re.findall(r'https?://[a-zA-Z0-9\-\.]*melon\.co\.kr/music/album/images/[^\s"\'<>]+_500\.jpg', html)
    if not img_urls:
        # Fallback to any melon image inside the album directory
        img_urls = re.findall(r'https?://[a-zA-Z0-9\-\.]*melon\.co\.kr/music/album/images/[^\s"\'<>]+', html)

    if img_urls:
        selected_url = img_urls[0]
        # Ensure it has standard formatting
        selected_url = selected_url.replace("&amp;", "&")
        print(f"Found cover artwork on Melon! URL: {selected_url}")
        
        # Download and overwrite album-art.png
        # Some CDNs block default Python user agents for image downloads, so we use urllib.request with headers
        img_req = urllib.request.Request(selected_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(img_req) as img_response:
            with open("deus-ex-machina/album-art.png", "wb") as f:
                f.write(img_response.read())
        
        print("Successfully downloaded and updated 'deus-ex-machina/album-art.png' from Melon.")
        sys.exit(0)
    else:
        print("Could not find any album cover images in Melon HTML source.")
        sys.exit(1)

except Exception as e:
    print(f"Error occurred: {e}")
    sys.exit(1)
