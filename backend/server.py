from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import json
import math
import asyncio
import base64
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'letsgo-secret-key-2025-super-secure')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
# Use pbkdf2_sha256 como padrão para evitar incompatibilidade conhecida
# entre passlib e bcrypt em ambientes Python mais recentes.
# Mantemos bcrypt na lista para verificar hashes legados já existentes.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'letsgo_db')]

# Create the main app
app = FastAPI(title="LetsGo API", version="2.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Brazilian states list
BRAZILIAN_STATES = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

# ============== CPF VALIDATION ==============

def validate_cpf(cpf: str) -> bool:
    """Validate CPF using the mathematical algorithm"""
    # Remove non-digits
    cpf = re.sub(r'[^0-9]', '', cpf)
    
    # Must be 11 digits
    if len(cpf) != 11:
        return False
    
    # Check for known invalid CPFs (all same digits)
    if cpf == cpf[0] * 11:
        return False
    
    # Calculate first check digit
    sum1 = 0
    for i in range(9):
        sum1 += int(cpf[i]) * (10 - i)
    remainder1 = (sum1 * 10) % 11
    if remainder1 == 10:
        remainder1 = 0
    if remainder1 != int(cpf[9]):
        return False
    
    # Calculate second check digit
    sum2 = 0
    for i in range(10):
        sum2 += int(cpf[i]) * (11 - i)
    remainder2 = (sum2 * 10) % 11
    if remainder2 == 10:
        remainder2 = 0
    if remainder2 != int(cpf[10]):
        return False
    
    return True

# ============== WEBSOCKET MANAGER ==============

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.ride_connections: Dict[str, List[str]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except:
                self.disconnect(user_id)
    
    async def broadcast_to_ride(self, message: dict, ride_id: str):
        if ride_id in self.ride_connections:
            for user_id in self.ride_connections[ride_id]:
                await self.send_personal_message(message, user_id)

manager = ConnectionManager()

# ============== MODELS ==============

class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: str
    gender: str
    cpf: str

class UserCreate(UserBase):
    password: str
    role: str = "passenger"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str = "passenger"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    score: int = 1000
    # Driver fields
    is_driver: bool = False
    driver_status: str = "none"  # none, pending, approved, rejected
    vehicle_type: str = ""
    vehicle_color: str = ""
    vehicle_plate: str = ""
    vehicle_model: str = ""
    cnh_photo: str = ""
    face_photo: str = ""
    vehicle_photo: str = ""
    driver_online: bool = False
    state: str = ""
    # Ranking fields
    ranking_active: bool = True
    total_rides: int = 0
    average_rating: float = 5.0

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class DriverApplication(BaseModel):
    vehicle_type: str
    vehicle_color: str
    vehicle_plate: str
    vehicle_model: str
    state: str
    cnh_photo: str  # base64
    face_photo: str  # base64
    vehicle_photo: str  # base64

class RideRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    origin_address: str
    destination_lat: float
    destination_lng: float
    destination_address: str
    category: str

class Ride(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    passenger_id: str
    driver_id: Optional[str] = None
    origin_lat: float
    origin_lng: float
    origin_address: str
    destination_lat: float
    destination_lng: float
    destination_address: str
    category: str
    distance_km: float = 0
    duration_min: float = 0
    estimated_price: float = 0
    final_price: Optional[float] = None
    status: str = "searching_driver"
    payment_method: str = "card"
    payment_status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None

class Rating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ride_id: str
    from_user_id: str
    to_user_id: str
    score: int
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ride_id: str
    user_id: str
    method: str
    amount: float
    status: str = "pending"
    transaction_id: Optional[str] = None
    pix_code: Optional[str] = None
    pix_qr: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ============== HELPER FUNCTIONS ==============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Get current user or return None if not authenticated"""
    try:
        if not credentials:
            return None
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user = await db.users.find_one({"id": user_id})
        return user
    except:
        return None

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def calculate_ride_price(distance_km: float, duration_min: float, category: str) -> float:
    categories = {
        "moto": {"per_km": 1.20, "per_min": 0.20, "base": 3.00},
        "car": {"per_km": 1.50, "per_min": 0.30, "base": 4.00},
        "comfort": {"per_km": 2.00, "per_min": 0.40, "base": 5.00},
        "women": {"per_km": 1.50, "per_min": 0.30, "base": 4.00},
    }
    cat = categories.get(category, categories["car"])
    price = cat["base"] + (distance_km * cat["per_km"]) + (duration_min * cat["per_min"])
    if price > 90:
        price += 10
    elif price > 50:
        price += 3
    elif price > 20:
        price += 2
    return round(price, 2)

def calculate_ranking_score(total_rides: int, score: int, average_rating: float) -> float:
    """Calculate ranking score based on rides, score and rating"""
    return (score * 0.4) + (total_rides * 10 * 0.3) + (average_rating * 100 * 0.3)

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    email_normalized = user_data.email.lower().strip()

    # Validate CPF
    if not validate_cpf(user_data.cpf):
        raise HTTPException(status_code=400, detail="CPF inválido")
    
    # Check if user exists
    existing = await db.users.find_one({"email": email_normalized})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    cpf_clean = re.sub(r'[^0-9]', '', user_data.cpf)
    existing_cpf = await db.users.find_one({"cpf": cpf_clean})
    if existing_cpf:
        raise HTTPException(status_code=400, detail="CPF já cadastrado")
    
    # Create user
    user = User(
        name=user_data.name,
        email=email_normalized,
        phone=user_data.phone,
        gender=user_data.gender,
        cpf=cpf_clean,
        role=user_data.role
    )
    
    user_dict = user.model_dump()
    user_dict["password_hash"] = get_password_hash(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(
        access_token=access_token,
        user={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "gender": user.gender,
            "role": user.role,
            "is_driver": user.is_driver,
            "driver_status": user.driver_status
        }
    )

@api_router.post("/auth/login", response_model=Token)
async def login(login_data: UserLogin):
    email_normalized = login_data.email.lower().strip()
    user = await db.users.find_one({"email": email_normalized})
    if not user or not verify_password(login_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Conta bloqueada")
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return Token(
        access_token=access_token,
        user={
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user.get("phone", ""),
            "gender": user.get("gender", ""),
            "role": user.get("role", "passenger"),
            "is_driver": user.get("is_driver", False),
            "driver_status": user.get("driver_status", "none"),
            "driver_online": user.get("driver_online", False)
        }
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    is_admin = current_user.get("role") == "admin"
    
    response = {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "phone": current_user.get("phone", ""),
        "gender": current_user.get("gender", ""),
        "role": current_user.get("role", "passenger"),
        "is_driver": current_user.get("is_driver", False),
        "driver_status": current_user.get("driver_status", "none"),
        "driver_online": current_user.get("driver_online", False),
        "vehicle_type": current_user.get("vehicle_type", ""),
        "vehicle_model": current_user.get("vehicle_model", ""),
        "vehicle_plate": current_user.get("vehicle_plate", ""),
        "state": current_user.get("state", ""),
        "total_rides": current_user.get("total_rides", 0),
        "average_rating": current_user.get("average_rating", 5.0),
        "ranking_active": current_user.get("ranking_active", True),
    }
    
    # Only show score to admin or the user themselves (for drivers)
    if is_admin or current_user.get("is_driver"):
        response["score"] = current_user.get("score", 1000)
    
    return response

# ============== DRIVER ROUTES ==============

@api_router.post("/driver/apply")
async def apply_driver(application: DriverApplication, current_user: dict = Depends(get_current_user)):
    """Apply to become a driver"""
    if current_user.get("driver_status") == "approved":
        raise HTTPException(status_code=400, detail="Você já é um motorista aprovado")
    
    if current_user.get("driver_status") == "pending":
        raise HTTPException(status_code=400, detail="Sua solicitação já está em análise")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "driver_status": "pending",
            "vehicle_type": application.vehicle_type,
            "vehicle_color": application.vehicle_color,
            "vehicle_plate": application.vehicle_plate,
            "vehicle_model": application.vehicle_model,
            "state": application.state,
            "cnh_photo": application.cnh_photo,
            "face_photo": application.face_photo,
            "vehicle_photo": application.vehicle_photo,
            "applied_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Solicitação enviada com sucesso! Aguarde a aprovação."}

@api_router.post("/driver/toggle-online")
async def toggle_driver_online(current_user: dict = Depends(get_current_user)):
    """Toggle driver online status"""
    if current_user.get("driver_status") != "approved":
        raise HTTPException(status_code=400, detail="Você não é um motorista aprovado")
    
    new_status = not current_user.get("driver_online", False)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"driver_online": new_status, "is_driver": True}}
    )
    
    return {"driver_online": new_status}

@api_router.post("/driver/toggle-ranking")
async def toggle_ranking(current_user: dict = Depends(get_current_user)):
    """Toggle ranking visibility"""
    if current_user.get("driver_status") != "approved":
        raise HTTPException(status_code=400, detail="Você não é um motorista aprovado")
    
    new_status = not current_user.get("ranking_active", True)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"ranking_active": new_status}}
    )
    
    return {"ranking_active": new_status}

@api_router.post("/driver/location")
async def update_driver_location(lat: float, lng: float, heading: float = 0, current_user: dict = Depends(get_current_user)):
    """Update driver location"""
    if current_user.get("driver_status") != "approved":
        raise HTTPException(status_code=400, detail="Você não é um motorista aprovado")
    
    await db.driver_locations.update_one(
        {"driver_id": current_user["id"]},
        {"$set": {
            "lat": lat,
            "lng": lng,
            "heading": heading,
            "vehicle_type": current_user.get("vehicle_type", "car"),
            "is_online": current_user.get("driver_online", False),
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    return {"message": "Location updated"}

@api_router.get("/driver/rides/available")
async def get_available_rides(current_user: dict = Depends(get_current_user)):
    """Get available rides for driver"""
    if current_user.get("driver_status") != "approved":
        raise HTTPException(status_code=400, detail="Você não é um motorista aprovado")
    
    if not current_user.get("driver_online"):
        return []
    
    rides = await db.rides.find({
        "status": "searching_driver",
        "category": {"$in": [current_user.get("vehicle_type", "car"), "car"]}
    }, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    return rides

@api_router.post("/driver/rides/{ride_id}/accept")
async def accept_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Accept a ride"""
    if current_user.get("driver_status") != "approved":
        raise HTTPException(status_code=400, detail="Você não é um motorista aprovado")
    
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    
    if ride["status"] != "searching_driver":
        raise HTTPException(status_code=400, detail="Corrida já foi aceita")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "driver_id": current_user["id"],
            "status": "driver_assigned",
            "accepted_at": datetime.utcnow()
        }}
    )
    
    # Notify passenger
    await manager.send_personal_message({
        "type": "driver_assigned",
        "ride_id": ride_id,
        "driver": {
            "id": current_user["id"],
            "name": current_user["name"],
            "phone": current_user.get("phone", ""),
            "vehicle_type": current_user.get("vehicle_type", ""),
            "vehicle_model": current_user.get("vehicle_model", ""),
            "vehicle_plate": current_user.get("vehicle_plate", ""),
            "vehicle_color": current_user.get("vehicle_color", "")
        }
    }, ride["passenger_id"])
    
    return {"message": "Corrida aceita"}

