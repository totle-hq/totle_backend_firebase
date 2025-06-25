
# Redis Setup for Windows (TOTLE Project)

This guide explains how to install and run Redis locally on your Windows machine to support the TOTLE backend.

---

## ✅ Step 1: Download Redis (Windows-Compatible)

1. Go to the official Redis for Windows community port:  
   👉 https://github.com/tporadowski/redis/releases

2. Download the latest `.zip` version (e.g., `redis-x64-7.x.x.zip`)

3. Extract it to a convenient location, e.g.:
   ```
   C:\redis
   ```

---

## ✅ Step 2: Add Redis to desktop (Optional for Local Use Only)

If you're the only dev on the project and just want convenience:

1. Move the extracted contents (from step 1) to your project folder like:
   ```
   /your-project-root/redis/
   ```

2. Place the `start_redis.bat` (provided) on the desktop.

---

## ✅ Step 3: Start Redis Server

1. Double-click `start_redis.bat`  
   This will start the Redis server in a new terminal window.



## 🔄 Optional: Auto-start Redis on System Boot

1. Press `Win + R`, type:
   ```
   shell:startup
   ```

2. Place a shortcut to `start_redis.bat` in that folder.

This will auto-start Redis every time you log in to your PC.

---

## ✅ You're Done!