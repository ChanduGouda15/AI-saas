# CreatorHub

CreatorHub is a full-stack AI-powered content generation platform for creating articles, images, and more using integrated AI APIs.

## Installation

Clone the repository and install dependencies for both client and server.

```bash
# Clone the repository
git clone https://github.com/yourusername/creatorhub.git
cd creatorhub

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

```
## Environment Setup

Create .env files in both server and client directories.

```bash
#Server (.env)
DATABASE_URL=your_neon_postgresql_url
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
GEMINI_API_KEY=your_gemini_key
CLIPDROP_API_KEY=your_clipdrop_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=3000

#Client (.env)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_BASE_URL=http://localhost:3000

#Database Setup
Run this SQL in your PostgreSQL database:

CREATE TABLE creations (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  publish BOOLEAN DEFAULT FALSE,
  likes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creations_user_id ON creations(user_id);
CREATE INDEX idx_user_date ON creations(user_id, created_at DESC);
```
## Usage



```bash
# Start the backend server:
cd server
npm start

# Start the frontend:
cd client
npm run dev

# Open your browser and navigate to:
http://localhost:5173

```
# Features

1) Article generation with customizable length

2) Blog title generation across 8 categories

3) Image generation in multiple styles

4) Background removal from images

5) Object removal from images

6) Resume review with AI feedback

7) Community gallery with likes

# Tech Stack

1) Frontend: React, Vite, Tailwind CSS, Clerk React

2) Backend: Node.js, Express, PostgreSQL, Neon

3) APIs: OpenAI Gemini, Clipdrop, Cloudinary




