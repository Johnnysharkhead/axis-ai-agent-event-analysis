from . import db


class DailySummary(db.Model):
    __tablename__ = "daily_summary"

    id = db.Column(db.Integer, primary_key=True)
    summary_date = db.Column(db.Date, nullable=False, index=True)
    camera_serial = db.Column(
        db.String(64), nullable=True, index=True
    )  # null = all cameras
    summary_text = db.Column(db.Text, nullable=False)
    status = db.Column(
        db.String(32), nullable=False, default="success"
    )  # e.g., success|pending|failed
    error_message = db.Column(db.Text, nullable=True)
    zone_id = db.Column(
        db.Integer, db.ForeignKey("zones.id"), nullable=True, index=True
    )
    zone = db.relationship("Zone", backref="daily_summaries", lazy="joined")

    def serialize(self):
        return {
            "id": self.id,
            "summary_date": (
                self.summary_date.isoformat() if self.summary_date else None
            ),
            "camera_serial": self.camera_serial,
            "summary_text": self.summary_text,
            "source_row_count": self.source_row_count,
            "status": self.status,
            "error_message": self.error_message,
            "llm_model": self.llm_model,
            "prompt_version": self.prompt_version,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
