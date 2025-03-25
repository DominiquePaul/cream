import modal

app = modal.App()
processing_queue = modal.Queue.from_name("processing_queue", create_if_missing=True)

image = modal.Image.debian_slim().pip_install("fastapi[standard]")

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def add_to_queue(content: dict):
    processing_queue.put(v={"prompt": content["prompt"], "img": content["img"]}, partition=content["stream_id"])
    return {"message": "Image added to queue"}


@app.function(image=image)
@modal.fastapi_endpoint()
def get_from_queue(stream_id: str):
    return processing_queue.get(partition=stream_id)