@api_router.post("/driver/rides/{ride_id}/arrive")
async def arrive_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Mark driver as arrived"""
    ride = await db.rides.find_one({"id": ride_id, "driver_id": current_user["id"]})
    if not ride:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"status": "driver_arrived", "arrived_at": datetime.utcnow()}}
    )
    
    await manager.send_personal_message({
        "type": "driver_arrived",
        "ride_id": ride_id
    }, ride["passenger_id"])
    
    return {"message": "Chegada confirmada"}

@api_router.post("/driver/rides/{ride_id}/start")
async def start_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Start the ride"""
    ride = await db.rides.find_one({"id": ride_id, "driver_id": current_user["id"]})
    if not ride:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"status": "in_progress", "started_at": datetime.utcnow()}}
    )
    
    await manager.send_personal_message({
        "type": "ride_started",
        "ride_id": ride_id
    }, ride["passenger_id"])
    
    return {"message": "Corrida iniciada"}

@api_router.post("/driver/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    """Complete the ride"""
    ride = await db.rides.find_one({"id": ride_id, "driver_id": current_user["id"]})
    if not ride:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.utcnow(),
            "final_price": ride["estimated_price"]
        }}
    )
    
    # Update driver stats
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"total_rides": 1}}
    )
    
    await manager.send_personal_message({
        "type": "ride_completed",
        "ride_id": ride_id,
        "final_price": ride["estimated_price"]
    }, ride["passenger_id"])
    
    return {"message": "Corrida finalizada", "final_price": ride["estimated_price"]}

@api_router.get("/driver/stats")
async def get_driver_stats(current_user: dict = Depends(get_current_user)):
    """Get driver statistics"""
    if current_user.get("driver_status") != "approved":
        raise HTTPException(status_code=400, detail="Você não é um motorista aprovado")
    
    # Get today's rides
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_rides = await db.rides.count_documents({
        "driver_id": current_user["id"],
        "status": "completed",
        "completed_at": {"$gte": today}
    })
    
    # Get today's earnings
    today_earnings_cursor = db.rides.aggregate([
        {
            "$match": {
                "driver_id": current_user["id"],
                "status": "completed",
                "completed_at": {"$gte": today}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$final_price"}
            }
        }
    ])
    today_earnings_list = await today_earnings_cursor.to_list(1)
    today_earnings = today_earnings_list[0]["total"] if today_earnings_list else 0
    
    # Get month's earnings
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_earnings_cursor = db.rides.aggregate([
        {
            "$match": {
                "driver_id": current_user["id"],
                "status": "completed",
                "completed_at": {"$gte": month_start}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$final_price"}
            }
        }
    ])
    month_earnings_list = await month_earnings_cursor.to_list(1)
    month_earnings = month_earnings_list[0]["total"] if month_earnings_list else 0
    
    return {
        "today_rides": today_rides,
        "today_earnings": round(today_earnings * 0.85, 2),  # 85% for driver
        "month_earnings": round(month_earnings * 0.85, 2),
        "total_rides": current_user.get("total_rides", 0),
        "score": current_user.get("score", 1000),
        "average_rating": current_user.get("average_rating", 5.0)
    }

# ============== RANKING ROUTES ==============

@api_router.get("/ranking/brazil")
async def get_brazil_ranking(current_user: dict = Depends(get_current_user)):
    """Get top 100 drivers in Brazil"""
    drivers = await db.users.find({
        "driver_status": "approved",
        "ranking_active": True
    }, {"_id": 0, "password_hash": 0, "cnh_photo": 0, "face_photo": 0, "vehicle_photo": 0}).to_list(1000)
    
    # Calculate ranking score and sort
    for driver in drivers:
        driver["ranking_score"] = calculate_ranking_score(
            driver.get("total_rides", 0),
            driver.get("score", 1000),
            driver.get("average_rating", 5.0)
        )
    
    drivers.sort(key=lambda x: x["ranking_score"], reverse=True)
    
    # Add position
    for i, driver in enumerate(drivers[:100]):
        driver["position"] = i + 1
    
    return drivers[:100]

@api_router.get("/ranking/state/{state}")
async def get_state_ranking(state: str, current_user: dict = Depends(get_current_user)):
    """Get top 100 drivers in a state"""
    if state.upper() not in BRAZILIAN_STATES:
        raise HTTPException(status_code=400, detail="Estado inválido")
    
    drivers = await db.users.find({
        "driver_status": "approved",
        "ranking_active": True,
        "state": state.upper()
    }, {"_id": 0, "password_hash": 0, "cnh_photo": 0, "face_photo": 0, "vehicle_photo": 0}).to_list(1000)
    
    for driver in drivers:
        driver["ranking_score"] = calculate_ranking_score(
            driver.get("total_rides", 0),
            driver.get("score", 1000),
            driver.get("average_rating", 5.0)
        )
    
    drivers.sort(key=lambda x: x["ranking_score"], reverse=True)
    
    for i, driver in enumerate(drivers[:100]):
        driver["position"] = i + 1
    
    return drivers[:100]

@api_router.get("/ranking/me")
async def get_my_ranking(current_user: dict = Depends(get_current_user)):
    """Get current user's ranking position"""
    if current_user.get("driver_status") != "approved":
        raise HTTPException(status_code=400, detail="Você não é um motorista aprovado")
    
    # Get all drivers for Brazil ranking
    all_drivers = await db.users.find({
        "driver_status": "approved"
    }, {"_id": 0, "id": 1, "score": 1, "total_rides": 1, "average_rating": 1, "state": 1}).to_list(10000)
    
    for driver in all_drivers:
        driver["ranking_score"] = calculate_ranking_score(
            driver.get("total_rides", 0),
            driver.get("score", 1000),
            driver.get("average_rating", 5.0)
        )
    
    all_drivers.sort(key=lambda x: x["ranking_score"], reverse=True)
    
    # Find Brazil position
    brazil_position = None
    for i, driver in enumerate(all_drivers):
        if driver["id"] == current_user["id"]:
            brazil_position = i + 1
            break
    
    # Find state position
    state_drivers = [d for d in all_drivers if d.get("state") == current_user.get("state")]
    state_position = None
    for i, driver in enumerate(state_drivers):
        if driver["id"] == current_user["id"]:
            state_position = i + 1
            break
    
    return {
        "brazil_position": brazil_position,
        "state_position": state_position,
        "state": current_user.get("state", ""),
        "total_brazil_drivers": len(all_drivers),
        "total_state_drivers": len(state_drivers),
        "ranking_score": calculate_ranking_score(
            current_user.get("total_rides", 0),
            current_user.get("score", 1000),
            current_user.get("average_rating", 5.0)
        )
    }

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/dashboard")
async def admin_dashboard(current_user: dict = Depends(require_admin)):
    """Get admin dashboard stats"""
    total_users = await db.users.count_documents({})
    total_drivers = await db.users.count_documents({"driver_status": "approved"})
    pending_drivers = await db.users.count_documents({"driver_status": "pending"})
    total_rides = await db.rides.count_documents({})
    completed_rides = await db.rides.count_documents({"status": "completed"})
    cancelled_rides = await db.rides.count_documents({"status": "cancelled"})
    
    # Total revenue
    revenue_cursor = db.rides.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$final_price"}}}
    ])
    revenue_list = await revenue_cursor.to_list(1)
    total_revenue = revenue_list[0]["total"] if revenue_list else 0
    
    # App earnings (15%)
    app_earnings = total_revenue * 0.15
    
    return {
        "total_users": total_users,
        "total_drivers": total_drivers,
        "pending_drivers": pending_drivers,
        "total_rides": total_rides,
        "completed_rides": completed_rides,
        "cancelled_rides": cancelled_rides,
        "cancellation_rate": round((cancelled_rides / total_rides * 100) if total_rides > 0 else 0, 2),
        "total_revenue": round(total_revenue, 2),
        "app_earnings": round(app_earnings, 2)
    }

