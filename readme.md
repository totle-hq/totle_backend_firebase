## Requirements

npm install @prisma/client pg firebase-admin bcryptjs jsonwebtoken passport express-rate-limit multer
npm install --save-dev nodemon prisma eslint prettier
npx prisma init
npm install firebase-admin

npx prisma migrate dev --name init => to create the tables/update the modified changes in db

npx prisma generate => generate prisma client to query the db

# Run the code:
npm run dev

# migrate => update the database, but renaming causes total data loss
=================
npm run migrate:user  "details of migration"
npm run migrate:catalog  "details of migration"


# generate => creates prisma client for prisma.user.findMany()
npm run generate:user
npm run generate:catalog

npm run studio:user
npm run studio:catalog

# delete all data => npm run prisma:reset


## API - Local
===============

1.   localhost:5000/auth/signup

{
    "email":"2493saicharan@gmail.com"
}

2. localhost:5000/auth/signup/verifyOtp

{
    "email":"2493saicharan@gmail.com",
    "otp":311644,
    "password": "123",
    "firstName":"sai"
}

3.   localhost:5000/auth/signup/complete

{
  "preferredLanguage": "Telugu",
  "knownLanguages": ["English", "Hindi"],
  "email": "2493saicharan@gmail.com"
}


4. localhost:5000/auth/login

{
    "email": "2493saicharan@gmail.com",
    "password": "123"
}

5. [localhost:5000/auth/verifyToken]

6. [localhost:5000/admin/auth/me]

## Super Admin creation
1. nodemon .\src\controllers\superAdmin.controller.js
2. ctrl + c

## Mock Super Admin credentials:
email: admin@totle.com
password: Admin@123
name: Admin mawa