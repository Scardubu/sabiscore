"""Authentication endpoints providing JWT issuance and profile helpers."""

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import UserAccount
from ...core.security import create_access_token, get_password_hash, verify_password
from ...db.session import get_async_session
from ...deps import get_current_active_user
from ...schemas.auth import LoginRequest, LoginResponse
from ...schemas.token import Token
from ...schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

AUTH_RATE_LIMIT_REQUESTS = 20
AUTH_RATE_LIMIT_WINDOW = 60
_rate_limit_store: dict[str, list[datetime]] = defaultdict(list)
_rate_lock = asyncio.Lock()


async def _check_rate_limit(client_ip: str) -> None:
	async with _rate_lock:
		now = datetime.utcnow()
		window_start = now - timedelta(seconds=AUTH_RATE_LIMIT_WINDOW)
		recent = [ts for ts in _rate_limit_store[client_ip] if ts > window_start]
		_rate_limit_store[client_ip] = recent
		if len(recent) >= AUTH_RATE_LIMIT_REQUESTS:
			raise HTTPException(
				status_code=status.HTTP_429_TOO_MANY_REQUESTS,
				detail="Too many authentication attempts. Please wait a moment.",
			)
		recent.append(now)


def _normalize_email(email: str) -> str:
	return email.strip().lower()


def _client_ip(request: Request) -> str:
	return (request.client.host if request.client else "unknown") or "unknown"


async def _get_user_by_email(db: AsyncSession, email: str) -> Optional[UserAccount]:
	result = await db.execute(select(UserAccount).where(UserAccount.email == email))
	return result.scalar_one_or_none()


async def _authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[UserAccount]:
	user = await _get_user_by_email(db, _normalize_email(email))
	if not user or not verify_password(password, user.hashed_password):
		return None
	return user


def _token_expiry_delta(remember_me: bool) -> timedelta:
	base_minutes = settings.access_token_expire_minutes
	if remember_me:
		return timedelta(minutes=min(base_minutes * 3, 60 * 24 * 14))  # cap at 14 days
	return timedelta(minutes=base_minutes)


def _serialize_user(user: UserAccount) -> UserResponse:
	return UserResponse.model_validate(user)


async def _touch_last_login(db: AsyncSession, user: UserAccount) -> None:
	user.last_login_at = datetime.utcnow()
	user.updated_at = datetime.utcnow()
	await db.commit()
	await db.refresh(user)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
	payload: UserCreate,
	request: Request,
	db: AsyncSession = Depends(get_async_session),
):
	"""Register a new user account with hashed password storage."""

	await _check_rate_limit(_client_ip(request))
	email = _normalize_email(str(payload.email))

	existing = await _get_user_by_email(db, email)
	if existing:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

	user = UserAccount(
		email=email,
		full_name=payload.full_name,
		hashed_password=get_password_hash(payload.password),
		is_active=payload.is_active,
	)

	db.add(user)
	await db.commit()
	await db.refresh(user)

	return _serialize_user(user)


@router.post("/login", response_model=LoginResponse)
async def login_user(
	payload: LoginRequest,
	request: Request,
	db: AsyncSession = Depends(get_async_session),
):
	"""Login with JSON credentials and receive a JWT plus profile payload."""

	await _check_rate_limit(_client_ip(request))
	user = await _authenticate_user(db, payload.email, payload.password)
	if not user:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
	if not user.is_active:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

	expires_delta = _token_expiry_delta(payload.remember_me)
	token = create_access_token(str(user.id), expires_delta=expires_delta, scope=payload.scope)
	await _touch_last_login(db, user)

	return LoginResponse(
		access_token=token,
		token_type="bearer",
		expires_in=int(expires_delta.total_seconds()),
		user=_serialize_user(user),
	)


@router.post("/token", response_model=Token)
async def login_via_oauth_form(
	request: Request,
	form_data: OAuth2PasswordRequestForm = Depends(),
	db: AsyncSession = Depends(get_async_session),
):
	"""OAuth2-compatible token endpoint used by the interactive docs."""

	await _check_rate_limit(_client_ip(request))
	user = await _authenticate_user(db, form_data.username, form_data.password)
	if not user:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
	if not user.is_active:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

	scope = " ".join(form_data.scopes) if form_data.scopes else "api"
	expires_delta = _token_expiry_delta(False)
	token = create_access_token(str(user.id), expires_delta=expires_delta, scope=scope)
	await _touch_last_login(db, user)

	return Token(access_token=token, token_type="bearer", expires_in=int(expires_delta.total_seconds()))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserAccount = Depends(get_current_active_user)) -> UserResponse:
	"""Return the authenticated user's profile."""

	return _serialize_user(current_user)
