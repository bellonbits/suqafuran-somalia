import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
model = os.getenv("GROQ_MODEL")

print(f"Testing Groq with Model: {model}")

client = Groq(api_key=api_key)

try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "user", "content": "Hello, are you working?"}
        ]
    )
    print("Success!")
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Failed: {e}")
