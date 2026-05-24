class WalletService:
    def __init__(self) -> None:
        self._balances = {"user-1": 250, "user-2": 425}

    def fetch_balance(self, user_id: str) -> int:
        return self._balances.get(user_id, 0)
