import os
from datetime import datetime, timedelta, timezone
import jwt
import uuid
from dotenv import load_dotenv
from models.token import Token_Body
from pydantic import ValidationError

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_MINUTES = 43200 #30 days

def encode(body: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    body_with_exp = body.copy()
    body_with_exp["exp"] = int(expire.timestamp())

    try:
        validated_data = Token_Body(**body_with_exp)
        return jwt.encode(validated_data.model_dump(), SECRET_KEY, algorithm=ALGORITHM)
    except ValidationError as e:
        error_details = e.errors()
        raise ValueError(f"Token Generation failed due to invalid data structure: {error_details}")
    
def encode_refresh(userid: int, jti: str) -> str:
    now = datetime.now(timezone.utc)
    expire = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)

    refresh_body = {
        "id": userid,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": jti,
        "type": "refresh"
    }

    return jwt.encode(refresh_body, SECRET_KEY,algorithm=ALGORITHM)


#Returns the decoded body
def decode(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithm=ALGORITHM)
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
    
def verify_refresh(token):
    #Stubbed but will interface with the DB to determine if a new JWT should be generated when database is setup.
    return None

def rotate_refresh(uuid):
    #Stubbed
    return None
    
def generate_token_pair(body: dict):

    user_id = body["id"]
    if user_id is None:
        raise ValueError("Token generation failed: 'id' is missing from the input data.")
    
    access_token = encode(body)

    jti = str(uuid.uuid4())
    refresh_token = encode_refresh(body["id"], jti)

    # Store the jti in the database with the user id
    # THE REFRESH TOKEN SHOULD BE SENT IN THE APPROPRIATE COOKIE FOR SECURITY.

    return {
        "access_token": access_token,
        "refresh_token" : refresh_token,
        "jti": jti
    }
