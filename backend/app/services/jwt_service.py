import os
from datetime import datetime, timedelta, timezone
import jwt
from dotenv import load_dotenv
from models.token import Token_Body
from pydantic import ValidationError

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def encode(body: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    body_with_exp = body.copy()
    body_with_exp["exp"] = int(expire.timestamp())

    try:
        validated_data = Token_Body(**body_with_exp)
        return jwt.encode(validated_data.model_dump(), SECRET_KEY, algorithm=ALGORITHM)
    except ValidationError as e:
        error_details = e.errors();
        raise ValueError("Token Generation failed due to invalid data structure: {error_details}")

#Returns the decoded body
def decode(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithm="HS256")
    except jwt.ExpiredSignatureError:
        print("Token has expired.")
        return None
    #Token failed to decode for some other reason.
    except jwt.InvalidTokenError:
        print("Invalid token sequence")
        return None

def verify(token):
    payload = decode(token)
    if not payload:
        return None
    try:
        return Token_Body(**payload)
    except ValidationError as e:
        print("Token payload structure is corrupt: {e}")
        return None