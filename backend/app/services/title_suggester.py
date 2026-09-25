"""AI-powered product title suggestion service using Groq."""

import re
from app.core.config import settings

try:
    from groq import Groq
except ImportError:
    Groq = None


class TitleSuggester:
    """Generate optimized product titles using Groq AI."""

    def __init__(self):
        if Groq is None:
            raise ImportError("groq library not installed")

        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL

    def generate_title(
        self,
        current_title: str,
        category: str = "",
        brand: str = "",
        template: str = "{brand} {category} - {feature}, {color}",
    ) -> str:
        """Generate optimized product title using AI.

        Args:
            current_title: Current product title
            category: Product category
            brand: Brand name
            template: Title format template

        Returns:
            Optimized product title
        """

        prompt = f"""You are an e-commerce product title expert. Generate an optimized,
compelling product title for this product that follows e-commerce best practices
(like Amazon and Jumia).

Current title: {current_title}
Category: {category}
Brand: {brand}

Requirements:
1. Keep it concise (60-80 characters max)
2. Start with brand name if available
3. Include key features/differentiators
4. Add size/color/variant info at the end
5. Use clear, searchable keywords
6. Avoid redundancy and special characters

Example format: {template}

Generate ONLY the new title, nothing else. No quotes, no explanations."""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=150,
                messages=[{"role": "user", "content": prompt}],
            )

            # Extract title from response
            title = message.content[0].text.strip()

            # Clean up response
            title = title.replace('"', '').replace("'", '')
            title = re.sub(r'\s+', ' ', title)  # Remove extra spaces
            title = title[:80]  # Ensure max length

            return title if title else current_title

        except Exception as e:
            print(f"Error generating title: {e}")
            return current_title

    def batch_generate_titles(
        self,
        products: list,
        template: str = "{brand} {category} - {feature}, {color}",
    ) -> dict:
        """Generate titles for multiple products.

        Args:
            products: List of dicts with id, current_title, category, brand
            template: Title format template

        Returns:
            Dict mapping product IDs to suggested titles
        """

        suggestions = {}

        for product in products:
            try:
                suggestion = self.generate_title(
                    current_title=product.get("current_title", ""),
                    category=product.get("category", ""),
                    brand=product.get("brand", ""),
                    template=template,
                )
                suggestions[product["id"]] = suggestion
            except Exception as e:
                # Fallback to current title
                suggestions[product["id"]] = product.get("current_title", "")

        return suggestions
