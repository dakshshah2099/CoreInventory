import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.db.database import engine, Base
import backend.models.models

app = FastAPI(title="CoreInventory")

# Create tables
Base.metadata.create_all(bind=engine)

# Configure CORS
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register all API routers BEFORE the static file mount ---
from backend.routers import auth, products, warehouses, receipts, deliveries, transfers, dashboard, moves, logs, users, adjustments

# EXACT order as requested
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(warehouses.warehouse_router)
app.include_router(warehouses.location_router)
app.include_router(receipts.router)
app.include_router(deliveries.router)
app.include_router(transfers.router)
app.include_router(dashboard.router)
app.include_router(moves.router)
app.include_router(logs.router)
app.include_router(users.router)
app.include_router(adjustments.router)

# --- Frontend Mount (AFTER all routers) ---
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
os.makedirs(frontend_dir, exist_ok=True)
app.mount("/app", StaticFiles(directory=frontend_dir), name="frontend")

@app.get("/")
def root():
    return RedirectResponse(url="/app/pages/login.html")
