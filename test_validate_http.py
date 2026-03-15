import sys
import os
import requests

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.db.database import SessionLocal
from backend.models.models import Delivery, DeliveryLine, Product, StatusEnum

def test_api():
    db = SessionLocal()
    product = db.query(Product).first()
    if not product:
        product = Product(name="Test Product", sku="TEST-SKU-1", reorder_level=10)
        db.add(product)
        db.commit()
    
    delivery = Delivery(reference="TEST-OUT-1", customer="Customer B", status=StatusEnum.draft)
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    
    # Needs to be a high quantity to guarantee it's larger than total_stock
    d_line = DeliveryLine(delivery_id=delivery.id, product_id=product.id, quantity=99999)
    db.add(d_line)
    db.commit()

    # Login to get token
    res = requests.post("http://localhost:8000/api/auth/login", json={
        "email": "staff@test.com",
        "password": "password123"
    })
    token = res.json()["data"]["token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Hitting /api/deliveries/%s/validate" % delivery.id)
    r = requests.put(f"http://localhost:8000/api/deliveries/{delivery.id}/validate", headers=headers)
    print("HTTP STATUS:", r.status_code)
    try:
        print("HTTP JSON:", r.json())
    except:
        print("HTTP TEXT:", r.text)

if __name__ == "__main__":
    test_api()
