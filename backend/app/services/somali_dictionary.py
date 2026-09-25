"""
Somali marketplace dictionary — spellings verified against
Qaamuuska Af-Soomaaliga (Puglielli & Mansuur, RomaTre-Press 2012).
Used for post-processing AI translations and as few-shot context.
"""

# ── English → Somali marketplace dictionary ──────────────────────────────────
# Each entry: "english phrase/word": "somali equivalent"
# Verified spellings sourced from the dictionary (page numbers in comments).

EN_SO: dict[str, str] = {

    # ── Animals / Livestock (xoolaha) ────────────────────────────────────────
    "camel":          "geel",          # p.30
    "camels":         "geel",
    "goat":           "ari",
    "goats":          "ari",
    "male goat":      "orgi",
    "female goat":    "riyo",
    "sheep":          "idhi",
    "lamb":           "waran",
    "cow":            "lo'",           # p.111
    "cows":           "lo'",
    "bull":           "dibi",          # p.266
    "ox":             "dibi",
    "donkey":         "dameer",        # p.86
    "horse":          "faras",
    "chicken":        "digaag",
    "chickens":       "digaag",
    "rooster":        "dooro lab",
    "hen":            "dooro",
    "cat":            "bisad",
    "dog":            "eey",
    "livestock":      "xoolaha",       # p.69
    "animals":        "xoolaha",

    # ── Vehicles (gaadiidka) ─────────────────────────────────────────────────
    "car":            "gaari",         # p.893
    "cars":           "gaari",
    "vehicle":        "gaari",
    "truck":          "baabuur",       # p.69
    "lorry":          "baabuur",
    "bus":            "bas",           # p.95
    "minibus":        "minibas",
    "motorcycle":     "mootoorad",
    "bike":           "baaskiil",      # p.74
    "bicycle":        "baaskiil",
    "boat":           "dooni",
    "ship":           "markab",
    "airplane":       "diyaarad",      # p.284 (also dayuurad)
    "pickup":         "gaari qaado",
    "tractor":        "tiraaktar",

    # ── Property (hantida) ───────────────────────────────────────────────────
    "house":          "guri",          # p.52
    "home":           "guri",
    "apartment":      "flet",
    "flat":           "flet",
    "room":           "qol",           # p.709
    "rooms":          "qolal",
    "land":           "dhul",          # p.37
    "plot":           "dhul",
    "farm":           "beer",          # p.11
    "warehouse":      "kaydka",
    "shop":           "dukaan",        # p.349
    "store":          "dukaan",
    "office":         "xafiis",
    "building":       "dhismo",

    # ── Electronics & Appliances ─────────────────────────────────────────────
    "phone":          "telefoon",
    "mobile":         "mobayl",
    "smartphone":     "telefoon casri ah",
    "television":     "telefishon",
    "tv":             "telefishon",
    "radio":          "raadiyow",
    "laptop":         "koombiyuutar gacmeed",
    "computer":       "koombiyuutar",
    "fridge":         "firiij",
    "refrigerator":   "firiij",
    "washing machine":"mishiinka dhaqista",
    "generator":      "jenereetar",
    "solar panel":    "celceliska qorraxda",
    "battery":        "baatiri",

    # ── Furniture & Home ─────────────────────────────────────────────────────
    "bed":            "sariir",
    "sofa":           "kursi",
    "chair":          "kursi",
    "table":          "miis",
    "mattress":       "godob",
    "carpet":         "xaasid",
    "fan":            "marwaxad",

    # ── Food & Agriculture ───────────────────────────────────────────────────
    "vegetables":     "khudaar",
    "fruit":          "midho",
    "rice":           "bariis",
    "sugar":          "sonkor",
    "flour":          "daqiiq",
    "oil":            "saliid",
    "milk":           "caano",
    "meat":           "hilib",
    "fish":           "kalluun",
    "eggs":           "ukun",
    "water":          "biyo",

    # ── Clothing & Fashion ───────────────────────────────────────────────────
    "clothes":        "dharka",
    "dress":          "qamiis",
    "shoes":          "kabo",
    "bag":            "bac",
    "watch":          "saacad",
    "gold":           "dahab",
    "silver":         "lacag cad",
    "jewellery":      "xidho",

    # ── Commerce & Pricing ───────────────────────────────────────────────────
    "for sale":       "iib ah",        # iib p.135
    "selling":        "la iibinayo",
    "buy":            "iibso",
    "price":          "qiimo",         # p.707
    "money":          "lacag",         # p.488
    "cheap":          "jaban",         # p.888
    "affordable":     "qiimo jaban",
    "expensive":      "qaali",
    "rent":           "kiro",          # p.537
    "for rent":       "kiro ah",
    "lease":          "kiro",
    "wanted":         "la raadinayo",
    "negotiable":     "waa la xoojin karaa",
    "fixed price":    "qiimo go'an",
    "discount":       "qiimo dhimis",
    "payment":        "lacag bixin",
    "cash":           "lacag diyaar ah",
    "delivery":       "gaarsiin",

    # ── Conditions ───────────────────────────────────────────────────────────
    "new":            "cusub",         # p.159
    "brand new":      "cusub oo dhan",
    "used":           "la isticmaalay",
    "second hand":    "la isticmaalay",
    "good condition": "xaalad wanaagsan",  # wanaagsan p.29
    "excellent":      "aad u wanaagsan",
    "refurbished":    "la hagaajiyey",
    "broken":         "xun",
    "working":        "shaqeynaya",

    # ── Urgency & Time ───────────────────────────────────────────────────────
    "urgent":         "deg deg",       # deg p.221
    "today":          "maanta",
    "daily":          "maalin kasta",
    "weekly":         "usbuucba",
    "available":      "la heli karaa",
    "immediately":    "isla markiiba",

    # ── Jobs & Services ──────────────────────────────────────────────────────
    "job":            "shaqo",         # p.211
    "work":           "shaqo",
    "service":        "adeeg",
    "driver":         "darawal",
    "repair":         "hagaajin",
    "cleaning":       "nadiifin",
    "teaching":       "waxbarasho",

    # ── Locations ────────────────────────────────────────────────────────────
    "mogadishu":      "Muqdisho",
    "hargeisa":       "Hargeysa",
    "kismayo":        "Kismaayo",
    "garowe":         "Garoowe",
    "baidoa":         "Baydhabo",
    "nairobi":        "Nairobi",

    # ── Common Adjectives ────────────────────────────────────────────────────
    "good":           "wanaagsan",     # p.29
    "great":          "aad u wanaagsan",
    "big":            "weyn",
    "small":          "yar",
    "clean":          "nadiif",
    "fast":           "deg deg",
    "original":       "asli ah",
    "genuine":        "run ah",

    # ── Numbers (plurals used in marketplace) ────────────────────────────────
    "1 bedroom":      "1 qol",
    "2 bedroom":      "2 qol",
    "3 bedroom":      "3 qol",
    "4 bedroom":      "4 qol",
    "1 room":         "1 qol",
    "2 rooms":        "2 qolal",
    "3 rooms":        "3 qolal",
}

