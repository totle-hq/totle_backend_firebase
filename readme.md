## Requirements

npm install @prisma/client pg firebase-admin bcryptjs jsonwebtoken passport express-rate-limit
npm install --save-dev nodemon prisma eslint prettier
npx prisma init
npm install firebase-admin

npx prisma migrate dev --name init => to create the tables/update the modified changes in db

npx prisma generate => generate prisma client to query the db

# Run the code:
npm run dev

# migrate => update the database, but renaming causes total data loss
=================
npm run migrate:user --name "details of migration"
npm run migrate:catalog --name "details of migration"


# generate => creates prisma client for prisma.user.findMany()
npm run generate:user
npm run generate:catalog

npm run studio:user
npm run studio:catalog

# delete all data => npm run prisma:reset