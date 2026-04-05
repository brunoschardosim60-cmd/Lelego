from fastapi import FastAPI, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from jose import JWTError, jwt
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get('JWT_SECRET', 'letsgo-secret-key-2025-super-secure')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

app = FastAPI(title="LetsGo API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database
users_db = {}

def seed_default_users():
    admin_email = "admin@letsgo.local"
    users_db[admin_email] = {
        "id": "admin-1",
        "name": "Bruno Admin",
        "email": admin_email,
        "phone": "00000000000",
        "cpf": "08818900579",
        "password_hash": get_password_hash("Aa1234@Lets"),
        "gender": "male",
        "is_active": True,
        "role": "admin",
    }

    shared_email = "brunoschardosim60@gmail.com"
    users_db[shared_email] = {
        "id": "user-1",
        "name": "Bruno Usuario",
        "email": shared_email,
        "phone": "11999999999",
        "cpf": "52998224725",
        "password_hash": get_password_hash("Aa1234@Lets"),
        "gender": "male",
        "is_active": True,
        "role": "passenger",
        "driver_status": "approved",
    }

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    cpf: str
    password: str
    gender: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    login_as: str | None = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

def get_password_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return get_password_hash(plain_password) == hashed_password

def validate_cpf(cpf: str) -> bool:
    cpf = cpf.replace('.', '').replace('-', '')
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    
    sum1 = sum(int(cpf[i]) * (10 - i) for i in range(9))
    digit1 = 11 - (sum1 % 11)
    digit1 = 0 if digit1 > 9 else digit1
    
    sum2 = sum(int(cpf[i]) * (11 - i) for i in range(10))
    digit2 = 11 - (sum2 % 11)
    digit2 = 0 if digit2 > 9 else digit2
    
    return cpf[9] == str(digit1) and cpf[10] == str(digit2)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

seed_default_users()

@app.get("/api/auth/health")
async def health():
    return {"status": "ok", "message": "Backend running"}

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    email_normalized = user_data.email.lower().strip()
    
    if not validate_cpf(user_data.cpf):
        raise HTTPException(status_code=400, detail="CPF inválido")
    
    if email_normalized in users_db:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    user_id = str(len(users_db) + 1)
    hashed_password = get_password_hash(user_data.password)
    
    users_db[email_normalized] = {
        "id": user_id,
        "name": user_data.name,
        "email": email_normalized,
        "phone": user_data.phone,
        "cpf": user_data.cpf,
        "password_hash": hashed_password,
        "gender": user_data.gender,
        "is_active": True,
        "role": "passenger",
    }
    
    user = users_db[email_normalized]
    access_token = create_access_token({"sub": user["id"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "role": user["role"],
        }
    )

@app.post("/api/auth/login", response_model=Token)
async def login(login_data: UserLogin):
    email_normalized = login_data.email.lower().strip()
    
    if email_normalized not in users_db:
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    
    user = users_db[email_normalized]
    
    if not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Conta bloqueada")

    response_role = user["role"]
    if email_normalized == "brunoschardosim60@gmail.com" and login_data.login_as == "driver":
        response_role = "driver"
    
    access_token = create_access_token({"sub": user["id"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "role": response_role,
        }
    )

@app.get("/api/auth/me")
async def get_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    for user_data in users_db.values():
        if user_data["id"] == user_id:
            return user_data
    
    raise HTTPException(status_code=404, detail="Usuário não encontrado")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