@api_router.get("/admin/users")
async def admin_get_users(skip: int = 0, limit: int = 50, role: str = None, current_user: dict = Depends(require_admin)):
    """Get all users"""
    query = {}
    if role:
        if role == "driver":
            query["driver_status"] = "approved"
        elif role == "pending":
            query["driver_status"] = "pending"
        else:
            query["role"] = role
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {"users": users, "total": total}

@api_router.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Get user details"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@api_router.post("/admin/drivers/{user_id}/approve")
async def admin_approve_driver(user_id: str, current_user: dict = Depends(require_admin)):
    """Approve driver application"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"driver_status": "approved", "is_driver": True, "approved_at": datetime.utcnow()}}
    )
    
    return {"message": "Motorista aprovado com sucesso"}

@api_router.post("/admin/drivers/{user_id}/reject")
async def admin_reject_driver(user_id: str, reason: str = "", current_user: dict = Depends(require_admin)):
    """Reject driver application"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"driver_status": "rejected", "rejection_reason": reason, "rejected_at": datetime.utcnow()}}
    )
    
    return {"message": "Motorista rejeitado"}

@api_router.post("/admin/users/{user_id}/block")
async def admin_block_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Block a user"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": False, "blocked_at": datetime.utcnow()}}
    )
    return {"message": "Usuário bloqueado"}

