import logging
import re
from groq import Groq
from fastapi import HTTPException
from app.core.config import settings
from app.services.somali_dictionary import EN_SO, build_dictionary_prompt, build_few_shot_prompt

logger = logging.getLogger(__name__)


def apply_somali_dictionary(text: str) -> str:
    """Post-process AI output: enforce dictionary-verified Somali terms."""
    for en, so in EN_SO.items():
        text = re.sub(rf'\b{re.escape(en)}\b', so, text, flags=re.IGNORECASE)
    return text

class AIService:
    def __init__(self):
        api_key = settings.GROQ_API_KEY
        if not api_key:
            logger.warning("GROQ_API_KEY is not set. AI features will not work.")
            self.client = None
        else:
            self.client = Groq(api_key=api_key)

        self.model = settings.GROQ_MODEL
        self.translate_model = settings.GROQ_TRANSLATE_MODEL

    def generate_listing_text(self, type: str, input_text: str, target_language: str = "en", category: str = None, attributes: dict = None) -> str:
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")
        
        if not input_text or len(input_text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Input text cannot be empty")
        
        # Simple moderation: length check
        if len(input_text) > 2000:
            raise HTTPException(status_code=400, detail="Input text is too long")

        logger.info(f"AI Service called. Type: {type}, Lang: {target_language}")

        system_prompt = """
You are an AI assistant for a classifieds marketplace in Africa.

Rules:
- Write clear, natural, human-like text
- Avoid exaggeration or spammy words
- Be concise but informative
- Use simple English or Somali depending on request
- Keep listings realistic and trustworthy
- Remove any obvious phone numbers, emails, or scam-like phrases
"""

        if type == "title":
            user_prompt = f"""
Improve this listing title for a {category or 'general'} product.

Input:
{input_text}

Return only one clean, high-quality title. Do not include quotes or conversational filler.
"""

        elif type == "description":
            attrs_str = ", ".join([f"{k}: {v}" for k, v in attributes.items()]) if attributes else "None"
            user_prompt = f"""
Write a professional marketplace description based on the user's input.

Category: {category or 'general'}
Details: {attrs_str}

User Input:
{input_text}

Make it:
- Clear
- Well-structured
- Trustworthy
- Not too long
- Do NOT include any phone numbers or email addresses in the output.
"""

        elif type == "translate":
            is_somali = target_language.lower() in ["so", "somali"]
            is_swahili = target_language.lower() in ["sw", "swahili"]
            lang_name = "Somali" if is_somali else "Swahili" if is_swahili else target_language

            system_prompt = f"""
You are an advanced multilingual AI assistant for an African marketplace.
Your job is NOT just to translate — you LOCALIZE content intelligently for real traders.

Core Rules:
- Understand the meaning, context, and product type before translating
- Use ONLY the verified Somali vocabulary listed below
- Prefer natural expressions used by real East African traders
- NEVER do literal word-for-word translation if it sounds unnatural
- Output ONLY the final translated text — no explanations, no quotes

{build_dictionary_prompt()}

{build_few_shot_prompt()}

Output Style:
- Short, clean, natural — sounds like a real seller wrote it
- No explanations, no filler text, no quotes
"""

            user_prompt = f"""
Category: {category or "general"}

Translate and LOCALIZE this marketplace listing into natural {lang_name}:

{input_text}

Instructions:
- Detect the product/item and translate it correctly using marketplace vocabulary
- Use real seller language (Jiji/marketplace style)
- Keep it short and natural
- Preserve the meaning exactly — do NOT add or remove information
- Return ONLY the final translated text, nothing else
"""

        else:
            raise HTTPException(status_code=400, detail="Invalid generation type. Must be 'title', 'description', or 'translate'")

        if type == "translate":
            result = self._call_ai(system_prompt, user_prompt, model=self.translate_model)
            if target_language.lower() in ["so", "somali"]:
                result = apply_somali_dictionary(result)
        else:
            result = self._call_ai(system_prompt, user_prompt)

        return result

    def check_moderation(self, listing_data: dict) -> dict:
        """
        Check for scam, fraud, or inappropriate content.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        system_prompt = """
You are a scam detection AI for a marketplace in East Africa.
Analyze the listing data and provide a risk assessment.
Risk levels: low, medium, high.

Look for:
- Price anomalies (unrealistically low prices)
- Suspicious wording (scam phrases like "payment before delivery", "lottery winner", etc.)
- Inappropriate content
"""
        user_prompt = f"""
Analyze this listing:
Title: {listing_data.get('title_en') or listing_data.get('title_so')}
Category: {listing_data.get('category')}
Price: {listing_data.get('price')} {listing_data.get('currency', 'USD')}
Description: {listing_data.get('description_en') or listing_data.get('description_so')}

Return a JSON object with:
{{
  "risk": "low | medium | high",
  "reasons": ["list of reasons"],
  "recommendation": "short advice for the user"
}}
Do not include any other text in your response.
"""
        import json
        try:
            response_text = self._call_ai(system_prompt, user_prompt)
            return json.loads(response_text)
        except Exception as e:
            logger.error(f"Moderation AI Error (Falling back to safe): {e}")
            # Fallback if AI fails: assume low risk to avoid blocking user
            return {"risk": "low", "reasons": ["AI moderation temporarily unavailable"], "recommendation": "Safe to post"}

    def parse_search_query(self, query: str) -> dict:
        """
        Convert natural language search query into structured filters.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        system_prompt = """
You are a search query parser for a marketplace.
Convert the user's natural language request into a JSON filter object.

Supported keys:
- q: search keyword
- category_id: category slug (e.g., 'electronics', 'vehicles', 'phones')
- location: city or region name
- min_price: number
- max_price: number
- brand: specific brand name
"""
        user_prompt = f"""
Parse this query: "{query}"

Return a JSON object with the keys above. If a value is unknown, omit it.
Do not include any other text.
"""
        import json
        response_text = self._call_ai(system_prompt, user_prompt)
        try:
            return json.loads(response_text)
        except:
            return {"q": query}

    def get_price_recommendation(self, listing_data: dict) -> dict:
        """
        Suggest a price range based on listing details.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        system_prompt = """
You are a pricing expert for an East African marketplace.
Based on the title and category, suggest a realistic price range in USD.
If the currency is KES, use 130 KES = 1 USD for conversion logic but return values as requested.
"""
        user_prompt = f"""
Item: {listing_data.get('title_en') or listing_data.get('title_so')}
Category: {listing_data.get('category')}
Condition: {listing_data.get('condition', 'Used')}

Return a JSON object:
{{
  "recommended_price": 0,
  "min_range": 0,
  "max_range": 0,
  "market_demand": "low | medium | high",
  "currency": "{listing_data.get('currency', 'USD')}"
}}
Do not include other text.
"""
        import json
        response_text = self._call_ai(system_prompt, user_prompt)
        try:
            return json.loads(response_text)
        except:
            return {"error": "Could not determine price"}

    def predict_category(self, title: str, description: str = "") -> dict:
        """
        Predict the best category for a listing title.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        system_prompt = """
You are a categorization assistant. 
Predict the best category slug for this product.
Available slugs include: electronics, vehicles, property, phones, laptops, home, fashion, health, services, jobs, pets, food, kids, sports, hobby, agriculture, other.
"""
        user_prompt = f"""
Product: "{title}"
Description snippet: "{description[:100]}"

Return a JSON object:
{{
  "category_slug": "slug",
  "confidence": 0.9,
  "reason": "short explanation"
}}
"""
        import json
        response_text = self._call_ai(system_prompt, user_prompt)
        try:
            return json.loads(response_text)
        except:
            return {"category_slug": "other", "confidence": 0}

    def generate_chat_suggestions(self, messages: list, role: str = "buyer") -> dict:
        """
        Generate smart suggested replies for a chat.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        history = "\n".join([f"{m['role']}: {m['content']}" for m in messages[-5:]])
        system_prompt = f"""
You are a helpful chat assistant for a marketplace.
Suggest 3 natural, short replies for the {role}.
Keep them conversational and relevant to the context.
"""
        user_prompt = f"""
Chat History:
{history}

Return a JSON object:
{
  "suggestions": ["reply 1", "reply 2", "reply 3"]
}
"""
        import json
        response_text = self._call_ai(system_prompt, user_prompt)
        try:
            return json.loads(response_text)
        except:
            return {"suggestions": []}

    def calculate_seller_score(self, user_data: dict, history: list) -> dict:
        """
        Analyze seller behavior and history to generate a trust score.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        system_prompt = """
You are a trust & safety auditor for a marketplace.
Analyze seller data and generate a score (0-100) and badges.
"""
        user_prompt = f"""
Seller: {user_data.get('full_name')}
Joined: {user_data.get('created_at')}
Verified: {user_data.get('is_verified')}
History summary: {history}

Return a JSON object:
{
  "score": number,
  "level": "New | Reliable | Top Seller",
  "badges": ["list of strings"],
  "summary": "short trust summary"
}
"""
        import json
        response_text = self._call_ai(system_prompt, user_prompt)
        try:
            return json.loads(response_text)
        except:
            return {"score": 50, "level": "New", "badges": [], "summary": "N/A"}

    def get_demand_insights(self, location: str = "Nairobi", category: str = "General") -> dict:
        """
        Predict market demand trends.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        system_prompt = """
You are a market analyst for East African trade.
Predict current demand trends for a specific location and category.
"""
        user_prompt = f"""
Location: {location}
Category: {category}

Return a JSON object:
{
  "demand_score": number (0-100),
  "trending_keywords": ["keyword 1", "keyword 2"],
  "advice": "short selling advice",
  "growth": "percentage string"
}
"""
        import json
        response_text = self._call_ai(system_prompt, user_prompt)
        try:
            return json.loads(response_text)
        except:
            return {"demand_score": 50, "trending_keywords": [], "advice": "N/A", "growth": "0%"}

    def parse_listing(self, input_text: str) -> dict:
        """
        Convert a raw, unstructured text (e.g. "Selling iPhone 12 50k Nairobi") 
        into a structured listing object.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        system_prompt = """
        You are a world-class bilingual marketplace assistant (English and Somali).
        Your goal is to take a brief user input and expand it into a professional listing in BOTH languages.

        Somali Localization Rules — always use these correct marketplace terms:
        - Camel → Geel | Goat → Ari | Cow → Lo' | Sheep → Idhi
        - Car → Gaari | Truck → Baabuur | House → Guri | Room → Qol | Land → Dhul
        - For sale → Iib ah | Cheap → Jaban | New → Cusub | Used → La isticmaalay
        - For rent → Kiro ah | Urgent → Deg deg | Negotiable → Waa la xoojin karaa

        Examples of natural Somali titles:
        - "Camel for sale" → "Geel iib ah"
        - "3 bedroom house for rent" → "Guri 3 qol ah oo kiro ah"
        - "Toyota Hilux 2015 used" → "Toyota Hilux 2015 la isticmaalay"

        Extract and Generate:
        1. title: Clean, catchy English title (max 70 chars).
        2. title_so: Natural Somali title using correct marketplace vocabulary above.
        3. suggestions: 3 alternative English title suggestions.
        4. price: The numeric price.
        5. currency: USD, KES, or SOS.
        6. category_slug: One of [electronics, vehicles, property, phones, laptops, home, fashion, health, services, jobs, pets, food, kids, sports, hobby, agriculture, other].
        7. location: The city or region.
        8. condition: New, Used, or Refurbished.
        9. description: Professional, detailed 2-3 sentence description in English.
        10. description_so: Natural Somali description — written like a real East African seller, NOT a word-for-word translation.
        11. negotiable: "yes" or "no".
        """
        user_prompt = f"""
        Input: "{input_text}"
        
        Return a JSON object with these keys:
        {{
          "title": "string",
          "title_so": "string",
          "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
          "price": number,
          "currency": "USD | KES | SOS",
          "category_slug": "slug",
          "location": "string",
          "condition": "New | Used | Refurbished",
          "description": "string",
          "description_so": "string",
          "negotiable": "yes | no"
        }}
        Do not include other text. Ensure descriptions are persuasive and localized for the East African market.
        """
        import json
        try:
            response_text = self._call_ai(system_prompt, user_prompt)
            return json.loads(response_text)
        except Exception as e:
            logger.error(f"AI Parsing Error (Falling back): {e}")
            return {"title": input_text, "suggestions": [input_text]}

    def get_support_response(self, messages: list, db: any = None, current_listing_id: int = None, language: str = "so") -> dict:
        """
        AI Support Agent that knows about Suqafuran and current product context.
        """
        if not self.client:
            raise HTTPException(status_code=503, detail="AI Service is not configured")

        listing_context = ""
        recommendations = []
        is_somali = (language or "so").lower() in ("so", "somali")

        def title_for(item):
            return (item.title_so or item.title_en) if is_somali else item.title_en

        if is_somali:
            language_rules = f"""
        LANGUAGE (MOST IMPORTANT RULE):
        - ALWAYS write the "answer" in natural, simple Somali (af-Soomaali), even if the user writes in English. Only switch to English if the user explicitly asks you to.
        - Write the text of markdown links in Somali too, but keep the route/URL unchanged, e.g. [Xayeysiis dhig](/post-ad), [Alaabta la keydiyay](/favorites), [Farriimaha](/messages), [Habaynta](/settings), [Xarunta Caawinta](/help).
        - Keep brand and payment names as they are (Suqafuran, M-Pesa, WhatsApp, TikTok, Instagram).
        - "ticket_subject" and "search_query" stay in English (they are for staff and the search index).
        {build_dictionary_prompt()}
        """
        else:
            language_rules = """
        LANGUAGE:
        - Write the "answer" in clear, simple English.
        """
        
        if db and current_listing_id:
            from app.models.listing import Listing
            from sqlmodel import select
            
            listing = db.exec(select(Listing).where(Listing.id == current_listing_id)).first()
            if listing:
                listing_context = f"""
                USER IS CURRENTLY LOOKING AT THIS PRODUCT:
                - Title: {listing.title_en}
                - Price: {listing.price} {listing.currency}
                - Category ID: {listing.category_id}
                - Condition: {listing.condition}
                - Location: {listing.location}
                """
                
                # Fetch 3 similar products in same category
                similar = db.exec(
                    select(Listing)
                    .where(Listing.category_id == listing.category_id)
                    .where(Listing.id != current_listing_id)
                    .where(Listing.status == "active")
                    .limit(3)
                ).all()
                
                for item in similar:
                    recommendations.append({
                        "id": item.id,
                        "title": title_for(item),
                        "price": item.price,
                        "currency": item.currency,
                        "image": item.images[0] if item.images else None
                    })

        system_prompt = f"""
        You are a helpful and professional customer support agent for Suqafuran — the leading marketplace for Somalia and Africa.
        
        {listing_context}
        
        YOUR IDENTITY:
        - Your name is 'Suqafuran Agent'.
        - Never refer to yourself as an AI, bot, or machine.
        - Speak like a helpful human who cares about the user's success on our platform.
        
        YOUR MISSION:
        - Help users navigate Suqafuran (posting ads, buying, payments).
        - Answer questions about marketplace rules, boosting plans, and safety.
        - If the user is looking at a product (see context above), help them with it.
        - If they seem interested but unsure, suggest similar products from our marketplace.
        - NEVER answer questions outside of Suqafuran or marketplace context.
        - If you don't know the answer or the user is frustrated, tell them to contact our human team by phone call or WhatsApp: +254 720 073322.
        - Be professional, helpful, and concise.

        EASY REDIRECTION LINKS:
        - When the user asks to navigate the site, suggest pages, or view pages in Suqafuran, ALWAYS include them in markdown format like [Link Text](route) where route is one of:
          * Post an Ad: [Post an Ad](/post-ad)
          * Saved Ads / Watchlist: [Saved Ads](/favorites)
          * Messaging / Inbox: [Messages](/messages)
          * Settings / Profile: [Settings](/settings)
          * Help Center: [Help Center](/help)
          * User Dashboard: [Dashboard](/dashboard)
          * Discovery Feed: [Discovery Feed](/discovery)
        - When the user asks for social media or contact info, ALWAYS include them in markdown format like [Link Text](url):
          * Instagram: [Instagram](https://www.instagram.com/suqafuran/)
          * Twitter/X: [Twitter/X](https://x.com/suqafuran)
          * TikTok: [TikTok](https://www.tiktok.com/@suqafuran_)
          * WhatsApp Support: [WhatsApp Support](https://wa.me/254720073322)
          * Call Support: [Call Support](tel:+254720073322)

        KNOWLEDGE BASE:
        - Boosting: We have Top, Premium, and VIP plans to sell 10x-100x faster.
        - Payments: We accept M-Pesa (Lipana) for all promotions.
        - Safety: Never pay before seeing the item. Meet in public places.
        - Listing: Users can post for free, but boosting gives better reach.
        - Verification: Users can verify their IDs to build trust.
        
        PRODUCT RECOMMENDATIONS & SEARCHING:
        - If the user asks for suggestions or seems to be browsing, you can mention that we have other similar items.
        - If the user is asking to search or look for items (e.g., 'show me shoes', 'do you have phones?', 'search for cars', 'I want a bag'), set "search_query" in the JSON response to the extracted item name (e.g. 'shoe', 'phone', 'car', 'bag') and set "suggest_products" to true.
        - In the "answer" field, reply politely and inform them that you have found active listings for them.
        
        {language_rules}

        STRICTOR CONTEXT RULE:
        If the user asks about anything NOT related to Suqafuran, politely state that you only assist with Suqafuran marketplace concerns.
        
        TICKET GENERATION:
        If the user has a serious issue (scam report, payment failure, technical bug), flag it as a ticket.
        
        RESPONSE FORMAT:
        Return a JSON object:
        {{
            "answer": "your message to user",
            "needs_ticket": true | false,
            "ticket_priority": "low | medium | high",
            "ticket_subject": "short summary of issue",
            "suggest_products": true | false,
            "search_query": "extracted item search term or null if not searching"
        }}
        """
        
        # Format conversation history
        history = []
        for m in messages[-8:]: # Keep last 8 messages
            history.append({"role": m["role"], "content": m["content"]})
            
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *history
                ],
                temperature=0.3,
                response_format={ "type": "json_object" }
            )
            
            import json
            result = json.loads(response.choices[0].message.content.strip())
            
            # Perform active database search if AI set search_query
            search_query = result.get("search_query")
            if db and search_query:
                from app.models.listing import Listing
                from sqlmodel import select, or_
                search_term = search_query.strip().lower()
                stmt = (
                    select(Listing)
                    .where(Listing.status == "active")
                    .where(
                        or_(
                            Listing.title_en.ilike(f"%{search_term}%"),
                            Listing.title_so.ilike(f"%{search_term}%"),
                            Listing.description_en.ilike(f"%{search_term}%"),
                            Listing.description_so.ilike(f"%{search_term}%")
                        )
                    )
                    .limit(5)
                )
                search_listings = db.exec(stmt).all()
                if search_listings:
                    # Clear default recommendations and populate with search results
                    recommendations = []
                    for item in search_listings:
                        recommendations.append({
                            "id": item.id,
                            "title": title_for(item),
                            "price": item.price,
                            "currency": item.currency,
                            "image": item.images[0] if item.images else None
                        })
            
            return {
                "answer": result.get("answer"),
                "whatsapp_support": "+254 720 073322",
                "needs_ticket": result.get("needs_ticket", False),
                "ticket_priority": result.get("ticket_priority", "low"),
                "ticket_subject": result.get("ticket_subject", "Support Inquiry"),
                "recommendations": recommendations if (result.get("suggest_products") or search_query) else []
            }
        except Exception as e:
            logger.error(f"Support AI Error: {e}")
            return {
                "answer": (
                    "Waan ka xumahay, hadda cilad yar ayaa jirta. Fadlan kooxdayada kala soo xiriir wac ama WhatsApp +254 720 073322 si aad caawimaad degdeg ah u hesho."
                    if is_somali
                    else "I'm having a bit of trouble right now. Please reach out to our team by call or WhatsApp for immediate help."
                ),
                "whatsapp_support": "+254 720 073322"
            }

    def analyze_image(self, image_url: str) -> dict:
        """
        Analyze an image for quality, tags, and authenticity using AI Vision.
        """
        if not self.client:
            return {"quality_score": 85, "tags": ["product"], "is_blur": False}

        try:
            # Using Groq's Vision capability
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Analyze this marketplace product image. Return JSON with: quality_score (0-100), tags (list of 3 tags), is_blur (bool), is_stolen_stock_photo (bool), and a short description."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url,
                                },
                            },
                        ],
                    }
                ],
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                response_format={"type": "json_object"}
            )
            import json
            return json.loads(chat_completion.choices[0].message.content)
        except Exception as e:
            logger.error(f"Vision AI Error: {e}")
            return {
                "quality_score": 75,
                "tags": ["Standard"],
                "is_blur": False,
                "is_stolen": False,
                "description": "Auto-moderated"
            }

    def get_recommended_listings(self, user_history: list) -> dict:
        """
        Suggest listings based on user history.
        """
        if not self.client:
            return {"recommendations": [], "reason": "AI Service not configured"}

        history_str = ", ".join(user_history) if user_history else "No history"
        system_prompt = "You are a personalized shopping assistant for a marketplace."
        user_prompt = f"""
        User has looked at: {history_str}
        Suggest 5 relevant marketplace categories or keywords they might be interested in.
        
        Return a JSON object:
        {{
            "recommendations": ["category1", "category2", "keyphrase1", ...],
            "reason": "short explanation of why these were suggested"
        }}
        """
        import json
        response_text = self._call_ai(system_prompt, user_prompt)
        try:
            return json.loads(response_text)
        except:
            return {"recommendations": ["Electronics", "Vehicles"], "reason": "General trends"}

    def _call_ai(self, system_prompt: str, user_prompt: str, model: str = None) -> str:
        try:
            response = self.client.chat.completions.create(
                model=model or self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2, # Lower temperature for more consistent structured output
            )
            
            output_text = response.choices[0].message.content.strip()
            
            # Clean JSON if AI wraps it in code blocks
            if output_text.startswith("```json"):
                output_text = output_text.split("```json")[1].split("```")[0].strip()
            elif output_text.startswith("```"):
                output_text = output_text.split("```")[1].split("```")[0].strip()

            return output_text

        except Exception as e:
            logger.error(f"GROQ API ERROR: {str(e)}", exc_info=True)
            # Check for specific known errors if possible
            error_msg = str(e).lower()
            if "rate limit" in error_msg:
                raise HTTPException(status_code=429, detail="AI Service is currently busy. Please try again in a moment.")
            if "authentication" in error_msg or "api key" in error_msg:
                raise HTTPException(status_code=503, detail="AI Service configuration error.")
            
            raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

