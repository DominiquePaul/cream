# DreamStream - AI-stylised Video streaming


### Timeline:

| Date | Goal |
|------|-----------|
| Monday | (a) Understand how well img2img could work and which network to use ✅</br>(b) Write simple class/function for style transfer ✅ |
| Tuesday | (a) design infrastructure for streaming ✅</br>(b) minimal website with streamer and viewer page ✅</br>(c) deploy website to live URL and set up CD ✅</br>(d) deploy vanilla webscoket server ✅</br>(e) Users can create and view livestream via website ✅ |
| Wednesday | ... |
| Thursday | ... |
| Friday | (a) Deploy websocket server on modal.com for autoscaling ✅</br>(b) apply image transformations to streamed images with H100 GPU on modal ✅|
| Saturday | (a) Remove black patches between frames in stream ✅</br>(b) Users can specify prompt for image transformation ✅</br>(c) improve speed of image transformations ✅</br> |
| Sunday | (a) Integrate lightning diffusion code into modal.com deployment ✅</br>(b) add registration/login for streamers ✅</br>(c) streamers can purchase credits for streaming via stripe checkout </br>(d) Add real screenshots & prettify app </br>(e) Create docker image to run stream from raspberry pi </br> |


- Streamer can see stream output of themselves via a toggle
- Streamer can see number of viewers
- Streamer can enable users to submit style requests and either approve them or set them to auto-approve.
- Add some kind of admin dashboard for user analytics
  - How many streams created
  - How many different IPs tuned in
  - Most concurrent viewers

### Ideas for the near future

- [ ] Add audio streaming
- [ ] Livestream chat
- [ ] Save stream input and output images. -> This could make cool timelapses


### Ideas for the not-so-near future to keep in mind.
- Some users might want to just use it as middleware and stream to other platforms (X, youtube, twitch)
- Would be cool if you could stream with multiple cameras at the same time. Could this even enable streaming effects that wouldn't be possible with just one camera?