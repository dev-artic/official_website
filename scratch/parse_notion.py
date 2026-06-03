import json

output_path = "/Users/minje/.gemini/antigravity/brain/cb6b594a-9879-4961-846b-0df33fc8b311/.system_generated/steps/2117/output.txt"
db_id = "653b6d15-ac9b-4ea3-b284-da77852f424e"

with open(output_path, "r", encoding="utf-8") as f:
    data = json.load(f)

results = data.get("results", [])
matched_pages = []

for page in results:
    parent = page.get("parent", {})
    if parent.get("type") == "database_id" and parent.get("database_id") == db_id:
        # Extract title
        properties = page.get("properties", {})
        title_prop = properties.get("") or properties.get("title") or {}
        title_list = title_prop.get("title", [])
        title = title_list[0].get("plain_text") if title_list else "(No Title)"
        
        # Extract Q and year
        q_prop = properties.get("Q", {})
        q_val = q_prop.get("formula", {}).get("string", "") or ""
        
        year_prop = properties.get("연도", {})
        year_val = year_prop.get("formula", {}).get("number", "") or ""
        
        archiving_prop = properties.get("아카이빙일", {})
        archiving_val = archiving_prop.get("date", {}) or {}
        archiving_date = archiving_val.get("start", "") if archiving_val else ""
        
        confirm_prop = properties.get("업로드 확정", {})
        confirm_val = confirm_prop.get("checkbox", False)

        matched_pages.append({
            "id": page.get("id"),
            "title": title,
            "quarter": q_val,
            "year": year_val,
            "archiving_date": archiving_date,
            "confirmed": confirm_val,
            "url": page.get("url")
        })

print(f"Total matched pages: {len(matched_pages)}")
print(json.dumps(matched_pages, indent=2, ensure_ascii=False))