@api_router.post("/admin/users/{user_id}/unblock")
async def admin_unblock_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Unblock a user"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": True, "blocked_at": None}}
    )
    return {"message": "Usuário desbloqueado"}

@api_router.get("/admin/rides")
async def admin_get_rides(skip: int = 0, limit: int = 50, status: str = None, current_user: dict = Depends(require_admin)):
    """Get all rides"""
    query = {}
    if status:
        query["status"] = status
    
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.rides.count_documents(query)
    
    return {"rides": rides, "total": total}

# ============== RIDE CATEGORIES ==============

@api_router.get("/rides/categories")
async def get_ride_categories():
    return [
        {"id": "moto", "name": "LetsGo Moto", "description": "Mais barato e mais rápido", "price_per_km": 1.20, "price_per_minute": 0.20, "base_fee": 3.00, "icon": "motorcycle"},
        {"id": "car", "name": "LetsGo Carro", "description": "Categoria padrão", "price_per_km": 1.50, "price_per_minute": 0.30, "base_fee": 4.00, "icon": "car"},
        {"id": "comfort", "name": "LetsGo Comfort", "description": "Mais espaço e conforto", "price_per_km": 2.00, "price_per_minute": 0.40, "base_fee": 5.00, "icon": "car-sport"},
        {"id": "women", "name": "LetsGo Mulheres", "description": "Apenas motoristas mulheres", "price_per_km": 1.50, "price_per_minute": 0.30, "base_fee": 4.00, "icon": "woman"}
    ]