# Singleton instance
    def verify_identity(self, selfie_b64: str, document_b64: str, id_number: str = None) -> tuple[float, bool, str]:
        if not self.client:
            return 85.0, True, "AI service not configured, bypassing."

        # Note: True face-matching via LLM is imperfect and often restricted by safety filters.
        # This implementation uses the vision model to attempt a basic comparison of the two images.
        system_prompt = f"""
        You are an AI Identity Verification Assistant. 
        You are given two images and an ID number: 
        1. A live selfie of a user.
        2. A photo of an ID document.
        3. Provided ID Number: {id_number if id_number else "Not provided"}
        
        Tasks:
        1. Analyze both images and compare the face in the selfie with the face on the ID document. Do they appear to be the same person?
        2. Verify if the ID document looks like a real, authentic ID card or passport.
        3. If an ID number was provided, check if it matches the ID number visible on the document.
        
        Return a JSON object:
        {{
            "match_score": 95.5,
            "is_authentic": true,
            "reason": "Faces appear to match, document looks authentic, and ID number matches."
        }}
        Output ONLY the JSON object.
        """

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Compare these images and verify the identity."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{selfie_b64}"}},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{document_b64}"}},
                        ],
                    }
                ],
                model=self.model,
                temperature=0.1,
                max_tokens=150,
            )
            response_text = chat_completion.choices[0].message.content
            
            import json
            import re
            json_match = re.search(r'\{.*\}', response_text.replace('\n', ''))
            if json_match:
                data = json.loads(json_match.group())
                score = float(data.get("match_score", 0.0))
                is_auth = bool(data.get("is_authentic", False))
                reason = str(data.get("reason", "No reason provided."))
                return score, is_auth, reason
            else:
                return 50.0, False, "Failed to parse AI response."
        except Exception as e:
            logger.error(f"Error in verify_identity: {e}")
            return 0.0, False, f"Error processing images: {str(e)}"

ai_service = AIService()
