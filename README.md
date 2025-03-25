# Cream - Creative Video stream 


### Timeline:

| Date | Milestone |
|------|-----------|
| Monday | (a) Understand how well img2img could work and which network to use ✅</br>(b) Write simple class/function for style transfer ✅ |
| Tuesday | (a) design infrastructure for streaming </br>(b) set up simple website with domain and CD </br>(c) simple streaming pipeline from a local python upload to streaming on nextjs app |
| Wednesday | (a) Create minimal home page </br>(b) Setup and connect supabase </br>(c) User can register and sign go through flow to start stream (no actual stream though). |
| Thursday | [Anticipating more work for the streaming part] |
| Friday | ... |
| Saturday | ... |
| Sunday | [Buffer time] |


Unassigned todos:
- [ ] Streaming upload page (NextJS)
- [ ] Streaming viewer page (NextJS)
- [ ] Raspberry pi container for upload

### Open questions:

- [ ] How will the streaming infra work exactly. Am I uploading a video or images? Am I using a streaming framework? What happens if processing takes longer than upload, how will I skip frames to catch up?
- [ ] Do I need some kind of password for uploading to ensure safety? 
- [ ] What if two sources try to upload at the same time?
- [ ] How can I create a new dynamic link for a stream to be viewed. 
- [x] Is audio streamed? -> I guess it could be an option unless disabled by the user


### Ideas for future to keep in mind
- Some users might want to just use it as middleware and stream to other platforms (X, youtube, twitch)
- Would be cool if you could stream with multiple cameras at the same time. Does this allow for new streaming effects not feasible with one camera?