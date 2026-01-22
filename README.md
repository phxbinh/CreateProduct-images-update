# Demo Api server Backend Frontend
## BACKEND
Tạo API ở server
-> delete-user.js  
   |-> Xoá user ở Auth của supabase và trong table profiles  
-> change-role.js  
   |-> Thay đổi role của user trong table profiles  
-> users.js  
   |-> Lấy thông tin users trong bảng profiles  

## Tạo package.json để cài đặt dependencies
```json
{
  "name": "Backend Frontend",
  "private": true,
  "type": "module",
  "dependencies": {
    "@vercel/node": "^3.0.0",
    "@supabase/supabase-js": "^2.33.0"
  }
}
```

## Cài đặt Environment Variables
-> SUPABASE_URL (lấy API URL trong supabase)  
-> SUPABASE_SERVER_ROLE_KEY (lấy API server key trong supabase)
