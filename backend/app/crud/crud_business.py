import uuid as uuid_pkg
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlmodel import Session, select, or_, and_
from app.models.business import (
    Business,
    Employee,
    BusinessProduct,
    BusinessCustomer,
    BusinessOrder,
    BusinessMessage,
    TeamMessage,
    BusinessTask,
    BusinessRole
)
from app.services.kafka_service import kafka_service


class CRUDBusiness:
    def create_business(self, db: Session, *, owner_id: int, name: str, slug: str, category: str, **kwargs) -> Business:
        business = Business(
            owner_id=owner_id,
            name=name,
            slug=slug,
            category=category,
            **kwargs
        )
        db.add(business)
        db.commit()
        db.refresh(business)

        # Automatically add the owner as the first employee with OWNER role
        employee = Employee(
            business_id=business.id,
            user_id=owner_id,
            role=BusinessRole.OWNER,
            is_active=True,
            joined_at=datetime.utcnow()
        )
        db.add(employee)
        db.commit()

        # Emit Kafka Event
        kafka_service.send_event("USER_CREATED_BUSINESS", {
            "business_id": str(business.id),
            "owner_id": owner_id,
            "name": business.name,
            "category": business.category
        }, key=str(business.id))

        return business

    def get_business(self, db: Session, business_id: uuid_pkg.UUID) -> Optional[Business]:
        return db.get(Business, business_id)

    def get_business_by_slug(self, db: Session, slug: str) -> Optional[Business]:
        stmt = select(Business).where(Business.slug == slug)
        return db.exec(stmt).first()

    def list_user_businesses(self, db: Session, user_id: int) -> List[Business]:
        # Businesses where user is owner or employee
        emp_stmt = select(Employee.business_id).where(
            Employee.user_id == user_id,
            Employee.is_active == True
        )
        raw_ids = db.exec(emp_stmt).all()
        # Ensure we have a flat list of integers (handle tuple results)
        emp_business_ids = [bid if not isinstance(bid, (list, tuple)) else bid[0] for bid in raw_ids if bid is not None]
        # If no employee businesses, only filter by ownership
        if not emp_business_ids:
            stmt = select(Business).where(Business.owner_id == user_id)
        else:
            stmt = select(Business).where(
                or_(
                    Business.owner_id == user_id,
                    Business.id.in_(emp_business_ids)
                )
            )
        return db.exec(stmt).all()

    def update_business(self, db: Session, business: Business, update_data: dict) -> Business:
        for field, value in update_data.items():
            if hasattr(business, field):
                setattr(business, field, value)
        business.updated_at = datetime.utcnow()
        db.add(business)
        db.commit()
        db.refresh(business)
        return business

    # --- Employees ---
    def invite_employee(
        self, db: Session, business_id: uuid_pkg.UUID, email: Optional[str], phone: Optional[str], role: BusinessRole
    ) -> Employee:
        employee = Employee(
            business_id=business_id,
            invite_email=email,
            invite_phone=phone,
            role=role,
            is_active=True
        )
        db.add(employee)
        db.commit()
        db.refresh(employee)

        # Send invite email/phone trigger via Kafka
        kafka_service.send_event("EMPLOYEE_ADDED", {
            "business_id": str(business_id),
            "employee_id": employee.id,
            "invite_email": email,
            "invite_phone": phone,
            "role": role.value
        }, key=str(business_id))

        return employee

    def link_employee_user(self, db: Session, employee: Employee, user_id: int) -> Employee:
        employee.user_id = user_id
        employee.joined_at = datetime.utcnow()
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return employee

    def get_employee(self, db: Session, employee_id: int) -> Optional[Employee]:
        return db.get(Employee, employee_id)

    def get_employee_by_user(self, db: Session, business_id: uuid_pkg.UUID, user_id: int) -> Optional[Employee]:
        stmt = select(Employee).where(
            Employee.business_id == business_id,
            Employee.user_id == user_id,
            Employee.is_active == True
        )
        return db.exec(stmt).first()

    def list_employees(self, db: Session, business_id: uuid_pkg.UUID) -> List[Employee]:
        stmt = select(Employee).where(Employee.business_id == business_id)
        return db.exec(stmt).all()

    # --- Products & Inventory ---
    def create_product(self, db: Session, business_id: uuid_pkg.UUID, *, name_en: str, price: float, **kwargs) -> BusinessProduct:
        product = BusinessProduct(
            business_id=business_id,
            name_en=name_en,
            price=price,
            **kwargs
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        # Emit Kafka Event
        kafka_service.send_event("PRODUCT_CREATED", {
            "business_id": str(business_id),
            "product_id": product.id,
            "name": name_en,
            "price": price,
            "stock_level": product.stock_level
        }, key=str(business_id))

        return product

    def get_product(self, db: Session, product_id: int) -> Optional[BusinessProduct]:
        return db.get(BusinessProduct, product_id)

    def list_products(self, db: Session, business_id: uuid_pkg.UUID) -> List[BusinessProduct]:
        stmt = select(BusinessProduct).where(BusinessProduct.business_id == business_id)
        return db.exec(stmt).all()

    def update_product(self, db: Session, product: BusinessProduct, update_data: dict) -> BusinessProduct:
        for field, value in update_data.items():
            if hasattr(product, field):
                setattr(product, field, value)
        product.updated_at = datetime.utcnow()
        db.add(product)
        db.commit()
        db.refresh(product)
        return product

    # --- CRM Customers ---
    def get_or_create_customer(self, db: Session, business_id: uuid_pkg.UUID, user_id: int) -> BusinessCustomer:
        stmt = select(BusinessCustomer).where(
            BusinessCustomer.business_id == business_id,
            BusinessCustomer.user_id == user_id
        )
        cust = db.exec(stmt).first()
        if not cust:
            cust = BusinessCustomer(
                business_id=business_id,
                user_id=user_id
            )
            db.add(cust)
            db.commit()
            db.refresh(cust)
        return cust

    def list_customers(self, db: Session, business_id: uuid_pkg.UUID) -> List[BusinessCustomer]:
        stmt = select(BusinessCustomer).where(BusinessCustomer.business_id == business_id)
        return db.exec(stmt).all()

    def update_customer_notes(self, db: Session, customer: BusinessCustomer, notes: str) -> BusinessCustomer:
        customer.notes = notes
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer

    # --- Orders ---
    def create_order(
        self, db: Session, business_id: uuid_pkg.UUID, customer_id: int, items: List[dict], total_amount: float, **kwargs
    ) -> BusinessOrder:
        order = BusinessOrder(
            business_id=business_id,
            customer_id=customer_id,
            items=items,
            total_amount=total_amount,
            **kwargs
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        # Trigger CRM Customer instantiation
        self.get_or_create_customer(db, business_id, customer_id)

        # Emit Kafka Event for real-time stock deductions, socket notifications and dashboard updates
        kafka_service.send_event("ORDER_PLACED", {
            "business_id": str(business_id),
            "order_id": order.id,
            "customer_id": customer_id,
            "total_amount": total_amount,
            "items": items,
            "payment_method": order.payment_method
        }, key=str(business_id))

        return order

    def get_order(self, db: Session, order_id: int) -> Optional[BusinessOrder]:
        return db.get(BusinessOrder, order_id)

    def list_orders(self, db: Session, business_id: uuid_pkg.UUID) -> List[BusinessOrder]:
        stmt = select(BusinessOrder).where(BusinessOrder.business_id == business_id).order_by(BusinessOrder.created_at.desc())
        return db.exec(stmt).all()

    def update_order_status(self, db: Session, order: BusinessOrder, status: str, employee_id: Optional[int] = None) -> BusinessOrder:
        order.status = status
        if employee_id:
            order.employee_id = employee_id
        order.updated_at = datetime.utcnow()
        db.add(order)
        db.commit()
        db.refresh(order)

        business = db.get(Business, order.business_id)

        # Dispatch status update event — includes customer_id so the consumer
        # can push this directly to the buyer (not just the business's own room).
        kafka_service.send_event("ORDER_STATUS_UPDATED", {
            "business_id": str(order.business_id),
            "business_name": business.name if business else None,
            "order_id": order.id,
            "customer_id": order.customer_id,
            "status": status,
            "employee_id": employee_id
        }, key=str(order.business_id))

        return order

    # --- Messages ---
    def create_business_message(
        self, db: Session, business_id: uuid_pkg.UUID, customer_id: int, sender_id: int, content: str, is_from_customer: bool, **kwargs
    ) -> BusinessMessage:
        message = BusinessMessage(
            business_id=business_id,
            customer_id=customer_id,
            sender_id=sender_id,
            content=content,
            is_from_customer=is_from_customer,
            **kwargs
        )
        db.add(message)
        db.commit()
        db.refresh(message)

        # Emit Kafka Event
        kafka_service.send_event("MESSAGE_RECEIVED", {
            "business_id": str(business_id),
            "message_id": message.id,
            "customer_id": customer_id,
            "sender_id": sender_id,
            "content": content,
            "is_from_customer": is_from_customer,
            "tags": message.tags
        }, key=str(business_id))

        return message

    def list_customer_messages(self, db: Session, business_id: uuid_pkg.UUID, customer_id: int) -> List[BusinessMessage]:
        stmt = select(BusinessMessage).where(
            BusinessMessage.business_id == business_id,
            BusinessMessage.customer_id == customer_id
        ).order_by(BusinessMessage.created_at.asc())
        return db.exec(stmt).all()

    def create_team_message(
        self, db: Session, business_id: uuid_pkg.UUID, sender_id: int, content: str, is_announcement: bool = False, **kwargs
    ) -> TeamMessage:
        message = TeamMessage(
            business_id=business_id,
            sender_id=sender_id,
            content=content,
            is_announcement=is_announcement,
            **kwargs
        )
        db.add(message)
        db.commit()
        db.refresh(message)

        # Emit Kafka Event
        kafka_service.send_event("TEAM_MESSAGE_RECEIVED", {
            "business_id": str(business_id),
            "message_id": message.id,
            "sender_id": sender_id,
            "content": content,
            "is_announcement": is_announcement
        }, key=str(business_id))

        return message

    def list_team_messages(self, db: Session, business_id: uuid_pkg.UUID) -> List[TeamMessage]:
        stmt = select(TeamMessage).where(TeamMessage.business_id == business_id).order_by(TeamMessage.created_at.asc())
        return db.exec(stmt).all()

    # --- Workspace Tasks ---
    def create_task(self, db: Session, business_id: uuid_pkg.UUID, title: str, **kwargs) -> BusinessTask:
        task = BusinessTask(
            business_id=business_id,
            title=title,
            **kwargs
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        # Emit Kafka Event
        kafka_service.send_event("TASK_CREATED", {
            "business_id": str(business_id),
            "task_id": task.id,
            "title": title,
            "status": task.status
        }, key=str(business_id))

        return task

    def list_tasks(self, db: Session, business_id: uuid_pkg.UUID) -> List[BusinessTask]:
        stmt = select(BusinessTask).where(BusinessTask.business_id == business_id)
        return db.exec(stmt).all()

    def get_task(self, db: Session, task_id: int) -> Optional[BusinessTask]:
        return db.get(BusinessTask, task_id)

    def update_task(self, db: Session, task: BusinessTask, update_data: dict) -> BusinessTask:
        for field, value in update_data.items():
            if hasattr(task, field):
                setattr(task, field, value)
        db.add(task)
        db.commit()
        db.refresh(task)

        # Emit Kafka Event
        kafka_service.send_event("TASK_UPDATED", {
            "business_id": str(task.business_id),
            "task_id": task.id,
            "title": task.title,
            "status": task.status,
            "assigned_to": task.assigned_to
        }, key=str(task.business_id))

        return task


crud_business = CRUDBusiness()
