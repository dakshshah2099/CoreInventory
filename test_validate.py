import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.db.database import SessionLocal
from backend.models.models import Receipt, ReceiptLine, Delivery, DeliveryLine, Product, StatusEnum, Location
from backend.routers.receipts import validate_receipt
from backend.routers.deliveries import validate_delivery

def test_validate():
    db = SessionLocal()
    
    product = db.query(Product).first()
    if not product:
        product = Product(name="Test Product", sku="TEST-SKU-1", reorder_level=10)
        db.add(product)
        db.commit()
        db.refresh(product)
        
    print(f"Using Product ID: {product.id}")

    # Test Receipt
    receipt = Receipt(reference="TEST-IN-1", supplier="Vendor A", status=StatusEnum.draft)
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    
    r_line = ReceiptLine(receipt_id=receipt.id, product_id=product.id, quantity=5)
    db.add(r_line)
    db.commit()
    
    print(f"Validating Receipt ID: {receipt.id}")
    try:
        res = validate_receipt(receipt.id, db, current_user=None)
        print("Success Receipt:", res)
    except Exception as e:
        print("Receipt Error details:")
        import traceback
        traceback.print_exc()

    # Test Delivery
    delivery = Delivery(reference="TEST-OUT-1", customer="Customer B", status=StatusEnum.draft)
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    
    d_line = DeliveryLine(delivery_id=delivery.id, product_id=product.id, quantity=1)
    db.add(d_line)
    db.commit()

    print(f"Validating Delivery ID: {delivery.id}")
    try:
        res = validate_delivery(delivery.id, db, current_user=None)
        print("Success Delivery:", res)
    except Exception as e:
        print("Delivery Error details:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_validate()