# ============== RIDE ROUTES ==============

@api_router.post("/rides/estimate")
async def estimate_ride(request: RideRequest, current_user: dict = Depends(get_current_user)):
    distance_km = haversine_distance(request.origin_lat, request.origin_lng, request.destination_lat, request.destination_lng)
    duration_min = (distance_km / 30) * 60
    
    estimates = []
    for category in ["moto", "car", "comfort", "women"]:
        if category == "women" and current_user.get("gender") != "female":
            continue
        price = calculate_ride_price(distance_km, duration_min, category)
        estimates.append({"category": category, "distance_km": round(distance_km, 2), "duration_min": round(duration_min, 0), "price": price})
    
    return estimates

@api_router.post("/rides/request")
async def request_ride(request: RideRequest, current_user: dict = Depends(get_current_user)):
    if request.category == "women" and current_user.get("gender") != "female":
        raise HTTPException(status_code=400, detail="LetsGo Mulheres é apenas para passageiras mulheres")
    
    distance_km = haversine_distance(request.origin_lat, request.origin_lng, request.destination_lat, request.destination_lng)
    duration_min = (distance_km / 30) * 60
    price = calculate_ride_price(distance_km, duration_min, request.category)
    
    ride = Ride(
        passenger_id=current_user["id"],
        origin_lat=request.origin_lat,
        origin_lng=request.origin_lng,
        origin_address=request.origin_address,
        destination_lat=request.destination_lat,
        destination_lng=request.destination_lng,
        destination_address=request.destination_address,
        category=request.category,
        distance_km=round(distance_km, 2),
        duration_min=round(duration_min, 0),
        estimated_price=price
    )
    
    await db.rides.insert_one(ride.model_dump())
    
    return ride.model_dump()

