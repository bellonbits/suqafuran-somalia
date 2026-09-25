import json
from deep_translator import GoogleTranslator

def run():
    categories = []
    
    from app.seed_categories import CATEGORIES
    
    for cat in CATEGORIES:
        categories.append(cat["name"])
        for sub in cat["subcategories"]:
            categories.append(sub["name"])

    all_names = list(set(categories))

    translator = GoogleTranslator(source="en", target="so")
    
    result = {}
    for name in all_names:
        try:
            val = translator.translate(name)
            result[name] = val
        except Exception as e:
            result[name] = name
            
    print("---JSON_START---")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("---JSON_END---")

if __name__ == "__main__":
    run()
