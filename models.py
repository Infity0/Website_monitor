from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import json

db = SQLAlchemy()


class Website(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    check_interval = db.Column(db.Integer, default=5)  # minutes
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    checks = db.relationship('WebsiteCheck', backref='website', lazy=True, cascade='all, delete-orphan')


class WebsiteCheck(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)
    status_code = db.Column(db.Integer)
    response_time = db.Column(db.Float)  # in seconds
    is_up = db.Column(db.Boolean)
    error_message = db.Column(db.Text)
    checked_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        # Конвертируем время в локальный часовой пояс
        local_time = self.checked_at.replace(tzinfo=timezone.utc).astimezone()

        return {
            'id': self.id,
            'status_code': self.status_code,
            'response_time': self.response_time,
            'is_up': self.is_up,
            'error_message': self.error_message,
            'checked_at': local_time.isoformat()
        }

    def get_local_time(self):
        """Возвращает время в локальном часовом поясе"""
        if self.checked_at:
            # Конвертируем UTC в локальное время
            return self.checked_at.replace(tzinfo=timezone.utc).astimezone()
        return None