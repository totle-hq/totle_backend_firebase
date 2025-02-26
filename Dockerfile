# Use an official Node.js runtime
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for better caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the Prisma directory explicitly
COPY prisma ./prisma

# Ensure Prisma schema files exist inside the container
RUN ls -l prisma/

# Generate Prisma Client for each schema
RUN npx prisma generate --schema=prisma/catalogSchema.prisma
RUN npx prisma generate --schema=prisma/userSchema.prisma

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Set the default command to start the application
CMD ["npm", "run", "dev"]
