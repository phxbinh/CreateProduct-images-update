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

## Thêm vercel.json
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

## Mở rộng vercel.json
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],

  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Headers", "value": "authorization, content-type, x-requested-with" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, PATCH, OPTIONS" },
        { "key": "Access-Control-Max-Age", "value": "86400" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    }
  ]
}
```

## Mở rộng 2 vercel.json
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],

  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Headers", "value": "authorization, content-type" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```



