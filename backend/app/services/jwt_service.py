import jwt
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")

def encode(body):
    return jwt.encode(body, SECRET_KEY, algorithm="HS256")