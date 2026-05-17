import bcrypt
from datetime import datetime, timedelta
from jose import jwt
from app.core.config import settings

def get_password_hash(password: str) -> str:
    """
    Băm mật khẩu trực tiếp bằng thư viện `bcrypt` thay vì dùng `passlib`.
    (Tránh lỗi tương thích sập nguồn passlib 'bcrypt has no attribute __about__' trên Python 3.12/3.14).
    """
    # Chuyển chuỗi mật khẩu sang bytes
    password_bytes = password.encode('utf-8')
    # Tạo salt tự động
    salt = bcrypt.gensalt()
    # Băm mật khẩu
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Trả về dưới dạng string để lưu DB
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu thô so với mật khẩu đã băm trực tiếp qua bcrypt"""
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Khởi tạo JWT Token dùng làm tấm thẻ đăng nhập phân quyền cho API"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