@api_router.get("/rides/{ride_id}")
async def get_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    return ride

@api_router.get("/rides/active/current")
async def get_active_ride(current_user: dict = Depends(get_current_user)):
    # Check as passenger
    ride = await db.rides.find_one({
        "passenger_id": current_user["id"],
        "status": {"$in": ["searching_driver", "driver_assigned", "driver_arrived", "in_progress"]}
    }, {"_id": 0})
    
    if not ride:
        # Check as driver
        ride = await db.rides.find_one({
            "driver_id": current_user["id"],
            "status": {"$in": ["driver_assigned", "driver_arrived", "in_progress"]}
        }, {"_id": 0})
    
    if ride and ride.get("driver_id"):
        driver = await db.users.find_one({"id": ride["driver_id"]}, {"_id": 0, "password_hash": 0})
        if driver:
            ride["driver"] = {
                "id": driver["id"],
                "name": driver["name"],
                "phone": driver.get("phone", ""),
                "vehicle_type": driver.get("vehicle_type", ""),
                "vehicle_model": driver.get("vehicle_model", ""),
                "vehicle_plate": driver.get("vehicle_plate", ""),
                "vehicle_color": driver.get("vehicle_color", "")
            }
    
    return ride

@api_router.post("/rides/{ride_id}/cancel")
async def cancel_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    
    if ride["passenger_id"] != current_user["id"] and ride.get("driver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if ride["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Corrida já finalizada")
    
    cancelled_by = "passenger" if ride["passenger_id"] == current_user["id"] else "driver"
    cancellation_fee = 0
    
    if ride["status"] in ["driver_assigned", "driver_arrived"]:
        accepted_at = ride.get("accepted_at")
        if accepted_at and (datetime.utcnow() - accepted_at).total_seconds() / 60 >= 5:
            cancellation_fee = 5.00
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow(), "cancelled_by": cancelled_by, "cancellation_fee": cancellation_fee}}
    )
    
    # Penalize canceller
    if cancelled_by == "driver":
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"score": -20}})
    
    return {"message": "Corrida cancelada", "cancellation_fee": cancellation_fee}

