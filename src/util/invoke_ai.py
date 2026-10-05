import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ.get("GROQ_API_KEY"),
)

def invoke_ai(system_message: str, user_message: str) -> str:
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",  # Matches your active Groq models
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        temperature=0.0,
    )
    return response.choices[0].message.content