import os
from datetime import datetime, timedelta, timezone
import jwt
from dotenv import load_dotenv
from models.token import Token_Body
from pydantic import ValidationError

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def encode(body: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    return jwt.encode(body, SECRET_KEY, algorithm="HS256")

#Returns the decoded body
def decode(token):
    return jwt.decode(token, SECRET_KEY, algorithm="HS256")

def verify(token):
    body = decode(token)