@api_router.get("/rides/history/list")
async def get_ride_history(current_user: dict = Depends(get_current_user)):
    # Get as passenger or driver
    rides = await db.rides.find({
        "$or": [
            {"passenger_id": current_user["id"]},
            {"driver_id": current_user["id"]}
        ],
        "status": {"$in": ["completed", "cancelled"]}
    }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return rides

# ============== NEARBY DRIVERS ==============

@api_router.get("/drivers/nearby")
async def get_nearby_drivers(lat: float, lng: float, radius_km: float = 5, current_user: dict = Depends(get_current_user)):
    """Get nearby online drivers"""
    # Get real online drivers
    online_drivers = await db.users.find({
        "driver_status": "approved",
        "driver_online": True
    }, {"_id": 0, "id": 1, "name": 1, "vehicle_type": 1, "state": 1}).to_list(100)
    
    # Get their locations
    drivers_with_location = []
    for driver in online_drivers:
        location = await db.driver_locations.find_one({"driver_id": driver["id"]}, {"_id": 0})
        if location:
            distance = haversine_distance(lat, lng, location["lat"], location["lng"])
            if distance <= radius_km:
                drivers_with_location.append({
                    "id": driver["id"],
                    "name": driver["name"],
                    "lat": location["lat"],
                    "lng": location["lng"],
                    "heading": location.get("heading", 0),
                    "vehicle_type": driver.get("vehicle_type", "car"),
                    "distance_km": round(distance, 2)
                })
    
    # If no real drivers, return mocked ones
    if not drivers_with_location:
        import random
        for i in range(5):
            offset_lat = random.uniform(-0.02, 0.02)
            offset_lng = random.uniform(-0.02, 0.02)
            drivers_with_location.append({
                "id": f"mock-driver-{i+1}",
                "name": f"Motorista {i+1}",
                "lat": lat + offset_lat,
                "lng": lng + offset_lng,
                "vehicle_type": random.choice(["moto", "car", "comfort"]),
                "heading": random.randint(0, 360),
                "distance_km": round(haversine_distance(lat, lng, lat + offset_lat, lng + offset_lng), 2)
            })
    
    return drivers_with_location

# ============== PAYMENT ROUTES ==============

@api_router.post("/payments/authorize")
async def authorize_payment(ride_id: str, method: str, current_user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    
    payment = Payment(
        ride_id=ride_id,
        user_id=current_user["id"],
        method=method,
        amount=ride["estimated_price"],
        status="authorized" if method == "card" else "pending",
        transaction_id=f"TXN-{uuid.uuid4().hex[:8].upper()}"
    )
    
    if method == "pix":
        payment.pix_code = f"00020126580014BR.GOV.BCB.PIX0136{uuid.uuid4()}5204000053039865802BR5925LETSGO MOBILIDADE6009SAO PAULO62070503***6304"
        payment.pix_qr = payment.pix_code
    
    await db.payments.insert_one(payment.model_dump())
    await db.rides.update_one({"id": ride_id}, {"$set": {"payment_method": method, "payment_status": payment.status}})
    
    return payment.model_dump()

@api_router.get("/payments/methods")
async def get_payment_methods(current_user: dict = Depends(get_current_user)):
    return [
        {"id": "card", "name": "Cartão de Crédito", "icon": "card", "last4": "4242"},
        {"id": "pix", "name": "PIX", "icon": "qr-code"},
        {"id": "cash", "name": "Dinheiro", "icon": "cash"}
    ]

# ============== RATING ROUTES ==============

@api_router.post("/ratings")
async def create_rating(rating_data: dict, current_user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": rating_data["ride_id"]})
    if not ride:
        raise HTTPException(status_code=404, detail="Corrida não encontrada")
    
    if ride["status"] != "completed":
        raise HTTPException(status_code=400, detail="Só é possível avaliar corridas finalizadas")
    
    existing = await db.ratings.find_one({"ride_id": rating_data["ride_id"], "from_user_id": current_user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Você já avaliou esta corrida")
    
    rating = Rating(
        ride_id=rating_data["ride_id"],
        from_user_id=current_user["id"],
        to_user_id=rating_data["to_user_id"],
        score=rating_data["score"],
        comment=rating_data.get("comment")
    )
    
    await db.ratings.insert_one(rating.model_dump())
    
    # Update average rating
    all_ratings = await db.ratings.find({"to_user_id": rating_data["to_user_id"]}).to_list(1000)
    if all_ratings:
        avg = sum(r["score"] for r in all_ratings) / len(all_ratings)
        await db.users.update_one({"id": rating_data["to_user_id"]}, {"$set": {"average_rating": round(avg, 2)}})
    
    # Penalize for bad ratings
    if rating_data["score"] <= 2:
        await db.users.update_one({"id": rating_data["to_user_id"]}, {"$inc": {"negative_ratings": 1}})
        user = await db.users.find_one({"id": rating_data["to_user_id"]})
        if user and user.get("negative_ratings", 0) >= 2:
            await db.users.update_one({"id": rating_data["to_user_id"]}, {"$inc": {"score": -10}, "$set": {"negative_ratings": 0}})
    
    return rating.model_dump()

# ============== WEBSOCKET ==============

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "location_update":
                await db.driver_locations.update_one(
                    {"driver_id": user_id},
                    {"$set": {"lat": message["lat"], "lng": message["lng"], "heading": message.get("heading", 0), "updated_at": datetime.utcnow()}},
                    upsert=True
                )
            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# ============== HEALTH CHECK ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "version": "2.0.0"}

@api_router.get("/")
async def root():
    return {"message": "LetsGo API v2.0.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create admin user on startup
@app.on_event("startup")
async def create_admin():
    admin_email = "brunoschardosim60@gmail.com"
    admin_password = "Aa1234@Lets"

    # Upsert garante que a conta admin sempre exista e com senha conhecida em ambiente de desenvolvimento.
    await db.users.update_one(
        {"email": admin_email},
        {
            "$set": {
                "name": "Bruno Admin",
                "email": admin_email,
                "phone": "00000000000",
                "gender": "male",
                "cpf": "08818900579",
                "role": "admin",
                "password_hash": get_password_hash(admin_password),
                "is_active": True,
                "score": 1000,
                "is_driver": False,
                "driver_status": "none",
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": datetime.utcnow(),
            },
        },
        upsert=True,
    )
    logger.info("Admin user ensured (email: %s)", admin_email)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
