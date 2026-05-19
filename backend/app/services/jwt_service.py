import os
from datetime import datetime, timedelta, timezone
import jwt
import uuid
from dotenv import load_dotenv
from app.models.token import Token_Body, Refresh_Token_Body
from pydantic import ValidationError

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_MINUTES = 43200 #30 days


def _require_secret_key() -> str:
    if not SECRET_KEY:
        raise RuntimeError("JWT_SECRET must be set")
    return SECRET_KEY

def encode(body: dict) -> str:
    now = datetime.now(timezone.utc)
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    body_with_claims = body.copy()
    body_with_claims["exp"] = int(expire.timestamp())
    body_with_claims["iat"] = int(now.timestamp())
    body_with_claims["jti"] = body.get("jti") or str(uuid.uuid4())

    raw_id = body.get("id") or body.get("sub")
    if raw_id is None:
        raise ValueError("Access Token Generation failed: 'id' or 'sub' is missing from payload data.")
    
    body_with_claims["sub"] = str(raw_id)

    try:
        validated_data = Token_Body(**body_with_claims)
        return jwt.encode(validated_data.model_dump(), _require_secret_key(), algorithm=ALGORITHM)
    except ValidationError as e:
        raise ValueError(f"Access Token Generation failed: {e.errors()}")
    
def encode_refresh(userid: int, jti: str) -> str:
    now = datetime.now(timezone.utc)
    expire = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)

    refresh_body = {
        "sub": str(userid),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": jti,
        "type": "refresh"
    }
    try:
        validated_refresh_body = Refresh_Token_Body(**refresh_body)
        return jwt.encode(validated_refresh_body.model_dump(), _require_secret_key(), algorithm=ALGORITHM)
    except ValidationError as e:
        raise ValueError(f"Refresh Token Generation failed: {e.errors()}")


#Returns the decoded body
def decode(token):
    try:
        return jwt.decode(token, _require_secret_key(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        print("Token has expired.")
        return None
    #Token failed to decode for some other reason.
    except jwt.InvalidTokenError as e:
        print(f"Invalid token sequence: {e}")
        return None

def verify(token):
    payload = decode(token)
    if not payload:
        return None
    try:
        return Token_Body(**payload)
    except ValidationError as e:
        print(f"Token payload structure is corrupt: {e}")
        return None
    
def verify_refresh(token):
    #Stubbed but will interface with the DB to determine if a new JWT should be generated when database is setup.
    return None

def rotate_refresh(uuid):
    #Stubbed
    return None
    
def generate_token_pair(body: dict):

    user_id = body.get("id")
    if user_id is None:
        raise ValueError("Token generation failed: 'id' is missing from the input data.")
    
    access_token = encode(body)

    jti = str(uuid.uuid4())
    refresh_token = encode_refresh(user_id, jti)

    # Store the jti in the database with the user id
    # THE REFRESH TOKEN SHOULD BE SENT IN THE APPROPRIATE COOKIE FOR SECURITY.

    return {
        "access_token": access_token,
        "refresh_token" : refresh_token,
        "jti": jti
    }
