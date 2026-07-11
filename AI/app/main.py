from fastapi import FastAPI


app = FastAPI(title="Savanna Sentinel AI Service")


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Savanna Sentinel AI service is running"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}