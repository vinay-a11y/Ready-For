from fastapi import APIRouter, Request, Form, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from uuid import uuid4
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from fastapi import Cookie

from app.database.session import get_db
from app.models.user import User
from app.schemas.user import ResetPasswordRequest
from app.schemas.user import UserAddressUpdate, Address
from sqlalchemy.orm.attributes import flag_modified

# Load environment variables
load_dotenv()

router = APIRouter()
templates = Jinja2Templates(directory="templates")

# JWT CONFIG
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

# Password Hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ================== UTILITY FUNCTIONS ================== #

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def hash_answer(answer: str) -> str:
    return pwd_context.hash(answer.lower().strip())

def verify_answer(answer: str, hashed: str) -> bool:
    return pwd_context.verify(answer.lower().strip(), hashed)

def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db)
):
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

# ================== AUTHENTICATION ROUTES ================== #

@router.get("/register", response_class=HTMLResponse)
def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@router.post("/register")
async def register(
    firstName: str = Form(...),
    phone: str = Form(...),
    password: str = Form(...),
    confirmPassword: str = Form(...),
    security_q1: str = Form(...),
    security_q2: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Register a new user with first name, phone, security questions, and password.
    Note: lastName is NOT required.
    """

    if password != confirmPassword:
        return JSONResponse(status_code=400, content={"error": "Passwords do not match"})

    existing = db.query(User).filter(User.mobile_number == phone).first()
    if existing:
        return JSONResponse(status_code=400, content={"error": "Mobile number already registered"})

    hashed_pw = hash_password(password)

    user = User(
        first_name=firstName,
        last_name="",  # Set empty string since lastName is not provided
        mobile_number=phone,
        password=hashed_pw,
        customer_id=str(uuid4())[:8],
        internal_id=str(uuid4()),
        security_questions={
            "q1": hash_answer(security_q1),
            "q2": hash_answer(security_q2),
        }
    )

    try:
        db.add(user)
        db.commit()
        return JSONResponse(status_code=200, content={"message": "Registration successful"})
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"error": "Registration failed: " + str(e)})

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@router.post("/login")
def login(
    mobile_number: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Login user with phone number and password.
    Returns access token as httpOnly cookie and user info in response.
    """
    user = db.query(User).filter(User.mobile_number == mobile_number).first()
    
    if not user or not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    response = JSONResponse(content={
        "message": "Login successful",
        "user": {
            "first_name": user.first_name,
            "id": user.id,
            "role": user.role
        }
    })

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,  # Set to True in production (HTTPS)
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return response

@router.get("/logout")
def logout():
    """Logout user by deleting access_token cookie"""
    response = RedirectResponse(url="/", status_code=302)
    response.delete_cookie("access_token")
    return response

# ================== PASSWORD RESET ROUTES ================== #

@router.post("/forgot-password/verify")
def forgot_password_verify(
    phone: str = Form(...),
    answer1: str = Form(...),
    answer2: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Step 1: Verify user identity using phone number and security questions.
    Returns success if answers match stored hashed answers.
    """
    user = db.query(User).filter(User.mobile_number == phone).first()

    if not user or not user.security_questions:
        raise HTTPException(status_code=404, detail="User not found")

    if not (
        verify_answer(answer1, user.security_questions["q1"]) and
        verify_answer(answer2, user.security_questions["q2"])
    ):
        raise HTTPException(status_code=401, detail="Incorrect answers")

    return JSONResponse(status_code=200, content={"message": "Verified"})

@router.post("/forgot-password/reset")
def forgot_password_reset(
    phone: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Step 2: Reset password after identity verification.
    Passwords must match.
    """
    if new_password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    user = db.query(User).filter(User.mobile_number == phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(new_password)
    db.commit()

    return JSONResponse(status_code=200, content={"message": "Password reset successful"})

# ================== ADDRESS MANAGEMENT ROUTES ================== #

@router.get("/api/user/addresses")
def get_user_saved_address(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all saved addresses for the current user"""
    addresses = current_user.address or []
    return {
        "addresses": addresses,
        "count": len(addresses)
    }

@router.post("/api/user/address")
async def save_user_address(
    payload: UserAddressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a new address for the current user"""
    if current_user.address is None:
        current_user.address = []

    new_address = payload.address.model_dump()

    is_duplicate = any(
        addr.get("line1") == new_address.get("line1") and
        addr.get("pincode") == new_address.get("pincode")
        for addr in current_user.address
    )
    if is_duplicate:
        return JSONResponse(status_code=400, content={"message": "Address already exists"})

    current_user.address.append(new_address)
    flag_modified(current_user, "address")
    db.commit()

    return JSONResponse(status_code=200, content={"message": "Address saved successfully"})

@router.delete("/api/user/address/{address_id}")
async def delete_user_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an address for the current user"""
    current_user.address = [
        addr for addr in current_user.address
        if addr.get("id") != address_id
    ]
    flag_modified(current_user, "address")
    db.commit()

    return JSONResponse(status_code=200, content={"message": "Address deleted successfully"})

@router.put("/api/user/address/{address_id}")
async def update_user_address(
    address_id: int,
    address: Address,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing address for the current user"""
    for i, addr in enumerate(current_user.address or []):
        if addr.get("id") == address_id:
            current_user.address[i] = address.model_dump()
            flag_modified(current_user, "address")
            db.commit()
            return JSONResponse(status_code=200, content={"message": "Address updated successfully"})

    raise HTTPException(status_code=404, detail="Address not found")

# ================== PAGE ROUTES ================== #

def require_user_page(
    request: Request,
    db: Session = Depends(get_db),
    access_token: str | None = Cookie(default=None),
):
    """Middleware to ensure user is authenticated before accessing protected pages"""
    if not access_token:
        return RedirectResponse(url="/login", status_code=302)

    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise JWTError()
    except JWTError:
        return RedirectResponse(url="/login", status_code=302)

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        return RedirectResponse(url="/login", status_code=302)

    return user

@router.get("/cart", response_class=HTMLResponse)
def cart_page(
    request: Request,
    current_user = Depends(require_user_page),
):
    """Cart page (protected)"""
    if isinstance(current_user, RedirectResponse):
        return current_user

    return templates.TemplateResponse(
        "cart.html",
        {
            "request": request,
            "user": current_user,
        },
    )

@router.get("/orderss", response_class=HTMLResponse)
def orders_page(
    request: Request,
    current_user = Depends(require_user_page),
):
    """Orders page (protected)"""
    if isinstance(current_user, RedirectResponse):
        return current_user

    return templates.TemplateResponse(
        "orders.html",
        {
            "request": request,
            "user": current_user,
        },
    )

@router.get("/terms-and-conditions", response_class=HTMLResponse)
def terms_and_conditions_page(request: Request):
    """Terms and conditions page (public)"""
    return templates.TemplateResponse(
        "termscondition.html",
        {
            "request": request
        }
    )
# ================== CHANGE PASSWORD ROUTE ================== #

@router.post("/change-password")
def change_password(
    phone: str = Form(...),
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Change password using phone number + current password.
    """

    # 1️⃣ Check new passwords match
    if new_password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match"
        )

    # 2️⃣ Get user
    user = db.query(User).filter(User.mobile_number == phone).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # 3️⃣ Verify current password
    if not verify_password(current_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )

    # 4️⃣ Prevent reusing old password
    if verify_password(new_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be same as old password"
        )

    # 5️⃣ Update password
    user.password = hash_password(new_password)
    db.commit()

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Password changed successfully"}
    )
