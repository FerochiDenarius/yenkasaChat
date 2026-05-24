from fastapi import FastAPI

from wallet import WalletService


app = FastAPI()
wallet_service = WalletService()


@app.get("/wallet/{user_id}")
async def read_wallet(user_id: str) -> dict:
    balance = wallet_service.fetch_balance(user_id)
    return {"user_id": user_id, "balance": balance}