# ── Phrase-level templates (for generating natural Somali listings) ──────────
LISTING_TEMPLATES: dict[str, str] = {
    "{item} for sale":                  "{item} iib ah",
    "{item} for sale in {location}":    "{item} iib ah {location}",
    "{item} for rent":                  "{item} kiro ah",
    "{item} for rent in {location}":    "{item} kiro ah {location}",
    "selling {item}":                   "{item} la iibinayo",
    "{n} bedroom house for rent":       "Guri {n} qol ah oo kiro ah",
    "{n} bedroom house for sale":       "Guri {n} qol ah oo iib ah",
    "{item} brand new":                 "{item} cusub oo dhan",
    "{item} good condition":            "{item} xaalad wanaagsan",
    "{item} used":                      "{item} la isticmaalay",
    "{item} cheap":                     "{item} jaban",
    "urgent {item}":                    "{item} deg deg",
    "fresh {item} daily":               "{item} cusub maalin kasta",
}

# ── Few-shot examples injected into AI prompts ───────────────────────────────
FEW_SHOT_EXAMPLES: list[tuple[str, str]] = [
    ("Camel for sale in Mogadishu",           "Geel iib ah Muqdisho"),
    ("2 goats selling urgent",                "2 ari oo iib ah deg deg"),
    ("Cow for sale cheap",                    "Lo' iib ah oo jaban"),
    ("Horse in good condition",               "Faras xaalad wanaagsan"),
    ("Toyota Hilux 2018 good condition",      "Toyota Hilux 2018 xaalad wanaagsan"),
    ("Toyota Prado for sale",                 "Toyota Prado iib ah"),
    ("3 bedroom house for rent cheap",        "Guri 3 qol ah oo kiro ah oo jaban"),
    ("Shop for rent in Hargeisa",             "Dukaan kiro ah Hargeysa"),
    ("Land for sale in Kismayo",              "Dhul iib ah Kismaayo"),
    ("iPhone 14 brand new",                   "iPhone 14 cusub oo dhan"),
    ("Samsung TV 55 inch brand new",          "Telefishon Samsung 55 inch cusub"),
    ("Laptop for sale used",                  "Koombiyuutar gacmeed iib ah oo la isticmaalay"),
    ("Fresh vegetables daily delivery",       "Khudaar cusub gaarsiin maalin kasta"),
    ("Rice 50kg bag for sale",                "Bariis 50kg iib ah"),
    ("Job available driver wanted",           "Shaqo darawal la raadinayo"),
    ("Phone repair service",                  "Adeegga hagaajinta telefoonka"),
    ("Generator for sale good condition",     "Jenereetar iib ah xaalad wanaagsan"),
    ("Gold jewellery brand new",              "Xidho dahab cusub"),
    ("Sofa set for sale",                     "Kursi iib ah"),
    ("Fridge working perfectly",              "Firiij shaqeynaya si fiican"),
]


def build_few_shot_prompt() -> str:
    """Return a formatted few-shot string for injection into the system prompt."""
    lines = ["Verified English → Somali marketplace examples:"]
    for en, so in FEW_SHOT_EXAMPLES:
        lines.append(f'  "{en}" → "{so}"')
    return "\n".join(lines)


def build_dictionary_prompt() -> str:
    """Return key dictionary entries as a compact reference for the AI."""
    sections = {
        "Animals": ["camel", "goat", "cow", "sheep", "horse", "chicken", "donkey", "bull"],
        "Vehicles": ["car", "truck", "motorcycle", "bus", "bicycle"],
        "Property": ["house", "apartment", "room", "land", "shop", "farm"],
        "Commerce": ["for sale", "for rent", "cheap", "negotiable", "brand new", "used", "good condition", "urgent"],
        "Electronics": ["phone", "television", "laptop", "fridge", "generator"],
    }
    lines = ["Somali marketplace vocabulary (dictionary-verified):"]
    for section, keys in sections.items():
        entries = ", ".join(f"{k}={EN_SO[k]}" for k in keys if k in EN_SO)
        lines.append(f"  {section}: {entries}")
    return "\n".join(lines)
