from fastapi import FastAPI, Request, Cookie, File, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter

import cloudinary
import cloudinary.uploader
import os

# ------------------------------
# ENV + Cloudinary Configuration
# ------------------------------
from dotenv import load_dotenv
load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# ------------------------------
# Database setup
# ------------------------------
from app.database.session import Base, engine
from app.models.product import Product  # ensure model registration

# ------------------------------
# Route Imports
# ------------------------------
from app.routes import auth, products, cart, otp, payment, admins
from app.routes.admins_ops import router as admins_ops_router

# ------------------------------
# Initialize FastAPI app
# ------------------------------
app = FastAPI(title="Gokhale Backend API")

# ------------------------------
# CORS Middleware
# ------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------
# Static files & templates
# ------------------------------
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ------------------------------
# API ROUTER (PREFIX = /api)
# ------------------------------
api_router = APIRouter(prefix="/api")

@api_router.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    """
    Upload image to Cloudinary and return secure URL
    """
    try:
        result = cloudinary.uploader.upload(
            file.file,
            folder="my_uploads"
        )
        return {"image_url": result["secure_url"]}

    except Exception as e:
        return {"error": str(e)}

# ------------------------------
# Register Routers
# ------------------------------
app.include_router(api_router)          # 👈 IMPORTANT
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(cart.router)
app.include_router(payment.router)
app.include_router(admins.router)
app.include_router(admins_ops_router)

# ------------------------------
# Create DB Tables
# ------------------------------
Base.metadata.create_all(bind=engine)

# ------------------------------
# Root Page
# ------------------------------
@app.get("/", response_class=HTMLResponse)
def index(request: Request, logged_in: str = Cookie(default=None)):
    is_logged_in = request.cookies.get("logged_in") == "true"
    return templates.TemplateResponse(
        "products.html",
        {
            "request": request,
            "is_logged_in": is_logged_in
        }
    )
