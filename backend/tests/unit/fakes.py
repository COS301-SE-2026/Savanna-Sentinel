"""Shared fakes used across unit tests."""


class FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}

    async def set(self, key, value, ex=None):  # NOSONAR
        self.store[key] = value

    async def get(self, key):  # NOSONAR
        return self.store.get(key)

    async def incr(self, key):  # NOSONAR
        value = int(self.store.get(key, "0")) + 1
        self.store[key] = str(value)
        return value

    async def expire(self, key, seconds):  # NOSONAR
        return key in self.store

    async def delete(self, key):  # NOSONAR
        self.store.pop(key, None)

    async def exists(self, key):  # NOSONAR
        return key in self.store
