# WebSocket Server for Streaming App

This is a WebSocket server for the streaming application, designed to be deployed on Render.com.

## Local Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The server will run on `http://localhost:8080`.

## Deployment to Render.com

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service with the following settings:
   - **Name**: Choose a name for your service
   - **Environment**: Docker
   - **Build Command**: Leave empty
   - **Start Command**: Leave empty (Docker handles this)
   - **Root Directory**: `websocket-server` (your monorepo subfolder)
   - **Branch**: Your main branch
   - **Instance Type**: Free (for development) or Basic (for production)
   - **Region**: Choose the region closest to your users

4. Click "Create Web Service"

## Environment Variables

- `PORT`: The port on which the server will run (defaults to 8080)

## Usage

The WebSocket server handles connections for streaming video frames between broadcasters and viewers. 