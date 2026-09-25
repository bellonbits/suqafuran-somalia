from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session
from authlib.integrations.starlette_client import OAuth
from app.api import deps
from app.core.config import settings
from app.core import security
from app.crud import crud_user
from starlette.responses import RedirectResponse
from datetime import timedelta

router = APIRouter()

oauth = OAuth()

# Google Client
if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        }
    )

# GitHub Client
if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
    oauth.register(
        name='github',
        client_id=settings.GITHUB_CLIENT_ID,
        client_secret=settings.GITHUB_CLIENT_SECRET,
        access_token_url='https://github.com/login/oauth/access_token',
        access_token_params=None,
        authorize_url='https://github.com/login/oauth/authorize',
        authorize_params=None,
        api_base_url='https://api.github.com/',
        client_kwargs={'scope': 'user:email'},
    )

@router.get("/login/{provider}")
async def login_social(provider: str, request: Request):
    if provider not in ['google', 'github']:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    client = oauth.create_client(provider)
    if not client:
         raise HTTPException(status_code=400, detail=f"OAuth client for {provider} not configured")

    redirect_uri = request.url_for('auth_callback_provider', provider=provider)
    # If running behind a proxy or with custom ports, may need to adjust redirect_uri
    return await client.authorize_redirect(request, str(redirect_uri))

@router.get("/callback", name="auth_callback")
async def auth_callback(
    request: Request,
    response: Response,
    db: Session = Depends(deps.get_db)
) -> Any:
    # Starlette integration doesn't automatically know which client it was
    # Authlib stores state in session, so it should be fine to try both or just check session
    # However, usually we can pass provider in callback URL or rely on state
    
    # Simple way: Authlib's authorize_redirect stores state. 
    # Let's try to detect from state or just try both.
    
    # Better: Use a state-based detection if available, or just use the same callback for all
    # and Authlib handles the state validation.
    
    # We'll try to find which provider it was.
    provider = None
    if 'google' in request.query_params.get('state', ''): # Very hacky, authlib usually handles this
        provider = 'google'
    # Actually, authlib's starlette client handles this by checking the state in session.
    
    # We will try to authorize with 'google' first, then 'github' if that fails state check
    # But usually, it's better to have /auth/callback/{provider}
    
    # Let's refactor to have provider-specific callbacks for clarity
    raise HTTPException(status_code=400, detail="Use provider specific callback")

@router.get("/callback/{provider}", name="auth_callback_provider")
async def auth_callback_provider(
    provider: str,
    request: Request,
    response: Response,
    db: Session = Depends(deps.get_db)
) -> Any:
    if provider not in ['google', 'github']:
        raise HTTPException(status_code=400, detail="Invalid provider")
        
    client = oauth.create_client(provider)
    if not client:
         raise HTTPException(status_code=400, detail=f"OAuth client for {provider} not configured")

    try:
        token = await client.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")

    user_info = None
    if provider == 'google':
        user_info = token.get('userinfo')
    elif provider == 'github':
        resp = await client.get('user', token=token)
        user_data = resp.json()
        
        # GitHub might not return email in /user if it's private
        email = user_data.get('email')
        if not email:
            emails_resp = await client.get('user/emails', token=token)
            emails = emails_resp.json()
            # Find primary verified email
            primary_email = next((e['email'] for e in emails if e['primary'] and e['verified']), None)
            email = primary_email or emails[0]['email']
            
        user_info = {
            'email': email,
            'name': user_data.get('name') or user_data.get('login'),
            'picture': user_data.get('avatar_url')
        }

    if not user_info or not user_info.get('email'):
        raise HTTPException(status_code=400, detail="Failed to get user info from provider")

    email = user_info['email']
    full_name = user_info.get('name', '')
    
    user = crud_user.get_user_by_email(db, email=email)
    if not user:
        # Create new user
        user = crud_user.create_social_user(
            db, 
            email=email, 
            full_name=full_name,
            provider=provider
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Issue token
    access_token = security.create_session_token(db, user.id, request)
    
    # Potentially redirect to frontend with token in fragment or cookie
    # Since it's a browser redirect, we'll use a cookie or a redirect with token
    
    frontend_url = settings.CORS_ORIGINS[0] # Usually http://localhost:5173
    redirect_url = f"{frontend_url}/auth/callback?token={access_token}"
    
    # Or set cookie here
    response = RedirectResponse(url=redirect_url)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.SESSION_TOKEN_DAYS * 86400,
        expires=settings.SESSION_TOKEN_DAYS * 86400,
        samesite="lax",
        secure=False,
    )
    return response
