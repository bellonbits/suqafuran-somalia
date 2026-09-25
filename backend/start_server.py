import uvicorn
import os

if __name__ == "__main__":
    print("🚀 Starting Suqafuran Backend for Mobile Access...")
    print("Point your phone to: http://192.168.100.16:8000/api/v1")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
