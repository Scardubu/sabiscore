"""Security helpers for password hashing and JWT token handling."""

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
	"""Return True when the supplied password matches the stored hash."""

	try:
		return pwd_context.verify(plain_password, hashed_password)
	except ValueError:
		return False


def get_password_hash(password: str) -> str:
	"""Hash a password using the configured passlib context."""

	return pwd_context.hash(password)


def create_access_token(
	subject: str,
	*,
	expires_delta: Optional[timedelta] = None,
	scope: str = "api",
	extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
	"""Create a signed JWT containing the provided subject and claims."""

	now = datetime.utcnow()
	expire_delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
	claims: Dict[str, Any] = {
		"sub": subject,
		"iat": now,
		"exp": now + expire_delta,
		"scope": scope,
	}
	if extra_claims:
		claims.update(extra_claims)
	return jwt.encode(claims, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
	"""Decode a JWT and return its payload, raising JWTError on failure."""

	return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


__all__ = [
	"create_access_token",
	"decode_access_token",
	"get_password_hash",
	"verify_password",
]
