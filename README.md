# Cream - Creative Video stream 


### Timeline:

| Date | Milestone |
|------|-----------|
| Monday | (a) Understand how well img2img could work and which network to use ✅</br>(b) Write simple class/function for style transfer ✅ |
| Tuesday | (a) design infrastructure for streaming ✅</br>(b) minimal website with streamer and viewer page ✅</br>(c) deploy website to live URL and set up CD ✅</br>(d) deploy vanilla webscoket server ✅</br>(e) Users can create and view livestream via website ✅ |
| Wednesday | ... |
| Thursday | ... |
| Friday | (a) Deploy websocket server on modal.com for autoscaling ✅</br>(b) apply image transformations to streamed images with H100 GPU on modal ✅|
| Saturday | (a) Remove black patches between frames in stream ✅</br>(b) Users can specify prompt for image transformation ✅</br>(c) improve speed of image transformations </br>(d) add registration/login for streamers </br>(e) streamers can purchase credits for streaming via stripe checkout |
| Sunday | (a) Prettify app </br>(b) Create docker image to run stream from raspberry pi </br>(c) [*buffer for anything else*] |


### Ideas for the near future

- [ ] Add audio streaming
- [ ] Livestream chat


### Ideas for the not-so-near future to keep in mind.
- Some users might want to just use it as middleware and stream to other platforms (X, youtube, twitch)
- Would be cool if you could stream with multiple cameras at the same time. Could this even enable streaming effects that wouldn't be possible with just one camera?