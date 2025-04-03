# DreamStream - AI-stylised Video Streaming Platform

[![Website](https://img.shields.io/website?label=thedreamstream.io&style=for-the-badge&url=https%3A%2F%2Fwww.thedreamstream.io%2F)](https://www.thedreamstream.io/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?style=for-the-badge&logo=github)](https://github.com/DominiquePaul/dreamstream)

DreamStream is a cutting-edge video streaming platform that leverages AI technology to stylize live video streams in real-time. This innovative platform allows users to create and share unique, AI-generated video content, revolutionizing the way we interact with live streaming.

Check it out at [www.thedreamstream.io](https://www.thedreamstream.io/)!

[![Homepage Screenshot](readme_images/homepage_screenshot.png)](https://www.thedreamstream.io/)

### 1-Week Development Sprint Timeline

The following timeline outlines the key milestones achieved during our 1-week development sprint:

| Date | Goals Achieved |
|------|-----------------|
| Monday | (a) Researched img2img technology and selected a suitable network for implementation ✅</br>(b) Developed a basic class for style transfer ✅ |
| Tuesday | (a) Designed the infrastructure for live streaming ✅</br>(b) Created a minimal website with streamer and viewer interfaces ✅</br>(c) Deployed the website to a live URL and set up continuous deployment ✅</br>(d) Deployed a basic WebSocket server ✅</br>(e) Enabled users to create and view live streams via the website ✅ |
| Wednesday | ... |
| Thursday | ... |
| Friday | (a) Deployed the WebSocket server on modal.com for autoscaling capabilities ✅</br>(b) Integrated image transformations using H100 GPU on modal.com ✅ |
| Saturday | (a) Removed black patches between frames in the stream ✅</br>(b) Allowed users to specify prompts for image transformations ✅</br>(c) Optimized the speed of image transformations ✅ |
| Sunday | (a) Integrated lightning diffusion code into the modal.com deployment ✅</br>(b) Implemented registration and login for streamers ✅</br>(c) Enabled streamers to purchase credits for streaming via Stripe checkout ✅</br>(d) Added real screenshots and enhanced the app's UI ✅ |

# 🚀 Features Roadmap

### Upcoming Features

- [ ] Implement real-time chat functionality for each stream
- [ ] Display the number of viewers for each stream to streamers
- [ ] Users can request style and streamer can accept/decline OR streamer can set auto-accept
- [ ] Streamers can set a theme, e.g. "90s TV shows" and set the prompt to change every 120 seconds. 
- [ ] Streamers can export all frames/timelapse of all frames after download
- [ ] Better SEO

### Future Development Ideas

- Develop an admin dashboard for seeing usage stats
- Introduce audio streaming capabilities
- Enable live streaming from raspberry pi devices

### Long-term Vision

- Allow users to utilize the platform as middleware for streaming to other platforms (e.g., YouTube, Twitch)
- Explore the possibility of supporting multiple camera streams simultaneously, enabling unique streaming effects not achievable with a single camera

### Product Showcase

Here's a glimpse of what DreamStream can do:

[![Stream Example Original](readme_images/stream_example_original.png)](https://www.thedreamstream.io/) → **Adjusts to the structure of people and movements in your video** → [![Stream Example Augmented](readme_images/stream_example_augmented.png)](https://www.thedreamstream.io/)



Collection of things I want to take a closer look at to improve the model speed
- https://github.com/chengzeyi/stable-fast