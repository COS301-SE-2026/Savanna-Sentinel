import jwt
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")

def encode(body):
    return jwt.encode(body, SECRET_KEY, algorithm="HS256")

#Returns the decoded body
def decode(token):
    return jwt.decode(token, SECRET_KEY, algorithm="HS256")

def verify(token):
    body = decode(token)